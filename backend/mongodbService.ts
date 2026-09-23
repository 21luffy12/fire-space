import { MongoClient, Db, Collection } from 'mongodb';
import { FireObservation, FireCluster } from './types';

let client: MongoClient | null = null;
let db: Db | null = null;
let connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR' = 'DISCONNECTED';
let lastError: string | null = null;
let lastPingMs: number = 0;
let customMongoUri: string = process.env.MONGODB_URI || 'mongodb+srv://amanc8399_db_user:uJ2qMP48cc1QsUR@cluster0.nqut7o4.mongodb.net/';

export function getMongoUri(): string {
  return customMongoUri;
}

export function setMongoUri(uri: string): void {
  customMongoUri = uri.trim();
}

export function getMongoStatus() {
  return {
    status: connectionStatus,
    uriMasked: customMongoUri ? customMongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') : '',
    hasUri: !!customMongoUri,
    lastPingMs,
    lastError
  };
}

/**
 * Initializes and connects to MongoDB with resilient fallback
 */
export async function connectMongoDB(overrideUri?: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const uri = overrideUri || customMongoUri || process.env.MONGODB_URI;

  if (!uri) {
    connectionStatus = 'DISCONNECTED';
    return {
      success: false,
      message: 'No MongoDB URI configured. Using high-performance in-memory spatial index.'
    };
  }

  connectionStatus = 'CONNECTING';
  const t0 = Date.now();

  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
    }

    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });

    await client.connect();
    db = client.db('fire_space');

    // Ping admin database
    await db.command({ ping: 1 });
    lastPingMs = Date.now() - t0;
    connectionStatus = 'CONNECTED';
    lastError = null;

    // Ensure 2dsphere geospatial indexes
    await ensureSpatialIndexes();

    console.log(`[MongoDB] Connected successfully to 'fire_space' (${lastPingMs}ms). 2dsphere indexes verified.`);
    return {
      success: true,
      message: `Connected to MongoDB database 'fire_space'`,
      latencyMs: lastPingMs
    };
  } catch (err: any) {
    connectionStatus = 'ERROR';
    lastError = err.message || 'MongoDB connection failed';
    console.warn('[MongoDB] Connection error (using in-memory operational store):', err.message);
    return {
      success: false,
      message: err.message || 'Failed to connect to MongoDB'
    };
  }
}

/**
 * Creates 2dsphere geospatial and compound indexes
 */
export async function ensureSpatialIndexes(): Promise<void> {
  if (!db) return;

  try {
    const obsCol = db.collection('fire_observations');
    await obsCol.createIndex({ geometry: '2dsphere' });
    await obsCol.createIndex({ acquisitionDate: -1, fireRadiativePower: -1 });
    await obsCol.createIndex({ clusterId: 1 });

    const clusterCol = db.collection('fire_clusters');
    await clusterCol.createIndex({ 'center.latitude': 1, 'center.longitude': 1 });
    await clusterCol.createIndex({ riskLevel: 1 });
    await clusterCol.createIndex({ detectedAt: -1 });

    console.log('[MongoDB] 2dsphere spatial indexes established for fire_observations & fire_clusters.');
  } catch (err) {
    console.warn('[MongoDB] Index creation warning:', err);
  }
}

/**
 * Persists raw observations into MongoDB with bulk upsert
 */
export async function persistObservationsToMongo(observations: FireObservation[]): Promise<number> {
  if (!db || connectionStatus !== 'CONNECTED' || observations.length === 0) {
    return 0;
  }

  try {
    const col = db.collection('fire_observations');
    const bulk = col.initializeUnorderedBulkOp();

    for (const obs of observations) {
      bulk.find({ id: obs.id }).upsert().replaceOne({
        ...obs,
        geometry: {
          type: 'Point',
          coordinates: [obs.longitude, obs.latitude]
        },
        syncedAt: new Date()
      });
    }

    const res = await bulk.execute();
    return res.upsertedCount + res.modifiedCount;
  } catch (err) {
    console.warn('[MongoDB] Batch persist error:', err);
    return 0;
  }
}

/**
 * Persists clustered complexes into MongoDB
 */
export async function persistClustersToMongo(clusters: FireCluster[]): Promise<number> {
  if (!db || connectionStatus !== 'CONNECTED' || clusters.length === 0) {
    return 0;
  }

  try {
    const col = db.collection('fire_clusters');
    const bulk = col.initializeUnorderedBulkOp();

    for (const c of clusters) {
      bulk.find({ clusterId: c.clusterId }).upsert().replaceOne({
        ...c,
        syncedAt: new Date()
      });
    }

    const res = await bulk.execute();
    return res.upsertedCount + res.modifiedCount;
  } catch (err) {
    console.warn('[MongoDB] Clusters persist error:', err);
    return 0;
  }
}

/**
 * Executes a MongoDB 2dsphere $near geospatial radius query
 */
export async function queryMongoByRadius(lat: number, lon: number, radiusKm: number): Promise<FireObservation[]> {
  if (!db || connectionStatus !== 'CONNECTED') {
    return [];
  }

  try {
    const col = db.collection<FireObservation>('fire_observations');
    const radiusMeters = radiusKm * 1000;

    const results = await col.find({
      geometry: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          },
          $maxDistance: radiusMeters
        }
      }
    }).limit(100).toArray();

    return results;
  } catch (err) {
    console.warn('[MongoDB] Radius query error:', err);
    return [];
  }
}

/**
 * Retrieves database statistics from MongoDB
 */
export async function getMongoStats(): Promise<any> {
  if (!db || connectionStatus !== 'CONNECTED') {
    return {
      connected: false,
      collections: { observations: 0, clusters: 0 },
      status: connectionStatus,
      lastError
    };
  }

  try {
    const obsCount = await db.collection('fire_observations').countDocuments();
    const clusterCount = await db.collection('fire_clusters').countDocuments();

    return {
      connected: true,
      database: 'fire_space',
      collections: {
        observations: obsCount,
        clusters: clusterCount
      },
      indexes: [
        'fire_observations.geometry (2dsphere)',
        'fire_observations.acquisitionDate_-1_fireRadiativePower_-1',
        'fire_clusters.riskLevel_1'
      ],
      lastPingMs
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message
    };
  }
}

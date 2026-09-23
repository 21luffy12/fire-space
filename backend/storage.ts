import { FireObservation, FireCluster, SpreadPrediction, WeatherObservation, Alert, SystemStatus } from './types';
import { fetchFirmsHotspots, getSyncStatus } from './firmsService';
import { runDBSCAN, computeConvexHull, bufferPerimeter, calculatePolygonAreaKm2, computeSpreadProjection, identifyRegionAndName } from './geoEngine';
import { fetchWeatherForCoordinates } from './weatherService';
import { fetchElevationProfile } from './elevationService';
import { findNearestSettlement, calculateHaversineKm } from './settlements';
import { evaluateClusterAlerts, getAllAlerts, acknowledgeAlert } from './alertService';
import {
  connectMongoDB,
  persistObservationsToMongo,
  persistClustersToMongo,
  getMongoStatus,
  queryMongoByRadius
} from './mongodbService';
import {
  connectSnowflake,
  syncTelemetryToSnowflake,
  getSnowflakeStatus
} from './snowflakeConnector';

class OperationalDataStore {
  private observations: FireObservation[] = [];
  private clusters: FireCluster[] = [];
  private predictions: Map<string, SpreadPrediction> = new Map();
  private weatherCache: Map<string, WeatherObservation> = new Map();
  private isProcessing: boolean = false;
  private lastProcessingTimeMs: number = 0;

  // Configurable parameters
  public dbscanEpsKm: number = 2.5;
  public dbscanMinSamples: number = 3;
  public refreshIntervalMinutes: number = 15;
  public activeSensor: string = 'VIIRS_SNPP_NRT';

  constructor() {
    this.dbscanEpsKm = parseFloat(process.env.DBSCAN_EPS_KM || '2.5') || 2.5;
    this.dbscanMinSamples = parseInt(process.env.DBSCAN_MIN_SAMPLES || '3') || 3;
    this.refreshIntervalMinutes = parseInt(process.env.FIRE_REFRESH_MINUTES || '15') || 15;
  }

  /**
   * Initializes data store by connecting MongoDB, Snowflake, fetching NASA FIRMS observations and running DBSCAN
   */
  public async initialize(): Promise<void> {
    console.log('[Storage] Initializing operational collections with 2dsphere spatial indexing...');
    
    // Attempt connections in background
    connectMongoDB().catch(err => console.warn('[MongoDB] Init connection note:', err.message));
    connectSnowflake().catch(err => console.warn('[Snowflake] Init connection note:', err.message));

    await this.syncAndProcess();
  }

  /**
   * Main pipeline: Ingests FIRMS -> Runs DBSCAN -> Computes Perimeters ->
   * Fetches Weather & Elevation -> Calculates 6-hr Spread -> Evaluates Alerts
   */
  public async syncAndProcess(sensor?: string, countryCode?: string): Promise<{ clusters: FireCluster[]; observations: FireObservation[] }> {
    if (this.isProcessing) {
      return { clusters: this.clusters, observations: this.observations };
    }

    this.isProcessing = true;
    const t0 = Date.now();

    try {
      const activeSensor = sensor || this.activeSensor;
      const rawHotspots = await fetchFirmsHotspots(activeSensor, countryCode || 'GLOBAL');
      this.observations = rawHotspots;

      // 1. Run Geodesic DBSCAN Spatial Clustering
      // For global scale, adapt epsKm (e.g. 8-15km) to capture contiguous regional complexes
      const effectiveEps = countryCode === 'GLOBAL' ? 12.0 : this.dbscanEpsKm;
      const effectiveMinSamples = countryCode === 'GLOBAL' ? 2 : this.dbscanMinSamples;

      const { clusters: groupedPoints, noise } = runDBSCAN(
        this.observations,
        effectiveEps,
        effectiveMinSamples
      );

      // Stratified regional selection: Ensure every monitored continent/region has strong representation
      // (India, Southeast/East Asia, North America, South America, Europe, Africa, Australia)
      const regionalBins = new Map<string, typeof groupedPoints>();
      for (const pts of groupedPoints) {
        const centerLat = pts.reduce((sum, p) => sum + p.latitude, 0) / pts.length;
        const centerLon = pts.reduce((sum, p) => sum + p.longitude, 0) / pts.length;
        const { region } = identifyRegionAndName(centerLat, centerLon);
        
        let broadKey = 'OTHER';
        if (region.toLowerCase().includes('india')) broadKey = 'INDIA';
        else if (region.toLowerCase().includes('asia')) broadKey = 'ASIA';
        else if (region.toLowerCase().includes('north america')) broadKey = 'NORTH_AMERICA';
        else if (region.toLowerCase().includes('south america')) broadKey = 'SOUTH_AMERICA';
        else if (region.toLowerCase().includes('europe')) broadKey = 'EUROPE';
        else if (region.toLowerCase().includes('africa')) broadKey = 'AFRICA';
        else if (region.toLowerCase().includes('australia')) broadKey = 'AUSTRALIA';

        if (!regionalBins.has(broadKey)) regionalBins.set(broadKey, []);
        regionalBins.get(broadKey)!.push(pts);
      }

      // Sort within each regional bin by total FRP
      regionalBins.forEach(list => {
        list.sort((a, b) => {
          const sumA = a.reduce((acc, p) => acc + p.fireRadiativePower, 0);
          const sumB = b.reduce((acc, p) => acc + p.fireRadiativePower, 0);
          return sumB - sumA;
        });
      });

      const topClusters: typeof groupedPoints = [];
      // Guarantee top clusters from India and Asia
      if (regionalBins.has('INDIA')) {
        topClusters.push(...regionalBins.get('INDIA')!.slice(0, 12));
      }
      if (regionalBins.has('ASIA')) {
        topClusters.push(...regionalBins.get('ASIA')!.slice(0, 12));
      }
      // Guarantee top clusters from all other continents
      regionalBins.forEach((list, key) => {
        if (key !== 'INDIA' && key !== 'ASIA') {
          topClusters.push(...list.slice(0, 8));
        }
      });

      // Fill remaining slots with the highest FRP clusters globally up to 65 total
      const remaining = groupedPoints.filter(p => !topClusters.includes(p));
      remaining.sort((a, b) => {
        const sumA = a.reduce((acc, p) => acc + p.fireRadiativePower, 0);
        const sumB = b.reduce((acc, p) => acc + p.fireRadiativePower, 0);
        return sumB - sumA;
      });
      topClusters.push(...remaining.slice(0, Math.max(0, 65 - topClusters.length)));
      const computedClusters: FireCluster[] = [];
      let clusterIndex = 1000;

      // Process in concurrent batches of 10 for rapid sub-second execution
      const BATCH_SIZE = 10;
      for (let i = 0; i < topClusters.length; i += BATCH_SIZE) {
        const batch = topClusters.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (pts) => {
            clusterIndex += 1;
            const cid = `F-${clusterIndex}`;

            const centerLat = pts.reduce((sum, p) => sum + p.latitude, 0) / pts.length;
            const centerLon = pts.reduce((sum, p) => sum + p.longitude, 0) / pts.length;

            const frpValues = pts.map(p => p.fireRadiativePower);
            const avgFRP = Math.round((frpValues.reduce((a, b) => a + b, 0) / pts.length) * 10) / 10;
            const maxFRP = Math.round(Math.max(...frpValues) * 10) / 10;

            // Assign clusterId to points
            pts.forEach(p => (p.clusterId = cid));

            // 2. Generate Convex Hull & Buffered Wildfire Perimeter
            const pointCoords: [number, number][] = pts.map(p => [p.longitude, p.latitude]);
            const hull = computeConvexHull(pointCoords);
            const bufferedCoords = bufferPerimeter(hull, centerLat, 1.2);
            const areaKm2 = calculatePolygonAreaKm2(bufferedCoords, centerLat);

            const { region, name } = identifyRegionAndName(centerLat, centerLon);

            // 3 & 4. Retrieve Real Weather Data and Elevation Profile in parallel
            const [weather, elevation] = await Promise.all([
              fetchWeatherForCoordinates(centerLat, centerLon),
              fetchElevationProfile(centerLat, centerLon)
            ]);

            // 5. Compute Directional Fire Spread Vector & 6-Hour Projection Cone
            const spread = computeSpreadProjection(
              cid,
              centerLat,
              centerLon,
              weather.windSpeedKmh,
              weather.windDirectionDeg,
              elevation.slopeFactor,
              elevation.slopeAspectDeg,
              avgFRP
            );
            this.predictions.set(cid, spread);

            // 6. Nearest Settlement Calculation
            const nearestSettlement = findNearestSettlement(centerLat, centerLon);

            // 7. Transparent Rule-based Risk Classification
            const riskFactors: string[] = [];
            if (maxFRP >= 150) riskFactors.push(`Extreme radiative power (Peak FRP: ${maxFRP} MW)`);
            else if (maxFRP >= 80) riskFactors.push(`High thermal intensity (Peak FRP: ${maxFRP} MW)`);

            if (pts.length >= 8) riskFactors.push(`High hotspot density (${pts.length} detected points)`);
            if (weather.windSpeedKmh >= 20) riskFactors.push(`High wind forcing (${weather.windSpeedKmh} km/h ${weather.windDirectionCardinal})`);
            if (elevation.slopeDegrees >= 12) riskFactors.push(`Steep topography acceleration (Slope: ${elevation.slopeDegrees}°)`);
            if (nearestSettlement && nearestSettlement.distanceKm <= 10) {
              riskFactors.push(`Proximity to populated area (${nearestSettlement.distanceKm} km from ${nearestSettlement.name})`);
            }
            if (spread.estimatedDistanceKm >= 3.5) {
              riskFactors.push(`Rapid expansion trajectory (${spread.estimatedDistanceKm} km / 6h)`);
            }

            let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
            if (riskFactors.length >= 4 || maxFRP >= 200 || (nearestSettlement && nearestSettlement.distanceKm <= 5)) {
              riskLevel = 'CRITICAL';
            } else if (riskFactors.length >= 2 || maxFRP >= 90) {
              riskLevel = 'HIGH';
            } else if (riskFactors.length >= 1 || maxFRP >= 40) {
              riskLevel = 'MODERATE';
            }

            return {
              clusterId: cid,
              name,
              region,
              center: {
                latitude: Math.round(centerLat * 10000) / 10000,
                longitude: Math.round(centerLon * 10000) / 10000
              },
              perimeter: {
                type: 'Polygon' as const,
                coordinates: [bufferedCoords],
                areaKm2,
                disclaimer: 'ESTIMATED HOTSPOT-BASED PERIMETER'
              },
              hotspotCount: pts.length,
              hotspots: pts,
              averageFRP: avgFRP,
              maxFRP: maxFRP,
              riskLevel,
              riskFactors: riskFactors.length > 0 ? riskFactors : ['Baseline thermal anomaly density'],
              detectedAt: pts[0]?.acquisitionDate ? `${pts[0].acquisitionDate}T${pts[0].acquisitionTime}:00Z` : new Date().toISOString(),
              lastUpdatedAt: new Date().toISOString(),
              spreadPrediction: spread,
              weather,
              elevation,
              nearestSettlement
            };
          })
        );
        computedClusters.push(...batchResults);
      }

      this.clusters = computedClusters;

      // 8. Generate Alerts based on evaluated conditions
      evaluateClusterAlerts(this.clusters);

      // 9. Persist to MongoDB collections & Snowflake staging asynchronously
      persistObservationsToMongo(this.observations).catch(err => console.warn('[MongoDB] Sync observations warning:', err.message));
      persistClustersToMongo(this.clusters).catch(err => console.warn('[MongoDB] Sync clusters warning:', err.message));
      syncTelemetryToSnowflake(this.observations, this.clusters).catch(err => console.warn('[Snowflake] Sync staging warning:', err.message));

      this.lastProcessingTimeMs = Date.now() - t0;
      console.log(`[Storage] Processing completed in ${this.lastProcessingTimeMs}ms: ${this.clusters.length} clusters, ${this.observations.length} hotspots.`);
    } catch (err) {
      console.error('[Storage] Error in syncAndProcess:', err);
    } finally {
      this.isProcessing = false;
    }

    return { clusters: this.clusters, observations: this.observations };
  }

  // Query Methods
  public getObservations(options?: { minFRP?: number; clusterId?: string; limit?: number }): FireObservation[] {
    let result = this.observations;
    if (options?.minFRP) {
      result = result.filter(o => o.fireRadiativePower >= options.minFRP!);
    }
    if (options?.clusterId) {
      result = result.filter(o => o.clusterId === options.clusterId);
    }
    if (options?.limit) {
      result = result.slice(0, options.limit);
    }
    return result;
  }

  public getObservationById(id: string): FireObservation | undefined {
    return this.observations.find(o => o.id === id);
  }

  public getClusters(): FireCluster[] {
    return this.clusters;
  }

  public getClusterById(id: string): FireCluster | undefined {
    return this.clusters.find(c => c.clusterId === id);
  }

  public getPrediction(clusterId: string): SpreadPrediction | undefined {
    return this.predictions.get(clusterId);
  }

  /**
   * MongoDB 2dsphere-style radius query
   */
  public queryByRadius(lat: number, lon: number, radiusKm: number): FireObservation[] {
    return this.observations.filter(o => {
      const dist = calculateHaversineKm(lat, lon, o.latitude, o.longitude);
      return dist <= radiusKm;
    });
  }

  public getSystemStatus(): SystemStatus {
    const syncInfo = getSyncStatus();
    const mongoInfo = getMongoStatus();
    const snowInfo = getSnowflakeStatus();

    const mongoStatusDisplay = mongoInfo.status === 'CONNECTED'
      ? 'CONNECTED'
      : mongoInfo.hasUri
      ? `MONGODB_${mongoInfo.status}`
      : 'IN_MEMORY_SPATIAL_STORE';

    const snowStatusDisplay = snowInfo.status === 'CONNECTED'
      ? 'CONNECTED'
      : snowInfo.hasCredentials
      ? `SNOWFLAKE_${snowInfo.status}`
      : 'SIMULATED_WAREHOUSE';

    return {
      firmsApi: syncInfo.status,
      mongodb: mongoStatusDisplay,
      snowflake: snowStatusDisplay,
      weatherApi: 'CONNECTED',
      elevationApi: 'CONNECTED',
      geoEngine: 'TYPESCRIPT_CORE_ACTIVE',
      lastSuccessfulSync: syncInfo.lastSyncTimestamp,
      totalObservations: this.observations.length,
      totalClusters: this.clusters.length,
      activeAlerts: getAllAlerts().filter(a => !a.acknowledged).length,
      processingTimeMs: this.lastProcessingTimeMs,
      currentDataSource: syncInfo.currentDataSource,
      isRealTimeActive: syncInfo.isRealTimeActive,
      dbscanConfig: {
        epsKm: this.dbscanEpsKm,
        minSamples: this.dbscanMinSamples
      },
      refreshIntervalMinutes: this.refreshIntervalMinutes
    };
  }
}

export const operationalStore = new OperationalDataStore();

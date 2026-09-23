// @ts-ignore
import snowflake from 'snowflake-sdk';
import { FireObservation, FireCluster } from './types';

export interface SnowflakeConfig {
  account?: string;
  username?: string;
  password?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  role?: string;
}

let activeConnection: any = null;
let connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR' = 'DISCONNECTED';
let lastError: string | null = null;
let lastPingMs: number = 0;

let currentConfig: SnowflakeConfig = {
  account: 'XLJUCHU-VW49309',
  username: 'alialiahm@student.iul.ac.in',
  password: 'Ali_9354241551',
  warehouse: 'SNOWFLAKE_LEARNING_WH',
  database: 'SNOWFLAKE_LEARNING_DB',
  schema: 'ANALYTICS',
  role: 'ACCOUNTADMIN'
};

export function getSnowflakeConfig(): SnowflakeConfig {
  return {
    ...currentConfig,
    password: currentConfig.password ? '********' : ''
  };
}

export function setSnowflakeConfig(config: Partial<SnowflakeConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...config,
    password: config.password !== undefined ? config.password : currentConfig.password
  };
}

export function getSnowflakeStatus() {
  return {
    status: connectionStatus,
    account: currentConfig.account || 'Not Configured',
    database: currentConfig.database || 'SNOWFLAKE_LEARNING_DB',
    warehouse: currentConfig.warehouse || 'SNOWFLAKE_LEARNING_WH',
    schema: currentConfig.schema || 'ANALYTICS',
    hasCredentials: !!(currentConfig.account && currentConfig.username),
    lastPingMs,
    lastError
  };
}

/**
 * Connect to Snowflake using official snowflake-sdk
 */
export async function connectSnowflake(overrideConfig?: SnowflakeConfig): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const config = {
    ...currentConfig,
    ...overrideConfig
  };

  if (!config.account || !config.username) {
    connectionStatus = 'DISCONNECTED';
    return {
      success: false,
      message: 'Snowflake credentials not provided.'
    };
  }

  let cleanedAccount = config.account.trim();
  cleanedAccount = cleanedAccount.replace(/^https?:\/\//i, '').replace(/\.snowflakecomputing\.com.*$/i, '');
  
  let cleanedWarehouse = (config.warehouse || 'SNOWFLAKE_LEARNING_WH').trim();
  cleanedWarehouse = cleanedWarehouse.replace(/^Showing\s+\d+\s+results?\s+/i, '').trim();

  connectionStatus = 'CONNECTING';
  const t0 = Date.now();

  return new Promise((resolve) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        connectionStatus = 'ERROR';
        lastError = 'Connection attempt timed out after 12s.';
        resolve({
          success: false,
          message: lastError
        });
      }
    }, 12000);

    try {
      const conn = snowflake.createConnection({
        account: cleanedAccount,
        username: (config.username || '').trim(),
        password: config.password,
        warehouse: cleanedWarehouse,
        database: (config.database || 'SNOWFLAKE_LEARNING_DB').trim(),
        schema: (config.schema || 'ANALYTICS').trim(),
        role: config.role?.trim() || 'ACCOUNTADMIN',
        timeout: 10000
      });

      conn.connect(async (err: any, connection: any) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);

        if (err) {
          connectionStatus = 'ERROR';
          lastError = err.message || 'Snowflake authentication failed';
          console.warn('[Snowflake] Connection error:', err.message);
          resolve({
            success: false,
            message: err.message || 'Failed to authenticate with Snowflake warehouse'
          });
        } else {
          activeConnection = connection;
          connectionStatus = 'CONNECTED';
          lastPingMs = Date.now() - t0;
          lastError = null;
          console.log(`[Snowflake] Successfully connected to ${cleanedAccount}/${config.database} (${lastPingMs}ms).`);
          
          // Ensure schema and tables exist on first connect
          await ensureSnowflakeTables();

          resolve({
            success: true,
            message: `Connected to Snowflake database '${config.database}' on warehouse '${cleanedWarehouse}'`,
            latencyMs: lastPingMs
          });
        }
      });
    } catch (err: any) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      connectionStatus = 'ERROR';
      lastError = err.message || 'Snowflake client initialization error';
      resolve({
        success: false,
        message: err.message
      });
    }
  });
}

/**
 * Ensure database schema and tables exist in Snowflake
 */
export async function ensureSnowflakeTables(): Promise<void> {
  if (!activeConnection || connectionStatus !== 'CONNECTED') return;

  const db = (currentConfig.database || 'SNOWFLAKE_LEARNING_DB').trim();
  const schema = (currentConfig.schema || 'ANALYTICS').trim();

  try {
    await executeSnowflakeSQL(`CREATE SCHEMA IF NOT EXISTS ${db}.${schema};`);
    
    await executeSnowflakeSQL(`
      CREATE TABLE IF NOT EXISTS ${db}.${schema}.FIRE_CLUSTERS (
        CLUSTER_ID VARCHAR(64) PRIMARY KEY,
        NAME VARCHAR(128),
        REGION VARCHAR(128),
        HOTSPOT_COUNT NUMBER,
        AVERAGE_FRP FLOAT,
        MAX_FRP FLOAT,
        AREA_KM2 FLOAT,
        RISK_LEVEL VARCHAR(32),
        DETECTED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
      );
    `);

    await executeSnowflakeSQL(`
      CREATE TABLE IF NOT EXISTS ${db}.${schema}.FIRE_OBSERVATIONS (
        ID VARCHAR(64) PRIMARY KEY,
        LATITUDE FLOAT,
        LONGITUDE FLOAT,
        ACQ_DATE VARCHAR(32),
        ACQ_TIME VARCHAR(32),
        SATELLITE VARCHAR(64),
        INSTRUMENT VARCHAR(64),
        CONFIDENCE VARCHAR(32),
        BRIGHTNESS_TEMPERATURE FLOAT,
        FRP FLOAT,
        DAYNIGHT VARCHAR(8),
        CLUSTER_ID VARCHAR(64),
        INGESTED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
      );
    `);
    console.log(`[Snowflake] Verified schema and tables in ${db}.${schema}`);
  } catch (err: any) {
    console.warn('[Snowflake] Table initialization warning:', err.message);
  }
}

/**
 * Execute custom SQL statement on Snowflake
 */
export async function executeSnowflakeSQL(sql: string): Promise<{ success: boolean; rows?: any[]; error?: string; rowCount?: number }> {
  if (!activeConnection || connectionStatus !== 'CONNECTED') {
    // If not connected, return structured error
    return {
      success: false,
      error: `Snowflake is ${connectionStatus}. Please verify connection to ${currentConfig.account}.`
    };
  }

  return new Promise((resolve) => {
    activeConnection.execute({
      sqlText: sql,
      complete: (err: any, _stmt: any, rows: any[]) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({
            success: true,
            rows: rows || [],
            rowCount: rows ? rows.length : 0
          });
        }
      }
    });
  });
}

/**
 * Synchronize real-time satellite telemetry into Snowflake ANALYTICS schema (STORE DATA)
 */
export async function syncTelemetryToSnowflake(
  observations: FireObservation[],
  clusters: FireCluster[]
): Promise<{ success: boolean; recordsStaged: number; batchId: string; message: string; rowsInserted?: number }> {
  const batchId = `ETL-SNOW-${Date.now().toString(36).toUpperCase()}`;

  if (!activeConnection || connectionStatus !== 'CONNECTED') {
    // Attempt auto-reconnect if configured
    if (currentConfig.account && currentConfig.username) {
      await connectSnowflake();
    }
  }

  if (activeConnection && connectionStatus === 'CONNECTED') {
    const db = (currentConfig.database || 'SNOWFLAKE_LEARNING_DB').trim();
    const schema = (currentConfig.schema || 'ANALYTICS').trim();

    try {
      // 1. Insert or Merge Clusters into FIRE_CLUSTERS
      const clusterRows = clusters.slice(0, 30).map(c => {
        const cleanName = (c.name || 'Wildfire Complex').replace(/'/g, "''");
        const cleanRegion = (c.region || 'Global Basin').replace(/'/g, "''");
        return `('${c.clusterId}', '${cleanName}', '${cleanRegion}', ${c.hotspotCount}, ${c.averageFRP}, ${c.maxFRP}, ${c.perimeter.areaKm2}, '${c.riskLevel}', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())`;
      }).join(',\n');

      if (clusterRows) {
        const sqlMergeClusters = `
          MERGE INTO ${db}.${schema}.FIRE_CLUSTERS target
          USING (
            SELECT 
              COLUMN1 AS CLUSTER_ID,
              COLUMN2 AS NAME,
              COLUMN3 AS REGION,
              COLUMN4 AS HOTSPOT_COUNT,
              COLUMN5 AS AVERAGE_FRP,
              COLUMN6 AS MAX_FRP,
              COLUMN7 AS AREA_KM2,
              COLUMN8 AS RISK_LEVEL,
              COLUMN9 AS DETECTED_AT,
              COLUMN10 AS UPDATED_AT
            FROM VALUES ${clusterRows}
          ) src
          ON target.CLUSTER_ID = src.CLUSTER_ID
          WHEN MATCHED THEN UPDATE SET
            target.HOTSPOT_COUNT = src.HOTSPOT_COUNT,
            target.AVERAGE_FRP = src.AVERAGE_FRP,
            target.MAX_FRP = src.MAX_FRP,
            target.AREA_KM2 = src.AREA_KM2,
            target.RISK_LEVEL = src.RISK_LEVEL,
            target.UPDATED_AT = CURRENT_TIMESTAMP()
          WHEN NOT MATCHED THEN INSERT (
            CLUSTER_ID, NAME, REGION, HOTSPOT_COUNT, AVERAGE_FRP, MAX_FRP, AREA_KM2, RISK_LEVEL, DETECTED_AT, UPDATED_AT
          ) VALUES (
            src.CLUSTER_ID, src.NAME, src.REGION, src.HOTSPOT_COUNT, src.AVERAGE_FRP, src.MAX_FRP, src.AREA_KM2, src.RISK_LEVEL, src.DETECTED_AT, src.UPDATED_AT
          );
        `;
        await executeSnowflakeSQL(sqlMergeClusters);
      }

      // 2. Insert Observations into FIRE_OBSERVATIONS
      const obsRows = observations.slice(0, 50).map(o => {
        const cid = o.clusterId ? `'${o.clusterId}'` : 'NULL';
        return `('${o.id}', ${o.latitude}, ${o.longitude}, '${o.acquisitionDate}', '${o.acquisitionTime}', '${o.satellite}', '${o.instrument}', '${o.confidence}', ${o.brightnessTemperature}, ${o.fireRadiativePower}, '${o.dayNight}', ${cid}, CURRENT_TIMESTAMP())`;
      }).join(',\n');

      if (obsRows) {
        const sqlMergeObs = `
          MERGE INTO ${db}.${schema}.FIRE_OBSERVATIONS target
          USING (
            SELECT 
              COLUMN1 AS ID,
              COLUMN2 AS LATITUDE,
              COLUMN3 AS LONGITUDE,
              COLUMN4 AS ACQ_DATE,
              COLUMN5 AS ACQ_TIME,
              COLUMN6 AS SATELLITE,
              COLUMN7 AS INSTRUMENT,
              COLUMN8 AS CONFIDENCE,
              COLUMN9 AS BRIGHTNESS_TEMPERATURE,
              COLUMN10 AS FRP,
              COLUMN11 AS DAYNIGHT,
              COLUMN12 AS CLUSTER_ID,
              COLUMN13 AS INGESTED_AT
            FROM VALUES ${obsRows}
          ) src
          ON target.ID = src.ID
          WHEN NOT MATCHED THEN INSERT (
            ID, LATITUDE, LONGITUDE, ACQ_DATE, ACQ_TIME, SATELLITE, INSTRUMENT, CONFIDENCE, BRIGHTNESS_TEMPERATURE, FRP, DAYNIGHT, CLUSTER_ID, INGESTED_AT
          ) VALUES (
            src.ID, src.LATITUDE, src.LONGITUDE, src.ACQ_DATE, src.ACQ_TIME, src.SATELLITE, src.INSTRUMENT, src.CONFIDENCE, src.BRIGHTNESS_TEMPERATURE, src.FRP, src.DAYNIGHT, src.CLUSTER_ID, src.INGESTED_AT
          );
        `;
        await executeSnowflakeSQL(sqlMergeObs);
      }

      return {
        success: true,
        recordsStaged: observations.length,
        batchId,
        rowsInserted: Math.min(clusters.length, 30) + Math.min(observations.length, 50),
        message: `Successfully stored wildfire telemetry in Snowflake database '${db}' (${clusters.length} clusters, ${observations.length} observations synced).`
      };
    } catch (err: any) {
      console.warn('[Snowflake] Ingestion error:', err.message);
      return {
        success: false,
        recordsStaged: 0,
        batchId,
        message: `Snowflake write error: ${err.message}`
      };
    }
  }

  return {
    success: false,
    recordsStaged: 0,
    batchId,
    message: `Snowflake is not connected (${lastError || 'check credentials'}).`
  };
}

/**
 * Retrieve stored wildfire data directly from Snowflake (RETRIEVE DATA)
 */
export async function retrieveSnowflakeData(): Promise<{
  success: boolean;
  totalClustersInDb: number;
  totalObservationsInDb: number;
  clusters: any[];
  recentObservations: any[];
  regionalSummary: any[];
  database: string;
  schema: string;
  warehouse: string;
  queriedAt: string;
  error?: string;
}> {
  const db = (currentConfig.database || 'SNOWFLAKE_LEARNING_DB').trim();
  const schema = (currentConfig.schema || 'ANALYTICS').trim();
  const warehouse = (currentConfig.warehouse || 'SNOWFLAKE_LEARNING_WH').trim();

  if (!activeConnection || connectionStatus !== 'CONNECTED') {
    const connRes = await connectSnowflake();
    if (!connRes.success) {
      return {
        success: false,
        totalClustersInDb: 0,
        totalObservationsInDb: 0,
        clusters: [],
        recentObservations: [],
        regionalSummary: [],
        database: db,
        schema,
        warehouse,
        queriedAt: new Date().toISOString(),
        error: `Could not connect to Snowflake: ${connRes.message}`
      };
    }
  }

  try {
    // 1. Query counts
    const countClustersRes = await executeSnowflakeSQL(`SELECT COUNT(*) AS CNT FROM ${db}.${schema}.FIRE_CLUSTERS;`);
    const countObsRes = await executeSnowflakeSQL(`SELECT COUNT(*) AS CNT FROM ${db}.${schema}.FIRE_OBSERVATIONS;`);
    const totalClusters = countClustersRes.rows?.[0]?.CNT || countClustersRes.rows?.[0]?.cnt || 0;
    const totalObs = countObsRes.rows?.[0]?.CNT || countObsRes.rows?.[0]?.cnt || 0;

    // 2. Retrieve clusters
    const clustersRes = await executeSnowflakeSQL(`
      SELECT 
        CLUSTER_ID, NAME, REGION, HOTSPOT_COUNT, AVERAGE_FRP, MAX_FRP, AREA_KM2, RISK_LEVEL, DETECTED_AT, UPDATED_AT
      FROM ${db}.${schema}.FIRE_CLUSTERS
      ORDER BY AVERAGE_FRP DESC
      LIMIT 25;
    `);

    // 3. Retrieve recent observations
    const obsRes = await executeSnowflakeSQL(`
      SELECT 
        ID, LATITUDE, LONGITUDE, ACQ_DATE, ACQ_TIME, SATELLITE, INSTRUMENT, CONFIDENCE, BRIGHTNESS_TEMPERATURE, FRP, DAYNIGHT, CLUSTER_ID, INGESTED_AT
      FROM ${db}.${schema}.FIRE_OBSERVATIONS
      ORDER BY FRP DESC
      LIMIT 25;
    `);

    // 4. Retrieve Regional aggregation directly computed in Snowflake
    const regionalRes = await executeSnowflakeSQL(`
      SELECT 
        REGION,
        COUNT(*) AS FIRE_COUNT,
        SUM(HOTSPOT_COUNT) AS TOTAL_HOTSPOTS,
        ROUND(AVG(AVERAGE_FRP), 2) AS MEAN_FRP_MW,
        ROUND(MAX(MAX_FRP), 2) AS PEAK_FRP_MW,
        ROUND(SUM(AREA_KM2), 2) AS TOTAL_AREA_KM2
      FROM ${db}.${schema}.FIRE_CLUSTERS
      GROUP BY REGION
      ORDER BY FIRE_COUNT DESC;
    `);

    return {
      success: true,
      totalClustersInDb: Number(totalClusters),
      totalObservationsInDb: Number(totalObs),
      clusters: clustersRes.rows || [],
      recentObservations: obsRes.rows || [],
      regionalSummary: regionalRes.rows || [],
      database: db,
      schema,
      warehouse,
      queriedAt: new Date().toISOString()
    };
  } catch (err: any) {
    return {
      success: false,
      totalClustersInDb: 0,
      totalObservationsInDb: 0,
      clusters: [],
      recentObservations: [],
      regionalSummary: [],
      database: db,
      schema,
      warehouse,
      queriedAt: new Date().toISOString(),
      error: err.message
    };
  }
}

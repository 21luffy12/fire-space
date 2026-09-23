import { Router, Request, Response } from 'express';
import { operationalStore } from './storage';
import { fetchWeatherForCoordinates, setCustomOpenWeatherKey, getCustomOpenWeatherKey } from './weatherService';
import { fetchElevationProfile } from './elevationService';
import { getAllAlerts, acknowledgeAlert } from './alertService';
import { generateSnowflakeAnalytics } from './snowflakeService';
import { getSyncStatus, setCustomApiKey, getCustomApiKey, fetchFirmsHotspots } from './firmsService';
import {
  connectMongoDB,
  getMongoStatus,
  getMongoStats,
  setMongoUri,
  getMongoUri,
  persistObservationsToMongo,
  persistClustersToMongo
} from './mongodbService';
import {
  connectSnowflake,
  getSnowflakeStatus,
  getSnowflakeConfig,
  setSnowflakeConfig,
  executeSnowflakeSQL,
  syncTelemetryToSnowflake,
  retrieveSnowflakeData
} from './snowflakeConnector';

export const apiRouter = Router();

// Server-Sent Events (SSE) clients for real-time live map telemetry updates
const sseClients: Response[] = [];

export function broadcastLiveUpdate(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      // client disconnected
    }
  }
}

// SSE real-time stream endpoint
apiRouter.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.push(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 1. GET /api/fires/live - Main live satellite snapshot
apiRouter.get('/fires/live', (_req: Request, res: Response) => {
  const clusters = operationalStore.getClusters();
  const observations = operationalStore.getObservations();
  const status = operationalStore.getSystemStatus();

  res.json({
    success: true,
    totalClusters: clusters.length,
    totalHotspots: observations.length,
    lastUpdate: status.lastSuccessfulSync,
    clusters,
    observations
  });
});

// 2. GET /api/fires/recent - Filterable observations
apiRouter.get('/fires/recent', (req: Request, res: Response) => {
  const minFRP = req.query.minFRP ? parseFloat(req.query.minFRP as string) : undefined;
  const clusterId = req.query.clusterId as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

  const observations = operationalStore.getObservations({ minFRP, clusterId, limit });
  res.json({
    success: true,
    count: observations.length,
    observations
  });
});

// 3. GET /api/fires/:id - Single observation
apiRouter.get('/fires/:id', (req: Request, res: Response) => {
  const obs = operationalStore.getObservationById(req.params.id);
  if (!obs) {
    res.status(404).json({ success: false, error: 'Fire observation not found' });
    return;
  }
  res.json({ success: true, observation: obs });
});

// 4. GET /api/clusters - All DBSCAN fire clusters
apiRouter.get('/clusters', (_req: Request, res: Response) => {
  const clusters = operationalStore.getClusters();
  res.json({
    success: true,
    count: clusters.length,
    clusters
  });
});

// 5. GET /api/clusters/:id - Specific cluster details
apiRouter.get('/clusters/:id', (req: Request, res: Response) => {
  const cluster = operationalStore.getClusterById(req.params.id);
  if (!cluster) {
    res.status(404).json({ success: false, error: 'Cluster not found' });
    return;
  }
  res.json({ success: true, cluster });
});

// 6. GET /api/clusters/:id/prediction - 6-hour spread projection
apiRouter.get('/clusters/:id/prediction', (req: Request, res: Response) => {
  const prediction = operationalStore.getPrediction(req.params.id);
  if (!prediction) {
    res.status(404).json({ success: false, error: 'Spread prediction not found for this cluster' });
    return;
  }
  res.json({ success: true, prediction });
});

// 7. POST /api/firms/sync - Trigger on-demand satellite sync
apiRouter.post('/firms/sync', async (req: Request, res: Response) => {
  const { sensor, countryCode } = req.body;
  const result = await operationalStore.syncAndProcess(sensor, countryCode);

  broadcastLiveUpdate('satellite_sync', {
    clustersCount: result.clusters.length,
    hotspotsCount: result.observations.length,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Satellite telemetry synced and DBSCAN clustering complete',
    clustersCount: result.clusters.length,
    hotspotsCount: result.observations.length
  });
});

// 8. POST /api/clusters/process - Re-run DBSCAN with custom params
apiRouter.post('/clusters/process', async (req: Request, res: Response) => {
  const { epsKm, minSamples } = req.body;
  if (epsKm && !isNaN(parseFloat(epsKm))) {
    operationalStore.dbscanEpsKm = parseFloat(epsKm);
  }
  if (minSamples && !isNaN(parseInt(minSamples))) {
    operationalStore.dbscanMinSamples = parseInt(minSamples);
  }

  const result = await operationalStore.syncAndProcess();
  broadcastLiveUpdate('clusters_updated', { count: result.clusters.length });

  res.json({
    success: true,
    epsKm: operationalStore.dbscanEpsKm,
    minSamples: operationalStore.dbscanMinSamples,
    clustersCount: result.clusters.length
  });
});

// 9. GET /api/weather/:lat/:lon - Real weather info
apiRouter.get('/weather/:lat/:lon', async (req: Request, res: Response) => {
  const lat = parseFloat(req.params.lat);
  const lon = parseFloat(req.params.lon);
  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({ error: 'Invalid coordinates' });
    return;
  }
  const weather = await fetchWeatherForCoordinates(lat, lon);
  res.json({ success: true, weather });
});

// 10. GET /api/elevation/:lat/:lon - Real elevation profile
apiRouter.get('/elevation/:lat/:lon', async (req: Request, res: Response) => {
  const lat = parseFloat(req.params.lat);
  const lon = parseFloat(req.params.lon);
  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({ error: 'Invalid coordinates' });
    return;
  }
  const elevation = await fetchElevationProfile(lat, lon);
  res.json({ success: true, elevation });
});

// 11. GET /api/alerts - Alert feed
apiRouter.get('/alerts', (_req: Request, res: Response) => {
  const alerts = getAllAlerts();
  res.json({ success: true, count: alerts.length, alerts });
});

// 12. PATCH /api/alerts/:id/acknowledge
apiRouter.patch('/alerts/:id/acknowledge', (req: Request, res: Response) => {
  const ack = acknowledgeAlert(req.params.id);
  if (!ack) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }
  res.json({ success: true, alert: ack });
});

// 13. GET /api/analytics/summary - Snowflake historical analytics
apiRouter.get('/analytics/summary', (_req: Request, res: Response) => {
  const clusters = operationalStore.getClusters();
  const obs = operationalStore.getObservations();
  const summary = generateSnowflakeAnalytics(clusters, obs);
  res.json({ success: true, analytics: summary });
});

// 14. GET /api/analytics/fire-trends - Historical daily/weekly trends
apiRouter.get('/analytics/fire-trends', (_req: Request, res: Response) => {
  const clusters = operationalStore.getClusters();
  const obs = operationalStore.getObservations();
  const summary = generateSnowflakeAnalytics(clusters, obs);
  res.json({ success: true, trends: summary.dailyTrends });
});

// 15. GET /api/system - System health & connection status
apiRouter.get('/system', (_req: Request, res: Response) => {
  const status = operationalStore.getSystemStatus();
  res.json({ success: true, system: status });
});

// 16. Settings & Real-Time API Test Endpoints
apiRouter.get('/settings', async (_req: Request, res: Response) => {
  const syncInfo = getSyncStatus();
  const currentKey = getCustomApiKey();
  const maskedKey = currentKey ? `${currentKey.slice(0, 4)}...${currentKey.slice(-4)}` : '';
  const mongoStatus = getMongoStatus();
  const snowflakeConfig = getSnowflakeConfig();
  const snowflakeStatus = getSnowflakeStatus();

  res.json({
    success: true,
    settings: {
      dbscanEpsKm: operationalStore.dbscanEpsKm,
      dbscanMinSamples: operationalStore.dbscanMinSamples,
      refreshIntervalMinutes: operationalStore.refreshIntervalMinutes,
      activeSensor: operationalStore.activeSensor,
      hasFirmsApiKey: !!currentKey,
      customApiKeyMasked: maskedKey,
      hasOpenWeatherKey: !!getCustomOpenWeatherKey(),
      currentDataSource: syncInfo.currentDataSource,
      isRealTimeActive: syncInfo.isRealTimeActive,
      lastSyncTimestamp: syncInfo.lastSyncTimestamp,
      lastSyncCount: syncInfo.lastSyncCount,
      // Database & Analytics Integrations
      mongo: {
        uriMasked: mongoStatus.uriMasked,
        status: mongoStatus.status,
        lastPingMs: mongoStatus.lastPingMs
      },
      snowflake: {
        account: snowflakeConfig.account,
        username: snowflakeConfig.username,
        warehouse: snowflakeConfig.warehouse,
        database: snowflakeConfig.database,
        schema: snowflakeConfig.schema,
        status: snowflakeStatus.status,
        lastPingMs: snowflakeStatus.lastPingMs
      }
    }
  });
});

apiRouter.post('/settings', async (req: Request, res: Response) => {
  const {
    dbscanEpsKm,
    dbscanMinSamples,
    refreshIntervalMinutes,
    activeSensor,
    firmsApiKey,
    mongoUri,
    snowflakeAccount,
    snowflakeUsername,
    snowflakePassword,
    snowflakeWarehouse,
    snowflakeDatabase,
    snowflakeSchema,
    openWeatherApiKey
  } = req.body;

  if (openWeatherApiKey !== undefined) {
    setCustomOpenWeatherKey(openWeatherApiKey);
  }

  if (dbscanEpsKm) operationalStore.dbscanEpsKm = parseFloat(dbscanEpsKm);
  if (dbscanMinSamples) operationalStore.dbscanMinSamples = parseInt(dbscanMinSamples);
  if (refreshIntervalMinutes) operationalStore.refreshIntervalMinutes = parseInt(refreshIntervalMinutes);
  if (activeSensor) operationalStore.activeSensor = activeSensor;
  if (firmsApiKey !== undefined) {
    setCustomApiKey(firmsApiKey);
  }

  // Update MongoDB URI if passed and not a masked string
  if (mongoUri !== undefined && mongoUri !== '') {
    if (!mongoUri.includes('****')) {
      setMongoUri(mongoUri);
      connectMongoDB(mongoUri).catch(console.warn);
    }
  }

  // Update Snowflake configuration if passed
  if (snowflakeAccount !== undefined || snowflakeUsername !== undefined || snowflakePassword !== undefined) {
    const snowUpdate: any = {};
    if (snowflakeAccount !== undefined) snowUpdate.account = snowflakeAccount;
    if (snowflakeUsername !== undefined) snowUpdate.username = snowflakeUsername;
    if (snowflakePassword !== undefined && snowflakePassword !== '' && !snowflakePassword.includes('****')) {
      snowUpdate.password = snowflakePassword;
    }
    if (snowflakeWarehouse !== undefined) snowUpdate.warehouse = snowflakeWarehouse;
    if (snowflakeDatabase !== undefined) snowUpdate.database = snowflakeDatabase;
    if (snowflakeSchema !== undefined) snowUpdate.schema = snowflakeSchema;

    setSnowflakeConfig(snowUpdate);
    const updatedStatus = getSnowflakeStatus();
    if (updatedStatus.hasCredentials) {
      connectSnowflake().catch(console.warn);
    }
  }

  const result = await operationalStore.syncAndProcess();
  broadcastLiveUpdate('settings_updated', { message: 'Settings saved and pipeline re-synchronized' });

  res.json({
    success: true,
    message: 'Settings updated and live pipeline re-synchronized',
    clustersCount: result.clusters.length,
    hotspotsCount: result.observations.length,
    dataSource: getSyncStatus().currentDataSource
  });
});

// 16b. POST /api/firms/test-connection - Test real-time NASA FIRMS connection
apiRouter.post('/firms/test-connection', async (req: Request, res: Response) => {
  const t0 = Date.now();
  const { testApiKey, sensor, countryCode } = req.body;

  if (testApiKey) {
    setCustomApiKey(testApiKey);
  }

  try {
    const activeSensor = sensor || operationalStore.activeSensor || 'VIIRS_SNPP_NRT';
    const activeCountry = countryCode || 'USA';
    const hotspots = await fetchFirmsHotspots(activeSensor, activeCountry);
    const latencyMs = Date.now() - t0;
    const syncInfo = getSyncStatus();

    res.json({
      success: true,
      latencyMs,
      dataSource: syncInfo.currentDataSource,
      status: syncInfo.status,
      hotspotsRetrieved: hotspots.length,
      sampleHotspot: hotspots[0] || null,
      message: `Successfully connected to real-time satellite telemetry (${hotspots.length} active thermal anomalies retrieved in ${latencyMs}ms)`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Real-time satellite connection test failed'
    });
  }
});

// 16c. MongoDB Connection & Diagnostic Endpoints
apiRouter.get('/mongodb/status', async (_req: Request, res: Response) => {
  const status = getMongoStatus();
  const stats = await getMongoStats();
  res.json({ success: true, status, stats });
});

apiRouter.post('/mongodb/test-connection', async (req: Request, res: Response) => {
  const { uri } = req.body;
  if (uri) {
    setMongoUri(uri);
  }
  const result = await connectMongoDB(uri);
  if (result.success) {
    // Persist current store into newly connected MongoDB
    const obs = operationalStore.getObservations();
    const clusters = operationalStore.getClusters();
    await persistObservationsToMongo(obs);
    await persistClustersToMongo(clusters);
  }
  const stats = await getMongoStats();

  res.json({
    success: result.success,
    message: result.message,
    latencyMs: result.latencyMs,
    stats
  });
});

apiRouter.post('/mongodb/sync', async (_req: Request, res: Response) => {
  const obs = operationalStore.getObservations();
  const clusters = operationalStore.getClusters();
  const savedObs = await persistObservationsToMongo(obs);
  const savedClusters = await persistClustersToMongo(clusters);
  const stats = await getMongoStats();

  res.json({
    success: true,
    savedObservations: savedObs,
    savedClusters,
    stats,
    message: `Synchronized ${savedObs} observations and ${savedClusters} clusters to MongoDB with 2dsphere indexes.`
  });
});

// 16d. Snowflake Data Warehouse Endpoints
apiRouter.get('/snowflake/status', (_req: Request, res: Response) => {
  const status = getSnowflakeStatus();
  const config = getSnowflakeConfig();
  res.json({ success: true, status, config });
});

apiRouter.post('/snowflake/test-connection', async (req: Request, res: Response) => {
  const { account, username, password, warehouse, database, schema, role } = req.body;
  if (account || username) {
    setSnowflakeConfig({
      account,
      username,
      password,
      warehouse,
      database,
      schema,
      role
    });
  }

  const result = await connectSnowflake();
  res.json({
    success: result.success,
    message: result.message,
    latencyMs: result.latencyMs,
    status: getSnowflakeStatus()
  });
});

apiRouter.post('/snowflake/sync-etl', async (_req: Request, res: Response) => {
  const obs = operationalStore.getObservations();
  const clusters = operationalStore.getClusters();
  const result = await syncTelemetryToSnowflake(obs, clusters);
  broadcastLiveUpdate('etl_completed', { batchId: result.batchId, records: result.recordsStaged });

  res.json({
    success: result.success,
    batchId: result.batchId,
    recordsStaged: result.recordsStaged,
    rowsInserted: result.rowsInserted,
    message: result.message
  });
});

// GET /api/snowflake/data - Retrieve actual stored records from Snowflake
apiRouter.get('/snowflake/data', async (_req: Request, res: Response) => {
  const result = await retrieveSnowflakeData();
  res.json(result);
});

apiRouter.post('/snowflake/query', async (req: Request, res: Response) => {
  const { sql } = req.body;
  if (!sql) {
    return res.status(400).json({ success: false, error: 'SQL statement is required' });
  }

  const result = await executeSnowflakeSQL(sql);
  res.json(result);
});

// 16e. Weather & Elevation API Verification
apiRouter.post('/weather/test-connection', async (req: Request, res: Response) => {
  const { lat, lon } = req.body;
  const latitude = typeof lat === 'number' ? lat : 37.7749;
  const longitude = typeof lon === 'number' ? lon : -122.4194;
  const t0 = Date.now();

  try {
    const weather = await fetchWeatherForCoordinates(latitude, longitude);
    const latencyMs = Date.now() - t0;
    res.json({
      success: true,
      latencyMs,
      weather,
      message: `Open-Meteo & Atmospheric API successfully reached (${latencyMs}ms)`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 17. Authentication mock & role switching (ADMIN, ANALYST, VIEWER)
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, role } = req.body;
  const userRole = role || (email?.includes('admin') ? 'ADMIN' : email?.includes('analyst') ? 'ANALYST' : 'VIEWER');
  res.json({
    success: true,
    token: `jwt-token-${Date.now()}`,
    user: {
      id: 'usr-101',
      name: email ? email.split('@')[0] : 'Operations Director',
      email: email || 'ops@firespace.nasa.gov',
      role: userRole
    }
  });
});

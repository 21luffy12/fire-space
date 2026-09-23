import { FireCluster, FireObservation, Alert, SystemStatus, User } from '../types';

const API_BASE = '/api';

export async function getLiveFires(): Promise<{
  success: boolean;
  totalClusters: number;
  totalHotspots: number;
  lastUpdate: string;
  clusters: FireCluster[];
  observations: FireObservation[];
}> {
  const res = await fetch(`${API_BASE}/fires/live`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function getRecentFires(options?: { minFRP?: number; clusterId?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.minFRP) params.set('minFRP', String(options.minFRP));
  if (options?.clusterId) params.set('clusterId', options.clusterId);
  if (options?.limit) params.set('limit', String(options.limit));

  const res = await fetch(`${API_BASE}/fires/recent?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function getClusterDetails(id: string): Promise<{ success: boolean; cluster: FireCluster }> {
  const res = await fetch(`${API_BASE}/clusters/${id}`);
  if (!res.ok) throw new Error(`Cluster ${id} not found`);
  return res.json();
}

export async function syncFirmsData(sensor?: string, countryCode?: string) {
  const res = await fetch(`${API_BASE}/firms/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sensor, countryCode })
  });
  if (!res.ok) throw new Error(`Sync failed with status ${res.status}`);
  return res.json();
}

export async function reprocessClusters(epsKm: number, minSamples: number) {
  const res = await fetch(`${API_BASE}/clusters/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ epsKm, minSamples })
  });
  if (!res.ok) throw new Error(`Clustering failed with status ${res.status}`);
  return res.json();
}

export async function getAlerts(): Promise<{ success: boolean; count: number; alerts: Alert[] }> {
  const res = await fetch(`${API_BASE}/alerts`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function acknowledgeAlert(alertId: string): Promise<{ success: boolean; alert: Alert }> {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
    method: 'PATCH'
  });
  if (!res.ok) throw new Error(`Failed to acknowledge alert`);
  return res.json();
}

export async function getAnalyticsSummary() {
  const res = await fetch(`${API_BASE}/analytics/summary`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function getSystemHealth(): Promise<{ success: boolean; system: SystemStatus }> {
  const res = await fetch(`${API_BASE}/system`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function getSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function updateSettings(settings: any) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error(`Settings update failed`);
  return res.json();
}

export async function testFirmsConnection(testApiKey?: string, sensor?: string, countryCode?: string) {
  const res = await fetch(`${API_BASE}/firms/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testApiKey, sensor, countryCode })
  });
  if (!res.ok) throw new Error(`Real-time connection test failed`);
  return res.json();
}

// MongoDB Database API
export async function getMongoStatus() {
  const res = await fetch(`${API_BASE}/mongodb/status`);
  if (!res.ok) throw new Error(`Failed to fetch MongoDB status`);
  return res.json();
}

export async function testMongoConnection(uri?: string) {
  const res = await fetch(`${API_BASE}/mongodb/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri })
  });
  if (!res.ok) throw new Error(`MongoDB connection test failed`);
  return res.json();
}

export async function syncMongoData() {
  const res = await fetch(`${API_BASE}/mongodb/sync`, { method: 'POST' });
  if (!res.ok) throw new Error(`MongoDB sync failed`);
  return res.json();
}

// Snowflake Data Warehouse API
export async function getSnowflakeStatus() {
  const res = await fetch(`${API_BASE}/snowflake/status`);
  if (!res.ok) throw new Error(`Failed to fetch Snowflake status`);
  return res.json();
}

export async function testSnowflakeConnection(config: any) {
  const res = await fetch(`${API_BASE}/snowflake/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error(`Snowflake connection test failed`);
  return res.json();
}

export async function syncSnowflakeETL() {
  const res = await fetch(`${API_BASE}/snowflake/sync-etl`, { method: 'POST' });
  if (!res.ok) throw new Error(`Snowflake ETL sync failed`);
  return res.json();
}

export async function executeSnowflakeSQLQuery(sql: string) {
  const res = await fetch(`${API_BASE}/snowflake/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  if (!res.ok) throw new Error(`Snowflake query execution failed`);
  return res.json();
}

export async function getSnowflakeStoredData() {
  const res = await fetch(`${API_BASE}/snowflake/data`);
  if (!res.ok) throw new Error(`Failed to retrieve Snowflake data`);
  return res.json();
}

// Atmospheric & Weather API
export async function testWeatherConnection(lat?: number, lon?: number) {
  const res = await fetch(`${API_BASE}/weather/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon })
  });
  if (!res.ok) throw new Error(`Weather connection test failed`);
  return res.json();
}

export async function loginUser(email: string, role?: string): Promise<{ success: boolean; user: User; token: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role })
  });
  if (!res.ok) throw new Error(`Login failed`);
  return res.json();
}

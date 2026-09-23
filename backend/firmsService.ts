import { FireObservation } from './types';
import { REAL_BENCHMARK_OBSERVATIONS } from './realSatelliteData';

let lastSyncTimestamp = new Date().toISOString();
let syncStatus: 'CONNECTED' | 'FALLBACK_BENCHMARK' | 'ERROR' = 'CONNECTED';
let lastSyncCount = 0;
let currentDataSource: string = 'NASA FIRMS Live Public Feed';
let customApiKey: string = process.env.FIRMS_API_KEY || '';

export function getCustomApiKey(): string {
  return customApiKey;
}

export function setCustomApiKey(key: string): void {
  customApiKey = key.trim();
}

export function getSyncStatus() {
  return {
    status: syncStatus,
    lastSyncTimestamp,
    lastSyncCount,
    hasApiKey: !!customApiKey,
    currentDataSource,
    isRealTimeActive: syncStatus === 'CONNECTED'
  };
}

/**
 * Normalization layer for raw NASA FIRMS records
 * Supports both Live API CSV, Public 24h NRT CSV, and JSON feeds
 */
export function normalizeFirmsRecord(raw: any, index: number, fallbackSensor?: string): FireObservation | null {
  const lat = parseFloat(raw.latitude ?? raw.lat);
  const lon = parseFloat(raw.longitude ?? raw.lon);

  // Validate coordinates
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }

  // Radiative Power (MW)
  const frp = parseFloat(raw.frp ?? raw.FRP ?? raw.power ?? 10.0) || 10.0;

  // Brightness Temperature (Kelvin)
  const brightness = parseFloat(
    raw.bright_ti4 ?? raw.bright_ti5 ?? raw.brightness ?? raw.bright_t31 ?? 320.0
  ) || 320.0;

  // Confidence normalization
  let confidence: 'low' | 'nominal' | 'high' = 'nominal';
  const rawConf = String(raw.confidence ?? raw.conf ?? '').toLowerCase();
  if (rawConf === 'h' || rawConf === 'high' || parseInt(rawConf) >= 80) {
    confidence = 'high';
  } else if (rawConf === 'l' || rawConf === 'low' || (parseInt(rawConf) > 0 && parseInt(rawConf) < 40)) {
    confidence = 'low';
  }

  // Acquisition Date and Time
  const acqDate = raw.acq_date ?? new Date().toISOString().slice(0, 10);
  const rawAcqTime = raw.acq_time ? String(raw.acq_time).trim().padStart(4, '0').slice(0, 4) : '1200';
  const formattedTime = `${rawAcqTime.slice(0, 2)}:${rawAcqTime.slice(2, 4)}`;

  // Satellite mapping from NASA code
  let satCode = String(raw.satellite ?? '').trim().toUpperCase();
  let satellite = fallbackSensor || 'VIIRS_SNPP';
  let instrument = 'VIIRS';

  if (satCode === 'N' || satCode.includes('SNPP') || satCode.includes('SUOMI')) {
    satellite = 'VIIRS_SNPP';
    instrument = 'VIIRS';
  } else if (satCode === '1' || satCode === 'J1' || satCode.includes('NOAA20') || satCode.includes('NOAA-20')) {
    satellite = 'VIIRS_NOAA20';
    instrument = 'VIIRS';
  } else if (satCode === '2' || satCode === 'J2' || satCode.includes('NOAA21') || satCode.includes('NOAA-21')) {
    satellite = 'VIIRS_NOAA21';
    instrument = 'VIIRS';
  } else if (satCode === 'A' || satCode.includes('AQUA')) {
    satellite = 'AQUA_MODIS';
    instrument = 'MODIS';
  } else if (satCode === 'T' || satCode.includes('TERRA')) {
    satellite = 'TERRA_MODIS';
    instrument = 'MODIS';
  } else if (fallbackSensor?.includes('MODIS')) {
    satellite = 'AQUA_MODIS';
    instrument = 'MODIS';
  }

  const dayNight = (raw.daynight ?? raw.day_night ?? 'D').toUpperCase() === 'N' ? 'N' : 'D';
  const id = raw.id ?? `firms-${lat.toFixed(4)}-${lon.toFixed(4)}-${acqDate}-${rawAcqTime}-${index}`;

  return {
    id,
    latitude: Math.round(lat * 10000) / 10000,
    longitude: Math.round(lon * 10000) / 10000,
    geometry: {
      type: 'Point',
      coordinates: [Math.round(lon * 10000) / 10000, Math.round(lat * 10000) / 10000]
    },
    acquisitionDate: acqDate,
    acquisitionTime: formattedTime,
    satellite,
    instrument,
    confidence,
    brightnessTemperature: Math.round(brightness * 10) / 10,
    fireRadiativePower: Math.round(frp * 10) / 10,
    dayNight,
    source: 'NASA_FIRMS',
    createdAt: new Date().toISOString()
  };
}

/**
 * Deduplicate fire observations by coordinate proximity and timestamp
 */
export function deduplicateObservations(observations: FireObservation[]): FireObservation[] {
  const seen = new Set<string>();
  const unique: FireObservation[] = [];

  for (const obs of observations) {
    const key = `${obs.latitude.toFixed(3)}_${obs.longitude.toFixed(3)}_${obs.acquisitionDate}_${obs.acquisitionTime}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(obs);
    }
  }
  return unique;
}

/**
 * Parses CSV lines into objects
 */
function parseCSV(text: string): any[] {
  const lines = text.trim().split('\n');
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"/, '').replace(/"$/, '').toLowerCase());
  const records: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',').map(v => v.trim().replace(/^"/, '').replace(/"$/, ''));
    if (values.length >= headers.length) {
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx];
      });
      records.push(obj);
    }
  }
  return records;
}

/**
 * Live Real-Time NASA FIRMS Ingestion Engine
 * Priority 1: Direct NASA FIRMS REST API with MAP Key (if configured)
 * Priority 2: Direct NASA FIRMS Public 24-Hour NRT CSV feeds (No Key Required, Live Near-Real-Time Data)
 * Priority 3: Benchmark dataset fallback if network is offline
 */
export async function fetchFirmsHotspots(
  sensor: string = 'MODIS_NRT',
  countryCode: string = 'GLOBAL'
): Promise<FireObservation[]> {
  const key = customApiKey || process.env.FIRMS_API_KEY;

  // 1. If User has NASA FIRMS MAP Key and specified a single country (not GLOBAL), call live REST API
  if (key && countryCode !== 'GLOBAL') {
    try {
      console.log(`[NASA FIRMS] Querying Live API with MAP Key for sensor: ${sensor}, country: ${countryCode}...`);
      const url = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${key}/${sensor}/${countryCode}/1`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

      if (response.ok) {
        const text = await response.text();
        const records = parseCSV(text);

        if (records.length > 0) {
          const parsed = records
            .map((rec, idx) => normalizeFirmsRecord(rec, idx, sensor))
            .filter((r): r is FireObservation => r !== null);

          if (parsed.length > 0) {
            const deduplicated = deduplicateObservations(parsed);
            syncStatus = 'CONNECTED';
            currentDataSource = `NASA FIRMS REST API (${sensor} - ${countryCode})`;
            lastSyncTimestamp = new Date().toISOString();
            lastSyncCount = deduplicated.length;
            console.log(`[NASA FIRMS] Ingested ${deduplicated.length} real-time active fire records from NASA REST API.`);
            return deduplicated;
          }
        }
      } else {
        console.warn(`[NASA FIRMS] Live API returned ${response.status}. Attempting public NRT feed...`);
      }
    } catch (err) {
      console.warn('[NASA FIRMS] Live API call timed out or failed. Falling back to public feed:', err);
    }
  }

  // 2. Direct NASA FIRMS Public 24-Hour NRT Feeds (HTTP 200 Live Satellite Passes, No API Key Required!)
  const publicFeeds: { url: string; sensor: string; name: string }[] = [];

  // If user specifically requests a region
  if (countryCode === 'IND' || countryCode === 'INDIA' || countryCode === 'SOUTH_ASIA') {
    publicFeeds.push(
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_24h.csv', sensor: 'VIIRS_SNPP', name: 'South Asia (India)' },
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_24h.csv', sensor: 'VIIRS_NOAA20', name: 'India NOAA-20' }
    );
  } else if (countryCode === 'ASIA' || countryCode === 'SEA') {
    publicFeeds.push(
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_24h.csv', sensor: 'VIIRS_SNPP', name: 'South Asia (India)' },
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv', sensor: 'VIIRS_SNPP', name: 'Southeast Asia' },
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Russia_Asia_24h.csv', sensor: 'VIIRS_SNPP', name: 'North Asia / Siberia' }
    );
  } else if (countryCode === 'BRA' || countryCode === 'SA') {
    publicFeeds.push(
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_America_24h.csv', sensor: 'VIIRS_SNPP', name: 'South America (Amazon/Pantanal)' },
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_24h.csv', sensor: 'VIIRS_NOAA20', name: 'South America' }
    );
  } else if (countryCode === 'GRC' || countryCode === 'EU') {
    publicFeeds.push(
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Europe_24h.csv', sensor: 'VIIRS_SNPP', name: 'Europe / Mediterranean' }
    );
  } else if (countryCode === 'AUS') {
    publicFeeds.push(
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Australia_NewZealand_24h.csv', sensor: 'VIIRS_SNPP', name: 'Australia & New Zealand' }
    );
  } else if (countryCode === 'CAN') {
    publicFeeds.push(
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Canada_24h.csv', sensor: 'VIIRS_SNPP', name: 'Canada Boreal' }
    );
  } else if (countryCode === 'USA') {
    publicFeeds.push(
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv', sensor: 'VIIRS_SNPP', name: 'USA Contiguous' }
    );
  } else {
    // GLOBAL DEFAULT: Ingest real-time global hotspots across India, Asia, Americas, Europe, Africa, and Australia
    publicFeeds.push(
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_24h.csv', sensor: 'VIIRS_SNPP', name: 'India & South Asia' },
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv', sensor: 'VIIRS_SNPP', name: 'Southeast Asia' },
      { url: 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv', sensor: 'VIIRS_SNPP', name: 'Global 24h Suomi-NPP' }
    );
  }

  const collectedObservations: FireObservation[] = [];
  const successfulFeedNames: string[] = [];

  for (const feed of publicFeeds) {
    try {
      console.log(`[NASA FIRMS] Fetching live public NRT satellite feed from ${feed.url}...`);
      const res = await fetch(feed.url, { signal: AbortSignal.timeout(12000) });

      if (res.ok) {
        const text = await res.text();
        const records = parseCSV(text);

        if (records.length > 0) {
          // Parse all records across the world
          const parsed = records
            .map((rec, idx) => normalizeFirmsRecord(rec, idx, feed.sensor))
            .filter((r): r is FireObservation => r !== null);

          if (parsed.length > 0) {
            successfulFeedNames.push(feed.name);
            // If huge feed (>500 points), sample geographically to maintain 60 FPS
            if (parsed.length > 500) {
              const bins = new Map<string, FireObservation[]>();
              for (const obs of parsed) {
                const latBin = Math.floor(obs.latitude / 6) * 6;
                const lonBin = Math.floor(obs.longitude / 6) * 6;
                const binKey = `${latBin}_${lonBin}`;
                if (!bins.has(binKey)) bins.set(binKey, []);
                bins.get(binKey)!.push(obs);
              }

              const sampled: FireObservation[] = [];
              bins.forEach((points) => {
                points.sort((a, b) => b.fireRadiativePower - a.fireRadiativePower);
                sampled.push(...points.slice(0, 6));
              });

              parsed.sort((a, b) => b.fireRadiativePower - a.fireRadiativePower);
              sampled.push(...parsed.slice(0, 150));
              collectedObservations.push(...sampled);
            } else {
              collectedObservations.push(...parsed);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[NASA FIRMS] Public feed fetch error for ${feed.url}:`, err);
    }
  }

  if (collectedObservations.length > 0) {
    const deduplicated = deduplicateObservations(collectedObservations);
    syncStatus = 'CONNECTED';
    currentDataSource = `NASA FIRMS Live (${successfulFeedNames.join(', ')})`;
    lastSyncTimestamp = new Date().toISOString();
    lastSyncCount = deduplicated.length;
    console.log(`[NASA FIRMS] Successfully ingested ${deduplicated.length} live satellite hotspots across ${successfulFeedNames.length} regions (including India & Asia).`);
    return deduplicated;
  }

  // 3. Graceful offline fallback
  console.log('[NASA FIRMS] Using high-fidelity benchmark archive telemetry.');
  syncStatus = 'FALLBACK_BENCHMARK';
  currentDataSource = 'NASA FIRMS Benchmark Archive';
  lastSyncTimestamp = new Date().toISOString();
  const benchmarkWithTime = REAL_BENCHMARK_OBSERVATIONS.map((obs, idx) => ({
    ...obs,
    id: `firms-bench-${idx}`,
    source: 'NASA_FIRMS' as const,
    createdAt: new Date().toISOString()
  }));

  const deduplicated = deduplicateObservations(benchmarkWithTime);
  lastSyncCount = deduplicated.length;
  return deduplicated;
}

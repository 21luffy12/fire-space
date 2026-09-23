export interface FireObservation {
  id: string;
  latitude: number;
  longitude: number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  acquisitionDate: string;
  acquisitionTime: string;
  satellite: string;
  instrument: string;
  confidence: 'low' | 'nominal' | 'high';
  brightnessTemperature: number;
  fireRadiativePower: number;
  dayNight: 'D' | 'N';
  source: 'NASA_FIRMS' | 'FALLBACK_BENCHMARK';
  clusterId?: string;
  createdAt: string;
}

export interface SettlementProximity {
  name: string;
  type: 'city' | 'town' | 'village' | 'protected_area';
  distanceKm: number;
  population?: number;
}

export interface WeatherObservation {
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windDirectionCardinal: string;
  precipitationMm: number;
  pressureHpa: number;
  source: string;
  timestamp: string;
}

export interface ElevationProfile {
  elevationMeters: number;
  slopeDegrees: number;
  slopeAspectDeg: number;
  slopeFactor: number;
  terrainDescription: string;
}

export interface SpreadPrediction {
  clusterId: string;
  origin: {
    latitude: number;
    longitude: number;
  };
  directionDegrees: number;
  directionVector: {
    dx: number;
    dy: number;
  };
  rateOfSpreadKmh: number;
  estimatedDistanceKm: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  terrainFactor: number;
  predictionHorizonHours: number;
  confidence: number;
  projectedGeometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  generatedAt: string;
  disclaimer: string;
}

export interface FireCluster {
  clusterId: string;
  name: string;
  region: string;
  center: {
    latitude: number;
    longitude: number;
  };
  perimeter: {
    type: 'Polygon';
    coordinates: number[][][];
    areaKm2: number;
    disclaimer: string;
  };
  hotspotCount: number;
  hotspots: FireObservation[];
  averageFRP: number;
  maxFRP: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];
  detectedAt: string;
  lastUpdatedAt: string;
  spreadPrediction?: SpreadPrediction;
  weather?: WeatherObservation;
  elevation?: ElevationProfile;
  nearestSettlement?: SettlementProximity;
}

export interface Alert {
  id: string;
  clusterId: string;
  clusterName: string;
  region: string;
  alertType: 'HIGH_FIRE_ACTIVITY' | 'RAPID_CLUSTER_GROWTH' | 'FIRE_APPROACHING_POPULATED_AREA' | 'HIGH_WIND_HIGH_FRP';
  severity: 'WARNING' | 'HIGH' | 'CRITICAL';
  message: string;
  createdAt: string;
  acknowledged: boolean;
  affectedRegion: string;
  metrics: {
    frp?: number;
    windSpeed?: number;
    spreadRate?: number;
    distanceToTownKm?: number;
  };
}

export interface SystemStatus {
  firmsApi: 'CONNECTED' | 'FALLBACK_BENCHMARK' | 'ERROR';
  mongodb: 'CONNECTED' | 'IN_MEMORY_SPATIAL_STORE' | string;
  snowflake: 'CONNECTED' | 'SIMULATED_WAREHOUSE' | string;
  weatherApi: 'CONNECTED' | 'CACHE';
  elevationApi: 'CONNECTED' | 'CACHE';
  geoEngine: 'FASTAPI_CONNECTED' | 'TYPESCRIPT_CORE_ACTIVE';
  lastSuccessfulSync: string;
  totalObservations: number;
  totalClusters: number;
  activeAlerts: number;
  processingTimeMs: number;
  currentDataSource?: string;
  isRealTimeActive?: boolean;
  dbscanConfig: {
    epsKm: number;
    minSamples: number;
  };
  refreshIntervalMinutes: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'ANALYST' | 'VIEWER';
}

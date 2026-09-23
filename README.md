# Fire & Space — Satellite Radiometric Hotspot Clustering & Wildfire Monitoring

A production-grade full-stack satellite wildfire monitoring and intelligence platform. The system ingests near-real-time thermal anomaly data from NASA FIRMS satellites (VIIRS 375m and MODIS 1km), indexes observations using spatial trees, clusters thermal anomalies into active fire complexes using geodesic Haversine DBSCAN, synthesizes real atmospheric wind vectors and topographic elevation slopes to project 6-hour fire spread forward cones, and warehouses telemetry in Snowflake for longitudinal multi-year analytics.

---

## 🛰️ Architecture Overview

```
[ NASA FIRMS Satellites (VIIRS 375m / MODIS 1km) ]
                      │
                      ▼
[ Express Node.js Ingestion Engine + Scheduler ]
                      │
                      ├──────────────────────────┐
                      ▼                          ▼
       [ Operational MongoDB 2dsphere ]    [ Snowflake RAW Schema ]
                      │                          │
                      ▼                          │
[ Geospatial Microservice / R-Tree STRtree ]     │
                      │                          │
                      ▼                          │
  [ Geodesic Haversine DBSCAN Clustering ]       │
                      │                          │
                      ▼                          │
[ Convex Hull & Buffered Perimeter Footprint ]   │
                      │                          │
                      ▼                          │
  [ Atmospheric Telemetry & Elevation Engine ]   │
        (Open-Meteo & OpenWeather)               │
                      │                          │
                      ▼                          ▼
 [ Directional Spread Vector & 6h Projection ] -> [ Snowflake ANALYTICS Schema ]
                      │
                      ▼
[ Interactive Leaflet Command Center Dashboard ]
```

---

## 🚀 Key Features

1. **Near-Real-Time NASA FIRMS Ingestion**:
   - Ingests active fire telemetry from VIIRS Suomi-NPP, VIIRS NOAA-20, and Aqua/Terra MODIS.
   - Validates coordinates, normalizes sensor fields (FRP, brightness temperature in Kelvin, confidence levels), and deduplicates satellite passes.
   - Configurable scheduled polling cadence (10–15 mins) with exponential backoff and authentic benchmark archive fallback.

2. **Geospatial Indexing & Geodesic DBSCAN**:
   - **R-Tree / STRtree Spatial Index**: Provides $O(\log N)$ neighborhood querying for efficient hotspot pruning.
   - **Haversine Metric**: Accounts for the curvature of the Earth over global wildfire latitude zones.
   - **Hyperparameters**: Configurable `eps_km` (default 2.5 km) and `min_samples` (default 3).
   - Generates convex hull polygon perimeters buffered to represent satellite sensor ground footprints.

3. **Physics-Informed Spread Vector & 6-Hour Projection**:
   - Directional vector synthesizes downwind forcing (75%) and topographic upslope acceleration (25%) based on Rothermel fire spread dynamics.
   - Generates 6-hour forward-expanding projection cones with azimuth heading, rate of spread (km/h), and confidence metrics.

4. **Community Proximity & Alert Engine**:
   - Computes distance to nearest human settlements, towns, and protected forests.
   - Automated evaluation of 4 incident command alerts:
     - `HIGH_FIRE_ACTIVITY`: FRP > 70 MW or Max FRP > 180 MW.
     - `HIGH_WIND_HIGH_FRP`: Wind > 20 km/h and FRP > 50 MW.
     - `RAPID_CLUSTER_GROWTH`: 6-hour projected expansion ≥ 3.5 km.
     - `FIRE_APPROACHING_POPULATED_AREA`: Perimeter distance to community < 12 km.

5. **Snowflake Historical Analytics Data Warehouse**:
   - Dual-schema architecture: `RAW` (unmodified satellite passes) and `ANALYTICS` (modeled DBSCAN clusters, spread predictions, and views).
   - Analytical queries for daily fire activity rollups, regional risk distribution, and VIIRS vs MODIS sensor comparison.

6. **Interactive Dark Matter Command Dashboard**:
   - Leaflet interactive map with CartoDB Dark Matter, High-Resolution Satellite imagery, and OpenStreetMap terrain.
   - Toggleable geospatial layers: Hotspots (FRP graduated symbology), Cluster Perimeters, 6-Hour Projection Cones, and Directional Vectors.
   - Scientific telemetry cards, filter drawer, and detailed fire inspection panel.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Leaflet, Lucide Icons |
| **Backend** | Node.js, Express, tsx, Server-Sent Events (SSE) |
| **Spatial Engine** | Python FastAPI / GeoPandas / Shapely / STRtree / scikit-learn + High-Performance TypeScript Spatial Core |
| **Operational DB** | MongoDB with `2dsphere` spatial indexing |
| **Warehouse** | Snowflake (`FIRE_SPACE.RAW`, `FIRE_SPACE.ANALYTICS`) |
| **Meteorology** | Open-Meteo Global WMO Forecasts & Elevation API |

---

## ⚡ Quick Start

### 1. Local Development
```bash
# Install dependencies
npm install

# Start development server (Node.js + Vite proxy on port 3000)
npm run dev
```

### 2. Docker Deployment
```bash
# Launch full-stack environment with Docker Compose
docker-compose up --build
```
This boots:
- `fire_space_mongodb`: Operational database on port 27017.
- `fire_space_geo_engine`: Python FastAPI geospatial service on port 8000.
- `fire_space_app`: Express API & React Command Center on port 3000.

---

## 🔑 Environment Variables (`.env`)

```ini
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/fire_space
GEO_ENGINE_URL=http://localhost:8000
FIRMS_API_KEY=YOUR_NASA_FIRMS_KEY
OPENWEATHER_API_KEY=OPTIONAL_KEY
DBSCAN_EPS_KM=2.5
DBSCAN_MIN_SAMPLES=3
FIRE_REFRESH_MINUTES=15
```

---

## 🧪 Scientific Disclaimer

Satellite hotspots are radiometric thermal anomalies, not guaranteed ground-truth wildfire perimeters. Detections can be influenced by cloud obscuration, orbital passes, and non-wildfire thermal sources. The 6-hour spread projection is an experimental physics-based decision-support estimation and must never replace official emergency agency warnings.

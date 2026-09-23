"""
FastAPI Geospatial Processing Engine for Satellite Fire Clustering
Provides:
  - POST /cluster: Haversine DBSCAN with R-tree spatial neighborhood indexing & perimeter generation
  - POST /spread: 6-hour spread projection and directional vector calculation
  - GET /health: Health & status
"""

import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .models import ClusterRequest, ClusterResponse, ClusterResult, SpreadRequest, SpreadResponse
from .clustering import run_dbscan_clustering
from .spatial import SpatialHotspotIndex
from .perimeter import generate_cluster_perimeter
from .spread import calculate_spread_prediction

app = FastAPI(
    title="Fire & Space Geo Engine",
    description="Spatial Indexing, DBSCAN Clustering, Perimeter & Spread Vector Analysis",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "geo-engine",
        "capabilities": ["rtree", "haversine_dbscan", "convex_hull_perimeter", "spread_vector_6h"],
        "timestamp": time.time()
    }

@app.post("/cluster", response_model=ClusterResponse)
def cluster_hotspots(req: ClusterRequest):
    t0 = time.time()
    hotspots_dict = [h.model_dump() for h in req.hotspots]

    if not hotspots_dict:
        return ClusterResponse(
            clusters=[],
            noiseCount=0,
            totalProcessed=0,
            statistics={"durationMs": round((time.time() - t0) * 1000, 2)}
        )

    # Initialize spatial index
    spatial_index = SpatialHotspotIndex(hotspots_dict)

    # Run DBSCAN
    clusters_raw, noise = run_dbscan_clustering(
        hotspots_dict,
        eps_km=req.eps_km or 2.5,
        min_samples=req.min_samples or 3
    )

    cluster_results = []
    cluster_idx = 1000

    for label, pts in clusters_raw.items():
        cluster_idx += 1
        cid = f"F-{cluster_idx}"
        
        center_lat = sum(p["latitude"] for p in pts) / len(pts)
        center_lon = sum(p["longitude"] for p in pts) / len(pts)
        
        frp_vals = [p.get("frp", 10.0) or 10.0 for p in pts]
        avg_frp = round(sum(frp_vals) / len(frp_vals), 2)
        max_frp = round(max(frp_vals), 2)
        
        # Perimeter generation
        perimeter_data = generate_cluster_perimeter(pts)

        # Risk classification
        if max_frp > 150 or (len(pts) > 35 and avg_frp > 60):
            risk = "CRITICAL"
        elif max_frp > 75 or len(pts) > 15:
            risk = "HIGH"
        elif max_frp > 30 or len(pts) > 6:
            risk = "MODERATE"
        else:
            risk = "LOW"

        cluster_results.append(ClusterResult(
            clusterId=cid,
            center={"latitude": round(center_lat, 6), "longitude": round(center_lon, 6)},
            hotspotCount=len(pts),
            estimatedAreaKm2=perimeter_data["areaKm2"],
            averageFRP=avg_frp,
            maxFRP=max_frp,
            hotspotIds=[p.get("id") or f"pt-{i}" for i, p in enumerate(pts)],
            perimeter=perimeter_data,
            confidence="high" if len(pts) >= 5 else "nominal",
            riskLevel=risk
        ))

    duration_ms = round((time.time() - t0) * 1000, 2)

    return ClusterResponse(
        clusters=cluster_results,
        noiseCount=len(noise),
        totalProcessed=len(hotspots_dict),
        statistics={
            "durationMs": duration_ms,
            "epsKm": req.eps_km,
            "minSamples": req.min_samples,
            "spatialIndex": "Shapely STRtree (R-Tree variant)",
            "clustersFound": len(cluster_results)
        }
    )

@app.post("/spread", response_model=SpreadResponse)
def compute_spread(req: SpreadRequest):
    pts = [h.model_dump() for h in req.hotspots]
    frp_vals = [p.get("frp", 10.0) or 10.0 for p in pts]
    avg_frp = (sum(frp_vals) / len(frp_vals)) if frp_vals else 20.0

    prediction = calculate_spread_prediction(
        center_lat=req.centerLat,
        center_lon=req.centerLon,
        wind_speed_kmh=req.windSpeedKmh,
        wind_direction_deg=req.windDirectionDeg,
        slope_factor=req.terrainSlopeFactor,
        slope_aspect_deg=req.slopeAspectDeg or 0.0,
        avg_frp=avg_frp
    )

    return SpreadResponse(
        clusterId=req.clusterId,
        directionDegrees=prediction["directionDegrees"],
        estimatedDistanceKm=prediction["estimatedDistanceKm"],
        predictionHorizonHours=6,
        confidence=prediction["confidence"],
        projectedGeometry=prediction["projectedGeometry"],
        factors=prediction["factors"]
    )

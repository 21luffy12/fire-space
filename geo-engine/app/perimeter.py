"""
Wildfire Perimeter Estimation Module
Generates an approximate boundary geometry from clustered radiometric hotspots.
Note: Labeled explicitly as "ESTIMATED HOTSPOT-BASED PERIMETER".
Not a guaranteed ground-truth burned-area boundary.
"""

import math
from typing import List, Dict, Any, Optional
from shapely.geometry import MultiPoint, Polygon, mapping
from shapely.ops import transform
from .spatial import EARTH_RADIUS_KM

BUFFER_KM = 0.8  # ~800m sensor footprint buffer around detected satellite hotspots

def generate_cluster_perimeter(hotspots: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes a buffered convex hull perimeter GeoJSON and estimated area in km2.
    """
    if not hotspots:
        return {
            "type": "Polygon",
            "coordinates": [],
            "areaKm2": 0.0,
            "disclaimer": "ESTIMATED HOTSPOT-BASED PERIMETER"
        }

    points = [(h["longitude"], h["latitude"]) for h in hotspots]
    mp = MultiPoint(points)

    center_lat = sum(h["latitude"] for h in hotspots) / len(hotspots)
    cos_lat = max(math.cos(math.radians(center_lat)), 0.01)

    # Convert buffer in km to approximate degrees
    buffer_deg_lat = BUFFER_KM / 111.32
    buffer_deg_lon = BUFFER_KM / (111.32 * cos_lat)
    avg_buffer_deg = (buffer_deg_lat + buffer_deg_lon) / 2.0

    if len(hotspots) < 3:
        # Buffer individual points
        geom = mp.buffer(avg_buffer_deg)
    else:
        # Convex hull + buffer for realistic satellite thermal footprint
        hull = mp.convex_hull
        geom = hull.buffer(avg_buffer_deg)

    # Approximate area in km2
    # Area in degree^2 * (111.32 km/deg * 111.32 * cos(lat) km/deg)
    area_deg2 = geom.area
    area_km2 = area_deg2 * (111.32 * 111.32 * cos_lat)

    geojson_geom = mapping(geom)

    return {
        "geojson": geojson_geom,
        "areaKm2": round(area_km2, 2),
        "bufferAppliedKm": BUFFER_KM,
        "disclaimer": "ESTIMATED HOTSPOT-BASED PERIMETER"
    }

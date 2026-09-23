"""
Spatial Indexing and Geodetic Calculation Module
Why Spatial Indexing is Required:
In satellite wildfire monitoring, thousands of active thermal anomalies arrive every pass.
A naive pairwise distance comparison scales quadratically: O(N^2) complexity.
For 10,000 hotspots, that requires 100,000,000 distance evaluations!
Using an R-tree or Shapely STRtree (Sort-Tile-Recursive Tree) partitions coordinates
into hierarchical Minimum Bounding Rectangles (MBRs), reducing spatial search
to O(log N) average time complexity for bounding box filtering and neighborhood queries.
"""

import math
import numpy as np
from typing import List, Tuple, Dict, Any
from shapely.geometry import Point, box
from shapely.strtree import STRtree

EARTH_RADIUS_KM = 6371.0088

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates geodesic great-circle distance between two points in kilometers."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c

class SpatialHotspotIndex:
    """STRtree-backed spatial index for fast neighborhood queries."""

    def __init__(self, hotspots: List[Dict[str, Any]]):
        self.hotspots = hotspots
        self.geometries = [Point(h["longitude"], h["latitude"]) for h in hotspots]
        self.tree = STRtree(self.geometries) if self.geometries else None

    def query_radius(self, lat: float, lon: float, radius_km: float) -> List[int]:
        """
        Query points within a given radius in kilometers using spatial filtering.
        First filters via bounding box, then confirms using accurate Haversine metric.
        """
        if not self.tree or not self.hotspots:
            return []

        # Convert radius in km to approximate degree delta
        lat_delta = radius_km / 111.32
        # Guard against pole singularities
        cos_lat = max(math.cos(math.radians(lat)), 0.01)
        lon_delta = radius_km / (111.32 * cos_lat)

        bbox = box(lon - lon_delta, lat - lat_delta, lon + lon_delta, lat + lat_delta)
        candidate_indices = self.tree.query(bbox)

        # Precise haversine refinement
        valid_indices = []
        for idx in candidate_indices:
            h = self.hotspots[idx]
            dist = haversine_distance(lat, lon, h["latitude"], h["longitude"])
            if dist <= radius_km:
                valid_indices.append(idx)

        return valid_indices

    def query_bbox(self, min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> List[int]:
        """Query all points within a geographic bounding box."""
        if not self.tree:
            return []
        query_box = box(min_lon, min_lat, max_lon, max_lat)
        return list(self.tree.query(query_box))

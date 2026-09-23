"""
DBSCAN Radiometric Hotspot Clustering Module
Uses scikit-learn DBSCAN with exact geodesic Haversine distance metric.
Coordinates are converted to radians (lat, lon) so that eps_radians = eps_km / R_earth.
"""

import math
import numpy as np
from typing import List, Dict, Any, Tuple
from sklearn.cluster import DBSCAN
from .spatial import EARTH_RADIUS_KM

def run_dbscan_clustering(
    hotspots: List[Dict[str, Any]],
    eps_km: float = 2.5,
    min_samples: int = 3
) -> Tuple[Dict[int, List[Dict[str, Any]]], List[Dict[str, Any]]]:
    """
    Performs geodesic DBSCAN on radiometric hotspots.
    Returns:
      (clusters_dict, noise_list)
      where clusters_dict maps cluster_label -> list of hotspots
    """
    if not hotspots:
        return {}, []

    # Prepare coordinates in radians [lat, lon]
    coords_rad = np.radians([[h["latitude"], h["longitude"]] for h in hotspots])

    # Convert kilometer eps to radians
    eps_rad = eps_km / EARTH_RADIUS_KM

    db = DBSCAN(eps=eps_rad, min_samples=min_samples, metric="haversine")
    labels = db.fit_predict(coords_rad)

    clusters: Dict[int, List[Dict[str, Any]]] = {}
    noise: List[Dict[str, Any]] = []

    for idx, label in enumerate(labels):
        h = hotspots[idx]
        if label == -1:
            noise.append(h)
        else:
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(h)

    return clusters, noise

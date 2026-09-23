"""
Directional Fire Spread Vector & 6-Hour Projection Model
Mathematical Formulation:
Spread vector S is a weighted combination of:
  1. Wind forcing vector W (direction and speed)
  2. Topographic slope acceleration vector T (upslope spread tendency)
  3. Historical centroid progression C (if multiple satellite observations exist)

S = w_wind * W + w_slope * T + w_hist * C
6-hour projection is synthesized as an expanding elliptical cone emanating
from the current perimeter along vector S.
"""

import math
from typing import List, Dict, Any
from shapely.geometry import Polygon, mapping

def calculate_spread_prediction(
    center_lat: float,
    center_lon: float,
    wind_speed_kmh: float,
    wind_direction_deg: float,
    slope_factor: float = 1.0,
    slope_aspect_deg: float = 0.0,
    avg_frp: float = 25.0
) -> Dict[str, Any]:
    """
    Computes spread direction, 6-hour estimated forward distance, and projected polygon.
    """
    # Wind direction: meteorological convention is direction FROM which wind blows.
    # Wildfire pushes DOWNWIND (wind_direction_deg + 180 mod 360).
    downwind_deg = (wind_direction_deg + 180.0) % 360.0
    wind_rad = math.radians(downwind_deg)

    # Wind component vector
    w_x = math.sin(wind_rad) * wind_speed_kmh
    w_y = math.cos(wind_rad) * wind_speed_kmh

    # Slope component: fire accelerates upslope
    # Aspect is azimuth facing downslope; upslope direction is (slope_aspect_deg + 180) % 360
    slope_rad = math.radians((slope_aspect_deg + 180.0) % 360.0)
    slope_magnitude = max(0.0, (slope_factor - 1.0) * 10.0)
    t_x = math.sin(slope_rad) * slope_magnitude
    t_y = math.cos(slope_rad) * slope_magnitude

    # Weighted vector combination (wind 0.75, slope 0.25)
    s_x = 0.75 * w_x + 0.25 * t_x
    s_y = 0.75 * w_y + 0.25 * t_y

    spread_deg = (math.degrees(math.atan2(s_x, s_y)) + 360.0) % 360.0

    # Rate of Spread (ROS) empirical approximation in km/h based on Rothermel/McArthur principles
    # Base ROS from FRP + wind effect (increases non-linearly with wind) + slope factor
    base_ros = 0.15 + (avg_frp / 250.0)
    wind_multiplier = 1.0 + 0.04 * (wind_speed_kmh ** 1.15)
    rate_of_spread_kmh = base_ros * wind_multiplier * max(0.8, slope_factor)
    
    # 6-hour forward distance
    estimated_distance_6h_km = min(25.0, round(rate_of_spread_kmh * 6.0, 2))

    # Confidence score based on wind consistency and FRP
    confidence = min(0.92, max(0.45, 0.55 + (avg_frp / 400.0) + (wind_speed_kmh / 150.0)))
    confidence = round(confidence, 2)

    # Construct 6-hour projection cone polygon
    # Emitted from cluster center towards spread_deg with angular dispersion +/- 25 degrees
    spread_rad = math.radians(spread_deg)
    cos_lat = max(math.cos(math.radians(center_lat)), 0.01)

    dispersion_deg = 28.0
    cone_points = [(center_lon, center_lat)]
    
    num_arc_steps = 9
    step_angle = (dispersion_deg * 2.0) / (num_arc_steps - 1)
    
    for i in range(num_arc_steps):
        angle = math.radians(spread_deg - dispersion_deg + i * step_angle)
        # Variable radial distance: maximum at center axis, tapering at edges
        axial_factor = math.cos(math.radians((i - (num_arc_steps - 1) / 2.0) * (dispersion_deg / ((num_arc_steps - 1) / 2.0))))
        r_km = estimated_distance_6h_km * (0.65 + 0.35 * axial_factor)
        
        d_lat = (r_km * math.cos(angle)) / 111.32
        d_lon = (r_km * math.sin(angle)) / (111.32 * cos_lat)
        cone_points.append((center_lon + d_lon, center_lat + d_lat))

    cone_points.append((center_lon, center_lat))  # close ring
    projected_polygon = Polygon(cone_points)

    return {
        "directionDegrees": round(spread_deg, 1),
        "directionVector": {"dx": round(math.sin(spread_rad), 3), "dy": round(math.cos(spread_rad), 3)},
        "rateOfSpreadKmh": round(rate_of_spread_kmh, 2),
        "estimatedDistanceKm": estimated_distance_6h_km,
        "predictionHorizonHours": 6,
        "confidence": confidence,
        "projectedGeometry": mapping(projected_polygon),
        "factors": {
            "windSpeedKmh": wind_speed_kmh,
            "windDirectionDeg": wind_direction_deg,
            "downwindDegrees": round(downwind_deg, 1),
            "terrainSlopeFactor": slope_factor,
            "averageFRP": avg_frp
        },
        "disclaimer": "Experimental fire-spread estimation model. Decision-support estimate, NOT an official emergency forecast."
    }

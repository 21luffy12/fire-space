from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class HotspotPoint(BaseModel):
    id: Optional[str] = None
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    frp: Optional[float] = 10.0
    brightness: Optional[float] = 310.0
    confidence: Optional[str] = "nominal"
    satellite: Optional[str] = "VIIRS_SNPP"
    acquisitionTime: Optional[str] = None

class ClusterRequest(BaseModel):
    hotspots: List[HotspotPoint]
    eps_km: Optional[float] = 2.5
    min_samples: Optional[int] = 3

class GeoJSONPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]

class ClusterResult(BaseModel):
    clusterId: str
    center: Dict[str, float]
    hotspotCount: int
    estimatedAreaKm2: float
    averageFRP: float
    maxFRP: float
    hotspotIds: List[str]
    perimeter: Optional[Dict[str, Any]]
    confidence: str
    riskLevel: str

class ClusterResponse(BaseModel):
    clusters: List[ClusterResult]
    noiseCount: int
    totalProcessed: int
    statistics: Dict[str, Any]

class SpreadRequest(BaseModel):
    clusterId: str
    centerLat: float
    centerLon: float
    hotspots: List[HotspotPoint]
    windSpeedKmh: float = 15.0
    windDirectionDeg: float = 45.0
    terrainSlopeFactor: float = 1.0
    slopeAspectDeg: Optional[float] = 0.0

class SpreadResponse(BaseModel):
    clusterId: str
    directionDegrees: float
    estimatedDistanceKm: float
    predictionHorizonHours: int = 6
    confidence: float
    projectedGeometry: Dict[str, Any]
    factors: Dict[str, Any]

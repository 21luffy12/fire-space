import { FireObservation, FireCluster, SpreadPrediction, WeatherObservation, ElevationProfile } from './types';
import { calculateHaversineKm, findNearestSettlement } from './settlements';

const EARTH_RADIUS_KM = 6371.0088;

/**
 * 2D Bounding Box Spatial R-Tree Node
 * Used for hierarchical spatial pruning before geodesic distance calculations.
 */
interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface RTreeNode {
  bbox: BoundingBox;
  pointIndex?: number;
  children?: RTreeNode[];
}

export class SpatialIndex {
  private root: RTreeNode | null = null;
  private points: { lat: number; lon: number }[] = [];

  constructor(points: { lat: number; lon: number }[]) {
    this.points = points;
    if (points.length > 0) {
      this.root = this.buildTree(points.map((_, i) => i));
    }
  }

  private buildTree(indices: number[]): RTreeNode {
    if (indices.length <= 4) {
      const bbox = this.computeBBox(indices);
      return {
        bbox,
        children: indices.map(idx => ({
          bbox: {
            minLat: this.points[idx].lat,
            maxLat: this.points[idx].lat,
            minLon: this.points[idx].lon,
            maxLon: this.points[idx].lon
          },
          pointIndex: idx
        }))
      };
    }

    // Split along the axis of largest variance
    const bbox = this.computeBBox(indices);
    const latSpan = bbox.maxLat - bbox.minLat;
    const lonSpan = bbox.maxLon - bbox.minLon;

    const sortedIndices = [...indices].sort((a, b) => {
      return latSpan >= lonSpan
        ? this.points[a].lat - this.points[b].lat
        : this.points[a].lon - this.points[b].lon;
    });

    const mid = Math.floor(sortedIndices.length / 2);
    const leftChild = this.buildTree(sortedIndices.slice(0, mid));
    const rightChild = this.buildTree(sortedIndices.slice(mid));

    return {
      bbox,
      children: [leftChild, rightChild]
    };
  }

  private computeBBox(indices: number[]): BoundingBox {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    for (const idx of indices) {
      const p = this.points[idx];
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    }
    return { minLat, maxLat, minLon, maxLon };
  }

  /**
   * Fast query for neighbor indices within radius in km.
   * Prunes non-overlapping subtrees before computing exact Haversine metric.
   */
  public queryRadius(lat: number, lon: number, radiusKm: number): number[] {
    if (!this.root) return [];

    const latDelta = radiusKm / 111.32;
    const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
    const lonDelta = radiusKm / (111.32 * cosLat);

    const queryBBox: BoundingBox = {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLon: lon - lonDelta,
      maxLon: lon + lonDelta
    };

    const candidateIndices: number[] = [];
    this.searchNode(this.root, queryBBox, candidateIndices);

    // Geodesic refinement
    const results: number[] = [];
    for (const idx of candidateIndices) {
      const p = this.points[idx];
      const dist = calculateHaversineKm(lat, lon, p.lat, p.lon);
      if (dist <= radiusKm) {
        results.push(idx);
      }
    }
    return results;
  }

  private searchNode(node: RTreeNode, qBbox: BoundingBox, results: number[]) {
    // Check bbox intersection
    if (
      node.bbox.minLat > qBbox.maxLat ||
      node.bbox.maxLat < qBbox.minLat ||
      node.bbox.minLon > qBbox.maxLon ||
      node.bbox.maxLon < qBbox.minLon
    ) {
      return;
    }

    if (node.pointIndex !== undefined) {
      results.push(node.pointIndex);
      return;
    }

    if (node.children) {
      for (const child of node.children) {
        this.searchNode(child, qBbox, results);
      }
    }
  }
}

/**
 * Geodesic DBSCAN (Density-Based Spatial Clustering of Applications with Noise)
 * Operates with configurable eps in kilometers and min_samples.
 */
export function runDBSCAN(
  hotspots: FireObservation[],
  epsKm: number = 2.5,
  minSamples: number = 3
): { clusters: FireObservation[][]; noise: FireObservation[] } {
  if (hotspots.length === 0) return { clusters: [], noise: [] };

  const spatialIndex = new SpatialIndex(
    hotspots.map(h => ({ lat: h.latitude, lon: h.longitude }))
  );

  const visited = new Set<number>();
  const clustered = new Set<number>();
  const clusters: FireObservation[][] = [];
  const noiseIndices = new Set<number>();

  for (let i = 0; i < hotspots.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    const neighbors = spatialIndex.queryRadius(hotspots[i].latitude, hotspots[i].longitude, epsKm);

    if (neighbors.length < minSamples) {
      noiseIndices.add(i);
    } else {
      noiseIndices.delete(i);
      const currentCluster: number[] = [i];
      clustered.add(i);

      const queue = [...neighbors];
      let head = 0;

      while (head < queue.length) {
        const neighborIdx = queue[head++];

        if (!visited.has(neighborIdx)) {
          visited.add(neighborIdx);
          const secondaryNeighbors = spatialIndex.queryRadius(
            hotspots[neighborIdx].latitude,
            hotspots[neighborIdx].longitude,
            epsKm
          );
          if (secondaryNeighbors.length >= minSamples) {
            for (const sn of secondaryNeighbors) {
              if (!queue.includes(sn)) {
                queue.push(sn);
              }
            }
          }
        }

        if (!clustered.has(neighborIdx)) {
          clustered.add(neighborIdx);
          currentCluster.push(neighborIdx);
          noiseIndices.delete(neighborIdx);
        }
      }

      clusters.push(currentCluster.map(idx => hotspots[idx]));
    }
  }

  const noise = Array.from(noiseIndices).map(idx => hotspots[idx]);
  return { clusters, noise };
}

/**
 * Monotone Chain Convex Hull algorithm
 * Converts clustered lat/lon points into a convex polygon perimeter.
 */
export function computeConvexHull(points: [number, number][]): [number, number][] {
  if (points.length <= 2) return points;

  // Sort primarily by lon (x), secondarily by lat (y)
  const sorted = [...points].sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);

  const cross = (o: [number, number], a: [number, number], b: [number, number]) => {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  };

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Buffer polygon coordinates outward by bufferKm to represent sensor footprint.
 */
export function bufferPerimeter(
  hullPoints: [number, number][],
  centerLat: number,
  bufferKm: number = 0.8
): [number, number][] {
  if (hullPoints.length === 0) return [];
  const cosLat = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01);
  const latDelta = bufferKm / 111.32;
  const lonDelta = bufferKm / (111.32 * cosLat);

  // Centroid
  const cLon = hullPoints.reduce((acc, p) => acc + p[0], 0) / hullPoints.length;
  const cLat = hullPoints.reduce((acc, p) => acc + p[1], 0) / hullPoints.length;

  const buffered: [number, number][] = hullPoints.map(p => {
    const dx = p[0] - cLon;
    const dy = p[1] - cLat;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.00001) {
      return [p[0] + lonDelta, p[1] + latDelta];
    }
    const expandLon = (dx / len) * lonDelta;
    const expandLat = (dy / len) * latDelta;
    return [Math.round((p[0] + expandLon) * 10000) / 10000, Math.round((p[1] + expandLat) * 10000) / 10000];
  });

  // Ensure closed ring
  buffered.push(buffered[0]);
  return buffered;
}

/**
 * Calculates approximate polygon area in km2.
 */
export function calculatePolygonAreaKm2(coords: [number, number][], centerLat: number): number {
  if (coords.length < 3) return 0.5;
  const cosLat = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01);
  const kmPerDegLat = 111.32;
  const kmPerDegLon = 111.32 * cosLat;

  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    area += (p1[0] * kmPerDegLon) * (p2[1] * kmPerDegLat) - (p2[0] * kmPerDegLon) * (p1[1] * kmPerDegLat);
  }
  return Math.round(Math.abs(area / 2) * 10) / 10;
}

/**
 * 6-Hour Directional Fire Spread Vector & Projection Cone Model
 */
export function computeSpreadProjection(
  clusterId: string,
  centerLat: number,
  centerLon: number,
  windSpeedKmh: number,
  windDirectionDeg: number,
  slopeFactor: number = 1.0,
  slopeAspectDeg: number = 0.0,
  avgFrp: number = 25.0
): SpreadPrediction {
  // Meteorological wind: direction FROM which wind blows. Wildfire pushes DOWNWIND.
  const downwindDeg = (windDirectionDeg + 180.0) % 360.0;
  const windRad = (downwindDeg * Math.PI) / 180.0;

  const wx = Math.sin(windRad) * windSpeedKmh;
  const wy = Math.cos(windRad) * windSpeedKmh;

  // Slope factor accelerates upslope (opposite of downhill aspect)
  const upslopeDeg = (slopeAspectDeg + 180.0) % 360.0;
  const slopeRad = (upslopeDeg * Math.PI) / 180.0;
  const slopeMagnitude = Math.max(0, (slopeFactor - 1.0) * 12.0);
  const tx = Math.sin(slopeRad) * slopeMagnitude;
  const ty = Math.cos(slopeRad) * slopeMagnitude;

  // Composite spread vector (75% wind, 25% topography)
  const sx = 0.75 * wx + 0.25 * tx;
  const sy = 0.75 * wy + 0.25 * ty;

  const spreadDeg = Math.round(((Math.atan2(sx, sy) * 180.0 / Math.PI) + 360.0) % 360.0);
  const spreadRad = (spreadDeg * Math.PI) / 180.0;

  // Empirical Rate of Spread (ROS) in km/h
  const baseRos = 0.18 + (avgFrp / 220.0);
  const windMultiplier = 1.0 + 0.035 * Math.pow(windSpeedKmh, 1.15);
  const rateOfSpreadKmh = Math.round(baseRos * windMultiplier * Math.max(0.8, slopeFactor) * 100) / 100;

  // 6-hour forward displacement
  const estimatedDistanceKm = Math.min(24.0, Math.round(rateOfSpreadKmh * 6.0 * 10) / 10);
  const confidence = Math.min(0.92, Math.max(0.48, Math.round((0.55 + avgFrp / 380 + windSpeedKmh / 140) * 100) / 100));

  // Synthesize 6-hour expanding projection cone
  const cosLat = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01);
  const dispersionDeg = 26.0;
  const coneCoords: [number, number][] = [[centerLon, centerLat]];
  const arcSteps = 9;

  for (let i = 0; i < arcSteps; i++) {
    const angleOffset = -dispersionDeg + (i * (dispersionDeg * 2)) / (arcSteps - 1);
    const angleRad = ((spreadDeg + angleOffset) * Math.PI) / 180.0;

    // Radius tapers towards cone flanks
    const flankFactor = Math.cos((angleOffset * Math.PI) / (dispersionDeg * 2.2));
    const rKm = estimatedDistanceKm * (0.65 + 0.35 * flankFactor);

    const dLat = (rKm * Math.cos(angleRad)) / 111.32;
    const dLon = (rKm * Math.sin(angleRad)) / (111.32 * cosLat);
    coneCoords.push([Math.round((centerLon + dLon) * 10000) / 10000, Math.round((centerLat + dLat) * 10000) / 10000]);
  }
  coneCoords.push([centerLon, centerLat]); // close polygon

  return {
    clusterId,
    origin: { latitude: centerLat, longitude: centerLon },
    directionDegrees: spreadDeg,
    directionVector: {
      dx: Math.round(Math.sin(spreadRad) * 1000) / 1000,
      dy: Math.round(Math.cos(spreadRad) * 1000) / 1000
    },
    rateOfSpreadKmh,
    estimatedDistanceKm,
    windSpeedKmh,
    windDirectionDeg,
    terrainFactor: slopeFactor,
    predictionHorizonHours: 6,
    confidence,
    projectedGeometry: {
      type: 'Polygon',
      coordinates: [coneCoords]
    },
    generatedAt: new Date().toISOString(),
    disclaimer: 'Experimental fire-spread estimation model. Decision-support estimate, NOT an official emergency forecast.'
  };
}

/**
 * Assign name and region to a cluster based on its geographic center
 */
export function identifyRegionAndName(lat: number, lon: number): { region: string; name: string } {
  // North America
  if (lat >= 32 && lat <= 44 && lon >= -125 && lon <= -114) {
    return { region: 'North America (California / Sierra)', name: 'Sierra Nevada Complex' };
  }
  if (lat >= 48 && lat <= 68 && lon >= -140 && lon <= -60) {
    return { region: 'North America (Canadian Boreal)', name: 'Boreal Forest Complex' };
  }
  if (lat >= 25 && lat <= 50 && lon >= -125 && lon <= -65) {
    return { region: 'North America (US Contiguous)', name: `North America Complex ${lat.toFixed(1)}°N` };
  }
  // South America
  if (lat >= -25 && lat <= 5 && lon >= -80 && lon <= -35) {
    return { region: 'South America (Amazon / Pantanal)', name: 'Amazon Basin Complex' };
  }
  if (lat < -25 && lat >= -55 && lon >= -75 && lon <= -55) {
    return { region: 'South America (Gran Chaco / Pampas)', name: 'Southern Cone Complex' };
  }
  // Europe
  if (lat >= 35 && lat <= 45 && lon >= -10 && lon <= 30) {
    return { region: 'Europe (Mediterranean Basin)', name: 'Mediterranean Fire Front' };
  }
  if (lat >= 45 && lat <= 70 && lon >= -10 && lon <= 40) {
    return { region: 'Northern & Central Europe', name: 'European Forestry Sector' };
  }
  // Africa
  if (lat >= -35 && lat <= 0 && lon >= 10 && lon <= 40) {
    return { region: 'Southern Africa Savanna', name: 'Savanna Fire Zone' };
  }
  if (lat >= 0 && lat <= 15 && lon >= -15 && lon <= 40) {
    return { region: 'Central & Western Africa (Sahel)', name: 'Sahelian Biomass Front' };
  }
  // India & South Asia Subcontinent
  if (lat >= 26 && lat <= 35 && lon >= 73 && lon <= 88) {
    return { region: 'India (Indo-Gangetic & North)', name: 'Indo-Gangetic Agricultural & Forest Complex' };
  }
  if (lat >= 18 && lat <= 26 && lon >= 72 && lon <= 86) {
    return { region: 'India (Central & Western Deciduous)', name: 'Central India Forest Belt' };
  }
  if (lat >= 8 && lat <= 18 && lon >= 74 && lon <= 82) {
    return { region: 'India (South & Western Ghats)', name: 'Western Ghats & Deccan Complex' };
  }
  if (lat >= 22 && lat <= 29 && lon >= 88 && lon <= 97) {
    return { region: 'India (North-East & Assam)', name: 'Brahmaputra Valley Forest Front' };
  }
  if (lat >= 6 && lat <= 37 && lon >= 68 && lon <= 97) {
    return { region: 'India & South Asia', name: `South Asia Regional Sector ${lat.toFixed(1)}°N` };
  }

  // Southeast & East Asia
  if (lat >= -11 && lat <= 24 && lon >= 95 && lon <= 142) {
    return { region: 'Southeast Asia (Maritime & Indochina)', name: 'Southeast Asian Peatland/Canopy Complex' };
  }
  if (lat >= 20 && lat <= 50 && lon >= 98 && lon <= 125) {
    return { region: 'East Asia (China Basin)', name: 'East Asian Biomass Complex' };
  }
  if (lat >= 50 && lat <= 72 && lon >= 60 && lon <= 170) {
    return { region: 'North Asia (Siberian Taiga)', name: 'Siberian Taiga Complex' };
  }
  if (lat >= 35 && lat <= 55 && lon >= 50 && lon <= 85) {
    return { region: 'Central Asia (Steppe & Highlands)', name: 'Central Asian Steppe Sector' };
  }
  // Australia & Oceania
  if (lat >= -45 && lat <= -10 && lon >= 110 && lon <= 155) {
    return { region: 'Australia (Bushland & Outback)', name: 'Australian Bushfire Sector' };
  }

  const hemisphereLat = lat >= 0 ? `${lat.toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`;
  const hemisphereLon = lon >= 0 ? `${lon.toFixed(1)}°E` : `${Math.abs(lon).toFixed(1)}°W`;
  return { region: 'Global Monitored Basin', name: `Global Hotspot Complex (${hemisphereLat}, ${hemisphereLon})` };
}

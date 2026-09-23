import { Alert, FireCluster } from './types';

let alertStore: Alert[] = [];

export function evaluateClusterAlerts(clusters: FireCluster[]): Alert[] {
  const newAlerts: Alert[] = [];

  for (const cluster of clusters) {
    const existingForCluster = alertStore.filter(a => a.clusterId === cluster.clusterId);

    // Rule 1: HIGH FIRE ACTIVITY (Average FRP > 70 MW or Max FRP > 180 MW)
    if (cluster.averageFRP > 70 || cluster.maxFRP > 180 || cluster.hotspotCount >= 8) {
      if (!existingForCluster.some(a => a.alertType === 'HIGH_FIRE_ACTIVITY')) {
        newAlerts.push({
          id: `alt-act-${cluster.clusterId}-${Date.now()}`,
          clusterId: cluster.clusterId,
          clusterName: cluster.name,
          region: cluster.region,
          alertType: 'HIGH_FIRE_ACTIVITY',
          severity: cluster.maxFRP > 200 ? 'CRITICAL' : 'HIGH',
          message: `Elevated radiometric intensity: Cluster ${cluster.name} detected with peak FRP of ${cluster.maxFRP} MW across ${cluster.hotspotCount} satellite hotspots.`,
          createdAt: new Date().toISOString(),
          acknowledged: false,
          affectedRegion: cluster.region,
          metrics: {
            frp: cluster.maxFRP
          }
        });
      }
    }

    // Rule 2: HIGH WIND + HIGH FRP (Wind > 20 km/h and FRP > 50 MW)
    if (cluster.weather && cluster.weather.windSpeedKmh >= 20 && cluster.averageFRP >= 50) {
      if (!existingForCluster.some(a => a.alertType === 'HIGH_WIND_HIGH_FRP')) {
        newAlerts.push({
          id: `alt-wnd-${cluster.clusterId}-${Date.now()}`,
          clusterId: cluster.clusterId,
          clusterName: cluster.name,
          region: cluster.region,
          alertType: 'HIGH_WIND_HIGH_FRP',
          severity: 'CRITICAL',
          message: `Atmospheric threat multiplier: Sustained winds of ${cluster.weather.windSpeedKmh} km/h (${cluster.weather.windDirectionCardinal}) impacting active fire front with ${cluster.averageFRP} MW mean FRP.`,
          createdAt: new Date().toISOString(),
          acknowledged: false,
          affectedRegion: cluster.region,
          metrics: {
            windSpeed: cluster.weather.windSpeedKmh,
            frp: cluster.averageFRP
          }
        });
      }
    }

    // Rule 3: RAPID CLUSTER GROWTH / SPREAD (6h forward expansion >= 3.5 km)
    if (cluster.spreadPrediction && cluster.spreadPrediction.estimatedDistanceKm >= 3.5) {
      if (!existingForCluster.some(a => a.alertType === 'RAPID_CLUSTER_GROWTH')) {
        newAlerts.push({
          id: `alt-spd-${cluster.clusterId}-${Date.now()}`,
          clusterId: cluster.clusterId,
          clusterName: cluster.name,
          region: cluster.region,
          alertType: 'RAPID_CLUSTER_GROWTH',
          severity: 'HIGH',
          message: `High velocity forward expansion: Model projects ${cluster.spreadPrediction.estimatedDistanceKm} km 6-hour displacement heading ${cluster.spreadPrediction.directionDegrees}° at ${cluster.spreadPrediction.rateOfSpreadKmh} km/h.`,
          createdAt: new Date().toISOString(),
          acknowledged: false,
          affectedRegion: cluster.region,
          metrics: {
            spreadRate: cluster.spreadPrediction.rateOfSpreadKmh
          }
        });
      }
    }

    // Rule 4: FIRE APPROACHING POPULATED AREA (< 12 km to town/settlement)
    if (cluster.nearestSettlement && cluster.nearestSettlement.distanceKm <= 12.0) {
      if (!existingForCluster.some(a => a.alertType === 'FIRE_APPROACHING_POPULATED_AREA')) {
        newAlerts.push({
          id: `alt-pop-${cluster.clusterId}-${Date.now()}`,
          clusterId: cluster.clusterId,
          clusterName: cluster.name,
          region: cluster.region,
          alertType: 'FIRE_APPROACHING_POPULATED_AREA',
          severity: cluster.nearestSettlement.distanceKm <= 6.0 ? 'CRITICAL' : 'HIGH',
          message: `Human settlement proximity: Thermal perimeter is ${cluster.nearestSettlement.distanceKm} km from ${cluster.nearestSettlement.name} (${cluster.nearestSettlement.type.replace('_', ' ')}).`,
          createdAt: new Date().toISOString(),
          acknowledged: false,
          affectedRegion: cluster.nearestSettlement.name,
          metrics: {
            distanceToTownKm: cluster.nearestSettlement.distanceKm
          }
        });
      }
    }
  }

  // Prepend new alerts
  alertStore = [...newAlerts, ...alertStore].slice(0, 100);
  return alertStore;
}

export function getAllAlerts(): Alert[] {
  return alertStore;
}

export function acknowledgeAlert(alertId: string): Alert | null {
  const alert = alertStore.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    return alert;
  }
  return null;
}

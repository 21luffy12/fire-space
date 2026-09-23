import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ArrowLeft, Flame, Wind, Mountain, Navigation, MapPin, ShieldAlert, Satellite, Clock, Activity, Calendar } from 'lucide-react';
import { FireCluster } from '../types';
import { ScientificDisclaimer } from '../components/ScientificDisclaimer';

interface FireDetailPageProps {
  cluster: FireCluster | null;
  onBack: () => void;
  onViewOnMainMap: (clusterId: string) => void;
}

export const FireDetailPage: React.FC<FireDetailPageProps> = ({
  cluster,
  onBack,
  onViewOnMainMap
}) => {
  const miniMapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!miniMapRef.current || !cluster) return;

    if (leafletInstance.current) {
      leafletInstance.current.remove();
      leafletInstance.current = null;
    }

    const map = L.map(miniMapRef.current, {
      center: [cluster.center.latitude, cluster.center.longitude],
      zoom: 11,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      maxNativeZoom: 16,
      attribution: 'Esri'
    }).addTo(map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      maxNativeZoom: 16,
      zIndex: 600
    }).addTo(map);

    // 6-hour projection cone
    if (cluster.spreadPrediction) {
      const coneCoords = cluster.spreadPrediction.projectedGeometry.coordinates[0];
      const latLngs = coneCoords.map(pt => [pt[1], pt[0]] as [number, number]);
      L.polygon(latLngs, {
        color: '#f97316',
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: '#f97316',
        fillOpacity: 0.2
      }).addTo(map);
    }

    // Cluster perimeter
    if (cluster.perimeter) {
      const polyCoords = cluster.perimeter.coordinates[0];
      const latLngs = polyCoords.map(pt => [pt[1], pt[0]] as [number, number]);
      L.polygon(latLngs, {
        color: '#38bdf8',
        weight: 2,
        fillColor: '#d97706',
        fillOpacity: 0.3
      }).addTo(map);
    }

    // Hotspot points
    cluster.hotspots.forEach(h => {
      const radius = Math.min(10, Math.max(4, 3 + Math.sqrt(h.fireRadiativePower) * 0.6));
      L.circleMarker([h.latitude, h.longitude], {
        radius,
        color: '#ef4444',
        fillColor: h.fireRadiativePower > 100 ? '#ffffff' : '#f59e0b',
        fillOpacity: 0.9,
        weight: 1.5
      }).addTo(map);
    });

    leafletInstance.current = map;

    return () => {
      map.remove();
      leafletInstance.current = null;
    };
  }, [cluster]);

  if (!cluster) {
    return (
      <div className="flex-1 p-8 text-center bg-[#07090e] flex flex-col items-center justify-center">
        <Flame className="w-12 h-12 text-slate-600 mb-3" />
        <h2 className="text-lg font-bold text-slate-200">Cluster Not Found</h2>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-[#1e293b] hover:bg-[#334155] text-slate-200 text-xs font-mono rounded"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const p = cluster.spreadPrediction;
  const w = cluster.weather;
  const e = cluster.elevation;
  const s = cluster.nearestSettlement;

  return (
    <div className="flex-1 bg-[#07090e] p-4 lg:p-6 overflow-y-auto space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Navigation & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded bg-[#0f172a] hover:bg-[#1e293b] text-slate-300 border border-[#1e293b] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">CLUSTER ANALYSIS #{cluster.clusterId}</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  cluster.riskLevel === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                  cluster.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {cluster.riskLevel} RISK
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-100">{cluster.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onViewOnMainMap(cluster.clusterId)}
              className="px-3 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-slate-200 border border-[#1e293b] text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>View On Main Command Map</span>
            </button>
          </div>
        </div>

        {/* Top Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded">
            <span className="text-[10px] font-mono text-slate-400 block">SATELLITE HOTSPOTS</span>
            <span className="text-xl font-mono font-bold text-slate-100 tabular-nums">{cluster.hotspotCount}</span>
            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">VIIRS / MODIS</span>
          </div>
          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded">
            <span className="text-[10px] font-mono text-slate-400 block">ESTIMATED AREA</span>
            <span className="text-xl font-mono font-bold text-slate-100 tabular-nums">{cluster.perimeter.areaKm2} <span className="text-xs text-slate-400">KM²</span></span>
            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Footprint Area</span>
          </div>
          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded">
            <span className="text-[10px] font-mono text-slate-400 block">MEAN RADIATIVE POWER</span>
            <span className="text-xl font-mono font-bold text-amber-400 tabular-nums">{cluster.averageFRP} <span className="text-xs text-slate-400">MW</span></span>
            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Average Heat Flux</span>
          </div>
          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded">
            <span className="text-[10px] font-mono text-slate-400 block">PEAK RADIATIVE POWER</span>
            <span className="text-xl font-mono font-bold text-rose-400 tabular-nums">{cluster.maxFRP} <span className="text-xs text-slate-400">MW</span></span>
            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Maximum Pixel Cell</span>
          </div>
          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded">
            <span className="text-[10px] font-mono text-slate-400 block">6-HR EXPANSION</span>
            <span className="text-xl font-mono font-bold text-cyan-400 tabular-nums">+{p?.estimatedDistanceKm || 0} <span className="text-xs text-slate-400">KM</span></span>
            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Heading {p?.directionDegrees || 0}°</span>
          </div>
          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded">
            <span className="text-[10px] font-mono text-slate-400 block">NEAREST COMMUNITY</span>
            <span className="text-sm font-mono font-bold text-slate-100 truncate block mt-1">{s?.name || 'Isolated'}</span>
            <span className="text-[10px] font-mono text-rose-400 block">{s ? `${s.distanceKm} km away` : 'No settlements'}</span>
          </div>
        </div>

        {/* 2-Column Detail: Left Map + Spread Projection / Right Physics & Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Mini Interactive Map (7 cols) */}
          <div className="lg:col-span-7 bg-[#0f172a] border border-[#1e293b] rounded p-3 flex flex-col">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span className="font-semibold text-slate-200">CLUSTER RADIOMETRIC FOOTPRINT & PROJECTION CONE</span>
              <span>Coordinates: {cluster.center.latitude.toFixed(4)}°N, {cluster.center.longitude.toFixed(4)}°E</span>
            </div>
            <div ref={miniMapRef} className="w-full h-80 rounded border border-[#1e293b] overflow-hidden" />
            <div className="mt-2 text-[11px] font-mono text-slate-500 flex items-center justify-between">
              <span>● Solid blue line: DBSCAN sensor perimeter</span>
              <span>-- Dashed orange zone: 6-hour forward spread cone</span>
            </div>
          </div>

          {/* Right Column: Physical & Environmental Model Parameters (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            {/* Spread Vector Model */}
            {p && (
              <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-cyan-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Navigation className="w-4 h-4" />
                    DIRECTIONAL SPREAD VECTOR MODEL
                  </span>
                  <span>Horizon: {p.predictionHorizonHours}h</span>
                </div>
                <div className="text-xs font-mono text-slate-300 grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-slate-500 text-[10px] block">SPREAD AZIMUTH</span>
                    <span className="font-bold text-slate-100 text-sm">{p.directionDegrees}°</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">FORWARD DISPLACEMENT</span>
                    <span className="font-bold text-amber-400 text-sm">{p.estimatedDistanceKm} km</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">ESTIMATED RATE OF SPREAD</span>
                    <span className="font-bold text-slate-200">{p.rateOfSpreadKmh} km/h</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">CONFIDENCE INDEX</span>
                    <span className="font-bold text-emerald-400">{Math.round(p.confidence * 100)}%</span>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-[#1e293b]">
                  {p.disclaimer}
                </div>
              </div>
            )}

            {/* Weather & Terrain Combined */}
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-slate-400" />
                  ATMOSPHERIC & TOPOGRAPHIC FORCING
                </span>
                <span className="text-[10px] font-mono text-slate-500">Open-Meteo Synced</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">WIND SPEED & VECTOR</span>
                  <span className="font-semibold text-slate-200">{w?.windSpeedKmh || '--'} km/h ({w?.windDirectionCardinal || '--'})</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">AMBIENT TEMPERATURE</span>
                  <span className="font-semibold text-slate-200">{w?.temperatureC || '--'}°C ({w?.humidityPct || '--'}% RH)</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">TERRAIN SLOPE</span>
                  <span className="font-semibold text-slate-200">{e?.slopeDegrees || '--'}° gradient</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">TOPOGRAPHIC MULTIPLIER</span>
                  <span className="font-semibold text-amber-400">{e?.slopeFactor || '--'}x</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hotspot Observation Sensor Table */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded overflow-hidden">
          <div className="p-3 border-b border-[#1e293b] flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-200">
              CLUSTER HOTSPOT OBSERVATIONS ({cluster.hotspots.length} SATELLITE READINGS)
            </h3>
            <span className="text-[11px] font-mono text-slate-500">NASA FIRMS Telemetry</span>
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead className="bg-[#07090e] text-slate-400 sticky top-0">
                <tr className="border-b border-[#1e293b]">
                  <th className="p-2.5">OBSERVATION ID</th>
                  <th className="p-2.5">COORDINATES</th>
                  <th className="p-2.5">FRP (MW)</th>
                  <th className="p-2.5">BRIGHTNESS</th>
                  <th className="p-2.5">SATELLITE</th>
                  <th className="p-2.5">CONFIDENCE</th>
                  <th className="p-2.5">ACQUIRED UTC</th>
                  <th className="p-2.5">PASS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/60">
                {cluster.hotspots.map(h => (
                  <tr key={h.id} className="hover:bg-[#1e293b]/40">
                    <td className="p-2.5 text-slate-400">{h.id}</td>
                    <td className="p-2.5 text-slate-200">{h.latitude.toFixed(4)}°, {h.longitude.toFixed(4)}°</td>
                    <td className="p-2.5 text-amber-400 font-bold tabular-nums">{h.fireRadiativePower} MW</td>
                    <td className="p-2.5 text-slate-300 tabular-nums">{h.brightnessTemperature} K</td>
                    <td className="p-2.5 text-slate-300">{h.satellite}</td>
                    <td className="p-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        h.confidence === 'high' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {h.confidence}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-400">{h.acquisitionDate} {h.acquisitionTime}</td>
                    <td className="p-2.5 text-slate-400">{h.dayNight === 'D' ? 'Day pass' : 'Night pass'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ScientificDisclaimer />
      </div>
    </div>
  );
};

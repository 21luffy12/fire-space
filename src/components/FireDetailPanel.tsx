import React from 'react';
import { Wind, Mountain, Navigation, Compass, AlertOctagon, ShieldCheck, ArrowUpRight, Flame, MapPin } from 'lucide-react';
import { FireCluster } from '../types';

interface FireDetailPanelProps {
  cluster: FireCluster | null;
  onNavigateDetail: (clusterId: string) => void;
  onClose?: () => void;
}

export const FireDetailPanel: React.FC<FireDetailPanelProps> = ({
  cluster,
  onNavigateDetail
}) => {
  if (!cluster) {
    return (
      <div className="h-full bg-[#0f172a] border border-[#1e293b] rounded p-4 flex flex-col items-center justify-center text-center">
        <Flame className="w-10 h-10 text-slate-600 mb-3" />
        <h4 className="text-sm font-semibold text-slate-300 mb-1">No Fire Cluster Selected</h4>
        <p className="text-xs text-slate-500 max-w-xs font-mono">
          Click any active thermal cluster or hotspot on the map to inspect radiometric intensity, terrain slope, wind vectors, and 6-hour forward projections.
        </p>
      </div>
    );
  }

  const p = cluster.spreadPrediction;
  const w = cluster.weather;
  const e = cluster.elevation;
  const s = cluster.nearestSettlement;

  const riskColor = {
    LOW: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    MODERATE: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    HIGH: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    CRITICAL: 'text-rose-400 border-rose-500/30 bg-rose-500/10'
  }[cluster.riskLevel];

  return (
    <div className="h-full bg-[#0f172a] border border-[#1e293b] rounded flex flex-col overflow-y-auto">
      {/* Cluster Header */}
      <div className="p-4 border-b border-[#1e293b] bg-[#07090e]/50">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-mono text-slate-400 tracking-wider">
            CLUSTER #{cluster.clusterId}
          </span>
          <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${riskColor}`}>
            {cluster.riskLevel} RISK
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-100 leading-snug">
          {cluster.name}
        </h3>
        <div className="text-xs font-mono text-slate-400 mt-0.5">
          {cluster.region} · {cluster.center.latitude.toFixed(3)}°N, {cluster.center.longitude.toFixed(3)}°E
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Core Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#07090e] border border-[#1e293b] p-2.5 rounded">
            <div className="text-[11px] font-mono text-slate-400">HOTSPOTS</div>
            <div className="text-xl font-mono font-bold text-slate-100 tabular-nums">
              {cluster.hotspotCount}
            </div>
            <div className="text-[10px] font-mono text-slate-500">VIIRS & MODIS</div>
          </div>
          <div className="bg-[#07090e] border border-[#1e293b] p-2.5 rounded">
            <div className="text-[11px] font-mono text-slate-400">ESTIMATED AREA</div>
            <div className="text-xl font-mono font-bold text-slate-100 tabular-nums">
              {cluster.perimeter.areaKm2} <span className="text-xs text-slate-400">KM²</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500">Sensor footprint</div>
          </div>
          <div className="bg-[#07090e] border border-[#1e293b] p-2.5 rounded">
            <div className="text-[11px] font-mono text-slate-400">AVERAGE FRP</div>
            <div className="text-xl font-mono font-bold text-amber-400 tabular-nums">
              {cluster.averageFRP} <span className="text-xs text-slate-400">MW</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500">Radiative power</div>
          </div>
          <div className="bg-[#07090e] border border-[#1e293b] p-2.5 rounded">
            <div className="text-[11px] font-mono text-slate-400">PEAK FRP</div>
            <div className="text-xl font-mono font-bold text-rose-400 tabular-nums">
              {cluster.maxFRP} <span className="text-xs text-slate-400">MW</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500">Maximum sensor cell</div>
          </div>
        </div>

        {/* 6-Hour Spread Projection Vector */}
        {p && (
          <div className="bg-[#07090e] border border-[#1e293b] p-3 rounded space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
              <span className="flex items-center gap-1 font-semibold">
                <Navigation className="w-3.5 h-3.5" />
                6-HOUR PROJECTION MODEL
              </span>
              <span className="text-slate-400">Horizon: 6h</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[10px] block">SPREAD HEADING</span>
                <span className="text-sm font-bold text-slate-200">{p.directionDegrees}°</span>
                <span className="text-[10px] text-slate-400 ml-1">Azimuth</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">6-HR EXPANSION</span>
                <span className="text-sm font-bold text-amber-400">+{p.estimatedDistanceKm} km</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">EST. RATE OF SPREAD</span>
                <span className="text-xs text-slate-300 font-bold">{p.rateOfSpreadKmh} km/h</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">MODEL CONFIDENCE</span>
                <span className="text-xs text-emerald-400 font-bold">{Math.round(p.confidence * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Atmospheric Telemetry */}
        {w && (
          <div className="bg-[#07090e] border border-[#1e293b] p-3 rounded space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 font-semibold mb-1">
              <Wind className="w-3.5 h-3.5 text-slate-400" />
              <span>ATMOSPHERIC CONDITIONS</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[10px] block">WIND VECTOR</span>
                <span className="text-slate-200 font-semibold">{w.windSpeedKmh} km/h {w.windDirectionCardinal}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">TEMPERATURE</span>
                <span className="text-slate-200 font-semibold">{w.temperatureC}°C · {w.humidityPct}% RH</span>
              </div>
            </div>
          </div>
        )}

        {/* Topography & Elevation */}
        {e && (
          <div className="bg-[#07090e] border border-[#1e293b] p-3 rounded space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 font-semibold mb-1">
              <Mountain className="w-3.5 h-3.5 text-slate-400" />
              <span>TERRAIN & TOPOGRAPHY</span>
            </div>
            <div className="text-xs font-mono text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Elevation:</span>
                <span className="font-semibold">{e.elevationMeters} m ASL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Slope Gradient:</span>
                <span className="font-semibold">{e.slopeDegrees}° ({e.terrainDescription})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Topographic Multiplier:</span>
                <span className="text-amber-400 font-semibold">{e.slopeFactor}x</span>
              </div>
            </div>
          </div>
        )}

        {/* Settlement Impact */}
        {s && (
          <div className="bg-[#07090e] border border-[#1e293b] p-3 rounded space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 font-semibold">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>COMMUNITY PROXIMITY</span>
            </div>
            <div className="text-xs font-mono flex items-baseline justify-between pt-1">
              <span className="text-slate-200 font-bold">{s.name}</span>
              <span className="text-rose-400 font-semibold">{s.distanceKm} km away</span>
            </div>
            {s.population && (
              <div className="text-[10px] font-mono text-slate-500">
                Pop. {s.population.toLocaleString()} · Designated evacuation monitoring zone
              </div>
            )}
          </div>
        )}

        {/* Contributing Risk Factors */}
        <div className="bg-[#07090e] border border-[#1e293b] p-3 rounded space-y-1.5">
          <span className="text-[11px] font-mono text-slate-400 block font-semibold">
            CONTRIBUTING RISK FACTORS
          </span>
          <ul className="text-xs font-mono text-slate-300 space-y-1">
            {cluster.riskFactors.map((rf, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-400 shrink-0">✓</span>
                <span>{rf}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onNavigateDetail(cluster.clusterId)}
          className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs font-mono rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>OPEN CLUSTER ANALYSIS DEEP-DIVE</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>

        {/* Scientific Disclaimer */}
        <div className="text-[10px] font-mono text-slate-500 border-t border-[#1e293b] pt-2 leading-relaxed">
          * Estimated hotspot-based perimeter. Experimental decision-support vector model; not an official emergency forecast.
        </div>
      </div>
    </div>
  );
};

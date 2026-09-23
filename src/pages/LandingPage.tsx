import React from 'react';
import { Flame, Satellite, Layers, Wind, Mountain, Database, ShieldAlert, ArrowRight, Activity, CheckCircle, ExternalLink } from 'lucide-react';
import { FireCluster, FireObservation } from '../types';
import { ScientificDisclaimer } from '../components/ScientificDisclaimer';

interface LandingPageProps {
  clusters: FireCluster[];
  observations: FireObservation[];
  onLaunchDashboard: () => void;
  onNavigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  clusters,
  observations,
  onLaunchDashboard,
  onNavigate
}) => {
  const totalBurnArea = Math.round(clusters.reduce((acc, c) => acc + c.perimeter.areaKm2, 0) * 10) / 10;
  const peakFRP = Math.round(observations.reduce((max, o) => Math.max(max, o.fireRadiativePower), 0) * 10) / 10;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 px-4 lg:px-8 border-b border-[#1e293b] overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
        
        <div className="relative max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 mb-3 tracking-widest uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>OPERATIONAL SATELLITE RADIOMETRIC INTELLIGENCE</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-100 leading-tight max-w-4xl">
            Turning satellite observations into <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-rose-500 to-amber-500">actionable wildfire intelligence</span>.
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-3xl leading-relaxed">
            Automated near-real-time thermal anomaly ingestion from NASA FIRMS satellites, geodesic DBSCAN spatial clustering, terrain slope modeling, and physics-informed 6-hour fire spread projections.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={onLaunchDashboard}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm font-mono rounded flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <span>LAUNCH COMMAND CENTER</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('/analytics')}
              className="px-5 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-slate-300 border border-[#1e293b] text-sm font-mono rounded flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>SNOWFLAKE HISTORICAL ANALYTICS</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* Live Telemetry KPI Bar */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded">
              <div className="text-[11px] font-mono text-slate-400">ACTIVE CLUSTERS</div>
              <div className="text-2xl font-mono font-bold text-slate-100 mt-1 tabular-nums">
                {clusters.length}
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">DBSCAN Grouped Complexes</div>
            </div>
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded">
              <div className="text-[11px] font-mono text-slate-400">THERMAL HOTSPOTS</div>
              <div className="text-2xl font-mono font-bold text-amber-400 mt-1 tabular-nums">
                {observations.length}
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">VIIRS & MODIS Passes</div>
            </div>
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded">
              <div className="text-[11px] font-mono text-slate-400">PEAK RADIATIVE POWER</div>
              <div className="text-2xl font-mono font-bold text-rose-400 mt-1 tabular-nums">
                {peakFRP} <span className="text-xs text-slate-400">MW</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">Maximum Radiant Flux</div>
            </div>
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded">
              <div className="text-[11px] font-mono text-slate-400">ESTIMATED BURN FOOTPRINT</div>
              <div className="text-2xl font-mono font-bold text-slate-100 mt-1 tabular-nums">
                {totalBurnArea} <span className="text-xs text-slate-400">KM²</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">Sensor-Derived Area</div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Pipeline Section */}
      <section className="py-14 px-4 lg:px-8 border-b border-[#1e293b]">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs font-mono text-amber-400 mb-2 tracking-widest uppercase">
            01. SYSTEM ARCHITECTURE
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-8">
            End-to-End Satellite Telemetry Pipeline
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
                  <Satellite className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 mb-1">1. NASA FIRMS Stream</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  Near-real-time thermal anomaly feeds from VIIRS (375m) and MODIS (1km) instruments.
                </p>
              </div>
              <div className="text-[10px] font-mono text-cyan-400/80 mt-3 pt-2 border-t border-[#1e293b]">
                NRT Revisit 10-15m
              </div>
            </div>

            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                  <Database className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 mb-1">2. MongoDB 2dsphere</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  Deduplication and spatial point storage with 2dsphere geospatial indexing.
                </p>
              </div>
              <div className="text-[10px] font-mono text-amber-400/80 mt-3 pt-2 border-t border-[#1e293b]">
                GeoJSON Schema
              </div>
            </div>

            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 mb-1">3. Geo Engine & DBSCAN</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  R-tree spatial indexing + geodesic Haversine DBSCAN grouping nearby hotspots into fire perimeters.
                </p>
              </div>
              <div className="text-[10px] font-mono text-rose-400/80 mt-3 pt-2 border-t border-[#1e293b]">
                Convex Hull + Buffer
              </div>
            </div>

            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <Wind className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 mb-1">4. Wind & Elevation</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  Real atmospheric wind vectors and Open-Meteo elevation slope synthesis to predict 6-hour spread.
                </p>
              </div>
              <div className="text-[10px] font-mono text-emerald-400/80 mt-3 pt-2 border-t border-[#1e293b]">
                Spread Vector Model
              </div>
            </div>

            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
                  <Activity className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 mb-1">5. Snowflake Analytics</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  Longitudinal warehousing across RAW and ANALYTICS schemas for multi-year trend queries.
                </p>
              </div>
              <div className="text-[10px] font-mono text-blue-400/80 mt-3 pt-2 border-t border-[#1e293b]">
                Snowflake FIRE_SPACE
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Active Monitored Wildfire Basins */}
      <section className="py-14 px-4 lg:px-8 border-b border-[#1e293b]">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs font-mono text-amber-400 mb-2 tracking-widest uppercase">
            02. SATELLITE OBSERVATION BASINS
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-6">
            Currently Monitored Wildfire Complexes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clusters.slice(0, 6).map(c => (
              <div
                key={c.clusterId}
                onClick={() => onNavigate(`/fires/${c.clusterId}`)}
                className="bg-[#0f172a] border border-[#1e293b] hover:border-slate-700 p-4 rounded transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                    <span>{c.clusterId}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.riskLevel === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                      c.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {c.riskLevel}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-100 mb-1">
                    {c.name}
                  </h4>
                  <div className="text-xs font-mono text-slate-400 mb-3">
                    {c.region}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1e293b] text-center text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block">HOTSPOTS</span>
                    <span className="text-slate-200 font-bold">{c.hotspotCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">MEAN FRP</span>
                    <span className="text-amber-400 font-bold">{c.averageFRP}M</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">6H EXP</span>
                    <span className="text-cyan-400 font-bold">+{c.spreadPrediction?.estimatedDistanceKm || 0}km</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scientific Framework & Limitations */}
      <section className="py-10 px-4 lg:px-8 max-w-6xl mx-auto w-full">
        <ScientificDisclaimer />
      </section>

      {/* Footer */}
      <footer className="mt-auto py-6 px-4 lg:px-8 border-t border-[#1e293b] bg-[#07090e] text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          Fire & Space Satellite Wildfire Platform · Data sources: NASA FIRMS (VIIRS/MODIS), Open-Meteo, Snowflake
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <button onClick={() => onNavigate('/system')} className="hover:text-slate-200">System Status</button>
          <button onClick={() => onNavigate('/settings')} className="hover:text-slate-200">Configuration</button>
          <button onClick={onLaunchDashboard} className="text-amber-400 hover:text-amber-300 font-bold">Live Map →</button>
        </div>
      </footer>
    </div>
  );
};

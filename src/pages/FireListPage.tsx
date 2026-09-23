import React, { useState } from 'react';
import { Search, Flame, MapPin, Wind, Navigation, ArrowUpRight, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { FireCluster } from '../types';

interface FireListPageProps {
  clusters: FireCluster[];
  onSelectAndNavigate: (clusterId: string) => void;
  onNavigateMap: (clusterId: string) => void;
}

export const FireListPage: React.FC<FireListPageProps> = ({
  clusters,
  onSelectAndNavigate,
  onNavigateMap
}) => {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'hotspots' | 'frp' | 'area' | 'risk'>('frp');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = clusters.filter(c => {
    if (riskFilter !== 'ALL' && c.riskLevel !== riskFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q) ||
        c.clusterId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortBy === 'hotspots') diff = b.hotspotCount - a.hotspotCount;
    else if (sortBy === 'frp') diff = b.averageFRP - a.averageFRP;
    else if (sortBy === 'area') diff = b.perimeter.areaKm2 - a.perimeter.areaKm2;
    else if (sortBy === 'risk') {
      const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 };
      diff = (rank[b.riskLevel] || 0) - (rank[a.riskLevel] || 0);
    }
    return sortAsc ? -diff : diff;
  });

  const handleSort = (field: 'hotspots' | 'frp' | 'area' | 'risk') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="flex-1 bg-[#07090e] p-4 lg:p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
              Active Wildfire Clusters
            </h1>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Geodesic DBSCAN Spatial Complexes Derived from NASA Satellite Radiometry
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Total Complexes:</span>
            <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded">
              {clusters.length}
            </span>
          </div>
        </div>

        {/* Filter & Controls Bar */}
        <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[260px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search cluster ID, name, or region..."
                className="w-full bg-[#07090e] border border-[#1e293b] rounded pl-8 pr-2.5 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <select
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
              className="bg-[#07090e] border border-[#1e293b] rounded px-3 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MODERATE">Moderate</option>
              <option value="LOW">Low</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearch(search === 'India' ? '' : 'India')}
                className={`px-2 py-1 text-xs font-mono rounded transition-all whitespace-nowrap flex items-center gap-1 ${
                  search.toLowerCase() === 'india'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30'
                }`}
                title="Filter India clusters"
              >
                <span>🇮🇳</span> India
              </button>
              <button
                onClick={() => setSearch(search === 'Asia' ? '' : 'Asia')}
                className={`px-2 py-1 text-xs font-mono rounded transition-all whitespace-nowrap flex items-center gap-1 ${
                  search.toLowerCase() === 'asia'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30'
                }`}
                title="Filter Asia clusters"
              >
                <span>🌏</span> Asia
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
            <span>Sort by:</span>
            <button
              onClick={() => handleSort('frp')}
              className={`px-2 py-1 rounded transition-colors ${sortBy === 'frp' ? 'bg-[#1e293b] text-amber-400 font-bold' : 'hover:bg-[#1e293b]'}`}
            >
              FRP
            </button>
            <button
              onClick={() => handleSort('hotspots')}
              className={`px-2 py-1 rounded transition-colors ${sortBy === 'hotspots' ? 'bg-[#1e293b] text-amber-400 font-bold' : 'hover:bg-[#1e293b]'}`}
            >
              Hotspots
            </button>
            <button
              onClick={() => handleSort('area')}
              className={`px-2 py-1 rounded transition-colors ${sortBy === 'area' ? 'bg-[#1e293b] text-amber-400 font-bold' : 'hover:bg-[#1e293b]'}`}
            >
              Area
            </button>
            <button
              onClick={() => handleSort('risk')}
              className={`px-2 py-1 rounded transition-colors ${sortBy === 'risk' ? 'bg-[#1e293b] text-amber-400 font-bold' : 'hover:bg-[#1e293b]'}`}
            >
              Risk
            </button>
          </div>
        </div>

        {/* Table / Card List */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-[#07090e]/80 border-b border-[#1e293b] text-slate-400">
                  <th className="p-3">CLUSTER COMPLEX</th>
                  <th className="p-3">RISK LEVEL</th>
                  <th className="p-3">HOTSPOTS</th>
                  <th className="p-3">AVG FRP</th>
                  <th className="p-3">PEAK FRP</th>
                  <th className="p-3">EST. AREA</th>
                  <th className="p-3">WIND / TOPOGRAPHY</th>
                  <th className="p-3">6H FORWARD SPREAD</th>
                  <th className="p-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]/60">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      No wildfire clusters match query.
                    </td>
                  </tr>
                ) : (
                  sorted.map(c => {
                    const p = c.spreadPrediction;
                    const w = c.weather;
                    return (
                      <tr key={c.clusterId} className="hover:bg-[#1e293b]/40 transition-colors">
                        <td className="p-3 font-medium">
                          <div className="text-slate-100 font-bold">{c.name}</div>
                          <div className="text-[11px] text-slate-400">
                            #{c.clusterId} · {c.region}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            c.riskLevel === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            c.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                            c.riskLevel === 'MODERATE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {c.riskLevel}
                          </span>
                        </td>
                        <td className="p-3 text-slate-200 tabular-nums">
                          {c.hotspotCount} pts
                        </td>
                        <td className="p-3 text-amber-400 font-bold tabular-nums">
                          {c.averageFRP} MW
                        </td>
                        <td className="p-3 text-rose-400 font-bold tabular-nums">
                          {c.maxFRP} MW
                        </td>
                        <td className="p-3 text-slate-200 tabular-nums">
                          {c.perimeter.areaKm2} km²
                        </td>
                        <td className="p-3 text-[11px] text-slate-300">
                          {w ? `${w.windSpeedKmh}km/h ${w.windDirectionCardinal}` : '--'} · {c.elevation?.slopeDegrees || 0}°
                        </td>
                        <td className="p-3 text-cyan-400 font-bold">
                          {p ? `+${p.estimatedDistanceKm}km (${p.directionDegrees}°)` : '--'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onNavigateMap(c.clusterId)}
                              className="px-2 py-1 rounded bg-[#07090e] hover:bg-[#1e293b] text-slate-300 border border-[#1e293b] text-[11px] cursor-pointer"
                            >
                              Map
                            </button>
                            <button
                              onClick={() => onSelectAndNavigate(c.clusterId)}
                              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <span>Details</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

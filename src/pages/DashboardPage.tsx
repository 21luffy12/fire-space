import React, { useState } from 'react';
import { Filter, Layers, Flame, Search, ChevronRight, Sliders, RefreshCw } from 'lucide-react';
import { FireCluster, FireObservation } from '../types';
import { KpiCards } from '../components/KpiCards';
import { FireMap } from '../components/FireMap';
import { FireDetailPanel } from '../components/FireDetailPanel';
import { ScientificDisclaimer } from '../components/ScientificDisclaimer';

interface DashboardPageProps {
  clusters: FireCluster[];
  observations: FireObservation[];
  lastUpdate: string;
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string) => void;
  onNavigateDetail: (clusterId: string) => void;
  onRefresh: () => void;
  isSyncing: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  clusters,
  observations,
  lastUpdate,
  selectedClusterId,
  onSelectCluster,
  onNavigateDetail,
  onRefresh,
  isSyncing
}) => {
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [minFRP, setMinFRP] = useState<number>(0);
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');

  // Filter clusters
  const filteredClusters = clusters.filter(c => {
    if (selectedRisk !== 'ALL' && c.riskLevel !== selectedRisk) return false;
    if (selectedRegion !== 'ALL') {
      if (selectedRegion === 'INDIA') {
        if (!c.region.toLowerCase().includes('india')) return false;
      } else if (selectedRegion === 'ASIA') {
        if (!c.region.toLowerCase().includes('asia') && !c.region.toLowerCase().includes('india')) return false;
      } else if (c.region !== selectedRegion) {
        return false;
      }
    }
    if (minFRP > 0 && c.averageFRP < minFRP) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchRegion = c.region.toLowerCase().includes(q);
      const matchId = c.clusterId.toLowerCase().includes(q);
      if (!matchName && !matchRegion && !matchId) return false;
    }
    return true;
  });

  // Filter observations for map display
  const filteredObservations = observations.filter(o => {
    if (minFRP > 0 && o.fireRadiativePower < minFRP) return false;
    return true;
  });

  const selectedCluster = clusters.find(c => c.clusterId === selectedClusterId) || null;

  // Unique regions
  const regions = Array.from(new Set(clusters.map(c => c.region)));

  return (
    <div className="flex-1 flex flex-col p-3 lg:p-4 gap-3 bg-[#07090e] overflow-hidden">
      {/* Top KPI Cards */}
      <KpiCards
        clusters={clusters}
        observations={observations}
        lastUpdate={lastUpdate}
      />

      {/* Main 3-Column Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[560px]">
        {/* Left Column: Filter & Cluster List (3 cols) */}
        <div className="lg:col-span-3 bg-[#0f172a] border border-[#1e293b] rounded flex flex-col overflow-hidden max-h-[750px]">
          {/* Filter Header */}
          <div className="p-3 border-b border-[#1e293b] bg-[#07090e]/50 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300">
              <span className="flex items-center gap-1.5 font-semibold">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                FILTER SATELLITE CLUSTERS
              </span>
              <button
                onClick={onRefresh}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search cluster or basin..."
                className="w-full bg-[#07090e] border border-[#1e293b] rounded pl-8 pr-2.5 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Risk & Region Filters */}
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
              <select
                value={selectedRisk}
                onChange={e => setSelectedRisk(e.target.value)}
                className="bg-[#07090e] border border-[#1e293b] rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="CRITICAL">Critical Risk</option>
                <option value="HIGH">High Risk</option>
                <option value="MODERATE">Moderate</option>
                <option value="LOW">Low</option>
              </select>

              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
                className="bg-[#07090e] border border-[#1e293b] rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Regions</option>
                <option value="INDIA">🇮🇳 India (All Basins)</option>
                <option value="ASIA">🌏 Asia (All Basins)</option>
                {regions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Quick Regional Focus Bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px] font-mono">
              <span className="text-slate-500 whitespace-nowrap">Focus:</span>
              <button
                onClick={() => setSelectedRegion('ALL')}
                className={`px-1.5 py-0.5 rounded transition-all whitespace-nowrap ${
                  selectedRegion === 'ALL'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedRegion('INDIA')}
                className={`px-1.5 py-0.5 rounded transition-all whitespace-nowrap flex items-center gap-0.5 font-semibold ${
                  selectedRegion === 'INDIA'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30'
                }`}
              >
                <span>🇮🇳</span> India
              </button>
              <button
                onClick={() => setSelectedRegion('ASIA')}
                className={`px-1.5 py-0.5 rounded transition-all whitespace-nowrap flex items-center gap-0.5 font-semibold ${
                  selectedRegion === 'ASIA'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30'
                }`}
              >
                <span>🌏</span> Asia
              </button>
            </div>

            {/* Min FRP Threshold Slider */}
            <div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                <span>MIN RADIATIVE POWER (FRP)</span>
                <span className="text-amber-400 font-semibold">{minFRP} MW</span>
              </div>
              <input
                type="range"
                min="0"
                max="150"
                step="5"
                value={minFRP}
                onChange={e => setMinFRP(parseInt(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-[#1e293b] rounded appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Clusters List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#1e293b]/60">
            {filteredClusters.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-500">
                No fire clusters match active filters.
              </div>
            ) : (
              filteredClusters.map(c => {
                const isSelected = c.clusterId === selectedClusterId;
                return (
                  <div
                    key={c.clusterId}
                    onClick={() => onSelectCluster(c.clusterId)}
                    className={`p-2.5 text-xs font-mono transition-colors cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#1e293b] border-l-2 border-amber-400'
                        : 'hover:bg-[#1e293b]/50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-200 truncate">{c.name}</span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                          c.riskLevel === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                          c.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {c.riskLevel}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {c.region} · {c.hotspotCount} pts · {c.averageFRP} MW
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </div>
                );
              })
            )}
          </div>

          {/* List Footer Stats */}
          <div className="p-2 border-t border-[#1e293b] bg-[#07090e]/60 text-[11px] font-mono text-slate-500 flex justify-between">
            <span>Showing {filteredClusters.length} of {clusters.length}</span>
            <span>{filteredObservations.length} Hotspots</span>
          </div>
        </div>

        {/* Center Column: Interactive Geospatial Map (6 cols) */}
        <div className="lg:col-span-6 h-[480px] lg:h-auto min-h-[460px]">
          <FireMap
            clusters={filteredClusters}
            observations={filteredObservations}
            selectedClusterId={selectedClusterId}
            onSelectCluster={onSelectCluster}
          />
        </div>

        {/* Right Column: Fire Detail Inspector (3 cols) */}
        <div className="lg:col-span-3 h-[480px] lg:h-auto max-h-[750px]">
          <FireDetailPanel
            cluster={selectedCluster}
            onNavigateDetail={onNavigateDetail}
          />
        </div>
      </div>

      {/* Scientific Disclaimer Footer */}
      <ScientificDisclaimer compact />
    </div>
  );
};

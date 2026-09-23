import React from 'react';
import { Layers, Flame, AlertTriangle, Scaling, Activity, Clock } from 'lucide-react';
import { FireCluster, FireObservation } from '../types';

interface KpiCardsProps {
  clusters: FireCluster[];
  observations: FireObservation[];
  lastUpdate: string;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ clusters, observations, lastUpdate }) => {
  const highRiskCount = clusters.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL').length;
  const totalBurnArea = Math.round(clusters.reduce((sum, c) => sum + c.perimeter.areaKm2, 0) * 10) / 10;
  
  const avgFrp = observations.length > 0
    ? Math.round((observations.reduce((sum, o) => sum + o.fireRadiativePower, 0) / observations.length) * 10) / 10
    : 0;

  const cards = [
    {
      label: 'ACTIVE FIRE CLUSTERS',
      value: clusters.length,
      unit: 'DBSCAN',
      icon: Layers,
      accent: 'text-amber-400',
      badge: `${clusters.length} Complexes`
    },
    {
      label: 'TOTAL HOTSPOTS',
      value: observations.length,
      unit: 'POINTS',
      icon: Flame,
      accent: 'text-rose-400',
      badge: 'VIIRS / MODIS'
    },
    {
      label: 'HIGH RISK FIRES',
      value: highRiskCount,
      unit: 'ACTIVE',
      icon: AlertTriangle,
      accent: highRiskCount > 0 ? 'text-red-400' : 'text-slate-400',
      badge: 'Level 3+'
    },
    {
      label: 'ESTIMATED BURN AREA',
      value: totalBurnArea,
      unit: 'KM²',
      icon: Scaling,
      accent: 'text-orange-400',
      badge: 'Sensor footprint'
    },
    {
      label: 'AVERAGE FRP',
      value: avgFrp,
      unit: 'MW',
      icon: Activity,
      accent: 'text-cyan-400',
      badge: 'Radiant Heat'
    },
    {
      label: 'REAL-TIME SATELLITE STREAM',
      value: lastUpdate ? new Date(lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--',
      unit: 'UTC',
      icon: Clock,
      accent: 'text-emerald-400',
      badge: 'NASA FIRMS LIVE'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="bg-[#0f172a] border border-[#1e293b] p-3 rounded flex flex-col justify-between hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-mono tracking-wider text-slate-400">
                {card.label}
              </span>
              <Icon className={`w-3.5 h-3.5 ${card.accent}`} />
            </div>
            <div className="flex items-baseline gap-1 my-0.5">
              <span className="text-xl sm:text-2xl font-mono font-semibold tabular-nums text-slate-100">
                {card.value}
              </span>
              <span className="text-[11px] font-mono text-slate-500 uppercase">
                {card.unit}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between mt-1 pt-1 border-t border-[#1e293b]/60">
              <span>{card.badge}</span>
              <span className="text-slate-600">●</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

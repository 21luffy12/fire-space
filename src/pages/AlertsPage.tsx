import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Bell, ArrowUpRight, Filter } from 'lucide-react';
import { Alert } from '../types';
import { getAlerts, acknowledgeAlert } from '../services/api';

interface AlertsPageProps {
  onNavigateCluster: (clusterId: string) => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ onNavigateCluster }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [showAcknowledged, setShowAcknowledged] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await getAlerts();
      if (res.success) {
        setAlerts(res.alerts);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleAcknowledge = async (alertId: string) => {
    try {
      const res = await acknowledgeAlert(alertId);
      if (res.success) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
      }
    } catch (err) {
      console.error('Failed to ack alert:', err);
    }
  };

  const filtered = alerts.filter(a => {
    if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
    if (!showAcknowledged && a.acknowledged) return false;
    return true;
  });

  return (
    <div className="flex-1 bg-[#07090e] p-4 lg:p-6 overflow-y-auto space-y-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-rose-400">
              <ShieldAlert className="w-4 h-4" />
              <span>INCIDENT COMMAND NOTIFICATIONS</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 mt-1">
              Active Wildfire Threat & Risk Alerts
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Active Unacknowledged:</span>
            <span className="text-xs font-mono font-bold text-rose-400 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded">
              {alerts.filter(a => !a.acknowledged).length}
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Filter Severity:</span>
            <select
              value={filterSeverity}
              onChange={e => setFilterSeverity(e.target.value)}
              className="bg-[#07090e] border border-[#1e293b] rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="WARNING">Warning</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showAcknowledged}
              onChange={e => setShowAcknowledged(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>Include Acknowledged Incidents</span>
          </label>
        </div>

        {/* Alert Stream */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500 bg-[#0f172a] border border-[#1e293b] rounded">
              No active alerts matching criteria.
            </div>
          ) : (
            filtered.map(a => {
              const isCrit = a.severity === 'CRITICAL';
              const isHigh = a.severity === 'HIGH';

              return (
                <div
                  key={a.id}
                  className={`bg-[#0f172a] border p-4 rounded transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    a.acknowledged
                      ? 'border-[#1e293b] opacity-60'
                      : isCrit
                      ? 'border-rose-500/40 bg-rose-950/10'
                      : isHigh
                      ? 'border-orange-500/40 bg-orange-950/10'
                      : 'border-amber-500/40'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        isCrit ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        isHigh ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {a.severity}
                      </span>
                      <span className="text-slate-400">{a.alertType.replace(/_/g, ' ')}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-500">{new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
                    </div>

                    <p className="text-xs font-mono text-slate-200 leading-relaxed font-semibold">
                      {a.message}
                    </p>

                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
                      <span>Affected: <span className="text-slate-300 font-semibold">{a.affectedRegion}</span></span>
                      <span>Cluster: <span className="text-amber-400 font-semibold">#{a.clusterId}</span></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {!a.acknowledged ? (
                      <button
                        onClick={() => handleAcknowledge(a.id)}
                        className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] text-slate-200 text-xs font-mono rounded flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Acknowledge</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded">
                        <CheckCircle className="w-3 h-3" /> Acknowledged
                      </span>
                    )}

                    <button
                      onClick={() => onNavigateCluster(a.clusterId)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs font-mono rounded flex items-center gap-1 cursor-pointer"
                    >
                      <span>Inspect</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

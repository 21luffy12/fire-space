import React, { useState } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, Satellite, Zap, Key, ExternalLink } from 'lucide-react';
import { syncFirmsData, testFirmsConnection, updateSettings } from '../services/api';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, onSyncComplete }) => {
  const [sensor, setSensor] = useState('MODIS_NRT');
  const [countryCode, setCountryCode] = useState('GLOBAL');
  const [apiKey, setApiKey] = useState('');
  const [feedMode, setFeedMode] = useState<'PUBLIC_NRT' | 'MAP_KEY'>('PUBLIC_NRT');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testFirmsConnection(
        feedMode === 'MAP_KEY' ? apiKey : undefined,
        sensor,
        countryCode
      );
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Failed to ping NASA FIRMS API'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      if (feedMode === 'MAP_KEY' && apiKey) {
        await updateSettings({ firmsApiKey: apiKey });
      }

      const res = await syncFirmsData(sensor, countryCode);
      if (res.success) {
        setStatusType('success');
        setStatusMessage(`Ingested ${res.hotspotsCount} real-time thermal hotspots into ${res.clustersCount} DBSCAN clusters.`);
        setTimeout(() => {
          onSyncComplete();
          onClose();
        }, 1200);
      } else {
        setStatusType('error');
        setStatusMessage(res.message || 'Satellite sync encountered an issue.');
      }
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(err.message || 'API request failure during FIRMS ingestion.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0f172a] border border-[#1e293b] rounded shadow-2xl p-5 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded bg-amber-500/10 text-amber-400">
            <Satellite className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">Real-Time NASA FIRMS Ingestion</h3>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">Direct Satellite Radiometric Stream Interface</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Feed Mode Toggle */}
          <div className="bg-[#07090e] p-1 rounded border border-[#1e293b] grid grid-cols-2 text-xs font-mono">
            <button
              type="button"
              onClick={() => setFeedMode('PUBLIC_NRT')}
              className={`py-1.5 px-3 rounded transition-all text-center cursor-pointer ${
                feedMode === 'PUBLIC_NRT'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              NASA Live 24h Stream (Free)
            </button>
            <button
              type="button"
              onClick={() => setFeedMode('MAP_KEY')}
              className={`py-1.5 px-3 rounded transition-all text-center cursor-pointer ${
                feedMode === 'MAP_KEY'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Custom NASA MAP Key
            </button>
          </div>

          {feedMode === 'MAP_KEY' && (
            <div className="p-3 bg-[#07090e] border border-amber-500/30 rounded space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  NASA FIRMS MAP KEY:
                </label>
                <a
                  href="https://firms.modaps.eosdis.nasa.gov/api/map_key/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-0.5"
                >
                  Get free key <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Paste your 32-character NASA MAP key here..."
                className="w-full bg-[#0f172a] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                SATELLITE SENSOR CONSTELLATION
              </label>
              <select
                value={sensor}
                onChange={e => setSensor(e.target.value)}
                className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="VIIRS_SNPP_NRT">VIIRS Suomi-NPP (375m Radiometer)</option>
                <option value="VIIRS_NOAA20_NRT">VIIRS NOAA-20 / JPSS-1 (375m)</option>
                <option value="MODIS_NRT">MODIS Aqua / Terra (1km Bands)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                TARGET BASIN / REGION
              </label>
              <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="GLOBAL">🌍 Entire World (Planetary Global Feed)</option>
                <option value="USA">United States (Contiguous & Basins)</option>
                <option value="BRA">South America (Amazon & Pantanal)</option>
                <option value="GRC">Europe / Mediterranean (Iberia, Greece)</option>
                <option value="AUS">Australia & New Zealand (Bushland)</option>
                <option value="CAN">Canada (Boreal Forest Zone)</option>
              </select>
            </div>
          </div>

          {/* Real-Time Pipeline Spec */}
          <div className="p-3 bg-[#07090e] border border-[#1e293b] rounded text-xs font-mono text-slate-400 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Live Telemetry Provider:</span>
              <span className="text-emerald-400 font-semibold">
                {feedMode === 'MAP_KEY' ? 'NASA FIRMS Live REST API' : 'NASA FIRMS 24h NRT Live Stream'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Atmospheric Link:</span>
              <span className="text-cyan-400 font-semibold">Open-Meteo Real-Time Wind & Elevation</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Clustering Algorithm:</span>
              <span className="text-amber-400 font-semibold">STRtree R-Tree + Geodesic Haversine DBSCAN</span>
            </div>
          </div>

          {/* Test Real-Time Connection button */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] disabled:opacity-50 text-slate-200 text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-400 ${isTesting ? 'animate-bounce' : ''}`} />
              <span>{isTesting ? 'Pinging NASA Servers...' : 'Test Real-Time API Ping'}</span>
            </button>
            {testResult && (
              <span className={`text-[11px] font-mono ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                {testResult.success ? `${testResult.hotspotsRetrieved} live pts (${testResult.latencyMs}ms)` : 'Ping Failed'}
              </span>
            )}
          </div>

          {testResult && testResult.success && (
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs font-mono text-emerald-300 space-y-1">
              <div className="font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>{testResult.message}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Feed: <span className="text-slate-200">{testResult.dataSource}</span> · Latency: <span className="text-amber-400">{testResult.latencyMs}ms</span>
              </div>
            </div>
          )}

          {statusMessage && (
            <div
              className={`p-3 rounded text-xs font-mono flex items-start gap-2 ${
                statusType === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}
            >
              {statusType === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e293b]">
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSync}
              disabled={isLoading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Ingesting Real-Time Feeds...' : 'Connect & Fetch Live Telemetry'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

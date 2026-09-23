import React, { useState, useEffect } from 'react';
import { Database, TrendingUp, BarChart2, Layers, Terminal, CheckCircle, RefreshCw, Play, Zap, AlertCircle, ArrowDownToLine, ArrowUpFromLine, Table } from 'lucide-react';
import { getAnalyticsSummary, executeSnowflakeSQLQuery, syncSnowflakeETL, getSnowflakeStoredData } from '../services/api';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live-warehouse' | 'trends' | 'satellites' | 'regions' | 'sql'>('live-warehouse');

  // Snowflake Live Data Warehouse State (Store & Retrieve)
  const [storedSnowflakeData, setStoredSnowflakeData] = useState<any>(null);
  const [isRetrievingSnowflake, setIsRetrievingSnowflake] = useState(false);
  const [retrieveError, setRetrieveError] = useState<string | null>(null);

  // SQL Execution Console State
  const [customSql, setCustomSql] = useState<string>(
`SELECT
    COALESCE(REGION, 'Global Basin') AS REGION,
    COUNT(*) AS FIRE_COUNT,
    SUM(HOTSPOT_COUNT) AS TOTAL_HOTSPOTS,
    ROUND(AVG(AVERAGE_FRP), 2) AS MEAN_FRP_MW,
    ROUND(SUM(AREA_KM2), 2) AS AGGREGATE_AREA_KM2
FROM SNOWFLAKE_LEARNING_DB.ANALYTICS.FIRE_CLUSTERS
GROUP BY REGION
ORDER BY FIRE_COUNT DESC;`
  );
  const [isExecutingSql, setIsExecutingSql] = useState(false);
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [isSyncingEtl, setIsSyncingEtl] = useState(false);
  const [etlMessage, setEtlMessage] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await getAnalyticsSummary();
      if (res.success) {
        setData(res.analytics);
      }
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSnowflakeStoredData = async () => {
    setIsRetrievingSnowflake(true);
    setRetrieveError(null);
    try {
      const res = await getSnowflakeStoredData();
      if (res.success) {
        setStoredSnowflakeData(res);
      } else {
        setRetrieveError(res.error || 'Failed to retrieve records from Snowflake');
      }
    } catch (err: any) {
      setRetrieveError(err.message || 'Error connecting to Snowflake');
    } finally {
      setIsRetrievingSnowflake(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchSnowflakeStoredData();
  }, []);

  const handleRunQuery = async () => {
    setIsExecutingSql(true);
    setSqlResult(null);
    try {
      const res = await executeSnowflakeSQLQuery(customSql);
      setSqlResult(res);
    } catch (err: any) {
      setSqlResult({ success: false, error: err.message || 'Snowflake query execution error' });
    } finally {
      setIsExecutingSql(false);
    }
  };

  const handleStoreDataToSnowflake = async () => {
    setIsSyncingEtl(true);
    setEtlMessage(null);
    try {
      const res = await syncSnowflakeETL();
      setEtlMessage(res.message);
      // Immediately refresh the retrieved Snowflake tables!
      await fetchSnowflakeStoredData();
      await fetchAnalytics();
    } catch (err: any) {
      setEtlMessage(err.message || 'Snowflake storage failed');
    } finally {
      setIsSyncingEtl(false);
    }
  };

  const sampleSqlQueries = [
    {
      title: 'Query Stored Wildfire Clusters',
      sql: `SELECT
    CLUSTER_ID,
    NAME,
    REGION,
    HOTSPOT_COUNT,
    ROUND(AVERAGE_FRP, 1) AS AVG_FRP_MW,
    ROUND(MAX_FRP, 1) AS PEAK_FRP_MW,
    ROUND(AREA_KM2, 1) AS AREA_KM2,
    RISK_LEVEL
FROM SNOWFLAKE_LEARNING_DB.ANALYTICS.FIRE_CLUSTERS
ORDER BY AVERAGE_FRP DESC
LIMIT 15;`
    },
    {
      title: 'Regional Fire Activity Breakdown',
      sql: `SELECT
    COALESCE(REGION, 'Global Basin') AS REGION,
    COUNT(*) AS FIRE_COUNT,
    SUM(HOTSPOT_COUNT) AS TOTAL_HOTSPOTS,
    ROUND(AVG(AVERAGE_FRP), 2) AS MEAN_FRP_MW,
    ROUND(SUM(AREA_KM2), 2) AS AGGREGATE_AREA_KM2,
    ROUND(COUNT(CASE WHEN RISK_LEVEL = 'CRITICAL' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS PCT_CRITICAL
FROM SNOWFLAKE_LEARNING_DB.ANALYTICS.FIRE_CLUSTERS
GROUP BY REGION
ORDER BY FIRE_COUNT DESC;`
    },
    {
      title: 'Satellite Radiometric Hotspot Observations',
      sql: `SELECT
    ID,
    SATELLITE,
    INSTRUMENT,
    ROUND(FRP, 1) AS FRP_MW,
    ROUND(BRIGHTNESS_TEMPERATURE, 1) AS BRIGHTNESS_K,
    CONFIDENCE,
    ACQ_DATE,
    CLUSTER_ID
FROM SNOWFLAKE_LEARNING_DB.ANALYTICS.FIRE_OBSERVATIONS
ORDER BY FRP DESC
LIMIT 20;`
    }
  ];

  return (
    <div className="flex-1 bg-[#07090e] p-4 lg:p-6 overflow-y-auto space-y-5">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e293b] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Database className="w-4 h-4" />
              <span>SNOWFLAKE ENTERPRISE DATA WAREHOUSE · SNOWFLAKE_LEARNING_DB</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 mt-1">
              Snowflake Data Pipeline: Store & Retrieve Engine
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live automated persistence and interactive analytics querying from Snowflake Warehouse
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleStoreDataToSnowflake}
              disabled={isSyncingEtl}
              className="px-3.5 py-2 rounded bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <ArrowDownToLine className={`w-4 h-4 ${isSyncingEtl ? 'animate-bounce' : ''}`} />
              <span>{isSyncingEtl ? 'Storing to Snowflake...' : '1. Store Data to Snowflake'}</span>
            </button>

            <button
              onClick={fetchSnowflakeStoredData}
              disabled={isRetrievingSnowflake}
              className="px-3.5 py-2 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-xs font-mono flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
            >
              <ArrowUpFromLine className={`w-4 h-4 ${isRetrievingSnowflake ? 'animate-spin' : ''}`} />
              <span>{isRetrievingSnowflake ? 'Querying...' : '2. Retrieve from Snowflake'}</span>
            </button>

            <button
              onClick={fetchAnalytics}
              className="px-3 py-2 rounded bg-[#0f172a] hover:bg-[#1e293b] text-slate-300 border border-[#1e293b] text-xs font-mono flex items-center gap-1.5 cursor-pointer"
              title="Refresh Analytics Mart"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {etlMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs font-mono text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{etlMessage}</span>
          </div>
        )}

        {retrieveError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs font-mono text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{retrieveError}</span>
          </div>
        )}

        {/* Warehouse Architecture Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded">
            <span className="text-[10px] text-slate-400 block font-mono">DATABASE / SCHEMA</span>
            <span className="text-sm font-bold font-mono text-slate-200 mt-1 block truncate">
              {storedSnowflakeData?.database || 'SNOWFLAKE_LEARNING_DB'}
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">
              .{storedSnowflakeData?.schema || 'ANALYTICS'}
            </span>
          </div>

          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded">
            <span className="text-[10px] text-slate-400 block font-mono">COMPUTE WAREHOUSE</span>
            <span className="text-sm font-bold font-mono text-cyan-400 mt-1 block truncate">
              {storedSnowflakeData?.warehouse || 'SNOWFLAKE_LEARNING_WH'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Connected & Ready</span>
          </div>

          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded">
            <span className="text-[10px] text-slate-400 block font-mono">STORED IN SNOWFLAKE</span>
            <span className="text-sm font-bold font-mono text-amber-400 mt-1 block tabular-nums">
              {storedSnowflakeData?.totalClustersInDb !== undefined ? (
                <span>{storedSnowflakeData.totalClustersInDb} clusters · {storedSnowflakeData.totalObservationsInDb} obs</span>
              ) : (
                'Loading...'
              )}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">Live Table Row Count</span>
          </div>

          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded">
            <span className="text-[10px] text-slate-400 block font-mono">WAREHOUSE STATUS</span>
            <span className="text-sm font-bold font-mono text-emerald-400 mt-1 block flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              ONLINE / ACTIVE
            </span>
            <span className="text-[10px] text-slate-500 font-mono truncate">
              {storedSnowflakeData?.queriedAt ? new Date(storedSnowflakeData.queriedAt).toLocaleTimeString() : 'Ready'}
            </span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-[#1e293b] gap-4 text-xs font-mono overflow-x-auto">
          <button
            onClick={() => setActiveTab('live-warehouse')}
            className={`pb-2.5 font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'live-warehouse' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Retrieved from Snowflake (Live Tables)</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`pb-2.5 font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sql' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Interactive SQL Worksheet</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`pb-2.5 font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'trends' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>7-Day Radiometric Trends</span>
          </button>

          <button
            onClick={() => setActiveTab('satellites')}
            className={`pb-2.5 font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'satellites' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Satellite Sensor Breakdown</span>
          </button>

          <button
            onClick={() => setActiveTab('regions')}
            className={`pb-2.5 font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'regions' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Regional Risk Summary</span>
          </button>
        </div>

        {/* Tab 0: Live Snowflake Data (Retrieved directly from Snowflake DB) */}
        {activeTab === 'live-warehouse' && (
          <div className="space-y-6">
            {/* Action Banner */}
            <div className="bg-gradient-to-r from-cyan-950/40 via-[#0f172a] to-amber-950/30 border border-cyan-500/30 p-4 rounded flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-cyan-300 font-bold flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span>DIRECT DATA WAREHOUSE QUERY RESULT</span>
                </div>
                <div className="text-sm text-slate-200 mt-1">
                  The data below is <strong className="text-cyan-300">physically queried from Snowflake tables</strong> (<code className="text-amber-300 text-xs font-mono">SNOWFLAKE_LEARNING_DB.ANALYTICS</code>). Click <strong>"1. Store Data to Snowflake"</strong> above to write fresh telemetry, or <strong>"2. Retrieve from Snowflake"</strong> to query live rows.
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Snowflake Synced
                </span>
              </div>
            </div>

            {/* Table 1: Retrieved Clusters */}
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded space-y-3">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-mono font-bold text-slate-200">
                    TABLE: <code className="text-amber-300">SNOWFLAKE_LEARNING_DB.ANALYTICS.FIRE_CLUSTERS</code>
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {storedSnowflakeData?.clusters?.length || 0} rows retrieved (Total in DB: {storedSnowflakeData?.totalClustersInDb || 0})
                </span>
              </div>

              {storedSnowflakeData?.clusters && storedSnowflakeData.clusters.length > 0 ? (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead className="bg-[#07090e] text-slate-400 sticky top-0 border-b border-[#1e293b]">
                      <tr>
                        <th className="p-2.5">CLUSTER_ID</th>
                        <th className="p-2.5">NAME</th>
                        <th className="p-2.5">REGION</th>
                        <th className="p-2.5">HOTSPOTS</th>
                        <th className="p-2.5">AVG FRP</th>
                        <th className="p-2.5">PEAK FRP</th>
                        <th className="p-2.5">AREA (KM²)</th>
                        <th className="p-2.5">RISK_LEVEL</th>
                        <th className="p-2.5">DETECTED_AT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/60">
                      {storedSnowflakeData.clusters.map((c: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#1e293b]/40">
                          <td className="p-2.5 text-amber-400 font-bold">{c.CLUSTER_ID || c.cluster_id}</td>
                          <td className="p-2.5 text-slate-200 font-medium">{c.NAME || c.name}</td>
                          <td className="p-2.5 text-slate-400">{c.REGION || c.region}</td>
                          <td className="p-2.5 text-cyan-400 tabular-nums">{c.HOTSPOT_COUNT || c.hotspot_count}</td>
                          <td className="p-2.5 text-amber-300 tabular-nums font-bold">{Math.round((c.AVERAGE_FRP || c.average_frp) * 10) / 10} MW</td>
                          <td className="p-2.5 text-rose-400 tabular-nums font-bold">{Math.round((c.MAX_FRP || c.max_frp) * 10) / 10} MW</td>
                          <td className="p-2.5 text-slate-300 tabular-nums">{Math.round((c.AREA_KM2 || c.area_km2) * 10) / 10} km²</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              (c.RISK_LEVEL || c.risk_level) === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : (c.RISK_LEVEL || c.risk_level) === 'ELEVATED'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            }`}>
                              {c.RISK_LEVEL || c.risk_level}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-500 text-[11px]">
                            {c.DETECTED_AT ? new Date(c.DETECTED_AT).toLocaleString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  No records stored yet in Snowflake. Click <strong>"1. Store Data to Snowflake"</strong> above to store the first batch!
                </div>
              )}
            </div>

            {/* Table 2: Retrieved Observations */}
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded space-y-3">
              <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-mono font-bold text-slate-200">
                    TABLE: <code className="text-cyan-300">SNOWFLAKE_LEARNING_DB.ANALYTICS.FIRE_OBSERVATIONS</code>
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {storedSnowflakeData?.recentObservations?.length || 0} rows retrieved (Total in DB: {storedSnowflakeData?.totalObservationsInDb || 0})
                </span>
              </div>

              {storedSnowflakeData?.recentObservations && storedSnowflakeData.recentObservations.length > 0 ? (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead className="bg-[#07090e] text-slate-400 sticky top-0 border-b border-[#1e293b]">
                      <tr>
                        <th className="p-2.5">ID</th>
                        <th className="p-2.5">SATELLITE</th>
                        <th className="p-2.5">INSTRUMENT</th>
                        <th className="p-2.5">COORDINATES</th>
                        <th className="p-2.5">FRP (MW)</th>
                        <th className="p-2.5">BRIGHTNESS TEMP</th>
                        <th className="p-2.5">CONFIDENCE</th>
                        <th className="p-2.5">PASS TIME</th>
                        <th className="p-2.5">CLUSTER_ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/60">
                      {storedSnowflakeData.recentObservations.map((o: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#1e293b]/40">
                          <td className="p-2.5 text-cyan-400 font-bold truncate max-w-[120px]">{o.ID || o.id}</td>
                          <td className="p-2.5 text-slate-200 font-semibold">{o.SATELLITE || o.satellite}</td>
                          <td className="p-2.5 text-slate-400">{o.INSTRUMENT || o.instrument}</td>
                          <td className="p-2.5 text-slate-300 tabular-nums">
                            {(o.LATITUDE || o.latitude)?.toFixed(3)}°, {(o.LONGITUDE || o.longitude)?.toFixed(3)}°
                          </td>
                          <td className="p-2.5 text-rose-400 tabular-nums font-bold">
                            {Math.round((o.FRP || o.frp) * 10) / 10} MW
                          </td>
                          <td className="p-2.5 text-amber-300 tabular-nums">
                            {Math.round((o.BRIGHTNESS_TEMPERATURE || o.brightness_temperature) * 10) / 10} K
                          </td>
                          <td className="p-2.5 text-emerald-400 font-semibold">{o.CONFIDENCE || o.confidence}</td>
                          <td className="p-2.5 text-slate-400 tabular-nums">
                            {o.ACQ_DATE || o.acq_date} {o.ACQ_TIME || o.acq_time}
                          </td>
                          <td className="p-2.5 text-amber-400 font-mono">{o.CLUSTER_ID || o.cluster_id || 'Isolated'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 font-mono text-xs">
                  No observation records queried from Snowflake yet. Click <strong>"1. Store Data to Snowflake"</strong> above!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 1: 7-Day Trends */}
        {activeTab === 'trends' && (
          <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-200">
              AGGREGATE WILDFIRE DYNAMICS OVER PAST 7 SATELLITE PASS CYCLES
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-[#07090e] text-slate-400 border-b border-[#1e293b]">
                  <tr>
                    <th className="p-2.5">PASS DATE</th>
                    <th className="p-2.5">MODELED CLUSTERS</th>
                    <th className="p-2.5">TOTAL HOTSPOTS</th>
                    <th className="p-2.5">MEAN FRP (MW)</th>
                    <th className="p-2.5">PEAK FRP (MW)</th>
                    <th className="p-2.5">EST. FOOTPRINT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]/60">
                  {data?.dailyTrends?.map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#1e293b]/40">
                      <td className="p-2.5 text-slate-300 font-bold">{d.date}</td>
                      <td className="p-2.5 text-slate-200 tabular-nums">{d.clusters}</td>
                      <td className="p-2.5 text-amber-400 font-bold tabular-nums">{d.hotspots}</td>
                      <td className="p-2.5 text-slate-300 tabular-nums">{d.avgFRP} MW</td>
                      <td className="p-2.5 text-rose-400 font-bold tabular-nums">{d.maxFRP} MW</td>
                      <td className="p-2.5 text-cyan-400 tabular-nums">{d.burnAreaKm2} km²</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Satellite Sensor Breakdown */}
        {activeTab === 'satellites' && (
          <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-200">
              ORBITAL SENSOR INGESTION & RADIOMETRIC CONFIDENCE
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-[#07090e] text-slate-400 border-b border-[#1e293b]">
                  <tr>
                    <th className="p-2.5">SATELLITE</th>
                    <th className="p-2.5">INSTRUMENT</th>
                    <th className="p-2.5">OBSERVATIONS</th>
                    <th className="p-2.5">AVERAGE FRP</th>
                    <th className="p-2.5">MAX PEAK FRP</th>
                    <th className="p-2.5">CONFIDENCE (% HIGH)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]/60">
                  {data?.satelliteBreakdown?.map((s: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#1e293b]/40">
                      <td className="p-2.5 text-slate-200 font-bold">{s.satellite}</td>
                      <td className="p-2.5 text-slate-400">{s.instrument}</td>
                      <td className="p-2.5 text-slate-200 tabular-nums">{s.observations} passes</td>
                      <td className="p-2.5 text-amber-400 font-bold tabular-nums">{s.avgFRP} MW</td>
                      <td className="p-2.5 text-rose-400 font-bold tabular-nums">{s.maxFRP} MW</td>
                      <td className="p-2.5 text-emerald-400 font-bold tabular-nums">{s.pctHighConfidence}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Regional Risk Mart */}
        {activeTab === 'regions' && (
          <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-200">
              GLOBAL WILDFIRE BASINS & REGIONAL THREAT AGGREGATIONS
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-[#07090e] text-slate-400 border-b border-[#1e293b]">
                  <tr>
                    <th className="p-2.5">MONITORED REGION</th>
                    <th className="p-2.5">ACTIVE CLUSTERS</th>
                    <th className="p-2.5">TOTAL HOTSPOTS</th>
                    <th className="p-2.5">REGIONAL MEAN FRP</th>
                    <th className="p-2.5">EST. BURN FOOTPRINT</th>
                    <th className="p-2.5">CRITICAL THREATS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]/60">
                  {data?.regionalDistribution?.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#1e293b]/40">
                      <td className="p-2.5 text-slate-200 font-bold">{r.region}</td>
                      <td className="p-2.5 text-slate-300 tabular-nums">{r.fireCount}</td>
                      <td className="p-2.5 text-amber-400 font-bold tabular-nums">{r.totalHotspots}</td>
                      <td className="p-2.5 text-slate-300 tabular-nums">{r.meanFRP} MW</td>
                      <td className="p-2.5 text-slate-300 tabular-nums">{r.burnAreaKm2} km²</td>
                      <td className="p-2.5 text-rose-400 font-bold tabular-nums">{r.riskCriticalCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Interactive Snowflake SQL Console */}
        {activeTab === 'sql' && (
          <div className="space-y-4">
            <div className="bg-[#0f172a] border border-[#1e293b] rounded p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e293b] pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200 font-mono">SNOWFLAKE INTERACTIVE SQL WORKSHEET</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => {
                      const selected = sampleSqlQueries.find(q => q.title === e.target.value);
                      if (selected) setCustomSql(selected.sql);
                    }}
                    className="bg-[#07090e] border border-[#1e293b] text-slate-300 text-xs font-mono p-1 rounded"
                  >
                    <option value="">Load Query Template...</option>
                    {sampleSqlQueries.map((q, i) => (
                      <option key={i} value={q.title}>{q.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleRunQuery}
                    disabled={isExecutingSql}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Play className={`w-3.5 h-3.5 fill-current ${isExecutingSql ? 'animate-spin' : ''}`} />
                    <span>{isExecutingSql ? 'Executing...' : 'Execute SQL'}</span>
                  </button>
                </div>
              </div>

              <textarea
                value={customSql}
                onChange={(e) => setCustomSql(e.target.value)}
                rows={7}
                className="w-full bg-[#07090e] border border-[#1e293b] rounded p-3 text-xs font-mono text-amber-300/90 focus:outline-none focus:border-cyan-500 resize-y"
              />

              {sqlResult && (
                <div className={`p-3 rounded text-xs font-mono border ${
                  sqlResult.success ? 'bg-[#07090e] border-[#1e293b]' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                }`}>
                  {sqlResult.success ? (
                    <div>
                      <div className="text-emerald-400 font-bold mb-2 flex items-center justify-between">
                        <span>Query completed successfully ({sqlResult.rowCount || 0} rows returned from Snowflake)</span>
                      </div>
                      {sqlResult.rows && sqlResult.rows.length > 0 ? (
                        <div className="overflow-x-auto max-h-60">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-[#1e293b] text-slate-300">
                              <tr>
                                {Object.keys(sqlResult.rows[0]).map((col, idx) => (
                                  <th key={idx} className="p-2 border border-slate-700">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e293b]">
                              {sqlResult.rows.map((row: any, rIdx: number) => (
                                <tr key={rIdx} className="hover:bg-[#1e293b]/40">
                                  {Object.values(row).map((val: any, cIdx: number) => (
                                    <td key={cIdx} className="p-2 text-slate-300 border border-slate-800">
                                      {typeof val === 'number' ? val.toLocaleString() : String(val)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <span className="text-slate-400">Statement executed with 0 rows returned.</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>{sqlResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Predefined Snowflake Templates */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-mono font-bold text-slate-300 block">
                PRODUCTION SCHEMA REFERENCE (SNOWFLAKE_LEARNING_DB.ANALYTICS DDL/DQL)
              </span>
              {sampleSqlQueries.map((q, idx) => (
                <div key={idx} className="bg-[#0f172a] border border-[#1e293b] rounded overflow-hidden">
                  <div className="p-2.5 bg-[#07090e] border-b border-[#1e293b] flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-200">{q.title}</span>
                    <button
                      onClick={() => setCustomSql(q.sql)}
                      className="text-[11px] font-mono text-cyan-400 hover:underline cursor-pointer"
                    >
                      Copy to Worksheet
                    </button>
                  </div>
                  <pre className="p-3 text-xs font-mono text-amber-300/80 overflow-x-auto bg-[#07090e]/50">
                    {q.sql}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

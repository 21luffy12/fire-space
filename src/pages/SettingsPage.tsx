import React, { useState, useEffect } from 'react';
import {
  Sliders, Save, RefreshCw, CheckCircle, AlertCircle, Database, Cpu,
  Key, Zap, ExternalLink, Satellite, Wind, Server, Layers, ArrowRight, ShieldAlert, Palette, Check
} from 'lucide-react';
import {
  getSettings,
  updateSettings,
  reprocessClusters,
  testFirmsConnection,
  testMongoConnection,
  syncMongoData,
  testSnowflakeConnection,
  syncSnowflakeETL,
  testWeatherConnection
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEMES } from '../context/ThemeContext';

export const SettingsPage: React.FC = () => {
  const { role, switchRole } = useAuth();
  const { theme, setTheme } = useTheme();

  // DBSCAN & General Settings
  const [epsKm, setEpsKm] = useState<number>(2.5);
  const [minSamples, setMinSamples] = useState<number>(3);
  const [refreshInterval, setRefreshInterval] = useState<number>(15);
  const [activeSensor, setActiveSensor] = useState<string>('VIIRS_SNPP_NRT');
  const [currentDataSource, setCurrentDataSource] = useState<string>('NASA FIRMS Live Public NRT Feed');
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // NASA FIRMS State
  const [firmsApiKey, setFirmsApiKey] = useState<string>('');
  const [testingFirms, setTestingFirms] = useState<boolean>(false);
  const [firmsPingResult, setFirmsPingResult] = useState<any>(null);

  // MongoDB Connection State
  const [mongoUri, setMongoUri] = useState<string>('mongodb://localhost:27017/fire_space');
  const [mongoStatus, setMongoStatus] = useState<string>('IN_MEMORY_SPATIAL_STORE');
  const [testingMongo, setTestingMongo] = useState<boolean>(false);
  const [syncingMongo, setSyncingMongo] = useState<boolean>(false);
  const [mongoResult, setMongoResult] = useState<any>(null);

  // Snowflake Warehouse State
  const [snowAccount, setSnowAccount] = useState<string>('XLJUCHU-VW49309');
  const [snowUsername, setSnowUsername] = useState<string>('alialiahm@student.iul.ac.in');
  const [snowPassword, setSnowPassword] = useState<string>('Ali_9354241551');
  const [snowWarehouse, setSnowWarehouse] = useState<string>('SNOWFLAKE_LEARNING_WH');
  const [snowDatabase, setSnowDatabase] = useState<string>('SNOWFLAKE_LEARNING_DB');
  const [snowSchema, setSnowSchema] = useState<string>('ANALYTICS');
  const [snowRole, setSnowRole] = useState<string>('ACCOUNTADMIN');
  const [snowStatus, setSnowStatus] = useState<string>('SIMULATED_WAREHOUSE');
  const [testingSnow, setTestingSnow] = useState<boolean>(false);
  const [syncingSnow, setSyncingSnow] = useState<boolean>(false);
  const [snowResult, setSnowResult] = useState<any>(null);

  // Weather API State
  const [openWeatherKey, setOpenWeatherKey] = useState<string>('');
  const [testingWeather, setTestingWeather] = useState<boolean>(false);
  const [weatherResult, setWeatherResult] = useState<any>(null);

  // Snowflake Guide modal state
  const [showSnowflakeGuide, setShowSnowflakeGuide] = useState<boolean>(false);

  useEffect(() => {
    getSettings().then(res => {
      if (res.success && res.settings) {
        setEpsKm(res.settings.dbscanEpsKm || 2.5);
        setMinSamples(res.settings.dbscanMinSamples || 3);
        setRefreshInterval(res.settings.refreshIntervalMinutes || 15);
        setActiveSensor(res.settings.activeSensor || 'VIIRS_SNPP_NRT');
        if (res.settings.currentDataSource) {
          setCurrentDataSource(res.settings.currentDataSource);
        }
        if (res.settings.mongo) {
          setMongoStatus(res.settings.mongo.status || 'IN_MEMORY_SPATIAL_STORE');
          if (res.settings.mongo.uriMasked) {
            setMongoUri(res.settings.mongo.uriMasked);
          }
        }
        if (res.settings.snowflake) {
          setSnowStatus(res.settings.snowflake.status || 'SIMULATED_WAREHOUSE');
          if (res.settings.snowflake.account) setSnowAccount(res.settings.snowflake.account);
          if (res.settings.snowflake.username) setSnowUsername(res.settings.snowflake.username);
          if (res.settings.snowflake.warehouse) setSnowWarehouse(res.settings.snowflake.warehouse);
          if (res.settings.snowflake.database) setSnowDatabase(res.settings.snowflake.database);
          if (res.settings.snowflake.schema) setSnowSchema(res.settings.snowflake.schema);
        }
      }
    }).catch(console.error);
  }, []);

  // Ping NASA FIRMS
  const handleTestFirms = async () => {
    setTestingFirms(true);
    setFirmsPingResult(null);
    try {
      const res = await testFirmsConnection(firmsApiKey || undefined, activeSensor);
      setFirmsPingResult(res);
      if (res.dataSource) setCurrentDataSource(res.dataSource);
    } catch (err: any) {
      setFirmsPingResult({ success: false, error: err.message || 'Connection test failed' });
    } finally {
      setTestingFirms(false);
    }
  };

  // Test MongoDB Connection
  const handleTestMongo = async () => {
    setTestingMongo(true);
    setMongoResult(null);
    try {
      const res = await testMongoConnection(mongoUri);
      setMongoResult(res);
      if (res.success) {
        setMongoStatus('CONNECTED');
      }
    } catch (err: any) {
      setMongoResult({ success: false, error: err.message || 'MongoDB connection failed' });
    } finally {
      setTestingMongo(false);
    }
  };

  // Sync to MongoDB
  const handleSyncMongo = async () => {
    setSyncingMongo(true);
    try {
      const res = await syncMongoData();
      setMongoResult({ success: true, message: res.message, stats: res.stats });
    } catch (err: any) {
      setMongoResult({ success: false, error: err.message });
    } finally {
      setSyncingMongo(false);
    }
  };

  // Test Snowflake Connection
  // Quick configuration preset for simulated/local demonstration
  const handleApplyPreset = () => {
    setSnowWarehouse('COMPUTE_WH');
    setSnowDatabase('FIRE_SPACE');
    setSnowSchema('ANALYTICS');
    setSnowRole('ACCOUNTADMIN');
  };

  const handleTestSnowflake = async () => {
    setTestingSnow(true);
    setSnowResult(null);
    try {
      const res = await testSnowflakeConnection({
        account: snowAccount,
        username: snowUsername,
        password: snowPassword,
        warehouse: snowWarehouse,
        database: snowDatabase,
        schema: snowSchema,
        role: snowRole
      });
      setSnowResult(res);
      if (res.success) {
        setSnowStatus('CONNECTED');
      }
    } catch (err: any) {
      setSnowResult({ success: false, error: err.message || 'Snowflake connection failed' });
    } finally {
      setTestingSnow(false);
    }
  };

  // Trigger Snowflake ETL Staging
  const handleSyncSnowflake = async () => {
    setSyncingSnow(true);
    try {
      const res = await syncSnowflakeETL();
      setSnowResult({ success: true, message: res.message, batchId: res.batchId });
    } catch (err: any) {
      setSnowResult({ success: false, error: err.message });
    } finally {
      setSyncingSnow(false);
    }
  };

  // Test Weather & Atmospheric API
  const handleTestWeather = async () => {
    setTestingWeather(true);
    setWeatherResult(null);
    try {
      const res = await testWeatherConnection();
      setWeatherResult(res);
    } catch (err: any) {
      setWeatherResult({ success: false, error: err.message });
    } finally {
      setTestingWeather(false);
    }
  };

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'ADMIN') return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      const payload: any = {
        dbscanEpsKm: epsKm,
        dbscanMinSamples: minSamples,
        refreshIntervalMinutes: refreshInterval,
        activeSensor,
        mongoUri,
        snowflakeAccount: snowAccount,
        snowflakeUsername: snowUsername,
        snowflakePassword: snowPassword,
        snowflakeWarehouse: snowWarehouse,
        snowflakeDatabase: snowDatabase,
        snowflakeSchema: snowSchema
      };
      if (firmsApiKey) {
        payload.firmsApiKey = firmsApiKey;
      }
      if (openWeatherKey) {
        payload.openWeatherApiKey = openWeatherKey;
      }
      const res = await updateSettings(payload);
      if (res.dataSource) setCurrentDataSource(res.dataSource);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRecluster = async () => {
    if (role !== 'ADMIN') return;
    setSaving(true);
    try {
      await reprocessClusters(epsKm, minSamples);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Clustering trigger error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 bg-[#07090e] p-4 lg:p-6 overflow-y-auto space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-[#1e293b] pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <Sliders className="w-4 h-4" />
            <span>OPERATIONAL TUNING & PIPELINE CONFIGURATION</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            System, Database & API Connections
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Configure live endpoints for MongoDB 2dsphere spatial store, Snowflake data warehouse, NASA FIRMS telemetry, and atmospheric models.
          </p>
          {role !== 'ADMIN' && (
            <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs font-mono text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span>Current role is <strong>{role}</strong> (inputs are disabled). Switch to <strong>ADMIN</strong> to edit database & Snowflake credentials.</span>
              </div>
              <button
                type="button"
                onClick={() => switchRole('ADMIN')}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[11px] cursor-pointer shrink-0"
              >
                Switch to ADMIN Role
              </button>
            </div>
          )}
        </div>

        {/* Global Pipeline Health Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Satellite className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">NASA FIRMS TELEMETRY</span>
                <span className="text-xs font-bold font-mono text-emerald-400">REAL-TIME ACTIVE</span>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">MONGODB SPATIAL STORE</span>
                <span className="text-xs font-bold font-mono text-slate-200">{mongoStatus}</span>
              </div>
            </div>
            <span className={`w-2 h-2 rounded-full ${mongoStatus === 'CONNECTED' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
          </div>

          <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">SNOWFLAKE WAREHOUSE</span>
                <span className="text-xs font-bold font-mono text-slate-200">{snowStatus}</span>
              </div>
            </div>
            <span className={`w-2 h-2 rounded-full ${snowStatus === 'CONNECTED' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          </div>
        </div>

        {/* COMMAND CENTER BACKGROUND THEMES SECTION */}
        <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-lg space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-sm font-bold text-slate-100 font-mono tracking-wide">
                  COMMAND CENTER BACKGROUND THEMES
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Select your preferred high-contrast background telemetry palette. Both themes are calibrated for long-duration earth observation monitoring.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-[#07090e] border border-[#1e293b] text-slate-400">
              Active: {THEMES[theme].name}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Theme 1: Obsidian Midnight */}
            <div
              onClick={() => setTheme('obsidian')}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden group ${
                theme === 'obsidian'
                  ? 'border-amber-500 bg-[#04060a] shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                  : 'border-[#1e293b] bg-[#04060a]/70 hover:border-slate-600'
              }`}
            >
              {theme === 'obsidian' && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500 text-slate-950 font-bold font-mono text-[10px] px-2 py-0.5 rounded shadow">
                  <Check className="w-3 h-3" />
                  ACTIVE
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🌑</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    Obsidian Midnight
                  </h3>
                  <span className="text-[10px] text-amber-400 font-mono">
                    Tactical Stealth Command
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Ultra-deep pitch black backdrop with amber, ember-orange, and crimson thermal radiance. Engineered for low-light night operations and maximum hotspot visual separation.
              </p>
              {/* Palette swatches */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-[#1e293b]/80">
                <span className="text-[10px] font-mono text-slate-500 mr-1">Palette:</span>
                <span className="w-4 h-4 rounded-full bg-[#04060a] border border-amber-500/50" title="#04060a Obsidian Canvas" />
                <span className="w-4 h-4 rounded-full bg-[#080d18] border border-slate-700" title="#080d18 Surface" />
                <span className="w-4 h-4 rounded-full bg-amber-500 shadow-sm" title="#f59e0b Amber Accent" />
                <span className="w-4 h-4 rounded-full bg-orange-500 shadow-sm" title="#f97316 Flame Glow" />
                <span className="w-4 h-4 rounded-full bg-rose-600 shadow-sm" title="#e11d48 Thermal Alert" />
              </div>
            </div>

            {/* Theme 2: Orbital Deep Navy */}
            <div
              onClick={() => setTheme('orbital-navy')}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden group ${
                theme === 'orbital-navy'
                  ? 'border-cyan-400 bg-[#050b16] shadow-[0_0_25px_rgba(6,182,212,0.25)]'
                  : 'border-[#1e293b] bg-[#050b16]/70 hover:border-slate-600'
              }`}
            >
              {theme === 'orbital-navy' && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-cyan-400 text-slate-950 font-bold font-mono text-[10px] px-2 py-0.5 rounded shadow">
                  <Check className="w-3 h-3" />
                  ACTIVE
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🛰️</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    Orbital Deep Navy
                  </h3>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    NASA Space Operations
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Deep aerospace navy blue with crisp electric cyan, cobalt radar mesh, and neon emerald telemetry indicators. Inspired by NASA JPL and ESA satellite orbital command centers.
              </p>
              {/* Palette swatches */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-[#1e293b]/80">
                <span className="text-[10px] font-mono text-slate-500 mr-1">Palette:</span>
                <span className="w-4 h-4 rounded-full bg-[#050b16] border border-cyan-500/50" title="#050b16 Deep Navy Canvas" />
                <span className="w-4 h-4 rounded-full bg-[#0a152d] border border-slate-700" title="#0a152d Surface" />
                <span className="w-4 h-4 rounded-full bg-cyan-400 shadow-sm" title="#22d3ee Electric Cyan" />
                <span className="w-4 h-4 rounded-full bg-blue-500 shadow-sm" title="#3b82f6 Orbital Blue" />
                <span className="w-4 h-4 rounded-full bg-emerald-400 shadow-sm" title="#34d399 Telemetry Emerald" />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* SECRETS DIRECTORY SUMMARY CARD */}
          <div className="bg-gradient-to-r from-amber-500/10 via-[#0f172a] to-cyan-500/10 border border-amber-500/30 p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold text-slate-100 font-mono tracking-wide">
                  API KEYS & SECRETS DIRECTORY
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-[#07090e] px-2.5 py-1 rounded border border-[#1e293b]">
                All optional · Zero-config active by default
              </span>
            </div>
            <p className="text-xs font-mono text-slate-300">
              Here are all external APIs and where to input your secret credentials:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="bg-[#07090e]/80 border border-[#1e293b] p-2.5 rounded space-y-1">
                <span className="text-emerald-400 font-bold block">1. NASA FIRMS API</span>
                <span className="text-[11px] text-slate-400 block">MAP_KEY (32 hex characters)</span>
                <span className="text-[10px] text-slate-500 block">Section 3 below or <code>FIRMS_API_KEY</code></span>
              </div>
              <div className="bg-[#07090e]/80 border border-[#1e293b] p-2.5 rounded space-y-1">
                <span className="text-amber-400 font-bold block">2. Snowflake Warehouse</span>
                <span className="text-[11px] text-slate-400 block">Account, User, Password</span>
                <span className="text-[10px] text-slate-500 block">Section 2 below or <code>SNOWFLAKE_*</code></span>
              </div>
              <div className="bg-[#07090e]/80 border border-[#1e293b] p-2.5 rounded space-y-1">
                <span className="text-cyan-400 font-bold block">3. MongoDB URI</span>
                <span className="text-[11px] text-slate-400 block">Connection String URI</span>
                <span className="text-[10px] text-slate-500 block">Section 1 below or <code>MONGODB_URI</code></span>
              </div>
              <div className="bg-[#07090e]/80 border border-[#1e293b] p-2.5 rounded space-y-1">
                <span className="text-blue-400 font-bold block">4. OpenWeatherMap</span>
                <span className="text-[11px] text-slate-400 block">API Key (Optional)</span>
                <span className="text-[10px] text-slate-500 block">Section 4 below or <code>OPENWEATHER_API_KEY</code></span>
              </div>
            </div>
          </div>
          {/* SECTION 1: MongoDB Operational Database */}
          <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    MONGODB DATABASE CONNECTION
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    High-throughput spatial storage with 2dsphere index for raw hotspots and fire perimeters
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                mongoStatus === 'CONNECTED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-[#1e293b] text-slate-400 border-[#334155]'
              }`}>
                {mongoStatus}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  MONGODB CONNECTION URI (MONGODB_URI)
                </label>
                <input
                  type="text"
                  value={mongoUri}
                  onChange={e => setMongoUri(e.target.value)}
                  placeholder="mongodb://username:password@cluster.mongodb.net/fire_space?retryWrites=true"
                  disabled={role !== 'ADMIN'}
                  className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                <p className="text-[10px] font-mono text-slate-500 mt-1">
                  Connect to local MongoDB (`mongodb://localhost:27017/fire_space`) or MongoDB Atlas. If no external instance is running, operational storage operates in built-in in-memory 2dsphere format.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestMongo}
                  disabled={testingMongo}
                  className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] disabled:opacity-50 text-cyan-300 text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer border border-cyan-500/30"
                >
                  <Zap className={`w-3.5 h-3.5 ${testingMongo ? 'animate-bounce' : ''}`} />
                  <span>{testingMongo ? 'Connecting & Verifying...' : 'Test MongoDB Ping & Indexes'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncMongo}
                  disabled={syncingMongo}
                  className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] disabled:opacity-50 text-slate-200 text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingMongo ? 'animate-spin' : ''}`} />
                  <span>{syncingMongo ? 'Syncing...' : 'Sync Hotspots to MongoDB'}</span>
                </button>
              </div>

              {mongoResult && (
                <div className={`p-3 rounded text-xs font-mono border ${
                  mongoResult.success ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                }`}>
                  <div className="font-bold">{mongoResult.message || mongoResult.error}</div>
                  {mongoResult.latencyMs && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      Ping: <span className="text-cyan-400 font-bold">{mongoResult.latencyMs}ms</span>
                    </div>
                  )}
                  {mongoResult.stats && mongoResult.stats.collections && (
                    <div className="text-[11px] text-slate-300 mt-1 flex gap-3">
                      <span>Observations: <strong>{mongoResult.stats.collections.observations}</strong></span>
                      <span>Clusters: <strong>{mongoResult.stats.collections.clusters}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Snowflake Analytical Data Warehouse */}
          <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    SNOWFLAKE DATA WAREHOUSE CONNECTION
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Enterprise cloud analytical warehouse for multi-year spatial trends and historical modeling
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSnowflakeGuide(true)}
                  className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[11px] font-mono cursor-pointer transition-colors flex items-center gap-1"
                >
                  <span>🔍 Where to find credentials?</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyPreset}
                  disabled={role !== 'ADMIN'}
                  className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[11px] font-mono cursor-pointer transition-colors"
                  title="Fills recommended default database and schema names"
                >
                  ⚡ Fill Standard Defaults
                </button>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                  snowStatus === 'CONNECTED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-[#1e293b] text-slate-400 border-[#334155]'
                }`}>
                  {snowStatus}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  ACCOUNT IDENTIFIER
                </label>
                <input
                  type="text"
                  value={snowAccount}
                  onChange={e => setSnowAccount(e.target.value)}
                  placeholder="e.g. xy12345.us-east-1"
                  disabled={role !== 'ADMIN'}
                  className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  USERNAME
                </label>
                <input
                  type="text"
                  value={snowUsername}
                  onChange={e => setSnowUsername(e.target.value)}
                  placeholder="SNOWFLAKE_USER"
                  disabled={role !== 'ADMIN'}
                  className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={snowPassword}
                  onChange={e => setSnowPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={role !== 'ADMIN'}
                  className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  WAREHOUSE
                </label>
                <input
                  type="text"
                  value={snowWarehouse}
                  onChange={e => setSnowWarehouse(e.target.value)}
                  placeholder="COMPUTE_WH"
                  disabled={role !== 'ADMIN'}
                  className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  DATABASE
                </label>
                <input
                  type="text"
                  value={snowDatabase}
                  onChange={e => setSnowDatabase(e.target.value)}
                  placeholder="FIRE_SPACE"
                  disabled={role !== 'ADMIN'}
                  className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  SCHEMA & ROLE
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={snowSchema}
                    onChange={e => setSnowSchema(e.target.value)}
                    placeholder="ANALYTICS"
                    disabled={role !== 'ADMIN'}
                    className="w-1/2 bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={snowRole}
                    onChange={e => setSnowRole(e.target.value)}
                    placeholder="ACCOUNTADMIN"
                    disabled={role !== 'ADMIN'}
                    className="w-1/2 bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#07090e] border border-[#1e293b] p-3 rounded text-[11px] font-mono text-slate-400 space-y-1">
              <div className="text-slate-200 font-bold flex items-center gap-1.5 text-xs text-amber-400">
                <span>💡 What values should you enter?</span>
              </div>
              <p>• <strong>Account Identifier:</strong> Your Snowflake Locator or Org-Account from your Snowflake login URL (e.g. <code className="text-amber-300">xy12345.us-east-1</code> or <code className="text-amber-300">myorg-myaccount</code>).</p>
              <p>• <strong>Username & Password:</strong> Your Snowflake user login credentials.</p>
              <p>• <strong>Warehouse:</strong> Default compute instance, usually <code className="text-amber-300">COMPUTE_WH</code>.</p>
              <p>• <strong>Database:</strong> Target database name, default <code className="text-amber-300">FIRE_SPACE</code> (or any database you create).</p>
              <p>• <strong>Schema & Role:</strong> Schema: <code className="text-amber-300">ANALYTICS</code> or <code className="text-amber-300">RAW</code> (or <code className="text-amber-300">PUBLIC</code>). Role: <code className="text-amber-300">ACCOUNTADMIN</code> or <code className="text-amber-300">SYSADMIN</code>.</p>
              <p className="text-emerald-400 pt-1">
                ⭐ <em>Don't have Snowflake credentials right now?</em> No problem! Fire & Space automatically runs in high-fidelity <strong>Simulated Warehouse mode</strong>, executing real SQL analytics and staging batches seamlessly.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestSnowflake}
                disabled={testingSnow}
                className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] disabled:opacity-50 text-amber-300 text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-500/30"
              >
                <Zap className={`w-3.5 h-3.5 ${testingSnow ? 'animate-bounce' : ''}`} />
                <span>{testingSnow ? 'Authenticating with Snowflake...' : 'Test Snowflake Warehouse Connection'}</span>
              </button>

              <button
                type="button"
                onClick={handleSyncSnowflake}
                disabled={syncingSnow}
                className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] disabled:opacity-50 text-slate-200 text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingSnow ? 'animate-spin' : ''}`} />
                <span>{syncingSnow ? 'Staging Telemetry...' : 'Trigger Snowflake ETL Batch'}</span>
              </button>
            </div>

            {snowResult && (
              <div className={`p-3 rounded text-xs font-mono border ${
                snowResult.success ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}>
                <div className="font-bold">{snowResult.message || snowResult.error}</div>
                {snowResult.latencyMs && (
                  <div className="text-[11px] text-slate-400 mt-1">
                    Warehouse Latency: <span className="text-amber-400 font-bold">{snowResult.latencyMs}ms</span>
                  </div>
                )}
                {snowResult.batchId && (
                  <div className="text-[11px] text-slate-300 mt-1">
                    Staged Batch ID: <span className="text-cyan-400">{snowResult.batchId}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: NASA FIRMS Satellite Telemetry & Credentials */}
          <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2">
                <Satellite className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    NASA FIRMS SATELLITE API
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Direct stream link to NASA EOSDIS MODIS & VIIRS active fire data
                  </p>
                </div>
              </div>
              <a
                href="https://firms.modaps.eosdis.nasa.gov/api/map_key/"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-amber-400 hover:underline flex items-center gap-1"
              >
                Get Free NASA Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-300 block mb-1">
                CUSTOM NASA MAP KEY (OPTIONAL)
              </label>
              <input
                type="text"
                value={firmsApiKey}
                onChange={e => setFirmsApiKey(e.target.value)}
                placeholder="Enter 32-character key (Leave blank for automatic NASA 24h Public Stream)..."
                disabled={role !== 'ADMIN'}
                className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestFirms}
                disabled={testingFirms}
                className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] disabled:opacity-50 text-emerald-300 text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-500/30"
              >
                <Zap className={`w-3.5 h-3.5 ${testingFirms ? 'animate-bounce' : ''}`} />
                <span>{testingFirms ? 'Pinging NASA Servers...' : 'Ping NASA FIRMS API'}</span>
              </button>
            </div>

            {firmsPingResult && (
              <div className={`p-3 rounded text-xs font-mono border ${
                firmsPingResult.success ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}>
                <div className="font-bold">{firmsPingResult.message || firmsPingResult.error}</div>
                {firmsPingResult.latencyMs && (
                  <div className="text-[11px] text-slate-400 mt-1">
                    Latency: <span className="text-emerald-400 font-bold">{firmsPingResult.latencyMs}ms</span> · Ingested: <span className="text-slate-200">{firmsPingResult.hotspotsRetrieved} points</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 4: Atmospheric & Elevation APIs */}
          <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    GLOBAL ATMOSPHERIC & TOPOGRAPHY APIS
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Open-Meteo & OpenWeather high-resolution weather models with digital elevation gradients
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestWeather}
                disabled={testingWeather}
                className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] disabled:opacity-50 text-cyan-300 text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer border border-cyan-500/30"
              >
                <Zap className={`w-3.5 h-3.5 ${testingWeather ? 'animate-bounce' : ''}`} />
                <span>{testingWeather ? 'Testing Stream...' : 'Test Atmospheric Link'}</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-300 block mb-1">
                OPENWEATHERMAP API KEY (OPTIONAL)
              </label>
              <input
                type="password"
                value={openWeatherKey}
                onChange={e => setOpenWeatherKey(e.target.value)}
                placeholder="Enter OpenWeatherMap API key (Leave blank for Open-Meteo Global Zero-Key stream)..."
                disabled={role !== 'ADMIN'}
                className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              <p className="text-[11px] font-mono text-slate-500 mt-1">
                Zero-config fallback: If left blank, real-time weather is seamlessly sampled via WMO Open-Meteo ECMWF models with no key needed.
              </p>
            </div>

            {weatherResult && (
              <div className={`p-3 rounded text-xs font-mono border ${
                weatherResult.success ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}>
                <div className="font-bold">{weatherResult.message || weatherResult.error}</div>
                {weatherResult.weather && (
                  <div className="text-[11px] text-slate-300 mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <span>Temp: <strong>{weatherResult.weather.temperatureC}°C</strong></span>
                    <span>Wind: <strong>{weatherResult.weather.windSpeedKmh} km/h ({weatherResult.weather.windDirectionCardinal})</strong></span>
                    <span>Humidity: <strong>{weatherResult.weather.humidityPct}%</strong></span>
                    <span>Source: <strong>{weatherResult.weather.source}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 5: DBSCAN Clustering & Processing */}
          <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">
                    DBSCAN GEODESIC CLUSTERING HYPERPARAMETERS
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Spatial neighborhood grouping distance threshold and core density
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Haversine Metric</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  EPS RADIUS (KM)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="10.0"
                  value={epsKm}
                  disabled={role !== 'ADMIN'}
                  onChange={e => setEpsKm(parseFloat(e.target.value) || 2.5)}
                  className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  MIN SAMPLES (POINTS)
                </label>
                <input
                  type="number"
                  step="1"
                  min="2"
                  max="20"
                  value={minSamples}
                  disabled={role !== 'ADMIN'}
                  onChange={e => setMinSamples(parseInt(e.target.value) || 3)}
                  className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  INGESTION INTERVAL (MINUTES)
                </label>
                <input
                  type="number"
                  step="5"
                  min="5"
                  max="60"
                  value={refreshInterval}
                  disabled={role !== 'ADMIN'}
                  onChange={e => setRefreshInterval(parseInt(e.target.value) || 15)}
                  className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">
                  DEFAULT SATELLITE SENSOR
                </label>
                <select
                  value={activeSensor}
                  disabled={role !== 'ADMIN'}
                  onChange={e => setActiveSensor(e.target.value)}
                  className="w-full bg-[#07090e] border border-[#1e293b] rounded p-2 text-xs font-mono text-slate-100 disabled:opacity-50"
                >
                  <option value="VIIRS_SNPP_NRT">VIIRS Suomi-NPP (375m)</option>
                  <option value="VIIRS_NOAA20_NRT">VIIRS NOAA-20 (375m)</option>
                  <option value="MODIS_NRT">MODIS Aqua & Terra (1km)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleRecluster}
                disabled={role !== 'ADMIN' || saving}
                className="px-4 py-2 bg-[#1e293b] hover:bg-[#334155] disabled:opacity-50 text-slate-200 text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
                <span>Trigger Immediate DBSCAN Re-Clustering</span>
              </button>
            </div>
          </div>

          {/* Save Configuration Bar */}
          {role === 'ADMIN' && (
            <div className="flex items-center justify-between pt-2">
              <div>
                {savedSuccess && (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    Configuration saved & database/API endpoints re-synchronized!
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono rounded flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Applying Settings...' : 'Save Configuration & Re-Sync Pipelines'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Snowflake Credentials Location Guide Modal */}
      {showSnowflakeGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100 font-mono">
                  Where to Find Credentials in Snowflake
                </h3>
              </div>
              <button
                onClick={() => setShowSnowflakeGuide(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono px-2 py-1 bg-[#1e293b] rounded cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono text-slate-300">
              {/* Step 1: Account Identifier */}
              <div className="bg-[#07090e] border border-[#1e293b] p-3 rounded space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">1</span>
                  <span>ACCOUNT IDENTIFIER (Most Important)</span>
                </div>
                <p className="text-slate-400">
                  Look at your browser's address bar when logged into Snowflake (Snowsight):
                </p>
                <div className="p-2 bg-[#1e293b] rounded text-emerald-400 font-bold overflow-x-auto">
                  https://<span className="text-amber-300 underline">app.snowflake.com/myorg/myaccount</span>/...
                </div>
                <p className="text-slate-400">
                  You can also find it in the bottom-left corner of Snowsight:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
                  <li>Click on your <strong>Profile / Account Name</strong> (bottom-left)</li>
                  <li>Hover over <strong>Account</strong> ➔ click <strong>Copy Account Identifier</strong></li>
                  <li>Format is usually <code className="text-amber-300">ORGNAME-ACCOUNTNAME</code> or locator format <code className="text-amber-300">xy12345.us-east-1</code>.</li>
                </ul>
              </div>

              {/* Step 2: Username & Password */}
              <div className="bg-[#07090e] border border-[#1e293b] p-3 rounded space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px]">2</span>
                  <span>USERNAME & PASSWORD</span>
                </div>
                <p className="text-slate-400">
                  This is the exact username and password you use to sign into your Snowflake web console.
                  (Note: If you sign in via Google/SSO, you may need to set a native database password in Snowflake under <em>Profile ➔ Change Password</em> or use a dedicated service user).
                </p>
              </div>

              {/* Step 3: Warehouse, Database & Schema */}
              <div className="bg-[#07090e] border border-[#1e293b] p-3 rounded space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">3</span>
                  <span>WAREHOUSE, DATABASE & SCHEMA</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div className="p-2 bg-[#1e293b] rounded">
                    <span className="text-slate-400 block text-[10px]">WAREHOUSE</span>
                    <span className="text-amber-300 font-bold">COMPUTE_WH</span>
                    <span className="text-[10px] text-slate-500 block">Check under <em>Admin ➔ Warehouses</em></span>
                  </div>
                  <div className="p-2 bg-[#1e293b] rounded">
                    <span className="text-slate-400 block text-[10px]">DATABASE</span>
                    <span className="text-cyan-300 font-bold">FIRE_SPACE</span>
                    <span className="text-[10px] text-slate-500 block">Or any DB in <em>Data ➔ Databases</em></span>
                  </div>
                  <div className="p-2 bg-[#1e293b] rounded">
                    <span className="text-slate-400 block text-[10px]">SCHEMA</span>
                    <span className="text-emerald-300 font-bold">ANALYTICS</span>
                    <span className="text-[10px] text-slate-500 block">Or <em>PUBLIC</em></span>
                  </div>
                </div>
              </div>

              {/* Step 4: Quick DDL if you want to create them */}
              <div className="bg-[#07090e] border border-[#1e293b] p-3 rounded space-y-2">
                <div className="text-slate-200 font-bold flex items-center justify-between">
                  <span>Quick Setup SQL (Run in a Snowflake Worksheet)</span>
                </div>
                <p className="text-slate-400">
                  If you want to create the exact database and schema in Snowflake, paste this in a SQL Worksheet:
                </p>
                <pre className="p-2 bg-[#1e293b] rounded text-amber-300 text-[11px] overflow-x-auto">
{`CREATE DATABASE IF NOT EXISTS FIRE_SPACE;
CREATE SCHEMA IF NOT EXISTS FIRE_SPACE.ANALYTICS;
CREATE SCHEMA IF NOT EXISTS FIRE_SPACE.RAW;
USE WAREHOUSE COMPUTE_WH;`}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#1e293b] pt-3">
              <button
                type="button"
                onClick={() => {
                  handleApplyPreset();
                  setShowSnowflakeGuide(false);
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs font-mono rounded cursor-pointer"
              >
                Apply Standard Defaults to Form
              </button>
              <button
                type="button"
                onClick={() => setShowSnowflakeGuide(false)}
                className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] text-slate-300 text-xs font-mono rounded cursor-pointer"
              >
                Got It, Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

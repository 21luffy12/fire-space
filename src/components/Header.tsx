import React from 'react';
import { Flame, RefreshCw, ShieldAlert, Cpu, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenSyncModal: () => void;
  lastUpdate?: string;
  isSyncing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentPath,
  onNavigate,
  onOpenSyncModal,
  lastUpdate,
  isSyncing = false
}) => {
  const { user, role, switchRole } = useAuth();
  const { theme, toggleTheme, themeConfig } = useTheme();

  const navLinks = [
    { label: 'Overview', path: '/' },
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Fire Clusters', path: '/fires' },
    { label: 'Analytics', path: '/analytics' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'System', path: '/system' }
  ];

  return (
    <header className={`sticky top-0 z-40 w-full h-14 backdrop-blur border-b transition-colors duration-300 px-4 lg:px-6 flex items-center justify-between ${
      theme === 'orbital-navy' ? 'bg-[#081224]/95 border-[#192b4d]' : 'bg-[#070a12]/95 border-[#1b2336]'
    }`}>
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => onNavigate('/')}>
        <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 via-rose-600 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Flame className="w-5 h-5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-slate-100">
            Fire & Space
          </span>
          <span className="hidden sm:inline text-xs font-mono text-slate-500 tracking-wider">
            SATELLITE RADIOMETRY
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden md:flex items-center gap-1.5 lg:gap-3 text-xs font-medium">
        {navLinks.map(link => {
          const isActive = currentPath === link.path;
          return (
            <button
              key={link.path}
              onClick={() => onNavigate(link.path)}
              className={`px-2.5 py-1.5 rounded transition-colors whitespace-nowrap ${
                isActive
                  ? theme === 'orbital-navy'
                    ? 'bg-[#102040] text-cyan-300 font-semibold shadow-inner'
                    : 'bg-[#1e293b] text-amber-400 font-semibold shadow-inner'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Actions & Status */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Quick Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono border transition-all cursor-pointer shadow-sm ${
            theme === 'orbital-navy'
              ? 'bg-[#0a152d] text-cyan-300 border-cyan-500/30 hover:border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              : 'bg-[#080d18] text-amber-300 border-amber-500/30 hover:border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
          }`}
          title={`Active Background Theme: ${themeConfig.name}. Click to switch theme.`}
        >
          <Palette className={`w-3.5 h-3.5 ${theme === 'orbital-navy' ? 'text-cyan-400' : 'text-amber-400'}`} />
          <span className="hidden sm:inline font-semibold text-[11px]">
            {theme === 'orbital-navy' ? '🛰️ Orbital Navy' : '🌑 Obsidian'}
          </span>
          <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
            [Switch]
          </span>
        </button>

        {/* Real-time sync telemetry button */}
        <button
          onClick={onOpenSyncModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono bg-[#0f172a] hover:bg-[#1e293b] text-slate-300 border border-emerald-500/30 hover:border-emerald-500/60 transition-all cursor-pointer shadow-sm"
          title="NASA FIRMS Real-Time Satellite Telemetry Ingestion"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="hidden sm:inline text-emerald-400 font-semibold text-[11px]">REAL-TIME API</span>
          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
          {lastUpdate && (
            <span className="hidden lg:inline text-[11px] text-slate-400 tabular-nums">
              {new Date(lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </button>

        {/* Role Persona Switcher */}
        <div className="relative group">
          <button className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono bg-[#0f172a] text-slate-300 border border-[#1e293b] hover:border-slate-700 transition-colors">
            <span className={`w-1.5 h-1.5 rounded-full ${
              role === 'ADMIN' ? 'bg-amber-400' : role === 'ANALYST' ? 'bg-cyan-400' : 'bg-slate-400'
            }`} />
            <span className="text-[11px] font-semibold">{role}</span>
          </button>
          <div className="absolute right-0 top-full mt-1 w-44 bg-[#0f172a] border border-[#1e293b] rounded shadow-2xl py-1 hidden group-hover:block z-50">
            <div className="px-3 py-1.5 border-b border-[#1e293b] text-[11px] text-slate-400 truncate">
              {user?.email || 'Guest Operator'}
            </div>
            <button
              onClick={() => switchRole('ADMIN')}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#1e293b] flex items-center justify-between ${role === 'ADMIN' ? 'text-amber-400' : 'text-slate-300'}`}
            >
              <span>ADMIN</span>
              <span className="text-[10px] text-slate-500 font-mono">DBSCAN/Config</span>
            </button>
            <button
              onClick={() => switchRole('ANALYST')}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#1e293b] flex items-center justify-between ${role === 'ANALYST' ? 'text-cyan-400' : 'text-slate-300'}`}
            >
              <span>ANALYST</span>
              <span className="text-[10px] text-slate-500 font-mono">Predictions</span>
            </button>
            <button
              onClick={() => switchRole('VIEWER')}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#1e293b] flex items-center justify-between ${role === 'VIEWER' ? 'text-emerald-400' : 'text-slate-300'}`}
            >
              <span>VIEWER</span>
              <span className="text-[10px] text-slate-500 font-mono">Read Only</span>
            </button>
          </div>
        </div>

        {/* Settings button */}
        <button
          onClick={() => onNavigate('/settings')}
          className="p-1.5 rounded bg-[#0f172a] hover:bg-[#1e293b] text-slate-400 hover:text-slate-200 border border-[#1e293b] transition-colors"
          title="System Settings & Theme"
        >
          <Cpu className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

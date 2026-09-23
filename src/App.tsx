import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Header } from './components/Header';
import { SyncModal } from './components/SyncModal';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { FireListPage } from './pages/FireListPage';
import { FireDetailPage } from './pages/FireDetailPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AlertsPage } from './pages/AlertsPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { SettingsPage } from './pages/SettingsPage';
import { FireCluster, FireObservation } from './types';
import { getLiveFires } from './services/api';

function AppContent() {
  const [currentPath, setCurrentPath] = useState<string>('/dashboard');
  const [clusters, setClusters] = useState<FireCluster[]>([]);
  const [observations, setObservations] = useState<FireObservation[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  // Load live satellite fires
  const loadData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await getLiveFires();
      if (res.success) {
        setClusters(res.clusters);
        setObservations(res.observations);
        setLastUpdate(res.lastUpdate);
        setError(null);

        // If no cluster selected yet, default to first critical or first cluster
        if (!selectedClusterId && res.clusters.length > 0) {
          const crit = res.clusters.find(c => c.riskLevel === 'CRITICAL') || res.clusters[0];
          setSelectedClusterId(crit.clusterId);
        }
      }
    } catch (err: any) {
      console.warn('Live fire telemetry fetch warning:', err);
      setError('Live satellite feed connecting...');
    } finally {
      setIsSyncing(false);
    }
  }, [selectedClusterId]);

  useEffect(() => {
    loadData();

    // Setup Server-Sent Events (SSE) for real-time live map telemetry pushes
    let evtSource: EventSource | null = null;
    try {
      evtSource = new EventSource('/api/stream');
      evtSource.addEventListener('satellite_sync', () => {
        console.log('[SSE] Live satellite sync notification received. Refreshing state...');
        loadData();
      });
      evtSource.addEventListener('clusters_updated', () => {
        loadData();
      });
    } catch (e) {
      console.warn('SSE stream unavailable:', e);
    }

    return () => {
      if (evtSource) evtSource.close();
    };
  }, [loadData]);

  // Navigate helper
  const navigate = (path: string) => {
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAndNavigate = (clusterId: string) => {
    setSelectedClusterId(clusterId);
    navigate(`/fires/${clusterId}`);
  };

  const handleNavigateMap = (clusterId: string) => {
    setSelectedClusterId(clusterId);
    navigate('/dashboard');
  };

  // Resolve detail cluster if route is /fires/:id
  let detailCluster: FireCluster | null = null;
  if (currentPath.startsWith('/fires/')) {
    const id = currentPath.replace('/fires/', '');
    detailCluster = clusters.find(c => c.clusterId === id) || clusters[0] || null;
  }

  return (
    <div className={`min-h-screen app-theme-bg text-slate-100 flex flex-col font-sans transition-colors duration-300 ${theme === 'orbital-navy' ? 'theme-orbital-navy' : 'theme-obsidian'}`}>
      {/* Navigation Top Bar */}
      <Header
        currentPath={currentPath}
        onNavigate={navigate}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        lastUpdate={lastUpdate}
        isSyncing={isSyncing}
      />

      {/* View Router */}
      <main className="flex-1 flex flex-col min-h-0">
        {currentPath === '/' && (
          <LandingPage
            clusters={clusters}
            observations={observations}
            onLaunchDashboard={() => navigate('/dashboard')}
            onNavigate={navigate}
          />
        )}

        {currentPath === '/dashboard' && (
          <DashboardPage
            clusters={clusters}
            observations={observations}
            lastUpdate={lastUpdate}
            selectedClusterId={selectedClusterId}
            onSelectCluster={id => setSelectedClusterId(id)}
            onNavigateDetail={id => handleSelectAndNavigate(id)}
            onRefresh={loadData}
            isSyncing={isSyncing}
          />
        )}

        {currentPath === '/fires' && (
          <FireListPage
            clusters={clusters}
            onSelectAndNavigate={handleSelectAndNavigate}
            onNavigateMap={handleNavigateMap}
          />
        )}

        {currentPath.startsWith('/fires/') && (
          <FireDetailPage
            cluster={detailCluster}
            onBack={() => navigate('/fires')}
            onViewOnMainMap={handleNavigateMap}
          />
        )}

        {currentPath === '/analytics' && <AnalyticsPage />}

        {currentPath === '/alerts' && (
          <AlertsPage onNavigateCluster={handleNavigateMap} />
        )}

        {currentPath === '/system' && <SystemHealthPage />}

        {currentPath === '/settings' && <SettingsPage />}
      </main>

      {/* Sync Telemetry Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={loadData}
      />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

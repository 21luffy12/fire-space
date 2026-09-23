import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { apiRouter, broadcastLiveUpdate } from './backend/routes';
import { operationalStore } from './backend/storage';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Background satellite sync job
let syncInterval: NodeJS.Timeout | null = null;

function scheduleSyncJob() {
  if (syncInterval) clearInterval(syncInterval);
  const intervalMs = Math.max(5, operationalStore.refreshIntervalMinutes) * 60 * 1000;
  console.log(`[Scheduler] NASA FIRMS background ingestion scheduled every ${operationalStore.refreshIntervalMinutes} minutes.`);

  syncInterval = setInterval(async () => {
    console.log('[Scheduler] Executing scheduled satellite fire ingestion & DBSCAN re-clustering...');
    try {
      const res = await operationalStore.syncAndProcess();
      broadcastLiveUpdate('satellite_sync', {
        clustersCount: res.clusters.length,
        hotspotsCount: res.observations.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[Scheduler] Ingestion error:', err);
    }
  }, intervalMs);
}

async function startServer() {
  if (!isProduction) {
    // Mount Vite dev server in dev mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🔥 Fire & Space — Wildfire Monitoring System Online`);
    console.log(`🌐 Server running at http://0.0.0.0:${PORT}`);
    console.log(`🛰️  FIRMS Source: ${process.env.FIRMS_API_KEY ? 'NASA Live Stream' : 'NASA Satellite Archive'}`);
    console.log(`❄️  Data Warehouse: Snowflake FIRE_SPACE (RAW & ANALYTICS)`);
    console.log(`🧭 DBSCAN Haversine eps: ${operationalStore.dbscanEpsKm}km | min_samples: ${operationalStore.dbscanMinSamples}`);
    console.log(`=======================================================`);
  });

  // Initialize operational database with real satellite data & DBSCAN in background so port 3000 opens instantly
  operationalStore.initialize()
    .then(() => {
      scheduleSyncJob();
    })
    .catch(err => {
      console.warn('[OperationalStore] Background initialization note:', err);
    });
}

startServer().catch(err => {
  console.error('Fatal server startup failure:', err);
  process.exit(1);
});

import { Pool } from 'pg';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { runOneJob, recoverExpiredJobs, reconcileUsage } from './control/worker.js';
import { reconcileMarketOperations } from './market/reconcile.js';
import { databaseOptions } from './control/database.js';

export async function startWorker(signal?: AbortSignal) {
  const config = loadConfig(); const control = new Pool({ ...databaseOptions(config.controlDatabaseUrl), connectionTimeoutMillis: 3000, query_timeout: 10_000 });
  const apps = new Pool({ ...databaseOptions(config.appsDatabaseUrl), connectionTimeoutMillis: 3000, query_timeout: 10_000 }); const ctx = { config, control, apps };
  let marketCheckedAt = 0, marketTask: Promise<void> | null = null;
  const recoveryStop = new AbortController(); const stopRecovery = () => recoveryStop.abort();
  signal?.addEventListener('abort', stopRecovery, { once: true });
  if (signal?.aborted) recoveryStop.abort();
  try {
    while (!signal?.aborted) {
      try {
        if (!marketTask && Date.now() - marketCheckedAt >= 30_000) {
          marketCheckedAt = Date.now();
          // One recovery scan at a time. A slow RPC must not hold the generation queue.
          marketTask = reconcileMarketOperations(ctx, recoveryStop.signal).then(() => {}).catch(() => {
            console.error('La conciliación Devnet sigue pendiente; la generación permanece independiente.');
          }).finally(() => { marketTask = null; });
        }
        await recoverExpiredJobs(ctx); const worked = await runOneJob(ctx); await reconcileUsage(ctx);
        if (!worked) await new Promise(resolve => setTimeout(resolve, 1000));
      } catch { console.error('El worker no puede acceder al plano de control; reintentará sin enviar inferencia.'); await new Promise(resolve => setTimeout(resolve, 5000)); }
    }
  } finally {
    recoveryStop.abort(); signal?.removeEventListener('abort', stopRecovery);
    await marketTask; await Promise.all([control.end(), apps.end()]);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  process.on('SIGINT', () => controller.abort()); process.on('SIGTERM', () => controller.abort());
  startWorker(controller.signal).catch(() => { console.error('No se pudo iniciar el worker.'); process.exitCode = 1; });
}

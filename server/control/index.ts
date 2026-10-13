import { Router } from 'express';
import type { CoreContext } from '../shared.js';
import { mountAuth } from './auth.js';
import { mountProjects } from './projects.js';
import { mountProviders } from './providers.js';
import { mountJobs } from './jobs.js';
import { mountWalletAuth } from './wallet-auth.js';

export function createControlRouter(ctx: CoreContext): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  mountAuth(router, ctx); mountWalletAuth(router,ctx); mountProjects(router, ctx); mountProviders(router, ctx); mountJobs(router, ctx);
  return router;
}

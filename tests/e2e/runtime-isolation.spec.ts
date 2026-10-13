import { test, expect } from '@playwright/test';
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createRuntimeRouter } from '../../server/runtime/index.js';
import { artifactHash, validateManifest } from '../../server/control/security.js';
import { HttpError, type CoreContext } from '../../server/shared.js';

// Test-only local fixture: production runtime router/CSP/SDK + real PostgreSQL SQL.
// Auth is disabled by this artifact's manifest. No identity, inference, Neon,
// Solana, storage transport or real creator data is contacted or represented.
let control: PGlite, apps: PGlite, platform: Server, runtime: Server;
let platformUrl: string, runtimeUrl: string;
let sessionRequests = 0, protectedHits = 0, navigationHits = 0, popupHits = 0;
const appId = randomUUID(), versionId = randomUUID(), ownerId = randomUUID();
async function listen(app: express.Express) {
  const server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  return { server, url: `http://127.0.0.1:${(server.address() as any).port}` };
}
function pool(db: PGlite) {
  let tail = Promise.resolve();
  async function query(sql: string, values: any[] = []) {
    const previous = tail; let unlock!: () => void; tail = new Promise<void>(resolve => { unlock = resolve; }); await previous;
    try { const r = await db.query(sql, values); return { rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0 }; }
    finally { unlock(); }
  }
  return { query };
}
test.beforeAll(async () => {
  control = new PGlite({ extensions: { pgcrypto } }); apps = new PGlite();
  await Promise.all([control.waitReady, apps.waitReady]);
  await control.exec(await readFile(new URL('../../supabase/control/migrations/202610130001_control.sql', import.meta.url), 'utf8'));
  await apps.exec(await readFile(new URL('../../supabase/apps/migrations/202610130001_apps.sql', import.meta.url), 'utf8'));
  const creator = express();
  creator.get('/', (_req, res) => {
    // Intentionally readable in its own creator document, but inaccessible to the opaque frame.
    res.cookie('creator_fixture', 'test-only-visible-creator-cookie');
    res.type('html').send(`<!doctype html><html><body><p id="creator-private">Test-only creator DOM</p><iframe id="trusted" src="${runtimeUrl}/apps/${appId}/versions/${versionId}"></iframe></body></html>`);
  });
  creator.get('/creator-only-proof', (_req, res) => { protectedHits++; res.json({ value: 'test-only creator data' }); });
  creator.get('/top-navigation-proof', (_req, res) => { navigationHits++; res.send('Unexpected navigation'); });
  creator.get('/popup-proof', (_req, res) => { popupHits++; res.send('Unexpected popup'); });
  const startedPlatform = await listen(creator); platform = startedPlatform.server; platformUrl = startedPlatform.url;
  const runtimeApp = express(); runtimeApp.use(express.json()); runtimeApp.use(cookieParser());
  runtimeApp.use((req, _res, next) => { if (req.path.endsWith('/api/session')) sessionRequests++; next(); });
  const ctx = { control: pool(control), apps: pool(apps), config: {
    platformOrigin: platformUrl, runtimeOrigin: '', production: false,
    encryptionKey: 'test-only-runtime-key', runtimeSigningKey: 'test-only-preview-key',
  } } as unknown as CoreContext;
  runtimeApp.use(createRuntimeRouter(ctx));
  runtimeApp.use(((error: any, _req: any, res: any, _next: any) => res.status(error instanceof HttpError ? error.status : 500).json({ error: { code: error.code || 'INTERNAL', message: error.message } })) as express.ErrorRequestHandler);
  const startedRuntime = await listen(runtimeApp); runtime = startedRuntime.server; runtimeUrl = startedRuntime.url; ctx.config.runtimeOrigin = runtimeUrl;
  const capabilities = validateManifest({ version: 1, auth: false, files: false, records: { collections: [] }, connectors: [] });
  const hostile = `<!doctype html><html><head><title>Hostile test-only artifact</title></head><body><p>Hostile test-only artifact</p><script>
    window.hostileResults={csp:[]};const results=window.hostileResults;
    addEventListener('securitypolicyviolation',event=>results.csp.push({directive:event.effectiveDirective,url:event.blockedURI}));
    try{results.parentText=parent.document.body.textContent;}catch(error){results.parentBlocked=error.name;}
    try{results.cookies=document.cookie;}catch(error){results.cookieBlocked=error.name;}
    try{top.location.href=${JSON.stringify(platformUrl + '/top-navigation-proof')};results.topAssigned=true;}catch(error){results.topBlocked=error.name;}
    results.popupOpened=!!window.open(${JSON.stringify(platformUrl + '/popup-proof')},'_blank');
    fetch(${JSON.stringify(platformUrl + '/creator-only-proof')},{credentials:'include'}).then(()=>{results.fetchSucceeded=true;},error=>{results.fetchBlocked=error.name;});
  </script></body></html>`;
  await ctx.control.query('insert into platform_users(id,email) values($1,$2)', [ownerId, 'test-only-creator@example.invalid']);
  await ctx.control.query('insert into projects(id,owner_id,title) values($1,$2,$3)', [appId, ownerId, 'Sandbox test-only fixture']);
  await ctx.control.query("insert into app_versions(id,project_id,prompt,html,manifest,content_hash) values($1,$2,'hostile local fixture',$3,$4,$5)", [versionId, appId, hostile, JSON.stringify(capabilities), artifactHash(hostile, capabilities)]);
  await ctx.control.query('update projects set published_version_id=$2 where id=$1', [appId, versionId]);
});
test.afterAll(async () => {
  for (const server of [runtime, platform]) if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  for (const db of [control, apps]) if (db) await db.close();
});

test('real runtime sandbox blocks hostile DOM/cookies/network/navigation and rejects forged SDK senders', async ({ page, context }) => {
  const popups: string[] = []; page.on('popup', popup => popups.push(popup.url()));
  await page.goto(platformUrl);
  await expect(page.locator('#creator-private')).toHaveText('Test-only creator DOM');
  expect((await context.cookies(platformUrl)).some(c => c.name === 'creator_fixture')).toBe(true);
  await expect.poll(() => sessionRequests).toBeGreaterThan(0);
  await expect.poll(() => page.frames().some(f => f.url().endsWith(`/versions/${versionId}/artifact`))).toBe(true);
  const trusted = page.frames().find(f => f.url() === `${runtimeUrl}/apps/${appId}/versions/${versionId}`)!;
  const generated = page.frames().find(f => f.url().endsWith(`/versions/${versionId}/artifact`))!;
  expect(trusted).toBeTruthy(); expect(generated).toBeTruthy();
  await expect.poll(() => generated.evaluate(() => (window as any).hostileResults?.fetchBlocked)).toBe('TypeError');
  const results = await generated.evaluate(() => (window as any).hostileResults);
  expect(results.parentBlocked).toBe('SecurityError'); expect(results.cookieBlocked).toBe('SecurityError'); expect(results.topBlocked).toBe('SecurityError');
  expect(results.parentText).toBeUndefined(); expect(results.cookies).toBeUndefined(); expect(results.fetchSucceeded).toBeUndefined(); expect(results.popupOpened).toBe(false);
  expect(results.csp.some((violation: any) => violation.directive === 'connect-src' && violation.url === platformUrl + '/creator-only-proof')).toBe(true);
  expect(protectedHits).toBe(0); expect(navigationHits).toBe(0); expect(popupHits).toBe(0); expect(popups).toEqual([]); expect(page.url()).toBe(platformUrl + '/');

  // Positive control: the actual opaque generated window can invoke an allowed SDK method.
  const allowed = await generated.evaluate(() => (window as any).promptfun.auth.session()); expect(allowed).toEqual({ user: null });
  const baseline = sessionRequests;
  await trusted.evaluate(() => {
    (window as any).forgedObserved = 0;
    addEventListener('message', event => { if (event.data?.id?.startsWith('forged-')) (window as any).forgedObserved++; });
  });
  await page.evaluate(() => {
    const target = (document.getElementById('trusted') as HTMLIFrameElement).contentWindow!;
    // This window has the creator origin, rather than the required opaque origin.
    target.postMessage({ channel: 'promptfun.sdk.v1', id: 'forged-creator-origin', method: 'auth.session', args: {} }, '*');
    // This sibling has the expected opaque origin but the wrong sender window.
    const sibling = document.createElement('iframe'); sibling.sandbox.add('allow-scripts');
    sibling.srcdoc = `<script>parent.frames[0].postMessage({channel:'promptfun.sdk.v1',id:'forged-opaque-sibling',method:'auth.session',args:{}},'*');<\/script>`;
    document.body.append(sibling);
  });
  await expect.poll(() => trusted.evaluate(() => (window as any).forgedObserved)).toBe(2);
  // Allow posted-message and HTTP event queues to settle before asserting absence.
  await page.waitForTimeout(500);
  expect(sessionRequests).toBe(baseline);
  expect(protectedHits).toBe(0); expect(navigationHits).toBe(0); expect(popupHits).toBe(0); expect(popups).toEqual([]);
  expect(page.url()).toBe(platformUrl + '/');
});

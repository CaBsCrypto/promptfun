import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import express from 'express';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createControlRouter } from '../../server/control/index.js';
import { HttpError, type CoreContext } from '../../server/shared.js';

// Test-only loopback fixture: built production UI -> production control router ->
// production migrations on real PostgreSQL WASM. No successful control response,
// identity or draft is mocked. No Phantom extension, managed Auth, OpenRouter,
// inference, Solana, app runtime or cloud database is contacted or represented.
let db: PGlite, server: Server, baseUrl: string, ctx: CoreContext;
const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const nativeFetch = globalThis.fetch;
const externalRequests: string[] = [];
const apiCalls: { path: string; method: string; status: number }[] = [];
let tail = Promise.resolve();
async function lock() {
  const previous = tail; let unlock!: () => void;
  tail = new Promise<void>(resolve => { unlock = resolve; }); await previous; return unlock;
}
async function sql(text: string, values: any[] = []) {
  const result = await db.query(text, values);
  return { rows: result.rows as any[], rowCount: result.rows.length || result.affectedRows || 0 };
}

test.beforeAll(async () => {
  await readFile(new URL('../../dist/index.html', import.meta.url), 'utf8');
  db = new PGlite({ extensions: { pgcrypto } }); await db.waitReady;
  for (const migration of ['202610130001_control.sql', '202610130003_identity.sql',
    '202610130004_publications.sql', '202610130005_wallet_auth.sql',
    '202610150006_project_drafts.sql', '202610150007_local_demo.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/control/migrations/${migration}`, import.meta.url), 'utf8'));
  }
  const pool = {
    query: async (text: string, values: any[] = []) => { const unlock = await lock(); try { return await sql(text, values); } finally { unlock(); } },
    connect: async () => { const unlock = await lock(); return { query: sql, release: unlock }; },
  };
  ctx = { control: pool, apps: { query: async () => { throw new Error('App plane is outside the local demo fixture.'); } }, config: {
    backendProvider: 'neon', localDemoEnabled: true, production: false,
    controlAuthUrl: 'https://control-auth.test-only.invalid/neondb/auth',
    appsAuthUrl: 'https://apps-auth.test-only.invalid/neondb/auth', platformOrigin: '', runtimeOrigin: 'http://localhost:4000',
    encryptionKey: 'test-only-local-demo-encryption-key', runtimeSigningKey: 'test-only-local-demo-preview-key',
    openRouterBaseUrl: 'https://openrouter.test-only.invalid/api/v1',
  } } as unknown as CoreContext;
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin !== baseUrl) { externalRequests.push(url.origin); throw new Error('Unexpected external request in local demo test.'); }
    return nativeFetch(input, init);
  }) as typeof fetch;
  const app = express(); app.use(express.json({ limit: '3mb' }));
  app.use('/api', (req, res, next) => {
    const path = req.path;
    res.on('finish', () => apiCalls.push({ path, method: req.method, status: res.statusCode })); next();
  });
  app.get('/api/health', async (_req, res) => {
    await pool.query('select 1'); res.json({ status: 'test_only_fixture', dependencies: { control_database: true }, devnet_only: true });
  });
  app.use('/api', createControlRouter(ctx));
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'TEST_ROUTE_NOT_FOUND', message: 'Unknown test API route.' } }));
  app.use(((error: any, _req: any, res: any, _next: any) => {
    res.status(error instanceof HttpError ? error.status : 500).json({ error: { code: error.code || 'TEST_INTERNAL', message: error.message } });
  }) as express.ErrorRequestHandler);
  app.use(express.static(dist)); app.get('*', (_req, res) => res.sendFile(fileURLToPath(new URL('../../dist/index.html', import.meta.url))));
  server = await new Promise<Server>(resolve => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}`; ctx.config.platformOrigin = baseUrl;
});

test.beforeEach(async () => {
  ctx.config.localDemoEnabled = true;
  await ctx.control.query('truncate table public.platform_users,public.wallet_auth_challenges restart identity cascade');
  externalRequests.length = 0; apiCalls.length = 0;
});
test.afterAll(async () => {
  globalThis.fetch = nativeFetch;
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  if (db) await db.close();
});

async function restrictToFixture(context: BrowserContext) {
  await context.route('**/*', async route => {
    const origin = new URL(route.request().url()).origin;
    if (origin !== baseUrl) { externalRequests.push(origin); await route.abort('blockedbyclient'); }
    else await route.continue();
  });
}
async function enterDemo(page: Page, open = true) {
  if (open) await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Entrar en demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis proyectos', exact: true })).toBeVisible();
  await expect(page.getByText('Demo local', { exact: true }).first()).toBeVisible();
  const session = await page.evaluate(async () => (await fetch('/api/session')).json());
  expect(session.user).toMatchObject({ email: null, wallet_address: null, is_demo: true });
  expect(session.csrf_token).toBeTruthy();
  return session;
}
async function createProject(page: Page, title: string, ownerId: string) {
  await page.getByRole('button', { name: 'Crear un proyecto', exact: true }).first().click();
  await page.getByLabel('Nombre del proyecto').fill(title);
  await page.getByLabel('Qué quieres resolver').fill('Sólo un borrador privado del fixture demo.');
  await page.getByRole('button', { name: 'Crear borrador', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('#project-prompt')).toBeEnabled();
  return (await ctx.control.query('select id,owner_id from projects where owner_id=$1 and title=$2', [ownerId, title])).rows[0];
}
async function draftInSql(projectId: string) {
  return (await ctx.control.query('select prompt,model,base_version_id,revision from project_drafts where project_id=$1', [projectId])).rows[0] ?? null;
}
async function expectSaved(page: Page) {
  await expect(page.locator('[aria-label="Guardado del borrador"] [role="status"]')).toHaveText(/^Guardado\b/);
}
function expectNoExternalActions() {
  expect(externalRequests).toEqual([]);
  expect(apiCalls.filter(call => call.method === 'POST' && (
    call.path.startsWith('/auth/wallet/') || call.path.startsWith('/providers/') ||
    /\/(jobs|publish|market|funding-intents|quote|transactions|submit)$/.test(call.path)))).toHaveLength(0);
}

test('demo entry is offered only while the real local feature flag is enabled', async ({ page, context }) => {
  await restrictToFixture(context);
  const enabled = page.waitForResponse(response => response.url().endsWith('/api/auth/demo') && response.request().method() === 'GET');
  await page.goto(baseUrl);
  expect(await (await enabled).json()).toEqual({ enabled: true });
  await expect(page.getByRole('button', { name: 'Entrar en demo', exact: true })).toBeVisible();
  ctx.config.localDemoEnabled = false;
  const disabled = page.waitForResponse(response => response.url().endsWith('/api/auth/demo') && response.request().method() === 'GET');
  await page.reload(); expect(await (await disabled).json()).toEqual({ enabled: false });
  await expect(page.getByRole('button', { name: 'Entrar con Phantom', exact: true })).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole('button', { name: 'Entrar en demo', exact: true })).toHaveCount(0);
  const denied = await context.request.post(baseUrl + '/api/auth/demo', { headers: { Origin: baseUrl }, data: {} });
  expect(denied.status()).toBe(403); expect((await denied.json()).error.code).toBe('LOCAL_DEMO_UNAVAILABLE');
  expect((await ctx.control.query('select count(*)::int as n from platform_users')).rows[0].n).toBe(0);
  expectNoExternalActions();
});

test('local demo preserves a private project and autosaved prompt through reload and logout/relogin', async ({ page, context }) => {
  await restrictToFixture(context); const session = await enterDemo(page);
  const cookies = await context.cookies(baseUrl);
  const identity = cookies.find(cookie => cookie.name === 'pf_demo_identity')!;
  const loginCookie = cookies.find(cookie => cookie.name === 'pf_session')!;
  expect(identity.httpOnly).toBe(true); expect(identity.sameSite).toBe('Lax');
  expect(loginCookie.httpOnly).toBe(true); expect(loginCookie.sameSite).toBe('Lax');
  expect(identity.expires).toBeGreaterThan(loginCookie.expires);
  expect(await page.evaluate(() => document.cookie)).not.toContain('pf_demo_identity');
  expect(await page.evaluate(() => document.cookie)).not.toContain('pf_session');
  const title = 'Proyecto privado de la demo local';
  const project = await createProject(page, title, session.user.id);
  const prompt = '  Guardar una idea sin wallet ni IA.\n    Conservar sangría y acentos.  ';
  await page.locator('#project-prompt').fill(prompt);
  await expect.poll(() => draftInSql(project.id)).toMatchObject({ prompt, model: '', base_version_id: null });
  await expectSaved(page);
  await expect(page.getByRole('button', { name: 'Conectar OpenRouter', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Generar (primera versión|mejora)$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'IA desactivada en demo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Apoyo y mercado Devnet/ })).toHaveCount(0);
  await mkdir(fileURLToPath(new URL('../../.local/evidence/', import.meta.url)), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../../.local/evidence/ui-demo.jpg', import.meta.url)), quality: 85, fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('#project-prompt')).toHaveValue(prompt); await expectSaved(page);
  expect((await page.evaluate(async () => (await fetch('/api/session')).json())).user.id).toBe(session.user.id);
  const latest = prompt + '\nEdición antes de salir de la demo.';
  await page.locator('#project-prompt').fill(latest);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrar en demo', exact: true })).toBeVisible();
  expect((await page.evaluate(async () => (await fetch('/api/session')).json())).user).toBeNull();
  const afterLogout = await context.cookies(baseUrl);
  expect(afterLogout.find(cookie => cookie.name === 'pf_demo_identity')?.value).toBe(identity.value);
  expect(afterLogout.find(cookie => cookie.name === 'pf_session')).toBeUndefined();
  expect(await draftInSql(project.id)).toMatchObject({ prompt: latest });
  const next = await enterDemo(page, false);
  expect(next.user.id).toBe(session.user.id);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('#project-prompt')).toHaveValue(latest); await expectSaved(page);
  expect((await ctx.control.query("select count(*)::int as n from platform_users where auth_provider='local_demo'")).rows[0].n).toBe(1);
  expect((await ctx.control.query('select count(*)::int as n from wallet_credentials')).rows[0].n).toBe(0);
  expect((await ctx.control.query('select count(*)::int as n from provider_connections')).rows[0].n).toBe(0);
  expect((await ctx.control.query('select count(*)::int as n from generation_jobs')).rows[0].n).toBe(0);
  expectNoExternalActions();
});

test('separate demo browser contexts own distinct projects and cannot read or overwrite each other drafts', async ({ page, context, browser }) => {
  await restrictToFixture(context); const first = await enterDemo(page);
  const title = 'Sólo visible para el navegador demo A';
  const project = await createProject(page, title, first.user.id);
  const firstPrompt = 'Texto privado del navegador demo A.';
  await page.locator('#project-prompt').fill(firstPrompt);
  await expect.poll(() => draftInSql(project.id)).toMatchObject({ prompt: firstPrompt }); await expectSaved(page);
  const otherContext = await browser.newContext();
  try {
    await restrictToFixture(otherContext); const other = await otherContext.newPage(); const second = await enterDemo(other);
    expect(second.user.id).not.toBe(first.user.id);
    const firstIdentity = (await context.cookies(baseUrl)).find(cookie => cookie.name === 'pf_demo_identity')!;
    const secondIdentity = (await otherContext.cookies(baseUrl)).find(cookie => cookie.name === 'pf_demo_identity')!;
    expect(secondIdentity.value).not.toBe(firstIdentity.value);
    await expect(other.getByText(title, { exact: true })).toHaveCount(0);
    const rejected = await other.evaluate(async ({ id, csrf }) => {
      const path = `/api/projects/${id}/draft`;
      const read = await fetch(path);
      const write = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ prompt: 'Intento de otro navegador', model: '', base_version_id: null, revision: 0 }) });
      return { read: read.status, readBody: await read.json(), write: write.status, writeBody: await write.json() };
    }, { id: project.id, csrf: second.csrf_token });
    expect(rejected.read).toBe(404); expect(rejected.write).toBe(404);
    expect(rejected.readBody.error.code).toBe('PROJECT_NOT_FOUND'); expect(rejected.writeBody.error.code).toBe('PROJECT_NOT_FOUND');
    expect(JSON.stringify(rejected)).not.toContain(firstPrompt);
    const own = await createProject(other, 'Sólo visible para el navegador demo B', second.user.id);
    await expect(other.locator('#project-prompt')).toHaveValue('');
    await other.locator('#project-prompt').fill('Texto privado del navegador demo B.');
    await expect.poll(() => draftInSql(own.id)).toMatchObject({ prompt: 'Texto privado del navegador demo B.' }); await expectSaved(other);
    await page.reload(); await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('#project-prompt')).toHaveValue(firstPrompt);
    expect(await draftInSql(project.id)).toMatchObject({ prompt: firstPrompt });
    expect((await ctx.control.query('select owner_id from projects where id=$1', [project.id])).rows[0].owner_id).toBe(first.user.id);
    expect((await ctx.control.query('select owner_id from projects where id=$1', [own.id])).rows[0].owner_id).toBe(second.user.id);
    expect((await ctx.control.query("select count(*)::int as n from platform_users where auth_provider='local_demo'")).rows[0].n).toBe(2);
    expectNoExternalActions();
  } finally { await otherContext.close(); }
});

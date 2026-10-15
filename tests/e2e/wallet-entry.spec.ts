import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import express from 'express';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createControlRouter } from '../../server/control/index.js';
import { artifactHash, encryptSecret, hash } from '../../server/control/security.js';
import { HttpError, type CoreContext } from '../../server/shared.js';

// Local test-only fixture: built production UI -> production control router ->
// production migrations on real PostgreSQL WASM. The injected Phantom extension,
// two deterministic Ed25519 test keys and a local read-only model catalogue are
// explicit doubles. Control APIs and successful draft responses are never mocked.
// Seeded versions/jobs are fixture records, not generated apps or inference proof.
// Keys must never receive funds. No RPC, personal extension, Neon Auth, live
// OpenRouter, app runtime or cloud database is exercised.
let db: PGlite, server: Server, baseUrl: string, ctx: CoreContext;
const nativeFetch = globalThis.fetch;
const keys = [Keypair.fromSeed(Buffer.alloc(32, 71)), Keypair.fromSeed(Buffer.alloc(32, 72))];
const addresses = keys.map(key => key.publicKey.toBase58());
const externalRequests: string[] = [], signedMessages: string[] = [];
const blockedRuntimePreviews: string[] = [];
const models = [
  { id: 'draft-fixture/alpha:free', name: 'Modelo de prueba A', context_length: 32768, pricing: { prompt: '0', completion: '0' } },
  { id: 'draft-fixture/beta:free', name: 'Modelo de prueba B', context_length: 32768, pricing: { prompt: '0', completion: '0' } },
];
const apiCalls: { path: string; method: string; status: number; body: any }[] = [];
const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
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
  // CI builds dist before Playwright. A stale/missing build must fail visibly.
  await readFile(new URL('../../dist/index.html', import.meta.url), 'utf8');
  db = new PGlite({ extensions: { pgcrypto } }); await db.waitReady;
  for (const migration of ['202610130001_control.sql', '202610130003_identity.sql',
    '202610130004_publications.sql', '202610130005_wallet_auth.sql', '202610150006_project_drafts.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/control/migrations/${migration}`, import.meta.url), 'utf8'));
  }
  const pool = {
    query: async (text: string, values: any[] = []) => { const unlock = await lock(); try { return await sql(text, values); } finally { unlock(); } },
    connect: async () => { const unlock = await lock(); return { query: sql, release: unlock }; },
  };
  ctx = { control: pool, apps: { query: async () => { throw new Error('App plane is outside this wallet-auth fixture.'); } }, config: {
    backendProvider: 'neon', controlAuthUrl: 'https://control-auth.test-only.invalid/neondb/auth',
    appsAuthUrl: 'https://apps-auth.test-only.invalid/neondb/auth', platformOrigin: '', runtimeOrigin: 'http://localhost:4000',
    encryptionKey: 'test-only-wallet-entry-encryption-key', runtimeSigningKey: 'test-only-wallet-entry-preview-key',
    openRouterBaseUrl: 'https://openrouter.test-only.invalid/api/v1', production: false,
  } } as unknown as CoreContext;
  // Deny unexpected server-side provider traffic, rather than fabricate a response.
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin !== baseUrl) { externalRequests.push(url.origin); throw new Error('Unexpected external request in wallet entry test.'); }
    return nativeFetch(input, init);
  }) as typeof fetch;
  const app = express(); app.use(express.json({ limit: '3mb' }));
  app.use('/api', (req, res, next) => {
    const path = req.path;
    res.on('finish', () => apiCalls.push({ path, method: req.method, status: res.statusCode, body: req.body })); next();
  });
  // Diagnostic endpoint reports the actual local SQL engine; it does not claim any cloud service is configured.
  app.get('/api/health', async (_req, res) => {
    await pool.query('select 1'); res.json({ status: 'test_only_fixture', dependencies: { control_database: true }, devnet_only: true });
  });
  app.get('/__test__/openrouter/api/v1/models', (_req, res) => res.json({ data: models }));
  app.post('/__test__/sign-message', (req, res) => {
    const index = req.body.key;
    if (![0, 1].includes(index) || !Array.isArray(req.body.bytes) || req.body.bytes.length > 10_000 ||
      !req.body.bytes.every((byte: any) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) { res.status(400).end(); return; }
    const message = Uint8Array.from(req.body.bytes);
    signedMessages.push(Buffer.from(message).toString('utf8'));
    res.json({ signature: Buffer.from(nacl.sign.detached(message, keys[index].secretKey)).toString('base64') });
  });
  app.use('/api', createControlRouter(ctx));
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'TEST_ROUTE_NOT_FOUND', message: 'Unknown test API route.' } }));
  app.use(((error: any, _req: any, res: any, _next: any) => {
    res.status(error instanceof HttpError ? error.status : 500).json({ error: { code: error.code || 'TEST_INTERNAL', message: error.message } });
  }) as express.ErrorRequestHandler);
  app.use(express.static(dist)); app.get('*', (_req, res) => res.sendFile(fileURLToPath(new URL('../../dist/index.html', import.meta.url))));
  server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}`; ctx.config.platformOrigin = baseUrl;
  ctx.config.openRouterBaseUrl = baseUrl + '/__test__/openrouter/api/v1';
});

test.beforeEach(async () => {
  await ctx.control.query('truncate table public.platform_users,public.wallet_auth_challenges restart identity cascade');
  apiCalls.length = 0; signedMessages.length = 0; externalRequests.length = 0; blockedRuntimePreviews.length = 0;
});
test.afterAll(async () => {
  globalThis.fetch = nativeFetch;
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  if (db) await db.close();
});
async function injectTestExtension(context: BrowserContext, initial = 0) {
  await context.route('**/*', async route => {
    const origin = new URL(route.request().url()).origin;
    if (origin !== baseUrl) {
      // Opening a seeded version would request the runtime, which is outside
      // this fixture. Deny it explicitly; never fabricate a working preview.
      if (origin === new URL(ctx.config.runtimeOrigin).origin) blockedRuntimePreviews.push(route.request().url());
      else externalRequests.push(origin);
      await route.abort('blockedbyclient');
    }
    else await route.continue();
  });
  await context.addInitScript(({ addresses, initial }) => {
    const state = { account: initial, mode: 'normal', transactions: 0 };
    const provider = {
      isPhantom: true,
      get publicKey() { return { toBase58: () => addresses[state.account] }; },
      connect: async () => ({ publicKey: provider.publicKey }),
      disconnect: async () => {}, on: () => {}, removeListener: () => {},
      signMessage: async (bytes: Uint8Array) => {
        const index = state.mode === 'wrong-signature' ? 1 - state.account : state.account;
        const result = await fetch('/__test__/sign-message', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: index, bytes: Array.from(bytes) }) });
        if (!result.ok) throw new Error('Test-only signer failed.');
        const body = await result.json();
        if (state.mode === 'change-during-sign') state.account = 1 - state.account;
        return { signature: Uint8Array.from(atob(body.signature), byte => byte.charCodeAt(0)) };
      },
      signTransaction: async () => { state.transactions++; throw new Error('Wallet login must never request a transaction signature.'); },
    };
    (window as any).phantom = { solana: provider }; (window as any).__testWalletExtension = state;
  }, { addresses, initial });
}

test('wallet entry follows real challenge, Ed25519 verification, private SQL project, reload and logout', async ({ page, context, browser }) => {
  await injectTestExtension(context);
  await page.setViewportSize({ width: 1440, height: 1050 }); await page.goto(baseUrl);
  await expect(page.getByRole('button', { name: 'Entrar con Phantom' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar con Solflare' })).toBeVisible();
  await expect(page.getByLabel('Correo', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
  await page.evaluate(() => document.fonts.ready);
  const evidenceDirectory = fileURLToPath(new URL('../../.local/evidence/', import.meta.url));
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../../.local/evidence/wallet-entry.png', import.meta.url)), fullPage: true });

  await page.getByRole('button', { name: 'Entrar con Phantom' }).click();
  await expect(page.getByRole('heading', { name: 'Mis proyectos' })).toBeVisible();
  const session = await page.evaluate(async () => (await fetch('/api/session')).json());
  expect(session.user.email).toBeNull(); expect(session.user.wallet_address).toBe(addresses[0]); expect(session.csrf_token).toBeTruthy();
  const cookie = (await context.cookies(baseUrl)).find(cookie => cookie.name === 'pf_session')!;
  expect(cookie.httpOnly).toBe(true); expect(cookie.sameSite).toBe('Lax');
  expect(await page.evaluate(() => document.cookie.includes('pf_session'))).toBe(false);
  const flow = await ctx.control.query('select address,consumed_at,message from wallet_auth_challenges where address=$1', [addresses[0]]);
  expect(flow.rows).toHaveLength(1); expect(flow.rows[0].consumed_at).toBeTruthy();
  expect(flow.rows[0].message).toBe(signedMessages[0]);
  expect(signedMessages[0]).toContain(new URL(baseUrl).host + ' wants you to sign in with your Solana account:');
  expect(signedMessages[0]).toContain('Chain ID: solana:devnet'); expect(signedMessages[0]).toContain('Nonce:');

  await page.getByRole('button', { name: 'Crear un proyecto', exact: true }).first().click();
  await page.getByLabel('Nombre del proyecto').fill('Borrador privado de wallet A');
  await page.getByLabel('Qué quieres resolver').fill('Proyecto test-only que debe persistir con esta identidad.');
  await page.getByRole('button', { name: 'Crear borrador', exact: true }).click();
  const projectButton = page.getByRole('complementary', { name: 'Mis proyectos' }).getByRole('button', { name: /Borrador privado de wallet A/ });
  await expect(projectButton).toBeVisible();
  const projects = await ctx.control.query('select id,owner_id,published_version_id from projects where owner_id=$1', [session.user.id]);
  expect(projects.rows).toHaveLength(1); expect(projects.rows[0].published_version_id).toBeNull();
  await page.reload(); await expect(projectButton).toBeVisible();
  expect((await page.evaluate(async () => (await fetch('/api/session')).json())).user.id).toBe(session.user.id);

  // A second real wallet-auth identity cannot see A's private project, even with its ID.
  const otherContext = await browser.newContext();
  try {
    await injectTestExtension(otherContext, 1); const other = await otherContext.newPage(); await other.goto(baseUrl);
    await other.getByRole('button', { name: 'Entrar con Phantom' }).click();
    await expect(other.getByRole('heading', { name: 'Mis proyectos' })).toBeVisible();
    await expect(other.getByText('Borrador privado de wallet A')).toHaveCount(0);
    const isolated = await other.evaluate(async id => {
      const response = await fetch('/api/projects/' + id); return { status: response.status, body: await response.json() };
    }, projects.rows[0].id);
    expect(isolated.status).toBe(404); expect(isolated.body.error.code).toBe('PROJECT_NOT_FOUND');
    const second = await other.evaluate(async () => (await fetch('/api/session')).json());
    expect(second.user.id).not.toBe(session.user.id); expect(second.user.wallet_address).toBe(addresses[1]);
    expect(await other.evaluate(() => (window as any).__testWalletExtension.transactions)).toBe(0);
    await other.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(other.getByRole('button', { name: 'Entrar con Phantom' })).toBeVisible();
  } finally { await otherContext.close(); }

  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrar con Phantom' })).toBeVisible();
  expect((await page.evaluate(async () => (await fetch('/api/session')).json())).user).toBeNull();
  expect((await ctx.control.query('select revoked_at,auth_method,auth_token_ciphertext from platform_sessions where token_hash=$1', [hash(cookie.value)])).rows[0])
    .toMatchObject({ auth_method: 'solana', auth_token_ciphertext: null, revoked_at: expect.anything() });
  const replay = await context.request.get(baseUrl + '/api/projects', { headers: { Cookie: `pf_session=${cookie.value}` } });
  expect(replay.status()).toBe(401);
  expect(await page.evaluate(() => (window as any).__testWalletExtension.transactions)).toBe(0); expect(externalRequests).toEqual([]);
  expect(apiCalls.some(call => call.path === '/auth/wallet/verify' && call.status === 200)).toBe(true);
  expect(apiCalls.some(call => call.path === '/projects' && call.method === 'POST' && call.status === 201)).toBe(true);
});

test('a wrong Ed25519 signer and an account change during signing cannot open a UI session', async ({ page, context }) => {
  await injectTestExtension(context); await page.goto(baseUrl);
  await expect(page.getByRole('button', { name: 'Entrar con Phantom' })).toBeVisible();
  const before = (await ctx.control.query('select count(*)::int as n from platform_sessions')).rows[0].n;
  await page.evaluate(() => { (window as any).__testWalletExtension.mode = 'wrong-signature'; });
  await page.getByRole('button', { name: 'Entrar con Phantom' }).click();
  await expect(page.getByText('La firma no corresponde a esta wallet y solicitud.')).toBeVisible();
  expect((await page.evaluate(async () => (await fetch('/api/session')).json())).user).toBeNull();
  expect(apiCalls.at(-1)?.status).not.toBe(500);
  const verifyCount = apiCalls.filter(call => call.path === '/auth/wallet/verify').length;
  await page.evaluate(() => { (window as any).__testWalletExtension.mode = 'change-during-sign'; });
  await page.getByRole('button', { name: 'Entrar con Phantom' }).click();
  await expect(page.getByText('La wallet cambió durante la firma.')).toBeVisible();
  expect(apiCalls.filter(call => call.path === '/auth/wallet/verify')).toHaveLength(verifyCount);
  expect((await page.evaluate(async () => (await fetch('/api/session')).json())).user).toBeNull();
  expect((await ctx.control.query('select count(*)::int as n from platform_sessions')).rows[0].n).toBe(before);
  expect(await page.evaluate(() => (window as any).__testWalletExtension.transactions)).toBe(0); expect(externalRequests).toEqual([]);
});

async function enterWallet(page: Page) {
  await page.goto(baseUrl);
  await page.getByRole('button', { name: 'Entrar con Phantom', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis proyectos' })).toBeVisible();
  return page.evaluate(async () => (await fetch('/api/session')).json());
}

async function createDraftProject(page: Page, title: string, ownerId: string) {
  await page.getByRole('button', { name: 'Crear un proyecto', exact: true }).first().click();
  await page.getByLabel('Nombre del proyecto').fill(title);
  await page.getByLabel('Qué quieres resolver').fill('Datos privados exclusivos del fixture de borradores.');
  await page.getByRole('button', { name: 'Crear borrador', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('#project-prompt')).toBeEnabled();
  return (await ctx.control.query('select id,owner_id from projects where owner_id=$1 and title=$2', [ownerId, title])).rows[0];
}

const saveState = (page: Page) => page.locator('[aria-label="Guardado del borrador"] [role="status"]');
async function expectSaved(page: Page) { await expect(saveState(page)).toHaveText(/^Guardado\b/); }
async function draftInSql(projectId: string) {
  return (await ctx.control.query('select prompt,model,base_version_id,revision from project_drafts where project_id=$1', [projectId])).rows[0] ?? null;
}

async function seedCatalogueConnection(ownerId: string) {
  const secret = 'test-only-local-catalogue-not-an-inference-key';
  return (await ctx.control.query(`insert into provider_connections(owner_id,secret_ciphertext,key_hash)
    values($1,$2,$3) returning id`, [ownerId, encryptSecret(secret, ctx.config.encryptionKey), hash(secret)])).rows[0].id as string;
}

async function seedVersionChoices(projectId: string, count = 2) {
  const manifest = { version: 1 as const, records: { collections: ['tasks'] }, auth: true, files: false, connectors: [] };
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const html = `<html><head><title>Fixture ${index}</title></head><body>Artefacto sembrado, no generado.</body></html>`;
    const result = await ctx.control.query(`insert into app_versions(project_id,prompt,html,manifest,content_hash,changelog,created_at)
      values($1,'Fuente de prueba privada',$2,$3,$4,'[]',$5) returning id`,
    [projectId, html, JSON.stringify(manifest), artifactHash(html, manifest), new Date(Date.UTC(2026, 9, 15, 12, index)).toISOString()]);
    ids.push(result.rows[0].id);
  }
  return ids;
}

test('draft prompt, model and base survive autosave, reload and logout while identities stay isolated', async ({ page, context, browser }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await injectTestExtension(context);
  const session = await enterWallet(page);
  const project = await createDraftProject(page, 'Borrador persistente de identidad A', session.user.id);
  await seedCatalogueConnection(session.user.id);
  const versions = await seedVersionChoices(project.id);
  await page.reload();
  await expect(page.locator('#free-model')).toBeEnabled();
  const prompt = '  Tareas con archivos y estados.\n    Conserva esta sangría y los acentos.  ';
  const desired = { prompt, model: models[1].id, base_version_id: versions[0] };
  await page.locator('#project-prompt').fill(prompt);
  await page.locator('#free-model').selectOption(desired.model);
  await page.locator('#version-base').selectOption(desired.base_version_id);
  await expect.poll(() => draftInSql(project.id)).toMatchObject(desired);
  await expectSaved(page);
  expect(apiCalls.some(call => call.path === `/projects/${project.id}/draft` && call.method === 'PUT' &&
    call.status === 200 && call.body.prompt === prompt && call.body.model === desired.model && call.body.base_version_id === desired.base_version_id)).toBe(true);

  // Visual evidence uses only this fixture's text, public test wallet and catalogue.
  const evidenceDirectory = fileURLToPath(new URL('../../.local/evidence/', import.meta.url));
  await mkdir(evidenceDirectory, { recursive: true });
  const desktopShot = fileURLToPath(new URL('../../.local/evidence/creator-autosave-desktop.png', import.meta.url));
  await page.screenshot({ path: desktopShot, fullPage: true, animations: 'disabled' });
  await test.info().attach('Creator autosaved desktop — local fixture', { path: desktopShot, contentType: 'image/png' });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const mobileShot = fileURLToPath(new URL('../../.local/evidence/creator-autosave-360.png', import.meta.url));
  await page.screenshot({ path: mobileShot, fullPage: true, animations: 'disabled' });
  await test.info().attach('Creator autosaved 360px — local fixture', { path: mobileShot, contentType: 'image/png' });
  await page.setViewportSize({ width: 1440, height: 1050 });

  await page.reload();
  await expect(page.locator('#project-prompt')).toHaveValue(prompt);
  await expect(page.locator('#free-model')).toHaveValue(desired.model);
  await expect(page.locator('#version-base')).toHaveValue(desired.base_version_id);
  await expectSaved(page);

  // Logout occurs before the debounce: its leave guard must acknowledge this edit.
  const latest = prompt + '\nCambio justo antes de cerrar la sesión.';
  await page.locator('#project-prompt').fill(latest);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrar con Phantom', exact: true })).toBeVisible();
  expect(await draftInSql(project.id)).toMatchObject({ ...desired, prompt: latest });
  await enterWallet(page);
  await expect(page.locator('#project-prompt')).toHaveValue(latest);
  await expect(page.locator('#free-model')).toHaveValue(desired.model);
  await expect(page.locator('#version-base')).toHaveValue(desired.base_version_id);
  await expectSaved(page);

  const otherContext = await browser.newContext();
  try {
    await injectTestExtension(otherContext, 1);
    const other = await otherContext.newPage(); const second = await enterWallet(other);
    expect(second.user.id).not.toBe(session.user.id);
    await expect(other.getByText('Borrador persistente de identidad A')).toHaveCount(0);
    const own = await createDraftProject(other, 'Borrador exclusivo de identidad B', second.user.id);
    await expect(other.locator('#project-prompt')).toHaveValue('');
    const inaccessible = await other.evaluate(async ({ id, csrf }) => {
      const path = `/api/projects/${id}/draft`;
      const read = await fetch(path);
      const write = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ prompt: 'Intento ajeno', model: '', base_version_id: null, revision: 0 }) });
      return { read: read.status, write: write.status };
    }, { id: project.id, csrf: second.csrf_token });
    expect(inaccessible).toEqual({ read: 404, write: 404 });
    await other.locator('#project-prompt').fill('Texto privado de B.');
    await expect.poll(() => draftInSql(own.id)).toMatchObject({ prompt: 'Texto privado de B.', model: '', base_version_id: null });
    expect(await draftInSql(project.id)).toMatchObject({ ...desired, prompt: latest });
    await page.reload(); await expect(page.locator('#project-prompt')).toHaveValue(latest);
  } finally { await otherContext.close(); }
  expect((await ctx.control.query('select count(*)::int as n from generation_jobs')).rows[0].n).toBe(0);
  expect(externalRequests).toEqual([]);
});

test('two tabs preserve a conflicting local draft and explicitly choose local or server revision', async ({ page, context }) => {
  await injectTestExtension(context); const session = await enterWallet(page);
  const project = await createDraftProject(page, 'Conflicto explícito entre dos pestañas', session.user.id);
  await expectSaved(page);
  const other = await context.newPage(); await other.goto(baseUrl);
  await expect(other.locator('#project-prompt')).toBeEnabled(); await expectSaved(other);
  await page.locator('#project-prompt').fill('Primera revisión guardada desde pestaña A.');
  await expect.poll(() => draftInSql(project.id)).toMatchObject({ prompt: 'Primera revisión guardada desde pestaña A.', revision: 1 });
  await expectSaved(page);

  const localB = 'Mi texto local en B debe conservarse durante el conflicto.';
  await other.locator('#project-prompt').fill(localB);
  await expect(saveState(other)).toHaveText(/^Conflicto entre revisiones/);
  await expect(other.locator('#project-prompt')).toHaveValue(localB);
  await expect(other.locator('.draft-remote')).toHaveText('Primera revisión guardada desde pestaña A.');
  expect(await draftInSql(project.id)).toMatchObject({ revision: 1 });
  expect(apiCalls.some(call => call.path === `/projects/${project.id}/draft` && call.method === 'PUT' && call.status === 409)).toBe(true);
  await other.getByRole('button', { name: 'Guardar mi borrador sobre esta revisión', exact: true }).click();
  await expect.poll(() => draftInSql(project.id)).toMatchObject({ prompt: localB, revision: 2 });
  await expectSaved(other);

  await page.locator('#project-prompt').fill('Texto local de A antes de elegir la revisión del servidor.');
  await expect(saveState(page)).toHaveText(/^Conflicto entre revisiones/);
  await expect(page.locator('#project-prompt')).toHaveValue('Texto local de A antes de elegir la revisión del servidor.');
  await expect(page.locator('.draft-remote')).toHaveText(localB);
  const successfulWrites = apiCalls.filter(call => call.path === `/projects/${project.id}/draft` && call.method === 'PUT' && call.status === 200).length;
  await page.getByRole('button', { name: 'Usar revisión del servidor', exact: true }).click();
  await expect(page.locator('#project-prompt')).toHaveValue(localB); await expectSaved(page);
  await page.reload(); await expect(page.locator('#project-prompt')).toHaveValue(localB); await expectSaved(page);
  expect(await draftInSql(project.id)).toMatchObject({ prompt: localB, revision: 2 });
  expect(apiCalls.filter(call => call.path === `/projects/${project.id}/draft` && call.method === 'PUT' && call.status === 200)).toHaveLength(successfulWrites);
  expect(externalRequests).toEqual([]);
});

test('a failed draft PUT never says saved or discards text when switching projects or logging out', async ({ page, context }) => {
  await injectTestExtension(context); const session = await enterWallet(page);
  const first = await createDraftProject(page, 'Proyecto cuyo texto debe conservarse', session.user.id);
  await expectSaved(page);
  await createDraftProject(page, 'Otro proyecto sin el texto anterior', session.user.id);
  await page.getByRole('complementary', { name: 'Mis proyectos' }).getByRole('button', { name: /Proyecto cuyo texto debe conservarse/ }).click();
  await expect(page.getByRole('heading', { name: 'Proyecto cuyo texto debe conservarse', exact: true })).toBeVisible();
  await expect(page.locator('#project-prompt')).toBeEnabled(); await expectSaved(page);
  let failWrites = true; const abortedBodies: any[] = [];
  await context.route('**/api/projects/*/draft', async route => {
    if (route.request().method() === 'PUT' && route.request().url().endsWith(`/projects/${first.id}/draft`) && failWrites) {
      abortedBodies.push(route.request().postDataJSON()); await route.abort('failed');
    } else await route.fallback();
  });
  const text = '  Texto aún no guardado.\nNo debe desaparecer con el fallo de transporte.  ';
  await page.locator('#project-prompt').fill(text);
  await expect(saveState(page)).toHaveText(/^Error al guardar/);
  await expect(saveState(page)).not.toHaveText(/^Guardado\b/);
  expect(await draftInSql(first.id)).toBeNull();
  const beforeSwitch = abortedBodies.length;
  await page.getByRole('complementary', { name: 'Mis proyectos' }).getByRole('button', { name: /Otro proyecto sin el texto anterior/ }).click();
  await expect.poll(() => abortedBodies.length).toBeGreaterThan(beforeSwitch);
  await expect(page.getByRole('heading', { name: 'Proyecto cuyo texto debe conservarse', exact: true })).toBeVisible();
  await expect(page.locator('#project-prompt')).toHaveValue(text);
  const beforeLogout = abortedBodies.length;
  const logoutCalls = apiCalls.filter(call => call.path === '/auth/logout').length;
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect.poll(() => abortedBodies.length).toBeGreaterThan(beforeLogout);
  await expect(page.locator('#project-prompt')).toHaveValue(text);
  await expect(saveState(page)).toHaveText(/^Error al guardar/);
  expect(apiCalls.filter(call => call.path === '/auth/logout')).toHaveLength(logoutCalls);
  expect((await page.evaluate(async () => (await fetch('/api/session')).json())).user.id).toBe(session.user.id);
  expect(abortedBodies.every(body => body.prompt === text)).toBe(true);

  failWrites = false;
  await page.getByRole('button', { name: 'Reintentar guardado', exact: true }).click();
  await expect.poll(() => draftInSql(first.id)).toMatchObject({ prompt: text, revision: 1 });
  await expectSaved(page);
  await page.getByRole('complementary', { name: 'Mis proyectos' }).getByRole('button', { name: /Otro proyecto sin el texto anterior/ }).click();
  await expect(page.getByRole('heading', { name: 'Otro proyecto sin el texto anterior', exact: true })).toBeVisible();
  await expect(page.locator('#project-prompt')).toHaveValue('');
  await page.getByRole('complementary', { name: 'Mis proyectos' }).getByRole('button', { name: /Proyecto cuyo texto debe conservarse/ }).click();
  await expect(page.locator('#project-prompt')).toHaveValue(text);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Proyecto cuyo texto debe conservarse', exact: true })).toBeVisible();
  await expect(page.locator('#project-prompt')).toHaveValue(text);
  expect(externalRequests).toEqual([]);
});

test('an uncertain job stays settled while the draft saves and only manual refresh checks execution', async ({ page, context }) => {
  await injectTestExtension(context); const session = await enterWallet(page);
  const project = await createDraftProject(page, 'Trabajo incierto con borrador editable', session.user.id);
  const connectionId = await seedCatalogueConnection(session.user.id);
  const jobId = (await ctx.control.query(`insert into generation_jobs(project_id,actor_id,connection_id,prompt,model,
    idempotency_key,request_hash,quota_day,status,usage_status,prompt_tokens,completion_tokens,cost_usd)
    values($1,$2,$3,'Solicitud anterior sembrada por el fixture',$4,$5,$6,current_date,'uncertain','reported',23,7,0.000041)
    returning id`, [project.id, session.user.id, connectionId, models[0].id, randomUUID(), hash('test-only-uncertain-execution')])).rows[0].id;
  await page.reload();
  await expect(page.locator('.job-state')).toContainText('Requiere revisión');
  await expect(page.locator('.job-state .state-dot')).toHaveClass(/settled/);
  await expect(page.getByRole('group', { name: 'Consumo del proveedor' })).toContainText('Reportado por el proveedor');
  await expect(page.locator('#project-prompt')).toBeEnabled();
  await page.locator('#project-prompt').fill('Una mejora distinta que puede guardarse mientras se revisa el resultado anterior.');
  await expect.poll(() => draftInSql(project.id)).toMatchObject({ prompt: 'Una mejora distinta que puede guardarse mientras se revisa el resultado anterior.' });
  await expectSaved(page);
  await expect(page.getByRole('button', { name: 'Generar primera versión', exact: true })).toBeEnabled();
  // Observe beyond the previous automatic poll interval, without mocking the clock.
  await page.waitForTimeout(3500);
  expect(apiCalls.filter(call => call.path === `/jobs/${jobId}`)).toHaveLength(0);
  expect(apiCalls.filter(call => call.path === `/projects/${project.id}/jobs` && call.method === 'POST')).toHaveLength(0);
  await ctx.control.query(`update generation_jobs set usage_status='unknown',prompt_tokens=null,completion_tokens=null,cost_usd=null where id=$1`, [jobId]);
  await page.getByRole('button', { name: 'Comprobar estado', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Consumo del proveedor' })).toContainText('Consumo Desconocido');
  await expect(page.getByRole('group', { name: 'Consumo del proveedor' })).toContainText('Coste Desconocido');
  await expect(page.locator('.job-state')).toContainText('Requiere revisión');
  expect(apiCalls.filter(call => call.path === `/jobs/${jobId}` && call.method === 'GET')).toHaveLength(1);
  expect(apiCalls.filter(call => call.path === `/projects/${project.id}/jobs` && call.method === 'POST')).toHaveLength(0);
  expect(externalRequests).toEqual([]);
});

function latch() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function enterSecondWalletWithoutReload(page: Page) {
  // Keep the same App instance alive: reloading would hide stale-state races.
  await expect(page.getByRole('button', { name: 'Entrar con Phantom', exact: true })).toBeVisible();
  await page.evaluate(() => { (window as any).__testWalletExtension.account = 1; });
  await page.getByRole('button', { name: 'Entrar con Phantom', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis proyectos' })).toBeVisible();
  const session = await page.evaluate(async () => (await fetch('/api/session')).json());
  expect(session.user.wallet_address).toBe(addresses[1]);
  return session;
}

test('an unsubmitted project form is cleared before another identity enters the same App instance', async ({ page, context }) => {
  await injectTestExtension(context); const first = await enterWallet(page);
  await page.getByRole('button', { name: 'Crear un proyecto', exact: true }).first().click();
  await page.getByLabel('Nombre del proyecto').fill('Idea privada de A que no se envió');
  await page.getByLabel('Qué quieres resolver').fill('Descripción confidencial de A, sólo en el formulario.');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  const second = await enterSecondWalletWithoutReload(page);
  expect(second.user.id).not.toBe(first.user.id);
  await expect(page.getByLabel('Nombre del proyecto')).toHaveCount(0);
  await page.getByRole('button', { name: 'Crear un proyecto', exact: true }).first().click();
  await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('');
  await expect(page.getByLabel('Qué quieres resolver')).toHaveValue('');
  expect((await ctx.control.query('select count(*)::int as n from projects')).rows[0].n).toBe(0);
  expect(externalRequests).toEqual([]);
});

test('a real project-list response buffered for A cannot populate the UI after logout and login as B', async ({ page, context }) => {
  await injectTestExtension(context); const first = await enterWallet(page);
  const title = 'Metadata privada de A en una respuesta tardía';
  const project = await createDraftProject(page, title, first.user.id);
  await seedVersionChoices(project.id, 1); await page.reload();
  await expect(page.locator('#version-base')).not.toHaveValue(''); await expectSaved(page);
  await expect(page.getByRole('link', { name: 'Abrir app', exact: false })).toBeVisible();
  const captured = latch(), release = latch(), settled = latch();
  let holdNext = true, bufferedOwner: string | undefined, delivery = 'not-delivered';
  await context.route('**/api/projects', async route => {
    if (route.request().method() !== 'GET' || !holdNext) { await route.fallback(); return; }
    holdNext = false;
    try {
      // Buffer the actual authenticated router/SQL response; no fabricated API body.
      const response = await route.fetch(); expect(response.status()).toBe(200);
      const body = await response.json();
      bufferedOwner = body.projects.find((item: any) => item.id === project.id)?.owner_id;
      expect(body.projects.some((item: any) => item.title === title)).toBe(true);
      captured.release(); await release.promise;
      try { await route.fulfill({ response }); delivery = 'delivered-real-response'; }
      catch { delivery = 'cancelled-obsolete-request'; }
    } finally { settled.release(); }
  });
  try {
    await page.getByRole('checkbox', { name: 'He probado esta versión y revisado sus datos y permisos.', exact: true }).check();
    await page.getByRole('button', { name: 'Publicar esta versión', exact: true }).click();
    await captured.promise;
    // This invokes the manual loadProjects path after publication, not its abortable mount effect.
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    const second = await enterSecondWalletWithoutReload(page);
    expect(second.user.id).not.toBe(first.user.id);
    await expect(page.getByRole('heading', { name: 'Empieza por una idea', exact: true })).toBeVisible();
    release.release(); await settled.promise;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole('complementary', { name: 'Mis proyectos' }).getByRole('button', { name: new RegExp(title) })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Empieza por una idea', exact: true })).toBeVisible();
    expect((await ctx.control.query('select owner_id from projects where id=$1', [project.id])).rows[0].owner_id).toBe(first.user.id);
    // owner_id is optional in the DTO. The stored row and real body title identify A's response.
    if (bufferedOwner) expect(bufferedOwner).toBe(first.user.id);
    expect(['delivered-real-response', 'cancelled-obsolete-request']).toContain(delivery);
    test.info().annotations.push({ type: 'buffered-response', description: delivery });
    expect(externalRequests).toEqual([]);
  } finally { release.release(); }
});

test('a completed job waits for its real version response and selects the candidate for publication', async ({ page, context }) => {
  await injectTestExtension(context); const session = await enterWallet(page);
  const project = await createDraftProject(page, 'Candidata tras completar un job del fixture', session.user.id);
  const connectionId = await seedCatalogueConnection(session.user.id);
  const jobId = (await ctx.control.query(`insert into generation_jobs(project_id,actor_id,connection_id,prompt,model,
    idempotency_key,request_hash,quota_day,status,usage_status)
    values($1,$2,$3,'Trabajo sembrado sin inferencia real',$4,$5,$6,current_date,'running','pending') returning id`,
  [project.id, session.user.id, connectionId, models[0].id, randomUUID(), hash('test-only-completed-job-version-delay')])).rows[0].id;
  await page.reload(); await expect(page.locator('.job-state')).toContainText('Generando');
  const captured = latch(), release = latch(), settled = latch();
  const failures: string[] = []; let delayed = false;
  page.on('requestfailed', request => { if (request.url().endsWith(`/projects/${project.id}/versions`)) failures.push(request.failure()?.errorText ?? 'unknown'); });
  await context.route(`**/api/projects/${project.id}/versions`, async route => {
    if (route.request().method() !== 'GET' || delayed) { await route.fallback(); return; }
    delayed = true;
    try {
      // Only the timing changes; these bytes come from the production version API.
      const response = await route.fetch(); expect(response.status()).toBe(200);
      expect((await response.json()).versions).toHaveLength(1);
      captured.release(); await release.promise; await route.fulfill({ response });
    } finally { settled.release(); }
  });
  const candidate = (await seedVersionChoices(project.id, 1))[0];
  try {
    await ctx.control.query(`update generation_jobs set status='completed',result_version_id=$2 where id=$1`, [jobId, candidate]);
    await captured.promise;
    // Let React run effect cleanup while the versions request remains outstanding.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(failures).toEqual([]);
    release.release(); await settled.promise;
    await expect(page.locator('.job-state')).toContainText('Versión lista para revisar');
    await expect(page.locator('#version-base')).toHaveValue(candidate);
    await expect(page.getByRole('heading', { name: 'Revisa esta versión', exact: true })).toBeVisible();
    await expectSaved(page);
    await page.getByRole('checkbox', { name: 'He probado esta versión y revisado sus datos y permisos.', exact: true }).check();
    await expect(page.getByRole('button', { name: 'Publicar esta versión', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Publicar esta versión', exact: true }).click();
    await expect.poll(async () => (await ctx.control.query('select published_version_id from projects where id=$1', [project.id])).rows[0].published_version_id).toBe(candidate);
    expect(failures).toEqual([]);
    expect(apiCalls.filter(call => call.path === `/projects/${project.id}/jobs` && call.method === 'POST')).toHaveLength(0);
    expect(externalRequests).toEqual([]);
  } finally { release.release(); }
});

test('a failed save restores the history entry and later Back and Forward preserve the draft context', async ({ page, context }) => {
  await injectTestExtension(context); const session = await enterWallet(page);
  const title = 'Borrador protegido al recorrer el historial';
  const project = await createDraftProject(page, title, session.user.id);
  await expectSaved(page);
  await page.getByRole('button', { name: 'Descubrir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Descubrir', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.history.state?.pf_index)).toBe(2);

  let failWrites = true, abortedWrites = 0;
  await context.route(`**/api/projects/${project.id}/draft`, async route => {
    if (route.request().method() === 'PUT' && failWrites) { abortedWrites++; await route.abort('failed'); }
    else await route.fallback();
  });
  const prompt = 'Este texto debe conservarse mientras el historial vuelve a la entrada actual.';
  await page.locator('#project-prompt').fill(prompt);
  await expect(saveState(page)).toHaveText(/^Error al guardar/);
  const beforeBack = abortedWrites;
  await page.goBack();
  await expect.poll(() => abortedWrites).toBeGreaterThan(beforeBack);
  await expect.poll(() => page.evaluate(() => window.history.state?.pf_index)).toBe(2);
  await expect(page.getByRole('button', { name: 'Crear', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('#project-prompt')).toHaveValue(prompt);
  await expect(saveState(page)).toHaveText(/^Error al guardar/);
  expect(await draftInSql(project.id)).toBeNull();

  failWrites = false;
  await page.getByRole('button', { name: 'Reintentar guardado', exact: true }).click();
  await expect.poll(() => draftInSql(project.id)).toMatchObject({ prompt, revision: 1 });
  await expectSaved(page);
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Descubrir', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect.poll(() => page.evaluate(() => window.history.state?.pf_index)).toBe(1);
  await page.goForward();
  await expect(page.getByRole('button', { name: 'Crear', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('#project-prompt')).toHaveValue(prompt); await expectSaved(page);
  await expect.poll(() => page.evaluate(() => window.history.state?.pf_index)).toBe(2);
  expect(new URL(page.url()).searchParams.get('creator_project')).toBe(project.id);
  expect(externalRequests).toEqual([]);
});

test('an older list for the same owner cannot displace a new project or discard its edits before autosave', async ({ page, context }) => {
  await injectTestExtension(context); const session = await enterWallet(page);
  const first = await createDraftProject(page, 'Proyecto A de la lista anterior', session.user.id);
  await seedVersionChoices(first.id, 1); await page.reload();
  await expect(page.locator('#version-base')).not.toHaveValue(''); await expectSaved(page);
  await expect(page.getByRole('link', { name: 'Abrir app', exact: false })).toBeVisible();
  const captured = latch(), release = latch(), settled = latch(); let holdNext = true;
  await context.route('**/api/projects', async route => {
    if (route.request().method() !== 'GET' || !holdNext) { await route.fallback(); return; }
    holdNext = false;
    try {
      // Retain the actual pre-creation list from this same authenticated owner.
      const response = await route.fetch(); expect(response.status()).toBe(200);
      expect((await response.json()).projects.map((item: any) => item.id)).toEqual([first.id]);
      captured.release(); await release.promise;
      try { await route.fulfill({ response }); } catch { /* Cancelling an obsolete request is also a valid defence. */ }
    } finally { settled.release(); }
  });
  try {
    await page.getByRole('checkbox', { name: 'He probado esta versión y revisado sus datos y permisos.', exact: true }).check();
    await page.getByRole('button', { name: 'Publicar esta versión', exact: true }).click();
    await captured.promise;
    const secondTitle = 'Proyecto B creado mientras la lista A esperaba';
    const second = await createDraftProject(page, secondTitle, session.user.id);
    const prompt = 'Texto nuevo de B, todavía dentro del debounce al llegar la respuesta antigua.';
    await page.locator('#project-prompt').fill(prompt);
    await expect(saveState(page)).toHaveText(/^Cambios sin guardar/);
    expect(await draftInSql(second.id)).toBeNull();
    release.release(); await settled.promise;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole('heading', { name: secondTitle, exact: true })).toBeVisible();
    await expect(page.locator('#project-prompt')).toHaveValue(prompt);
    await expect.poll(() => draftInSql(second.id)).toMatchObject({ prompt, revision: 1 });
    await expectSaved(page);
    expect(new URL(page.url()).searchParams.get('creator_project')).toBe(second.id);
    await page.reload();
    await expect(page.getByRole('heading', { name: secondTitle, exact: true })).toBeVisible();
    await expect(page.locator('#project-prompt')).toHaveValue(prompt);
    expect((await ctx.control.query('select count(*)::int as n from projects where owner_id=$1', [session.user.id])).rows[0].n).toBe(2);
    expect(externalRequests).toEqual([]);
  } finally { release.release(); }
});

test('checking pending usage on a completed job preserves the older base chosen for the next draft', async ({ page, context }) => {
  await injectTestExtension(context); const session = await enterWallet(page);
  const project = await createDraftProject(page, 'Consultar consumo sin modificar la base elegida', session.user.id);
  const connectionId = await seedCatalogueConnection(session.user.id);
  const [older, candidate] = await seedVersionChoices(project.id, 2);
  const jobId = (await ctx.control.query(`insert into generation_jobs(project_id,actor_id,connection_id,prompt,model,
    idempotency_key,request_hash,quota_day,status,usage_status,result_version_id)
    values($1,$2,$3,'Generación terminada sembrada, sin inferencia real',$4,$5,$6,current_date,'completed','pending',$7) returning id`,
  [project.id, session.user.id, connectionId, models[0].id, randomUUID(), hash('test-only-completed-usage-refresh'), candidate])).rows[0].id;
  await page.reload();
  await expect(page.locator('.job-state')).toContainText('Versión lista para revisar');
  await expect(page.locator('#version-base')).toBeEnabled();
  await expect(page.locator('#free-model')).toBeEnabled();
  const prompt = 'La siguiente iteración usa una versión anterior elegida de forma consciente.';
  await page.locator('#project-prompt').fill(prompt);
  await page.locator('#version-base').selectOption(older);
  await page.locator('#free-model').selectOption(models[1].id);
  await expect.poll(() => draftInSql(project.id)).toMatchObject({ prompt, model: models[1].id, base_version_id: older });
  await expectSaved(page);
  const before = await draftInSql(project.id);
  const writesBefore = apiCalls.filter(call => call.path === `/projects/${project.id}/draft` && call.method === 'PUT').length;
  const versionsResponse = page.waitForResponse(response => response.url().endsWith(`/projects/${project.id}/versions`) && response.request().method() === 'GET');
  const jobResponse = page.waitForResponse(response => response.url().endsWith(`/jobs/${jobId}`) && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Comprobar estado', exact: true }).click();
  const responses = await Promise.all([versionsResponse, jobResponse]);
  for (const response of responses) { expect(response.status()).toBe(200); await response.finished(); }
  await expect(page.getByRole('button', { name: 'Comprobar estado', exact: true })).toBeEnabled();
  await expect(page.locator('#version-base')).toHaveValue(older);
  await expect(page.locator('#project-prompt')).toHaveValue(prompt);
  await expect(page.locator('#free-model')).toHaveValue(models[1].id); await expectSaved(page);
  await expect(page.getByRole('group', { name: 'Consumo del proveedor' })).toContainText('Pendiente de reporte');
  await expect(page.getByRole('group', { name: 'Consumo del proveedor' })).toContainText('Coste Pendiente');
  expect(await draftInSql(project.id)).toEqual(before);
  expect(apiCalls.filter(call => call.path === `/projects/${project.id}/draft` && call.method === 'PUT')).toHaveLength(writesBefore);
  expect(apiCalls.filter(call => call.path === `/jobs/${jobId}` && call.method === 'GET')).toHaveLength(1);
  expect(apiCalls.filter(call => call.path === `/projects/${project.id}/jobs` && call.method === 'POST')).toHaveLength(0);
  await page.reload(); await expect(page.locator('#version-base')).toHaveValue(older);
  expect(externalRequests).toEqual([]);
});

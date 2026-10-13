import { test, expect, type BrowserContext } from '@playwright/test';
import express from 'express';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createControlRouter } from '../../server/control/index.js';
import { hash } from '../../server/control/security.js';
import { HttpError, type CoreContext } from '../../server/shared.js';

// Local test-only fixture: built production UI -> production control router ->
// production migrations on real PostgreSQL WASM. ONLY the injected Phantom
// extension and its two deterministic Ed25519 test keys are doubles. These keys
// are not operator credentials and must never receive funds. No RPC, real
// extension, Neon Auth, OpenRouter, generated app or cloud database is exercised.
let db: PGlite, server: Server, baseUrl: string, ctx: CoreContext;
const nativeFetch = globalThis.fetch;
const keys = [Keypair.fromSeed(Buffer.alloc(32, 71)), Keypair.fromSeed(Buffer.alloc(32, 72))];
const addresses = keys.map(key => key.publicKey.toBase58());
const externalRequests: string[] = [], signedMessages: string[] = [];
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
    '202610130004_publications.sql', '202610130005_wallet_auth.sql']) {
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
});
test.afterAll(async () => {
  globalThis.fetch = nativeFetch;
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  if (db) await db.close();
});
async function injectTestExtension(context: BrowserContext, initial = 0) {
  await context.route('**/*', async route => {
    const origin = new URL(route.request().url()).origin;
    if (origin !== baseUrl) { externalRequests.push(origin); await route.abort('blockedbyclient'); }
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

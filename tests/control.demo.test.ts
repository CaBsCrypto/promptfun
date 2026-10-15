import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { request as httpRequest } from 'node:http';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { Keypair } from '@solana/web3.js';
import { createControlRouter } from '../server/control/index.js';
import { authenticate } from '../server/control/auth.js';
import { DEMO_COOKIE, demoEnabled, demoIdentity } from '../server/control/demo-auth.js';
import { hash, nonce } from '../server/control/security.js';
import { HttpError, type CoreContext } from '../server/shared.js';

// Local HTTP + actual production PostgreSQL migrations. No managed Auth, wallet,
// provider inference, funds or cloud connection; the provider double rejects all calls.
let db: PGlite, ctx: CoreContext, server: Server, baseUrl: string, remoteCalls = 0;
let tail = Promise.resolve();
const nativeFetch = globalThis.fetch;
type Browser = Map<string, string>;
const browser = () => new Map<string, string>();
async function lock() { const previous = tail; let unlock!: () => void; tail = new Promise<void>(resolve => { unlock = resolve; }); await previous; return unlock; }
async function query(sql: string, values: any[] = []) { const result = await db.query<any>(sql, values); return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 }; }
before(async () => {
  db = new PGlite({ extensions: { pgcrypto } }); await db.waitReady; await db.exec('create role anon;create role authenticated;');
  for (const file of ['202610130001_control.sql', '202610130003_identity.sql', '202610130004_publications.sql',
    '202610130005_wallet_auth.sql', '202610150006_project_drafts.sql', '202610150007_local_demo.sql'])
    await db.exec(await readFile(new URL('../supabase/control/migrations/' + file, import.meta.url), 'utf8'));
  const pool = { query: async (sql: string, values: any[] = []) => { const unlock = await lock(); try { return await query(sql, values); } finally { unlock(); } },
    connect: async () => { const unlock = await lock(); return { query, release: unlock }; } };
  ctx = { control: pool, apps: pool, config: { localDemoEnabled: true, production: false, platformOrigin: 'http://localhost:3000',
    runtimeOrigin: 'http://127.0.0.1:4000', encryptionKey: 'demo-test-stable-local-encryption-key' } } as unknown as CoreContext;
  globalThis.fetch = (async () => { remoteCalls++; throw new Error('No provider/Auth call is permitted by local demo tests.'); }) as any;
  const app = express(); app.use(express.json()); app.use('/api', createControlRouter(ctx));
  app.use(((error: any, _req: any, res: any, _next: any) => res.status(error instanceof HttpError ? error.status : 500)
    .json({ error: { code: error.code || 'INTERNAL', message: error.message } })) as express.ErrorRequestHandler);
  server = await new Promise<Server>(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}/api`;
});
after(async () => { globalThis.fetch = nativeFetch; if (server) await new Promise<void>(resolve => server.close(() => resolve())); if (db) await db.close(); });
async function api(path: string, jar: Browser, options: { method?: string; body?: any; origin?: string | null; host?: string; csrf?: string; extra?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { Host: options.host || 'localhost:3000', 'Content-Type': 'application/json',
    Cookie: [...jar].map(([key, value]) => key + '=' + value).join(';'), 'Idempotency-Key': nonce(), ...options.extra };
  if (options.origin !== null) headers.Origin = options.origin || ctx.config.platformOrigin;
  if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
  // node:http deliberately permits exercising the exact Host gate against an
  // ephemeral listening port; fetch implementations may replace that header.
  const response = await new Promise<{ status: number; body: any; cookies: string[]; cache: string | undefined }>((resolve, reject) => {
    const request = httpRequest(baseUrl + path, { method: options.method || 'GET', headers }, res => {
      const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => {
        try { resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()), cookies: res.headers['set-cookie'] || [], cache: res.headers['cache-control'] }); }
        catch (error) { reject(error); }
      });
    });
    request.on('error', reject); request.setTimeout(10_000, () => request.destroy(new Error('Fixture HTTP timeout')));
    request.end(options.body === undefined ? undefined : JSON.stringify(options.body));
  });
  const cookies = response.cookies;
  for (const cookie of cookies) { const [pair] = cookie.split(';'), [key, ...value] = pair.split('='); if (!value.join('=')) jar.delete(key); else jar.set(key, value.join('=')); }
  return response;
}
const login = (jar: Browser) => api('/auth/demo', jar, { method: 'POST' });
function request(jar: Browser, overrides: { host?: string; remote?: string; origin?: string; method?: string; forwarded?: boolean } = {}) {
  const headers: Record<string, string> = { host: overrides.host || 'localhost:3000', cookie: [...jar].map(([key, value]) => key + '=' + value).join(';') };
  if (overrides.origin) headers.origin = overrides.origin;
  if (overrides.forwarded) { headers['x-forwarded-for'] = '127.0.0.1'; headers['x-forwarded-host'] = 'localhost:3000'; }
  return { headers, socket: { remoteAddress: overrides.remote || '127.0.0.1' }, method: overrides.method || 'GET',
    get: (name: string) => headers[name.toLowerCase()] } as any;
}

test('demo readiness is flag-gated and never reads SQL, even when unavailable', async () => {
  const original = ctx.control.query;
  ctx.control.query = (async () => { throw new Error('Readiness must not query SQL.'); }) as any;
  try {
    assert.deepEqual((await api('/auth/demo', browser(), { origin: null })).body, { enabled: true });
    for (const value of [undefined, false]) { ctx.config.localDemoEnabled = value; const response = await api('/auth/demo', browser()); assert.equal(response.status, 200); assert.deepEqual(response.body, { enabled: false }); assert.equal(response.cache, 'no-store'); }
    ctx.config.localDemoEnabled = true; ctx.config.production = true;
    assert.deepEqual((await api('/auth/demo', browser())).body, { enabled: false });
  } finally { ctx.config.production = false; ctx.config.localDemoEnabled = true; ctx.control.query = original; }
});

test('local demo issues real hashed sessions and a browser identity that survives logout/reentry', async () => {
  const jar = browser(), logged = await login(jar); assert.equal(logged.status, 200);
  assert.deepEqual(logged.body.user, { id: logged.body.user.id, email: null, wallet_address: null, is_demo: true });
  const identityCookie = jar.get(DEMO_COOKIE)!, oldToken = jar.get('pf_session')!;
  assert.match(identityCookie, /^[\w-]{43}$/);
  assert.ok(logged.cookies.some(cookie => cookie.startsWith(DEMO_COOKIE + '=') && cookie.includes('Max-Age=604800') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax') && !cookie.includes('Domain=')));
  assert.ok(logged.cookies.some(cookie => cookie.startsWith('pf_session=') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax')));
  const stored = (await ctx.control.query('select email,auth_provider,auth_subject from platform_users where id=$1', [logged.body.user.id])).rows[0];
  assert.equal(stored.email, null); assert.equal(stored.auth_provider, 'local_demo'); assert.match(stored.auth_subject, /^[a-f0-9]{64}$/);
  assert.notEqual(stored.auth_subject, identityCookie); assert.equal(stored.auth_subject, demoIdentity(ctx, identityCookie).subject);
  const session = (await ctx.control.query('select token_hash,auth_method,auth_token_ciphertext,wallet_credential_id from platform_sessions where token_hash=$1', [hash(oldToken)])).rows[0];
  assert.deepEqual(session, { token_hash: hash(oldToken), auth_method: 'local_demo', auth_token_ciphertext: null, wallet_credential_id: null });
  assert.deepEqual((await api('/session', jar, { origin: null })).body, logged.body);
  const repeated = await login(jar); assert.equal(repeated.body.user.id, logged.body.user.id); assert.equal(jar.get('pf_session'), oldToken);
  assert.equal((await api('/auth/logout', jar, { method: 'POST', csrf: 'wrong' })).status, 403);
  assert.equal((await api('/auth/logout', jar, { method: 'POST', csrf: logged.body.csrf_token })).status, 200);
  assert.equal(jar.get(DEMO_COOKIE), identityCookie); assert.equal(jar.has('pf_session'), false);
  assert.equal((await api('/projects', new Map([[DEMO_COOKIE, identityCookie], ['pf_session', oldToken]]))).status, 401);
  assert.equal((await login(jar)).body.user.id, logged.body.user.id);
  assert.equal((await ctx.control.query("select count(*)::int as n from platform_users where auth_provider='local_demo' and auth_subject=$1", [stored.auth_subject])).rows[0].n, 1);
  assert.equal(remoteCalls, 0);
});

test('separate browsers own private projects and drafts with actual SQL ownership and CSRF', async () => {
  const a = browser(), b = browser(), one = (await login(a)).body, two = (await login(b)).body;
  assert.notEqual(one.user.id, two.user.id); assert.notEqual(a.get(DEMO_COOKIE), b.get(DEMO_COOKIE));
  assert.equal((await api('/projects', a, { method: 'POST', csrf: 'wrong', body: { title: 'Demo private' } })).status, 403);
  const created = await api('/projects', a, { method: 'POST', csrf: one.csrf_token, body: { title: 'Demo private', owner_id: two.user.id } });
  assert.equal(created.status, 201); assert.equal(created.body.project.owner_id, one.user.id);
  const id = created.body.project.id;
  assert.equal((await api('/projects/' + id, b)).status, 404);
  assert.equal((await api('/projects/' + id + '/draft', a, { method: 'PUT', csrf: one.csrf_token, body: { prompt: '  texto demo\n', model: '', base_version_id: null, revision: 0 } })).status, 200);
  assert.equal((await api('/projects/' + id + '/draft', b)).status, 404);
  assert.equal((await api('/projects/' + id + '/draft', a)).body.draft.prompt, '  texto demo\n');
  assert.equal((await ctx.control.query('select count(*)::int as n from generation_jobs')).rows[0].n, 0);
  assert.equal((await ctx.control.query('select count(*)::int as n from wallet_credentials')).rows[0].n, 0);
  assert.equal(remoteCalls, 0);
});

test('demo cannot use remote hosts/origins/sockets or forwarded-header impersonation', async () => {
  const jar = browser(), user = (await login(jar)).body;
  for (const options of [{ origin: null }, { origin: 'null' }, { origin: 'http://localhost:3001' }, { host: 'attacker.invalid:3000' }, { host: 'localhost:3001' }])
    assert.equal((await api('/auth/demo', browser(), { method: 'POST', ...options })).status, 403);
  assert.deepEqual((await api('/auth/demo', browser(), { host: 'attacker.invalid:3000', extra: { 'X-Forwarded-Host': 'localhost:3000', 'X-Forwarded-For': '127.0.0.1' } })).body, { enabled: false });
  for (const override of [{ remote: '203.0.113.4', forwarded: true }, { host: 'evil.invalid', forwarded: true }, { origin: 'http://localhost:3001' }]) {
    assert.equal(demoEnabled(ctx, request(jar, override)), false);
    await assert.rejects(authenticate(ctx, request(jar, override), false), (error: any) => error.code === 'LOCAL_DEMO_UNAVAILABLE');
  }
  for (const name of ['platformOrigin', 'runtimeOrigin'] as const) {
    const original = ctx.config[name];
    try { for (const value of ['https://example.com', 'http://localhost:3000/path', 'http://localhost:3000?x=1', 'http://user@localhost:3000']) { ctx.config[name] = value; assert.equal(demoEnabled(ctx, request(jar)), false); } }
    finally { ctx.config[name] = original; }
  }
  assert.equal((await api('/session', jar)).body.user.id, user.user.id); assert.equal(remoteCalls, 0);
});

test('demo gates also apply to persisted sessions and logout when disabled or in production', async () => {
  const jar = browser(), logged = (await login(jar)).body;
  for (const scenario of ['disabled', 'production']) {
    if (scenario === 'disabled') ctx.config.localDemoEnabled = false; else ctx.config.production = true;
    try {
      assert.equal((await api('/projects', jar)).status, 403);
      assert.equal((await api('/auth/logout', jar, { method: 'POST', csrf: logged.csrf_token })).status, 403);
      await assert.rejects(authenticate(ctx, request(jar), false), (error: any) => error.code === 'LOCAL_DEMO_UNAVAILABLE');
    } finally { ctx.config.localDemoEnabled = true; ctx.config.production = false; }
  }
  assert.equal((await api('/session', jar)).body.user.id, logged.user.id);
  assert.equal(remoteCalls, 0);
});

test('invalid browser cookies and changed identity/key/provider cannot replay a demo session', async () => {
  for (const value of ['x'.repeat(42), 'x'.repeat(44), '!'.repeat(43), '%E0']) {
    const jar = new Map([[DEMO_COOKIE, value]]); assert.equal((await login(jar)).status, 403);
  }
  assert.equal((await api('/auth/demo', browser(), { method: 'POST', extra: { Cookie: `${DEMO_COOKIE}=${nonce()}; ${DEMO_COOKIE}=${nonce()}` } })).status, 403);
  const jar = browser(), logged = (await login(jar)).body, identityCookie = jar.get(DEMO_COOKIE)!;
  jar.delete(DEMO_COOKIE); assert.equal((await api('/session', jar)).body.user, null);
  jar.set(DEMO_COOKIE, nonce()); assert.equal((await api('/session', jar)).body.user, null); jar.set(DEMO_COOKIE, identityCookie);
  const key = ctx.config.encryptionKey; ctx.config.encryptionKey = 'different-test-local-key';
  try { assert.equal((await api('/session', jar)).body.user, null); } finally { ctx.config.encryptionKey = key; }
  await ctx.control.query("update platform_users set auth_provider='neon',email='fixture@example.invalid' where id=$1", [logged.user.id]);
  assert.equal((await api('/session', jar)).body.user, null);
  await ctx.control.query("update platform_users set auth_provider='local_demo',email=null where id=$1", [logged.user.id]);
  await ctx.control.query("update platform_sessions set auth_method='managed' where token_hash=$1", [hash(jar.get('pf_session')!)]);
  assert.equal((await api('/session', jar)).body.user, null);
  assert.equal(remoteCalls, 0);
});

test('demo refuses an existing regular account without changing its session or contacting Auth', async () => {
  const id = randomUUID(), token = nonce(), jar = new Map([['pf_session', token]]);
  await ctx.control.query("insert into platform_users(id,email,auth_provider,auth_subject) values($1,'regular@example.invalid','supabase',$2)", [id,id]);
  await ctx.control.query("insert into platform_sessions(user_id,token_hash,csrf_token,auth_token_ciphertext,expires_at) values($1,$2,'fixture-csrf','fixture-not-a-real-provider-grant',now()+interval '1 hour')", [id, hash(token)]);
  const response = await login(jar); assert.equal(response.status, 409); assert.equal(response.body.error.code, 'ACCOUNT_ALREADY_AUTHENTICATED');
  assert.equal(response.cookies.length, 0); assert.equal(jar.get('pf_session'), token); assert.equal(jar.has(DEMO_COOKIE), false);
  assert.equal((await ctx.control.query('select revoked_at from platform_sessions where token_hash=$1', [hash(token)])).rows[0].revoked_at, null);
  assert.equal(remoteCalls, 0);
});

test('SQL rejects fake email/upstream credentials for local demos and keeps browser grants revoked', async () => {
  for (const [email, subject] of [['fake@example.invalid', 'a'.repeat(64)], [null, null], [null, nonce()]])
    await assert.rejects(ctx.control.query("insert into platform_users(id,email,auth_provider,auth_subject) values($1,$2,'local_demo',$3)", [randomUUID(), email, subject]), /check constraint/i);
  const jar = browser(), logged = (await login(jar)).body;
  await assert.rejects(ctx.control.query("insert into platform_sessions(user_id,token_hash,csrf_token,auth_token_ciphertext,expires_at,auth_method) values($1,$2,'fixture','forbidden',now()+interval '1 hour','local_demo')", [logged.user.id, nonce()]), /check constraint/i);
  for (const role of ['anon', 'authenticated']) {
    await ctx.control.query('set role ' + role);
    try { await assert.rejects(ctx.control.query('select * from platform_users'), /permission denied/i); await assert.rejects(ctx.control.query('select * from platform_sessions'), /permission denied/i); }
    finally { await ctx.control.query('reset role'); }
  }
  const original = demoIdentity(ctx, jar.get(DEMO_COOKIE)!); ctx.config.platformOrigin = 'http://localhost:3001';
  try { assert.notEqual(demoIdentity(ctx, jar.get(DEMO_COOKIE)!).id, original.id); } finally { ctx.config.platformOrigin = 'http://localhost:3000'; }
});

test('demo cannot authorize AI, publication, public feedback or wallet linking through actual routes', async () => {
  const jar = browser(), logged = (await login(jar)).body;
  const created = await api('/projects', jar, { method: 'POST', csrf: logged.csrf_token, body: { title: 'Demo restricted editor' } });
  assert.equal(created.status, 201); const id = created.body.project.id;
  const tables = ['provider_connections', 'auth_flows', 'generation_jobs', 'generation_attempts', 'app_versions', 'publication_history', 'feedback', 'wallet_credentials', 'wallet_auth_challenges'];
  const counts = async () => Promise.all(tables.map(async table => (await ctx.control.query('select count(*)::int as n from public.' + table)).rows[0].n));
  const before = await counts();
  const routes = [
    { path: `/projects/${id}/jobs`, method: 'POST', body: { prompt: 'Never send inference', model: 'fixture:free' } },
    { path: `/projects/${id}/publish`, method: 'POST', body: { version_id: randomUUID() } },
    { path: `/projects/${id}/import`, method: 'POST', body: {} },
    { path: `/projects/${id}/preview-token`, method: 'POST', body: {} },
    { path: `/public/projects/${id}/feedback`, method: 'POST', body: { version_id: randomUUID(), text: 'Never publish demo feedback' } },
    { path: '/providers/openrouter/start', method: 'GET' },
    { path: '/providers/openrouter/callback?state=unused&code=unused', method: 'GET' },
    { path: '/providers/openrouter/models', method: 'GET' },
    { path: '/providers/openrouter', method: 'DELETE' },
    { path: '/auth/wallet/challenge', method: 'POST', body: { mode: 'link', address: Keypair.generate().publicKey.toBase58() } },
    { path: '/auth/wallet', method: 'DELETE' },
  ];
  for (const route of routes) {
    const response = await api(route.path, jar, { ...route, csrf: logged.csrf_token });
    assert.equal(response.status, 403, route.path); assert.equal(response.body.error.code, 'LOCAL_DEMO_ONLY', route.path);
  }
  assert.equal((await api('/providers/openrouter', jar)).body.connected, false);
  assert.deepEqual(await counts(), before); assert.equal(remoteCalls, 0);
  assert.equal((await api('/session', jar)).body.user.is_demo, true);
});

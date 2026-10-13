import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { Server } from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createRuntimeRouter } from '../server/runtime/index.js';
import { artifactHash, decryptSecret, signPreviewToken, validateManifest } from '../server/control/security.js';
import { NEON_SESSION_COOKIE } from '../server/control/identity.js';
import { HttpError, type CoreContext } from '../server/shared.js';
import type { CapabilityManifest } from '../shared/contracts.js';

// Production SQL, HTTP routes, identity protocol, cookie encryption and object integrity
// are real. ONLY the upstream identity HTTP server and S3 transport are test doubles.
// Two separate PGlite engines represent the planes; connections are serialized because
// each engine has one backend. This is not proof of live Neon/Auth/S3 or native PG races.
let controlDb: PGlite, appsDb: PGlite, ctx: CoreContext;
let runtimeServer: Server, identityServer: Server, base: string, identityBase: string;
const nativeFetch = globalThis.fetch, originalSend = S3Client.prototype.send;
const owner = randomUUID(), password = 'fixture-password-only';
const html = '<!doctype html><html><head><title>Fixture</title></head><body><p>App fixture</p></body></html>';
const manifest: CapabilityManifest = { version: 1, auth: true, files: true, records: { collections: ['tasks', 'notes'] }, connectors: [] };
const objects = new Map<string, Buffer>();
const upstreamSessions = new Map<string, { id: string; email: string; emailVerified: boolean }>();
let providerReads = 0, providerWrites = 0, storagePuts = 0, storageGets = 0, storageDeletes = 0;
let storagePutFails = false;
let blockedUpload: { started: () => void; wait: Promise<void> } | undefined;
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const appCookieName = (appId: string) => 'pf_app_' + appId.replaceAll('-', '');

function pool(db: PGlite) {
  let tail = Promise.resolve();
  async function lock() { const previous = tail; let unlock!: () => void; tail = new Promise<void>(resolve => { unlock = resolve; }); await previous; return unlock; }
  async function query(sql: string, values: any[] = []) { const r = await db.query(sql, values); return { rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0 }; }
  return {
    query: async (sql: string, values: any[] = []) => { const unlock = await lock(); try { return await query(sql, values); } finally { unlock(); } },
    connect: async () => { const unlock = await lock(); return { query, release: unlock }; },
  };
}
async function listen(app: express.Express) {
  const server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  return { server, url: `http://127.0.0.1:${(server.address() as any).port}` };
}
before(async () => {
  controlDb = new PGlite({ extensions: { pgcrypto } }); appsDb = new PGlite();
  await Promise.all([controlDb.waitReady, appsDb.waitReady]);
  await controlDb.exec(await readFile(new URL('../supabase/control/migrations/202610130001_control.sql', import.meta.url), 'utf8'));
  await controlDb.exec(await readFile(new URL('../supabase/control/migrations/202610130003_identity.sql', import.meta.url), 'utf8'));
  await appsDb.exec('create role anon; create role authenticated;');
  await appsDb.exec(await readFile(new URL('../supabase/apps/migrations/202610130001_apps.sql', import.meta.url), 'utf8'));
  await appsDb.exec(await readFile(new URL('../supabase/apps/migrations/202610130002_mutation_receipts.sql', import.meta.url), 'utf8'));
  const identity = express(); identity.use(express.json());
  identity.post(['/sign-in/email', '/sign-up/email'], (req, res) => {
    providerWrites++;
    if (req.body.password !== password) { res.status(401).json({ error: 'fixture credentials rejected' }); return; }
    const user = { id: 'opaque-fixture-subject:' + req.body.email, email: req.body.email, emailVerified: true };
    const token = NEON_SESSION_COOKIE + '=' + randomUUID(); upstreamSessions.set(token, user);
    res.setHeader('Set-Cookie', token + '; HttpOnly; Secure; Path=/; SameSite=Lax'); res.json({ user });
  });
  identity.get('/get-session', (req, res) => {
    providerReads++; const user = upstreamSessions.get(req.get('cookie') || '');
    if (!user) { res.status(401).json({ error: 'fixture revoked session' }); return; }
    res.json({ user, session: { userId: user.id, expiresAt: new Date(Date.now() + 3_600_000).toISOString() } });
  });
  identity.post('/sign-out', (req, res) => { providerWrites++; upstreamSessions.delete(req.get('cookie') || ''); res.json({ ok: true }); });
  const auth = await listen(identity); identityServer = auth.server; identityBase = auth.url;
  ctx = { control: pool(controlDb), apps: pool(appsDb), config: {
    backendProvider: 'neon', appsAuthUrl: identityBase, controlAuthUrl: identityBase,
    platformOrigin: 'http://localhost:3000', runtimeOrigin: 'http://127.0.0.1:4000', production: false,
    encryptionKey: 'runtime-database-test-encryption-key', runtimeSigningKey: 'runtime-database-test-preview-key',
    neonStorageEndpoint: 'https://s3-fixture.invalid', neonStorageAccessKeyId: 'fixture-id', neonStorageSecretAccessKey: 'fixture-secret', neonStorageBucket: 'fixture-private-bucket',
  } } as unknown as CoreContext;
  await ctx.control.query('insert into platform_users(id,email) values($1,$2)', [owner, 'creator@example.invalid']);
  // Replace just the AWS wire transport. Production ObjectStore still checks every size/SHA.
  S3Client.prototype.send = (async function(command: any) {
    const key = command.input.Key;
    if (command instanceof PutObjectCommand) { storagePuts++; if (storagePutFails) throw new Error('fixture S3 write failure'); const gate = blockedUpload; blockedUpload = undefined; if (gate) { gate.started(); await gate.wait; } objects.set(key, Buffer.from(command.input.Body as Buffer)); return {}; }
    if (command instanceof GetObjectCommand) { storageGets++; const bytes = objects.get(key); if (!bytes) throw new Error('fixture object absent'); return { ContentLength: bytes.length, Body: Readable.from([bytes.subarray(0, 2), bytes.subarray(2)]) }; }
    if (command instanceof DeleteObjectCommand) { storageDeletes++; objects.delete(key); return {}; }
    throw new Error('Unexpected S3 command in runtime database test');
  }) as any;
  const app = express(); app.use(express.json({ limit: '8mb' })); app.use(cookieParser()); app.use(createRuntimeRouter(ctx));
  app.use(((error: any, _req: any, res: any, _next: any) => res.status(error instanceof HttpError ? error.status : 500).json({ error: { code: error.code || 'INTERNAL', message: error.message } })) as express.ErrorRequestHandler);
  const runtime = await listen(app); runtimeServer = runtime.server; base = runtime.url;
});
after(async () => {
  S3Client.prototype.send = originalSend;
  for (const server of [runtimeServer, identityServer]) if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  for (const db of [controlDb, appsDb]) if (db) await db.close();
});
interface AppFixture { id: string; version: string }
interface Login { cookie: string; csrf: string; userId: string }
async function application(capabilities: CapabilityManifest = manifest, published = true): Promise<AppFixture> {
  const id = randomUUID(), version = randomUUID();
  await ctx.control.query('insert into projects(id,owner_id,title) values($1,$2,$3)', [id, owner, 'Runtime SQL fixture']);
  const canonical = validateManifest(capabilities);
  await ctx.control.query("insert into app_versions(id,project_id,prompt,html,manifest,content_hash) values($1,$2,'fixture',$3,$4,$5)", [version, id, html, JSON.stringify(canonical), artifactHash(html, canonical)]);
  if (published) await ctx.control.query('update projects set published_version_id=$2 where id=$1', [id, version]);
  return { id, version };
}
async function publishedVersion(app: AppFixture, capabilities: CapabilityManifest, contentHash?: string): Promise<AppFixture> {
  const canonical = validateManifest(capabilities), version = randomUUID();
  await ctx.control.query("insert into app_versions(id,project_id,prompt,html,manifest,content_hash) values($1,$2,'fixture',$3,$4,$5)", [version, app.id, html, JSON.stringify(canonical), contentHash ?? artifactHash(html, canonical)]);
  await ctx.control.query('update projects set published_version_id=$2 where id=$1', [app.id, version]);
  return { id: app.id, version };
}
async function api(app: AppFixture, path: string, options: { method?: string; body?: any; login?: Login; cookie?: string; csrf?: string; origin?: string; version?: string; preview?: string; key?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: options.origin || ctx.config.runtimeOrigin, 'X-App-Version': options.version || app.version };
  if (options.login || options.cookie) headers.Cookie = options.cookie || options.login!.cookie;
  if (options.login || options.csrf) headers['X-CSRF-Token'] = options.csrf ?? options.login!.csrf;
  if (options.preview) headers['X-Preview-Token'] = options.preview;
  if (options.method === 'POST' && (path.startsWith('/records/') || path === '/files')) headers['Idempotency-Key'] = options.key ?? randomUUID();
  const response = await nativeFetch(base + `/apps/${app.id}/api${path}`, { method: options.method || 'GET', headers, signal: AbortSignal.timeout(10_000), ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
  return { status: response.status, body: await response.json() as any, headers: response.headers };
}
async function login(app: AppFixture, email = 'alice@example.invalid'): Promise<Login> {
  const r = await api(app, '/auth/login', { method: 'POST', body: { email, password } }); assert.equal(r.status, 200);
  const cookies = r.headers.getSetCookie(); assert.equal(cookies.length, 1); assert.match(cookies[0], /HttpOnly/i); assert.match(cookies[0], /SameSite=Lax/i); assert.match(cookies[0], new RegExp('Path=/apps/' + app.id));
  assert.doesNotMatch(cookies[0], /neon-auth/); assert.ok(r.body.csrf_token);
  return { cookie: cookies[0].split(';', 1)[0], csrf: r.body.csrf_token, userId: r.body.user.id };
}
async function createRecord(app: AppFixture, account: Login, text = 'private task') {
  const r = await api(app, '/records/tasks', { method: 'POST', login: account, body: { data: { text } } }); assert.equal(r.status, 201); return r.body.record;
}
async function upload(app: AppFixture, account: Login, bytes = Buffer.from('private fixture file'), key?: string) {
  return api(app, '/files', { method: 'POST', login: account, key, body: { name: 'fixture.txt', mime_type: 'text/plain', base64: bytes.toString('base64') } });
}

test('real SQL and HTTP isolate records between two users and apps despite manipulated IDs', async () => {
  const a = await application(), b = await application();
  const aliceA = await login(a), bobA = await login(a, 'bob@example.invalid'), aliceB = await login(b);
  const own = await createRecord(a, aliceA), otherUser = await createRecord(a, bobA, 'Bob secret'), otherApp = await createRecord(b, aliceB, 'App B secret');
  assert.deepEqual((await api(a, '/records/tasks', { login: aliceA })).body.records.map((r: any) => r.id), [own.id]);
  for (const record of [otherUser, otherApp]) for (const method of ['GET', 'PATCH', 'DELETE']) {
    const denied = await api(a, '/records/tasks/' + record.id, { method, login: aliceA, ...(method === 'PATCH' ? { body: { data: { text: 'forged' }, user_id: bobA.userId, app_id: b.id } } : {}) });
    assert.equal(denied.status, 404, method + ' must not reveal another scope');
  }
  const forged = await api(a, '/records/tasks', { method: 'POST', login: aliceA, body: { user_id: bobA.userId, app_id: b.id, data: { text: 'forged metadata' } } });
  assert.equal(forged.status, 201);
  const stored = (await ctx.apps.query('select app_id,user_id from app_records where id=$1', [forged.body.record.id])).rows[0]; assert.deepEqual(stored, { app_id: a.id, user_id: aliceA.userId });
  assert.equal((await api(a, '/records/tasks/' + own.id, { login: aliceA, version: b.version })).status, 404);
  const stolenCookie = appCookieName(b.id) + '=' + aliceA.cookie.split('=')[1];
  assert.equal((await api(b, '/records/tasks', { cookie: stolenCookie })).status, 401);
  assert.equal((await api(a, '/records/tasks/' + own.id, { login: bobA })).status, 404);
});

test('manifest gates deny absent collections, files, connectors and all data when auth is false', async () => {
  const restricted = await application({ ...manifest, files: false, records: { collections: ['tasks'] } }); const account = await login(restricted);
  for (const [path, method, body] of [['/records/notes', 'GET', undefined], ['/files', 'GET', undefined], ['/files', 'POST', { name: 'x', mime_type: 'text/plain', base64: 'eA==' }], ['/connectors', 'POST', { name: 'github.repository' }]] as const) {
    assert.equal((await api(restricted, path, { method, body, login: account })).status, 403);
  }
  // Keep a valid existing app session while publishing a version that removes auth.
  const enabled = await application(), previouslySignedIn = await login(enabled);
  const disabled = await publishedVersion(enabled, { ...manifest, auth: false });
  const copiedCookie = previouslySignedIn.cookie;
  const reads = providerReads, writes = providerWrites;
  const state = await api(disabled, '/session', { cookie: copiedCookie });
  assert.equal(state.headers.get('Cache-Control'), 'no-store');
  assert.equal(state.status, 200); assert.deepEqual(state.body, { user: null, csrf_token: null });
  for (const [path, method, body] of [['/records/tasks', 'GET', undefined], ['/files', 'GET', undefined], ['/auth/login', 'POST', { email: 'alice@example.invalid', password }], ['/connectors', 'POST', { name: 'github.repository' }]] as const) {
    const denied = await api(disabled, path, { method, body, cookie: copiedCookie, csrf: account.csrf }); assert.equal(denied.status, 403); assert.equal(denied.body.error.code, 'CAPABILITY_DENIED');
  }
  assert.equal(providerReads, reads); assert.equal(providerWrites, writes);
});

test('stored artifact hash is enforced before any identity, object access or instance registration', async () => {
  const initial = await application(); const invalid = await publishedVersion(initial, manifest, 'incorrect-fixture-hash');
  const reads = providerReads, gets = storageGets;
  const denied = await api(invalid, '/session'); assert.equal(denied.status, 503); assert.equal(denied.body.error.code, 'ARTIFACT_INTEGRITY');
  const artifact = await nativeFetch(`${base}/apps/${invalid.id}/versions/${invalid.version}/artifact`); assert.equal(artifact.status, 503); assert.equal((await artifact.json() as any).error.code, 'ARTIFACT_INTEGRITY');
  assert.equal((await ctx.apps.query('select * from app_instances where id=$1', [invalid.id])).rowCount, 0);
  assert.equal(providerReads, reads); assert.equal(storageGets, gets);
});

test('private previews require signed app/version/owner claims before registering an app instance', async () => {
  const app = await application(manifest, false), foreign = await application(manifest, false);
  assert.equal((await api(app, '/session')).status, 403);
  assert.equal((await ctx.apps.query('select * from app_instances where id=$1', [app.id])).rowCount, 0);
  const grant = signPreviewToken(ctx, app.id, app.version, owner);
  assert.equal((await api(app, '/session', { preview: grant })).status, 200);
  assert.equal((await api(foreign, '/session', { preview: grant })).status, 403);
  const wrongOwner = signPreviewToken(ctx, app.id, app.version, randomUUID());
  assert.equal((await api(app, '/session', { preview: wrongOwner })).status, 403);
});

test('provider revocation, changed identity and local expiry fail closed for existing sessions', async () => {
  const app = await application(), account = await login(app); await createRecord(app, account);
  const row = (await ctx.apps.query('select * from app_sessions where app_id=$1 and user_id=$2', [app.id, account.userId])).rows[0];
  const upstream = decryptSecret(row.auth_token_ciphertext, ctx.config.encryptionKey);
  const visibleSession = await api(app, '/session', { login: account }); assert.equal(visibleSession.headers.get('Cache-Control'), 'no-store');
  assert.notEqual(row.auth_token_ciphertext, upstream); assert.doesNotMatch(JSON.stringify(visibleSession.body), /opaque-fixture|neon-auth|auth_token/);
  const user = upstreamSessions.get(upstream)!;
  upstreamSessions.set(upstream, { ...user, id: 'different-fixture-subject' });
  assert.equal((await api(app, '/records/tasks', { login: account })).status, 401);
  upstreamSessions.delete(upstream);
  for (const path of ['/session', '/records/tasks', '/files']) assert.equal((await api(app, path, { login: account })).status, 401);
  const fresh = await login(app); await ctx.apps.query("update app_sessions set expires_at=now()-interval '1 second' where app_id=$1", [app.id]);
  const reads = providerReads;
  assert.equal((await api(app, '/records/tasks', { login: fresh })).status, 401);
  assert.deepEqual((await api(app, '/session', { login: fresh })).body, { user: null, csrf_token: null }); assert.equal(providerReads, reads);
});

test('origin and CSRF guards precede mutations and logout destroys the local session', async () => {
  const app = await application(), account = await login(app); const count = providerReads;
  assert.equal((await api(app, '/records/tasks', { method: 'POST', login: account, csrf: 'wrong', body: { data: { x: 1 } } })).status, 403);
  assert.equal((await api(app, '/records/tasks', { method: 'POST', login: account, origin: ctx.config.platformOrigin, body: { data: { x: 1 } } })).status, 403);
  assert.equal(providerReads, count); assert.equal((await ctx.apps.query('select * from app_records where app_id=$1', [app.id])).rowCount, 0);
  const logout = await api(app, '/auth/logout', { method: 'POST', login: account, body: {} }); assert.equal(logout.status, 200);
  assert.match(logout.headers.getSetCookie()[0], /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await ctx.apps.query('select * from app_sessions where app_id=$1', [app.id])).rowCount, 0);
  assert.equal((await api(app, '/records/tasks', { login: account })).status, 401);
});

test('private file paths and SQL membership hide another user/app before touching storage', async () => {
  const a = await application(), b = await application(); const aliceA = await login(a), bobA = await login(a, 'bob@example.invalid'), aliceB = await login(b);
  const bytes = Buffer.from('binary fixture\u0000private'); const saved = await upload(a, aliceA, bytes); assert.equal(saved.status, 201);
  assert.equal(saved.body.file.sha256, sha(bytes)); assert.equal(saved.body.file.size_bytes, bytes.length);
  const metadata = (await ctx.apps.query('select * from app_files where id=$1', [saved.body.file.id])).rows[0];
  assert.equal(metadata.object_path, `${a.id}/${aliceA.userId}/${saved.body.file.id}`);
  assert.deepEqual((await api(a, '/files', { login: bobA })).body.files, []);
  const beforeGets = storageGets;
  assert.equal((await api(a, '/files/' + saved.body.file.id, { login: bobA })).status, 404);
  assert.equal((await api(b, '/files/' + saved.body.file.id, { login: aliceB })).status, 404);
  assert.equal(storageGets, beforeGets);
  const download = await api(a, '/files/' + saved.body.file.id, { login: aliceA }); assert.equal(download.status, 200); assert.equal(download.body.file.base64, bytes.toString('base64'));
  assert.equal((await api(a, '/files/not-a-uuid', { login: aliceA })).status, 400);
});

test('production ObjectStore rejects changed hash, truncated object and oversized object', async () => {
  const app = await application(), account = await login(app), original = Buffer.from('unmodified private fixture');
  const saved = await upload(app, account, original); assert.equal(saved.status, 201);
  const row = (await ctx.apps.query('select * from app_files where id=$1', [saved.body.file.id])).rows[0];
  for (const corrupted of [Buffer.alloc(original.length, 42), original.subarray(0, -1), Buffer.concat([original, Buffer.from('extra')])]) {
    objects.set(row.object_path, corrupted); const r = await api(app, '/files/' + row.id, { login: account }); assert.equal(r.status, 503); assert.equal(r.body.error.code, 'STORAGE_INTEGRITY'); assert.equal(r.body.file, undefined);
  }
  objects.set(row.object_path, original); assert.equal((await api(app, '/files/' + row.id, { login: account })).status, 200);
});

test('file limits and app-wide quota reject data before S3 and release SQL connection on rollback', async () => {
  const app = await application(), account = await login(app); const initialPuts = storagePuts, initialDeletes = storageDeletes;
  assert.equal((await upload(app, account, Buffer.alloc(0))).status, 400);
  assert.equal((await upload(app, account, Buffer.alloc(5_242_881))).status, 400);
  assert.equal((await api(app, '/files', { method: 'POST', login: account, body: { name: 'bad encoding', mime_type: 'text/plain', base64: 'AAAAA' } })).status, 400);
  assert.equal(storagePuts, initialPuts);
  // Five legal metadata rows fill the app quota, with no 25 MiB network fixture needed.
  for (let i = 0; i < 5; i++) {
    const id = randomUUID(); await ctx.apps.query('insert into app_files(id,app_id,user_id,name,mime_type,size_bytes,object_path,sha256) values($1,$2,$3,$4,$5,5242880,$6,$7)', [id, app.id, account.userId, 'quota-fixture', 'application/octet-stream', `${app.id}/${account.userId}/${id}`, sha('metadata-only quota fixture')]);
  }
  const denied = await upload(app, account, Buffer.from('over quota')); assert.equal(denied.status, 409); assert.equal(denied.body.error.code, 'FILE_QUOTA'); assert.equal(storagePuts, initialPuts);
  assert.equal(storageDeletes, initialDeletes);
  assert.equal((await api(app, '/files', { login: account })).body.files.length, 5);
});

test('failed S3 writes leave no metadata and cleanup runs without holding a second pool connection', async () => {
  const app = await application(), account = await login(app), deletions = storageDeletes;
  storagePutFails = true;
  try { const denied = await upload(app, account); assert.equal(denied.status, 503); assert.equal(denied.body.error.code, 'STORAGE_UNAVAILABLE'); }
  finally { storagePutFails = false; }
  assert.equal((await ctx.apps.query('select * from app_files where app_id=$1', [app.id])).rowCount, 0); assert.equal(storageDeletes, deletions + 1);
  assert.equal((await upload(app, account)).status, 201);
});

test('record object/byte limits and app-wide quota remain enforced by the gateway and SQL', async () => {
  const app = await application(), account = await login(app);
  for (const data of [[], 'string', null, { text: 'x'.repeat(65536) }]) assert.equal((await api(app, '/records/tasks', { method: 'POST', login: account, body: { data } })).status, 400);
  // Compact JSON fits the client limit, but PG jsonb adds a space after the colon.
  const boundary = { text: 'x'.repeat(65525) }; assert.equal(Buffer.byteLength(JSON.stringify(boundary)), 65536);
  assert.equal((await api(app, '/records/tasks', { method: 'POST', login: account, body: { data: boundary } })).status, 400);
  await ctx.apps.query("insert into app_records(app_id,user_id,collection,data) select $1,$2,'tasks','{}'::jsonb from generate_series(1,1000)", [app.id, account.userId]);
  const denied = await api(app, '/records/tasks', { method: 'POST', login: account, body: { data: { x: 1 } } }); assert.equal(denied.status, 409); assert.equal(denied.body.error.code, 'RECORD_QUOTA');
  assert.equal((await ctx.apps.query('select count(*)::int as count from app_records where app_id=$1', [app.id])).rows[0].count, 1000);
  await assert.rejects(ctx.apps.query('insert into app_records(app_id,user_id,collection,data) values($1,$2,$3,$4)', [app.id, account.userId, 'tasks', JSON.stringify({ text: 'x'.repeat(65536) })]), e => (e as any).code === '23514');
});

test('concurrent record retries return one durable response and reject reused key with changed payload', async () => {
  const app = await application(), account = await login(app), key = randomUUID();
  const options = { method: 'POST', login: account, key, body: { data: { title: 'once', done: false } } };
  const results = await Promise.all([api(app, '/records/tasks', options), api(app, '/records/tasks', options)]);
  assert.deepEqual(results.map(r => r.status), [201, 201]); assert.deepEqual(results[0].body, results[1].body);
  const again = await api(app, '/records/tasks', { ...options, body: { data: { done: false, title: 'once' } } }); assert.equal(again.status, 201); assert.deepEqual(again.body, results[0].body);
  const conflict = await api(app, '/records/tasks', { ...options, body: { data: { title: 'changed' } } }); assert.equal(conflict.status, 409); assert.equal(conflict.body.error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal((await api(app, '/records/notes', options)).status, 409);
  assert.equal((await ctx.apps.query('select * from app_records where app_id=$1', [app.id])).rowCount, 1);
  const receipts = (await ctx.apps.query('select * from app_mutation_receipts where app_id=$1', [app.id])).rows; assert.equal(receipts.length, 1); assert.equal(receipts[0].request_hash.length, 64);
  const newer = await publishedVersion(app, manifest); assert.equal((await api(newer, '/records/tasks', options)).status, 409);
  const missing = await api(newer, '/records/tasks', { ...options, key: '' }); assert.equal(missing.status, 400); assert.equal(missing.body.error.code, 'IDEMPOTENCY_REQUIRED');
});

test('idempotency keys remain scoped to app and user; a receipt survives consumed record quota', async () => {
  const a = await application(), b = await application(), aliceA = await login(a), bobA = await login(a, 'bob@example.invalid'), aliceB = await login(b), key = randomUUID();
  const request = { method: 'POST', key, body: { data: { text: 'scope fixture' } } };
  const own = await api(a, '/records/tasks', { ...request, login: aliceA }); const otherUser = await api(a, '/records/tasks', { ...request, login: bobA }); const otherApp = await api(b, '/records/tasks', { ...request, login: aliceB });
  assert.equal(own.status, 201); assert.equal(otherUser.status, 201); assert.equal(otherApp.status, 201); assert.notEqual(own.body.record.id, otherUser.body.record.id); assert.notEqual(own.body.record.id, otherApp.body.record.id);
  await ctx.apps.query("insert into app_records(app_id,user_id,collection,data) select $1,$2,'tasks','{}'::jsonb from generate_series(1,998)", [a.id, aliceA.userId]);
  const repeated = await api(a, '/records/tasks', { ...request, login: aliceA }); assert.equal(repeated.status, 201); assert.deepEqual(repeated.body, own.body);
  assert.equal((await ctx.apps.query('select count(*)::int as count from app_records where app_id=$1', [a.id])).rows[0].count, 1000);
});

test('concurrent upload retry and payload conflict do not write a second object or metadata', async () => {
  const app = await application(), account = await login(app), key = randomUUID(), bytes = Buffer.from('upload once'); const puts = storagePuts;
  const results = await Promise.all([upload(app, account, bytes, key), upload(app, account, bytes, key)]);
  assert.deepEqual(results.map(r => r.status), [201, 201]); assert.deepEqual(results[0].body, results[1].body); assert.equal(storagePuts, puts + 1);
  const conflict = await upload(app, account, Buffer.from('upload changed'), key); assert.equal(conflict.status, 409); assert.equal(conflict.body.error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(storagePuts, puts + 1); assert.equal((await ctx.apps.query('select * from app_files where app_id=$1', [app.id])).rowCount, 1);
  assert.equal((await ctx.apps.query('select * from app_mutation_receipts where app_id=$1', [app.id])).rowCount, 1);
});

test('an HTTP client aborted before upload commit can safely retry the same durable key', async () => {
  const app = await application(), account = await login(app), key = randomUUID(), puts = storagePuts;
  let start!: () => void, release!: () => void; const started = new Promise<void>(resolve => { start = resolve; }), wait = new Promise<void>(resolve => { release = resolve; });
  blockedUpload = { started: start, wait };
  const abort = new AbortController();
  const payload = { name: 'fixture.txt', mime_type: 'text/plain', base64: Buffer.from('private fixture file').toString('base64') };
  const lost = nativeFetch(`${base}/apps/${app.id}/api/files`, { method: 'POST', signal: abort.signal, headers: { 'Content-Type': 'application/json', Origin: ctx.config.runtimeOrigin, Cookie: account.cookie, 'X-CSRF-Token': account.csrf, 'X-App-Version': app.version, 'Idempotency-Key': key }, body: JSON.stringify(payload) });
  const lostResult = lost.then(() => 'unexpected response', () => 'client aborted');
  try { await started; abort.abort(); release(); assert.equal(await lostResult, 'client aborted'); }
  finally { release(); blockedUpload = undefined; }
  const retried = await upload(app, account, Buffer.from('private fixture file'), key); assert.equal(retried.status, 201);
  assert.equal(storagePuts, puts + 1); assert.equal((await ctx.apps.query('select * from app_files where app_id=$1', [app.id])).rowCount, 1);
  assert.equal((await ctx.apps.query('select * from app_mutation_receipts where app_id=$1', [app.id])).rowCount, 1);
});

test('browser SQL roles have no grants; RLS still denies reads/writes after accidental grants', async () => {
  const tables = ['app_instances', 'app_users', 'app_memberships', 'app_records', 'app_files', 'app_sessions', 'app_mutation_receipts'];
  for (const role of ['anon', 'authenticated']) {
    await ctx.apps.query('set role ' + role);
    try { for (const table of tables) await assert.rejects(ctx.apps.query('select * from ' + table), e => (e as any).code === '42501'); }
    finally { await ctx.apps.query('reset role'); }
  }
  await ctx.apps.query('create role runtime_browser_fixture');
  await ctx.apps.query('grant usage on schema public to runtime_browser_fixture');
  await ctx.apps.query('grant select,insert on app_records to runtime_browser_fixture');
  const row = (await ctx.apps.query('select app_id,user_id from app_records limit 1')).rows[0]; assert.ok(row);
  await ctx.apps.query('set role runtime_browser_fixture');
  try {
    assert.equal((await ctx.apps.query('select * from app_records')).rowCount, 0);
    await assert.rejects(ctx.apps.query("insert into app_records(app_id,user_id,collection,data) values($1,$2,'tasks','{}')", [row.app_id, row.user_id]), e => (e as any).code === '42501');
  } finally { await ctx.apps.query('reset role'); }
  assert.equal((await ctx.apps.query("select count(*)::int as count from pg_policies where schemaname='public'")).rows[0].count, 0);
});

test('apps-plane SQL has neither creator sessions nor provider grants', async () => {
  const result = await ctx.apps.query("select to_regclass('public.platform_sessions') as sessions,to_regclass('public.provider_connections') as grants");
  assert.deepEqual(result.rows[0], { sessions: null, grants: null });
  const control = await ctx.control.query("select to_regclass('public.app_users') as end_users,to_regclass('public.app_sessions') as end_sessions");
  assert.deepEqual(control.rows[0], { end_users: null, end_sessions: null });
});

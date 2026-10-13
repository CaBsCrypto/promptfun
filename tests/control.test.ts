import test from 'node:test';
import assert from 'node:assert/strict';
import type { CoreContext } from '../server/shared.js';
import { authenticate, assertCsrf } from '../server/control/auth.js';
import { publicProject, publicVersion } from '../server/control/db.js';
import { artifactHash, decryptSecret, encryptSecret, hash, nonce, validateManifest } from '../server/control/security.js';
import { sanitizeLegacyItems } from '../server/control/projects.js';
import { isAllowedFreeModel, preflight } from '../server/control/providers.js';
import { buildModelMessages, normalizeUsage, parseGeneration, recoverExpiredJobs, runOneJob } from '../server/control/worker.js';

const config: CoreContext['config'] = {
  controlDatabaseUrl: '', appsDatabaseUrl: '', controlSupabaseUrl: 'http://127.0.0.1:54321', controlPublishableKey: 'test',
  appsSupabaseUrl: '', appsPublishableKey: '', appsSecretKey: '', platformOrigin: 'http://localhost:3000', runtimeOrigin: 'http://127.0.0.1:4000',
  encryptionKey: 'test-encryption-key-not-a-provider-credential', runtimeSigningKey: 'test-runtime-signing-key',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1', solanaRpcUrl: '', marketProgramId: '', registrarKeyPath: '', production: false,
};
const manifest = { version: 1 as const, records: { collections: ['tasks'] }, auth: true, files: true, connectors: [] };

test('session lookup uses only a cookie hash and requires an unexpired server record', async () => {
  const token = nonce(),id='650e8400-e29b-41d4-a716-446655440000'; let lookedUp: unknown;
  const query=async(sql:string,args:any[]=[])=> {
    if(sql.includes('from platform_sessions s')) {lookedUp=args[0];return {rows:[{id,email:'test@example.invalid',auth_provider:'supabase',auth_subject:id,auth_token_ciphertext:encryptSecret('fixture-auth-token',config.encryptionKey),csrf_token:'csrf',session_id:'session'}]};}
    return {rows:sql.includes('returning id')?[{id:'session'}]:[]};
  };
  const ctx = {config,control:{query,connect:async()=>({query,release:()=>{}})}} as unknown as CoreContext;
  const originalFetch=globalThis.fetch;globalThis.fetch=(async()=>Response.json({id,email:'test@example.invalid',email_confirmed_at:'2026-10-13T00:00:00Z'})) as any;
  try {
    const user = await authenticate(ctx, { headers: { cookie: `pf_session=${token}` } } as any);
    assert.equal(user.id,id);assert.equal(lookedUp,hash(token));assert.notEqual(lookedUp,token);assert.deepEqual(Object.keys(user).sort(),['csrf_token','email','id','session_id','wallet_address']);
    ctx.control.query=(async()=>({rows:[]})) as any;
    await assert.rejects(authenticate(ctx,{headers:{cookie:`pf_session=${token}`}} as any),/sesión venció/i);
  } finally {globalThis.fetch=originalFetch;}
});
test('mutation rejects a correct CSRF token from a different origin', () => {
  const user = { id: 'user', email: 'test@example.invalid', session_id: 'session', csrf_token: 'valid-token' };
  const req = { get: (name: string) => name === 'origin' ? 'http://127.0.0.1:4000' : 'valid-token' } as any;
  assert.throws(() => assertCsrf({ config } as CoreContext, req, user), /Origen/);
  req.get = (name: string) => name === 'origin' ? config.platformOrigin : 'invalid';
  assert.throws(() => assertCsrf({ config } as CoreContext, req, user), /sesión inválida/);
});
test('encrypted provider grants authenticate ciphertext and never contain plaintext', () => {
  const original = 'test-only-provider-token-0123456789'; const encrypted = encryptSecret(original, config.encryptionKey);
  assert.equal(decryptSecret(encrypted, config.encryptionKey), original); assert.ok(!encrypted.includes(original));
  assert.throws(() => decryptSecret(encrypted, 'another-key'));
  const parts = encrypted.split('.'); parts[3] = Buffer.from('changed payload').toString('base64url');
  assert.throws(() => decryptSecret(parts.join('.'), config.encryptionKey));
});
test('legacy import drops fabricated finance/ownership and rejects embedded credentials', () => {
  const original = { legacy_id: 'legacy-1', title: 'Tareas', prompt: 'Crear tareas', html: '<html><body>Tasks</body></html>', owner_id: 'attacker', solBalance: 99, trades: [{ signature: 'fake' }], openRouterApiKey: 'not-copied' };
  const [safe] = sanitizeLegacyItems({ items: [original] });
  assert.equal((safe as any).owner_id, undefined); assert.equal((safe as any).trades, undefined); assert.equal((safe as any).openRouterApiKey, undefined);
  assert.throws(() => sanitizeLegacyItems({ items: [{ ...original, html: '<html><body>sk-or-v1-01234567890123456789</body></html>' }] }), /credencial/);
  assert.throws(() => sanitizeLegacyItems({ items: [original, original] }), /duplicadas/);
});
test('public project/version DTOs omit ownership, prompt and executable source', () => {
  const project = publicProject({ id: 'project', owner_id: 'private-owner', secret: 'secret', title: 'public', description: '', published_version_id: 'version' });
  const version = publicVersion({ id: 'version', project_id: 'project', prompt: 'private prompt', html: '<html>private source</html>', manifest, content_hash: 'hash', changelog: [] });
  assert.equal((project as any).owner_id, undefined); assert.equal((project as any).secret, undefined);
  assert.equal((version as any).prompt, undefined); assert.equal((version as any).html, undefined);
});
test('free catalog refuses paid, unknown price, routers and arbitrary backend capabilities', () => {
  const free = { id: 'example/code:free', context_length: 32768, pricing: { prompt: '0', completion: '0.000000' } };
  assert.equal(isAllowedFreeModel(free), true);
  assert.equal(isAllowedFreeModel({ ...free, pricing: { prompt: '0', completion: '0.01' } }), false);
  assert.equal(isAllowedFreeModel({ ...free, pricing: { prompt: '0' } }), false);
  assert.equal(isAllowedFreeModel({ ...free, id: 'openrouter/free' }), false);
  assert.throws(() => validateManifest({ ...manifest, records: { collections: ['platform_sessions'] } }));
  assert.throws(() => validateManifest({ ...manifest, sql: 'select * from users' }));
});
test('model response must be real validated HTML and manifest, and iteration receives full base', () => {
  const html = '<html><body><h1>Existing tasks</h1></body></html>';
  const messages = buildModelMessages({ prompt: 'Añadir archivos' }, { html, manifest });
  const user = JSON.parse(messages[1].content); assert.equal(user.currentHtml, html); assert.deepEqual(user.currentManifest, manifest);
  assert.match(messages[0].content, /list\(collection\)->\{records:/); assert.match(messages[0].content, /signup\/login\/logout live in trusted/);
  assert.throws(() => parseGeneration({ choices: [{ message: { content: 'The generation failed.' } }] }), /formato inválido/);
  const parsed = parseGeneration({ choices: [{ message: { content: JSON.stringify({ html, manifest, changelog: ['Archivos añadidos'] }) } }] });
  assert.equal(parsed.content_hash, artifactHash(html, validateManifest(manifest)));
});
test('usage unknown stays null while zero cost still preserves tokens/cache categories', () => {
  assert.deepEqual(normalizeUsage(undefined), { prompt_tokens: null, completion_tokens: null, cost_usd: null, raw: {} });
  const usage = normalizeUsage({ prompt_tokens: 42, completion_tokens: 7, prompt_tokens_details: { cached_tokens: 30 }, cost: 0, api_key: 'secret' });
  assert.equal(usage.prompt_tokens, 42); assert.equal(usage.completion_tokens, 7); assert.equal(usage.cost_usd, '0.000000000000');
  assert.equal((usage.raw as any).api_key, undefined); assert.deepEqual(usage.raw.prompt_tokens_details, { cached_tokens: 30 });
});
test('preflight blocks a retired/paid model before checking quota or making inference', async () => {
  const key = 'test-only-grant'; const connection = { id: 'connection', secret_ciphertext: encryptSecret(key, config.encryptionKey) };
  const ctx = { config, control: { query: async () => ({ rows: [connection] }) } } as unknown as CoreContext;
  const originalFetch = globalThis.fetch; const calls: string[] = [];
  globalThis.fetch = (async (url: any) => { calls.push(String(url)); return new Response(JSON.stringify({ data: [{ id: 'example/code:free', context_length: 32768, pricing: { prompt: '0', completion: '0.01' } }] }), { status: 200 }); }) as any;
  try { await assert.rejects(preflight(ctx, 'user', 'example/code:free'), /precio cero/); assert.deepEqual(calls, ['https://openrouter.ai/api/v1/models']); }
  finally { globalThis.fetch = originalFetch; }
});

function durableHarness(initial: 'queued' | 'running' = 'queued', attemptState?: string) {
  const job: any = { id: 'job', project_id: 'project', actor_id: 'user', connection_id: 'connection', model: 'example/code:free', prompt: 'Gestor de tareas', base_version_id: null,
    status: initial, quota_day: new Date().toISOString().slice(0, 10), lease_owner: initial === 'running' ? 'lost-worker' : null };
  let attempt = attemptState; let expired = initial === 'running'; let attemptsCreated = 0;
  const query = async (raw: string, args: any[] = []) => {
    const sql = raw.replace(/\s+/g, ' ').trim();
    if (['begin', 'commit', 'rollback'].includes(sql)) return { rows: [], rowCount: 0 };
    if (sql.startsWith("select * from generation_jobs where status='queued'")) return { rows: job.status === 'queued' ? [{ ...job }] : [] };
    if (sql.startsWith("update generation_jobs set status='running'")) { job.status = 'running'; job.lease_owner = args[1]; expired = false; return { rows: [], rowCount: 1 }; }
    if (sql.startsWith('insert into generation_attempts')) { if (!attempt) { attempt = 'prepared'; attemptsCreated++; } return { rows: [] }; }
    if (sql.startsWith('select j.*,a.state')) return { rows: [{ ...job, state: attempt }] };
    if (sql.startsWith('select id from provider_connections')) return { rows: [{ id: 'connection' }] };
    if (sql.startsWith('update free_quota_days')) return { rows: [], rowCount: 1 };
    if (sql.startsWith('insert into usage_receipts')) return { rows: [], rowCount: 1 };
    if (sql.startsWith("update generation_attempts set state='submitted'")) { attempt = 'submitted'; return { rows: [], rowCount: 1 }; }
    if (sql.startsWith("update generation_attempts set state='uncertain'")) { if (attempt === 'submitted') attempt = 'uncertain'; return { rows: [] }; }
    if (sql.startsWith("update generation_jobs set status='uncertain'")) { job.status = 'uncertain'; job.lease_owner = null; return { rows: [], rowCount: 1 }; }
    if (sql.startsWith('select j.id,a.state')) return { rows: expired && ['running', 'validating'].includes(job.status) ? [{ id: job.id, state: attempt }] : [] };
    if (sql.startsWith("update generation_jobs set status='queued'")) { job.status = 'queued'; job.lease_owner = null; return { rows: [] }; }
    throw new Error(`Unsupported test persistence operation: ${sql.slice(0, 90)}`);
  };
  const pool = { query, connect: async () => ({ query, release: () => {} }) };
  return { ctx: { config, control: pool, apps: pool } as unknown as CoreContext, job, getAttempt: () => attempt, attemptsCreated: () => attemptsCreated };
}
test('timeout after durable submission is uncertain and does not call inference on recovery', async () => {
  const h = durableHarness(); let inferenceCalls = 0;
  const options = { check: (async () => ({ connection: { key: 'test-grant' }, model: { context_length: 32768 }, quota: { limit: 50 } })) as any,
    fetcher: (async () => { inferenceCalls++; throw new Error('Response lost after provider accepted'); }) as any };
  await runOneJob(h.ctx, 'worker-one', options);
  assert.equal(h.job.status, 'uncertain'); assert.equal(h.getAttempt(), 'uncertain'); assert.equal(inferenceCalls, 1);
  await recoverExpiredJobs(h.ctx); await runOneJob(h.ctx, 'worker-two', options);
  assert.equal(inferenceCalls, 1); assert.equal(h.attemptsCreated(), 1);
});
test('a crashed submitted lease cannot be reclaimed as a fresh provider request', async () => {
  const h = durableHarness('running', 'submitted'); await recoverExpiredJobs(h.ctx);
  assert.equal(h.job.status, 'uncertain'); let calls = 0;
  await runOneJob(h.ctx, 'another-worker', { check: (async () => { calls++; throw new Error('must not run'); }) as any });
  assert.equal(calls, 0);
});

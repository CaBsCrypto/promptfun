import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createControlRouter } from '../server/control/index.js';
import { artifactHash, encryptSecret, hash, nonce } from '../server/control/security.js';
import { recoverExpiredJobs, runOneJob } from '../server/control/worker.js';
import { HttpError, type CoreContext } from '../server/shared.js';
import { identityUserId, identitySubject, NEON_SESSION_COOKIE } from '../server/control/identity.js';

// PostgreSQL's real WASM engine executes the production migration and constraints.
// PGlite has one backend; the adapter serializes connections. This does not claim
// to verify multiple native Postgres sessions, Supabase Auth, or live inference.
let db: PGlite; let ctx: CoreContext; let server: Server; let baseUrl: string;
const nativeFetch = globalThis.fetch;
const alice = randomUUID(), bob = randomUUID(), aliceCookie = nonce(), bobCookie = nonce();
const csrf = 'database-test-csrf-token'; const manifest = { version: 1 as const, records: { collections: ['tasks'] }, auth: true, files: true, connectors: [] };
const html = '<!doctype html><html><head><title>Tareas</title></head><body>Lista de tareas</body></html>';
let tail = Promise.resolve();
async function lock() { const previous = tail; let release!: () => void; tail = new Promise<void>(resolve => { release = resolve; }); await previous; return release; }
async function query(sql: string, values: any[] = []) {
  const result = await db.query(sql, values);
  return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
}
before(async () => {
  db = new PGlite({ extensions: { pgcrypto } }); await db.waitReady;
  await db.exec('create role anon; create role authenticated;');
  await db.exec(await readFile(new URL('../supabase/control/migrations/202610130001_control.sql', import.meta.url), 'utf8'));
  const pool = {
    query: async (sql: string, values: any[] = []) => { const unlock = await lock(); try { return await query(sql, values); } finally { unlock(); } },
    connect: async () => { const unlock = await lock(); return { query, release: unlock }; },
  };
  ctx = { control: pool, apps: pool, config: {
    controlDatabaseUrl: '', appsDatabaseUrl: '', controlSupabaseUrl: 'https://auth-fixture.invalid', controlPublishableKey: 'test',
    appsSupabaseUrl: '', appsPublishableKey: '', appsSecretKey: '', platformOrigin: 'http://localhost:3000', runtimeOrigin: 'http://127.0.0.1:4000',
    encryptionKey: 'control-database-test-encryption-key', runtimeSigningKey: 'control-database-test-runtime-key',
    openRouterBaseUrl: 'https://openrouter.ai/api/v1', solanaRpcUrl: '', marketProgramId: '', registrarKeyPath: '', production: false,
  } } as unknown as CoreContext;
  await ctx.control.query('insert into platform_users(id,email) values($1,$2),($3,$4)', [alice, 'alice@example.invalid', bob, 'bob@example.invalid']);
  await db.exec(await readFile(new URL('../supabase/control/migrations/202610130003_identity.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/control/migrations/202610130004_publications.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/control/migrations/202610130005_wallet_auth.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/control/migrations/202610150006_project_drafts.sql', import.meta.url), 'utf8'));
  for (const [id, cookie] of [[alice, aliceCookie], [bob, bobCookie]]) {
    await ctx.control.query(`insert into platform_sessions(user_id,token_hash,csrf_token,auth_token_ciphertext,expires_at) values($1,$2,$3,$4,now()+interval '1 hour')`, [id, hash(cookie), csrf,encryptSecret('fixture-auth:'+id,ctx.config.encryptionKey)]);
    await ctx.control.query(`insert into provider_connections(owner_id,secret_ciphertext,key_hash) values($1,$2,$3)`, [id, encryptSecret('fixture-key', ctx.config.encryptionKey), hash('fixture-key')]);
  }
  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = String(input);
    if(url.endsWith('/auth/v1/user')) {
      const authorization=new Headers(init?.headers).get('Authorization')||'',id=authorization.replace('Bearer fixture-auth:','');
      if(![String(alice),String(bob)].includes(id))return Response.json({error:'fixture rejected'},{status:401});
      return Response.json({id,email:id===alice?'alice@example.invalid':'bob@example.invalid',email_confirmed_at:'2026-10-13T00:00:00Z'});
    }
    if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [
      { id: 'fixture/code:free', name: 'Fixture only', context_length: 32768, pricing: { prompt: '0', completion: '0' } },
      { id: 'fixture/alternate:free', name: 'Alternate fixture', context_length: 32768, pricing: { prompt: '0', completion: '0' } },
    ] }));
    if (url.endsWith('/key')) return new Response(JSON.stringify({ data: { free_model_daily_requests: { used: 0, remaining: 50, limit: 50 } } }));
    if (url.endsWith('/auth/keys')) return new Response(JSON.stringify({ key: 'oauth-fixture-key-0123456789' }));
    throw new Error(`Unexpected external request in PostgreSQL test: ${url}`);
  }) as any;
  const app = express(); app.use(express.json({ limit: '3mb' })); app.use('/api', createControlRouter(ctx));
  app.use(((error: any, _req: any, res: any, _next: any) => res.status(error instanceof HttpError ? error.status : 500).json({ error: { code: error.code || 'INTERNAL', message: error.message } })) as express.ErrorRequestHandler);
  server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}/api`;
});
after(async () => { globalThis.fetch = nativeFetch; if (server) await new Promise<void>(resolve => server.close(() => resolve())); if (db) await db.close(); });
async function api(path: string, options: { method?: string; body?: any; user?: 'alice' | 'bob' | 'public'; key?: string; origin?: string; token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: options.origin || ctx.config.platformOrigin, 'X-CSRF-Token': options.token || csrf };
  if (options.user !== 'public') headers.Cookie = `pf_session=${options.user === 'bob' ? bobCookie : aliceCookie}`;
  if (options.key || options.method === 'POST') headers['Idempotency-Key'] = options.key || nonce();
  const response = await nativeFetch(baseUrl + path, { method: options.method || 'GET', headers, redirect: 'manual', ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
  const body = await response.json().catch(() => null); return { status: response.status, body, location: response.headers.get('location') };
}
async function project(owner: 'alice' | 'bob' = 'alice') {
  const result = await api('/projects', { method: 'POST', body: { title: 'Proyecto PostgreSQL', description: 'Prueba aislada' }, user: owner });
  assert.equal(result.status, 201); return result.body.project;
}
async function version(projectId: string) {
  return (await ctx.control.query(`insert into app_versions(project_id,prompt,html,manifest,content_hash,changelog) values($1,'prompt privado',$2,$3,$4,'[]') returning *`, [projectId, html, JSON.stringify(manifest), artifactHash(html, manifest)])).rows[0];
}
test('real SQL protects ownership, CSRF and server-derived owner during creation', async () => {
  const p = await project(); const denied = await api(`/projects/${p.id}`, { user: 'bob' }); assert.equal(denied.status, 404);
  assert.equal((await api(`/projects/${p.id}/versions`, { user: 'bob' })).status, 404);
  assert.equal((await api('/projects', { method: 'POST', body: { title: 'CSRF' }, origin: ctx.config.runtimeOrigin })).status, 403);
  assert.equal((await api('/projects', { method: 'POST', body: { title: 'CSRF' }, token: 'wrong' })).status, 403);
  const forged = await api('/projects', { method: 'POST', body: { title: 'Owner', owner_id: bob } }); assert.equal(forged.body.project.owner_id, alice);
});

test('concurrent project creation is idempotent and rejects a changed payload in real SQL',async()=> {
  const body={title:'Durable project creation',description:'Same request twice'},key='project-create-race-key';
  const [a,b]=await Promise.all([api('/projects',{method:'POST',body,key}),api('/projects',{method:'POST',body,key})]);
  assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(a.body.project.id,b.body.project.id);
  assert.equal((await ctx.control.query('select count(*)::int as n from projects where id=$1',[a.body.project.id])).rows[0].n,1);
  assert.equal((await ctx.control.query("select count(*)::int as n from platform_mutation_receipts where user_id=$1 and idempotency_key=$2",[alice,key])).rows[0].n,1);
  assert.equal((await api('/projects',{method:'POST',body:{...body,title:'Different request'},key})).status,409);
});
test('real immutable trigger and composite foreign key protect versions and publication', async () => {
  const p = await project(); const other = await project('bob'); const v = await version(p.id); const foreign = await version(other.id);
  await assert.rejects(ctx.control.query('update app_versions set html=$2 where id=$1', [v.id, '<html>changed</html>']), /immutable/i);
  await assert.rejects(ctx.control.query('delete from app_versions where id=$1', [v.id]), /immutable/i);
  await assert.rejects(ctx.control.query('update projects set published_version_id=$2 where id=$1', [p.id, foreign.id]), /foreign key/i);
  assert.equal((await api(`/projects/${p.id}/publish`, { method: 'POST', body: { version_id: foreign.id } })).status, 404);
  assert.equal((await api(`/projects/${p.id}/publish`, { method: 'POST', body: { version_id: v.id } })).status, 200);
  const visible = await api(`/public/projects/${p.id}`, { user: 'public' });
  assert.equal(visible.status, 200); assert.equal(visible.body.version.html, undefined); assert.equal(visible.body.version.prompt, undefined); assert.equal(visible.body.project.owner_id, undefined);
  assert.match(visible.body.runtime_url, /\/apps\/.*\/versions\//);
});

test('replaying publication A never reverts B and public history reveals only published metadata',async()=> {
  const p=await project(),a=await version(p.id),b=await version(p.id),privateCandidate=await version(p.id);
  const publish=(versionId:string,key:string)=>api(`/projects/${p.id}/publish`,{method:'POST',body:{version_id:versionId},key});
  assert.equal((await publish(a.id,'publish-ordered-A')).status,200);assert.equal((await publish(b.id,'publish-ordered-B')).status,200);
  assert.equal((await publish(a.id,'publish-ordered-A')).status,200);
  assert.equal((await ctx.control.query('select published_version_id from projects where id=$1',[p.id])).rows[0].published_version_id,b.id);
  assert.equal((await publish(b.id,'publish-repeat-same-version')).status,200);
  assert.equal((await ctx.control.query('select count(*)::int as n from publication_history where project_id=$1',[p.id])).rows[0].n,2);
  const visible=await api(`/public/projects/${p.id}`,{user:'public'});assert.equal(visible.status,200);assert.equal(visible.body.history.length,2);
  assert.deepEqual(new Set(visible.body.history.map((row:any)=>row.version_id)),new Set([a.id,b.id]));assert.ok(!visible.body.history.some((row:any)=>row.version_id===privateCandidate.id));
  for(const row of visible.body.history){assert.equal(row.html,undefined);assert.equal(row.prompt,undefined);assert.equal(row.owner_id,undefined);}
  assert.ok(!JSON.stringify(visible.body.history).includes('prompt privado'));
  await assert.rejects(ctx.control.query('delete from publication_history where project_id=$1',[p.id]),/immutable/i);
});
test('RLS and revoked grants prevent direct anonymous/authenticated reads of control tables', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try { await assert.rejects(db.query('select * from public.projects'), /permission denied/i); await assert.rejects(db.query('select * from public.provider_connections'), /permission denied/i); }
    finally { await db.exec('reset role'); }
  }
});

test('control migration is portable when Supabase browser roles do not exist', async () => {
  const portable=new PGlite({extensions:{pgcrypto}}); await portable.waitReady;
  try {
    await portable.exec(await readFile(new URL('../supabase/control/migrations/202610130001_control.sql',import.meta.url),'utf8'));
    assert.equal((await portable.query<{n:number}>("select count(*)::int as n from pg_roles where rolname in ('anon','authenticated')")).rows[0].n,0);
    const grants=await portable.query<{n:number}>(`select count(*)::int as n from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      where c.relnamespace='public'::regnamespace and c.relkind='r' and a.grantee=0`);
    assert.equal(grants.rows[0].n,0);
  } finally {await portable.close();}
});
test('legacy import is atomic/idempotent and never fabricates credits or publication', async () => {
  const p = await project(); const items = [{ legacy_id: 'legacy-poc', title: 'Tareas', prompt: 'Borrador', html, solBalance: 123, signature: 'fake' }];
  const first = await api(`/projects/${p.id}/import`, { method: 'POST', body: { items }, key: 'legacy-batch-1' }); assert.equal(first.status, 201);
  const repeated = await api(`/projects/${p.id}/import`, { method: 'POST', body: { items }, key: 'legacy-batch-1' }); assert.equal(repeated.body.versions[0].id, first.body.versions[0].id);
  assert.equal((await api(`/projects/${p.id}/import`, { method: 'POST', body: { items: [{ ...items[0], prompt: 'changed' }] }, key: 'legacy-batch-1' })).status, 409);
  assert.equal((await ctx.control.query('select count(*)::int as n from app_versions where project_id=$1', [p.id])).rows[0].n, 1);
  assert.equal((await ctx.control.query('select published_version_id from projects where id=$1', [p.id])).rows[0].published_version_id, null);
  assert.equal((await ctx.control.query('select count(*)::int as n from generation_attempts')).rows[0].n, 0);
});
test('racing HTTP enqueue with the same key creates one actual SQL job and reservation', async () => {
  const p = await project(); const body = { prompt: 'Genera tareas', model: 'fixture/code:free' };
  const [a, b] = await Promise.all([api(`/projects/${p.id}/jobs`, { method: 'POST', body, key: 'generation-race-1' }), api(`/projects/${p.id}/jobs`, { method: 'POST', body, key: 'generation-race-1' })]);
  assert.ok([200, 202].includes(a.status), JSON.stringify(a.body)); assert.ok([200, 202].includes(b.status), JSON.stringify(b.body));
  assert.equal(a.body.job_id, b.body.job_id);
  const count = await ctx.control.query('select count(*)::int as n from generation_jobs where idempotency_key=$1', ['generation-race-1']); assert.equal(count.rows[0].n, 1);
  assert.equal((await api(`/projects/${p.id}/jobs`, { method: 'POST', body: { ...body, prompt: 'Different' }, key: 'generation-race-1' })).status, 409);
  let calls = 0;
  await runOneJob(ctx, 'sql-worker', { fetcher: (async () => { calls++; return new Response(JSON.stringify({ id: 'gen-fixture', usage: { prompt_tokens: 99, completion_tokens: 55, cost: 0 }, choices: [{ message: { content: JSON.stringify({ html, manifest, changelog: ['Primera versión'] }) } }] })); }) as any });
  const completed = await api(`/jobs/${a.body.job_id}`); assert.equal(completed.body.job.status, 'completed'); assert.equal(completed.body.job.usage_status, 'reported'); assert.equal(completed.body.job.cost_usd, '0.000000000000'); assert.equal(calls, 1);
  assert.equal((await ctx.control.query('select published_version_id from projects where id=$1', [p.id])).rows[0].published_version_id, null);
});
test('iteration persists no_changes without overwriting the immutable base', async () => {
  const p = await project(); const v = await version(p.id);
  const created = await api(`/projects/${p.id}/jobs`, { method: 'POST', body: { prompt: 'Sin cambios necesarios', model: 'fixture/code:free', base_version_id: v.id }, key: 'unchanged-iteration-1' });
  assert.equal(created.status, 202);
  await runOneJob(ctx, 'sql-worker', { fetcher: (async (_url: any, options: any) => {
    const sent = JSON.parse(options.body); assert.equal(JSON.parse(sent.messages[1].content).currentHtml, html);
    assert.deepEqual(sent.plugins, []);
    assert.equal(sent.provider.allow_fallbacks, false);
    assert.deepEqual(sent.provider.max_price, { prompt: 0, completion: 0, request: 0, image: 0 });
    return new Response(JSON.stringify({ id: 'gen-no-change', usage: { prompt_tokens: 30, completion_tokens: 20, cost: 0 }, choices: [{ message: { content: JSON.stringify({ html, manifest, changelog: [] }) } }] }));
  }) as any });
  const done = await api(`/jobs/${created.body.job_id}`); assert.equal(done.body.job.status, 'no_changes'); assert.equal(done.body.job.result_version_id, v.id);
  assert.equal((await ctx.control.query('select count(*)::int as n from app_versions where project_id=$1', [p.id])).rows[0].n, 1);
});
test('private drafts start empty and require owner, CSRF and exact Origin without generation side effects',async()=>{
  const p=await project(),path=`/projects/${p.id}/draft`;
  const blank=await api(path);assert.equal(blank.status,200);
  assert.deepEqual(blank.body.draft,{project_id:p.id,prompt:'',model:'',base_version_id:null,revision:0,updated_at:null});
  assert.equal((await ctx.control.query('select count(*)::int as n from project_drafts where project_id=$1',[p.id])).rows[0].n,0);
  assert.equal((await api(path,{user:'bob'})).status,404);
  const body={prompt:'Una idea privada',model:'',base_version_id:null,revision:0};
  assert.equal((await api(path,{method:'PUT',body,user:'bob'})).status,404);
  assert.equal((await api(path,{method:'PUT',body,token:'wrong'})).status,403);
  assert.equal((await api(path,{method:'PUT',body,origin:ctx.config.runtimeOrigin})).status,403);
  const saved=await api(path,{method:'PUT',body:{...body,owner_id:bob}});assert.equal(saved.status,200);assert.equal(saved.body.draft.revision,1);
  assert.equal((await ctx.control.query('select owner_id,published_version_id from projects where id=$1',[p.id])).rows[0].owner_id,alice);
  assert.equal((await ctx.control.query('select count(*)::int as n from app_versions where project_id=$1',[p.id])).rows[0].n,0);
  assert.equal((await ctx.control.query('select count(*)::int as n from generation_jobs where project_id=$1',[p.id])).rows[0].n,0);
});

test('draft revisions serialize competing writers and acknowledge an identical lost-response retry exactly once',async()=>{
  const p=await project(),base=await version(p.id),path=`/projects/${p.id}/draft`;
  const body={prompt:'  Primera línea\n\tsegunda línea 💡\r\n  ',model:'fixture/code:free',base_version_id:base.id,revision:0};
  const initial=await Promise.all([api(path,{method:'PUT',body}),api(path,{method:'PUT',body})]);
  for(const response of initial){assert.equal(response.status,200);assert.equal(response.body.draft.prompt,body.prompt);assert.equal(response.body.draft.revision,1);}
  assert.deepEqual(initial[0].body.draft,initial[1].body.draft);
  const replay=await api(path,{method:'PUT',body});assert.equal(replay.status,200);assert.deepEqual(replay.body.draft,initial[0].body.draft);
  assert.equal((await ctx.control.query('select count(*)::int as n from project_drafts where project_id=$1',[p.id])).rows[0].n,1);
  const competing=await Promise.all([
    api(path,{method:'PUT',body:{...body,prompt:'Edición pestaña A',revision:1}}),
    api(path,{method:'PUT',body:{...body,prompt:'Edición pestaña B',revision:1}}),
  ]);
  assert.deepEqual(competing.map(response=>response.status).sort(),[200,409]);
  assert.equal(competing.find(response=>response.status===409)!.body.error.code,'DRAFT_CONFLICT');
  const winner=competing.find(response=>response.status===200)!.body.draft;assert.equal(winner.revision,2);
  assert.equal((await api(path,{method:'PUT',body})).status,409);
  assert.deepEqual((await api(path)).body.draft,winner);
  const explicit=await api(path,{method:'PUT',body:{prompt:'Conservo mi edición tras revisar el conflicto',model:'',base_version_id:null,revision:winner.revision}});
  assert.equal(explicit.status,200);assert.equal(explicit.body.draft.revision,3);
  assert.equal((await ctx.control.query('select count(*)::int as n from app_versions where project_id=$1',[p.id])).rows[0].n,1);
  assert.equal((await ctx.control.query('select published_version_id from projects where id=$1',[p.id])).rows[0].published_version_id,null);
});

test('draft validation and database permissions reject foreign bases, invalid input and public prompt leakage',async()=>{
  const p=await project(),other=await project(),foreign=await version(other.id),path=`/projects/${p.id}/draft`;
  const body={prompt:'private autosave never public',model:'',base_version_id:null,revision:0};
  assert.equal((await api(path,{method:'PUT',body:{...body,base_version_id:foreign.id}})).body.error.code,'INVALID_BASE_VERSION');
  for(const invalid of [{prompt:'x'.repeat(20001)},{prompt:String.fromCharCode(0)},{prompt:String.fromCharCode(0xd800)},{model:'x'.repeat(201)},
    {model:'bad\nmodel'},{revision:-1},{revision:0.5},{revision:'0'},{base_version_id:undefined}])
    assert.equal((await api(path,{method:'PUT',body:{...body,...invalid}})).status,422);
  assert.equal((await api(path,{method:'PUT',body:{...body,prompt:'sk-or-v1-'+ 'a'.repeat(30)}})).status,422);
  await assert.rejects(ctx.control.query('insert into project_drafts(project_id,prompt,model,base_version_id,revision) values($1,$2,$3,$4,1)',[p.id,'test','',foreign.id]),/foreign key/i);
  const saved=await api(path,{method:'PUT',body});assert.equal(saved.status,200);
  for(const role of ['anon','authenticated']){
    await ctx.control.query('set role '+role);
    await assert.rejects(ctx.control.query('select * from project_drafts'),/permission denied/i);
    await ctx.control.query('reset role');
  }
  const v=await version(p.id);
  assert.equal((await api(`/projects/${p.id}/publish`,{method:'POST',body:{version_id:v.id},key:'publish-private-draft-check'})).status,200);
  const publicView=await api(`/public/projects/${p.id}`,{user:'public'});assert.equal(publicView.status,200);
  assert.ok(!JSON.stringify(publicView.body).includes(body.prompt));assert.equal(publicView.body.project.draft,undefined);
});

test('a submitted uncertain request survives real SQL recovery without a second inference', async () => {
  const p = await project(); const body = { prompt: 'Prueba pérdida de respuesta', model: 'fixture/code:free' };
  const created = await api(`/projects/${p.id}/jobs`, { method: 'POST', body, key: 'uncertain-sql-job-1' }); assert.equal(created.status, 202);
  let calls = 0; const options = { fetcher: (async () => { calls++; throw new Error('accepted but connection dropped'); }) as any };
  await runOneJob(ctx, 'crashed-worker', options); await recoverExpiredJobs(ctx); await runOneJob(ctx, 'replacement-worker', options);
  const done = await api(`/jobs/${created.body.job_id}`); assert.equal(done.body.job.status, 'uncertain'); assert.equal(done.body.job.cost_usd, null); assert.equal(done.body.job.usage_status, 'unknown'); assert.equal(calls, 1);
  const evidence = await ctx.control.query('select a.state,r.cost_usd from generation_attempts a join usage_receipts r on r.attempt_id=a.id where a.job_id=$1', [created.body.job_id]);
  assert.equal(evidence.rows[0].state, 'uncertain'); assert.equal(evidence.rows[0].cost_usd, null);
  const retry = await api(`/projects/${p.id}/jobs`, { method: 'POST', body, key: 'uncertain-sql-job-1' });
  assert.equal(retry.status, 200); assert.equal(retry.body.job_id, created.body.job_id); assert.equal(retry.body.job.status, 'uncertain');
  const quotaBefore = (await ctx.control.query('select used,held from free_quota_days where owner_id=$1 and day=current_date', [alice])).rows[0];
  const attempts = await Promise.all([
    api(`/projects/${p.id}/jobs`, { method: 'POST', body, key: 'uncertain-new-key-1' }),
    api(`/projects/${p.id}/jobs`, { method: 'POST', body: { ...body, model: 'fixture/alternate:free' }, key: 'uncertain-new-key-2' }),
  ]);
  for (const attempt of attempts) { assert.equal(attempt.status, 409); assert.equal(attempt.body.error.code, 'GENERATION_REVIEW_REQUIRED'); }
  const quotaAfter = (await ctx.control.query('select used,held from free_quota_days where owner_id=$1 and day=current_date', [alice])).rows[0];
  assert.deepEqual(quotaAfter, quotaBefore);
  assert.equal((await ctx.control.query('select count(*)::int as n from generation_jobs where project_id=$1', [p.id])).rows[0].n, 1);
  assert.equal(await runOneJob(ctx, 'after-reenqueue-worker', options), false); assert.equal(calls, 1);
});
test('OAuth state is bound to account/session and consumed atomically once in PostgreSQL', async () => {
  const state = nonce(); const verifier = nonce();
  const session = await ctx.control.query('select id from platform_sessions where token_hash=$1', [hash(aliceCookie)]);
  await ctx.control.query(`insert into auth_flows(state_hash,purpose,user_id,session_id,verifier_ciphertext,expires_at) values($1,'openrouter',$2,$3,$4,now()+interval '10 minutes')`, [hash(state), alice, session.rows[0].id, encryptSecret(verifier, ctx.config.encryptionKey)]);
  const callback = `/providers/openrouter/callback?state=${state}&code=fixture-code`;
  assert.equal((await api(callback, { user: 'bob' })).status, 403);
  assert.equal((await api(callback)).status, 302);
  assert.equal((await api(callback)).status, 403);
  const grant = await ctx.control.query(`select secret_ciphertext,state from provider_connections where owner_id=$1 and state='active'`, [alice]);
  assert.equal(grant.rows.length, 1); assert.ok(!grant.rows[0].secret_ciphertext.includes('oauth-fixture-key'));
});
test('feedback remains unpublished until its project owner moderates it', async () => {
  const p = await project(); const v = await version(p.id); await api(`/projects/${p.id}/publish`, { method: 'POST', body: { version_id: v.id } });
  const created = await api(`/public/projects/${p.id}/feedback`, { method: 'POST', user: 'bob', body: { version_id: v.id, text: 'Comentario verificable' } }); assert.equal(created.status, 201);
  assert.equal((await api(`/public/projects/${p.id}`, { user: 'public' })).body.feedback.length, 0);
  const route = `/projects/${p.id}/feedback/${created.body.feedback.id}`;
  assert.equal((await api(route, { method: 'PATCH', user: 'bob', body: { status: 'approved' } })).status, 404);
  assert.equal((await api(route, { method: 'PATCH', body: { status: 'approved' } })).status, 200);
  assert.equal((await api(`/public/projects/${p.id}`, { user: 'public' })).body.feedback.length, 1);
});

test('managed Neon identity maps opaque subjects and persists only encrypted upstream cookies in real SQL', async () => {
  const legacy=(await ctx.control.query('select auth_provider,auth_subject from platform_users where id=$1',[alice])).rows[0];assert.equal(legacy.auth_provider,'supabase');assert.equal(legacy.auth_subject,alice);
  const previousFetch=globalThis.fetch, previousProvider=ctx.config.backendProvider;
  const authUrl='https://control.neonauth.example.invalid/neondb/auth'; ctx.config.backendProvider='neon'; ctx.config.controlAuthUrl=authUrl;
  const subject='opaque-provider-subject', email='neon@example.invalid', upstreamCookie=NEON_SESSION_COOKIE+'=only-provider-knows-the-signature';
  const identity={provider:'neon' as const,subject,issuer:authUrl}; let revoked=false;
  globalThis.fetch=(async (input:any,init:any) => {
    if(String(input).endsWith('/sign-in/email')) return Response.json({user:{id:subject,email,emailVerified:true}}, {headers:{'Set-Cookie':upstreamCookie+'; Secure; HttpOnly'}});
    assert.equal(init.headers.Cookie,upstreamCookie);
    if(String(input).endsWith('/sign-out')) {revoked=true;return Response.json({success:true});}
    return Response.json({user:{id:subject,email,emailVerified:true},session:{userId:subject,expiresAt:new Date(Date.now()+3600000).toISOString()}});
  }) as any;
  try {
    const response=await nativeFetch(baseUrl+'/auth/login',{method:'POST',headers:{Origin:ctx.config.platformOrigin,'Content-Type':'application/json'},body:JSON.stringify({email,password:'password-123'})});
    assert.equal(response.status,200); const logged=await response.json(); assert.equal(logged.user.id,identityUserId(identity)); assert.ok(!JSON.stringify(logged).includes('signature'));
    const browserCookie=response.headers.getSetCookie()[0].split(';')[0]; assert.match(browserCookie,/^pf_session=/); assert.ok(!browserCookie.includes(upstreamCookie));
    const stored=(await ctx.control.query('select auth_provider,auth_subject from platform_users where id=$1',[logged.user.id])).rows[0]; assert.equal(stored.auth_provider,'neon');assert.equal(stored.auth_subject,identitySubject(identity));
    const upstream=(await ctx.control.query('select auth_token_ciphertext from platform_sessions where user_id=$1',[logged.user.id])).rows[0];assert.ok(upstream.auth_token_ciphertext.startsWith('v1.'));assert.ok(!upstream.auth_token_ciphertext.includes('signature'));
    const session=await nativeFetch(baseUrl+'/session',{headers:{Cookie:browserCookie}});assert.equal((await session.json()).user.id,logged.user.id);
    const logout=await nativeFetch(baseUrl+'/auth/logout',{method:'POST',headers:{Cookie:browserCookie,Origin:ctx.config.platformOrigin,'X-CSRF-Token':logged.csrf_token}});assert.equal(logout.status,200);assert.equal(revoked,true);
    const ended=await nativeFetch(baseUrl+'/session',{headers:{Cookie:browserCookie}});assert.equal((await ended.json()).user,null);
  } finally {globalThis.fetch=previousFetch;ctx.config.backendProvider=previousProvider;}
});

test('remote identity revocation fails closed while local logout survives an upstream outage',async()=> {
  const previousFetch=globalThis.fetch,id=randomUUID(),cookie=nonce(),secondCookie=nonce(),email='revocation@example.invalid';let state:'active'|'outage'|'revoked'='active';
  await ctx.control.query('insert into platform_users(id,email,auth_provider,auth_subject) values($1,$2,\'supabase\',$3)',[id,email,id]);
  const issue=async(token:string)=>ctx.control.query("insert into platform_sessions(user_id,token_hash,csrf_token,auth_token_ciphertext,expires_at) values($1,$2,$3,$4,now()+interval '1 hour')",[id,hash(token),csrf,encryptSecret('fixture-revocation-token',ctx.config.encryptionKey)]);
  await issue(cookie);
  globalThis.fetch=(async(input:any)=> {
    if(state==='outage')throw new Error('fixture upstream unavailable');
    if(String(input).endsWith('/auth/v1/user'))return state==='revoked'?Response.json({error:'revoked'},{status:401}):Response.json({id,email,email_confirmed_at:'2026-10-13T00:00:00Z'});
    return previousFetch(input);
  }) as any;
  const get=(token:string)=>nativeFetch(baseUrl+'/projects',{headers:{Cookie:'pf_session='+token}});
  try {
    assert.equal((await get(cookie)).status,200);state='outage';assert.equal((await get(cookie)).status,503);
    const logout=await nativeFetch(baseUrl+'/auth/logout',{method:'POST',headers:{Cookie:'pf_session='+cookie,Origin:ctx.config.platformOrigin,'X-CSRF-Token':csrf}});assert.equal(logout.status,200);assert.equal((await get(cookie)).status,401);
    state='active';await issue(secondCookie);assert.equal((await get(secondCookie)).status,200);state='revoked';assert.equal((await get(secondCookie)).status,401);
    assert.ok((await ctx.control.query('select revoked_at from platform_sessions where token_hash=$1',[hash(secondCookie)])).rows[0].revoked_at);
  } finally {globalThis.fetch=previousFetch;}
});

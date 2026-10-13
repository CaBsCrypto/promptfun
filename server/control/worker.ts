import { randomUUID } from 'node:crypto';
import type { CoreContext } from '../shared.js';
import { HttpError } from '../shared.js';
import { transaction } from './db.js';
import { openRouterUrl, preflight, providerRequest } from './providers.js';
import { artifactHash, assertNoSecrets, decryptSecret, validateHtml, validateManifest } from './security.js';

export function buildModelMessages(job: { prompt: string }, base?: { html: string; manifest: unknown } | null) {
  return [{ role: 'system', content: `Create a complete runnable HTML web app with inline CSS and JavaScript. Return ONLY JSON {"html":string,"manifest":{"version":1,"records":{"collections":string[]},"auth":boolean,"files":boolean,"connectors":string[]},"changelog":string[]}. No Markdown fences. No external scripts, packages, shell, SQL, servers, API keys, wallet code or network fetch. All text must be in Spanish. Make the requested app usable and handle loading/error/empty states.
The trusted runtime injects window.promptfun. Never implement or replace that SDK, and never create a localStorage database. Backend collections allowed: tasks, notes, items, attachments. Use only capabilities declared in manifest. Set manifest.auth=true whenever using any records, files or connectors; set manifest.files=true when using files. manifest.connectors must be [] or ["github.repository"]; include "github.repository" when the requested app uses that connector.
All SDK methods are asynchronous: await their results. window.promptfun.records.list(collection)->{records:[{id,data}]}; get(collection,id), create(collection,data), update(collection,id,data)->{record:{id,data}}; delete(collection,id)->{ok:true}. records.update replaces the complete data object, not a partial patch: preserve existing fields with window.promptfun.records.update(collection,record.id,{...record.data,...changes}). auth.session()->{user}; signup/login/logout live in trusted surrounding UI: display a message requesting login if user is null, never collect passwords in your HTML. files.upload(File)->{file}; files.list()->{files}; files.download(id)->{file:{id,name,mime_type,base64}}; connectors.invoke('github.repository',{})->{result:{name,description,url,updated_at,language}} only when declared. Prefer tasks and files for the task manager. React to message channel promptfun.auth.changed.v1 by rechecking auth.session. Keep source compact. Preserve working behavior when iterating.` },
    { role: 'user', content: JSON.stringify({ instruction: job.prompt, ...(base ? { currentHtml: base.html, currentManifest: base.manifest, mode: 'iterate_existing_version' } : { mode: 'create' }) }) }];
}
export function normalizeUsage(value: any) {
  const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
  let cost: string | null = null;
  if (typeof value?.cost === 'number' && Number.isFinite(value.cost) && value.cost >= 0 && value.cost < 1e12) cost = value.cost.toFixed(12);
  if (typeof value?.cost === 'string' && /^\d{1,12}(?:\.\d{1,12})?$/.test(value.cost)) cost = value.cost;
  const raw: Record<string, unknown> = {};
  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens', 'cost', 'prompt_tokens_details', 'completion_tokens_details']) {
    if (key === 'cost') { if (cost !== null) raw.cost = cost; continue; }
    if (key.endsWith('_details') && value?.[key] && typeof value[key] === 'object') {
      raw[key] = Object.fromEntries(Object.entries(value[key]).filter(([, n]) => count(n) !== null));
    } else if (count(value?.[key]) !== null) raw[key] = value[key];
  }
  return { prompt_tokens: count(value?.prompt_tokens), completion_tokens: count(value?.completion_tokens), cost_usd: cost, raw };
}
export function parseGeneration(value: any) {
  const content = value?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new HttpError(422, 'INVALID_MODEL_OUTPUT', 'El modelo no entregó un artefacto.');
  let parsed: any;
  try { parsed = JSON.parse(content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')); }
  catch { throw new HttpError(422, 'INVALID_MODEL_OUTPUT', 'El modelo devolvió un formato inválido; se conserva la versión anterior.'); }
  const html = validateHtml(parsed.html); const manifest = validateManifest(parsed.manifest);
  if (!Array.isArray(parsed.changelog) || parsed.changelog.length > 20 || parsed.changelog.some((v: unknown) => typeof v !== 'string' || v.length > 500))
    throw new HttpError(422, 'INVALID_MODEL_OUTPUT', 'Resumen de cambios inválido.');
  for (const entry of parsed.changelog) assertNoSecrets(entry);
  return { html, manifest, changelog: parsed.changelog, content_hash: artifactHash(html, manifest) };
}
async function boundedJson(response: Response) {
  const reader = response.body?.getReader(); if (!reader) throw new Error('Empty provider response');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength;
      if (length > 3 * 1024 * 1024) throw new Error('Provider response exceeds limit'); chunks.push(part.value); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
}
export async function recoverExpiredJobs(ctx: CoreContext) {
  return transaction(ctx, async client => {
    const stale = await client.query(`select j.id,a.state from generation_jobs j join generation_attempts a on a.job_id=j.id
      where j.status in ('running','validating') and j.lease_until<now() for update of j skip locked`);
    for (const job of stale.rows) {
      if (job.state === 'prepared') await client.query(`update generation_jobs set status='queued',lease_owner=null,lease_until=null,updated_at=now() where id=$1`, [job.id]);
      else {
        await client.query(`update generation_attempts set state='uncertain' where job_id=$1 and state='submitted'`, [job.id]);
        await client.query(`update generation_jobs set status='uncertain',usage_status=case when usage_status='reported' then 'reported' else 'unknown' end,
          error='El worker se interrumpió después del envío. No se repetirá la llamada automáticamente.',lease_owner=null,lease_until=null,updated_at=now() where id=$1`, [job.id]);
      }
    } return stale.rows.length;
  });
}
async function claim(ctx: CoreContext, workerId: string) {
  return transaction(ctx, async client => {
    const result = await client.query(`select * from generation_jobs where status='queued' order by created_at for update skip locked limit 1`);
    const job = result.rows[0]; if (!job) return null;
    await client.query(`update generation_jobs set status='running',lease_owner=$2,lease_until=now()+interval '60 seconds',updated_at=now() where id=$1`, [job.id, workerId]);
    await client.query(`insert into generation_attempts(job_id,payer_id,connection_id,model) values($1,$2,$3,$4) on conflict(job_id) do nothing`, [job.id, job.actor_id, job.connection_id, job.model]);
    return job;
  });
}
async function failPrepared(ctx: CoreContext, job: any, error: unknown, workerId: string) {
  await transaction(ctx, async client => {
    const current = await client.query(`select j.id,a.state from generation_jobs j join generation_attempts a on a.job_id=j.id where j.id=$1 and j.lease_owner=$2 for update of j`, [job.id, workerId]);
    if (current.rows[0]?.state !== 'prepared') return;
    await client.query(`update generation_attempts set state='rejected' where job_id=$1`, [job.id]);
    await client.query(`update generation_jobs set status='failed',usage_status='unknown',error=$2,lease_owner=null,lease_until=null,updated_at=now() where id=$1`, [job.id, error instanceof HttpError ? error.message : 'No se pudo preparar la generación.']);
    await client.query('update free_quota_days set held=held-1 where owner_id=$1 and day=$2 and held>0', [job.actor_id, job.quota_day]);
  });
}
async function submitted(ctx: CoreContext, job: any, workerId: string, quotaLimit: number) {
  return transaction(ctx, async client => {
    const current = await client.query(`select j.*,a.state from generation_jobs j join generation_attempts a on a.job_id=j.id where j.id=$1 for update of j,a`, [job.id]);
    if (current.rows[0]?.state !== 'prepared' || current.rows[0]?.lease_owner !== workerId) return false;
    const grant = await client.query(`select id from provider_connections where id=$1 and owner_id=$2 and state='active' for update`, [job.connection_id, job.actor_id]);
    if (!grant.rows[0]) throw new HttpError(409, 'PROVIDER_REVOKED', 'La conexión fue revocada antes del envío.');
    const today = new Date().toISOString().slice(0, 10); const reservedDay = new Date(job.quota_day).toISOString().slice(0, 10);
    if (today !== reservedDay) {
      await client.query('insert into free_quota_days(owner_id,day) values($1,$2) on conflict do nothing', [job.actor_id, today]);
      const quota = await client.query('select used,held from free_quota_days where owner_id=$1 and day=$2 for update', [job.actor_id, today]);
      if (quota.rows[0].used + quota.rows[0].held >= quotaLimit) throw new HttpError(429, 'FREE_QUOTA_EXHAUSTED', 'Se agotó la cuota del día actual.');
      await client.query('update free_quota_days set held=held-1 where owner_id=$1 and day=$2 and held>0', [job.actor_id, job.quota_day]);
      await client.query('update free_quota_days set used=used+1 where owner_id=$1 and day=$2', [job.actor_id, today]);
      await client.query('update generation_jobs set quota_day=$2 where id=$1', [job.id, today]);
    } else {
      const quota = await client.query('update free_quota_days set held=held-1,used=used+1 where owner_id=$1 and day=$2 and held>0', [job.actor_id, job.quota_day]);
      if (quota.rowCount !== 1) throw new HttpError(409, 'QUOTA_RESERVATION_MISSING', 'No existe una cuota reservada para este trabajo.');
    }
    await client.query(`update generation_attempts set state='submitted',submitted_at=now() where job_id=$1`, [job.id]);
    await client.query(`insert into usage_receipts(attempt_id,revision,raw_usage,source)
      select id,0,'{}'::jsonb,'submitted' from generation_attempts where job_id=$1 on conflict(attempt_id,revision) do nothing`, [job.id]);
    return true;
  });
}
async function uncertain(ctx: CoreContext, jobId: string, message: string) {
  await transaction(ctx, async client => {
    await client.query(`update generation_attempts set state='uncertain' where job_id=$1 and state='submitted'`, [jobId]);
    await client.query(`update generation_jobs set status='uncertain',usage_status='unknown',error=$2,lease_owner=null,lease_until=null,updated_at=now() where id=$1 and status in ('running','validating')`, [jobId, message]);
  });
}
export interface WorkerOptions { fetcher?: typeof fetch; check?: typeof preflight }
export async function runOneJob(ctx: CoreContext, workerId: string = randomUUID(), options: WorkerOptions = {}) {
  const job = await claim(ctx, workerId); if (!job) return false;
  const heartbeat = setInterval(() => {
    ctx.control.query(`update generation_jobs set lease_until=now()+interval '60 seconds' where id=$1 and lease_owner=$2 and status in ('running','validating')`, [job.id, workerId]).catch(() => {});
  }, 15_000);
  heartbeat.unref();
  let sent = false;
  try {
    const checked = await (options.check || preflight)(ctx, job.actor_id, job.model, job.connection_id);
    const base = job.base_version_id ? (await ctx.control.query('select html,manifest,content_hash from app_versions where id=$1 and project_id=$2', [job.base_version_id, job.project_id])).rows[0] : null;
    if (job.base_version_id && !base) throw new HttpError(422, 'INVALID_BASE_VERSION', 'La versión base no está disponible.');
    const messages = buildModelMessages(job, base);
    const maxTokens = Math.min(8192, Math.floor(checked.model.context_length / 2));
    if (Buffer.byteLength(JSON.stringify(messages)) > Math.min(512_000, (checked.model.context_length - maxTokens - 1024) * 3))
      throw new HttpError(422, 'CONTEXT_TOO_LARGE', 'La versión excede el contexto permitido por este modelo gratuito.');
    if (!await submitted(ctx, job, workerId, checked.quota.limit)) return true;
    sent = true;
    const response = await (options.fetcher || fetch)(openRouterUrl(ctx, 'chat/completions'), {
      method: 'POST', headers: { Authorization: `Bearer ${checked.connection.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: job.model, messages, stream: false, max_tokens: maxTokens, plugins: [], provider: { allow_fallbacks: false, max_price: { prompt: 0, completion: 0, request: 0, image: 0 } } }),
      signal: AbortSignal.timeout(90_000),
    });
    let data: any;
    try { data = await boundedJson(response); }
    catch { await uncertain(ctx, job.id, 'El envío o la respuesta quedó incompleto. Revisa el intento; no habrá reenvío automático.'); return true; }
    if (!response.ok || data?.error) {
      if (response.status >= 500 || response.ok) { await uncertain(ctx, job.id, 'El proveedor devolvió un resultado incierto; no se repetirá la llamada.'); return true; }
      await transaction(ctx, async client => {
        const failedUsage = normalizeUsage(data.usage); const requestId = typeof data.id === 'string' && data.id.length < 256 ? data.id : null;
        const attempt = await client.query(`update generation_attempts set state='rejected',responded_at=now(),request_id=$2,raw_usage=$3,
          next_reconcile_at=case when $4::text is null and $2::text is not null then now()+interval '1 minute' else null end where job_id=$1 returning id`,
        [job.id, requestId, JSON.stringify(failedUsage.raw), failedUsage.cost_usd]);
        await client.query(`insert into usage_receipts(attempt_id,revision,prompt_tokens,completion_tokens,cost_usd,raw_usage,source) values($1,1,$2,$3,$4,$5,'rejected_response')`,
          [attempt.rows[0].id, failedUsage.prompt_tokens, failedUsage.completion_tokens, failedUsage.cost_usd, JSON.stringify(failedUsage.raw)]);
        await client.query(`update generation_jobs set status='failed',usage_status=$3,error=$2,prompt_tokens=$4,completion_tokens=$5,cost_usd=$6,lease_owner=null,lease_until=null,updated_at=now() where id=$1`,
          [job.id, response.status === 429 ? 'El proveedor agotó la cuota. No se usó un modelo de pago.' : response.status === 401 ? 'La conexión fue revocada. Reconecta el proveedor.' : 'El proveedor rechazó la solicitud.',
          failedUsage.cost_usd !== null ? 'reported' : requestId ? 'pending' : 'unknown', failedUsage.prompt_tokens, failedUsage.completion_tokens, failedUsage.cost_usd]);
        if (response.status === 401) await client.query(`update provider_connections set state='revoked',revoked_at=now() where id=$1`, [job.connection_id]);
      }); return true;
    }
    const usage = normalizeUsage(data.usage); const requestId = typeof data.id === 'string' && data.id.length < 256 ? data.id : null;
    await ctx.control.query(`update generation_jobs set status='validating',updated_at=now() where id=$1 and status in ('running','uncertain')`, [job.id]);
    let artifact: ReturnType<typeof parseGeneration> | null = null; let validationError: string | null = null;
    try { artifact = parseGeneration(data); } catch (error) { validationError = error instanceof HttpError ? error.message : 'Artefacto inválido.'; }
    await transaction(ctx, async client => {
      const attempt = await client.query(`update generation_attempts set state='responded',request_id=$2,responded_at=now(),raw_usage=$3,
        next_reconcile_at=case when $4::text is null and $2::text is not null then now()+interval '1 minute' else null end where job_id=$1 returning id`, [job.id, requestId, JSON.stringify(usage.raw), usage.cost_usd]);
      await client.query(`insert into usage_receipts(attempt_id,revision,prompt_tokens,completion_tokens,cost_usd,raw_usage,source) values($1,1,$2,$3,$4,$5,'response')`, [attempt.rows[0].id, usage.prompt_tokens, usage.completion_tokens, usage.cost_usd, JSON.stringify(usage.raw)]);
      let versionId: string | null = null; let status = artifact ? 'completed' : 'failed';
      if (artifact && base?.content_hash === artifact.content_hash) { versionId = job.base_version_id; status = 'no_changes'; }
      else if (artifact) {
        const version = await client.query(`insert into app_versions(project_id,parent_version_id,prompt,html,manifest,content_hash,changelog) values($1,$2,$3,$4,$5,$6,$7) returning id`,
          [job.project_id, job.base_version_id, job.prompt, artifact.html, JSON.stringify(artifact.manifest), artifact.content_hash, JSON.stringify(artifact.changelog)]);
        versionId = version.rows[0].id;
      }
      await client.query(`update generation_jobs set status=$2,usage_status=$3,result_version_id=$4,error=$5,prompt_tokens=$6,completion_tokens=$7,cost_usd=$8,
        lease_owner=null,lease_until=null,updated_at=now() where id=$1`, [job.id, status, usage.cost_usd !== null ? 'reported' : requestId ? 'pending' : 'unknown', versionId, validationError, usage.prompt_tokens, usage.completion_tokens, usage.cost_usd]);
      if (usage.cost_usd !== null && Number(usage.cost_usd) > 0) await client.query(`update provider_connections set state='blocked',updated_at=now() where id=$1`, [job.connection_id]);
    });
    return true;
  } catch (error) {
    if (sent) await uncertain(ctx, job.id, 'El intento fue enviado y no pudo cerrarse. Se conserva el historial para revisión.');
    else await failPrepared(ctx, job, error, workerId);
    return true;
  } finally { clearInterval(heartbeat); }
}
export async function reconcileUsage(ctx: CoreContext) {
  const attempts = await ctx.control.query(`select a.*,c.secret_ciphertext,j.usage_status from generation_attempts a
    join provider_connections c on c.id=a.connection_id join generation_jobs j on j.id=a.job_id
    where a.request_id is not null and j.usage_status='pending' and a.next_reconcile_at<=now() limit 10`);
  for (const attempt of attempts.rows) {
    let usage: ReturnType<typeof normalizeUsage> | null = null;
    try {
      const result = await providerRequest(ctx, `generation?id=${encodeURIComponent(attempt.request_id)}`, decryptSecret(attempt.secret_ciphertext, ctx.config.encryptionKey));
      usage = normalizeUsage({ prompt_tokens: result.data?.tokens_prompt, completion_tokens: result.data?.tokens_completion, cost: result.data?.total_cost });
    } catch { /* Persist pending state and a bounded future check, never resend inference. */ }
    await transaction(ctx, async client => {
      const job = await client.query('select usage_status from generation_jobs where id=$1 for update', [attempt.job_id]);
      if (job.rows[0]?.usage_status !== 'pending') return;
      if (usage?.cost_usd !== null && usage?.cost_usd !== undefined) {
        const revision = await client.query('select coalesce(max(revision),0)+1 as revision from usage_receipts where attempt_id=$1', [attempt.id]);
        await client.query(`insert into usage_receipts(attempt_id,revision,prompt_tokens,completion_tokens,cost_usd,raw_usage,source) values($1,$2,$3,$4,$5,$6,'generation_lookup')`, [attempt.id, revision.rows[0].revision, usage.prompt_tokens, usage.completion_tokens, usage.cost_usd, JSON.stringify(usage.raw)]);
        await client.query(`update generation_jobs set usage_status='reported',prompt_tokens=coalesce($2,prompt_tokens),completion_tokens=coalesce($3,completion_tokens),cost_usd=$4,updated_at=now() where id=$1`, [attempt.job_id, usage.prompt_tokens, usage.completion_tokens, usage.cost_usd]);
        await client.query('update generation_attempts set next_reconcile_at=null where id=$1', [attempt.id]);
        if (Number(usage.cost_usd) > 0) await client.query(`update provider_connections set state='blocked',updated_at=now() where id=$1`, [attempt.connection_id]);
      } else {
        const exhausted = attempt.reconcile_checks >= 7;
        await client.query(`update generation_attempts set reconcile_checks=reconcile_checks+1,next_reconcile_at=case when $2 then null else now()+interval '5 minutes' end where id=$1`, [attempt.id, exhausted]);
        if (exhausted) await client.query(`update generation_jobs set usage_status='unknown',updated_at=now() where id=$1`, [attempt.job_id]);
      }
    });
  } return attempts.rows.length;
}

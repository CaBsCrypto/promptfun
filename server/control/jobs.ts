import type { Router } from 'express';
import type { CoreContext } from '../shared.js';
import { HttpError, asyncRoute } from '../shared.js';
import { authenticate, assertCsrf } from './auth.js';
import { jobDto, ownedProject, transaction } from './db.js';
import { preflight } from './providers.js';
import { assertNonDemo } from './demo-policy.js';
import { assertNoSecrets, hash, idempotencyKey, textInput, uuid } from './security.js';

export function mountJobs(router: Router, ctx: CoreContext) {
  router.post('/projects/:id/jobs', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); assertCsrf(ctx, req, user); assertNonDemo(user); const projectId = uuid(req.params.id);
    const prompt = textInput(req.body.prompt, 'Prompt', 20_000); assertNoSecrets(prompt);
    const model = textInput(req.body.model, 'Modelo', 200);
    const baseId = req.body.base_version_id ? uuid(req.body.base_version_id) : null;
    const key = idempotencyKey(req.get('Idempotency-Key')); const requestHash = hash(JSON.stringify({ projectId, prompt, model, baseId }));
    await ownedProject(ctx, projectId, user.id);
    const previous = await ctx.control.query('select * from generation_jobs where actor_id=$1 and idempotency_key=$2', [user.id, key]);
    if (previous.rows[0]) {
      if (previous.rows[0].request_hash !== requestHash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'La clave ya se utilizó con otra solicitud.');
      res.json({ job_id: previous.rows[0].id, job: jobDto(previous.rows[0]) }); return;
    }
    const checked = await preflight(ctx, user.id, model);
    const job = await transaction(ctx, async client => {
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`${user.id}:${key}`]);
      const duplicate = await client.query('select * from generation_jobs where actor_id=$1 and idempotency_key=$2', [user.id, key]);
      if (duplicate.rows[0]) {
        if (duplicate.rows[0].request_hash !== requestHash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'La clave ya se utilizó con otra solicitud.');
        return duplicate.rows[0];
      }
      const project = await client.query('select id from projects where id=$1 and owner_id=$2 for update', [projectId, user.id]);
      if (!project.rows[0]) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Proyecto no encontrado.');
      if (baseId) {
        const base = await client.query('select id from app_versions where project_id=$1 and id=$2', [projectId, baseId]);
        if (!base.rows[0]) throw new HttpError(422, 'INVALID_BASE_VERSION', 'La versión base no pertenece al proyecto.');
      }
      const day = new Date().toISOString().slice(0, 10);
      await client.query('insert into free_quota_days(owner_id,day) values($1,$2) on conflict do nothing', [user.id, day]);
      const quota = await client.query('select used,held from free_quota_days where owner_id=$1 and day=$2 for update', [user.id, day]);
      // A new HTTP key/model does not resolve an already submitted execution.
      // The project/quota locks serialize this guard with competing enqueues.
      const active = await client.query(`select id,status from generation_jobs where actor_id=$1 and (
        status in ('queued','running','validating') or
        (status='uncertain' and project_id=$2 and base_version_id is not distinct from $3::uuid and prompt=$4))
        order by case when status='uncertain' then 0 else 1 end limit 1`, [user.id, projectId, baseId, prompt]);
      if (active.rows[0]?.status === 'uncertain') throw new HttpError(409, 'GENERATION_REVIEW_REQUIRED', 'Un intento equivalente sigue incierto. Revisa y concilia su ejecución antes de repetirlo; cambiar la clave o el modelo no lo resuelve.');
      if (active.rows[0]) throw new HttpError(409, 'JOB_ALREADY_RUNNING', 'Espera a que termine la generación actual.');
      if (quota.rows[0].used + quota.rows[0].held >= checked.quota.limit || quota.rows[0].held >= checked.quota.remaining)
        throw new HttpError(429, 'FREE_QUOTA_EXHAUSTED', 'No queda cuota gratuita disponible para reservar.');
      const connection = await client.query(`select id from provider_connections where id=$1 and owner_id=$2 and state='active' for update`, [checked.connection.id, user.id]);
      if (!connection.rows[0]) throw new HttpError(409, 'PROVIDER_NOT_CONNECTED', 'La conexión fue revocada.');
      await client.query('update free_quota_days set held=held+1 where owner_id=$1 and day=$2', [user.id, day]);
      const result = await client.query(`insert into generation_jobs(project_id,actor_id,connection_id,base_version_id,prompt,model,idempotency_key,request_hash,quota_day)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`, [projectId, user.id, checked.connection.id, baseId, prompt, model, key, requestHash, day]);
      return result.rows[0];
    }); res.status(202).json({ job_id: job.id, job: jobDto(job) });
  }));
  router.get('/jobs/:id', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req);
    const result = await ctx.control.query('select * from generation_jobs where id=$1 and actor_id=$2', [uuid(req.params.id), user.id]);
    if (!result.rows[0]) throw new HttpError(404, 'JOB_NOT_FOUND', 'Trabajo no encontrado.');
    res.json({ job: jobDto(result.rows[0]) });
  }));
  router.get('/projects/:id/jobs', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); const id = uuid(req.params.id); await ownedProject(ctx, id, user.id);
    const result = await ctx.control.query('select * from generation_jobs where project_id=$1 and actor_id=$2 order by created_at desc limit 10', [id, user.id]);
    res.json({ jobs: result.rows.map(jobDto) });
  }));
}

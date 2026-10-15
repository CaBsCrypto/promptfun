import type { Router } from 'express';
import type { CoreContext } from '../shared.js';
import { HttpError, asyncRoute } from '../shared.js';
import { authenticate, assertCsrf } from './auth.js';
import { ownedProject, publicProject, publicVersion, transaction } from './db.js';
import { artifactHash, assertNoSecrets, hash, idempotencyKey, signPreviewToken, textInput, uuid, validateHtml } from './security.js';
import type { CapabilityManifest } from '../../shared/contracts.js';
import { durableMutation } from './mutations.js';
import { assertNonDemo } from './demo-policy.js';

const LEGACY_MANIFEST: CapabilityManifest = { version: 1, records: { collections: [] }, auth: false, files: false, connectors: [] };
export function sanitizeLegacyItems(body: unknown) {
  const items = (body as any)?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 10) throw new HttpError(422, 'INVALID_IMPORT', 'Selecciona entre 1 y 10 borradores.');
  const safe = items.map((item: any) => {
    if (!item || typeof item !== 'object') throw new HttpError(422, 'INVALID_IMPORT', 'Borrador inválido.');
    const result = { legacy_id: textInput(item.legacy_id, 'Referencia antigua', 128), title: textInput(item.title, 'Título', 120),
      description: textInput(item.description, 'Descripción', 2000, true), prompt: textInput(item.prompt, 'Prompt', 20_000, true), html: validateHtml(item.html) };
    assertNoSecrets(JSON.stringify(result)); return result;
  });
  if (new Set(safe.map(i => i.legacy_id)).size !== safe.length || safe.reduce((n, i) => n + Buffer.byteLength(i.html), 0) > 2 * 1024 * 1024)
    throw new HttpError(422, 'INVALID_IMPORT', 'Referencias duplicadas o lote demasiado grande.');
  return safe;
}
export function mountProjects(router: Router, ctx: CoreContext) {
  router.get('/projects', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req);
    const result = await ctx.control.query('select * from projects where owner_id=$1 order by updated_at desc limit 100', [user.id]);
    res.json({ projects: result.rows });
  }));
  router.post('/projects', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); assertCsrf(ctx, req, user);
    const title = textInput(req.body.title, 'Título', 120); const description = textInput(req.body.description, 'Descripción', 2000, true);
    const result = await durableMutation(ctx,req,user.id,'project.create',{title,description},async client=>{
      const inserted=await client.query('insert into projects(owner_id,title,description) values($1,$2,$3) returning *',[user.id,title,description]);
      return {project:inserted.rows[0]};
    });res.status(result.status).json(result.body);
  }));
  router.get('/projects/:id', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); res.json({ project: await ownedProject(ctx, uuid(req.params.id), user.id) });
  }));
  router.patch('/projects/:id', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); assertCsrf(ctx, req, user); const id = uuid(req.params.id);
    const project = await ownedProject(ctx, id, user.id);
    const title = req.body.title === undefined ? project.title : textInput(req.body.title, 'Título', 120);
    const description = req.body.description === undefined ? project.description : textInput(req.body.description, 'Descripción', 2000, true);
    const result = await ctx.control.query('update projects set title=$1,description=$2,updated_at=now() where id=$3 and owner_id=$4 returning *', [title, description, id, user.id]);
    res.json({ project: result.rows[0] });
  }));
  router.get('/projects/:id/versions', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); const id = uuid(req.params.id); await ownedProject(ctx, id, user.id);
    const result = await ctx.control.query('select * from app_versions where project_id=$1 order by created_at desc limit 100', [id]);
    res.json({ versions: result.rows });
  }));
  router.post('/projects/:id/publish', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); assertCsrf(ctx, req, user); assertNonDemo(user); const id = uuid(req.params.id); const versionId = uuid(req.body.version_id);
    const result = await durableMutation(ctx,req,user.id,'project.publish',{id,versionId},async client => {
      const project = await client.query('select * from projects where id=$1 and owner_id=$2 for update', [id, user.id]);
      if (!project.rows[0]) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Proyecto no encontrado.');
      const version = await client.query('select * from app_versions where id=$1 and project_id=$2', [versionId, id]);
      if (!version.rows[0]) throw new HttpError(404, 'VERSION_NOT_FOUND', 'Versión no encontrada.');
      const updated = await client.query('update projects set published_version_id=$1,updated_at=now() where id=$2 returning *', [versionId, id]);
      if(project.rows[0].published_version_id!==versionId)await client.query('insert into public.publication_history(project_id,version_id) values($1,$2)',[id,versionId]);
      return { project: updated.rows[0], version: version.rows[0] };
    },200); res.status(result.status).json(result.body);
  }));
  router.post('/projects/:id/preview-token', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); assertCsrf(ctx, req, user); assertNonDemo(user); const id = uuid(req.params.id); await ownedProject(ctx, id, user.id);
    let versionId: string;
    if (req.body.version_id) versionId = uuid(req.body.version_id);
    else {
      const latest = await ctx.control.query('select id from app_versions where project_id=$1 order by created_at desc limit 1', [id]);
      if (!latest.rows[0]) throw new HttpError(404, 'VERSION_NOT_FOUND', 'Genera una versión antes de abrir el preview.');
      versionId = latest.rows[0].id;
    }
    const version = await ctx.control.query('select id from app_versions where id=$1 and project_id=$2', [versionId, id]);
    if (!version.rows[0]) throw new HttpError(404, 'VERSION_NOT_FOUND', 'Versión no encontrada.');
    const url = new URL(`/apps/${id}/versions/${versionId}`, ctx.config.runtimeOrigin);
    url.searchParams.set('preview_token', signPreviewToken(ctx, id, versionId, user.id));
    res.set('Cache-Control', 'no-store'); res.json({ url: url.toString() });
  }));
  router.post('/projects/:id/import', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); assertCsrf(ctx, req, user); assertNonDemo(user); const id = uuid(req.params.id);
    const key = idempotencyKey(req.get('Idempotency-Key')); const items = sanitizeLegacyItems(req.body); const manifestHash = hash(JSON.stringify(items));
    const result = await transaction(ctx, async client => {
      const project = await client.query('select * from projects where id=$1 and owner_id=$2 for update', [id, user.id]);
      if (!project.rows[0]) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Proyecto no encontrado.');
      if (project.rows[0].published_version_id) throw new HttpError(409, 'IMPORT_REQUIRES_DRAFT', 'Importa en un borrador privado.');
      const existing = await client.query('select * from migration_batches where owner_id=$1 and (idempotency_key=$2 or (project_id=$3 and manifest_hash=$4))', [user.id, key, id, manifestHash]);
      if (existing.rows[0]) {
        const batch = existing.rows[0];
        if (batch.project_id !== id || batch.manifest_hash !== manifestHash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'La clave ya se usó con otro contenido.');
        const versions = await client.query('select * from app_versions where id=any($1::uuid[]) order by created_at', [batch.version_ids]);
        return { imported: versions.rows.length, versions: versions.rows, batch_id: batch.id, reused: true };
      }
      const versions: any[] = [];
      for (const item of items) {
        const version = await client.query(`insert into app_versions(project_id,prompt,html,manifest,content_hash,changelog) values($1,$2,$3,$4,$5,$6) returning *`,
          [id, item.prompt, item.html, JSON.stringify(LEGACY_MANIFEST), artifactHash(item.html, LEGACY_MANIFEST), JSON.stringify([`Borrador importado: ${item.legacy_id}. Sin ejecución, publicación ni registros financieros.`])]);
        versions.push(version.rows[0]);
      }
      const batch = await client.query('insert into migration_batches(owner_id,project_id,manifest_hash,idempotency_key,version_ids) values($1,$2,$3,$4,$5) returning id', [user.id, id, manifestHash, key, versions.map(v => v.id)]);
      return { imported: versions.length, versions, batch_id: batch.rows[0].id, reused: false };
    }); res.status(result.reused ? 200 : 201).json(result);
  }));
  router.get('/public/projects', asyncRoute(async (_req, res) => {
    const result = await ctx.control.query('select * from projects where published_version_id is not null order by updated_at desc limit 100');
    res.json({ projects: result.rows.map(publicProject) });
  }));
  router.get('/public/projects/:id', asyncRoute(async (req, res) => {
    const id = uuid(req.params.id);
    const result = await ctx.control.query('select * from projects where id=$1 and published_version_id is not null', [id]);
    const project = result.rows[0]; if (!project) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Proyecto público no encontrado.');
    const version = await ctx.control.query('select * from app_versions where id=$1 and project_id=$2', [project.published_version_id, id]);
    const feedback = await ctx.control.query(`select id,project_id,version_id,text,created_at from feedback where project_id=$1 and version_id=$2 and status='approved' order by created_at desc limit 100`, [id, project.published_version_id]);
    const history=await ctx.control.query(`select h.id,h.version_id,h.published_at,v.content_hash,v.changelog from public.publication_history h join public.app_versions v on v.project_id=h.project_id and v.id=h.version_id where h.project_id=$1 order by h.published_at desc,h.id desc limit 100`,[id]);
    res.json({ project: publicProject(project), version: publicVersion(version.rows[0]), feedback: feedback.rows,history:history.rows,
      preview_url: new URL(`/apps/${id}/versions/${project.published_version_id}`, ctx.config.runtimeOrigin).toString(),
      runtime_url: new URL(`/apps/${id}/versions/${project.published_version_id}`, ctx.config.runtimeOrigin).toString() });
  }));
  router.post('/public/projects/:id/feedback', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); assertCsrf(ctx, req, user); assertNonDemo(user); const id = uuid(req.params.id); const versionId = uuid(req.body.version_id); const text = textInput(req.body.text, 'Comentario', 2000);
    const result = await ctx.control.query(`insert into feedback(project_id,version_id,author_id,text)
      select id,$2,$3,$4 from projects where id=$1 and published_version_id=$2 returning id,project_id,version_id,text,created_at,status`, [id, versionId, user.id, text]);
    if (!result.rows[0]) throw new HttpError(409, 'VERSION_NOT_PUBLIC', 'La versión ya no está publicada.');
    res.status(201).json({ feedback: result.rows[0] });
  }));
  router.get('/projects/:id/feedback', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); const id = uuid(req.params.id); await ownedProject(ctx, id, user.id);
    const result = await ctx.control.query('select id,project_id,version_id,text,status,created_at from feedback where project_id=$1 order by created_at desc limit 100', [id]);
    res.json({ feedback: result.rows });
  }));
  router.patch('/projects/:id/feedback/:feedbackId', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); assertCsrf(ctx, req, user); const id = uuid(req.params.id); await ownedProject(ctx, id, user.id);
    if (!['approved', 'rejected'].includes(req.body.status)) throw new HttpError(422, 'INVALID_MODERATION', 'Estado de moderación inválido.');
    const result = await ctx.control.query('update feedback set status=$1,moderated_at=now() where id=$2 and project_id=$3 returning id,project_id,version_id,text,status,created_at', [req.body.status, uuid(req.params.feedbackId), id]);
    if (!result.rows[0]) throw new HttpError(404, 'FEEDBACK_NOT_FOUND', 'Comentario no encontrado.');
    res.json({ feedback: result.rows[0] });
  }));
}

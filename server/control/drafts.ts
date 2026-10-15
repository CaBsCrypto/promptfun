import type { Router } from 'express';
import type { ProjectDraft, SaveProjectDraft } from '../../shared/contracts.js';
import { asyncRoute, HttpError, type CoreContext } from '../shared.js';
import { authenticate, assertCsrf } from './auth.js';
import { ownedProject, transaction } from './db.js';
import { assertNoSecrets, uuid } from './security.js';

const emptyDraft=(projectId:string):ProjectDraft=>({project_id:projectId,prompt:'',model:'',base_version_id:null,revision:0,updated_at:null});
function draftDto(row:any):ProjectDraft {
  return {project_id:row.project_id,prompt:row.prompt,model:row.model,base_version_id:row.base_version_id,
    revision:row.revision,updated_at:new Date(row.updated_at).toISOString()};
}
function input(value:any):SaveProjectDraft {
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.prompt!=='string'||value.prompt.length>20000||
    value.prompt.includes('\0')||Buffer.from(value.prompt,'utf8').toString('utf8')!==value.prompt||
    typeof value.model!=='string'||value.model.length>200||/[\x00-\x1f]/.test(value.model)||Buffer.from(value.model,'utf8').toString('utf8')!==value.model||
    !Number.isInteger(value.revision)||value.revision<0||value.revision>2147483646)
    throw new HttpError(422,'INVALID_DRAFT','El borrador o su revisión no son válidos.');
  if(value.base_version_id!==null&&typeof value.base_version_id!=='string')throw new HttpError(422,'INVALID_DRAFT','Selecciona una versión base válida o ninguna.');
  assertNoSecrets(value.prompt);assertNoSecrets(value.model);
  // Preserve the prompt exactly, including whitespace and indentation.
  return {prompt:value.prompt,model:value.model,base_version_id:value.base_version_id===null?null:uuid(value.base_version_id).toLowerCase(),revision:value.revision};
}
const sameContent=(row:any,request:SaveProjectDraft)=>row.prompt===request.prompt&&row.model===request.model&&row.base_version_id===request.base_version_id;

export function mountDrafts(router:Router,ctx:CoreContext) {
  router.get('/projects/:id/draft',asyncRoute(async(req,res)=>{
    const user=await authenticate(ctx,req),projectId=uuid(req.params.id).toLowerCase();await ownedProject(ctx,projectId,user.id);
    const result=await ctx.control.query('select * from public.project_drafts where project_id=$1',[projectId]);
    res.json({draft:result.rows[0]?draftDto(result.rows[0]):emptyDraft(projectId)});
  }));
  router.put('/projects/:id/draft',asyncRoute(async(req,res)=>{
    const user=await authenticate(ctx,req);assertCsrf(ctx,req,user);const projectId=uuid(req.params.id).toLowerCase(),request=input(req.body);
    const draft=await transaction(ctx,async client=>{
      // Serialize first insert and later revisions on the existing owner/project row.
      const project=await client.query('select id from public.projects where id=$1 and owner_id=$2 for update',[projectId,user.id]);
      if(!project.rows[0])throw new HttpError(404,'PROJECT_NOT_FOUND','Proyecto no encontrado.');
      const existing=(await client.query('select * from public.project_drafts where project_id=$1',[projectId])).rows[0];
      // A committed PUT whose response was lost can be acknowledged once without
      // overwriting a later revision or changing the saved timestamp.
      if(existing&&existing.revision===request.revision+1&&sameContent(existing,request))return draftDto(existing);
      if((existing?.revision||0)!==request.revision)throw new HttpError(409,'DRAFT_CONFLICT','El borrador cambió en otra pestaña. Conserva tu texto y revisa la versión guardada antes de reemplazarla.');
      if(request.base_version_id){
        const base=await client.query('select id from public.app_versions where project_id=$1 and id=$2',[projectId,request.base_version_id]);
        if(!base.rows[0])throw new HttpError(422,'INVALID_BASE_VERSION','La versión base no pertenece al proyecto.');
      }
      const saved=existing?await client.query(`update public.project_drafts set prompt=$2,model=$3,base_version_id=$4,
        revision=revision+1,updated_at=now() where project_id=$1 returning *`,[projectId,request.prompt,request.model,request.base_version_id]):
        await client.query(`insert into public.project_drafts(project_id,prompt,model,base_version_id,revision)
          values($1,$2,$3,$4,1) returning *`,[projectId,request.prompt,request.model,request.base_version_id]);
      return draftDto(saved.rows[0]);
    });res.json({draft});
  }));
}

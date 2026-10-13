import { Router } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { CapabilityManifest } from '../../shared/contracts.js';
import { asyncRoute, assertOrigin, HttpError, type CoreContext } from '../shared.js';
import { artifactCsp, escapeHtml, verifyPreviewToken } from './security.js';
import { APP_SDK, RUNTIME_BRIDGE } from './sdk.js';
import { decryptSecret, encryptSecret, equalSecret, artifactHash, validateManifest, validateHtml } from '../control/security.js';
import { signInIdentity, validateIdentity, revokeIdentity, identityUserId, identitySubject, verifyIdentityEmail, sendIdentityVerification } from '../control/identity.js';
import { createObjectStore } from './storage.js';
import { mutationRequest, mutationReceipt, saveMutationReceipt } from './mutations.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const safeId = (value: unknown) => { if(typeof value!=='string'||!uuid.test(value)) throw new HttpError(400,'INVALID_ID','Identificador inválido.'); return value; };
const cookieName = (appId: string) => 'pf_app_'+appId.replaceAll('-','');
interface RuntimeSession { user_id: string; csrf_token: string; email?: string; auth_token_ciphertext: string }

export function createRuntimeRouter(ctx: CoreContext) {
  const router = Router();
  const objects = createObjectStore(ctx.config);
  async function version(req: Request, id?: string) {
    const appId = safeId(req.params.appId);
    const selected = id || req.get('X-App-Version');
    const result = await ctx.control.query(`select v.*,p.owner_id,p.published_version_id,p.title from public.app_versions v join public.projects p on p.id=v.project_id where p.id=$1 and v.id=$2`,[appId,safeId(selected)]);
    const row = result.rows[0]; if(!row)throw new HttpError(404,'VERSION_NOT_FOUND','Versión no encontrada.');
    row.manifest=validateManifest(row.manifest);
    if(artifactHash(validateHtml(row.html),row.manifest)!==row.content_hash)throw new HttpError(503,'ARTIFACT_INTEGRITY','El artefacto no coincide con la versión registrada.');
    if(row.published_version_id!==row.id){
      const token = String(req.get('X-Preview-Token') || req.query.preview_token || '');
      const claims=verifyPreviewToken(token,ctx.config.runtimeSigningKey,appId,row.id);
      if(claims.sub!==row.owner_id)throw new HttpError(403,'INVALID_PREVIEW','Vista previa no autorizada.');
    }
    await ctx.apps.query('insert into public.app_instances(id) values($1) on conflict do nothing',[appId]);
    return row as {id:string;project_id:string;html:string;manifest:CapabilityManifest;title:string};
  }
  async function session(req: Request, required=true, checkProvider=true): Promise<RuntimeSession|null> {
    const appId=safeId(req.params.appId); const token=req.cookies?.[cookieName(appId)];
    if(!token){if(required)throw new HttpError(401,'LOGIN_REQUIRED','Inicia sesión en esta app para guardar tus datos.');return null;}
    const result=await ctx.apps.query(`select s.user_id,s.csrf_token,s.auth_token_ciphertext,u.email from public.app_sessions s join public.app_users u on u.id=s.user_id join public.app_memberships m on m.app_id=s.app_id and m.user_id=s.user_id where s.token_hash=$1 and s.app_id=$2 and s.expires_at>now()`,[hash(token),appId]);
    const row=result.rows[0];if(!row){if(required)throw new HttpError(401,'SESSION_EXPIRED','La sesión de esta app caducó.');return null;}
    if(!['GET','HEAD'].includes(req.method) && !equalSecret(req.get('X-CSRF-Token')||'',row.csrf_token))throw new HttpError(403,'INVALID_CSRF','Recarga la app antes de continuar.');
    if(checkProvider){
      const identity=await validateIdentity(ctx,'apps',decryptSecret(row.auth_token_ciphertext,ctx.config.encryptionKey));
      if(identityUserId(identity,'apps')!==row.user_id)throw new HttpError(401,'SESSION_EXPIRED','La identidad de esta sesión no coincide.');
      await ctx.apps.query('update public.app_sessions set auth_token_ciphertext=$2,identity_checked_at=now() where token_hash=$1',[hash(token),encryptSecret(identity.sessionToken,ctx.config.encryptionKey)]);
    }
    return row;
  }
  router.use('/apps/:appId/api',(req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    try { if(!['GET','HEAD'].includes(req.method))assertOrigin(req,ctx.config.runtimeOrigin);next(); }catch(error){next(error);}
  });
  router.get('/apps/:appId/versions/:versionId',asyncRoute(async(req,res)=>{
    const v=await version(req,req.params.versionId);const token=typeof req.query.preview_token==='string'?'?preview_token='+encodeURIComponent(req.query.preview_token):'';
    res.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'self'; style-src 'self'; frame-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors ${ctx.config.platformOrigin}`);
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
    res.type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(v.title)}</title><link rel="stylesheet" href="/runtime.css"></head><body data-version="${v.id}"><header><strong>${escapeHtml(v.title)}</strong><p id="status" role="status">Cargando sesión de la app…</p><form id="auth"><label>Correo<input name="email" type="email" required autocomplete="email"></label><label>Contraseña<input name="password" type="password" minlength="8" required autocomplete="current-password"></label><button value="login">Entrar</button><button value="signup">Crear cuenta</button></form><form id="verify" hidden><label>Código de correo<input name="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"></label><button value="verify-email">Confirmar correo</button><button value="resend-verification" formnovalidate>Reenviar código</button></form><button id="logout">Cerrar sesión</button></header><iframe id="app" title="App generada" sandbox="allow-scripts allow-forms allow-downloads" src="/apps/${v.project_id}/versions/${v.id}/artifact${token}"></iframe><script src="/runtime-bridge.js"></script></body></html>`);
  }));
  router.get('/apps/:appId/versions/:versionId/artifact',asyncRoute(async(req,res)=>{
    const v=await version(req,req.params.versionId);
    res.setHeader('Content-Security-Policy',artifactCsp(ctx.config.runtimeOrigin,ctx.config.platformOrigin).replace('sandbox allow-scripts allow-forms','sandbox allow-scripts allow-forms allow-downloads'));
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
    const script='<script src="'+ctx.config.runtimeOrigin+'/app-sdk.js"></script>';
    const head=/<head(?:\s[^>]*)?>/i;
    const html=head.test(v.html)?v.html.replace(head,match=>match+script):
      /<!doctype[^>]*>/i.test(v.html)?v.html.replace(/<!doctype[^>]*>/i,match=>match+script):script+v.html;
    res.type('html').send(html);
  }));
  router.get('/app-sdk.js',(_req,res)=>res.type('js').send(APP_SDK));
  router.get('/runtime-bridge.js',(_req,res)=>res.type('js').send(RUNTIME_BRIDGE));
  router.get('/runtime.css',(_req,res)=>res.type('css').send(`*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;font:14px system-ui;background:#12283a;color:#eef8fb}header{padding:12px 20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center}strong{font-size:18px}form{display:flex;gap:8px;flex-wrap:wrap}label{display:flex;gap:6px;align-items:center}input,button{font:inherit;padding:8px;border:1px solid #527285;border-radius:6px}input{background:#eef8fb;color:#12283a}button{background:#33c6d8;color:#12283a;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #ffca75}iframe{display:block;width:100%;height:calc(100vh - 135px);min-height:480px;border:0;background:white}#status{flex:1;min-width:180px}@media(max-width:600px){header{padding:10px}form{width:100%}label{width:100%}input{flex:1}iframe{height:70vh}}`));
  router.get('/apps/:appId/api/session',asyncRoute(async(req,res)=>{
    const v=await version(req);if(!v.manifest.auth){res.json({user:null,csrf_token:null});return;}const s=await session(req,false);res.json({user:s?{id:s.user_id,email:s.email}:null,csrf_token:s?.csrf_token||null});
  }));
  router.post('/apps/:appId/api/auth/:action',asyncRoute(async(req,res)=>{
    const v=await version(req);if(!v.manifest.auth)throw new HttpError(403,'CAPABILITY_DENIED','Esta versión no habilita cuentas.');
    const appId=v.project_id;
    if(['verify-email','resend-verification'].includes(req.params.action)){
      const {email,otp}=req.body;
      if(typeof email!=='string'||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'INVALID_LOGIN','Correo inválido.');
      if(req.params.action==='verify-email'){
        if(typeof otp!=='string'||!/^\d{6}$/.test(otp))throw new HttpError(400,'INVALID_OTP','Introduce el código de seis dígitos.');
        await verifyIdentityEmail(ctx,'apps',email.toLowerCase(),otp);
      }else await sendIdentityVerification(ctx,'apps',email.toLowerCase());
      res.json({ok:true});return;
    }
    if(req.params.action==='logout'){
      const s=await session(req,true,false);const token=req.cookies[cookieName(appId)];await ctx.apps.query('delete from public.app_sessions where token_hash=$1',[hash(token)]);
      await revokeIdentity(ctx,'apps',decryptSecret(s!.auth_token_ciphertext,ctx.config.encryptionKey)).catch(()=>{});
      res.clearCookie(cookieName(appId),{path:'/apps/'+appId});res.json({ok:true});return;
    }
    if(!['login','signup'].includes(req.params.action))throw new HttpError(404,'NOT_FOUND','Operación no disponible.');
    const {email,password}=req.body;
    if(typeof email!=='string'||email.length>254||!email.includes('@')||typeof password!=='string'||password.length<8||password.length>128)throw new HttpError(400,'INVALID_LOGIN','Usa un correo válido y una contraseña de 8 a 128 caracteres.');
    const identity=await signInIdentity(ctx,'apps',email.toLowerCase(),password,req.params.action==='signup');
    if('confirmation_required' in identity){res.status(202).json({confirmation_required:true});return;}
    const userId=identityUserId(identity,'apps');
    const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url');
    const expires=new Date(Math.min(Date.now()+3600000,identity.expiresAt?Date.parse(identity.expiresAt):Infinity));
    const client=await ctx.apps.connect();try{
      await client.query('begin');
      const inserted=await client.query(`insert into public.app_users(id,auth_provider,auth_subject,email) values($1,$2,$3,$4) on conflict(id) do update set email=excluded.email where app_users.auth_provider=excluded.auth_provider and app_users.auth_subject=excluded.auth_subject returning id`,[userId,identity.provider,identitySubject(identity),identity.email]);
      if(!inserted.rowCount)throw new HttpError(409,'IDENTITY_CONFLICT','No se pudo asociar la identidad de esta app.');
      await client.query('insert into public.app_memberships(app_id,user_id) values($1,$2) on conflict do nothing',[appId,userId]);
      await client.query(`insert into public.app_sessions(token_hash,app_id,user_id,csrf_token,expires_at,auth_token_ciphertext) values($1,$2,$3,$4,$5,$6)`,[hash(token),appId,userId,csrf,expires.toISOString(),encryptSecret(identity.sessionToken,ctx.config.encryptionKey)]);
      await client.query('commit');
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
    res.cookie(cookieName(appId),token,{httpOnly:true,secure:ctx.config.production,sameSite:'lax',path:'/apps/'+appId,maxAge:expires.getTime()-Date.now()});res.json({user:{id:userId,email:identity.email},csrf_token:csrf});
  }));
  async function recordContext(req:Request){
    const v=await version(req);if(!v.manifest.auth)throw new HttpError(403,'CAPABILITY_DENIED','Esta versión no habilita cuentas.');const s=(await session(req))!;const collection=req.params.collection;
    if(!v.manifest.records.collections.includes(collection))throw new HttpError(403,'CAPABILITY_DENIED','Colección no habilitada para esta versión.');
    return {v,s,collection};
  }
  const validData=(input:unknown)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Buffer.byteLength(JSON.stringify(input))>65536)throw new HttpError(400,'INVALID_RECORD','El registro debe ser un objeto de hasta 64 KiB.');return input;};
  async function checkedData(input:unknown,client:Pick<CoreContext['apps'],'query'>=ctx.apps){
    const data=validData(input);
    const size=await client.query('select octet_length($1::jsonb::text) as size',[JSON.stringify(data)]);
    if(size.rows[0].size>65536)throw new HttpError(400,'INVALID_RECORD','El registro debe ser un objeto de hasta 64 KiB.');return data;
  }
  router.get('/apps/:appId/api/records/:collection',asyncRoute(async(req,res)=>{
    const {v,s,collection}=await recordContext(req);const result=await ctx.apps.query('select id,data,created_at,updated_at from public.app_records where app_id=$1 and user_id=$2 and collection=$3 order by created_at desc limit 1000',[v.project_id,s.user_id,collection]);res.json({records:result.rows});
  }));
  router.get('/apps/:appId/api/records/:collection/:id',asyncRoute(async(req,res)=>{
    const {v,s,collection}=await recordContext(req);const result=await ctx.apps.query('select id,data,created_at,updated_at from public.app_records where app_id=$1 and user_id=$2 and collection=$3 and id=$4',[v.project_id,s.user_id,collection,safeId(req.params.id)]);if(!result.rowCount)throw new HttpError(404,'NOT_FOUND','Registro no encontrado.');res.json({record:result.rows[0]});
  }));
  router.post('/apps/:appId/api/records/:collection',asyncRoute(async(req,res)=>{
    const {v,s,collection}=await recordContext(req);const data=validData(req.body.data);
    const request=mutationRequest(req,'record.create',v.id,{collection,data});const client=await ctx.apps.connect();
    try{await client.query('begin');await client.query('select pg_advisory_xact_lock(hashtext($1))',[v.project_id]);
      const receipt=await mutationReceipt(client,v.project_id,s.user_id,request);
      if(receipt){await client.query('commit');res.status(receipt.status).json(receipt.body);return;}
      const count=await client.query('select count(*)::int as count from public.app_records where app_id=$1',[v.project_id]);
      if(count.rows[0].count>=1000)throw new HttpError(409,'RECORD_QUOTA','Esta app alcanzó su límite de 1.000 registros.');
      const result=await client.query('insert into public.app_records(app_id,user_id,collection,data) values($1,$2,$3,$4) returning id,data,created_at,updated_at',[v.project_id,s.user_id,collection,await checkedData(data,client)]);
      const response={record:result.rows[0]};await saveMutationReceipt(client,v.project_id,s.user_id,request,201,response);await client.query('commit');res.status(201).json(response);
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
  }));
  router.patch('/apps/:appId/api/records/:collection/:id',asyncRoute(async(req,res)=>{
    const {v,s,collection}=await recordContext(req);const result=await ctx.apps.query('update public.app_records set data=$5,updated_at=now() where app_id=$1 and user_id=$2 and collection=$3 and id=$4 returning id,data,created_at,updated_at',[v.project_id,s.user_id,collection,safeId(req.params.id),await checkedData(req.body.data)]);if(!result.rowCount)throw new HttpError(404,'NOT_FOUND','Registro no encontrado.');res.json({record:result.rows[0]});
  }));
  router.delete('/apps/:appId/api/records/:collection/:id',asyncRoute(async(req,res)=>{
    const {v,s,collection}=await recordContext(req);const result=await ctx.apps.query('delete from public.app_records where app_id=$1 and user_id=$2 and collection=$3 and id=$4',[v.project_id,s.user_id,collection,safeId(req.params.id)]);if(!result.rowCount)throw new HttpError(404,'NOT_FOUND','Registro no encontrado.');res.json({ok:true});
  }));
  async function filesContext(req:Request){const v=await version(req);if(!v.manifest.auth||!v.manifest.files)throw new HttpError(403,'CAPABILITY_DENIED','Los archivos no están habilitados.');const s=(await session(req))!;return {v,s};}
  router.get('/apps/:appId/api/files',asyncRoute(async(req,res)=>{const {v,s}=await filesContext(req);const result=await ctx.apps.query('select id,name,mime_type,size_bytes,sha256,created_at from public.app_files where app_id=$1 and user_id=$2 order by created_at desc limit 1000',[v.project_id,s.user_id]);res.json({files:result.rows});}));
  router.post('/apps/:appId/api/files',asyncRoute(async(req,res)=>{
    const {v,s}=await filesContext(req);const {name,mime_type,base64}=req.body;
    if(typeof name!=='string'||name.length>160||typeof mime_type!=='string'||mime_type.length>100||typeof base64!=='string'||base64.length>6990508||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new HttpError(400,'INVALID_FILE','Archivo inválido; máximo 5 MiB.');
    const bytes=Buffer.from(base64,'base64');if(!bytes.length||bytes.length>5242880)throw new HttpError(400,'FILE_SIZE','Archivo vacío o mayor que 5 MiB.');
    if(bytes.toString('base64')!==base64)throw new HttpError(400,'INVALID_FILE','La codificación del archivo es inválida.');
    const request=mutationRequest(req,'file.upload',v.id,{name,mime_type,size:bytes.length,sha256:hash(bytes)});
    const id=randomUUID(),objectPath=v.project_id+'/'+s.user_id+'/'+id,client=await ctx.apps.connect();
    let objectAttempted=false;
    try{
      await client.query('begin');await client.query('select pg_advisory_xact_lock(hashtext($1))',[v.project_id]);
      const receipt=await mutationReceipt(client,v.project_id,s.user_id,request);
      if(receipt){await client.query('commit');res.status(receipt.status).json(receipt.body);return;}
      const size=await client.query('select coalesce(sum(size_bytes),0)::int as used,count(*)::int as count from public.app_files where app_id=$1',[v.project_id]);if(size.rows[0].used+bytes.length>26214400||size.rows[0].count>=1000)throw new HttpError(409,'FILE_QUOTA','Esta app alcanzó su límite de archivos (25 MiB o 1.000 objetos).');
      objectAttempted=true;await objects.put(objectPath,bytes);
      const inserted=await client.query('insert into public.app_files(id,app_id,user_id,name,mime_type,size_bytes,object_path,sha256) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,name,mime_type,size_bytes,sha256',[id,v.project_id,s.user_id,name,mime_type,bytes.length,objectPath,hash(bytes)]);
      const response={file:inserted.rows[0]};await saveMutationReceipt(client,v.project_id,s.user_id,request,201,response);await client.query('commit');res.status(201).json(response);
    }catch(error){
      await client.query('rollback').catch(()=>{});
      // An interrupted COMMIT is ambiguous: do not delete an object whose metadata might be durable.
      if(objectAttempted){
        const persisted=await client.query('select id from public.app_files where id=$1',[id]).catch(()=>null);
        if(persisted && !persisted.rowCount)await objects.delete(objectPath).catch(()=>{});
      }
      throw error;
    }finally{client.release();}
  }));
  router.get('/apps/:appId/api/files/:id',asyncRoute(async(req,res)=>{
    const {v,s}=await filesContext(req);const result=await ctx.apps.query('select * from public.app_files where id=$1 and app_id=$2 and user_id=$3',[safeId(req.params.id),v.project_id,s.user_id]);const file=result.rows[0];if(!file)throw new HttpError(404,'NOT_FOUND','Archivo no encontrado.');
    const bytes=await objects.get(file.object_path,file);res.json({file:{id:file.id,name:file.name,mime_type:file.mime_type,base64:bytes.toString('base64')}});
  }));
  router.post('/apps/:appId/api/connectors',asyncRoute(async(req,res)=>{
    const v=await version(req);if(!v.manifest.auth||req.body.name!=='github.repository'||!v.manifest.connectors.includes('github.repository'))throw new HttpError(403,'CAPABILITY_DENIED','Conector no habilitado.');await session(req);
    // A fixed destination and redirect:error prevent generated code from turning this into an open proxy.
    const response=await fetch('https://api.github.com/repos/CaBsCrypto/promptfun',{headers:{Accept:'application/vnd.github+json','User-Agent':'promptfun-runtime'},redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new HttpError(response.status===429?429:503,'CONNECTOR_UNAVAILABLE','GitHub no está disponible; intenta nuevamente más tarde.');const data=await response.json() as any;
    res.json({result:{name:data.full_name,description:data.description,url:data.html_url,updated_at:data.updated_at,language:data.language}});
  }));
  return router;
}

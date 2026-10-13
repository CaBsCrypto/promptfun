import express from 'express';
import cookieParser from 'cookie-parser';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { loadConfig } from './server/config.js';
import { createControlRouter } from './server/control/index.js';
import { authenticate } from './server/control/auth.js';
import { createMarketRouter } from './server/market/index.js';
import { createRuntimeRouter } from './server/runtime/index.js';
import { HttpError, type CoreContext } from './server/shared.js';
import { databaseOptions } from './server/control/database.js';

export async function createServers() {
 const config=loadConfig();
 const context:CoreContext={config,control:new Pool({...databaseOptions(config.controlDatabaseUrl),connectionTimeoutMillis:3000}),apps:new Pool({...databaseOptions(config.appsDatabaseUrl),connectionTimeoutMillis:3000})};
 const platform=express(),runtime=express();
 for(const app of [platform,runtime]){
  app.disable('x-powered-by');app.use(express.json({limit:'8mb'}));app.use(cookieParser());
  app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');next();});
  const counts=new Map<string,{count:number,until:number}>();
  app.use((req,res,next)=>{
   if(!req.path.includes('/api'))return next();
   const key=req.ip||'local';const now=Date.now();let entry=counts.get(key);
   if(!entry||entry.until<now){entry={count:0,until:now+60000};counts.set(key,entry);}
   if(++entry.count>180){res.setHeader('Retry-After','60');return next(new HttpError(429,'RATE_LIMIT','Demasiadas solicitudes. Espera un minuto.'));}
   if(counts.size>10000)for(const [key,value] of counts)if(value.until<now)counts.delete(key);
   next();
  });
 }
 platform.get('/api/health',async(_req,res)=>{
  const results=await Promise.allSettled([context.control.query('select 1'),context.apps.query('select 1')]);
  const neon=config.backendProvider==='neon';
  const dependencies={control_database:results[0].status==='fulfilled',apps_database:results[1].status==='fulfilled',platform_auth:!!(neon?config.controlAuthUrl:config.controlPublishableKey),apps_auth:!!(neon?config.appsAuthUrl:config.appsPublishableKey),storage:neon?!!(config.neonStorageEndpoint&&config.neonStorageAccessKeyId&&config.neonStorageSecretAccessKey):!!config.appsSecretKey,market:!!config.marketProgramId};
  res.status(results.some(r=>r.status==='rejected')?503:200).json({status:results.some(r=>r.status==='rejected')?'dependencies_unavailable':'ready',dependencies,devnet_only:true});
 });
 platform.use('/api',createControlRouter(context));
 platform.use('/api',createMarketRouter(context,req=>authenticate(context,req)));
 platform.post(['/api/generate-poc','/api/iterate-poc'],(_req,res)=>res.status(410).json({error:{code:'LEGACY_DISABLED',message:'Usa los trabajos de proyectos autenticados. El generador simulado está retirado.'}}));
 platform.use('/api',(_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Ruta no encontrada.'}}));
 runtime.use(createRuntimeRouter(context));
 const errors:express.ErrorRequestHandler=(error,_req,res,_next)=>{
  if(error instanceof HttpError){res.status(error.status).json({error:{code:error.code,message:error.message}});return;}
  if(error?.name==='ZodError'||error?.type==='entity.parse.failed'){res.status(400).json({error:{code:'INVALID_REQUEST',message:'La solicitud contiene datos inválidos.'}});return;}
  if(error?.type==='entity.too.large'){res.status(413).json({error:{code:'PAYLOAD_TOO_LARGE',message:'La solicitud supera el tamaño permitido.'}});return;}
  const databaseUnavailable=['ECONNREFUSED','ETIMEDOUT','ENOTFOUND'].includes(error?.code);
  console.error('Request failed:',error?.code||error?.name||'unknown');
  res.status(databaseUnavailable?503:500).json({error:{code:databaseUnavailable?'DEPENDENCY_UNAVAILABLE':'INTERNAL_ERROR',message:databaseUnavailable?'No se pudo conectar con el backend. Revisa la configuración de las bases.':'No se pudo completar la operación.'}});
 };
 platform.use(errors);runtime.use(errors);
 if(!config.production){
  const vite=await createViteServer({server:{middlewareMode:true,hmr:process.env.DISABLE_HMR!=='true'},appType:'spa'});platform.use(vite.middlewares);
 }else{platform.use(express.static(resolve('dist')));platform.get('*',(_req,res)=>res.sendFile(resolve('dist/index.html')));}
 return {platform,runtime,context};
}
if(process.argv[1]?.endsWith('server.ts')){
 const {platform,runtime}=await createServers();
 platform.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('promptfun: http://localhost:3000'));
 runtime.listen(Number(process.env.RUNTIME_PORT)||4000,'127.0.0.1',()=>console.log('Isolated app runtime: http://127.0.0.1:4000'));
}

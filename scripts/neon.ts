import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

// Explicit dedicated projects only. No credentials or connection strings are printed.
const cliVersion='8.4.1';
const cli=(args:string[])=>{
  try { return execFileSync('bun',['x',`neon@${cliVersion}`,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000}); }
  catch { throw new Error('Neon CLI failed. Check login, dedicated project IDs, and Free-plan availability; credentials were not printed.'); }
};
const json=(args:string[])=>JSON.parse(cli([...args,'--output','json']));
const argv=process.argv.slice(2);
const envPath=resolve('.env');
const env=existsSync(envPath)?parse(readFileSync(envPath)):{};
const ids={control:env.NEON_CONTROL_PROJECT_ID||process.env.NEON_CONTROL_PROJECT_ID,apps:env.NEON_APPS_PROJECT_ID||process.env.NEON_APPS_PROJECT_ID};
if(!ids.control||!ids.apps||ids.control===ids.apps)throw new Error('Set NEON_CONTROL_PROJECT_ID and NEON_APPS_PROJECT_ID to two distinct dedicated promptfun projects in .env.');
mkdirSync('.local/neon',{recursive:true});
for(const plane of ['control','apps'] as const){
  const id=ids[plane]!;
  const project=json(['projects','get',id]);
  if(project.name!==`promptfun-${plane}`)throw new Error('Refusing to configure a project that is not dedicated to promptfun-'+plane+'.');
  if(!['free','free_v3'].includes(project.owner?.subscription_type))throw new Error('This setup is restricted to the Free plan; choose a dedicated Free project.');
  if(!['aws-us-east-1','aws-us-east-2','aws-eu-central-1','aws-ap-southeast-1'].includes(project.region_id))throw new Error('Choose a region supporting managed Auth and Object Storage.');
  const status=json(['neon-auth','status','--project-id',id]);
  if(!status.base_url)throw new Error('Enable managed Better Auth on the dedicated project before continuing.');
  const branch=env[`NEON_${plane.toUpperCase()}_BRANCH_ID`]||status.branch_id;
  if(branch!==status.branch_id)throw new Error('Configured Auth and database branch do not match.');
  const file=resolve(`.local/neon/${plane}.env`);
  cli(['env','pull','--project-id',id,'--branch',branch,'--file',file,'--service','postgres','--service','auth',...(plane==='apps'?['--service','object-storage']:[])]);
  const pulled=parse(readFileSync(file));
  if(!pulled.DATABASE_URL||!pulled.NEON_AUTH_BASE_URL)throw new Error('Neon did not return the required database/Auth environment.');
  env[plane.toUpperCase()+'_DATABASE_URL']=pulled.DATABASE_URL;
  env[plane.toUpperCase()+'_AUTH_URL']=pulled.NEON_AUTH_BASE_URL;
  env[`NEON_${plane.toUpperCase()}_BRANCH_ID`]=branch;
  env[`NEON_${plane.toUpperCase()}_PROJECT_ID`]=id;
  if(plane==='apps'){
    for(const [dest,src] of Object.entries({NEON_STORAGE_ENDPOINT:'AWS_ENDPOINT_URL_S3',NEON_STORAGE_ACCESS_KEY_ID:'AWS_ACCESS_KEY_ID',NEON_STORAGE_SECRET_ACCESS_KEY:'AWS_SECRET_ACCESS_KEY',NEON_STORAGE_REGION:'AWS_REGION'})){
      if(!pulled[src])throw new Error('Create the private app-files bucket before pulling storage credentials.');
      env[dest]=pulled[src];
    }
    env.NEON_STORAGE_BUCKET='app-files';
  }
  if(argv.includes('--allow-local-development')){
    cli(['neon-auth','domain','allow-localhost','enable','--project-id',id,'--branch',branch]);
    if(plane==='apps')cli(['neon-auth','domain','add','http://127.0.0.1:4000','--project-id',id,'--branch',branch]);
    cli(['neon-auth','config','email-password','update','--project-id',id,'--branch',branch,
      '--email-verification-method','otp','--require-email-verification','true',
      '--auto-sign-in-after-verification','false','--send-verification-email-on-sign-up','true','--send-verification-email-on-sign-in','true']);
  }
  console.log(`Verified dedicated Free project promptfun-${plane}; private settings saved locally.`);
}
env.BACKEND_PROVIDER='neon';
writeFileSync(envPath,Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n');
console.log('Neon configuration saved in ignored .env. Run bun db:migrate, then bun dev and bun worker.');

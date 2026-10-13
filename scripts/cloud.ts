import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// This script configures already-provisioned dedicated projects. It never creates billable resources,
// pauses other projects, switches accounts, or prints database passwords/service keys.
const getEnv=()=>new Map((existsSync('.env')?readFileSync('.env','utf8'):'').split(/\r?\n/).filter(line=>/^[A-Z_]+=/.test(line)).map(line=>[line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1).replace(/^"|"$/g,'')]));
const env=getEnv();const refs={control:process.env.CONTROL_PROJECT_REF||env.get('CONTROL_PROJECT_REF'),apps:process.env.APPS_PROJECT_REF||env.get('APPS_PROJECT_REF')};
if(!refs.control||!refs.apps||refs.control===refs.apps)throw new Error('Set distinct CONTROL_PROJECT_REF and APPS_PROJECT_REF for dedicated promptfun projects.');
const cli=(...args:string[])=>execFileSync('bun',['x','supabase',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const projects=JSON.parse(cli('projects','list','--output','json')) as any[];
for(const plane of ['control','apps'] as const){
 const project=projects.find(p=>p.ref===refs[plane]||p.id===refs[plane]);
 if(!project||project.name!==`promptfun-${plane}`)throw new Error(`The CLI account cannot access the dedicated promptfun-${plane} project. Sign in to the correct Supabase account; existing projects are protected.`);
 const keys=JSON.parse(cli('projects','api-keys','--project-ref',refs[plane]!,'--reveal','--output','json')) as any[];
 const publishable=keys.find(k=>k.type==='publishable'||k.name==='anon')?.api_key;
 const secret=keys.find(k=>k.type==='secret'||k.name==='service_role')?.api_key;
 if(!publishable||(plane==='apps'&&!secret))throw new Error('Expected backend keys are unavailable.');
 env.set(plane.toUpperCase()+'_SUPABASE_URL',`https://${refs[plane]}.supabase.co`);env.set(plane.toUpperCase()+'_PUBLISHABLE_KEY',publishable);
 env.set(plane.toUpperCase()+'_PROJECT_REF',refs[plane]!);if(plane==='apps')env.set('APPS_SECRET_KEY',secret);
 const database=process.env[plane.toUpperCase()+'_DATABASE_URL']||env.get(plane.toUpperCase()+'_DATABASE_URL');
 if(!database||!database.startsWith('postgresql://')||database.includes('127.0.0.1'))throw new Error(`Supply the ${plane} Supabase session-pooler PostgreSQL connection string in ignored .env; no password is requested in chat.`);
 env.set(plane.toUpperCase()+'_DATABASE_URL',database);console.log(`Verified dedicated ${plane} project ${project.name}; keys will remain local.`);
}
writeFileSync('.env',[...env].map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n');
console.log('Cloud endpoints configured. Run bun run db:migrate to apply the two dedicated schemas.');

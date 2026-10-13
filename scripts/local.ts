import { existsSync,readFileSync,writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const args=process.argv.slice(2);
const cli=(...args:string[])=>execFileSync('bun',['x','supabase',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const envPath='.env';
function loadLocalEnv(){const lines=existsSync(envPath)?readFileSync(envPath,'utf8').split(/\r?\n/):[];return new Map(lines.filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));}
function saveLocalEnv(env:Map<string,string>){writeFileSync(envPath,[...env].map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n');}
const env=loadLocalEnv();
for(const key of ['ENCRYPTION_KEY','RUNTIME_SIGNING_KEY'])if(!env.get(key))env.set(key,randomBytes(32).toString('base64'));
for(const [key,value] of Object.entries({BACKEND_PROVIDER:'neon',PLATFORM_ORIGIN:'http://localhost:3000',RUNTIME_ORIGIN:'http://127.0.0.1:4000'}))if(!env.get(key))env.set(key,value);
saveLocalEnv(env);
if(args.includes('--env-only')){console.log('Persistent development secrets prepared in ignored .env.');process.exit(0);}
if(env.get('BACKEND_PROVIDER')!=='supabase')throw new Error('local:up is an optional Supabase/Docker adapter. For Neon use local:env and cloud:configure; existing cloud values were preserved.');
for(const [key,value] of Object.entries({CONTROL_DATABASE_URL:'postgresql://postgres:postgres@127.0.0.1:54322/postgres',APPS_DATABASE_URL:'postgresql://postgres:postgres@127.0.0.1:55322/postgres',CONTROL_SUPABASE_URL:'http://127.0.0.1:54321',APPS_SUPABASE_URL:'http://127.0.0.1:55321'}))if(!env.get(key))env.set(key,value);
if(!env.get('CONTROL_DATABASE_URL')!.includes('127.0.0.1:54322')||!env.get('APPS_DATABASE_URL')!.includes('127.0.0.1:55322'))throw new Error('Refusing to mix local services with existing cloud database URLs.');
saveLocalEnv(env);
execFileSync('docker',['info','--format','{{.ServerVersion}}'],{stdio:['ignore','pipe','pipe']});
for(const plane of ['control','apps']){
 console.log(`Starting ${plane} plane…`);
 cli('start','--workdir',`supabase/${plane}`,'--exclude','analytics,realtime,edge-runtime,vector');
 const status=JSON.parse(cli('status','--workdir',`supabase/${plane}`,'--output','json'));
 const prefix=plane.toUpperCase();env.set(prefix+'_PUBLISHABLE_KEY',status.PUBLISHABLE_KEY||status.ANON_KEY);
 if(plane==='apps')env.set('APPS_SECRET_KEY',status.SECRET_KEY||status.SERVICE_ROLE_KEY);
 if(!env.get(prefix+'_PUBLISHABLE_KEY')||(plane==='apps'&&!env.get('APPS_SECRET_KEY')))throw new Error('Supabase did not return configured local keys.');
 saveLocalEnv(env);console.log(`${plane} ready; local keys saved without printing them.`);
}
execFileSync('bun',['run','scripts/migrate.ts'],{stdio:'inherit'});

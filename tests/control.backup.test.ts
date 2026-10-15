import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { Client } from 'pg';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { writeBackup, verifyBackup, restoreBackup, sourceFingerprints, restoreConfig, type BackupDatabase } from '../scripts/backup.js';
import { migrateClient } from '../scripts/migrate.js';
import { databaseOptions, databaseIdentity } from '../server/control/database.js';
import { artifactHash } from '../server/control/security.js';
import { runOneJob } from '../server/control/worker.js';
import type { ObjectStore } from '../server/runtime/storage.js';
import type { Config, CoreContext } from '../server/shared.js';

// These integration tests execute the real application migrations and restore SQL in
// PostgreSQL WASM. Object storage is an explicit in-memory fixture, not live Neon S3.
const testRoot=resolve('.local/tests'),hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const sourceConfig={backendProvider:'neon',controlDatabaseUrl:'postgresql://owner:fixture@ep-source-control.neon.tech/db?sslmode=require',appsDatabaseUrl:'postgresql://owner:fixture@ep-source-apps.neon.tech/db?sslmode=require',neonStorageEndpoint:'https://source-storage.example.invalid',neonStorageBucket:'files'} as Config;
const targetConfig={...sourceConfig,controlDatabaseUrl:'postgresql://owner:fixture@ep-target-control.neon.tech/db?sslmode=verify-full',appsDatabaseUrl:'postgresql://owner:fixture@ep-target-apps.neon.tech/db?sslmode=verify-full',neonStorageEndpoint:'https://target-storage.example.invalid'};
async function temp() {await mkdir(testRoot,{recursive:true});return mkdtemp(resolve(testRoot,'backup-'));}
async function removeTemp(path:string) {const rel=relative(testRoot,resolve(path));assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel));await rm(resolve(path),{recursive:true,force:true});}
async function database(plane:'control'|'apps') {
  const engine=new PGlite({extensions:{pgcrypto}});await engine.waitReady;
  const db:BackupDatabase={query:async(sql,values=[])=> {
    const result=values.length?await engine.query<any>(sql,values):sql.includes(';')?(await engine.exec(sql)).at(-1)!:await engine.query<any>(sql);
    return {rows:result.rows as any[],rowCount:result.rows.length||result.affectedRows||0};
  }};
  await migrateClient(db as any,resolve('supabase',plane,'migrations'));return {engine,db};
}
function memoryStore() {
  const data=new Map<string,Buffer>();let puts=0,failAt=0;
  const store:ObjectStore={put:async(path,bytes)=>{puts++;data.set(path,Buffer.from(bytes));if(puts===failAt)throw new Error('Fixture lost PUT response.');},
    get:async(path,expected)=>{const bytes=data.get(path);if(!bytes||bytes.length!==expected.size_bytes||hash(bytes)!==expected.sha256)throw new Error('Fixture object integrity failure.');return Buffer.from(bytes);},
    delete:async path=>{data.delete(path);},isEmpty:async()=>data.size===0};
  return {store,data,failAfter:(n:number)=>{failAt=n;},puts:()=>puts};
}
async function seeded() {
  const control=await database('control'),apps=await database('apps'),objects=memoryStore();
  const owner=randomUUID(),appUser=randomUUID(),project=randomUUID(),base=randomUUID(),latest=randomUUID(),connection=randomUUID(),job=randomUUID(),attempt=randomUUID();
  const manifest={version:1 as const,records:{collections:['tasks']},auth:true,files:true,connectors:[]};
  const html='<!doctype html><html><body>Tareas con archivos</body></html>',html2=html.replace('Tareas','Mis tareas');
  const subject=JSON.stringify(['https://original-auth.example.invalid/auth','opaque-original-subject']);
  await control.db.query('insert into platform_users(id,email,auth_provider,auth_subject) values($1,$2,$3,$4)',[owner,'owner@example.invalid','neon',subject]);
  for(const state of ['active','revoked']) {
    const address=new PublicKey(nacl.sign.keyPair().publicKey).toBase58();
    await control.db.query('insert into wallet_credentials(user_id,address,state,revoked_at) values($1,$2,$3,$4)',[owner,address,state,state==='revoked'?new Date().toISOString():null]);
  }
  await control.db.query('insert into projects(id,owner_id,title) values($1,$2,$3)',[project,owner,'Backup fixture']);
  for(const [id,parent,source] of [[base,null,html],[latest,base,html2]])await control.db.query('insert into app_versions(id,project_id,parent_version_id,prompt,html,manifest,content_hash) values($1,$2,$3,$4,$5,$6,$7)',[id,project,parent,'private prompt',source,JSON.stringify(manifest),artifactHash(source!,manifest)]);
  await control.db.query('insert into project_drafts(project_id,prompt,model,base_version_id,revision) values($1,$2,$3,$4,7)',[project,'  Borrador privado\n\tcon espacios 💡\n  ','fixture/code:free',latest]);
  await control.db.query('update projects set published_version_id=$2 where id=$1',[project,latest]);
  await control.db.query('insert into publication_history(project_id,version_id) values($1,$2)',[project,latest]);
  await control.db.query("insert into platform_mutation_receipts(user_id,idempotency_key,kind,request_hash,response_status,response) values($1,'fixture_project_publish','project.publish',$2,200,$3)",[owner,hash('fixture-publish'),JSON.stringify({project:{id:project,published_version_id:latest}})]);
  await control.db.query('insert into provider_connections(id,owner_id,secret_ciphertext,key_hash) values($1,$2,$3,$4)',[connection,owner,'SOURCE_PRIVATE_PROVIDER_GRANT','key-hash']);
  await control.db.query("insert into free_quota_days(owner_id,day,used,held) values($1,current_date,3,1)",[owner]);
  await control.db.query("insert into generation_jobs(id,project_id,actor_id,connection_id,base_version_id,prompt,model,idempotency_key,request_hash,quota_day,status,lease_owner,lease_until) values($1,$2,$3,$4,$5,'fixture','fixture:free','fixture-backup-job','request',current_date,'running','lost-worker',now()+interval '1 minute')",[job,project,owner,connection,latest]);
  await control.db.query("insert into generation_attempts(id,job_id,payer_id,connection_id,model,state,request_id,next_reconcile_at) values($1,$2,$3,$4,'fixture:free','submitted','fixture-request',now())",[attempt,job,owner,connection]);
  await control.db.query("insert into usage_receipts(attempt_id,revision,raw_usage,source) values($1,0,'{}','provider_submitted')",[attempt]);
  await control.db.query("insert into platform_sessions(user_id,token_hash,csrf_token,auth_token_ciphertext,expires_at) values($1,'session-hash','SOURCE_PRIVATE_CSRF','SOURCE_PRIVATE_SESSION',now()+interval '1 hour')",[owner]);
  await control.db.query("insert into markets(project_id,address,mint,creator,curve_vault,locked_vault,net_sold,reserve_lamports,status) values($1,'fixture-market','fixture-mint','fixture-creator','fixture-curve','fixture-lock',1000000,30,'active')",[project]);
  const quote=randomUUID();await control.db.query("insert into market_quotes(id,project_id,user_id,side,token_amount,lamports,expires_at) values($1,$2,$3,'buy',1000000,30,now())",[quote,project,owner]);
  await control.db.query("insert into solana_transactions(id,project_id,user_id,kind,quote_id,signature,ix_index,message_hash,expected_signer,expires_at,status) values($1,$2,$3,'buy',$4,'fixture-signature',0,'fixture-message','fixture-signer',now(),'confirmed')",[randomUUID(),project,owner,quote]);
  await apps.db.query('insert into app_instances(id) values($1)',[project]);await apps.db.query('insert into app_users(id,auth_provider,auth_subject,email) values($1,$2,$3,$4)',[appUser,'neon',subject,'end-user@example.invalid']);
  await apps.db.query('insert into app_memberships(app_id,user_id) values($1,$2)',[project,appUser]);await apps.db.query("insert into app_records(app_id,user_id,collection,data) values($1,$2,'tasks',$3)",[project,appUser,JSON.stringify({title:'Preserved task'})]);
  await apps.db.query("insert into app_mutation_receipts(app_id,user_id,idempotency_key,kind,request_hash,response_status,response) values($1,$2,'fixture_receipt_key','record.create',$3,201,$4)",[project,appUser,hash('fixture-request'),JSON.stringify({record:{id:'fixture-record',data:{title:'Preserved task'}}})]);
  await apps.db.query("insert into app_sessions(token_hash,app_id,user_id,csrf_token,expires_at,auth_token_ciphertext) values('app-session',$1,$2,'SOURCE_PRIVATE_APP_CSRF',now()+interval '1 hour','SOURCE_PRIVATE_APP_SESSION')",[project,appUser]);
  const files=[];
  for(const text of ['first-file','second-file']) {const id=randomUUID(),bytes=Buffer.from(text),path=`${project}/${appUser}/${id}`;await apps.db.query('insert into app_files(id,app_id,user_id,name,mime_type,size_bytes,object_path,sha256) values($1,$2,$3,$4,$5,$6,$7,$8)',[id,project,appUser,text,'text/plain',bytes.length,path,hash(bytes)]);objects.data.set(path,bytes);files.push({id,path,bytes});}
  return {control,apps,objects,owner,appUser,project,latest,job,subject,files};
}

test('cloud database options always verify TLS and migrations use direct Neon endpoints',()=> {
  const options=databaseOptions('postgresql://owner:fixture@ep-project-pooler.c-2.us-east-1.aws.neon.tech/db?sslmode=require&uselibpqcompat=true',true);
  assert.deepEqual(options.ssl,{rejectUnauthorized:true});assert.equal(new URL(options.connectionString!).hostname,'ep-project.c-2.us-east-1.aws.neon.tech');assert.equal(new URL(options.connectionString!).searchParams.has('sslmode'),false);
  assert.equal(databaseIdentity('postgresql://a:one@ep-project-pooler.neon.tech/db'),databaseIdentity('postgresql://b:two@ep-project.neon.tech/db?sslmode=verify-full'));
  assert.throws(()=>databaseOptions('postgresql://owner:fixture@cloud.example.invalid/db?sslmode=disable'),/verified TLS/);
  const cannotDisable=databaseOptions('postgresql://owner:fixture@cloud.example.invalid/db?ssl=0&sslmode=require&sslnegotiation=direct');
  assert.equal(new URL(cannotDisable.connectionString!).searchParams.has('ssl'),false);
  // Inspect pg's effective connection parameters without opening a connection:
  // the URL parser must not replace our verified TLS object with ssl=false.
  assert.deepEqual((new Client(cannotDisable) as any).connectionParameters.ssl,{rejectUnauthorized:true});
  for(const parameter of ['host=127.0.0.1','port=5432','database=other'])assert.throws(()=>databaseOptions(`postgresql://owner:fixture@cloud.example.invalid/db?${parameter}`),/routing/);
  assert.equal(databaseOptions('postgresql://owner:fixture@127.0.0.1/db').ssl,false);
});

test('real SQL backup/restore preserves versions, users, files and financial evidence without resuming jobs',async()=> {
  const source=await seeded(),a=await database('control'),b=await database('apps'),objects=memoryStore(),directory=await temp();
  try {
    await writeBackup(directory,source.control.db,source.apps.db,source.objects.store,sourceFingerprints(sourceConfig));const backup=await verifyBackup(directory);
    const text=JSON.stringify(backup);assert.ok(!text.includes('SOURCE_PRIVATE_'));assert.equal(backup.control.provider_connections[0].state,'revoked');
    // A legitimate backup can enumerate children before parents; restore must sort the graph.
    backup.control.app_versions.reverse();const controlText=JSON.stringify(backup.control);backup.manifest.hashes.control=hash(controlText);
    await writeFile(resolve(directory,'control.json'),controlText);await writeFile(resolve(directory,'manifest.json'),JSON.stringify(backup.manifest));
    const restored=await restoreBackup(directory,a.db,b.db,objects.store,sourceFingerprints(targetConfig));assert.equal(restored.restored,true);assert.equal(restored.identities_require_recovery,true);
    assert.equal((await a.db.query('select published_version_id from projects')).rows[0].published_version_id,source.latest);
    assert.equal((await a.db.query('select version_id from publication_history')).rows[0].version_id,source.latest);assert.equal((await a.db.query('select idempotency_key from platform_mutation_receipts')).rows[0].idempotency_key,'fixture_project_publish');
    assert.equal((await a.db.query('select count(*)::int as n from app_versions')).rows[0].n,2);assert.equal((await b.db.query('select data from app_records')).rows[0].data.title,'Preserved task');
    const restoredDraft=(await a.db.query('select project_id,prompt,model,base_version_id,revision,updated_at from project_drafts')).rows;
    assert.deepEqual(restoredDraft,(await source.control.db.query('select project_id,prompt,model,base_version_id,revision,updated_at from project_drafts')).rows);
    assert.equal((await b.db.query('select auth_subject from app_users')).rows[0].auth_subject,source.subject);
    const restoredWallets=(await a.db.query('select address,state,revoked_at from wallet_credentials order by address')).rows;
    assert.deepEqual(restoredWallets,(await source.control.db.query('select address,state,revoked_at from wallet_credentials order by address')).rows);
    assert.equal((await a.db.query('select count(*)::int as n from wallet_auth_challenges')).rows[0].n,0);
    assert.equal((await b.db.query('select idempotency_key from app_mutation_receipts')).rows[0].idempotency_key,'fixture_receipt_key');
    assert.equal((await a.db.query('select signature from solana_transactions')).rows[0].signature,'fixture-signature');assert.equal((await a.db.query('select net_sold from markets')).rows[0].net_sold,'1000000');
    const job=(await a.db.query('select status,usage_status,cost_usd from generation_jobs')).rows[0];assert.equal(job.status,'cancelled');assert.equal(job.usage_status,'unknown');assert.equal(job.cost_usd,null);
    assert.equal((await a.db.query('select state,next_reconcile_at from generation_attempts')).rows[0].state,'uncertain');assert.equal((await a.db.query('select held from free_quota_days')).rows[0].held,0);
    assert.equal((await a.db.query('select count(*)::int as n from platform_sessions')).rows[0].n,0);assert.equal((await b.db.query('select count(*)::int as n from app_sessions')).rows[0].n,0);
    for(const file of source.files)assert.deepEqual(objects.data.get(file.path),file.bytes);
    let calls=0;const pool={query:a.db.query,connect:async()=>({query:a.db.query,release:()=>{}})};
    assert.equal(await runOneJob({control:pool,apps:pool,config:sourceConfig} as unknown as CoreContext,'restore-worker',{fetcher:(async()=>{calls++;throw new Error('must not send');}) as any}),false);assert.equal(calls,0);
    await assert.rejects(restoreBackup(directory,a.db,b.db,objects.store,sourceFingerprints(targetConfig)),/not empty/);
  } finally {await Promise.all([source.control.engine.close(),source.apps.engine.close(),a.engine.close(),b.engine.close()]);await removeTemp(directory);}
});

test('restore rejects the source, occupied storage and corrupt bytes before writing SQL',async()=> {
  const source=await seeded(),a=await database('control'),b=await database('apps'),objects=memoryStore(),directory=await temp();
  try {
    await writeBackup(directory,source.control.db,source.apps.db,source.objects.store,sourceFingerprints(sourceConfig));
    await assert.rejects(restoreBackup(directory,a.db,b.db,objects.store,sourceFingerprints(sourceConfig)),/isolated/);assert.equal(objects.puts(),0);
    objects.data.set('existing-object',Buffer.from('preserve'));await assert.rejects(restoreBackup(directory,a.db,b.db,objects.store,sourceFingerprints(targetConfig)),/not empty/);assert.deepEqual(objects.data.get('existing-object'),Buffer.from('preserve'));objects.data.clear();
    await writeFile(resolve(directory,'objects',source.files[0].id+'.bin'),'corrupt');await assert.rejects(restoreBackup(directory,a.db,b.db,objects.store,sourceFingerprints(targetConfig)),/hash mismatch/);
    assert.equal((await a.db.query('select count(*)::int as n from projects')).rows[0].n,0);assert.equal(objects.puts(),0);
  } finally {await Promise.all([source.control.engine.close(),source.apps.engine.close(),a.engine.close(),b.engine.close()]);await removeTemp(directory);}
});

test('a failed object PUT rolls back both real databases and cleans only isolated target objects',async()=> {
  const source=await seeded(),a=await database('control'),b=await database('apps'),objects=memoryStore(),directory=await temp();objects.failAfter(2);
  try {
    await writeBackup(directory,source.control.db,source.apps.db,source.objects.store,sourceFingerprints(sourceConfig));await assert.rejects(restoreBackup(directory,a.db,b.db,objects.store,sourceFingerprints(targetConfig)),/lost PUT response/);
    assert.equal((await a.db.query('select count(*)::int as n from projects')).rows[0].n,0);assert.equal((await b.db.query('select count(*)::int as n from app_files')).rows[0].n,0);assert.equal(objects.data.size,0);assert.equal(source.objects.data.size,2);
  } finally {await Promise.all([source.control.engine.close(),source.apps.engine.close(),a.engine.close(),b.engine.close()]);await removeTemp(directory);}
});

test('restore configuration requires explicit target credentials and never falls back to source',()=> {
  assert.throws(()=>restoreConfig(sourceConfig,{}),/Explicit isolated/);
  const env={RESTORE_BACKEND_PROVIDER:'neon',RESTORE_CONTROL_DATABASE_URL:targetConfig.controlDatabaseUrl,RESTORE_APPS_DATABASE_URL:targetConfig.appsDatabaseUrl,
    RESTORE_NEON_STORAGE_ENDPOINT:targetConfig.neonStorageEndpoint,RESTORE_NEON_STORAGE_ACCESS_KEY_ID:'target-only',RESTORE_NEON_STORAGE_SECRET_ACCESS_KEY:'target-only-secret',RESTORE_NEON_STORAGE_BUCKET:'target-files'};
  const restored=restoreConfig({...sourceConfig,neonStorageAccessKeyId:'source-only',neonStorageSecretAccessKey:'source-only-secret'},env);assert.equal(restored.neonStorageAccessKeyId,'target-only');
  assert.equal(restoreConfig({...sourceConfig,neonStorageAccessKeyId:'target-only',neonStorageSecretAccessKey:'target-only-secret'},env).neonStorageAccessKeyId,'target-only');
  assert.throws(()=>restoreConfig(sourceConfig,{...env,RESTORE_NEON_STORAGE_ENDPOINT:sourceConfig.neonStorageEndpoint,RESTORE_NEON_STORAGE_BUCKET:sourceConfig.neonStorageBucket}),/isolated/);
  assert.throws(()=>restoreConfig(sourceConfig,{...env,RESTORE_NEON_STORAGE_ENDPOINT:'HTTPS://SOURCE-STORAGE.EXAMPLE.INVALID:443///',RESTORE_NEON_STORAGE_BUCKET:sourceConfig.neonStorageBucket}),/isolated/);
  assert.equal(sourceFingerprints({...sourceConfig,neonStorageEndpoint:'https://SOURCE-storage.example.invalid.:443/'}).objects,sourceFingerprints(sourceConfig).objects);
  assert.notEqual(sourceFingerprints({...sourceConfig,neonStorageBucket:'files-v2'}).objects,sourceFingerprints(sourceConfig).objects);
  assert.throws(()=>restoreConfig(sourceConfig,{...env,RESTORE_CONTROL_DATABASE_URL:'postgresql://other:fixture@EP-SOURCE-CONTROL-pooler.neon.tech.:5432/%64b?sslmode=verify-full'}),/isolated/);
});

test('older v1 backups restore with empty new tables only across the exact known wallet/draft migrations',async()=>{
  const source=await seeded();
  try {
    for(const beforeWallet of [false,true]) {
      const a=await database('control'),b=await database('apps'),objects=memoryStore(),directory=await temp();
      try {
        await writeBackup(directory,source.control.db,source.apps.db,source.objects.store,sourceFingerprints(sourceConfig));
        const data=JSON.parse(await readFile(resolve(directory,'control.json'),'utf8'));
        const manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
        delete data.project_drafts;if(beforeWallet)delete data.wallet_credentials;
        const text=JSON.stringify(data);manifest.hashes.control=hash(text);
        await writeFile(resolve(directory,'control.json'),text);await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest));
        await assert.rejects(verifyBackup(directory),/missing a table/);
        manifest.migrations.control=manifest.migrations.control.filter((row:any)=>row.name!=='202610150006_project_drafts.sql'&&(!beforeWallet||row.name!=='202610130005_wallet_auth.sql'));
        const marker=JSON.stringify(manifest);await writeFile(resolve(directory,'manifest.json'),marker);
        const verified=await verifyBackup(directory);assert.deepEqual(verified.control.project_drafts,[]);
        if(beforeWallet)assert.deepEqual(verified.control.wallet_credentials,[]);
        const sha=(await a.db.query("select sha256 from promptfun_migrations where name='202610150006_project_drafts.sql'")).rows[0].sha256;
        await a.db.query("update promptfun_migrations set sha256=$1 where name='202610150006_project_drafts.sql'",['f'.repeat(64)]);
        await assert.rejects(restoreBackup(directory,a.db,b.db,objects.store,sourceFingerprints(targetConfig)),/schema differs/);
        await a.db.query("update promptfun_migrations set sha256=$1 where name='202610150006_project_drafts.sql'",[sha]);
        await a.db.query('insert into promptfun_migrations(name,sha256) values($1,$2)',['202610150007_unknown.sql','a'.repeat(64)]);
        await assert.rejects(restoreBackup(directory,a.db,b.db,objects.store,sourceFingerprints(targetConfig)),/schema differs/);
        await a.db.query("delete from promptfun_migrations where name='202610150007_unknown.sql'");
        assert.equal(objects.puts(),0);
        assert.equal((await restoreBackup(directory,a.db,b.db,objects.store,sourceFingerprints(targetConfig))).restored,true);
        assert.equal((await a.db.query('select count(*)::int as n from project_drafts')).rows[0].n,0);
        assert.equal((await a.db.query('select count(*)::int as n from wallet_credentials')).rows[0].n,beforeWallet?0:2);
        assert.equal((await a.db.query('select published_version_id from projects')).rows[0].published_version_id,source.latest);
        assert.equal((await b.db.query('select data from app_records')).rows[0].data.title,'Preserved task');
        assert.equal(await readFile(resolve(directory,'control.json'),'utf8'),text);
        assert.equal(await readFile(resolve(directory,'manifest.json'),'utf8'),marker);
      } finally {await Promise.all([a.engine.close(),b.engine.close()]);await removeTemp(directory);}
    }
  } finally {await Promise.all([source.control.engine.close(),source.apps.engine.close()]);}
});

test('backup can read an actual pre-draft schema without manufacturing a migration journal',async()=>{
  const source=await seeded(),directory=await temp();
  try {
    await source.control.db.query('drop table project_drafts');
    await source.control.db.query("delete from promptfun_migrations where name='202610150006_project_drafts.sql'");
    const manifest=await writeBackup(directory,source.control.db,source.apps.db,source.objects.store,sourceFingerprints(sourceConfig));
    assert.equal(manifest.migrations.control.some(row=>row.name==='202610150006_project_drafts.sql'),false);
    assert.deepEqual((await verifyBackup(directory)).control.project_drafts,[]);
    assert.equal((await source.control.db.query("select to_regclass('public.project_drafts') as name")).rows[0].name,null);
  } finally {await Promise.all([source.control.engine.close(),source.apps.engine.close()]);await removeTemp(directory);}
});

test('migration journal is idempotent, checksum guarded and rolls back failed DDL in PostgreSQL',async()=> {
  const engine=new PGlite(),directory=await temp();await engine.waitReady;
  const db={query:async(sql:string,values:any[]=[])=>{const result=values.length?await engine.query<any>(sql,values):sql.includes(';')?(await engine.exec(sql)).at(-1)!:await engine.query<any>(sql);return {rows:result.rows,rowCount:result.rows.length||result.affectedRows||0};}};
  const first=resolve(directory,'202610130001_test.sql'),second=resolve(directory,'202610130002_failure.sql');
  try {
    await writeFile(first,'create table public.fixture(id int primary key);');await migrateClient(db as any,directory);await migrateClient(db as any,directory);assert.equal((await db.query('select count(*)::int as n from promptfun_migrations')).rows[0].n,1);
    await writeFile(first,'create table public.changed(id int);');await assert.rejects(migrateClient(db as any,directory),/checksum/);
    await writeFile(first,'create table public.fixture(id int primary key);');await writeFile(second,'create table public.rolled_back(id int); select * from public.nonexistent;');await assert.rejects(migrateClient(db as any,directory),/nonexistent/);
    assert.equal((await db.query("select to_regclass('public.rolled_back') as name")).rows[0].name,null);assert.equal((await db.query('select count(*)::int as n from promptfun_migrations')).rows[0].n,1);
  } finally {await engine.close();await removeTemp(directory);}
});

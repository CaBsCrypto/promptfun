import { mkdir, writeFile, readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { loadConfig } from '../server/config.js';
import type { Config } from '../server/shared.js';
import { createObjectStore, type ObjectStore } from '../server/runtime/storage.js';
import { canonicalEndpoint, databaseIdentity, databaseOptions } from '../server/control/database.js';
import { artifactHash, validateManifest } from '../server/control/security.js';
import { migrateClient } from './migrate.js';

export const BACKUP_TABLES = {
  control: ['platform_users','wallet_credentials','projects','app_versions','provider_connections','free_quota_days','generation_jobs','generation_attempts','usage_receipts',
    'migration_batches','feedback','project_wallet_bindings','markets','market_quotes','funding_intents','solana_transactions','publication_history','platform_mutation_receipts'],
  apps: ['app_instances','app_users','app_memberships','app_records','app_files','app_mutation_receipts'],
} as const;
const EXCLUDED = ['platform_sessions','wallet_auth_challenges','auth_flows','project_wallet_challenges','app_sessions','neon_auth','provider_secret_ciphertexts'];
const RESTORE_LOCK = [1725162101, 8412];
const MAX_JSON = 268435456, MAX_ROWS = 100000, MAX_OBJECTS_BYTES = 1073741824;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
type Row = Record<string, any>;
type Plane = keyof typeof BACKUP_TABLES;
export interface BackupDatabase { query(sql: string, values?: any[]): Promise<{ rows: Row[]; rowCount?: number | null }> }
export interface BackupManifest {
  format: 'promptfun-backup'; version: 1; created_at: string;
  source: { control: string; apps: string; objects: string };
  hashes: { control: string; apps: string };
  migrations: { control: Row[]; apps: Row[] };
  excluded: string[]; cross_plane_atomic: false;
}
export interface BackupBundle { manifest: BackupManifest; control: Record<string, Row[]>; apps: Record<string, Row[]> }
const identifier = (name: string) => '"' + name.replaceAll('"', '""') + '"';
export function sourceFingerprints(config: Config) {
  const storage = config.backendProvider === 'neon' ? [canonicalEndpoint(config.neonStorageEndpoint), config.neonStorageBucket || 'app-files'] : [canonicalEndpoint(config.appsSupabaseUrl), 'app-files'];
  return { control: sha(databaseIdentity(config.controlDatabaseUrl)), apps: sha(databaseIdentity(config.appsDatabaseUrl)), objects: sha(JSON.stringify(storage)) };
}
async function snapshot(db: BackupDatabase, plane: Plane) {
  const data: Record<string, Row[]> = {}; await db.query('begin isolation level repeatable read read only');
  try {
    for(const table of BACKUP_TABLES[plane]) {
      const rows = (await db.query(`select * from public.${identifier(table)} limit ${MAX_ROWS+1}`)).rows;
      if(rows.length>MAX_ROWS)throw new Error('Backup row limit exceeded.');
      data[table]=rows;
    }
    const migrations=(await db.query('select name,sha256 from public.promptfun_migrations order by name')).rows;
    await db.query('commit');return {data,migrations};
  } catch(error) {await db.query('rollback').catch(()=>{});throw error;}
}
function redacted(data: Record<string, Row[]>, created: string) {
  for(const row of data.provider_connections) {row.secret_ciphertext='RESTORE_REQUIRES_RECONNECT';row.state='revoked';row.revoked_at=created;}
  return data;
}
function orderedVersions(rows: Row[]) {
  const remaining=new Map(rows.map(row=>[row.id,row])), result:Row[]=[], seen=new Set<string>();
  if(remaining.size!==rows.length)throw new Error('Duplicate version.');
  while(remaining.size) {
    let progress=false;
    for(const [id,row] of remaining) if(!row.parent_version_id||seen.has(row.parent_version_id)) {result.push(row);seen.add(id);remaining.delete(id);progress=true;}
    if(!progress)throw new Error('Missing parent or cyclic version graph.');
  }
  return result;
}
function validateBundle(bundle: BackupBundle) {
  const {manifest}=bundle;
  if(manifest?.format!=='promptfun-backup'||manifest.version!==1||!Number.isFinite(Date.parse(manifest.created_at))||manifest.cross_plane_atomic!==false)throw new Error('Unsupported backup format.');
  for(const value of Object.values(manifest.source || {}))if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new Error('Invalid backup fingerprint.');
  if(Object.keys(manifest.source||{}).sort().join()!=='apps,control,objects')throw new Error('Incomplete backup fingerprints.');
  for(const plane of ['control','apps'] as const) {
    const data=bundle[plane];if(!data||Object.keys(data).sort().join()!==[...BACKUP_TABLES[plane]].sort().join())throw new Error('Unexpected backup table.');
    for(const table of BACKUP_TABLES[plane])if(!Array.isArray(data[table])||data[table].length>MAX_ROWS||data[table].some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw new Error('Invalid backup rows.');
    const migrations=manifest.migrations?.[plane];if(!Array.isArray(migrations)||!migrations.length||new Set(migrations.map(row=>row.name)).size!==migrations.length||
      migrations.some(row=>!/^\d{12,}_[a-z0-9_-]+\.sql$/.test(row.name)||!/^[a-f0-9]{64}$/.test(row.sha256)))throw new Error('Missing or invalid schema migration evidence.');
  }
  for(const connection of bundle.control.provider_connections)if(connection.secret_ciphertext!=='RESTORE_REQUIRES_RECONNECT'||connection.state!=='revoked')throw new Error('Backup contains a live provider grant.');
  const projects=new Set(bundle.control.projects.map(row=>row.id));
  for(const instance of bundle.apps.app_instances)if(!projects.has(instance.id))throw new Error('Inconsistent cross-plane snapshot; retry with writers stopped.');
  for(const row of orderedVersions(bundle.control.app_versions)) {
    if(!projects.has(row.project_id)||typeof row.html!=='string'||row.content_hash!==artifactHash(row.html,validateManifest(row.manifest)))throw new Error('Version content hash mismatch.');
  }
  let total=0;const ids=new Set<string>(),paths=new Set<string>();
  for(const file of bundle.apps.app_files) {
    if(!uuid.test(file.id)||!uuid.test(file.app_id)||!uuid.test(file.user_id)||file.object_path!==`${file.app_id}/${file.user_id}/${file.id}`||
      !Number.isSafeInteger(file.size_bytes)||file.size_bytes<1||file.size_bytes>5242880||!/^[a-f0-9]{64}$/.test(file.sha256)||ids.has(file.id)||paths.has(file.object_path))throw new Error('Invalid backup file metadata.');
    ids.add(file.id);paths.add(file.object_path);total+=file.size_bytes;
  }
  if(total>MAX_OBJECTS_BYTES)throw new Error('Backup object limit exceeded.');
}
async function bytesFile(path: string, limit: number) {
  const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.size>limit)throw new Error('Invalid or oversized backup file.');return readFile(path);
}
export async function writeBackup(directory: string, control: BackupDatabase, apps: BackupDatabase, objects: ObjectStore, fingerprints: BackupManifest['source']) {
  const path=resolve(directory);await mkdir(path,{recursive:true,mode:0o700});
  if((await readdir(path)).length)throw new Error('Backup directory must be empty.');
  const created=new Date().toISOString(),a=await snapshot(control,'control'),b=await snapshot(apps,'apps');
  const controlText=JSON.stringify(redacted(a.data,created)),appsText=JSON.stringify(b.data);
  if(Buffer.byteLength(controlText)>MAX_JSON||Buffer.byteLength(appsText)>MAX_JSON)throw new Error('Backup JSON limit exceeded.');
  const bundle:BackupBundle={control:JSON.parse(controlText),apps:JSON.parse(appsText),manifest:{format:'promptfun-backup',version:1,created_at:created,source:fingerprints,
    hashes:{control:sha(controlText),apps:sha(appsText)},migrations:{control:a.migrations,apps:b.migrations},excluded:EXCLUDED,cross_plane_atomic:false}};
  validateBundle(bundle);await mkdir(join(path,'objects'),{mode:0o700});
  for(const file of bundle.apps.app_files) {
    const bytes=await objects.get(file.object_path,{size_bytes:file.size_bytes,sha256:file.sha256});
    if(bytes.length!==file.size_bytes||sha(bytes)!==file.sha256)throw new Error('Backup object integrity failure.');
    await writeFile(join(path,'objects',file.id+'.bin'),bytes,{flag:'wx',mode:0o600});
  }
  await writeFile(join(path,'control.json'),controlText,{flag:'wx',mode:0o600});await writeFile(join(path,'apps.json'),appsText,{flag:'wx',mode:0o600});
  // The manifest is the completion marker. An interrupted backup is never reported complete.
  await writeFile(join(path,'manifest.json'),JSON.stringify(bundle.manifest),{flag:'wx',mode:0o600});return bundle.manifest;
}
export async function verifyBackup(directory: string): Promise<BackupBundle> {
  const path=resolve(directory),manifest=JSON.parse((await bytesFile(join(path,'manifest.json'),1048576)).toString());
  const a=await bytesFile(join(path,'control.json'),MAX_JSON),b=await bytesFile(join(path,'apps.json'),MAX_JSON);
  if(sha(a)!==manifest.hashes?.control||sha(b)!==manifest.hashes?.apps)throw new Error('Backup data hash mismatch.');
  const bundle={manifest,control:JSON.parse(a.toString()),apps:JSON.parse(b.toString())} as BackupBundle;validateBundle(bundle);
  for(const file of bundle.apps.app_files) {const bytes=await bytesFile(join(path,'objects',file.id+'.bin'),5242880);if(bytes.length!==file.size_bytes||sha(bytes)!==file.sha256)throw new Error('Backup object hash mismatch.');}
  return bundle;
}
export function assertIsolatedTargets(source: BackupManifest['source'], target: BackupManifest['source']) {
  if(target.control===target.apps||[source.control,source.apps].includes(target.control)||[source.control,source.apps].includes(target.apps)||source.objects===target.objects)
    throw new Error('Restore requires separate isolated target databases and object storage.');
}
export async function assertEmptyDatabase(db: BackupDatabase) {
  const tables=(await db.query("select tablename from pg_tables where schemaname='public' and tablename<>'promptfun_migrations' order by tablename")).rows;
  for(const table of tables)if((await db.query(`select 1 from public.${identifier(table.tablename)} limit 1`)).rows.length)throw new Error('Restore target database is not empty.');
}
async function insertRows(db: BackupDatabase, table: string, rows: Row[]) {
  const columns=(await db.query('select column_name,udt_name from information_schema.columns where table_schema=\'public\' and table_name=$1',[table])).rows;
  const types=new Map(columns.map(column=>[column.column_name,column.udt_name]));
  for(const row of rows) {
    const names=Object.keys(row);if(!names.length||names.some(name=>!types.has(name)))throw new Error('Backup schema does not match the target.');
    const values=names.map(name=> {
      const value=row[name],type=types.get(name);if(value===null)return null;
      if(type==='json'||type==='jsonb')return JSON.stringify(value);
      if(type==='_uuid') {if(!Array.isArray(value)||value.some(id=>typeof id!=='string'||!uuid.test(id)))throw new Error('Invalid backup UUID array.');return '{'+value.join(',')+'}';}
      return value;
    });
    await db.query(`insert into public.${identifier(table)}(${names.map(identifier).join(',')}) values(${names.map((_,i)=>'$'+(i+1)).join(',')})`,values);
  }
}
function restoredRows(bundle: BackupBundle) {
  const control=structuredClone(bundle.control),apps=structuredClone(bundle.apps),now=new Date().toISOString();
  const published=control.projects.map(row=>({id:row.id,version:row.published_version_id}));
  for(const project of control.projects)project.published_version_id=null;
  control.app_versions=orderedVersions(control.app_versions);
  for(const quota of control.free_quota_days)quota.held=0;
  for(const job of control.generation_jobs) {
    if(['queued','running','validating'].includes(job.status)) {job.status='cancelled';job.error='Restaurado sin reanudar inferencia; conecta nuevamente el proveedor.';}
    if(job.usage_status==='pending')job.usage_status='unknown';job.lease_owner=null;job.lease_until=null;
  }
  for(const attempt of control.generation_attempts) {if(attempt.state==='prepared')attempt.state='rejected';else if(attempt.state==='submitted')attempt.state='uncertain';attempt.next_reconcile_at=null;}
  for(const connection of control.provider_connections) {connection.secret_ciphertext='RESTORE_REQUIRES_RECONNECT';connection.state='revoked';connection.revoked_at=now;}
  return {control,apps,published};
}
/** Target schema must already be migrated. SQL is transactional per database, not across
 * two databases/S3. If a COMMIT outcome is uncertain we retain objects and report failure;
 * we never erase potentially durable restored data or declare partial restoration success. */
export async function restoreBackup(directory: string, control: BackupDatabase, apps: BackupDatabase, objects: ObjectStore, target: BackupManifest['source']) {
  const bundle=await verifyBackup(directory);assertIsolatedTargets(bundle.manifest.source,target);
  await assertEmptyDatabase(control);await assertEmptyDatabase(apps);if(!await objects.isEmpty())throw new Error('Restore target object container is not empty.');
  for(const [db,plane] of [[control,'control'],[apps,'apps']] as const) {
    const applied=(await db.query('select name,sha256 from public.promptfun_migrations order by name')).rows;
    if(JSON.stringify(applied)!==JSON.stringify(bundle.manifest.migrations[plane]))throw new Error('Restore target schema differs from backup migrations.');
  }
  const rows=restoredRows(bundle);let controlBegun=false,appsBegun=false,commitStarted=false,controlLocked=false,appsLocked=false;const uploaded:string[]=[];
  try {
    await control.query('select pg_advisory_lock($1,$2)',RESTORE_LOCK);controlLocked=true;
    await apps.query('select pg_advisory_lock($1,$2)',RESTORE_LOCK);appsLocked=true;
    await control.query('begin');controlBegun=true;await apps.query('begin');appsBegun=true;
    for(const [db,plane] of [[control,'control'],[apps,'apps']] as const) {
      const names=(await db.query("select tablename from pg_tables where schemaname='public' and tablename<>'promptfun_migrations'")).rows.map(row=>'public.'+identifier(row.tablename));
      if(names.length)await db.query('lock table '+names.join(',')+' in access exclusive mode');await assertEmptyDatabase(db);
      for(const table of BACKUP_TABLES[plane])await insertRows(db,table,rows[plane][table]);
    }
    for(const project of rows.published)if(project.version)await control.query('update public.projects set published_version_id=$2 where id=$1',[project.id,project.version]);
    for(const file of bundle.apps.app_files) {
      const bytes=await bytesFile(join(resolve(directory),'objects',file.id+'.bin'),5242880);
      if(bytes.length!==file.size_bytes||sha(bytes)!==file.sha256)throw new Error('Backup changed during restore.');
      // Include the path before PUT: a dropped response may still leave the object durable.
      uploaded.push(file.object_path);await objects.put(file.object_path,bytes);await objects.get(file.object_path,{size_bytes:file.size_bytes,sha256:file.sha256});
    }
    commitStarted=true;await apps.query('commit');appsBegun=false;await control.query('commit');controlBegun=false;
    return {restored:true,projects:rows.control.projects.length,files:rows.apps.app_files.length,identities_require_recovery:true};
  } catch(error) {
    if(controlBegun)await control.query('rollback').catch(()=>{});if(appsBegun)await apps.query('rollback').catch(()=>{});
    if(!commitStarted)for(const path of uploaded)await objects.delete(path).catch(()=>{});
    throw error;
  } finally {await Promise.all([controlLocked?control.query('select pg_advisory_unlock($1,$2)',RESTORE_LOCK):Promise.resolve(),appsLocked?apps.query('select pg_advisory_unlock($1,$2)',RESTORE_LOCK):Promise.resolve()]);}
}
export function restoreConfig(source: Config, env: NodeJS.ProcessEnv): Config {
  const required=(key:string)=>{const value=env[key];if(!value)throw new Error('Explicit isolated RESTORE_* configuration is required.');return value;};
  const provider=required('RESTORE_BACKEND_PROVIDER');if(!['neon','supabase'].includes(provider))throw new Error('Invalid restore provider.');
  const config={...source,backendProvider:provider as Config['backendProvider'],controlDatabaseUrl:required('RESTORE_CONTROL_DATABASE_URL'),appsDatabaseUrl:required('RESTORE_APPS_DATABASE_URL')};
  if(provider==='neon') {
    config.neonStorageEndpoint=required('RESTORE_NEON_STORAGE_ENDPOINT');config.neonStorageAccessKeyId=required('RESTORE_NEON_STORAGE_ACCESS_KEY_ID');config.neonStorageSecretAccessKey=required('RESTORE_NEON_STORAGE_SECRET_ACCESS_KEY');config.neonStorageBucket=required('RESTORE_NEON_STORAGE_BUCKET');config.neonStorageRegion=env.RESTORE_NEON_STORAGE_REGION||'us-east-1';
  } else {config.appsSupabaseUrl=required('RESTORE_APPS_SUPABASE_URL');config.appsSecretKey=required('RESTORE_APPS_SECRET_KEY');}
  // Explicit credentials may already cover multiple isolated buckets. Isolation is the
  // destination namespace and empty-state proof; changing keys does not make a shared bucket safe.
  assertIsolatedTargets(sourceFingerprints(source),sourceFingerprints(config));
  return config;
}
async function cli(mode:string,directory:string) {
  if(mode==='verify') {await verifyBackup(directory);console.log('Private backup verified.');return;}
  if(!['backup','restore'].includes(mode))throw new Error('Use backup, verify or restore.');
  const source=loadConfig(),config=mode==='restore'?restoreConfig(source,process.env):source;
  const control=new Pool(databaseOptions(config.controlDatabaseUrl,true)),apps=new Pool(databaseOptions(config.appsDatabaseUrl,true));let a:PoolClient|undefined,b:PoolClient|undefined;
  try {
    a=await control.connect();b=await apps.connect();const objects=createObjectStore(config),fingerprints=sourceFingerprints(config);
    if(mode==='backup')await writeBackup(directory,a,b,objects,fingerprints);
    else {
      const bundle=await verifyBackup(directory);assertIsolatedTargets(bundle.manifest.source,fingerprints);
      await assertEmptyDatabase(a);await assertEmptyDatabase(b);if(!await objects.isEmpty())throw new Error('Restore target object container is not empty.');
      await migrateClient(a,resolve('supabase/control/migrations'));await migrateClient(b,resolve('supabase/apps/migrations'));
      await restoreBackup(directory,a,b,objects,fingerprints);
    }
    console.log(mode==='backup'?`Private backup complete at ${directory}; output is excluded from Git.`:'Isolated restore complete. Provider permissions remain revoked; identity recovery is required.');
  } finally {a?.release();b?.release();await Promise.all([control.end(),apps.end()]);}
}
export async function latestBackupDirectory(root=resolve('.local/backups')) {
  const candidates:{path:string;modified:number}[]=[];
  for(const entry of await readdir(root,{withFileTypes:true}))if(entry.isDirectory()) {
    const path=join(root,entry.name),marker=await lstat(join(path,'manifest.json')).catch(()=>null);
    if(marker?.isFile()&&!marker.isSymbolicLink())candidates.push({path,modified:marker.mtimeMs});
  }
  candidates.sort((a,b)=>b.modified-a.modified);
  if(!candidates.length)throw new Error('No completed backup found; specify its directory.');return candidates[0].path;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const mode=process.argv[2]||'backup';
  try {
    const directory=process.argv[3]?resolve(process.argv[3]):mode==='backup'?resolve('.local/backups/'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()):await latestBackupDirectory();
    await cli(mode,directory);
  }catch {console.error('Backup/restore failed. Specify a completed backup directory and inspect any partial target. No credentials were logged.');process.exitCode=1;}
}

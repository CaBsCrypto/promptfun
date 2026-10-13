import { randomUUID, createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { Pool } from 'pg';
import { loadConfig } from '../server/config.js';
import { databaseOptions, databaseIdentity } from '../server/control/database.js';
import { createObjectStore } from '../server/runtime/storage.js';

const config=loadConfig();
if(config.backendProvider!=='neon')throw new Error('This check targets the selected Neon backend.');
if(databaseIdentity(config.controlDatabaseUrl)===databaseIdentity(config.appsDatabaseUrl))throw new Error('Planes are not isolated.');
const evidence:Record<string,unknown>={date:new Date().toISOString(),provider:'neon',independent_databases:true,live:true};
for(const plane of ['control','apps'] as const){
  const pool=new Pool(databaseOptions(plane==='control'?config.controlDatabaseUrl:config.appsDatabaseUrl));
  try {
    const tables=await pool.query(`select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname<>'promptfun_migrations' order by c.relname`);
    if(!tables.rows.length||tables.rows.some(row=>!row.relrowsecurity))throw new Error('RLS is not enabled on all '+plane+' tables.');
    const auth=await pool.query("select exists(select 1 from pg_namespace where nspname='neon_auth') as present");
    if(!auth.rows[0].present)throw new Error('Managed identity schema missing.');
    evidence[plane]={tables:tables.rows.map(row=>row.relname),rls_enabled:true,managed_identity:true};
  } finally { await pool.end(); }
}
const objects=createObjectStore(config),path=[randomUUID(),randomUUID(),randomUUID()].join('/');
const bytes=Buffer.from('promptfun infrastructure verification '+new Date().toISOString());
const metadata={size_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
try {
  await objects.put(path,bytes);
  const downloaded=await objects.get(path,metadata);
  if(!downloaded.equals(bytes))throw new Error('Live object mismatch.');
  const response=await fetch(`${config.neonStorageEndpoint!.replace(/\/$/,'')}/${config.neonStorageBucket||'app-files'}/${path}`,{redirect:'error',signal:AbortSignal.timeout(15000)});
  await response.body?.cancel();
  if(response.ok)throw new Error('Object unexpectedly allows anonymous reads.');
  if(![401,403].includes(response.status))throw new Error('Anonymous read check inconclusive: '+response.status);
  evidence.storage={put_get_verified:true,sha256_verified:true,anonymous_read_denied:response.status};
} finally { await objects.delete(path); }
await mkdir('.local/evidence',{recursive:true});
await writeFile('.local/evidence/neon-infrastructure.json',JSON.stringify(evidence,null,2));
console.log('Live Neon: two isolated databases, managed identity, RLS and private S3 PUT/GET/hash/anonymous denial verified.');

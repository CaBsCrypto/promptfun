import { Pool, type PoolClient } from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadConfig } from '../server/config.js';
import { databaseOptions } from '../server/control/database.js';

export const MIGRATION_LOCK = [1725162101, 8411] as const;
export type MigrationClient = Pick<PoolClient, 'query'>;
export async function migrateClient(client: MigrationClient, directory: string, log: (message: string) => void = () => {}) {
 await client.query('select pg_advisory_lock($1,$2)', [...MIGRATION_LOCK]);
 try {
  await client.query(`create table if not exists public.promptfun_migrations(name text primary key,sha256 text,applied_at timestamptz not null default now());
   alter table public.promptfun_migrations add column if not exists sha256 text;revoke all on public.promptfun_migrations from public;`);
  for(const name of (await readdir(directory)).filter(x=>x.endsWith('.sql')).sort()) {
   if(!/^\d{12,}_[a-z0-9_-]+\.sql$/.test(name))throw new Error('Invalid migration filename.');
   const sql=await readFile(resolve(directory,name),'utf8'),digest=createHash('sha256').update(sql).digest('hex');
   const applied=await client.query('select sha256 from public.promptfun_migrations where name=$1',[name]);
   if(applied.rowCount) {if(applied.rows[0].sha256!==digest)throw new Error('Applied migration checksum requires review: '+name);continue;}
   await client.query('begin');
   try {await client.query(sql);await client.query('insert into public.promptfun_migrations(name,sha256) values($1,$2)',[name,digest]);await client.query('commit');log('Applied '+name);}
   catch(error) {await client.query('rollback').catch(()=>{});throw error;}
  }
 } finally {await client.query('select pg_advisory_unlock($1,$2)', [...MIGRATION_LOCK]);}
}
export async function migrate(url:string,directory:string) {
 const pool=new Pool(databaseOptions(url,true));let client:PoolClient|undefined;
 try {client=await pool.connect();await migrateClient(client,directory,console.log);}
 finally {client?.release();await pool.end();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 try {const config=loadConfig();await migrate(config.controlDatabaseUrl,resolve('supabase/control/migrations'));await migrate(config.appsDatabaseUrl,resolve('supabase/apps/migrations'));}
 catch {console.error('Migration failed. Check database access and migration checksum; no secrets were logged.');process.exitCode=1;}
}

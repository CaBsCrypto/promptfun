import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createPrivateKey,sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { Keypair } from '@solana/web3.js';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import type { Server } from 'node:http';
import { createMarketRouter } from '../server/market/index.js';
import { HttpError,type CoreContext } from '../server/shared.js';

// Real PostgreSQL engine and production migrations, with serialized backend connections.
// These tests do not claim live RPC, native multi-session Postgres or a deployed program.
let db:PGlite,ctx:CoreContext,server:Server,base:string;
const alice=randomUUID(),bob=randomUUID(),csrf='market-database-csrf';let tail=Promise.resolve();
async function lock(){const previous=tail;let release!:()=>void;tail=new Promise<void>(r=>{release=r;});await previous;return release;}
async function query(sql:string,params:any[]=[]) {const r=await db.query(sql,params);return {rows:r.rows,rowCount:r.rows.length||r.affectedRows||0};}
before(async()=>{
  db=new PGlite({extensions:{pgcrypto}});await db.waitReady;await db.exec('create role anon;create role authenticated;');
  for(const file of ['202610130001_control.sql','202610130002_market.sql'])await db.exec(await readFile(new URL(`../supabase/control/migrations/${file}`,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/control/migrations/202610130002_market.sql',import.meta.url),'utf8'));
  const pool={query:async(sql:string,values:any[]=[])=>{const release=await lock();try{return await query(sql,values);}finally{release();}},connect:async()=>{const release=await lock();return {query,release};}};
  ctx={control:pool,apps:pool,config:{platformOrigin:'http://localhost:3000',solanaRpcUrl:'https://api.devnet.solana.com',marketProgramId:'',registrarKeyPath:''}} as unknown as CoreContext;
  await ctx.control.query('insert into platform_users(id,email) values($1,$2),($3,$4)',[alice,'market-alice@example.invalid',bob,'market-bob@example.invalid']);
  const app=express();app.use(express.json());app.use('/api',createMarketRouter(ctx,async req=>{
    const id=req.get('x-test-user');if(id!==alice&&id!==bob)throw new HttpError(401,'UNAUTHENTICATED','Inicia sesión.');
    return {id,email:'fixture@example.invalid',csrf_token:csrf,session_id:randomUUID()};
  }));
  app.use((e:any,_req:any,res:any,_next:any)=>res.status(e.status||500).json({error:{code:e.code||'INTERNAL',message:e.message}}));
  server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${(server.address() as any).port}/api`;
});
after(async()=>{if(server)await new Promise<void>(r=>server.close(()=>r()));if(db)await db.close();});
async function project(user=alice){const id=randomUUID();await ctx.control.query('insert into projects(id,owner_id,title) values($1,$2,$3)',[id,user,'Market SQL fixture']);return id;}
async function api(path:string,body:any,user=alice){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3000','X-CSRF-Token':csrf,'X-Test-User':user},body:JSON.stringify(body)});return {status:response.status,body:await response.json() as any};}
function proof(key:Keypair,message:string){const secret=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(key.secretKey.subarray(0,32))]),type:'pkcs8',format:'der'});return sign(null,Buffer.from(message),secret).toString('base64');}
test('SQL nonce consumption is atomic and a concurrent replay never creates two bindings',async()=>{
  const id=await project(),key=Keypair.generate(),address=key.publicKey.toBase58();
  const issued=await api(`/projects/${id}/wallet/challenge`,{address});assert.equal(issued.status,200);
  const request={address,nonce:issued.body.nonce,signature:proof(key,issued.body.message)};
  const results=await Promise.all([api(`/projects/${id}/wallet/verify`,request),api(`/projects/${id}/wallet/verify`,request)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
  const p=(await ctx.control.query('select wallet_address from projects where id=$1',[id])).rows[0];assert.equal(p.wallet_address,address);
  assert.equal((await ctx.control.query('select * from project_wallet_bindings where project_id=$1',[id])).rowCount,1);
});
test('SQL ownership and proof rejection keep private wallets unchanged',async()=>{
  const id=await project(),key=Keypair.generate(),address=key.publicKey.toBase58();
  assert.equal((await api(`/projects/${id}/wallet/challenge`,{address},bob)).status,404);
  const c=(await api(`/projects/${id}/wallet/challenge`,{address})).body;
  const invalid=await api(`/projects/${id}/wallet/verify`,{address,nonce:c.nonce,signature:proof(Keypair.generate(),c.message)});assert.equal(invalid.status,401);
  assert.equal((await ctx.control.query('select wallet_address from projects where id=$1',[id])).rows[0].wallet_address,null);
  assert.equal((await ctx.control.query('select consumed_at from project_wallet_challenges where nonce=$1',[c.nonce])).rows[0].consumed_at,null);
});
test('SQL signature uniqueness prevents assigning one transfer to different projects',async()=>{
  const a=await project(),b=await project(),sig='fixture-unique-chain-signature';
  const sql="insert into solana_transactions(id,project_id,user_id,kind,signature,ix_index,message_hash,expected_signer,expires_at) values($1,$2,$3,'funding',$4,0,$5,'fixture-signer',now()+interval '1 minute')";
  await ctx.control.query(sql,[randomUUID(),a,alice,sig,'fixture-message-a']);
  await assert.rejects(ctx.control.query(sql,[randomUUID(),b,alice,sig,'fixture-message-b']),e=>(e as any).code==='23505');
  assert.equal((await ctx.control.query('select * from solana_transactions where signature=$1',[sig])).rowCount,1);
});
test('SQL financial tables fail closed for direct browser roles',async()=>{
  await ctx.control.query('set role anon');
  try {await assert.rejects(ctx.control.query('select * from project_wallet_challenges'),e=>(e as any).code==='42501');}
  finally {await ctx.control.query('reset role');}
});
test('market SQL migration supports Neon without Supabase roles',async()=>{
  const neon=new PGlite();await neon.waitReady;
  try {
    await neon.exec('create table platform_users(id uuid primary key);create table projects(id uuid primary key);');
    const migration=await readFile(new URL('../supabase/control/migrations/202610130002_market.sql',import.meta.url),'utf8');
    await neon.exec(migration);await neon.exec(migration);
    const result=await neon.query("select column_name from information_schema.columns where table_name='solana_transactions' and column_name='recovery_cursor'");
    assert.equal(result.rows.length,1);
  }finally{await neon.close();}
});

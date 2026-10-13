import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { createControlRouter } from '../server/control/index.js';
import { encryptSecret, hash, nonce } from '../server/control/security.js';
import { HttpError, type CoreContext } from '../server/shared.js';

// Real production SQL/HTTP and Ed25519 signatures. PGlite serializes its one
// backend; managed email Auth is an explicit fixture. No wallet RPC or funds.
let db:PGlite,ctx:CoreContext,server:Server,baseUrl:string;
const nativeFetch=globalThis.fetch;
const alice=randomUUID(),bob=randomUUID(),aliceToken=nonce(),bobToken=nonce(),csrf='wallet-sql-test-csrf';
let remoteCalls=0,tail=Promise.resolve();
type Browser=Map<string,string>;
const browser=(token?:string)=>new Map(token?[['pf_session',token]]:[]);
const aliceBrowser=browser(aliceToken),bobBrowser=browser(bobToken);
const wallet=()=>{const key=nacl.sign.keyPair();return {address:new PublicKey(key.publicKey).toBase58(),sign:(message:string)=>Buffer.from(nacl.sign.detached(Buffer.from(message,'utf8'),key.secretKey)).toString('base64')};};
async function lock(){const previous=tail;let unlock!:()=>void;tail=new Promise<void>(resolve=>{unlock=resolve;});await previous;return unlock;}
async function query(sql:string,values:any[]=[]) {const result=await db.query<any>(sql,values);return {rows:result.rows,rowCount:result.rows.length||result.affectedRows||0};}
before(async()=>{
  db=new PGlite({extensions:{pgcrypto}});await db.waitReady;await db.exec('create role anon;create role authenticated;');
  for(const file of ['202610130001_control.sql','202610130003_identity.sql','202610130004_publications.sql','202610130005_wallet_auth.sql'])
    await db.exec(await readFile(new URL('../supabase/control/migrations/'+file,import.meta.url),'utf8'));
  const pool={query:async(sql:string,values:any[]=[])=>{const unlock=await lock();try{return await query(sql,values);}finally{unlock();}},
    connect:async()=>{const unlock=await lock();return {query,release:unlock};}};
  ctx={control:pool,apps:pool,config:{controlSupabaseUrl:'https://email-fixture.invalid',controlPublishableKey:'fixture',
    platformOrigin:'http://localhost:3000',runtimeOrigin:'http://127.0.0.1:4000',encryptionKey:'wallet-sql-test-encryption',production:false}} as unknown as CoreContext;
  for(const [id,email,token] of [[alice,'alice@example.invalid',aliceToken],[bob,'bob@example.invalid',bobToken]]) {
    await ctx.control.query("insert into platform_users(id,email,auth_provider,auth_subject) values($1,$2,'supabase',$3)",[id,email,id]);
    await ctx.control.query('insert into platform_sessions(user_id,token_hash,csrf_token,auth_token_ciphertext,expires_at) values($1,$2,$3,$4,now()+interval \'1 hour\')',[id,hash(token),csrf,encryptSecret('fixture:'+id,ctx.config.encryptionKey)]);
  }
  globalThis.fetch=(async(input:any,init?:RequestInit)=>{
    remoteCalls++;const id=new Headers(init?.headers).get('Authorization')?.replace('Bearer fixture:','');
    if(String(input).endsWith('/auth/v1/user')&&(id===alice||id===bob))return Response.json({id,email:id===alice?'alice@example.invalid':'bob@example.invalid',email_confirmed_at:'2026-10-13T00:00:00Z'});
    throw new Error('Unexpected provider request in wallet auth test.');
  }) as any;
  const app=express();app.use(express.json());app.use('/api',createControlRouter(ctx));
  app.use(((error:any,_req:any,res:any,_next:any)=>res.status(error instanceof HttpError?error.status:500).json({error:{code:error.code||'INTERNAL',message:error.message}})) as express.ErrorRequestHandler);
  server=await new Promise<Server>(resolve=>{const listening=app.listen(0,'127.0.0.1',()=>resolve(listening));});
  baseUrl=`http://127.0.0.1:${(server.address() as any).port}/api`;
});
after(async()=>{globalThis.fetch=nativeFetch;if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));if(db)await db.close();});
async function api(path:string,jar:Browser,options:{method?:string;body?:any;token?:string;origin?:string}={}) {
  const headers:Record<string,string>={Origin:options.origin||ctx.config.platformOrigin,'Content-Type':'application/json','X-CSRF-Token':options.token||csrf,
    Cookie:[...jar].map(([key,value])=>key+'='+value).join(';'),'Idempotency-Key':nonce()};
  const response=await nativeFetch(baseUrl+path,{method:options.method||'GET',headers,...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
  const cookies=response.headers.getSetCookie();
  for(const cookie of cookies){const [pair]=cookie.split(';'),[key,...value]=pair.split('=');if(!value.join('='))jar.delete(key);else jar.set(key,value.join('='));}
  return {status:response.status,body:await response.json(),cookies};
}
const challenge=(jar:Browser,w:ReturnType<typeof wallet>,mode:'login'|'link'='login',token?:string)=>api('/auth/wallet/challenge',jar,{method:'POST',body:{address:w.address,mode},token});
const confirm=(jar:Browser,w:ReturnType<typeof wallet>,data:any,token?:string)=>api('/auth/wallet/verify',jar,{method:'POST',body:{challenge_id:data.challenge_id,signature:w.sign(data.message)},token});

test('wallet challenge binds exact host, URI, Devnet, purpose, nonce, expiration and browser',async()=>{
  const w=wallet(),jar=browser();
  assert.equal((await api('/auth/wallet/challenge',jar,{method:'POST',body:{address:w.address,mode:'login'},origin:'http://localhost:3001'})).status,403);
  const created=await challenge(jar,w);assert.equal(created.status,200);
  assert.ok(created.cookies.some(cookie=>cookie.includes('HttpOnly')&&cookie.includes('SameSite=Strict')&&cookie.includes('Path=/api/auth/wallet')));
  const data=created.body;assert.ok(data.message.startsWith('localhost:3000 wants you to sign in with your Solana account:\n'+w.address));
  assert.ok(data.message.includes('URI: http://localhost:3000\n'));assert.ok(data.message.includes('Chain ID: solana:devnet\n'));
  assert.ok(data.message.includes('urn:promptfun:wallet-auth:login'));assert.match(data.message,/Nonce: [a-f0-9]{64}\n/);
  const stored=(await ctx.control.query('select * from wallet_auth_challenges where id=$1',[data.challenge_id])).rows[0];
  assert.equal(new Date(stored.expires_at).getTime()-new Date(stored.created_at).getTime(),300000);
  assert.equal(stored.browser_token_hash,hash(jar.get('pf_wallet_flow')!));assert.notEqual(stored.browser_token_hash,jar.get('pf_wallet_flow'));
  assert.equal((await confirm(browser(),w,data)).status,403);
  assert.equal((await confirm(jar,wallet(),data)).body.error.code,'INVALID_WALLET_SIGNATURE');
  assert.equal((await ctx.control.query('select consumed_at from wallet_auth_challenges where id=$1',[data.challenge_id])).rows[0].consumed_at,null);
  const clone=browser();clone.set('pf_wallet_flow',jar.get('pf_wallet_flow')!);
  const altered={...data,message:data.message.replace('Chain ID: solana:devnet','Chain ID: solana:mainnet')};
  assert.equal((await confirm(clone,w,altered)).body.error.code,'INVALID_WALLET_SIGNATURE');
});

test('real Ed25519 wallet login consumes once concurrently, keeps email null and survives reload/logout',async()=>{
  const w=wallet(),jar=browser(),created=(await challenge(jar,w)).body,remoteBefore=remoteCalls;
  const a=new Map(jar),b=new Map(jar);const results=await Promise.all([confirm(a,w,created),confirm(b,w,created)]);
  assert.deepEqual(results.map(result=>result.status).sort(),[200,403]);
  const logged=results.find(result=>result.status===200)!;const current=results[0].status===200?a:b;
  assert.equal(logged.body.user.email,null);assert.equal(logged.body.user.wallet_address,w.address);
  assert.ok(logged.cookies.some(cookie=>cookie.startsWith('pf_session=')&&cookie.includes('HttpOnly')));
  const stored=(await ctx.control.query('select auth_provider,auth_subject,email from platform_users where id=$1',[logged.body.user.id])).rows[0];
  assert.deepEqual(stored,{auth_provider:'solana',auth_subject:w.address,email:null});
  const sessions=(await ctx.control.query('select auth_method,auth_token_ciphertext,token_hash from platform_sessions where user_id=$1',[logged.body.user.id])).rows;
  assert.equal(sessions.length,1);assert.equal(sessions[0].auth_method,'solana');assert.equal(sessions[0].auth_token_ciphertext,null);
  assert.equal(sessions[0].token_hash,hash(current.get('pf_session')!));
  assert.equal((await api('/session',current)).body.user.id,logged.body.user.id);
  const p=await api('/projects',current,{method:'POST',body:{title:'Wallet only test'},token:logged.body.csrf_token});assert.equal(p.status,201);
  assert.equal(p.body.project.owner_id,logged.body.user.id);assert.equal(p.body.project.wallet_address,null);
  assert.equal((await api('/auth/wallet',current)).body.credential.address,w.address);
  assert.equal((await api('/auth/wallet',current,{method:'DELETE',token:logged.body.csrf_token})).body.error.code,'LAST_LOGIN_METHOD');
  assert.equal((await api('/auth/logout',current,{method:'POST',body:{},token:'wrong'})).status,403);
  assert.equal((await api('/auth/logout',current,{method:'POST',body:{},token:logged.body.csrf_token})).status,200);
  assert.equal((await api('/session',current)).body.user,null);assert.equal(remoteCalls,remoteBefore);
  const fresh=(await challenge(current,w)).body;const relogged=await confirm(current,w,fresh);assert.equal(relogged.body.user.id,logged.body.user.id);
});

test('expired challenge and reused nonce are denied by real database state',async()=>{
  const w=wallet(),jar=browser(),created=(await challenge(jar,w)).body;
  await assert.rejects(ctx.control.query(`insert into wallet_auth_challenges(id,nonce,address,mode,origin,message,browser_token_hash,created_at,expires_at)
    select $1,nonce,address,mode,origin,message,browser_token_hash,created_at,expires_at from wallet_auth_challenges where id=$2`,[randomUUID(),created.challenge_id]),/unique|duplicate/i);
  await ctx.control.query("update wallet_auth_challenges set created_at=now()-interval '6 minutes',expires_at=now()-interval '1 minute' where id=$1",[created.challenge_id]);
  assert.equal((await confirm(jar,w,created)).status,403);
  assert.equal((await ctx.control.query('select consumed_at from wallet_auth_challenges where id=$1',[created.challenge_id])).rows[0].consumed_at,null);
});

test('wallet link is CSRF/session/account bound and never auto-links another identity',async()=>{
  const w=wallet();
  assert.equal((await challenge(aliceBrowser,w,'link','wrong')).status,403);
  const created=await challenge(aliceBrowser,w,'link');assert.equal(created.status,200);assert.ok(created.body.message.includes('urn:promptfun:account:'+alice));
  const stolen=new Map(bobBrowser);stolen.set('pf_wallet_flow',aliceBrowser.get('pf_wallet_flow')!);
  assert.equal((await confirm(stolen,w,created.body)).status,403);
  assert.equal((await confirm(aliceBrowser,w,created.body,'wrong')).status,403);
  assert.equal((await confirm(aliceBrowser,w,created.body)).body.user.id,alice);
  assert.equal(aliceBrowser.get('pf_session'),aliceToken);
  const fresh=browser(),login=(await challenge(fresh,w)).body;const logged=await confirm(fresh,w,login);
  assert.equal(logged.body.user.id,alice);assert.equal(logged.body.user.email,'alice@example.invalid');
  const other=(await challenge(bobBrowser,w,'link')).body;assert.equal((await confirm(bobBrowser,w,other)).body.error.code,'WALLET_ALREADY_LINKED');
  assert.equal((await ctx.control.query('select user_id from wallet_credentials where address=$1',[w.address])).rows[0].user_id,alice);
  assert.equal((await api('/auth/wallet',aliceBrowser,{method:'DELETE',token:'wrong'})).status,403);
  assert.equal((await api('/auth/wallet',aliceBrowser,{method:'DELETE'})).status,200);
  assert.equal((await api('/session',fresh)).body.user,null);
  assert.equal((await api('/session',aliceBrowser)).body.user.id,alice);
  const revokedBrowser=browser(),revokedChallenge=(await challenge(revokedBrowser,w)).body;
  assert.equal((await confirm(revokedBrowser,w,revokedChallenge)).body.error.code,'WALLET_RELINK_REQUIRED');
  const relink=(await challenge(aliceBrowser,w,'link')).body;assert.equal((await confirm(aliceBrowser,w,relink)).status,200);
});

test('link nonce is bound to the exact managed session and wallet revocation invalidates live sessions',async()=>{
  const w=wallet(),created=(await challenge(aliceBrowser,w,'link')).body;
  const otherToken=nonce();await ctx.control.query('insert into platform_sessions(user_id,token_hash,csrf_token,auth_token_ciphertext,expires_at) values($1,$2,$3,$4,now()+interval \'1 hour\')',[alice,hash(otherToken),csrf,encryptSecret('fixture:'+alice,ctx.config.encryptionKey)]);
  const other=browser(otherToken);other.set('pf_wallet_flow',aliceBrowser.get('pf_wallet_flow')!);
  assert.equal((await confirm(other,w,created)).status,403);
  const owned=wallet(),jar=browser(),data=(await challenge(jar,owned)).body;const logged=(await confirm(jar,owned,data)).body;
  await ctx.control.query("update wallet_credentials set state='revoked',revoked_at=now() where user_id=$1",[logged.user.id]);
  assert.equal((await api('/session',jar)).body.user,null);
  assert.ok((await ctx.control.query('select revoked_at from platform_sessions where user_id=$1',[logged.user.id])).rows[0].revoked_at);
});

test('RLS and session foreign keys protect wallet credentials and nonce tables',async()=>{
  for(const role of ['anon','authenticated']){
    await ctx.control.query('set role '+role);
    for(const table of ['wallet_credentials','wallet_auth_challenges'])await assert.rejects(ctx.control.query('select * from '+table),/permission denied/i);
    await ctx.control.query('reset role');
  }
  const credential=(await ctx.control.query('select id,user_id from wallet_credentials limit 1')).rows[0];
  const wrongOwner=credential.user_id===alice?bob:alice;
  await assert.rejects(ctx.control.query("insert into platform_sessions(user_id,token_hash,csrf_token,expires_at,auth_method,wallet_credential_id) values($1,$2,'test',now()+interval '1 hour','solana',$3)",[wrongOwner,nonce(),credential.id]),/foreign key/i);
  await assert.rejects(ctx.control.query("insert into platform_sessions(user_id,token_hash,csrf_token,expires_at,auth_method) values($1,$2,'test',now()+interval '1 hour','solana')",[alice,nonce()]),/check constraint/i);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createPrivateKey, sign } from 'node:crypto';
import { Keypair } from '@solana/web3.js';
import type { AddressInfo } from 'node:net';
import { createMarketRouter } from '../server/market/index.js';
import { HttpError, type CoreContext } from '../server/shared.js';

const projectId='44444444-aaaa-4bbb-8ccc-123456789abc',owner='11111111-aaaa-4bbb-8ccc-123456789abc',other='22222222-aaaa-4bbb-8ccc-123456789abc';
/** HTTP integration with a deterministic database boundary; real Ed25519 and routing are exercised. */
class ControlFixture {
  project={id:projectId,owner_id:owner,wallet_address:null as string|null,published_version_id:null};
  challenges=new Map<string,any>();bindings=new Map<string,string>();
  async query(sql:string,args:any[]=[]):Promise<{rows:any[];rowCount:number}> {
    let rows:any[]=[];
    if(sql.startsWith('select * from projects')||sql.startsWith('select wallet_address from projects')) rows=args[0]===projectId?[this.project]:[];
    else if(sql.startsWith('select creator from markets')) rows=[];
    else if(sql.startsWith('insert into project_wallet_challenges')) {
      this.challenges.set(args[0],{nonce:args[0],project_id:args[1],user_id:args[2],address:args[3],message:args[4],expires_at:args[5],consumed_at:null});
    }else if(sql.startsWith('select * from project_wallet_challenges')) {
      const c=this.challenges.get(args[0]);rows=c&&c.project_id===args[1]&&c.user_id===args[2]?[c]:[];
    }else if(sql.startsWith('update project_wallet_challenges')) this.challenges.get(args[0]).consumed_at=new Date().toISOString();
    else if(sql.startsWith('insert into project_wallet_bindings')) this.bindings.set(args[0],args[2]);
    else if(sql.startsWith('update projects set wallet_address')) this.project.wallet_address=args[1];
    else if(!['begin','commit','rollback'].includes(sql)) throw new Error(`Unexpected query in fixture: ${sql}`);
    return {rows,rowCount:rows.length};
  }
  async connect() {return {query:this.query.bind(this),release(){}};}
}
async function fixture(run:(base:string,db:ControlFixture)=>Promise<void>) {
  const db=new ControlFixture(),app=express();app.use(express.json());
  const ctx={control:db,apps:db,config:{solanaRpcUrl:'https://api.devnet.solana.com',marketProgramId:'',registrarKeyPath:'',platformOrigin:'http://localhost:3000'}} as unknown as CoreContext;
  app.use('/api',createMarketRouter(ctx,async req=>{
    const id=req.get('x-test-user');if(!id)throw new HttpError(401,'UNAUTHENTICATED','Inicia sesión.');
    return {id,email:'test@example.invalid',csrf_token:'test-csrf',session_id:'test-session',...(req.get('x-test-demo')==='true'?{is_demo:true}:{})};
  }));
  app.use((err:any,_req:any,res:any,_next:any)=>res.status(err.status||500).json({error:{code:err.code||'INTERNAL_ERROR',message:err.message}}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {await run(base,db);}finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
}
function headers(user=owner) {return {'Content-Type':'application/json','Origin':'http://localhost:3000','X-CSRF-Token':'test-csrf','X-Test-User':user};}
async function post(base:string,path:string,body:any,overrides:Record<string,string>={}) {
  return fetch(`${base}${path}`,{method:'POST',headers:{...headers(),...overrides},body:JSON.stringify(body)});
}
function proof(pair:Keypair,message:string) {
  const privateKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(pair.secretKey.subarray(0,32))]),format:'der',type:'pkcs8'});
  return sign(null,Buffer.from(message),privateKey).toString('base64');
}
test('HTTP demo sessions cannot prepare, sign or submit any market or funding action',()=>fixture(async(base,db)=>{
  for(const path of [`/projects/${projectId}/wallet/challenge`,`/projects/${projectId}/wallet/verify`,
    `/projects/${projectId}/market`,`/markets/${projectId}/quote`,`/markets/${projectId}/transactions`,
    `/markets/${projectId}/submit`,`/projects/${projectId}/funding-intents`,`/funding-intents/${projectId}/submit`]) {
    const response=await post(base,path,{}, {'X-Test-Demo':'true'});
    assert.equal(response.status,403,path);assert.equal((await response.json() as any).error.code,'LOCAL_DEMO_ONLY',path);
  }
  assert.equal(db.challenges.size,0);assert.equal(db.bindings.size,0);assert.equal(db.project.wallet_address,null);
}));
test('HTTP wallet binding needs owner, correct origin and CSRF before issuing a challenge',()=>fixture(async(base,db)=>{
  const address=Keypair.generate().publicKey.toBase58(),path=`/projects/${projectId}/wallet/challenge`;
  assert.equal((await post(base,path,{address},{'X-Test-User':other})).status,404);
  assert.equal((await post(base,path,{address},{Origin:'http://malicious.invalid'})).status,403);
  assert.equal((await post(base,path,{address},{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal(db.challenges.size,0);
  const response=await post(base,path,{address});assert.equal(response.status,200);
  const c=await response.json() as any;assert.match(c.message,/localhost:3000/);assert.match(c.message,new RegExp(projectId));assert.equal(db.challenges.size,1);
}));
test('HTTP verified binding persists identity and the same nonce cannot be replayed',()=>fixture(async(base,db)=>{
  const pair=Keypair.generate(),address=pair.publicKey.toBase58();
  const c=await(await post(base,`/projects/${projectId}/wallet/challenge`,{address})).json() as any;
  const payload={address,nonce:c.nonce,signature:proof(pair,c.message)};
  const verified=await post(base,`/projects/${projectId}/wallet/verify`,payload);assert.equal(verified.status,200);
  assert.equal((await verified.json() as any).wallet_address,address);assert.equal(db.project.wallet_address,address);
  assert.equal((await post(base,`/projects/${projectId}/wallet/verify`,payload)).status,401);
}));
test('HTTP rejects wrong signer, expired nonce and a proof from another platform account',()=>fixture(async(base,db)=>{
  const pair=Keypair.generate(),address=pair.publicKey.toBase58();
  const c=await(await post(base,`/projects/${projectId}/wallet/challenge`,{address})).json() as any;
  const wrong={address,nonce:c.nonce,signature:proof(Keypair.generate(),c.message)};
  assert.equal((await post(base,`/projects/${projectId}/wallet/verify`,wrong)).status,401);
  const correct={...wrong,signature:proof(pair,c.message)};
  assert.equal((await post(base,`/projects/${projectId}/wallet/verify`,correct,{'X-Test-User':other})).status,404);
  db.challenges.get(c.nonce).expires_at=new Date(Date.now()-1000).toISOString();
  assert.equal((await post(base,`/projects/${projectId}/wallet/verify`,correct)).status,401);
  assert.equal(db.project.wallet_address,null);
}));
test('HTTP private project market is hidden and unconfigured issuance fails closed',()=>fixture(async(base)=>{
  assert.equal((await fetch(`${base}/projects/${projectId}/market`)).status,404);
  assert.equal((await fetch(`${base}/projects/${projectId}/market`,{headers:headers(other)})).status,404);
  const visible=await fetch(`${base}/projects/${projectId}/market`,{headers:headers()});assert.equal(visible.status,200);
  assert.deepEqual(await visible.json(),{market:null,configured:false});
  const blocked=await post(base,`/projects/${projectId}/market`,{});assert.equal(blocked.status,503);
  assert.equal((await blocked.json() as any).error.code,'MARKET_NOT_CONFIGURED');
}));

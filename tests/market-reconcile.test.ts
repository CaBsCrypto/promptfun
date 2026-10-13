import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Connection, Keypair } from '@solana/web3.js';
import { reconcileMarketOperations } from '../server/market/reconcile.js';
import { DEVNET_GENESIS, fundingTransaction, hash } from '../server/market/chain.js';
import type { CoreContext } from '../server/shared.js';

test('shutdown abort cancels the pending RPC and waits for its request to finish',async()=>{
  let opened!:()=>void,closed!:()=>void;
  const started=new Promise<void>(r=>{opened=r;}),finished=new Promise<void>(r=>{closed=r;});
  const server=createServer((_req,res)=>{res.once('close',closed);opened();});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const controller=new AbortController();
  const ctx={config:{solanaRpcUrl:`http://127.0.0.1:${(server.address() as any).port}`},control:{query:()=>{throw new Error('SQL must not run after aborted genesis check.');}}} as unknown as CoreContext;
  const task=reconcileMarketOperations(ctx,controller.signal),rejected=assert.rejects(task);
  try {await started;controller.abort();await rejected;await finished;}
  finally {controller.abort();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test('recovery persists pagination and finds an exact payment beyond the first forty signatures',async()=>{
  const originalGenesis=Connection.prototype.getGenesisHash,originalList=Connection.prototype.getSignaturesForAddress,originalTransaction=Connection.prototype.getTransaction;
  const sender=Keypair.generate(),recipient=Keypair.generate().publicKey;
  const transaction=fundingTransaction(sender.publicKey,recipient,5n,'recovery-intent');
  transaction.feePayer=sender.publicKey;transaction.recentBlockhash=Keypair.generate().publicKey.toBase58();transaction.sign(sender);
  const exact={meta:{err:null},transaction:{message:transaction.compileMessage()}};
  const row:any={id:'op',project_id:'project',user_id:'user',expected_signer:sender.publicKey.toBase58(),message_hash:hash(transaction.serializeMessage()),status:'prepared',signature:null,recovery_cursor:null,created_at:new Date(Date.now()-30_000).toISOString(),funding_intent_id:null};
  let commits=0;const seenCursors:(string|undefined)[]=[];
  const query=async(sql:string,args:any[]=[])=>{
    if(sql.startsWith('select *'))return {rows:row.status==='confirmed'?[]:[{...row}],rowCount:1};
    if(sql.includes('set recovery_cursor'))row.recovery_cursor=args[1];
    if(sql.includes('set signature')){row.signature=args[1];row.status=args[2];}
    if(sql==='commit')commits++;
    return {rows:[],rowCount:1};
  };
  const ctx={config:{solanaRpcUrl:'https://api.devnet.solana.com'},control:{query,connect:async()=>({query,release(){}})}} as unknown as CoreContext;
  Connection.prototype.getGenesisHash=async()=>DEVNET_GENESIS;
  Connection.prototype.getSignaturesForAddress=(async(_key:any,options:any)=>{
    seenCursors.push(options.before);
    return options.before?[{signature:'exact-payment',err:null,blockTime:Math.floor(Date.now()/1000)}]:Array.from({length:40},(_,i)=>({signature:`unrelated-${i}`,err:null,blockTime:Math.floor(Date.now()/1000)}));
  }) as any;
  Connection.prototype.getTransaction=(async(sig:string)=>sig==='exact-payment'?exact:null) as any;
  try {
    assert.deepEqual(await reconcileMarketOperations(ctx),{checked:1,confirmed:0});assert.equal(row.recovery_cursor,'unrelated-39');
    assert.deepEqual(await reconcileMarketOperations(ctx),{checked:1,confirmed:1});assert.equal(row.signature,'exact-payment');assert.equal(commits,1);
    assert.deepEqual(seenCursors,[undefined,'unrelated-39']);
  }finally{Connection.prototype.getGenesisHash=originalGenesis;Connection.prototype.getSignaturesForAddress=originalList;Connection.prototype.getTransaction=originalTransaction;}
});

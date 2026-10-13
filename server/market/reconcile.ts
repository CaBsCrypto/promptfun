import { Connection, PublicKey } from '@solana/web3.js';
import type { CoreContext } from '../shared.js';
import { assertDevnet, hash, verifyPreparedTransaction } from './chain.js';

/** Recovery is bounded and can be called by the worker after API downtime. No contribution becomes IA credit. */
export async function reconcileMarketOperations(ctx:CoreContext, signal?:AbortSignal):Promise<{checked:number;confirmed:number}> {
  const deadline=new AbortController(),cancel=()=>deadline.abort(signal?.reason);
  if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>deadline.abort(new Error('Market reconciliation deadline reached.')),60_000);timer.unref();
  const boundedFetch:typeof fetch=(input,init)=>fetch(input,{...init,signal:AbortSignal.any([deadline.signal,AbortSignal.timeout(10_000),...(init?.signal?[init.signal]:[])])});
  const connection=new Connection(ctx.config.solanaRpcUrl,{commitment:'confirmed',fetch:boundedFetch,disableRetryOnRateLimit:true});
  try {
  deadline.signal.throwIfAborted();
  await assertDevnet(connection);
  const rows=(await ctx.control.query(`select * from solana_transactions where status in ('prepared','pending')
    and created_at > now() - interval '24 hours' order by (signature is null),last_scan_at nulls first,created_at limit 30`)).rows;
  let confirmed=0,requests=1,checked=0;
  const signaturesCache=new Map<string,Awaited<ReturnType<Connection['getSignaturesForAddress']>>>();
  const transactionsCache=new Map<string,Awaited<ReturnType<Connection['getTransaction']>>>();
  const alive=()=>{deadline.signal.throwIfAborted();return requests<100;};
  async function transaction(sig:string) {
    if(transactionsCache.has(sig))return transactionsCache.get(sig)!;
    if(!alive())return null;
    requests++;const tx=await connection.getTransaction(sig,{commitment:'finalized',maxSupportedTransactionVersion:0});
    transactionsCache.set(sig,tx);return tx;
  }
  for(const row of rows) {
    if(!alive())break;checked++;
    let sig=row.signature;
    if(!sig) {
      const cursor=row.recovery_cursor||undefined,cacheKey=`${row.expected_signer}:${cursor||''}`;
      let signatures=signaturesCache.get(cacheKey);
      if(!signatures){requests++;signatures=await connection.getSignaturesForAddress(new PublicKey(row.expected_signer),{limit:40,...(cursor?{before:cursor}:{})},'finalized');signaturesCache.set(cacheKey,signatures);}
      let reachedStart=signatures.length<40,budgetReached=false;
      for(const candidate of signatures) {
        if(!alive()){budgetReached=true;break;}
        if(candidate.blockTime && candidate.blockTime*1000<new Date(row.created_at).getTime()-10_000){reachedStart=true;break;}
        if(candidate.err) continue;
        const tx=await transaction(candidate.signature);
        if(tx && hash(tx.transaction.message.serialize())===row.message_hash) {sig=candidate.signature;break;}
      }
      const nextCursor=budgetReached?cursor:(reachedStart?null:(signatures.at(-1)?.signature||null));
      await ctx.control.query('update solana_transactions set recovery_cursor=$2,last_scan_at=now() where id=$1',[row.id,nextCursor||null]);
    }else await ctx.control.query('update solana_transactions set last_scan_at=now() where id=$1',[row.id]);
    if(!sig) continue;
    deadline.signal.throwIfAborted();
    const tx=await transaction(sig);
    if(!tx) continue;
    deadline.signal.throwIfAborted();
    const valid=verifyPreparedTransaction(tx,row.message_hash,row.expected_signer),client=await ctx.control.connect();
    try {
      await client.query('begin');
      await client.query("update solana_transactions set signature=$2,status=$3,finalized_at=now(),error=$4 where id=$1 and status in ('prepared','pending')",[row.id,sig,valid?'confirmed':'failed',valid?null:'La transacción no prueba la operación autorizada.']);
      if(row.funding_intent_id) await client.query('update funding_intents set signature=$2,status=$3 where id=$1',[row.funding_intent_id,sig,valid?'confirmed':'failed']);
      await client.query('commit');if(valid)confirmed++;
    }catch(e){await client.query('rollback');throw e;}finally{client.release();}
  }
  return {checked,confirmed};
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',cancel);deadline.abort();}
}

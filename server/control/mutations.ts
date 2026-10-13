import type { Request } from 'express';
import type { PoolClient } from 'pg';
import type { CoreContext } from '../shared.js';
import { HttpError } from '../shared.js';
import { transaction } from './db.js';
import { hash,idempotencyKey } from './security.js';

export async function durableMutation<T>(ctx:CoreContext,req:Request,userId:string,kind:'project.create'|'project.publish',payload:unknown,action:(client:PoolClient)=>Promise<T>,status=201) {
 const key=idempotencyKey(req.get('Idempotency-Key')),digest=hash(JSON.stringify({kind,payload}));
 return transaction(ctx,async client=>{
  await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['mutation:'+userId]);
  const stored=await client.query('select kind,request_hash,response,response_status from public.platform_mutation_receipts where user_id=$1 and idempotency_key=$2',[userId,key]);
  const row=stored.rows[0];if(row){
   if(row.kind!==kind||row.request_hash!==digest)throw new HttpError(409,'IDEMPOTENCY_CONFLICT','La clave ya pertenece a otra operación.');
   return {status:row.response_status as number,body:row.response as T};
  }
  const body=await action(client);
  await client.query('insert into public.platform_mutation_receipts(user_id,idempotency_key,kind,request_hash,response_status,response) values($1,$2,$3,$4,$5,$6)',[userId,key,kind,digest,status,JSON.stringify(body)]);
  return {status,body};
 });
}

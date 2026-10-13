import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { PoolClient } from 'pg';
import { HttpError } from '../shared.js';

export interface MutationRequest { key: string; hash: string; kind: 'record.create' | 'file.upload' }
/** JSON keys are normalized; array order and every value remain significant. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as any)[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function mutationRequest(req: Request, kind: MutationRequest['kind'], version: string, payload: unknown): MutationRequest {
  const key = req.get('Idempotency-Key');
  if (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) throw new HttpError(400, 'IDEMPOTENCY_REQUIRED', 'Falta un identificador válido para reintentar esta operación.');
  return { key, kind, hash: createHash('sha256').update(canonical({ kind, version, payload })).digest('hex') };
}
/** Caller holds the app advisory lock and transaction, so read/mutation/receipt commit together. */
export async function mutationReceipt(client: PoolClient, appId: string, userId: string, request: MutationRequest) {
  const existing = await client.query('select kind,request_hash,response_status,response from public.app_mutation_receipts where app_id=$1 and user_id=$2 and idempotency_key=$3', [appId, userId, request.key]);
  const row = existing.rows[0];
  if (!row) return null;
  if (row.kind !== request.kind || row.request_hash !== request.hash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Este identificador ya se usó para una operación distinta.');
  return { status: row.response_status as number, body: row.response };
}
export async function saveMutationReceipt(client: PoolClient, appId: string, userId: string, request: MutationRequest, status: number, body: unknown) {
  await client.query('insert into public.app_mutation_receipts(app_id,user_id,idempotency_key,kind,request_hash,response_status,response) values($1,$2,$3,$4,$5,$6,$7)', [appId, userId, request.key, request.kind, request.hash, status, JSON.stringify(body)]);
}

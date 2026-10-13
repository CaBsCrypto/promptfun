import type { PoolClient } from 'pg';
import type { CoreContext } from '../shared.js';
import { HttpError } from '../shared.js';

export async function transaction<T>(ctx: CoreContext, action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await ctx.control.connect();
  try { await client.query('begin'); const result = await action(client); await client.query('commit'); return result; }
  catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
export async function ownedProject(ctx: CoreContext, projectId: string, userId: string) {
  const result = await ctx.control.query('select * from projects where id=$1 and owner_id=$2', [projectId, userId]);
  if (!result.rows[0]) throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Proyecto no encontrado.');
  return result.rows[0];
}
export function publicProject(row: any) {
  return { id: row.id, title: row.title, description: row.description, published_version_id: row.published_version_id,
    wallet_address: row.wallet_address, created_at: row.created_at, updated_at: row.updated_at };
}
export function publicVersion(row: any) {
  if (!row) return null;
  return { id: row.id, project_id: row.project_id, parent_version_id: row.parent_version_id, manifest: row.manifest,
    content_hash: row.content_hash, changelog: row.changelog, created_at: row.created_at };
}
export function jobDto(row: any) {
  return { id: row.id, project_id: row.project_id, base_version_id: row.base_version_id, status: row.status,
    usage_status: row.usage_status, model: row.model, error: row.error, result_version_id: row.result_version_id,
    prompt_tokens: row.prompt_tokens === null ? null : Number(row.prompt_tokens),
    completion_tokens: row.completion_tokens === null ? null : Number(row.completion_tokens), cost_usd: row.cost_usd,
    created_at: row.created_at };
}

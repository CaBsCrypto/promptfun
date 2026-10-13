import type { Router } from 'express';
import type { CoreContext } from '../shared.js';
import { HttpError, asyncRoute } from '../shared.js';
import type { FreeModel } from '../../shared/contracts.js';
import { authenticate, assertCsrf } from './auth.js';
import { decryptSecret, encryptSecret, hash, nonce, textInput } from './security.js';
import { transaction } from './db.js';

export function openRouterUrl(ctx: CoreContext, path: string) {
  const base = ctx.config.openRouterBaseUrl.replace(/\/$/, '');
  return `${base.endsWith('/api/v1') ? base : `${base}/api/v1`}/${path}`;
}
export async function providerRequest(ctx: CoreContext, path: string, key?: string, body?: unknown, timeout = 15_000) {
  let response: Response;
  try {
    response = await fetch(openRouterUrl(ctx, path), {
      method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(timeout),
    });
  } catch { throw new HttpError(503, 'PROVIDER_UNAVAILABLE', 'No se pudo consultar el proveedor.'); }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new HttpError(response.status === 401 ? 401 : response.status === 429 ? 429 : 503,
    response.status === 401 ? 'PROVIDER_REVOKED' : response.status === 429 ? 'PROVIDER_QUOTA' : 'PROVIDER_UNAVAILABLE',
    response.status === 401 ? 'Reconecta tu cuenta del proveedor.' : response.status === 429 ? 'La cuota del proveedor está agotada.' : 'El proveedor no pudo completar la consulta.');
  if (!result || result.error) throw new HttpError(503, 'PROVIDER_UNAVAILABLE', 'Respuesta del proveedor no válida.');
  return result as any;
}
export function isZeroPrice(value: unknown) {
  return value === 0 || (typeof value === 'string' && /^0(?:\.0+)?(?:e[+-]?\d+)?$/i.test(value));
}
export function isAllowedFreeModel(value: any) {
  return value && typeof value.id === 'string' && value.id.endsWith(':free') &&
    isZeroPrice(value.pricing?.prompt) && isZeroPrice(value.pricing?.completion) &&
    ['request', 'per_request', 'internal_reasoning'].every(k => value.pricing?.[k] === undefined || isZeroPrice(value.pricing[k])) &&
    Number.isInteger(value.context_length) && value.context_length >= 8192;
}
export async function freeCatalog(ctx: CoreContext): Promise<(FreeModel & { pricing: unknown })[]> {
  const result = await providerRequest(ctx, 'models');
  if (!Array.isArray(result.data)) throw new HttpError(503, 'CATALOG_UNAVAILABLE', 'Catálogo no disponible.');
  return result.data.filter(isAllowedFreeModel).map((m: any) => ({ id: m.id, name: String(m.name || m.id), context_length: m.context_length, pricing: m.pricing }));
}
export async function activeConnection(ctx: CoreContext, userId: string, connectionId?: string) {
  const result = await ctx.control.query(`select * from provider_connections where owner_id=$1 and state='active' ${connectionId ? 'and id=$2' : ''}`, connectionId ? [userId, connectionId] : [userId]);
  if (!result.rows[0]) throw new HttpError(409, 'PROVIDER_NOT_CONNECTED', 'Conecta tu propia cuenta OpenRouter antes de generar.');
  const connection = result.rows[0];
  return { ...connection, key: decryptSecret(connection.secret_ciphertext, ctx.config.encryptionKey) };
}
export async function preflight(ctx: CoreContext, userId: string, modelId: string, connectionId?: string) {
  const connection = await activeConnection(ctx, userId, connectionId);
  const catalog = await freeCatalog(ctx); const model = catalog.find(m => m.id === modelId);
  if (!model) throw new HttpError(422, 'MODEL_NOT_FREE', 'El modelo ya no está disponible con precio cero. No se utilizará uno de pago.');
  const status = await providerRequest(ctx, 'key', connection.key);
  const q = status.data?.free_model_daily_requests;
  if (!q || !Number.isInteger(q.limit) || !Number.isInteger(q.remaining) || q.limit < 0 || q.remaining < 0)
    throw new HttpError(503, 'QUOTA_UNKNOWN', 'El proveedor no confirmó la cuota disponible.');
  if (q.remaining === 0) throw new HttpError(429, 'PROVIDER_QUOTA', 'La cuota gratuita diaria está agotada.');
  return { connection, model, quota: { limit: Math.min(50, q.limit), remaining: Math.min(50, q.remaining), used: q.used ?? null } };
}
export function mountProviders(router: Router, ctx: CoreContext) {
  router.get('/providers/openrouter/start', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); const state = nonce(); const verifier = nonce();
    await ctx.control.query(`insert into auth_flows(state_hash,purpose,user_id,session_id,verifier_ciphertext,expires_at)
      values($1,'openrouter',$2,$3,$4,now()+interval '10 minutes')`, [hash(state), user.id, user.session_id, encryptSecret(verifier, ctx.config.encryptionKey)]);
    const auth = new URL('/auth', ctx.config.openRouterBaseUrl);
    auth.searchParams.set('callback_url', new URL('/api/providers/openrouter/callback', ctx.config.platformOrigin).toString());
    auth.searchParams.set('state', state); auth.searchParams.set('code_challenge', Buffer.from(hash(verifier), 'hex').toString('base64url'));
    auth.searchParams.set('code_challenge_method', 'S256'); auth.searchParams.set('key_label', 'Promptfun · modelos gratuitos');
    res.set('Cache-Control', 'no-store'); res.redirect(auth.toString());
  }));
  router.get('/providers/openrouter/callback', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); const state = textInput(req.query.state, 'Estado', 128); const code = textInput(req.query.code, 'Código', 2048);
    const flow = await ctx.control.query(`update auth_flows set consumed_at=now() where state_hash=$1 and purpose='openrouter'
      and user_id=$2 and session_id=$3 and consumed_at is null and expires_at>now() returning verifier_ciphertext`, [hash(state), user.id, user.session_id]);
    if (!flow.rows[0]) throw new HttpError(403, 'INVALID_OAUTH_STATE', 'El permiso venció, se reutilizó o pertenece a otra cuenta.');
    const result = await providerRequest(ctx, 'auth/keys', undefined, { code, code_verifier: decryptSecret(flow.rows[0].verifier_ciphertext, ctx.config.encryptionKey), code_challenge_method: 'S256' });
    if (typeof result.key !== 'string' || result.key.length < 16) throw new HttpError(503, 'PROVIDER_KEY_MISSING', 'El proveedor no entregó una conexión válida.');
    await transaction(ctx, async client => {
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`provider:${user.id}`]);
      await client.query(`update provider_connections set state='revoked',revoked_at=now(),updated_at=now() where owner_id=$1 and state='active'`, [user.id]);
      await client.query(`insert into provider_connections(owner_id,secret_ciphertext,key_hash) values($1,$2,$3)`,
        [user.id, encryptSecret(result.key, ctx.config.encryptionKey), hash(result.key)]);
    });
    res.redirect(new URL('/?provider=connected', ctx.config.platformOrigin).toString());
  }));
  router.get('/providers/openrouter', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req);
    const result = await ctx.control.query(`select state,key_hash from provider_connections where owner_id=$1 order by created_at desc limit 1`, [user.id]);
    const row = result.rows[0]; res.set('Cache-Control', 'no-store');
    res.json({ connected: row?.state === 'active', state: row?.state || 'disconnected', management_url: row ? `https://openrouter.ai/keys/${row.key_hash}` : null });
  }));
  router.delete('/providers/openrouter', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req); assertCsrf(ctx, req, user);
    await ctx.control.query(`update provider_connections set state='revoked',revoked_at=now(),updated_at=now() where owner_id=$1`, [user.id]);
    res.json({ connected: false, state: 'revoked', remote_revocation_required: true });
  }));
  router.get('/providers/openrouter/models', asyncRoute(async (req, res) => {
    await authenticate(ctx, req); const models = await freeCatalog(ctx);
    res.json({ models: models.map(({ id, name, context_length }) => ({ id, name, context_length })) });
  }));
}

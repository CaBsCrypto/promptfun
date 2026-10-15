import { createHmac } from 'node:crypto';
import type { Request, Router } from 'express';
import { asyncRoute, HttpError, type CoreContext } from '../shared.js';
import { authenticate, cookieOptions, cookieValue, SESSION_COOKIE, SESSION_SECONDS } from './auth.js';
import { identityId } from './identity.js';
import { equalSecret, hash, nonce } from './security.js';
import { transaction } from './db.js';

export const DEMO_COOKIE = 'pf_demo_identity';
const DEMO_SECONDS = 7 * 24 * 60 * 60;
const loopback = (value: string | undefined) => !!value && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value.toLowerCase());
function origin(value: string) {
  try { const url = new URL(value); return url.origin === value && ['http:', 'https:'].includes(url.protocol) &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? url : null; } catch { return null; }
}
export function demoEnabled(ctx: CoreContext, req: Request) {
  const site = origin(ctx.config.platformOrigin);
  return ctx.config.localDemoEnabled === true && !ctx.config.production && !!site && !!origin(ctx.config.runtimeOrigin) &&
    loopback(req.socket?.remoteAddress) && req.headers.host?.toLowerCase() === site.host.toLowerCase() &&
    (!req.get('Origin') || req.get('Origin') === site.origin);
}
export function assertDemoRequest(ctx: CoreContext, req: Request) {
  if (!demoEnabled(ctx, req) || (!['GET', 'HEAD'].includes(req.method) && req.get('Origin') !== ctx.config.platformOrigin))
    throw new HttpError(403, 'LOCAL_DEMO_UNAVAILABLE', 'El acceso demo sólo está habilitado en este navegador local de desarrollo.');
}
function browserNonce(req: Request) {
  const values = req.headers.cookie?.split(';').map(value => value.trim()).filter(value => value.startsWith(DEMO_COOKIE + '=')) || [];
  if (values.length > 1) throw new HttpError(403, 'INVALID_DEMO_IDENTITY', 'La identidad demo de este navegador no es válida.');
  const value = cookieValue(req, DEMO_COOKIE);
  if ((values.length && value === undefined) || (value !== undefined && !/^[\w-]{43}$/.test(value))) throw new HttpError(403, 'INVALID_DEMO_IDENTITY', 'La identidad demo de este navegador no es válida.');
  return value;
}
export function demoIdentity(ctx: CoreContext, value: string) {
  const namespace = createHmac('sha256', ctx.config.encryptionKey).update(JSON.stringify(['promptfun.local-demo.namespace.v1', ctx.config.platformOrigin])).digest('hex');
  const subject = createHmac('sha256', ctx.config.encryptionKey).update(JSON.stringify(['promptfun.local-demo.subject.v1', ctx.config.platformOrigin, value])).digest('hex');
  return { id: identityId('local_demo:' + namespace, subject), subject };
}
export function validateDemoSession(ctx: CoreContext, req: Request, row: any) {
  assertDemoRequest(ctx, req);
  const value = browserNonce(req), expected = value ? demoIdentity(ctx, value) : null;
  if (!expected || row.auth_provider !== 'local_demo' || row.auth_method !== 'local_demo' || row.id !== expected.id ||
    typeof row.auth_subject !== 'string' || !equalSecret(row.auth_subject, expected.subject) || row.email !== null ||
    row.auth_token_ciphertext !== null || row.wallet_credential_id !== null || row.wallet_address)
    throw new HttpError(401, 'DEMO_SESSION_INVALID', 'La sesión demo requiere volver a entrar desde su navegador original.');
}
export function mountDemoAuth(router: Router, ctx: CoreContext) {
  router.get('/auth/demo', (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ enabled: demoEnabled(ctx, req) }); });
  router.post('/auth/demo', asyncRoute(async (req, res) => {
    assertDemoRequest(ctx, req);
    // A local server-side session lookup is enough to avoid replacing an existing
    // regular account. No managed-provider round trip is invented by this login.
    try {
      const current = await authenticate(ctx, req, false);
      if (!current.is_demo) throw new HttpError(409, 'ACCOUNT_ALREADY_AUTHENTICATED', 'Cierra tu sesión actual antes de entrar en demo.');
      res.json({ user: { id: current.id, email: null, wallet_address: null, is_demo: true }, csrf_token: current.csrf_token }); return;
    } catch (error) { if (!(error instanceof HttpError) || error.status !== 401) throw error; }
    const identityNonce = browserNonce(req) || nonce(), identity = demoIdentity(ctx, identityNonce);
    const sessionToken = nonce(), csrf = nonce(), expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
    await transaction(ctx, async client => {
      const user = await client.query(`insert into public.platform_users(id,email,auth_provider,auth_subject) values($1,null,'local_demo',$2)
        on conflict(id) do update set auth_subject=excluded.auth_subject
        where platform_users.auth_provider='local_demo' and platform_users.auth_subject=excluded.auth_subject and platform_users.email is null returning id`, [identity.id, identity.subject]);
      if (!user.rows[0]) throw new HttpError(409, 'DEMO_IDENTITY_CONFLICT', 'La identidad demo no pudo asociarse.');
      await client.query(`insert into public.platform_sessions(user_id,token_hash,csrf_token,auth_token_ciphertext,expires_at,auth_method)
        values($1,$2,$3,null,$4,'local_demo')`, [identity.id, hash(sessionToken), csrf, expiresAt.toISOString()]);
    });
    res.cookie(DEMO_COOKIE, identityNonce, { ...cookieOptions(ctx), maxAge: DEMO_SECONDS * 1000 });
    res.cookie(SESSION_COOKIE, sessionToken, { ...cookieOptions(ctx), maxAge: SESSION_SECONDS * 1000 });
    res.json({ user: { id: identity.id, email: null, wallet_address: null, is_demo: true }, csrf_token: csrf });
  }));
}

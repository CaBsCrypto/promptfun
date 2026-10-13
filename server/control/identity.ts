import { createHash } from 'node:crypto';
import { HttpError, type CoreContext } from '../shared.js';

export type IdentityPlane = 'control' | 'apps';
export type IdentityProvider = 'neon' | 'supabase';
export interface Identity {
  provider: IdentityProvider; subject: string; issuer: string; email: string; sessionToken: string; expiresAt?: string;
}
export type IdentityResult = Identity | { confirmation_required: true };
export const NEON_SESSION_COOKIE = '__Secure-neon-auth.session_token';

export function identityProvider(ctx: CoreContext): IdentityProvider { return ctx.config.backendProvider || 'supabase'; }
const failed = () => new HttpError(401, 'AUTH_FAILED', 'Identidad no confirmada. Revisa tus credenciales y verifica tu correo.');
const unavailable = () => new HttpError(503, 'AUTH_UNAVAILABLE', 'El servicio de acceso no está disponible.');
const confirmed = (user: any, provider: IdentityProvider) => provider === 'neon' ? user?.emailVerified === true : typeof user?.email_confirmed_at === 'string' && !!user.email_confirmed_at;
function userFields(user: any) {
  if (typeof user?.id !== 'string' || !user.id || user.id.length > 512 || /[\x00-\x1f]/.test(user.id) ||
    typeof user.email !== 'string' || user.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) throw failed();
  return { subject: user.id, email: user.email.toLowerCase() };
}
function authUrl(ctx: CoreContext, plane: IdentityPlane) {
  const raw = plane === 'control' ? ctx.config.controlAuthUrl : ctx.config.appsAuthUrl;
  if (!raw) throw new HttpError(503, 'AUTH_UNCONFIGURED', 'Falta configurar el servicio de cuentas.');
  let url: URL; try { url = new URL(raw); } catch { throw unavailable(); }
  if (url.username || url.password || url.search || url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && !ctx.config.production && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw unavailable();
  return url.toString().replace(/\/$/, '');
}
async function request(url: string, init: RequestInit) {
  let response: Response;
  try { response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) }); }
  catch { throw unavailable(); }
  if (!response.ok) {
    if (response.status === 429) throw new HttpError(429, 'AUTH_RATE_LIMITED', 'Demasiados intentos de acceso. Intenta nuevamente más tarde.');
    throw response.status >= 400 && response.status < 500 ? failed() : unavailable();
  }
  if (response.status === 204) return { response, data: null };
  // Auth envelopes are small. Bound a malformed provider response before parsing it.
  const reader = response.body?.getReader(); let bytes = 0; const parts: Uint8Array[] = [];
  if (!reader) throw unavailable();
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength;
      if (bytes > 131072) { await reader.cancel(); throw unavailable(); } parts.push(chunk.value); }
    return { response, data: JSON.parse(Buffer.concat(parts).toString('utf8')) as any };
  } catch (error) { if (error instanceof HttpError) throw error; throw unavailable(); }
}
function neonHeaders(ctx: CoreContext, plane: IdentityPlane, cookie?: string) {
  return { 'Content-Type': 'application/json', Origin: plane === 'control' ? ctx.config.platformOrigin : ctx.config.runtimeOrigin,
    'x-neon-auth-proxy': 'express', ...(cookie ? { Cookie: cookie } : {}) };
}
function checkedCookie(cookie: string) {
  if (!cookie.startsWith(NEON_SESSION_COOKIE + '=') || cookie.length > 8192 || cookie.length <= NEON_SESSION_COOKIE.length + 1 || /[\x00-\x20\x7f;]/.test(cookie)) throw failed();
  return cookie;
}
function responseCookie(response: Response) {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0].trim();
    if (pair.startsWith(NEON_SESSION_COOKIE + '=')) {
      if (/(?:^|;)\s*max-age\s*=\s*0(?:;|$)/i.test(header)) return null;
      return checkedCookie(pair);
    }
  }
  return undefined;
}
/** Same REST endpoints/headers/cookie protocol as the official Neon server adapter:
 * https://github.com/neondatabase/neon-js/blob/main/packages/auth/src/server/client-factory.ts
 * https://github.com/neondatabase/neon-js/blob/main/packages/auth/src/server/endpoints.ts
 * The upstream signed cookie stays encrypted in our BFF; we never synthesize its signature,
 * assume a managed Bearer plugin, or forward provider Set-Cookie headers to the browser.
 */
export async function validateIdentity(ctx: CoreContext, plane: IdentityPlane, token: string): Promise<Identity> {
  const provider = identityProvider(ctx);
  if (provider === 'supabase') {
    const user = await supabaseIdentityRequest(ctx, plane, 'user', undefined, token);
    if (!confirmed(user, provider)) throw failed();
    return { provider, ...userFields(user), issuer: plane === 'control' ? ctx.config.controlSupabaseUrl : ctx.config.appsSupabaseUrl, sessionToken: token };
  }
  const cookie = checkedCookie(token);
  const { response, data } = await request(authUrl(ctx, plane) + '/get-session?disableCookieCache=true', { headers: neonHeaders(ctx, plane, cookie) });
  const fields = userFields(data?.user); const expires = Date.parse(data?.session?.expiresAt);
  if (!data.session || data.session.userId !== fields.subject || !Number.isFinite(expires) || expires <= Date.now() || !confirmed(data.user, provider)) throw failed();
  const renewed = responseCookie(response); if (renewed === null) throw failed();
  return { provider, ...fields, issuer: authUrl(ctx, plane), sessionToken: renewed || cookie, expiresAt: new Date(expires).toISOString() };
}
export async function signInIdentity(ctx: CoreContext, plane: IdentityPlane, email: string, password: string, signup = false): Promise<IdentityResult> {
  const provider = identityProvider(ctx);
  if (provider === 'supabase') {
    const data = await supabaseIdentityRequest(ctx, plane, signup ? 'signup' : 'token?grant_type=password', { email, password });
    if (!data.access_token) { if (signup) return { confirmation_required: true }; throw failed(); }
    const identity = await validateIdentity(ctx, plane, data.access_token);
    if (identity.email !== email.toLowerCase()) throw failed(); return identity;
  }
  const { response, data } = await request(authUrl(ctx, plane) + (signup ? '/sign-up/email' : '/sign-in/email'), {
    method: 'POST', headers: neonHeaders(ctx, plane), body: JSON.stringify({ email, password, ...(signup ? { name: email.split('@')[0].slice(0, 100) } : {}) }),
  });
  userFields(data?.user);
  const cookie = responseCookie(response);
  if (!cookie || !confirmed(data?.user, provider)) {
    if (cookie) await revokeIdentity(ctx, plane, cookie).catch(() => {});
    if (signup || data?.user?.emailVerified === false) return { confirmation_required: true }; throw failed();
  }
  const identity = await validateIdentity(ctx, plane, cookie);
  if (identity.subject !== data.user.id || identity.email !== email.toLowerCase()) throw failed(); return identity;
}
export async function revokeIdentity(ctx: CoreContext, plane: IdentityPlane, token: string) {
  if (identityProvider(ctx) === 'supabase') { await supabaseIdentityRequest(ctx, plane, 'logout', {}, token); return; }
  await request(authUrl(ctx, plane) + '/sign-out', { method: 'POST', headers: neonHeaders(ctx, plane, checkedCookie(token)), body: '{}' });
}
/** Shared Neon SMTP delivers codes; the BFF exposes only this fixed verification capability. */
export async function verifyIdentityEmail(ctx: CoreContext, plane: IdentityPlane, email: string, otp: string) {
  if (identityProvider(ctx) !== 'neon') throw new HttpError(503, 'VERIFY_EMAIL_UNAVAILABLE', 'Confirma tu correo desde el enlace del proveedor.');
  await request(authUrl(ctx, plane) + '/email-otp/verify-email', {
    method: 'POST', headers: neonHeaders(ctx, plane), body: JSON.stringify({ email, otp }),
  });
}
export async function sendIdentityVerification(ctx: CoreContext, plane: IdentityPlane, email: string) {
  if (identityProvider(ctx) !== 'neon') throw new HttpError(503, 'VERIFY_EMAIL_UNAVAILABLE', 'Confirma tu correo desde el enlace del proveedor.');
  await request(authUrl(ctx, plane) + '/email-otp/send-verification-otp', {
    method: 'POST', headers: neonHeaders(ctx, plane), body: JSON.stringify({ email, type: 'email-verification' }),
  });
}
export async function supabaseIdentityRequest(ctx: CoreContext, plane: IdentityPlane, path: string, body?: unknown, bearer?: string) {
  const base = plane === 'control' ? ctx.config.controlSupabaseUrl : ctx.config.appsSupabaseUrl;
  const key = plane === 'control' ? ctx.config.controlPublishableKey : ctx.config.appsPublishableKey;
  if (!base || !key) throw new HttpError(503, 'AUTH_UNCONFIGURED', 'Falta configurar el servicio de cuentas.');
  const { data } = await request(`${base.replace(/\/$/, '')}/auth/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { apikey: key, 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }); return data;
}
/** RFC 9562 UUIDv5 with the DNS namespace. Existing Supabase UUID identities keep their ID;
 * Neon subjects are opaque text and cannot be cast into the application's UUID columns. */
export function identityId(providerId: string, subject: string) {
  if (providerId === 'supabase' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subject)) return subject.toLowerCase();
  const namespace = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
  const bytes = createHash('sha1').update(namespace).update(`promptfun.identity.v1:${JSON.stringify([providerId, subject])}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex'); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function identityUserId(identity: Pick<Identity, 'provider' | 'subject' | 'issuer'>, plane: IdentityPlane = 'control') {
  return identityId(identity.provider === 'supabase' ? 'supabase' : `neon:${plane}:${identity.issuer}`, identity.subject);
}
export function identitySubject(identity: Pick<Identity, 'provider' | 'subject' | 'issuer'>) {
  // JSON is unambiguous even if an opaque provider ID itself contains a delimiter.
  return identity.provider === 'supabase' ? identity.subject : JSON.stringify([identity.issuer, identity.subject]);
}

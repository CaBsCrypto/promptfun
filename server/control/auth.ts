import type { Request, Response, Router } from 'express';
import type { AuthenticatedUser, CoreContext } from '../shared.js';
import { HttpError, assertOrigin, asyncRoute } from '../shared.js';
import { decryptSecret, encryptSecret, equalSecret, hash, nonce, textInput } from './security.js';
import { identityProvider, identitySubject, identityUserId, revokeIdentity, signInIdentity, supabaseIdentityRequest, validateIdentity, verifyIdentityEmail, sendIdentityVerification, type Identity } from './identity.js';
import { transaction } from './db.js';
import { validateDemoSession } from './demo-auth.js';

export const SESSION_COOKIE = 'pf_session';
export const SESSION_SECONDS = 24 * 60 * 60;
export function cookieValue(req: Request, name: string): string | undefined {
  const item = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  if (!item) return undefined;
  try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return undefined; }
}
export function cookieOptions(ctx: CoreContext) {
  return { httpOnly: true, secure: ctx.config.production, sameSite: 'lax' as const, path: '/' };
}
export async function authenticate(ctx: CoreContext, req: Request, checkProvider = true): Promise<AuthenticatedUser> {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token || !/^[\w-]{43}$/.test(token)) throw new HttpError(401, 'AUTH_REQUIRED', 'Inicia sesión en Promptfun.');
  const result = await ctx.control.query(
    `select u.id,u.email,u.auth_provider,u.auth_subject,s.auth_method,s.wallet_credential_id,s.auth_token_ciphertext,s.csrf_token,s.id as session_id,
      sw.user_id as wallet_owner,sw.state as wallet_state,w.address as wallet_address from platform_sessions s
     join platform_users u on u.id=s.user_id
     left join wallet_credentials sw on sw.id=s.wallet_credential_id
     left join wallet_credentials w on w.user_id=u.id and w.state='active'
     where s.token_hash=$1 and s.revoked_at is null and s.expires_at>now()`, [hash(token)]);
  const row=result.rows[0];if (!row) throw new HttpError(401, 'SESSION_EXPIRED', 'La sesión venció. Inicia sesión nuevamente.');
  const demo = row.auth_method === 'local_demo' || row.auth_provider === 'local_demo';
  if(demo) validateDemoSession(ctx,req,row);
  else if(checkProvider && row.auth_method==='solana') {
    if(row.wallet_owner!==row.id || row.wallet_state!=='active') {
      await ctx.control.query('update platform_sessions set revoked_at=now() where id=$1',[row.session_id]);
      throw new HttpError(401,'WALLET_REVOKED','El acceso con esta wallet fue revocado.');
    }
  } else if(checkProvider) {
    let identity:Identity;
    try {
      if(!row.auth_token_ciphertext)throw new HttpError(401,'SESSION_EXPIRED','La sesión requiere un nuevo acceso.');
      let token:string;try {token=decryptSecret(row.auth_token_ciphertext,ctx.config.encryptionKey);}catch {throw new HttpError(401,'SESSION_EXPIRED','La sesión requiere un nuevo acceso.');}
      identity=await validateIdentity(ctx,'control',token);
      if(identity.provider!==row.auth_provider||identityUserId(identity,'control')!==row.id||identitySubject(identity)!==row.auth_subject)
        throw new HttpError(401,'SESSION_EXPIRED','La identidad de esta sesión no coincide.');
    } catch(error) {
      if(error instanceof HttpError && error.status===401)await ctx.control.query('update platform_sessions set revoked_at=now() where id=$1',[row.session_id]);
      throw error;
    }
    await transaction(ctx,async client=> {
      const active=await client.query(`update platform_sessions set auth_token_ciphertext=$2,expires_at=least(expires_at,coalesce($3::timestamptz,expires_at))
        where id=$1 and revoked_at is null and expires_at>now() returning id`,[row.session_id,encryptSecret(identity.sessionToken,ctx.config.encryptionKey),identity.expiresAt||null]);
      if(!active.rows.length)throw new HttpError(401,'SESSION_EXPIRED','La sesión venció. Inicia sesión nuevamente.');
      await client.query('update platform_users set email=$2 where id=$1',[row.id,identity.email]);
    });row.email=identity.email;
  }
  // Internal upstream permission/ciphertext must never escape through an authentication DTO.
  return {id:row.id,email:row.email,wallet_address:row.wallet_address||null,csrf_token:row.csrf_token,session_id:row.session_id,...(demo?{is_demo:true}:{})};
}
export function assertCsrf(ctx: CoreContext, req: Request, user: AuthenticatedUser) {
  assertOrigin(req, ctx.config.platformOrigin);
  const submitted = req.get('X-CSRF-Token');
  if (!submitted || !equalSecret(submitted, user.csrf_token)) throw new HttpError(403, 'INVALID_CSRF', 'Solicitud de sesión inválida.');
}
export async function supabaseAuth(ctx: CoreContext, path: string, body?: unknown, bearer?: string) {
  return supabaseIdentityRequest(ctx, 'control', path, body, bearer);
}
async function issueSession(ctx: CoreContext, res: Response, identity: Identity) {
  const userId = identityUserId(identity, 'control'), subject = identitySubject(identity);
  const sessionToken = nonce(); const csrf = nonce();
  const expires = new Date(Math.min(Date.now() + SESSION_SECONDS * 1000, identity.expiresAt ? Date.parse(identity.expiresAt) : Infinity));
  await transaction(ctx, async client => {
    const stored = await client.query(`insert into platform_users(id,email,auth_provider,auth_subject) values($1,$2,$3,$4)
      on conflict(id) do update set email=excluded.email,auth_subject=excluded.auth_subject
      where platform_users.auth_provider=excluded.auth_provider and (platform_users.auth_subject=excluded.auth_subject or platform_users.auth_subject is null)
      returning id`, [userId, identity.email, identity.provider, subject]);
    if (!stored.rowCount) throw new HttpError(409, 'IDENTITY_CONFLICT', 'No se pudo asociar esta identidad.');
    await client.query(`insert into platform_sessions(user_id,token_hash,csrf_token,auth_token_ciphertext,expires_at)
      values($1,$2,$3,$4,$5)`, [userId, hash(sessionToken), csrf, encryptSecret(identity.sessionToken, ctx.config.encryptionKey), expires.toISOString()]);
  });
  res.cookie(SESSION_COOKIE, sessionToken, { ...cookieOptions(ctx), maxAge: expires.getTime() - Date.now() });
  return { user: { id: userId, email: identity.email }, csrf_token: csrf };
}
export function mountAuth(router: Router, ctx: CoreContext) {
  for (const action of ['verify-email','resend-verification'] as const) router.post(`/auth/${action}`,asyncRoute(async(req,res)=>{
    assertOrigin(req,ctx.config.platformOrigin);
    const email=textInput(req.body.email,'Correo',254).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(422,'INVALID_CREDENTIALS','Correo inválido.');
    if(action==='verify-email'){
      if(typeof req.body.otp!=='string'||!/^\d{6}$/.test(req.body.otp))throw new HttpError(422,'INVALID_OTP','Introduce el código de seis dígitos.');
      await verifyIdentityEmail(ctx,'control',email,req.body.otp);
    }else await sendIdentityVerification(ctx,'control',email);
    res.json({ok:true});
  }));
  router.get('/session', asyncRoute(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { const user = await authenticate(ctx, req); res.json({ user: { id: user.id, email: user.email,wallet_address:user.wallet_address||null,...(user.is_demo?{is_demo:true}:{}) }, csrf_token: user.csrf_token }); }
    catch (e) { if (e instanceof HttpError && e.status === 401) res.json({ user: null, csrf_token: null }); else throw e; }
  }));
  for (const action of ['login', 'signup'] as const) {
    router.post(`/auth/${action}`, asyncRoute(async (req, res) => {
      assertOrigin(req, ctx.config.platformOrigin);
      const email = textInput(req.body.email, 'Correo', 254).toLowerCase();
      const password = req.body.password;
      if (typeof password !== 'string' || password.length > 256) throw new HttpError(422, 'INVALID_CREDENTIALS', 'Contraseña inválida.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) throw new HttpError(422, 'INVALID_CREDENTIALS', 'Correo válido y contraseña de al menos 8 caracteres requeridos.');
      const result = await signInIdentity(ctx, 'control', email, password, action === 'signup');
      res.set('Cache-Control', 'no-store');
      if ('confirmation_required' in result) { res.status(202).json({ user: null, csrf_token: null, confirmation_required: true }); return; }
      res.json(await issueSession(ctx, res, result));
    }));
  }
  router.post('/auth/logout', asyncRoute(async (req, res) => {
    const user = await authenticate(ctx, req, false); assertCsrf(ctx, req, user);
    const result = await ctx.control.query(`update platform_sessions set revoked_at=now() where id=$1 returning auth_token_ciphertext`, [user.session_id]);
    const encrypted = result.rows[0]?.auth_token_ciphertext;
    if (encrypted) {
      try {
        await revokeIdentity(ctx, 'control', decryptSecret(encrypted, ctx.config.encryptionKey));
      } catch { /* The local revocation remains authoritative even during an upstream outage. */ }
    }
    res.clearCookie(SESSION_COOKIE, cookieOptions(ctx)); res.json({ user: null, csrf_token: null });
  }));
  router.get('/auth/google/start', asyncRoute(async (req, res) => {
    if (identityProvider(ctx) === 'neon') throw new HttpError(503, 'GOOGLE_UNCONFIGURED', 'El acceso con Google aún no está configurado. Usa correo y contraseña.');
    const state = nonce(); const verifier = nonce();
    await ctx.control.query(`insert into auth_flows(state_hash,purpose,verifier_ciphertext,expires_at) values($1,'google',$2,now()+interval '10 minutes')`, [hash(state), encryptSecret(verifier, ctx.config.encryptionKey)]);
    res.cookie('pf_google_flow', state, { ...cookieOptions(ctx), maxAge: 600_000 });
    const callback = new URL('/api/auth/google/callback', ctx.config.platformOrigin); callback.searchParams.set('state', state);
    const url = new URL(`${ctx.config.controlSupabaseUrl}/auth/v1/authorize`);
    url.searchParams.set('provider', 'google'); url.searchParams.set('redirect_to', callback.toString());
    url.searchParams.set('code_challenge', Buffer.from(hash(verifier), 'hex').toString('base64url')); url.searchParams.set('code_challenge_method', 's256');
    res.redirect(url.toString());
  }));
  router.get('/auth/google/callback', asyncRoute(async (req, res) => {
    if (identityProvider(ctx) === 'neon') throw new HttpError(503, 'GOOGLE_UNCONFIGURED', 'El acceso con Google aún no está configurado.');
    const state = textInput(req.query.state, 'Estado', 128); const code = textInput(req.query.code, 'Código', 2048);
    if (!equalSecret(state, cookieValue(req, 'pf_google_flow') || '')) throw new HttpError(403, 'INVALID_OAUTH_STATE', 'El acceso no pertenece a este navegador.');
    const flow = await ctx.control.query(`update auth_flows set consumed_at=now() where state_hash=$1 and purpose='google' and consumed_at is null and expires_at>now() returning verifier_ciphertext`, [hash(state)]);
    if (!flow.rows[0]) throw new HttpError(403, 'INVALID_OAUTH_STATE', 'El permiso venció o ya fue utilizado.');
    const result = await supabaseAuth(ctx, 'token?grant_type=pkce', { auth_code: code, code_verifier: decryptSecret(flow.rows[0].verifier_ciphertext, ctx.config.encryptionKey) });
    await issueSession(ctx, res, await validateIdentity(ctx, 'control', result.access_token)); res.clearCookie('pf_google_flow', cookieOptions(ctx));
    res.redirect(ctx.config.platformOrigin);
  }));
}

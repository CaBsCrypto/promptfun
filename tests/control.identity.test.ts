import test from 'node:test';
import assert from 'node:assert/strict';
import { identityId, identitySubject, identityUserId, NEON_SESSION_COOKIE, revokeIdentity, signInIdentity, validateIdentity } from '../server/control/identity.js';
import type { CoreContext } from '../server/shared.js';

const ctx = { config: {
  backendProvider: 'neon', controlAuthUrl: 'https://control.neonauth.example.invalid/neondb/auth',
  appsAuthUrl: 'https://apps.neonauth.example.invalid/neondb/auth', platformOrigin: 'http://localhost:3000', runtimeOrigin: 'http://127.0.0.1:4000',
  controlSupabaseUrl: 'https://legacy.example.invalid', controlPublishableKey: 'fixture', production: false,
} } as CoreContext;
const user = { id: 'opaque-neon-user-id', email: 'owner@example.invalid', emailVerified: true };
const cookie = `${NEON_SESSION_COOKIE}=fixture-token%2Bsigned-by-provider`;
const envelope = () => ({ user, session: { id: 'session', userId: user.id, expiresAt: new Date(Date.now()+3600000).toISOString() } });
async function withFetch(fake: typeof fetch, work: () => Promise<void>) {
  const original = globalThis.fetch; globalThis.fetch = fake;
  try { await work(); } finally { globalThis.fetch = original; }
}

test('Neon login validates the exact signed provider cookie remotely and keeps plane origin separate', async () => {
  let calls = 0;
  await withFetch((async (input: any, init: any) => {
    calls++; const url = String(input); assert.equal(init.headers.Origin, ctx.config.runtimeOrigin);
    assert.equal(init.headers['x-neon-auth-proxy'], 'express'); assert.equal(init.headers.Authorization, undefined); assert.equal(init.redirect, 'error');
    if (url.endsWith('/sign-in/email')) {
      assert.match(url, /^https:\/\/apps\./); assert.equal(init.headers.Cookie, undefined);
      assert.deepEqual(JSON.parse(init.body), { email: user.email, password: ' password-with-spaces ' });
      return Response.json({ user, token: 'unsigned-response-token-is-not-used' }, { headers: { 'Set-Cookie': cookie+'; Path=/; Secure; HttpOnly; SameSite=Lax' } });
    }
    assert.match(url, /\/get-session\?disableCookieCache=true$/); assert.equal(init.headers.Cookie, cookie);
    return Response.json(envelope());
  }) as typeof fetch, async () => {
    const result = await signInIdentity(ctx, 'apps', user.email, ' password-with-spaces ');
    assert.ok(!('confirmation_required' in result)); assert.equal(result.subject, user.id); assert.equal(result.sessionToken, cookie);
    assert.equal(result.issuer, ctx.config.appsAuthUrl); assert.equal(calls, 2);
  });
});

test('unconfirmed Neon signup never creates a local authenticated identity', async () => {
  let calls = 0;
  await withFetch((async (input: any, init: any) => {
    calls++; assert.match(String(input), /\/sign-up\/email$/); const body=JSON.parse(init.body); assert.equal(body.name, 'owner');
    return Response.json({ user: { ...user, emailVerified: false }, token: null });
  }) as typeof fetch, async () => {
    assert.deepEqual(await signInIdentity(ctx, 'control', user.email, 'password-123', true), { confirmation_required: true }); assert.equal(calls, 1);
  });
});

test('an unconfirmed upstream session is revoked instead of being treated as a login', async () => {
  let revoked = false;
  await withFetch((async (input: any, init: any) => {
    if (String(input).endsWith('/sign-out')) { revoked=true; assert.equal(init.headers.Cookie, cookie); return Response.json({ success: true }); }
    return Response.json({ user: { ...user, emailVerified: false } }, { headers: { 'Set-Cookie': cookie } });
  }) as typeof fetch, async () => {
    assert.deepEqual(await signInIdentity(ctx, 'control', user.email, 'password-123'), { confirmation_required: true }); assert.equal(revoked, true);
  });
});

test('remote validation rejects expired, mismatched and unverified managed sessions', async () => {
  for (const data of [
    { ...envelope(), session: { ...envelope().session, expiresAt: '2000-01-01T00:00:00Z' } },
    { ...envelope(), session: { ...envelope().session, userId: 'different-subject' } },
    { ...envelope(), user: { ...user, emailVerified: false } },
    { session: null, user: null },
  ]) await withFetch((async () => Response.json(data)) as typeof fetch, async () => { await assert.rejects(validateIdentity(ctx, 'control', cookie), /Identidad no confirmada/); });
});

test('identity mapping is stable, issuer/plane bound, opaque-ID safe and never links by email', () => {
  const identity = { provider: 'neon' as const, subject: user.id, issuer: ctx.config.controlAuthUrl! };
  assert.equal(identityUserId(identity), identityUserId({ ...identity }));
  assert.match(identityUserId(identity), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(identityUserId(identity), identityUserId(identity, 'apps'));
  assert.notEqual(identityUserId(identity), identityUserId({ ...identity, issuer: ctx.config.appsAuthUrl! }));
  assert.notEqual(identityUserId(identity), identityUserId({ ...identity, subject: 'another-user' }));
  assert.notEqual(identityId('issuer:a', 'b'), identityId('issuer', 'a:b'));
  assert.deepEqual(JSON.parse(identitySubject(identity)), [identity.issuer, user.id]);
  const existing='650e8400-e29b-41d4-a716-446655440000'; assert.equal(identityId('supabase', existing), existing);
});

test('malformed cookies and provider errors fail closed without echoing upstream secrets', async () => {
  await assert.rejects(validateIdentity(ctx, 'control', cookie+'; injected=value'), /Identidad/);
  await withFetch((async () => Response.json({ message: 'sensitive-upstream-detail' }, { status: 401 })) as typeof fetch, async () => {
    await assert.rejects(signInIdentity(ctx, 'control', user.email, 'password-123'), error => error instanceof Error && !error.message.includes('sensitive-upstream-detail') && /Identidad/.test(error.message));
  });
  await withFetch((async () => new Response('x'.repeat(131073))) as typeof fetch, async () => { await assert.rejects(validateIdentity(ctx, 'control', cookie), /no está disponible/); });
  await withFetch((async () => Response.json(envelope(), { headers: { 'Set-Cookie': cookie+'; Max-Age=0' } })) as typeof fetch, async () => { await assert.rejects(validateIdentity(ctx, 'control', cookie), /Identidad/); });
});

test('Supabase compatibility validates user remotely and supports an empty logout response', async () => {
  const legacy = { config: { ...ctx.config, backendProvider: 'supabase' } } as CoreContext; const id='650e8400-e29b-41d4-a716-446655440000';
  await withFetch((async (input: any, init: any) => {
    const url=String(input); assert.equal(init.headers.apikey, 'fixture');
    if(url.endsWith('/token?grant_type=password')) return Response.json({ access_token: 'fixture-gotrue-token' });
    assert.equal(init.headers.Authorization, 'Bearer fixture-gotrue-token');
    if(url.endsWith('/logout')) return new Response(null, { status: 204 });
    assert.match(url, /\/auth\/v1\/user$/); return Response.json({ id, email:user.email, email_confirmed_at:'2026-10-13T00:00:00Z' });
  }) as typeof fetch, async () => {
    const result=await signInIdentity(legacy, 'control', user.email, 'password-123'); assert.ok(!('confirmation_required' in result));
    assert.equal(identityUserId(result), id); await revokeIdentity(legacy, 'control', result.sessionToken);
  });
});

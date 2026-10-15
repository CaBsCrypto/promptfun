import { randomBytes, randomUUID, createPublicKey, verify } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import type { Request, Router } from 'express';
import { assertOrigin, asyncRoute, HttpError, type CoreContext } from '../shared.js';
import { authenticate, assertCsrf, cookieOptions, cookieValue, SESSION_COOKIE, SESSION_SECONDS } from './auth.js';
import { transaction } from './db.js';
import { identityId } from './identity.js';
import { equalSecret, hash, nonce, uuid } from './security.js';
import { assertNonDemo } from './demo-policy.js';

const FLOW_COOKIE='pf_wallet_flow';
const FLOW_PATH='/api/auth/wallet';
const FIVE_MINUTES=300_000;
const invalid=()=>new HttpError(403,'INVALID_WALLET_CHALLENGE','La solicitud de wallet venció, ya se utilizó o pertenece a otro navegador.');
function address(value:unknown):string {
  if(typeof value!=='string'||value.length<32||value.length>44)throw new HttpError(422,'INVALID_WALLET','Dirección de wallet inválida.');
  try {const key=new PublicKey(value);if(key.toBase58()!==value||!PublicKey.isOnCurve(key.toBytes()))throw new Error();return value;}
  catch {throw new HttpError(422,'INVALID_WALLET','Dirección de wallet inválida.');}
}
function signatureBytes(value:unknown) {
  if(typeof value!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(value))throw new HttpError(422,'INVALID_WALLET_SIGNATURE','Firma de wallet inválida.');
  const bytes=Buffer.from(value,'base64');
  if(bytes.length!==64||bytes.toString('base64')!==value)throw new HttpError(422,'INVALID_WALLET_SIGNATURE','Firma de wallet inválida.');
  return bytes;
}
function origin(ctx:CoreContext) {
  const url=new URL(ctx.config.platformOrigin);
  if(url.origin!==ctx.config.platformOrigin)throw new HttpError(503,'WALLET_AUTH_UNCONFIGURED','Configura un origen exacto para el acceso con wallet.');
  return url;
}
// SIWS ABNF, with an explicit Devnet/purpose binding. The client signs these exact
// UTF-8 bytes using signMessage; this is BFF proof, not a Neon Auth wallet plugin.
// https://github.com/phantom/sign-in-with-solana#specification
export function walletAuthMessage(input:{origin:string;address:string;mode:'login'|'link';nonce:string;id:string;issuedAt:string;expiresAt:string;userId?:string}) {
  const url=new URL(input.origin);
  const statement=input.mode==='login'?'Inicia sesion en Promptfun con esta wallet. No autoriza transacciones ni movimientos de fondos.':
    `Vincula esta wallet a la cuenta ${input.userId} de Promptfun. No autoriza transacciones ni movimientos de fondos.`;
  return `${url.host} wants you to sign in with your Solana account:\n${input.address}\n\n${statement}\n\nURI: ${url.origin}\nVersion: 1\nChain ID: solana:devnet\nNonce: ${input.nonce}\nIssued At: ${input.issuedAt}\nExpiration Time: ${input.expiresAt}\nRequest ID: ${input.id}\nResources:\n- urn:promptfun:wallet-auth:${input.mode}${input.userId?'\n- urn:promptfun:account:'+input.userId:''}`;
}
function verifyProof(message:string,signature:Buffer,wallet:string) {
  // RFC 8410 SubjectPublicKeyInfo for the 32-byte Ed25519 public key.
  const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),new PublicKey(wallet).toBuffer()]),format:'der',type:'spki'});
  return verify(null,Buffer.from(message,'utf8'),key,signature);
}
function flowOptions(ctx:CoreContext) {return {...cookieOptions(ctx),sameSite:'strict' as const,path:FLOW_PATH};}

export function mountWalletAuth(router:Router,ctx:CoreContext) {
  router.post('/auth/wallet/challenge',asyncRoute(async(req,res)=>{
    assertOrigin(req,ctx.config.platformOrigin);const site=origin(ctx),wallet=address(req.body.address),mode=req.body.mode;
    if(mode!=='login'&&mode!=='link')throw new HttpError(422,'INVALID_WALLET_MODE','Elige iniciar sesión o vincular wallet.');
    const user=mode==='link'?await authenticate(ctx,req):null;
    if(user){assertNonDemo(user);assertCsrf(ctx,req,user);if(!user.email)throw new HttpError(409,'MANAGED_ACCOUNT_REQUIRED','Vincula la wallet desde una cuenta existente con correo.');}
    const id=randomUUID(),flowToken=nonce(),challengeNonce=randomBytes(32).toString('hex');
    const time=(await ctx.control.query('select now() as time')).rows[0].time;
    const issuedAt=new Date(time).toISOString(),expiresAt=new Date(Date.parse(issuedAt)+FIVE_MINUTES).toISOString();
    const message=walletAuthMessage({origin:site.origin,address:wallet,mode,nonce:challengeNonce,id,issuedAt,expiresAt,userId:user?.id});
    await ctx.control.query(`insert into wallet_auth_challenges(id,nonce,address,mode,origin,message,browser_token_hash,user_id,session_id,created_at,expires_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[id,challengeNonce,wallet,mode,site.origin,message,hash(flowToken),user?.id||null,user?.session_id||null,issuedAt,expiresAt]);
    res.cookie(FLOW_COOKIE,flowToken,{...flowOptions(ctx),maxAge:FIVE_MINUTES});res.json({challenge_id:id,message,expires_at:expiresAt});
  }));
  router.post('/auth/wallet/verify',asyncRoute(async(req,res)=>{
    assertOrigin(req,ctx.config.platformOrigin);const site=origin(ctx),id=uuid(req.body.challenge_id),signature=signatureBytes(req.body.signature);
    const flow=cookieValue(req,FLOW_COOKIE);if(!flow||!/^[\w-]{43}$/.test(flow))throw invalid();
    // Determine the mode only from durable server state, never from client input.
    const pending=(await ctx.control.query('select mode from wallet_auth_challenges where id=$1',[id])).rows[0];
    if(!pending)throw invalid();
    const user=pending.mode==='link'?await authenticate(ctx,req):null;
    if(user){assertNonDemo(user);assertCsrf(ctx,req,user);}
    const sessionToken=nonce(),csrf=nonce(),expiresAt=new Date(Date.now()+SESSION_SECONDS*1000).toISOString();
    const result=await transaction(ctx,async client=>{
      const challenge=(await client.query(`select * from wallet_auth_challenges where id=$1 and consumed_at is null and expires_at>now() for update`,[id])).rows[0];
      if(!challenge||challenge.origin!==site.origin||!equalSecret(challenge.browser_token_hash,hash(flow)))throw invalid();
      if(challenge.mode==='link'&&(!user||challenge.user_id!==user.id||challenge.session_id!==user.session_id))throw invalid();
      if(!verifyProof(challenge.message,signature,challenge.address))throw new HttpError(403,'INVALID_WALLET_SIGNATURE','La firma no corresponde a esta wallet y solicitud.');
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['wallet-auth:'+challenge.address]);
      if(user){
        const live=(await client.query(`select id from platform_sessions where id=$1 and user_id=$2 and revoked_at is null and expires_at>now() for update`,[user.session_id,user.id])).rows[0];
        if(!live)throw invalid();
      }
      const existing=(await client.query('select * from wallet_credentials where address=$1',[challenge.address])).rows[0];
      const userId=user?.id||existing?.user_id||identityId('solana:devnet',challenge.address);
      if(!user&&!existing)await client.query(`insert into platform_users(id,email,auth_provider,auth_subject) values($1,null,'solana',$2)`,[userId,challenge.address]);
      const account=(await client.query('select * from platform_users where id=$1 for update',[userId])).rows[0];
      if(!account)throw invalid();
      if(user&&(!account.email||!['neon','supabase'].includes(account.auth_provider)))throw new HttpError(409,'MANAGED_ACCOUNT_REQUIRED','Vincula la wallet desde una cuenta existente con correo.');
      if(existing&&existing.user_id!==userId)throw new HttpError(409,'WALLET_ALREADY_LINKED','Esta wallet pertenece a otra cuenta; no se vincula automáticamente.');
      if(!user&&existing?.state==='revoked')throw new HttpError(403,'WALLET_RELINK_REQUIRED','Esta wallet fue desvinculada. Inicia sesión por correo para volver a vincularla.');
      const active=(await client.query("select id,address from wallet_credentials where user_id=$1 and state='active' for update",[userId])).rows[0];
      if(active&&active.address!==challenge.address)throw new HttpError(409,'WALLET_ALREADY_LINKED','La cuenta ya tiene una wallet activa. Desvincúlala antes de cambiarla.');
      let credential=existing;
      if(!credential)credential=(await client.query('insert into wallet_credentials(user_id,address) values($1,$2) returning *',[userId,challenge.address])).rows[0];
      else if(user&&credential.state==='revoked')credential=(await client.query("update wallet_credentials set state='active',revoked_at=null where id=$1 returning *",[credential.id])).rows[0];
      const consumed=await client.query('update wallet_auth_challenges set consumed_at=now() where id=$1 and consumed_at is null returning id',[id]);
      if(!consumed.rowCount)throw invalid();
      if(!user)await client.query(`insert into platform_sessions(user_id,token_hash,csrf_token,expires_at,auth_method,wallet_credential_id)
        values($1,$2,$3,$4,'solana',$5)`,[userId,hash(sessionToken),csrf,expiresAt,credential.id]);
      return {user:{id:userId,email:account.email,wallet_address:challenge.address},csrf_token:user?.csrf_token||csrf};
    });
    res.clearCookie(FLOW_COOKIE,flowOptions(ctx));
    if(!user)res.cookie(SESSION_COOKIE,sessionToken,{...cookieOptions(ctx),maxAge:SESSION_SECONDS*1000});
    res.json(result);
  }));
  router.get('/auth/wallet',asyncRoute(async(req,res)=>{
    const user=await authenticate(ctx,req);
    const credential=(await ctx.control.query("select address,created_at from wallet_credentials where user_id=$1 and state='active'",[user.id])).rows[0]||null;
    res.json({credential});
  }));
  router.delete('/auth/wallet',asyncRoute(async(req,res)=>{
    const user=await authenticate(ctx,req);assertNonDemo(user);assertCsrf(ctx,req,user);
    const current=(await ctx.control.query("select id,address from wallet_credentials where user_id=$1 and state='active'",[user.id])).rows[0];
    if(!current){res.json({ok:true});return;}
    const clearSession=await transaction(ctx,async client=>{
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['wallet-auth:'+current.address]);
      await client.query('select id from platform_sessions where wallet_credential_id=$1 for update',[current.id]);
      const account=(await client.query('select auth_provider,email from platform_users where id=$1 for update',[user.id])).rows[0];
      if(!account?.email||!['neon','supabase'].includes(account.auth_provider))throw new HttpError(409,'LAST_LOGIN_METHOD','Esta wallet es tu único método de acceso y no se puede desvincular.');
      await client.query("update wallet_credentials set state='revoked',revoked_at=now() where id=$1 and user_id=$2",[current.id,user.id]);
      const revoked=await client.query('update platform_sessions set revoked_at=now() where wallet_credential_id=$1 and revoked_at is null returning id',[current.id]);
      return revoked.rows.some(row=>row.id===user.session_id);
    });
    if(clearSession)res.clearCookie(SESSION_COOKIE,cookieOptions(ctx));res.json({ok:true});
  }));
}

import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import type { CoreContext, Authenticate, AuthenticatedUser } from '../shared.js';
import { asyncRoute, HttpError, assertOrigin } from '../shared.js';
import { integer, quoteTrade, QUOTE_SECONDS } from '../../shared/curve.js';
import { addresses, assertDevnet, createAta, decodeMarket, fundingTransaction, hash, registerInstruction,
  TOKEN_PROGRAM, tradeInstruction, uuidBytes, validateCurveVault, validateLockedVault, validateMint, verifyPreparedTransaction, verifyWalletMessage } from './chain.js';

type Operation = {id: string; project_id: string; user_id: string; kind: string; message_hash: string; created_at: string;
  expected_signer: string; funding_intent_id: string | null; signature: string | null; status: string; expires_at: string; error: string | null};
function pubkey(value: unknown): PublicKey {
  try { if (typeof value !== 'string') throw new Error(); return new PublicKey(value); }
  catch { throw new HttpError(400, 'INVALID_WALLET', 'Dirección de wallet inválida.'); }
}
function uuid(value: unknown): string {
  try { if (typeof value !== 'string') throw new Error(); uuidBytes(value); return value; }
  catch { throw new HttpError(400, 'INVALID_ID', 'Identificador inválido.'); }
}
function amount(value: unknown): bigint {
  try { const n=integer(value); if(n<=0n) throw new Error('El importe debe ser positivo.'); return n; }
  catch(e) { throw new HttpError(400,'INVALID_AMOUNT',(e as Error).message); }
}
function signature(value: unknown): string {
  if(typeof value!=='string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value)) throw new HttpError(400,'INVALID_SIGNATURE','Firma de transacción inválida.');
  return value;
}
const expiry = (seconds=QUOTE_SECONDS) => new Date(Date.now()+seconds*1000).toISOString();

export function createMarketRouter(ctx: CoreContext, authenticate: Authenticate): Router {
  const router=Router();
  const connection=new Connection(ctx.config.solanaRpcUrl || 'https://api.devnet.solana.com','confirmed');
  const configured=()=>!!ctx.config.marketProgramId && !!ctx.config.registrarKeyPath;
  const program=()=>{if(!configured()) throw new HttpError(503,'MARKET_NOT_CONFIGURED','El programa Devnet y registrar todavía no están configurados.'); return pubkey(ctx.config.marketProgramId);};
  async function devnet() { try { await assertDevnet(connection); } catch(e) { throw new HttpError(503,'DEVNET_UNAVAILABLE',(e as Error).message); } }
  async function auth(req:any):Promise<AuthenticatedUser> {
    const user=await authenticate(req); assertOrigin(req,ctx.config.platformOrigin);
    const supplied=Buffer.from(req.get('x-csrf-token')||''),expected=Buffer.from(user.csrf_token);
    if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) throw new HttpError(403,'INVALID_CSRF','Token CSRF inválido.');
    return user;
  }
  async function project(id:string,owner?:string) {
    const result=await ctx.control.query('select * from projects where id=$1',[uuid(id)]);
    const p=result.rows[0]; if(!p || (owner && p.owner_id!==owner)) throw new HttpError(404,'PROJECT_NOT_FOUND','Proyecto no encontrado.'); return p;
  }
  async function visibleProject(req:any,id:string) {
    const p=await project(id); if(p.published_version_id) return p;
    try { const user=await authenticate(req); if(user.id===p.owner_id) return p; } catch {}
    throw new HttpError(404,'PROJECT_NOT_FOUND','Proyecto no encontrado.');
  }
  async function registrar() {
    try {const bytes=JSON.parse(await readFile(ctx.config.registrarKeyPath,'utf8')); return Keypair.fromSecretKey(Uint8Array.from(bytes));}
    catch {throw new HttpError(503,'REGISTRAR_UNAVAILABLE','No se pudo cargar el registrar Devnet del servidor.');}
  }
  async function refreshMarket(id:string) {
    const stored=(await ctx.control.query('select * from markets where project_id=$1',[uuid(id)])).rows[0];
    if(!stored) return null;
    await devnet();
    const programId=program(), creator=pubkey(stored.creator), a=addresses(programId,creator,id);
    const accounts=await connection.getMultipleAccountsInfo([a.market,a.mint,a.locked,a.curve],'finalized');
    if(!accounts[0]) return {...stored,sol_vault:stored.address,status:'prepared'};
    if(!accounts[0].owner.equals(programId)) throw new HttpError(409,'INVALID_MARKET','El mercado no pertenece al programa configurado.');
    const state=decodeMarket(accounts[0].data);
    if(!state.creator.equals(creator) || !state.project.equals(uuidBytes(id)) || !state.mint.equals(a.mint) || !state.curve.equals(a.curve) || !state.locked.equals(a.locked)) throw new HttpError(409,'INVALID_MARKET','Direcciones del mercado no coinciden.');
    if(!accounts[1]?.owner.equals(TOKEN_PROGRAM) || !accounts[2]?.owner.equals(TOKEN_PROGRAM) || !accounts[3]?.owner.equals(TOKEN_PROGRAM)) throw new HttpError(409,'INVALID_MINT','Las cuentas SPL no son válidas.');
    validateMint(accounts[1].data);validateLockedVault(accounts[2].data,a.mint,a.market);
    validateCurveVault(accounts[3].data,a.mint,a.market,state.sold);
    const rent=await connection.getMinimumBalanceForRentExemption(accounts[0].data.length,'finalized');
    if(BigInt(accounts[0].lamports)<state.reserve+BigInt(rent)) throw new HttpError(409,'INVALID_RESERVE','El mercado no conserva rent y respaldo SOL.');
    const updated=(await ctx.control.query("update markets set net_sold=$2,reserve_lamports=$3,status='active',updated_at=now() where project_id=$1 returning *",[id,state.sold.toString(),state.reserve.toString()])).rows[0];
    return {...updated,sol_vault:stored.address};
  }
  async function prepare(tx:Transaction,user:AuthenticatedUser,projectId:string,kind:string,options:{quote?:string;funding?:string;registrar?:Keypair}={}) {
    await devnet();
    tx.recentBlockhash=(await connection.getLatestBlockhash('confirmed')).blockhash;
    if(!tx.feePayer) throw new Error('Fee payer missing.');
    if(options.registrar) tx.partialSign(options.registrar);
    const expiresAt=expiry(),id=randomUUID(),messageHash=hash(tx.serializeMessage());
    const saved=(await ctx.control.query(`insert into solana_transactions(id,project_id,user_id,kind,quote_id,funding_intent_id,message_hash,expected_signer,expires_at,ix_index)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(message_hash) do update set message_hash=excluded.message_hash returning id,user_id,expires_at`,[id,projectId,user.id,kind,options.quote||null,options.funding||null,messageHash,tx.feePayer.toBase58(),expiresAt,kind==='buy'||kind==='sell'?1:0])).rows[0];
    if(saved.user_id!==user.id) throw new HttpError(409,'OPERATION_CONFLICT','La operación ya está asociada a otra cuenta.');
    return {transaction:tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64'),expires_at:new Date(saved.expires_at).toISOString(),operation_id:saved.id};
  }
  async function reconcile(op:Operation) {
    if(!op.signature || op.status==='confirmed' || op.status==='failed') return op;
    await devnet();
    const tx=await connection.getTransaction(op.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
    if(!tx) return op;
    const ok=verifyPreparedTransaction(tx,op.message_hash,op.expected_signer);
    const error=ok?null:(tx.meta?.err?'Transacción fallida en Solana.':'La transacción no coincide con la operación autorizada.');
    const client=await ctx.control.connect();
    try {
      await client.query('begin');
      const updated=(await client.query("update solana_transactions set status=$2,error=$3,finalized_at=now() where id=$1 returning *",[op.id,ok?'confirmed':'failed',error])).rows[0];
      if(op.funding_intent_id) await client.query('update funding_intents set status=$2,signature=$3 where id=$1',[op.funding_intent_id,ok?'confirmed':'failed',op.signature]);
      await client.query('commit'); return updated as Operation;
    }catch(e){await client.query('rollback');throw e;}finally{client.release();}
  }
  async function attachSubmission(id:string,user:AuthenticatedUser,sig:string,funding?:string) {
    await devnet();
    const tx=await connection.getTransaction(sig,{commitment:'confirmed',maxSupportedTransactionVersion:0});
    if(!tx) throw new HttpError(409,'TRANSACTION_NOT_VISIBLE','La transacción aún no aparece en Devnet; vuelve a consultar con la misma firma.');
    if(tx.meta?.err) throw new HttpError(409,'TRANSACTION_FAILED','La transacción falló en Devnet.');
    const messageHash=hash(tx.transaction.message.serialize());
    const stored=(await ctx.control.query('select * from solana_transactions where project_id=$1 and user_id=$2 and message_hash=$3',[id,user.id,messageHash])).rows[0] as Operation|undefined;
    if(!stored || (funding && stored.funding_intent_id!==funding) || !verifyPreparedTransaction(tx,stored.message_hash,stored.expected_signer)) throw new HttpError(409,'TRANSACTION_MISMATCH','La firma no prueba esta operación.');
    const result=await ctx.control.query("update solana_transactions set signature=$2,status=case when status='prepared' then 'pending' else status end where id=$1 and (signature is null or signature=$2) returning *",[stored.id,sig]);
    if(!result.rowCount) throw new HttpError(409,'ALREADY_SUBMITTED','La operación ya tiene otra firma.');
    if(funding) await ctx.control.query("update funding_intents set status=case when status='created' then 'pending' else status end,signature=$2 where id=$1",[funding,sig]);
    return reconcile(result.rows[0]);
  }

  router.post('/projects/:id/wallet/challenge',asyncRoute(async(req,res)=>{
    const user=await auth(req),p=await project(req.params.id,user.id),address=pubkey(req.body.address).toBase58();
    const existing=(await ctx.control.query('select creator from markets where project_id=$1',[p.id])).rows[0];
    if(existing && existing.creator!==address) throw new HttpError(409,'WALLET_LOCKED','Un mercado ya preparado fija la wallet del creador.');
    const nonce=randomBytes(32).toString('hex'),expiresAt=expiry(300);
    const message=`${new URL(ctx.config.platformOrigin).host} wants you to sign in with your Solana account:\n${address}\n\nVincular wallet al proyecto promptfun ${p.id}. Esta firma no mueve fondos.\n\nURI: ${ctx.config.platformOrigin}\nVersion: 1\nChain ID: solana:devnet\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}\nExpiration Time: ${expiresAt}\nResources:\n- urn:promptfun:project:${p.id}`;
    await ctx.control.query('insert into project_wallet_challenges(nonce,project_id,user_id,address,message,expires_at) values($1,$2,$3,$4,$5,$6)',[nonce,p.id,user.id,address,message,expiresAt]);
    res.json({nonce,message,expires_at:expiresAt});
  }));
  router.post('/projects/:id/wallet/verify',asyncRoute(async(req,res)=>{
    const user=await auth(req),p=await project(req.params.id,user.id),client=await ctx.control.connect();
    try {
      await client.query('begin');
      const c=(await client.query('select * from project_wallet_challenges where nonce=$1 and project_id=$2 and user_id=$3 for update',[req.body.nonce,p.id,user.id])).rows[0];
      const address=pubkey(req.body.address).toBase58();
      if(!c || c.consumed_at || new Date(c.expires_at).getTime()<=Date.now() || c.address!==address || !verifyWalletMessage(address,c.message,req.body.signature)) throw new HttpError(401,'INVALID_WALLET_PROOF','Firma, nonce o vencimiento inválido.');
      await client.query('select wallet_address from projects where id=$1 for update',[p.id]);
      const market=(await client.query('select creator from markets where project_id=$1',[p.id])).rows[0];
      if(market && market.creator!==address) throw new HttpError(409,'WALLET_LOCKED','La wallet del mercado no puede cambiar.');
      await client.query('update project_wallet_challenges set consumed_at=now() where nonce=$1',[c.nonce]);
      await client.query('insert into project_wallet_bindings(project_id,user_id,address) values($1,$2,$3) on conflict(project_id) do update set address=excluded.address,verified_at=now()',[p.id,user.id,address]);
      await client.query('update projects set wallet_address=$2 where id=$1',[p.id,address]);
      await client.query('commit');res.json({wallet_address:address});
    }catch(e){await client.query('rollback');throw e;}finally{client.release();}
  }));
  router.get('/projects/:id/market',asyncRoute(async(req,res)=>{
    const p=await visibleProject(req,req.params.id);
    if(!configured()) return res.json({market:null,configured:false});
    const pending=(await ctx.control.query("select * from solana_transactions where project_id=$1 and status='pending' order by created_at limit 20",[p.id])).rows;
    for(const op of pending) await reconcile(op);
    res.json({market:await refreshMarket(p.id),configured:true});
  }));
  router.post('/projects/:id/market',asyncRoute(async(req,res)=>{
    const user=await auth(req),p=await project(req.params.id,user.id),programId=program();
    if(!p.wallet_address) throw new HttpError(409,'WALLET_REQUIRED','Vincula la wallet del creador antes de emitir el token Devnet.');
    const creator=pubkey(p.wallet_address),key=await registrar(),a=addresses(programId,creator,p.id);
    await devnet();
    const cfg=await connection.getAccountInfo(a.config,'finalized');
    if(!cfg?.owner.equals(programId) || cfg.data.length!==74 || !cfg.data.subarray(40,72).equals(key.publicKey.toBuffer()) || cfg.data[72]!==0) throw new HttpError(503,'PROGRAM_NOT_INITIALIZED','Configura el programa y su registrar Devnet antes de registrar proyectos.');
    const active=await refreshMarket(p.id);if(active?.status==='active') throw new HttpError(409,'MARKET_EXISTS','El token del proyecto ya existe.');
    const client=await ctx.control.connect();let stored:any;
    try {
      await client.query('begin');
      const current=(await client.query('select wallet_address from projects where id=$1 for update',[p.id])).rows[0];
      if(current.wallet_address!==creator.toBase58()) throw new HttpError(409,'WALLET_CHANGED','La wallet cambió durante la preparación; vuelve a intentarlo.');
      stored=(await client.query(`insert into markets(project_id,address,mint,creator,curve_vault,locked_vault) values($1,$2,$3,$4,$5,$6)
        on conflict(project_id) do update set project_id=excluded.project_id returning *`,[p.id,a.market.toBase58(),a.mint.toBase58(),creator.toBase58(),a.curve.toBase58(),a.locked.toBase58()])).rows[0];
      await client.query('commit');
    }catch(e){await client.query('rollback');throw e;}finally{client.release();}
    if(stored.creator!==creator.toBase58()) throw new HttpError(409,'WALLET_LOCKED','La wallet ya fue fijada para el mercado.');
    const tx=new Transaction().add(registerInstruction(programId,creator,key.publicKey,p.id));tx.feePayer=creator;
    res.json({...await prepare(tx,user,p.id,'register',{registrar:key}),market:{...stored,sol_vault:stored.address},requires_signatures:[creator.toBase58(),key.publicKey.toBase58()],kind:'register'});
  }));
  router.post('/markets/:id/quote',asyncRoute(async(req,res)=>{
    const user=await auth(req),p=await visibleProject(req,req.params.id),market=await refreshMarket(p.id);
    if(!market || market.status!=='active') throw new HttpError(409,'MARKET_INACTIVE','El mercado Devnet no está registrado.');
    const side=req.body.side;if(side!=='buy'&&side!=='sell') throw new HttpError(400,'INVALID_SIDE','Operación inválida.');
    const q=amount(req.body.token_amount);let lamports:bigint;
    try {lamports=quoteTrade(side,BigInt(market.net_sold),q);}catch(e){throw new HttpError(400,'CURVE_LIMIT',(e as Error).message);}
    const id=randomUUID(),expiresAt=expiry();
    await ctx.control.query('insert into market_quotes(id,project_id,user_id,side,token_amount,lamports,expires_at) values($1,$2,$3,$4,$5,$6,$7)',[id,p.id,user.id,side,q.toString(),lamports.toString(),expiresAt]);
    res.json({quote:{id,market_id:p.id,side,token_amount:q.toString(),lamports:lamports.toString(),max_lamports:lamports.toString(),min_lamports:lamports.toString(),expires_at:expiresAt}});
  }));
  router.post('/markets/:id/transactions',asyncRoute(async(req,res)=>{
    const user=await auth(req),id=uuid(req.params.id);
    const quote=(await ctx.control.query('select * from market_quotes where id=$1 and project_id=$2 and user_id=$3',[uuid(req.body.quote_id),id,user.id])).rows[0];
    if(!quote || new Date(quote.expires_at).getTime()<=Date.now()) throw new HttpError(409,'QUOTE_EXPIRED','La cotización venció.');
    const market=await refreshMarket(id);if(!market || market.status!=='active') throw new HttpError(409,'MARKET_INACTIVE','Mercado no disponible.');
    const trader=pubkey(req.body.address),tx=new Transaction().add(createAta(trader,pubkey(market.mint)),tradeInstruction(program(),pubkey(market.creator),id,trader,quote.side,BigInt(quote.token_amount),BigInt(quote.lamports),BigInt(Math.floor(new Date(quote.expires_at).getTime()/1000))));
    tx.feePayer=trader;res.json({...await prepare(tx,user,id,quote.side,{quote:quote.id}),expires_at:new Date(quote.expires_at).toISOString()});
  }));
  router.post('/markets/:id/submit',asyncRoute(async(req,res)=>{
    const user=await auth(req),id=uuid(req.params.id),sig=signature(req.body.signature),op=await attachSubmission(id,user,sig);
    res.json({status:op.status,signature:sig,market:await refreshMarket(id)});
  }));
  router.post('/projects/:id/funding-intents',asyncRoute(async(req,res)=>{
    const user=await auth(req),p=await visibleProject(req,req.params.id);await devnet();
    if(!p.wallet_address) throw new HttpError(409,'WALLET_REQUIRED','El creador aún no tiene wallet vinculada.');
    const sender=pubkey(req.body.address),recipient=pubkey(p.wallet_address),lamports=amount(req.body.lamports),id=randomUUID(),reference=randomUUID(),expiresAt=expiry();
    await ctx.control.query('insert into funding_intents(id,project_id,user_id,sender,recipient,reference,lamports,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8)',[id,p.id,user.id,sender.toBase58(),recipient.toBase58(),reference,lamports.toString(),expiresAt]);
    const tx=fundingTransaction(sender,recipient,lamports,reference);tx.feePayer=sender;
    const prepared=await prepare(tx,user,p.id,'funding',{funding:id});
    const intent=(await ctx.control.query('select * from funding_intents where id=$1',[id])).rows[0];res.json({intent,...prepared});
  }));
  router.post('/funding-intents/:id/submit',asyncRoute(async(req,res)=>{
    const user=await auth(req),id=uuid(req.params.id),intent=(await ctx.control.query('select * from funding_intents where id=$1 and user_id=$2',[id,user.id])).rows[0];
    if(!intent) throw new HttpError(404,'INTENT_NOT_FOUND','Aporte no encontrado.');
    await attachSubmission(intent.project_id,user,signature(req.body.signature),id);
    res.json({intent:(await ctx.control.query('select * from funding_intents where id=$1',[id])).rows[0]});
  }));
  router.get('/funding-intents/:id',asyncRoute(async(req,res)=>{
    const user=await authenticate(req),id=uuid(req.params.id),intent=(await ctx.control.query('select * from funding_intents where id=$1 and user_id=$2',[id,user.id])).rows[0];
    if(!intent) throw new HttpError(404,'INTENT_NOT_FOUND','Aporte no encontrado.');
    const ops=(await ctx.control.query("select * from solana_transactions where funding_intent_id=$1 and status='pending'",[id])).rows;
    for(const op of ops) await reconcile(op);
    if(!intent.signature && new Date(intent.expires_at).getTime()<=Date.now()) await ctx.control.query("update funding_intents set status='expired' where id=$1 and status='created'",[id]);
    res.json({intent:(await ctx.control.query('select * from funding_intents where id=$1',[id])).rows[0]});
  }));
  return router;
}

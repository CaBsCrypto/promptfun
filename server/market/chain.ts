import { createHash, createPublicKey, verify } from 'node:crypto';
import { Connection, PublicKey, TransactionInstruction, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { CURVE_SUPPLY, LOCKED_SUPPLY, TOTAL_SUPPLY, cumulativeCost } from '../../shared/curve.js';

export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
export function hash(data: Uint8Array) { return createHash('sha256').update(data).digest('hex'); }
export function discriminator(namespace: 'global' | 'account', name: string) {
  return createHash('sha256').update(`${namespace}:${name}`).digest().subarray(0, 8);
}
export function uuidBytes(id: string): Buffer {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new Error('ID de proyecto inválido.');
  return Buffer.from(id.replaceAll('-', ''), 'hex');
}
export function addresses(program: PublicKey, creator: PublicKey, project: string) {
  const [market] = PublicKey.findProgramAddressSync([Buffer.from('market'), creator.toBuffer(), uuidBytes(project)], program);
  const pda = (seed: string) => PublicKey.findProgramAddressSync([Buffer.from(seed), market.toBuffer()], program)[0];
  return { market, mint: pda('mint'), curve: pda('curve'), locked: pda('locked'),
    config: PublicKey.findProgramAddressSync([Buffer.from('config')], program)[0] };
}
export function associatedToken(owner: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
}
export function createAta(payer: PublicKey, mint: PublicKey) {
  return new TransactionInstruction({ programId: ATA_PROGRAM, data: Buffer.from([1]), keys: [
    {pubkey: payer, isSigner: true, isWritable: true},
    {pubkey: associatedToken(payer, mint), isSigner: false, isWritable: true},
    {pubkey: payer, isSigner: false, isWritable: false}, {pubkey: mint, isSigner: false, isWritable: false},
    {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}, {pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false},
  ] });
}
export function registerInstruction(program: PublicKey, creator: PublicKey, registrar: PublicKey, project: string) {
  const a = addresses(program, creator, project);
  return new TransactionInstruction({programId: program, data: Buffer.concat([discriminator('global', 'register_project'), uuidBytes(project)]), keys: [
    {pubkey: creator, isSigner: true, isWritable: true}, {pubkey: registrar, isSigner: true, isWritable: false},
    {pubkey: a.config, isSigner: false, isWritable: false}, {pubkey: a.market, isSigner: false, isWritable: true},
    {pubkey: a.mint, isSigner: false, isWritable: true}, {pubkey: a.curve, isSigner: false, isWritable: true},
    {pubkey: a.locked, isSigner: false, isWritable: true}, {pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false},
    {pubkey: SystemProgram.programId, isSigner: false, isWritable: false}, {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
  ]});
}
export function tradeInstruction(program: PublicKey, creator: PublicKey, project: string, trader: PublicKey,
  side: 'buy' | 'sell', quantity: bigint, limit: bigint, expiry: bigint) {
  const a = addresses(program, creator, project), data = Buffer.alloc(32);
  discriminator('global', side).copy(data); data.writeBigUInt64LE(quantity, 8); data.writeBigUInt64LE(limit, 16); data.writeBigInt64LE(expiry, 24);
  return new TransactionInstruction({programId: program, data, keys: [
    {pubkey: trader, isSigner: true, isWritable: true}, {pubkey: a.config, isSigner: false, isWritable: false},
    {pubkey: a.market, isSigner: false, isWritable: true}, {pubkey: a.mint, isSigner: false, isWritable: false},
    {pubkey: a.curve, isSigner: false, isWritable: true}, {pubkey: associatedToken(trader, a.mint), isSigner: false, isWritable: true},
    {pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false}, {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
  ]});
}
export function verifyWalletMessage(address: string, message: string, signature: string) {
  try {
    const publicBytes = new PublicKey(address).toBuffer();
    const sig = Buffer.from(signature, 'base64');
    if (sig.length !== 64 || sig.toString('base64') !== signature) return false;
    const key = createPublicKey({key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), publicBytes]), format: 'der', type: 'spki'});
    return verify(null, Buffer.from(message), key, sig);
  } catch { return false; }
}
export async function assertDevnet(connection: Pick<Connection, 'getGenesisHash'>) {
  if (await connection.getGenesisHash() !== DEVNET_GENESIS) throw new Error('La conexión RPC no es Solana Devnet.');
}
export function decodeMarket(data: Buffer) {
  if (data.length !== 169 || !data.subarray(0,8).equals(discriminator('account', 'Market'))) throw new Error('Cuenta de mercado inválida.');
  const sold = data.readBigUInt64LE(152), reserve = data.readBigUInt64LE(160);
  if (sold > CURVE_SUPPLY || cumulativeCost(sold) !== reserve) throw new Error('Reservas del mercado no conciliadas.');
  return {creator: new PublicKey(data.subarray(8,40)), project: data.subarray(40,56),
    mint: new PublicKey(data.subarray(56,88)), curve: new PublicKey(data.subarray(88,120)),
    locked: new PublicKey(data.subarray(120,152)), sold, reserve};
}
export function validateMint(data: Buffer) {
  if (data.length !== 82 || data.readUInt32LE(0) !== 0 || data.readBigUInt64LE(36) !== TOTAL_SUPPLY ||
      data[44] !== 6 || data[45] !== 1 || data.readUInt32LE(46) !== 0) throw new Error('Mint: oferta, decimales o autoridades no permitidos.');
}
export function validateLockedVault(data: Buffer, mint: PublicKey, market: PublicKey) {
  if (data.length !== 165 || !data.subarray(0,32).equals(mint.toBuffer()) || !data.subarray(32,64).equals(market.toBuffer()) ||
    data.readBigUInt64LE(64) !== LOCKED_SUPPLY || data.readUInt32LE(72) !== 0 || data[108] !== 1 ||
    data.readUInt32LE(109) !== 0 || data.readUInt32LE(129) !== 0) throw new Error('Vault bloqueado inválido.');
}
export function validateCurveVault(data: Buffer, mint: PublicKey, market: PublicKey, sold: bigint) {
  if (data.length !== 165 || !data.subarray(0,32).equals(mint.toBuffer()) || !data.subarray(32,64).equals(market.toBuffer()) ||
    data.readBigUInt64LE(64) < CURVE_SUPPLY - sold || data.readUInt32LE(72) !== 0 || data[108] !== 1 ||
    data.readUInt32LE(109) !== 0 || data.readUInt32LE(129) !== 0) throw new Error('Vault de curva inválido.');
}
/** A transaction only proves the exact prepared message, signer and successful finalized execution. */
export function verifyPreparedTransaction(tx: any, messageHash: string, signer: string): boolean {
  if (!tx?.meta || tx.meta.err !== null || !tx.transaction?.message) return false;
  const message = tx.transaction.message;
  const signerKeys = message.staticAccountKeys ?? message.accountKeys;
  if (!Array.isArray(signerKeys) || !signerKeys.slice(0, message.header.numRequiredSignatures).some((key: PublicKey) => key.toBase58() === signer)) return false;
  return hash(message.serialize()) === messageHash;
}
export function fundingTransaction(sender: PublicKey, recipient: PublicKey, lamports: bigint, reference: string) {
  return new Transaction().add(SystemProgram.transfer({fromPubkey: sender, toPubkey: recipient, lamports}))
    .add(new TransactionInstruction({programId: MEMO_PROGRAM, keys: [{pubkey: sender,isSigner:true,isWritable:false}], data: Buffer.from(`promptfun:devnet:funding:${reference}`)}));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import { Keypair } from '@solana/web3.js';
import { signWalletMessage, type WalletProvider } from './wallet.js';

const key = Keypair.generate(), address = key.publicKey.toBase58();
const message = 'localhost:3000 solicita acceso a promptfun. Nonce: 9ab328bc581cb234';
function provider(shape: 'phantom' | 'solflare'): WalletProvider {
  return { publicKey:key.publicKey, connect:async()=>{}, disconnect:async()=>{},
    signTransaction:async transaction=>transaction,
    signMessage:async bytes=>{
      const signature=nacl.sign.detached(bytes,key.secretKey);
      return shape==='phantom'?{signature}:signature;
    } };
}
test('Phantom and Solflare message signatures normalize to the same verifiable Ed25519 proof',async()=>{
  for(const shape of ['phantom','solflare'] as const) {
    const signed=await signWalletMessage(provider(shape),message,address);
    assert.equal(nacl.sign.detached.verify(new TextEncoder().encode(message),Buffer.from(signed,'base64'),key.publicKey.toBytes()),true);
    assert.equal(nacl.sign.detached.verify(new TextEncoder().encode(message+' alterado'),Buffer.from(signed,'base64'),key.publicKey.toBytes()),false);
  }
});
test('wallet account changes before or during a login signature cannot create a proof for the expected account',async()=>{
  const before=provider('phantom');before.publicKey=Keypair.generate().publicKey;
  let calls=0;before.signMessage=async()=>{calls++;return new Uint8Array(64);};
  await assert.rejects(signWalletMessage(before,message,address),/wallet cambió/);assert.equal(calls,0);
  const during=provider('solflare');during.signMessage=async()=>{during.publicKey=Keypair.generate().publicKey;return new Uint8Array(64);};
  await assert.rejects(signWalletMessage(during,message,address),/durante la firma/);
});
test('malformed wallet signature bytes cannot become a login request',async()=>{
  const invalid=provider('solflare');invalid.signMessage=async()=>new Uint8Array(63);
  await assert.rejects(signWalletMessage(invalid,message,address),/firma de mensaje inválida/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateKey, sign } from 'node:crypto';
import { Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { CURVE_SUPPLY, TOTAL_SUPPLY, cumulativeCost, integer, quoteTrade } from '../shared/curve.js';
import { addresses, assertDevnet, DEVNET_GENESIS, fundingTransaction, hash, registerInstruction,
  tradeInstruction, verifyPreparedTransaction, verifyWalletMessage, decodeMarket, discriminator, validateMint } from '../server/market/chain.js';

test('curve reserve is exact at zero, full cap, partial sell and reopening',()=>{
  assert.equal(cumulativeCost(0n),0n);assert.equal(cumulativeCost(CURVE_SUPPLY),87_912_087_913n);
  const q=10_000_000_000n,paid=quoteTrade('buy',0n,q);
  assert.equal(quoteTrade('sell',q,q),paid);
  const returnAtCap=quoteTrade('sell',CURVE_SUPPLY,q);
  assert.equal(quoteTrade('buy',CURVE_SUPPLY-q,q),returnAtCap);
  assert.throws(()=>quoteTrade('buy',CURVE_SUPPLY,1n));assert.throws(()=>quoteTrade('sell',0n,1n));
  assert.throws(()=>quoteTrade('buy',0n,0n));assert.throws(()=>integer('1.5'));assert.throws(()=>integer('-1'));
  assert.throws(()=>integer('18446744073709551616'));assert.throws(()=>integer(1));
});
test('partitioned purchases cannot manufacture SOL through rounding',()=>{
  let seed=13n;
  for(let i=0;i<2_000;i++) {
    seed=(seed*48271n)%2147483647n;
    const sold=seed*300_000n,q=seed*10_000n+1_000_000n,r=q/2n;
    const split=quoteTrade('buy',sold,r)+quoteTrade('buy',sold+r,q-r);
    assert.equal(split,quoteTrade('buy',sold,q));assert.equal(quoteTrade('sell',sold+q,q),split);
  }
});
test('wallet signature is bound to exact domain, nonce and project',()=>{
  const pair=Keypair.generate();
  const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(pair.secretKey.subarray(0,32))]),format:'der',type:'pkcs8'});
  const message='localhost:3000 / nonce:abc / project:one';
  const sig=sign(null,Buffer.from(message),key).toString('base64');
  assert.equal(verifyWalletMessage(pair.publicKey.toBase58(),message,sig),true);
  assert.equal(verifyWalletMessage(pair.publicKey.toBase58(),message.replace('one','two'),sig),false);
  assert.equal(verifyWalletMessage(Keypair.generate().publicKey.toBase58(),message,sig),false);
  assert.equal(verifyWalletMessage(pair.publicKey.toBase58(),message,'abc'),false);
});
test('finalized proof requires the exact prepared transfer, amount, recipient and reference',()=>{
  const sender=Keypair.generate(),recipient=Keypair.generate().publicKey;
  function fixture(lamports=25n,ref='intent-one',to=recipient) {
    const tx=fundingTransaction(sender.publicKey,to,lamports,ref);
    tx.feePayer=sender.publicKey;tx.recentBlockhash=Keypair.generate().publicKey.toBase58();
    tx.sign(sender);return {tx,proof:{meta:{err:null},transaction:{message:tx.compileMessage()}}};
  }
  const {tx,proof}=fixture(),expected=hash(tx.serializeMessage());
  assert.equal(verifyPreparedTransaction(proof,expected,sender.publicKey.toBase58()),true);
  assert.equal(verifyPreparedTransaction({...proof,meta:{err:{InstructionError:[0,'failure']}}},expected,sender.publicKey.toBase58()),false);
  for(const changed of [fixture(26n),fixture(25n,'intent-two'),fixture(25n,'intent-one',Keypair.generate().publicKey)])
    assert.equal(verifyPreparedTransaction(changed.proof,expected,sender.publicKey.toBase58()),false);
  assert.equal(verifyPreparedTransaction(proof,expected,recipient.toBase58()),false);
});
test('RPC network guard rejects mainnet and unknown clusters',async()=>{
  // Independent fixture from Solana's genesis_config.rs, also checked against live Devnet.
  await assertDevnet({getGenesisHash:async()=>'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'});
  for(const invalid of ['5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d','EtWTRABZaYq6iMfeYKouRu166VU2xqa1','unknown'])
    await assert.rejects(assertDevnet({getGenesisHash:async()=>invalid}));
});
test('registration is bound to creator/project and requires both signatures',()=>{
  const program=new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'),creator=Keypair.generate(),registrar=Keypair.generate();
  const project='3ff10000-aaaa-4bbb-8ccc-123456789abc';
  const a=addresses(program,creator.publicKey,project),other=addresses(program,creator.publicKey,'3ff10000-aaaa-4bbb-8ccc-123456789abd');
  assert.notEqual(a.market.toBase58(),other.market.toBase58());
  const ix=registerInstruction(program,creator.publicKey,registrar.publicKey,project);
  assert.equal(ix.keys[0].isSigner,true);assert.equal(ix.keys[1].isSigner,true);
  const tx=new Transaction().add(ix);tx.feePayer=creator.publicKey;tx.recentBlockhash=Keypair.generate().publicKey.toBase58();tx.partialSign(registrar);
  const restored=Transaction.from(tx.serialize({requireAllSignatures:false,verifySignatures:false}));restored.partialSign(creator);
  assert.equal(restored.verifySignatures(),true);
});
test('market decode rejects wrong owner binding data and invented reserve',()=>{
  const data=Buffer.alloc(169);discriminator('account','Market').copy(data);
  data.writeBigUInt64LE(1_000_000_000n,152);data.writeBigUInt64LE(cumulativeCost(1_000_000_000n),160);
  assert.equal(decodeMarket(data).sold,1_000_000_000n);
  data.writeBigUInt64LE(1n,160);assert.throws(()=>decodeMarket(data));
  const mint=Buffer.alloc(82);mint.writeBigUInt64LE(TOTAL_SUPPLY,36);mint[44]=6;mint[45]=1;validateMint(mint);
  mint.writeUInt32LE(1,0);assert.throws(()=>validateMint(mint));
});
test('trade encodes exact integers and no program can withdraw locked tokens',()=>{
  const program=new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'),creator=Keypair.generate().publicKey,buyer=Keypair.generate().publicKey;
  const project='3ff10000-aaaa-4bbb-8ccc-123456789abc',a=addresses(program,creator,project);
  const ix=tradeInstruction(program,creator,project,buyer,'buy',123_456_789_000n,55_000_000n,1_800_000_000n);
  assert.equal(ix.data.readBigUInt64LE(8),123_456_789_000n);
  assert.equal(ix.keys.some(k=>k.pubkey.equals(a.locked)),false);
  assert.equal(ix.keys[0].pubkey.equals(buyer),true);
});

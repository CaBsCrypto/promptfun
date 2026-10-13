import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey, SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY, SystemProgram } from '@solana/web3.js';
import { initializeBuffer, writeBuffer, deployProgram, validateBuffer, UPGRADEABLE_LOADER } from '../server/market/loader.js';
test('upgradeable-loader instruction encoding matches official bincode discriminants and account order',()=>{
  const authority=Keypair.generate().publicKey,buffer=Keypair.generate().publicKey,program=Keypair.generate().publicKey;
  const init=initializeBuffer(buffer,authority);assert.deepEqual([...init.data],[0,0,0,0]);assert.equal(init.keys[1].isSigner,false);
  const write=writeBuffer(buffer,authority,0x12345678,Buffer.from([3,9,27]));
  assert.equal(write.data.toString('hex'),'0100000078563412030000000000000003091b');assert.equal(write.keys[1].isSigner,true);
  assert.throws(()=>writeBuffer(buffer,authority,-1,Buffer.from([1])));assert.throws(()=>writeBuffer(buffer,authority,0,Buffer.alloc(801)));
  const deploy=deployProgram(authority,program,buffer,authority,1_000_000);
  assert.equal(deploy.data.toString('hex'),'0200000040420f0000000000');
  assert.equal(deploy.keys[1].pubkey.toBase58(),PublicKey.findProgramAddressSync([program.toBuffer()],UPGRADEABLE_LOADER)[0].toBase58());
  assert.equal(deploy.keys[4].pubkey.equals(SYSVAR_RENT_PUBKEY),true);assert.equal(deploy.keys[5].pubkey.equals(SYSVAR_CLOCK_PUBKEY),true);
  assert.equal(deploy.keys[6].pubkey.equals(SystemProgram.programId),true);assert.equal(deploy.keys[7].isSigner,true);
});
test('resume buffer is bound to the operator authority and exact artifact size',()=>{
  const authority=Keypair.generate().publicKey,binary=Buffer.alloc(300),data=Buffer.alloc(337);data.writeUInt32LE(1);data[4]=1;authority.toBuffer().copy(data,5);
  validateBuffer(data,authority,binary);assert.throws(()=>validateBuffer(data,Keypair.generate().publicKey,binary));
  assert.throws(()=>validateBuffer(data,authority,Buffer.alloc(301)));data[4]=0;assert.throws(()=>validateBuffer(data,authority,binary));
});

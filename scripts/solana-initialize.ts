import 'dotenv/config';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { assertDevnet, discriminator } from '../server/market/chain.js';
import { isOutsideDirectory } from '../server/market/key-files.js';
const root=realpathSync(resolve(import.meta.dirname,'..'));
const [authorityPath,registrarAddress]=process.argv.slice(2);
if(!authorityPath||!registrarAddress||!process.env.MARKET_PROGRAM_ID) throw new Error('Usage: bun scripts/solana-initialize.ts EXTERNAL_UPGRADE_KEYPAIR REGISTRAR_PUBKEY [--submit]; MARKET_PROGRAM_ID is required.');
const path=realpathSync(authorityPath);
if(!isAbsolute(authorityPath)||!isOutsideDirectory(root,path)) throw new Error('The operator keypair must remain outside the repository.');
const authority=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path,'utf8'))));
const registrar=new PublicKey(registrarAddress),program=new PublicKey(process.env.MARKET_PROGRAM_ID);
const connection=new Connection(process.env.SOLANA_RPC_URL||'https://api.devnet.solana.com','confirmed');await assertDevnet(connection);
const loader=new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const programdata=PublicKey.findProgramAddressSync([program.toBuffer()],loader)[0];
const data=await connection.getAccountInfo(programdata,'finalized');
if(!data?.owner.equals(loader)||data.data.readUInt32LE(0)!==3||data.data[12]!==1||!data.data.subarray(13,45).equals(authority.publicKey.toBuffer())) throw new Error('ProgramData does not belong to the supplied Devnet upgrade authority.');
const config=PublicKey.findProgramAddressSync([Buffer.from('config')],program)[0];
if(await connection.getAccountInfo(config,'finalized')) throw new Error('The market config already exists; initialization cannot be repeated.');
const tx=new Transaction().add(new TransactionInstruction({programId:program,data:Buffer.concat([discriminator('global','initialize'),registrar.toBuffer()]),keys:[
  {pubkey:authority.publicKey,isSigner:true,isWritable:true},{pubkey:program,isSigner:false,isWritable:false},
  {pubkey:programdata,isSigner:false,isWritable:false},{pubkey:config,isSigner:false,isWritable:true},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false},
]}));
tx.feePayer=authority.publicKey;const latest=await connection.getLatestBlockhash('confirmed');tx.recentBlockhash=latest.blockhash;
if(process.argv.includes('--submit')) {
  tx.sign(authority);const signature=await connection.sendRawTransaction(tx.serialize());
  const result=await connection.confirmTransaction({...latest,signature},'finalized');if(result.value.err) throw new Error('Devnet initialization failed.');
  process.stdout.write(`Config initialized on Devnet: ${config.toBase58()}\nSignature: ${signature}\n`);
}else {
  process.stdout.write(`Prepared only. No transaction sent.\nConfig: ${config.toBase58()}\nTransaction: ${tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64')}\n`);
}

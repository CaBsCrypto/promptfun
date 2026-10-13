import 'dotenv/config';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {Connection,Keypair} from '@solana/web3.js';
import {assertDevnet} from '../server/market/chain.js';
import {isOutsideDirectory} from '../server/market/key-files.js';

const args=process.argv.slice(2),file=args[args.indexOf('--keypaths')+1];
if(!args.includes('--keypaths')||!file)throw new Error('Provide --keypaths pointing to the private local key-path manifest.');
const paths=JSON.parse(readFileSync(file,'utf8')),root=realpathSync(resolve('.'));
const connection=new Connection(process.env.SOLANA_RPC_URL||'https://api.devnet.solana.com','confirmed');
await assertDevnet(connection);
for(const name of ['upgrade','creator','trader']){
 const path=realpathSync(paths[name]);
 if(!isAbsolute(path)||!isOutsideDirectory(root,path))throw new Error('Technical keypairs must remain outside this repository.');
 const publicKey=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path,'utf8')))).publicKey;
 let balance=await connection.getBalance(publicKey,'confirmed');
 console.log(JSON.stringify({cluster:'devnet',role:name,address:publicKey.toBase58(),balance_lamports:String(balance)}));
 if(args.includes('--request')&&balance<2_000_000_000){
  // Only a free Devnet RPC airdrop. No purchase, paid faucet, wallet sweep, or mainnet request.
  const signature=await connection.requestAirdrop(publicKey,2_000_000_000);
  const result=await connection.confirmTransaction(signature,'finalized');
  if(result.value.err)throw new Error('Devnet airdrop failed.');
  balance=await connection.getBalance(publicKey,'finalized');
  console.log(JSON.stringify({cluster:'devnet',role:name,airdrop_signature:signature,balance_lamports:String(balance)}));
 }
}

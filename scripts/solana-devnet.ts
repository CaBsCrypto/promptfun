import 'dotenv/config';
import { readFileSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram, SystemProgram } from '@solana/web3.js';
import { assertDevnet, hash } from '../server/market/chain.js';
import { isOutsideDirectory } from '../server/market/key-files.js';
import { BUFFER_METADATA_SIZE, PROGRAM_METADATA_SIZE, PROGRAMDATA_METADATA_SIZE, UPGRADEABLE_LOADER, initializeBuffer, writeBuffer, deployProgram, validateBuffer } from '../server/market/loader.js';
const root=realpathSync(resolve(import.meta.dirname,'..'));
const args=process.argv.slice(2),option=(name:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
function externalKey(name:string) {
  const supplied=option(name);if(!supplied||!isAbsolute(supplied))throw new Error(`${name} requires an absolute external keypair path.`);
  const path=realpathSync(supplied);
  if(!isOutsideDirectory(root,path))throw new Error('Technical private keys must remain outside the repository.');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path,'utf8'))));
}
const authority=externalKey('--upgrade-keypair'),program=externalKey('--program-keypair');
if(authority.publicKey.equals(program.publicKey))throw new Error('Program and upgrade authority require separate technical keys.');
const artifact=option('--artifact');if(!artifact)throw new Error('--artifact is required.');
const binary=readFileSync(resolve(artifact)),manifest=JSON.parse(readFileSync(resolve(dirname(artifact),'artifact.json'),'utf8'));
if(binary.subarray(0,4).toString('hex')!=='7f454c46'||hash(binary)!==manifest.sha256||manifest.program_id!==program.publicKey.toBase58()||manifest.anchor!=='1.2.1'||manifest.litesvm!=='0.13.1'||manifest.sbf_tests!==3)throw new Error('Artifact, public program ID or tested-build manifest does not match.');
const connection=new Connection(process.env.SOLANA_RPC_URL||'https://api.devnet.solana.com','confirmed');await assertDevnet(connection);
if(await connection.getAccountInfo(program.publicKey,'finalized'))throw new Error('The program address is already deployed. This tool never upgrades or overwrites a program.');
const bufferRent=await connection.getMinimumBalanceForRentExemption(BUFFER_METADATA_SIZE+binary.length);
const programRent=await connection.getMinimumBalanceForRentExemption(PROGRAM_METADATA_SIZE);
const programdataRent=await connection.getMinimumBalanceForRentExemption(PROGRAMDATA_METADATA_SIZE+binary.length);
const feeAllowance=Math.ceil(binary.length/800)*10_000+100_000;
const required=bufferRent+programRent+Math.max(0,programdataRent-bufferRent)+feeAllowance;
const balance=await connection.getBalance(authority.publicKey,'confirmed');
process.stdout.write(JSON.stringify({cluster:'devnet',program_id:program.publicKey.toBase58(),upgrade_authority:authority.publicKey.toBase58(),artifact_sha256:manifest.sha256,bytes:binary.length,required_lamports:String(required),balance_lamports:String(balance),submit:args.includes('--submit')},null,2)+'\n');
if(!args.includes('--submit'))process.exit(0);
const resume=option('--resume-buffer');
if(balance<required&&!resume)throw new Error('Insufficient Devnet SOL. Request a free Devnet faucet explicitly; no airdrop or paid funding is automatic.');
mkdirSync(resolve(root,'.local'),{recursive:true});
async function send(tx:Transaction,signers:Keypair[]) {
  const latest=await connection.getLatestBlockhash('confirmed');tx.feePayer=authority.publicKey;tx.recentBlockhash=latest.blockhash;tx.sign(...signers);
  const raw=tx.serialize(),signature=await connection.sendRawTransaction(raw,{skipPreflight:false,maxRetries:5});
  const result=await connection.confirmTransaction({...latest,signature},'confirmed');
  if(result.value.err)throw new Error(`Devnet transaction failed: ${signature}`);return signature;
}
let buffer:PublicKey;
if(resume)buffer=new PublicKey(resume);
else {
  const pair=Keypair.generate();buffer=pair.publicKey;
  const tx=new Transaction().add(SystemProgram.createAccount({fromPubkey:authority.publicKey,newAccountPubkey:buffer,lamports:bufferRent,space:BUFFER_METADATA_SIZE+binary.length,programId:UPGRADEABLE_LOADER}),initializeBuffer(buffer,authority.publicKey));
  await send(tx,[authority,pair]);
}
const progress=(offset:number,signature?:string)=>writeFileSync(resolve(root,'.local/solana-deployment.json'),JSON.stringify({cluster:'devnet',program_id:program.publicKey.toBase58(),buffer:buffer.toBase58(),offset,artifact_sha256:manifest.sha256,signature:signature||null},null,2));
progress(0);process.stdout.write(`Recoverable public buffer: ${buffer.toBase58()}\n`);
const bufferAccount=await connection.getAccountInfo(buffer,'confirmed');
if(!bufferAccount?.owner.equals(UPGRADEABLE_LOADER))throw new Error('Not an upgradeable-loader buffer.');
validateBuffer(bufferAccount.data,authority.publicKey,binary);
for(let offset=0;offset<binary.length;offset+=800) {
  const chunk=binary.subarray(offset,offset+800);
  if(!bufferAccount.data.subarray(BUFFER_METADATA_SIZE+offset,BUFFER_METADATA_SIZE+offset+chunk.length).equals(chunk))
    await send(new Transaction().add(writeBuffer(buffer,authority.publicKey,offset,chunk)),[authority]);
  progress(Math.min(offset+800,binary.length));
  if(offset%16000===0)process.stdout.write(`Buffer written: ${Math.min(offset+800,binary.length)}/${binary.length} bytes\n`);
}
const written=await connection.getAccountInfo(buffer,'confirmed');
if(!written||hash(written.data.subarray(BUFFER_METADATA_SIZE))!==manifest.sha256)throw new Error('Buffer bytecode hash mismatch. Deployment stopped.');
const tx=new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({units:1_400_000}),
  SystemProgram.createAccount({fromPubkey:authority.publicKey,newAccountPubkey:program.publicKey,lamports:programRent,space:PROGRAM_METADATA_SIZE,programId:UPGRADEABLE_LOADER}),
  deployProgram(authority.publicKey,program.publicKey,buffer,authority.publicKey,binary.length));
const sig=await send(tx,[authority,program]);
const final=await connection.confirmTransaction(sig,'finalized');if(final.value.err)throw new Error('Deployment did not finalize.');
const deployed=await connection.getAccountInfo(program.publicKey,'finalized');
const programdata=PublicKey.findProgramAddressSync([program.publicKey.toBuffer()],UPGRADEABLE_LOADER)[0];
const onchain=await connection.getAccountInfo(programdata,'finalized');
if(!deployed?.executable||!deployed.owner.equals(UPGRADEABLE_LOADER)||!onchain?.owner.equals(UPGRADEABLE_LOADER)||onchain.data[12]!==1||!onchain.data.subarray(13,45).equals(authority.publicKey.toBuffer())||hash(onchain.data.subarray(PROGRAMDATA_METADATA_SIZE))!==manifest.sha256)throw new Error('Finalized deployment bytecode or upgrade authority does not match.');
progress(binary.length,sig);process.stdout.write(`Verified Devnet deployment: ${program.publicKey.toBase58()}\nSignature: ${sig}\n`);

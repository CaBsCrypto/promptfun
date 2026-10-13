/** Standard upgradeable loader-v3 bincode ABI, grounded in solana-loader-v3-interface 6.1.1. */
import { PublicKey, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY, SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';
export const UPGRADEABLE_LOADER=new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
export const BUFFER_METADATA_SIZE=37,PROGRAM_METADATA_SIZE=36,PROGRAMDATA_METADATA_SIZE=45;
function tag(index:number){const data=Buffer.alloc(4);data.writeUInt32LE(index);return data;}
const writable=(pubkey:PublicKey,isSigner=false)=>({pubkey,isSigner,isWritable:true});
const readonly=(pubkey:PublicKey,isSigner=false)=>({pubkey,isSigner,isWritable:false});
export function initializeBuffer(buffer:PublicKey,authority:PublicKey) {
  return new TransactionInstruction({programId:UPGRADEABLE_LOADER,data:tag(0),keys:[writable(buffer),readonly(authority)]});
}
export function writeBuffer(buffer:PublicKey,authority:PublicKey,offset:number,bytes:Buffer) {
  if(!Number.isInteger(offset)||offset<0||offset>0xffffffff||bytes.length>800)throw new Error('Invalid loader write bounds.');
  const data=Buffer.alloc(16+bytes.length);data.writeUInt32LE(1);data.writeUInt32LE(offset,4);data.writeBigUInt64LE(BigInt(bytes.length),8);bytes.copy(data,16);
  return new TransactionInstruction({programId:UPGRADEABLE_LOADER,data,keys:[writable(buffer),readonly(authority,true)]});
}
export function deployProgram(payer:PublicKey,program:PublicKey,buffer:PublicKey,authority:PublicKey,maxBytes:number) {
  if(!Number.isSafeInteger(maxBytes)||maxBytes<=0||maxBytes>10*1024*1024-PROGRAMDATA_METADATA_SIZE)throw new Error('Invalid program length.');
  const data=Buffer.alloc(12);data.writeUInt32LE(2);data.writeBigUInt64LE(BigInt(maxBytes),4);
  const programdata=PublicKey.findProgramAddressSync([program.toBuffer()],UPGRADEABLE_LOADER)[0];
  return new TransactionInstruction({programId:UPGRADEABLE_LOADER,data,keys:[writable(payer,true),writable(programdata),writable(program),writable(buffer),readonly(SYSVAR_RENT_PUBKEY),readonly(SYSVAR_CLOCK_PUBKEY),readonly(SystemProgram.programId),readonly(authority,true)]});
}
export function validateBuffer(data:Buffer,authority:PublicKey,programBytes:Buffer) {
  if(data.length!==BUFFER_METADATA_SIZE+programBytes.length||data.readUInt32LE(0)!==1||data[4]!==1||!data.subarray(5,37).equals(authority.toBuffer()))throw new Error('Buffer owner/authority/length does not match this deployment.');
}

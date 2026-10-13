import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import {resolve,isAbsolute,join} from 'node:path';
import {Keypair} from '@solana/web3.js';
import {isOutsideDirectory} from '../server/market/key-files.js';
const args=process.argv.slice(2),directory=args[args.indexOf('--directory')+1];
if(!args.includes('--directory')||!directory||!isAbsolute(directory))throw new Error('Provide an absolute external --directory for dedicated Devnet technical keys.');
const root=realpathSync(resolve('.')),target=resolve(directory);
if(!isOutsideDirectory(root,target))throw new Error('Private technical keys cannot be created inside this repository.');
if(!args.includes('--initialize'))throw new Error('Use --initialize to prepare dedicated technical Devnet keys; existing keys are never overwritten.');
mkdirSync(target,{recursive:true});const canonical=realpathSync(target);
if(!isOutsideDirectory(root,canonical))throw new Error('External directory resolves inside the repository.');
const paths:Record<string,string>={},publicKeys:Record<string,string>={};
for(const role of ['program','upgrade','registrar','creator','trader']){
 const path=join(canonical,role+'.keypair.json');
 if(!existsSync(path))writeFileSync(path,JSON.stringify([...Keypair.generate().secretKey]),{flag:'wx',mode:0o600});
 const key=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path,'utf8'))));paths[role]=path;publicKeys[role]=key.publicKey.toBase58();
}
if(new Set(Object.values(publicKeys)).size!==5)throw new Error('Technical roles require independent keys.');
mkdirSync('.local',{recursive:true});writeFileSync('.local/devnet-key-paths.json',JSON.stringify(paths,null,2));
console.log(JSON.stringify({cluster:'devnet',public_keys:publicKeys,private_keys:'outside repository; never uploaded to CI'},null,2));

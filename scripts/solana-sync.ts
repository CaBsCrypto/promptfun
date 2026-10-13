import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { Keypair } from '@solana/web3.js';
import { isOutsideDirectory } from '../server/market/key-files.js';
const root=realpathSync(resolve(import.meta.dirname,'..'));
const supplied=process.argv[2];
if(!supplied) throw new Error('Usage: bun scripts/solana-sync.ts ABSOLUTE_EXTERNAL_PROGRAM_KEYPAIR_PATH');
const keyPath=realpathSync(supplied);
if(!isAbsolute(supplied) || !isOutsideDirectory(root,keyPath)) throw new Error('Deployment key must be stored outside the repository.');
const address=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyPath,'utf8')))).publicKey.toBase58();
for(const file of ['Anchor.toml','programs/promptfun-market/src/lib.rs']) {
  const path=resolve(root,file),contents=readFileSync(path,'utf8');
  const updated=file.endsWith('.rs')?contents.replace(/declare_id!\("[1-9A-HJ-NP-Za-km-z]+"\)/,`declare_id!("${address}")`):contents.replace(/promptfun_market = "[1-9A-HJ-NP-Za-km-z]+"/g,`promptfun_market = "${address}"`);
  writeFileSync(path,updated);
}
process.stdout.write(`Public program ID synchronized: ${address}\nNo deployment or transfer was performed.\n`);

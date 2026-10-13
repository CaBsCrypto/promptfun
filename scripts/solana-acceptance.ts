/** Technical Devnet acceptance. No platform DB writes, airdrops or implicit transactions. */
import 'dotenv/config';
import { readFileSync, realpathSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { addresses, assertDevnet, associatedToken, createAta, decodeMarket, DEVNET_GENESIS, discriminator,
  fundingTransaction, hash, registerInstruction, TOKEN_PROGRAM, tradeInstruction, uuidBytes,
  validateCurveVault, validateLockedVault, validateMint, verifyPreparedTransaction } from '../server/market/chain.js';
import { PROGRAMDATA_METADATA_SIZE, UPGRADEABLE_LOADER } from '../server/market/loader.js';
import { CURVE_SUPPLY, integer, QUOTE_SECONDS, quoteTrade, TOTAL_SUPPLY } from '../shared/curve.js';

const root = realpathSync(resolve(import.meta.dirname, '..'));
export class AcceptanceError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
function requireCondition(value: unknown, code: string, message: string): asserts value {
  if (!value) throw new AcceptanceError(code, message);
}
export type AcceptanceOptions = {
  project: string; program: PublicKey; registrarPath: string; creatorPath: string; traderPath: string;
  artifact: string; quantity: bigint; contribution: bigint; rpc: string; submit: boolean;
};
export function parseAcceptanceArgs(args: string[], env: NodeJS.ProcessEnv = process.env): AcceptanceOptions {
  const names = new Set(['--project-id', '--program-id', '--registrar-keypair', '--creator-keypair',
    '--trader-keypair', '--artifact', '--token-units', '--contribution-lamports', '--rpc']);
  const values = new Map<string, string>(); let submit = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--submit') { requireCondition(!submit, 'CLI_INVALID', 'Duplicate --submit.'); submit = true; continue; }
    requireCondition(names.has(flag) && !values.has(flag) && args[i + 1] && !args[i + 1].startsWith('--'),
      'CLI_INVALID', `Unknown, missing or duplicate argument: ${flag}.`);
    values.set(flag, args[++i]);
  }
  const project = values.get('--project-id') || '';
  try { uuidBytes(project); } catch { throw new AcceptanceError('CLI_INVALID', '--project-id requires an explicit project UUID.'); }
  let program: PublicKey;
  try { program = new PublicKey(values.get('--program-id') || env.MARKET_PROGRAM_ID || ''); }
  catch { throw new AcceptanceError('CLI_INVALID', 'Supply --program-id or MARKET_PROGRAM_ID.'); }
  const key = (flag: string) => {
    const value = values.get(flag);
    requireCondition(value && isAbsolute(value), 'CLI_INVALID', `${flag} requires an absolute external technical keypair path.`);
    return value;
  };
  let quantity: bigint, contribution: bigint;
  try {
    quantity = integer(values.get('--token-units') || '1000000000');
    contribution = integer(values.get('--contribution-lamports') || '10000');
    requireCondition(quantity > 0n && quantity <= CURVE_SUPPLY && contribution > 0n, 'CLI_INVALID', 'Amounts must be positive and quantity within the curve.');
    quoteTrade('buy', 0n, quantity);
  } catch { throw new AcceptanceError('CLI_INVALID', 'Use positive decimal base units with a nonzero curve quote.'); }
  const rpc = values.get('--rpc') || env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  try { requireCondition(new URL(rpc).protocol === 'https:', 'CLI_INVALID', 'The public Devnet RPC must use HTTPS.'); }
  catch { throw new AcceptanceError('CLI_INVALID', 'The public Devnet RPC must use HTTPS.'); }
  return { project, program, registrarPath: key('--registrar-keypair'), creatorPath: key('--creator-keypair'),
    traderPath: key('--trader-keypair'), artifact: resolve(values.get('--artifact') || '.local/solana-artifacts/promptfun_market.so'),
    quantity, contribution, rpc, submit };
}
function externalKey(path: string) {
  try {
    const canonical = realpathSync(path), inside = relative(root, canonical);
    requireCondition(isAbsolute(path) && (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)), 'KEYS_NOT_ISOLATED', 'Technical keypairs must be outside the repository.');
    const bytes: unknown = JSON.parse(readFileSync(canonical, 'utf8'));
    requireCondition(Array.isArray(bytes) && bytes.length === 64 && bytes.every(b => Number.isInteger(b) && b >= 0 && b <= 255), 'KEY_INVALID', 'Invalid technical keypair.');
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch (error) {
    if (error instanceof AcceptanceError) throw error;
    throw new AcceptanceError('KEY_INVALID', 'Could not read a valid external technical keypair.');
  }
}
type Actors = { creator: PublicKey; trader: PublicKey; registrar: PublicKey };
type MarketSnapshot = {
  sold: string; reserve_lamports: string; market_lamports: string; curve_units: string; locked_units: string;
  trader_units: string; mint_supply: string; mint_authority: null; freeze_authority: null; decimals: 6;
};
async function marketSnapshot(connection: Connection, program: PublicKey, project: string, actors: Actors): Promise<MarketSnapshot | null> {
  const a = addresses(program, actors.creator, project);
  const accounts = await connection.getMultipleAccountsInfo([a.market, a.mint, a.locked, a.curve,
    associatedToken(actors.trader, a.mint)], 'finalized');
  if (!accounts[0]) {
    requireCondition(accounts.slice(1).every(account => !account), 'MARKET_INVALID', 'Orphan mint, vault or trader account at the project addresses.');
    return null;
  }
  requireCondition(accounts[0].owner.equals(program), 'MARKET_INVALID', 'Market is owned by a different program.');
  const state = decodeMarket(accounts[0].data);
  requireCondition(state.creator.equals(actors.creator) && state.project.equals(uuidBytes(project)) && state.mint.equals(a.mint) &&
    state.curve.equals(a.curve) && state.locked.equals(a.locked), 'MARKET_INVALID', 'Market PDA, owner or project binding differs.');
  const mint = accounts[1], locked = accounts[2], curve = accounts[3];
  requireCondition(mint && locked && curve && mint.owner.equals(TOKEN_PROGRAM) && locked.owner.equals(TOKEN_PROGRAM) && curve.owner.equals(TOKEN_PROGRAM),
    'MARKET_INVALID', 'Mint and vaults must use the classic SPL Token program.');
  validateMint(mint.data); validateLockedVault(locked.data, a.mint, a.market);
  validateCurveVault(curve.data, a.mint, a.market, state.sold);
  const rent = await connection.getMinimumBalanceForRentExemption(accounts[0].data.length, 'finalized');
  requireCondition(BigInt(accounts[0].lamports) >= BigInt(rent) + state.reserve, 'MARKET_INVALID', 'SOL vault does not retain rent plus reserves.');
  let traderUnits = 0n;
  if (accounts[4]) {
    const account = accounts[4];
    requireCondition(account.owner.equals(TOKEN_PROGRAM) && account.data.length === 165 && account.data.subarray(0, 32).equals(a.mint.toBuffer()) &&
      account.data.subarray(32, 64).equals(actors.trader.toBuffer()) && account.data[108] === 1 && account.data.readUInt32LE(72) === 0 &&
      account.data.readUInt32LE(109) === 0 && account.data.readUInt32LE(129) === 0, 'MARKET_INVALID', 'Invalid trader associated token account.');
    traderUnits = account.data.readBigUInt64LE(64);
  }
  return { sold: state.sold.toString(), reserve_lamports: state.reserve.toString(), market_lamports: String(accounts[0].lamports),
    curve_units: curve.data.readBigUInt64LE(64).toString(), locked_units: locked.data.readBigUInt64LE(64).toString(),
    trader_units: traderUnits.toString(), mint_supply: TOTAL_SUPPLY.toString(), mint_authority: null, freeze_authority: null, decimals: 6 };
}
type Artifact = { binary: Buffer; sha256: string; source_commit: string };
function readArtifact(options: AcceptanceOptions): Artifact {
  try {
    const binary = readFileSync(options.artifact), manifest = JSON.parse(readFileSync(resolve(dirname(options.artifact), 'artifact.json'), 'utf8'));
    const idl = JSON.parse(readFileSync(resolve(dirname(options.artifact), 'promptfun_market.json'), 'utf8'));
    requireCondition(binary.subarray(0, 4).toString('hex') === '7f454c46' && hash(binary) === manifest.sha256 &&
      manifest.program_id === options.program.toBase58() && idl.address === options.program.toBase58() &&
      manifest.anchor === '1.2.1' && manifest.litesvm === '0.13.1' && manifest.sbf_tests === 3 && manifest.rust_math_tests === 3 &&
      /^[a-f0-9]{40}$/.test(manifest.source_commit), 'ARTIFACT_INVALID', 'Artifact ID, SHA, IDL or three math/SBF test proofs do not match.');
    return { binary, sha256: manifest.sha256, source_commit: manifest.source_commit };
  } catch (error) {
    if (error instanceof AcceptanceError) throw error;
    throw new AcceptanceError('ARTIFACT_INVALID', 'Could not read a verified SBF artifact, IDL and manifest.');
  }
}
export type Readiness = {
  ready: boolean; blockers: string[]; deployed: boolean; config_initialized: boolean; upgrade_authority: string | null;
  balances_lamports: Record<'creator' | 'trader' | 'registrar', string>;
  minimum_lamports: { creator: string; trader: string }; market: MarketSnapshot | null;
};
/** Only finalized RPC reads. In particular, this function has no signing or submission path. */
export async function inspectAcceptance(connection: Connection, options: AcceptanceOptions, actors: Actors, artifact: Artifact): Promise<Readiness> {
  await assertDevnet(connection);
  const a = addresses(options.program, actors.creator, options.project);
  const programdata = PublicKey.findProgramAddressSync([options.program.toBuffer()], UPGRADEABLE_LOADER)[0];
  const [programAccount, data, config, creator, trader, registrar] = await connection.getMultipleAccountsInfo(
    [options.program, programdata, a.config, actors.creator, actors.trader, actors.registrar], 'finalized');
  for (const account of [creator, trader, registrar]) requireCondition(!account || (account.owner.equals(SystemProgram.programId) && account.data.length === 0),
    'KEYS_NOT_ISOLATED', 'Technical signers must be ordinary system wallets.');
  const blockers: string[] = []; let authority: string | null = null;
  if (!programAccount) {
    requireCondition(!data && !config, 'PROGRAM_INVALID', 'ProgramData or config exists without its program.');
    blockers.push('PROGRAM_NOT_DEPLOYED');
  } else {
    requireCondition(programAccount.executable && programAccount.owner.equals(UPGRADEABLE_LOADER) && programAccount.data.length === 36 &&
      programAccount.data.readUInt32LE(0) === 2 && programAccount.data.subarray(4).equals(programdata.toBuffer()), 'PROGRAM_INVALID', 'Invalid upgradeable program account.');
    requireCondition(data && data.owner.equals(UPGRADEABLE_LOADER) && data.data.length === PROGRAMDATA_METADATA_SIZE + artifact.binary.length &&
      data.data.readUInt32LE(0) === 3 && data.data[12] === 1 && hash(data.data.subarray(PROGRAMDATA_METADATA_SIZE)) === artifact.sha256,
      'PROGRAM_INVALID', 'Finalized bytecode or upgradeable ProgramData differs from the tested artifact.');
    authority = new PublicKey(data.data.subarray(13, 45)).toBase58();
    requireCondition(!Object.values(actors).some(actor => actor.toBase58() === authority), 'KEYS_NOT_ISOLATED', 'Upgrade, registrar, creator and trader roles must be separate.');
  }
  if (!config) blockers.push('CONFIG_NOT_INITIALIZED');
  else {
    const bump = PublicKey.findProgramAddressSync([Buffer.from('config')], options.program)[1];
    requireCondition(config.owner.equals(options.program) && config.data.length === 74 && config.data.subarray(0, 8).equals(discriminator('account', 'MarketConfig')) &&
      new PublicKey(config.data.subarray(8, 40)).toBase58() === authority && config.data.subarray(40, 72).equals(actors.registrar.toBuffer()) && config.data[73] === bump,
      'CONFIG_INVALID', 'Config authority, registrar or PDA does not match the isolated deployment.');
    if (config.data[72] !== 0) blockers.push('MARKET_PAUSED');
  }
  const market = await marketSnapshot(connection, options.program, options.project, actors);
  if (market) blockers.push('PROJECT_ALREADY_REGISTERED');
  const rent = await Promise.all([169, 82, 165].map(size => connection.getMinimumBalanceForRentExemption(size, 'finalized')));
  // Conservative base-signature fee allowance; actual messages are priced again immediately before sending.
  const creatorMinimum = BigInt(rent[0] + rent[1] + 2 * rent[2]) + 100_000n;
  const traderMinimum = quoteTrade('buy', 0n, options.quantity) + BigInt(rent[2]) + options.contribution + 150_000n;
  const balances = { creator: String(creator?.lamports || 0), trader: String(trader?.lamports || 0), registrar: String(registrar?.lamports || 0) };
  if (BigInt(balances.creator) < creatorMinimum) blockers.push('CREATOR_INSUFFICIENT_DEVNET_SOL');
  if (BigInt(balances.trader) < traderMinimum) blockers.push('TRADER_INSUFFICIENT_DEVNET_SOL');
  return { ready: blockers.length === 0, blockers, deployed: !!programAccount, config_initialized: !!config, upgrade_authority: authority,
    balances_lamports: balances, minimum_lamports: { creator: creatorMinimum.toString(), trader: traderMinimum.toString() }, market };
}
type Proof = { kind: string; message_hash: string; required_signers: string[]; ix_index: number;
  signature: string | null; finalized: boolean; slot?: number; fee_lamports?: string; snapshot?: MarketSnapshot };
type Evidence = { scope: string; mode: 'dry_run' | 'submit'; status: string; sent: boolean; cluster: 'devnet'; genesis_hash?: string;
  program_id: string; project_id: string; addresses: Record<string, string>; actors: Record<string, string>;
  artifact_sha256: string; source_commit: string; token_units: string; contribution_lamports: string;
  started_at: string; readiness?: Readiness; operations: Proof[]; error?: { code: string; message: string } };
function publicFailure(error: unknown) {
  return error instanceof AcceptanceError ? { code: error.code, message: error.message } :
    { code: 'RPC_OR_VERIFICATION_FAILED', message: 'RPC, account decoding or verification failed. No success is asserted; inspect any recorded signature before retrying.' };
}
function balanceChange(tx: any, account: PublicKey): bigint {
  const keys: PublicKey[] = tx.transaction.message.staticAccountKeys ?? tx.transaction.message.accountKeys;
  const index = keys.findIndex(key => key.equals(account));
  requireCondition(index >= 0 && Number.isSafeInteger(tx.meta.preBalances[index]) && Number.isSafeInteger(tx.meta.postBalances[index]),
    'TRANSACTION_MISMATCH', 'Missing exact account balance metadata.');
  return BigInt(tx.meta.postBalances[index]) - BigInt(tx.meta.preBalances[index]);
}
function exactSnapshot(snapshot: MarketSnapshot | null, quantity: bigint, reserve: bigint, trader: bigint) {
  requireCondition(snapshot && snapshot.sold === quantity.toString() && snapshot.reserve_lamports === reserve.toString() &&
    snapshot.curve_units === (CURVE_SUPPLY - quantity).toString() && snapshot.trader_units === trader.toString(),
    'STATE_MISMATCH', 'Finalized market or token balances differ from the exact curve operation.');
  return snapshot;
}
export async function runAcceptance(options: AcceptanceOptions) {
  const keys = { registrar: externalKey(options.registrarPath), creator: externalKey(options.creatorPath), trader: externalKey(options.traderPath) };
  const actors = { registrar: keys.registrar.publicKey, creator: keys.creator.publicKey, trader: keys.trader.publicKey };
  requireCondition(new Set([...Object.values(actors), options.program].map(key => key.toBase58())).size === 4,
    'KEYS_NOT_ISOLATED', 'Program, registrar, creator and trader must have separate technical keys.');
  const artifact = readArtifact(options), a = addresses(options.program, actors.creator, options.project);
  const evidence: Evidence = { scope: 'Chain-only technical acceptance; no platform project, auth, inference or SQL ledger is exercised.',
    mode: options.submit ? 'submit' : 'dry_run', status: 'checking', sent: false, cluster: 'devnet', program_id: options.program.toBase58(),
    project_id: options.project, actors: Object.fromEntries(Object.entries(actors).map(([role, key]) => [role, key.toBase58()])),
    addresses: Object.fromEntries(Object.entries(a).map(([role, key]) => [role, key.toBase58()])),
    artifact_sha256: artifact.sha256, source_commit: artifact.source_commit, token_units: options.quantity.toString(),
    contribution_lamports: options.contribution.toString(), started_at: new Date().toISOString(), operations: [] };
  mkdirSync(resolve(root, '.local'), { recursive: true });
  const local = realpathSync(resolve(root, '.local')), inside = relative(root, local);
  requireCondition(inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside), 'OUTPUT_INVALID', '.local must remain inside the repository.');
  const evidencePath = resolve(local, `solana-acceptance-${options.project}-${Date.now()}.json`);
  const save = () => { writeFileSync(`${evidencePath}.tmp`, JSON.stringify(evidence, null, 2) + '\n'); renameSync(`${evidencePath}.tmp`, evidencePath); };
  const boundedFetch: typeof fetch = (input, init) => fetch(input, { ...init,
    signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(init?.signal ? [init.signal] : [])]) });
  const connection = new Connection(options.rpc, { commitment: 'finalized', fetch: boundedFetch, disableRetryOnRateLimit: true });
  try {
    evidence.readiness = await inspectAcceptance(connection, options, actors, artifact);
    evidence.genesis_hash = DEVNET_GENESIS;
    if (!options.submit) { evidence.status = 'dry_run'; save(); return { evidence, evidencePath }; }
    requireCondition(evidence.readiness.ready, 'NOT_READY', `Submission refused: ${evidence.readiness.blockers.join(', ')}.`);
    const send = async (kind: string, tx: Transaction, signers: Keypair[], ixIndex: number) => {
      await assertDevnet(connection);
      const latest = await connection.getLatestBlockhash('confirmed');
      tx.feePayer = signers[0].publicKey; tx.recentBlockhash = latest.blockhash;
      const fee = (await connection.getFeeForMessage(tx.compileMessage(), 'confirmed')).value;
      requireCondition(fee !== null && Number.isSafeInteger(fee), 'FEE_UNKNOWN', 'Cannot verify the transaction fee.');
      requireCondition(await connection.getBalance(signers[0].publicKey, 'confirmed') >= fee, 'NOT_READY', 'Fee payer has insufficient Devnet SOL.');
      const proof: Proof = { kind, message_hash: hash(tx.serializeMessage()), required_signers: signers.map(key => key.publicKey.toBase58()),
        ix_index: ixIndex, signature: null, finalized: false };
      evidence.operations.push(proof); evidence.status = 'partial'; save();
      tx.sign(...signers);
      // No retries with a fresh message after an unknown result. Preserve the exact prepared hash for recovery.
      evidence.sent = true; save();
      proof.signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 0 }); save();
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        const found = await connection.getTransaction(proof.signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0 });
        if (found) {
          requireCondition(signers.every(key => verifyPreparedTransaction(found, proof.message_hash, key.publicKey.toBase58())),
            'TRANSACTION_MISMATCH', 'Finalized transaction failed or differs from the prepared message and required signers.');
          requireCondition(found.meta && found.meta.fee === fee, 'TRANSACTION_MISMATCH', 'Finalized fee differs from the prepared message fee.');
          proof.finalized = true; proof.slot = found.slot; proof.fee_lamports = String(found.meta.fee); save();
          return { tx: found, proof };
        }
        await delay(1_000);
      }
      throw new AcceptanceError('FINALIZATION_PENDING', 'The transaction is not yet proven finalized. Inspect its recorded signature before any retry.');
    };
    const registered = await send('register', new Transaction().add(registerInstruction(options.program, actors.creator, actors.registrar, options.project)),
      [keys.creator, keys.registrar], 0);
    let snapshot = exactSnapshot(await marketSnapshot(connection, options.program, options.project, actors), 0n, 0n, 0n);
    registered.proof.snapshot = snapshot; save();
    const chainExpiry = async () => {
      const time = await connection.getBlockTime(await connection.getSlot('finalized'));
      requireCondition(time !== null && Number.isSafeInteger(time), 'CLOCK_UNAVAILABLE', 'Cannot determine a finalized Devnet block time.');
      return BigInt(time + QUOTE_SECONDS);
    };
    const price = quoteTrade('buy', 0n, options.quantity);
    const purchased = await send('buy', new Transaction().add(createAta(actors.trader, a.mint),
      tradeInstruction(options.program, actors.creator, options.project, actors.trader, 'buy', options.quantity, price, await chainExpiry())), [keys.trader], 1);
    const bought = exactSnapshot(await marketSnapshot(connection, options.program, options.project, actors), options.quantity, price, options.quantity);
    requireCondition(BigInt(bought.market_lamports) - BigInt(snapshot.market_lamports) === price && balanceChange(purchased.tx, a.market) === price &&
      balanceChange(purchased.tx, actors.trader) === -price - BigInt(purchased.tx.meta!.fee) - balanceChange(purchased.tx, associatedToken(actors.trader, a.mint)),
      'STATE_MISMATCH', 'Purchase SOL must enter only the market vault.');
    purchased.proof.snapshot = bought; snapshot = bought; save();
    const refund = quoteTrade('sell', options.quantity, options.quantity);
    const sold = await send('sell', new Transaction().add(createAta(actors.trader, a.mint),
      tradeInstruction(options.program, actors.creator, options.project, actors.trader, 'sell', options.quantity, refund, await chainExpiry())), [keys.trader], 1);
    const emptied = exactSnapshot(await marketSnapshot(connection, options.program, options.project, actors), 0n, 0n, 0n);
    requireCondition(BigInt(snapshot.market_lamports) - BigInt(emptied.market_lamports) === refund && balanceChange(sold.tx, a.market) === -refund &&
      balanceChange(sold.tx, actors.trader) === refund - BigInt(sold.tx.meta!.fee), 'STATE_MISMATCH', 'Sale must return the full curve refund, excluding only the network fee.');
    sold.proof.snapshot = emptied; save();
    const contributed = await send('contribution', fundingTransaction(actors.trader, actors.creator, options.contribution, randomUUID()), [keys.trader], 0);
    const final = exactSnapshot(await marketSnapshot(connection, options.program, options.project, actors), 0n, 0n, 0n);
    requireCondition(JSON.stringify(final) === JSON.stringify(emptied) && balanceChange(contributed.tx, actors.creator) === options.contribution &&
      balanceChange(contributed.tx, actors.trader) === -options.contribution - BigInt(contributed.tx.meta!.fee),
      'STATE_MISMATCH', 'Voluntary contribution must reach the creator wallet without changing tokens or the SOL market vault.');
    contributed.proof.snapshot = final; evidence.status = 'completed'; save();
    return { evidence, evidencePath };
  } catch (error) {
    evidence.status = evidence.sent ? 'partial_or_failed' : 'blocked'; evidence.error = publicFailure(error); save();
    process.stderr.write(`${evidence.error.code}: ${evidence.error.message}\nEvidence: ${evidencePath}\n`); throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runAcceptance(parseAcceptanceArgs(process.argv.slice(2)));
    process.stdout.write(JSON.stringify({ ...result.evidence, evidence_path: result.evidencePath }, null, 2) + '\n');
  } catch (error) { const failure = publicFailure(error); process.stderr.write(`${failure.code}: ${failure.message}\n`); process.exitCode = 1; }
}

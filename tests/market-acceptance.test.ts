import test from 'node:test';
import assert from 'node:assert/strict';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { AcceptanceError, inspectAcceptance, parseAcceptanceArgs } from '../scripts/solana-acceptance.js';
import { addresses, DEVNET_GENESIS, discriminator, hash } from '../server/market/chain.js';
import { UPGRADEABLE_LOADER } from '../server/market/loader.js';

// RPC responses below are unit-test doubles. They do not prove a deployment or live Devnet trades.
const key = (byte: number) => new PublicKey(Uint8Array.from({ length: 32 }, () => byte));
const actors = { creator: key(1), trader: key(2), registrar: key(3) };
const program = key(4), authority = key(5), project = '12345678-1234-1234-1234-123456789abc';
const artifact = { binary: Buffer.from('test-only-bytecode'), sha256: hash(Buffer.from('test-only-bytecode')), source_commit: 'a'.repeat(40) };
const options = { project, program, creatorPath: '/test-only/creator', traderPath: '/test-only/trader', registrarPath: '/test-only/registrar',
  artifact: '/test-only/artifact', quantity: 1_000_000_000n, contribution: 10_000n, rpc: 'https://api.devnet.solana.com', submit: false };
function fixture(deployed = false) {
  const accounts = new Map<string, any>(), reads: string[] = [];
  const a = addresses(program, actors.creator, project);
  const programdata = PublicKey.findProgramAddressSync([program.toBuffer()], UPGRADEABLE_LOADER)[0];
  const account = (owner: PublicKey, data: Buffer, lamports = 10_000_000, executable = false) => ({ owner, data, lamports, executable, rentEpoch: 0 });
  if (deployed) {
    const programBytes = Buffer.alloc(36); programBytes.writeUInt32LE(2); programdata.toBuffer().copy(programBytes, 4);
    const data = Buffer.alloc(45 + artifact.binary.length); data.writeUInt32LE(3); data[12] = 1;
    authority.toBuffer().copy(data, 13); artifact.binary.copy(data, 45);
    const config = Buffer.alloc(74); discriminator('account', 'MarketConfig').copy(config);
    authority.toBuffer().copy(config, 8); actors.registrar.toBuffer().copy(config, 40);
    config[73] = PublicKey.findProgramAddressSync([Buffer.from('config')], program)[1];
    accounts.set(program.toBase58(), account(UPGRADEABLE_LOADER, programBytes, 10_000_000, true));
    accounts.set(programdata.toBase58(), account(UPGRADEABLE_LOADER, data));
    accounts.set(a.config.toBase58(), account(program, config));
    for (const actor of Object.values(actors)) accounts.set(actor.toBase58(), account(SystemProgram.programId, Buffer.alloc(0)));
  }
  const connection = {
    getGenesisHash: async () => { reads.push('genesis'); return DEVNET_GENESIS; },
    getMultipleAccountsInfo: async (keys: PublicKey[], commitment: string) => {
      assert.equal(commitment, 'finalized'); reads.push('accounts'); return keys.map(key => accounts.get(key.toBase58()) || null);
    },
    getMinimumBalanceForRentExemption: async (_size: number, commitment: string) => {
      assert.equal(commitment, 'finalized'); reads.push('rent'); return 1_000_000;
    },
    sendRawTransaction: async () => { assert.fail('Readiness must never submit a transaction.'); },
    requestAirdrop: async () => { assert.fail('Acceptance must never fund a wallet.'); },
  } as unknown as Connection;
  return { accounts, reads, connection, a, programdata };
}

test('acceptance is dry by default and rejects implicit/ambiguous submission arguments', () => {
  const external = process.platform === 'win32' ? 'C:\\test-only\\keypair.json' : '/test-only/keypair.json';
  const args = ['--project-id', project, '--program-id', program.toBase58(), '--creator-keypair', external,
    '--trader-keypair', external, '--registrar-keypair', external];
  assert.equal(parseAcceptanceArgs(args, {}).submit, false);
  assert.equal(parseAcceptanceArgs([...args, '--submit'], {}).submit, true);
  assert.throws(() => parseAcceptanceArgs([...args, '--submit', '--submit'], {}), AcceptanceError);
  assert.throws(() => parseAcceptanceArgs([...args, '--airdrop'], {}), AcceptanceError);
  assert.throws(() => parseAcceptanceArgs([...args, '--token-units', '0'], {}), AcceptanceError);
  assert.throws(() => parseAcceptanceArgs(args.slice(2), {}), AcceptanceError);
});

test('read-only acceptance records missing deployment/configuration/zero balances without success', async () => {
  const f = fixture();
  const result = await inspectAcceptance(f.connection, options, actors, artifact);
  assert.equal(result.ready, false); assert.equal(result.deployed, false); assert.equal(result.market, null);
  assert.deepEqual(result.blockers, ['PROGRAM_NOT_DEPLOYED', 'CONFIG_NOT_INITIALIZED',
    'CREATOR_INSUFFICIENT_DEVNET_SOL', 'TRADER_INSUFFICIENT_DEVNET_SOL']);
  assert.deepEqual(result.balances_lamports, { creator: '0', trader: '0', registrar: '0' });
  assert.equal(result.upgrade_authority, null);
  assert.deepEqual(f.reads, ['genesis', 'accounts', 'accounts', 'rent', 'rent', 'rent']);
});

test('readiness validates finalized bytecode, isolated authority, registrar and rent budget', async () => {
  const f = fixture(true), result = await inspectAcceptance(f.connection, options, actors, artifact);
  assert.equal(result.ready, true); assert.deepEqual(result.blockers, []);
  assert.equal(result.upgrade_authority, authority.toBase58());
  assert.equal(result.minimum_lamports.creator, '4100000');
  assert.equal(result.config_initialized, true);
  f.accounts.get(f.a.config.toBase58()).data[72] = 1;
  assert.deepEqual((await inspectAcceptance(f.connection, options, actors, artifact)).blockers, ['MARKET_PAUSED']);
});

test('readiness fails closed on a bytecode substitution or registrar mismatch', async () => {
  const f = fixture(true);
  f.accounts.get(f.programdata.toBase58()).data[45] ^= 1;
  await assert.rejects(inspectAcceptance(f.connection, options, actors, artifact), (error: unknown) =>
    error instanceof AcceptanceError && error.code === 'PROGRAM_INVALID');
  const g = fixture(true); key(6).toBuffer().copy(g.accounts.get(g.a.config.toBase58()).data, 40);
  await assert.rejects(inspectAcceptance(g.connection, options, actors, artifact), (error: unknown) =>
    error instanceof AcceptanceError && error.code === 'CONFIG_INVALID');
});

test('a non-Devnet genesis is rejected before accounts are accessed', async () => {
  const f = fixture(); f.connection.getGenesisHash = async () => 'mainnet-or-local-test-genesis';
  await assert.rejects(inspectAcceptance(f.connection, options, actors, artifact), /no es Solana Devnet/);
  assert.deepEqual(f.reads, []);
});

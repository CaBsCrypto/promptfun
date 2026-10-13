import { Connection, PublicKey, SendTransactionError, Transaction } from '@solana/web3.js';

export type WalletName = 'phantom' | 'solflare';
export interface WalletProvider {
  isPhantom?: boolean;
  publicKey: PublicKey | null;
  connect(): Promise<{ publicKey: PublicKey } | void>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, display?: 'utf8'): Promise<{ signature: Uint8Array } | Uint8Array>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  on?(event: 'accountChanged' | 'disconnect', listener: (...args: unknown[]) => void): void;
  removeListener?(event: 'accountChanged' | 'disconnect', listener: (...args: unknown[]) => void): void;
}
export type PhantomProvider = WalletProvider;

export const devnetConnection = new Connection('https://api.devnet.solana.com', 'confirmed');

export function phantomProvider(): PhantomProvider {
  const host = window as unknown as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  const provider = host.phantom?.solana ?? host.solana;
  if (!provider?.isPhantom) throw new Error('Instala o abre Phantom para conectar una wallet Solana.');
  return provider;
}

let solflareProvider: Promise<WalletProvider> | undefined;
export async function getWalletProvider(name: WalletName): Promise<WalletProvider> {
  if (name === 'phantom') return phantomProvider();
  if (name !== 'solflare') throw new Error('Wallet Solana no compatible.');
  // Load the official SDK only after the user chooses Solflare. It handles
  // extension/web/mobile connection without a platform custody key.
  if (!solflareProvider) solflareProvider = import('@solflare-wallet/sdk').then(({default: Solflare}) => {
    const sdk = new Solflare({network:'devnet'});
    return {
      get publicKey() { return sdk.publicKey; },
      connect: () => sdk.connect(), disconnect: () => sdk.disconnect(),
      signMessage: (message, display) => sdk.signMessage(message, display),
      signTransaction: async transaction => {
        const signed = await sdk.signTransaction(transaction);
        if (!(signed instanceof Transaction)) throw new Error('La wallet devolvió una transacción incompatible.');
        return signed;
      },
      on: (event, listener) => { sdk.on(event, listener); },
      removeListener: (event, listener) => { sdk.removeListener(event, listener); },
    } satisfies WalletProvider;
  }).catch(error => { solflareProvider = undefined; throw error; });
  return solflareProvider;
}

export async function connectWallet(name: WalletName) {
  const provider = await getWalletProvider(name);
  await provider.connect();
  if (!provider.publicKey) throw new Error('La wallet no autorizó la conexión.');
  return {provider, address:provider.publicKey.toBase58()};
}

export async function signWalletMessage(provider: WalletProvider, message: string, expectedAddress: string): Promise<string> {
  if (provider.publicKey?.toBase58() !== expectedAddress) throw new Error('La wallet cambió. Conéctala de nuevo.');
  const signed = await provider.signMessage(new TextEncoder().encode(message), 'utf8');
  if (provider.publicKey?.toBase58() !== expectedAddress) throw new Error('La wallet cambió durante la firma.');
  const signature = signed instanceof Uint8Array ? signed : signed.signature;
  if (!(signature instanceof Uint8Array) || signature.byteLength !== 64) throw new Error('La wallet devolvió una firma de mensaje inválida.');
  return bytesToBase64(signature);
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}

function bytesToBase58(bytes: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let encoded = '';
  while (value > 0n) { encoded = alphabet[Number(value % 58n)] + encoded; value /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; encoded = '1' + encoded; }
  return encoded;
}

export async function connectPhantom() {
  return connectWallet('phantom');
}

export async function signDevnetTransaction(encoded: string, expectedAddress: string, onSigned?: (signature: string, status: 'pending' | 'failed') => void, provider: WalletProvider = phantomProvider()): Promise<string> {
  if (provider.publicKey?.toBase58() !== expectedAddress) {
    throw new Error('La wallet cambió. Conéctala de nuevo y revisa la operación.');
  }
  const transaction = Transaction.from(Uint8Array.from(atob(encoded), char => char.charCodeAt(0)));
  if (transaction.feePayer?.toBase58() !== expectedAddress) throw new Error('La transacción no corresponde a esta wallet.');
  const signed = await provider.signTransaction(transaction);
  if (provider.publicKey?.toBase58() !== expectedAddress) throw new Error('La wallet cambió durante la firma.');
  const serialized = signed.serialize();
  if (!signed.signature) throw new Error('La wallet no devolvió la firma del pagador.');
  const expectedSignature = bytesToBase58(signed.signature);
  onSigned?.(expectedSignature, 'pending');
  let sent: string;
  try { sent = await devnetConnection.sendRawTransaction(serialized, { skipPreflight: false, maxRetries: 2 }); }
  catch (error) {
    if (error instanceof SendTransactionError && error.message.startsWith('Simulation failed.')) {
      onSigned?.(expectedSignature, 'failed');
      throw new Error(`Solana rechazó la simulación; la operación no se envió: ${error.transactionError.message}`);
    }
    throw error;
  }
  if (sent !== expectedSignature) throw new Error('La red devolvió una firma diferente. Comprueba el resultado antes de repetir.');
  return sent;
}

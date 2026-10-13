import type { Session } from '../../../shared/contracts';
import type { WalletName } from '../../lib/wallet';
import { api } from '../../lib/api';

export async function authenticateWallet(name: WalletName, mode: 'login' | 'link'): Promise<Session> {
  const { connectWallet, signWalletMessage } = await import('../../lib/wallet');
  const { provider, address } = await connectWallet(name);
  const challenge = await api<{ challenge_id: string; message: string }>('/auth/wallet/challenge', {
    method: 'POST', body: { address, mode },
  });
  const signature = await signWalletMessage(provider, challenge.message, address);
  await api<Session>('/auth/wallet/verify', { method: 'POST', body: { challenge_id: challenge.challenge_id, signature } });
  const session = await api<Session>('/session');
  if (!session.user) throw new Error('No se abrió la sesión. Vuelve a firmar para entrar.');
  return session;
}

export function shortWallet(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

import { useCallback, useEffect, useState } from 'react';
import type { PlatformUser, Session } from '../../../shared/contracts';
import type { WalletName } from '../../lib/wallet';
import { api, errorMessage, isAbort } from '../../lib/api';
import { authenticateWallet, shortWallet } from './walletAuth';
import { ErrorNotice, Loading } from '../ui';

interface Credential { address: string; created_at: string }

export function WalletAccess({ user, onAuthenticated, onClose }: {
  user: PlatformUser; onAuthenticated: (session: Session) => void; onClose: () => void;
}) {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const result = await api<{ credential: Credential | null }>('/auth/wallet', { signal });
      if (!signal?.aborted) setCredential(result.credential);
    } catch (cause) { if (!isAbort(cause)) setError(errorMessage(cause)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController(); void load(controller.signal);
    return () => controller.abort();
  }, [user.id, load]);

  async function link(name: WalletName) {
    setBusy(true); setError(null); setNotice(null);
    try {
      onAuthenticated(await authenticateWallet(name, 'link'));
      await load(); setNotice('Acceso con wallet vinculado. Puedes usarlo para entrar a esta misma cuenta.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function unlink() {
    setBusy(true); setError(null); setNotice(null);
    try {
      await api('/auth/wallet', { method: 'DELETE' });
      onAuthenticated(await api<Session>('/session'));
      setCredential(null); setNotice('Acceso con wallet desvinculado. Puedes seguir entrando con tu correo.');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <section id="wallet-access" className="wallet-access" aria-labelledby="wallet-access-title">
    <div className="wallet-access-heading"><h2 id="wallet-access-title">Acceso con wallet</h2><button className="text-button" onClick={onClose} disabled={busy}>Cerrar</button></div>
    <p className="muted">Firma un mensaje para demostrar que la wallet es tuya. No envía transacciones ni requiere SOL. Este acceso es independiente de la wallet de un proyecto y de OpenRouter.</p>
    {loading ? <Loading>Consultando tus métodos de acceso…</Loading> : credential ? <>
      <p className="wallet-access-address" title={credential.address}>Wallet vinculada: <strong>{shortWallet(credential.address)}</strong></p>
      {user.email ? <button className="button button-secondary" onClick={unlink} disabled={busy}>{busy ? 'Procesando…' : 'Desvincular acceso con wallet'}</button> : <p className="field-hint">La wallet es tu único método de acceso; no se puede desvincular para evitar perder la cuenta.</p>}
    </> : !error ? <div className="wallet-auth-actions"><button className="button button-secondary" disabled={busy} onClick={() => void link('phantom')}>Vincular Phantom</button><button className="button button-secondary" disabled={busy} onClick={() => void link('solflare')}>Vincular Solflare</button></div> : null}
    {busy && <Loading>Procesando el acceso…</Loading>}
    {notice && <p className="notice notice-info" role="status">{notice}</p>}
    <ErrorNotice message={error} onRetry={busy ? undefined : () => void load()} />
  </section>;
}

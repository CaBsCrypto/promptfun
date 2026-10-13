import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Wallet } from 'lucide-react';
import type { Market, Project } from '../../../shared/contracts';
import { api, errorMessage, isAbort } from '../../lib/api';
import { decimalToUnits, formatUnits, shortAddress } from '../../lib/amounts';
import { connectWallet, devnetConnection, signWalletMessage, signDevnetTransaction, type WalletName, type WalletProvider } from '../../lib/wallet';
import { ErrorNotice, Loading } from '../ui';

interface Quote { id: string; market_id: string; side: 'buy' | 'sell'; token_amount: string; lamports: string; max_lamports: string; min_lamports: string; expires_at: string }
interface FundingIntent { id: string; project_id: string; lamports: string; recipient: string; status: string; reference: string; expires_at: string }
interface Prepared { transaction: string; expires_at: string }
interface MarketState extends Market { status: 'prepared' | 'active' }
interface Receipt { signature: string; kind: 'market' | 'funding'; intentId?: string; status: 'pending' | 'confirmed' | 'failed' }

function verifyExpiry(expiresAt: string) {
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) throw new Error('La operación caducó. Solicita una nueva cotización antes de firmar.');
}

export function MarketPanel({ project, owner, authenticated, viewerId, onProjectChanged }: {
  project: Project; owner: boolean; authenticated: boolean; viewerId: string | null; onProjectChanged?: () => void;
}) {
  const receiptStorageKey = `promptfun_devnet_receipt_${viewerId ?? 'visitor'}_${project.id}`;
  const [market, setMarket] = useState<MarketState | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<WalletName>('phantom');
  const [walletProvider, setWalletProvider] = useState<WalletProvider | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [tokenAmount, setTokenAmount] = useState('');
  const [supportAmount, setSupportAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(receiptStorageKey) ?? 'null') as Receipt | null;
      return stored && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(stored.signature) && ['market', 'funding'].includes(stored.kind) && ['pending', 'confirmed', 'failed'].includes(stored.status) && (stored.kind !== 'funding' || /^[0-9a-f-]{36}$/i.test(stored.intentId ?? '')) ? stored : null;
    } catch { return null; }
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await api<{ market: MarketState | null; configured: boolean }>(`/projects/${project.id}/market`, { signal });
      if (!signal?.aborted) { setMarket(result.market); setConfigured(result.configured); }
    } catch (cause) { if (!isAbort(cause)) setError(errorMessage(cause)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [project.id]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => { if (receipt) { try { sessionStorage.setItem(receiptStorageKey, JSON.stringify(receipt)); } catch { /* The receipt remains available in memory if storage is blocked. */ } } }, [receipt, receiptStorageKey]);
  useEffect(() => {
    const provider = walletProvider;
    if (!provider) return;
    const changed = () => { setAddress(null); setBalance(null); setQuote(null); };
    provider.on?.('accountChanged', changed); provider.on?.('disconnect', changed);
    return () => { provider.removeListener?.('accountChanged', changed); provider.removeListener?.('disconnect', changed); };
  }, [walletProvider]);

  async function connect() {
    setBusy(true); setError(null); setBalanceError(false);
    try {
      const wallet = await connectWallet(walletName); setWalletProvider(wallet.provider); setAddress(wallet.address); setQuote(null);
      try { const lamports = await devnetConnection.getBalance(wallet.provider.publicKey!); if (!Number.isSafeInteger(lamports) || lamports < 0) throw new Error('Saldo fuera del rango exacto.'); setBalance(String(lamports)); }
      catch { setBalance(null); setBalanceError(true); }
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function checkReceipt(current: Receipt) {
    if (current.kind === 'funding') {
      const result = await api<{ intent: FundingIntent }>(`/funding-intents/${current.intentId}/submit`, { method: 'POST', body: { signature: current.signature } });
      const status = result.intent.status === 'confirmed' || result.intent.status === 'credited' ? 'confirmed' : result.intent.status === 'failed' ? 'failed' : 'pending';
      setReceipt({ ...current, status });
      if (status === 'failed') throw new Error('El aporte falló en Solana. No se acreditó como confirmado.');
      setMessage(status === 'confirmed' ? 'Aporte verificado en Devnet. Es una prueba; no compra créditos de IA.' : 'La transacción está pendiente de verificación. Puedes consultar su estado sin volver a enviarla.');
    } else {
      const result = await api<{ status: 'pending' | 'confirmed' | 'failed'; market?: MarketState }>(`/markets/${project.id}/submit`, { method: 'POST', body: { signature: current.signature } });
      if (result.market) setMarket(result.market);
      setReceipt({ ...current, status: result.status });
      if (result.status === 'failed') throw new Error('La operación falló en Solana. No se presenta como una compra o venta completada.');
      setMessage(result.status === 'confirmed' ? 'Operación verificada en Solana Devnet.' : 'La transacción está pendiente de verificación. Puedes consultar su estado sin volver a enviarla.');
    }
  }

  async function createMarket() {
    if (!address || !walletProvider) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      if (project.wallet_address !== address) {
        const challenge = await api<{ nonce: string; message: string }>(`/projects/${project.id}/wallet/challenge`, { method: 'POST', body: { address } });
        const signature = await signWalletMessage(walletProvider, challenge.message, address);
        await api(`/projects/${project.id}/wallet/verify`, { method: 'POST', body: { nonce: challenge.nonce, address, signature } });
        onProjectChanged?.();
      }
      const prepared = await api<Prepared & { market: Market }>(`/projects/${project.id}/market`, { method: 'POST', body: {} });
      verifyExpiry(prepared.expires_at);
      const signature = await signDevnetTransaction(prepared.transaction, address, (signature, status) => setReceipt({ signature, kind: 'market', status }), walletProvider);
      const current: Receipt = { signature, kind: 'market', status: 'pending' }; setReceipt(current);
      setMessage('Transacción enviada a Devnet; falta verificar su resultado.');
      await checkReceipt(current); await load();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function requestQuote() {
    setBusy(true); setError(null); setQuote(null); setMessage(null);
    try {
      const amount = decimalToUnits(tokenAmount, 6);
      const result = await api<{ quote: Quote }>(`/markets/${project.id}/quote`, { method: 'POST', body: { side, token_amount: amount } });
      verifyExpiry(result.quote.expires_at); setQuote(result.quote);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function trade() {
    if (!quote || !address || !walletProvider) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      verifyExpiry(quote.expires_at);
      const prepared = await api<Prepared>(`/markets/${project.id}/transactions`, { method: 'POST', body: { quote_id: quote.id, address } });
      verifyExpiry(prepared.expires_at);
      const signature = await signDevnetTransaction(prepared.transaction, address, (signature, status) => setReceipt({ signature, kind: 'market', status }), walletProvider);
      const current: Receipt = { signature, kind: 'market', status: 'pending' }; setReceipt(current); setQuote(null);
      setMessage('Transacción enviada a Devnet; falta verificar su resultado.'); await checkReceipt(current);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function support() {
    if (!address || !walletProvider) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await api<{ intent: FundingIntent; transaction: string }>(`/projects/${project.id}/funding-intents`, { method: 'POST', body: { lamports: decimalToUnits(supportAmount, 9), address } });
      verifyExpiry(result.intent.expires_at);
      const signature = await signDevnetTransaction(result.transaction, address, (signature, status) => setReceipt({ signature, kind: 'funding', intentId: result.intent.id, status }), walletProvider);
      const current: Receipt = { signature, kind: 'funding', intentId: result.intent.id, status: 'pending' }; setReceipt(current);
      setMessage('Aporte enviado a Devnet; falta verificar su resultado.'); await checkReceipt(current);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <section className="market-panel" aria-labelledby={`market-title-${project.id}`}>
    <div className="section-heading"><div><h2 id={`market-title-${project.id}`}>Apoyo y mercado</h2><p>Solana Devnet</p></div><span className="network-pill">Solo pruebas</span></div>
    <p className="market-description">Un token de apoyo por proyecto. No representa participación en la empresa, derechos económicos ni una promesa de retorno. Los aportes y las compras se registran por separado.</p>
    {loading ? <Loading>Consultando el mercado…</Loading> : <>
      {configured === false && <p className="notice notice-info">El programa de mercado Devnet todavía no está configurado. La creación de tu app puede continuar.</p>}
      {market?.status === 'active' && <div className="market-summary"><span>Token emitido <strong>{shortAddress(market.mint)}</strong></span><span>Reserva de pruebas <strong>{formatUnits(market.reserve_lamports, 9)} SOL</strong></span><a href={`https://explorer.solana.com/address/${market.mint}?cluster=devnet`} target="_blank" rel="noreferrer">Ver token en Devnet <ExternalLink size={13} aria-hidden="true" /></a></div>}
      {market?.status === 'prepared' && <p className="notice notice-info">El mercado está preparado, pero su registro todavía no está verificado en Devnet.</p>}
      {!authenticated ? <p className="muted">Entra con tu cuenta de Promptfun para operar. Puedes probar la app sin wallet.</p> : <>
        <div className="wallet-line"><label htmlFor={`wallet-provider-${project.id}`}>Wallet</label><select id={`wallet-provider-${project.id}`} value={walletName} disabled={busy} onChange={event => { setWalletName(event.target.value as WalletName); setWalletProvider(null); setAddress(null); setBalance(null); setQuote(null); }}><option value="phantom">Phantom</option><option value="solflare">Solflare</option></select><button className="button button-secondary" onClick={connect} disabled={busy}><Wallet size={16} aria-hidden="true" />{address ? `Wallet ${shortAddress(address)}` : `Conectar ${walletName === 'phantom' ? 'Phantom' : 'Solflare'}`}</button>{address && <span className="muted">Saldo Devnet: {balance === null ? 'No disponible' : `${formatUnits(balance, 9)} SOL`}</span>}</div>
        {balanceError && <p className="field-hint">No pudimos consultar el saldo de Devnet. No se ha sustituido por un saldo de ejemplo.</p>}
        {owner && market?.status !== 'active' && configured && <div className="market-create"><p>Emisión: 1 000 millones de tokens; 80 % en la curva y 20 % reservado y bloqueado. Sin comisión de compraventa de plataforma en esta prueba.</p><button className="button button-secondary" onClick={createMarket} disabled={!address || busy || receipt?.status === 'pending'}>{busy ? 'Esperando la operación…' : 'Vincular wallet y crear mercado Devnet'}</button></div>}
        {market?.status === 'active' && <div className="trade-form"><div className="segmented" aria-label="Operación"><button aria-pressed={side === 'buy'} onClick={() => { setSide('buy'); setQuote(null); }} disabled={busy}>Comprar</button><button aria-pressed={side === 'sell'} onClick={() => { setSide('sell'); setQuote(null); }} disabled={busy}>Vender</button></div>
          <label htmlFor={`token-amount-${project.id}`}>Cantidad de tokens</label><div className="input-action"><input id={`token-amount-${project.id}`} inputMode="decimal" value={tokenAmount} placeholder="0.00" onChange={event => { setTokenAmount(event.target.value); setQuote(null); }} disabled={busy} /><button className="button button-secondary" onClick={requestQuote} disabled={!tokenAmount || !address || busy || receipt?.status === 'pending'}>Cotizar</button></div>
          {quote && <div className="quote-review"><strong>{quote.side === 'buy' ? 'Compra' : 'Venta'} de {formatUnits(quote.token_amount, 6)} tokens</strong><span>{quote.side === 'buy' ? 'Máximo' : 'Mínimo a recibir'}: {formatUnits(quote.side === 'buy' ? quote.max_lamports : quote.min_lamports, 9)} SOL de Devnet</span><span className="field-hint">La wallet muestra también la comisión de red. Esta cotización caduca; revisa los detalles antes de firmar.</span><button className="button button-primary" onClick={trade} disabled={busy || !address || receipt?.status === 'pending'}>{busy ? 'Esperando la firma…' : 'Firmar operación en Devnet'}</button></div>}
        </div>}
        {project.wallet_address && <div className="support-form"><h3>Aporte directo de prueba</h3><p className="field-hint">Destino: {shortAddress(project.wallet_address)}. No añade créditos a OpenRouter.</p><label htmlFor={`support-amount-${project.id}`}>Cantidad de SOL Devnet</label><div className="input-action"><input id={`support-amount-${project.id}`} inputMode="decimal" placeholder="0.01" value={supportAmount} onChange={event => setSupportAmount(event.target.value)} disabled={busy} /><button className="button button-secondary" onClick={support} disabled={!address || !supportAmount || busy || receipt?.status === 'pending'}>Revisar y firmar aporte</button></div></div>}
      </>}
    </>}
    {message && <p className="notice notice-success" role="status">{message}</p>}
    {receipt?.status === 'pending' && <p className="notice notice-info">Hay una firma pendiente de comprobar. Consultar su estado no vuelve a enviar la transacción.</p>}
    {receipt && <div className="receipt"><a href={`https://explorer.solana.com/tx/${receipt.signature}?cluster=devnet`} target="_blank" rel="noreferrer">Ver transacción en Devnet <ExternalLink size={13} aria-hidden="true" /></a><button className="text-button" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await checkReceipt(receipt); await load(); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); } }}>Comprobar estado</button></div>}
    <ErrorNotice message={error} />
  </section>;
}

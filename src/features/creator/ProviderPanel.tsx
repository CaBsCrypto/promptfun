import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Link2, Unplug } from 'lucide-react';
import type { FreeModel } from '../../../shared/contracts';
import { api, errorMessage, isAbort } from '../../lib/api';
import { ErrorNotice, Loading } from '../ui';

interface ProviderStatus { connected: boolean; state?: string }

export function ProviderPanel({ model, onModelChange, onAvailabilityChange }: {
  model: string;
  onModelChange: (model: string) => void;
  onAvailabilityChange: (connected: boolean, models: FreeModel[]) => void;
}) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [models, setModels] = useState<FreeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    let nextConnected = false;
    try {
      const connection = await api<ProviderStatus>('/providers/openrouter', { signal });
      if (signal?.aborted) return;
      setStatus(connection); nextConnected = connection.connected;
      const available = connection.connected ? (await api<{ models: FreeModel[] }>('/providers/openrouter/models', { signal })).models : [];
      if (signal?.aborted) return;
      setStatus(connection); setModels(available); onAvailabilityChange(connection.connected, available);
    } catch (cause) { if (!isAbort(cause)) { setError(errorMessage(cause)); setModels([]); if (!nextConnected) setStatus(null); onAvailabilityChange(nextConnected, []); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [onAvailabilityChange]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function disconnect() {
    setBusy(true); setError(null);
    try { await api('/providers/openrouter', { method: 'DELETE' }); await load(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <section className="provider-panel" aria-labelledby="provider-title"><div className="section-heading"><div><h3 id="provider-title"><Link2 size={17} aria-hidden="true" />Tu acceso a IA</h3><p>OpenRouter con tu propia cuenta.</p></div>{status?.connected && <span className="status-pill">Conectado</span>}</div>
    {loading ? <Loading>Consultando la conexión…</Loading> : <>
      {!status?.connected ? <><p className="muted">Autoriza el acceso para usar un modelo gratuito elegible. La cuota depende de tu cuenta y de la capacidad del proveedor.</p><button className="button button-secondary" onClick={() => window.location.assign('/api/providers/openrouter/start')}><ExternalLink size={16} aria-hidden="true" />Conectar OpenRouter</button></> : <>
        <label htmlFor="free-model">Modelo gratuito</label><select id="free-model" value={model} onChange={event => onModelChange(event.target.value)} disabled={busy || models.length === 0}><option value="">{models.length ? 'Selecciona un modelo' : 'No hay modelos gratuitos disponibles'}</option>{models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <p className="field-hint">Sin cambio automático a pago. Si no hay cuota, conservamos tu trabajo.</p><button className="text-button" onClick={disconnect} disabled={busy}><Unplug size={14} aria-hidden="true" />{busy ? 'Desconectando…' : 'Desconectar proveedor'}</button>
      </>}
    </>}<ErrorNotice message={error} onRetry={() => void load()} />
  </section>;
}

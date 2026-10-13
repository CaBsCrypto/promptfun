import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Health { status: string; dependencies: Record<string, boolean> }
const LABELS: Record<string, string> = { control_database: 'Proyectos', apps_database: 'Datos de apps', platform_auth: 'Acceso a Promptfun', apps_auth: 'Usuarios de apps', storage: 'Archivos', market: 'Mercado Devnet' };

export function HealthNotice() {
  const [health, setHealth] = useState<Health | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    try {
      const response = await fetch('/api/health', { credentials: 'same-origin', signal });
      const result = await response.json() as Health;
      if (typeof result.status !== 'string' || !result.dependencies || typeof result.dependencies !== 'object') throw new Error('No se pudo leer el estado del entorno.');
      if (!signal?.aborted) { setHealth(result); setUnreachable(false); }
    } catch (error) { if (!signal?.aborted) setUnreachable(true); }
    finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  if (!unreachable && (!health || Object.values(health.dependencies ?? {}).every(Boolean))) return null;
  return <div className="health-notice" role="status"><AlertCircle size={18} aria-hidden="true" /><div><strong>{unreachable ? 'No podemos conectar con el servidor local.' : health?.status === 'dependencies_unavailable' ? 'El backend todavía no está disponible.' : 'La configuración del entorno está incompleta.'}</strong><p>Las acciones que dependen de estos servicios mostrarán su error real.</p>{health && <div className="health-dependencies">{Object.entries(health.dependencies).map(([key, ready]) => <span key={key} className={ready ? 'ready' : ''}>{LABELS[key] ?? key}: {ready ? key.endsWith('_database') ? 'conectado' : 'configurado' : 'pendiente'}</span>)}</div>}</div><button className="icon-button" aria-label="Comprobar servicios del entorno" disabled={busy} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" /></button></div>;
}

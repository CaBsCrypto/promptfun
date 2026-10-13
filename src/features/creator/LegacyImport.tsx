import { useState } from 'react';
import { FileInput } from 'lucide-react';
import { actionId, api, errorMessage } from '../../lib/api';
import { ErrorNotice } from '../ui';

interface LegacyDraft { legacy_id: string; title: string; description: string; prompt: string; html: string }

export function LegacyImport({ projectId, onImported }: { projectId: string; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LegacyDraft[] | null>(null);
  const [selection, setSelection] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function inspect() {
    setError(null); setMessage(null);
    try {
      const text = localStorage.getItem('promptpump_pocs_v2');
      if (!text) { setItems([]); return; }
      if (text.length > 10_000_000) throw new Error('El archivo anterior supera el límite de lectura.');
      const data: unknown = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('El contenido anterior no tiene el formato esperado.');
      const safe = data.slice(0, 100).flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const source = item as Record<string, unknown>;
        const html = typeof source.runnableHtml === 'string' ? source.runnableHtml : typeof source.html === 'string' ? source.html : '';
        if (!html) return [];
        return [{ legacy_id: typeof source.id === 'string' ? source.id : `legacy-${index}`, title: typeof source.title === 'string' ? source.title : typeof source.name === 'string' ? source.name : 'Borrador anterior', description: typeof source.description === 'string' ? source.description : '', prompt: typeof source.prompt === 'string' ? source.prompt : '', html }];
      });
      setItems(safe); setSelection(safe[0]?.legacy_id ?? '');
    } catch (cause) { setError(errorMessage(cause)); }
  }
  async function submit() {
    const selected = items?.find(item => item.legacy_id === selection);
    if (!selected || !consent) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await api<{ imported: number; reused?: boolean }>(`/projects/${projectId}/import`, { method: 'POST', body: { items: [selected] }, idempotencyKey: actionId() });
      setMessage(result.reused ? 'Este borrador ya estaba importado; se conserva la misma versión.' : 'Borrador importado como versión privada. Revísalo antes de publicar.');
      setConsent(false); onImported();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <section className="legacy-import"><button className="text-button" aria-expanded={open} onClick={() => setOpen(!open)}><FileInput size={15} aria-hidden="true" />Importar un borrador anterior</button>{open && <div className="import-content"><p>Lee el contenido guardado por el prototipo en este navegador. Se importan título, descripción, prompt y artefacto; los saldos, roles, claves y operaciones quedan excluidos.</p>
    <button className="button button-secondary" onClick={inspect} disabled={busy}>Leer borradores de este navegador</button>
    {items !== null && (items.length ? <><label htmlFor="legacy-draft">Borrador para este proyecto</label><select id="legacy-draft" value={selection} onChange={event => { setSelection(event.target.value); setConsent(false); }}>{items.map(item => <option key={item.legacy_id} value={item.legacy_id}>{item.title}</option>)}</select><label className="check-label"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Confirmo que puedo importar este contenido como versión privada.</label><button className="button button-secondary" onClick={submit} disabled={!consent || busy}>{busy ? 'Validando el borrador…' : 'Importar versión privada'}</button></> : <p className="muted">No hay borradores con un artefacto importable en este navegador.</p>)}
    {message && <p className="notice notice-success" role="status">{message}</p>}<ErrorNotice message={error} />
  </div>}</section>;
}

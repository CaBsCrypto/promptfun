import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, Code2, ExternalLink, Eye, History, Play, RefreshCw, Send } from 'lucide-react';
import type { AppVersion, Feedback, FreeModel, GenerationJob, Project } from '../../../shared/contracts';
import { actionId, api, ApiError, errorMessage, isAbort } from '../../lib/api';
import { formatDate } from '../../lib/amounts';
import { ErrorNotice, Loading } from '../ui';
import { LegacyImport } from './LegacyImport';
import { ProviderPanel } from './ProviderPanel';

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'no_changes']);
const MarketPanel = lazy(() => import('../market/MarketPanel').then(module => ({ default: module.MarketPanel })));
const STATUS: Record<GenerationJob['status'], string> = { queued: 'En cola', running: 'Generando', validating: 'Validando la versión', completed: 'Versión lista para revisar', failed: 'La generación falló', uncertain: 'Resultado pendiente de comprobar', cancelled: 'Trabajo cancelado', no_changes: 'Sin cambios en el artefacto' };

export function PreviewPane({ url, title, onRefresh }: { url: string | null; title: string; onRefresh?: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setLoaded(false); setFailed(false); }, [url]);
  let permitted = false;
  if (url) {
    try { const target = new URL(url); permitted = ['http:', 'https:'].includes(target.protocol) && target.origin !== window.location.origin; } catch { /* Unreadable or same-origin previews stay blocked. */ }
  }
  return <section className="preview-pane" aria-label={`Preview de ${title}`}><div className="preview-toolbar"><span><Eye size={16} aria-hidden="true" />Preview aislado</span><div className="preview-toolbar-actions">{url && permitted && <a className="preview-open-link" href={url} target="_blank" rel="noopener noreferrer">Abrir app <ExternalLink size={14} aria-hidden="true" /></a>}{onRefresh && <button className="icon-button" aria-label="Volver a cargar preview" onClick={onRefresh}><RefreshCw size={15} aria-hidden="true" /></button>}</div></div>
    {!url ? <div className="preview-placeholder"><div className="preview-outline" aria-hidden="true"><i /><i /><i /></div><h3>Tu próxima versión aparece aquí</h3><p>Genera o selecciona una versión para probarla antes de publicar.</p></div> : !permitted ? <div className="preview-placeholder"><ErrorNotice message="El preview necesita un origen separado y válido. Revisa la configuración del servidor." /></div> : <div className="iframe-area">
      {!loaded && !failed && <div className="preview-loading"><Loading>Abriendo la versión…</Loading></div>}
      <iframe key={url} src={url} title={`Versión de ${title}`} sandbox="allow-scripts allow-forms allow-same-origin" allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'" referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(false); }} />
      {failed && <ErrorNotice message="El preview no pudo cargarse. La versión sigue guardada; vuelve a intentar." onRetry={onRefresh} />}
    </div>}{url && permitted && <p className="preview-hint">Abre la app en otra pestaña para entrar y guardar tus datos.</p>}
  </section>;
}

function JobSummary({ job }: { job: GenerationJob }) {
  const uncertain = job.status === 'uncertain' || job.usage_status === 'unknown';
  return <section className="job-summary" aria-label="Estado del trabajo"><div className="job-state" role="status"><span className={`state-dot ${TERMINAL.has(job.status) ? 'settled' : ''}`} /><strong>{STATUS[job.status]}</strong><span>{formatDate(job.created_at)}</span></div>
    <div className="usage-row"><span>Modelo <strong>{job.model}</strong></span><span>Entrada <strong>{job.prompt_tokens ?? 'No disponible'}</strong></span><span>Salida <strong>{job.completion_tokens ?? 'No disponible'}</strong></span><span>Coste <strong>{job.cost_usd === null ? 'Pendiente' : `${job.cost_usd} USD`}</strong></span></div>
    <p className="field-hint">{uncertain ? 'No hay evidencia suficiente para cerrar el consumo. No equivale a coste cero; no se repetirá automáticamente la llamada.' : job.usage_status === 'reported' ? 'Consumo reportado por el proveedor. La generación y su coste se registran por separado.' : 'El consumo todavía está pendiente de reporte. La versión puede estar lista antes que el recibo.'}</p>
    {job.error && <ErrorNotice message={job.error} />}
  </section>;
}

function OwnerFeedback({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<(Feedback & { status?: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    try { const result = await api<{ feedback: (Feedback & { status?: string })[] }>(`/projects/${projectId}/feedback`, { signal }); if (!signal?.aborted) { setItems(result.feedback); setError(null); } }
    catch (cause) { if (!isAbort(cause)) setError(errorMessage(cause)); }
  }, [projectId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function moderate(id: string, status: 'approved' | 'rejected') {
    setBusyId(id); setError(null);
    try { await api(`/projects/${projectId}/feedback/${id}`, { method: 'PATCH', body: { status } }); await load(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusyId(null); }
  }
  return <section className="feedback-panel"><div className="section-heading"><div><h2>Comentarios recibidos</h2><p>Cada comentario conserva la versión observada.</p></div><button className="icon-button" aria-label="Actualizar comentarios" onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" /></button></div>
    {!items.length && <p className="muted">Todavía no hay comentarios para revisar.</p>}{items.map(item => <article className="feedback-item" key={item.id}><p>{item.text}</p><span className="field-hint">{formatDate(item.created_at)} · versión {item.version_id.slice(0, 8)}</span>{item.status === 'pending' && <div className="button-row"><button className="text-button" disabled={busyId === item.id} onClick={() => void moderate(item.id, 'approved')}>Aprobar</button><button className="text-button" disabled={busyId === item.id} onClick={() => void moderate(item.id, 'rejected')}>Rechazar</button></div>}{item.status && item.status !== 'pending' && <span className="status-pill">{item.status === 'approved' ? 'Aprobado' : 'Rechazado'}</span>}</article>)}<ErrorNotice message={error} onRetry={() => void load()} />
  </section>;
}

export function Workbench({ project, draft, viewerId, onDraftChange, onProjectChanged }: {
  project: Project; draft: string; viewerId: string; onDraftChange: (value: string) => void; onProjectChanged: () => void;
}) {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [model, setModel] = useState('');
  const [connected, setConnected] = useState(false);
  const [availableModels, setAvailableModels] = useState<FreeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [publishedMessage, setPublishedMessage] = useState<string | null>(null);
  const [codeVisible, setCodeVisible] = useState(false);
  const [mobileTab, setMobileTab] = useState<'prompt' | 'preview'>('prompt');
  const [marketOpen, setMarketOpen] = useState(false);
  const [approvedImportPreviews, setApprovedImportPreviews] = useState<Set<string>>(() => new Set());
  const retryRequest = useRef<{ payload: string; key: string } | null>(null);
  const publishRequest = useRef<{version:string,key:string}|null>(null);
  const selected = versions.find(version => version.id === selectedId) ?? null;
  const baseVersion = selected?.parent_version_id ? versions.find(version => version.id === selected.parent_version_id) : null;
  const activeJob = job !== null && !TERMINAL.has(job.status);
  const importedVersion = selected?.changelog.some(line => line.startsWith('Borrador importado:')) ?? false;
  const previewAllowed = !importedVersion || approvedImportPreviews.has(selectedId);
  const validModel = availableModels.some(item => item.id === model);
  const comparison = useMemo(() => {
    if (!selected?.html || !baseVersion?.html) return null;
    const before = new Set(baseVersion.html.split('\n'));
    const after = new Set(selected.html.split('\n'));
    return { added: [...after].filter(line => !before.has(line)).length, removed: [...before].filter(line => !after.has(line)).length, identical: selected.content_hash === baseVersion.content_hash };
  }, [selected, baseVersion]);

  const providerChanged = useCallback((nextConnected: boolean, models: FreeModel[]) => {
    setConnected(nextConnected); setAvailableModels(models);
    setModel(current => models.some(item => item.id === current) ? current : models[0]?.id ?? '');
  }, []);
  const loadVersions = useCallback(async (signal?: AbortSignal) => {
    const result = await api<{ versions: AppVersion[] }>(`/projects/${project.id}/versions`, { signal });
    if (!signal?.aborted) { setVersions(result.versions); setSelectedId(current => result.versions.some(version => version.id === current) ? current : result.versions[0]?.id ?? ''); }
    return result.versions;
  }, [project.id]);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null);
    void Promise.all([loadVersions(controller.signal), api<{ jobs: GenerationJob[] }>(`/projects/${project.id}/jobs`, { signal: controller.signal })]).then(([, result]) => {
      if (!controller.signal.aborted) setJob(result.jobs.find(item => !TERMINAL.has(item.status)) ?? result.jobs[0] ?? null);
    }).catch(cause => { if (!isAbort(cause)) setError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project.id, loadVersions]);

  useEffect(() => {
    if (!job || TERMINAL.has(job.status)) return;
    const jobId = job.id; const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await api<{ job: GenerationJob }>(`/jobs/${jobId}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setJob(result.job); setJobError(null);
        if (TERMINAL.has(result.job.status)) {
          if (result.job.result_version_id) { await loadVersions(controller.signal); if (!controller.signal.aborted) setSelectedId(result.job.result_version_id); }
          return;
        }
      } catch (cause) {
        if (isAbort(cause)) return;
        setJobError(errorMessage(cause));
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) return;
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 1500);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [job?.id, activeJob, loadVersions]);

  useEffect(() => {
    setReviewed(false); setPreviewUrl(null); setPreviewError(null); setPublishedMessage(null);
    if (!selectedId || !previewAllowed) return;
    const controller = new AbortController();
    void api<{ url: string }>(`/projects/${project.id}/preview-token`, { method: 'POST', body: { version_id: selectedId }, signal: controller.signal }).then(result => { if (!controller.signal.aborted) setPreviewUrl(result.url); }).catch(cause => { if (!isAbort(cause)) setPreviewError(errorMessage(cause)); });
    return () => controller.abort();
  }, [selectedId, project.id, previewRevision, previewAllowed]);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (activeJob || !validModel || !draft.trim()) return;
    setBusy(true); setError(null); setJobError(null);
    const payload = JSON.stringify({ prompt: draft, model, base_version_id: selectedId || null });
    if (retryRequest.current?.payload !== payload) retryRequest.current = { payload, key: actionId() };
    const idempotencyKey = retryRequest.current.key;
    try {
      const result = await api<{ job_id?: string; job?: GenerationJob }>(`/projects/${project.id}/jobs`, { method: 'POST', body: { prompt: draft, model, base_version_id: selectedId || null, idempotency_key: idempotencyKey }, idempotencyKey });
      if (result.job) setJob(result.job);
      else if (result.job_id) setJob((await api<{ job: GenerationJob }>(`/jobs/${result.job_id}`)).job);
      else throw new Error('El servidor no devolvió un identificador de trabajo. Conserva el borrador y comprueba el estado antes de repetir.');
      retryRequest.current = null;
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!selected || !reviewed) return;
    setBusy(true); setError(null);
    try {
      if(publishRequest.current?.version!==selected.id)publishRequest.current={version:selected.id,key:actionId()};
      await api(`/projects/${project.id}/publish`, { method: 'POST', body: { version_id: selected.id },idempotencyKey:publishRequest.current!.key });
      publishRequest.current=null;
      setPublishedMessage('Versión publicada. La audiencia verá este artefacto; el prompt sigue privado.');
      onProjectChanged(); setReviewed(false);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <div className="workbench">
    <header className="project-heading"><div><span className="project-privacy">Espacio privado</span><h1>{project.title}</h1>{project.description && <p>{project.description}</p>}</div><span className={`status-pill ${project.published_version_id ? 'published' : ''}`}>{project.published_version_id ? 'Con una versión pública' : 'Borrador'}</span></header>
    <ErrorNotice message={error} />
    {loading && <Loading>Recuperando versiones y trabajos…</Loading>}
    <div className="mobile-workbench-tabs" aria-label="Panel del proyecto"><button aria-pressed={mobileTab === 'prompt'} onClick={() => setMobileTab('prompt')}>Prompt y trabajo</button><button aria-pressed={mobileTab === 'preview'} onClick={() => setMobileTab('preview')}>Preview</button></div>
    <div className={`workspace-columns show-${mobileTab}`}>
      <section className="prompt-pane"><ProviderPanel model={model} onModelChange={setModel} onAvailabilityChange={providerChanged} />
        <form className="prompt-form" onSubmit={generate}><div className="section-heading"><h2>{selected ? 'Mejora esta versión' : 'Describe tu primera versión'}</h2><Code2 size={20} aria-hidden="true" /></div>
          {versions.length > 0 && <><label htmlFor="version-base">Versión de partida</label><select id="version-base" value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={busy || activeJob}>{versions.map(version => <option key={version.id} value={version.id}>{formatDate(version.created_at)} · {version.id.slice(0, 8)}{project.published_version_id === version.id ? ' · publicada' : ''}</option>)}</select></>}
          <label htmlFor="project-prompt">{selected ? 'Qué quieres cambiar' : 'Qué quieres construir'}</label><textarea id="project-prompt" value={draft} onChange={event => onDraftChange(event.target.value)} placeholder={selected ? 'Explica la mejora y qué debe conservarse…' : 'Por ejemplo: una lista de tareas con usuarios, estados y archivos adjuntos…'} rows={9} maxLength={20000} disabled={busy} />
          <p className="field-hint">{selected ? 'Se conserva la versión de partida. La candidata nueva se prueba antes de publicarla.' : 'Empieza sin wallet con tu cuota gratuita elegible. Generar no publica.'}</p>
          <div className="generation-footer"><span><i />Cuota propia gratuita</span><button className="button button-primary" disabled={busy || activeJob || !connected || !validModel || !draft.trim() || loading}><Play size={16} aria-hidden="true" />{busy ? 'Creando el trabajo…' : activeJob ? 'Trabajo en curso' : selected ? 'Generar mejora' : 'Generar primera versión'}</button></div>
        </form>{job && <JobSummary job={job} />}<ErrorNotice message={jobError} />
      </section>
      <div className="preview-column">{importedVersion && !previewAllowed && <div className="notice notice-info"><div>Esta versión se importó sin ejecutarse. Revisa su contenido antes de abrirla.<button className="text-button" onClick={() => setApprovedImportPreviews(current => new Set([...current, selectedId]))}>Abrir preview para revisar</button></div></div>}<PreviewPane url={previewUrl} title={project.title} onRefresh={() => setPreviewRevision(current => current + 1)} /><ErrorNotice message={previewError} onRetry={() => setPreviewRevision(current => current + 1)} />
        {selected && <section className="version-review"><div className="section-heading"><h2><History size={18} aria-hidden="true" />Revisa esta versión</h2><span className="field-hint">{selected.id.slice(0, 8)}</span></div>
          {selected.changelog.length > 0 && <ul>{selected.changelog.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul>}
          {comparison && <p className="comparison-note">{comparison.identical ? 'El artefacto es idéntico a su versión de partida.' : `Comparación con la base: ${comparison.added} líneas distintas añadidas y ${comparison.removed} retiradas.`}</p>}
          <div className="capability-list"><span>Datos: {selected.manifest.records.collections.join(', ') || 'Sin colecciones'}</span><span>{selected.manifest.auth ? 'Con usuarios de app' : 'Sin autenticación de app'}</span><span>{selected.manifest.files ? 'Archivos habilitados' : 'Sin archivos'}</span></div>
          <button className="text-button" onClick={() => setCodeVisible(!codeVisible)} aria-expanded={codeVisible}>{codeVisible ? 'Ocultar artefacto' : 'Ver código del artefacto'}</button>{codeVisible && <pre className="artifact-code" tabIndex={0}>{selected.html ?? 'El artefacto no está disponible.'}</pre>}
          {project.published_version_id === selected.id ? <p className="notice notice-success"><Check size={17} aria-hidden="true" />Esta es la versión publicada.</p> : <><label className="check-label"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />He probado esta versión y revisado sus datos y permisos.</label><button className="button button-primary" disabled={!reviewed || busy || !previewUrl} onClick={publish}><Send size={16} aria-hidden="true" />{busy ? 'Publicando…' : 'Publicar esta versión'}</button></>}
          {publishedMessage && <p className="notice notice-success" role="status">{publishedMessage}</p>}
        </section>}
      </div>
    </div>
    <div className="project-secondary"><div className="market-disclosure"><button className="section-disclosure" aria-expanded={marketOpen} onClick={() => setMarketOpen(!marketOpen)}><span>Apoyo y mercado Devnet</span><span>{marketOpen ? 'Cerrar' : 'Abrir'}</span></button>{marketOpen ? <Suspense fallback={<Loading>Abriendo el mercado…</Loading>}><MarketPanel key={`${project.id}:${viewerId}`} project={project} viewerId={viewerId} owner authenticated onProjectChanged={onProjectChanged} /></Suspense> : <p className="muted">Conecta una wallet únicamente cuando quieras probar una operación en Devnet.</p>}</div><div><OwnerFeedback projectId={project.id} /><LegacyImport projectId={project.id} onImported={() => void loadVersions().catch(cause => setError(errorMessage(cause)))} /></div></div>
  </div>;
}

import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, MessageSquare, RefreshCw, Search } from 'lucide-react';
import type { AppVersion, Feedback, Project } from '../../../shared/contracts';
import { api, errorMessage, isAbort } from '../../lib/api';
import { formatDate } from '../../lib/amounts';
import { EmptyState, ErrorNotice, Loading } from '../ui';
import { PreviewPane } from '../creator/Workbench';
const MarketPanel = lazy(() => import('../market/MarketPanel').then(module => ({ default: module.MarketPanel })));

interface PublicDetail { project: Project; version: AppVersion | null; feedback: Feedback[]; preview_url?: string | null; history:{id:string;version_id:string;published_at:string;content_hash:string;changelog:string[]}[] }

export function Discover({ selectedId, onSelect, authenticated, viewerId, onLogin, revision, isDemo = false }: { selectedId: string | null; onSelect: (id: string | null) => void; authenticated: boolean; viewerId: string | null; onLogin: () => void; revision: number; isDemo?: boolean }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [detail, setDetail] = useState<PublicDetail | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentMessage, setCommentMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try { const result = await api<{ projects: Project[] }>('/public/projects', { signal }); if (!signal?.aborted) setProjects(result.projects); }
    catch (cause) { if (!isAbort(cause)) setError(errorMessage(cause)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, revision]);
  useEffect(() => {
    setDetail(null); setDetailError(null); setComment(''); setCommentMessage(null); setCommentError(null); setMarketOpen(false);
    if (!selectedId) return;
    const controller = new AbortController(); setDetailLoading(true);
    void api<PublicDetail>(`/public/projects/${selectedId}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setDetail(result); }).catch(cause => { if (!isAbort(cause)) setDetailError(errorMessage(cause)); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, revision]);
  const visible = useMemo(() => { const normalized = query.trim().toLocaleLowerCase('es'); return projects.filter(project => `${project.title} ${project.description}`.toLocaleLowerCase('es').includes(normalized)); }, [projects, query]);
  async function sendComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (isDemo || !detail?.version || !comment.trim()) return;
    setSending(true); setCommentError(null); setCommentMessage(null);
    try { await api(`/public/projects/${detail.project.id}/feedback`, { method: 'POST', body: { version_id: detail.version.id, text: comment.trim() } }); setComment(''); setCommentMessage('Comentario enviado para revisión. Gracias por compartir una observación concreta.'); }
    catch (cause) { setCommentError(errorMessage(cause)); }
    finally { setSending(false); }
  }
  if (selectedId) return <div className="public-project"><button className="text-button back-button" onClick={() => onSelect(null)}><ArrowLeft size={16} aria-hidden="true" />Volver a proyectos</button>
    {detailLoading && <Loading>Abriendo la versión publicada…</Loading>}<ErrorNotice message={detailError} />
    {detail && <><header className="project-heading"><div><span className="project-privacy">Proyecto público</span><h1>{detail.project.title}</h1><p>{detail.project.description}</p></div><span className="status-pill published">Versión publicada</span></header>
      {detail.version ? <><PreviewPane url={detail.preview_url ?? null} title={detail.project.title} />{!detail.preview_url && <p className="notice notice-info">El preview público todavía no está disponible. La ficha y el historial permanecen accesibles.</p>}<div className="public-version"><span>Publicada: {formatDate(detail.version.created_at)}</span><span>Versión {detail.version.id.slice(0, 8)}</span></div>{detail.version.changelog?.length > 0 && <section className="public-changelog"><h2>Qué cambió</h2><ul>{detail.version.changelog.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul></section>}</> : <EmptyState title="La versión no está disponible">Vuelve a consultar este proyecto más adelante.</EmptyState>}
      {detail.history?.length>0&&<section className="public-changelog"><h2>Historial de publicaciones</h2><ol>{detail.history.map(item=><li key={item.id}><strong>{formatDate(item.published_at)} · versión {item.version_id.slice(0,8)}</strong>{item.changelog?.length>0&&<p>{item.changelog.join(' ')}</p>}</li>)}</ol></section>}
      <div className="public-secondary"><section className="feedback-panel"><div className="section-heading"><div><h2><MessageSquare size={18} aria-hidden="true" />Conversación sobre esta versión</h2><p>Comparte qué funciona, qué cambiarías y por qué.</p></div></div>
        {detail.feedback.length ? detail.feedback.map(item => <article className="feedback-item" key={item.id}><p>{item.text}</p><span className="field-hint">{formatDate(item.created_at)} · versión {item.version_id.slice(0, 8)}</span></article>) : <p className="muted">Todavía no hay comentarios publicados.</p>}
        {isDemo ? <p className="muted">La demo permite leer los comentarios publicados.</p> : authenticated && detail.version ? <form className="comment-form" onSubmit={sendComment}><label htmlFor="public-comment">Tu comentario</label><textarea id="public-comment" rows={4} maxLength={2000} required value={comment} onChange={event => setComment(event.target.value)} disabled={sending} /><button className="button button-secondary" disabled={!comment.trim() || sending}>{sending ? 'Enviando…' : 'Enviar comentario'}</button></form> : !authenticated && <button className="text-button" onClick={onLogin}>Entrar para comentar</button>}
        {commentMessage && <p className="notice notice-success" role="status">{commentMessage}</p>}<ErrorNotice message={commentError} />
      </section>{!isDemo && <div className="market-disclosure"><button className="section-disclosure" aria-expanded={marketOpen} onClick={() => setMarketOpen(!marketOpen)}><span>Apoyo y mercado Devnet</span><span>{marketOpen ? 'Cerrar' : 'Abrir'}</span></button>{marketOpen ? <Suspense fallback={<Loading>Abriendo el mercado…</Loading>}><MarketPanel key={`${detail.project.id}:${viewerId ?? 'visitor'}`} project={detail.project} viewerId={viewerId} owner={false} authenticated={authenticated} /></Suspense> : <p className="muted">Prueba el proyecto antes de decidir cómo participar.</p>}</div>}</div>
    </>}
  </div>;
  return <section className="discovery"><header className="discovery-heading"><div><h1>Proyectos que puedes probar.</h1><p>Explora versiones publicadas y conoce su próximo avance.</p></div><button className="icon-button" onClick={() => void load()} aria-label="Actualizar proyectos"><RefreshCw size={18} aria-hidden="true" /></button></header>
    <div className="search-field"><Search size={19} aria-hidden="true" /><label htmlFor="project-search" className="visually-hidden">Buscar proyectos publicados</label><input id="project-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar una app o un proyecto" /><span>{!loading && !error ? `${visible.length} ${visible.length === 1 ? 'proyecto' : 'proyectos'}` : ''}</span></div><ErrorNotice message={error} onRetry={() => void load()} />
    {loading ? <Loading>Consultando publicaciones…</Loading> : !error && (visible.length ? <div className="project-grid">{visible.map(project => <button className="public-project-card" key={project.id} onClick={() => onSelect(project.id)}><div className="project-card-art" aria-hidden="true"><div><i /><i /><i /></div><ArrowUpRight size={23} /></div><div className="project-card-content"><h2>{project.title}</h2><p>{project.description || 'Abre la versión publicada para conocer este proyecto.'}</p><span>Actualizado {formatDate(project.updated_at)}</span><strong>Probar proyecto</strong></div></button>)}</div> : <EmptyState title={query.trim() ? 'No encontramos proyectos con estos filtros' : 'Todavía no hay proyectos publicados'}>{query.trim() ? 'Prueba otra búsqueda.' : 'Una primera versión puede abrir una buena conversación.'}{query.trim() && <button className="text-button" onClick={() => setQuery('')}>Limpiar filtros</button>}</EmptyState>)}
  </section>;
}

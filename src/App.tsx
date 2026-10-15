import { useCallback, useEffect, useState, useRef, type FormEvent } from 'react';
import { Compass, FolderOpen, LogOut, Plus, SquareTerminal } from 'lucide-react';
import type { Project, Session } from '../shared/contracts';
import { api, errorMessage, isAbort, setSessionToken, actionId } from './lib/api';
import { AuthPanel } from './features/identity/AuthPanel';
import { WalletAccess } from './features/identity/WalletAccess';
import { shortWallet } from './features/identity/walletAuth';
import { Workbench } from './features/creator/Workbench';
import { Discover } from './features/discovery/Discover';
import { EmptyState, ErrorNotice, Loading } from './features/ui';
import { HealthNotice } from './features/HealthNotice';
import type { RegisterLeaveGuard } from './features/creator/useProjectDraft';

function initialNavigation() {
  const params = new URLSearchParams(window.location.search);
  return { view: params.get('view') === 'discover' ? 'discover' as const : 'creator' as const, publicId: params.get('view') === 'discover' ? params.get('project') : null };
}

export default function App() {
  const [session, setSession] = useState<Session>({ user: null, csrf_token: null });
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [navigation, setNavigation] = useState(initialNavigation);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => new URL(window.location.href).searchParams.get('creator_project'));
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [publicRevision, setPublicRevision] = useState(0);
  const [walletAccessOpen, setWalletAccessOpen] = useState(false);
  const projectRequest=useRef<{payload:string,key:string}|null>(null);
  const leaveGuard = useRef<(() => Promise<boolean>) | null>(null);
  const leaving = useRef(false);
  const currentUrl = useRef(window.location.href);
  const historyIndex = useRef<number>(Number.isInteger(window.history.state?.pf_index) ? window.history.state.pf_index : 0);
  const restoringHistory = useRef(false);
  const popEpoch = useRef(0);
  const identity = useRef<{ id: string | null; epoch: number }>({ id: null, epoch: 0 });
  const projectListEpoch = useRef(0);
  const registerLeaveGuard = useCallback<RegisterLeaveGuard>(guard => {
    leaveGuard.current = guard;
    return () => { if (leaveGuard.current === guard) leaveGuard.current = null; };
  }, []);
  const safelyLeave = useCallback(async (action: () => void | Promise<void>) => {
    if (leaving.current) return;
    leaving.current = true; setBusy(true);
    try { if (!leaveGuard.current || await leaveGuard.current()) await action(); }
    finally { leaving.current = false; setBusy(false); }
  }, []);
  const receiveSession = useCallback((next: Session) => {
    const id = next.user?.id ?? null;
    if (identity.current.id !== id) {
      const previousId = identity.current.id;
      identity.current = { id, epoch: identity.current.epoch + 1 };
      setProjects([]); setProjectsError(null); setCreating(false); setNewTitle(''); setNewDescription(''); projectRequest.current = null;
      if (previousId !== null || id === null) setSelectedId(null);
      setWalletAccessOpen(false);
    }
    setSessionToken(next); setSession(next); setSessionError(null);
  }, []);
  const loadSession = useCallback(async (signal?: AbortSignal) => {
    const epoch = identity.current.epoch;
    let accepted = false;
    setSessionLoading(true); setSessionError(null);
    try { const result = await api<Session>('/session', { signal }); if (!signal?.aborted && identity.current.epoch === epoch) { receiveSession(result); accepted = true; } }
    catch (cause) { if (!isAbort(cause) && identity.current.epoch === epoch) setSessionError(errorMessage(cause)); }
    finally { if (!signal?.aborted && (identity.current.epoch === epoch || accepted)) setSessionLoading(false); }
  }, [receiveSession]);
  useEffect(() => { const controller = new AbortController(); void loadSession(controller.signal); return () => controller.abort(); }, [loadSession]);
  useEffect(() => { window.history.replaceState({ ...window.history.state, pf_index: historyIndex.current }, '', window.location.href); }, []);
  useEffect(() => {
    const restore = () => {
      const index = window.history.state?.pf_index;
      const delta = Number.isInteger(index) ? historyIndex.current - index : 0;
      if (delta) { restoringHistory.current = true; window.history.go(delta); }
      else window.history.replaceState({ ...window.history.state, pf_index: historyIndex.current }, '', currentUrl.current);
    };
    const changed = () => {
      if (restoringHistory.current) {
        if (window.history.state?.pf_index === historyIndex.current) restoringHistory.current = false;
        else restore();
        return;
      }
      if (leaving.current) { popEpoch.current++; restore(); return; }
      const destination = window.location.href, next = initialNavigation();
      const index = Number.isInteger(window.history.state?.pf_index) ? window.history.state.pf_index : historyIndex.current;
      const epoch = ++popEpoch.current;
      leaving.current = true; setBusy(true);
      void (async () => {
        try {
          const allowed = !leaveGuard.current || await leaveGuard.current();
          if (popEpoch.current !== epoch) return;
          if (!allowed) { restore(); return; }
          historyIndex.current = index; currentUrl.current = destination; setNavigation(next);
          if (next.view === 'creator') {
            const requested = new URL(destination).searchParams.get('creator_project');
            setSelectedId(projects.some(project => project.id === requested) ? requested : projects[0]?.id ?? null);
          }
        } finally { leaving.current = false; setBusy(false); }
      })();
    };
    window.addEventListener('popstate', changed); return () => window.removeEventListener('popstate', changed);
  }, [projects]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (navigation.view === 'creator' && selectedId) url.searchParams.set('creator_project', selectedId);
    else url.searchParams.delete('creator_project');
    window.history.replaceState({ ...window.history.state, pf_index: historyIndex.current }, '', url); currentUrl.current = url.href;
  }, [navigation.view, selectedId]);
  function navigate(view: 'creator' | 'discover', publicId: string | null = null) {
    void safelyLeave(() => {
      const url = new URL(window.location.href); url.searchParams.set('view', view);
      if (publicId) url.searchParams.set('project', publicId); else url.searchParams.delete('project');
      historyIndex.current++;
      window.history.pushState({ pf_index: historyIndex.current }, '', url); currentUrl.current = url.href; setNavigation({ view, publicId });
    });
  }
  const loadProjects = useCallback(async (signal?: AbortSignal) => {
    const { id, epoch } = identity.current;
    if (!id) return;
    const requestEpoch = ++projectListEpoch.current;
    const isCurrent = () => !signal?.aborted && identity.current.id === id && identity.current.epoch === epoch && projectListEpoch.current === requestEpoch;
    setProjectsLoading(true); setProjectsError(null);
    try { const result = await api<{ projects: Project[] }>('/projects', { signal }); if (isCurrent()) { setProjects(result.projects); setSelectedId(current => result.projects.some(project => project.id === current) ? current : result.projects[0]?.id ?? null); } }
    catch (cause) { if (!isAbort(cause) && isCurrent()) setProjectsError(errorMessage(cause)); }
    finally { if (isCurrent()) setProjectsLoading(false); }
  }, []);
  useEffect(() => { if (sessionLoading) return; if (!session.user) { setProjects([]); setSelectedId(null); return; } const controller = new AbortController(); void loadProjects(controller.signal); return () => controller.abort(); }, [sessionLoading, session.user?.id, loadProjects]);
  const projectChanged = useCallback(() => { void loadProjects(); setPublicRevision(current => current + 1); }, [loadProjects]);
  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await safelyLeave(async () => {
    // A list read started before this create cannot remove the new project or
    // unmount its editor when that older response finally arrives.
    projectListEpoch.current++; setProjectsLoading(false);
    setProjectsError(null);
    const body={title:newTitle.trim(),description:newDescription.trim()},payload=JSON.stringify(body);
    if(projectRequest.current?.payload!==payload)projectRequest.current={payload,key:actionId()};
    try { const result = await api<{ project: Project }>('/projects', { method: 'POST', body, idempotencyKey:projectRequest.current!.key }); projectRequest.current=null;setProjects(current => [result.project, ...current.filter(project=>project.id!==result.project.id)]); setSelectedId(result.project.id); setCreating(false); setNewTitle(''); setNewDescription(''); }
    catch (cause) { setProjectsError(errorMessage(cause)); }
    });
  }
  async function logout() {
    await safelyLeave(async () => {
    try { await api('/auth/logout', { method: 'POST' }); receiveSession({ user: null, csrf_token: null }); setWalletAccessOpen(false); }
    catch (cause) { setSessionError(errorMessage(cause)); }
    });
  }
  const selected = projects.find(project => project.id === selectedId) ?? null;
  const accountLabel = session.user?.email ?? (session.user?.wallet_address ? shortWallet(session.user.wallet_address) : 'Cuenta');
  return <div className="app-shell"><a className="skip-link" href="#main-content">Ir al contenido</a>
    <header className="app-header"><a className="brand" href="/" onClick={event => { event.preventDefault(); navigate('creator'); }} aria-label="Promptfun, espacio de creación"><span className="brand-symbol" aria-hidden="true"><SquareTerminal size={24} /></span>promptfun</a>
      <nav className="main-navigation" aria-label="Navegación principal"><button aria-current={navigation.view === 'creator' ? 'page' : undefined} onClick={() => navigate('creator')}><FolderOpen size={17} aria-hidden="true" />Crear</button><button aria-current={navigation.view === 'discover' ? 'page' : undefined} onClick={() => navigate('discover')}><Compass size={17} aria-hidden="true" />Descubrir</button></nav>
      <div className="header-account"><span className="network-pill">Devnet</span>{session.user ? <><span className="account-email" title={session.user.email ?? session.user.wallet_address ?? undefined}>{accountLabel}</span><button className="text-button account-access" aria-expanded={walletAccessOpen} aria-controls="wallet-access" onClick={() => setWalletAccessOpen(current => !current)}>{session.user.email && !session.user.wallet_address ? 'Vincular acceso con wallet' : 'Acceso con wallet'}</button><button className="icon-button" aria-label="Cerrar sesión" onClick={logout} disabled={busy}><LogOut size={18} aria-hidden="true" /></button></> : <button className="text-button" onClick={() => navigate('creator')}>Entrar</button>}</div>
    </header><div className="environment-note">Entorno local de desarrollo. Las operaciones financieras usan exclusivamente Solana Devnet.</div>
    <main id="main-content" tabIndex={-1}><HealthNotice /><ErrorNotice message={sessionError} onRetry={() => void loadSession()} />
      {walletAccessOpen && session.user && <WalletAccess user={session.user} onAuthenticated={receiveSession} onClose={() => setWalletAccessOpen(false)} />}
      {navigation.view === 'discover' ? <Discover selectedId={navigation.publicId} onSelect={id => navigate('discover', id)} authenticated={Boolean(session.user)} viewerId={session.user?.id ?? null} onLogin={() => navigate('creator')} revision={publicRevision} /> : sessionLoading ? <div className="page-loading"><Loading>Abriendo tu espacio…</Loading></div> : !session.user ? <AuthPanel onAuthenticated={receiveSession} /> : <div className="creator-layout">
        <aside className="project-sidebar" aria-label="Mis proyectos"><div className="sidebar-heading"><h2>Mis proyectos</h2><button className="icon-button" aria-label="Crear un proyecto" aria-expanded={creating} onClick={() => setCreating(!creating)}><Plus size={20} aria-hidden="true" /></button></div>
          {creating && <form className="new-project-form" onSubmit={createProject}><label htmlFor="project-title">Nombre del proyecto</label><input id="project-title" autoFocus required maxLength={100} value={newTitle} onChange={event => setNewTitle(event.target.value)} disabled={busy} /><label htmlFor="project-description">Qué quieres resolver</label><textarea id="project-description" rows={3} maxLength={1000} value={newDescription} onChange={event => setNewDescription(event.target.value)} disabled={busy} /><button className="button button-primary full-width" disabled={!newTitle.trim() || busy}>{busy ? 'Guardando…' : 'Crear borrador'}</button></form>}
          <ErrorNotice message={projectsError} onRetry={() => void loadProjects()} />{projectsLoading && !projects.length ? <Loading>Cargando proyectos…</Loading> : <div className="private-project-list">{projects.map(project => <button className="private-project" key={project.id} aria-current={selectedId === project.id ? 'true' : undefined} onClick={() => void safelyLeave(() => { setSelectedId(project.id); setCreating(false); })}><span className="project-icon" aria-hidden="true"><SquareTerminal size={19} /></span><span><strong>{project.title}</strong><small>{project.published_version_id ? 'Con versión pública' : 'Borrador privado'}</small></span></button>)}</div>}
          <div className="sidebar-note"><span className="private-dot" />Tus prompts permanecen privados. Publicar comparte únicamente la versión que elijas.</div>
        </aside><div className="creator-content">{selected ? <Workbench key={`${session.user.id}:${selected.id}`} project={selected} viewerId={session.user.id} disabled={busy} registerLeaveGuard={registerLeaveGuard} onProjectChanged={projectChanged} /> : !projectsLoading && <EmptyState title="Empieza por una idea">Guarda un proyecto y conecta tu cuenta de IA para crear una primera versión.<button className="button button-primary" onClick={() => setCreating(true)}><Plus size={17} aria-hidden="true" />Crear un proyecto</button></EmptyState>}</div>
      </div>}
    </main><footer className="app-footer"><span>promptfun</span><span>Crea una demo. Comprueba el avance. Decide qué compartir.</span></footer>
  </div>;
}

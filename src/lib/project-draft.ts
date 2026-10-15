import type { ProjectDraft } from '../../shared/contracts';
import { ApiError, errorMessage } from './api';

export type DraftContent = Pick<ProjectDraft, 'prompt' | 'model' | 'base_version_id'>;
type DraftState = {
  content: DraftContent; loaded: boolean; revision: number;
  status: 'loading' | 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
  error: string | null; remote: ProjectDraft | null;
};
const empty = (): DraftContent => ({ prompt: '', model: '', base_version_id: null });
const contentOf = (draft: ProjectDraft): DraftContent => ({ prompt: draft.prompt, model: draft.model, base_version_id: draft.base_version_id });
const equal = (a: DraftContent, b: DraftContent) => a.prompt === b.prompt && a.model === b.model && a.base_version_id === b.base_version_id;

// A serial save queue keeps edits made during a request, including a lost acknowledgement.
// The server owns the revision; a conflict never silently overwrites either copy.
export class ProjectDraftController {
  private state: DraftState = { content: empty(), loaded: false, revision: 0, status: 'loading', error: null, remote: null };
  private saved = empty();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<boolean> | null = null;
  private unacknowledged: (DraftContent & { revision: number }) | null = null;
  private loading: Promise<void> | null = null;

  constructor(private read: () => Promise<ProjectDraft>, private write: (value: DraftContent & { revision: number }) => Promise<ProjectDraft>, private delay = 800) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<DraftState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  private isDirty = () => this.state.loaded && !equal(this.state.content, this.saved);
  hasUnsaved = () => this.isDirty() || this.inFlight !== null || this.unacknowledged !== null;
  stopTimer() { clearTimeout(this.timer); }

  load = async () => {
    if (this.state.loaded) return;
    if (this.loading) return this.loading;
    this.emit({ status: 'loading', error: null });
    this.loading = (async () => {
      try {
        const draft = await this.read(); this.saved = contentOf(draft);
        this.emit({ content: this.saved, loaded: true, revision: draft.revision, status: 'saved', error: null });
      } catch (cause) { this.emit({ status: 'error', error: errorMessage(cause) }); }
      finally { this.loading = null; }
    })();
    return this.loading;
  };

  update = (patch: Partial<DraftContent>) => {
    if (!this.state.loaded) return;
    const content = { ...this.state.content, ...patch };
    if (equal(content, this.state.content)) return;
    this.stopTimer();
    const conflict = this.state.status === 'conflict';
    this.emit({ content, status: conflict ? 'conflict' : this.inFlight ? 'saving' : equal(content, this.saved) && !this.unacknowledged ? 'saved' : 'pending', error: conflict ? this.state.error : null });
    if (!conflict && !this.inFlight && this.hasUnsaved()) this.timer = setTimeout(() => void this.flush(), this.delay);
  };

  flush = async (): Promise<boolean> => {
    this.stopTimer();
    if (!this.state.loaded || this.state.status === 'conflict') return false;
    if (this.inFlight) return this.inFlight;
    if (!this.hasUnsaved()) return true;
    this.inFlight = this.save();
    try { return await this.inFlight; } finally { this.inFlight = null; }
  };

  private async save() {
    while (this.isDirty() || this.unacknowledged) {
      // First acknowledge the exact ambiguous PUT, even if the editor has since
      // returned to its old value. Only then can we save that newer reversal.
      const attempt = this.unacknowledged ?? { ...this.state.content, revision: this.state.revision };
      this.unacknowledged = attempt;
      this.emit({ status: 'saving', error: null });
      try {
        const result = await this.write(attempt);
        this.unacknowledged = null;
        this.saved = contentOf(result);
        this.emit({ revision: result.revision });
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === 'DRAFT_CONFLICT') {
          this.unacknowledged = null;
          this.emit({ status: 'conflict', error: 'Otra pestaña guardó una revisión distinta. Tu texto sigue aquí; compara las dos copias antes de elegir.', remote: null });
          try { this.emit({ remote: await this.read() }); } catch { /* Keep the local copy and conflict until a manual read succeeds. */ }
        } else {
          // A definite rejection did not commit. Transport/5xx/unreadable replies
          // remain ambiguous and must not make navigation look safely saved.
          if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) this.unacknowledged = null;
          this.emit({ status: 'error', error: errorMessage(cause) });
        }
        return false;
      }
    }
    this.emit({ status: 'saved', error: null }); return true;
  }

  refreshConflict = async () => {
    try { this.emit({ remote: await this.read(), error: 'Compara las dos copias y elige cuál conservar.' }); }
    catch (cause) { this.emit({ error: errorMessage(cause) }); }
  };
  useRemote = () => {
    const remote = this.state.remote; if (!remote) return;
    this.stopTimer(); this.unacknowledged = null; this.saved = contentOf(remote);
    this.emit({ content: this.saved, revision: remote.revision, status: 'saved', remote: null, error: null });
  };
  keepLocal = async () => {
    const remote = this.state.remote; if (!remote) return false;
    this.unacknowledged = null;
    this.saved = contentOf(remote);
    this.emit({ revision: remote.revision, status: 'pending', remote: null, error: null });
    return this.flush();
  };
}

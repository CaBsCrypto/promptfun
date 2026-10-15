import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ProjectDraft } from '../../../shared/contracts';
import { api } from '../../lib/api';
import { ProjectDraftController } from '../../lib/project-draft';

export type RegisterLeaveGuard = (guard: () => Promise<boolean>) => () => void;

export function useProjectDraft(projectId: string, registerLeaveGuard: RegisterLeaveGuard) {
  // Workbench is keyed by identity + project, so neither unsaved text nor revisions cross accounts.
  const [controller] = useState(() => new ProjectDraftController(
    async () => (await api<{ draft: ProjectDraft }>(`/projects/${projectId}/draft`)).draft,
    async body => (await api<{ draft: ProjectDraft }>(`/projects/${projectId}/draft`, { method: 'PUT', body })).draft,
  ));
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  useEffect(() => { void controller.load(); return () => controller.stopTimer(); }, [controller]);
  useEffect(() => registerLeaveGuard(async () => !controller.hasUnsaved() || await controller.flush()), [controller, registerLeaveGuard]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (controller.hasUnsaved()) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [controller]);
  return { ...state, controller };
}

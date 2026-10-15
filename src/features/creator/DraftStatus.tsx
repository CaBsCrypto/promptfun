import type { ProjectDraftController } from '../../lib/project-draft';

export function DraftStatus({ controller }: { controller: ProjectDraftController }) {
  const state = controller.snapshot();
  const label = { loading: 'Cargando borrador…', saved: 'Guardado', pending: 'Cambios sin guardar', saving: 'Guardando…', error: 'Error al guardar', conflict: 'Conflicto entre revisiones' }[state.status];
  return <section className={`draft-status draft-${state.status}`} aria-label="Guardado del borrador">
    <p role="status">{label}<span className="field-hint"> · Borrador privado</span></p>
    {state.error && <p role="alert">{state.error}</p>}
    {state.status === 'error' && <button className="text-button" type="button" onClick={() => void (state.loaded ? controller.flush() : controller.load())}>Reintentar guardado</button>}
    {state.status === 'conflict' && <>
      {state.remote ? <><details open><summary>Revisión guardada en el servidor</summary><p className="field-hint">Modelo: {state.remote.model || 'Sin elegir'} · Base: {state.remote.base_version_id?.slice(0, 8) ?? 'Desde cero'}</p><pre className="draft-remote">{state.remote.prompt || '(Sin texto)'}</pre></details>
        <div className="button-row"><button className="button button-secondary" type="button" onClick={controller.useRemote}>Usar revisión del servidor</button><button className="button button-secondary" type="button" onClick={() => void controller.keepLocal()}>Guardar mi borrador sobre esta revisión</button></div></>
        : <button className="text-button" type="button" onClick={() => void controller.refreshConflict()}>Consultar revisión del servidor</button>}
    </>}
  </section>;
}

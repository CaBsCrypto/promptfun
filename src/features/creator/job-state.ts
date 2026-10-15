import type { GenerationJob, JobStatus } from '../../../shared/contracts';

type JobWithStatus = Pick<GenerationJob, 'status'> | null | undefined;

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'En cola',
  running: 'Generando',
  validating: 'Validando la versión',
  completed: 'Versión lista para revisar',
  failed: 'La generación falló',
  uncertain: 'Requiere revisión',
  cancelled: 'Trabajo cancelado',
  no_changes: 'Sin cambios en el artefacto',
};

export const USAGE_STATUS_LABELS: Record<GenerationJob['usage_status'], string> = {
  pending: 'Pendiente de reporte',
  reported: 'Reportado por el proveedor',
  unknown: 'Desconocido',
};

/** Execution alone determines whether a job is still progressing. */
export function isActiveJob(job: JobWithStatus): boolean {
  return job?.status === 'queued' || job?.status === 'running' || job?.status === 'validating';
}

/** An uncertain execution requires review; polling cannot settle that outcome. */
export function isPollingJob(job: JobWithStatus): boolean {
  return isActiveJob(job);
}

/** Settled means automatic execution stopped, not that it succeeded. */
export function isSettledJob(job: JobWithStatus): boolean {
  return job?.status === 'completed' || job?.status === 'failed' || job?.status === 'cancelled'
    || job?.status === 'no_changes' || job?.status === 'uncertain';
}

export function jobCostLabel(job: Pick<GenerationJob, 'cost_usd' | 'usage_status'>): string {
  if (job.cost_usd !== null) return `${job.cost_usd} USD`;
  if (job.usage_status === 'pending') return 'Pendiente';
  return job.usage_status === 'unknown' ? 'Desconocido' : 'No disponible';
}

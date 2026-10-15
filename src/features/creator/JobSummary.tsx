import { RefreshCw } from 'lucide-react';
import type { GenerationJob } from '../../../shared/contracts';
import { formatDate } from '../../lib/amounts';
import { ErrorNotice } from '../ui';
import { isSettledJob, JOB_STATUS_LABELS, jobCostLabel, USAGE_STATUS_LABELS } from './job-state';

export interface JobSummaryProps {
  job: GenerationJob;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  refreshError?: string | null;
}

export function JobSummary({ job, onRefresh, isRefreshing = false, refreshError = null }: JobSummaryProps) {
  const needsReview = job.status === 'uncertain';
  const usageHint = job.usage_status === 'reported'
    ? 'Consumo reportado por el proveedor. El recibo se registra por separado del resultado de la generación.'
    : job.usage_status === 'unknown'
      ? 'El consumo no pudo confirmarse. Los campos ausentes siguen desconocidos y no equivalen a cero.'
      : 'El consumo sigue pendiente de reporte. La versión puede estar lista antes de que llegue el recibo.';

  return <section className="job-summary" aria-label="Estado del trabajo">
    <div className="job-state" role="status">
      <span className={`state-dot ${isSettledJob(job) ? 'settled' : ''}`} aria-hidden="true" />
      <span>Ejecución: <strong>{JOB_STATUS_LABELS[job.status]}</strong></span>
      <span>{formatDate(job.created_at)}</span>
    </div>
    {needsReview && <>
      <p className="field-hint">La ejecución requiere revisión y permanece sin reenvío automático. Comprobar el estado consulta el trabajo guardado.</p>
    </>}
      {onRefresh && isSettledJob(job) && (needsReview || refreshError || job.usage_status !== 'reported') && <button type="button" className="button button-secondary" onClick={() => void onRefresh()} disabled={isRefreshing} aria-busy={isRefreshing}>
        <RefreshCw size={16} aria-hidden="true" />{isRefreshing ? 'Comprobando…' : 'Comprobar estado'}
      </button>}
    <div className="usage-row" role="group" aria-label="Consumo del proveedor">
      <span>Consumo <strong>{USAGE_STATUS_LABELS[job.usage_status]}</strong></span>
      <span>Modelo <strong>{job.model}</strong></span>
      <span>Entrada <strong>{job.prompt_tokens ?? 'No disponible'}</strong></span>
      <span>Salida <strong>{job.completion_tokens ?? 'No disponible'}</strong></span>
      <span>Coste <strong>{jobCostLabel(job)}</strong></span>
    </div>
    <p className="field-hint">{usageHint}</p>
    {job.error && <ErrorNotice message={job.error} />}
    <ErrorNotice message={refreshError} />
  </section>;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import type { GenerationJob, JobStatus } from '../shared/contracts';
import { isActiveJob, isPollingJob, isSettledJob, jobCostLabel } from '../src/features/creator/job-state';

function job(status: JobStatus, usage_status: GenerationJob['usage_status']): GenerationJob {
  return {
    id: 'job-test', project_id: 'project-test', base_version_id: null, status, usage_status,
    model: 'test-model:free', error: null, result_version_id: null,
    prompt_tokens: null, completion_tokens: null, cost_usd: null, created_at: '2026-10-15T12:00:00Z',
  };
}

test('uncertain execution stops automatic activity and polling even with a reported receipt', () => {
  for (const usage of ['pending', 'reported', 'unknown'] as const) {
    const uncertain = job('uncertain', usage);
    assert.equal(isActiveJob(uncertain), false);
    assert.equal(isPollingJob(uncertain), false);
    assert.equal(isSettledJob(uncertain), true);
  }
});

test('execution controls polling independently of receipt availability', () => {
  for (const usage of ['pending', 'reported', 'unknown'] as const) {
    for (const status of ['queued', 'running', 'validating'] as const) {
      const active = job(status, usage);
      assert.equal(isActiveJob(active), true);
      assert.equal(isPollingJob(active), true);
      assert.equal(isSettledJob(active), false);
    }
    for (const status of ['completed', 'failed', 'cancelled', 'no_changes'] as const) {
      const finished = job(status, usage);
      assert.equal(isActiveJob(finished), false);
      assert.equal(isPollingJob(finished), false);
      assert.equal(isSettledJob(finished), true);
    }
  }
  for (const missing of [null, undefined]) {
    assert.equal(isActiveJob(missing), false);
    assert.equal(isPollingJob(missing), false);
    assert.equal(isSettledJob(missing), false);
  }
});

test('cost labels preserve recorded precision and zero without filling absent amounts', () => {
  for (const usage_status of ['pending', 'reported', 'unknown'] as const) {
    assert.equal(jobCostLabel({ cost_usd: '0', usage_status }), '0 USD');
    assert.equal(jobCostLabel({ cost_usd: '0.0000000137', usage_status }), '0.0000000137 USD');
  }
  assert.equal(jobCostLabel({ cost_usd: null, usage_status: 'pending' }), 'Pendiente');
  assert.equal(jobCostLabel({ cost_usd: null, usage_status: 'unknown' }), 'Desconocido');
  assert.equal(jobCostLabel({ cost_usd: null, usage_status: 'reported' }), 'No disponible');
});

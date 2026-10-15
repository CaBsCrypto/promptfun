import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectDraft } from '../../shared/contracts';
import { ApiError } from './api';
import { ProjectDraftController, type DraftContent } from './project-draft';

const draft = (revision = 0, prompt = '', model = ''): ProjectDraft => ({ project_id: 'test-project', prompt, model, base_version_id: null, revision, updated_at: null });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };

test('draft serializes edits made during save and waits for the latest acknowledgement', async () => {
  const first = deferred<ProjectDraft>(); const calls: (DraftContent & { revision: number })[] = [];
  const controller = new ProjectDraftController(async () => draft(), async body => {
    calls.push(body); return calls.length === 1 ? first.promise : draft(body.revision + 1, body.prompt, body.model);
  }, 60000);
  try {
    await controller.load(); controller.update({ prompt: 'primero' });
    const saving = controller.flush(); controller.update({ prompt: 'último', model: 'chosen:free' });
    assert.equal(controller.hasUnsaved(), true); first.resolve(draft(1, 'primero'));
    assert.equal(await saving, true);
    assert.deepEqual(calls.map(call => [call.revision, call.prompt, call.model]), [[0, 'primero', ''], [1, 'último', 'chosen:free']]);
    assert.equal(controller.snapshot().status, 'saved'); assert.equal(controller.hasUnsaved(), false);
  } finally { controller.stopTimer(); }
});

test('returning to the original text during a save still protects navigation and saves the reversal', async () => {
  const first = deferred<ProjectDraft>(); let count = 0;
  const controller = new ProjectDraftController(async () => draft(3, 'original'), async body => ++count === 1 ? first.promise : draft(body.revision + 1, body.prompt), 60000);
  try {
    await controller.load(); controller.update({ prompt: 'temporal' }); const saving = controller.flush();
    controller.update({ prompt: 'original' }); assert.equal(controller.hasUnsaved(), true);
    first.resolve(draft(4, 'temporal')); assert.equal(await saving, true);
    assert.equal(count, 2); assert.equal(controller.snapshot().revision, 5); assert.equal(controller.snapshot().content.prompt, 'original');
  } finally { controller.stopTimer(); }
});

test('failed or lost save response retains text and only a confirmed retry reports saved', async () => {
  let calls = 0;
  const controller = new ProjectDraftController(async () => draft(), async () => {
    if (++calls === 1) throw new ApiError('Connection lost after sending', 0, 'NETWORK_ERROR');
    return draft(1, '  conservar espacios\ny líneas  ');
  }, 60000);
  try {
    await controller.load(); controller.update({ prompt: '  conservar espacios\ny líneas  ' });
    assert.equal(await controller.flush(), false); assert.equal(controller.snapshot().status, 'error');
    assert.equal(controller.hasUnsaved(), true); assert.equal(controller.snapshot().content.prompt, '  conservar espacios\ny líneas  ');
    assert.equal(await controller.flush(), true); assert.equal(controller.snapshot().status, 'saved'); assert.equal(calls, 2);
  } finally { controller.stopTimer(); }
});

test('conflict preserves the local copy until an explicit choice and detects a second concurrent revision', async () => {
  let remote = draft(2, 'otra pestaña'); const revisions: number[] = [];
  const controller = new ProjectDraftController(async () => remote, async body => {
    revisions.push(body.revision); throw new ApiError('Changed', 409, 'DRAFT_CONFLICT');
  }, 60000);
  try {
    await controller.load(); controller.update({ prompt: 'mi copia local' }); remote = draft(3, 'copia remota');
    assert.equal(await controller.flush(), false); assert.equal(controller.snapshot().status, 'conflict');
    assert.equal(controller.snapshot().content.prompt, 'mi copia local'); assert.equal(controller.snapshot().remote?.prompt, 'copia remota');
    assert.equal(await controller.flush(), false); assert.equal(revisions.length, 1);
    remote = draft(4, 'otra edición posterior'); assert.equal(await controller.keepLocal(), false);
    assert.deepEqual(revisions, [2, 3]); assert.equal(controller.snapshot().content.prompt, 'mi copia local');
    controller.useRemote(); assert.equal(controller.snapshot().content.prompt, 'otra edición posterior'); assert.equal(controller.hasUnsaved(), false);
  } finally { controller.stopTimer(); }
});

test('a failed initial read cannot overwrite the saved server draft with an empty form', async () => {
  let reads = 0, writes = 0;
  const controller = new ProjectDraftController(async () => { if (++reads === 1) throw new Error('unavailable'); return draft(7, 'privado'); }, async () => { writes++; return draft(); });
  await controller.load(); controller.update({ prompt: 'must not overwrite' });
  assert.equal(await controller.flush(), false); assert.equal(writes, 0);
  await controller.load(); assert.equal(controller.snapshot().content.prompt, 'privado'); assert.equal(controller.snapshot().revision, 7);
});

test('an ambiguous committed PUT cannot lose a reversal back to the previously saved text', async () => {
  const pending = deferred<void>(); let server = draft(3, 'original');
  const calls: (DraftContent & { revision: number })[] = [];
  const controller = new ProjectDraftController(async () => server, async body => {
    calls.push(body);
    if (calls.length === 1) { server = draft(4, body.prompt); await pending.promise; throw new ApiError('Acknowledgement lost', 0, 'NETWORK_ERROR'); }
    if (calls.length === 2) { assert.equal(body.revision, 3); assert.equal(body.prompt, 'temporal'); return server; }
    server = draft(body.revision + 1, body.prompt); return server;
  }, 60000);
  try {
    await controller.load(); controller.update({ prompt: 'temporal' }); const saving = controller.flush();
    controller.update({ prompt: 'original' }); pending.resolve();
    assert.equal(await saving, false); assert.equal(controller.hasUnsaved(), true);
    assert.equal(controller.snapshot().content.prompt, 'original'); assert.equal(server.prompt, 'temporal');
    assert.equal(await controller.flush(), true);
    assert.deepEqual(calls.map(call => [call.revision, call.prompt]), [[3, 'temporal'], [3, 'temporal'], [4, 'original']]);
    assert.equal(server.prompt, 'original'); assert.equal(controller.hasUnsaved(), false);
  } finally { controller.stopTimer(); }
});

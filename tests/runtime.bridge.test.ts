import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { APP_SDK, RUNTIME_BRIDGE } from '../server/runtime/sdk.js';

// Execute our SDK/bridge code with small DOM and HTTP doubles. No generated app,
// browser automation, live identity or cloud transport is implied by these tests.
function sdkRequest() {
  const messages: any[] = [], callbacks: Record<string, (...args: any[]) => void> = {};
  const window: any = {};
  runInNewContext(APP_SDK, { window, crypto: webcrypto, parent: { postMessage: (message: any) => messages.push(message) },
    addEventListener: (name: string, callback: any) => { callbacks[name] = callback; }, setTimeout: () => 1, clearTimeout: () => {} });
  void window.promptfun.records.create('tasks', { title: 'once' });
  return messages[0];
}
function bridge(fetchDouble: (url: string, init: RequestInit) => Promise<Response>) {
  const results: any[] = [], callbacks: Record<string, (...args: any[]) => any> = {};
  const source = { postMessage: (message: any) => results.push(message) };
  const elements: Record<string, any> = { app: { contentWindow: source }, status: { textContent: '' },
    auth: { addEventListener() {} }, verify: { addEventListener() {} }, logout: {} };
  runInNewContext(RUNTIME_BRIDGE, { document: { body: { dataset: { version: 'fixture-version' } }, getElementById: (id: string) => elements[id] },
    location: { pathname: '/apps/fixture-app/versions/fixture-version', search: '' }, URLSearchParams, AbortSignal,
    addEventListener: (name: string, callback: any) => { callbacks[name] = callback; }, fetch: fetchDouble });
  return { results, source, receive: callbacks.message };
}
test('SDK provides a random per-operation key and bridge preserves it across a transport retry', async () => {
  const first = sdkRequest(), second = sdkRequest();
  assert.match(first.args.request_id, /^[a-f0-9]{32}$/); assert.notEqual(first.args.request_id, second.args.request_id);
  const requests: { headers: Record<string, string>; body: string }[] = [];
  const gateway = bridge(async (url, init) => {
    if (url.endsWith('/session')) return Response.json({ user: null, csrf_token: 'test-session-csrf' });
    requests.push({ headers: init.headers as Record<string, string>, body: init.body as string });
    if (requests.length === 1) throw new TypeError('fixture connection lost');
    return Response.json({ record: { id: 'created-once', data: { title: 'once' } } }, { status: 201 });
  });
  await new Promise<void>(resolve => setImmediate(resolve));
  await gateway.receive({ source: gateway.source, origin: 'null', data: first });
  assert.equal(requests.length, 2); assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[0].headers['Idempotency-Key'], first.args.request_id);
  assert.equal(requests[0].headers['X-CSRF-Token'], 'test-session-csrf');
  assert.equal(gateway.results.length, 1); assert.equal(gateway.results[0].result.record.id, 'created-once');
  assert.doesNotMatch(JSON.stringify(gateway.results), /csrf|session_token|provider/);
});
test('bridge rejects a wrong sender/origin and never retries an authorization rejection', async () => {
  let requests = 0;
  const gateway = bridge(async (url) => {
    if (url.endsWith('/session')) return Response.json({ user: null, csrf_token: null });
    requests++; return Response.json({ error: { message: 'Capability denied' } }, { status: 403 });
  });
  await new Promise<void>(resolve => setImmediate(resolve)); const message = sdkRequest();
  await gateway.receive({ source: {}, origin: 'null', data: message });
  await gateway.receive({ source: gateway.source, origin: 'https://attacker.invalid', data: message });
  assert.equal(requests, 0); assert.equal(gateway.results.length, 0);
  await gateway.receive({ source: gateway.source, origin: 'null', data: message });
  assert.equal(requests, 1); assert.equal(gateway.results.length, 1); assert.equal(gateway.results[0].error, 'Capability denied');
});

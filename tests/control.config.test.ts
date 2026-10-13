import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../server/config.js';
import { canonicalEndpoint } from '../server/control/database.js';

function configured(patch: Record<string, string | undefined>, check: () => void) {
  const values = {
    NODE_ENV: 'test', BACKEND_PROVIDER: 'neon',
    PLATFORM_ORIGIN: 'http://localhost:3000', RUNTIME_ORIGIN: 'http://127.0.0.1:4000',
    CONTROL_DATABASE_URL: 'postgresql://owner:fixture@ep-control.neon.tech/control',
    APPS_DATABASE_URL: 'postgresql://owner:fixture@ep-apps.neon.tech/apps',
    CONTROL_AUTH_URL: '', APPS_AUTH_URL: '',
    ...patch,
  };
  const previous = new Map(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    check();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test('startup rejects pooled/direct aliases of the same database regardless of credentials', () => {
  configured({ CONTROL_DATABASE_URL: 'postgresql://reader:one@EP-PROJECT-pooler.neon.tech.:5432/%64b?sslmode=require',
    APPS_DATABASE_URL: 'postgres://writer:two@ep-project.neon.tech/db?sslmode=verify-full' }, () => {
    assert.throws(loadConfig, /independent databases/);
  });
  configured({ CONTROL_DATABASE_URL: 'postgresql://reader:one@localhost:5432/db',
    APPS_DATABASE_URL: 'postgresql://writer:two@127.0.0.1:5432/db' }, () => {
    assert.throws(loadConfig, /independent databases/);
  });
});

test('startup distinguishes actual database names on one direct/pooled Neon endpoint', () => {
  configured({ CONTROL_DATABASE_URL: 'postgresql://owner:fixture@ep-project-pooler.neon.tech/control',
    APPS_DATABASE_URL: 'postgresql://owner:fixture@ep-project.neon.tech/apps' }, () => {
    assert.equal(loadConfig().appsDatabaseUrl, 'postgresql://owner:fixture@ep-project.neon.tech/apps');
  });
});

test('Auth issuer aliases are rejected while independent paths remain normalized', () => {
  configured({ CONTROL_AUTH_URL: 'https://AUTH.example.invalid:443/platform///',
    APPS_AUTH_URL: 'https://auth.example.invalid/platform' }, () => {
    assert.throws(loadConfig, /independent Auth issuers/);
  });
  configured({ CONTROL_AUTH_URL: 'https://AUTH.example.invalid:443/platform/',
    APPS_AUTH_URL: 'https://auth.example.invalid/apps///' }, () => {
    const config = loadConfig();
    assert.equal(config.controlAuthUrl, 'https://auth.example.invalid/platform');
    assert.equal(config.appsAuthUrl, 'https://auth.example.invalid/apps');
  });
  assert.throws(() => canonicalEndpoint('https://secret@example.invalid/auth'), /Invalid service endpoint/);
  assert.throws(() => canonicalEndpoint('https://example.invalid/auth?issuer=other'), /Invalid service endpoint/);
});

test('empty bootstrap configuration still exposes unconfigured Auth and distinct local database defaults', () => {
  configured({ CONTROL_DATABASE_URL: undefined, APPS_DATABASE_URL: undefined,
    CONTROL_AUTH_URL: undefined, APPS_AUTH_URL: undefined }, () => {
    const config = loadConfig();
    assert.equal(config.controlAuthUrl, ''); assert.equal(config.appsAuthUrl, '');
    assert.equal(new URL(config.controlDatabaseUrl).port, '54322');
    assert.equal(new URL(config.appsDatabaseUrl).port, '55322');
  });
});

import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import type { Config } from './shared.js';
import { canonicalEndpoint, databaseIdentity } from './control/database.js';

export function loadConfig(): Config {
  const production = process.env.NODE_ENV === 'production';
  const secret = (name: string) => {
    const value = process.env[name];
    if (!value && production) throw new Error(`${name} is required in production`);
    // Development without .env can render diagnostics, but cannot persist grants across restarts.
    return value || randomBytes(32).toString('base64');
  };
  const platformOrigin = process.env.PLATFORM_ORIGIN || 'http://localhost:3000';
  const runtimeOrigin = process.env.RUNTIME_ORIGIN || 'http://127.0.0.1:4000';
  if (new URL(platformOrigin).hostname === new URL(runtimeOrigin).hostname)
    throw new Error('Platform and runtime must use separate hostnames, not just separate ports');
  const backendProvider = process.env.BACKEND_PROVIDER === 'supabase' ? 'supabase' : 'neon';
  const controlAuthUrl = canonicalEndpoint(process.env.CONTROL_AUTH_URL);
  const appsAuthUrl = canonicalEndpoint(process.env.APPS_AUTH_URL);
  const controlDatabaseUrl = process.env.CONTROL_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const appsDatabaseUrl = process.env.APPS_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';
  if (controlAuthUrl && controlAuthUrl === appsAuthUrl)
    throw new Error('Platform and app identities require independent Auth issuers');
  if (databaseIdentity(controlDatabaseUrl) === databaseIdentity(appsDatabaseUrl))
    throw new Error('Platform and apps require independent databases');
  if (production && [platformOrigin,runtimeOrigin].some(origin=>new URL(origin).protocol!=='https:'))
    throw new Error('Production platform and runtime require HTTPS');
  return {
    backendProvider,
    controlAuthUrl, appsAuthUrl,
    neonStorageEndpoint: process.env.NEON_STORAGE_ENDPOINT || '',
    neonStorageAccessKeyId: process.env.NEON_STORAGE_ACCESS_KEY_ID || '',
    neonStorageSecretAccessKey: process.env.NEON_STORAGE_SECRET_ACCESS_KEY || '',
    neonStorageBucket: process.env.NEON_STORAGE_BUCKET || 'app-files',
    neonStorageRegion: process.env.NEON_STORAGE_REGION || 'us-east-1',
    controlDatabaseUrl, appsDatabaseUrl,
    controlSupabaseUrl: process.env.CONTROL_SUPABASE_URL || 'http://127.0.0.1:54321',
    controlPublishableKey: process.env.CONTROL_PUBLISHABLE_KEY || '',
    appsSupabaseUrl: process.env.APPS_SUPABASE_URL || 'http://127.0.0.1:55321',
    appsPublishableKey: process.env.APPS_PUBLISHABLE_KEY || '',
    appsSecretKey: process.env.APPS_SECRET_KEY || '',
    platformOrigin, runtimeOrigin,
    encryptionKey: secret('ENCRYPTION_KEY'), runtimeSigningKey: secret('RUNTIME_SIGNING_KEY'),
    openRouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    marketProgramId: process.env.MARKET_PROGRAM_ID || '',
    registrarKeyPath: process.env.MARKET_REGISTRAR_KEY_PATH || '', production,
  };
}

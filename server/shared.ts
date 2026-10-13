import type { Pool } from 'pg';
import type { Request } from 'express';
import type { PlatformUser } from '../shared/contracts.js';

export interface Config {
  backendProvider?: 'neon' | 'supabase';
  controlAuthUrl?: string; appsAuthUrl?: string;
  neonStorageEndpoint?: string; neonStorageAccessKeyId?: string;
  neonStorageSecretAccessKey?: string; neonStorageBucket?: string; neonStorageRegion?: string;
  controlDatabaseUrl: string; appsDatabaseUrl: string;
  controlSupabaseUrl: string; controlPublishableKey: string;
  appsSupabaseUrl: string; appsPublishableKey: string; appsSecretKey: string;
  platformOrigin: string; runtimeOrigin: string;
  encryptionKey: string; runtimeSigningKey: string;
  openRouterBaseUrl: string; solanaRpcUrl: string; marketProgramId: string;
  registrarKeyPath: string; production: boolean;
}
export interface CoreContext { control: Pool; apps: Pool; config: Config }
export interface AuthenticatedUser extends PlatformUser { csrf_token: string; session_id: string }
export type Authenticate = (req: Request) => Promise<AuthenticatedUser>;
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function asyncRoute(handler: (req: any, res: any) => Promise<any>) {
  return (req: any, res: any, next: any) => { Promise.resolve(handler(req, res)).catch(next); };
}
export function assertOrigin(req: Request, expected: string) {
  if (req.get('origin') !== expected) throw new HttpError(403, 'INVALID_ORIGIN', 'Origen de solicitud no permitido.');
}

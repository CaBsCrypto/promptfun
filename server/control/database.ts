import type { PoolConfig } from 'pg';

/** pg replaces an ssl object when SSL URL parameters are also present.
 * https://node-postgres.com/features/ssl#usage-with-connectionstring
 * Migration/backup session locks require Neon's direct endpoint.
 * https://neon.com/docs/connect/connection-pooling
 */
export function databaseOptions(connectionString: string, direct = false): PoolConfig & { enableChannelBinding: boolean } {
  let url: URL; try { url = new URL(connectionString); } catch { throw new Error('Invalid database URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1) || url.hash) throw new Error('Invalid database URL.');
  // pg accepts query parameters that override the URL authority. Keeping one
  // destination avoids checking isolation/TLS against a different host.
  if (['host', 'port', 'database'].some(key => url.searchParams.has(key))) throw new Error('Database routing must be specified in the URL authority and path.');
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (direct && /\.neon\.tech$/i.test(url.hostname)) url.hostname = url.hostname.replace(/-pooler(?=\.)/i, '');
  if (direct && /pooler/i.test(url.hostname)) throw new Error('Administrative operations require a direct database URL.');
  const mode = url.searchParams.get('sslmode');
  if (!local && mode && !['require', 'verify-ca', 'verify-full'].includes(mode)) throw new Error('Cloud databases require verified TLS.');
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat', 'sslnegotiation']) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: local && (!mode || mode === 'disable') ? false : { rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000, statement_timeout: 30_000, max: 4, enableChannelBinding: !local };
}
export function databaseIdentity(connectionString: string) {
  const normalized = new URL(databaseOptions(connectionString, true).connectionString!);
  const host = ['localhost', '127.0.0.1', '[::1]'].includes(normalized.hostname) ? 'loopback' : normalized.hostname;
  // Match pg's decoding of the database path; database names remain case sensitive.
  return `${host}:${normalized.port || '5432'}/${decodeURI(normalized.pathname.slice(1))}`;
}

/** Credential-free HTTP endpoint identity. Empty configuration is intentional
 * during bootstrap so the server can report which services remain unconfigured. */
export function canonicalEndpoint(value: string | undefined): string {
  if (!value) return '';
  let url: URL; try { url = new URL(value); } catch { throw new Error('Invalid service endpoint URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid service endpoint URL.');
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}

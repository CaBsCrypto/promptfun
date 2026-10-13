import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { HttpError, type Config } from '../shared.js';

export interface ObjectMetadata { size_bytes: number; sha256: string }
export interface ObjectStore {
  put(path: string, bytes: Buffer): Promise<void>;
  get(path: string, expected: ObjectMetadata): Promise<Buffer>;
  delete(path: string): Promise<void>;
  isEmpty(): Promise<boolean>;
}
const MAX_BYTES = 5242880;
function objectPath(path: string) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/i.test(path)) throw new HttpError(400, 'INVALID_OBJECT', 'Ruta de archivo inválida.');
  return path;
}
async function bounded(stream: AsyncIterable<Uint8Array>, expected: ObjectMetadata) {
  if (!Number.isSafeInteger(expected.size_bytes) || expected.size_bytes < 1 || expected.size_bytes > MAX_BYTES || !/^[a-f0-9]{64}$/.test(expected.sha256))
    throw new HttpError(503, 'STORAGE_INTEGRITY', 'Los metadatos del archivo son inválidos.');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > expected.size_bytes) throw new HttpError(503, 'STORAGE_INTEGRITY', 'El archivo supera el tamaño registrado.');
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks);
  if (size !== expected.size_bytes || createHash('sha256').update(bytes).digest('hex') !== expected.sha256)
    throw new HttpError(503, 'STORAGE_INTEGRITY', 'El archivo no coincide con su copia registrada.');
  return bytes;
}
function privateEndpoint(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Storage requires a credential-free HTTPS endpoint');
  return url.toString();
}
/** All credentials and S3 calls remain behind the authenticated app gateway. */
export function createObjectStore(config: Config): ObjectStore {
  let client: S3Client | undefined;
  const s3 = () => {
    if (!config.neonStorageEndpoint || !config.neonStorageAccessKeyId || !config.neonStorageSecretAccessKey)
      throw new HttpError(503, 'STORAGE_UNCONFIGURED', 'Falta configurar el almacenamiento privado de las apps.');
    return client ||= new S3Client({ endpoint: privateEndpoint(config.neonStorageEndpoint), region: config.neonStorageRegion || 'us-east-1',
      credentials: { accessKeyId: config.neonStorageAccessKeyId, secretAccessKey: config.neonStorageSecretAccessKey },
      forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', maxAttempts: 2 });
  };
  const bucket = config.neonStorageBucket || 'app-files';
  const isNeon = config.backendProvider === 'neon';
  const headers = () => {
    if (!config.appsSecretKey) throw new HttpError(503, 'STORAGE_UNCONFIGURED', 'Falta configurar el almacenamiento privado.');
    return { apikey: config.appsSecretKey, Authorization: 'Bearer ' + config.appsSecretKey };
  };
  const send = async (command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand | ListObjectsV2Command) => {
    try { return await s3().send(command as any, { abortSignal: AbortSignal.timeout(30000) }) as any; }
    catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'El almacenamiento no está disponible.'); }
  };
  return {
    async put(path, bytes) {
      objectPath(path);
      if (!bytes.length || bytes.length > MAX_BYTES) throw new HttpError(400, 'FILE_SIZE', 'Archivo vacío o mayor que 5 MiB.');
      if (isNeon) { await send(new PutObjectCommand({ Bucket: bucket, Key: path, Body: bytes, ContentType: 'application/octet-stream' })); return; }
      const res = await fetch(`${config.appsSupabaseUrl}/storage/v1/object/app-files/${path}`, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(bytes), redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'No se pudo guardar el archivo.');
    },
    async get(path, expected) {
      objectPath(path);
      if (isNeon) {
        const response = await send(new GetObjectCommand({ Bucket: bucket, Key: path }));
        if (!response.Body || response.ContentLength !== expected.size_bytes) { response.Body?.destroy?.(); throw new HttpError(503, 'STORAGE_INTEGRITY', 'El archivo no coincide con el tamaño registrado.'); }
        try { return await bounded(response.Body, expected); } finally { response.Body.destroy?.(); }
      }
      const response = await fetch(`${config.appsSupabaseUrl}/storage/v1/object/authenticated/app-files/${path}`, { headers: headers(), redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (!response.ok || !response.body) throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'El archivo no está disponible.');
      return bounded(response.body as unknown as AsyncIterable<Uint8Array>, expected);
    },
    async delete(path) {
      objectPath(path);
      if (isNeon) { await send(new DeleteObjectCommand({ Bucket: bucket, Key: path })); return; }
      const res = await fetch(`${config.appsSupabaseUrl}/storage/v1/object/app-files`, { method: 'DELETE', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }), redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'No se pudo retirar el archivo.');
    },
    async isEmpty() {
      if (isNeon) { const response = await send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 })); return !response.Contents?.length && !response.IsTruncated; }
      const response = await fetch(`${config.appsSupabaseUrl}/storage/v1/object/list/app-files`, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 1 }), redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'No se pudo verificar el contenedor.');
      const data = await response.json(); return Array.isArray(data) && !data.length;
    },
  };
}

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CoreContext } from '../shared.js';
import { HttpError } from '../shared.js';
import type { CapabilityManifest } from '../../shared/contracts.js';

export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const COLLECTIONS = ['tasks', 'notes', 'items', 'attachments'] as const;
export const nonce = () => randomBytes(32).toString('base64url');
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function equalSecret(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function encryptSecret(value: string, secret: string) {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
  const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), bytes.toString('base64url')].join('.');
}
export function decryptSecret(value: string, secret: string) {
  const [version, iv, tag, ciphertext, extra] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext || extra) throw new Error('Invalid encrypted secret');
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
export function textInput(value: unknown, name: string, max: number, optional = false): string {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max)
    throw new HttpError(422, 'INVALID_INPUT', `${name} inválido.`);
  return value.trim();
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    throw new HttpError(422, 'INVALID_ID', 'Identificador inválido.');
  return value;
}
export function validateManifest(value: unknown): CapabilityManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(422, 'INVALID_MANIFEST', 'Manifiesto inválido.');
  const m = value as any;
  if (Object.keys(m).some(k => !['version', 'records', 'auth', 'files', 'connectors'].includes(k)) ||
      m.version !== 1 || typeof m.auth !== 'boolean' || typeof m.files !== 'boolean' ||
      !m.records || Object.keys(m.records).some(k => k !== 'collections') || !Array.isArray(m.records.collections) ||
      m.records.collections.length > 4 || new Set(m.records.collections).size !== m.records.collections.length ||
      m.records.collections.some((c: unknown) => typeof c !== 'string' || !(COLLECTIONS as readonly string[]).includes(c)) ||
      !Array.isArray(m.connectors) || m.connectors.length > 1 || m.connectors.some((c: unknown) => c !== 'github.repository'))
    throw new HttpError(422, 'INVALID_MANIFEST', 'Las capacidades solicitadas no están permitidas.');
  return { version: 1, records: { collections: [...m.records.collections] }, auth: m.auth, files: m.files, connectors: [...m.connectors] };
}
export function assertNoSecrets(value: string) {
  if (/(?:sk-or-v1-[a-z0-9]{10,}|AIza[\w-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:service_role|api_key|apikey|access_token|refresh_token|secret_key)\s*["']?\s*[:=]\s*["'][^"']{12,}["'])/i.test(value))
    throw new HttpError(422, 'SECRET_IN_ARTIFACT', 'El contenido incluye una credencial y no puede importarse ni guardarse.');
}
export function validateHtml(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value, 'utf8') > MAX_HTML_BYTES ||
      !/<(?:!doctype\s+html|html|body)\b/i.test(value)) throw new HttpError(422, 'INVALID_HTML', 'Artefacto HTML inválido o demasiado grande.');
  assertNoSecrets(value);
  return value;
}
export function artifactHash(html: string, manifest: CapabilityManifest) {
  return hash(JSON.stringify({ html, manifest }));
}
export function signPreviewToken(ctx: CoreContext, projectId: string, versionId: string, subject: string, ttl = 300) {
  const payload = Buffer.from(JSON.stringify({ type: 'preview', app_id: projectId, version_id: versionId, sub: subject, exp: Math.floor(Date.now() / 1000) + ttl })).toString('base64url');
  return `${payload}.${createHmac('sha256', ctx.config.runtimeSigningKey).update(payload).digest('base64url')}`;
}
export function idempotencyKey(value: unknown) {
  if (typeof value !== 'string' || !/^[\w.-]{8,128}$/.test(value)) throw new HttpError(422, 'IDEMPOTENCY_REQUIRED', 'Incluye una clave idempotente de 8 a 128 caracteres.');
  return value;
}

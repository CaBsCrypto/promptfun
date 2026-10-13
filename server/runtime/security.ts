import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../shared.js';

export function verifyPreviewToken(token: string, key: string, appId: string, versionId: string) {
  try {
    const [payload, signature, extra] = token.split('.');
    if (extra || !payload || !signature || token.length > 4096) throw new Error();
    const expected = createHmac('sha256', key).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error();
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (claims.type !== 'preview' || claims.app_id !== appId || claims.version_id !== versionId ||
      !claims.sub || !Number.isSafeInteger(claims.exp) || claims.exp <= Math.floor(Date.now()/1000)) throw new Error();
    return claims as { sub: string; app_id: string; version_id: string; exp: number };
  } catch { throw new HttpError(403, 'INVALID_PREVIEW', 'La vista previa caducó o no está autorizada. Ábrela nuevamente desde tu proyecto.'); }
}
export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}
export function artifactCsp(runtimeOrigin: string, platformOrigin: string) {
  return `default-src 'none'; script-src 'unsafe-inline' ${runtimeOrigin}; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; sandbox allow-scripts allow-forms; frame-ancestors ${runtimeOrigin} ${platformOrigin}`;
}

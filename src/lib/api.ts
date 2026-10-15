import type { ApiErrorBody, Session } from '../../shared/contracts';

let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setSessionToken(session: Session) {
  csrfToken = session.csrf_token;
}

export async function api<T>(path: string, options: {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
} = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method, headers, credentials: 'same-origin', signal: options.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('No podemos conectar con el servidor. Conserva tu borrador e inténtalo de nuevo.', 0, 'NETWORK_ERROR');
  }
  const body = await response.json().catch(() => null) as T | ApiErrorBody | null;
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'error' in body ? body.error : null;
    throw new ApiError(detail?.message ?? `La operación no se completó (HTTP ${response.status}).`, response.status, detail?.code ?? 'HTTP_ERROR');
  }
  if (body === null && response.status !== 204) {
    throw new ApiError('El servidor devolvió una respuesta que no podemos leer.', response.status, 'INVALID_RESPONSE');
  }
  return body as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No pudimos completar esta acción. Inténtalo de nuevo.';
}

export function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function actionId() {
  return crypto.randomUUID();
}

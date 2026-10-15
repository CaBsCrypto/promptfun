import { HttpError, type AuthenticatedUser } from '../shared.js';

export function assertNonDemo(user: Pick<AuthenticatedUser, 'is_demo'>) {
  if (user.is_demo) throw new HttpError(403, 'LOCAL_DEMO_ONLY', 'La demo permite probar proyectos y borradores privados. Entra con correo o wallet para usar IA, publicar u operar en Devnet.');
}

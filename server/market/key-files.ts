import { isAbsolute, relative, sep } from 'node:path';

// Arguments must already be canonical absolute paths when filesystem access is
// involved. A child named "..keys" is still inside the repository.
export function isOutsideDirectory(root: string, candidate: string): boolean {
  const scope = relative(root, candidate);
  return scope === '..' || scope.startsWith(`..${sep}`) || isAbsolute(scope);
}

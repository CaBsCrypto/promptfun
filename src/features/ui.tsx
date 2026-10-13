import type { ReactNode } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';

export function ErrorNotice({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return <div className="notice notice-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><div>{message}{onRetry && <button className="text-button" onClick={onRetry}>Volver a intentar</button>}</div></div>;
}

export function Loading({ children = 'Cargando…' }: { children?: ReactNode }) {
  return <p className="loading" role="status"><LoaderCircle className="spinner" size={18} aria-hidden="true" />{children}</p>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-glyph" aria-hidden="true"><span /><span /><span /></div><h2>{title}</h2>{children && <p>{children}</p>}{action}</div>;
}

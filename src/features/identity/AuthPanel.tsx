import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import type { Session } from '../../../shared/contracts';
import type { WalletName } from '../../lib/wallet';
import { api, errorMessage } from '../../lib/api';
import { authenticateWallet } from './walletAuth';
import { ErrorNotice } from '../ui';

export function AuthPanel({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function walletLogin(name: WalletName) {
    setBusy(true); setError(null); setNotice(null);
    try { const session = await authenticateWallet(name, 'login'); setPassword(''); onAuthenticated(session); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      if (mode === 'verify') {
        await api('/auth/verify-email', { method: 'POST', body: { email: email.trim(), otp: otp.trim() } });
        setOtp(''); setPassword(''); setMode('login');
        setNotice('Correo confirmado. Entra con tu contraseña.');
        return;
      }
      const result = await api<Session & { confirmation_required?: boolean }>(`/auth/${mode}`, { method: 'POST', body: { email: email.trim(), password } });
      if (result.confirmation_required) {
        setPassword(''); setOtp(''); setMode('verify');
        setNotice('Revisa tu correo e introduce el código de verificación que recibiste.');
        return;
      }
      const session = await api<Session>('/session');
      if (!session.user) throw new Error('No se abrió la sesión. Intenta entrar nuevamente.');
      setPassword(''); onAuthenticated(session);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <section className="auth-layout">
    <div className="auth-intro"><div className="studio-illustration" aria-hidden="true"><div className="studio-sheet"><span /><span /><span /><div className="studio-result"><i /><i /><i /></div></div><div className="studio-cursor" /></div><h1>De tu idea a una versión que puedes probar.</h1><p>Crea, revisa y decide qué compartir. Tu primera demo no necesita una wallet.</p><div className="inline-facts"><span>Borradores privados</span><span>Tu cuenta de IA</span><span>Publicación consciente</span></div></div>
    <div className="auth-panel"><h2>{mode === 'verify' ? 'Confirma tu correo' : mode === 'login' ? 'Entra a tu espacio' : 'Crea tu cuenta'}</h2><p className="muted">Entra con correo o wallet. Tu cuenta guarda los proyectos; OpenRouter y las operaciones de cada proyecto se conectan por separado.</p>
      <div className="wallet-auth-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => void walletLogin('phantom')}>Entrar con Phantom</button><button type="button" className="button button-secondary" disabled={busy} onClick={() => void walletLogin('solflare')}>Entrar con Solflare</button></div>
      <p className="field-hint wallet-sign-note">Firmas un mensaje, sin transacción ni SOL. La primera firma crea tu cuenta si todavía no existe.</p>
      <div className="auth-divider"><span>O usa tu correo</span></div>
      <form onSubmit={submit}><label htmlFor="auth-email">Correo</label><input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy || mode === 'verify'} />
        {mode === 'verify' ? <><label htmlFor="auth-otp">Código de verificación</label><input id="auth-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]+" required minLength={4} maxLength={12} value={otp} onChange={event => setOtp(event.target.value)} disabled={busy} aria-describedby="auth-notice" autoFocus /></> : <><label htmlFor="auth-password">Contraseña</label><input id="auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 12 : undefined} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
          {mode === 'signup' && <span className="field-hint">Usa al menos 12 caracteres.</span>}</>}
        {notice && <p id="auth-notice" className="notice notice-info" role="status">{notice}</p>}<ErrorNotice message={error} />
        <button className="button button-primary full-width" disabled={busy}><LogIn size={17} aria-hidden="true" />{busy ? mode === 'verify' ? 'Verificando…' : 'Conectando…' : mode === 'verify' ? 'Confirmar correo' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
      </form><button type="button" className="text-button auth-switch" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setNotice(null); setOtp(''); setPassword(''); }}>{mode === 'verify' ? 'Volver a iniciar sesión' : mode === 'login' ? 'Crear una cuenta nueva' : 'Ya tengo una cuenta'}</button>
    </div>
  </section>;
}

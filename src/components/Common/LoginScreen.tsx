import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Lock, LogIn, Mail, UserPlus } from 'lucide-react';
import { CalandriaMark } from '../../calandria/CalandriaUI';
import { registerAccount, requestPasswordReset, resetPassword, signIn } from '../../lib/api';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export const LoginScreen: React.FC = () => {
  const resetToken = new URLSearchParams(window.location.search).get('reset') || '';
  const [mode, setMode] = useState<AuthMode>(resetToken ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSending(true);

    if (mode === 'login') {
      const err = await signIn(email, password);
      if (err) setError(err);
    } else if (mode === 'register') {
      const result = await registerAccount(email, password);
      if (result.error) setError(result.error);
      else if (result.message) setNotice(result.message);
    } else if (mode === 'forgot') {
      const result = await requestPasswordReset(email);
      if (result.error) setError(result.error);
      else setNotice(result.message || 'Si el email está registrado, recibirás un enlace para restablecer la contraseña.');
    } else if (mode === 'reset') {
      if (!resetToken) {
        setError('El enlace no es válido o venció. Solicitá uno nuevo.');
      } else if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
      } else {
        const err = await resetPassword(password);
        if (err) setError(err);
        else {
          window.history.replaceState({}, '', window.location.pathname);
          setMode('login');
          setPassword('');
          setConfirmPassword('');
          setNotice('Contraseña actualizada. Ya podés ingresar.');
        }
      }
    }
    setSending(false);
  };

  const heading = {
    login: 'Acceso al sistema',
    register: 'Crear cuenta',
    forgot: 'Recuperar contraseña',
    reset: 'Elegir nueva contraseña',
  }[mode];

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} data-testid="login-form" className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6 space-y-4">
        <div className="flex flex-col items-center gap-1.5 pb-1">
          <CalandriaMark className="w-14 h-16" />
          <div className="font-bold text-xl text-slate-900 tracking-tight">Golondrina</div>
          <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
            {mode === 'forgot' || mode === 'reset' ? <KeyRound className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {heading}
          </p>
        </div>

        {mode !== 'reset' && (
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-700">Email</span>
            <input type="email" required maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
        )}

        {(mode === 'login' || mode === 'register' || mode === 'reset') && (
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-700">{mode === 'login' ? 'Contraseña' : 'Contraseña nueva'}</span>
            <input type="password" required minLength={mode === 'login' ? 1 : 12} maxLength={200}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 12 caracteres"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
        )}

        {mode === 'reset' && (
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-700">Repetir contraseña nueva</span>
            <input type="password" required minLength={12} maxLength={200} autoComplete="new-password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repetí la contraseña"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
        )}

        {error && <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>}
        {notice && <p role="status" className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{notice}</p>}

        <button type="submit" disabled={sending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold">
          {mode === 'register' ? <UserPlus className="w-4 h-4" /> : mode === 'forgot' ? <Mail className="w-4 h-4" /> : mode === 'reset' ? <KeyRound className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
          {sending ? 'Procesando…' : mode === 'register' ? 'Crear cuenta' : mode === 'forgot' ? 'Enviar enlace' : mode === 'reset' ? 'Guardar contraseña' : 'Ingresar'}
        </button>

        <div className="flex flex-col items-center gap-2 text-xs">
          {mode === 'login' && <>
            <button type="button" onClick={() => changeMode('forgot')} className="font-semibold text-indigo-700 hover:text-indigo-900">Olvidé mi contraseña</button>
            <p className="text-slate-500">¿Primera vez? <button type="button" onClick={() => changeMode('register')} className="font-bold text-indigo-700 hover:text-indigo-900">Crear cuenta</button></p>
          </>}
          {mode === 'register' && <p className="text-slate-500">¿Ya tenés cuenta? <button type="button" onClick={() => changeMode('login')} className="font-bold text-indigo-700 hover:text-indigo-900">Ingresar</button></p>}
          {(mode === 'forgot' || mode === 'reset') && <button type="button" onClick={() => changeMode('login')} className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900"><ArrowLeft className="w-3.5 h-3.5" /> Volver al ingreso</button>}
        </div>
        <p className="text-center text-[11px] text-slate-400">una solución de <b className="text-slate-600">tecnoros.ar</b></p>
      </form>
    </div>
  );
};

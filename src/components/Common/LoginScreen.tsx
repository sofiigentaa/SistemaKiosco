import React, { useState } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { CalandriaMark } from '../../calandria/CalandriaUI';
import { signIn } from '../../lib/supabase';

// Login con Supabase Auth. Las cuentas se crean desde el panel de Supabase
// (Authentication → Users → Add user); no hay registro abierto.
export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    const err = await signIn(email, password);
    setSending(false);
    if (err) setError(err);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} data-testid="login-form" className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6 space-y-4">
        <div className="flex flex-col items-center gap-1.5 pb-1">
          <CalandriaMark className="w-14 h-16" />
          <div className="font-bold text-xl text-slate-900 tracking-tight">Cotorra</div>
          <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Acceso al sistema</p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-700">Email</span>
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-700">Contraseña</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </label>

        {error && <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</p>}

        <button type="submit" disabled={sending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold">
          <LogIn className="w-4 h-4" /> {sending ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="text-center text-[11px] text-slate-400">una solución de <b className="text-slate-600">tecnoros.ar</b></p>
      </form>
    </div>
  );
};

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import App from './App.tsx';
import { LoginScreen } from './components/Common/LoginScreen';
import { getSession, isSupabaseConfigured, onSessionChange } from './lib/supabase';
import './index.css';

// Con Supabase configurado, nadie ve el kiosco sin iniciar sesión.
// Sin Supabase, funciona en modo local (demo en el navegador).
function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
    return onSessionChange(setSession);
  }, []);

  if (!isSupabaseConfigured) return <App />;
  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-sm text-slate-400">Cargando…</div>;
  return session ? <App key={session.user.id} userId={session.user.id} /> : <LoginScreen />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);

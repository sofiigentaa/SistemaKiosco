import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LoginScreen } from './components/Common/LoginScreen';
import { ApiSession, getSession, isApiConfigured, onSessionChange } from './lib/api';
import './index.css';

function AuthGate() {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [loading, setLoading] = useState(isApiConfigured);

  useEffect(() => {
    if (!isApiConfigured) return;
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
    return onSessionChange(setSession);
  }, []);

  if (!isApiConfigured) return <App />;
  if (new URLSearchParams(window.location.search).has('reset')) return <LoginScreen />;
  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-sm text-slate-400">Cargando…</div>;
  return session ? <App key={session.user.id} userId={session.user.id} /> : <LoginScreen />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);

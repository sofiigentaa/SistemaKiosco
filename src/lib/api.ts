import { supabaseAuth } from './supabaseAuth';

export interface ApiUser {
  id: string;
  email: string;
}

export interface ApiSession {
  user: ApiUser;
}

const SESSION_EVENT = 'kiosco-api-session-change';

export const isApiConfigured = true;

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/auth/exchange' && path !== '/api/auth/session') {
      window.dispatchEvent(new Event(SESSION_EVENT));
    }
    throw new Error(payload.error || 'No se pudo completar la operación.');
  }
  return payload as T;
}

export async function getSession(): Promise<ApiSession | null> {
  try {
    return await apiRequest<ApiSession>('/api/auth/session');
  } catch {
    if (!supabaseAuth) return null;
    const { data } = await supabaseAuth.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken || !(await exchangeSession(accessToken))) return null;
    try {
      return await apiRequest<ApiSession>('/api/auth/session');
    } catch {
      return null;
    }
  }
}

export function onSessionChange(cb: (session: ApiSession | null) => void): () => void {
  const listener = () => {
    void getSession().then(cb);
  };
  window.addEventListener(SESSION_EVENT, listener);
  return () => window.removeEventListener(SESSION_EVENT, listener);
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabaseAuth) return 'Falta configurar Supabase Auth.';
  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) return error?.message || 'No se pudo iniciar sesión.';
    const exchangeError = await exchangeSession(data.session.access_token);
    if (exchangeError) return exchangeError;
    window.dispatchEvent(new Event(SESSION_EVENT));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
  }
}

export async function registerAccount(email: string, password: string): Promise<{ error?: string; message?: string }> {
  if (!supabaseAuth) return { error: 'Falta configurar Supabase Auth.' };
  try {
    const { data, error } = await supabaseAuth.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { error: error.message };
    if (data.session) {
      const exchangeError = await exchangeSession(data.session.access_token);
      if (exchangeError) return { error: exchangeError };
      window.dispatchEvent(new Event(SESSION_EVENT));
      return { message: 'Cuenta creada correctamente.' };
    }
    return { message: 'Te enviamos un email para confirmar la cuenta. Revisá tu bandeja de entrada.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo crear la cuenta.' };
  }
}

export async function requestPasswordReset(email: string): Promise<{ message?: string; error?: string }> {
  if (!supabaseAuth) return { error: 'Falta configurar Supabase Auth.' };
  try {
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/?reset=1`,
    });
    if (error) return { error: error.message };
    return { message: 'Si el email está registrado, recibirás un enlace para restablecer la contraseña.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo solicitar la recuperación.' };
  }
}

export async function resetPassword(password: string): Promise<string | null> {
  if (!supabaseAuth) return 'Falta configurar Supabase Auth.';
  try {
    const { error } = await supabaseAuth.auth.updateUser({ password });
    if (error) return error.message;
    await signOut();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.';
  }
}

export async function signOut(): Promise<void> {
  try {
    await supabaseAuth?.auth.signOut();
  } finally {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
}

async function exchangeSession(accessToken: string): Promise<string | null> {
  try {
    await apiRequest('/api/auth/exchange', {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
    });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'No se pudo validar la sesión con el servidor.';
  }
}
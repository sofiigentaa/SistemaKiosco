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
    if (response.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/session') {
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
    return null;
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
  try {
    await apiRequest<{ user: ApiUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });
    window.dispatchEvent(new Event(SESSION_EVENT));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
  }
}

export async function registerAccount(email: string, password: string): Promise<string | null> {
  try {
    await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });
    window.dispatchEvent(new Event(SESSION_EVENT));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'No se pudo crear la cuenta.';
  }
}

export async function requestPasswordReset(email: string): Promise<{ message?: string; error?: string }> {
  try {
    return await apiRequest('/api/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo solicitar la recuperación.' };
  }
}

export async function resetPassword(token: string, password: string): Promise<string | null> {
  try {
    await apiRequest('/api/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.';
  }
}

export async function signOut(): Promise<void> {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } finally {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
}
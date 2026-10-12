import { createClient, Session } from '@supabase/supabase-js';

// La nube se configura SOLO con variables de entorno al publicar
// (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY). Antes también se podía pegar
// la URL y la clave desde la pantalla, y quedaban guardadas en el navegador.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

// La clave "anon" es pública por diseño: los datos los protege el login +
// las políticas RLS de supabase/schema.sql.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onSessionChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'La nube no está configurada.';
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return null;
  return /invalid/i.test(error.message) ? 'Email o contraseña incorrectos.' : 'No se pudo iniciar sesión.';
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

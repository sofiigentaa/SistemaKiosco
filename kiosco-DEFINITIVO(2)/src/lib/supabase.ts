import { createClient } from '@supabase/supabase-js';

// Get credentials from environment variables or fallback to localStorage
const getEnvVar = (key: string): string => {
  try {
    return (import.meta as any).env?.[key] || '';
  } catch {
    return '';
  }
};

const envUrl = getEnvVar('VITE_SUPABASE_URL');
const envKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('kiosco_supabase_url') || '' : '';
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('kiosco_supabase_key') || '' : '';

export const supabaseUrl = envUrl || storedUrl;
export const supabaseAnonKey = envKey || storedKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('kiosco_supabase_url', url.trim());
  localStorage.setItem('kiosco_supabase_key', key.trim());
  window.location.reload();
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem('kiosco_supabase_url');
  localStorage.removeItem('kiosco_supabase_key');
  window.location.reload();
};

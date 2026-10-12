import { supabase } from '../lib/supabase';
import { CalandriaAction, CalandriaKind, LogEntry, sealEntry } from './chain';

// Dónde vive el registro sellado:
//  - Modo local (demo): en este navegador, sellado acá mismo.
//  - Modo nube: en la tabla kiosk_calandria_log. La base pone la fecha y la
//    huella, y no deja modificar ni borrar líneas (ni siquiera el dueño).
//    Si no hay internet, la acción queda "pendiente de sellar" en este equipo
//    y se sube sola al volver la conexión.

export interface PendingAction {
  localId: string;
  kind: CalandriaKind;
  action: CalandriaAction;
  qty: number;
  minutes: number;
  createdAt: string;
}

const localKey = (userId?: string) => (userId ? `calandria_log_${userId}` : 'calandria_log');
const pendingKey = (userId?: string) => `calandria_pending_${userId || 'local'}`;

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // sin espacio o bloqueado: el registro en memoria sigue
  }
}

export function readLocalLog(userId?: string): LogEntry[] {
  return read<LogEntry[]>(localKey(userId), []);
}

export function appendLocal(userId: string | undefined, data: Omit<PendingAction, 'localId' | 'createdAt'>): LogEntry[] {
  const log = readLocalLog(userId);
  const entry = sealEntry(log[log.length - 1], { ...data, at: new Date().toISOString() });
  const next = [...log, entry];
  write(localKey(userId), next);
  return next;
}

export function readPending(userId?: string): PendingAction[] {
  return read<PendingAction[]>(pendingKey(userId), []);
}

export function queuePending(userId: string | undefined, data: Omit<PendingAction, 'localId' | 'createdAt'>): PendingAction[] {
  const next = [
    ...readPending(userId),
    { ...data, localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() },
  ];
  write(pendingKey(userId), next);
  return next;
}

export async function fetchCloudLog(): Promise<{ ok: boolean; entries?: LogEntry[] }> {
  if (!supabase) return { ok: false };
  const { data, error } = await supabase
    .from('kiosk_calandria_log')
    .select('seq, at, kind, action, qty, minutes, prev_hash, hash')
    .order('seq', { ascending: true })
    .limit(10000);
  if (error) return { ok: false };
  return { ok: true, entries: (data || []) as LogEntry[] };
}

// Sube en orden lo pendiente. Lo que se subió sale de la cola.
let flushing: Promise<boolean> | null = null;

export function flushPending(userId: string): Promise<boolean> {
  // Una sola subida a la vez: así ninguna acción se registra dos veces.
  if (!flushing) flushing = doFlush(userId).finally(() => (flushing = null));
  return flushing;
}

async function doFlush(userId: string): Promise<boolean> {
  if (!supabase) return false;
  for (;;) {
    const queue = readPending(userId);
    if (queue.length === 0) return true;
    const p = queue[0];
    const { error } = await supabase
      .from('kiosk_calandria_log')
      .insert({ kind: p.kind, action: p.action, qty: p.qty, minutes: p.minutes });
    if (error) return false;
    write(pendingKey(userId), readPending(userId).filter((x) => x.localId !== p.localId));
  }
}

export function toCsv(entries: LogEntry[]): string {
  const head = 'numero;fecha_utc;tipo;accion;cantidad;minutos_estimados;huella_anterior;huella';
  const rows = entries.map((e) => [e.seq, e.at, e.kind, e.action, e.qty, e.minutes, e.prev_hash, e.hash].join(';'));
  return [head, ...rows].join('\n');
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

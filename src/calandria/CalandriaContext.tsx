import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useKiosk } from '../context/KioskContext';
import { CalandriaAction, CalandriaKind, LogEntry, verifyChain, VerifyResult } from './chain';
import { appendLocal, fetchCloudLog, flushPending, PendingAction, queuePending, readLocalLog, readPending } from './logStore';
import { buildSuggestions, Suggestion } from './suggestions';

// Resultado que se muestra después de aprobar (pedido armado o mensajes).
// Vive solo en memoria: al cerrarlo se borra, nunca se guarda.
export type CalandriaResult =
  | { type: 'reposicion'; bySupplier: Array<{ supplier: string; text: string }> }
  | { type: 'fiados'; messages: Array<{ customer: string; text: string }> };

interface CalandriaContextType {
  suggestions: Suggestion[];
  paused: boolean;
  togglePause: () => void;
  approve: (s: Suggestion) => void;
  dismiss: (s: Suggestion) => void;
  pressButton: () => void; // botón físico / F9 / botón grande de la pantalla
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  logOpen: boolean;
  setLogOpen: (v: boolean) => void;
  log: LogEntry[];
  pending: PendingAction[];
  verification: VerifyResult;
  minutesThisMonth: number;
  minutesTotal: number;
  approvedCount: number;
  result: CalandriaResult | null;
  lastResult: CalandriaResult | null; // lo último que preparó (para compartir / imprimir); solo en memoria
  clearResult: () => void;
  homeActive: boolean; // se está viendo la pantalla de la C
  setHomeActive: (v: boolean) => void;
  toast: string | null;
  refreshLog: () => void;
}

const Ctx = createContext<CalandriaContextType | null>(null);

const SNOOZE_MS = 12 * 60 * 60 * 1000;
// Lo aprobado no vuelve a aparecer igual (si cambia algo, la propuesta cambia de clave y aparece de nuevo).
const DONE_MS = 3 * 24 * 60 * 60 * 1000;

function readJson<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // ignorar
  }
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' });

export const CalandriaProvider: React.FC<{ children: React.ReactNode; userId?: string; brandName: string }> = ({
  children,
  userId,
  brandName,
}) => {
  const { products, sales, stockMovements, restockProduct, updateProduct, cloudEnabled } = useKiosk();
  const cloud = cloudEnabled && Boolean(userId);
  const prefsKey = `calandria_prefs_${userId || 'local'}`;

  const [paused, setPaused] = useState<boolean>(() => readJson(prefsKey, { paused: false }).paused);
  const [snoozed, setSnoozed] = useState<Record<string, number>>(() => readJson(`${prefsKey}_snooze`, {}));
  const [panelOpen, setPanelOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState<LogEntry[]>(() => (cloud ? [] : readLocalLog()));
  const [pending, setPending] = useState<PendingAction[]>(() => (cloud ? readPending(userId) : []));
  const [result, setResultState] = useState<CalandriaResult | null>(null);
  const [lastResult, setLastResult] = useState<CalandriaResult | null>(null);
  const setResult = (r: CalandriaResult | null) => {
    setResultState(r);
    if (r) setLastResult(r);
  };
  const [homeActive, setHomeActive] = useState(false);
  const homeRef = useRef(false);
  homeRef.current = homeActive;
  const [toast, setToast] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cada minuto se recalculan las propuestas (vencimientos, fiados viejos…).
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const refreshLog = useCallback(async () => {
    if (!cloud || !userId) {
      setLog(readLocalLog());
      return;
    }
    await flushPending(userId);
    setPending(readPending(userId));
    const res = await fetchCloudLog();
    if (res.ok && res.entries) setLog(res.entries);
  }, [cloud, userId]);

  useEffect(() => {
    refreshLog();
    if (!cloud) return;
    const onOnline = () => refreshLog();
    window.addEventListener('online', onOnline);
    const t = setInterval(() => {
      if (readPending(userId).length > 0) refreshLog();
    }, 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(t);
    };
  }, [cloud, userId, refreshLog]);

  const record = useCallback(
    (kind: CalandriaKind, action: CalandriaAction, qty: number, minutes: number) => {
      const data = { kind, action, qty, minutes };
      if (cloud && userId) {
        setPending(queuePending(userId, data));
        refreshLog();
      } else {
        setLog(appendLocal(undefined, data));
      }
    },
    [cloud, userId, refreshLog]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // Esconde una propuesta por un tiempo (functional update: sirve aunque se llame varias veces seguidas).
  const markSnoozed = useCallback(
    (key: string, ms: number) => {
      setSnoozed((prev) => {
        const now = Date.now();
        const next: Record<string, number> = { ...prev, [key]: now + ms };
        Object.keys(next).forEach((k) => next[k] < now && delete next[k]);
        writeJson(`${prefsKey}_snooze`, next);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const suggestions = useMemo(() => {
    if (paused) return [];
    const now = Date.now();
    return buildSuggestions(products, sales, stockMovements, now).filter((s) => !(snoozed[s.key] > now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, sales, stockMovements, paused, snoozed, tick]);

  const approve = useCallback(
    (s: Suggestion) => {
      const p = s.payload;
      if (p.type === 'ingreso_habitual') {
        restockProduct(p.productId, p.quantity);
      } else if (p.type === 'liquidacion') {
        p.updates.forEach((u) => updateProduct(u.id, { salePrice: u.newPrice, liquidationApplied: true }));
      } else if (p.type === 'reposicion') {
        setResult({
          type: 'reposicion',
          bySupplier: p.bySupplier.map((g) => ({
            supplier: g.supplier,
            text: `Hola! Te paso el pedido de ${brandName}:\n${g.items.map((i) => `• ${i.qty} × ${i.name}`).join('\n')}\nGracias!`,
          })),
        });
      } else if (p.type === 'fiados') {
        const byCustomer = new Map<string, typeof p.items>();
        p.items.forEach((i) => byCustomer.set(i.customer, [...(byCustomer.get(i.customer) || []), i]));
        setResult({
          type: 'fiados',
          messages: [...byCustomer.entries()].map(([customer, items]) => {
            const total = items.reduce((a, i) => a + i.total, 0);
            const first = sales.find((x) => x.id === items[items.length - 1].saleId);
            return {
              customer,
              text: `Hola ${customer}! Te escribimos de ${brandName}. Te recordamos que quedó pendiente $${total.toLocaleString('es-AR')}${
                first ? ` de tu compra del ${shortDate(first.date)}` : ''
              }. Cuando puedas, pasá. ¡Gracias!`,
            };
          }),
        });
      }
      markSnoozed(s.key, DONE_MS);
      record(s.kind, 'aprobada', s.qty, s.minutes);
      showToast(`Listo. Cotorra te ahorró ~${s.minutes} min.`);
    },
    [restockProduct, updateProduct, record, brandName, sales, markSnoozed]
  );

  const dismiss = useCallback(
    (s: Suggestion) => {
      markSnoozed(s.key, SNOOZE_MS);
      record(s.kind, 'descartada', s.qty, 0);
    },
    [markSnoozed, record]
  );

  const togglePause = useCallback(() => {
    const next = !paused;
    setPaused(next);
    writeJson(prefsKey, { paused: next });
    record('sistema', next ? 'pausa' : 'reanudada', 0, 0);
    showToast(next ? 'Cotorra en pausa: no propone nada hasta que la reanudes.' : 'Cotorra volvió a mirar.');
  }, [paused, prefsKey, record]);

  const suggestionsRef = useRef(suggestions);
  suggestionsRef.current = suggestions;
  const panelRef = useRef(panelOpen);
  panelRef.current = panelOpen;
  const blockRef = useRef(false);

  // El botón físico nunca aprueba "a ciegas": si el panel está cerrado, lo abre
  // para que veas qué propone; si está abierto, aprueba la primera propuesta.
  const pressButton = useCallback(() => {
    if (blockRef.current) return;
    blockRef.current = true;
    setTimeout(() => (blockRef.current = false), 600); // evita doble toque
    if (!panelRef.current && !homeRef.current) {
      setPanelOpen(true);
      return;
    }
    const first = suggestionsRef.current[0];
    if (first) approve(first);
  }, [approve]);

  // F9 = botón Cotorra. Un ESP32 conectado por USB como teclado manda F9.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        pressButton();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pressButton]);

  const verification = useMemo(() => verifyChain(log), [log]);
  const { minutesThisMonth, minutesTotal, approvedCount } = useMemo(() => {
    const now = new Date();
    let month = 0;
    let total = 0;
    let count = 0;
    const add = (at: string, action: string, minutes: number) => {
      if (action !== 'aprobada') return;
      count++;
      total += minutes;
      const d = new Date(at);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) month += minutes;
    };
    log.forEach((e) => add(e.at, e.action, e.minutes));
    pending.forEach((p) => add(p.createdAt, p.action, p.minutes));
    return { minutesThisMonth: month, minutesTotal: total, approvedCount: count };
  }, [log, pending]);

  const value: CalandriaContextType = {
    suggestions,
    paused,
    togglePause,
    approve,
    dismiss,
    pressButton,
    panelOpen,
    setPanelOpen,
    logOpen,
    setLogOpen,
    log,
    pending,
    verification,
    minutesThisMonth,
    minutesTotal,
    approvedCount,
    result,
    lastResult,
    clearResult: () => setResultState(null),
    homeActive,
    setHomeActive,
    toast,
    refreshLog,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useCalandria() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCalandria fuera de CalandriaProvider');
  return v;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

import { supabase } from './supabase';
import { Product, Sale, StockMovement, CashRegisterShift } from '../types';

// Sincronización con Supabase, pensada para varios equipos vendiendo a la vez.
//
// Antes: todo el kiosco se guardaba en UNA fila y "la última escritura ganaba",
// así que dos equipos vendiendo al mismo tiempo se pisaban ventas y stock.
// Ahora:
//  - cada producto, venta y movimiento es una fila propia (tablas kiosk_*);
//  - las ventas y movimientos solo se agregan (nunca se pisan entre equipos);
//  - el stock se manda como DIFERENCIA (vendí 2 → -2) y la base la suma en una
//    sola operación (función kiosk_upsert_product), así no se pierde ninguna;
//  - si la lectura inicial falla, NO se sube nada (antes pisaba la nube).
//
// Cada fila tiene owner = usuario logueado, y RLS hace que cada cuenta vea solo
// lo suyo (supabase/schema.sql).

export interface KioskMeta {
  categories: string[];
  currentShift: CashRegisterShift | null;
  closedShifts: CashRegisterShift[];
}

export interface KioskCloudState extends KioskMeta {
  products: Product[];
  sales: Sale[];
  stockMovements: StockMovement[];
}

export interface Snapshot {
  products: Map<string, string>; // id -> JSON del producto
  productStock: Map<string, number>; // id -> stock conocido en la nube
  sales: Map<string, string>; // id -> JSON de la venta
  movements: Set<string>;
  meta: string;
}

export type SyncResult = { ok: boolean; error?: string; stockUpdates?: Record<string, number> };

const json = (v: unknown) => JSON.stringify(v);

export function makeSnapshot(state: KioskCloudState): Snapshot {
  return {
    products: new Map(state.products.map((p) => [p.id, json(p)])),
    productStock: new Map(state.products.map((p) => [p.id, p.stock])),
    sales: new Map(state.sales.map((s) => [s.id, json(s)])),
    movements: new Set(state.stockMovements.map((m) => m.id)),
    meta: json({ categories: state.categories, currentShift: state.currentShift, closedShifts: state.closedShifts }),
  };
}

function friendlyError(error: any, fallback: string): string {
  const msg = String(error?.message || '');
  if (/JWT|not authenticated|permission denied|row-level security/i.test(msg)) {
    return 'Tu sesión venció o no tenés permiso. Volvé a iniciar sesión.';
  }
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return 'Sin conexión con la nube. Las ventas quedan en este equipo y se suben al volver internet.';
  }
  return fallback;
}

// Lee todo lo del usuario. Si algo falla devuelve ok:false (y no se sube nada).
export async function fetchCloudState(): Promise<{ ok: boolean; state?: KioskCloudState; isEmpty?: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'La nube no está configurada.' };
  try {
    const [prod, sales, movs, meta] = await Promise.all([
      supabase.from('kiosk_products').select('data'),
      supabase.from('kiosk_sales').select('data').order('created_at', { ascending: false }),
      supabase.from('kiosk_movements').select('data').order('created_at', { ascending: false }).limit(5000),
      supabase.from('kiosk_meta').select('categories, current_shift, closed_shifts').maybeSingle(),
    ]);
    const firstError = prod.error || sales.error || movs.error || meta.error;
    if (firstError) return { ok: false, error: friendlyError(firstError, 'No se pudieron leer los datos de la nube.') };
    const state: KioskCloudState = {
      products: (prod.data || []).map((r: any) => r.data),
      sales: (sales.data || []).map((r: any) => r.data),
      stockMovements: (movs.data || []).map((r: any) => r.data),
      categories: Array.isArray(meta.data?.categories) ? meta.data!.categories : [],
      currentShift: meta.data?.current_shift ?? null,
      closedShifts: Array.isArray(meta.data?.closed_shifts) ? meta.data!.closed_shifts : [],
    };
    const isEmpty = state.products.length === 0 && state.sales.length === 0 && !meta.data;
    return { ok: true, state, isEmpty };
  } catch (err) {
    return { ok: false, error: friendlyError(err, 'No se pudieron leer los datos de la nube.') };
  }
}

// Sube solo lo que cambió respecto del último estado sincronizado.
export async function pushChanges(snapshot: Snapshot, next: KioskCloudState): Promise<SyncResult> {
  if (!supabase) return { ok: true };
  const stockUpdates: Record<string, number> = {};
  try {
    // Productos: nuevos o modificados, con el stock como diferencia.
    const nextIds = new Set<string>();
    for (const p of next.products) {
      nextIds.add(p.id);
      const before = snapshot.products.get(p.id);
      if (before === json(p)) continue;
      const known = snapshot.productStock.get(p.id);
      const delta = known === undefined ? p.stock : p.stock - known;
      const { data, error } = await supabase.rpc('kiosk_upsert_product', { p, stock_delta: delta, is_new: known === undefined });
      if (error) return { ok: false, error: friendlyError(error, 'No se pudo guardar un producto en la nube.') };
      if (typeof data === 'number') stockUpdates[p.id] = data;
    }
    const removedProducts = [...snapshot.products.keys()].filter((id) => !nextIds.has(id));
    if (removedProducts.length) {
      const { error } = await supabase.from('kiosk_products').delete().in('id', removedProducts);
      if (error) return { ok: false, error: friendlyError(error, 'No se pudo borrar un producto en la nube.') };
    }

    // Ventas: nuevas o modificadas (anulación); nunca se pisan las de otro equipo.
    const changedSales = next.sales.filter((s) => snapshot.sales.get(s.id) !== json(s));
    if (changedSales.length) {
      const rows = changedSales.map((s) => ({ id: s.id, data: s, created_at: s.date }));
      const { error } = await supabase.from('kiosk_sales').upsert(rows);
      if (error) return { ok: false, error: friendlyError(error, 'No se pudo guardar una venta en la nube.') };
    }
    const nextSaleIds = new Set(next.sales.map((s) => s.id));
    const removedSales = [...snapshot.sales.keys()].filter((id) => !nextSaleIds.has(id));
    if (removedSales.length) {
      const { error } = await supabase.from('kiosk_sales').delete().in('id', removedSales);
      if (error) return { ok: false, error: friendlyError(error, 'No se pudo borrar el historial en la nube.') };
    }

    // Movimientos de stock: solo se agregan.
    const newMovs = next.stockMovements.filter((m) => !snapshot.movements.has(m.id));
    if (newMovs.length) {
      const rows = newMovs.map((m) => ({ id: m.id, data: m, created_at: m.date }));
      const { error } = await supabase.from('kiosk_movements').upsert(rows, { ignoreDuplicates: true });
      if (error) return { ok: false, error: friendlyError(error, 'No se pudo guardar un movimiento en la nube.') };
    }
    const nextMovIds = new Set(next.stockMovements.map((m) => m.id));
    const removedMovs = [...snapshot.movements].filter((id) => !nextMovIds.has(id));
    if (removedMovs.length) {
      for (let i = 0; i < removedMovs.length; i += 200) {
        const { error } = await supabase.from('kiosk_movements').delete().in('id', removedMovs.slice(i, i + 200));
        if (error) return { ok: false, error: friendlyError(error, 'No se pudieron borrar movimientos en la nube.') };
      }
    }

    // Categorías y caja.
    const metaJson = json({ categories: next.categories, currentShift: next.currentShift, closedShifts: next.closedShifts });
    if (metaJson !== snapshot.meta) {
      const { error } = await supabase.from('kiosk_meta').upsert({
        categories: next.categories,
        current_shift: next.currentShift,
        closed_shifts: next.closedShifts,
        updated_at: new Date().toISOString(),
      });
      if (error) return { ok: false, error: friendlyError(error, 'No se pudo guardar la caja en la nube.') };
    }
    return { ok: true, stockUpdates };
  } catch (err) {
    return { ok: false, error: friendlyError(err, 'No se pudo sincronizar con la nube.') };
  }
}

export type RemoteChange =
  | { table: 'product'; deleted: boolean; id: string; product?: Product }
  | { table: 'sale'; deleted: boolean; id: string; sale?: Sale }
  | { table: 'movement'; deleted: boolean; id: string; movement?: StockMovement }
  | { table: 'meta'; meta: KioskMeta };

// Cambios de otros equipos en tiempo real.
export function subscribeCloudChanges(onChange: (change: RemoteChange) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('kiosk_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kiosk_products' }, (payload: any) => {
      const deleted = payload.eventType === 'DELETE';
      onChange({ table: 'product', deleted, id: (deleted ? payload.old : payload.new)?.id, product: payload.new?.data });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kiosk_sales' }, (payload: any) => {
      const deleted = payload.eventType === 'DELETE';
      onChange({ table: 'sale', deleted, id: (deleted ? payload.old : payload.new)?.id, sale: payload.new?.data });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kiosk_movements' }, (payload: any) => {
      const deleted = payload.eventType === 'DELETE';
      onChange({ table: 'movement', deleted, id: (deleted ? payload.old : payload.new)?.id, movement: payload.new?.data });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kiosk_meta' }, (payload: any) => {
      const row = payload.new || {};
      onChange({
        table: 'meta',
        meta: {
          categories: Array.isArray(row.categories) ? row.categories : [],
          currentShift: row.current_shift ?? null,
          closedShifts: Array.isArray(row.closed_shifts) ? row.closed_shifts : [],
        },
      });
    })
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

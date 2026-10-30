import { Product, Sale, StockMovement, CashRegisterShift } from '../types';
import { apiRequest } from './api';

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
  products: Map<string, string>;
  productStock: Map<string, number>;
  sales: Map<string, string>;
  movements: Set<string>;
  meta: string;
}

export type SyncResult = { ok: boolean; error?: string; stockUpdates?: Record<string, number> };

const json = (value: unknown) => JSON.stringify(value);

export function makeSnapshot(state: KioskCloudState): Snapshot {
  return {
    products: new Map(state.products.map((product) => [product.id, json(product)])),
    productStock: new Map(state.products.map((product) => [product.id, product.stock])),
    sales: new Map(state.sales.map((sale) => [sale.id, json(sale)])),
    movements: new Set(state.stockMovements.map((movement) => movement.id)),
    meta: json({ categories: state.categories, currentShift: state.currentShift, closedShifts: state.closedShifts }),
  };
}

function message(error: unknown, fallback: string): string {
  if (error instanceof Error && /fetch|network/i.test(error.message)) {
    return 'Sin conexión con la nube. Los cambios quedan en este equipo y se suben al volver internet.';
  }
  return error instanceof Error ? error.message : fallback;
}

export async function fetchCloudState(): Promise<{ ok: boolean; state?: KioskCloudState; isEmpty?: boolean; error?: string }> {
  try {
    const result = await apiRequest<{ state: KioskCloudState; isEmpty: boolean }>('/api/kiosk/state');
    return { ok: true, state: result.state, isEmpty: result.isEmpty };
  } catch (error) {
    return { ok: false, error: message(error, 'No se pudieron leer los datos de PostgreSQL.') };
  }
}

export async function pushChanges(snapshot: Snapshot, next: KioskCloudState): Promise<SyncResult> {
  const stockUpdates: Record<string, number> = {};
  const nextProductIds = new Set(next.products.map((product) => product.id));
  const nextSaleIds = new Set(next.sales.map((sale) => sale.id));
  const nextMovementIds = new Set(next.stockMovements.map((movement) => movement.id));
  const products = next.products.flatMap((product) => {
    if (snapshot.products.get(product.id) === json(product)) return [];
    const knownStock = snapshot.productStock.get(product.id);
    return [{
      product,
      isNew: knownStock === undefined,
      stockDelta: knownStock === undefined ? 0 : product.stock - knownStock,
    }];
  });
  const sales = next.sales.filter((sale) => snapshot.sales.get(sale.id) !== json(sale));
  const movements = next.stockMovements.filter((movement) => !snapshot.movements.has(movement.id));

  try {
    const result = await apiRequest<{ stockUpdates: Record<string, number> }>('/api/kiosk/sync', {
      method: 'POST',
      body: JSON.stringify({
        products,
        deletedProducts: [...snapshot.products.keys()].filter((id) => !nextProductIds.has(id)),
        sales,
        deletedSales: [...snapshot.sales.keys()].filter((id) => !nextSaleIds.has(id)),
        movements,
        deletedMovements: [...snapshot.movements].filter((id) => !nextMovementIds.has(id)),
        meta: json({ categories: next.categories, currentShift: next.currentShift, closedShifts: next.closedShifts }) === snapshot.meta
          ? null
          : { categories: next.categories, currentShift: next.currentShift, closedShifts: next.closedShifts },
      }),
    });
    Object.assign(stockUpdates, result.stockUpdates);
    return { ok: true, stockUpdates };
  } catch (error) {
    return { ok: false, error: message(error, 'No se pudo sincronizar con PostgreSQL.') };
  }
}

export type RemoteChange =
  | { table: 'product'; deleted: boolean; id: string; product?: Product }
  | { table: 'sale'; deleted: boolean; id: string; sale?: Sale }
  | { table: 'movement'; deleted: boolean; id: string; movement?: StockMovement }
  | { table: 'meta'; meta: KioskMeta };

export function subscribeCloudChanges(onChange: (change: RemoteChange) => void): () => void {
  let stopped = false;
  let previous: Snapshot | null = null;
  const poll = async () => {
    const result = await fetchCloudState();
    if (stopped || !result.ok || !result.state) return;
    const next = makeSnapshot(result.state);
    if (previous) {
      for (const [id, value] of previous.products) {
        if (!next.products.has(id)) onChange({ table: 'product', deleted: true, id });
        else if (next.products.get(id) !== value) onChange({ table: 'product', deleted: false, id, product: result.state!.products.find((item) => item.id === id) });
      }
      for (const product of result.state.products) {
        if (!previous.products.has(product.id)) onChange({ table: 'product', deleted: false, id: product.id, product });
      }
      for (const [id, value] of previous.sales) {
        if (!next.sales.has(id)) onChange({ table: 'sale', deleted: true, id });
        else if (next.sales.get(id) !== value) onChange({ table: 'sale', deleted: false, id, sale: result.state!.sales.find((item) => item.id === id) });
      }
      for (const sale of result.state.sales) {
        if (!previous.sales.has(sale.id)) onChange({ table: 'sale', deleted: false, id: sale.id, sale });
      }
      for (const id of previous.movements) {
        if (!next.movements.has(id)) onChange({ table: 'movement', deleted: true, id });
      }
      for (const movement of result.state.stockMovements) {
        if (!previous.movements.has(movement.id)) onChange({ table: 'movement', deleted: false, id: movement.id, movement });
      }
      if (previous.meta !== next.meta) {
        onChange({ table: 'meta', meta: { categories: result.state.categories, currentShift: result.state.currentShift, closedShifts: result.state.closedShifts } });
      }
    }
    previous = next;
  };
  void poll();
  const timer = setInterval(poll, 5000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
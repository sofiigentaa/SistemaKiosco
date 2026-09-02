import { supabase } from './supabase';
import { Product, Sale, StockMovement, CashRegisterShift } from '../types';

// One row holds the entire kiosk state as JSON. Simple, robust, and avoids
// having to keep a SQL column list in sync with the app's TypeScript types.
const ROW_ID = 'main';
const TABLE = 'kiosk_state';

export interface KioskCloudState {
  products: Product[];
  sales: Sale[];
  stockMovements: StockMovement[];
  currentShift: CashRegisterShift | null;
  categories: string[];
  updatedAt: string;
}

// Fetch the current cloud state (null if nothing has been pushed yet).
export const fetchCloudState = async (): Promise<KioskCloudState | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('data')
      .eq('id', ROW_ID)
      .maybeSingle();

    if (error || !data) return null;
    return data.data as KioskCloudState;
  } catch {
    return null;
  }
};

// Push the full local state up to Supabase (upsert = create or overwrite).
export const pushCloudState = async (state: KioskCloudState): Promise<boolean> => {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ id: ROW_ID, data: state, updated_at: new Date().toISOString() });
    return !error;
  } catch {
    return false;
  }
};

// Subscribe to live changes from other devices. Returns an unsubscribe function.
export const subscribeCloudState = (
  onChange: (state: KioskCloudState) => void
): (() => void) => {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('kiosk_state_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${ROW_ID}` },
      (payload: any) => {
        const row = payload.new;
        if (row && row.data) onChange(row.data as KioskCloudState);
      }
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
};

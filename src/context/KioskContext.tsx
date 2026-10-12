import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Product, Sale, CartItem, SaleItem, StockMovement, CashRegisterShift, PaymentMethod } from '../types';
import { INITIAL_PRODUCTS, generateSampleSales, INITIAL_SHIFTS, INITIAL_CATEGORIES } from '../data/initialData';
import { getDaysUntil, playSuccessBeep } from '../utils/formatters';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchCloudState, pushChanges, subscribeCloudChanges, makeSnapshot, KioskCloudState, Snapshot, RemoteChange } from '../lib/supabaseSync';

interface KioskContextType {
  products: Product[];
  sales: Sale[];
  stockMovements: StockMovement[];
  currentShift: CashRegisterShift | null;
  activeTab: 'pos' | 'inventory' | 'alerts' | 'sales' | 'reports' | 'cash';
  setActiveTab: (tab: 'pos' | 'inventory' | 'alerts' | 'sales' | 'reports' | 'cash') => void;
  
  // Product actions
  addProduct: (product: Omit<Product, 'id' | 'updatedAt'>) => Product;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  restockProduct: (id: string, quantityAdded: number, newCostPrice?: number, newSalePrice?: number) => void;
  applyBulkPriceAdjustment: (category: string | 'ALL', percentage: number) => void;
  
  // Sale actions
  recordSale: (
    items: CartItem[],
    paymentMethod: PaymentMethod,
    cashReceived?: number,
    discount?: number,
    customerName?: string,
    note?: string
  ) => Sale;
  cancelSale: (saleId: string, reason?: string) => void;
  
  // Shift actions
  openShift: (initialCash: number) => void;
  closeShift: (finalCashReal: number, notes?: string) => void;
  
  // System actions
  resetData: () => void;
  clearAllData: () => void;
  clearSalesHistory: () => void;
  clearAllProducts: () => void;
  resetInventoryStock: () => void;
  importData: (imported: { products?: Product[]; sales?: Sale[] }) => void;
  
  // Category management
  categories: string[];
  addCategory: (categoryName: string) => void;
  deleteCategory: (categoryName: string) => void;
  
  // Cloud sync (Supabase)
  cloudEnabled: boolean;
  cloudSyncStatus: 'synced' | 'syncing' | 'local' | 'error';
  cloudError: string | null;
  lastSyncTime: string | null;
  manualSync: () => void;

  // Caja y fiados
  closedShifts: CashRegisterShift[];
  settleFiado: (saleId: string, method: Exclude<PaymentMethod, 'Cuenta Corriente (Fiado)'>) => void;

  // Alerts & computed
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
  expiringProducts: Product[];
  expiredProducts: Product[];
  totalAlertsCount: number;
  todaySalesTotal: number;
  todayProfitTotal: number;
  todaySalesCount: number;
  searchFilter: string;
  setSearchFilter: (q: string) => void;
}

const KioskContext = createContext<KioskContextType | null>(null);

const STORAGE_KEYS = {
  PRODUCTS: 'kiosco_products_v3',
  SALES: 'kiosco_sales_v3',
  MOVEMENTS: 'kiosco_movements_v3',
  SHIFT: 'kiosco_shift_v3',
  CATEGORIES: 'kiosco_categories_v3',
  CLOSED_SHIFTS: 'kiosco_closed_shifts_v3',
  SNAPSHOT: 'kiosco_cloud_snapshot_v1',
};

// Cleanup old mock data keys from earlier versions
try {
  localStorage.removeItem('kiosco_products_v1');
  localStorage.removeItem('kiosco_sales_v1');
  localStorage.removeItem('kiosco_movements_v1');
  localStorage.removeItem('kiosco_products_v2');
  localStorage.removeItem('kiosco_sales_v2');
  localStorage.removeItem('kiosco_movements_v2');
} catch {}

export const KioskProvider: React.FC<{ children: React.ReactNode; userId?: string }> = ({ children, userId }) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'alerts' | 'sales' | 'reports' | 'cash'>('pos');
  const [searchFilter, setSearchFilter] = useState('');

  const cloud = isSupabaseConfigured && Boolean(userId);
  // En modo nube cada cuenta tiene su propia copia local (para seguir vendiendo
  // sin internet) y nunca arranca con datos de ejemplo.
  const key = (name: string) => (cloud ? `${name}_${userId}` : name);
  const readCache = <T,>(name: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(key(name));
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return fallback;
  };

  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'local' | 'error'>(
    cloud ? 'syncing' : 'local'
  );
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const stampSyncTime = () =>
    setLastSyncTime(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  const [categories, setCategories] = useState<string[]>(() =>
    readCache(STORAGE_KEYS.CATEGORIES, cloud ? [...INITIAL_CATEGORIES] : [...INITIAL_CATEGORIES])
  );
  const [products, setProducts] = useState<Product[]>(() => readCache(STORAGE_KEYS.PRODUCTS, cloud ? [] : INITIAL_PRODUCTS));
  const [sales, setSales] = useState<Sale[]>(() => readCache(STORAGE_KEYS.SALES, cloud ? [] : generateSampleSales()));
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => readCache(STORAGE_KEYS.MOVEMENTS, []));
  const [currentShift, setCurrentShift] = useState<CashRegisterShift | null>(() =>
    readCache(STORAGE_KEYS.SHIFT, cloud ? null : INITIAL_SHIFTS[0])
  );
  const [closedShifts, setClosedShifts] = useState<CashRegisterShift[]>(() => readCache(STORAGE_KEYS.CLOSED_SHIFTS, []));

  // Keep references for event handlers
  const productsRef = useRef(products);
  productsRef.current = products;
  const salesRef = useRef(sales);
  salesRef.current = sales;
  const movementsRef = useRef(stockMovements);
  movementsRef.current = stockMovements;
  const shiftRef = useRef(currentShift);
  shiftRef.current = currentShift;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const closedShiftsRef = useRef(closedShifts);
  closedShiftsRef.current = closedShifts;

  // Sincronización: el "snapshot" es lo último que se sabe que está en la nube.
  // Se sube solo la diferencia entre el estado actual y el snapshot. Se guarda en
  // el navegador para que las ventas hechas sin internet se suban al volver.
  const snapshotRef = useRef<Snapshot | null>(null);
  const hasBootstrappedRef = useRef(false);
  const pushingRef = useRef(false);
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentState = (): KioskCloudState => ({
    products: productsRef.current,
    sales: salesRef.current,
    stockMovements: movementsRef.current,
    categories: categoriesRef.current,
    currentShift: shiftRef.current,
    closedShifts: closedShiftsRef.current,
  });

  const saveSnapshot = (state: KioskCloudState) => {
    snapshotRef.current = makeSnapshot(state);
    try {
      localStorage.setItem(key(STORAGE_KEYS.SNAPSHOT), JSON.stringify(state));
    } catch {}
  };

  const applyCloudState = (state: KioskCloudState) => {
    setProducts(state.products);
    setSales([...state.sales].sort((a, b) => b.date.localeCompare(a.date)));
    setStockMovements([...state.stockMovements].sort((a, b) => b.date.localeCompare(a.date)));
    if (state.categories.length > 0) setCategories(state.categories);
    setCurrentShift(state.currentShift);
    setClosedShifts(state.closedShifts);
    productsRef.current = state.products;
    salesRef.current = state.sales;
    movementsRef.current = state.stockMovements;
    if (state.categories.length > 0) categoriesRef.current = state.categories;
    shiftRef.current = state.currentShift;
    closedShiftsRef.current = state.closedShifts;
    saveSnapshot(currentState());
  };

  // Sube lo pendiente. Si falla, el snapshot no cambia y se reintenta luego.
  const pushPending = useCallback(async () => {
    if (!cloud || !hasBootstrappedRef.current || !snapshotRef.current || pushingRef.current) return;
    pushingRef.current = true;
    setCloudSyncStatus('syncing');
    const state = currentState();
    const result = await pushChanges(snapshotRef.current, state);
    pushingRef.current = false;
    if (!result.ok) {
      setCloudSyncStatus('error');
      setCloudError(result.error || 'No se pudo sincronizar con la nube.');
      return;
    }
    // El stock que devuelve la base ya incluye las ventas de otros equipos.
    const updates = result.stockUpdates || {};
    const synced: KioskCloudState = {
      ...state,
      products: state.products.map((p) => (updates[p.id] !== undefined && updates[p.id] !== p.stock ? { ...p, stock: updates[p.id] } : p)),
    };
    saveSnapshot(synced);
    if (Object.keys(updates).some((id) => state.products.find((p) => p.id === id)?.stock !== updates[id])) {
      setProducts((prev) => prev.map((p) => (updates[p.id] !== undefined ? { ...p, stock: updates[p.id] } : p)));
    }
    setCloudSyncStatus('synced');
    setCloudError(null);
    stampSyncTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud]);

  const manualSync = useCallback(async () => {
    if (!cloud) return;
    await pushPending();
    const fetched = await fetchCloudState();
    if (fetched.ok && fetched.state) applyCloudState(fetched.state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, pushPending]);

  // Cambio que llega de otro equipo: se aplica al estado y al snapshot (así no
  // se vuelve a subir).
  const applyRemoteChange = useCallback((change: RemoteChange) => {
    const snap = snapshotRef.current;
    if (!snap) return;
    if (change.table === 'product') {
      if (change.deleted) {
        snap.products.delete(change.id);
        snap.productStock.delete(change.id);
        setProducts((prev) => prev.filter((p) => p.id !== change.id));
      } else if (change.product) {
        const remote = change.product;
        snap.products.set(remote.id, JSON.stringify(remote));
        snap.productStock.set(remote.id, remote.stock);
        setProducts((prev) => {
          const exists = prev.some((p) => p.id === remote.id);
          return exists ? prev.map((p) => (p.id === remote.id ? remote : p)) : [remote, ...prev];
        });
      }
    } else if (change.table === 'sale') {
      if (change.deleted) {
        snap.sales.delete(change.id);
        setSales((prev) => prev.filter((s) => s.id !== change.id));
      } else if (change.sale) {
        const remote = change.sale;
        snap.sales.set(remote.id, JSON.stringify(remote));
        setSales((prev) => {
          const exists = prev.some((s) => s.id === remote.id);
          const next = exists ? prev.map((s) => (s.id === remote.id ? remote : s)) : [remote, ...prev];
          return next.sort((a, b) => b.date.localeCompare(a.date));
        });
      }
    } else if (change.table === 'movement') {
      if (change.deleted) {
        snap.movements.delete(change.id);
        setStockMovements((prev) => prev.filter((m) => m.id !== change.id));
      } else if (change.movement) {
        const remote = change.movement;
        snap.movements.add(remote.id);
        setStockMovements((prev) => (prev.some((m) => m.id === remote.id) ? prev : [remote, ...prev]));
      }
    } else if (change.table === 'meta') {
      snap.meta = JSON.stringify({
        categories: change.meta.categories,
        currentShift: change.meta.currentShift,
        closedShifts: change.meta.closedShifts,
      });
      if (change.meta.categories.length > 0) setCategories(change.meta.categories);
      setCurrentShift(change.meta.currentShift);
      setClosedShifts(change.meta.closedShifts);
    }
  }, []);

  // Arranque en modo nube:
  // 1) se lee la nube; si falla, NO se sube nada (antes pisaba la nube) y se reintenta;
  // 2) se suben las ventas hechas sin internet (diferencia contra el último snapshot);
  // 3) se vuelve a leer y se escuchan los cambios de los otros equipos.
  useEffect(() => {
    if (!cloud) {
      setCloudSyncStatus('local');
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const bootstrap = async () => {
      setCloudSyncStatus('syncing');
      const first = await fetchCloudState();
      if (cancelled) return;
      if (!first.ok || !first.state) {
        setCloudSyncStatus('error');
        setCloudError(first.error || 'No se pudieron leer los datos de la nube.');
        retry = setTimeout(bootstrap, 15000);
        return;
      }

      let savedSnapshot: KioskCloudState | null = null;
      try {
        const raw = localStorage.getItem(key(STORAGE_KEYS.SNAPSHOT));
        if (raw) savedSnapshot = JSON.parse(raw);
      } catch {}

      const local = currentState();
      const hasLocalData = local.products.length > 0 || local.sales.length > 0;
      let base: Snapshot | null = null;
      if (savedSnapshot) base = makeSnapshot({ closedShifts: [], ...savedSnapshot });
      else if (first.isEmpty && hasLocalData) base = makeSnapshot({ products: [], sales: [], stockMovements: [], categories: [], currentShift: null, closedShifts: [] });

      if (base) {
        const pushed = await pushChanges(base, local);
        if (cancelled) return;
        if (!pushed.ok) {
          setCloudSyncStatus('error');
          setCloudError(pushed.error || 'No se pudieron subir las ventas pendientes.');
          retry = setTimeout(bootstrap, 15000);
          return;
        }
      }

      const fresh = base ? await fetchCloudState() : first;
      if (cancelled) return;
      if (!fresh.ok || !fresh.state) {
        setCloudSyncStatus('error');
        setCloudError(fresh.error || 'No se pudieron leer los datos de la nube.');
        retry = setTimeout(bootstrap, 15000);
        return;
      }
      applyCloudState(fresh.state);
      hasBootstrappedRef.current = true;
      setCloudSyncStatus('synced');
      setCloudError(null);
      stampSyncTime();
      unsubscribe = subscribeCloudChanges(applyRemoteChange);
    };

    bootstrap();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, userId]);

  // Cada cambio local se sube (agrupado cada 600 ms).
  useEffect(() => {
    if (!cloud || !hasBootstrappedRef.current) return;
    if (pushTimeoutRef.current) clearTimeout(pushTimeoutRef.current);
    pushTimeoutRef.current = setTimeout(() => {
      pushPending();
    }, 600);
    return () => {
      if (pushTimeoutRef.current) clearTimeout(pushTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, sales, stockMovements, currentShift, categories, closedShifts]);

  // Si quedó algo sin subir (sin internet), se reintenta cada 15 s y al volver la conexión.
  useEffect(() => {
    if (!cloud) return;
    const tick = () => {
      if (hasBootstrappedRef.current && cloudSyncStatusRef.current === 'error') pushPending();
    };
    const interval = setInterval(tick, 15000);
    window.addEventListener('online', tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', tick);
    };
  }, [cloud, pushPending]);
  const cloudSyncStatusRef = useRef(cloudSyncStatus);
  cloudSyncStatusRef.current = cloudSyncStatus;

  // Add category helper
  const addCategory = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setCategories((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
  }, []);

  const deleteCategory = useCallback((name: string) => {
    const clean = name.trim();
    setCategories((prev) => prev.filter((c) => c !== clean));
  }, []);

  // Copia local (también sirve para seguir vendiendo sin internet)
  const cache = (name: string, value: unknown) => {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
    } catch (e) {
      console.error('Error guardando en el navegador:', e);
    }
  };
  useEffect(() => cache(STORAGE_KEYS.PRODUCTS, products), [products]);
  useEffect(() => cache(STORAGE_KEYS.SALES, sales), [sales]);
  useEffect(() => cache(STORAGE_KEYS.MOVEMENTS, stockMovements), [stockMovements]);
  useEffect(() => cache(STORAGE_KEYS.CATEGORIES, categories), [categories]);
  useEffect(() => cache(STORAGE_KEYS.CLOSED_SHIFTS, closedShifts), [closedShifts]);
  useEffect(() => {
    try {
      if (currentShift) localStorage.setItem(key(STORAGE_KEYS.SHIFT), JSON.stringify(currentShift));
      else localStorage.removeItem(key(STORAGE_KEYS.SHIFT));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShift]);

  // Product CRUD
  const addProduct = (data: Omit<Product, 'id' | 'updatedAt'>): Product => {
    const newProduct: Product = {
      ...data,
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      updatedAt: new Date().toISOString(),
    };

    const nextProducts = [newProduct, ...products];
    setProducts(nextProducts);

    if (data.category && !categories.includes(data.category)) {
      addCategory(data.category);
    }

    if (newProduct.stock > 0) {
      const movement: StockMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: new Date().toISOString(),
        productId: newProduct.id,
        productName: newProduct.name,
        type: 'ingreso',
        quantityChange: newProduct.stock,
        previousStock: 0,
        newStock: newProduct.stock,
        reason: 'Carga inicial de producto',
        costPrice: newProduct.costPrice,
      };
      setStockMovements((prev) => [movement, ...prev]);
    }

    // Broadcast to other phones

    return newProduct;
  };

  const updateProduct = (id: string, data: Partial<Product>) => {
    const nextProducts = products.map((p) => {
      if (p.id === id) {
        const updated = { ...p, ...data, updatedAt: new Date().toISOString() };

        // A new expiration date means a fresh batch — clear the "ya liquidado"
        // flag so it can show up in the alerts list again if it becomes urgent.
        if (data.expirationDate !== undefined && data.expirationDate !== p.expirationDate) {
          updated.liquidationApplied = false;
        }

        if (data.stock !== undefined && data.stock !== p.stock) {
          const diff = data.stock - p.stock;
          const movement: StockMovement = {
            id: `mov-${Date.now()}-${p.id}-${Math.random().toString(36).slice(2, 6)}`,
            date: new Date().toISOString(),
            productId: p.id,
            productName: p.name,
            type: 'ajuste',
            quantityChange: diff,
            previousStock: p.stock,
            newStock: data.stock,
            reason: 'Ajuste manual de inventario',
            costPrice: p.costPrice,
          };
          setStockMovements((prevMovs) => [movement, ...prevMovs]);
        }
        return updated;
      }
      return p;
    });

    setProducts(nextProducts);
  };

  const deleteProduct = (id: string) => {
    const nextProducts = products.filter((p) => p.id !== id);
    setProducts(nextProducts);
  };

  const restockProduct = (id: string, quantityAdded: number, newCostPrice?: number, newSalePrice?: number) => {
    if (quantityAdded <= 0) return;
    const nextProducts = products.map((p) => {
      if (p.id === id) {
        const newStock = p.stock + quantityAdded;
        const cost = newCostPrice !== undefined ? newCostPrice : p.costPrice;
        const sale = newSalePrice !== undefined ? newSalePrice : p.salePrice;

        const movement: StockMovement = {
          id: `mov-${Date.now()}-${p.id}-${Math.random().toString(36).slice(2, 6)}`,
          date: new Date().toISOString(),
          productId: p.id,
          productName: p.name,
          type: 'ingreso',
          quantityChange: quantityAdded,
          previousStock: p.stock,
          newStock: newStock,
          reason: 'Reabastecimiento de mercadería / Compra',
          costPrice: cost,
        };
        setStockMovements((prevMovs) => [movement, ...prevMovs]);

        return {
          ...p,
          stock: newStock,
          costPrice: cost,
          salePrice: sale,
          liquidationApplied: false,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });

    setProducts(nextProducts);
  };

  const applyBulkPriceAdjustment = (category: string | 'ALL', percentage: number) => {
    const factor = 1 + percentage / 100;
    const nextProducts = products.map((p) => {
      if (category === 'ALL' || p.category === category) {
        const updatedSalePrice = Math.round(p.salePrice * factor);
        return {
          ...p,
          salePrice: updatedSalePrice,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });

    setProducts(nextProducts);
  };

  // Record Sale
  const recordSale = (
    items: CartItem[],
    paymentMethod: PaymentMethod,
    cashReceived?: number,
    discount: number = 0,
    customerName?: string,
    note?: string
  ): Sale => {
    const subtotal = items.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
    const finalTotal = Math.max(0, subtotal - discount);
    const totalCost = items.reduce((acc, it) => acc + (it.product.costPrice * it.quantity), 0);
    const totalProfit = finalTotal - totalCost;

    const saleItems: SaleItem[] = items.map((it) => {
      const lineTotal = it.unitPrice * it.quantity;
      const lineCost = it.product.costPrice * it.quantity;
      return {
        productId: it.product.id,
        productName: it.product.name,
        category: it.product.category,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unitCost: it.product.costPrice,
        total: lineTotal,
        profit: lineTotal - lineCost,
      };
    });

    const newSale: Sale = {
      id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: new Date().toISOString(),
      items: saleItems,
      subtotal,
      discount,
      total: finalTotal,
      totalCost,
      totalProfit,
      paymentMethod,
      cashReceived,
      change: cashReceived ? Math.max(0, cashReceived - finalTotal) : 0,
      customerName,
      note,
      status: 'completada',
    };

    // Update product stock
    const nextProducts = products.map((p) => {
      const itemSold = items.find((it) => it.product.id === p.id);
      if (itemSold) {
        const updatedStock = Math.max(0, p.stock - itemSold.quantity);
        return {
          ...p,
          stock: updatedStock,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });

    setProducts(nextProducts);

    // Create stock movements
    const movements: StockMovement[] = items.map((it) => {
      const currentProd = products.find((p) => p.id === it.product.id);
      const currentStk = currentProd ? currentProd.stock : 0;
      return {
        id: `mov-${Date.now()}-${it.product.id}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        productId: it.product.id,
        productName: it.product.name,
        type: 'venta',
        quantityChange: -it.quantity,
        previousStock: currentStk,
        newStock: Math.max(0, currentStk - it.quantity),
        reason: `Venta #${newSale.id.slice(-5)}`,
        costPrice: it.product.costPrice,
      };
    });

    setStockMovements((prev) => [...movements, ...prev]);
    setSales((prev) => [newSale, ...prev]);

    try {
      playSuccessBeep();
    } catch {
      // Audio fallback
    }

    return newSale;
  };

  const cancelSale = (saleId: string, reason?: string) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale || sale.status === 'anulada') return;

    const nextSales = sales.map((s) => (s.id === saleId ? { ...s, status: 'anulada' as const } : s));
    setSales(nextSales);

    const nextProducts = products.map((p) => {
      const item = sale.items.find((it) => it.productId === p.id);
      if (item) {
        const newStock = p.stock + item.quantity;
        return {
          ...p,
          stock: newStock,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });

    setProducts(nextProducts);

    const restoreMovements: StockMovement[] = sale.items.map((it) => {
      const currentProd = products.find((p) => p.id === it.productId);
      const currentStk = currentProd ? currentProd.stock : 0;
      return {
        id: `mov-anul-${Date.now()}-${it.productId}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        productId: it.productId,
        productName: it.productName,
        type: 'anulacion_venta',
        quantityChange: it.quantity,
        previousStock: currentStk,
        newStock: currentStk + it.quantity,
        reason: `Devolución por anulación de Venta #${sale.id.slice(-5)}`,
        costPrice: it.unitCost,
      };
    });

    setStockMovements((prev) => [...restoreMovements, ...prev]);
  };

  // Shift management
  const openShift = (initialCash: number) => {
    const shift: CashRegisterShift = {
      id: `shift-${Date.now()}`,
      openedAt: new Date().toISOString(),
      initialCash,
      isOpen: true,
    };
    setCurrentShift(shift);
  };

  const closeShift = (finalCashReal: number, notes?: string) => {
    if (!currentShift) return;

    const shiftStartTime = new Date(currentShift.openedAt).getTime();
    const cashSalesTotal = sales
      .filter((s) => s.status === 'completada' && s.paymentMethod === 'Efectivo' && new Date(s.date).getTime() >= shiftStartTime)
      .reduce((acc, s) => acc + s.total, 0);
    // Fiados que se cobraron en efectivo durante este turno
    const cashFiadosTotal = sales
      .filter((s) => s.status === 'completada' && s.fiadoPaidMethod === 'Efectivo' && s.fiadoPaidAt && new Date(s.fiadoPaidAt).getTime() >= shiftStartTime)
      .reduce((acc, s) => acc + s.total, 0);

    const expectedCash = currentShift.initialCash + cashSalesTotal + cashFiadosTotal;

    const closed: CashRegisterShift = {
      ...currentShift,
      closedAt: new Date().toISOString(),
      finalCashCalculated: expectedCash,
      finalCashReal,
      notes,
      isOpen: false,
    };

    setCurrentShift(closed);
    // Historial de cierres (antes el cierre anterior se perdía al abrir otro turno)
    setClosedShifts((prev) => [closed, ...prev.filter((s) => s.id !== closed.id)].slice(0, 365));
  };

  // Cobrar un fiado: queda registrado cuándo y cómo se pagó.
  const settleFiado = (saleId: string, method: Exclude<PaymentMethod, 'Cuenta Corriente (Fiado)'>) => {
    setSales((prev) =>
      prev.map((s) =>
        s.id === saleId && s.paymentMethod === 'Cuenta Corriente (Fiado)' && !s.fiadoPaidAt
          ? { ...s, fiadoPaidAt: new Date().toISOString(), fiadoPaidMethod: method }
          : s
      )
    );
  };

  const resetData = () => {
    setProducts(INITIAL_PRODUCTS);
    setSales(generateSampleSales());
    setStockMovements([]);
    setCurrentShift(INITIAL_SHIFTS[0]);
    setClosedShifts([]);
  };

  const clearAllData = () => {
    setProducts([]);
    setSales([]);
    setStockMovements([]);
    const freshShift: CashRegisterShift = {
      id: `shift-${Date.now()}`,
      openedAt: new Date().toISOString(),
      initialCash: 0,
      isOpen: false,
    };
    setCurrentShift(freshShift);
    setClosedShifts([]);
  };

  const clearSalesHistory = () => {
    setSales([]);
    setStockMovements([]);
  };

  const clearAllProducts = () => {
    setProducts([]);
    setStockMovements([]);
  };

  const resetInventoryStock = () => {
    const zeroStock = products.map((p) => ({
      ...p,
      stock: 0,
      updatedAt: new Date().toISOString(),
    }));
    setProducts(zeroStock);
  };

  const importData = (imported: { products?: Product[]; sales?: Sale[] }) => {
    if (imported.products && Array.isArray(imported.products)) {
      setProducts(imported.products);
    }
    if (imported.sales && Array.isArray(imported.sales)) {
      setSales(imported.sales);
    }
    // Local-only: state updates are persisted to localStorage by the effects above.
  };

  // Alerts calculations
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  const outOfStockProducts = products.filter((p) => p.stock <= 0);
  const expiringProducts = products.filter((p) => {
    if (!p.expirationDate || p.liquidationApplied) return false;
    const days = getDaysUntil(p.expirationDate);
    return days >= 0 && days <= 7;
  });
  const expiredProducts = products.filter((p) => {
    if (!p.expirationDate) return false;
    const days = getDaysUntil(p.expirationDate);
    return days < 0;
  });

  const totalAlertsCount =
    lowStockProducts.length +
    outOfStockProducts.length +
    expiringProducts.length +
    expiredProducts.length;

  // Today totals
  // "Hoy" según la hora de Argentina (antes, después de las 21 h las ventas del día desaparecían).
  const isToday = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };
  const todaySales = sales.filter((s) => s.status === 'completada' && isToday(s.date));
  const todaySalesTotal = todaySales.reduce((acc, s) => acc + s.total, 0);
  const todayProfitTotal = todaySales.reduce((acc, s) => acc + s.totalProfit, 0);
  const todaySalesCount = todaySales.length;

  return (
    <KioskContext.Provider
      value={{
        products,
        sales,
        stockMovements,
        currentShift,
        activeTab,
        setActiveTab,
        addProduct,
        updateProduct,
        deleteProduct,
        restockProduct,
        applyBulkPriceAdjustment,
        recordSale,
        cancelSale,
        openShift,
        closeShift,
        resetData,
        clearAllData,
        clearSalesHistory,
        clearAllProducts,
        resetInventoryStock,
        importData,
        categories,
        addCategory,
        deleteCategory,
        cloudEnabled: cloud,
        cloudSyncStatus,
        cloudError,
        lastSyncTime,
        manualSync,
        closedShifts,
        settleFiado,
        lowStockProducts,
        outOfStockProducts,
        expiringProducts,
        expiredProducts,
        totalAlertsCount,
        todaySalesTotal,
        todayProfitTotal,
        todaySalesCount,
        searchFilter,
        setSearchFilter,
      }}
    >
      {children}
    </KioskContext.Provider>
  );
};

export const useKiosk = () => {
  const context = useContext(KioskContext);
  if (!context) {
    throw new Error('useKiosk must be used within a KioskProvider');
  }
  return context;
};

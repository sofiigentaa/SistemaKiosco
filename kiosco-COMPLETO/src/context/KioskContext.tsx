import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Product, Sale, CartItem, SaleItem, StockMovement, CashRegisterShift, PaymentMethod } from '../types';
import { INITIAL_PRODUCTS, generateSampleSales, INITIAL_SHIFTS, INITIAL_CATEGORIES } from '../data/initialData';
import { getDaysUntil, playSuccessBeep } from '../utils/formatters';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchCloudState, pushCloudState, subscribeCloudState, KioskCloudState } from '../lib/supabaseSync';

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
  lastSyncTime: string | null;
  manualSync: () => void;

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

export const KioskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'alerts' | 'sales' | 'reports' | 'cash'>('pos');
  const [searchFilter, setSearchFilter] = useState('');

  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'local' | 'error'>(
    isSupabaseConfigured ? 'syncing' : 'local'
  );
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const stampSyncTime = () =>
    setLastSyncTime(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  // Initialize categories
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [...INITIAL_CATEGORIES];
  });

  // Initialize products from localStorage or defaults
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_PRODUCTS;
  });

  // Initialize sales
  const [sales, setSales] = useState<Sale[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SALES);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return generateSampleSales();
  });

  // Initialize movements
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  // Initialize current shift
  const [currentShift, setCurrentShift] = useState<CashRegisterShift | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SHIFT);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_SHIFTS[0];
  });

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

  // Guards for the Supabase cloud sync loop (see effects below)
  const isApplyingRemoteRef = useRef(false);
  const pushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasBootstrappedRef = useRef(false);

  // Add category helper
  const addCategory = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setCategories((prev) => {
      if (prev.includes(clean)) return prev;
      const next = [...prev, clean];
      try {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const deleteCategory = useCallback((name: string) => {
    const clean = name.trim();
    setCategories((prev) => {
      const next = prev.filter((c) => c !== clean);
      try {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Force an immediate push of the current state to Supabase
  const manualSync = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setCloudSyncStatus('syncing');
    const ok = await pushCloudState({
      products: productsRef.current,
      sales: salesRef.current,
      stockMovements: movementsRef.current,
      currentShift: shiftRef.current,
      categories: categoriesRef.current,
      updatedAt: new Date().toISOString(),
    });
    setCloudSyncStatus(ok ? 'synced' : 'error');
    if (ok) stampSyncTime();
  }, []);

  // Apply a state snapshot received from Supabase (initial load or realtime)
  const applyCloudState = useCallback((state: KioskCloudState) => {
    isApplyingRemoteRef.current = true;
    setProducts(state.products || []);
    setSales(state.sales || []);
    setStockMovements(state.stockMovements || []);
    setCurrentShift(state.currentShift ?? null);
    if (state.categories && state.categories.length > 0) {
      setCategories(state.categories);
    }
    setCloudSyncStatus('synced');
    stampSyncTime();
  }, []);

  // Bootstrap: on first load, pull whatever is already in Supabase (or push
  // this device's local data if the cloud is empty), then listen for
  // realtime changes coming from other devices.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCloudSyncStatus('local');
      return;
    }

    let unsubscribe: (() => void) | null = null;

    (async () => {
      setCloudSyncStatus('syncing');
      const cloudState = await fetchCloudState();

      if (cloudState) {
        applyCloudState(cloudState);
      } else {
        const ok = await pushCloudState({
          products: productsRef.current,
          sales: salesRef.current,
          stockMovements: movementsRef.current,
          currentShift: shiftRef.current,
          categories: categoriesRef.current,
          updatedAt: new Date().toISOString(),
        });
        setCloudSyncStatus(ok ? 'synced' : 'error');
        if (ok) stampSyncTime();
      }

      hasBootstrappedRef.current = true;
      unsubscribe = subscribeCloudState(applyCloudState);
    })();

    return () => {
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push local changes to Supabase whenever the data actually changes
  // (debounced, and skipped when the change came FROM Supabase itself).
  useEffect(() => {
    if (!isSupabaseConfigured || !hasBootstrappedRef.current) return;

    if (isApplyingRemoteRef.current) {
      isApplyingRemoteRef.current = false;
      return;
    }

    setCloudSyncStatus('syncing');
    if (pushTimeoutRef.current) clearTimeout(pushTimeoutRef.current);
    pushTimeoutRef.current = setTimeout(async () => {
      const ok = await pushCloudState({
        products,
        sales,
        stockMovements,
        currentShift,
        categories,
        updatedAt: new Date().toISOString(),
      });
      setCloudSyncStatus(ok ? 'synced' : 'error');
      if (ok) stampSyncTime();
    }, 600);

    return () => {
      if (pushTimeoutRef.current) clearTimeout(pushTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, sales, stockMovements, currentShift, categories]);

  // Local storage caching
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    } catch (e) {
      console.error('Error saving products:', e);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
    } catch (e) {
      console.error('Error saving sales:', e);
    }
  }, [sales]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(stockMovements));
    } catch (e) {
      console.error('Error saving movements:', e);
    }
  }, [stockMovements]);

  useEffect(() => {
    try {
      if (currentShift) {
        localStorage.setItem(STORAGE_KEYS.SHIFT, JSON.stringify(currentShift));
      } else {
        localStorage.removeItem(STORAGE_KEYS.SHIFT);
      }
    } catch (e) {
      console.error('Error saving shift:', e);
    }
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
        id: `mov-${Date.now()}`,
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
            id: `mov-${Date.now()}-${p.id}`,
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
          id: `mov-${Date.now()}-${p.id}`,
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
      id: `sale-${Date.now()}`,
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
        id: `mov-${Date.now()}-${it.product.id}`,
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
        id: `mov-anul-${Date.now()}-${it.productId}`,
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

    const expectedCash = currentShift.initialCash + cashSalesTotal;

    const closed: CashRegisterShift = {
      ...currentShift,
      closedAt: new Date().toISOString(),
      finalCashCalculated: expectedCash,
      finalCashReal,
      notes,
      isOpen: false,
    };

    setCurrentShift(closed);
  };

  const resetData = () => {
    setProducts(INITIAL_PRODUCTS);
    setSales(generateSampleSales());
    setStockMovements([]);
    setCurrentShift(INITIAL_SHIFTS[0]);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.SALES);
    localStorage.removeItem(STORAGE_KEYS.MOVEMENTS);
    localStorage.removeItem(STORAGE_KEYS.SHIFT);
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
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.SHIFT, JSON.stringify(freshShift));
    } catch {}
  };

  const clearSalesHistory = () => {
    setSales([]);
    setStockMovements([]);
    try {
      localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
    } catch {}
  };

  const clearAllProducts = () => {
    setProducts([]);
    setStockMovements([]);
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify([]));
    } catch {}
  };

  const resetInventoryStock = () => {
    const zeroStock = products.map((p) => ({
      ...p,
      stock: 0,
      updatedAt: new Date().toISOString(),
    }));
    setProducts(zeroStock);
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(zeroStock));
    } catch {}
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
  const todayDateString = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter((s) => s.status === 'completada' && s.date.startsWith(todayDateString));
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
        cloudEnabled: isSupabaseConfigured,
        cloudSyncStatus,
        lastSyncTime,
        manualSync,
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

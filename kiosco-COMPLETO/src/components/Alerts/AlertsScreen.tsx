import React, { useState } from 'react';
import { 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  PackageX, 
  Plus, 
  CheckCircle2,
  Tag,
  Percent,
  SlidersHorizontal,
  Zap
} from 'lucide-react';
import { useKiosk } from '../../context/KioskContext';
import { Product } from '../../types';
import { formatCurrency, formatDate, getDaysUntil } from '../../utils/formatters';
import { ExpiryDiscountModal } from './ExpiryDiscountModal';
import { ExpiringProductRow } from './ExpiringProductRow';

interface AlertsScreenProps {
  onGoToInventory: () => void;
  onGoToPOS: () => void;
}

export const AlertsScreen: React.FC<AlertsScreenProps> = ({ onGoToInventory, onGoToPOS }) => {
  const { 
    lowStockProducts, 
    outOfStockProducts, 
    expiringProducts, 
    expiredProducts,
    restockProduct,
    updateProduct
  } = useKiosk();

  const [activeSubTab, setActiveSubTab] = useState<'ALL' | 'STOCK' | 'EXPIRY'>('ALL');
  const [quickRestockModal, setQuickRestockModal] = useState<Product | null>(null);
  const [quickRestockQty, setQuickRestockQty] = useState<number>(10);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [showBulkExpiryModal, setShowBulkExpiryModal] = useState(false);

  const handleQuickRestock = () => {
    if (!quickRestockModal || quickRestockQty <= 0) return;
    restockProduct(quickRestockModal.id, quickRestockQty);
    setSuccessToast('Se agregaron ' + quickRestockQty + ' unidades a ' + quickRestockModal.name);
    setQuickRestockModal(null);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleApplyDiscountUpdates = (updates: Array<{ id: string; newPrice: number }>, label: string) => {
    updates.forEach((u) => {
      updateProduct(u.id, { salePrice: u.newPrice, liquidationApplied: true });
    });
    setSuccessToast(label);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const totalStockAlerts = outOfStockProducts.length + lowStockProducts.length;
  const totalExpiryAlerts = expiredProducts.length + expiringProducts.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3.5">
      
      {/* Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-indigo-600" />
            <span>Centro de Alertas & Notificaciones</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Supervise quiebres de stock, faltantes críticos y mercadería próxima a vencer para evitar pérdidas.
          </p>
        </div>

        {/* Subtab Filters */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('ALL')}
            className={'px-2.5 py-1 rounded text-xs font-semibold transition-all ' + (
              activeSubTab === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            Todas ({totalStockAlerts + totalExpiryAlerts})
          </button>
          <button
            onClick={() => setActiveSubTab('STOCK')}
            className={'px-2.5 py-1 rounded text-xs font-semibold transition-all ' + (
              activeSubTab === 'STOCK'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            Stock ({totalStockAlerts})
          </button>
          <button
            onClick={() => setActiveSubTab('EXPIRY')}
            className={'px-2.5 py-1 rounded text-xs font-semibold transition-all ' + (
              activeSubTab === 'EXPIRY'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            Vencimientos ({totalExpiryAlerts})
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        
        {/* Out of stock card */}
        <div className="bg-red-50/70 border border-red-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-red-800 tracking-wider">Agotados (0 Stock)</span>
            <PackageX className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-900 mt-1">{outOfStockProducts.length}</div>
          <div className="text-[11px] text-red-700 mt-0.5 font-medium">Quiebre total de producto</div>
        </div>

        {/* Low stock card */}
        <div className="bg-orange-50/70 border border-orange-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-orange-800 tracking-wider">Stock Bajo (Crítico)</span>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-orange-900 mt-1">{lowStockProducts.length}</div>
          <div className="text-[11px] text-orange-700 mt-0.5 font-medium">Debajo del stock mínimo</div>
        </div>

        {/* Expired card */}
        <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-rose-800 tracking-wider">Ya Vencidos</span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-900 mt-1">{expiredProducts.length}</div>
          <div className="text-[11px] text-rose-700 mt-0.5 font-medium">Retirar de exhibición</div>
        </div>

        {/* Expiring soon */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">Vence en ≤ 7 días</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-900 mt-1">{expiringProducts.length}</div>
          <div className="text-[11px] text-amber-700 mt-0.5 font-medium">Priorizar venta / descuento</div>
        </div>

      </div>

      {/* DETAILED ALERT SECTIONS */}
      <div className="space-y-3.5">
        
        {/* SECTION 1: OUT OF STOCK PRODUCTS */}
        {(activeSubTab === 'ALL' || activeSubTab === 'STOCK') && outOfStockProducts.length > 0 && (
          <div className="bg-white rounded-lg border border-red-200 shadow-xs overflow-hidden">
            <div className="bg-red-600 px-4 py-2.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageX className="w-4 h-4" />
                <h3 className="font-bold text-xs uppercase tracking-wide">
                  PRODUCTOS AGOTADOS - QUIEBRE DE STOCK ({outOfStockProducts.length})
                </h3>
              </div>
              <span className="text-[10px] bg-red-700 px-2 py-0.5 rounded font-bold">Acción Inmediata</span>
            </div>

            <div className="p-3 divide-y divide-slate-100">
              {outOfStockProducts.map((p) => (
                <div key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                        {p.category.split('&')[0]}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      P. Venta: <span className="font-bold text-slate-700">{formatCurrency(p.salePrice)}</span> • Proveedor: <span className="font-medium text-slate-700">{p.supplier || 'No especificado'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setQuickRestockModal(p);
                        setQuickRestockQty(10);
                      }}
                      className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Reponer Stock</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: LOW STOCK PRODUCTS */}
        {(activeSubTab === 'ALL' || activeSubTab === 'STOCK') && lowStockProducts.length > 0 && (
          <div className="bg-white rounded-lg border border-orange-200 shadow-xs overflow-hidden">
            <div className="bg-orange-500 px-4 py-2.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-white" />
                <h3 className="font-bold text-xs uppercase tracking-wide">
                  PRODUCTOS CON STOCK BAJO / CRÍTICO ({lowStockProducts.length})
                </h3>
              </div>
              <span className="text-[10px] bg-orange-700 text-white px-2 py-0.5 rounded font-bold">
                Reordenar
              </span>
            </div>

            <div className="p-3 divide-y divide-slate-100">
              {lowStockProducts.map((p) => (
                <div key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-200 font-mono">
                        Quedan solo {p.stock} u. (Mínimo: {p.minStock})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      Costo: {formatCurrency(p.costPrice)} • Proveedor: {p.supplier || 'Directo'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setQuickRestockModal(p);
                        setQuickRestockQty(p.minStock * 2);
                      }}
                      className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Ingresar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: EXPIRING PRODUCTS */}
        {(activeSubTab === 'ALL' || activeSubTab === 'EXPIRY') && (expiredProducts.length > 0 || expiringProducts.length > 0) && (
          <div className="bg-white rounded-lg border border-amber-200 shadow-xs overflow-hidden">
            <div className="bg-amber-600 px-4 py-2.5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <h3 className="font-bold text-xs uppercase tracking-wide">
                  CONTROL DE VENCIMIENTOS ({expiredProducts.length + expiringProducts.length})
                </h3>
                <span className="text-[10px] bg-amber-700/80 px-2 py-0.5 rounded font-bold">
                  Gestión de Caducidad
                </span>
              </div>

              {expiringProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBulkExpiryModal(true)}
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-50 text-amber-900 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Elegir margen de descuento masivo para todos los productos por vencer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span>Liquidar Todos por Vencer ({expiringProducts.length})</span>
                </button>
              )}
            </div>

            <div className="p-3 divide-y divide-slate-100">
              {/* Expired items */}
              {expiredProducts.map((p) => {
                const days = getDaysUntil(p.expirationDate);
                return (
                  <div key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-red-50/50 p-2.5 rounded mb-1.5">
                    <div>
                      <div className="font-bold text-red-900 text-xs flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold text-[9px] uppercase">
                          ¡VENCIDO HACE {Math.abs(days!)} DÍAS!
                        </span>
                      </div>
                      <div className="text-[11px] text-red-800 mt-0.5 font-mono">
                        Fecha: {formatDate(p.expirationDate!)} • {p.stock} unidades en góndola.
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        updateProduct(p.id, { stock: 0 });
                        setSuccessToast('Se dieron de baja ' + p.stock + ' unidades vencidas de ' + p.name);
                        setTimeout(() => setSuccessToast(null), 3000);
                      }}
                      className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Dar de Baja ({p.stock} u.)
                    </button>
                  </div>
                );
              })}

              {/* Expiring Soon items */}
              {expiringProducts.map((p) => (
                <ExpiringProductRow
                  key={p.id}
                  product={p}
                  onUpdatePrice={(productId, newPrice, label) => {
                    updateProduct(productId, { salePrice: newPrice, liquidationApplied: true });
                    setSuccessToast(label);
                    setTimeout(() => setSuccessToast(null), 3000);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ALL CLEAR STATE */}
        {totalStockAlerts === 0 && totalExpiryAlerts === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200 p-6 shadow-xs">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">¡Todo en Orden! Sin Alertas Activas</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Todos los productos tienen niveles de stock saludables y no hay mercadería vencida ni próxima a vencer.
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={onGoToPOS}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700"
              >
                Ir a Venta (POS)
              </button>
              <button
                onClick={onGoToInventory}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded hover:bg-slate-200"
              >
                Ver Todo el Inventario
              </button>
            </div>
          </div>
        )}

      </div>

      {/* QUICK RESTOCK POPUP */}
      {quickRestockModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-lg p-5 shadow-xl border border-slate-200 space-y-3.5">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Reponer {quickRestockModal.name}</span>
            </h4>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad a Ingresar</label>
              <input
                type="number"
                min="1"
                value={quickRestockQty}
                onChange={(e) => setQuickRestockQty(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-base font-bold font-mono text-slate-900"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setQuickRestockModal(null)}
                className="flex-1 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleQuickRestock}
                className="flex-1 py-1.5 rounded bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 cursor-pointer"
              >
                Confirmar Ingreso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK EXPIRY DISCOUNT MODAL (ALL EXPIRING PRODUCTS) */}
      {showBulkExpiryModal && (
        <ExpiryDiscountModal
          products={expiringProducts}
          targetProduct={null}
          onApply={handleApplyDiscountUpdates}
          onClose={() => setShowBulkExpiryModal(false)}
        />
      )}

    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { Tag, Percent, AlertTriangle, Clock, X, Check, CheckCheck, ArrowDownRight, Layers, Sparkles, Filter } from 'lucide-react';
import { Product } from '../../types';
import { formatCurrency, formatPercent, formatDate, getDaysUntil } from '../../utils/formatters';

interface LiquidationModalProps {
  products: Product[];
  categories: string[];
  onApplyLiquidation: (productIds: string[], discountPct: number | 'COST') => void;
  onClose: () => void;
}

export const LiquidationModal: React.FC<LiquidationModalProps> = ({
  products,
  categories,
  onApplyLiquidation,
  onClose,
}) => {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'EXPIRING' | 'LOW_SALES' | 'EXCESS_STOCK' | 'CATEGORY' | 'ALL'>('EXPIRING');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [discountType, setDiscountType] = useState<10 | 15 | 20 | 30 | 50 | 'CUSTOM' | 'COST'>(20);
  const [customPct, setCustomPct] = useState<number | ''>(25);

  // Products filtered based on the current liquidation preset
  const candidateProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterMode === 'EXPIRING') {
        if (!p.expirationDate || p.liquidationApplied) return false;
        const days = getDaysUntil(p.expirationDate);
        return days !== null && days <= 15; // Vence en 15 días o menos o ya vencido
      }
      if (filterMode === 'EXCESS_STOCK') {
        return p.stock >= 20; // Mercadería estancada con mucho stock
      }
      if (filterMode === 'CATEGORY') {
        return selectedCategory === 'ALL' || p.category === selectedCategory;
      }
      return true;
    });
  }, [products, filterMode, selectedCategory]);

  // Auto-select all filtered products when filterMode changes
  React.useEffect(() => {
    setSelectedProductIds(candidateProducts.map((p) => p.id));
  }, [candidateProducts]);

  const toggleSelectAll = () => {
    if (selectedProductIds.length === candidateProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(candidateProducts.map((p) => p.id));
    }
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const effectiveDiscountPct = discountType === 'CUSTOM' ? Number(customPct) || 0 : discountType;

  const handleApply = () => {
    if (selectedProductIds.length === 0) return;
    if (effectiveDiscountPct === 'COST') {
      onApplyLiquidation(selectedProductIds, 'COST');
    } else if (effectiveDiscountPct > 0) {
      onApplyLiquidation(selectedProductIds, effectiveDiscountPct);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-amber-600 px-4 sm:px-6 py-3.5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-200" />
            <div>
              <h3 className="text-sm font-bold tracking-wide">MÓDULO DE LIQUIDACIÓN Y OFERTAS</h3>
              <p className="text-[11px] text-amber-100">
                Rebaje precios rápidamente para rotar mercadería próxima a vencer o exceso de stock.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-amber-700/60 text-white hover:bg-amber-700 flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Presets */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              1. Seleccionar Criterio de Liquidación:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterMode('EXPIRING')}
                className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  filterMode === 'EXPIRING'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Por Vencimiento</span>
                </div>
                <span className="text-[10px] opacity-90 mt-1">≤ 15 días o vencidos</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('EXCESS_STOCK')}
                className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  filterMode === 'EXCESS_STOCK'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Exceso Stock</span>
                </div>
                <span className="text-[10px] opacity-90 mt-1">Stock ≥ 20 u.</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('CATEGORY')}
                className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  filterMode === 'CATEGORY'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Por Rubro</span>
                </div>
                <span className="text-[10px] opacity-90 mt-1">Categoría puntual</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  filterMode === 'ALL'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Todo el Kiosco</span>
                </div>
                <span className="text-[10px] opacity-90 mt-1">Selección manual</span>
              </button>
            </div>
          </div>

          {filterMode === 'CATEGORY' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Rubro:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
              >
                <option value="ALL">Todas las Categorías</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Discount Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              2. Definir Porcentaje de Descuento / Rebaja:
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {[10, 15, 20, 30, 50].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setDiscountType(pct as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    discountType === pct
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  -{pct}%
                </button>
              ))}

              <button
                type="button"
                onClick={() => setDiscountType('COST')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  discountType === 'COST'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                    : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                }`}
                title="Vender exactamente al precio de costo para recuperar el capital invertido"
              >
                🔥 Al Costo (0% Ganancia)
              </button>

              <button
                type="button"
                onClick={() => setDiscountType('CUSTOM')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  discountType === 'CUSTOM'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Personalizado %
              </button>

              {discountType === 'CUSTOM' && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={customPct}
                    onChange={(e) => setCustomPct(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                    placeholder="%"
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product selection list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200 text-xs">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>
                {selectedProductIds.length === candidateProducts.length
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos (' + candidateProducts.length + ')'}
              </span>
            </button>
            <span className="text-slate-500 font-medium">
              {selectedProductIds.length} seleccionados
            </span>
          </div>

          {candidateProducts.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No hay productos que cumplan el criterio seleccionado.
            </div>
          ) : (
            <div className="space-y-1.5">
              {candidateProducts.map((p) => {
                const isSelected = selectedProductIds.includes(p.id);
                const days = getDaysUntil(p.expirationDate);
                let newPrice = p.salePrice;
                if (effectiveDiscountPct === 'COST') {
                  newPrice = p.costPrice;
                } else if (typeof effectiveDiscountPct === 'number') {
                  newPrice = Math.round((p.salePrice * (1 - effectiveDiscountPct / 100)) / 10) * 10;
                  if (newPrice < p.costPrice) newPrice = p.costPrice;
                }

                return (
                  <div
                    key={p.id}
                    onClick={() => toggleProduct(p.id)}
                    className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-0 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {days !== null && days <= 15 && (
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              days <= 0 ? 'bg-rose-600 text-white' : 'bg-amber-200 text-amber-900'
                            }`}>
                              {days <= 0 ? '¡VENCIDO!' : `Vence en ${days} d`}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Stock: {p.stock} u. • Costo: {formatCurrency(p.costPrice)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400 line-through font-mono">
                        {formatCurrency(p.salePrice)}
                      </div>
                      <div className="text-xs font-bold text-emerald-700 font-mono flex items-center gap-0.5 justify-end">
                        <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                        <span>{formatCurrency(newPrice)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={selectedProductIds.length === 0}
            onClick={handleApply}
            className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>
              Aplicar Liquidación a {selectedProductIds.length} Producto(s)
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};

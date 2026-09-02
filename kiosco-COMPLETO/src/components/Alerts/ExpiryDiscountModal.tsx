import React, { useState, useMemo } from 'react';
import { Tag, Percent, ArrowDownRight, Check, X, Sparkles, DollarSign, Calculator } from 'lucide-react';
import { Product } from '../../types';
import { formatCurrency, formatPercent, formatDate, getDaysUntil } from '../../utils/formatters';

interface ExpiryDiscountModalProps {
  products: Product[];
  targetProduct?: Product | null; // If null, applies to all provided expiring products
  onApply: (updates: Array<{ id: string; newPrice: number }>, label: string) => void;
  onClose: () => void;
}

export const ExpiryDiscountModal: React.FC<ExpiryDiscountModalProps> = ({
  products,
  targetProduct,
  onApply,
  onClose,
}) => {
  const isSingle = !!targetProduct;
  const activeProducts = isSingle ? [targetProduct] : products;

  // Selected discount mode
  const [discountMode, setDiscountMode] = useState<'PERCENT' | 'PRICE' | 'COST'>('PERCENT');
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [customPrice, setCustomPrice] = useState<number | ''>(
    isSingle ? Math.round((targetProduct.salePrice * 0.8) / 10) * 10 : 0
  );

  // Quick preset percentages
  const presets = [10, 15, 20, 25, 30, 40, 50];

  const handlePresetClick = (pct: number) => {
    setDiscountMode('PERCENT');
    setDiscountPercent(pct);
    if (isSingle) {
      setCustomPrice(Math.round((targetProduct.salePrice * (1 - pct / 100)) / 10) * 10);
    }
  };

  const handlePriceChange = (val: number | '') => {
    setCustomPrice(val);
    if (isSingle && typeof val === 'number' && val > 0 && targetProduct.salePrice > 0) {
      const calculatedPct = Math.round(((targetProduct.salePrice - val) / targetProduct.salePrice) * 100);
      setDiscountPercent(Math.max(0, calculatedPct));
    }
  };

  const handlePercentChange = (pct: number) => {
    const clamped = Math.min(95, Math.max(1, pct));
    setDiscountPercent(clamped);
    if (isSingle) {
      setCustomPrice(Math.round((targetProduct.salePrice * (1 - clamped / 100)) / 10) * 10);
    }
  };

  // Calculate updates for all active products
  const previewUpdates = useMemo(() => {
    return activeProducts.map((p) => {
      let newPrice = p.salePrice;
      if (discountMode === 'COST') {
        newPrice = p.costPrice;
      } else if (discountMode === 'PRICE' && isSingle && typeof customPrice === 'number' && customPrice > 0) {
        newPrice = customPrice;
      } else {
        // PERCENT mode
        newPrice = Math.round((p.salePrice * (1 - discountPercent / 100)) / 10) * 10;
        if (newPrice < p.costPrice) {
          // Warning or allow at cost
          newPrice = Math.max(newPrice, p.costPrice);
        }
      }

      const profit = newPrice - p.costPrice;
      const margin = newPrice > 0 ? (profit / newPrice) * 100 : 0;
      const discountAmount = p.salePrice - newPrice;
      const effectivePct = p.salePrice > 0 ? Math.round((discountAmount / p.salePrice) * 100) : 0;

      return {
        product: p,
        newPrice,
        profit,
        margin,
        discountAmount,
        effectivePct,
      };
    });
  }, [activeProducts, discountMode, discountPercent, customPrice, isSingle]);

  const handleSubmit = () => {
    const updates = previewUpdates.map((u) => ({
      id: u.product.id,
      newPrice: u.newPrice,
    }));

    let label = '';
    if (discountMode === 'COST') {
      label = `🔥 Liquidación al Costo aplicada a ${updates.length} producto(s).`;
    } else if (isSingle) {
      label = `🏷️ Descuento de ${previewUpdates[0].effectivePct}% aplicado a ${targetProduct.name} (Nuevo precio: ${formatCurrency(previewUpdates[0].newPrice)})`;
    } else {
      label = `🏷️ Descuento de ${discountPercent}% aplicado a ${updates.length} productos por vencer.`;
    }

    onApply(updates, label);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-4 sm:px-6 py-3.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-200" />
            <div>
              <h3 className="text-sm font-bold tracking-wide uppercase">
                {isSingle ? 'Elegir Margen de Descuento' : 'Descuento Masivo por Caducidad'}
              </h3>
              <p className="text-[11px] text-amber-100">
                {isSingle ? targetProduct.name : `${activeProducts.length} productos próximos a vencer`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-amber-800/50 text-white hover:bg-amber-800 flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          
          {/* Discount Mode Tabs */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              1. Seleccione el tipo de rebaja:
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDiscountMode('PERCENT')}
                className={`py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  discountMode === 'PERCENT'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Porcentaje %</span>
              </button>

              {isSingle && (
                <button
                  type="button"
                  onClick={() => setDiscountMode('PRICE')}
                  className={`py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    discountMode === 'PRICE'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Precio Final $</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setDiscountMode('COST')}
                className={`py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  discountMode === 'COST'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 hover:bg-rose-50'
                } ${!isSingle ? 'col-span-2' : ''}`}
              >
                <span>🔥 Al Costo (0% Margen)</span>
              </button>
            </div>
          </div>

          {/* PERCENT MODE CONTROLS */}
          {discountMode === 'PERCENT' && (
            <div className="bg-amber-50/60 p-3.5 rounded-lg border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Margen de Descuento:</span>
                <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-amber-300 font-mono font-bold text-amber-900 text-sm">
                  <span>-{discountPercent}%</span>
                </div>
              </div>

              {/* Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="5"
                  max="70"
                  step="5"
                  value={discountPercent}
                  onChange={(e) => handlePercentChange(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>-5% (Leve)</span>
                  <span>-25% (Recomendado)</span>
                  <span>-70% (Liquidación extrema)</span>
                </div>
              </div>

              {/* Presets Chips */}
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <span className="text-[10px] font-bold text-slate-500 mr-1">Rápidos:</span>
                {presets.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handlePresetClick(pct)}
                    className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors cursor-pointer ${
                      discountPercent === pct
                        ? 'bg-amber-600 text-white border-amber-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-100'
                    }`}
                  >
                    -{pct}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DIRECT PRICE MODE CONTROLS */}
          {discountMode === 'PRICE' && isSingle && targetProduct && (
            <div className="bg-amber-50/60 p-3.5 rounded-lg border border-amber-200 space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Definir Nuevo Precio de Venta en Mano:
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    min={targetProduct.costPrice}
                    step="10"
                    value={customPrice}
                    onChange={(e) => handlePriceChange(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 bg-white border border-amber-300 rounded-lg text-sm font-bold text-slate-900 font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    placeholder="Ej. 650"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handlePriceChange(targetProduct.costPrice)}
                  className="px-2.5 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold rounded-lg border border-rose-300 transition-colors cursor-pointer"
                  title="Fijar al precio de compra"
                >
                  Al Costo ({formatCurrency(targetProduct.costPrice)})
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Precio actual: <span className="font-bold line-through">{formatCurrency(targetProduct.salePrice)}</span> • Costo base: <span className="font-bold">{formatCurrency(targetProduct.costPrice)}</span>
              </p>
            </div>
          )}

          {/* AT COST MODE EXPLANATION */}
          {discountMode === 'COST' && (
            <div className="bg-rose-50 p-3.5 rounded-lg border border-rose-200 text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <span>🔥 Venta al Costo (0% Ganancia)</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Los productos se rebajarán exactamente a su precio de compra para recuperar el 100% del capital antes de que caduquen.
              </p>
            </div>
          )}

          {/* Calculation & Live Impact Preview */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              2. Simulación de Impacto y Ganancia:
            </label>
            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-slate-200 p-2 bg-slate-50">
              {previewUpdates.map(({ product, newPrice, profit, margin, effectivePct }) => (
                <div
                  key={product.id}
                  className="p-2 bg-white rounded-md border border-slate-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{product.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Costo: {formatCurrency(product.costPrice)} • Original: <span className="line-through">{formatCurrency(product.salePrice)}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold font-mono text-emerald-700 text-xs flex items-center justify-end gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{formatCurrency(newPrice)}</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded ml-1">
                        -{effectivePct}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Ganancia: <span className={profit > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{formatCurrency(profit)}</span> ({formatPercent(margin)})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>
              Aplicar a {activeProducts.length} Producto{activeProducts.length > 1 ? 's' : ''}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};

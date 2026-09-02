import React, { useState } from 'react';
import { Check, ArrowRight, Sparkles, Flame, SlidersHorizontal, X } from 'lucide-react';
import { Product } from '../../types';
import { formatCurrency, formatDate, getDaysUntil } from '../../utils/formatters';

interface ExpiringProductRowProps {
  product: Product;
  onUpdatePrice: (productId: string, newPrice: number, label: string) => void;
}

export const ExpiringProductRow: React.FC<ExpiringProductRowProps> = ({
  product,
  onUpdatePrice,
}) => {
  const days = getDaysUntil(product.expirationDate);

  // Mode: 'DISCOUNT_PCT' (% rebaja) | 'MARGIN_PCT' (% margen s/costo) | 'PRICE' ($ precio final)
  const [inputMode, setInputMode] = useState<'DISCOUNT_PCT' | 'MARGIN_PCT' | 'PRICE'>('DISCOUNT_PCT');
  const [inputValue, setInputValue] = useState<string>('');
  const [justUpdated, setJustUpdated] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  // Urgency scale: today/1 day = red (critical), 2-3 days = orange, 4+ = amber
  const urgency: 'critical' | 'high' | 'medium' =
    days !== null && days <= 1 ? 'critical' : days !== null && days <= 3 ? 'high' : 'medium';

  const urgencyStyles = {
    critical: { badge: 'bg-red-600 text-white border-red-700', bar: 'bg-red-500' },
    high: { badge: 'bg-orange-500 text-white border-orange-600', bar: 'bg-orange-400' },
    medium: { badge: 'bg-amber-100 text-amber-900 border-amber-200', bar: 'bg-amber-300' },
  }[urgency];

  // Calculate live preview price based on mode & input
  const calculateNewPrice = (): number => {
    const num = parseFloat(inputValue);
    if (isNaN(num) || num <= 0) return product.salePrice;

    if (inputMode === 'DISCOUNT_PCT') {
      const discounted = product.salePrice * (1 - num / 100);
      return Math.max(1, Math.round(discounted / 10) * 10);
    } else if (inputMode === 'MARGIN_PCT') {
      const withMargin = product.costPrice * (1 + num / 100);
      return Math.max(1, Math.round(withMargin / 10) * 10);
    } else {
      return Math.max(1, Math.round(num));
    }
  };

  const previewPrice = calculateNewPrice();
  const numInput = parseFloat(inputValue);
  const isInputActive = !isNaN(numInput) && numInput > 0;
  const isPriceChanged = isInputActive && previewPrice !== product.salePrice;

  const previewProfit = previewPrice - product.costPrice;
  const previewMarginPct =
    previewPrice > 0 ? Math.round((previewProfit / previewPrice) * 100) : 0;
  const discountFromCurrent =
    product.salePrice > 0
      ? Math.round(((product.salePrice - previewPrice) / product.salePrice) * 100)
      : 0;

  const currentProfit = product.salePrice - product.costPrice;
  const currentMargin =
    product.salePrice > 0 ? Math.round((currentProfit / product.salePrice) * 100) : 0;

  const priceAt = (pct: number) => Math.max(1, Math.round((product.salePrice * (1 - pct / 100)) / 10) * 10);

  const applyAndCelebrate = () => {
    setJustUpdated(true);
    setInputValue('');
    setShowCustom(false);
    setTimeout(() => setJustUpdated(false), 3000);
  };

  const handleApply = () => {
    if (!isPriceChanged || previewPrice <= 0) return;
    let label = '';
    if (discountFromCurrent > 0) {
      label = `Rebaja aplicada a ${product.name}: ${formatCurrency(previewPrice)} (-${discountFromCurrent}%)`;
    } else {
      label = `Precio de ${product.name} ajustado a ${formatCurrency(previewPrice)}`;
    }
    onUpdatePrice(product.id, previewPrice, label);
    applyAndCelebrate();
  };

  const handleQuickPercent = (pct: number) => {
    const discounted = priceAt(pct);
    const label = `Rebaja del ${pct}% aplicada a ${product.name}: ${formatCurrency(discounted)}`;
    onUpdatePrice(product.id, discounted, label);
    applyAndCelebrate();
  };

  const handleAtCost = () => {
    const label = `🔥 Liquidación al Costo aplicada a ${product.name}: ${formatCurrency(product.costPrice)}`;
    onUpdatePrice(product.id, product.costPrice, label);
    applyAndCelebrate();
  };

  const modeConfig = {
    DISCOUNT_PCT: { label: '% Rebaja', placeholder: 'Ej: 20', hint: 'sobre el precio actual' },
    MARGIN_PCT: { label: '% Margen', placeholder: 'Ej: 15', hint: 'de ganancia sobre el costo' },
    PRICE: { label: '$ Precio final', placeholder: 'Ej: 2500', hint: 'precio de venta directo' },
  } as const;

  return (
    <div
      className={`rounded-lg transition-all border overflow-hidden ${
        justUpdated
          ? 'bg-emerald-50/90 border-emerald-300 shadow-xs'
          : 'bg-white hover:bg-slate-50/60 border-slate-200/70'
      }`}
    >
      <div className="flex items-stretch">
        {/* Urgency color bar */}
        <div className={`w-1.5 shrink-0 ${urgencyStyles.bar}`} />

        <div className="flex-1 p-3 flex flex-col gap-2.5">
          {/* Top: name + urgency + success toast */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{product.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${urgencyStyles.badge}`}>
              {days === 0 ? '¡Vence HOY!' : days === 1 ? 'Vence mañana' : `Vence en ${days} días`}
              {' '}({formatDate(product.expirationDate!)})
            </span>
            {justUpdated && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white flex items-center gap-1 animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>¡Precio guardado!</span>
              </span>
            )}
          </div>

          {/* Stats row: stock, cost, price, margin as small clear pills */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-500">
              Stock: <strong className="text-slate-800">{product.stock} u.</strong>
            </span>
            <span className="text-slate-500">
              Costo: <strong className="text-slate-800">{formatCurrency(product.costPrice)}</strong>
            </span>

            {!isPriceChanged ? (
              <>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold">
                  Precio: {formatCurrency(product.salePrice)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded border font-bold ${
                    currentMargin > 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : currentMargin === 0
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  Margen: {currentMargin}% ({formatCurrency(currentProfit)})
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100/80 border border-amber-300">
                <span className="text-slate-500 line-through text-[10px]">{formatCurrency(product.salePrice)}</span>
                <ArrowRight className="w-3 h-3 text-amber-800" />
                <strong className="text-indigo-900 bg-white px-1.5 py-0.5 rounded border border-indigo-300 font-black">
                  {formatCurrency(previewPrice)}
                </strong>
                <span
                  className={`text-[10px] font-black px-1 rounded ${
                    discountFromCurrent > 0 ? 'text-amber-800 bg-amber-200/70' : 'text-emerald-800 bg-emerald-200/70'
                  }`}
                >
                  {discountFromCurrent > 0 ? `-${discountFromCurrent}%` : `+${Math.abs(discountFromCurrent)}%`}
                </span>
                <span
                  className={`font-black ${
                    previewMarginPct > 0 ? 'text-emerald-700' : previewMarginPct === 0 ? 'text-amber-700' : 'text-rose-700'
                  }`}
                >
                  Margen: {previewMarginPct}%
                </span>
              </span>
            )}
          </div>

          {/* Live preview sentence when typing custom */}
          {isPriceChanged && showCustom && (
            <div className="flex items-center gap-2 text-[11px] bg-amber-100/70 text-amber-900 px-2.5 py-1.5 rounded border border-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>
                Nuevo precio: <strong>{formatCurrency(previewPrice)}</strong> · Ganancia por unidad:{' '}
                <strong>{formatCurrency(previewProfit)}</strong>
              </span>
            </div>
          )}

          {/* Actions */}
          {!showCustom ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleQuickPercent(15)}
                className="flex flex-col items-start px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-amber-800">Rebajar 15%</span>
                <span className="text-xs font-black text-amber-950">{formatCurrency(priceAt(15))}</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPercent(25)}
                className="flex flex-col items-start px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-amber-800">Rebajar 25%</span>
                <span className="text-xs font-black text-amber-950">{formatCurrency(priceAt(25))}</span>
              </button>
              <button
                type="button"
                onClick={handleAtCost}
                className="flex flex-col items-start px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-300 transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-bold text-rose-700 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Liquidar al costo
                </span>
                <span className="text-xs font-black text-rose-950">{formatCurrency(product.costPrice)}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Precio personalizado</span>
              </button>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50/40 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center bg-slate-100 rounded-md p-0.5 gap-0.5">
                  {(Object.keys(modeConfig) as Array<keyof typeof modeConfig>).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setInputMode(mode);
                        setInputValue('');
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        inputMode === mode ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {modeConfig[mode].label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustom(false);
                    setInputValue('');
                  }}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-slate-300 rounded-md px-2 flex-1 max-w-[180px]">
                  {inputMode === 'PRICE' && <span className="text-slate-400 text-xs font-bold mr-0.5">$</span>}
                  <input
                    type="number"
                    min="1"
                    autoFocus
                    placeholder={modeConfig[inputMode].placeholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                    className="w-full py-1.5 text-sm font-bold font-mono text-slate-900 outline-hidden placeholder:text-slate-400 placeholder:font-normal"
                  />
                  {inputMode !== 'PRICE' && <span className="text-slate-400 text-xs font-bold ml-0.5">%</span>}
                </div>
                <span className="text-[11px] text-slate-500 hidden sm:inline">{modeConfig[inputMode].hint}</span>

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!isPriceChanged}
                  className={`ml-auto px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    isPriceChanged
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

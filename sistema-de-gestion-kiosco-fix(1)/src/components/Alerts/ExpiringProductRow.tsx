import React, { useState } from 'react';
import { Check, Percent, DollarSign, ArrowRight, Sparkles } from 'lucide-react';
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

  // New profit and margin calculation
  const previewProfit = previewPrice - product.costPrice;
  const previewMarginPct =
    previewPrice > 0 ? Math.round((previewProfit / previewPrice) * 100) : 0;
  const discountFromCurrent =
    product.salePrice > 0
      ? Math.round(((product.salePrice - previewPrice) / product.salePrice) * 100)
      : 0;

  const currentProfit = product.salePrice - product.costPrice;
  const currentMargin =
    product.salePrice > 0
      ? Math.round((currentProfit / product.salePrice) * 100)
      : 0;

  const handleApply = () => {
    if (!isPriceChanged || previewPrice <= 0) return;

    let label = '';
    if (discountFromCurrent > 0) {
      label = `Rebaja aplicada a ${product.name}: ${formatCurrency(previewPrice)} (-${discountFromCurrent}%)`;
    } else {
      label = `Precio de ${product.name} ajustado a ${formatCurrency(previewPrice)}`;
    }

    onUpdatePrice(product.id, previewPrice, label);
    setJustUpdated(true);
    setInputValue('');
    setTimeout(() => setJustUpdated(false), 3000);
  };

  const handleQuickPercent = (pct: number) => {
    const discounted = Math.round((product.salePrice * (1 - pct / 100)) / 10) * 10;
    const label = `Rebaja del ${pct}% aplicada a ${product.name}: ${formatCurrency(discounted)}`;
    onUpdatePrice(product.id, discounted, label);
    setJustUpdated(true);
    setInputValue('');
    setTimeout(() => setJustUpdated(false), 3000);
  };

  const handleAtCost = () => {
    const label = `🔥 Liquidación al Costo aplicada a ${product.name}: ${formatCurrency(product.costPrice)}`;
    onUpdatePrice(product.id, product.costPrice, label);
    setJustUpdated(true);
    setInputValue('');
    setTimeout(() => setJustUpdated(false), 3000);
  };

  return (
    <div
      className={`py-3 px-3 rounded-lg transition-all border ${
        justUpdated
          ? 'bg-emerald-50/90 border-emerald-300 shadow-xs'
          : isPriceChanged
          ? 'bg-amber-50/60 border-amber-300/80 shadow-2xs'
          : 'bg-white hover:bg-slate-50/80 border-slate-200/70'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Left: Product Info & Dynamic Live Price Reflection Below */}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900 text-xs flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{product.name}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 font-mono">
              Vence en {days} días ({formatDate(product.expirationDate!)})
            </span>
            {justUpdated && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white border border-emerald-700 flex items-center gap-1 animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>¡Precio Guardado con Éxito!</span>
              </span>
            )}
          </div>

          {/* Real-time reflection line below */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-600 mt-1.5 font-mono">
            <span>
              Stock: <strong className="text-slate-900 font-bold">{product.stock} u.</strong>
            </span>
            <span>•</span>
            <span>
              Costo: <strong className="text-slate-900 font-bold">{formatCurrency(product.costPrice)}</strong>
            </span>
            <span>•</span>
            
            {/* Price reflection: Shows current price AND live projected new price if typing */}
            {!isPriceChanged ? (
              <span className="flex items-center gap-1">
                Precio: <strong className="text-indigo-800 bg-indigo-50/90 px-1.5 py-0.5 rounded border border-indigo-200 font-bold text-xs">{formatCurrency(product.salePrice)}</strong>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300 animate-pulse">
                <span className="text-slate-500 line-through text-[10px]">{formatCurrency(product.salePrice)}</span>
                <ArrowRight className="w-3 h-3 text-amber-800" />
                <span className="text-slate-800 font-bold text-[10px]">Nuevo Precio:</span>
                <strong className="text-indigo-900 bg-white px-1.5 py-0.5 rounded border border-indigo-300 font-black text-xs">
                  {formatCurrency(previewPrice)}
                </strong>
                {discountFromCurrent !== 0 && (
                  <span className={`text-[10px] font-black px-1 py-0.2 rounded ${discountFromCurrent > 0 ? 'text-amber-800 bg-amber-200/70' : 'text-emerald-800 bg-emerald-200/70'}`}>
                    {discountFromCurrent > 0 ? `-${discountFromCurrent}%` : `+${Math.abs(discountFromCurrent)}%`}
                  </span>
                )}
              </span>
            )}

            <span>•</span>

            {/* Margin reflection: Shows live projected margin */}
            {!isPriceChanged ? (
              <span className={currentMargin > 0 ? 'text-emerald-700 font-bold' : currentMargin === 0 ? 'text-amber-700 font-bold' : 'text-rose-700 font-bold'}>
                Margen: {currentMargin}% ({formatCurrency(currentProfit)})
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-amber-900 bg-amber-100/60 px-1.5 py-0.5 rounded">
                <span>Margen Nuevo:</span>
                <span className={previewMarginPct > 0 ? 'text-emerald-700 font-black' : previewMarginPct === 0 ? 'text-amber-700 font-black' : 'text-rose-700 font-black'}>
                  {previewMarginPct}% ({formatCurrency(previewProfit)})
                </span>
              </span>
            )}
          </div>

          {/* Quick live preview banner right under when typing */}
          {isPriceChanged && (
            <div className="mt-1.5 flex items-center gap-2 text-[11px] bg-amber-100/70 text-amber-900 px-2 py-1 rounded border border-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>
                Al presionar <strong>"Aplicar"</strong>, el precio cambiará de <strong>{formatCurrency(product.salePrice)}</strong> a <strong>{formatCurrency(previewPrice)}</strong> (Ganancia: <strong>{formatCurrency(previewProfit)}</strong> por unidad).
              </span>
            </div>
          )}
        </div>

        {/* Right: Inline Written Input Controls (No Popup) */}
        <div className="flex flex-wrap items-center gap-1.5 self-start lg:self-auto shrink-0">
          
          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleQuickPercent(15)}
              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300 font-mono transition-colors cursor-pointer"
              title={`Rebajar 15% (${formatCurrency(Math.round((product.salePrice * 0.85) / 10) * 10)})`}
            >
              -15%
            </button>
            <button
              type="button"
              onClick={() => handleQuickPercent(25)}
              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300 font-mono transition-colors cursor-pointer"
              title={`Rebajar 25% (${formatCurrency(Math.round((product.salePrice * 0.75) / 10) * 10)})`}
            >
              -25%
            </button>
            <button
              type="button"
              onClick={handleAtCost}
              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-300 font-mono transition-colors cursor-pointer"
              title={`Liquidar al precio de costo (${formatCurrency(product.costPrice)})`}
            >
              Al Costo ({formatCurrency(product.costPrice)})
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block mx-0.5" />

          {/* Direct Written Input (Escribir % Descuento, % Margen o $ Precio Final) */}
          <div className="flex items-center bg-white rounded-md border-2 border-amber-400 p-0.5 shadow-2xs">
            
            {/* Mode Selector Buttons */}
            <div className="flex items-center bg-slate-100 rounded p-0.5 gap-0.5 mr-1">
              <button
                type="button"
                onClick={() => setInputMode('DISCOUNT_PCT')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  inputMode === 'DISCOUNT_PCT'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Escribir % de Descuento / Rebaja"
              >
                % Rebaja
              </button>
              <button
                type="button"
                onClick={() => setInputMode('MARGIN_PCT')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  inputMode === 'MARGIN_PCT'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Escribir % de Margen sobre Costo"
              >
                % Margen
              </button>
              <button
                type="button"
                onClick={() => setInputMode('PRICE')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  inputMode === 'PRICE'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Escribir $ Precio Final directamente"
              >
                $ Precio
              </button>
            </div>

            {/* Input Field */}
            <div className="flex items-center px-1">
              <input
                type="number"
                min="1"
                placeholder={
                  inputMode === 'DISCOUNT_PCT'
                    ? 'Ej: 20%'
                    : inputMode === 'MARGIN_PCT'
                    ? 'Ej: 15%'
                    : 'Ej: $2500'
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                className="w-20 px-1 py-0.5 text-xs font-bold font-mono text-slate-900 outline-hidden placeholder:text-slate-400"
              />
            </div>

            {/* Apply Button */}
            <button
              type="button"
              onClick={handleApply}
              disabled={!isPriceChanged}
              className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                isPriceChanged
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title="Confirmar y aplicar este precio inmediatamente"
            >
              <span>Aplicar</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};


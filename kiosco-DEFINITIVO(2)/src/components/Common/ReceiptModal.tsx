import React from 'react';
import { CheckCircle2, Printer } from 'lucide-react';
import { Sale } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { printElement } from '../../utils/printHelper';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
  onNewSale?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  if (!sale) return null;

  const handlePrint = () => {
    printElement('printable-ticket-content', `Ticket_${sale.id.slice(-6)}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-sm rounded-lg shadow-xl border border-slate-200 overflow-hidden transform animate-in fade-in zoom-in duration-150">
        
        {/* Top success banner */}
        <div className="bg-emerald-600 px-4 py-2.5 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-bold text-xs uppercase tracking-wide">¡VENTA REGISTRADA CON ÉXITO!</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xs cursor-pointer">✕</button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div id="printable-ticket-content" className="printable-content p-4 space-y-3 font-mono text-xs text-slate-800 bg-slate-50/50 border-b border-dashed border-slate-300 print:p-0 print:border-none">
          
          {/* Receipt Header */}
          <div className="text-center space-y-0.5">
            <div className="font-bold text-sm text-slate-900 tracking-wider">
              GRANJA DON RAMÓN
            </div>
            <div className="text-[10px] text-slate-500">
              Punto de Venta & Control de Stock
            </div>
            <div className="text-[10px] text-slate-400">
              {formatDateTime(sale.date)}
            </div>
            <div className="text-[11px] font-bold text-slate-700 mt-1">
              TICKET #{sale.id.slice(-6).toUpperCase()}
            </div>
          </div>

          <div className="border-t border-dashed border-slate-300 pt-1.5"></div>

          {/* Customer / Note if any */}
          {sale.customerName && (
            <div className="text-[10px] text-amber-900 font-bold bg-amber-50 p-1 rounded font-sans">
              Cliente: {sale.customerName}
            </div>
          )}

          {/* Items breakdown */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-bold text-[10px] text-slate-500 border-b border-slate-200 pb-0.5 font-sans">
              <span>CANT. ARTÍCULO</span>
              <span>TOTAL</span>
            </div>
            {sale.items.map((it, idx) => (
              <div key={idx} className="flex justify-between items-start text-xs">
                <div className="pr-2">
                  <span className="font-bold">{it.quantity}x</span> {it.productName}
                  <div className="text-[9px] text-slate-400">@{formatCurrency(it.unitPrice)}</div>
                </div>
                <span className="font-bold text-slate-900 shrink-0">{formatCurrency(it.total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5">
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Subtotal:</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold text-[11px]">
                <span>Descuento:</span>
                <span>-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-slate-950 pt-1 border-t border-slate-800">
              <span>TOTAL:</span>
              <span className="text-indigo-600">{formatCurrency(sale.total)}</span>
            </div>
          </div>

          {/* Payment info */}
          <div className="bg-slate-100 p-2 rounded text-[10px] space-y-0.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Medio de Pago:</span>
              <span className="font-bold text-slate-800">{sale.paymentMethod}</span>
            </div>
            {sale.cashReceived !== undefined && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Efectivo Entregado:</span>
                  <span className="font-bold text-slate-800">{formatCurrency(sale.cashReceived)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Vuelto:</span>
                  <span>{formatCurrency(sale.changeGiven || 0)}</span>
                </div>
              </>
            )}
          </div>

          <div className="text-center text-[9px] text-slate-400 pt-1 font-sans">
            ¡Gracias por su compra!
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-3 bg-white flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
        </div>

      </div>
    </div>
  );
};

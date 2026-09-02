import React, { useState } from 'react';
import { Wallet, CheckCircle2, Lock, Printer, FileText, ArrowLeft, Clock, DollarSign, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useKiosk } from '../../context/KioskContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

interface CashRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashRegisterModal: React.FC<CashRegisterModalProps> = ({ isOpen, onClose }) => {
  const { currentShift, openShift, closeShift, sales } = useKiosk();

  const [initialCashInput, setInitialCashInput] = useState<number | ''>(15000);
  const [realCashInput, setRealCashInput] = useState<number | ''>('');
  const [closeNotes, setCloseNotes] = useState('');
  const [shiftMode, setShiftMode] = useState<'VIEW' | 'CLOSE' | 'RECEIPT_PREVIEW'>('VIEW');
  const [justClosedShift, setJustClosedShift] = useState<boolean>(false);

  if (!isOpen) return null;

  const shiftStartTime = currentShift?.openedAt ? new Date(currentShift.openedAt).getTime() : 0;
  
  // Calculate sales that occurred in the shift
  const shiftSales = sales.filter((s) => {
    if (s.status !== 'completada') return false;
    const saleTime = new Date(s.date).getTime();
    if (!currentShift) return false;
    if (currentShift.isOpen) {
      return saleTime >= shiftStartTime;
    } else if (currentShift.closedAt) {
      const shiftEndTime = new Date(currentShift.closedAt).getTime();
      return saleTime >= shiftStartTime && saleTime <= shiftEndTime;
    }
    return saleTime >= shiftStartTime;
  });

  const cashSales = shiftSales.filter((s) => s.paymentMethod === 'Efectivo').reduce((a, s) => a + s.total, 0);
  const debitSales = shiftSales.filter((s) => s.paymentMethod === 'Tarjeta de Débito').reduce((a, s) => a + s.total, 0);
  const creditCardSales = shiftSales.filter((s) => s.paymentMethod === 'Tarjeta de Crédito').reduce((a, s) => a + s.total, 0);
  const qrSales = shiftSales.filter((s) => s.paymentMethod.includes('Transferencia') || s.paymentMethod.includes('MP')).reduce((a, s) => a + s.total, 0);
  const onAccountSales = shiftSales.filter((s) => s.paymentMethod.includes('Cuenta Corriente')).reduce((a, s) => a + s.total, 0);
  
  const cardAndQrSales = debitSales + creditCardSales + qrSales;
  const totalShiftRevenue = shiftSales.reduce((a, s) => a + s.total, 0);
  const totalShiftProfit = shiftSales.reduce((a, s) => a + s.totalProfit, 0);
  const averageTicket = shiftSales.length > 0 ? Math.round(totalShiftRevenue / shiftSales.length) : 0;

  const initialFloat = currentShift?.initialCash || 0;
  const expectedCashInDrawer = initialFloat + cashSales;
  const actualCashCounted = typeof realCashInput === 'number' 
    ? realCashInput 
    : (currentShift?.finalCashReal !== undefined ? currentShift.finalCashReal : 0);
  const cashDifference = actualCashCounted - expectedCashInDrawer;

  // Compute shift duration
  const getShiftDuration = () => {
    if (!currentShift?.openedAt) return '';
    const start = new Date(currentShift.openedAt).getTime();
    const end = currentShift.closedAt ? new Date(currentShift.closedAt).getTime() : Date.now();
    const diffMins = Math.max(1, Math.floor((end - start) / (1000 * 60)));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours === 0) return `${mins} min`;
    return `${hours}h ${mins}m`;
  };

  // Top sold items in shift
  const topItemsMap = new Map<string, { name: string; qty: number; total: number }>();
  shiftSales.forEach((s) => {
    s.items.forEach((item) => {
      const existing = topItemsMap.get(item.productId) || { name: item.productName, qty: 0, total: 0 };
      existing.qty += item.quantity;
      existing.total += item.total;
      topItemsMap.set(item.productId, existing);
    });
  });
  const topShiftProducts = Array.from(topItemsMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 4);

  const handleStartShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialCashInput || Number(initialCashInput) < 0) return;
    openShift(Number(initialCashInput));
    setJustClosedShift(false);
    setShiftMode('VIEW');
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (realCashInput === '') return;
    closeShift(Number(realCashInput), closeNotes);
    setJustClosedShift(true);
    setShiftMode('RECEIPT_PREVIEW');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform animate-in fade-in zoom-in duration-150 my-auto">
        
        {/* Modal Header */}
        <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-indigo-500/20 text-indigo-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Control de Caja & Turnos</h3>
              <p className="text-[10px] text-slate-400">
                {currentShift?.isOpen 
                  ? 'Turno en curso activo' 
                  : (currentShift?.closedAt ? 'Último turno cerrado' : 'Caja cerrada')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={onClose} 
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* View Mode Navigation Tabs when shift is active or recorded */}
        {currentShift && (
          <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShiftMode('VIEW')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  shiftMode === 'VIEW' || shiftMode === 'CLOSE'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Control & Resumen
              </button>
              <button
                type="button"
                onClick={() => setShiftMode('RECEIPT_PREVIEW')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  shiftMode === 'RECEIPT_PREVIEW'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Ticket Imprimible</span>
              </button>
            </div>

            {shiftMode === 'RECEIPT_PREVIEW' && null}
          </div>
        )}

        <div className="p-4 sm:p-5 max-h-[75vh] overflow-y-auto space-y-4">
          
          {/* ============================================================ */}
          {/* CASE 1: NO ACTIVE SHIFT (OPEN NEW SHIFT FORM)                */}
          {/* ============================================================ */}
          {(!currentShift || (!currentShift.isOpen && shiftMode !== 'RECEIPT_PREVIEW' && !justClosedShift)) && (
            <div className="space-y-4">
              {currentShift?.closedAt && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Caja Cerrada</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    El último turno se cerró el {formatDateTime(currentShift.closedAt)}. Puedes ver el comprobante o iniciar una nueva apertura.
                  </p>
                  <div className="pt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShiftMode('RECEIPT_PREVIEW')}
                      className="px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-[11px] flex items-center gap-1 border border-amber-300"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Ver Comprobante Cierre Anterior</span>
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleStartShift} className="space-y-3.5">
                <div className="text-center py-2">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-2xs">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Apertura de Caja & Inicio de Turno</h4>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">
                    Ingrese el fondo inicial (cambio para vuelto) para comenzar a registrar operaciones.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fondo Inicial de Caja Chica ($)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="100"
                    value={initialCashInput}
                    onChange={(e) => setInitialCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="15000"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-base font-bold font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {/* Quick Preset Buttons */}
                  <div className="flex gap-1.5 mt-2">
                    {[5000, 10000, 15000, 20000, 30000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setInitialCashInput(val)}
                        className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold font-mono rounded border border-slate-200 transition-colors"
                      >
                        {formatCurrency(val)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    Iniciar Turno
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* CASE 2: ACTIVE SHIFT RESUME / CLOSE (VIEW & CLOSE MODES)      */}
          {/* ============================================================ */}
          {currentShift && currentShift.isOpen && shiftMode !== 'RECEIPT_PREVIEW' && (
            <div className="space-y-4">
              
              {/* Shift status header */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Apertura del Turno</div>
                  <div className="font-mono font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-indigo-600" />
                    <span>{formatDateTime(currentShift.openedAt)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Turno en Curso ({getShiftDuration()})
                  </span>
                </div>
              </div>

              {/* Shift Financial Metrics Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-[9px] text-slate-400 font-bold uppercase font-sans">Fondo Inicial</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{formatCurrency(initialFloat)}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-[9px] text-slate-400 font-bold uppercase font-sans">Ventas Efectivo</div>
                  <div className="text-sm font-bold text-emerald-600 mt-0.5">{formatCurrency(cashSales)}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-[9px] text-slate-400 font-bold uppercase font-sans">Tarjetas & QR</div>
                  <div className="text-sm font-bold text-indigo-600 mt-0.5">{formatCurrency(cardAndQrSales)}</div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-[9px] text-slate-400 font-bold uppercase font-sans">Total Recaudado</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{formatCurrency(totalShiftRevenue)}</div>
                </div>
              </div>

              {/* Expected cash banner */}
              <div className="bg-indigo-50/70 p-3.5 rounded-lg border border-indigo-100 flex items-center justify-between font-mono">
                <div>
                  <div className="text-[10px] text-indigo-900 font-bold uppercase font-sans flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Efectivo Esperado en Gaveta</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5 font-mono">
                    {formatCurrency(expectedCashInDrawer)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                    Fondo inicial ({formatCurrency(initialFloat)}) + Efectivo cobrado ({formatCurrency(cashSales)})
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded">
                    {shiftSales.length} {shiftSales.length === 1 ? 'venta' : 'ventas'}
                  </span>
                  <div className="text-[10px] text-slate-500 font-sans mt-1">
                    Prom: {formatCurrency(averageTicket)}
                  </div>
                </div>
              </div>

              {/* VIEW MODE CONTROLS */}
              {shiftMode === 'VIEW' ? (
                <div className="space-y-2 pt-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShiftMode('RECEIPT_PREVIEW')}
                      className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>Imprimir Comprobante</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftMode('CLOSE')}
                      className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Arqueo & Cierre de Caja</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* CLOSE SHIFT FORM */
                <form onSubmit={handleCloseShift} className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Efectivo Físico Contado en el Cajón ($) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={realCashInput}
                      onChange={(e) => setRealCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ingrese el monto total contado billete por billete"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-base font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {typeof realCashInput === 'number' && (
                    <div className={'p-2.5 rounded-lg text-xs font-mono font-bold flex justify-between items-center ' + (
                      cashDifference === 0 
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                        : cashDifference > 0 
                          ? 'bg-blue-50 text-blue-900 border border-blue-300'
                          : 'bg-rose-50 text-rose-900 border border-rose-300'
                    )}>
                      <span className="font-sans flex items-center gap-1">
                        {cashDifference === 0 && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {cashDifference !== 0 && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                        <span>
                          {cashDifference === 0 ? 'Caja Cuadrada Perfecta:' : (cashDifference > 0 ? 'Sobrante de Caja:' : 'Faltante de Caja:')}
                        </span>
                      </span>
                      <span className="text-sm">
                        {cashDifference >= 0 ? '+' : ''}{formatCurrency(cashDifference)}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Observaciones / Notas de Cierre</label>
                    <input
                      type="text"
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      placeholder="Ej: Retiro para pago a proveedor Arcor / Cambio dejado"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShiftMode('VIEW')}
                      className="flex-1 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                    >
                      Confirmar Cierre & Imprimir
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* CASE 3: THERMAL PRINTABLE VOUCHER / TICKET VIEW               */}
          {/* ============================================================ */}
          {(shiftMode === 'RECEIPT_PREVIEW' || (!currentShift?.isOpen && shiftMode === 'RECEIPT_PREVIEW')) && currentShift && (
            <div className="space-y-4">
              
              {/* Success notification if just closed */}
              {justClosedShift && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>¡Turno cerrado y registrado correctamente!</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono">
                    ID: #{currentShift.id.slice(-6).toUpperCase()}
                  </span>
                </div>
              )}

              {/* Printable Ticket Voucher Container */}
              <div 
                id="shift-printable-receipt"
                className="printable-receipt p-4 sm:p-5 font-mono text-xs text-slate-900 bg-white border border-dashed border-slate-300 rounded-lg shadow-2xs space-y-3 print:p-0 print:border-none print:shadow-none"
              >
                {/* Voucher Header */}
                <div className="text-center space-y-0.5">
                  <div className="font-bold text-sm text-slate-950 tracking-wider">
                    GRANJA DON RAMÓN
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide font-sans">
                    Sistema de Gestión & Punto de Venta
                  </div>
                  <div className="text-[11px] font-bold text-slate-800 pt-1">
                    {currentShift.isOpen 
                      ? '*** ARQUEO PARCIAL (TURNO ACTIVO) ***' 
                      : '*** CIERRE DEFINITIVO DE TURNO (ARQUEO Z) ***'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    COMPROBANTE #{currentShift.id.slice(-8).toUpperCase()}
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Apertura:</span>
                    <span className="font-bold">{formatDateTime(currentShift.openedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {currentShift.isOpen ? 'Emisión:' : 'Cierre:'}
                    </span>
                    <span className="font-bold">
                      {formatDateTime(currentShift.closedAt || new Date().toISOString())}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Duración:</span>
                    <span className="font-bold">{getShiftDuration()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estado:</span>
                    <span className={`font-bold ${currentShift.isOpen ? 'text-blue-700' : 'text-slate-800'}`}>
                      {currentShift.isOpen ? 'TURNO ACTIVO' : 'TURNO CERRADO'}
                    </span>
                  </div>
                </div>

                {/* Sales Breakdown by Payment Method */}
                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                    RECAUDACIÓN POR MEDIO DE PAGO
                  </div>
                  
                  <div className="flex justify-between text-[11px]">
                    <span>(+) Ventas Efectivo:</span>
                    <span className="font-bold">{formatCurrency(cashSales)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>(+) Tarjeta Débito:</span>
                    <span className="font-bold">{formatCurrency(debitSales)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>(+) Tarjeta Crédito:</span>
                    <span className="font-bold">{formatCurrency(creditCardSales)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>(+) Transferencia / MP:</span>
                    <span className="font-bold">{formatCurrency(qrSales)}</span>
                  </div>
                  {onAccountSales > 0 && (
                    <div className="flex justify-between text-[11px] text-amber-800">
                      <span>(+) Cuenta Cte. (Fiados):</span>
                      <span className="font-bold">{formatCurrency(onAccountSales)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-800 pt-1 flex justify-between text-xs font-bold text-slate-950">
                    <span>TOTAL VENTAS:</span>
                    <span className="text-indigo-700">{formatCurrency(totalShiftRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Ganancia Neta Estimada:</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(totalShiftProfit)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Cantidad de Tickets / Ventas:</span>
                    <span className="font-bold">{shiftSales.length} ops.</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Ticket Promedio:</span>
                    <span className="font-bold">{formatCurrency(averageTicket)}</span>
                  </div>
                </div>

                {/* Cash Drawer Control */}
                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                    CONTROL DE GAVETA & EFECTIVO
                  </div>
                  
                  <div className="flex justify-between text-[11px]">
                    <span>(+) Fondo Inicial de Caja:</span>
                    <span className="font-bold">{formatCurrency(initialFloat)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>(+) Cobros en Efectivo:</span>
                    <span className="font-bold">{formatCurrency(cashSales)}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-0.5 flex justify-between text-xs font-bold text-slate-900">
                    <span>(=) Efectivo Esperado:</span>
                    <span>{formatCurrency(expectedCashInDrawer)}</span>
                  </div>

                  {(currentShift.finalCashReal !== undefined || typeof realCashInput === 'number') && (
                    <>
                      <div className="flex justify-between text-xs font-bold text-slate-900">
                        <span>(•) Efectivo Real Contado:</span>
                        <span>{formatCurrency(actualCashCounted)}</span>
                      </div>
                      <div className={`flex justify-between text-xs font-bold pt-0.5 border-t border-slate-800 ${
                        cashDifference >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        <span>DIFERENCIA DE CAJA:</span>
                        <span>
                          {cashDifference === 0 
                            ? '$0 (EXACTA)' 
                            : `${cashDifference > 0 ? '+' : ''}${formatCurrency(cashDifference)} (${cashDifference > 0 ? 'SOBRANTE' : 'FALTANTE'})`}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Top Sold Products in Shift */}
                {topShiftProducts.length > 0 && (
                  <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-1">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                      MÁS VENDIDOS EN EL TURNO
                    </div>
                    {topShiftProducts.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-[10px]">
                        <span className="truncate pr-2">{p.qty}x {p.name}</span>
                        <span className="font-bold shrink-0">{formatCurrency(p.total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes if present */}
                {(closeNotes || currentShift.notes) && (
                  <div className="border-t border-dashed border-slate-300 pt-1.5 text-[10px]">
                    <span className="text-slate-500 font-sans font-bold">Observaciones: </span>
                    <span className="italic">{closeNotes || currentShift.notes}</span>
                  </div>
                )}

                {/* Signatures Area */}
                <div className="border-t border-dashed border-slate-300 pt-6 grid grid-cols-2 gap-4 text-center text-[10px] font-sans text-slate-600">
                  <div>
                    <div className="border-t border-slate-400 pt-1">
                      Firma Cajero / Operador
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1">
                      Firma Supervisor / Responsable
                    </div>
                  </div>
                </div>

                <div className="text-center text-[9px] text-slate-400 pt-2 font-sans">
                  Impreso el {formatDateTime(new Date().toISOString())}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {currentShift.isOpen && (
                  <button
                    type="button"
                    onClick={() => setShiftMode('VIEW')}
                    className="flex-1 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver al Control</span>
                  </button>
                )}
                {!currentShift.isOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setShiftMode('VIEW');
                      setJustClosedShift(false);
                    }}
                    className="flex-1 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Nueva Apertura de Caja
                  </button>
                )}
                <button
                  type="button"
                  id="print-shift-ticket-btn"
                  onClick={handlePrint}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Comprobante (Ctrl+P)</span>
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

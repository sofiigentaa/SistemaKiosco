import React, { useMemo } from 'react';
import { Printer, X, Download, History, Calendar, CreditCard, DollarSign } from 'lucide-react';
import { Sale } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { printElement } from '../../utils/printHelper';

interface PrintSalesHistoryModalProps {
  sales: Sale[];
  filterSummary: {
    dateFilter: string;
    paymentMethod: string;
    searchTerm?: string;
  };
  onClose: () => void;
}

export const PrintSalesHistoryModal: React.FC<PrintSalesHistoryModalProps> = ({
  sales,
  filterSummary,
  onClose,
}) => {
  const totalBilled = useMemo(() => sales.reduce((acc, s) => acc + s.total, 0), [sales]);
  const averageTicket = useMemo(() => (sales.length > 0 ? totalBilled / sales.length : 0), [sales, totalBilled]);

  const paymentBreakdown = useMemo(() => {
    return sales.reduce((acc, s) => {
      const method = s.paymentMethod || 'Efectivo';
      acc[method] = (acc[method] || 0) + s.total;
      return acc;
    }, {} as Record<string, number>);
  }, [sales]);

  const handlePrint = () => {
    printElement('printable-sales-history-doc', 'Historial_Ventas_Don_Ramon');
  };

  const handleDownloadCSV = () => {
    const headers = ['Ticket ID', 'Fecha y Hora', 'Medio de Pago', 'Items', 'Total'];
    const rows = sales.map((s) => [
      `"${s.id}"`,
      `"${formatDateTime(s.date)}"`,
      `"${s.paymentMethod || 'Efectivo'}"`,
      `"${s.items.map((i) => `${i.productName} (x${i.quantity})`).join(', ')}"`,
      s.total,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_ventas_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-150">
        
        {/* Header Modal Bar */}
        <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide uppercase">
                Imprimir Registro Histórico de Ventas
              </h3>
              <p className="text-[11px] text-slate-400">
                {sales.length} tickets encontrados • Total {formatCurrency(totalBilled)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center text-xs transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Controls Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Filtro aplicado:</span>
            <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-medium">
              📅 {filterSummary.dateFilter}
            </span>
            <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-medium">
              💳 {filterSummary.paymentMethod}
            </span>
            {filterSummary.searchTerm && (
              <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-medium">
                🔍 "{filterSummary.searchTerm}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ahora</span>
            </button>
          </div>
        </div>

        {/* Document Preview (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70">
          <div
            id="printable-sales-history-doc"
            className="bg-white p-6 sm:p-8 rounded-lg shadow-xs border border-slate-200 max-w-3xl mx-auto text-slate-900 font-sans"
          >
            {/* Header Document */}
            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  Granja Don Ramón
                </h1>
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  Sistema de Gestión & Kiosco
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Reporte Detallado de Ventas e Ingresos
                </p>
              </div>

              <div className="text-right text-xs space-y-0.5">
                <div className="font-bold text-slate-900">REGISTRO DE VENTAS</div>
                <div className="text-slate-500 text-[11px]">
                  Emisión: {formatDateTime(new Date().toISOString())}
                </div>
                <div className="text-slate-600 text-[11px] font-medium">
                  Período: {filterSummary.dateFilter}
                </div>
              </div>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Facturado</div>
                <div className="text-base sm:text-lg font-black font-mono text-slate-900">{formatCurrency(totalBilled)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Comprobantes</div>
                <div className="text-base sm:text-lg font-black font-mono text-indigo-700">{sales.length} tickets</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ticket Promedio</div>
                <div className="text-base sm:text-lg font-black font-mono text-slate-900">{formatCurrency(averageTicket)}</div>
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="mb-6 p-3 bg-white rounded-lg border border-slate-200">
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-2">
                Recaudación por Medio de Pago:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {(Object.entries(paymentBreakdown) as [string, number][]).map(([method, total]) => (
                  <div key={method} className="bg-slate-50 p-2 rounded border border-slate-150">
                    <div className="text-[10px] text-slate-500 font-semibold">{method}</div>
                    <div className="font-bold font-mono text-slate-900">{formatCurrency(total)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales Table */}
            <div>
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Detalle de Tickets Registrados:
              </div>

              {sales.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                  No se encontraron ventas para los filtros seleccionados.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700 uppercase">
                      <th className="py-2 px-2">Fecha / Hora</th>
                      <th className="py-2 px-2">N° Ticket</th>
                      <th className="py-2 px-2">Artículos Vendidos</th>
                      <th className="py-2 px-2 text-center">Pago</th>
                      <th className="py-2 px-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/80">
                        <td className="py-2 px-2 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {formatDateTime(sale.date)}
                        </td>
                        <td className="py-2 px-2 font-mono text-[11px] text-slate-500">
                          #{sale.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="py-2 px-2 text-slate-900">
                          <div className="font-medium text-slate-800">
                            {sale.items.map((item, idx) => (
                              <span key={idx}>
                                {item.productName} <span className="font-bold text-slate-600">x{item.quantity}</span>
                                {idx < sale.items.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {sale.paymentMethod || 'Efectivo'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-bold font-mono text-slate-900 whitespace-nowrap">
                          {formatCurrency(sale.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-900 font-bold bg-slate-50">
                      <td colSpan={4} className="py-2.5 px-2 text-right uppercase text-slate-900 text-xs">
                        Total General ({sales.length} comprobantes):
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-indigo-700 text-sm">
                        {formatCurrency(totalBilled)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Footer of the printed document */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
              <span>Granja Don Ramón • Comprobante interno de auditoría y ventas</span>
              <span>Página 1</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Documento</span>
          </button>
        </div>

      </div>
    </div>
  );
};

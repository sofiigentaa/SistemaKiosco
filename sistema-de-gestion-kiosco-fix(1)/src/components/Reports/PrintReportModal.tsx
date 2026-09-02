import React from 'react';
import { Printer, X, Download, FileText } from 'lucide-react';
import { Sale, Product } from '../../types';
import { formatCurrency, formatPercent, formatDateTime } from '../../utils/formatters';
import { printElement } from '../../utils/printHelper';

interface PrintReportModalProps {
  timeRangeLabel: string;
  sales: Sale[];
  products: Product[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  grossMarginPercent: number;
  markupPercent: number;
  averageTicket: number;
  topProducts: Array<{
    productId: string;
    name: string;
    category: string;
    unitsSold: number;
    revenue: number;
    profit: number;
    currentStock: number;
  }>;
  categoryStats: Array<{
    name: string;
    value: number;
    count: number;
  }>;
  onClose: () => void;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  timeRangeLabel,
  sales,
  products,
  totalRevenue,
  totalCost,
  totalProfit,
  grossMarginPercent,
  markupPercent,
  averageTicket,
  topProducts,
  categoryStats,
  onClose,
}) => {
  // Payment methods breakdown
  const paymentMethods = sales.reduce((acc, sale) => {
    const method = sale.paymentMethod || 'Efectivo';
    acc[method] = (acc[method] || 0) + sale.total;
    return acc;
  }, {} as Record<string, number>);

  const handlePrint = () => {
    printElement('printable-report-doc', `Reporte_${timeRangeLabel.replace(/\s+/g, '_')}`);
  };

  const handleDownloadSummary = () => {
    const lines = [
      '====================================================',
      '         GRANJA DON RAMÓN - REPORTE DE VENTAS       ',
      '====================================================',
      `Período: ${timeRangeLabel}`,
      `Fecha de emisión: ${formatDateTime(new Date().toISOString())}`,
      `Total de Ventas: ${sales.length}`,
      '----------------------------------------------------',
      `Facturación Total: ${formatCurrency(totalRevenue)}`,
      `Costo de Mercadería: ${formatCurrency(totalCost)}`,
      `Ganancia Neta: ${formatCurrency(totalProfit)}`,
      `Margen Bruto: ${formatPercent(grossMarginPercent)}`,
      `Markup Promedio: ${formatPercent(markupPercent)}`,
      `Ticket Promedio: ${formatCurrency(averageTicket)}`,
      '----------------------------------------------------',
      'MEDIOS DE PAGO:',
      ...(Object.entries(paymentMethods) as [string, number][]).map(([m, total]) => ` - ${m}: ${formatCurrency(total)}`),
      '----------------------------------------------------',
      'TOP PRODUCTOS MÁS VENDIDOS:',
      ...topProducts.map((p, i) => ` ${i + 1}. ${p.name} | ${p.unitsSold} u. | ${formatCurrency(p.revenue)} | Ganancia: ${formatCurrency(p.profit)}`),
      '====================================================',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_${timeRangeLabel.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Modal Toolbar (Non printable) */}
        <div className="bg-slate-900 px-4 sm:px-6 py-3.5 text-white flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold tracking-wide">VISTA PREVIA DE IMPRESIÓN DEL REPORTE</h3>
              <p className="text-[11px] text-slate-400">Período: {timeRangeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSummary}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Descargar resumen en texto plano"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar Texto</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100">
          <div 
            id="printable-report-doc" 
            className="printable-content bg-white max-w-2xl mx-auto p-6 sm:p-8 rounded-lg shadow-sm border border-slate-200 text-slate-900 font-sans space-y-6"
          >
            {/* Header Document */}
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  GRANJA DON RAMÓN
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Almacén & Punto de Venta • Control de Stock y Márgenes
                </p>
                <div className="mt-2 inline-block px-2.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold uppercase tracking-wider">
                  Informe de Ventas & Márgenes ({timeRangeLabel})
                </div>
              </div>
              <div className="text-right text-xs text-slate-500 font-mono">
                <div>Fecha de Emisión:</div>
                <div className="font-bold text-slate-800">{formatDateTime(new Date().toISOString())}</div>
                <div className="mt-1 text-[11px] text-slate-400">Total Operaciones: {sales.length}</div>
              </div>
            </div>

            {/* Financial Summary Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
                1. RESUMEN FINANCIERO Y RESULTADO OPERATIVO
              </h4>
              <table className="w-full text-xs font-mono">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600 font-sans font-medium">Facturación Bruta Total:</td>
                    <td className="py-1.5 text-right font-bold text-slate-900 text-sm">{formatCurrency(totalRevenue)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600 font-sans font-medium">Costo de Mercadería Vendida (CMV):</td>
                    <td className="py-1.5 text-right font-bold text-rose-700">-{formatCurrency(totalCost)}</td>
                  </tr>
                  <tr className="border-b-2 border-slate-800 bg-emerald-50">
                    <td className="py-2 text-emerald-950 font-sans font-bold text-sm">Ganancia Neta de Bolsillo:</td>
                    <td className="py-2 text-right font-bold text-emerald-700 text-base">{formatCurrency(totalProfit)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600 font-sans font-medium">Margen Bruto sobre Ventas (%):</td>
                    <td className="py-1.5 text-right font-bold text-indigo-700">{formatPercent(grossMarginPercent)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600 font-sans font-medium">Markup promedio sobre costo (%):</td>
                    <td className="py-1.5 text-right font-bold text-slate-800">{formatPercent(markupPercent)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600 font-sans font-medium">Ticket Promedio por Cliente:</td>
                    <td className="py-1.5 text-right font-bold text-slate-800">{formatCurrency(averageTicket)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Methods Breakdown */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
                2. RECAUDACIÓN POR MEDIO DE PAGO
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.entries(paymentMethods) as [string, number][]).map(([method, total]) => (
                  <div key={method} className="p-2 rounded bg-slate-50 border border-slate-200 font-mono text-xs">
                    <div className="text-[10px] text-slate-500 font-sans font-semibold uppercase">{method}</div>
                    <div className="font-bold text-slate-900 mt-0.5">{formatCurrency(total)}</div>
                    <div className="text-[10px] text-slate-400">
                      {totalRevenue > 0 ? formatPercent((total / totalRevenue) * 100) : '0%'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Products Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
                3. RANKING DE PRODUCTOS MÁS VENDIDOS
              </h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 text-[10px] uppercase font-bold">
                    <th className="py-1.5 px-2 text-left">#</th>
                    <th className="py-1.5 px-2 text-left">Producto</th>
                    <th className="py-1.5 px-2 text-right">Cant.</th>
                    <th className="py-1.5 px-2 text-right">Recaudación</th>
                    <th className="py-1.5 px-2 text-right">Ganancia</th>
                    <th className="py-1.5 px-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400 font-sans">
                        Sin operaciones registradas en el período seleccionado.
                      </td>
                    </tr>
                  ) : (
                    topProducts.map((p, idx) => (
                      <tr key={p.productId}>
                        <td className="py-1.5 px-2 text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-1.5 px-2 font-sans font-medium text-slate-900">{p.name}</td>
                        <td className="py-1.5 px-2 text-right font-bold text-slate-800">{p.unitsSold} u.</td>
                        <td className="py-1.5 px-2 text-right text-slate-900">{formatCurrency(p.revenue)}</td>
                        <td className="py-1.5 px-2 text-right font-bold text-emerald-700">{formatCurrency(p.profit)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-600">{p.currentStock}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Category Sales Breakdown */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
                4. DISTRIBUCIÓN POR CATEGORÍA
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                {categoryStats.map((cat) => (
                  <div key={cat.name} className="flex justify-between py-1 border-b border-slate-100">
                    <span className="font-sans text-slate-700 truncate pr-2">{cat.name}:</span>
                    <span className="font-bold text-slate-900 shrink-0">{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Signatures & Footer */}
            <div className="pt-6 mt-8 border-t border-dashed border-slate-300 flex justify-between items-end text-xs text-slate-500">
              <div>
                <div>Sistema Granja Don Ramón</div>
                <div className="text-[10px] text-slate-400">Documento de control interno no válido como factura fiscal.</div>
              </div>
              <div className="text-center">
                <div className="w-36 border-b border-slate-400 mb-1"></div>
                <div className="text-[10px] uppercase font-bold text-slate-600">Firma / Encargado</div>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Reporte</span>
          </button>
        </div>

      </div>
    </div>
  );
};

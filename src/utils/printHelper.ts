import React, { useState, useMemo } from 'react';
import { Printer, X, Download, FileText, Layers, CheckSquare } from 'lucide-react';
import { Product } from '../../types';
import { formatCurrency, formatPercent, formatDateTime } from '../../utils/formatters';
import { printElement } from '../../utils/printHelper';

interface PrintInventoryModalProps {
  products: Product[];
  categories: string[];
  onClose: () => void;
}

export const PrintInventoryModal: React.FC<PrintInventoryModalProps> = ({
  products,
  categories,
  onClose,
}) => {
  const [reportType, setReportType] = useState<'PRICE_LIST' | 'VALUATION' | 'RESTOCK'>('PRICE_LIST');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (selectedCategory !== 'ALL') {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (reportType === 'RESTOCK') {
      list = list.filter((p) => p.stock <= p.minStock);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, selectedCategory, reportType]);

  const totalCostValuation = useMemo(() => {
    return filteredProducts.reduce((acc, p) => acc + p.costPrice * p.stock, 0);
  }, [filteredProducts]);

  const totalSaleValuation = useMemo(() => {
    return filteredProducts.reduce((acc, p) => acc + p.salePrice * p.stock, 0);
  }, [filteredProducts]);

  const totalStockUnits = useMemo(() => {
    return filteredProducts.reduce((acc, p) => acc + p.stock, 0);
  }, [filteredProducts]);

  const handlePrint = () => {
    const title = reportType === 'PRICE_LIST' 
      ? 'Lista_Precios_Don_Ramon' 
      : reportType === 'VALUATION' 
      ? 'Valuacion_Stock_Don_Ramon' 
      : 'Faltantes_Stock_Don_Ramon';
    printElement('printable-inventory-doc', title);
  };

  const handleDownloadCSV = () => {
    const headers = ['Codigo', 'Producto', 'Categoria', 'Costo', 'Precio Venta', 'Stock', 'Unidad'];
    const rows = filteredProducts.map((p) => [
      `"${p.barcode || ''}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.costPrice,
      p.salePrice,
      p.stock,
      `"${p.unit || 'u.'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Inventario_Don_Ramon_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl max-h-[94vh] flex flex-col rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Modal Toolbar (Non printable) */}
        <div className="bg-slate-900 px-4 sm:px-6 py-3.5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold tracking-wide">IMPRIMIR INVENTARIO & LISTA DE PRECIOS</h3>
              <p className="text-[11px] text-slate-400">{filteredProducts.length} productos listados</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadCSV}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Descargar lista en Excel / CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
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

        {/* Filter bar inside modal (Non printable) */}
        <div className="bg-slate-50 p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 no-print text-xs">
          {/* Format selection */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setReportType('PRICE_LIST')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                reportType === 'PRICE_LIST' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lista de Precios al Público
            </button>
            <button
              onClick={() => setReportType('VALUATION')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                reportType === 'VALUATION' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Valuación de Stock & Costos
            </button>
            <button
              onClick={() => setReportType('RESTOCK')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                reportType === 'RESTOCK' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Faltantes de Stock ({products.filter(p => p.stock <= p.minStock).length})
            </button>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Categoría:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-800"
            >
              <option value="ALL">Todas las Categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100">
          <div 
            id="printable-inventory-doc" 
            className="printable-content bg-white max-w-3xl mx-auto p-6 sm:p-8 rounded-lg shadow-sm border border-slate-200 text-slate-900 font-sans space-y-6"
          >
            {/* Header Document */}
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  GRANJA DON RAMÓN
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  {reportType === 'PRICE_LIST' 
                    ? 'LISTA OFICIAL DE PRECIOS AL PÚBLICO' 
                    : reportType === 'VALUATION' 
                    ? 'REPORTE DE VALUACIÓN DE INVENTARIO Y STOCK' 
                    : 'PLANILLA DE REPOSICIÓN Y FALTANTES DE MERCADERÍA'}
                </p>
                {selectedCategory !== 'ALL' && (
                  <div className="mt-1 text-[11px] font-bold text-indigo-700">
                    Rubro: {selectedCategory}
                  </div>
                )}
              </div>
              <div className="text-right text-xs text-slate-500 font-mono">
                <div>Fecha de Emisión:</div>
                <div className="font-bold text-slate-800">{formatDateTime(new Date().toISOString())}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">Total Artículos: {filteredProducts.length}</div>
              </div>
            </div>

            {/* Summary strip for Valuation & Restock */}
            {reportType === 'VALUATION' && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 font-sans font-bold uppercase">Unidades Totales</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{totalStockUnits} u.</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-sans font-bold uppercase">Valuación a Costo</div>
                  <div className="font-bold text-slate-700 text-sm mt-0.5">{formatCurrency(totalCostValuation)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-sans font-bold uppercase">Valuación a Venta</div>
                  <div className="font-bold text-emerald-700 text-sm mt-0.5">{formatCurrency(totalSaleValuation)}</div>
                </div>
              </div>
            )}

            {/* Items Table */}
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b-2 border-slate-300 text-[10px] uppercase font-bold">
                    <th className="py-2 px-2 text-left">Código</th>
                    <th className="py-2 px-2 text-left">Producto</th>
                    <th className="py-2 px-2 text-left">Categoría</th>
                    {reportType === 'VALUATION' && (
                      <th className="py-2 px-2 text-right">Costo</th>
                    )}
                    <th className="py-2 px-2 text-right">Precio Venta</th>
                    <th className="py-2 px-2 text-right">Stock</th>
                    {reportType === 'VALUATION' && (
                      <th className="py-2 px-2 text-right">Val. Total</th>
                    )}
                    {reportType === 'RESTOCK' && (
                      <th className="py-2 px-2 text-right">Mínimo</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                        No hay productos que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLowStock = p.stock <= p.minStock;
                      return (
                        <tr key={p.id} className={isLowStock && reportType !== 'PRICE_LIST' ? 'bg-amber-50/50' : ''}>
                          <td className="py-1.5 px-2 text-slate-400 text-[10px]">{p.barcode || '—'}</td>
                          <td className="py-1.5 px-2 font-sans font-bold text-slate-900">
                            {p.name}
                            {p.unit && p.unit !== 'u.' && <span className="text-[10px] font-normal text-slate-500 ml-1">({p.unit})</span>}
                          </td>
                          <td className="py-1.5 px-2 text-[10px] text-slate-500 font-sans truncate max-w-[120px]">
                            {p.category.split('&')[0]}
                          </td>
                          {reportType === 'VALUATION' && (
                            <td className="py-1.5 px-2 text-right text-slate-600">{formatCurrency(p.costPrice)}</td>
                          )}
                          <td className="py-1.5 px-2 text-right font-bold text-slate-900 text-xs">
                            {formatCurrency(p.salePrice)}
                          </td>
                          <td className={`py-1.5 px-2 text-right font-bold ${
                            p.stock <= 0 ? 'text-rose-600' : p.stock <= p.minStock ? 'text-amber-600' : 'text-slate-800'
                          }`}>
                            {p.stock}
                          </td>
                          {reportType === 'VALUATION' && (
                            <td className="py-1.5 px-2 text-right font-bold text-emerald-700">
                              {formatCurrency(p.salePrice * p.stock)}
                            </td>
                          )}
                          {reportType === 'RESTOCK' && (
                            <td className="py-1.5 px-2 text-right text-slate-500">{p.minStock}</td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="pt-6 mt-6 border-t border-dashed border-slate-300 flex justify-between items-center text-[10px] text-slate-400 font-sans">
              <div>Granja Don Ramón • Precios sujetos a modificación sin previo aviso.</div>
              <div>Página 1 de 1</div>
            </div>

          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-end items-center no-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};

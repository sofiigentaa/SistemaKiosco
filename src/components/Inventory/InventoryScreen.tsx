import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Download, 
  TrendingUp, 
  Check, 
  Barcode,
  Tags,
  FolderPlus,
  X,
  Printer,
  AlertTriangle,
  Tag,
  Percent,
  Zap,
  ArrowDownRight
} from 'lucide-react';
import { useKiosk } from '../../context/KioskContext';
import { Product, ProductCategory } from '../../types';
import { formatCurrency, formatPercent, formatDate, getDaysUntil } from '../../utils/formatters';
import { PrintInventoryModal } from './PrintInventoryModal';
import { LiquidationModal } from './LiquidationModal';
import { ClearDataModal } from '../Common/ClearDataModal';

export const InventoryScreen: React.FC = () => {
  const { 
    products, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    restockProduct, 
    applyBulkPriceAdjustment,
    categories,
    addCategory,
    deleteCategory
  } = useKiosk();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'EXPIRING'>('ALL');
  
  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showLiquidationModal, setShowLiquidationModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{ name: string; count: number } | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [showCategoryManagerModal, setShowCategoryManagerModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isInlineCategoryActive, setIsInlineCategoryActive] = useState(false);
  const [inlineCategoryInput, setInlineCategoryInput] = useState('');
  
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<number | ''>(10);
  const [restockCost, setRestockCost] = useState<number | ''>('');
  const [restockSale, setRestockSale] = useState<number | ''>('');

  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>('ALL');
  const [bulkPercent, setBulkPercent] = useState<number | ''>(10);

  const handleApplyLiquidation = (productIds: string[], discountPct: number | 'COST') => {
    let count = 0;
    productIds.forEach((id) => {
      const p = products.find((item) => item.id === id);
      if (!p) return;
      let newSalePrice = p.salePrice;
      if (discountPct === 'COST') {
        newSalePrice = p.costPrice;
      } else {
        newSalePrice = Math.round((p.salePrice * (1 - discountPct / 100)) / 10) * 10;
        if (newSalePrice < p.costPrice) {
          newSalePrice = p.costPrice;
        }
      }
      updateProduct(id, { salePrice: newSalePrice });
      count++;
    });

    setFeedbackToast(
      discountPct === 'COST'
        ? `🔥 Liquidación al Costo aplicada a ${count} producto(s).`
        : `🏷️ Liquidación (-${discountPct}%) aplicada a ${count} producto(s).`
    );
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Form State for Add / Edit Product
  const [formData, setFormData] = useState<{
    barcode: string;
    name: string;
    category: ProductCategory;
    costPrice: number | '';
    salePrice: number | '';
    stock: number | '';
    minStock: number | '';
    expirationDate: string;
    unit: string;
    supplier: string;
    notes: string;
  }>({
    barcode: '',
    name: '',
    category: 'Golosinas & Chocolates',
    costPrice: 500,
    salePrice: 900,
    stock: 10,
    minStock: 5,
    expirationDate: '',
    unit: 'u.',
    supplier: '',
    notes: '',
  });

  // Calculate profit margin markup
  const cost = Number(formData.costPrice) || 0;
  const sale = Number(formData.salePrice) || 0;
  const markupPercent = cost > 0 ? ((sale - cost) / cost) * 100 : 0;
  const marginPercent = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
  const profitPerUnit = sale - cost;

  // Open modal for new product
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setProductFormError(null);
    setFormData({
      barcode: '',
      name: '',
      category: categories[0] || 'Golosinas & Chocolates',
      costPrice: 500,
      salePrice: 900,
      stock: 15,
      minStock: 5,
      expirationDate: '',
      unit: 'u.',
      supplier: '',
      notes: '',
    });
    setIsInlineCategoryActive(false);
    setShowProductModal(true);
  };

  // Category helpers
  const handleCreateCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newCategoryName.trim();
    if (!clean) return;
    addCategory(clean);
    setFeedbackToast(`Categoría "${clean}" creada.`);
    setTimeout(() => setFeedbackToast(null), 3000);
    setNewCategoryName('');
  };

  const handleSaveInlineCategory = () => {
    const clean = inlineCategoryInput.trim();
    if (!clean) {
      setIsInlineCategoryActive(false);
      return;
    }
    addCategory(clean);
    setFormData((prev) => ({ ...prev, category: clean }));
    setFeedbackToast(`Categoría "${clean}" creada.`);
    setTimeout(() => setFeedbackToast(null), 3000);
    setInlineCategoryInput('');
    setIsInlineCategoryActive(false);
  };

  // Open modal for editing
  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setProductFormError(null);
    setFormData({
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      stock: p.stock,
      minStock: p.minStock,
      expirationDate: p.expirationDate || '',
      unit: p.unit || 'u.',
      supplier: p.supplier || '',
      notes: p.notes || '',
    });
    setShowProductModal(true);
  };

  // Open restock modal
  const handleOpenRestock = (p: Product) => {
    setRestockTarget(p);
    setRestockQty(10);
    setRestockCost(p.costPrice);
    setRestockSale(p.salePrice);
    setShowRestockModal(true);
  };

  // Save product form
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    const finalSalePrice = Number(formData.salePrice) || 0;
    const finalCostPrice = Number(formData.costPrice) || 0;
    const finalStock = formData.stock === '' ? 0 : Number(formData.stock);
    const finalMinStock = formData.minStock === '' ? 5 : Number(formData.minStock);

    if (!cleanName) {
      setProductFormError('Por favor, ingresa el nombre del producto.');
      return;
    }

    if (finalSalePrice <= 0) {
      setProductFormError('Por favor, ingresa un precio de venta mayor a $0.');
      return;
    }

    setProductFormError(null);

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        barcode: formData.barcode.trim() || editingProduct.barcode,
        name: cleanName,
        category: formData.category,
        costPrice: finalCostPrice,
        salePrice: finalSalePrice,
        stock: finalStock,
        minStock: finalMinStock,
        expirationDate: formData.expirationDate || undefined,
        unit: formData.unit || 'u.',
        supplier: formData.supplier.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
      setFeedbackToast(`"${cleanName}" actualizado.`);
      setTimeout(() => setFeedbackToast(null), 3000);
    } else {
      addProduct({
        barcode: formData.barcode.trim() || ('779' + Math.floor(1000000000 + Math.random() * 9000000000)),
        name: cleanName,
        category: formData.category,
        costPrice: finalCostPrice,
        salePrice: finalSalePrice,
        stock: finalStock,
        minStock: finalMinStock,
        expirationDate: formData.expirationDate || undefined,
        unit: formData.unit || 'u.',
        supplier: formData.supplier.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
      setFeedbackToast(`"${cleanName}" agregado al inventario.`);
      setTimeout(() => setFeedbackToast(null), 3000);
    }

    setShowProductModal(false);
  };

  // Execute restock
  const handleExecuteRestock = () => {
    if (!restockTarget || !restockQty || Number(restockQty) <= 0) return;

    restockProduct(
      restockTarget.id,
      Number(restockQty),
      restockCost ? Number(restockCost) : undefined,
      restockSale ? Number(restockSale) : undefined
    );

    setShowRestockModal(false);
    setRestockTarget(null);
  };

  // Execute bulk price increase
  const handleExecuteBulkPrice = () => {
    if (!bulkPercent || Number(bulkPercent) === 0) return;
    applyBulkPriceAdjustment(bulkCategory, Number(bulkPercent));
    setShowBulkPriceModal(false);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Codigo_Barras', 'Nombre', 'Categoria', 'Precio_Costo', 'Precio_Venta', 'Stock_Actual', 'Stock_Minimo', 'Vencimiento', 'Proveedor'];
    const rows = products.map((p) => [
      p.id,
      p.barcode,
      '"' + p.name.replace(/"/g, '""') + '"',
      '"' + p.category + '"',
      p.costPrice,
      p.salePrice,
      p.stock,
      p.minStock,
      p.expirationDate || '',
      '"' + (p.supplier || '').replace(/"/g, '""') + '"',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'inventario_kiosco_' + new Date().toISOString().split('T')[0] + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const query = search.toLowerCase().trim();
    const matchesSearch = !query || 
      p.name.toLowerCase().includes(query) || 
      p.barcode.includes(query) ||
      (p.supplier && p.supplier.toLowerCase().includes(query));

    let matchesStock = true;
    if (stockFilter === 'OUT') matchesStock = p.stock <= 0;
    if (stockFilter === 'LOW') matchesStock = p.stock > 0 && p.stock <= p.minStock;
    if (stockFilter === 'EXPIRING') {
      if (!p.expirationDate) matchesStock = false;
      else {
        const days = getDaysUntil(p.expirationDate);
        matchesStock = days !== null && days <= 7;
      }
    }

    return matchesCategory && matchesSearch && matchesStock;
  });

  // Calculate totals
  const totalItemsCount = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);
  const totalValuationCost = products.reduce((acc, p) => acc + p.stock * p.costPrice, 0);
  const totalValuationSale = products.reduce((acc, p) => acc + p.stock * p.salePrice, 0);
  const potentialProfit = totalValuationSale - totalValuationCost;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3.5">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            <span>Inventario & Control de Stock</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Gestione productos, precios de costo y venta, márgenes de ganancia y reposición.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            id="inv-categories-btn"
            onClick={() => setShowCategoryManagerModal(true)}
            className="px-2.5 py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-all border border-indigo-200 flex items-center gap-1.5"
            title="Administrar y crear nuevas categorías del kiosco"
          >
            <Tags className="w-3.5 h-3.5 text-indigo-600" />
            <span>Categorías ({categories.length})</span>
          </button>

          <button
            id="inv-bulk-price-btn"
            onClick={() => setShowBulkPriceModal(true)}
            className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-200 flex items-center gap-1 cursor-pointer"
            title="Aumentar precios por inflación a una categoría o a todo el kiosco"
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            <span>Aumento Masivo %</span>
          </button>

          <button
            id="inv-liquidation-btn"
            onClick={() => setShowLiquidationModal(true)}
            className="px-2.5 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition-all border border-amber-300 flex items-center gap-1 cursor-pointer"
            title="Liquidación y ofertas por pronto vencimiento o exceso de stock"
          >
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            <span>Liquidación / Ofertas %</span>
          </button>

          <button
            id="inv-print-btn"
            onClick={() => setShowPrintModal(true)}
            className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
            title="Imprimir lista completa de precios, valuación y stock del inventario"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Imprimir Inventario</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-200 flex items-center gap-1 cursor-pointer"
            title="Exportar inventario a planilla Excel/CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            id="inv-clear-data-btn"
            onClick={() => setShowClearDataModal(true)}
            className="px-2.5 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-semibold transition-all border border-rose-200 flex items-center gap-1 cursor-pointer"
            title="Borrar catálogo o vaciar stock a 0"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Borrar Datos</span>
          </button>

          <button
            id="inv-new-product-btn"
            onClick={handleOpenAddModal}
            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>NUEVO PRODUCTO</span>
          </button>
        </div>
      </div>

      {/* Valuation & Inventory Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Productos Registrados</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{totalItemsCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{totalStockUnits} unidades en stock</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valuación a Costo</div>
          <div className="text-xl font-bold font-mono text-slate-700 mt-0.5">{formatCurrency(totalValuationCost)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Capital invertido</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valuación a Venta</div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">{formatCurrency(totalValuationSale)}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Recaudación estimada</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ganancia Proyectada</div>
          <div className="text-xl font-bold font-mono text-indigo-600 mt-0.5">{formatCurrency(potentialProfit)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Margen: {totalValuationCost > 0 ? formatPercent((potentialProfit / totalValuationCost) * 100) : '0%'}
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="inv-search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código de barras o proveedor..."
              className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">Todas las Categorías ({products.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c} ({products.filter((p) => p.category === c).length})
                </option>
              ))}
            </select>
          </div>

          {/* Stock Level Filter */}
          <div className="md:col-span-3">
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">Todos los estados de stock</option>
              <option value="LOW">⚠️ Stock Bajo (Alerta de reposición)</option>
              <option value="OUT">🔴 Sin Stock (Agotados)</option>
              <option value="EXPIRING">⏰ Por vencer / Vencidos</option>
            </select>
          </div>

        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3.5">Producto & Código</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3 text-right">P. Costo</th>
                <th className="py-2.5 px-3 text-right">P. Venta</th>
                <th className="py-2.5 px-3 text-center">Margen</th>
                <th className="py-2.5 px-3 text-center">Stock</th>
                <th className="py-2.5 px-3">Vencimiento</th>
                <th className="py-2.5 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No se encontraron productos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOutOfStock = p.stock <= 0;
                  const isLowStock = p.stock > 0 && p.stock <= p.minStock;
                  const daysUntilExpiry = getDaysUntil(p.expirationDate);
                  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
                  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
                  const margin = p.costPrice > 0 ? ((p.salePrice - p.costPrice) / p.costPrice) * 100 : 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      {/* Name & Barcode */}
                      <td className="py-2 px-3.5">
                        <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <Barcode className="w-3 h-3 text-slate-400" />
                          <span>{p.barcode}</span>
                          {p.supplier && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500">{p.supplier}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                          {p.category.split('&')[0]}
                        </span>
                      </td>

                      {/* Cost */}
                      <td className="py-2 px-3 text-right font-mono text-slate-500">
                        {formatCurrency(p.costPrice)}
                      </td>

                      {/* Sale */}
                      <td className="py-2 px-3 text-right font-bold font-mono text-slate-900 text-xs">
                        {formatCurrency(p.salePrice)}
                      </td>

                      {/* Margin % */}
                      <td className="py-2 px-3 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {formatPercent(margin)}
                        </span>
                      </td>

                      {/* Stock with Status Badge */}
                      <td className="py-2 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          {isOutOfStock ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 uppercase">
                              0 {p.unit || 'u.'}
                            </span>
                          ) : isLowStock ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 uppercase">
                              {p.stock} {p.unit || 'u.'} (Min {p.minStock})
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase">
                              {p.stock} {p.unit || 'u.'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Expiration Date */}
                      <td className="py-2 px-3">
                        {p.expirationDate ? (
                          <div>
                            <div className="font-semibold text-slate-800 text-[11px]">
                              {formatDate(p.expirationDate)}
                            </div>
                            {isExpired ? (
                              <span className="text-[10px] font-bold text-rose-600 block">
                                ¡VENCIDO! ({Math.abs(daysUntilExpiry!)} d)
                              </span>
                            ) : isExpiringSoon ? (
                              <span className="text-[10px] font-bold text-amber-600 block">
                                Vence en {daysUntilExpiry} días
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 block">
                                En {daysUntilExpiry} días
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Quick Restock Button */}
                          <button
                            id={'inv-restock-' + p.id}
                            onClick={() => handleOpenRestock(p)}
                            className="p-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded transition-colors cursor-pointer"
                            title="Ingresar stock de mercadería"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            id={'inv-edit-' + p.id}
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors cursor-pointer"
                            title="Editar datos y precios"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            id={'inv-delete-' + p.id}
                            onClick={() => setProductToDelete(p)}
                            className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-xl border border-slate-200 overflow-hidden transform animate-in fade-in zoom-in duration-150 my-6">
            
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-tight flex items-center gap-2 uppercase">
                <Package className="w-4 h-4 text-indigo-400" />
                <span>{editingProduct ? 'EDITAR PRODUCTO' : 'CARGAR NUEVO PRODUCTO'}</span>
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="w-7 h-7 rounded bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-3.5 text-xs">
              {productFormError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{productFormError}</span>
                </div>
              )}
              
              {/* Name & Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nombre del Producto <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="prod-name-input"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Alfajor Havanna 70% Cacao"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Código de Barras
                  </label>
                  <input
                    id="prod-barcode-input"
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Ej: 7791234567890 (dejalo vacío para autogenerar)"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Category & Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Categoría</label>
                    {!isInlineCategoryActive ? (
                      <button
                        type="button"
                        onClick={() => setIsInlineCategoryActive(true)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nueva</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsInlineCategoryActive(false)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
                      >
                        Elegir de lista
                      </button>
                    )}
                  </div>

                  {isInlineCategoryActive ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={inlineCategoryInput}
                        onChange={(e) => setInlineCategoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveInlineCategory();
                          }
                        }}
                        placeholder="Nombre nueva categoría..."
                        className="flex-1 bg-white border border-indigo-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveInlineCategory}
                        className="px-2 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs font-bold"
                        title="Guardar categoría"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInlineCategoryActive(false)}
                        className="px-2 py-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-xs"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsInlineCategoryActive(true);
                        } else {
                          setFormData({ ...formData, category: e.target.value });
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__NEW__">➕ + Crear nueva categoría...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Proveedor / Distribuidora</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Ej: Arcor / Distribuidora Central"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* PRICES & REAL-TIME MARGIN CALCULATOR */}
              <div className="bg-indigo-50/70 p-3 rounded-lg border border-indigo-100 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                  Precios y Márgenes de Ganancia
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Precio de Costo ($)</label>
                    <input
                      id="prod-cost-input"
                      type="number"
                      min="0"
                      step="10"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Precio de Venta al Público ($) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="prod-sale-input"
                      type="number"
                      required
                      min="1"
                      step="10"
                      value={formData.salePrice}
                      onChange={(e) => setFormData({ ...formData, salePrice: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full bg-white border border-indigo-400 rounded px-2.5 py-1.5 text-sm font-bold font-mono text-slate-950 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Auto Calculated Live Indicators */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                  <div className="bg-white p-1.5 rounded border border-indigo-100">
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Ganancia Neta</div>
                    <div className="text-xs font-bold text-emerald-600 mt-0.5">
                      {formatCurrency(profitPerUnit)}
                    </div>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-indigo-100">
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Recargo</div>
                    <div className="text-xs font-bold text-indigo-600 mt-0.5">
                      {formatPercent(markupPercent)}
                    </div>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-indigo-100">
                    <div className="text-[9px] text-slate-400 font-bold uppercase">Margen Com.</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">
                      {marginPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* STOCK, MIN STOCK & EXPIRY */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Actual (u.)</label>
                  <input
                    id="prod-stock-input"
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-2 px-3 rounded border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="prod-save-submit-btn"
                  className="flex-1 py-2 px-3 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingProduct ? 'GUARDAR CAMBIOS' : 'CREAR PRODUCTO'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* RESTOCK MODAL */}
      {showRestockModal && restockTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-lg p-5 shadow-xl border border-slate-200 space-y-3.5">
            
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Ingreso de Mercadería (Reposición)</span>
              </h4>
              <button
                onClick={() => setShowRestockModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="font-bold text-slate-900 text-xs">{restockTarget.name}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Stock actual: <span className="font-bold text-slate-800">{restockTarget.stock} u.</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad a ingresar (+ unidades)</label>
              <input
                id="restock-qty-input"
                type="number"
                min="1"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-base font-bold font-mono text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Nuevo Costo ($)</label>
                <input
                  type="number"
                  value={restockCost}
                  onChange={(e) => setRestockCost(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={restockTarget.costPrice.toString()}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Nuevo Precio Venta ($)</label>
                <input
                  type="number"
                  value={restockSale}
                  onChange={(e) => setRestockSale(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={restockTarget.salePrice.toString()}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="bg-emerald-50 p-2 rounded border border-emerald-200 text-xs text-emerald-900 font-medium">
              El nuevo stock será de <span className="font-bold font-mono">{restockTarget.stock + (Number(restockQty) || 0)}</span> unidades.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRestockModal(false)}
                className="flex-1 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="restock-confirm-btn"
                onClick={handleExecuteRestock}
                className="flex-1 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
              >
                Confirmar Ingreso
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BULK PRICE ADJUSTMENT MODAL */}
      {showBulkPriceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-lg p-5 shadow-xl border border-slate-200 space-y-3.5">
            
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>Aumento Masivo de Precios (%)</span>
              </h4>
              <button
                onClick={() => setShowBulkPriceModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Ajuste rápidamente los precios por inflación o lista de proveedores sin modificar producto por producto.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Categoría a actualizar</label>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900"
              >
                <option value="ALL">Todo el Kiosco (Todos los productos)</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Porcentaje de Aumento (%)</label>
              <input
                id="bulk-percent-input"
                type="number"
                step="1"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-base font-bold font-mono text-slate-900"
              />
            </div>

            {/* Shortcut Buttons */}
            <div className="flex gap-1.5">
              {[5, 10, 15, 20, 25].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setBulkPercent(pct)}
                  className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold font-mono rounded"
                >
                  {'+' + pct + '%'}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBulkPriceModal(false)}
                className="flex-1 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="bulk-apply-btn"
                onClick={handleExecuteBulkPrice}
                className="flex-1 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
              >
                Aplicar Aumento
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CATEGORY MANAGER MODAL */}
      {showCategoryManagerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-lg p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Tags className="w-4 h-4 text-indigo-600" />
                <span>Gestor de Categorías del Kiosco</span>
              </h4>
              <button
                onClick={() => setShowCategoryManagerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Create new category form */}
            <form onSubmit={handleCreateCategory} className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Crear Nueva Categoría
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ej: Cigarrillos, Panadería, Helados..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newCategoryName.trim()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear</span>
                </button>
              </div>
            </form>

            {/* List of existing categories */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Categorías Existentes ({categories.length})
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-md bg-slate-50/50">
                {categories.map((cat) => {
                  const count = products.filter((p) => p.category === cat).length;
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between px-3 py-2 text-xs hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{cat}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          {count} {count === 1 ? 'producto' : 'productos'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCategoryToDelete({ name: cat, count })}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCategoryManagerModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM DELETE PRODUCT MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-lg p-5 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">¿Eliminar este producto?</h4>
                <p className="text-xs text-slate-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900">{productToDelete.name}</div>
              <div className="text-slate-500 flex items-center gap-2">
                <span>Categoría: {productToDelete.category}</span>
                <span>•</span>
                <span>Stock: {productToDelete.stock} {productToDelete.unit || 'u.'}</span>
              </div>
              {productToDelete.barcode && (
                <div className="text-slate-400 font-mono text-[11px]">Código: {productToDelete.barcode}</div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="flex-1 py-2 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="confirm-delete-product-btn"
                onClick={() => {
                  deleteProduct(productToDelete.id);
                  setFeedbackToast(`"${productToDelete.name}" fue eliminado.`);
                  setTimeout(() => setFeedbackToast(null), 3000);
                  setProductToDelete(null);
                }}
                className="flex-1 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CATEGORY MODAL */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-lg p-5 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">¿Eliminar categoría?</h4>
                <p className="text-xs text-slate-500">Categoría: {categoryToDelete.name}</p>
              </div>
            </div>

            {categoryToDelete.count > 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded text-xs">
                ⚠️ Hay <strong>{categoryToDelete.count} producto(s)</strong> con esta categoría asignada. Al eliminarla, los productos conservarán su stock pero no pertenecerán a esta categoría.
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                ¿Estás seguro de que deseas quitar esta categoría de la lista?
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCategory(categoryToDelete.name);
                  setFeedbackToast(`Categoría "${categoryToDelete.name}" eliminada.`);
                  setTimeout(() => setFeedbackToast(null), 3000);
                  setCategoryToDelete(null);
                }}
                className="flex-1 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Feedback Toast */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom duration-200 flex items-center gap-2 border border-slate-700">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Print Inventory / Price List Modal */}
      {showPrintModal && (
        <PrintInventoryModal
          products={products}
          categories={categories}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Bulk Liquidation & Offers Modal */}
      {showLiquidationModal && (
        <LiquidationModal
          products={products}
          categories={categories}
          onApplyLiquidation={handleApplyLiquidation}
          onClose={() => setShowLiquidationModal(false)}
        />
      )}

      {/* Clear Data Modal */}
      <ClearDataModal
        isOpen={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        defaultMode="PRODUCTS"
      />

    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  RotateCcw, 
  DollarSign, 
  CreditCard, 
  Banknote, 
  QrCode, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Zap,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ListFilter,
  ShoppingCart,
  Tags,
  Check,
  X,
  Camera
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useKiosk } from '../../context/KioskContext';
import { Product, CartItem, PaymentMethod, Sale } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { playScannerBeep } from '../../utils/audio';
import { CameraBarcodeScannerModal } from './CameraBarcodeScannerModal';

interface PosScreenProps {
  onSaleCompleted: (sale: Sale) => void;
}

export const PosScreen: React.FC<PosScreenProps> = ({ onSaleCompleted }) => {
  const { 
    products, 
    recordSale, 
    searchFilter, 
    setSearchFilter, 
    setActiveTab,
    categories,
    addCategory,
    addProduct
  } = useKiosk();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [mobileView, setMobileView] = useState<'catalog' | 'ticket'>('catalog');
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isCategoryWrapped, setIsCategoryWrapped] = useState<boolean>(false);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [cashReceived, setCashReceived] = useState<number | ''>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [saleNote, setSaleNote] = useState<string>('');

  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState<number | ''>(500);

  // Quick Add Product Modal (when barcode/name not found or when clicking "+ Agregar")
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState<{
    barcode: string;
    name: string;
    category: string;
    costPrice: number | '';
    salePrice: number | '';
    stock: number | '';
  }>({
    barcode: '',
    name: '',
    category: 'Golosinas & Chocolates',
    costPrice: 500,
    salePrice: 900,
    stock: 15,
  });
  const [isQuickInlineCat, setIsQuickInlineCat] = useState(false);
  const [quickInlineCatInput, setQuickInlineCatInput] = useState('');

  // POS Category Creation Modal
  const [showPosCategoryModal, setShowPosCategoryModal] = useState(false);
  const [posNewCatName, setPosNewCatName] = useState('');

  const updateScrollButtons = () => {
    if (categoryScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoryScrollRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    updateScrollButtons();
  }, [selectedCategory, isCategoryWrapped, products]);

  const handleCategoryScroll = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = 220;
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(updateScrollButtons, 300);
    }
  };

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          setShowCheckoutModal(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const q = searchFilter.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchCategory && matchSearch;
  });

  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    if (product.stock <= 0) {
      setFeedbackMessage({
        type: 'error',
        text: 'Producto sin stock disponible: ' + product.name,
      });
      setTimeout(() => setFeedbackMessage(null), 2500);
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === product.id);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + quantityToAdd > product.stock) {
        setFeedbackMessage({
          type: 'error',
          text: 'Stock máximo alcanzado (' + product.stock + ' u.)',
        });
        setTimeout(() => setFeedbackMessage(null), 2500);
        return;
      }

      setCart((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + quantityToAdd }
            : item
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          product,
          quantity: quantityToAdd,
          unitPrice: product.salePrice,
        },
      ]);
    }

    playScannerBeep();
  };

  const openQuickProductModal = (initialCode: string) => {
    const isDigits = /^\d+$/.test(initialCode);
    setQuickError(null);
    setQuickForm({
      barcode: initialCode && isDigits ? initialCode : '',
      name: initialCode && !isDigits ? initialCode : '',
      category: categories[0] || 'Golosinas & Chocolates',
      costPrice: 500,
      salePrice: 900,
      stock: 15,
    });
    setIsQuickInlineCat(false);
    setQuickInlineCatInput('');
    setShowQuickAddModal(true);
  };

  const handleSaveQuickProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = quickForm.name.trim();
    const sale = Number(quickForm.salePrice) || 0;
    const cost = Number(quickForm.costPrice) || 0;
    const stock = quickForm.stock === '' ? 15 : Number(quickForm.stock);
    const barcode = quickForm.barcode.trim() || ('779' + Math.floor(1000000000 + Math.random() * 9000000000));
    const category = quickForm.category || categories[0] || 'General';

    if (!cleanName) {
      setQuickError('Por favor, ingresa el nombre del producto.');
      return;
    }
    if (sale <= 0) {
      setQuickError('Por favor, ingresa un precio de venta mayor a $0.');
      return;
    }

    setQuickError(null);

    const newProd = addProduct({
      barcode,
      name: cleanName,
      category,
      costPrice: cost,
      salePrice: sale,
      stock: Math.max(1, stock),
      minStock: 5,
      unit: 'u.',
    });

    // Automatically add 1 unit to cart
    addToCart(newProd, 1);
    setBarcodeInput('');
    setShowQuickAddModal(false);
    setFeedbackMessage({
      type: 'success',
      text: `¡"${cleanName}" creado y añadido al ticket!`,
    });
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleSaveQuickInlineCategory = () => {
    const clean = quickInlineCatInput.trim();
    if (!clean) {
      setIsQuickInlineCat(false);
      return;
    }
    addCategory(clean);
    setQuickForm((prev) => ({ ...prev, category: clean }));
    setQuickInlineCatInput('');
    setIsQuickInlineCat(false);
  };

  const handlePosCreateCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = posNewCatName.trim();
    if (!clean) return;
    addCategory(clean);
    setSelectedCategory(clean);
    setPosNewCatName('');
    setShowPosCategoryModal(false);
    setFeedbackMessage({
      type: 'success',
      text: `Categoría "${clean}" creada con éxito`,
    });
    setTimeout(() => setFeedbackMessage(null), 2500);
  };

  // Shared resolver used both by the manual barcode input (physical
  // scanner / keyboard) and by the camera-based scanner modal.
  const processScannedCode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      openQuickProductModal('');
      return;
    }

    // Search exact barcode, exact ID, or partial name match
    const lower = code.toLowerCase();
    const matchedProduct = products.find(
      (p) => p.barcode.toLowerCase() === lower || p.id === code || p.name.toLowerCase().includes(lower)
    );

    if (matchedProduct) {
      addToCart(matchedProduct, 1);
      setFeedbackMessage({
        type: 'success',
        text: 'Agregado al ticket: ' + matchedProduct.name,
      });
      setBarcodeInput('');
      setTimeout(() => setFeedbackMessage(null), 2500);
    } else {
      // Open Quick Product Creation Modal with this code/name prefilled!
      openQuickProductModal(code);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processScannedCode(barcodeInput);
  };

  const handleCameraScan = (code: string) => {
    // Close the camera modal first so the success/creation feedback and
    // any Quick Add modal are clearly visible to the user.
    setShowCameraScanner(false);
    processScannedCode(code);
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const targetItem = cart.find((i) => i.product.id === productId);
    if (!targetItem) return;

    if (targetItem.product.stock > 0 && newQty > targetItem.product.stock) {
      setFeedbackMessage({
        type: 'error',
        text: 'Stock máximo: ' + targetItem.product.stock + ' unidades',
      });
      setTimeout(() => setFeedbackMessage(null), 2500);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
  };

  const handleAddCustomItem = () => {
    if (!customItemPrice || customItemPrice <= 0) return;

    const dummyCustomProduct: Product = {
      id: 'custom-' + Date.now(),
      barcode: 'VAR-0000',
      name: customItemName || 'Golosina / Artículo Libre',
      category: 'Recargas & Varios',
      costPrice: Math.round(Number(customItemPrice) * 0.6),
      salePrice: Number(customItemPrice),
      stock: 999,
      minStock: 0,
      updatedAt: new Date().toISOString(),
    };

    setCart((prev) => [
      ...prev,
      {
        product: dummyCustomProduct,
        quantity: 1,
        unitPrice: Number(customItemPrice),
      },
    ]);

    setShowCustomItemModal(false);
    setCustomItemPrice(500);
    setCustomItemName('');
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const discountAmount = Math.round((cartSubtotal * discountPercent) / 100);
  const cartTotal = Math.max(0, cartSubtotal - discountAmount);

  const numericCashReceived = typeof cashReceived === 'number' ? cashReceived : 0;
  const calculatedChange = Math.max(0, numericCashReceived - cartTotal);

  const handleCompleteSale = () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'Efectivo' && numericCashReceived < cartTotal && numericCashReceived > 0) {
      setFeedbackMessage({
        type: 'error',
        text: 'El efectivo recibido es menor al total a cobrar.',
      });
      return;
    }

    const sale = recordSale(
      cart,
      paymentMethod,
      paymentMethod === 'Efectivo' ? (numericCashReceived || cartTotal) : undefined,
      discountAmount,
      customerName.trim() || undefined,
      saleNote.trim() || undefined
    );

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#6366f1', '#10b981', '#3b82f6'],
    });

    setCart([]);
    setShowCheckoutModal(false);
    setCashReceived('');
    setDiscountPercent(0);
    setCustomerName('');
    setSaleNote('');
    setMobileView('catalog');

    onSaleCompleted(sale);
  };

  const quickCashPresets = [
    { label: 'Exacto', value: cartTotal },
    { label: '$1.000', value: 1000 },
    { label: '$2.000', value: 2000 },
    { label: '$5.000', value: 5000 },
    { label: '$10.000', value: 10000 },
    { label: '$20.000', value: 20000 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4 pb-24 lg:pb-4">
      
      {feedbackMessage && (
        <div 
          className={'fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 text-xs font-semibold transition-all ' + (
            feedbackMessage.type === 'success' 
              ? 'bg-emerald-600 text-white' 
              : 'bg-rose-600 text-white'
          )}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Mobile Top View Switcher (Visible only on Celu / Tablet < 1024px) */}
      <div className="lg:hidden flex rounded-lg bg-slate-200 p-1 text-xs font-bold shadow-xs">
        <button
          type="button"
          id="mobile-tab-catalog"
          onClick={() => setMobileView('catalog')}
          className={`flex-1 py-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileView === 'catalog'
              ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-300'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Barcode className="w-3.5 h-3.5" />
          <span>Catálogo ({filteredProducts.length})</span>
        </button>
        <button
          type="button"
          id="mobile-tab-ticket"
          onClick={() => setMobileView('ticket')}
          className={`flex-1 py-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
            mobileView === 'ticket'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Ticket ({cart.reduce((a, b) => a + b.quantity, 0)})</span>
          {cartTotal > 0 && (
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              mobileView === 'ticket' ? 'bg-indigo-800 text-indigo-200' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {formatCurrency(cartTotal)}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* LEFT COLUMN: BARCODE INPUT, CATEGORIES & CATALOG (7 cols) */}
        <div className={`lg:col-span-7 space-y-3 ${mobileView === 'ticket' ? 'hidden lg:block' : 'block'}`}>
          
          {/* Top Barcode Quick Scan Bar */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs">
            <form onSubmit={handleBarcodeSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Barcode className="w-4 h-4 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={barcodeInputRef}
                  id="pos-barcode-input"
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Escanear código de barras (F2) o presione Enter..."
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 pl-9 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  id="pos-add-barcode-btn"
                  className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded text-xs transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>

                <button
                  type="button"
                  id="pos-camera-scan-btn"
                  onClick={() => setShowCameraScanner(true)}
                  className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-2 rounded text-xs transition-all border border-slate-200 flex items-center justify-center gap-1.5"
                  title="Escanear código de barras con la cámara del dispositivo"
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="inline">Cámara</span>
                </button>

                <button
                  type="button"
                  id="pos-custom-item-btn"
                  onClick={() => setShowCustomItemModal(true)}
                  className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-2 rounded text-xs transition-all border border-slate-200 flex items-center justify-center gap-1.5"
                  title="Cobro rápido de golosinas sueltas o monto libre"
                >
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="inline">Monto Libre</span>
                </button>
              </div>
            </form>
          </div>

          {/* Category Filter Bar with Responsive Scrolling & Wrap Controls */}
          <div className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-xs space-y-2">
            {/* Header with Title & View Mode Controls */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ListFilter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Categorías</span>
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {selectedCategory === 'ALL' ? 'Mostrando Todas' : selectedCategory}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Scroll Navigation Arrows (visible in scroll mode) */}
                {!isCategoryWrapped && (
                  <div className="hidden sm:flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCategoryScroll('left')}
                      disabled={!canScrollLeft}
                      className={"p-1 rounded border text-xs transition-all " + (
                        canScrollLeft 
                          ? "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs" 
                          : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-50"
                      )}
                      title="Desplazar categorías hacia la izquierda"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCategoryScroll('right')}
                      disabled={!canScrollRight}
                      className={"p-1 rounded border text-xs transition-all " + (
                        canScrollRight 
                          ? "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs" 
                          : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-50"
                      )}
                      title="Desplazar categorías hacia la derecha"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Wrap / Expand Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsCategoryWrapped(!isCategoryWrapped)}
                  className={"flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-all " + (
                    isCategoryWrapped
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                  )}
                  title={isCategoryWrapped ? "Cambiar a fila deslizable" : "Ver todas las categorías expandidas"}
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span className="hidden xs:inline sm:inline">
                    {isCategoryWrapped ? "Compactar" : "Ver Todas"}
                  </span>
                </button>
              </div>
            </div>

            {/* Pills Container: Either Horizontal Scroll or Wrapped Grid */}
            <div className="relative">
              {/* Left & Right gradient indicators in scroll mode */}
              {!isCategoryWrapped && canScrollLeft && (
                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
              )}
              {!isCategoryWrapped && canScrollRight && (
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />
              )}

              <div 
                ref={categoryScrollRef}
                onScroll={updateScrollButtons}
                className={
                  isCategoryWrapped
                    ? "flex flex-wrap items-center gap-1.5 py-1"
                    : "flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin touch-scroll scroll-smooth"
                }
              >
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={'px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap shrink-0 ' + (
                    selectedCategory === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-500'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  )}
                >
                  Todos ({products.length})
                </button>
                {categories.map((cat) => {
                  const count = products.filter((p) => p.category === cat).length;
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={'px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ' + (
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-500'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                      )}
                    >
                      <span>{cat}</span>
                      <span className={'text-[10px] font-bold px-1.5 py-0.2 rounded-full ' + (
                        isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowPosCategoryModal(true)}
                  className="px-2.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 shrink-0 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-dashed border-indigo-300"
                  title="Crear una nueva categoría"
                >
                  <Plus className="w-3 h-3" />
                  <span>Categoría</span>
                </button>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 max-h-[580px] overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-14 px-4">
                <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-700">No se encontraron productos</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Prueba buscando con otro término o añade nuevos artículos desde la sección de Inventario.
                </p>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="mt-3 px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700"
                >
                  Ir a Cargar Producto
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.stock <= 0;
                  const isLowStock = product.stock > 0 && product.stock <= product.minStock;

                  return (
                    <div
                      key={product.id}
                      id={'pos-prod-' + product.id}
                      onClick={() => !isOutOfStock && addToCart(product, 1)}
                      className={'group relative bg-white p-3 rounded-lg border text-left transition-all select-none flex flex-col justify-between ' + (
                        isOutOfStock
                          ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed'
                          : 'cursor-pointer hover:border-indigo-400 hover:shadow-xs border-slate-200 active:scale-[0.99]'
                      )}
                    >
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-medium text-slate-400 truncate max-w-[100px] uppercase tracking-tight">
                          {product.category.split('&')[0]}
                        </span>
                        
                        {/* Stock Badge */}
                        {isOutOfStock ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 uppercase">
                            Sin Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 uppercase">
                            Quedan {product.stock}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase">
                            Stock {product.stock}
                          </span>
                        )}
                      </div>

                      {/* Product Name */}
                      <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors">
                        {product.name}
                      </h4>

                      {/* Price and Add Icon */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                        <span className="text-sm font-bold text-slate-900 font-mono">
                          {formatCurrency(product.salePrice)}
                        </span>
                        <div className="w-6 h-6 rounded bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white flex items-center justify-center transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE SALE TICKET & CHECKOUT (5 cols) */}
        <div className={`lg:col-span-5 ${mobileView === 'catalog' ? 'hidden lg:block' : 'block'}`} id="pos-ticket-container">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden sticky top-20">
            
            {/* Ticket Header */}
            <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">TICKET DE VENTA ACTUAL</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Mobile button to return to catalog */}
                <button
                  type="button"
                  onClick={() => setMobileView('catalog')}
                  className="lg:hidden text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2.5 py-1 rounded flex items-center gap-1 font-semibold border border-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Catálogo</span>
                </button>

                {cart.length > 0 && (
                  <button
                    id="pos-clear-cart-btn"
                    onClick={clearCart}
                    className="text-xs text-rose-300 hover:text-rose-100 flex items-center gap-1 font-medium transition-colors"
                    title="Vaciar carrito"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Vaciar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="p-3 max-h-[360px] overflow-y-auto divide-y divide-slate-100 text-[13px]">
              {cart.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Barcode className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">El carrito está vacío</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Escanee código de barras o haga clic en productos del catálogo.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMobileView('catalog')}
                    className="lg:hidden mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ver Catálogo de Productos</span>
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0 pr-1">
                      <h5 className="text-xs font-bold text-slate-800 truncate">
                        {item.product.name}
                      </h5>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatCurrency(item.unitPrice)} c/u
                      </div>
                    </div>

                    {/* Quantity Stepper (touch-friendly on mobile) */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-7 h-7 sm:w-6 sm:h-6 rounded bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors text-xs font-bold cursor-pointer active:scale-95 shadow-2xs"
                        title="Restar una unidad"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold font-mono text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-7 h-7 sm:w-6 sm:h-6 rounded bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors text-xs font-bold cursor-pointer active:scale-95 shadow-2xs"
                        title="Sumar una unidad"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Line Subtotal */}
                    <div className="text-right min-w-[65px]">
                      <div className="text-xs font-bold font-mono text-slate-900">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </div>
                    </div>

                    {/* Delete item */}
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-300 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                      title="Eliminar del ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Ticket Summary & Actions */}
            <div className="bg-slate-50 p-3.5 border-t border-slate-200 space-y-2.5">
              
              {/* Subtotals & Discount */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal ({cart.reduce((a, b) => a + b.quantity, 0)} items)</span>
                  <span className="font-semibold text-slate-700 font-mono">{formatCurrency(cartSubtotal)}</span>
                </div>

                {discountPercent > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium font-mono">
                    <span>Descuento ({discountPercent}%)</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
              </div>

              {/* Grand Total Display */}
              <div className="bg-slate-900 text-white rounded-lg p-3 flex items-center justify-between shadow-inner">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">TOTAL A COBRAR</div>
                  <div className="text-2xl font-bold font-mono text-indigo-300 tracking-tight">
                    {formatCurrency(cartTotal)}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  {cart.length} productos
                </div>
              </div>

              {/* Primary Checkout Button */}
              <button
                id="pos-checkout-modal-btn"
                disabled={cart.length === 0}
                onClick={() => {
                  setCashReceived(cartTotal);
                  setShowCheckoutModal(true);
                }}
                className={'w-full py-3 px-4 rounded font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 ' + (
                  cart.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-[0.99]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                <DollarSign className="w-4 h-4" />
                <span>COBRAR {cartTotal > 0 ? formatCurrency(cartTotal) : ''} (F4)</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* CHECKOUT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg max-h-[94vh] flex flex-col rounded-lg shadow-xl border border-slate-200 overflow-hidden transform animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold tracking-wide flex items-center gap-2 uppercase">
                  <Banknote className="w-4 h-4 text-indigo-400" />
                  <span>FINALIZAR COBRO</span>
                </h3>
                <p className="text-[11px] text-slate-400">Seleccione el medio de pago del cliente</p>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="w-7 h-7 rounded bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Big Total Banner */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Monto Total a Cobrar</span>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                  {formatCurrency(cartTotal)}
                </div>
              </div>

              {/* Payment Methods Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Método de Pago
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'Efectivo', label: 'Efectivo', icon: Banknote },
                    { id: 'Tarjeta de Débito', label: 'Débito', icon: CreditCard },
                    { id: 'Tarjeta de Crédito', label: 'Crédito', icon: CreditCard },
                    { id: 'Transferencia / MP', label: 'QR / MP', icon: QrCode },
                    { id: 'Cuenta Corriente (Fiado)', label: 'Fiado / Cta.', icon: User },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSel = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.id as PaymentMethod);
                          if (m.id === 'Efectivo') setCashReceived(cartTotal);
                        }}
                        className={'p-2.5 rounded border text-xs font-bold flex flex-col items-center gap-1 transition-all ' + (
                          isSel
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CASH SPECIFIC: Fast Cash Presets & Realtime Vuelto */}
              {paymentMethod === 'Efectivo' && (
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700">Efectivo Recibido ($)</label>
                    <span className="text-[11px] text-slate-500">Cálculo de vuelto</span>
                  </div>

                  <input
                    id="pos-cash-received-input"
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Monto entregado por el cliente"
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-base font-bold font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  {/* Preset Bills */}
                  <div className="flex flex-wrap gap-1.5">
                    {quickCashPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setCashReceived(preset.value)}
                        className={'px-2.5 py-1 rounded text-xs font-bold font-mono border transition-all ' + (
                          cashReceived === preset.value
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Calculated Change Box */}
                  <div className={'p-2.5 rounded flex items-center justify-between ' + (
                    numericCashReceived >= cartTotal
                      ? 'bg-green-100 text-green-900 border border-green-300'
                      : 'bg-orange-100 text-orange-900 border border-orange-300'
                  )}>
                    <span className="text-xs font-bold uppercase">
                      {numericCashReceived >= cartTotal ? 'Vuelto a Entregar:' : 'Faltan:'}
                    </span>
                    <span className="text-lg font-bold font-mono">
                      {numericCashReceived >= cartTotal
                        ? formatCurrency(calculatedChange)
                        : formatCurrency(cartTotal - numericCashReceived)}
                    </span>
                  </div>
                </div>
              )}

              {/* FIADO / CUENTA CORRIENTE: Customer Name */}
              {paymentMethod === 'Cuenta Corriente (Fiado)' && (
                <div className="bg-amber-50 p-3.5 rounded-lg border border-amber-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Nombre del Cliente / Vecino <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej: Doña Rosa / Martín (Piso 4)"
                    className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-amber-800">
                    El stock se descontará en tiempo real y quedará asentado en el registro como venta a cobrar.
                  </p>
                </div>
              )}

              {/* Optional Discount selector & Note */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Descuento (%)</label>
                  <select
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value={0}>Sin Descuento (0%)</option>
                    <option value={5}>5% Promoción</option>
                    <option value={10}>10% Amigo / Empleado</option>
                    <option value={15}>15% Liquidación</option>
                    <option value={20}>20% Mayorista</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Nota Opcional</label>
                  <input
                    type="text"
                    value={saleNote}
                    onChange={(e) => setSaleNote(e.target.value)}
                    placeholder="Ej: Envoltorio para regalo"
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Confirm Sale Button */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 py-2.5 px-3 rounded border border-slate-300 text-slate-700 font-medium text-xs hover:bg-slate-100"
                >
                  Volver al Ticket
                </button>
                <button
                  type="button"
                  id="pos-confirm-sale-final-btn"
                  onClick={handleCompleteSale}
                  className="flex-1 py-2.5 px-3 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>REGISTRAR VENTA</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CAMERA BARCODE SCANNER MODAL */}
      <CameraBarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScan}
      />

      {/* QUICK CUSTOM ITEM MODAL (Golosina suelta / Varios) */}
      {showCustomItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-lg p-5 shadow-xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-indigo-600" />
                <span>Cobro Libre / Varios</span>
              </h4>
              <button
                onClick={() => setShowCustomItemModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Descripción</label>
              <input
                type="text"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                placeholder="Ej: Golosina suelta / Fotocopia"
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Precio de Venta ($)</label>
              <input
                type="number"
                value={customItemPrice}
                onChange={(e) => setCustomItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="500"
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-sm font-bold font-mono text-slate-900"
              />
            </div>

            {/* Quick amount shortcuts */}
            <div className="flex gap-1.5">
              {[200, 500, 1000, 1500, 2000].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCustomItemPrice(p)}
                  className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-mono rounded"
                >
                  {'$' + p}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCustomItemModal(false)}
                className="flex-1 py-1.5 rounded border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="flex-1 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
              >
                Agregar al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD / REGISTER NEW PRODUCT MODAL */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-lg p-5 shadow-xl border border-slate-200 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>Cargar Producto y Sumar al Ticket</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Registre el artículo en el inventario y agréguelo de inmediato a la venta actual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickProduct} className="space-y-3">
              {quickError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{quickError}</span>
                </div>
              )}
              
              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre del Producto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={quickForm.name}
                  onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })}
                  placeholder="Ej: Alfajor Fantoche Triple"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código de Barras
                </label>
                <div className="relative">
                  <Barcode className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={quickForm.barcode}
                    onChange={(e) => setQuickForm({ ...quickForm, barcode: e.target.value })}
                    placeholder="779..."
                    className="w-full bg-slate-50 border border-slate-300 rounded pl-8 pr-2.5 py-1.5 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Category with Inline Creation Option */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Categoría</label>
                  {!isQuickInlineCat ? (
                    <button
                      type="button"
                      onClick={() => setIsQuickInlineCat(true)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Nueva</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsQuickInlineCat(false)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
                    >
                      Elegir de lista
                    </button>
                  )}
                </div>

                {isQuickInlineCat ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      autoFocus
                      value={quickInlineCatInput}
                      onChange={(e) => setQuickInlineCatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveQuickInlineCategory();
                        }
                      }}
                      placeholder="Nombre nueva categoría..."
                      className="flex-1 bg-white border border-indigo-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveQuickInlineCategory}
                      className="px-2 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs font-bold"
                      title="Guardar categoría"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsQuickInlineCat(false)}
                      className="px-2 py-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 text-xs"
                      title="Cancelar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <select
                    value={quickForm.category}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsQuickInlineCat(true);
                      } else {
                        setQuickForm({ ...quickForm, category: e.target.value });
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__NEW__">➕ Crear nueva categoría...</option>
                  </select>
                )}
              </div>

              {/* Pricing & Stock Grid */}
              <div className="grid grid-cols-3 gap-2 bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">P. Costo ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={quickForm.costPrice}
                    onChange={(e) => setQuickForm({ ...quickForm, costPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    P. Venta ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={quickForm.salePrice}
                    onChange={(e) => setQuickForm({ ...quickForm, salePrice: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Stock Inicial</label>
                  <input
                    type="number"
                    min="1"
                    value={quickForm.stock}
                    onChange={(e) => setQuickForm({ ...quickForm, stock: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="flex-1 py-2 rounded border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Guardar y Agregar</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* POS QUICK CATEGORY MODAL */}
      {showPosCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-lg p-5 shadow-xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Tags className="w-4 h-4 text-indigo-600" />
                <span>Nueva Categoría de Productos</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowPosCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePosCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre de la categoría
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={posNewCatName}
                  onChange={(e) => setPosNewCatName(e.target.value)}
                  placeholder="Ej: Bebidas con Alcohol, Cigarrillos..."
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPosCategoryModal(false)}
                  className="flex-1 py-1.5 rounded border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!posNewCatName.trim()}
                  className="flex-1 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
                >
                  Crear Categoría
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Floating Mobile Sticky Checkout Bar */}
      {cart.length > 0 && mobileView === 'catalog' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 text-white p-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div 
              onClick={() => setMobileView('ticket')}
              className="flex items-center gap-2.5 cursor-pointer min-w-0"
            >
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
                {cart.reduce((acc, item) => acc + item.quantity, 0)}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Ticket</div>
                <div className="text-base font-bold text-emerald-400 font-mono tracking-tight truncate">
                  {formatCurrency(cartTotal)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                id="mobile-pos-view-ticket-btn"
                onClick={() => setMobileView('ticket')}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ver Ticket</span>
              </button>
              <button
                type="button"
                id="mobile-pos-checkout-btn"
                onClick={() => {
                  setCashReceived(cartTotal);
                  setShowCheckoutModal(true);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <DollarSign className="w-4 h-4" />
                <span>Cobrar</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

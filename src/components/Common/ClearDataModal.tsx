import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  AlertTriangle, 
  RotateCcw, 
  PackageX, 
  History, 
  X, 
  Check, 
  Layers,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { useKiosk } from '../../context/KioskContext';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'ALL' | 'SALES' | 'PRODUCTS' | 'STOCK' | 'DEMO';
}

type ClearMode = 'ALL' | 'SALES' | 'PRODUCTS' | 'STOCK' | 'DEMO';

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'ALL',
}) => {
  const { 
    products, 
    sales, 
    clearAllData, 
    clearSalesHistory, 
    clearAllProducts, 
    resetInventoryStock, 
    resetData 
  } = useKiosk();

  const [selectedMode, setSelectedMode] = useState<ClearMode>(defaultMode);
  const [confirmStep, setConfirmStep] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Reset internal state every time the modal is (re)opened, so it never
  // opens "stuck" on the confirmation step from a previous use.
  useEffect(() => {
    if (isOpen) {
      setSelectedMode(defaultMode);
      setConfirmStep(false);
      setTypedConfirm('');
      setNotification(null);
    }
  }, [isOpen, defaultMode]);

  if (!isOpen) return null;

  const handleSelectMode = (mode: ClearMode) => {
    setSelectedMode(mode);
    setConfirmStep(false);
    setTypedConfirm('');
  };

  const handleExecute = () => {
    if (selectedMode === 'ALL') {
      clearAllData();
      setNotification('✅ Todos los datos han sido borrados. La aplicación está lista desde cero.');
    } else if (selectedMode === 'SALES') {
      clearSalesHistory();
      setNotification('✅ Historial de ventas eliminado con éxito.');
    } else if (selectedMode === 'PRODUCTS') {
      clearAllProducts();
      setNotification('✅ Catálogo de productos eliminado.');
    } else if (selectedMode === 'STOCK') {
      resetInventoryStock();
      setNotification('✅ Stock de todos los productos puesto en 0.');
    } else if (selectedMode === 'DEMO') {
      resetData();
      setNotification('✅ Datos de demostración y ejemplos restablecidos.');
    }

    setTimeout(() => {
      setNotification(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
              selectedMode === 'DEMO'
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
            }`}>
              {selectedMode === 'DEMO' ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide uppercase text-white">
                {selectedMode === 'DEMO' ? 'Datos de Demostración' : 'Borrar Datos del Sistema'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Seleccione qué información desea vaciar o reiniciar
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

        {/* Notification Feedback Toast */}
        {notification ? (
          <div className="p-8 text-center space-y-3 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">{notification}</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            
            {!confirmStep ? (
              <>
                <p className="text-xs text-slate-600">
                  Elija una de las siguientes opciones de limpieza:
                </p>

                <div className="space-y-2">
                  
                  {/* Option 1: BORRAR TODO (CERO TOTAL) */}
                  <div
                    onClick={() => handleSelectMode('ALL')}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      selectedMode === 'ALL'
                        ? 'border-rose-600 bg-rose-50/50 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="p-2 rounded-md bg-rose-100 text-rose-700 mt-0.5 shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          Vaciar Todo (Poner Sistema en Blanco)
                        </span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                          Recomendado para empezar
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Elimina todos los productos ({products.length}), todas las ventas ({sales.length}) e historial de caja. Deja el sistema 100% limpio listo para cargar tu negocio.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: BORRAR SOLO VENTAS */}
                  <div
                    onClick={() => handleSelectMode('SALES')}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      selectedMode === 'SALES'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="p-2 rounded-md bg-indigo-100 text-indigo-700 mt-0.5 shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          Borrar solo Historial de Ventas
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-semibold">
                          {sales.length} ventas
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Elimina los tickets y métricas de facturación acumuladas. <strong className="text-slate-700">Conserva intactos tus productos y precios</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Option 3: VACIAR STOCK A 0 */}
                  <div
                    onClick={() => handleSelectMode('STOCK')}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      selectedMode === 'STOCK'
                        ? 'border-amber-600 bg-amber-50/50 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="p-2 rounded-md bg-amber-100 text-amber-700 mt-0.5 shrink-0">
                      <PackageX className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          Poner Stock de Productos en 0
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-semibold">
                          {products.length} artículos
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Mantiene los nombres, códigos de barra y precios de tus productos, pero reinicia las cantidades a 0 para hacer un conteo inicial de mercadería.
                      </p>
                    </div>
                  </div>

                  {/* Option 4: BORRAR CATALOGO DE PRODUCTOS */}
                  <div
                    onClick={() => handleSelectMode('PRODUCTS')}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      selectedMode === 'PRODUCTS'
                        ? 'border-rose-600 bg-rose-50/50 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="p-2 rounded-md bg-slate-100 text-slate-700 mt-0.5 shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          Eliminar Catálogo de Productos
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-semibold">
                          {products.length} artículos
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Borra todos los artículos del inventario para cargar una lista de productos totalmente nueva.
                      </p>
                    </div>
                  </div>

                  {/* Option 5: RESTABLECER DEMO */}
                  <div
                    onClick={() => handleSelectMode('DEMO')}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      selectedMode === 'DEMO'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="p-2 rounded-md bg-emerald-100 text-emerald-700 mt-0.5 shrink-0">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">
                          Restaurar Datos de Demostración
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Ejemplos iniciales
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Carga los productos de prueba con precios en pesos argentinos y ventas de muestra para probar la aplicación.
                      </p>
                    </div>
                  </div>

                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmStep(true)}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>Continuar</span>
                  </button>
                </div>
              </>
            ) : (
              /* CONFIRMATION STEP */
              <div className="space-y-4 py-2 animate-in fade-in duration-150">
                <div className={`p-3.5 border rounded-lg flex items-start gap-3 ${
                  selectedMode === 'DEMO'
                    ? 'bg-emerald-50 border-emerald-200'
                    : selectedMode === 'STOCK'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-rose-50 border-rose-200'
                }`}>
                  {selectedMode === 'DEMO' ? (
                    <RotateCcw className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : selectedMode === 'STOCK' ? (
                    <PackageX className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className={`text-xs font-bold ${
                      selectedMode === 'DEMO' ? 'text-emerald-900' : selectedMode === 'STOCK' ? 'text-amber-900' : 'text-rose-900'
                    }`}>
                      {selectedMode === 'DEMO'
                        ? '¿Confirmar carga de datos de muestra?'
                        : selectedMode === 'STOCK'
                        ? '¿Confirmar reinicio de stock a 0?'
                        : '¿Confirmar borrado de datos?'}
                    </h4>
                    <p className={`text-xs mt-0.5 ${
                      selectedMode === 'DEMO' ? 'text-emerald-700' : selectedMode === 'STOCK' ? 'text-amber-700' : 'text-rose-700'
                    }`}>
                      {selectedMode === 'ALL' && 'Se vaciará la base de datos por completo (productos, ventas y caja). Esta acción no se puede deshacer.'}
                      {selectedMode === 'SALES' && `Se eliminarán permanentemente las ${sales.length} ventas del registro.`}
                      {selectedMode === 'PRODUCTS' && `Se borrarán los ${products.length} productos del catálogo.`}
                      {selectedMode === 'STOCK' && `Se pondrán en 0 las cantidades de los ${products.length} productos. Los nombres, precios y códigos se conservan.`}
                      {selectedMode === 'DEMO' && 'Se reemplazarán los datos actuales por los productos y ventas de demostración. Esta acción no se puede deshacer.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmStep(false)}
                    className="flex-1 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={handleExecute}
                    className={`flex-1 py-2.5 rounded-lg text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      selectedMode === 'DEMO'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : selectedMode === 'STOCK'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {selectedMode === 'DEMO' ? (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Sí, Cargar Datos de Muestra</span>
                      </>
                    ) : selectedMode === 'STOCK' ? (
                      <>
                        <PackageX className="w-4 h-4" />
                        <span>Sí, Poner Stock en 0</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Sí, Borrar Definitivamente</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

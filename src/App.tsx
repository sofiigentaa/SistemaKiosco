import React, { useEffect, useState } from "react";
import { KioskProvider, useKiosk } from "./context/KioskContext";
import { Header } from "./components/Header";
import { PosScreen } from "./components/POS/PosScreen";
import { InventoryScreen } from "./components/Inventory/InventoryScreen";
import { AlertsScreen } from "./components/Alerts/AlertsScreen";
import { SalesHistoryScreen } from "./components/Sales/SalesHistoryScreen";
import { ReportsScreen } from "./components/Reports/ReportsScreen";
import { CashRegisterModal } from "./components/CashRegister/CashRegisterModal";
import { ClearDataModal } from "./components/Common/ClearDataModal";
import { RotateCcw, Trash2, LogOut, AlertTriangle } from "lucide-react";
import { signOut } from "./lib/supabase";
import { CalandriaProvider } from "./calandria/CalandriaContext";
import { CalandriaPanel, CalandriaLogModal, CalandriaResultModal, CalandriaToast } from "./calandria/CalandriaUI";
import { CalandriaHome, ResumenSeccion } from "./calandria/CalandriaHome";
import { formatCurrency } from "./utils/formatters";
import { BRAND } from "./config/brand";
import { AsistenteKiosco } from "./asistente/AsistenteKiosco";

const KioskAppContent: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    resetData, 
    cloudEnabled,
    cloudSyncStatus,
    cloudError,
    lastSyncTime,
  } = useKiosk();

  const kiosk = useKiosk();
  // Filtro con el que se abre el historial cuando se llega desde el informe de la G.
  const [salesFilter, setSalesFilter] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (kiosk.activeTab !== 'sales') setSalesFilter(undefined);
  }, [kiosk.activeTab]);
  const abrir = (tab: 'sales' | 'alerts' | 'inventory' | 'reports', filtro?: string) => () => {
    setSalesFilter(filtro);
    setVista('sistema');
    kiosk.setActiveTab(tab);
  };
  // Pantalla principal: la G de Golondrina. "Abrir sistema" muestra el sistema completo.
  const [vista, setVistaState] = useState<'calandria' | 'sistema'>(() => {
    try {
      return localStorage.getItem('calandria_vista') === 'sistema' ? 'sistema' : 'calandria';
    } catch {
      return 'calandria';
    }
  });
  const setVista = (v: 'calandria' | 'sistema') => {
    setVistaState(v);
    try {
      localStorage.setItem('calandria_vista', v);
    } catch {
      // sin almacenamiento: queda solo en memoria
    }
    window.scrollTo(0, 0);
  };

  // Resumen del día para Compartir / Imprimir.
  const resumen = (): ResumenSeccion[] => {
    const k = kiosk;
    const out: ResumenSeccion[] = [
      {
        titulo: 'Ventas de hoy',
        lineas: [
          `${k.todaySalesCount} ${k.todaySalesCount === 1 ? 'venta' : 'ventas'} por ${formatCurrency(k.todaySalesTotal)}`,
          `Ganancia: ${formatCurrency(k.todayProfitTotal)}`,
        ],
        ver: abrir('sales', 'HOY'),
      },
    ];
    const sh = k.currentShift;
    if (sh && sh.isOpen) {
      const desde = new Date(sh.openedAt).getTime();
      const efectivo = k.sales
        .filter((x) => x.status === 'completada' && x.paymentMethod === 'Efectivo' && new Date(x.date).getTime() >= desde)
        .reduce((a, x) => a + x.total, 0);
      const fiadosCobrados = k.sales
        .filter((x) => x.fiadoPaidMethod === 'Efectivo' && x.fiadoPaidAt && new Date(x.fiadoPaidAt).getTime() >= desde)
        .reduce((a, x) => a + x.total, 0);
      out.push({
        titulo: 'Caja',
        lineas: [`Tendría que haber ${formatCurrency(sh.initialCash + efectivo + fiadosCobrados)} en el cajón`],
        ver: () => {
          setVista('sistema');
          setShowCashModal(true);
        },
      });
    }
    const reponer = [...k.outOfStockProducts, ...k.lowStockProducts];
    out.push({
      titulo: 'Para reponer',
      lineas: reponer.length ? reponer.slice(0, 10).map((p) => `${p.name}: quedan ${Math.max(p.stock, 0)}`) : ['Nada: todo bien de stock'],
      pendientes: reponer.length,
      ver: abrir('alerts'),
    });
    const vencen = [...k.expiredProducts, ...k.expiringProducts];
    if (vencen.length) out.push({ titulo: 'Vencidos o por vencer', lineas: vencen.slice(0, 10).map((p) => p.name), pendientes: vencen.length, ver: abrir('alerts') });
    const fiados = k.sales.filter((x) => x.status === 'completada' && x.paymentMethod === 'Cuenta Corriente (Fiado)' && !x.fiadoPaidAt);
    if (fiados.length)
      out.push({
        titulo: 'Fiados sin cobrar',
        lineas: [`${formatCurrency(fiados.reduce((a, x) => a + x.total, 0))} en ${fiados.length} ${fiados.length === 1 ? 'venta' : 'ventas'}`],
        ver: abrir('sales', 'FIADO_PENDIENTE'),
      });
    return out;
  };

  const [showCashModal, setShowCashModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  if (vista === 'calandria') {
    return (
      <>
        <CalandriaHome negocio={`${BRAND.first} ${BRAND.second}`} resumen={resumen} onOpenSystem={() => setVista('sistema')} />
        <AsistenteKiosco onOpenCash={() => setShowCashModal(true)} antesDeAccion={() => setVista('sistema')} posicion="bottom-5 right-4 sm:right-6" />
        <CalandriaPanel />
        <CalandriaLogModal />
        <CalandriaResultModal />
        <CalandriaToast />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      
      {/* Top Bar Header */}
      <Header 
        onOpenCashModal={() => setShowCashModal(true)} 
        onGoHome={() => setVista('calandria')}
      />

      {/* Aviso de sincronización (antes los errores con la nube no se mostraban) */}
      {cloudEnabled && cloudError && (
        <div role="alert" className="max-w-7xl mx-auto w-full px-4 sm:px-6 mt-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{cloudError} Las ventas se guardan en este equipo y se reintenta solo.</span>
          </div>
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1 pb-8">
        {activeTab === "pos" && (
          <PosScreen onSaleCompleted={() => {}} />
        )}
        {activeTab === "inventory" && (
          <InventoryScreen />
        )}
        {activeTab === "alerts" && (
          <AlertsScreen 
            onGoToInventory={() => setActiveTab("inventory")}
            onGoToPOS={() => setActiveTab("pos")}
          />
        )}
        {activeTab === "sales" && (
          <SalesHistoryScreen key={salesFilter || 'todas'} initialMethod={salesFilter} />
        )}
        {activeTab === "reports" && (
          <ReportsScreen onGoToInventory={() => setActiveTab("inventory")} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cloudEnabled ? (cloudSyncStatus === 'error' ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-400'}`}></span>
            <span>una solución de <a href="https://tecnoros-ar.onrender.com" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-700 hover:text-cyan-700">tecnoros.ar</a></span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              {cloudEnabled
                ? cloudSyncStatus === 'error'
                  ? 'Sin conexión con la nube: se reintenta solo'
                  : `En la nube, sincronizado entre equipos${lastSyncTime ? ` (${lastSyncTime})` : ''}`
                : 'Modo local: los datos quedan en este navegador'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              id="footer-clear-data-btn"
              onClick={() => setShowClearModal(true)}
              className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Borrar o reiniciar base de datos"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Borrar Datos</span>
            </button>

            {/* Datos de ejemplo: solo en modo local (demo), nunca en el kiosco de un cliente */}
            {!cloudEnabled && (
              <button
                onClick={() => setShowResetConfirmModal(true)}
                className="text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                title="Restablecer base de datos a ejemplos"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer Demo</span>
              </button>
            )}

            {cloudEnabled && (
              <button
                onClick={() => signOut()}
                className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar sesión</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Golondrina */}
      <CalandriaPanel />
      <CalandriaLogModal />
      <CalandriaResultModal />
      <CalandriaToast />
      <AsistenteKiosco onOpenCash={() => setShowCashModal(true)} />

      {/* MODALS */}
      <CashRegisterModal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
      />


      <ClearDataModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
      />

      {/* Reset Demo Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-lg p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">¿Restablecer datos de prueba?</h4>
                <p className="text-xs text-slate-500">Se recargarán los productos y ventas de ejemplo.</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="flex-1 py-2 rounded border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  resetData();
                  setShowResetConfirmModal(false);
                }}
                className="flex-1 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Sí, Restablecer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const App: React.FC<{ userId?: string }> = ({ userId }) => {
  return (
    <KioskProvider userId={userId}>
      <CalandriaProvider userId={userId} brandName={`${BRAND.first} ${BRAND.second}`}>
        <KioskAppContent />
      </CalandriaProvider>
    </KioskProvider>
  );
};

export default App;

import React, { useState } from "react";
import { KioskProvider, useKiosk } from "./context/KioskContext";
import { Header } from "./components/Header";
import { PosScreen } from "./components/POS/PosScreen";
import { InventoryScreen } from "./components/Inventory/InventoryScreen";
import { AlertsScreen } from "./components/Alerts/AlertsScreen";
import { SalesHistoryScreen } from "./components/Sales/SalesHistoryScreen";
import { ReportsScreen } from "./components/Reports/ReportsScreen";
import { CashRegisterModal } from "./components/CashRegister/CashRegisterModal";
import { SupabaseSyncModal } from "./components/Common/SupabaseSyncModal";
import { ClearDataModal } from "./components/Common/ClearDataModal";
import { RotateCcw, Cloud, CloudOff, Trash2 } from "lucide-react";

const KioskAppContent: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    resetData, 
    cloudEnabled,
    cloudSyncStatus,
    lastSyncTime,
    manualSync
  } = useKiosk();

  const [showCashModal, setShowCashModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      
      {/* Top Bar Header */}
      <Header 
        onOpenCashModal={() => setShowCashModal(true)} 
        onOpenSyncModal={() => setShowSyncModal(true)}
        onOpenClearModal={() => setShowClearModal(true)}
      />

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
          <SalesHistoryScreen />
        )}
        {activeTab === "reports" && (
          <ReportsScreen onGoToInventory={() => setActiveTab("inventory")} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cloudEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span className="font-semibold text-slate-700">KioscoManager Pro</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">
              {cloudEnabled
                ? `Sincronizado con Supabase${lastSyncTime ? ` (última: ${lastSyncTime})` : ''}`
                : 'Terminal Local (Toca Conectar Nube para compartir entre dispositivos)'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSyncModal(true)}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              {cloudEnabled ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
              <span>{cloudEnabled ? 'Estado de la nube' : 'Conectar Nube (Supabase)'}</span>
            </button>

            <button
              id="footer-clear-data-btn"
              onClick={() => setShowClearModal(true)}
              className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Borrar o reiniciar base de datos"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Borrar Datos</span>
            </button>

            <button
              onClick={() => setShowResetConfirmModal(true)}
              className="text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              title="Restablecer base de datos a ejemplos"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer Demo</span>
            </button>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      <CashRegisterModal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
      />

      <SupabaseSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        syncStatus={cloudSyncStatus}
        lastSyncTime={lastSyncTime}
        onManualSync={manualSync}
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

export default function App() {
  return (
    <KioskProvider>
      <KioskAppContent />
    </KioskProvider>
  );
}

import React, { useState, useEffect } from "react";
import { 
  ShoppingCart, 
  Package, 
  AlertTriangle, 
  BarChart3, 
  History, 
  Wallet, 
  Search,
  Plus,
  Cloud,
  CloudOff,
  Trash2
} from "lucide-react";
import { useKiosk } from "../context/KioskContext";
import { formatCurrency } from "../utils/formatters";

interface HeaderProps {
  onOpenCashModal: () => void;
  onOpenQuickSaleModal?: () => void;
  onOpenSyncModal?: () => void;
  onOpenClearModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCashModal, onOpenClearModal }) => {
  const { 
    activeTab, 
    setActiveTab, 
    totalAlertsCount, 
    todaySalesTotal, 
    todaySalesCount, 
    currentShift,
    searchFilter,
    setSearchFilter,
    cloudEnabled,
    cloudSyncStatus,
  } = useKiosk();

  const [time, setTime] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDateStr(now.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", year: "numeric" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  interface NavItem {
    id: "pos" | "inventory" | "alerts" | "sales" | "reports";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | null;
    badgeColor?: string;
  }

  const navItems: NavItem[] = [
    { id: "pos", label: "Venta (POS)", icon: ShoppingCart },
    { id: "inventory", label: "Inventario", icon: Package },
    { 
      id: "alerts", 
      label: "Alertas", 
      icon: AlertTriangle, 
      badge: totalAlertsCount > 0 ? totalAlertsCount : null,
      badgeColor: "bg-orange-500 text-white"
    },
    { id: "sales", label: "Historial Ventas", icon: History },
    { id: "reports", label: "Márgenes & Reportes", icon: BarChart3 },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-xs">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-3">
          
          {/* Brand & Store Name */}
          <div className="flex items-center gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  <span>Granja y Kiosco</span>
                  <span className="text-emerald-400 font-semibold">Don Ramón</span>
                </span>

                {/* Supabase Cloud Sync Indicator (informational only, no click action) */}
                <span
                  className={`px-2 py-0.5 border text-[10px] font-bold rounded-full uppercase flex items-center gap-1 select-none ${
                    cloudEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  }`}
                  title={cloudEnabled ? `Sincronizado con Supabase (${cloudSyncStatus === 'syncing' ? 'sincronizando…' : 'al día'})` : 'Sincronización en la nube desactivada'}
                >
                  {cloudEnabled ? (
                    <Cloud className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <CloudOff className="w-3 h-3 text-amber-400" />
                  )}
                  <span>
                    {cloudEnabled
                      ? cloudSyncStatus === 'syncing'
                        ? 'Sincronizando…'
                        : 'En la nube'
                      : 'Sin conectar'}
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5 capitalize">
                <span>{dateStr || "Hoy"}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-slate-300">{time || "--:--:--"}</span>
              </p>
            </div>
          </div>

          {/* Quick Global Search Bar */}
          <div className="flex-1 max-w-sm mx-2">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar producto, código de barras..."
                className="w-full bg-slate-800/80 border border-slate-700 text-xs rounded-lg pl-8 pr-8 py-1.5 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-slate-800 transition-colors"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center gap-2">
            {/* Sales of Day summary */}
            <div className="hidden lg:flex items-center gap-2 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Ventas Hoy ({todaySalesCount})</div>
                <div className="text-xs font-bold text-indigo-300 font-mono">
                  {formatCurrency(todaySalesTotal)}
                </div>
              </div>
            </div>

            {/* Quick POS Trigger button */}
            <button
              id="header-new-sale-btn"
              onClick={() => {
                setActiveTab("pos");
                setTimeout(() => {
                  const input = document.getElementById("pos-barcode-input") as HTMLInputElement | null;
                  if (input) {
                    input.focus();
                    input.select();
                  }
                }, 50);
              }}
              className={"flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 " + (
                activeTab === "pos"
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white ring-2 ring-indigo-400/40"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              )}
              title="Iniciar cobro rápido"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nueva Venta</span>
              <span className="sm:hidden">Venta</span>
            </button>

            {/* Arqueo de Caja Shift Button */}
            <button
              id="header-cash-shift-btn"
              onClick={onOpenCashModal}
              className={"flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded text-xs font-bold transition-all border shadow-xs shrink-0 " + (
                currentShift?.isOpen
                  ? "bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700 ring-1 ring-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
              )}
              title="Abrir o cerrar turno, contar dinero físico y emitir comprobante de arqueo"
            >
              <Wallet className={"w-3.5 h-3.5 " + (currentShift?.isOpen ? "text-emerald-400" : "text-amber-400")} />
              <span className="hidden sm:inline">
                {currentShift?.isOpen ? "Arqueo de Caja" : "Abrir Caja"}
              </span>
              <span className="sm:hidden">
                {currentShift?.isOpen ? "Caja" : "Abrir"}
              </span>
            </button>

            {/* Borrar Datos Button */}
            {onOpenClearModal && (
              <button
                id="header-clear-data-btn"
                onClick={onOpenClearModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold transition-all border border-slate-700 bg-slate-800 hover:bg-rose-900/40 hover:border-rose-700/50 text-slate-300 hover:text-rose-300 shadow-xs cursor-pointer shrink-0"
                title="Borrar o reiniciar datos (ventas, stock, productos o todo)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden md:inline">Borrar Datos</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 border-t border-slate-800 pt-1 pb-1.5 overflow-x-auto scrollbar-thin touch-scroll">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={"nav-tab-" + item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={"flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 relative " + (
                  isActive
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <Icon className={"w-3.5 h-3.5 " + (isActive ? "text-white" : "text-slate-400")} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge !== null && (
                  <span className={"ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold " + (
                    isActive ? "bg-slate-900 text-indigo-300" : item.badgeColor
                  )}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

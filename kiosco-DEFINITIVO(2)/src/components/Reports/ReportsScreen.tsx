import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Calendar, 
  Layers, 
  Package, 
  Award,
  Printer,
  CalendarDays,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { useKiosk } from '../../context/KioskContext';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { PrintReportModal } from './PrintReportModal';

interface ReportsScreenProps {
  onGoToInventory: () => void;
}

const CATEGORY_COLORS = [
  '#4f46e5', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#f97316', // orange
  '#ec4899', // pink
  '#64748b', // slate
];

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ onGoToInventory }) => {
  const { sales, products } = useKiosk();
  const [timeRange, setTimeRange] = useState<'DAY' | 'WEEK' | 'MONTH' | 'ALL'>('DAY');
  const [showPrintModal, setShowPrintModal] = useState(false);

  const timeRangeLabel = useMemo(() => {
    switch (timeRange) {
      case 'DAY': return 'Por Día (Hoy)';
      case 'WEEK': return 'Por Semana (Últimos 7 días)';
      case 'MONTH': return 'Por Mes (Últimos 30 días)';
      case 'ALL': return 'Historial Completo';
      default: return 'Período';
    }
  }, [timeRange]);

  const filteredSales = useMemo(() => {
    const validSales = sales.filter((s) => s.status === 'completada');
    if (timeRange === 'ALL') return validSales;

    const now = new Date();
    if (timeRange === 'DAY') {
      const todayStr = now.toISOString().split('T')[0];
      return validSales.filter((s) => s.date.startsWith(todayStr));
    }
    if (timeRange === 'WEEK') {
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return validSales.filter((s) => new Date(s.date) >= cutoff);
    }
    if (timeRange === 'MONTH') {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return validSales.filter((s) => new Date(s.date) >= cutoff);
    }
    return validSales;
  }, [sales, timeRange]);

  const totalRevenue = useMemo(() => filteredSales.reduce((acc, s) => acc + s.total, 0), [filteredSales]);
  const totalCost = useMemo(() => filteredSales.reduce((acc, s) => acc + s.totalCost, 0), [filteredSales]);
  const totalProfit = useMemo(() => filteredSales.reduce((acc, s) => acc + s.totalProfit, 0), [filteredSales]);
  const grossMarginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const markupPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  const averageTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  const timelineData = useMemo(() => {
    if (timeRange === 'DAY') {
      // Group by hours for the day view
      const map = new Map<number, { hourKey: number; displayDate: string; ventas: number; ganancia: number; costo: number; tickets: number }>();
      
      // Initialize hours 8 to 23
      for (let h = 8; h <= 23; h++) {
        map.set(h, {
          hourKey: h,
          displayDate: `${h}:00 hs`,
          ventas: 0,
          ganancia: 0,
          costo: 0,
          tickets: 0,
        });
      }

      filteredSales.forEach((s) => {
        const hour = new Date(s.date).getHours();
        const existing = map.get(hour) || {
          hourKey: hour,
          displayDate: `${hour}:00 hs`,
          ventas: 0,
          ganancia: 0,
          costo: 0,
          tickets: 0,
        };
        existing.ventas += s.total;
        existing.ganancia += s.totalProfit;
        existing.costo += s.totalCost;
        existing.tickets += 1;
        map.set(hour, existing);
      });

      return Array.from(map.values()).sort((a, b) => a.hourKey - b.hourKey);
    }

    const map = new Map<string, { date: string; displayDate: string; ventas: number; ganancia: number; costo: number; tickets: number }>();

    filteredSales.forEach((s) => {
      const dayKey = s.date.split('T')[0];
      const existing = map.get(dayKey) || {
        date: dayKey,
        displayDate: new Date(dayKey + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
        ventas: 0,
        ganancia: 0,
        costo: 0,
        tickets: 0,
      };

      existing.ventas += s.total;
      existing.ganancia += s.totalProfit;
      existing.costo += s.totalCost;
      existing.tickets += 1;

      map.set(dayKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales, timeRange]);

  const topProducts = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        name: string;
        category: string;
        unitsSold: number;
        revenue: number;
        profit: number;
        currentStock: number;
        minStock: number;
      }
    >();

    filteredSales.forEach((s) => {
      s.items.forEach((item) => {
        const prodInStock = products.find((p) => p.id === item.productId);
        const existing = map.get(item.productId) || {
          productId: item.productId,
          name: item.productName,
          category: item.category,
          unitsSold: 0,
          revenue: 0,
          profit: 0,
          currentStock: prodInStock ? prodInStock.stock : 0,
          minStock: prodInStock ? prodInStock.minStock : 5,
        };

        existing.unitsSold += item.quantity;
        existing.revenue += item.total;
        existing.profit += item.profit;

        map.set(item.productId, existing);
      });
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);

    return list.slice(0, 10);
  }, [filteredSales, products]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    filteredSales.forEach((s) => {
      s.items.forEach((it) => {
        const cat = it.category.split('&')[0].trim();
        const existing = map.get(cat) || { name: cat, value: 0, count: 0 };
        existing.value += it.total;
        existing.count += it.quantity;
        map.set(cat, existing);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3.5">
      
      {/* Header & Period Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>Márgenes & Reportes de Ventas</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Analice ganancias reales, recaudación por día, semana o mes, y productos más rentables.
          </p>
        </div>

        {/* Actions and Time Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="reports-print-btn"
            onClick={() => setShowPrintModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Abrir vista previa de impresión y guardar reporte en PDF"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Imprimir Reporte</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {[
              { id: 'DAY', label: 'Por Día' },
              { id: 'WEEK', label: 'Por Semana' },
              { id: 'MONTH', label: 'Por Mes' },
              { id: 'ALL', label: 'Todo' },
            ].map((t) => (
              <button
                key={t.id}
                id={`report-filter-${t.id.toLowerCase()}`}
                onClick={() => setTimeRange(t.id as any)}
                className={'px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ' + (
                  timeRange === t.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facturación Total</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{formatCurrency(totalRevenue)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{filteredSales.length} ventas registradas</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ganancia Neta Total</div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">{formatCurrency(totalProfit)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Margen: {formatPercent(grossMarginPercent)}
          </div>
        </div>

      </div>

      {/* Chart Section: Revenue & Profit Timeline */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Evolución de Ventas y Ganancias por Día
            </h3>
            <p className="text-[11px] text-slate-500">Comparativa de facturación bruta vs ganancia de bolsillo</p>
          </div>
        </div>

        <div className="h-64 w-full">
          {timelineData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              No hay suficientes datos en este rango para graficar.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => '$' + (v >= 1000 ? v / 1000 + 'k' : v)} />
                <Tooltip 
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '6px', color: '#fff', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area type="monotone" dataKey="ventas" name="Ventas Brutas" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorVentas)" />
                <Area type="monotone" dataKey="ganancia" name="Ganancia Neta" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorGanancia)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Two Column Grid: Top Selling Products & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        
        {/* TOP 10 BESTSELLERS (7 cols) */}
        <div className="lg:col-span-7 bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Productos Más Vendidos (Ranking)</span>
              </h3>
              <p className="text-[11px] text-slate-500">Para saber qué artículos reponer con mayor prioridad</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Top 10</span>
          </div>

          {/* Ranking Table */}
          <div className="divide-y divide-slate-100 text-xs">
            {topProducts.length === 0 ? (
              <div className="text-center py-8 text-slate-400">Sin datos de ventas en este período.</div>
            ) : (
              topProducts.map((p, idx) => (
                <div key={p.productId} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={'w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ' + (
                      idx === 0 ? 'bg-indigo-600 text-white' :
                      idx === 1 ? 'bg-slate-700 text-white' :
                      idx === 2 ? 'bg-slate-500 text-white' :
                      'bg-slate-100 text-slate-600'
                    )}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h5 className="font-bold text-slate-800 text-xs truncate">{p.name}</h5>
                      <span className="text-[10px] text-slate-400">{p.category.split('&')[0]}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div>
                      <div className="font-bold font-mono text-slate-900 text-xs">
                        {p.unitsSold} u. ({formatCurrency(p.revenue)})
                      </div>
                      <div className="text-[10px] text-emerald-600 font-mono font-medium">
                        +{formatCurrency(p.profit)} ganancia
                      </div>
                    </div>

                    {/* Stock Alert Badge */}
                    <div className="min-w-[65px] text-right">
                      {p.currentStock <= p.minStock ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-800 uppercase">
                          Reponer ({p.currentStock})
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 uppercase">
                          Stock {p.currentStock}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CATEGORY DISTRIBUTION (5 cols) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ventas por Categoría</span>
            </h3>
            <p className="text-[11px] text-slate-500">Distribución de ingresos según rubro</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            {categoryStats.length === 0 ? (
              <div className="text-slate-400 text-xs">Sin datos registrados.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryStats.map((entry, index) => (
                      <Cell key={'cell-' + index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Facturación']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '6px', color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Compact Legend List */}
          <div className="space-y-1 max-h-36 overflow-y-auto text-xs font-mono">
            {categoryStats.map((cat, i) => (
              <div key={cat.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 truncate">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}></div>
                  <span className="truncate text-slate-700">{cat.name}</span>
                </div>
                <span className="font-bold text-slate-900">{formatCurrency(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Print Report Preview & Export Modal */}
      {showPrintModal && (
        <PrintReportModal
          timeRangeLabel={timeRangeLabel}
          sales={filteredSales}
          products={products}
          totalRevenue={totalRevenue}
          totalCost={totalCost}
          totalProfit={totalProfit}
          grossMarginPercent={grossMarginPercent}
          markupPercent={markupPercent}
          averageTicket={averageTicket}
          topProducts={topProducts}
          categoryStats={categoryStats}
          onClose={() => setShowPrintModal(false)}
        />
      )}

    </div>
  );
};

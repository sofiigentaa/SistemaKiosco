import React, { useState } from 'react';
import { Cloud, Check, RefreshCw, Key, Database, Smartphone, ShieldCheck, AlertCircle, Trash2 } from 'lucide-react';
import { 
  supabaseUrl, 
  supabaseAnonKey, 
  isSupabaseConfigured, 
  saveSupabaseConfig, 
  clearSupabaseConfig 
} from '../../lib/supabase';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus?: 'synced' | 'syncing' | 'local' | 'error';
  lastSyncTime?: string | null;
  onManualSync?: () => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus = 'local',
  lastSyncTime,
  onManualSync,
}) => {
  const [url, setUrl] = useState(supabaseUrl);
  const [key, setKey] = useState(supabaseAnonKey);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !key) return;
    saveSupabaseConfig(url, key);
  };

  const sqlQuickScript = `-- EJECUTA ESTO EN SUPABASE > SQL EDITOR:
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'u',
  expiration_date TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  total NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  total_profit NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  amount_paid NUMERIC,
  change_amount NUMERIC DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completada',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_shifts (
  id TEXT PRIMARY KEY,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  initial_cash NUMERIC NOT NULL DEFAULT 0,
  final_cash_calculated NUMERIC,
  final_cash_real NUMERIC,
  is_open BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar lectura/escritura pública instantánea:
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo a anon" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon" ON cash_shifts FOR ALL USING (true) WITH CHECK (true);
`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlQuickScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform animate-in fade-in zoom-in duration-150 my-auto">
        
        {/* Header */}
        <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-400">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Sincronización en la Nube (Múltiples Celulares)</h3>
              <p className="text-[10px] text-slate-400">Conexión en tiempo real para compartir stock y ventas</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-xs transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-5 max-h-[75vh] overflow-y-auto space-y-4">
          
          {/* Status banner */}
          <div className={`p-3.5 rounded-lg border flex items-center justify-between text-xs ${
            isSupabaseConfigured
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-center gap-2">
              {isSupabaseConfigured ? (
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div>
                <span className="font-bold">
                  {isSupabaseConfigured ? 'Conectado a Supabase (En la Nube)' : 'Modo Offline / Local'}
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {isSupabaseConfigured 
                    ? `Todos los celulares ven el mismo stock y ventas al instante. ${lastSyncTime ? `(Última sincro: ${lastSyncTime})` : ''}`
                    : 'Actualmente los datos solo se guardan en este dispositivo.'}
                </p>
              </div>
            </div>

            {isSupabaseConfigured && onManualSync && (
              <button
                type="button"
                onClick={onManualSync}
                className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs flex items-center gap-1 shadow-2xs"
                title="Forzar sincronización ahora"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sincronizar</span>
              </button>
            )}
          </div>

          {/* Quick instructions */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2 text-xs text-slate-700">
            <div className="font-bold flex items-center gap-1.5 text-slate-900">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              <span>¿Cómo ver lo mismo en todos los celulares? (En 2 minutos)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
              <li>Crea una cuenta gratis en <strong>supabase.com</strong> y crea un nuevo proyecto.</li>
              <li>En el menú lateral entra en <strong>SQL Editor</strong>, pega el código rápido de abajo y dale a <strong>Run</strong>.</li>
              <li>Ve a <strong>Project Settings &gt; API</strong> y copia la <strong>URL</strong> y la clave <strong>anon / public key</strong>.</li>
              <li>Pégalas en el formulario de abajo y dale a <strong>Guardar y Conectar</strong>. ¡Listo!</li>
            </ol>
            
            <button
              type="button"
              onClick={copySql}
              className="w-full py-1.5 px-3 rounded bg-slate-900 hover:bg-slate-800 text-white font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Database className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Script SQL Copiado al portapapeles!' : 'Copiar Script SQL para Supabase'}</span>
            </button>
          </div>

          {/* Form to enter keys */}
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Project URL de Supabase:
              </label>
              <input
                type="text"
                required
                placeholder="https://tu-proyecto.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                API Key (anon / public):
              </label>
              <input
                type="password"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              {isSupabaseConfigured && (
                <button
                  type="button"
                  onClick={clearSupabaseConfig}
                  className="px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Guardar y Sincronizar en la Nube</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};

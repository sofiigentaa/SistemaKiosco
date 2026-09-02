import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Smartphone, 
  Copy, 
  Check, 
  RefreshCw, 
  QrCode, 
  KeyRound, 
  Zap, 
  Share2, 
  Layers, 
  ShieldCheck, 
  CheckCircle2, 
  Trash2,
  Send
} from 'lucide-react';
import { useKiosk } from '../../context/KioskContext';
import { generateRandomPin } from '../../lib/cloudSync';

interface SyncPinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncPinModal: React.FC<SyncPinModalProps> = ({ isOpen, onClose }) => {
  const {
    kioskPin,
    setKioskPinCode,
    cloudSyncStatus,
    lastSyncTime,
    broadcastFullSync,
    products,
    sales
  } = useKiosk();

  const [inputPin, setInputPin] = useState(kioskPin || '');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState(false);

  if (!isOpen) return null;

  // Build the shareable link with ?pin=
  const shareableUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?pin=${encodeURIComponent(kioskPin || inputPin)}`
    : '';

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPin.trim()) return;
    setKioskPinCode(inputPin.trim().toUpperCase());
  };

  const handleGenerateNew = () => {
    const random = generateRandomPin();
    setInputPin(random);
    setKioskPinCode(random);
  };

  const handleCopyLink = () => {
    if (!shareableUrl) return;
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyPin = () => {
    if (!kioskPin) return;
    navigator.clipboard.writeText(kioskPin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleForceBroadcast = () => {
    broadcastFullSync();
    setBroadcastDone(true);
    setTimeout(() => setBroadcastDone(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform animate-in fade-in zoom-in duration-150 my-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-white">Sincronización Flash (Múltiples Celulares)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Sin Cuentas
                </span>
              </div>
              <p className="text-xs text-slate-400">Comparte stock y ventas al instante mediante un PIN o QR</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[80vh] overflow-y-auto space-y-5">
          
          {/* Status Badge */}
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            kioskPin
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/80 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-3.5 h-3.5 rounded-full ${kioskPin ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {kioskPin && <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />}
              </div>
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>{kioskPin ? `Conectado al Kiosco "${kioskPin}"` : 'Modo Solo en este Dispositivo'}</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {kioskPin 
                    ? `Todos los celulares con el PIN "${kioskPin}" están sincronizados en vivo. ${lastSyncTime ? `(Última señal: ${lastSyncTime})` : ''}`
                    : 'Ingresa o genera un código para conectar otro teléfono en 5 segundos.'}
                </p>
              </div>
            </div>

            {kioskPin && (
              <button
                type="button"
                onClick={handleForceBroadcast}
                className={`px-3 py-1.5 rounded-lg border font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-2xs ${
                  broadcastDone
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                }`}
                title="Re-transmitir inventario completo a los demás celulares"
              >
                {broadcastDone ? <Check className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />}
                <span>{broadcastDone ? '¡Transmitido!' : 'Sincronizar'}</span>
              </button>
            )}
          </div>

          {/* MAIN PIN & QR SECTION */}
          {kioskPin ? (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
              <div className="text-center space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Tu Código de Kiosco Compartido
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black font-mono tracking-widest text-indigo-950 bg-white px-4 py-1.5 rounded-lg border border-indigo-200 shadow-2xs">
                    {kioskPin}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1 shadow-2xs"
                    title="Copiar código PIN"
                  >
                    {copiedPin ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs shrink-0">
                  <QRCodeSVG 
                    value={shareableUrl} 
                    size={130}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="space-y-2 max-w-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 justify-center sm:justify-start">
                    <QrCode className="w-4 h-4 text-indigo-600" />
                    <span>Escanear con otro celular</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Abre la cámara de otro celular y escanea este código. Se abrirá el kiosco automáticamente conectado al mismo inventario.
                  </p>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar Enlace para WhatsApp'}</span>
                  </button>
                </div>
              </div>

              {/* Stats info */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Productos Sincronizados</div>
                  <div className="font-bold text-slate-800 text-sm font-mono">{products.length}</div>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Ventas Compartidas</div>
                  <div className="font-bold text-slate-800 text-sm font-mono">{sales.length}</div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Form to enter or generate PIN */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                <span>{kioskPin ? 'Cambiar o Unirse a otro Código de Kiosco:' : 'Crear o Ingresar Código de Kiosco:'}</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateNew}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
              >
                Generar Código Automático
              </button>
            </div>

            <form onSubmit={handleSavePin} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Ej: KIOSCO-CENTRAL o 1234"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value.toUpperCase())}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Conectar</span>
              </button>
            </form>

            {kioskPin && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setKioskPinCode('');
                    setInputPin('');
                  }}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Desconectar este teléfono</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Explanation */}
          <div className="text-[11px] text-slate-500 space-y-1.5 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
            <div className="font-bold text-indigo-950 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>¿Cómo funciona?</span>
            </div>
            <p>
              Todos los celulares que tengan el mismo <strong>Código de Kiosco</strong> se conectan entre sí en tiempo real. Si vendes un alfajor o agregas un producto en el Celular 1, el Celular 2 se actualiza automáticamente en menos de 1 segundo.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

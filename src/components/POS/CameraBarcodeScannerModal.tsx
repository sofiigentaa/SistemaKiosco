import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertTriangle, RefreshCcw } from 'lucide-react';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the raw decoded text when a barcode/QR is successfully read. */
  onScan: (code: string) => void;
}

/**
 * Modal that opens the device camera and scans 1D barcodes (EAN-13, UPC-A,
 * Code128, etc.) and QR codes using the html5-qrcode library (which wraps
 * ZXing). Designed to be a drop-in alternative to a physical USB/Bluetooth
 * barcode scanner for devices that don't have one (e.g. tablets, phones).
 */
export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const containerId = 'camera-barcode-scanner-region';
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    hasScannedRef.current = false;
    setError(null);
    setIsStarting(true);

    const start = async () => {
      try {
        // Lazy-loaded so the (fairly heavy) library only enters the bundle
        // when the user actually opens the camera scanner.
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

        if (cancelled) return;

        const html5Qrcode = new Html5Qrcode(containerId, {
          // Limit to common retail barcode formats + QR for speed/accuracy.
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        } as any);

        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 160 },
          },
          (decodedText: string) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;
            onScan(decodedText.trim());
          },
          () => {
            // Per-frame "not found" callback — expected constantly while
            // aiming the camera, so we intentionally ignore it.
          }
        );

        if (!cancelled) setIsStarting(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Error al iniciar la cámara:', err);
        const message =
          err?.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Habilitá el acceso a la cámara en tu navegador para usar esta función.'
            : err?.name === 'NotFoundError'
            ? 'No se encontró ninguna cámara disponible en este dispositivo.'
            : 'No se pudo iniciar la cámara. Verificá los permisos o probá con otro dispositivo.';
        setError(message);
        setIsStarting(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {
            /* scanner was already stopped/never started — safe to ignore */
          });
          scannerRef.current = null;
      }
    };
  }, [isOpen, onScan, retryKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-800">
              Escanear con la cámara
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error ? (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <p className="text-xs text-slate-600">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setIsStarting(true);
                  setRetryKey((k) => k + 1);
                }}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div
                id={containerId}
                className="w-full rounded-lg overflow-hidden bg-black min-h-[220px] flex items-center justify-center"
              />
              <p className="text-[11px] text-slate-500 text-center">
                {isStarting
                  ? 'Iniciando cámara...'
                  : 'Apuntá la cámara al código de barras del producto. Se agregará automáticamente al detectarlo.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

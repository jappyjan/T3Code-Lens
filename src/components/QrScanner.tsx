// ── QR Code Scanner Component ───────────────────────────────────────
// Uses the native BarcodeDetector API (Chrome 83+ / Android WebView)
// to scan QR codes via the device camera.
//
// Falls back to a manual "paste URL" input when BarcodeDetector is
// not available (Firefox, older browsers, etc.).

import { useEffect, useRef, useState, useCallback } from 'react';

// ── BarcodeDetector type declarations ──────────────────────────────

interface DetectedBarcode {
  rawValue: string;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts: { formats: string[] }): {
        detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
      };
    };
  }
}

// ── Props ──────────────────────────────────────────────────────────

interface QrScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [pasteUrl, setPasteUrl] = useState('');

  // Stable onScan ref so the scanning loop doesn't re-mount
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!window.BarcodeDetector) {
      setSupported(false);
      return;
    }

    let cancelled = false;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        // Continuous scanning loop
        const scan = async () => {
          if (cancelled || !video || video.readyState < 2) {
            if (!cancelled) requestAnimationFrame(scan);
            return;
          }
          try {
            const results = await detector.detect(video);
            const first = results[0];
            if (first?.rawValue) {
              stopCamera();
              onScanRef.current(first.rawValue);
              return;
            }
          } catch {
            // detection can throw on some frames — ignore
          }
          if (!cancelled) requestAnimationFrame(scan);
        };
        requestAnimationFrame(scan);
      } catch {
        setError('Camera access denied. Allow camera permissions or paste the URL below.');
        setSupported(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  // ── Manual paste fallback ────────────────────────────────────────

  const handlePaste = () => {
    if (pasteUrl.trim()) onScan(pasteUrl.trim());
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Camera preview */}
      {supported && (
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          {/* Scan target overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-white/40 rounded-2xl" />
          </div>
        </div>
      )}

      {/* Error / no-support message */}
      {(!supported || error) && (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-gray-400 text-center">
            {error || 'QR scanning not supported in this browser.'}
          </p>
        </div>
      )}

      {/* Bottom panel */}
      <div className="bg-gray-950 p-4 space-y-3">
        <p className="text-xs text-gray-500 text-center">
          {supported
            ? 'Point camera at the QR code from t3 serve'
            : 'Paste the pairing URL from t3 serve instead'}
        </p>

        {/* Paste URL fallback */}
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            placeholder="http://host:port/pair#token=..."
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
          />
          <button
            onClick={handlePaste}
            disabled={!pasteUrl.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg px-4 text-sm font-medium transition-colors"
          >
            Go
          </button>
        </div>

        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

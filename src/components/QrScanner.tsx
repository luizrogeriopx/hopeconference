import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  onResult: (text: string) => void | Promise<void>;
  paused?: boolean;
};

export function QrScanner({ onResult, paused }: Props) {
  const elId = "qr-reader-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    return () => {
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ativo && !scannerRef.current) {
      const startScanner = async () => {
        try {
          const inst = new Html5Qrcode(elId, { verbose: false });
          scannerRef.current = inst;
          await inst.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (text) => {
              void onResult(text);
            },
            () => { /* ignore per-frame errors */ }
          );
        } catch (e: unknown) {
          setErro(e instanceof Error ? e.message : "Não foi possível abrir a câmera.");
          setAtivo(false);
          scannerRef.current = null;
        }
      };

      // A small timeout to ensure the DOM has completed rendering the overlay div
      const timer = setTimeout(() => {
        void startScanner();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [ativo]);

  useEffect(() => {
    if (paused && scannerRef.current && ativo) {
      scannerRef.current.pause(true);
    } else if (!paused && scannerRef.current && ativo) {
      try { scannerRef.current.resume(); } catch { /* noop */ }
    }
  }, [paused, ativo]);

  async function stop() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch { /* noop */ } finally {
      scannerRef.current = null;
      setAtivo(false);
    }
  }

  const scannerOverlay = (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-center items-center p-4 animate-in fade-in duration-200">
      <style dangerouslySetInnerHTML={{ __html: `
        #${elId} {
          border: none !important;
          background: transparent !important;
          width: 100% !important;
          height: 100% !important;
        }
        #${elId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1rem !important;
        }
        #${elId}__header, #${elId}__dashboard {
          display: none !important;
        }
        #${elId} img {
          display: none !important;
        }
      ` }} />

      {/* Close button top right */}
      <button
        onClick={stop}
        className="absolute top-4 right-4 z-50 rounded-full bg-white/10 hover:bg-white/20 text-white w-12 h-12 flex items-center justify-center transition border border-white/20 cursor-pointer text-xl font-bold"
        aria-label="Fechar Câmera"
      >
        ✕
      </button>

      <div className="w-full max-w-md flex flex-col items-center gap-4 text-center">
        <h3 className="text-white font-display text-lg tracking-wide">Escanear QR Code</h3>
        <p className="text-white/60 text-xs max-w-xs leading-normal">
          Aponte a câmera para o QR Code do participante para ler as informações.
        </p>

        {/* Scanner preview region */}
        <div className="w-full aspect-square max-w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-black relative shadow-2xl">
          <div id={elId} className="w-full h-full" />
        </div>

        <p className="text-white/40 text-[10px] uppercase tracking-widest mt-2">
          Modo: Câmera Traseira (Auto)
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {!ativo && (
        <button
          onClick={() => setAtivo(true)}
          className="w-full sm:w-auto rounded-md bg-primary px-5 py-3 text-sm font-semibold tracking-widest text-primary-foreground hover:bg-primary/90 transition shadow-sm"
        >
          ABRIR CÂMERA DO SCANNER
        </button>
      )}

      {erro && !ativo && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>
      )}

      {ativo && typeof document !== "undefined"
        ? createPortal(scannerOverlay, document.body)
        : null}
    </div>
  );
}

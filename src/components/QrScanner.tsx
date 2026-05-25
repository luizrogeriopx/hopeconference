import { useEffect, useRef, useState } from "react";
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
    if (paused && scannerRef.current && ativo) {
      scannerRef.current.pause(true);
    } else if (!paused && scannerRef.current && ativo) {
      try { scannerRef.current.resume(); } catch { /* noop */ }
    }
  }, [paused, ativo]);

  async function start() {
    setErro(null);
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
      setAtivo(true);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir a câmera.");
    }
  }

  async function stop() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
        scannerRef.current = null;
        setAtivo(false);
      }
    } catch { /* noop */ }
  }

  return (
    <div className="space-y-3">
      <div id={elId} className="overflow-hidden rounded-lg border border-border bg-background" />
      <div className="flex gap-2">
        {!ativo ? (
          <button onClick={start} className="rounded-md bg-primary px-4 py-2 text-sm tracking-widest text-primary-foreground hover:bg-primary/90">
            ABRIR CÂMERA
          </button>
        ) : (
          <button onClick={stop} className="rounded-md border border-border px-4 py-2 text-sm tracking-widest text-primary hover:bg-muted">
            FECHAR CÂMERA
          </button>
        )}
      </div>
      {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
    </div>
  );
}

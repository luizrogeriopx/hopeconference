import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QrScanner } from "./QrScanner";

type Resultado = {
  tipo: "ok" | "ja" | "erro";
  msg: string;
  nome?: string;
  validado_em?: string;
};

export function ValidadorEntrada({ userId }: { userId: string }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [paused, setPaused] = useState(false);
  const [processando, setProcessando] = useState(false);

  async function handle(token: string) {
    if (processando || paused) return;
    setProcessando(true);
    setPaused(true);
    try {
      const t = token.trim();
      const { data: insc, error } = await supabase
        .from("inscricoes")
        .select("id, nome_participante, status, validado_em")
        .eq("qr_token", t)
        .maybeSingle();
      if (error || !insc) {
        setResultado({ tipo: "erro", msg: "QR Code inválido — inscrição não encontrada." });
        return;
      }
      if (insc.status === "validado") {
        setResultado({ tipo: "ja", msg: "Este ingresso já foi validado.", nome: insc.nome_participante, validado_em: insc.validado_em ?? undefined });
        return;
      }
      if (insc.status !== "pago") {
        setResultado({ tipo: "erro", msg: `Ingresso ${insc.status}. Entrada não permitida.`, nome: insc.nome_participante });
        return;
      }
      const { error: upErr } = await supabase
        .from("inscricoes")
        .update({ status: "validado", validado_em: new Date().toISOString(), validado_por: userId })
        .eq("id", insc.id);
      if (upErr) {
        setResultado({ tipo: "erro", msg: upErr.message });
        return;
      }
      setResultado({ tipo: "ok", msg: "Entrada autorizada!", nome: insc.nome_participante });
    } finally {
      setProcessando(false);
    }
  }

  const cor =
    resultado?.tipo === "ok" ? "border-gold bg-gold/10 text-primary" :
    resultado?.tipo === "ja" ? "border-destructive/40 bg-destructive/10 text-destructive" :
    resultado ? "border-destructive/40 bg-destructive/10 text-destructive" : "";

  return (
    <div className="space-y-4">
      <QrScanner onResult={handle} paused={paused} />
      {resultado && (
        <div className={`rounded-xl border p-5 ${cor}`}>
          <p className="text-xs tracking-widest uppercase opacity-80">
            {resultado.tipo === "ok" ? "✓ AUTORIZADO" : resultado.tipo === "ja" ? "⚠ JÁ VALIDADO" : "✕ RECUSADO"}
          </p>
          {resultado.nome && <p className="mt-1 font-display text-2xl">{resultado.nome}</p>}
          <p className="mt-1 text-sm">{resultado.msg}</p>
          {resultado.validado_em && (
            <p className="mt-1 text-xs opacity-70">Validado em: {new Date(resultado.validado_em).toLocaleString("pt-BR")}</p>
          )}
          <button
            onClick={() => { setResultado(null); setPaused(false); }}
            className="mt-3 rounded-md border border-current px-3 py-2 text-xs tracking-widest hover:opacity-80"
          >
            LER PRÓXIMO
          </button>
        </div>
      )}
    </div>
  );
}

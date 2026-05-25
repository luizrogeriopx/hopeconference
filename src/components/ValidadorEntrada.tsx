import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QrScanner } from "./QrScanner";

type Inscricao = {
  id: string;
  nome_participante: string;
  email: string | null;
  telefone: string | null;
  status: string;
  validado_em: string | null;
  criado_em: string;
  valor: number;
};

type Resultado =
  | { tipo: "pendente"; insc: Inscricao }
  | { tipo: "ok"; insc: Inscricao }
  | { tipo: "ja"; insc: Inscricao }
  | { tipo: "erro"; msg: string; insc?: Inscricao };

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
        .select("id, nome_participante, email, telefone, status, validado_em, criado_em, valor")
        .eq("qr_token", t)
        .maybeSingle();
      if (error || !insc) {
        setResultado({ tipo: "erro", msg: "QR Code inválido — inscrição não encontrada." });
        return;
      }
      if (insc.status === "validado") {
        setResultado({ tipo: "ja", insc });
        return;
      }
      if (insc.status !== "pago") {
        setResultado({ tipo: "erro", msg: `Ingresso ${insc.status}. Entrada não permitida.`, insc });
        return;
      }
      setResultado({ tipo: "pendente", insc });
    } finally {
      setProcessando(false);
    }
  }

  async function confirmar() {
    if (!resultado || resultado.tipo !== "pendente") return;
    setProcessando(true);
    try {
      const { error: upErr } = await supabase
        .from("inscricoes")
        .update({ status: "validado", validado_em: new Date().toISOString(), validado_por: userId })
        .eq("id", resultado.insc.id);
      if (upErr) {
        setResultado({ tipo: "erro", msg: upErr.message, insc: resultado.insc });
        return;
      }
      setResultado({ tipo: "ok", insc: { ...resultado.insc, status: "validado", validado_em: new Date().toISOString() } });
    } finally {
      setProcessando(false);
    }
  }

  function reset() {
    setResultado(null);
    setPaused(false);
  }

  const cor =
    resultado?.tipo === "ok" ? "border-gold bg-gold/10 text-primary" :
    resultado?.tipo === "pendente" ? "border-border bg-card text-primary" :
    resultado?.tipo === "ja" ? "border-destructive/40 bg-destructive/10 text-destructive" :
    resultado ? "border-destructive/40 bg-destructive/10 text-destructive" : "";

  const insc = resultado && "insc" in resultado ? resultado.insc : undefined;

  return (
    <div className="space-y-4">
      <QrScanner onResult={handle} paused={paused} />
      {resultado && (
        <div className={`rounded-xl border p-5 ${cor}`}>
          <p className="text-xs tracking-widest uppercase opacity-80">
            {resultado.tipo === "ok" ? "✓ ENTRADA AUTORIZADA" :
             resultado.tipo === "pendente" ? "⟳ CONFIRMAR ENTRADA" :
             resultado.tipo === "ja" ? "⚠ JÁ VALIDADO" : "✕ RECUSADO"}
          </p>

          {insc ? (
            <div className="mt-2 space-y-1">
              <p className="font-display text-2xl">{insc.nome_participante}</p>
              {insc.email && <p className="text-sm opacity-80">{insc.email}</p>}
              {insc.telefone && <p className="text-sm opacity-80">{insc.telefone}</p>}
              <p className="text-xs opacity-70">
                Status: <span className="uppercase">{insc.status}</span> · R$ {Number(insc.valor).toFixed(2)}
              </p>
              <p className="text-xs opacity-70">Inscrito em: {new Date(insc.criado_em).toLocaleString("pt-BR")}</p>
              {insc.validado_em && (
                <p className="text-xs opacity-70">Validado em: {new Date(insc.validado_em).toLocaleString("pt-BR")}</p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm">{resultado.tipo === "erro" ? resultado.msg : ""}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {resultado.tipo === "pendente" && (
              <button
                onClick={confirmar}
                disabled={processando}
                className="rounded-md bg-primary px-4 py-2 text-sm tracking-widest text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {processando ? "CONFIRMANDO…" : "CONFIRMAR ENTRADA"}
              </button>
            )}
            <button
              onClick={reset}
              className="rounded-md border border-current px-3 py-2 text-xs tracking-widest hover:opacity-80"
            >
              {resultado.tipo === "pendente" ? "CANCELAR" : "LER PRÓXIMO"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

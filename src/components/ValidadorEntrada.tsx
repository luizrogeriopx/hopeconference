import { useEffect, useState } from "react";
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
  lab_id: string | null;
  lab_qr_token: string | null;
  lab_validado_em: string | null;
  labs?: { nome: string; local: string; eh_geral: boolean } | null;
};

type ControllerInfo = {
  role: string;
  labId: string | null;
  labNome: string;
};

type Resultado =
  | { tipo: "pendente"; insc: Inscricao }
  | { tipo: "ok"; insc: Inscricao }
  | { tipo: "ja"; insc: Inscricao; msg?: string }
  | { tipo: "erro"; msg: string; insc?: Inscricao };

export function ValidadorEntrada({ userId }: { userId: string }) {
  const [controller, setController] = useState<ControllerInfo | null>(null);
  const [carregandoController, setCarregandoController] = useState(true);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [paused, setPaused] = useState(false);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    async function loadController() {
      setCarregandoController(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, lab_id, labs(nome)")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setController({
          role: data.role,
          labId: data.lab_id,
          labNome: (data.labs as any)?.nome || "",
        });
      } else {
        // Fallback para admin/super que atuam como portaria geral
        setController({
          role: "admin",
          labId: null,
          labNome: "",
        });
      }
      setCarregandoController(false);
    }
    void loadController();
  }, [userId]);

  async function handle(token: string) {
    if (processando || paused || !controller) return;
    setProcessando(true);
    setPaused(true);
    try {
      const t = token.trim();

      if (controller.labId) {
        // --- Modo Controlador de LAB ---
        // 1. Busca por lab_qr_token
        const { data: insc, error } = await supabase
          .from("inscricoes")
          .select("id, nome_participante, email, telefone, status, validado_em, criado_em, valor, lab_id, lab_qr_token, lab_validado_em, labs(nome, local, eh_geral)")
          .eq("lab_qr_token", t)
          .maybeSingle();

        if (error || !insc) {
          // Check if they scanned the general qr_token instead
          const { data: generalInsc } = await supabase
            .from("inscricoes")
            .select("id, nome_participante, labs(nome)")
            .eq("qr_token", t)
            .maybeSingle();

          if (generalInsc) {
            setResultado({
              tipo: "erro",
              msg: `Atenção: Este é um QR Code de entrada geral! O participante "${generalInsc.nome_participante}" deve primeiro realizar o check-in na Entrada Principal.`,
            });
          } else {
            setResultado({ tipo: "erro", msg: "QR Code inválido para esta portaria." });
          }
          return;
        }

        // Verifica se a LAB da inscrição condiz com a do controlador
        if (insc.lab_id !== controller.labId) {
          setResultado({
            tipo: "erro",
            msg: `Entrada Recusada! Este participante pertence à LAB: "${insc.labs?.nome || "Outra LAB"}".`,
            insc: insc as any,
          });
          return;
        }

        // Verifica se a LAB já foi validada
        if (insc.lab_validado_em) {
          setResultado({
            tipo: "ja",
            insc: insc as any,
            msg: `Esta credencial de LAB já foi utilizada em ${new Date(insc.lab_validado_em).toLocaleTimeString("pt-BR")}.`,
          });
          return;
        }

        setResultado({ tipo: "pendente", insc: insc as any });
      } else {
        // --- Modo Controlador Geral (Principal) ---
        // 1. Busca por qr_token
        const { data: insc, error } = await supabase
          .from("inscricoes")
          .select("id, nome_participante, email, telefone, status, validado_em, criado_em, valor, lab_id, lab_qr_token, lab_validado_em, labs(nome, local, eh_geral)")
          .eq("qr_token", t)
          .maybeSingle();

        if (error || !insc) {
          // Check if they scanned a lab_qr_token in the general gate
          const { data: labInsc } = await supabase
            .from("inscricoes")
            .select("id, nome_participante")
            .eq("lab_qr_token", t)
            .maybeSingle();

          if (labInsc) {
            setResultado({
              tipo: "erro",
              msg: `Atenção: Este é um QR Code de LAB! O participante "${labInsc.nome_participante}" já fez o check-in geral.`,
            });
          } else {
            setResultado({ tipo: "erro", msg: "QR Code inválido — inscrição não encontrada." });
          }
          return;
        }

        if (insc.status === "validado") {
          setResultado({
            tipo: "ja",
            insc: insc as any,
            msg: `A entrada geral deste ingresso já foi validada anteriormente.`,
          });
          return;
        }

        if (insc.status !== "pago") {
          setResultado({
            tipo: "erro",
            msg: `Ingresso com status "${insc.status}". Entrada não permitida.`,
            insc: insc as any,
          });
          return;
        }

        setResultado({ tipo: "pendente", insc: insc as any });
      }
    } finally {
      setProcessando(false);
    }
  }

  async function confirmar() {
    if (!resultado || resultado.tipo !== "pendente" || !controller) return;
    setProcessando(true);
    try {
      if (controller.labId) {
        // --- Confirmar entrada na LAB ---
        const { error: upErr } = await supabase
          .from("inscricoes")
          .update({
            lab_validado_em: new Date().toISOString(),
            lab_validado_por: userId,
          })
          .eq("id", resultado.insc.id);

        if (upErr) {
          setResultado({ tipo: "erro", msg: upErr.message, insc: resultado.insc });
          return;
        }

        setResultado({
          tipo: "ok",
          insc: {
            ...resultado.insc,
            lab_validado_em: new Date().toISOString(),
          },
        });
      } else {
        // --- Confirmar entrada Principal (Geral) ---
        const hasSpecificLab = resultado.insc.lab_id && !resultado.insc.labs?.eh_geral;
        const updates: any = {
          status: "validado",
          validado_em: new Date().toISOString(),
          validado_por: userId,
        };

        let newLabQrToken = null;
        if (hasSpecificLab) {
          newLabQrToken = window.crypto.randomUUID();
          updates.lab_qr_token = newLabQrToken;
        }

        const { error: upErr } = await supabase
          .from("inscricoes")
          .update(updates)
          .eq("id", resultado.insc.id);

        if (upErr) {
          setResultado({ tipo: "erro", msg: upErr.message, insc: resultado.insc });
          return;
        }

        setResultado({
          tipo: "ok",
          insc: {
            ...resultado.insc,
            status: "validado",
            validado_em: new Date().toISOString(),
            lab_qr_token: newLabQrToken,
          },
        });
      }
    } finally {
      setProcessando(false);
    }
  }

  function reset() {
    setResultado(null);
    setPaused(false);
  }

  if (carregandoController) {
    return <p className="text-center text-sm text-muted-foreground py-4">Carregando configuração de portaria…</p>;
  }

  const cor =
    resultado?.tipo === "ok" ? "border-gold bg-gold/10 text-primary" :
    resultado?.tipo === "pendente" ? "border-border bg-card text-primary" :
    resultado?.tipo === "ja" ? "border-destructive/40 bg-destructive/10 text-destructive" :
    resultado ? "border-destructive/40 bg-destructive/10 text-destructive" : "";

  const insc = resultado && "insc" in resultado ? resultado.insc : undefined;

  return (
    <div className="space-y-4 text-left">
      {/* Banner informativo de tipo de portaria */}
      <div className="rounded-md bg-muted px-4 py-2 text-xs border border-border flex justify-between items-center">
        <span>PORTARIA ATIVA:</span>
        <span className="font-semibold text-primary uppercase">
          {controller?.labId ? `LAB: ${controller.labNome}` : "Entrada Principal (Geral)"}
        </span>
      </div>

      <QrScanner onResult={handle} paused={paused} />
      {resultado && (
        <div className={`rounded-xl border p-5 ${cor}`}>
          <p className="text-xs tracking-widest uppercase opacity-85 font-semibold">
            {resultado.tipo === "ok" ? "✓ ENTRADA AUTORIZADA" :
             resultado.tipo === "pendente" ? "⟳ CONFIRMAR ENTRADA" :
             resultado.tipo === "ja" ? "⚠ JÁ VALIDADO" : "✕ RECUSADO"}
          </p>

          {insc ? (
            <div className="mt-2 space-y-1">
              <p className="font-display text-2xl">{insc.nome_participante}</p>
              {insc.labs && (
                <p className="text-sm font-semibold text-gold">
                  Categoria: {insc.labs.nome} ({insc.labs.local})
                </p>
              )}
              {insc.email && <p className="text-sm opacity-80">{insc.email}</p>}
              {insc.telefone && <p className="text-sm opacity-80">{insc.telefone}</p>}
              <p className="text-xs opacity-75">
                Status Geral: <span className="uppercase font-semibold">{insc.status}</span> · R$ {Number(insc.valor).toFixed(2)}
              </p>
              {insc.validado_em && (
                <p className="text-xs opacity-75">Entrada Geral: {new Date(insc.validado_em).toLocaleString("pt-BR")}</p>
              )}
              {insc.lab_validado_em && (
                <p className="text-xs opacity-75">Entrada na LAB: {new Date(insc.lab_validado_em).toLocaleString("pt-BR")}</p>
              )}
              {resultado.tipo === "ja" && resultado.msg && (
                <p className="mt-2 text-xs font-semibold text-destructive">{resultado.msg}</p>
              )}
              {resultado.tipo === "ok" && !controller?.labId && insc.lab_qr_token && (
                <div className="mt-3 p-3 rounded-md bg-gold/10 border border-gold/30 text-xs text-primary font-medium">
                  🎟️ **Gere o QR Code da LAB** no painel do participante para a entrada específica.
                </div>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm font-medium">{resultado.tipo === "erro" ? resultado.msg : ""}</p>
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
              className="rounded-md border border-current px-3 py-2 text-xs tracking-widest hover:opacity-85"
            >
              {resultado.tipo === "pendente" ? "CANCELAR" : "LER PRÓXIMO"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

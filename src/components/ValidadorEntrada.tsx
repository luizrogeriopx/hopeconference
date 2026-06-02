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
        const updates: any = {
          status: "validado",
          validado_em: new Date().toISOString(),
          validado_por: userId,
        };

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
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className={`w-full max-w-md my-auto rounded-2xl border bg-card p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left flex flex-col justify-between ${
            resultado.tipo === "ok" ? "border-gold/30" :
            resultado.tipo === "pendente" ? "border-border" :
            "border-destructive/30"
          }`}>
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className={`text-sm font-bold tracking-widest uppercase ${
                resultado.tipo === "ok" ? "text-gold" :
                resultado.tipo === "pendente" ? "text-primary" :
                "text-destructive"
              }`}>
                {resultado.tipo === "ok" ? "✓ Entrada Autorizada" :
                 resultado.tipo === "pendente" ? "⟳ Confirmar Entrada" :
                 resultado.tipo === "ja" ? "⚠ Já Validado" : "✕ Recusado"}
              </h3>
              <button 
                onClick={reset}
                className="text-muted-foreground hover:text-foreground text-lg transition-colors p-1"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {insc ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">PARTICIPANTE</label>
                  <p className="font-display text-2xl text-primary font-bold break-words">{insc.nome_participante}</p>
                </div>

                {insc.labs && (
                  <div>
                    <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">CATEGORIA / LAB</label>
                    <p className="text-sm font-semibold text-gold break-words">
                      {insc.labs.nome} ({insc.labs.local})
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {insc.email && (
                    <div className="min-w-0">
                      <label className="tracking-widest uppercase font-semibold text-muted-foreground block text-[9px]">E-MAIL</label>
                      <span className="text-primary truncate block" title={insc.email}>{insc.email}</span>
                    </div>
                  )}
                  {insc.telefone && (
                    <div>
                      <label className="tracking-widest uppercase font-semibold text-muted-foreground block text-[9px]">TELEFONE</label>
                      <span className="text-primary block">{insc.telefone}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-3 space-y-1 text-xs">
                  <p className="opacity-80">
                    Status Inscrição: <span className="uppercase font-semibold text-primary">{insc.status}</span>
                  </p>
                  <p className="opacity-80">
                    Valor: <span className="font-semibold text-primary">R$ {Number(insc.valor).toFixed(2)}</span>
                  </p>
                  {insc.validado_em && (
                    <p className="opacity-80">
                      Entrada Geral: <span className="font-semibold text-primary">{new Date(insc.validado_em).toLocaleString("pt-BR")}</span>
                    </p>
                  )}
                  {insc.lab_validado_em && (
                    <p className="opacity-80">
                      Entrada LAB: <span className="font-semibold text-primary">{new Date(insc.lab_validado_em).toLocaleString("pt-BR")}</span>
                    </p>
                  )}
                </div>

                {resultado.tipo === "ja" && resultado.msg && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive break-words">
                    {resultado.msg}
                  </div>
                )}

                {resultado.tipo === "ok" && !controller?.labId && insc.lab_qr_token && (
                  <div className="p-3 rounded-md bg-gold/10 border border-gold/30 text-xs text-primary font-medium break-words">
                    🎟️ **Gere o QR Code da LAB** no painel do participant para a entrada específica.
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm font-semibold text-destructive break-words">{resultado.tipo === "erro" ? resultado.msg : ""}</p>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3 border-t border-border pt-4">
              {resultado.tipo === "pendente" ? (
                <>
                  <button
                    onClick={confirmar}
                    disabled={processando}
                    className="w-full sm:flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold tracking-widest text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition"
                  >
                    {processando ? "CONFIRMANDO…" : "CONFIRMAR"}
                  </button>
                  <button
                    onClick={reset}
                    className="w-full sm:flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-semibold tracking-widest text-primary hover:bg-muted transition"
                  >
                    VOLTAR
                  </button>
                </>
              ) : (
                <button
                  onClick={reset}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold tracking-widest text-primary-foreground hover:bg-primary/90 transition"
                >
                  FECHAR / LER PRÓXIMO
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

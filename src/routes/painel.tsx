import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LocalCard } from "@/components/LocalCard";
import { criarInscricoesPainel } from "@/lib/inscriptions.functions";
import {
  processarPagamentoTransparente,
  verificarStatusPagamento,
  cancelarPagamentoPendente,
} from "@/lib/payment.functions";
import { regionaisCongregacoes } from "@/lib/regionais";

function loadMercadoPagoSDK(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).MercadoPago) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
}

export const Route = createFileRoute("/painel")({
  component: PainelInscrito,
  head: () => ({ meta: [{ title: "Painel do Inscrito — Hope Conference" }] }),
});

type Inscricao = {
  id: string;
  nome_participante: string;
  status: "pendente" | "pago" | "cancelado" | "validado";
  qr_token: string;
  valor: number;
  criado_em: string;
  lab_id?: string | null;
  lab_qr_token?: string | null;
  lab_validado_em?: string | null;
  regional: string;
  congregacao: string;
  labs?: { nome: string; local: string; eh_geral: boolean } | null;
};

type Lab = {
  id: string;
  nome: string;
  limite_vagas: number;
  local: string;
  ativo: boolean;
  requer_cpf: boolean;
  eh_geral: boolean;
};

type ParticipanteForm = {
  nome: string;
  labId: string;
  cpf: string;
  regional: string;
  congregacao: string;
  ministerioId: string;
};

type Ministerio = {
  id: string;
  nome: string;
  ativo: boolean;
};

function PainelInscrito() {
  const navigate = useNavigate();
  const { user, roles, loading, signOut } = useAuth();
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [vagasOcupadas, setVagasOcupadas] = useState<Record<string, number>>({});
  const [totalGeralOcupado, setTotalGeralOcupado] = useState(0);
  const [participantes, setParticipantes] = useState<ParticipanteForm[]>([
    { nome: "", labId: "", cpf: "", regional: "SEDE", congregacao: "", ministerioId: "" }
  ]);
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const inscreverFn = useServerFn(criarInscricoesPainel);
  const processarPagamento = useServerFn(processarPagamentoTransparente);
  const verificarPagamento = useServerFn(verificarStatusPagamento);
  const cancelarPendente = useServerFn(cancelarPagamentoPendente);

  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [mpAtivo, setMpAtivo] = useState(false);
  const [verificandoPagamentoId, setVerificandoPagamentoId] = useState<string | null>(null);
  const [cancelandoPagamento, setCancelandoPagamento] = useState(false);

  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [senhaErro, setSenhaErro] = useState<string | null>(null);
  const [senhaSucesso, setSenhaSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/painel" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    async function carregarMPSettings() {
      const { data } = await supabase
        .from("app_settings")
        .select("mercado_pago_ativo, mercado_pago_public_key")
        .eq("id", true)
        .maybeSingle();
      if (data) {
        setMpAtivo(data.mercado_pago_ativo);
        setMpPublicKey(data.mercado_pago_public_key || "");
      }
    }
    void carregarMPSettings();
  }, []);

  async function carregarMinisterios() {
    const { data } = await supabase
      .from("ministerios")
      .select("id, nome, ativo")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (data) setMinisterios(data as Ministerio[]);
  }

  useEffect(() => {
    if (!user) return;
    void carregar();
    void carregarLabs();
    void carregarVagas();
    void carregarMinisterios();

    const channel = supabase
      .channel(`inscricoes-user-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inscricoes", filter: `comprador_user_id=eq.${user.id}` },
        (payload) => {
          void carregar();
          void carregarVagas();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);



  async function carregarLabs() {
    const { data } = await supabase
      .from("labs")
      .select("*")
      .eq("exclusivo_recepcao", false)
      .eq("eh_geral", false)
      .order("eh_geral", { ascending: true })
      .order("nome", { ascending: true });
    if (data) setLabs(data as Lab[]);
  }

  async function carregarVagas() {
    const { data: countsData } = await supabase
      .from("inscricoes")
      .select("lab_id")
      .neq("status", "cancelado");

    const counts: Record<string, number> = {};
    let total = 0;
    (countsData ?? []).forEach((row) => {
      total++;
      if (row.lab_id) {
        counts[row.lab_id] = (counts[row.lab_id] || 0) + 1;
      }
    });
    setVagasOcupadas(counts);
    setTotalGeralOcupado(total);
  }

  async function carregar() {
    setCarregando(true);
    const { data, error } = await supabase
      .from("inscricoes")
      .select("id, nome_participante, status, qr_token, valor, criado_em, lab_id, lab_qr_token, lab_validado_em, regional, congregacao, labs(nome, local, eh_geral)")
      .eq("comprador_user_id", user!.id)
      .order("criado_em", { ascending: false });
    
    if (!error && data) {
      setInscricoes(data as any[]);
      
      const pendingInscs = (data ?? []).filter((i: any) => i.status === "pendente");
      if (pendingInscs.length > 0) {
        const { data: payData } = await supabase
          .from("pagamentos")
          .select("id, status, metodo, valor, preference_id, payment_id, payment_url, pix_qr_base64, inscricao_id")
          .in("inscricao_id", pendingInscs.map((i: any) => i.id))
          .eq("status", "pendente");
        setPendingPayments(payData ?? []);
      } else {
        setPendingPayments([]);
      }
    }
    setCarregando(false);
  }

  // Efeito para inicializar o Payment Brick
  useEffect(() => {
    if (!mpPublicKey || pendingPayments.length === 0 || !checkoutAberto) return;

    let brickController: any = null;

    const initBrick = async () => {
      try {
        await loadMercadoPagoSDK();
        const mp = new (window as any).MercadoPago(mpPublicKey);
        const bricksBuilder = mp.bricks();

        const totalAmount = pendingPayments.reduce((s, p) => s + p.valor, 0);

        const settings = {
          initialization: {
            amount: totalAmount,
            payer: {
              email: user?.email,
            },
          },
          customization: {
            paymentMethods: {
              bankTransfer: ["pix"],
              creditCard: "all",
              debitCard: "all",
            },
          },
          callbacks: {
            onReady: () => {
              console.log("Payment Brick is ready");
            },
            onSubmit: ({ selectedPaymentMethod, formData }: any) => {
              return new Promise<void>((resolve, reject) => {
                processarPagamento({
                  data: {
                    formData,
                    pendingPaymentIds: pendingPayments.map((p) => p.id),
                  }
                })
                  .then(async (res: any) => {
                    if (res.success) {
                      resolve();
                      alert(res.status === "approved" 
                        ? "Pagamento confirmado! Seus ingressos foram liberados." 
                        : "Pagamento Pix gerado com sucesso! Utilize o código QR abaixo para pagar."
                      );
                      setCheckoutAberto(false);
                      await carregar();
                    } else {
                      reject();
                      alert(`Erro no pagamento: ${res.statusDetail || "Tente novamente"}`);
                    }
                  })
                  .catch((err: any) => {
                    reject();
                    alert(err instanceof Error ? err.message : "Erro ao processar o pagamento.");
                  });
              });
            },
            onError: (error: any) => {
              console.error("Payment Brick Error:", error);
            },
          },
        };

        const container = document.getElementById("paymentBrick_container");
        if (container) {
          container.innerHTML = "";
          brickController = await bricksBuilder.create("payment", "paymentBrick_container", settings);
        }
      } catch (err) {
        console.error("Erro ao inicializar o Payment Brick:", err);
      }
    };

    void initBrick();

    return () => {
      if (brickController) {
        try {
          brickController.unmount();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [mpPublicKey, pendingPayments, checkoutAberto]);

  async function verificarPix(paymentId: string) {
    setVerificandoPagamentoId(paymentId);
    try {
      const res = await verificarPagamento({ data: { paymentId } });
      if (res.approved) {
        alert("Pagamento confirmado com sucesso! Seus ingressos foram liberados.");
        await carregar();
      } else {
        alert("O pagamento ainda não consta como aprovado. Por favor, conclua a transação no seu aplicativo do banco.");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao consultar status.");
    } finally {
      setVerificandoPagamentoId(null);
    }
  }

  async function refazerCheckout(paymentIds: string[]) {
    if (!confirm("Deseja redefinir as opções de pagamento? O Pix anterior será cancelado.")) return;
    setCancelandoPagamento(true);
    try {
      await cancelarPendente({ data: { paymentIds } });
      await carregar();
      setCheckoutAberto(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao cancelar transação pendente.");
    } finally {
      setCancelandoPagamento(false);
    }
  }

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault();
    setSenhaErro(null);
    setSenhaSucesso(null);

    if (novaSenha.length < 6) {
      setSenhaErro("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      setSenhaErro("As senhas não coincidem.");
      return;
    }

    setAlterandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
        data: { senha_provisoria: false }
      });

      if (error) throw error;

      setSenhaSucesso("Senha alterada com sucesso!");
      setNovaSenha("");
      setConfirmarNovaSenha("");
      
      // Atualiza a sessão local para carregar os novos metadados
      await supabase.auth.refreshSession();
      
      setTimeout(() => {
        setModalSenhaAberto(false);
        setSenhaSucesso(null);
      }, 2000);
    } catch (err) {
      setSenhaErro(err instanceof Error ? err.message : "Erro ao alterar a senha.");
    } finally {
      setAlterandoSenha(false);
    }
  }

  async function inscrever(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const validos = participantes.filter((p) => p.nome.trim());
    if (validos.length === 0) {
      setErro("Informe ao menos um participante.");
      return;
    }
    setEnviando(true);
    try {
      const payload = {
        participantes: validos.map((p) => ({
          nome: p.nome.trim(),
          labId: p.labId,
          cpf: p.cpf ? p.cpf.trim() : undefined,
          regional: p.regional,
          congregacao: p.regional === "SEDE" ? "SEDE" : p.congregacao.trim(),
          ministerioId: p.regional === "SEDE" ? (p.ministerioId || null) : null,
        })),
      };
      const res = await inscreverFn({ data: payload });
      setParticipantes([{ nome: "", labId: "", cpf: "", regional: "SEDE", congregacao: "", ministerioId: "" }]);
      await carregar();
      await carregarVagas();
      
      if (res.mercadoPagoAtivo && res.pendingPaymentIds && res.pendingPaymentIds.length > 0) {
        setCheckoutAberto(true);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao realizar inscrição.");
    } finally {
      setEnviando(false);
    }
  }


  if (loading || !user) {
    return <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando…</main>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="font-display text-xl text-primary">Hope Conference 2026</Link>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline text-muted-foreground">{user.email}</span>
            {roles.includes("super_admin") && (
              <Link to="/super" className="rounded-md border border-gold bg-gold/10 px-3 py-2 tracking-widest text-primary hover:bg-gold/20">SUPER ADMIN</Link>
            )}
            {roles.includes("admin") && (
              <Link to="/admin" className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">ADMIN</Link>
            )}
            {roles.includes("gate") && (
              <Link to="/gate" className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">CONTROLE</Link>
            )}
            <button
              onClick={() => setModalSenhaAberto(true)}
              className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted"
            >
              ALTERAR SENHA
            </button>
            <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">
              SAIR
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {user?.user_metadata?.senha_provisoria && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-4 py-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>Você está utilizando uma senha temporária. Para garantir a segurança de sua conta, por favor, altere sua senha.</span>
              </div>
              <button
                onClick={() => setModalSenhaAberto(true)}
                className="shrink-0 rounded bg-amber-500 text-black px-3 py-1 font-semibold hover:bg-amber-500/90 text-xs transition"
              >
                ALTERAR SENHA AGORA
              </button>
            </div>
          )}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-2xl text-primary">Nova inscrição</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              R$ 50,00 por participante. Selecione a categoria (LAB) correspondente para cada pessoa.
            </p>
            {labs.find(l => l.eh_geral) && totalGeralOcupado >= (labs.find(l => l.eh_geral)?.limite_vagas || 0) ? (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive font-semibold">
                ⚠️ Inscrições encerradas! O limite máximo de vagas do evento ({labs.find(l => l.eh_geral)?.limite_vagas} vagas) foi atingido.
              </div>
            ) : (
              <form onSubmit={inscrever} className="mt-4 space-y-4">
                {participantes.map((p, i) => {
                  const selectedLab = labs.find(l => l.id === p.labId);
                  const showCpf = selectedLab?.requer_cpf;

                  return (
                    <div key={i} className="space-y-3 rounded-lg border border-border bg-background/50 p-4 relative">
                      {participantes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setParticipantes(participantes.filter((_, j) => j !== i))}
                          className="absolute right-3 top-3 text-xs text-muted-foreground hover:text-destructive"
                        >
                          ✕ Remover
                        </button>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">NOME DO PARTICIPANTE</label>
                          <input
                            value={p.nome}
                            onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                            placeholder={`Nome completo`}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">CATEGORIA (LAB)</label>
                          <select
                            value={p.labId}
                            onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, labId: e.target.value, cpf: "" } : x)))}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                            required
                          >
                            <option value="" disabled>Selecione uma categoria</option>
                            {labs.map((l) => {
                              const ocupadas = l.eh_geral ? totalGeralOcupado : (vagasOcupadas[l.id] || 0);
                              const restantes = Math.max(0, l.limite_vagas - ocupadas);
                              const esgotado = restantes <= 0 || !l.ativo;
                              return (
                                <option key={l.id} value={l.id} disabled={esgotado}>
                                  {l.nome} ({l.local}) — {esgotado ? "ESGOTADO" : `${restantes} vagas restantes`}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid gap-3 sm:grid-cols-2 mt-3">
                        <div className="space-y-1">
                          <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">REGIONAL</label>
                          <select
                            value={p.regional}
                            onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, regional: e.target.value, congregacao: "" } : x)))}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                            required
                          >
                            {["SEDE", ...Array.from({ length: 20 }, (_, idx) => String(idx + 2))].map((r) => (
                              <option key={r} value={r}>
                                {r === "SEDE" ? "Regional 01 - SEDE" : `Regional ${String(r).padStart(2, "0")}`}
                              </option>
                            ))}
                          </select>
                        </div>
                        {p.regional !== "SEDE" && (
                          <div className="space-y-1">
                            <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">CONGREGAÇÃO</label>
                            {regionaisCongregacoes[p.regional] ? (
                              <select
                                value={p.congregacao}
                                onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, congregacao: e.target.value } : x)))}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                                required
                              >
                                <option value="" disabled>Selecione a congregação</option>
                                {regionaisCongregacoes[p.regional].map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                value={p.congregacao}
                                onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, congregacao: e.target.value } : x)))}
                                placeholder="Nome da congregação"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                                required
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {p.regional === "SEDE" && (
                        <div className="space-y-1 mt-3">
                          <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground text-left block">MINISTÉRIO</label>
                          <select
                            value={p.ministerioId}
                            onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, ministerioId: e.target.value } : x)))}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                            required
                          >
                            <option value="" disabled>Selecione um ministério</option>
                            {ministerios.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {showCpf && (
                        <div className="space-y-1 sm:max-w-xs mt-3">
                          <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">CPF do Pastor</label>
                          <input
                            value={p.cpf}
                            onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, cpf: e.target.value } : x)))}
                            placeholder="000.000.000-00"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                            required
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setParticipantes([...participantes, { nome: "", labId: "", cpf: "", regional: "SEDE", congregacao: "", ministerioId: "" }]);
                    }}
                    className="text-xs tracking-widest text-primary font-semibold hover:underline"
                  >
                    + ADICIONAR PARTICIPANTE
                  </button>
                  <div className="text-sm text-muted-foreground">
                    Total: <span className="font-semibold text-primary">R$ {(participantes.filter(p => p.nome.trim()).length * 50).toFixed(2)}</span>
                  </div>
                </div>
                {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
                <button type="submit" disabled={enviando}
                  className="w-full rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
                  {enviando ? "PROCESSANDO..." : "CONFIRMAR INSCRIÇÃO"}
                </button>
              </form>
            )}
          </section>

          {/* Seção de Pagamento Pendente (Mercado Pago) */}
          {mpAtivo && pendingPayments.length > 0 && (
            <section className="rounded-xl border border-gold bg-gold/5 p-6 shadow-sm space-y-4 text-left">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg text-primary font-semibold">Pagamento Pendente</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Você possui {pendingPayments.length} inscrição(ões) aguardando pagamento para liberar os ingressos.
                  </p>
                </div>
                <div className="text-lg font-bold text-primary">
                  Total: R$ {pendingPayments.reduce((s, p) => s + p.valor, 0).toFixed(2)}
                </div>
              </div>

              {/* Lista de participantes pendentes */}
              <div className="rounded-lg bg-background/40 p-3 border border-border/50">
                <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground mb-1.5">Participantes Pendentes</p>
                <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
                  {inscricoes
                    .filter((i) => i.status === "pendente")
                    .map((i) => (
                      <li key={i.id}>
                        <span className="font-semibold text-primary">{i.nome_participante}</span> ({i.labs?.nome || "Entrada Geral"})
                      </li>
                    ))}
                </ul>
              </div>

              {/* Se Pix já gerado, mostrar o Pix diretamente */}
              {pendingPayments[0]?.payment_url && pendingPayments[0]?.pix_qr_base64 ? (
                <div className="flex flex-col items-center gap-4 p-4 rounded-lg bg-background border border-border max-w-sm mx-auto text-center">
                  <span className="text-xs font-semibold tracking-wider text-gold uppercase">Pague via Pix</span>
                  
                  <img 
                    src={`data:image/jpeg;base64,${pendingPayments[0].pix_qr_base64}`} 
                    alt="Pix QR Code" 
                    className="w-48 h-48 border border-border rounded-lg"
                  />

                  <div className="w-full space-y-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(pendingPayments[0].payment_url);
                        alert("Código Pix copiado para a área de transferência!");
                      }}
                      className="w-full rounded-md border border-border px-3 py-2 text-xs font-semibold tracking-widest text-primary hover:bg-muted transition-colors cursor-pointer"
                    >
                      COPIAR CÓDIGO PIX (CÓPIA E COLA)
                    </button>
                    
                    <button
                      disabled={verificandoPagamentoId !== null}
                      onClick={() => verificarPix(pendingPayments[0].payment_id)}
                      className="w-full rounded-md bg-gold px-3 py-2 text-xs font-semibold tracking-widest text-primary-foreground hover:bg-gold/90 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {verificandoPagamentoId === pendingPayments[0].payment_id ? "VERIFICANDO..." : "CONCLUÍ O PAGAMENTO (VERIFICAR)"}
                    </button>

                    <button
                      disabled={cancelandoPagamento}
                      onClick={() => refazerCheckout(pendingPayments.map(p => p.id))}
                      className="w-full rounded-md border border-destructive/20 text-destructive px-3 py-2 text-[10px] tracking-widest uppercase hover:bg-destructive/5 transition-colors cursor-pointer"
                    >
                      {cancelandoPagamento ? "REDEFININDO..." : "MUDAR FORMA DE PAGAMENTO"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {!checkoutAberto ? (
                    <button
                      onClick={() => setCheckoutAberto(true)}
                      className="w-full rounded-md bg-gold px-6 py-3 text-sm font-semibold tracking-wider text-primary-foreground hover:bg-gold/90 transition shadow-sm cursor-pointer"
                    >
                      EFETUAR PAGAMENTO
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Checkout Transparente</span>
                        <button 
                          onClick={() => setCheckoutAberto(false)} 
                          className="text-xs text-muted-foreground hover:text-primary tracking-widest uppercase font-semibold"
                        >
                          Cancelar
                        </button>
                      </div>
                      
                      {/* Container onde o Payment Brick será montado */}
                      <div id="paymentBrick_container" className="rounded-lg border border-border bg-background p-4 shadow-inner min-h-[300px]">
                        <p className="text-center text-sm text-muted-foreground py-10">Carregando formulário do Mercado Pago…</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          <section>
            <h2 className="font-display text-2xl text-primary">Minhas inscrições</h2>
            {carregando ? (
              <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
            ) : inscricoes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma inscrição ainda.</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {inscricoes.map((i) => (
                  <InscricaoCard key={i.id} inscricao={i} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside>
          <LocalCard />
        </aside>
      </div>

      {modalSenhaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
            <h3 className="font-display text-xl text-primary mb-1">Alterar Senha</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Escolha uma nova senha forte para acessar seu painel.
            </p>

            <form onSubmit={alterarSenha} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">
                  NOVA SENHA
                </label>
                <input
                  type="password"
                  required
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="No mínimo 6 caracteres"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                  minLength={6}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">
                  CONFIRMAR NOVA SENHA
                </label>
                <input
                  type="password"
                  required
                  value={confirmarNovaSenha}
                  onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                  placeholder="Digite a senha novamente"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                  minLength={6}
                />
              </div>

              {senhaErro && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive text-left">
                  {senhaErro}
                </p>
              )}

              {senhaSucesso && (
                <p className="rounded-md border border-gold/40 bg-gold/10 p-3 text-xs text-primary text-left">
                  {senhaSucesso}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalSenhaAberto(false);
                    setSenhaErro(null);
                    setSenhaSucesso(null);
                    setNovaSenha("");
                    setConfirmarNovaSenha("");
                  }}
                  className="rounded-md border border-border px-4 py-2 text-xs font-semibold tracking-widest text-primary hover:bg-muted transition-colors"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={alterandoSenha}
                  className="rounded-md bg-gold px-4 py-2 text-xs font-semibold tracking-widest text-primary-foreground hover:bg-gold/90 transition-colors disabled:opacity-50"
                >
                  {alterandoSenha ? "SALVANDO..." : "SALVAR SENHA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function InscricaoCard({ inscricao }: { inscricao: Inscricao }) {
  const canvasGeralRef = useRef<HTMLCanvasElement>(null);
  const canvasLabRef = useRef<HTMLCanvasElement>(null);
  const [dataUrlGeral, setDataUrlGeral] = useState<string>("");
  const [dataUrlLab, setDataUrlLab] = useState<string>("");

  const hasSpecificLab = inscricao.lab_id && !inscricao.labs?.eh_geral;
  const isGeneralValidated = inscricao.status === "validado";
  const isLabValidated = !!inscricao.lab_validado_em;

  useEffect(() => {
    if (!canvasGeralRef.current || !inscricao.qr_token || inscricao.status === "cancelado" || inscricao.status === "pendente") return;
    QRCode.toCanvas(canvasGeralRef.current, inscricao.qr_token, { width: 160, margin: 1 }, () => {
      setDataUrlGeral(canvasGeralRef.current?.toDataURL("image/png") ?? "");
    });
  }, [inscricao.qr_token, inscricao.status]);

  useEffect(() => {
    if (!canvasLabRef.current || !inscricao.lab_qr_token || !hasSpecificLab || inscricao.status === "pendente") return;
    QRCode.toCanvas(canvasLabRef.current, inscricao.lab_qr_token, { width: 160, margin: 1 }, () => {
      setDataUrlLab(canvasLabRef.current?.toDataURL("image/png") ?? "");
    });
  }, [inscricao.lab_qr_token, hasSpecificLab, inscricao.status]);

  const statusColor: Record<string, string> = {
    pago: "bg-gold/20 text-primary border-gold/50",
    validado: "bg-primary text-primary-foreground border-primary",
    cancelado: "bg-destructive/10 text-destructive border-destructive/40",
    pendente: "bg-muted text-muted-foreground border-border",
  };

  const showGeralQr = inscricao.status === "pago" || inscricao.status === "validado";
  const showLabQr = isGeneralValidated && hasSpecificLab && !!inscricao.lab_qr_token && (inscricao.status === "pago" || inscricao.status === "validado");

  const baixarPDF = async () => {
    const nome = inscricao.nome_participante;
    const hasLab = inscricao.lab_id && !inscricao.labs?.eh_geral;
    const labNome = inscricao.labs?.nome || "";
    const labLocal = inscricao.labs?.local || "";
    const imgGeral = dataUrlGeral;
    const imgLab = hasLab && inscricao.lab_qr_token ? dataUrlLab : "";

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Outer border dashed box
    doc.setDrawColor(209, 213, 219);
    doc.setLineDashPattern([3, 3], 0);
    doc.rect(20, 20, 170, 200);

    // Title
    doc.setTextColor(181, 146, 71);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text("HOPE CONFERENCE 2026", 105, 45, { align: "center" });

    // Subtitle
    doc.setTextColor(107, 114, 128);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Comprovante de Inscrição", 105, 53, { align: "center" });

    // Divider
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(243, 244, 246);
    doc.line(35, 63, 175, 63);

    // Participant Name Section
    doc.setTextColor(156, 163, 175);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text("PARTICIPANTE", 105, 73, { align: "center" });

    doc.setTextColor(17, 24, 37);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text(nome, 105, 81, { align: "center" });

    if (hasLab) {
      doc.setTextColor(156, 163, 175);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.text("CATEGORIA / LAB", 105, 93, { align: "center" });

      doc.setTextColor(181, 146, 71);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(13);
      doc.text(labNome, 105, 100, { align: "center" });

      doc.setTextColor(17, 24, 37);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Local: ${labLocal}`, 105, 107, { align: "center" });
    }

    // Divider
    doc.setDrawColor(243, 244, 246);
    doc.line(35, 118, 175, 118);

    // QRs layout
    if (imgLab) {
      // Both QRs side-by-side
      doc.setTextColor(107, 114, 128);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("ENTRADA GERAL", 65, 132, { align: "center" });
      doc.addImage(imgGeral, "PNG", 40, 137, 50, 50);

      doc.text("ACESSO LAB", 145, 132, { align: "center" });
      doc.addImage(imgLab, "PNG", 120, 137, 50, 50);
    } else {
      // Only Geral QR centered
      doc.setTextColor(107, 114, 128);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("ENTRADA GERAL", 105, 132, { align: "center" });
      doc.addImage(imgGeral, "PNG", 80, 137, 50, 50);
    }

    // Footer
    doc.setTextColor(156, 163, 175);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Apresente este comprovante nos pontos de acesso para validar sua entrada.", 105, 205, { align: "center" });

    doc.save(`ingresso-${nome.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  };

  return (
    <li className="rounded-xl border border-border bg-card p-5 shadow-sm text-left">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-semibold">PARTICIPANTE</p>
          <p className="font-display text-lg text-primary leading-tight">{inscricao.nome_participante}</p>
          {inscricao.labs && (
            <p className="text-xs text-gold font-semibold mt-1">
              Categoria: {inscricao.labs.nome} ({inscricao.labs.local})
            </p>
          )}
          {inscricao.regional && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Regional: {inscricao.regional === "SEDE" ? "SEDE" : `Regional ${inscricao.regional}`} | Congregação: {inscricao.congregacao || "Nenhuma"}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold tracking-widest uppercase ${statusColor[inscricao.status]}`}>
          {isLabValidated ? "LAB VALIDADO" : (isGeneralValidated && hasSpecificLab ? "GERAL VALIDADO" : inscricao.status)}
        </span>
      </div>

      <div className="mt-3 text-xs text-muted-foreground leading-normal">
        {inscricao.status === "cancelado" && (
          <p className="text-destructive font-medium">Inscrição cancelada.</p>
        )}
        {inscricao.status === "pendente" && (
          <p className="text-amber-500 font-semibold">Aguardando confirmação de pagamento para liberar o ingresso.</p>
        )}
        {inscricao.status === "pago" && (
          <p>Apresente o QR Code abaixo na entrada geral do evento para validar seu ingresso.</p>
        )}
        {isGeneralValidated && !hasSpecificLab && (
          <p className="text-primary font-medium">✓ Entrada geral confirmada! Bom evento.</p>
        )}
        {isGeneralValidated && hasSpecificLab && !isLabValidated && (
          <p className="text-gold font-medium">
            ✓ Entrada geral confirmada! Apresente o **novo QR Code** ao lado no local da sua LAB: **{inscricao.labs?.local}**.
          </p>
        )}
        {isLabValidated && (
          <p className="text-primary font-medium">✓ Presença confirmada no evento e na LAB! Bom evento.</p>
        )}
      </div>

      {showGeralQr && (
        <div className="mt-4 flex flex-col sm:flex-row gap-4 justify-center items-center">
          {/* QR Code Geral */}
          <div className={`relative flex flex-col items-center rounded-lg bg-background p-3 border ${isGeneralValidated ? 'border-primary/40 opacity-70' : 'border-border'}`}>
            <span className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase mb-1">Entrada Geral</span>
            <canvas ref={canvasGeralRef} />
            {isGeneralValidated && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[1px] rounded-lg">
                <span className="text-primary font-bold text-sm">✓ LIDO</span>
                <span className="text-[10px] text-muted-foreground">Entrada Geral</span>
              </div>
            )}
          </div>

          {/* QR Code LAB (always mounted if hasSpecificLab + token exists to render canvas, hidden visually until general check-in) */}
          {hasSpecificLab && inscricao.lab_qr_token && (
            <div className={`relative flex flex-col items-center rounded-lg bg-background p-3 border ${
              !showLabQr ? "hidden" :
              isLabValidated ? 'border-primary/40 opacity-70' : 'border-gold/60 ring-1 ring-gold/20'
            }`}>
              <span className="text-[9px] font-semibold tracking-wider text-gold uppercase mb-1">Acesso LAB</span>
              <canvas ref={canvasLabRef} />
              {isLabValidated && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[1px] rounded-lg">
                  <span className="text-primary font-bold text-sm">✓ LIDO</span>
                  <span className="text-[10px] text-muted-foreground">{inscricao.labs?.nome}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        {showGeralQr && (
          <button
            onClick={baixarPDF}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-xs font-semibold tracking-widest text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            BAIXAR INGRESSO (PDF)
          </button>
        )}
      </div>
    </li>
  );
}

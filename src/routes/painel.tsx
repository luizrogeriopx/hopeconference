import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LocalCard } from "@/components/LocalCard";
import { criarInscricoesPainel } from "@/lib/inscriptions.functions";

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
    { nome: "", labId: "", cpf: "" }
  ]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const inscreverFn = useServerFn(criarInscricoesPainel);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void carregar();
    void carregarLabs();
    void carregarVagas();

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

  useEffect(() => {
    if (labs.length > 0) {
      const generalLab = labs.find((l) => l.eh_geral);
      if (generalLab) {
        setParticipantes((prev) =>
          prev.map((p) => (p.labId ? p : { ...p, labId: generalLab.id }))
        );
      }
    }
  }, [labs]);

  async function carregarLabs() {
    const { data } = await supabase
      .from("labs")
      .select("*")
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
      .select("id, nome_participante, status, qr_token, valor, criado_em, lab_id, lab_qr_token, lab_validado_em, labs(nome, local, eh_geral)")
      .eq("comprador_user_id", user!.id)
      .order("criado_em", { ascending: false });
    if (!error && data) setInscricoes(data as any[]);
    setCarregando(false);
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
        })),
      };
      await inscreverFn({ data: payload });
      const generalLab = labs.find((l) => l.eh_geral);
      setParticipantes([{ nome: "", labId: generalLab?.id || "", cpf: "" }]);
      await carregar();
      await carregarVagas();
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
            <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">
              SAIR
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
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
                      {showCpf && (
                        <div className="space-y-1 sm:max-w-xs">
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
                      const generalLab = labs.find(l => l.eh_geral);
                      setParticipantes([...participantes, { nome: "", labId: generalLab?.id || "", cpf: "" }]);
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
    if (!canvasGeralRef.current || !inscricao.qr_token || inscricao.status === "cancelado") return;
    QRCode.toCanvas(canvasGeralRef.current, inscricao.qr_token, { width: 160, margin: 1 }, () => {
      setDataUrlGeral(canvasGeralRef.current?.toDataURL("image/png") ?? "");
    });
  }, [inscricao.qr_token, inscricao.status]);

  useEffect(() => {
    if (!canvasLabRef.current || !inscricao.lab_qr_token || !hasSpecificLab) return;
    QRCode.toCanvas(canvasLabRef.current, inscricao.lab_qr_token, { width: 160, margin: 1 }, () => {
      setDataUrlLab(canvasLabRef.current?.toDataURL("image/png") ?? "");
    });
  }, [inscricao.lab_qr_token, hasSpecificLab]);

  const statusColor: Record<string, string> = {
    pago: "bg-gold/20 text-primary border-gold/50",
    validado: "bg-primary text-primary-foreground border-primary",
    cancelado: "bg-destructive/10 text-destructive border-destructive/40",
    pendente: "bg-muted text-muted-foreground border-border",
  };

  const showGeralQr = inscricao.status !== "cancelado";
  const showLabQr = isGeneralValidated && hasSpecificLab && !!inscricao.lab_qr_token;

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
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold tracking-widest uppercase ${statusColor[inscricao.status]}`}>
          {isLabValidated ? "LAB VALIDADO" : (isGeneralValidated && hasSpecificLab ? "GERAL VALIDADO" : inscricao.status)}
        </span>
      </div>

      <div className="mt-3 text-xs text-muted-foreground leading-normal">
        {inscricao.status === "cancelado" && (
          <p className="text-destructive font-medium">Inscrição cancelada.</p>
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

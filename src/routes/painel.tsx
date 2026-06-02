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
  labs?: { nome: string; local: string } | null;
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
      .select("id, nome_participante, status, qr_token, valor, criado_em, lab_id, labs(nome, local)")
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, inscricao.qr_token, { width: 220, margin: 1 }, () => {
      setDataUrl(canvasRef.current?.toDataURL("image/png") ?? "");
    });
  }, [inscricao.qr_token]);

  const statusColor: Record<string, string> = {
    pago: "bg-gold/20 text-primary border-gold/50",
    validado: "bg-primary text-primary-foreground border-primary",
    cancelado: "bg-destructive/10 text-destructive border-destructive/40",
    pendente: "bg-muted text-muted-foreground border-border",
  };

  return (
    <li className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase font-semibold">PARTICIPANTE</p>
          <p className="font-display text-lg text-primary leading-tight">{inscricao.nome_participante}</p>
          {inscricao.labs && (
            <p className="text-xs text-gold font-semibold mt-1">
              {inscricao.labs.nome} ({inscricao.labs.local})
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold tracking-widest uppercase ${statusColor[inscricao.status]}`}>
          {inscricao.status}
        </span>
      </div>
      <div className="relative mt-4 flex justify-center rounded-lg bg-background p-3 border border-border">
        <canvas ref={canvasRef} className={inscricao.status === "cancelado" ? "opacity-30" : inscricao.status === "validado" ? "opacity-0" : ""} />
        {inscricao.status === "validado" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black">
            <span className="font-display text-3xl font-bold tracking-widest text-white rotate-[-12deg]">
              USADO
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {dataUrl && inscricao.status !== "cancelado" && inscricao.status !== "validado" && (
          <a href={dataUrl} download={`ingresso-${inscricao.nome_participante.replace(/\s+/g, "-")}.png`}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-xs font-medium tracking-widest text-primary-foreground hover:bg-primary/90">
            BAIXAR QR
          </a>
        )}
      </div>
    </li>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { criarInscricoesRecepcao, confirmarPagamentosRecepcao } from "@/lib/inscriptions.functions";
import { LocalCard } from "@/components/LocalCard";


export const Route = createFileRoute("/recepcao")({
  component: RecepcaoPage,
  head: () => ({ meta: [{ title: "Painel da Recepção — Hope Conference" }] }),
});

type Lab = {
  id: string;
  nome: string;
  limite_vagas: number;
  local: string;
  ativo: boolean;
  requer_cpf: boolean;
  eh_geral: boolean;
  exclusivo_recepcao: boolean;
};

type ParticipanteForm = {
  id?: string;
  nome: string;
  email: string;
  labId: string;
  cpf: string;
  whatsapp: string;
  regional: string;
  congregacao: string;
  ministerioId: string;
};

function formatWhatsBR(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type Ministerio = {
  id: string;
  nome: string;
  ativo: boolean;
};

type UltimaInscricao = {
  id: string;
  nome_participante: string;
  status: string;
  valor: number;
  criado_em: string;
  regional: string;
  congregacao: string;
  labs?: { nome: string } | null;
};

function RecepcaoPage() {
  const navigate = useNavigate();
  const { user, isStaff, loading, signOut } = useAuth();
  
  const [labs, setLabs] = useState<Lab[]>([]);
  const [vagasOcupadas, setVagasOcupadas] = useState<Record<string, number>>({});
  const [totalGeralOcupado, setTotalGeralOcupado] = useState(0);
  const [participantes, setParticipantes] = useState<ParticipanteForm[]>([
    { nome: "", email: "", labId: "", cpf: "", whatsapp: "", regional: "SEDE", congregacao: "", ministerioId: "" }
  ]);
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [ultimasInscricoes, setUltimasInscricoes] = useState<UltimaInscricao[]>([]);
  const [regionaisCongregacoes, setRegionaisCongregacoes] = useState<Record<string, string[]>>({});
  
  const [inscricoesPendentes, setInscricoesPendentes] = useState<any[]>([]);
  const [selecionadasPendentes, setSelecionadasPendentes] = useState<string[]>([]);
  const [buscaPendente, setBuscaPendente] = useState("");
  
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const inscreverRecepcaoFn = useServerFn(criarInscricoesRecepcao);
  const confirmarPagamentoFn = useServerFn(confirmarPagamentosRecepcao);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate({ to: "/auth", search: { redirect: "/recepcao" } });
      } else if (!isStaff) {
        navigate({ to: "/painel" });
      }
    }
  }, [loading, user, isStaff, navigate]);

  async function carregarMinisterios() {
    const { data } = await supabase
      .from("ministerios")
      .select("id, nome, ativo")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (data) setMinisterios(data as Ministerio[]);
  }

  async function carregarRegionaisCongregacoes() {
    const { data } = await supabase
      .from("regional_congregacoes")
      .select("regional, congregacao")
      .order("congregacao", { ascending: true });
    
    if (data) {
      const mapping: Record<string, string[]> = {};
      data.forEach((row) => {
        if (!mapping[row.regional]) {
          mapping[row.regional] = [];
        }
        mapping[row.regional].push(row.congregacao);
      });
      setRegionaisCongregacoes(mapping);
    }
  }

  useEffect(() => {
    if (user && isStaff) {
      void carregarLabs();
      void carregarVagas();
      void carregarUltimasInscricoes();
      void carregarMinisterios();
      void carregarRegionaisCongregacoes();
      void carregarPendentesRecepcao();
    }
  }, [user, isStaff]);

  async function carregarLabs() {
    const { data } = await supabase
      .from("labs")
      .select("id, nome, limite_vagas, local, ativo, requer_cpf, eh_geral, exclusivo_recepcao")
      .eq("eh_geral", false)
      .order("eh_geral", { ascending: true })
      .order("nome", { ascending: true });
    if (data) {
      setLabs(data as Lab[]);
    }
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

  async function carregarUltimasInscricoes() {
    if (!user) return;
    const { data } = await supabase
      .from("inscricoes")
      .select("id, nome_participante, status, valor, criado_em, regional, congregacao, labs(nome)")
      .eq("comprador_user_id", user.id)
      .order("criado_em", { ascending: false })
      .limit(10);
    if (data) {
      setUltimasInscricoes(data as any[]);
    }
  }

  async function carregarPendentesRecepcao() {
    const { data } = await supabase
      .from("inscricoes")
      .select("id, nome_participante, email, valor, criado_em, regional, congregacao, labs(nome)")
      .eq("status", "pendente")
      .order("criado_em", { ascending: false });
    if (data) setInscricoesPendentes(data as any[]);
  }

  async function confirmarPagamentoPresencial(ids: string[], metodo: "dinheiro" | "isento") {
    if (ids.length === 0) return;
    setEnviando(true);
    try {
      await confirmarPagamentoFn({
        data: {
          inscricaoIds: ids,
          metodoPagamento: metodo,
        }
      });
      alert("Pagamento presencial confirmado com sucesso!");
      setSelecionadasPendentes([]);
      await carregarVagas();
      await carregarUltimasInscricoes();
      await carregarPendentesRecepcao();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao confirmar pagamento.");
    } finally {
      setEnviando(false);
    }
  }

  // Calcula valores dinamicamente
  const sumTotal = participantes.reduce((acc, p) => {
    const lab = labs.find(l => l.id === p.labId);
    const isFree = lab?.nome === "Liderança Ministerial e Obreiros" || lab?.nome?.startsWith("Dirigentes e Coordenadores");
    return acc + (isFree ? 0 : 50);
  }, 0);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const validos = participantes.filter(p => p.nome.trim());
    if (validos.length === 0) {
      setErro("Adicione pelo menos um participante com nome.");
      return;
    }

    // Valida campos obrigatórios (LAB selecionado)
    for (const p of validos) {
      if (!p.labId) {
        setErro("Selecione a Categoria (LAB) de todos os participantes.");
        return;
      }
      const selectedLab = labs.find(l => l.id === p.labId);
      if (selectedLab?.requer_cpf && !p.cpf) {
        setErro(`O CPF é obrigatório para a categoria "${selectedLab.nome}".`);
        return;
      }
      const d = p.whatsapp.replace(/\D/g, "");
      if (d.length < 10 || d.length > 11) {
        setErro(`Informe o WhatsApp do participante "${p.nome.trim()}" com DDD.`);
        return;
      }
    }

    setEnviando(true);
    try {
      const payload = {
        participantes: validos.map(p => ({
          nome: p.nome.trim(),
          email: p.email.trim().toLowerCase(),
          labId: p.labId,
          cpf: p.cpf ? p.cpf.trim() : undefined,
          whatsapp: p.whatsapp.replace(/\D/g, ""),
          regional: p.regional,
          congregacao: p.regional === "SEDE" ? "SEDE" : p.congregacao.trim(),
          ministerioId: p.regional === "SEDE" ? (p.ministerioId || null) : null,
        })),
        metodoPagamento: sumTotal === 0 ? ("isento" as const) : ("dinheiro" as const),
      };

      const res = await inscreverRecepcaoFn({ data: payload });
      setSucesso(`Inscrição presencial realizada com sucesso! As credenciais de acesso provisórias foram geradas (E-mail informado, senha provisória: 123456) para acesso ao painel (https://hopeconference.lovable.app/painel) onde estarão os QR Codes.`);
      
      const generalLab = labs.find(l => l.eh_geral);
      setParticipantes([{ nome: "", email: "", labId: generalLab?.id || "", cpf: "", whatsapp: "", regional: "SEDE", congregacao: "", ministerioId: "" }]);
      
      await carregarVagas();
      await carregarUltimasInscricoes();
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
          <Link to="/recepcao" className="font-display text-xl text-primary">Hope Conference — Recepção</Link>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-muted-foreground">Operador: {user.email}</span>
            <Link to="/admin" className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">ADMIN</Link>
            <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">SAIR</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-2xl text-primary">Inscrição Presencial</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Insira os dados dos participantes atendidos presencialmente no balcão.
            </p>

            <form onSubmit={submeter} className="mt-6 space-y-4">
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

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">NOME COMPLETO</label>
                        <input
                          value={p.nome}
                          onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                          placeholder="Nome do participante"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">E-MAIL</label>
                        <input
                          value={p.email}
                          onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                          placeholder="exemplo@email.com"
                          type="email"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">WHATSAPP (COM DDD)</label>
                        <input
                          value={p.whatsapp}
                          onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, whatsapp: formatWhatsBR(e.target.value) } : x)))}
                          placeholder="(00) 00000-0000"
                          inputMode="numeric"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">CATEGORIA (LAB)</label>
                        <select
                          value={p.labId}
                          onChange={(e) => setParticipantes(participantes.map((x, j) => (j === i ? { ...x, labId: e.target.value, cpf: "" } : x)))}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                          required
                        >
                          <option value="" disabled>Selecione a categoria</option>
                          {labs.map((l) => {
                            const ocupadas = l.eh_geral ? totalGeralOcupado : (vagasOcupadas[l.id] || 0);
                            const restantes = Math.max(0, l.limite_vagas - ocupadas);
                            const esgotado = restantes <= 0 || !l.ativo;
                            const isFree = l.nome === "Liderança Ministerial e Obreiros" || l.nome?.startsWith("Dirigentes e Coordenadores");
                            const displayName = l.nome === "Liderança Ministerial e Obreiros" ? "Liderança Ministerial" : l.nome;
                            return (
                              <option key={l.id} value={l.id} disabled={esgotado}>
                                {displayName} ({l.local}) {isFree ? "— ISENTO" : ""} — {esgotado ? "ESGOTADO" : `${restantes} vagas`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">REGIONAL</label>
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
                          <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">CONGREGAÇÃO</label>
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
                        <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">MINISTÉRIO</label>
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
                        <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">CPF do Pastor</label>
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

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const generalLab = labs.find(l => l.eh_geral);
                    setParticipantes([...participantes, { nome: "", email: "", labId: generalLab?.id || "", cpf: "", whatsapp: "", regional: "SEDE", congregacao: "", ministerioId: "" }]);
                  }}
                  className="text-xs tracking-widest text-primary font-semibold hover:underline"
                >
                  + ADICIONAR PARTICIPANTE
                </button>
              </div>

              {erro && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{erro}</div>}
              {sucesso && <div className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-primary font-medium">{sucesso}</div>}

              <div className="pt-4 border-t border-border">
                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full rounded-md bg-gold px-6 py-3 text-sm font-semibold tracking-widest text-primary hover:bg-gold/90 transition-colors disabled:opacity-50"
                >
                  {enviando ? "PROCESSANDO..." : sumTotal > 0 ? `CONFIRMAR RECEBIMENTO (DINHEIRO: R$ ${sumTotal.toFixed(2)})` : "CONFIRMAR INSCRIÇÃO GRATUITA (ISENTO)"}
                </button>
              </div>
            </form>
          </section>

          {/* Confirmação de Inscrições Pendentes */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm text-left">
            <h2 className="font-display text-xl text-primary">Confirmar Pagamento de Pendentes</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Marque as inscrições pendentes do sistema que deseja confirmar o pagamento presencialmente.
            </p>

            <div className="mt-4">
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                value={buscaPendente}
                onChange={(e) => setBuscaPendente(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-gold"
              />
            </div>

            <div className="mt-4 overflow-x-auto max-h-[300px] overflow-y-auto border border-border rounded-lg">
              <table className="w-full min-w-[500px] text-xs">
                <thead className="sticky top-0 bg-card border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider text-left z-10">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={
                          inscricoesPendentes.length > 0 &&
                          inscricoesPendentes
                            .filter((insc) => {
                              const b = buscaPendente.toLowerCase().trim();
                              return (
                                !b ||
                                insc.nome_participante.toLowerCase().includes(b) ||
                                (insc.email && insc.email.toLowerCase().includes(b))
                              );
                            })
                            .every((insc) => selecionadasPendentes.includes(insc.id))
                        }
                        onChange={(e) => {
                          const filtradas = inscricoesPendentes.filter((insc) => {
                            const b = buscaPendente.toLowerCase().trim();
                            return (
                              !b ||
                              insc.nome_participante.toLowerCase().includes(b) ||
                              (insc.email && insc.email.toLowerCase().includes(b))
                            );
                          });
                          if (e.target.checked) {
                            const todosIds = Array.from(new Set([...selecionadasPendentes, ...filtradas.map(f => f.id)]));
                            setSelecionadasPendentes(todosIds);
                          } else {
                            const filtradasIds = filtradas.map(f => f.id);
                            setSelecionadasPendentes(selecionadasPendentes.filter(id => !filtradasIds.includes(id)));
                          }
                        }}
                        className="rounded border-input text-gold focus:ring-gold h-4 w-4 bg-background cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Participante / E-mail</th>
                    <th className="p-3">Categoria (LAB)</th>
                    <th className="p-3">Regional / Congregação</th>
                    <th className="p-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inscricoesPendentes
                    .filter((insc) => {
                      const b = buscaPendente.toLowerCase().trim();
                      return (
                        !b ||
                        insc.nome_participante.toLowerCase().includes(b) ||
                        (insc.email && insc.email.toLowerCase().includes(b))
                      );
                    })
                    .map((insc) => {
                      const isChecked = selecionadasPendentes.includes(insc.id);
                      return (
                        <tr key={insc.id} className="hover:bg-muted/30">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelecionadasPendentes([...selecionadasPendentes, insc.id]);
                                } else {
                                  setSelecionadasPendentes(selecionadasPendentes.filter(id => id !== insc.id));
                                }
                              }}
                              className="rounded border-input text-gold focus:ring-gold h-4 w-4 bg-background cursor-pointer"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-primary">{insc.nome_participante}</div>
                            <div className="text-muted-foreground text-[10px]">{insc.email || "Sem e-mail"}</div>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {insc.labs?.nome || "Entrada Geral"}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            Reg. {String(insc.regional).padStart(2, "0")} - {insc.congregacao}
                          </td>
                          <td className="p-3 text-right font-medium text-primary">
                            R$ {insc.valor.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  {inscricoesPendentes.filter((insc) => {
                    const b = buscaPendente.toLowerCase().trim();
                    return (
                      !b ||
                      insc.nome_participante.toLowerCase().includes(b) ||
                      (insc.email && insc.email.toLowerCase().includes(b))
                    );
                  }).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Nenhuma inscrição pendente encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selecionadasPendentes.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-gold/5 border border-gold/20 flex flex-wrap items-center justify-between gap-3 z-10 relative">
                <div className="text-sm">
                  <span className="font-semibold text-primary">{selecionadasPendentes.length}</span> selecionada(s) | Total:{" "}
                  <strong className="text-primary text-base">
                    R$ {inscricoesPendentes
                      .filter(i => selecionadasPendentes.includes(i.id))
                      .reduce((s, i) => s + i.valor, 0)
                      .toFixed(2)}
                  </strong>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={enviando}
                    onClick={() => confirmarPagamentoPresencial(selecionadasPendentes, "dinheiro")}
                    className="rounded-md bg-gold px-4 py-2 text-xs font-semibold tracking-widest text-primary-foreground hover:bg-gold/90 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    PAGO EM DINHEIRO
                  </button>
                  <button
                    disabled={enviando}
                    onClick={() => confirmarPagamentoPresencial(selecionadasPendentes, "isento")}
                    className="rounded-md border border-border px-4 py-2 text-xs font-semibold tracking-widest text-primary hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    ISENTAR (GRÁTIS)
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Últimas Inscrições da Sessão */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm text-left">
            <h2 className="font-display text-xl text-primary">Minhas Inscrições Recentes</h2>
            <p className="text-xs text-muted-foreground">Inscrições presenciais cadastradas pelo seu usuário operador.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider text-left">
                    <th className="py-2">Participante</th>
                    <th className="py-2">Categoria</th>
                    <th className="py-2">Regional</th>
                    <th className="py-2 text-right">Valor</th>
                    <th className="py-2 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ultimasInscricoes.map((insc) => (
                    <tr key={insc.id}>
                      <td className="py-2 text-primary font-medium">{insc.nome_participante}</td>
                      <td className="py-2 text-muted-foreground">
                        {insc.labs?.nome === "Liderança Ministerial e Obreiros"
                          ? "Liderança Ministerial"
                          : insc.labs?.nome || "Geral"}
                      </td>
                      <td className="py-2 text-muted-foreground">{insc.regional}</td>
                      <td className="py-2 text-right text-muted-foreground">R$ {insc.valor.toFixed(2)}</td>
                      <td className="py-2 text-right text-muted-foreground">{new Date(insc.criado_em).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                  {ultimasInscricoes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">Nenhuma inscrição realizada recentemente.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside>
          <LocalCard />
        </aside>
      </div>
    </main>
  );
}

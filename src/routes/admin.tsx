import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  criarUsuarioPainel,
  listarUsuariosPainel,
  removerUsuarioPainel,
} from "@/lib/users.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Hope Conference" }] }),
});

type Inscricao = {
  id: string;
  nome_participante: string;
  email: string | null;
  telefone?: string | null;
  status: "pendente" | "pago" | "cancelado" | "validado";
  valor: number;
  criado_em: string;
  validado_em: string | null;
  cpf: string | null;
  lab_id: string | null;
  qr_token: string;
  lab_qr_token?: string | null;
  regional: string;
  congregacao: string;
  labs?: { nome: string; local?: string; requer_cpf: boolean; eh_geral?: boolean } | null;
  ministerio_id?: string | null;
  ministerios?: { nome: string } | null;
  canal?: string | null;
  pagamentos?: { metodo: string }[] | null;
};
type UsuarioPainel = { user_id: string; role: string; nome: string; email: string; criado_em: string; lab_id?: string | null; lab_nome?: string };

type Ministerio = {
  id: string;
  nome: string;
  ativo: boolean;
  criado_em: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const { user, isStaff, isSuper, loading, signOut } = useAuth();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/admin" } });
    if (!loading && user && !isStaff) navigate({ to: "/painel" });
  }, [loading, user, isStaff, navigate]);

  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPainel[]>([]);
  const [busca, setBusca] = useState("");
  const [regionalSelecionada, setRegionalSelecionada] = useState<string | null>(null);
  const [labSelecionado, setLabSelecionado] = useState<string | null>(null);
  const [ministerioSelecionado, setMinisterioSelecionado] = useState<string | null>(null);
  const [labs, setLabs] = useState<any[]>([]);
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [totalDinheiro, setTotalDinheiro] = useState(0);
  const listar = useServerFn(listarUsuariosPainel);
  const criar = useServerFn(criarUsuarioPainel);
  const remover = useServerFn(removerUsuarioPainel);

  useEffect(() => { if (user && isStaff) void carregar(); }, [user, isStaff]);

  async function carregar() {
    const { data } = await supabase
      .from("inscricoes")
      .select("id, nome_participante, email, status, valor, criado_em, validado_em, cpf, lab_id, qr_token, lab_qr_token, regional, congregacao, labs(nome, local, requer_cpf), ministerio_id, ministerios(nome), canal, pagamentos(metodo)")
      .order("criado_em", { ascending: false });
    setInscricoes((data ?? []) as Inscricao[]);

    const { data: pgDinheiro } = await supabase
      .from("pagamentos")
      .select("valor")
      .eq("metodo", "dinheiro")
      .eq("status", "pago");
    const totalD = (pgDinheiro ?? []).reduce((s, p) => s + Number(p.valor), 0);
    setTotalDinheiro(totalD);

    const { data: labsData } = await supabase
      .from("labs")
      .select("id, nome, local, eh_geral")
      .order("eh_geral", { ascending: true })
      .order("nome", { ascending: true });
    if (labsData) setLabs(labsData);

    const { data: ministeriosData } = await supabase
      .from("ministerios")
      .select("*")
      .order("nome", { ascending: true });
    if (ministeriosData) setMinisterios(ministeriosData as Ministerio[]);

    try { setUsuarios(await listar()); } catch { /* noop */ }
  }

  const stats = useMemo(() => {
    const pagas = inscricoes.filter((i) => i.status === "pago" || i.status === "validado");
    const validadas = inscricoes.filter((i) => i.status === "validado");
    const canceladas = inscricoes.filter((i) => i.status === "cancelado");
    const receita = pagas.reduce((s, i) => s + Number(i.valor), 0);
    
    const regionais = [...Array.from({ length: 20 }, (_, idx) => String(idx + 2)), "SEDE"];
    const regionalCounts: Record<string, number> = {};
    regionais.forEach((r) => {
      regionalCounts[r] = pagas.filter((i) => i.regional === r).length;
    });

    const labCounts: Record<string, number> = {};
    pagas.forEach((i) => {
      if (i.lab_id) labCounts[i.lab_id] = (labCounts[i.lab_id] ?? 0) + 1;
    });

    const ministerioCounts: Record<string, number> = {};
    pagas.forEach((i) => {
      if (i.ministerio_id) ministerioCounts[i.ministerio_id] = (ministerioCounts[i.ministerio_id] ?? 0) + 1;
    });

    return { 
      total: inscricoes.length, 
      pagas: pagas.length, 
      validadas: validadas.length, 
      canceladas: canceladas.length, 
      receita,
      regionalCounts,
      labCounts,
      ministerioCounts,
      totalDinheiro,
    };
  }, [inscricoes, totalDinheiro]);

  const filtradas = useMemo(() => {
    return inscricoes.filter((i) => {
      const matchesBusca = !busca ||
        i.nome_participante.toLowerCase().includes(busca.toLowerCase()) ||
        (i.email ?? "").toLowerCase().includes(busca.toLowerCase());
      const matchesRegional = !regionalSelecionada || i.regional === regionalSelecionada;
      const matchesLab = !labSelecionado || i.lab_id === labSelecionado;
      const matchesMinisterio = !ministerioSelecionado || i.ministerio_id === ministerioSelecionado;
      return matchesBusca && matchesRegional && matchesLab && matchesMinisterio;
    });
  }, [inscricoes, busca, regionalSelecionada, labSelecionado, ministerioSelecionado]);

  if (loading || !user) {
    return <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando…</main>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="font-display text-xl text-primary">Hope Conference — Admin</Link>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-muted-foreground">{user.email}</span>
            {isSuper && <Link to="/super" className="rounded-md border border-gold bg-gold/10 px-3 py-2 tracking-widest text-primary">SUPER</Link>}
            <Link to="/painel" className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">PAINEL</Link>
            <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">SAIR</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <Cards stats={stats} />
        <RegionalCards
          stats={stats}
          selectedRegional={regionalSelecionada}
          onSelectRegional={setRegionalSelecionada}
        />

        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
            Inscrições Confirmadas por LABs
          </h3>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
            {labs.map((l: any) => (
              <div
                key={l.id}
                className="rounded-xl border border-border bg-card/60 p-3 shadow-sm flex flex-col justify-between items-start text-left w-full"
              >
                <span className="text-[9px] tracking-wider uppercase text-muted-foreground truncate w-full" title={l.nome}>{l.nome}</span>
                <span className="mt-1 font-display text-lg text-primary font-bold">
                  {stats.labCounts[l.id] ?? 0}
                </span>
              </div>
            ))}
            {labs.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-full">Nenhum LAB cadastrado.</p>
            )}
          </section>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
            Inscrições Confirmadas por Ministério
          </h3>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
            {ministerios.filter((m) => m.ativo).map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-border bg-card/60 p-3 shadow-sm flex flex-col justify-between items-start text-left w-full"
              >
                <span className="text-[9px] tracking-wider uppercase text-muted-foreground truncate w-full" title={m.nome}>{m.nome}</span>
                <span className="mt-1 font-display text-lg text-primary font-bold">
                  {stats.ministerioCounts[m.id] ?? 0}
                </span>
              </div>
            ))}
            {ministerios.filter((m) => m.ativo).length === 0 && (
              <p className="text-xs text-muted-foreground col-span-full">Nenhum ministério cadastrado.</p>
            )}
          </section>
        </div>

        <ListaInscricoes inscricoes={filtradas} busca={busca} setBusca={setBusca} />
        <ListaPastoresCoordenadores inscricoes={filtradas} />

      </div>
    </main>
  );
}

export function Cards({ stats }: { stats: { total: number; pagas: number; validadas: number; canceladas: number; receita: number; totalDinheiro: number } }) {
  const items = [
    { label: "Inscrições", v: stats.total },
    { label: "Pagas / Ativas", v: stats.pagas },
    { label: "Validadas", v: stats.validadas },
    { label: "Receita Geral", v: `R$ ${stats.receita.toFixed(2)}` },
    { label: "Caixa Dinheiro (Recepção)", v: `R$ ${(stats.totalDinheiro ?? 0).toFixed(2)}` },
  ];
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground">{i.label}</p>
          <p className="mt-2 font-display text-2xl text-primary">{i.v}</p>
        </div>
      ))}
    </section>
  );
}

export function RegionalCards({
  stats,
  selectedRegional,
  onSelectRegional,
}: {
  stats: { regionalCounts: Record<string, number> };
  selectedRegional?: string | null;
  onSelectRegional?: (r: string | null) => void;
}) {
  const regionais = [...Array.from({ length: 20 }, (_, idx) => String(idx + 2)), "SEDE"];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between min-h-[20px]">
        <h3 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
          Inscrições Confirmadas por Regional
        </h3>
        {selectedRegional && onSelectRegional && (
          <button
            type="button"
            onClick={() => onSelectRegional(null)}
            className="text-[10px] tracking-widest text-gold hover:underline uppercase font-bold"
          >
            LIMPAR FILTRO
          </button>
        )}
      </div>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
        {regionais.map((r) => {
          const count = stats.regionalCounts[r] ?? 0;
          const label = r === "SEDE" ? "Sede" : `Reg. ${r}`;
          const isSelected = selectedRegional === r;

          if (onSelectRegional) {
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  console.log("Selecionando regional:", r, "isSelected:", isSelected);
                  onSelectRegional(isSelected ? null : r);
                }}
                className={`rounded-xl border p-3 shadow-sm flex flex-col justify-between items-start transition-all text-left w-full cursor-pointer hover:border-gold hover:bg-gold/5 ${
                  isSelected
                    ? "border-gold bg-gold/10 text-primary"
                    : "border-border bg-card/60 text-foreground"
                }`}
              >
                <span className="text-[9px] tracking-wider uppercase text-muted-foreground">{label}</span>
                <span className={`mt-1 font-display text-lg font-bold ${isSelected ? "text-gold" : "text-primary"}`}>
                  {count}
                </span>
              </button>
            );
          }

          return (
            <div
              key={r}
              className="rounded-xl border border-border bg-card/60 p-3 shadow-sm flex flex-col justify-between items-start text-left w-full"
            >
              <span className="text-[9px] tracking-wider uppercase text-muted-foreground">{label}</span>
              <span className="mt-1 font-display text-lg text-primary font-bold">
                {count}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export function ListaInscricoes({
  inscricoes,
  busca,
  setBusca,
  onExcluir,
  onAlterarLab,
  onEditar,
  labs,
  congregacoes,
  ministerios,
  mostrarBaixarIngresso,
}: {
  inscricoes: Inscricao[];
  busca: string;
  setBusca: (s: string) => void;
  onExcluir?: (id: string) => void;
  onAlterarLab?: (id: string, labId: string) => Promise<void> | void;
  onEditar?: (id: string, dados: { nome_participante: string; email: string | null; telefone: string | null; regional: string; congregacao: string; ministerio_id: string | null }) => Promise<void> | void;
  labs?: { id: string; nome: string; local: string; eh_geral: boolean }[];
  congregacoes?: { id: string; regional: string; congregacao: string }[];
  ministerios?: { id: string; nome: string }[];
  mostrarBaixarIngresso?: boolean;
}) {
  const [editando, setEditando] = useState<Inscricao | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editRegional, setEditRegional] = useState("");
  const [editCongregacao, setEditCongregacao] = useState("");
  const [editMinisterioId, setEditMinisterioId] = useState<string>("");
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  const regionaisDisponiveis = useMemo(
    () => [...Array.from({ length: 20 }, (_, idx) => String(idx + 2)), "SEDE"],
    []
  );

  const congregacoesDaRegional = useMemo(() => {
    if (!congregacoes || !editRegional || editRegional === "SEDE") return [];
    return congregacoes.filter((c) => c.regional === editRegional);
  }, [congregacoes, editRegional]);

  function abrirEdicao(i: Inscricao) {
    setEditando(i);
    setEditNome(i.nome_participante || "");
    setEditEmail(i.email || "");
    setEditTelefone(i.telefone || "");
    setEditRegional(i.regional || "");
    setEditCongregacao(i.congregacao || "");
    setEditMinisterioId(i.ministerio_id || "");
  }

  async function salvarEdicao() {
    if (!editando || !onEditar) return;
    if (!editNome.trim()) { alert("Nome é obrigatório."); return; }
    if (!editRegional) { alert("Regional é obrigatória."); return; }
    if (editRegional !== "SEDE" && !editCongregacao.trim()) { alert("Congregação é obrigatória."); return; }
    setSalvandoEdit(true);
    try {
      await onEditar(editando.id, {
        nome_participante: editNome.trim(),
        email: editEmail.trim() || null,
        telefone: editTelefone.trim() || null,
        regional: editRegional,
        congregacao: editRegional === "SEDE" ? "SEDE" : editCongregacao.trim(),
        ministerio_id: editRegional === "SEDE" ? (editMinisterioId || null) : null,
      });
      setEditando(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvandoEdit(false);
    }
  }

  async function baixarIngresso(i: Inscricao) {
    const nome = i.nome_participante;
    const hasLab = i.lab_id && !i.labs?.eh_geral;
    const labNome = i.labs?.nome || "";
    const labLocal = i.labs?.local || "";

    const [imgGeral, imgLab] = await Promise.all([
      new Promise<string>((resolve) => {
        if (!i.qr_token || i.status === "cancelado" || i.status === "pendente") {
          resolve("");
          return;
        }
        QRCode.toDataURL(i.qr_token, { width: 160, margin: 1 }, (err, url) => {
          resolve(err ? "" : url);
        });
      }),
      new Promise<string>((resolve) => {
        if (!i.lab_qr_token || !hasLab || i.status === "pendente") {
          resolve("");
          return;
        }
        QRCode.toDataURL(i.lab_qr_token, { width: 160, margin: 1 }, (err, url) => {
          resolve(err ? "" : url);
        });
      }),
    ]);

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    doc.setDrawColor(209, 213, 219);
    doc.setLineDashPattern([3, 3], 0);
    doc.rect(20, 20, 170, 200);

    doc.setTextColor(181, 146, 71);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text("HOPE CONFERENCE 2026", 105, 45, { align: "center" });

    doc.setTextColor(107, 114, 128);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Comprovante de Inscrição", 105, 53, { align: "center" });

    doc.setLineDashPattern([], 0);
    doc.setDrawColor(243, 244, 246);
    doc.line(35, 63, 175, 63);

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

    doc.setDrawColor(243, 244, 246);
    doc.line(35, 118, 175, 118);

    if (imgLab) {
      doc.setTextColor(107, 114, 128);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("ENTRADA GERAL", 65, 132, { align: "center" });
      doc.addImage(imgGeral, "PNG", 40, 137, 50, 50);

      doc.text("ACESSO LAB", 145, 132, { align: "center" });
      doc.addImage(imgLab, "PNG", 120, 137, 50, 50);
    } else {
      doc.setTextColor(107, 114, 128);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.text("ENTRADA GERAL", 105, 132, { align: "center" });
      doc.addImage(imgGeral, "PNG", 80, 137, 50, 50);
    }

    doc.setTextColor(156, 163, 175);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Apresente este comprovante nos pontos de acesso para validar sua entrada.", 105, 205, { align: "center" });

    doc.save(`ingresso-${nome.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  }

  const colSpan = 13 + (onEditar || onExcluir || mostrarBaixarIngresso ? 1 : 0);

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl text-primary">Inscritos</h2>
          <span className="rounded-md border border-border bg-background px-2.5 py-1 text-[10px] tracking-widest uppercase text-muted-foreground">{inscricoes.length} Total</span>
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail" className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="sticky top-0 z-10 bg-card text-left text-xs tracking-widest uppercase text-muted-foreground shadow-[0_1px_0_0_var(--color-border)]">
            <tr>
              <th className="p-3 bg-card">Nome</th>
              <th className="p-3 bg-card">CPF</th>
              <th className="p-3 bg-card">E-mail</th>
              <th className="p-3 bg-card">WhatsApp</th>
              <th className="p-3 bg-card">Categoria</th>
              <th className="p-3 bg-card">Regional</th>
              <th className="p-3 bg-card">Congregação</th>
              <th className="p-3 bg-card">Ministério</th>
              <th className="p-3 bg-card">Status</th>
              <th className="p-3 bg-card">Origem</th>
              <th className="p-3 bg-card">Forma Pgto.</th>
              <th className="p-3 bg-card">Valor</th>
              <th className="p-3 bg-card">Data</th>
              {(onEditar || onExcluir) && <th className="p-3 bg-card text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {inscricoes.map((i) => (
              <tr key={i.id} className={`border-t border-border ${i.status === "pendente" ? "bg-amber-500/10" : ""}`}>
                <td className="p-3 text-primary font-medium">{i.nome_participante}</td>
                <td className="p-3 text-muted-foreground font-mono">{i.cpf ? i.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "-"}</td>
                <td className="p-3 text-muted-foreground">{i.email}</td>
                <td className="p-3 text-muted-foreground">
                  {i.telefone ? (
                    <div className="flex items-center gap-2">
                      <span>{i.telefone}</span>
                      {(() => {
                        const digits = (i.telefone || "").replace(/\D/g, "");
                        if (!digits) return null;
                        const phone = digits.startsWith("55") ? digits : `55${digits}`;
                        const msg = i.status === "pago"
                          ? "Obrigado por se inscrever na HOPE CONFERENCE, serão 3 dias extraordinários na sua vida!"
                          : i.status === "pendente"
                          ? "Olá, a Paz do Senhor! vi que tentou se inscrever na HOPE CONFERENCE más não conclui o pagamento da inscrição, você teve alguma dificuldade com a inscrição? Precisa da minha ajuda?"
                          : null;
                        if (!msg) return null;
                        const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir WhatsApp"
                            className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-green-600 hover:bg-green-500/10"
                          >
                            WHATSAPP
                          </a>
                        );
                      })()}
                    </div>
                  ) : "-"}
                </td>
                <td className="p-3 text-muted-foreground">
                  {onAlterarLab && labs && labs.length > 0 ? (
                    <select
                      value={i.lab_id || ""}
                      onChange={(e) => onAlterarLab(i.id, e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-gold"
                    >
                      {labs.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nome} ({l.local})
                        </option>
                      ))}
                    </select>
                  ) : (
                    i.labs?.nome || "Geral"
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{i.regional === "SEDE" ? "SEDE" : `Regional ${i.regional}`}</td>
                <td className="p-3 text-muted-foreground">{i.congregacao || "-"}</td>
                <td className="p-3 text-muted-foreground">{i.regional === "SEDE" ? (i.ministerios?.nome || "-") : "-"}</td>
                <td className="p-3"><span className="rounded-md border border-border bg-background px-2 py-1 text-[10px] tracking-widest uppercase">{i.status}</span></td>
                <td className="p-3 text-muted-foreground">
                  {i.canal === "recepcao" ? "Secretaria (/recepcao)" : "Internet (/painel)"}
                </td>
                <td className="p-3 text-muted-foreground capitalize">
                  {i.pagamentos && i.pagamentos.length > 0
                    ? (i.pagamentos[0].metodo === "mock" ? "Simulado (Mock)" : i.pagamentos[0].metodo === "mercado_pago" ? "Mercado Pago" : i.pagamentos[0].metodo)
                    : (i.valor === 0 ? "Isento" : "—")}
                </td>
                <td className="p-3 text-muted-foreground">R$ {Number(i.valor).toFixed(2)}</td>
                <td className="p-3 text-muted-foreground">{new Date(i.criado_em).toLocaleDateString("pt-BR")}</td>
                {(onEditar || onExcluir || mostrarBaixarIngresso) && (
                  <td className="p-3 text-right whitespace-nowrap">
                    {mostrarBaixarIngresso && (i.status === "pago" || i.status === "validado") && (
                      <button
                        onClick={() => baixarIngresso(i)}
                        className="mr-2 rounded-md border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] tracking-widest text-primary hover:bg-gold/20"
                      >
                        BAIXAR INGRESSO
                      </button>
                    )}
                    {onEditar && (
                      <button
                        onClick={() => abrirEdicao(i)}
                        className="mr-2 rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-primary hover:bg-primary/10"
                      >
                        EDITAR
                      </button>
                    )}
                    {onExcluir && (
                      <button
                        onClick={() => onExcluir(i.id)}
                        className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] tracking-widest text-destructive hover:bg-destructive/10"
                      >
                        EXCLUIR
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {inscricoes.length === 0 && (
              <tr><td colSpan={colSpan} className="p-6 text-center text-sm text-muted-foreground">Nenhuma inscrição.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !salvandoEdit && setEditando(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg text-primary">Editar inscrição</h3>
            <p className="mt-1 text-xs text-muted-foreground">O QR Code gerado não será alterado.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Nome</label>
                <input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
              </div>
              <div>
                <label className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1">E-mail</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
              </div>
              <div>
                <label className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1">WhatsApp</label>
                <input value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} placeholder="(00) 00000-0000" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
              </div>
              <div>
                <label className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Regional</label>
                <select
                  value={editRegional}
                  onChange={(e) => { setEditRegional(e.target.value); setEditCongregacao(""); }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                >
                  <option value="">Selecione...</option>
                  {regionaisDisponiveis.map((r) => (
                    <option key={r} value={r}>{r === "SEDE" ? "SEDE" : `Regional ${r}`}</option>
                  ))}
                </select>
              </div>
              {editRegional && editRegional !== "SEDE" && (
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Congregação</label>
                  {congregacoesDaRegional.length > 0 ? (
                    <select
                      value={editCongregacao}
                      onChange={(e) => setEditCongregacao(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                    >
                      <option value="">Selecione...</option>
                      {congregacoesDaRegional.map((c) => (
                        <option key={c.id} value={c.congregacao}>{c.congregacao}</option>
                      ))}
                      {editCongregacao && !congregacoesDaRegional.some((c) => c.congregacao === editCongregacao) && (
                        <option value={editCongregacao}>{editCongregacao} (atual)</option>
                      )}
                    </select>
                  ) : (
                    <input
                      value={editCongregacao}
                      onChange={(e) => setEditCongregacao(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                    />
                  )}
                </div>
              )}
              {editRegional === "SEDE" && ministerios && (
                <div>
                  <label className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Ministério</label>
                  <select
                    value={editMinisterioId}
                    onChange={(e) => setEditMinisterioId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                  >
                    <option value="">— Sem ministério —</option>
                    {ministerios.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={salvandoEdit} onClick={() => setEditando(null)} className="rounded-md border border-border px-3 py-2 text-xs tracking-widest text-muted-foreground hover:bg-muted/30 disabled:opacity-50">CANCELAR</button>
              <button disabled={salvandoEdit} onClick={salvarEdicao} className="rounded-md bg-primary px-4 py-2 text-xs tracking-widest text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{salvandoEdit ? "SALVANDO..." : "SALVAR"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function GestaoUsuarios({
  usuarios,
  podeCriarAdmin,
  labs,
  onCriar,
  onRemover,
}: {
  usuarios: UsuarioPainel[];
  podeCriarAdmin: boolean;
  labs: { id: string; nome: string; local: string; eh_geral: boolean }[];
  onCriar: (p: {
    email: string;
    senha: string;
    nome: string;
    role: "admin" | "gate" | "recepcao";
    labId?: string | null;
  }) => Promise<void>;
  onRemover: (u: UsuarioPainel) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<"admin" | "gate" | "recepcao">("gate");
  const [selectedLabId, setSelectedLabId] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setEnviando(true);
    try {
      await onCriar({
        email,
        senha,
        nome,
        role,
        labId: role === "gate" ? (selectedLabId || null) : null,
      });
      setEmail(""); setSenha(""); setNome(""); setSelectedLabId("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    } finally { setEnviando(false); }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm text-left">
        <h2 className="font-display text-xl text-primary">Cadastrar usuário</h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input required placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
          <input required type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
          <input required type="password" minLength={6} placeholder="Senha (mín. 6)" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "gate" | "recepcao")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold">
            <option value="gate">Controle de Acesso (gate)</option>
            <option value="recepcao">Recepção / Inscrição Presencial</option>
            {podeCriarAdmin && <option value="admin">Admin</option>}
          </select>
          {role === "gate" && (
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground text-left block">Portaria / Setor</label>
              <select value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold">
                <option value="">Entrada Principal (Geral)</option>
                {labs.filter(l => !l.eh_geral).map((l) => (
                  <option key={l.id} value={l.id}>
                    Portaria LAB: {l.nome} ({l.local})
                  </option>
                ))}
              </select>
            </div>
          )}
          {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          <button disabled={enviando} className="w-full rounded-md bg-primary px-4 py-2 text-sm tracking-widest text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {enviando ? "CRIANDO..." : "CRIAR USUÁRIO"}
          </button>
        </form>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm text-left">
        <h2 className="font-display text-xl text-primary">Usuários dos painéis</h2>
        <ul className="mt-3 divide-y divide-border">
          {usuarios.map((u) => (
            <li key={u.user_id + u.role} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 last:pb-0">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-primary break-all">{u.nome || u.email}</p>
                <p className="text-xs text-muted-foreground break-all">{u.email}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="uppercase font-semibold text-primary">{u.role === "recepcao" ? "recepção" : u.role}</span>
                  {u.role === "gate" && (
                    <span className="text-gold font-semibold ml-1">
                      ({u.lab_nome ? `Portaria LAB: ${u.lab_nome}` : "Portaria Geral"})
                    </span>
                  )}
                </p>
              </div>
              {(podeCriarAdmin || u.role === "gate" || u.role === "recepcao") && (
                <button 
                  onClick={() => { if (confirm("Remover este usuário?")) void onRemover(u); }} 
                  className="self-start sm:self-center rounded-md border border-border px-3 py-1.5 text-[10px] tracking-widest text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  REMOVER
                </button>
              )}
            </li>
          ))}
          {usuarios.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nenhum usuário cadastrado.</li>}
        </ul>
      </div>
    </section>
  );
}

export function ListaPastoresCoordenadores({ inscricoes }: { inscricoes: Inscricao[] }) {
  const list = useMemo(() => {
    return inscricoes.filter((i) => {
      const nomeLab = i.labs?.nome?.toLowerCase() || "";
      return (
        nomeLab.includes("pastor") ||
        nomeLab.includes("dirigente") ||
        nomeLab.includes("coordenador") ||
        i.labs?.requer_cpf === true
      );
    });
  }, [inscricoes]);

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="font-display text-xl text-primary">Pastores e Coordenadores Cadastrados</h2>
        <span className="rounded-md border border-border bg-background px-2.5 py-1 text-[10px] tracking-widest uppercase text-muted-foreground">{list.length} Total</span>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[700px] text-sm text-left">
          <thead className="sticky top-0 z-10 bg-card text-xs tracking-widest uppercase text-muted-foreground shadow-[0_1px_0_0_var(--color-border)]">
            <tr>
              <th className="p-3 bg-card">Nome</th>
              <th className="p-3 bg-card">CPF</th>
              <th className="p-3 bg-card">Categoria</th>
              <th className="p-3 bg-card">Regional</th>
              <th className="p-3 bg-card">Congregação</th>
              <th className="p-3 bg-card">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="p-3 text-primary font-medium">{i.nome_participante}</td>
                <td className="p-3 text-muted-foreground font-mono">{i.cpf ? i.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "-"}</td>
                <td className="p-3 text-muted-foreground">{i.labs?.nome}</td>
                <td className="p-3 text-muted-foreground">{i.regional === "SEDE" ? "SEDE" : `Regional ${i.regional}`}</td>
                <td className="p-3 text-muted-foreground">{i.congregacao || "-"}</td>
                <td className="p-3"><span className="rounded-md border border-border bg-background px-2 py-1 text-[10px] tracking-widest uppercase">{i.status}</span></td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Nenhum pastor ou coordenador cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function LabCards({
  labs,
  stats,
  selectedLab,
  onSelectLab,
}: {
  labs: { id: string; nome: string }[];
  stats: { labCounts: Record<string, number> };
  selectedLab?: string | null;
  onSelectLab?: (id: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between min-h-[20px]">
        <h3 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
          Inscrições Confirmadas por LABs
        </h3>
        {selectedLab && onSelectLab && (
          <button
            type="button"
            onClick={() => onSelectLab(null)}
            className="text-[10px] tracking-widest text-gold hover:underline uppercase font-bold"
          >
            LIMPAR FILTRO
          </button>
        )}
      </div>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
        {labs.map((l) => {
          const count = stats.labCounts[l.id] ?? 0;
          const isSelected = selectedLab === l.id;

          if (onSelectLab) {
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => onSelectLab(isSelected ? null : l.id)}
                className={`rounded-xl border p-3 shadow-sm flex flex-col justify-between items-start transition-all text-left w-full cursor-pointer hover:border-gold hover:bg-gold/5 ${
                  isSelected
                    ? "border-gold bg-gold/10 text-primary"
                    : "border-border bg-card/60 text-foreground"
                }`}
              >
                <span className="text-[9px] tracking-wider uppercase text-muted-foreground truncate w-full" title={l.nome}>{l.nome}</span>
                <span className={`mt-1 font-display text-lg font-bold ${isSelected ? "text-gold" : "text-primary"}`}>
                  {count}
                </span>
              </button>
            );
          }

          return (
            <div
              key={l.id}
              className="rounded-xl border border-border bg-card/60 p-3 shadow-sm flex flex-col justify-between items-start text-left w-full"
            >
              <span className="text-[9px] tracking-wider uppercase text-muted-foreground truncate w-full" title={l.nome}>{l.nome}</span>
              <span className="mt-1 font-display text-lg text-primary font-bold">
                {count}
              </span>
            </div>
          );
        })}
        {labs.length === 0 && (
          <p className="text-xs text-muted-foreground col-span-full">Nenhum LAB cadastrado.</p>
        )}
      </section>
    </div>
  );
}

export function MinisterioCards({
  ministerios,
  stats,
  selectedMinisterio,
  onSelectMinisterio,
}: {
  ministerios: { id: string; nome: string; ativo: boolean }[];
  stats: { ministerioCounts: Record<string, number> };
  selectedMinisterio?: string | null;
  onSelectMinisterio?: (id: string | null) => void;
}) {
  const ativos = ministerios.filter((m) => m.ativo);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between min-h-[20px]">
        <h3 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
          Inscrições Confirmadas por Ministério
        </h3>
        {selectedMinisterio && onSelectMinisterio && (
          <button
            type="button"
            onClick={() => onSelectMinisterio(null)}
            className="text-[10px] tracking-widest text-gold hover:underline uppercase font-bold"
          >
            LIMPAR FILTRO
          </button>
        )}
      </div>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
        {ativos.map((m) => {
          const count = stats.ministerioCounts[m.id] ?? 0;
          const isSelected = selectedMinisterio === m.id;

          if (onSelectMinisterio) {
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMinisterio(isSelected ? null : m.id)}
                className={`rounded-xl border p-3 shadow-sm flex flex-col justify-between items-start transition-all text-left w-full cursor-pointer hover:border-gold hover:bg-gold/5 ${
                  isSelected
                    ? "border-gold bg-gold/10 text-primary"
                    : "border-border bg-card/60 text-foreground"
                }`}
              >
                <span className="text-[9px] tracking-wider uppercase text-muted-foreground truncate w-full" title={m.nome}>{m.nome}</span>
                <span className={`mt-1 font-display text-lg font-bold ${isSelected ? "text-gold" : "text-primary"}`}>
                  {count}
                </span>
              </button>
            );
          }

          return (
            <div
              key={m.id}
              className="rounded-xl border border-border bg-card/60 p-3 shadow-sm flex flex-col justify-between items-start text-left w-full"
            >
              <span className="text-[9px] tracking-wider uppercase text-muted-foreground truncate w-full" title={m.nome}>{m.nome}</span>
              <span className="mt-1 font-display text-lg text-primary font-bold">
                {count}
              </span>
            </div>
          );
        })}
        {ativos.length === 0 && (
          <p className="text-xs text-muted-foreground col-span-full">Nenhum ministério cadastrado.</p>
        )}
      </section>
    </div>
  );
}

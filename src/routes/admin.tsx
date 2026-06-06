import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
  status: "pendente" | "pago" | "cancelado" | "validado";
  valor: number;
  criado_em: string;
  validado_em: string | null;
  cpf: string | null;
  lab_id: string | null;
  regional: string;
  congregacao: string;
  labs?: { nome: string; requer_cpf: boolean } | null;
  ministerio_id?: string | null;
  ministerios?: { nome: string } | null;
};
type UsuarioPainel = { user_id: string; role: string; nome: string; email: string; criado_em: string; lab_id?: string | null; lab_nome?: string };

function AdminPage() {
  const navigate = useNavigate();
  const { user, isStaff, isSuper, loading, signOut } = useAuth();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && !isStaff) navigate({ to: "/painel" });
  }, [loading, user, isStaff, navigate]);

  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPainel[]>([]);
  const [busca, setBusca] = useState("");
  const [labs, setLabs] = useState<any[]>([]);
  const [totalDinheiro, setTotalDinheiro] = useState(0);
  const listar = useServerFn(listarUsuariosPainel);
  const criar = useServerFn(criarUsuarioPainel);
  const remover = useServerFn(removerUsuarioPainel);

  useEffect(() => { if (user && isStaff) void carregar(); }, [user, isStaff]);

  async function carregar() {
    const { data } = await supabase
      .from("inscricoes")
      .select("id, nome_participante, email, status, valor, criado_em, validado_em, cpf, lab_id, regional, congregacao, labs(nome, requer_cpf), ministerio_id, ministerios(nome)")
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

    return { 
      total: inscricoes.length, 
      pagas: pagas.length, 
      validadas: validadas.length, 
      canceladas: canceladas.length, 
      receita,
      regionalCounts,
      totalDinheiro,
    };
  }, [inscricoes, totalDinheiro]);

  const filtradas = inscricoes.filter((i) =>
    !busca ||
    i.nome_participante.toLowerCase().includes(busca.toLowerCase()) ||
    (i.email ?? "").toLowerCase().includes(busca.toLowerCase())
  );

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
        <RegionalCards stats={stats} />
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

export function RegionalCards({ stats }: { stats: { regionalCounts: Record<string, number> } }) {
  const regionais = [...Array.from({ length: 20 }, (_, idx) => String(idx + 2)), "SEDE"];
  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Inscrições Confirmadas por Regional</h3>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
        {regionais.map((r) => {
          const count = stats.regionalCounts[r] ?? 0;
          const label = r === "SEDE" ? "Sede" : `Reg. ${r}`;
          return (
            <div key={r} className="rounded-xl border border-border bg-card/60 p-3 shadow-sm flex flex-col justify-between items-start">
              <span className="text-[9px] tracking-wider uppercase text-muted-foreground">{label}</span>
              <span className="mt-1 font-display text-lg text-primary font-bold">{count}</span>
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
}: {
  inscricoes: Inscricao[];
  busca: string;
  setBusca: (s: string) => void;
  onExcluir?: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <h2 className="font-display text-xl text-primary">Inscritos</h2>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail" className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-xs tracking-widest uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">CPF</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Regional</th>
              <th className="p-3">Congregação</th>
              <th className="p-3">Ministério</th>
              <th className="p-3">Status</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Data</th>
              {onExcluir && <th className="p-3 text-right">Ação</th>}
            </tr>
          </thead>
          <tbody>
            {inscricoes.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="p-3 text-primary font-medium">{i.nome_participante}</td>
                <td className="p-3 text-muted-foreground font-mono">{i.cpf ? i.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "-"}</td>
                <td className="p-3 text-muted-foreground">{i.email}</td>
                <td className="p-3 text-muted-foreground">{i.labs?.nome || "Geral"}</td>
                <td className="p-3 text-muted-foreground">{i.regional === "SEDE" ? "SEDE" : `Regional ${i.regional}`}</td>
                <td className="p-3 text-muted-foreground">{i.congregacao || "-"}</td>
                <td className="p-3 text-muted-foreground">{i.regional === "SEDE" ? (i.ministerios?.nome || "-") : "-"}</td>
                <td className="p-3"><span className="rounded-md border border-border bg-background px-2 py-1 text-[10px] tracking-widest uppercase">{i.status}</span></td>
                <td className="p-3 text-muted-foreground">R$ {Number(i.valor).toFixed(2)}</td>
                <td className="p-3 text-muted-foreground">{new Date(i.criado_em).toLocaleDateString("pt-BR")}</td>
                {onExcluir && (
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onExcluir(i.id)}
                      className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] tracking-widest text-destructive hover:bg-destructive/10"
                    >
                      EXCLUIR
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {inscricoes.length === 0 && (
              <tr><td colSpan={onExcluir ? 11 : 10} className="p-6 text-center text-sm text-muted-foreground">Nenhuma inscrição.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm text-left">
          <thead className="text-xs tracking-widest uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">CPF</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Regional</th>
              <th className="p-3">Congregação</th>
              <th className="p-3">Status</th>
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

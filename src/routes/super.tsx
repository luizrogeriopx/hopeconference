import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Cards, ListaInscricoes, GestaoUsuarios } from "./admin";
import { ValidadorEntrada } from "@/components/ValidadorEntrada";
import {
  criarUsuarioPainel,
  listarUsuariosPainel,
  removerUsuarioPainel,
} from "@/lib/users.functions";

export const Route = createFileRoute("/super")({
  component: SuperPage,
  head: () => ({ meta: [{ title: "Super Admin — Hope Conference" }] }),
});

type Inscricao = {
  id: string;
  nome_participante: string;
  email: string | null;
  status: "pendente" | "pago" | "cancelado" | "validado";
  valor: number;
  criado_em: string;
  validado_em: string | null;
};
type UsuarioPainel = { user_id: string; role: string; nome: string; email: string; criado_em: string };

function SuperPage() {
  const navigate = useNavigate();
  const { user, isSuper, loading, signOut } = useAuth();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && !isSuper) navigate({ to: "/painel" });
  }, [loading, user, isSuper, navigate]);

  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPainel[]>([]);
  const [busca, setBusca] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const listar = useServerFn(listarUsuariosPainel);
  const criar = useServerFn(criarUsuarioPainel);
  const remover = useServerFn(removerUsuarioPainel);

  useEffect(() => { if (user && isSuper) void carregar(); }, [user, isSuper]);

  async function carregar() {
    const { data } = await supabase
      .from("inscricoes")
      .select("id, nome_participante, email, status, valor, criado_em, validado_em")
      .order("criado_em", { ascending: false });
    setInscricoes((data ?? []) as Inscricao[]);
    try { setUsuarios(await listar()); } catch { /* noop */ }
  }

  async function reverter(id: string) {
    if (!confirm("Reverter validação? O QR voltará a funcionar.")) return;
    const { error } = await supabase.from("inscricoes").update({ status: "pago" }).eq("id", id);
    if (error) alert(error.message);
    else await carregar();
  }

  const stats = useMemo(() => {
    const pagas = inscricoes.filter((i) => i.status === "pago" || i.status === "validado");
    const validadas = inscricoes.filter((i) => i.status === "validado");
    const canceladas = inscricoes.filter((i) => i.status === "cancelado");
    const receita = pagas.reduce((s, i) => s + Number(i.valor), 0);
    return { total: inscricoes.length, pagas: pagas.length, validadas: validadas.length, canceladas: canceladas.length, receita };
  }, [inscricoes]);

  const validadasList = inscricoes.filter((i) => i.status === "validado");
  const filtradas = inscricoes.filter((i) =>
    !busca ||
    i.nome_participante.toLowerCase().includes(busca.toLowerCase()) ||
    (i.email ?? "").toLowerCase().includes(busca.toLowerCase())
  );

  function copiar(path: string) {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    setCopiado(path);
    setTimeout(() => setCopiado(null), 1500);
  }

  if (loading || !user) {
    return <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando…</main>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="font-display text-xl text-primary">Hope Conference — Super Admin</Link>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-muted-foreground">{user.email}</span>
            <Link to="/painel" className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">PAINEL</Link>
            <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">SAIR</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <Cards stats={stats} />

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-xl text-primary">Links dos painéis</h2>
            <p className="mt-1 text-xs text-muted-foreground">Compartilhe somente com os usuários autorizados.</p>
            <ul className="mt-4 space-y-2">
              {[
                { label: "Painel do Inscrito", path: "/painel" },
                { label: "Controle de Acesso (Gate)", path: "/gate" },
                { label: "Admin", path: "/admin" },
                { label: "Super Admin", path: "/super" },
              ].map((l) => (
                <li key={l.path} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-primary">{l.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.path}</p>
                  </div>
                  <button onClick={() => copiar(l.path)} className="rounded-md border border-gold bg-gold/10 px-3 py-1.5 text-[10px] tracking-widest text-primary hover:bg-gold/20">
                    {copiado === l.path ? "COPIADO!" : "COPIAR"}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-xl text-primary">Validar entrada</h2>
            <p className="mt-1 text-xs text-muted-foreground">Abra a câmera para validar QR Codes.</p>
            <div className="mt-4">
              <ValidadorEntrada userId={user.id} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-display text-xl text-primary">Ingressos validados na entrada</h2>
            <span className="text-xs text-muted-foreground">{validadasList.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-left text-xs tracking-widest uppercase text-muted-foreground">
                <tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Validado em</th><th className="p-3 text-right">Ação</th></tr>
              </thead>
              <tbody>
                {validadasList.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="p-3 text-primary">{i.nome_participante}</td>
                    <td className="p-3 text-muted-foreground">{i.email}</td>
                    <td className="p-3 text-muted-foreground">{i.validado_em ? new Date(i.validado_em).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => reverter(i.id)} className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] tracking-widest text-destructive hover:bg-destructive/10">
                        REVERTER
                      </button>
                    </td>
                  </tr>
                ))}
                {validadasList.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">Nenhum ingresso validado ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <ListaInscricoes inscricoes={filtradas} busca={busca} setBusca={setBusca} />

        <GestaoUsuarios
          usuarios={usuarios}
          podeCriarAdmin={true}
          onCriar={async (payload) => { await criar({ data: payload }); await carregar(); }}
          onRemover={async (u) => { await remover({ data: { user_id: u.user_id, role: u.role as "admin" | "gate" } }); await carregar(); }}
        />
      </div>
    </main>
  );
}

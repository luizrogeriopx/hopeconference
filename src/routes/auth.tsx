import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Entrar — Hope Conference" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setMsg(null); setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: `${window.location.origin}/painel`,
            data: { nome },
          },
        });
        if (error) throw error;
        setMsg("Cadastro realizado! Verifique seu e-mail para confirmar e depois faça login.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: "/painel" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro ao autenticar";
      setErro(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
        <Link to="/" className="text-xs tracking-[0.3em] text-muted-foreground hover:text-primary">
          ← VOLTAR AO SITE
        </Link>
        <h1 className="mt-4 font-display text-3xl text-primary">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Painel do Inscrito — Hope Conference 2026
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs tracking-widest text-muted-foreground">NOME COMPLETO</span>
              <input
                required value={nome} onChange={(e) => setNome(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground">E-MAIL</span>
            <input
              required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>
          <label className="block">
            <span className="text-xs tracking-widest text-muted-foreground">SENHA</span>
            <input
              required type="password" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          {msg && <p className="rounded-md border border-gold/40 bg-gold/10 p-3 text-sm text-primary">{msg}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "AGUARDE..." : mode === "login" ? "ENTRAR" : "CADASTRAR"}
          </button>
        </form>

        <button
          onClick={() => { setErro(null); setMsg(null); setMode(mode === "login" ? "signup" : "login"); }}
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-primary"
        >
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </div>
    </main>
  );
}

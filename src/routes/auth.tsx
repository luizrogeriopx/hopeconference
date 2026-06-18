import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AuthSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    return {
      redirect: search.redirect ? String(search.redirect) : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Entrar — Hope Conference" }] }),
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function formatWhats(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect || "/painel" });
    });
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setMsg(null); setLoading(true);
    try {
      const emailNormalizado = email.trim().toLowerCase();
      if (mode === "signup") {
        if (senha !== confirmarSenha) {
          throw new Error("As senhas não coincidem. Digite a mesma senha nos dois campos.");
        }
        const whatsDig = whatsapp.replace(/\D/g, "");
        if (whatsDig.length < 10 || whatsDig.length > 11) {
          throw new Error("Informe um WhatsApp válido com DDD (10 ou 11 dígitos).");
        }
        const { data, error } = await supabase.auth.signUp({
          email: emailNormalizado,
          password: senha,
          options: {
            emailRedirectTo: `${window.location.origin}/painel`,
            data: { nome: nome.trim(), whatsapp: whatsDig },
          },
        });
        if (error) throw error;
        
        if (data?.session) {
          navigate({ to: redirect || "/painel" });
        } else {
          setMsg("Cadastro realizado! Você já pode fazer login.");
          setMode("login");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(emailNormalizado, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMsg("Enviamos um e-mail com o link para redefinir sua senha. Verifique sua caixa de entrada.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: emailNormalizado, password: senha });
        if (error) throw error;
        navigate({ to: redirect || "/painel" });
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
          {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "forgot"
            ? "Informe seu e-mail para receber o link de redefinição."
            : "Painel do Inscrito — Hope Conference 2026"}
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
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs tracking-widest text-muted-foreground">WHATSAPP (COM DDD)</span>
              <input
                required inputMode="numeric" value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhats(e.target.value))}
                placeholder="(00) 00000-0000"
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
          {mode !== "forgot" && (
            <label className="block">
              <span className="text-xs tracking-widest text-muted-foreground">SENHA</span>
              <input
                required type="password" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
          )}
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs tracking-widest text-muted-foreground">CONFIRMAR SENHA</span>
              <input
                required type="password" minLength={6} value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => { setErro(null); setMsg(null); setMode("forgot"); }}
              className="block text-xs tracking-widest text-muted-foreground hover:text-primary"
            >
              ESQUECI MINHA SENHA
            </button>
          )}

          {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
          {msg && <p className="rounded-md border border-gold/40 bg-gold/10 p-3 text-sm text-primary">{msg}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "AGUARDE..." : mode === "login" ? "ENTRAR" : mode === "signup" ? "CADASTRAR" : "ENVIAR LINK"}
          </button>
        </form>

        {mode === "forgot" ? (
          <button
            type="button"
            onClick={() => { setErro(null); setMsg(null); setMode("login"); }}
            className="mt-6 w-full rounded-md border border-primary px-6 py-3 text-center text-sm font-medium tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            Voltar para o login
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setErro(null); setMsg(null); setConfirmarSenha(""); setMode(mode === "login" ? "signup" : "login"); }}
            className="mt-6 w-full rounded-md border border-primary px-6 py-3 text-center text-sm font-medium tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
          </button>
        )}
      </div>
    </main>
  );
}

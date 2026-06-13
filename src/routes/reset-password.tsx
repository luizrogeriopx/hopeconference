import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Redefinir senha — Hope Conference" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    // Supabase processa o token de recovery do hash da URL automaticamente
    // e dispara o evento PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setPronto(true);
      }
    });
    // fallback: se já houver sessão de recovery
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setMsg(null);
    if (senha.length < 6) { setErro("A senha deve ter pelo menos 6 caracteres."); return; }
    if (senha !== confirma) { setErro("As senhas não coincidem."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setMsg("Senha redefinida com sucesso! Redirecionando...");
      setTimeout(() => navigate({ to: "/painel" }), 1500);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
        <Link to="/auth" className="text-xs tracking-[0.3em] text-muted-foreground hover:text-primary">
          ← VOLTAR
        </Link>
        <h1 className="mt-4 font-display text-3xl text-primary">Redefinir senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Defina sua nova senha abaixo.
        </p>

        {!pronto ? (
          <p className="mt-6 rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
            Validando o link de redefinição... Se você abriu esta página diretamente, peça um novo link em "Esqueci minha senha".
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs tracking-widest text-muted-foreground">NOVA SENHA</span>
              <input
                required type="password" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            <label className="block">
              <span className="text-xs tracking-widest text-muted-foreground">CONFIRMAR SENHA</span>
              <input
                required type="password" minLength={6} value={confirma} onChange={(e) => setConfirma(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>

            {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
            {msg && <p className="rounded-md border border-gold/40 bg-gold/10 p-3 text-sm text-primary">{msg}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "AGUARDE..." : "SALVAR NOVA SENHA"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

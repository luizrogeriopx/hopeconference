import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

function formatWhats(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function WhatsAppGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [precisa, setPrecisa] = useState(false);
  const [checando, setChecando] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      setPrecisa(false);
      return;
    }
    let cancel = false;
    setChecando(true);
    supabase
      .from("profiles")
      .select("whatsapp")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        const w = (data?.whatsapp || "").trim();
        setPrecisa(!w);
        setChecando(false);
      });
    return () => {
      cancel = true;
    };
  }, [user, loading]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const d = onlyDigits(whatsapp);
    if (d.length < 10 || d.length > 11) {
      setErro("Informe um WhatsApp válido com DDD (10 ou 11 dígitos).");
      return;
    }
    if (!user) return;
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ whatsapp: d })
        .eq("id", user.id);
      if (error) throw error;
      setPrecisa(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      {children}
      {!loading && !checando && precisa && user && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={salvar}
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
          >
            <h2 className="font-display text-2xl text-primary">Complete seu cadastro</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Para continuar, precisamos do seu número de <strong>WhatsApp</strong> com DDD.
              Usaremos para enviar informações importantes do evento.
            </p>
            <label className="mt-5 block">
              <span className="text-xs tracking-widest text-muted-foreground">WHATSAPP (COM DDD)</span>
              <input
                required
                inputMode="numeric"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhats(e.target.value))}
                placeholder="(00) 00000-0000"
                className="mt-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            {erro && (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {erro}
              </p>
            )}
            <button
              type="submit"
              disabled={salvando}
              className="mt-5 w-full rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {salvando ? "SALVANDO..." : "SALVAR E CONTINUAR"}
            </button>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="mt-3 w-full rounded-md border border-border px-6 py-2 text-xs tracking-widest text-muted-foreground hover:bg-muted"
            >
              SAIR
            </button>
          </form>
        </div>
      )}
    </>
  );
}

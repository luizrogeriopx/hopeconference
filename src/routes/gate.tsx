import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ValidadorEntrada } from "@/components/ValidadorEntrada";

export const Route = createFileRoute("/gate")({
  component: GatePage,
  head: () => ({ meta: [{ title: "Controle de Acesso — Hope Conference" }] }),
});

function GatePage() {
  const navigate = useNavigate();
  const { user, isGate, isStaff, loading, signOut } = useAuth();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && !isGate && !isStaff) navigate({ to: "/painel" });
  }, [loading, user, isGate, isStaff, navigate]);

  if (loading || !user) {
    return <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando…</main>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="font-display text-xl text-primary">Hope Conference</Link>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-muted-foreground">{user.email}</span>
            <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">
              SAIR
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl text-primary">Controle de Acesso</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aponte a câmera para o QR Code do ingresso.</p>
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <ValidadorEntrada userId={user.id} />
        </div>
      </div>
    </main>
  );
}

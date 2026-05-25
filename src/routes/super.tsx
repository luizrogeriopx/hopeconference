import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/super")({
  component: SuperStub,
  head: () => ({ meta: [{ title: "Super Admin — Hope Conference" }] }),
});

function SuperStub() {
  const navigate = useNavigate();
  const { user, isSuper, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && !isSuper) navigate({ to: "/painel" });
  }, [loading, user, isSuper, navigate]);
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="font-display text-3xl text-primary">Painel Super Admin</h1>
        <p className="mt-3 text-sm text-muted-foreground">Em construção (Passo B). Aqui virão: relatórios, gestão de usuários, validação por câmera, reverter QR e links dos painéis.</p>
        <Link to="/painel" className="mt-6 inline-block rounded-md border border-border px-4 py-2 text-xs tracking-widest text-primary hover:bg-muted">← VOLTAR</Link>
      </div>
    </main>
  );
}

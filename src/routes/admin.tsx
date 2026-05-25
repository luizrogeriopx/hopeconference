import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin")({
  component: AdminStub,
  head: () => ({ meta: [{ title: "Admin — Hope Conference" }] }),
});

function AdminStub() {
  const navigate = useNavigate();
  const { user, isStaff, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && !isStaff) navigate({ to: "/painel" });
  }, [loading, user, isStaff, navigate]);
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="font-display text-3xl text-primary">Painel Admin</h1>
        <p className="mt-3 text-sm text-muted-foreground">Em construção (Passo B). Relatórios de vendas, lista de inscritos e cadastro de usuários de Controle de Acesso.</p>
        <Link to="/painel" className="mt-6 inline-block rounded-md border border-border px-4 py-2 text-xs tracking-widest text-primary hover:bg-muted">← VOLTAR</Link>
      </div>
    </main>
  );
}

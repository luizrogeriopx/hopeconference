import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listarGalerias, type GaleriaPublica } from "@/lib/galerias.functions";

export const Route = createFileRoute("/fotos/")({
  component: FotosIndex,
  head: () => ({
    meta: [
      { title: "Galerias de Fotos — Hope Conference" },
      { name: "description", content: "Veja as fotos das galerias da Hope Conference e encontre as suas com filtro por reconhecimento facial." },
      { property: "og:title", content: "Galerias de Fotos — Hope Conference" },
      { property: "og:description", content: "Encontre suas fotos com filtro por selfie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function formatarData(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function FotosIndex() {
  const listar = useServerFn(listarGalerias);
  const [galerias, setGalerias] = useState<GaleriaPublica[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listar()
      .then((g) => setGalerias(g))
      .catch((e) => setErro(e?.message || "Falha ao carregar galerias."));
  }, [listar]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="font-display text-2xl text-primary">Galerias de Fotos</h1>
            <p className="text-xs text-muted-foreground">
              Explore as fotos dos eventos. Use o filtro por selfie para encontrar as suas.
            </p>
          </div>
          <Link to="/" className="text-xs text-muted-foreground underline">← Início</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
        {!galerias && !erro && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {galerias && galerias.length === 0 && (
          <p className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhuma galeria publicada ainda.
          </p>
        )}
        {galerias && galerias.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {galerias.map((g) => (
              <Link
                key={g.id}
                to="/fotos/$id"
                params={{ id: g.id }}
                className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full bg-muted">
                  {g.capa_url ? (
                    <img src={g.capa_url} alt={g.titulo} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem capa</div>
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                    {g.total_fotos} {g.total_fotos === 1 ? "foto" : "fotos"}
                  </span>
                </div>
                <div className="p-4">
                  <h2 className="font-display text-lg text-primary">{g.titulo}</h2>
                  {g.data_evento && <p className="text-xs text-muted-foreground">{formatarData(g.data_evento)}</p>}
                  {g.descricao && <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{g.descricao}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

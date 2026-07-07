import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { obterGaleria, type FotoPublica } from "@/lib/galerias.functions";
import {
  loadFaceApi,
  extrairEmbeddingsDeImagem,
  distanciaEuclidiana,
  MATCH_THRESHOLD,
} from "@/lib/face-api-browser";

export const Route = createFileRoute("/fotos/$id")({
  component: GaleriaDetalhe,
  head: () => ({
    meta: [
      { title: "Galeria — Hope Conference" },
      { name: "description", content: "Fotos da galeria. Encontre as suas com filtro por selfie." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Galeria = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_evento: string | null;
  capa_url: string | null;
};

function formatarData(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function GaleriaDetalhe() {
  const { id } = Route.useParams();
  const obter = useServerFn(obterGaleria);
  const [galeria, setGaleria] = useState<Galeria | null>(null);
  const [fotos, setFotos] = useState<FotoPublica[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroAtivo, setFiltroAtivo] = useState<Set<string> | null>(null);
  const [modalSelfieAberta, setModalSelfieAberta] = useState(false);
  const [fotoAberta, setFotoAberta] = useState<FotoPublica | null>(null);

  useEffect(() => {
    obter({ data: { id } })
      .then((r) => {
        setGaleria(r.galeria);
        setFotos(r.fotos);
      })
      .catch((e) => setErro(e?.message || "Falha ao carregar galeria."));
  }, [id, obter]);

  const fotosVisiveis = useMemo(() => {
    if (!filtroAtivo) return fotos;
    return fotos.filter((f) => filtroAtivo.has(f.id));
  }, [fotos, filtroAtivo]);

  const totalComRosto = useMemo(
    () => fotos.filter((f) => f.face_embeddings && f.face_embeddings.length > 0).length,
    [fotos],
  );

  function aplicarFiltro(idsBatendo: string[]) {
    setFiltroAtivo(new Set(idsBatendo));
  }
  function limparFiltro() {
    setFiltroAtivo(null);
  }

  async function baixarFoto(f: FotoPublica) {
    try {
      const resp = await fetch(f.url);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = (blob.type.split("/")[1] || "jpg").split(";")[0];
      a.download = `foto-${f.id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.open(f.url, "_blank");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <Link to="/fotos" className="text-xs text-muted-foreground underline">← Todas as galerias</Link>
            <h1 className="mt-1 truncate font-display text-2xl text-primary">{galeria?.titulo ?? "Carregando…"}</h1>
            {galeria?.data_evento && <p className="text-xs text-muted-foreground">{formatarData(galeria.data_evento)}</p>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
        {galeria?.descricao && <p className="mb-4 text-sm text-foreground/80">{galeria.descricao}</p>}

        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <button
            onClick={() => setModalSelfieAberta(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            📸 Encontrar minhas fotos (selfie)
          </button>
          {filtroAtivo && (
            <button onClick={limparFiltro} className="rounded-md border border-border px-3 py-2 text-sm">
              Limpar filtro ({filtroAtivo.size} {filtroAtivo.size === 1 ? "foto" : "fotos"})
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {fotos.length} fotos · {totalComRosto} com rostos detectados
          </span>
        </div>

        {fotos.length === 0 && !erro && (
          <p className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Ainda não há fotos nesta galeria.
          </p>
        )}

        {fotosVisiveis.length === 0 && filtroAtivo && (
          <p className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhuma foto correspondeu à sua selfie. Tente outra foto com o rosto bem visível.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {fotosVisiveis.map((f) => (
            <div key={f.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
              <button onClick={() => setFotoAberta(f)} className="block h-full w-full">
                <img
                  src={f.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); baixarFoto(f); }}
                title="Baixar"
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-90 hover:opacity-100"
              >
                ⬇
              </button>
            </div>
          ))}
        </div>
      </main>

      {modalSelfieAberta && (
        <ModalSelfie
          fotos={fotos}
          onClose={() => setModalSelfieAberta(false)}
          onFiltrar={(ids) => {
            aplicarFiltro(ids);
            setModalSelfieAberta(false);
          }}
        />
      )}

      {fotoAberta && (
        <div
          onClick={() => setFotoAberta(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <img src={fotoAberta.url} alt="" className="max-h-full max-w-full object-contain" />
          <button
            onClick={(e) => { e.stopPropagation(); baixarFoto(fotoAberta); }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/20 px-4 py-2 text-sm text-white hover:bg-white/30"
          >
            ⬇ Baixar foto
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setFotoAberta(null); }}
            className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function ModalSelfie({
  fotos,
  onClose,
  onFiltrar,
}: {
  fotos: FotoPublica[];
  onClose: () => void;
  onFiltrar: (ids: string[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<string>("Carregando câmera…");
  const [carregandoModelos, setCarregandoModelos] = useState(true);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("Carregando modelos de reconhecimento facial…");
        await loadFaceApi();
        if (cancelled) return;
        setCarregandoModelos(false);
        setStatus("Solicitando acesso à câmera…");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("Posicione seu rosto no centro e tire a selfie.");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus("Não foi possível acessar a câmera: " + msg);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function capturarECompara() {
    if (!videoRef.current) return;
    setProcessando(true);
    setStatus("Analisando seu rosto…");
    try {
      const emb = await extrairEmbeddingsDeImagem(videoRef.current);
      if (emb.length === 0) {
        setStatus("Nenhum rosto detectado. Ajuste a iluminação e tente novamente.");
        setProcessando(false);
        return;
      }
      const meuRosto = emb[0];
      const idsBatendo: string[] = [];
      for (const foto of fotos) {
        if (!foto.face_embeddings || foto.face_embeddings.length === 0) continue;
        const menorDist = Math.min(...foto.face_embeddings.map((e) => distanciaEuclidiana(meuRosto, e)));
        if (menorDist <= MATCH_THRESHOLD) idsBatendo.push(foto.id);
      }
      setStatus(`Encontramos ${idsBatendo.length} foto(s) com seu rosto.`);
      setTimeout(() => onFiltrar(idsBatendo), 400);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("Erro ao analisar: " + msg);
      setProcessando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-primary">Filtrar por selfie</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground">✕</button>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
        </div>
        <p className="mt-2 min-h-[2.5rem] text-xs text-muted-foreground">{status}</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={capturarECompara}
            disabled={carregandoModelos || processando}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {processando ? "Analisando…" : "📸 Tirar selfie e filtrar"}
          </button>
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
            Cancelar
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Sua selfie é processada apenas no seu dispositivo. Nenhuma imagem é enviada para o servidor.
        </p>
      </div>
    </div>
  );
}

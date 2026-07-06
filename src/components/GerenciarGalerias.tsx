import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listarGalerias,
  criarGaleria,
  atualizarGaleria,
  deletarGaleria,
  criarUploadUrl,
  registrarFoto,
  deletarFoto,
  obterGaleria,
  type GaleriaPublica,
  type FotoPublica,
} from "@/lib/galerias.functions";
type FaceApiModule = typeof import("@/lib/face-api.client");
let faceApiPromise: Promise<FaceApiModule> | null = null;
function getFaceApi(): Promise<FaceApiModule> {
  if (!faceApiPromise) faceApiPromise = import("@/lib/face-api.client");
  return faceApiPromise;
}

export function GerenciarGalerias() {
  const listar = useServerFn(listarGalerias);
  const criar = useServerFn(criarGaleria);
  const atualizar = useServerFn(atualizarGaleria);
  const deletar = useServerFn(deletarGaleria);

  const [galerias, setGalerias] = useState<GaleriaPublica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criandoNova, setCriandoNova] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [galeriaAbertaId, setGaleriaAbertaId] = useState<string | null>(null);

  async function recarregar() {
    setCarregando(true);
    try {
      const g = await listar();
      setGalerias(g);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    recarregar();
  }, []);

  async function submitNova() {
    if (!titulo.trim()) return alert("Informe um título.");
    try {
      await criar({ data: { titulo: titulo.trim(), descricao: descricao.trim() || null, data_evento: dataEvento || null } });
      setTitulo("");
      setDescricao("");
      setDataEvento("");
      setCriandoNova(false);
      await recarregar();
    } catch (e) {
      alert("Falha ao criar: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function editarGaleria(g: GaleriaPublica) {
    const novoTitulo = prompt("Título:", g.titulo);
    if (novoTitulo === null) return;
    const novaDesc = prompt("Descrição:", g.descricao ?? "");
    if (novaDesc === null) return;
    const novaData = prompt("Data do evento (YYYY-MM-DD):", g.data_evento ?? "");
    if (novaData === null) return;
    try {
      await atualizar({ data: { id: g.id, titulo: novoTitulo, descricao: novaDesc || null, data_evento: novaData || null } });
      await recarregar();
    } catch (e) {
      alert("Falha: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function removerGaleria(g: GaleriaPublica) {
    if (!confirm(`Apagar galeria "${g.titulo}" e todas as ${g.total_fotos} fotos?`)) return;
    await deletar({ data: { id: g.id } });
    await recarregar();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl text-primary">Galerias de Fotos</h2>
          <p className="text-xs text-muted-foreground">Publicadas em /fotos. Cada foto tem seus rostos detectados automaticamente.</p>
        </div>
        <button onClick={() => setCriandoNova((v) => !v)} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
          {criandoNova ? "Cancelar" : "+ Nova galeria"}
        </button>
      </div>

      {criandoNova && (
        <div className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-4 md:grid-cols-3">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className="col-span-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
          <input value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} type="date" className="rounded-md border border-border bg-card px-3 py-2 text-sm" />
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (opcional)" className="col-span-full min-h-[80px] rounded-md border border-border bg-card px-3 py-2 text-sm" />
          <button onClick={submitNova} className="col-span-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Criar galeria</button>
        </div>
      )}

      {carregando ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
      ) : galerias.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhuma galeria criada ainda.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {galerias.map((g) => (
            <li key={g.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-primary">{g.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.data_evento ?? "sem data"} · {g.total_fotos} fotos
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setGaleriaAbertaId(galeriaAbertaId === g.id ? null : g.id)} className="rounded-md border border-border px-3 py-1 text-xs">
                    {galeriaAbertaId === g.id ? "Fechar" : "Gerenciar fotos"}
                  </button>
                  <button onClick={() => editarGaleria(g)} className="rounded-md border border-border px-3 py-1 text-xs">Editar</button>
                  <button onClick={() => removerGaleria(g)} className="rounded-md border border-destructive/40 px-3 py-1 text-xs text-destructive">Apagar</button>
                </div>
              </div>
              {galeriaAbertaId === g.id && <GerenciarFotos galeriaId={g.id} onChange={recarregar} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GerenciarFotos({ galeriaId, onChange }: { galeriaId: string; onChange: () => void }) {
  const obter = useServerFn(obterGaleria);
  const criarUpload = useServerFn(criarUploadUrl);
  const registrar = useServerFn(registrarFoto);
  const remover = useServerFn(deletarFoto);

  const [fotos, setFotos] = useState<FotoPublica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<{ atual: number; total: number; msg: string } | null>(null);

  async function recarregar() {
    setCarregando(true);
    try {
      const r = await obter({ data: { id: galeriaId } });
      setFotos(r.fotos);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    recarregar();
  }, [galeriaId]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const lista = Array.from(files);
    setEnviando(true);
    setProgresso({ atual: 0, total: lista.length, msg: "Preparando modelos de reconhecimento…" });
    try {
      const faceApi = await getFaceApi();
      await faceApi.loadFaceApi();
      let temCapa = fotos.length > 0;
      for (let i = 0; i < lista.length; i++) {
        const file = lista[i];
        setProgresso({ atual: i + 1, total: lista.length, msg: `Processando ${file.name}…` });

        // 1) extrai embeddings no browser
        let embeddings: number[][] = [];
        let largura = 0, altura = 0;
        try {
          const r = await faceApi.extrairEmbeddingDeArquivo(file);
          embeddings = r.embeddings;
          largura = r.largura;
          altura = r.altura;
        } catch (err) {
          console.warn("Falha ao extrair embeddings de", file.name, err);
        }

        // 2) pede URL de upload assinada
        const up = await criarUpload({ data: { galeria_id: galeriaId, filename: file.name } });

        // 3) faz upload direto ao storage
        const { error: upErr } = await supabase.storage.from("galerias").uploadToSignedUrl(up.path, up.token, file, {
          contentType: file.type || "image/jpeg",
        });
        if (upErr) throw upErr;

        // 4) registra a foto (define capa se ainda não houver)
        await registrar({
          data: {
            galeria_id: galeriaId,
            storage_path: up.path,
            face_embeddings: embeddings.length > 0 ? embeddings : null,
            largura: largura || null,
            altura: altura || null,
            set_como_capa: !temCapa,
          },
        });
        temCapa = true;
      }
      setProgresso({ atual: lista.length, total: lista.length, msg: "Concluído!" });
      await recarregar();
      onChange();
    } catch (e) {
      alert("Erro no upload: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
      setTimeout(() => setProgresso(null), 2000);
    }
  }

  async function apagar(f: FotoPublica) {
    if (!confirm("Apagar esta foto?")) return;
    await remover({ data: { id: f.id } });
    await recarregar();
    onChange();
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-card p-3">
      <label className="mb-2 block cursor-pointer rounded-md border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground hover:bg-muted/40">
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          disabled={enviando}
          onChange={(e) => handleUpload(e.target.files)}
        />
        {enviando ? "Enviando…" : "📁 Clique ou arraste imagens aqui"}
      </label>

      {progresso && (
        <p className="mb-2 text-xs text-muted-foreground">
          {progresso.atual}/{progresso.total} — {progresso.msg}
        </p>
      )}

      {carregando ? (
        <p className="text-xs text-muted-foreground">Carregando fotos…</p>
      ) : fotos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma foto ainda.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {fotos.map((f) => (
            <div key={f.id} className="relative aspect-square overflow-hidden rounded-md bg-muted">
              <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              <button
                onClick={() => apagar(f)}
                title="Apagar"
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
              >
                ✕
              </button>
              {f.face_embeddings && f.face_embeddings.length > 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  {f.face_embeddings.length} 👤
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LocalCard } from "@/components/LocalCard";

export const Route = createFileRoute("/painel")({
  component: PainelInscrito,
  head: () => ({ meta: [{ title: "Painel do Inscrito — Hope Conference" }] }),
});

type Inscricao = {
  id: string;
  nome_participante: string;
  status: "pendente" | "pago" | "cancelado" | "validado";
  qr_token: string;
  valor: number;
  criado_em: string;
};

function PainelInscrito() {
  const navigate = useNavigate();
  const { user, roles, loading, signOut } = useAuth();
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nomes, setNomes] = useState<string[]>([""]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void carregar();
  }, [user]);

  async function carregar() {
    setCarregando(true);
    const { data, error } = await supabase
      .from("inscricoes")
      .select("id, nome_participante, status, qr_token, valor, criado_em")
      .eq("comprador_user_id", user!.id)
      .order("criado_em", { ascending: false });
    if (!error && data) setInscricoes(data as Inscricao[]);
    setCarregando(false);
  }

  async function inscrever(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const validos = nomes.map((n) => n.trim()).filter(Boolean);
    if (validos.length === 0) { setErro("Informe ao menos um nome."); return; }
    setEnviando(true);
    const rows = validos.map((nome) => ({
      comprador_user_id: user!.id,
      nome_participante: nome,
      email: user!.email,
      valor: 50,
      status: "pago" as const,
    }));
    const { data: novas, error } = await supabase.from("inscricoes").insert(rows).select("id, valor");
    if (error) { setErro(error.message); setEnviando(false); return; }
    if (novas) {
      await supabase.from("pagamentos").insert(
        novas.map((n: { id: string; valor: number }) => ({
          inscricao_id: n.id, status: "pago", metodo: "mock", valor: n.valor,
        }))
      );
    }
    setNomes([""]);
    setEnviando(false);
    await carregar();
  }

  async function cancelar(id: string) {
    if (!confirm("Cancelar esta inscrição?")) return;
    const { error } = await supabase.from("inscricoes").update({ status: "cancelado" }).eq("id", id);
    if (!error) await carregar();
  }

  if (loading || !user) {
    return <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando…</main>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="font-display text-xl text-primary">Hope Conference 2026</Link>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline text-muted-foreground">{user.email}</span>
            {roles.includes("super_admin") && (
              <Link to="/super" className="rounded-md border border-gold bg-gold/10 px-3 py-2 tracking-widest text-primary hover:bg-gold/20">SUPER ADMIN</Link>
            )}
            {roles.includes("admin") && (
              <Link to="/admin" className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">ADMIN</Link>
            )}
            {roles.includes("gate") && (
              <Link to="/gate" className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">CONTROLE</Link>
            )}
            <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">
              SAIR
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-2xl text-primary">Nova inscrição</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              R$ 50,00 por participante. Informe o nome de cada pessoa — você receberá um QR Code para cada inscrição.
            </p>
            <form onSubmit={inscrever} className="mt-4 space-y-3">
              {nomes.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={n}
                    onChange={(e) => setNomes(nomes.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={`Nome do participante ${i + 1}`}
                    className="flex-1 rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                  />
                  {nomes.length > 1 && (
                    <button type="button" onClick={() => setNomes(nomes.filter((_, j) => j !== i))}
                      className="rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setNomes([...nomes, ""])}
                  className="text-sm tracking-widest text-primary underline-offset-4 hover:underline">
                  + ADICIONAR PARTICIPANTE
                </button>
                <div className="text-sm text-muted-foreground">
                  Total: <span className="font-semibold text-primary">R$ {(nomes.filter(n => n.trim()).length * 50).toFixed(2)}</span>
                </div>
              </div>
              {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
              <button type="submit" disabled={enviando}
                className="w-full rounded-md bg-primary px-6 py-3 text-sm font-medium tracking-wider text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
                {enviando ? "PROCESSANDO..." : "CONFIRMAR INSCRIÇÃO"}
              </button>
            </form>
          </section>

          <section>
            <h2 className="font-display text-2xl text-primary">Minhas inscrições</h2>
            {carregando ? (
              <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
            ) : inscricoes.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma inscrição ainda.</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {inscricoes.map((i) => (
                  <InscricaoCard key={i.id} inscricao={i} onCancelar={() => cancelar(i.id)} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside>
          <LocalCard />
        </aside>
      </div>
    </main>
  );
}

function InscricaoCard({ inscricao, onCancelar }: { inscricao: Inscricao; onCancelar: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, inscricao.qr_token, { width: 220, margin: 1 }, () => {
      setDataUrl(canvasRef.current?.toDataURL("image/png") ?? "");
    });
  }, [inscricao.qr_token]);

  const statusColor: Record<string, string> = {
    pago: "bg-gold/20 text-primary border-gold/50",
    validado: "bg-primary text-primary-foreground border-primary",
    cancelado: "bg-destructive/10 text-destructive border-destructive/40",
    pendente: "bg-muted text-muted-foreground border-border",
  };

  return (
    <li className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs tracking-widest text-muted-foreground">PARTICIPANTE</p>
          <p className="font-display text-lg text-primary leading-tight">{inscricao.nome_participante}</p>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold tracking-widest uppercase ${statusColor[inscricao.status]}`}>
          {inscricao.status}
        </span>
      </div>
      <div className="mt-4 flex justify-center rounded-lg bg-background p-3 border border-border">
        <canvas ref={canvasRef} className={inscricao.status === "cancelado" ? "opacity-30" : ""} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {dataUrl && inscricao.status !== "cancelado" && (
          <a href={dataUrl} download={`ingresso-${inscricao.nome_participante.replace(/\s+/g, "-")}.png`}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-xs font-medium tracking-widest text-primary-foreground hover:bg-primary/90">
            BAIXAR QR
          </a>
        )}
        {inscricao.status === "pago" && (
          <button onClick={onCancelar}
            className="rounded-md border border-border px-3 py-2 text-xs tracking-widest text-muted-foreground hover:bg-muted">
            CANCELAR
          </button>
        )}
      </div>
    </li>
  );
}

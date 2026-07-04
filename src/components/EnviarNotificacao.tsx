import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { enviarNotificacaoMassa } from "@/lib/notificacoes.functions";
import { REGIONAIS } from "@/lib/regionais";

type Lab = { id: string; nome: string };
type Ministerio = { id: string; nome: string; ativo: boolean };

type Alvo = "todos" | "inscritos" | "regional" | "lab" | "ministerio" | "status";

export function EnviarNotificacao({ labs, ministerios }: { labs: Lab[]; ministerios: Ministerio[] }) {
  const enviar = useServerFn(enviarNotificacaoMassa);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [link, setLink] = useState("");
  const [alvo, setAlvo] = useState<Alvo>("todos");
  const [regional, setRegional] = useState<string>("2");
  const [labId, setLabId] = useState<string>("");
  const [ministerioId, setMinisterioId] = useState<string>("");
  const [status, setStatus] = useState<"pendente" | "pago" | "validado" | "cancelado">("pago");
  const [enviando, setEnviando] = useState(false);

  async function submit() {
    if (!titulo.trim() || !mensagem.trim()) {
      alert("Preencha título e mensagem.");
      return;
    }
    if (alvo === "lab" && !labId) return alert("Selecione um LAB.");
    if (alvo === "ministerio" && !ministerioId) return alert("Selecione um ministério.");

    const total = alvo === "todos" ? "TODOS os usuários cadastrados" : "os usuários filtrados";
    if (!confirm(`Enviar notificação para ${total}?`)) return;

    setEnviando(true);
    try {
      const res = await enviar({
        data: {
          titulo: titulo.trim(),
          mensagem: mensagem.trim(),
          link: link.trim() || null,
          alvo,
          regional: alvo === "regional" ? regional : null,
          labId: alvo === "lab" ? labId : null,
          ministerioId: alvo === "ministerio" ? ministerioId : null,
          status: alvo === "status" ? status : null,
        },
      });
      alert(`Notificação enviada para ${res.total} usuário(s).`);
      setTitulo("");
      setMensagem("");
      setLink("");
    } catch (e: any) {
      alert(`Erro: ${e?.message ?? e}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div>
        <h2 className="font-display text-xl text-primary">Enviar notificação</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Envie um aviso in-app que aparecerá no sino de notificações dos usuários selecionados.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Público-alvo</label>
          <select
            value={alvo}
            onChange={(e) => setAlvo(e.target.value as Alvo)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="todos">Todos os usuários cadastrados</option>
            <option value="inscritos">Todos com inscrição</option>
            <option value="status">Por status da inscrição</option>
            <option value="regional">Por Regional</option>
            <option value="lab">Por LAB</option>
            <option value="ministerio">Por Ministério</option>
          </select>
        </div>

        {alvo === "regional" && (
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Regional</label>
            <select value={regional} onChange={(e) => setRegional(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              {REGIONAIS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}
        {alvo === "lab" && (
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">LAB</label>
            <select value={labId} onChange={(e) => setLabId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Selecione…</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
        )}
        {alvo === "ministerio" && (
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Ministério</label>
            <select value={ministerioId} onChange={(e) => setMinisterioId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="">Selecione…</option>
              {ministerios.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
        )}
        {alvo === "status" && (
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="validado">Validado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Título</label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Ex: Informações importantes"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Mensagem</label>
        <textarea
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={2000}
          rows={4}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Escreva a mensagem…"
        />
        <div className="mt-1 text-right text-[10px] text-muted-foreground">{mensagem.length}/2000</div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">Link (opcional)</label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          maxLength={500}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="https://…"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={enviando}
          className="rounded-md border border-gold bg-gold/10 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-primary hover:bg-gold/20 disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar notificação"}
        </button>
      </div>
    </section>
  );
}

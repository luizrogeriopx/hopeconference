import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import {
  listarTodasContas,
  atualizarConta,
  resetarSenhaConta,
  gerarLinkAcessoConta,
  listarInscricoesDaConta,
} from "@/lib/usuarios-admin.functions";

type Conta = {
  id: string;
  email: string;
  nome: string;
  criado_em: string;
  roles: string[];
  total_inscricoes: number;
};

type InscricaoConta = {
  id: string;
  nome_participante: string;
  email: string | null;
  status: string;
  valor: number;
  criado_em: string;
  qr_token: string;
  lab_qr_token: string | null;
  lab_id: string | null;
  regional: string;
  congregacao: string;
  cpf: string | null;
  validado_em: string | null;
  lab_validado_em: string | null;
  labs?: { nome: string; local: string; eh_geral: boolean } | null;
};

function QrCanvas({ token, label }: { token: string; label: string }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    QRCode.toDataURL(token, { width: 180, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(""));
  }, [token]);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] tracking-widest uppercase text-muted-foreground">{label}</span>
      {dataUrl ? (
        <img src={dataUrl} alt={label} className="rounded border border-border bg-white p-1" />
      ) : (
        <div className="h-[180px] w-[180px] rounded border border-border bg-muted" />
      )}
      <span className="break-all text-[9px] font-mono text-muted-foreground max-w-[180px] text-center">{token}</span>
    </div>
  );
}

export function ContasUsuarios() {
  const listar = useServerFn(listarTodasContas);
  const atualizar = useServerFn(atualizarConta);
  const resetar = useServerFn(resetarSenhaConta);
  const gerarLink = useServerFn(gerarLinkAcessoConta);
  const listarInscs = useServerFn(listarInscricoesDaConta);

  const [contas, setContas] = useState<Conta[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [verUserId, setVerUserId] = useState<string | null>(null);
  const [inscricoes, setInscricoes] = useState<InscricaoConta[]>([]);
  const [carregandoInscs, setCarregandoInscs] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [showLink, setShowLink] = useState<{ url: string; email: string } | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const data = await listar();
      setContas(data as Conta[]);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contas;
    return contas.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        c.nome.toLowerCase().includes(q) ||
        c.roles.some((r) => r.toLowerCase().includes(q)),
    );
  }, [contas, busca]);

  function iniciarEdicao(c: Conta) {
    setEditandoId(c.id);
    setEditNome(c.nome);
    setEditEmail(c.email);
    setMensagem(null);
  }

  async function salvarEdicao(id: string) {
    setSalvando(true);
    setMensagem(null);
    try {
      await atualizar({ data: { user_id: id, nome: editNome, email: editEmail } });
      setEditandoId(null);
      await carregar();
      setMensagem("Conta atualizada.");
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Erro ao atualizar.");
    } finally {
      setSalvando(false);
    }
  }

  async function onResetar(id: string) {
    if (!confirm("Resetar a senha desta conta para 123456?")) return;
    setMensagem(null);
    try {
      await resetar({ data: { user_id: id } });
      setMensagem("Senha redefinida para 123456.");
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Erro ao resetar senha.");
    }
  }

  async function onLogarComo(id: string) {
    setMensagem(null);
    try {
      const res = await gerarLink({ data: { user_id: id } });
      const r = res as { url: string; email: string };
      // Força o redirect_to do magic link para marcar a sessão como impersonação,
      // assim o WhatsAppGate não exigirá WhatsApp do super logado como o usuário.
      let finalUrl = r.url;
      try {
        const u = new URL(r.url);
        const redirect = `${window.location.origin}/?impersonated=1`;
        u.searchParams.set("redirect_to", redirect);
        finalUrl = u.toString();
      } catch {
        // mantém url original em caso de parse falhar
      }
      setShowLink({ url: finalUrl, email: r.email });
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Erro ao gerar link.");
    }
  }

  async function onVerInscricoes(id: string) {
    setVerUserId(id);
    setInscricoes([]);
    setCarregandoInscs(true);
    try {
      const data = await listarInscs({ data: { user_id: id } });
      setInscricoes(data as InscricaoConta[]);
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Erro ao carregar inscrições.");
    } finally {
      setCarregandoInscs(false);
    }
  }

  const contaSelecionada = contas.find((c) => c.id === verUserId);

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl text-primary">Contas de Usuários</h2>
          <span className="rounded-md border border-border bg-background px-2.5 py-1 text-[10px] tracking-widest uppercase text-muted-foreground">
            {contas.length} Total
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou papel"
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <button
            onClick={() => void carregar()}
            disabled={carregando}
            className="rounded-md border border-border px-3 py-2 text-[10px] tracking-widest uppercase text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {carregando ? "..." : "Recarregar"}
          </button>
        </div>
      </div>

      {mensagem && (
        <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs text-primary">{mensagem}</div>
      )}

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10 bg-card text-left text-xs tracking-widest uppercase text-muted-foreground shadow-[0_1px_0_0_var(--color-border)]">
            <tr>
              <th className="p-3 bg-card">Nome</th>
              <th className="p-3 bg-card">E-mail</th>
              <th className="p-3 bg-card">Papéis</th>
              <th className="p-3 bg-card">Inscrições</th>
              <th className="p-3 bg-card">Criado em</th>
              <th className="p-3 bg-card text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => {
              const isEditing = editandoId === c.id;
              return (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="p-3 text-primary font-medium">
                    {isEditing ? (
                      <input
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-gold"
                      />
                    ) : (
                      c.nome || "—"
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {isEditing ? (
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-gold"
                      />
                    ) : (
                      <span className="break-all">{c.email}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {c.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        c.roles.map((r) => (
                          <span
                            key={r}
                            className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold border ${
                              r === "super_admin"
                                ? "bg-gold/15 border-gold/30 text-primary"
                                : r === "admin"
                                ? "bg-primary/10 border-primary/20 text-primary"
                                : r === "gate" || r === "recepcao"
                                ? "bg-muted border-border text-muted-foreground"
                                : "bg-background border-border text-muted-foreground"
                            }`}
                          >
                            {r === "recepcao" ? "recepção" : r}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.total_inscricoes}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => salvarEdicao(c.id)}
                            disabled={salvando}
                            className="rounded-md bg-primary px-2 py-1 text-[10px] tracking-widest text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {salvando ? "..." : "SALVAR"}
                          </button>
                          <button
                            onClick={() => setEditandoId(null)}
                            className="rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-muted-foreground hover:bg-muted"
                          >
                            CANCELAR
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => iniciarEdicao(c)}
                            className="rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-primary hover:bg-muted"
                          >
                            EDITAR
                          </button>
                          <button
                            onClick={() => void onResetar(c.id)}
                            className="rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-muted-foreground hover:bg-muted"
                          >
                            RESET SENHA
                          </button>
                          <button
                            onClick={() => void onVerInscricoes(c.id)}
                            className="rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-primary hover:bg-muted"
                          >
                            VER INSCRIÇÕES
                          </button>
                          <button
                            onClick={() => void onLogarComo(c.id)}
                            className="rounded-md border border-gold/40 bg-gold/10 px-2 py-1 text-[10px] tracking-widest text-primary hover:bg-gold/20"
                          >
                            LOGAR COMO
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                  {carregando ? "Carregando..." : "Nenhuma conta encontrada."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showLink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowLink(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg text-primary">Link de acesso gerado</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Conta: <span className="font-mono text-primary">{showLink.email}</span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              <strong className="text-destructive">Atenção:</strong> abrir este link nesta mesma janela
              vai <strong>encerrar sua sessão de super admin</strong>. Para manter sua sessão intacta,
              copie o link e abra em uma <strong>janela anônima</strong> (Ctrl+Shift+N).
            </p>
            <textarea
              readOnly
              value={showLink.url}
              className="mt-3 h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(showLink.url);
                  setMensagem("Link copiado.");
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-[10px] tracking-widest text-primary-foreground hover:bg-primary/90"
              >
                COPIAR LINK
              </button>
              <a
                href={showLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-[10px] tracking-widest text-primary hover:bg-gold/20"
              >
                ABRIR EM NOVA ABA
              </a>
              <button
                onClick={() => setShowLink(null)}
                className="rounded-md border border-border px-3 py-1.5 text-[10px] tracking-widest text-muted-foreground hover:bg-muted"
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>
      )}

      {verUserId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setVerUserId(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg text-primary">
                  Inscrições de {contaSelecionada?.nome || contaSelecionada?.email}
                </h3>
                <p className="text-xs text-muted-foreground break-all">{contaSelecionada?.email}</p>
              </div>
              <button
                onClick={() => setVerUserId(null)}
                className="rounded-md border border-border px-3 py-1.5 text-[10px] tracking-widest text-muted-foreground hover:bg-muted"
              >
                FECHAR
              </button>
            </div>

            {carregandoInscs ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">Carregando inscrições...</p>
            ) : inscricoes.length === 0 ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Esta conta não possui inscrições.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {inscricoes.map((i) => (
                  <div key={i.id} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{i.nome_participante}</p>
                        <p className="text-xs text-muted-foreground break-all">{i.email || "—"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {i.regional === "SEDE" ? "SEDE" : `Regional ${i.regional}`}
                          {i.congregacao ? ` — ${i.congregacao}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Categoria: <span className="text-primary">{i.labs?.nome || "Geral"}</span>
                          {i.labs?.local ? ` (${i.labs.local})` : ""}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <span className="rounded-md border border-border bg-card px-2 py-1 text-[10px] tracking-widest uppercase">
                          {i.status}
                        </span>
                        <p className="mt-1 text-muted-foreground">R$ {Number(i.valor).toFixed(2)}</p>
                        <p className="text-muted-foreground">
                          {new Date(i.criado_em).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>

                    {(i.status === "pago" || i.status === "validado") && (
                      <div className="mt-3 flex flex-wrap gap-6 justify-center">
                        <QrCanvas token={i.qr_token} label="QR Geral" />
                        {i.lab_qr_token && i.labs && !i.labs.eh_geral && (
                          <QrCanvas token={i.lab_qr_token} label={`QR LAB — ${i.labs.nome}`} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

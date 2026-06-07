import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Cards, RegionalCards, ListaInscricoes, GestaoUsuarios, ListaPastoresCoordenadores } from "./admin";
import { ValidadorEntrada } from "@/components/ValidadorEntrada";
import {
  criarUsuarioPainel,
  listarUsuariosPainel,
  removerUsuarioPainel,
} from "@/lib/users.functions";
import {
  carregarConfiguracaoMercadoPago,
  salvarConfiguracaoMercadoPago,
} from "@/lib/payment.functions";

export const Route = createFileRoute("/super")({
  component: SuperPage,
  head: () => ({ meta: [{ title: "Super Admin — Hope Conference" }] }),
});

type Inscricao = {
  id: string;
  nome_participante: string;
  email: string | null;
  status: "pendente" | "pago" | "cancelado" | "validado";
  valor: number;
  criado_em: string;
  validado_em: string | null;
  cpf: string | null;
  lab_id: string | null;
  regional: string;
  congregacao: string;
  labs?: { nome: string; requer_cpf: boolean } | null;
  ministerio_id?: string | null;
  ministerios?: { nome: string } | null;
};
type UsuarioPainel = { user_id: string; role: string; nome: string; email: string; criado_em: string; lab_id?: string | null; lab_nome?: string };

type Ministerio = {
  id: string;
  nome: string;
  ativo: boolean;
  criado_em: string;
};

type Lab = {
  id: string;
  nome: string;
  limite_vagas: number;
  local: string;
  ativo: boolean;
  requer_cpf: boolean;
  eh_geral: boolean;
  criado_em: string;
};

function SuperPage() {
  const navigate = useNavigate();
  const { user, isSuper, loading, signOut } = useAuth();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && user && !isSuper) navigate({ to: "/painel" });
  }, [loading, user, isSuper, navigate]);

  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPainel[]>([]);
  const [busca, setBusca] = useState("");
  const [regionalSelecionada, setRegionalSelecionada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [inscricoesAbertas, setInscricoesAbertas] = useState<boolean>(true);
  const [salvandoFlag, setSalvandoFlag] = useState(false);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [googleSheetPastoresUrl, setGoogleSheetPastoresUrl] = useState("");
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [novoMinisterioNome, setNovoMinisterioNome] = useState("");
  const [editingMinisterioId, setEditingMinisterioId] = useState<string | null>(null);
  const [editMinisterioNome, setEditMinisterioNome] = useState("");
  const [totalDinheiro, setTotalDinheiro] = useState(0);

  // Novo LAB form state
  const [novoLabNome, setNovoLabNome] = useState("");
  const [novoLabLimite, setNovoLabLimite] = useState(100);
  const [novoLabLocal, setNovoLabLocal] = useState("");
  const [novoLabRequerCpf, setNovoLabRequerCpf] = useState(false);
  const [novoLabEhGeral, setNovoLabEhGeral] = useState(false);

  // Edit LAB form state
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [editLabNome, setEditLabNome] = useState("");
  const [editLabLimite, setEditLabLimite] = useState(100);
  const [editLabLocal, setEditLabLocal] = useState("");

  // Mercado Pago config state
  const [mpAtivo, setMpAtivo] = useState(false);
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpConfigurado, setMpConfigurado] = useState(false);
  const [salvandoMP, setSalvandoMP] = useState(false);

  const listar = useServerFn(listarUsuariosPainel);
  const criar = useServerFn(criarUsuarioPainel);
  const remover = useServerFn(removerUsuarioPainel);
  const carregarMP = useServerFn(carregarConfiguracaoMercadoPago);
  const salvarMP = useServerFn(salvarConfiguracaoMercadoPago);

  useEffect(() => { if (user && isSuper) void carregar(); }, [user, isSuper]);

  async function carregar() {
    const { data } = await supabase
      .from("inscricoes")
      .select("id, nome_participante, email, status, valor, criado_em, validado_em, cpf, lab_id, regional, congregacao, labs(nome, requer_cpf), ministerio_id, ministerios(nome)")
      .order("criado_em", { ascending: false });
    setInscricoes((data ?? []) as Inscricao[]);

    const { data: pgDinheiro } = await supabase
      .from("pagamentos")
      .select("valor")
      .eq("metodo", "dinheiro")
      .eq("status", "pago");
    const totalD = (pgDinheiro ?? []).reduce((s, p) => s + Number(p.valor), 0);
    setTotalDinheiro(totalD);
    
    const { data: cfg } = await supabase
      .from("app_settings")
      .select("inscricoes_abertas, google_sheet_pastores_url")
      .eq("id", true)
      .maybeSingle();
    if (cfg) {
      setInscricoesAbertas(cfg.inscricoes_abertas);
      setGoogleSheetPastoresUrl(cfg.google_sheet_pastores_url || "");
    }

    try {
      const mpCfg = await carregarMP();
      setMpAtivo(mpCfg.mercadoPagoAtivo);
      setMpPublicKey(mpCfg.mercadoPagoPublicKey);
      setMpConfigurado(mpCfg.hasAccessToken);
      if (mpCfg.hasAccessToken) {
        setMpAccessToken("_KEEP_EXISTING_");
      }
    } catch (err) {
      console.error("Erro ao carregar configurações do Mercado Pago:", err);
    }

    const { data: labsData } = await supabase
      .from("labs")
      .select("*")
      .order("eh_geral", { ascending: true })
      .order("nome", { ascending: true });
    if (labsData) setLabs(labsData as Lab[]);

    const { data: ministeriosData } = await supabase
      .from("ministerios")
      .select("*")
      .order("nome", { ascending: true });
    if (ministeriosData) setMinisterios(ministeriosData as Ministerio[]);

    try { setUsuarios(await listar()); } catch { /* noop */ }
  }

  async function toggleInscricoes() {
    const novo = !inscricoesAbertas;
    setSalvandoFlag(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ inscricoes_abertas: novo, atualizado_em: new Date().toISOString() })
      .eq("id", true);
    setSalvandoFlag(false);
    if (error) alert(error.message);
    else setInscricoesAbertas(novo);
  }

  async function reverter(id: string, origem: "validado" | "cancelado") {
    const msg = origem === "validado"
      ? "Reverter validação? O QR voltará a funcionar e as validações de LAB associadas serão resetadas."
      : "Reativar inscrição cancelada? Voltará para o status PAGO e o QR funcionará.";
    if (!confirm(msg)) return;
    const { error } = await supabase
      .from("inscricoes")
      .update({ 
        status: "pago", 
        validado_em: null, 
        validado_por: null,
        lab_qr_token: null,
        lab_validado_em: null,
        lab_validado_por: null
      })
      .eq("id", id);
    if (error) alert(error.message);
    else await carregar();
  }

  async function excluirInscricao(id: string) {
    if (!confirm("Tem certeza que deseja excluir permanentemente esta inscrição? Esta ação não pode ser desfeita e removerá todos os pagamentos vinculados.")) return;
    const { error } = await supabase.from("inscricoes").delete().eq("id", id);
    if (error) alert(error.message);
    else await carregar();
  }



  async function salvarMercadoPago(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoMP(true);
    try {
      await salvarMP({
        data: {
          mercadoPagoAtivo: mpAtivo,
          mercadoPagoPublicKey: mpPublicKey.trim(),
          mercadoPagoAccessToken: mpAccessToken.trim(),
        }
      });
      alert("Configurações do Mercado Pago salvas com sucesso!");
      const mpCfg = await carregarMP();
      setMpAtivo(mpCfg.mercadoPagoAtivo);
      setMpPublicKey(mpCfg.mercadoPagoPublicKey);
      setMpConfigurado(mpCfg.hasAccessToken);
      if (mpCfg.hasAccessToken) {
        setMpAccessToken("_KEEP_EXISTING_");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar configurações do Mercado Pago.");
    } finally {
      setSalvandoMP(false);
    }
  }

  async function criarLab(e: React.FormEvent) {
    e.preventDefault();
    if (!novoLabNome.trim() || !novoLabLocal.trim()) {
      alert("Preencha todos os campos.");
      return;
    }
    const { error } = await supabase.from("labs").insert({
      nome: novoLabNome.trim(),
      limite_vagas: novoLabLimite,
      local: novoLabLocal.trim(),
      requer_cpf: novoLabRequerCpf,
      eh_geral: novoLabEhGeral,
      ativo: true,
    });
    if (error) {
      alert(error.message);
    } else {
      setNovoLabNome("");
      setNovoLabLocal("");
      setNovoLabLimite(100);
      setNovoLabRequerCpf(false);
      setNovoLabEhGeral(false);
      await carregar();
    }
  }

  async function excluirLab(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta categoria? Isso só funcionará se não houver inscrições vinculadas.")) return;
    const { error } = await supabase.from("labs").delete().eq("id", id);
    if (error) alert(error.message);
    else await carregar();
  }

  async function salvarEdicaoLab(id: string) {
    const { error } = await supabase
      .from("labs")
      .update({
        nome: editLabNome.trim(),
        limite_vagas: editLabLimite,
        local: editLabLocal.trim(),
      })
      .eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      setEditingLabId(null);
      await carregar();
    }
  }

  function iniciarEdicaoLab(lab: Lab) {
    setEditingLabId(lab.id);
    setEditLabNome(lab.nome);
    setEditLabLimite(lab.limite_vagas);
    setEditLabLocal(lab.local);
  }

  async function toggleAtivoLab(id: string, ativoAtual: boolean) {
    const { error } = await supabase
      .from("labs")
      .update({ ativo: !ativoAtual })
      .eq("id", id);
    if (error) alert(error.message);
    else await carregar();
  }

  async function toggleRequerCpfLab(id: string, requerCpfAtual: boolean) {
    const { error } = await supabase
      .from("labs")
      .update({ requer_cpf: !requerCpfAtual })
      .eq("id", id);
    if (error) alert(error.message);
    else await carregar();
  }

  async function criarMinisterio(e: React.FormEvent) {
    e.preventDefault();
    if (!novoMinisterioNome.trim()) {
      alert("Preencha o nome do ministério.");
      return;
    }
    const { error } = await supabase.from("ministerios").insert({
      nome: novoMinisterioNome.trim(),
      ativo: true,
    });
    if (error) {
      alert(error.message);
    } else {
      setNovoMinisterioNome("");
      await carregar();
    }
  }

  async function excluirMinisterio(id: string) {
    if (!confirm("Tem certeza que deseja excluir este ministério? Isso só funcionará se não houver inscrições vinculadas.")) return;
    const { error } = await supabase.from("ministerios").delete().eq("id", id);
    if (error) alert(error.message);
    else await carregar();
  }

  async function salvarEdicaoMinisterio(id: string) {
    if (!editMinisterioNome.trim()) {
      alert("Preencha o nome do ministério.");
      return;
    }
    const { error } = await supabase
      .from("ministerios")
      .update({
        nome: editMinisterioNome.trim(),
      })
      .eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      setEditingMinisterioId(null);
      await carregar();
    }
  }

  function iniciarEdicaoMinisterio(min: Ministerio) {
    setEditingMinisterioId(min.id);
    setEditMinisterioNome(min.nome);
  }

  async function toggleAtivoMinisterio(id: string, ativoAtual: boolean) {
    const { error } = await supabase
      .from("ministerios")
      .update({ ativo: !ativoAtual })
      .eq("id", id);
    if (error) alert(error.message);
    else await carregar();
  }

  const vagasOcupadas = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    inscricoes.forEach((i) => {
      if (i.status !== "cancelado") {
        total++;
        if (i.lab_id) {
          counts[i.lab_id] = (counts[i.lab_id] || 0) + 1;
        }
      }
    });
    return { counts, total };
  }, [inscricoes]);

  const stats = useMemo(() => {
    const pagas = inscricoes.filter((i) => i.status === "pago" || i.status === "validado");
    const validadas = inscricoes.filter((i) => i.status === "validado");
    const canceladas = inscricoes.filter((i) => i.status === "cancelado");
    const receita = pagas.reduce((s, i) => s + Number(i.valor), 0);
    
    const regionais = [...Array.from({ length: 20 }, (_, idx) => String(idx + 2)), "SEDE"];
    const regionalCounts: Record<string, number> = {};
    regionais.forEach((r) => {
      regionalCounts[r] = pagas.filter((i) => i.regional === r).length;
    });

    return { 
      total: inscricoes.length, 
      pagas: pagas.length, 
      validadas: validadas.length, 
      canceladas: canceladas.length, 
      receita,
      regionalCounts,
      totalDinheiro,
    };
  }, [inscricoes, totalDinheiro]);

  const validadasList = inscricoes.filter((i) => i.status === "validado");
  const canceladasList = inscricoes.filter((i) => i.status === "cancelado");
  const filtradas = useMemo(() => {
    return inscricoes.filter((i) => {
      const matchesBusca = !busca ||
        i.nome_participante.toLowerCase().includes(busca.toLowerCase()) ||
        (i.email ?? "").toLowerCase().includes(busca.toLowerCase());
      const matchesRegional = !regionalSelecionada || i.regional === regionalSelecionada;
      return matchesBusca && matchesRegional;
    });
  }, [inscricoes, busca, regionalSelecionada]);

  function copiar(path: string) {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    setCopiado(path);
    setTimeout(() => setCopiado(null), 1500);
  }

  if (loading || !user) {
    return <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando…</main>;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="font-display text-xl text-primary">Hope Conference — Super Admin</Link>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-muted-foreground">{user.email}</span>
            <Link to="/painel" className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">PAINEL</Link>
            <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="rounded-md border border-border px-3 py-2 tracking-widest text-primary hover:bg-muted">SAIR</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <Cards stats={stats} />
        <RegionalCards
          stats={stats}
          selectedRegional={regionalSelecionada}
          onSelectRegional={setRegionalSelecionada}
        />

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl text-primary">Inscrições</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {inscricoesAbertas
                  ? "O botão de inscrição na home está ATIVO e clicável."
                  : "O botão de inscrição na home aparece, mas está DESABILITADO."}
              </p>
            </div>
            <button
              onClick={toggleInscricoes}
              disabled={salvandoFlag}
              className={`rounded-md border px-4 py-2 text-xs tracking-widest ${
                inscricoesAbertas
                  ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                  : "border-gold bg-gold/10 text-primary hover:bg-gold/20"
              }`}
            >
              {salvandoFlag ? "SALVANDO…" : inscricoesAbertas ? "DESABILITAR BOTÃO" : "REATIVAR BOTÃO"}
            </button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-xl text-primary">Links dos painéis</h2>
            <p className="mt-1 text-xs text-muted-foreground">Compartilhe somente com os usuários autorizados.</p>
            <ul className="mt-4 space-y-2">
              {[
                { label: "Painel do Inscrito", path: "/painel" },
                { label: "Painel da Recepção (Presencial)", path: "/recepcao" },
                { label: "Controle de Acesso (Gate)", path: "/gate" },
                { label: "Admin", path: "/admin" },
                { label: "Super Admin", path: "/super" },
              ].map((l) => (
                <li key={l.path} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-primary">{l.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.path}</p>
                  </div>
                  <button onClick={() => copiar(l.path)} className="rounded-md border border-gold bg-gold/10 px-3 py-1.5 text-[10px] tracking-widest text-primary hover:bg-gold/20">
                    {copiado === l.path ? "COPIADO!" : "COPIAR"}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-xl text-primary">Validar entrada</h2>
            <p className="mt-1 text-xs text-muted-foreground">Abra a câmera para validar QR Codes.</p>
            <div className="mt-4">
              <ValidadorEntrada userId={user.id} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-display text-xl text-primary">Ingressos validados na entrada</h2>
            <span className="text-xs text-muted-foreground">{validadasList.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-left text-xs tracking-widest uppercase text-muted-foreground">
                <tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Validado em</th><th className="p-3 text-right">Ação</th></tr>
              </thead>
              <tbody>
                {validadasList.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="p-3 text-primary">{i.nome_participante}</td>
                    <td className="p-3 text-muted-foreground">{i.email}</td>
                    <td className="p-3 text-muted-foreground">{i.validado_em ? new Date(i.validado_em).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => reverter(i.id, "validado")} className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] tracking-widest text-destructive hover:bg-destructive/10">
                        REVERTER
                      </button>
                    </td>
                  </tr>
                ))}
                {validadasList.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">Nenhum ingresso validado ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-display text-xl text-primary">Inscrições canceladas</h2>
            <span className="text-xs text-muted-foreground">{canceladasList.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-left text-xs tracking-widest uppercase text-muted-foreground">
                <tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Inscrito em</th><th className="p-3 text-right">Ação</th></tr>
              </thead>
              <tbody>
                {canceladasList.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="p-3 text-primary">{i.nome_participante}</td>
                    <td className="p-3 text-muted-foreground">{i.email}</td>
                    <td className="p-3 text-muted-foreground">{new Date(i.criado_em).toLocaleString("pt-BR")}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => reverter(i.id, "cancelado")} className="rounded-md border border-gold bg-gold/10 px-2 py-1 text-[10px] tracking-widest text-primary hover:bg-gold/20">
                        REATIVAR
                      </button>
                    </td>
                  </tr>
                ))}
                {canceladasList.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">Nenhuma inscrição cancelada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>



        <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="font-display text-xl text-primary">Integração do Mercado Pago</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Habilite o checkout transparente (Cartão e Pix) para cobrar as inscrições automaticamente.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={mpAtivo}
                  onChange={(e) => setMpAtivo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold"></div>
                <span className="ml-2 text-xs font-semibold text-primary tracking-widest uppercase">
                  {mpAtivo ? "Ativo" : "Inativo"}
                </span>
              </label>
            </div>
          </div>

          <form onSubmit={salvarMercadoPago} className="space-y-4 max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">
                  Public Key (Chave Pública)
                </label>
                <input
                  type="text"
                  required={mpAtivo}
                  placeholder="APP_USR-..."
                  value={mpPublicKey}
                  onChange={(e) => setMpPublicKey(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left flex justify-between">
                  <span>Access Token (Chave Privada)</span>
                  {mpConfigurado && <span className="text-gold tracking-normal text-[9px] lowercase font-normal">(configurado)</span>}
                </label>
                <input
                  type="password"
                  required={mpAtivo && !mpConfigurado}
                  placeholder={mpConfigurado ? "••••••••••••••••••••••••••••••••" : "TEST-... ou APP_USR-..."}
                  value={mpAccessToken === "_KEEP_EXISTING_" ? "" : mpAccessToken}
                  onChange={(e) => setMpAccessToken(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={salvandoMP}
              className="rounded-md bg-primary px-5 py-2.5 text-xs font-semibold tracking-widest text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {salvandoMP ? "SALVANDO..." : "SALVAR CONFIGURAÇÃO"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="font-display text-xl text-primary">Gerenciamento de LABs (Categorias)</h2>
          <p className="mt-1 text-xs text-muted-foreground">Configure os limites de vagas, locais e status de ativação das categorias.</p>

          <form onSubmit={criarLab} className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-5 items-end border-b border-border pb-5">
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground text-left block">NOME DA LAB</label>
              <input required placeholder="Nome" value={novoLabNome} onChange={(e) => setNovoLabNome(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground text-left block">LOCAL</label>
              <input required placeholder="Local" value={novoLabLocal} onChange={(e) => setNovoLabLocal(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground text-left block">LIMITE DE VAGAS</label>
              <input required type="number" min={1} placeholder="Limite" value={novoLabLimite} onChange={(e) => setNovoLabLimite(Number(e.target.value))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
            </div>
            <div className="flex flex-col gap-2 py-1 text-left justify-center h-full">
              <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                <input type="checkbox" checked={novoLabRequerCpf} onChange={(e) => setNovoLabRequerCpf(e.target.checked)} />
                Requer CPF
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                <input type="checkbox" checked={novoLabEhGeral} onChange={(e) => setNovoLabEhGeral(e.target.checked)} />
                É Geral (Nenhum)
              </label>
            </div>
            <button className="rounded-md bg-primary px-4 py-2 text-xs font-semibold tracking-widest text-primary-foreground hover:bg-primary/90 h-[38px]">
              ADICIONAR LAB
            </button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="text-left text-xs tracking-widest uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Nome / Local</th>
                  <th className="p-3">Inscrições</th>
                  <th className="p-3">Limite</th>
                  <th className="p-3">CPF Requerido</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {labs.map((l) => {
                  const ocupadas = l.eh_geral ? vagasOcupadas.total : (vagasOcupadas.counts[l.id] || 0);
                  const restantes = Math.max(0, l.limite_vagas - ocupadas);
                  const isEditing = editingLabId === l.id;

                  return (
                    <tr key={l.id} className="border-t border-border">
                      <td className="p-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input required value={editLabNome} onChange={(e) => setEditLabNome(e.target.value)} className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-gold w-full" />
                            <input required value={editLabLocal} onChange={(e) => setEditLabLocal(e.target.value)} className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-gold w-full" />
                          </div>
                        ) : (
                          <div className="text-left">
                            <p className="font-semibold text-primary">{l.nome} {l.eh_geral && <span className="rounded bg-gold/20 text-gold px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider ml-1">GERAL</span>}</p>
                            <p className="text-xs text-muted-foreground">{l.local}</p>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-left">
                        <span className="font-semibold text-primary">{ocupadas}</span>
                        <span className="text-muted-foreground text-xs"> / {restantes} vagas restantes</span>
                      </td>
                      <td className="p-3 text-left">
                        {isEditing ? (
                          <input required type="number" value={editLabLimite} onChange={(e) => setEditLabLimite(Number(e.target.value))} className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-gold w-20" />
                        ) : (
                          <span className="text-muted-foreground">{l.limite_vagas}</span>
                        )}
                      </td>
                      <td className="p-3 text-left">
                        <button onClick={() => toggleRequerCpfLab(l.id, l.requer_cpf)} className={`rounded px-2 py-0.5 text-[10px] tracking-wider uppercase font-semibold border cursor-pointer ${l.requer_cpf ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-muted border-border text-muted-foreground'}`}>
                          {l.requer_cpf ? "Sim" : "Não"}
                        </button>
                      </td>
                      <td className="p-3 text-left">
                        <button onClick={() => toggleAtivoLab(l.id, l.ativo)} className={`rounded px-2 py-0.5 text-[10px] tracking-wider uppercase font-semibold border cursor-pointer ${l.ativo ? 'bg-gold/10 border-gold/20 text-primary' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
                          {l.ativo ? "Ativo" : "Desativado"}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => salvarEdicaoLab(l.id)} className="rounded-md bg-primary px-2 py-1 text-[10px] tracking-widest text-primary-foreground hover:bg-primary/90">
                              SALVAR
                            </button>
                            <button onClick={() => setEditingLabId(null)} className="rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-muted-foreground hover:bg-muted">
                              CANCELAR
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => iniciarEdicaoLab(l)} className="rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-primary hover:bg-muted">
                              EDITAR
                            </button>
                            {!l.eh_geral && (
                              <button onClick={() => excluirLab(l.id)} className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] tracking-widest text-destructive hover:bg-destructive/10">
                                EXCLUIR
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="font-display text-xl text-primary">Gerenciamento de Ministérios</h2>
          <p className="mt-1 text-xs text-muted-foreground">Adicione e edite os ministérios cadastrados na regional SEDE.</p>

          <form onSubmit={criarMinisterio} className="mt-4 flex gap-3 max-w-xl items-end border-b border-border pb-5">
            <div className="space-y-1 flex-1">
              <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground text-left block">NOME DO MINISTÉRIO</label>
              <input required placeholder="Nome do Ministério" value={novoMinisterioNome} onChange={(e) => setNovoMinisterioNome(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
            </div>
            <button className="rounded-md bg-primary px-4 py-2 text-xs font-semibold tracking-widest text-primary-foreground hover:bg-primary/90 h-[38px]">
              ADICIONAR
            </button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="text-left text-xs tracking-widest uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ministerios.map((m) => {
                  const isEditing = editingMinisterioId === m.id;

                  return (
                    <tr key={m.id} className="border-t border-border">
                      <td className="p-3">
                        {isEditing ? (
                          <input required value={editMinisterioNome} onChange={(e) => setEditMinisterioNome(e.target.value)} className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-gold w-full" />
                        ) : (
                          <span className="font-semibold text-primary">{m.nome}</span>
                        )}
                      </td>
                      <td className="p-3 text-left">
                        <button onClick={() => toggleAtivoMinisterio(m.id, m.ativo)} className={`rounded px-2 py-0.5 text-[10px] tracking-wider uppercase font-semibold border cursor-pointer ${m.ativo ? 'bg-gold/10 border-gold/20 text-primary' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
                          {m.ativo ? "Ativo" : "Desativado"}
                        </button>
                      </td>
                      <td className="p-3 text-right text-xs">
                        {isEditing ? (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => salvarEdicaoMinisterio(m.id)} className="rounded-md bg-primary px-2 py-1 text-[10px] tracking-widest text-primary-foreground hover:bg-primary/90">
                              SALVAR
                            </button>
                            <button onClick={() => setEditingMinisterioId(null)} className="rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-muted-foreground hover:bg-muted">
                              CANCELAR
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => iniciarEdicaoMinisterio(m)} className="rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-primary hover:bg-muted">
                              EDITAR
                            </button>
                            <button onClick={() => excluirMinisterio(m.id)} className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] tracking-widest text-destructive hover:bg-destructive/10">
                              EXCLUIR
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {ministerios.length === 0 && (
                  <tr><td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">Nenhum ministério cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <ListaInscricoes
          inscricoes={filtradas}
          busca={busca}
          setBusca={setBusca}
          onExcluir={excluirInscricao}
        />
        <ListaPastoresCoordenadores inscricoes={filtradas} />

        <GestaoUsuarios
          usuarios={usuarios}
          podeCriarAdmin={true}
          labs={labs}
          onCriar={async (payload) => { await criar({ data: payload }); await carregar(); }}
          onRemover={async (u) => { await remover({ data: { user_id: u.user_id, role: u.role as "admin" | "gate" | "recepcao" } }); await carregar(); }}
        />
      </div>
    </main>
  );
}

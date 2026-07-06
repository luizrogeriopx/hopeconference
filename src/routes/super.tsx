import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn, createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Cards, RegionalCards, LabCards, MinisterioCards, ListaInscricoes, GestaoUsuarios, ListaPastoresCoordenadores } from "./admin";
import { ValidadorEntrada } from "@/components/ValidadorEntrada";
import { ContasUsuarios } from "@/components/ContasUsuarios";
import { EnviarNotificacao } from "@/components/EnviarNotificacao";
import { GerenciarGalerias } from "@/components/GerenciarGalerias";
import {
  criarUsuarioPainel,
  listarUsuariosPainel,
  removerUsuarioPainel,
} from "@/lib/users.functions";
import {
  carregarConfiguracaoMercadoPago,
  salvarConfiguracaoMercadoPago,
} from "@/lib/payment.functions";

export const corrigirInscricoesWestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const ad = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Verificar se o usuário solicitante é super_admin
    const { data: meusRoles } = await ad
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (meusRoles ?? []).map((r) => r.role);
    if (!roles.includes("super_admin")) {
      throw new Error("Sem permissão. Apenas super admin.");
    }

    const emailWest = "westsantos21@gmail.com";

    // 1. Buscar inscrições
    const { data: inscs, error: fetchErr } = await ad
      .from("inscricoes")
      .select("id, status, valor, nome_participante")
      .eq("email", emailWest);

    if (fetchErr) throw new Error("Erro ao carregar inscrições: " + fetchErr.message);
    if (!inscs || inscs.length === 0) {
      return { ok: false, message: "Nenhuma inscrição encontrada para o e-mail " + emailWest };
    }

    const inscIds = inscs.map((i) => i.id);

    // 2. Atualizar inscrições para 'pago'
    const { error: updateErr } = await ad
      .from("inscricoes")
      .update({ status: "pago" })
      .in("id", inscIds);
    if (updateErr) throw new Error("Erro ao atualizar inscrições: " + updateErr.message);

    // 3. Remover pagamentos pendentes e inserir pago
    await ad
      .from("pagamentos")
      .delete()
      .in("inscricao_id", inscIds)
      .eq("status", "pendente");

    const paymentRows = inscs.map((insc) => ({
      inscricao_id: insc.id,
      status: "pago",
      metodo: "pix",
      valor: insc.valor || 50,
    }));

    const { error: payErr } = await ad.from("pagamentos").insert(paymentRows);
    if (payErr) throw new Error("Erro ao salvar pagamentos: " + payErr.message);

    return {
      ok: true,
      message: `Sucesso! ${inscs.length} inscrições do e-mail ${emailWest} foram marcadas como PAGAS e seus pagamentos registrados como PIX.`,
      detalhes: inscs.map((i) => `${i.nome_participante} (Status anterior: ${i.status})`).join(", "),
    };
  });

export const Route = createFileRoute("/super")({
  component: SuperPage,
  head: () => ({ meta: [{ title: "Super Admin — Hope Conference" }] }),
});

type Inscricao = {
  id: string;
  nome_participante: string;
  email: string | null;
  telefone?: string | null;
  status: "pendente" | "pago" | "cancelado" | "validado";
  valor: number;
  criado_em: string;
  validado_em: string | null;
  cpf: string | null;
  lab_id: string | null;
  qr_token: string;
  lab_qr_token?: string | null;
  regional: string;
  congregacao: string;
  labs?: { nome: string; local?: string; requer_cpf: boolean } | null;
  ministerio_id?: string | null;
  ministerios?: { nome: string } | null;
  canal?: string | null;
  pagamentos?: { metodo: string }[] | null;
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
  link_material?: string | null;
};

type RegionalCongregacao = {
  id: string;
  regional: string;
  congregacao: string;
  criado_em: string;
};

function SuperPage() {
  const navigate = useNavigate();
  const { user, isSuper, loading, signOut } = useAuth();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/super" } });
    if (!loading && user && !isSuper) navigate({ to: "/painel" });
  }, [loading, user, isSuper, navigate]);

  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioPainel[]>([]);
  const [busca, setBusca] = useState("");
  const [regionalSelecionada, setRegionalSelecionada] = useState<string | null>(null);
  const [labSelecionado, setLabSelecionado] = useState<string | null>(null);
  const [ministerioSelecionado, setMinisterioSelecionado] = useState<string | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "pendente" | "pago" | "validado" | "cancelado">("todos");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [inscricoesAbertas, setInscricoesAbertas] = useState<boolean>(true);
  const [materialAtivo, setMaterialAtivo] = useState<boolean>(true);
  const [mostrarSegundaHomepage, setMostrarSegundaHomepage] = useState<boolean>(false);
  const [whatsappSuporteAtivo, setWhatsappSuporteAtivo] = useState<boolean>(true);
  const [whatsappSuporteNumero, setWhatsappSuporteNumero] = useState<string>("5562996897483");
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
  const [novoLabLinkMaterial, setNovoLabLinkMaterial] = useState("");

  // Edit LAB form state
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [editLabNome, setEditLabNome] = useState("");
  const [editLabLimite, setEditLabLimite] = useState(100);
  const [editLabLocal, setEditLabLocal] = useState("");
  const [editLabLinkMaterial, setEditLabLinkMaterial] = useState("");

  // Mercado Pago config state
  const [mpAtivo, setMpAtivo] = useState(false);
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpConfigurado, setMpConfigurado] = useState(false);
  const [salvandoMP, setSalvandoMP] = useState(false);

  // Congregações state
  const [congregacoes, setCongregacoes] = useState<RegionalCongregacao[]>([]);
  const [novaCongregacaoRegional, setNovaCongregacaoRegional] = useState("2");
  const [novaCongregacaoNome, setNovaCongregacaoNome] = useState("");
  const [editingCongregacaoId, setEditingCongregacaoId] = useState<string | null>(null);
  const [editCongregacaoNome, setEditCongregacaoNome] = useState("");
  const [selecionadosValidados, setSelecionadosValidados] = useState<string[]>([]);

  const [rodandoFix, setRodandoFix] = useState(false);
  const [resultadoFix, setResultadoFix] = useState<string | null>(null);
  const corrigirWest = useServerFn(corrigirInscricoesWestFn);

  async function handleCorrigirWest() {
    if (!confirm("Confirmar a baixa de pagamento por PIX das inscrições de westsantos21@gmail.com?")) return;
    setRodandoFix(true);
    setResultadoFix(null);
    try {
      const res = await corrigirWest();
      setResultadoFix(res.message);
      await carregar(); // Recarrega inscrições
    } catch (err: any) {
      setResultadoFix("Erro ao executar correção: " + err.message);
    } finally {
      setRodandoFix(false);
    }
  }

  const listar = useServerFn(listarUsuariosPainel);
  const criar = useServerFn(criarUsuarioPainel);
  const remover = useServerFn(removerUsuarioPainel);
  const carregarMP = useServerFn(carregarConfiguracaoMercadoPago);
  const salvarMP = useServerFn(salvarConfiguracaoMercadoPago);

  useEffect(() => { if (user && isSuper) void carregar(); }, [user, isSuper]);

  async function carregar() {
    const { data } = await supabase
      .from("inscricoes")
      .select("id, nome_participante, email, telefone, status, valor, criado_em, validado_em, cpf, lab_id, qr_token, lab_qr_token, regional, congregacao, labs(nome, local, requer_cpf), ministerio_id, ministerios(nome), canal, pagamentos(metodo)")
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
      .select("inscricoes_abertas, google_sheet_pastores_url, material_ativo, mostrar_segunda_homepage, whatsapp_suporte_ativo, whatsapp_suporte_numero")
      .eq("id", true)
      .maybeSingle();
    if (cfg) {
      setInscricoesAbertas(cfg.inscricoes_abertas);
      setGoogleSheetPastoresUrl(cfg.google_sheet_pastores_url || "");
      setMaterialAtivo(cfg.material_ativo ?? true);
      setMostrarSegundaHomepage(!!cfg.mostrar_segunda_homepage);
      setWhatsappSuporteAtivo(cfg.whatsapp_suporte_ativo ?? true);
      setWhatsappSuporteNumero(cfg.whatsapp_suporte_numero || "5562996897483");
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

    const { data: congData } = await supabase
      .from("regional_congregacoes")
      .select("*")
      .order("regional", { ascending: true })
      .order("congregacao", { ascending: true });
    if (congData) setCongregacoes(congData as RegionalCongregacao[]);

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

  async function toggleMaterial() {
    const novo = !materialAtivo;
    setSalvandoFlag(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ material_ativo: novo, atualizado_em: new Date().toISOString() })
      .eq("id", true);
    setSalvandoFlag(false);
    if (error) alert(error.message);
    else setMaterialAtivo(novo);
  }

  async function setHomepageVersion(mostrarSegunda: boolean) {
    setSalvandoFlag(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ mostrar_segunda_homepage: mostrarSegunda, atualizado_em: new Date().toISOString() })
      .eq("id", true);
    setSalvandoFlag(false);
    if (error) alert(error.message);
    else setMostrarSegundaHomepage(mostrarSegunda);
  }

  async function toggleWhatsappSuporte() {
    const novo = !whatsappSuporteAtivo;
    setSalvandoFlag(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ whatsapp_suporte_ativo: novo, atualizado_em: new Date().toISOString() })
      .eq("id", true);
    setSalvandoFlag(false);
    if (error) alert(error.message);
    else setWhatsappSuporteAtivo(novo);
  }

  async function salvarWhatsappNumero(numero: string) {
    setSalvandoFlag(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ whatsapp_suporte_numero: numero, atualizado_em: new Date().toISOString() })
      .eq("id", true);
    setSalvandoFlag(false);
    if (error) alert(error.message);
    else {
      setWhatsappSuporteNumero(numero);
      alert("Número do WhatsApp de suporte atualizado!");
    }
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

  async function reverterEmMassa(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`Deseja reverter a validação de ${ids.length} inscrições selecionadas? Os QR Codes voltarão a funcionar.`)) return;
    setSalvandoFlag(true);
    try {
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
        .in("id", ids);
      if (error) throw error;
      alert(`${ids.length} inscrições revertidas com sucesso!`);
      setSelecionadosValidados([]);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao reverter em massa.");
    } finally {
      setSalvandoFlag(false);
    }
  }

  async function excluirInscricao(id: string) {
    if (!confirm("Tem certeza que deseja excluir permanentemente esta inscrição? Esta ação não pode ser desfeita e removerá todos os pagamentos vinculados.")) return;
    const { error } = await supabase.from("inscricoes").delete().eq("id", id);
    if (error) alert(error.message);
    else await carregar();
  }

  async function editarInscricao(
    id: string,
    dados: { nome_participante: string; email: string | null; telefone: string | null; regional: string; congregacao: string; ministerio_id: string | null }
  ) {
    // Atualiza dados pessoais e vínculo (regional/congregação/ministério).
    // qr_token e lab_qr_token NÃO são alterados — QRs gerados continuam válidos.
    const { error } = await supabase
      .from("inscricoes")
      .update({
        nome_participante: dados.nome_participante,
        email: dados.email,
        telefone: dados.telefone,
        regional: dados.regional,
        congregacao: dados.congregacao,
        ministerio_id: dados.ministerio_id,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await carregar();
  }

  async function criarCongregacao(e: React.FormEvent) {
    e.preventDefault();
    if (!novaCongregacaoNome.trim()) return;

    const { error } = await supabase
      .from("regional_congregacoes")
      .insert({
        regional: novaCongregacaoRegional,
        congregacao: novaCongregacaoNome.trim()
      });

    if (error) {
      alert("Erro ao adicionar congregação: " + error.message);
    } else {
      setNovaCongregacaoNome("");
      // Recarregar
      const { data: congData } = await supabase
        .from("regional_congregacoes")
        .select("*")
        .order("regional", { ascending: true })
        .order("congregacao", { ascending: true });
      if (congData) setCongregacoes(congData as RegionalCongregacao[]);
    }
  }

  function iniciarEdicaoCongregacao(c: RegionalCongregacao) {
    setEditingCongregacaoId(c.id);
    setEditCongregacaoNome(c.congregacao);
  }

  async function salvarEdicaoCongregacao(id: string) {
    if (!editCongregacaoNome.trim()) return;

    const { error } = await supabase
      .from("regional_congregacoes")
      .update({ congregacao: editCongregacaoNome.trim() })
      .eq("id", id);

    if (error) {
      alert("Erro ao salvar congregação: " + error.message);
    } else {
      setEditingCongregacaoId(null);
      // Recarregar
      const { data: congData } = await supabase
        .from("regional_congregacoes")
        .select("*")
        .order("regional", { ascending: true })
        .order("congregacao", { ascending: true });
      if (congData) setCongregacoes(congData as RegionalCongregacao[]);
    }
  }

  async function excluirCongregacao(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta congregação?")) return;

    const { error } = await supabase
      .from("regional_congregacoes")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Erro ao excluir congregação: " + error.message);
    } else {
      // Recarregar
      const { data: congData } = await supabase
        .from("regional_congregacoes")
        .select("*")
        .order("regional", { ascending: true })
        .order("congregacao", { ascending: true });
      if (congData) setCongregacoes(congData as RegionalCongregacao[]);
    }
  }

  async function alterarLabInscricao(id: string, newLabId: string) {
    const selectedLab = labs.find(l => l.id === newLabId);
    if (!selectedLab) return;
    
    if (!confirm(`Deseja alterar a categoria LAB deste participante para "${selectedLab.nome} (${selectedLab.local})"?`)) {
      await carregar();
      return;
    }

    const currentInsc = inscricoes.find(i => i.id === id);
    const isGeral = selectedLab.eh_geral;
    const labQrToken = isGeral ? null : (currentInsc?.lab_qr_token || globalThis.crypto.randomUUID());

    const { error } = await supabase
      .from("inscricoes")
      .update({
        lab_id: newLabId,
        lab_qr_token: labQrToken,
        lab_validado_em: null,
        lab_validado_por: null,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
    } else {
      await carregar();
    }
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
      link_material: novoLabLinkMaterial.trim() || null,
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
      setNovoLabLinkMaterial("");
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
        link_material: editLabLinkMaterial.trim() || null,
      })
      .eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      setEditingLabId(null);
      setEditLabLinkMaterial("");
      await carregar();
    }
  }

  function iniciarEdicaoLab(lab: Lab) {
    setEditingLabId(lab.id);
    setEditLabNome(lab.nome);
    setEditLabLimite(lab.limite_vagas);
    setEditLabLocal(lab.local);
    setEditLabLinkMaterial(lab.link_material || "");
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

    const labCounts: Record<string, number> = {};
    pagas.forEach((i) => {
      if (i.lab_id) labCounts[i.lab_id] = (labCounts[i.lab_id] ?? 0) + 1;
    });

    const ministerioCounts: Record<string, number> = {};
    pagas.forEach((i) => {
      if (i.ministerio_id) ministerioCounts[i.ministerio_id] = (ministerioCounts[i.ministerio_id] ?? 0) + 1;
    });

    return { 
      total: inscricoes.length, 
      pagas: pagas.length, 
      validadas: validadas.length, 
      canceladas: canceladas.length, 
      receita,
      regionalCounts,
      labCounts,
      ministerioCounts,
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
      const matchesLab = !labSelecionado || i.lab_id === labSelecionado;
      const matchesMinisterio = !ministerioSelecionado || i.ministerio_id === ministerioSelecionado;
      const matchesStatus = statusFiltro === "todos" || i.status === statusFiltro;
      return matchesBusca && matchesRegional && matchesLab && matchesMinisterio && matchesStatus;
    });
  }, [inscricoes, busca, regionalSelecionada, labSelecionado, ministerioSelecionado, statusFiltro]);

  function copiar(path: string) {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    setCopiado(path);
    setTimeout(() => setCopiado(null), 1500);
  }

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      const offset = 110; // Compensação para o cabeçalho fixo (main + sub-header)
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
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

      {/* Sub-Header Fixo para Navegação pelas Seções */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav className="flex space-x-5 overflow-x-auto py-3 text-[10px] tracking-widest scrollbar-none whitespace-nowrap uppercase font-semibold text-muted-foreground">
            <button onClick={() => scrollToSection("dashboard")} className="hover:text-primary transition-colors cursor-pointer">Resumo</button>
            <button onClick={() => scrollToSection("inscritos")} className="hover:text-primary transition-colors cursor-pointer">Inscritos</button>
            <button onClick={() => scrollToSection("coordenadores")} className="hover:text-primary transition-colors cursor-pointer">Pastores/Coord.</button>
            <button onClick={() => scrollToSection("contas")} className="hover:text-primary transition-colors cursor-pointer">Contas</button>
            <button onClick={() => scrollToSection("notificacoes")} className="hover:text-primary transition-colors cursor-pointer">Notificar</button>
            <button onClick={() => scrollToSection("validar")} className="hover:text-primary transition-colors cursor-pointer">Validar</button>
            <button onClick={() => scrollToSection("labs")} className="hover:text-primary transition-colors cursor-pointer">LABs</button>
            <button onClick={() => scrollToSection("ministerios")} className="hover:text-primary transition-colors cursor-pointer">Ministérios</button>
            <button onClick={() => scrollToSection("congregacoes")} className="hover:text-primary transition-colors cursor-pointer">Congregações</button>
            <button onClick={() => scrollToSection("validados")} className="hover:text-primary transition-colors cursor-pointer">Validados</button>
            <button onClick={() => scrollToSection("canceladas")} className="hover:text-primary transition-colors cursor-pointer">Cancelados</button>
            <button onClick={() => scrollToSection("usuarios")} className="hover:text-primary transition-colors cursor-pointer">Equipe</button>
            <button onClick={() => scrollToSection("configuracoes")} className="hover:text-primary transition-colors cursor-pointer">Configurações</button>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <div id="dashboard" className="space-y-8">
          <Cards stats={stats} />
          <RegionalCards
            stats={stats}
            selectedRegional={regionalSelecionada}
            onSelectRegional={setRegionalSelecionada}
          />

          <LabCards
            labs={labs}
            stats={stats}
            selectedLab={labSelecionado}
            onSelectLab={setLabSelecionado}
          />

          <MinisterioCards
            ministerios={ministerios}
            stats={stats}
            selectedMinisterio={ministerioSelecionado}
            onSelectMinisterio={setMinisterioSelecionado}
          />
        </div>

        <div id="inscritos" className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs tracking-widest uppercase text-muted-foreground">Filtrar status:</label>
            {(["todos", "pendente", "pago", "validado", "cancelado"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFiltro(s)}
                className={`rounded-md border px-3 py-1.5 text-xs tracking-widest uppercase transition ${
                  statusFiltro === s
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <ListaInscricoes
            inscricoes={filtradas}
            busca={busca}
            setBusca={setBusca}
            onExcluir={excluirInscricao}
            onAlterarLab={alterarLabInscricao}
            onEditar={editarInscricao}
            labs={labs}
            congregacoes={congregacoes}
            ministerios={ministerios.filter((m) => m.ativo)}
            mostrarBaixarIngresso={true}
          />
        </div>

        <div id="coordenadores">
          <ListaPastoresCoordenadores inscricoes={filtradas} />
        </div>

        <div id="contas">
          <ContasUsuarios />
        </div>

        <div id="notificacoes">
          <EnviarNotificacao labs={labs} ministerios={ministerios} />
        </div>

        <div id="galerias">
          <GerenciarGalerias />
        </div>




        <section id="validar" className="grid gap-6 lg:grid-cols-2">
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

        <section id="labs" className="rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="font-display text-xl text-primary">Gerenciamento de LABs (Categorias)</h2>
          <p className="mt-1 text-xs text-muted-foreground">Configure os limites de vagas, locais e status de ativação das categorias.</p>

          <form onSubmit={criarLab} className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 items-end border-b border-border pb-5">
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
            <div className="space-y-1">
              <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground text-left block">LINK DO MATERIAL</label>
              <input placeholder="https://..." value={novoLabLinkMaterial} onChange={(e) => setNovoLabLinkMaterial(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold" />
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
            <button className="rounded-md bg-primary px-4 py-2 text-xs font-semibold tracking-widest text-primary-foreground hover:bg-primary/90 h-[38px] cursor-pointer">
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
                  <th className="p-3">Link do Material</th>
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
                        {isEditing ? (
                          <input placeholder="https://..." value={editLabLinkMaterial} onChange={(e) => setEditLabLinkMaterial(e.target.value)} className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-gold w-full min-w-[150px]" />
                        ) : (
                          l.link_material ? (
                            <a href={l.link_material} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold text-xs">
                              Link do Material
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Nenhum</span>
                          )
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

        <section id="ministerios" className="rounded-xl border border-border bg-card shadow-sm p-5">
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

        <section id="congregacoes" className="rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="font-display text-xl text-primary">Gerenciamento de Congregações</h2>
          <p className="mt-1 text-xs text-muted-foreground">Adicione, edite ou remova as congregações vinculadas às regionais (02 a 21).</p>

          <div className="mt-4 flex flex-col md:flex-row gap-4 items-end border-b border-border pb-5">
            <div className="space-y-1 w-full md:w-1/3">
              <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground text-left block">SELECIONAR REGIONAL</label>
              <select
                value={novaCongregacaoRegional}
                onChange={(e) => setNovaCongregacaoRegional(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
              >
                {Array.from({ length: 20 }, (_, idx) => String(idx + 2)).map((r) => (
                  <option key={r} value={r}>
                    Regional {String(r).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
            
            <form onSubmit={criarCongregacao} className="flex-1 flex gap-3 items-end w-full">
              <div className="space-y-1 flex-1">
                <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground text-left block">NOME DA CONGREGAÇÃO</label>
                <input
                  required
                  placeholder="Nome da congregação"
                  value={novaCongregacaoNome}
                  onChange={(e) => setNovaCongregacaoNome(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-gold"
                />
              </div>
              <button className="rounded-md bg-primary px-4 py-2 text-xs font-semibold tracking-widest text-primary-foreground hover:bg-primary/90 h-[38px] whitespace-nowrap">
                ADICIONAR
              </button>
            </form>
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-muted-foreground">
                Exibindo congregações da <strong>Regional {String(novaCongregacaoRegional).padStart(2, "0")}</strong>
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead className="text-left text-xs tracking-widest uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Regional</th>
                    <th className="p-3">Congregação</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {congregacoes
                    .filter((c) => c.regional === novaCongregacaoRegional)
                    .map((c) => {
                      const isEditing = editingCongregacaoId === c.id;

                      return (
                        <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                          <td className="p-3 font-medium text-muted-foreground">
                            Regional {String(c.regional).padStart(2, "0")}
                          </td>
                          <td className="p-3">
                            {isEditing ? (
                              <input
                                required
                                value={editCongregacaoNome}
                                onChange={(e) => setEditCongregacaoNome(e.target.value)}
                                className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-gold w-full"
                              />
                            ) : (
                              <span className="font-semibold text-primary">{c.congregacao}</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-xs">
                            {isEditing ? (
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => salvarEdicaoCongregacao(c.id)}
                                  className="rounded-md bg-primary px-2 py-1 text-[10px] tracking-widest text-primary-foreground hover:bg-primary/90"
                                >
                                  SALVAR
                                </button>
                                <button
                                  onClick={() => setEditingCongregacaoId(null)}
                                  className="rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-muted-foreground hover:bg-muted"
                                >
                                  CANCELAR
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => iniciarEdicaoCongregacao(c)}
                                  className="rounded-md border border-border px-2 py-1 text-[10px] tracking-widest text-primary hover:bg-muted"
                                >
                                  EDITAR
                                </button>
                                <button
                                  onClick={() => excluirCongregacao(c.id)}
                                  className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] tracking-widest text-destructive hover:bg-destructive/10"
                                >
                                  EXCLUIR
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {congregacoes.filter((c) => c.regional === novaCongregacaoRegional).length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">
                        Nenhuma congregação cadastrada para esta regional.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="validados" className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between border-b border-border p-4 gap-3">
            <div>
              <h2 className="font-display text-xl text-primary">Ingressos validados na entrada</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{validadasList.length} total</p>
            </div>
            {selecionadosValidados.length > 0 && (
              <button
                onClick={() => reverterEmMassa(selecionadosValidados)}
                className="rounded-md bg-destructive text-white px-3 py-1.5 text-xs font-semibold tracking-widest hover:bg-destructive/90 transition-colors cursor-pointer"
              >
                REVERTER EM MASSA ({selecionadosValidados.length})
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="text-left text-xs tracking-widest uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        validadasList.length > 0 &&
                        validadasList.every((i) => selecionadosValidados.includes(i.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelecionadosValidados(validadasList.map((i) => i.id));
                        } else {
                          setSelecionadosValidados([]);
                        }
                      }}
                      className="rounded border-input text-gold focus:ring-gold h-4 w-4 bg-background cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Nome</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3">Validado em</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {validadasList.map((i) => {
                  const isChecked = selecionadosValidados.includes(i.id);
                  return (
                    <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelecionadosValidados([...selecionadosValidados, i.id]);
                            } else {
                              setSelecionadosValidados(
                                selecionadosValidados.filter((id) => id !== i.id)
                              );
                            }
                          }}
                          className="rounded border-input text-gold focus:ring-gold h-4 w-4 bg-background cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-primary">{i.nome_participante}</td>
                      <td className="p-3 text-muted-foreground">{i.email}</td>
                      <td className="p-3 text-muted-foreground">{i.validado_em ? new Date(i.validado_em).toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => reverter(i.id, "validado")} className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] tracking-widest text-destructive hover:bg-destructive/10 cursor-pointer">
                          REVERTER
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {validadasList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      Nenhum ingresso validado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="canceladas" className="rounded-xl border border-border bg-card shadow-sm">
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

        <div id="usuarios">
          <GestaoUsuarios
            usuarios={usuarios}
            podeCriarAdmin={true}
            labs={labs}
            onCriar={async (payload) => { await criar({ data: payload }); await carregar(); }}
            onRemover={async (u) => { await remover({ data: { user_id: u.user_id, role: u.role as "admin" | "gate" | "recepcao" } }); await carregar(); }}
          />
        </div>

        <div id="configuracoes" className="space-y-8">
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
                className={`rounded-md border px-4 py-2 text-xs tracking-widest cursor-pointer ${
                  inscricoesAbertas
                    ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                    : "border-gold bg-gold/10 text-primary hover:bg-gold/20"
                }`}
              >
                {salvandoFlag ? "SALVANDO…" : inscricoesAbertas ? "DESABILITAR BOTÃO" : "REATIVAR BOTÃO"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl text-primary">Downloads de Material</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {materialAtivo
                    ? "O botão 'BAIXAR MATERIAL' está ativo e visível para inscritos pagos no painel."
                    : "O botão 'BAIXAR MATERIAL' está desabilitado e oculto para todos os inscritos."}
                </p>
              </div>
              <button
                onClick={toggleMaterial}
                disabled={salvandoFlag}
                className={`rounded-md border px-4 py-2 text-xs tracking-widest cursor-pointer ${
                  materialAtivo
                    ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                    : "border-gold bg-gold/10 text-primary hover:bg-gold/20"
                }`}
              >
                {salvandoFlag ? "SALVANDO…" : materialAtivo ? "DESABILITAR BOTÃO" : "REATIVAR BOTÃO"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl text-primary">Página Inicial Ativa</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Escolha qual versão da página inicial exibir para os visitantes.
                </p>
              </div>
              <div className="flex items-center rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setHomepageVersion(false)}
                  disabled={salvandoFlag}
                  className={`px-4 py-2 text-xs tracking-widest font-medium cursor-pointer transition-colors duration-150 ${
                    !mostrarSegundaHomepage
                      ? "bg-gold/10 text-primary border-r border-border"
                      : "bg-transparent text-muted-foreground hover:bg-muted border-r border-border"
                  }`}
                >
                  ATUAL (2026)
                </button>
                <button
                  type="button"
                  onClick={() => setHomepageVersion(true)}
                  disabled={salvandoFlag}
                  className={`px-4 py-2 text-xs tracking-widest font-medium cursor-pointer transition-colors duration-150 ${
                    mostrarSegundaHomepage
                      ? "bg-gold/10 text-primary"
                      : "bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  SEGUNDA (2027)
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
              <div>
                <h2 className="font-display text-xl text-primary">WhatsApp de Suporte Flutuante</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {whatsappSuporteAtivo
                    ? "O botão flutuante do WhatsApp de suporte está ATIVO nas páginas."
                    : "O botão flutuante do WhatsApp de suporte está OCULTO em todo o site."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whatsappSuporteAtivo}
                    onChange={toggleWhatsappSuporte}
                    disabled={salvandoFlag}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold"></div>
                  <span className="ml-2 text-xs font-semibold text-primary tracking-widest uppercase">
                    {whatsappSuporteAtivo ? "Ativo" : "Oculto"}
                  </span>
                </label>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl pt-1">
              <div className="space-y-1">
                <label className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground block text-left">
                  Número do WhatsApp (com código do país - ex: 5562996897483)
                </label>
                <input
                  type="text"
                  required
                  value={whatsappSuporteNumero}
                  onChange={(e) => setWhatsappSuporteNumero(e.target.value)}
                  placeholder="5562996897483"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => salvarWhatsappNumero(whatsappSuporteNumero)}
                  disabled={salvandoFlag || !whatsappSuporteNumero}
                  className="rounded-md border border-gold bg-gold/10 px-4 py-2 text-xs tracking-widest text-primary hover:bg-gold/20 cursor-pointer disabled:opacity-50"
                >
                  {salvandoFlag ? "SALVANDO…" : "SALVAR NÚMERO"}
                </button>
              </div>
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

            </form>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h2 className="font-display text-xl text-primary">Ferramentas de Suporte</h2>
            <p className="text-xs text-muted-foreground">Executar ações de emergência ou correções de banco de dados diretamente.</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCorrigirWest}
                disabled={rodandoFix}
                className="rounded-md border border-gold bg-gold/10 px-4 py-2 text-xs font-semibold tracking-widest text-primary hover:bg-gold/20 disabled:opacity-50 cursor-pointer"
              >
                {rodandoFix ? "EXECUTANDO..." : "BAIXAR INSCRIÇÕES DE WESTSANTOS21@GMAIL.COM"}
              </button>
            </div>
            {resultadoFix && (
              <div className="rounded-md bg-muted p-3 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                {resultadoFix}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

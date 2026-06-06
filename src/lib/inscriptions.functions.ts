import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function containsCPF(csvText: string, searchCPF: string): boolean {
  const cleanSearch = searchCPF.replace(/\D/g, "");
  if (cleanSearch.length !== 11) return false;
  // Split CSV by typical separators
  const cells = csvText.split(/[,;\t\r\n]+/);
  for (const cell of cells) {
    const cleanCell = cell.replace(/\D/g, "");
    if (cleanCell === cleanSearch) {
      return true;
    }
  }
  return false;
}

const regionaisValidas = ["SEDE", ...Array.from({ length: 20 }, (_, i) => String(i + 2))] as [string, ...string[]];

const inputSchema = z.object({
  participantes: z
    .array(
      z.object({
        nome: z.string().min(1).max(120),
        labId: z.string().uuid(),
        cpf: z.string().optional(),
        regional: z.enum(regionaisValidas),
        congregacao: z.string().min(1).max(150),
      })
    )
    .min(1),
});

export const criarInscricoesPainel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ad = admin();

    // 1. Fetch the selected LABs
    const labIds = Array.from(new Set(data.participantes.map((p) => p.labId)));
    const { data: labsData, error: labsErr } = await ad
      .from("labs")
      .select("id, nome, limite_vagas, ativo, requer_cpf, eh_geral")
      .in("id", labIds);
    if (labsErr || !labsData) {
      throw new Error("Erro ao carregar as categorias selecionadas.");
    }

    const labsMap = new Map(labsData.map((l) => [l.id, l]));

    // 2. Validate if all LABs are active
    for (const p of data.participantes) {
      const lab = labsMap.get(p.labId);
      if (!lab) throw new Error("Categoria selecionada inválida.");
      if (!lab.ativo) throw new Error(`A categoria "${lab.nome}" está temporariamente desativada.`);
    }

    // 3. Find the general LAB (eh_geral = true)
    const { data: generalLab, error: genErr } = await ad
      .from("labs")
      .select("id, limite_vagas, nome, ativo")
      .eq("eh_geral", true)
      .maybeSingle();
    if (genErr || !generalLab) {
      throw new Error("Categoria geral (Nenhum) não encontrada no sistema.");
    }
    if (!generalLab.ativo) {
      throw new Error("As inscrições para o evento estão desativadas.");
    }

    // 4. Check general pool limit
    const { count: totalCount, error: countErr } = await ad
      .from("inscricoes")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelado");
    if (countErr) {
      throw new Error("Erro ao validar limite de vagas geral do evento.");
    }

    const newInscCount = data.participantes.length;
    if ((totalCount ?? 0) + newInscCount > generalLab.limite_vagas) {
      throw new Error(
        `Inscrições esgotadas! O limite geral do evento (${generalLab.limite_vagas} vagas) foi atingido.`
      );
    }

    // 5. Check specific LAB limits (only for non-general LABs)
    const nonGeneralParticipants = data.participantes.filter((p) => {
      const lab = labsMap.get(p.labId);
      return lab && !lab.eh_geral;
    });

    const countsByLab = new Map<string, number>();
    for (const p of nonGeneralParticipants) {
      countsByLab.set(p.labId, (countsByLab.get(p.labId) || 0) + 1);
    }

    for (const [labId, countNeeded] of countsByLab.entries()) {
      const lab = labsMap.get(labId)!;
      const { count: labCount, error: labCountErr } = await ad
        .from("inscricoes")
        .select("id", { count: "exact", head: true })
        .eq("lab_id", labId)
        .neq("status", "cancelado");
      if (labCountErr) {
        throw new Error(`Erro ao calcular vagas para a categoria "${lab.nome}".`);
      }
      if ((labCount ?? 0) + countNeeded > lab.limite_vagas) {
        const restantes = Math.max(0, lab.limite_vagas - (labCount ?? 0));
        throw new Error(
          `Vagas esgotadas para a categoria "${lab.nome}". Vagas restantes: ${restantes}.`
        );
      }
    }

    // 6. Check CPF for LABs that require validation
    const { data: settings } = await ad
      .from("app_settings")
      .select("google_sheet_pastores_url, mercado_pago_ativo")
      .eq("id", true)
      .maybeSingle();
    const sheetUrl = settings?.google_sheet_pastores_url;
    const isMpActive = settings?.mercado_pago_ativo ?? false;

    for (const p of data.participantes) {
      const lab = labsMap.get(p.labId)!;
      if (lab.requer_cpf) {
        if (!p.cpf) {
          throw new Error(`O campo CPF é obrigatório para a categoria "${lab.nome}".`);
        }
        const cleanCpf = p.cpf.replace(/\D/g, "");
        if (cleanCpf.length !== 11) {
          throw new Error(`O CPF informado para "${p.nome}" deve conter 11 dígitos.`);
        }

        if (!sheetUrl) {
          throw new Error("Planilha de Pastores não configurada no painel administrativo. Entre em contato com a SECRETÁRIA.");
        }

        try {
          const res = await fetch(sheetUrl);
          if (!res.ok) throw new Error("Erro na requisição para a planilha.");
          const csvText = await res.text();
          if (!containsCPF(csvText, cleanCpf)) {
            throw new Error(
              `Inscrição não autorizada. O CPF "${p.cpf}" de "${p.nome}" não consta na lista de Pastores autorizados. Por favor, sugira outra categoria ou entre em contato com a SECRETÁRIA.`
            );
          }
        } catch (err) {
          console.error("Pastor validation failed:", err);
          throw new Error(
            err instanceof Error && err.message.includes("não autorizada")
              ? err.message
              : "Erro ao consultar a planilha de Pastores autorizados. Entre em contato com a SECRETÁRIA."
          );
        }
      }
    }

    // 7. Get user's email to attach to the registrations
    const { data: profile } = await ad
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const emailToUse = profile?.email || "";

    // 8. Create inscriptions and payments
    const rows = data.participantes.map((p) => {
      const lab = labsMap.get(p.labId);
      const hasSpecificLab = lab && !lab.eh_geral;
      return {
        comprador_user_id: userId,
        nome_participante: p.nome,
        email: emailToUse,
        lab_id: p.labId,
        cpf: p.cpf ? p.cpf.replace(/\D/g, "") : null,
        valor: 50,
        status: (isMpActive ? "pendente" : "pago") as any,
        lab_qr_token: hasSpecificLab ? globalThis.crypto.randomUUID() : null,
        regional: p.regional,
        congregacao: p.congregacao,
      };
    });

    const { data: novas, error: insertErr } = await ad
      .from("inscricoes")
      .insert(rows)
      .select("id, valor");
    if (insertErr || !novas) {
      throw new Error(insertErr?.message || "Erro ao salvar as inscrições.");
    }

    const payments = novas.map((n) => ({
      inscricao_id: n.id,
      status: isMpActive ? "pendente" : "pago",
      metodo: isMpActive ? "mercado_pago" : "mock",
      valor: n.valor,
    }));

    const { data: paymentsData, error: payErr } = await ad
      .from("pagamentos")
      .insert(payments)
      .select("id");

    if (payErr || !paymentsData) {
      throw new Error("Erro ao registrar o pagamento das inscrições.");
    }

    return { 
      ok: true, 
      count: novas.length, 
      mercadoPagoAtivo: isMpActive,
      pendingPaymentIds: paymentsData.map((p) => p.id),
      totalAmount: novas.reduce((s, n) => s + n.valor, 0),
    };
  });

const inputSchemaRecepcao = z.object({
  participantes: z
    .array(
      z.object({
        nome: z.string().min(1).max(120),
        labId: z.string().uuid(),
        cpf: z.string().optional(),
        regional: z.enum(regionaisValidas),
        congregacao: z.string().min(1).max(150),
      })
    )
    .min(1),
  metodoPagamento: z.enum(["dinheiro", "isento"]),
});

export const criarInscricoesRecepcao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchemaRecepcao.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const ad = admin();

    // 1. Validar se o usuário logado tem permissão (super_admin, admin ou recepcao)
    const { data: userRoles, error: rolesErr } = await ad
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr || !userRoles) {
      throw new Error("Erro ao validar permissões do usuário.");
    }
    const userRoleTypes = userRoles.map((r) => r.role);
    const temPermissao =
      userRoleTypes.includes("super_admin") ||
      userRoleTypes.includes("admin") ||
      userRoleTypes.includes("recepcao");
    if (!temPermissao) {
      throw new Error("Acesso negado. Apenas operadores autorizados podem realizar inscrições presenciais.");
    }

    // 2. Buscar LABs selecionados
    const labIds = Array.from(new Set(data.participantes.map((p) => p.labId)));
    const { data: labsData, error: labsErr } = await ad
      .from("labs")
      .select("id, nome, limite_vagas, ativo, requer_cpf, eh_geral, exclusivo_recepcao")
      .in("id", labIds);
    if (labsErr || !labsData) {
      throw new Error("Erro ao carregar categorias de LABs.");
    }
    const labsMap = new Map(labsData.map((l) => [l.id, l]));

    // 3. Validar se os LABs estão ativos
    for (const p of data.participantes) {
      const lab = labsMap.get(p.labId);
      if (!lab) throw new Error("Categoria selecionada inválida.");
      if (!lab.ativo) throw new Error(`A categoria "${lab.nome}" está desativada.`);
    }

    // 4. Buscar LAB geral para limite máximo
    const { data: generalLab, error: genErr } = await ad
      .from("labs")
      .select("id, limite_vagas, nome, ativo")
      .eq("eh_geral", true)
      .maybeSingle();
    if (genErr || !generalLab) {
      throw new Error("Categoria geral não encontrada no sistema.");
    }

    // 5. Validar limite geral do evento
    const { count: totalCount, error: countErr } = await ad
      .from("inscricoes")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelado");
    if (countErr) {
      throw new Error("Erro ao validar vagas do evento.");
    }
    const newInscCount = data.participantes.length;
    if ((totalCount ?? 0) + newInscCount > generalLab.limite_vagas) {
      throw new Error(`Limite do evento esgotado (${generalLab.limite_vagas} vagas).`);
    }

    // 6. Validar limite específico dos LABs (apenas os não-gerais)
    const nonGeneralParticipants = data.participantes.filter((p) => {
      const lab = labsMap.get(p.labId);
      return lab && !lab.eh_geral;
    });
    const countsByLab = new Map<string, number>();
    for (const p of nonGeneralParticipants) {
      countsByLab.set(p.labId, (countsByLab.get(p.labId) || 0) + 1);
    }
    for (const [labId, countNeeded] of countsByLab.entries()) {
      const lab = labsMap.get(labId)!;
      const { count: labCount, error: labCountErr } = await ad
        .from("inscricoes")
        .select("id", { count: "exact", head: true })
        .eq("lab_id", labId)
        .neq("status", "cancelado");
      if (labCountErr) {
        throw new Error(`Erro ao calcular vagas para a categoria "${lab.nome}".`);
      }
      if ((labCount ?? 0) + countNeeded > lab.limite_vagas) {
        const restantes = Math.max(0, lab.limite_vagas - (labCount ?? 0));
        throw new Error(`Vagas esgotadas para "${lab.nome}". Restantes: ${restantes}.`);
      }
    }

    // 7. Salvar inscrições presenciais (status já vai como 'pago')
    const rows = data.participantes.map((p) => {
      const lab = labsMap.get(p.labId);
      const isExclusivoRecepcao = lab?.exclusivo_recepcao ?? false;
      const hasSpecificLab = lab && !lab.eh_geral;
      
      // Se for lab exclusivo de recepção (ex: Dirigentes), o valor é 0. Caso contrário, 50.
      const valorInscricao = isExclusivoRecepcao ? 0 : 50;

      return {
        comprador_user_id: userId, // associado ao operador logado
        nome_participante: p.nome,
        email: null, // opcional na recepção
        lab_id: p.labId,
        cpf: p.cpf ? p.cpf.replace(/\D/g, "") : null,
        valor: valorInscricao,
        status: "pago" as const,
        lab_qr_token: hasSpecificLab ? globalThis.crypto.randomUUID() : null,
        regional: p.regional,
        congregacao: p.congregacao,
      };
    });

    const { data: novas, error: insertErr } = await ad
      .from("inscricoes")
      .insert(rows)
      .select("id, valor");
    if (insertErr || !novas) {
      throw new Error(insertErr?.message || "Erro ao salvar inscrições.");
    }

    // 8. Criar os pagamentos já pagos no banco
    const payments = novas.map((n) => {
      const metodo = n.valor === 0 ? "isento" : "dinheiro";
      return {
        inscricao_id: n.id,
        status: "pago",
        metodo: metodo,
        valor: n.valor,
      };
    });

    const { error: payErr } = await ad.from("pagamentos").insert(payments);
    if (payErr) {
      throw new Error("Erro ao registrar pagamento das inscrições presenciais.");
    }

    return {
      ok: true,
      count: novas.length,
      totalAmount: novas.reduce((s, n) => s + n.valor, 0),
    };
  });

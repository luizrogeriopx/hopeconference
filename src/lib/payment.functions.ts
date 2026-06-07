import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

// 1. Carregar Configuração
export const carregarConfiguracaoMercadoPago = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ad = admin();
    const { userId } = context;

    // Verificar se o usuário é super_admin ou admin
    const { data: roleData } = await ad
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const isStaff = roleData?.role === "super_admin" || roleData?.role === "admin";
    if (!isStaff) {
      throw new Error("Não autorizado.");
    }

    const { data: settings } = await ad
      .from("app_settings")
      .select("mercado_pago_ativo, mercado_pago_public_key")
      .eq("id", true)
      .maybeSingle();

    const { data: secrets } = await ad
      .from("app_secrets")
      .select("mercado_pago_access_token")
      .eq("id", true)
      .maybeSingle();

    return {
      mercadoPagoAtivo: settings?.mercado_pago_ativo ?? false,
      mercadoPagoPublicKey: settings?.mercado_pago_public_key ?? "",
      hasAccessToken: !!secrets?.mercado_pago_access_token && secrets.mercado_pago_access_token.trim().length > 0,
    };
  });

// Schema para Salvar Configuração
const saveSettingsSchema = z.object({
  mercadoPagoAtivo: z.boolean(),
  mercadoPagoPublicKey: z.string().trim(),
  mercadoPagoAccessToken: z.string().trim(),
});

// 2. Salvar Configuração (Somente Super Admin)
export const salvarConfiguracaoMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ad = admin();
    const { userId } = context;

    // Apenas super_admin pode salvar credenciais
    const { data: roleData } = await ad
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role !== "super_admin") {
      throw new Error("Apenas o Super Administrador pode alterar as credenciais de pagamento.");
    }

    // 1. Atualizar app_settings
    const { error: settingsErr } = await ad
      .from("app_settings")
      .update({
        mercado_pago_ativo: data.mercadoPagoAtivo,
        mercado_pago_public_key: data.mercadoPagoPublicKey,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", true);

    if (settingsErr) {
      throw new Error(`Erro ao atualizar configurações públicas: ${settingsErr.message}`);
    }

    // 2. Atualizar app_secrets se um novo token foi fornecido
    if (data.mercadoPagoAccessToken !== "" && data.mercadoPagoAccessToken !== "_KEEP_EXISTING_") {
      const { error: secretsErr } = await ad
        .from("app_secrets")
        .update({
          mercado_pago_access_token: data.mercadoPagoAccessToken,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", true);

      if (secretsErr) {
        throw new Error(`Erro ao atualizar chaves privadas: ${secretsErr.message}`);
      }
    }

    return { ok: true };
  });

// Schema para Processar Pagamento
const processPaymentSchema = z.object({
  formData: z.any(),
  pendingPaymentIds: z.array(z.string().uuid()),
});

// 3. Processar Pagamento Transparente
export const processarPagamentoTransparente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => processPaymentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ad = admin();
    const { userId } = context;

    // Buscar Access Token do Mercado Pago
    const { data: secrets } = await ad
      .from("app_secrets")
      .select("mercado_pago_access_token")
      .eq("id", true)
      .maybeSingle();

    const token = secrets?.mercado_pago_access_token;
    if (!token || token.trim().length === 0) {
      throw new Error("Mercado Pago não está configurado no sistema. Contate o administrador.");
    }

    // Obter origin do webhook
    const request = getRequest();
    const host = request?.headers.get("x-forwarded-host") || request?.headers.get("host") || "";
    const protocol = request?.headers.get("x-forwarded-proto") || "https";
    const webhookUrl = host ? `${protocol}://${host}/api/webhook/mercadopago` : "";

    // Montar requisição de pagamento transparente do Mercado Pago
    const idempotencyKey = globalThis.crypto.randomUUID();
    
    // Configurar o payload
    const payload: any = {
      transaction_amount: Number(data.formData.transaction_amount),
      description: "Inscrições Hope Conference 2026",
      payment_method_id: data.formData.payment_method_id,
      payer: {
        email: data.formData.payer.email,
        identification: data.formData.payer.identification,
      },
      external_reference: data.pendingPaymentIds.join(","),
    };

    if (webhookUrl) {
      payload.notification_url = webhookUrl;
    }

    if (data.formData.token) {
      // É cartão de crédito/débito
      payload.token = data.formData.token;
      payload.installments = Number(data.formData.installments);
      payload.issuer_id = data.formData.issuer_id;
    }

    // Chamar Mercado Pago API
    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const mpData = await mpRes.json() as any;

    if (!mpRes.ok) {
      console.error("Mercado Pago payment error:", mpData);
      throw new Error(mpData.message || "Erro ao processar pagamento com Mercado Pago.");
    }

    const mpPaymentId = String(mpData.id);
    const mpStatus = mpData.status; // approved, pending, in_process, rejected

    // Buscar as inscrições vinculadas aos pagamentos para poder atualizar seus status se aprovado
    const { data: payments } = await ad
      .from("pagamentos")
      .select("id, inscricao_id")
      .in("id", data.pendingPaymentIds);
    const inscIds = payments?.map((p) => p.inscricao_id) || [];

    if (mpStatus === "approved") {
      // 1. Atualizar inscrições
      const { error: insErr } = await ad
        .from("inscricoes")
        .update({ status: "pago" })
        .in("id", inscIds);
      if (insErr) console.error("Error updating inscriptions status:", insErr);

      // 2. Atualizar pagamentos
      const { error: payErr } = await ad
        .from("pagamentos")
        .update({
          status: "pago",
          metodo: data.formData.payment_method_id,
          payment_id: mpPaymentId,
        })
        .in("id", data.pendingPaymentIds);
      if (payErr) console.error("Error updating payments status:", payErr);

    } else if (mpStatus === "pending" || mpStatus === "in_process") {
      // Pegar dados do Pix (se for Pix)
      const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || null;
      const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || null;

      // Atualizar pagamentos com informações da transação pendente
      const { error: payErr } = await ad
        .from("pagamentos")
        .update({
          status: "pendente",
          metodo: data.formData.payment_method_id,
          payment_id: mpPaymentId,
          payment_url: qrCode,
          pix_qr_base64: qrCodeBase64,
        })
        .in("id", data.pendingPaymentIds);
      if (payErr) console.error("Error updating payments status:", payErr);
    }

    return {
      success: mpStatus === "approved" || mpStatus === "pending" || mpStatus === "in_process",
      status: mpStatus,
      statusDetail: mpData.status_detail,
      paymentId: mpPaymentId,
      qrCode: mpData.point_of_interaction?.transaction_data?.qr_code || null,
      qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64 || null,
    };
  });

// Schema para Verificar Pagamento
const checkPaymentSchema = z.object({
  paymentId: z.string(),
});

// 4. Verificar Status do Pagamento (Manual ou Callback)
export const verificarStatusPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => checkPaymentSchema.parse(input))
  .handler(async ({ data }) => {
    const ad = admin();

    // Buscar Access Token
    const { data: secrets } = await ad
      .from("app_secrets")
      .select("mercado_pago_access_token")
      .eq("id", true)
      .maybeSingle();

    const token = secrets?.mercado_pago_access_token;
    if (!token) {
      throw new Error("Chave de API do Mercado Pago não configurada.");
    }

    // Consultar Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!mpRes.ok) {
      throw new Error("Não foi possível consultar o status do pagamento no Mercado Pago.");
    }

    const mpData = await mpRes.json() as any;
    const mpStatus = mpData.status;

    if (mpStatus === "approved") {
      // Encontrar pagamentos correspondentes no banco pelo payment_id
      const { data: dbPayments } = await ad
        .from("pagamentos")
        .select("id, inscricao_id, status")
        .eq("payment_id", data.paymentId);

      if (dbPayments && dbPayments.length > 0) {
        const payIds = dbPayments.map((p) => p.id);
        const inscIds = dbPayments.map((p) => p.inscricao_id);

        // Atualizar inscrições para pago
        await ad
          .from("inscricoes")
          .update({ status: "pago" })
          .in("id", inscIds);

        // Atualizar pagamentos para pago
        await ad
          .from("pagamentos")
          .update({ status: "pago" })
          .in("id", payIds);
      }
    }

    return {
      status: mpStatus,
      statusDetail: mpData.status_detail,
      approved: mpStatus === "approved",
    };
  });

// Schema para Cancelar Pagamento Pendente
const cancelPaymentSchema = z.object({
  paymentIds: z.array(z.string().uuid()),
});

// 5. Cancelar Pagamento Pendente (Limpar dados de Pix para refazer checkout)
export const cancelarPagamentoPendente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cancelPaymentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ad = admin();
    const { userId } = context;

    // Buscar pagamentos para verificar propriedade das inscrições
    const { data: dbPayments, error: fetchErr } = await ad
      .from("pagamentos")
      .select("id, inscricao_id, inscricoes(comprador_user_id)")
      .in("id", data.paymentIds);

    if (fetchErr || !dbPayments) {
      throw new Error("Erro ao carregar dados de pagamento.");
    }

    // Verificar se todos pertencem ao comprador autenticado
    for (const p of dbPayments) {
      const compradorId = (p.inscricoes as any)?.comprador_user_id;
      if (compradorId !== userId) {
        throw new Error("Operação não autorizada. Um ou mais pagamentos não pertencem a você.");
      }
    }

    // Limpar informações de pagamento do Mercado Pago
    const { error: updateErr } = await ad
      .from("pagamentos")
      .update({
        payment_id: null,
        payment_url: null,
        pix_qr_base64: null,
      })
      .in("id", data.paymentIds);

    if (updateErr) {
      throw new Error(`Erro ao redefinir transações: ${updateErr.message}`);
    }

    return { ok: true };
  });


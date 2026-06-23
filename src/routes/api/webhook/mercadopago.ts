import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export const Route = createFileRoute("/api/webhook/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let paymentId: string | null = null;
        let topic: string | null = null;

        try {
          // 1. Tentar ler do query params (formato IPN)
          const url = new URL(request.url);
          paymentId = url.searchParams.get("id") || url.searchParams.get("data.id");
          topic = url.searchParams.get("topic") || url.searchParams.get("type");

          // 2. Tentar ler do body (formato Webhooks)
          const bodyText = await request.clone().text();
          if (bodyText) {
            const body = JSON.parse(bodyText);
            if (body.data && body.data.id) {
              paymentId = String(body.data.id);
            }
            if (body.type) {
              topic = body.type;
            }
          }
        } catch (err) {
          console.error("Erro ao fazer parse do webhook do Mercado Pago:", err);
        }

        // Se for uma notificação de teste ou sem dados válidos, apenas retornar OK
        if (!paymentId || (topic && topic !== "payment")) {
          return new Response(JSON.stringify({ ok: true, message: "Ignored topic or missing payment id" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const ad = admin();

        try {
          // Buscar Access Token
          const { data: secrets } = await ad
            .from("app_secrets")
            .select("mercado_pago_access_token")
            .eq("id", true)
            .maybeSingle();

          const token = secrets?.mercado_pago_access_token;
          if (!token || token.trim().length === 0) {
            console.error("Aviso Webhook: Chave do Mercado Pago não configurada.");
            return new Response(JSON.stringify({ error: "Access token not configured" }), { status: 500 });
          }

          // Consultar Mercado Pago para verificar a transação
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!mpRes.ok) {
            console.error(`Erro ao consultar pagamento ${paymentId} no Mercado Pago: ${mpRes.statusText}`);
            return new Response(JSON.stringify({ error: "Failed to fetch payment details from Mercado Pago" }), { status: 500 });
          }

          const mpData = await mpRes.json() as any;
          const status = mpData.status; // approved, pending, etc.
          const externalReference = mpData.external_reference ? String(mpData.external_reference).trim() : "";

          if (status === "approved") {
            // Se possuir referência externa (lote curto ou IDs antigos separados por vírgula)
            if (externalReference) {
              const paymentIds = externalReference.includes(",")
                ? externalReference.split(",").map((id) => id.trim()).filter(Boolean)
                : [];
              
              // 1. Buscar correspondentes no banco
              let { data: dbPayments } = paymentIds.length > 0
                ? await ad
                    .from("pagamentos")
                    .select("id, inscricao_id")
                    .in("id", paymentIds)
                : await ad
                    .from("pagamentos")
                    .select("id, inscricao_id")
                    .eq("preference_id", externalReference);

              if ((!dbPayments || dbPayments.length === 0) && paymentIds.length === 0) {
                const fallback = await ad
                  .from("pagamentos")
                  .select("id, inscricao_id")
                  .eq("id", externalReference);
                dbPayments = fallback.data;
              }

              if (dbPayments && dbPayments.length > 0) {
                const payIds = dbPayments.map((p) => p.id);
                const inscIds = dbPayments.map((p) => p.inscricao_id);

                // 2. Atualizar inscrições para pago
                await ad
                  .from("inscricoes")
                  .update({ status: "pago" })
                  .in("id", inscIds);

                // 3. Atualizar pagamentos para pago
                await ad
                  .from("pagamentos")
                  .update({
                    status: "pago",
                    payment_id: paymentId,
                  })
                  .in("id", payIds);
                
                console.log(`Webhook MP: Pagamentos aprovados com sucesso para referência: ${externalReference}`);
              }
            } else {
              // Fallback: Atualizar buscando pelo payment_id no banco
              const { data: dbPayments } = await ad
                .from("pagamentos")
                .select("id, inscricao_id")
                .eq("payment_id", paymentId);

              if (dbPayments && dbPayments.length > 0) {
                const inscIds = dbPayments.map((p) => p.inscricao_id);
                
                await ad
                  .from("inscricoes")
                  .update({ status: "pago" })
                  .in("id", inscIds);

                await ad
                  .from("pagamentos")
                  .update({ status: "pago" })
                  .eq("payment_id", paymentId);
                
                console.log(`Webhook MP: Pagamento aprovado com sucesso via payment_id: ${paymentId}`);
              }
            }
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("Erro interno no processamento do webhook:", err);
          return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
      },
    },
  },
});

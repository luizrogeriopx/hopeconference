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

export const Route = createFileRoute("/api/temp-fix")({
  server: {
    handlers: {
      GET: async () => {
        const ad = admin();
        const results: any[] = [];

        try {
          // 1. Buscar inscrições do e-mail westsantos21@gmail.com
          const { data: inscs, error: inscErr } = await ad
            .from("inscricoes")
            .select("*")
            .eq("email", "westsantos21@gmail.com");

          if (inscErr) {
            return new Response(JSON.stringify({ error: inscErr.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (!inscs || inscs.length === 0) {
            // Tentar buscar por profiles caso as inscrições tenham sido registradas sob outro e-mail comprador
            const { data: profs } = await ad
              .from("profiles")
              .select("id, email, nome")
              .eq("email", "westsantos21@gmail.com");

            const buyerIds = profs?.map((p) => p.id) || [];
            if (buyerIds.length > 0) {
              const { data: fallbackInscs } = await ad
                .from("inscricoes")
                .select("*")
                .in("comprador_user_id", buyerIds);
              
              if (fallbackInscs && fallbackInscs.length > 0) {
                inscs.push(...fallbackInscs);
              }
            }
          }

          results.push({ message: `Encontradas ${inscs?.length || 0} inscrições.` });

          if (inscs && inscs.length > 0) {
            for (const insc of inscs) {
              const prevStatus = insc.status;
              
              // Apenas atualizar se estiver pendente
              if (insc.status === "pendente") {
                // 2. Atualizar status da inscrição para 'pago'
                const { error: updateErr } = await ad
                  .from("inscricoes")
                  .update({ status: "pago" })
                  .eq("id", insc.id);

                if (updateErr) {
                  results.push({ id: insc.id, name: insc.nome_participante, error: `Erro ao atualizar inscrição: ${updateErr.message}` });
                  continue;
                }

                // 3. Verificar se já existe pagamento para esta inscrição
                const { data: existingPayments } = await ad
                  .from("pagamentos")
                  .select("id, status")
                  .eq("inscricao_id", insc.id);

                if (existingPayments && existingPayments.length > 0) {
                  // Atualizar pagamentos existentes para 'pago'
                  const { error: payUpdateErr } = await ad
                    .from("pagamentos")
                    .update({ status: "pago", metodo: "pix" })
                    .eq("inscricao_id", insc.id);

                  results.push({
                    id: insc.id,
                    name: insc.nome_participante,
                    prevStatus,
                    newStatus: "pago",
                    paymentAction: payUpdateErr ? `Erro ao atualizar pagamento: ${payUpdateErr.message}` : "Pagamento atualizado para pago (pix)",
                  });
                } else {
                  // Criar novo registro de pagamento
                  const { error: payInsertErr } = await ad
                    .from("pagamentos")
                    .insert({
                      inscricao_id: insc.id,
                      status: "pago",
                      metodo: "pix",
                      valor: insc.valor || 50.00,
                    });

                  results.push({
                    id: insc.id,
                    name: insc.nome_participante,
                    prevStatus,
                    newStatus: "pago",
                    paymentAction: payInsertErr ? `Erro ao criar pagamento: ${payInsertErr.message}` : "Novo registro de pagamento criado (pix)",
                  });
                }
              } else {
                results.push({
                  id: insc.id,
                  name: insc.nome_participante,
                  status: insc.status,
                  message: "Inscrição já não estava pendente.",
                });
              }
            }
          }

          return new Response(JSON.stringify({ ok: true, results }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });

        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

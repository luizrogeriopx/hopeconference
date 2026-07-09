import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { fetchAllPages } from "@/lib/fetch-all-pages";

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function assertSuper(ad: ReturnType<typeof admin>, userId: string) {
  const { data } = await ad.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("super_admin")) throw new Error("Apenas super admin.");
}

const schema = z.object({
  titulo: z.string().trim().min(1).max(120),
  mensagem: z.string().trim().min(1).max(2000),
  link: z.string().trim().max(500).optional().nullable(),
  alvo: z.enum(["todos", "inscritos", "regional", "lab", "ministerio", "status"]),
  regional: z.string().optional().nullable(),
  labId: z.string().uuid().optional().nullable(),
  ministerioId: z.string().uuid().optional().nullable(),
  status: z.enum(["pendente", "pago", "validado", "cancelado"]).optional().nullable(),
});

export const enviarNotificacaoMassa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);

    let userIds: string[] = [];

    if (data.alvo === "todos") {
      const profs = await fetchAllPages<any>(() => ad.from("profiles").select("id"));
      userIds = (profs ?? []).map((p) => p.id);
    } else {
      // Filtrar via inscrições
      const inscs = await fetchAllPages<any>(() => {
        let q = ad.from("inscricoes").select("comprador_user_id");
        if (data.alvo === "regional" && data.regional) q = q.eq("regional", data.regional);
        if (data.alvo === "lab" && data.labId) q = q.eq("lab_id", data.labId);
        if (data.alvo === "ministerio" && data.ministerioId) q = q.eq("ministerio_id", data.ministerioId);
        if (data.alvo === "status" && data.status) q = q.eq("status", data.status);
        return q;
      });
      userIds = Array.from(new Set((inscs ?? []).map((i) => i.comprador_user_id).filter(Boolean)));
    }

    if (userIds.length === 0) return { ok: true, total: 0 };

    // Insere em lotes de 500
    const link = data.link?.trim() || null;
    const rows = userIds.map((uid) => ({
      user_id: uid,
      titulo: data.titulo,
      mensagem: data.mensagem,
      link,
      criado_por: context.userId,
    }));

    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await ad.from("notificacoes").insert(chunk);
      if (error) throw new Error(error.message);
    }

    return { ok: true, total: userIds.length };
  });

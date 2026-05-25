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

const createSchema = z.object({
  email: z.string().email().max(255),
  senha: z.string().min(6).max(72),
  nome: z.string().min(1).max(120),
  role: z.enum(["admin", "gate"]),
});

export const criarUsuarioPainel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verifica permissão: super pode criar admin/gate; admin só pode criar gate
    const { data: meusRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (meusRoles ?? []).map((r) => r.role);
    const isSuper = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");
    if (data.role === "admin" && !isSuper) throw new Error("Apenas super admin pode criar admin.");
    if (data.role === "gate" && !(isSuper || isAdmin)) throw new Error("Sem permissão.");

    const ad = admin();
    const { data: created, error } = await ad.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário.");

    // Remove role inscrito (criada por trigger) e atribui a role solicitada
    await ad.from("user_roles").delete().eq("user_id", created.user.id);
    const { error: roleErr } = await ad
      .from("user_roles")
      .insert({ user_id: created.user.id, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, id: created.user.id };
  });

export const listarUsuariosPainel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: meusRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (meusRoles ?? []).map((r) => r.role);
    if (!roles.includes("super_admin") && !roles.includes("admin")) {
      throw new Error("Sem permissão.");
    }

    const ad = admin();
    const { data: rolesData } = await ad
      .from("user_roles")
      .select("user_id, role, criado_em")
      .in("role", ["admin", "gate"]);
    const ids = Array.from(new Set((rolesData ?? []).map((r) => r.user_id)));
    const { data: profs } = await ad
      .from("profiles")
      .select("id, email, nome")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return (rolesData ?? []).map((r) => ({
      user_id: r.user_id,
      role: r.role,
      criado_em: r.criado_em,
      email: byId.get(r.user_id)?.email ?? "",
      nome: byId.get(r.user_id)?.nome ?? "",
    }));
  });

export const removerUsuarioPainel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), role: z.enum(["admin", "gate"]) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: meusRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (meusRoles ?? []).map((r) => r.role);
    const isSuper = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");
    if (data.role === "admin" && !isSuper) throw new Error("Apenas super admin.");
    if (data.role === "gate" && !(isSuper || isAdmin)) throw new Error("Sem permissão.");

    const ad = admin();
    await ad.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
    // Remove o usuário do auth se não tiver mais nenhuma role de painel
    const { data: restantes } = await ad
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    if (!restantes || restantes.length === 0) {
      await ad.auth.admin.deleteUser(data.user_id);
    }
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function assertSuper(supabase: ReturnType<typeof admin>, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("super_admin")) throw new Error("Apenas super admin.");
}

export const listarTodasContas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);

    const { data: profiles, error: pErr } = await ad
      .from("profiles")
      .select("id, email, nome, criado_em")
      .order("criado_em", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const { data: rolesData } = await ad.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, string[]>();
    (rolesData ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    const { data: inscData } = await ad
      .from("inscricoes")
      .select("comprador_user_id, status");
    const countsByUser = new Map<string, number>();
    (inscData ?? []).forEach((i) => {
      countsByUser.set(i.comprador_user_id, (countsByUser.get(i.comprador_user_id) ?? 0) + 1);
    });

    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      nome: p.nome ?? "",
      criado_em: p.criado_em,
      roles: rolesByUser.get(p.id) ?? [],
      total_inscricoes: countsByUser.get(p.id) ?? 0,
    }));
  });

export const atualizarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        nome: z.string().min(1).max(120).optional(),
        email: z.string().email().max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);

    if (data.email) {
      const { error } = await ad.auth.admin.updateUserById(data.user_id, {
        email: data.email.trim().toLowerCase(),
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
    }

    const patch: { nome?: string; email?: string } = {};
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.email !== undefined) patch.email = data.email.trim().toLowerCase();
    if (Object.keys(patch).length > 0) {
      const { error } = await ad.from("profiles").update(patch).eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const resetarSenhaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), nova_senha: z.string().min(6).max(72).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);
    const senha = data.nova_senha ?? "123456";
    const { error } = await ad.auth.admin.updateUserById(data.user_id, {
      password: senha,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true, senha };
  });

export const gerarLinkAcessoConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);

    const { data: prof } = await ad.from("profiles").select("email").eq("id", data.user_id).maybeSingle();
    if (!prof?.email) throw new Error("Usuário sem e-mail.");

    const { data: link, error } = await ad.auth.admin.generateLink({
      type: "magiclink",
      email: prof.email,
    });
    if (error || !link?.properties?.action_link) {
      throw new Error(error?.message ?? "Falha ao gerar link.");
    }
    return { ok: true, url: link.properties.action_link, email: prof.email };
  });

export const listarInscricoesDaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);

    const { data: inscs, error } = await ad
      .from("inscricoes")
      .select(
        "id, nome_participante, email, status, valor, criado_em, qr_token, lab_qr_token, lab_id, regional, congregacao, cpf, validado_em, lab_validado_em, labs(nome, local, eh_geral)",
      )
      .eq("comprador_user_id", data.user_id)
      .order("criado_em", { ascending: false });
    if (error) throw new Error(error.message);
    return inscs ?? [];
  });

export const excluirConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);

    if (data.user_id === context.userId) {
      throw new Error("Você não pode excluir sua própria conta.");
    }

    const { data: alvoRoles } = await ad
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    if ((alvoRoles ?? []).some((r) => r.role === "super_admin")) {
      throw new Error("Não é possível excluir outro super admin.");
    }

    // Remove dependências antes (caso FKs não tenham cascade)
    await ad.from("inscricoes").delete().eq("comprador_user_id", data.user_id);
    await ad.from("user_roles").delete().eq("user_id", data.user_id);
    await ad.from("profiles").delete().eq("id", data.user_id);

    const { error } = await ad.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

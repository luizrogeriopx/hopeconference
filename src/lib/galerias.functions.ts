import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const BUCKET = "galerias";
const SIGN_EXPIRY = 60 * 60 * 24 * 365; // 1 ano

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

async function signUrl(ad: ReturnType<typeof admin>, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await ad.storage.from(BUCKET).createSignedUrl(path, SIGN_EXPIRY);
  return data?.signedUrl ?? null;
}

export type GaleriaPublica = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_evento: string | null;
  capa_url: string | null;
  total_fotos: number;
  criado_em: string;
};

export type FotoPublica = {
  id: string;
  url: string;
  face_embeddings: number[][] | null;
  largura: number | null;
  altura: number | null;
};

// LEITURA PÚBLICA (sem middleware)
export const listarGalerias = createServerFn({ method: "GET" }).handler(async () => {
  const ad = admin();
  const { data: galerias, error } = await ad
    .from("galerias")
    .select("id, titulo, descricao, data_evento, capa_url, criado_em")
    .order("data_evento", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);

  // conta fotos
  const ids = (galerias ?? []).map((g) => g.id);
  const contagem: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: fotos } = await ad
      .from("galeria_fotos")
      .select("galeria_id")
      .in("galeria_id", ids);
    for (const f of fotos ?? []) contagem[f.galeria_id] = (contagem[f.galeria_id] ?? 0) + 1;
  }

  const result: GaleriaPublica[] = [];
  for (const g of galerias ?? []) {
    result.push({
      id: g.id,
      titulo: g.titulo,
      descricao: g.descricao,
      data_evento: g.data_evento,
      capa_url: g.capa_url ? await signUrl(ad, g.capa_url) : null,
      total_fotos: contagem[g.id] ?? 0,
      criado_em: g.criado_em,
    });
  }
  return result;
});

export const obterGaleria = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const ad = admin();
    const { data: g, error } = await ad
      .from("galerias")
      .select("id, titulo, descricao, data_evento, capa_url, criado_em")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!g) throw new Error("Galeria não encontrada.");

    const { data: fotos, error: fe } = await ad
      .from("galeria_fotos")
      .select("id, storage_path, face_embeddings, largura, altura")
      .eq("galeria_id", data.id)
      .order("criado_em", { ascending: true });
    if (fe) throw new Error(fe.message);

    const fotosOut: FotoPublica[] = [];
    for (const f of fotos ?? []) {
      const url = await signUrl(ad, f.storage_path);
      if (!url) continue;
      fotosOut.push({
        id: f.id,
        url,
        face_embeddings: (f.face_embeddings as number[][] | null) ?? null,
        largura: f.largura,
        altura: f.altura,
      });
    }

    return {
      galeria: {
        id: g.id,
        titulo: g.titulo,
        descricao: g.descricao,
        data_evento: g.data_evento,
        capa_url: g.capa_url ? await signUrl(ad, g.capa_url) : null,
        criado_em: g.criado_em,
      },
      fotos: fotosOut,
    };
  });

// MUTAÇÕES (super)
export const criarGaleria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        titulo: z.string().trim().min(1).max(200),
        descricao: z.string().trim().max(2000).optional().nullable(),
        data_evento: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);
    const { data: g, error } = await ad
      .from("galerias")
      .insert({
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        data_evento: data.data_evento || null,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: g.id };
  });

export const atualizarGaleria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        titulo: z.string().trim().min(1).max(200),
        descricao: z.string().trim().max(2000).optional().nullable(),
        data_evento: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);
    const { error } = await ad
      .from("galerias")
      .update({
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        data_evento: data.data_evento || null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletarGaleria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);

    // apaga arquivos do storage
    const { data: fotos } = await ad
      .from("galeria_fotos")
      .select("storage_path")
      .eq("galeria_id", data.id);
    const paths = (fotos ?? []).map((f) => f.storage_path).filter(Boolean);
    if (paths.length) await ad.storage.from(BUCKET).remove(paths);

    const { error } = await ad.from("galerias").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registrarFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        galeria_id: z.string().uuid(),
        storage_path: z.string().min(1),
        face_embeddings: z.array(z.array(z.number())).nullable().optional(),
        largura: z.number().int().positive().nullable().optional(),
        altura: z.number().int().positive().nullable().optional(),
        set_como_capa: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);
    const { data: f, error } = await ad
      .from("galeria_fotos")
      .insert({
        galeria_id: data.galeria_id,
        storage_path: data.storage_path,
        url: data.storage_path, // legacy - guardamos path; url pública é gerada sob demanda
        face_embeddings: data.face_embeddings ?? null,
        largura: data.largura ?? null,
        altura: data.altura ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.set_como_capa) {
      await ad.from("galerias").update({ capa_url: data.storage_path }).eq("id", data.galeria_id);
    }
    return { id: f.id };
  });

export const deletarFoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);
    const { data: f } = await ad
      .from("galeria_fotos")
      .select("storage_path, galeria_id")
      .eq("id", data.id)
      .maybeSingle();
    if (f?.storage_path) await ad.storage.from(BUCKET).remove([f.storage_path]);
    const { error } = await ad.from("galeria_fotos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Assina URL para upload direto do super (client → storage) usando service role
export const criarUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        galeria_id: z.string().uuid(),
        filename: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ad = admin();
    await assertSuper(ad, context.userId);
    const ext = data.filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
    const path = `${data.galeria_id}/${crypto.randomUUID()}.${safeExt}`;
    const { data: up, error } = await ad.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: up.token, signedUrl: up.signedUrl };
  });

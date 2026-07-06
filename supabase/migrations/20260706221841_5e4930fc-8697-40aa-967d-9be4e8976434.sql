
-- Galerias
create table public.galerias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  data_evento date,
  capa_url text,
  criado_em timestamptz not null default now(),
  criado_por uuid
);

grant select on public.galerias to anon, authenticated;
grant all on public.galerias to service_role;

alter table public.galerias enable row level security;

create policy "galerias_public_read" on public.galerias
  for select to anon, authenticated using (true);

create policy "galerias_super_all" on public.galerias
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- Fotos
create table public.galeria_fotos (
  id uuid primary key default gen_random_uuid(),
  galeria_id uuid not null references public.galerias(id) on delete cascade,
  storage_path text not null,
  url text not null,
  face_embeddings jsonb, -- array de descritores (128 floats por rosto detectado)
  largura int,
  altura int,
  criado_em timestamptz not null default now()
);

grant select on public.galeria_fotos to anon, authenticated;
grant all on public.galeria_fotos to service_role;

alter table public.galeria_fotos enable row level security;

create policy "galeria_fotos_public_read" on public.galeria_fotos
  for select to anon, authenticated using (true);

create policy "galeria_fotos_super_all" on public.galeria_fotos
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create index galeria_fotos_galeria_idx on public.galeria_fotos(galeria_id);

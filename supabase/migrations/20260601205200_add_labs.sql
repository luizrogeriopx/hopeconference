-- =========== Criar tabela public.labs ===========
create table public.labs (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  limite_vagas integer not null,
  local text not null,
  ativo boolean not null default true,
  requer_cpf boolean not null default false,
  eh_geral boolean not null default false,
  criado_em timestamptz not null default now()
);

-- RLS: labs
alter table public.labs enable row level security;

-- Qualquer usuário autenticado ou anônimo pode listar os labs ativos
create policy "labs_select_all" on public.labs
  for select using (true);

-- Apenas super_admin pode gerenciar labs
create policy "labs_super_all" on public.labs
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- =========== Inserir LABs iniciais ===========
-- 2. HopeKids - 80 vagas (Auditório 4)
insert into public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral)
values ('HopeKids', 80, 'Auditório 4', true, false, false);

-- 3. Juventude Hope - 120 vagas (Anexo 3)
insert into public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral)
values ('Juventude Hope', 120, 'Anexo 3', true, false, false);

-- 4. Diaconia e Recepção - 40 vagas (Sala Reuniões)
insert into public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral)
values ('Diaconia e Recepção', 40, 'Sala Reuniões', true, false, false);

-- 5. Louvor - 70 vagas (Auditório 2)
insert into public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral)
values ('Louvor', 70, 'Auditório 2', true, false, false);

-- 6. Liderança Ministerial e Obreiros - 700 vagas (Auditório 1)
insert into public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral)
values ('Liderança Ministerial e Obreiros', 700, 'Auditório 1', true, false, false);

-- 7. Ativação Profética e Libertação - 70 vagas (Auditório 5 - teen)
insert into public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral)
values ('Ativação Profética e Libertação', 70, 'Auditório 5 - teen', true, false, false);

-- 8. Célula - 150 vagas (Anexo 1 - estacionamento)
insert into public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral)
values ('Célula', 150, 'Anexo 1 - estacionamento', true, false, false);

-- 9. Nenhum - 1.480 vagas (Templo) - Geral
insert into public.labs (nome, limite_vagas, local, ativo, requer_cpf, eh_geral)
values ('Nenhum', 1480, 'Templo', true, false, true);

-- =========== Alterar public.inscricoes ===========
alter table public.inscricoes add column lab_id uuid references public.labs(id) on delete set null;
alter table public.inscricoes add column cpf text;

-- =========== Alterar public.app_settings ===========
alter table public.app_settings add column google_sheet_pastores_url text not null default '';

-- Adicionar labs à publicação de realtime
alter publication supabase_realtime add table public.labs;

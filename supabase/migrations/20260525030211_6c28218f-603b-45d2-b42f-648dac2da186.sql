
-- =========== ENUM de papéis ===========
create type public.app_role as enum ('super_admin','admin','gate','inscrito');
create type public.inscricao_status as enum ('pendente','pago','cancelado','validado');

-- =========== profiles ===========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  criado_em timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- =========== user_roles ===========
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  criado_em timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

-- =========== função has_role (security definer, evita recursão em RLS) ===========
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('super_admin','admin')
  )
$$;

-- =========== inscricoes ===========
create table public.inscricoes (
  id uuid primary key default gen_random_uuid(),
  comprador_user_id uuid not null references auth.users(id) on delete cascade,
  nome_participante text not null,
  email text,
  telefone text,
  valor numeric(10,2) not null default 50.00,
  status inscricao_status not null default 'pago',
  qr_token uuid not null default gen_random_uuid() unique,
  validado_em timestamptz,
  validado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);
alter table public.inscricoes enable row level security;
create index inscricoes_comprador_idx on public.inscricoes(comprador_user_id);
create index inscricoes_status_idx on public.inscricoes(status);

-- =========== pagamentos ===========
create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references public.inscricoes(id) on delete cascade,
  status text not null default 'pago',
  metodo text not null default 'mock',
  valor numeric(10,2) not null,
  criado_em timestamptz not null default now()
);
alter table public.pagamentos enable row level security;

-- =========== RLS: profiles ===========
create policy "profiles_self_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (id = auth.uid());
create policy "profiles_self_insert" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- =========== RLS: user_roles ===========
-- Cada um lê o próprio papel; staff lê todos
create policy "user_roles_select_self_or_staff" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
-- Apenas super_admin pode escrever em qualquer papel
create policy "user_roles_super_all" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));
-- Admin pode criar/remover apenas 'gate'
create policy "user_roles_admin_manage_gate" on public.user_roles
  for insert to authenticated
  with check (public.has_role(auth.uid(),'admin') and role = 'gate');
create policy "user_roles_admin_delete_gate" on public.user_roles
  for delete to authenticated
  using (public.has_role(auth.uid(),'admin') and role = 'gate');

-- =========== RLS: inscricoes ===========
-- Inscrito vê as próprias; staff e gate veem tudo
create policy "inscricoes_select_owner_or_staff_or_gate" on public.inscricoes
  for select to authenticated
  using (
    comprador_user_id = auth.uid()
    or public.is_staff(auth.uid())
    or public.has_role(auth.uid(),'gate')
  );
-- Inscrito cria as próprias
create policy "inscricoes_insert_self" on public.inscricoes
  for insert to authenticated
  with check (comprador_user_id = auth.uid());
-- Inscrito pode atualizar (cancelar) as próprias enquanto não validadas
create policy "inscricoes_update_owner" on public.inscricoes
  for update to authenticated
  using (comprador_user_id = auth.uid() and status <> 'validado')
  with check (comprador_user_id = auth.uid());
-- Staff/gate podem atualizar (validar). Reverter validação só super_admin (controlado por trigger)
create policy "inscricoes_update_staff_gate" on public.inscricoes
  for update to authenticated
  using (public.is_staff(auth.uid()) or public.has_role(auth.uid(),'gate'))
  with check (public.is_staff(auth.uid()) or public.has_role(auth.uid(),'gate'));

-- Trigger: apenas super_admin pode reverter de 'validado' para outro status
create or replace function public.guard_revert_validacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'validado' and new.status <> 'validado' then
    if not public.has_role(auth.uid(),'super_admin') then
      raise exception 'Apenas super admin pode reverter uma validação';
    end if;
    -- limpa metadados ao reverter
    new.validado_em := null;
    new.validado_por := null;
  end if;
  return new;
end;
$$;
create trigger trg_guard_revert_validacao
  before update on public.inscricoes
  for each row execute function public.guard_revert_validacao();

-- =========== RLS: pagamentos ===========
create policy "pagamentos_select_owner_or_staff" on public.pagamentos
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.inscricoes i
      where i.id = pagamentos.inscricao_id and i.comprador_user_id = auth.uid()
    )
  );
create policy "pagamentos_insert_owner" on public.pagamentos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.inscricoes i
      where i.id = pagamentos.inscricao_id and i.comprador_user_id = auth.uid()
    )
  );

-- =========== Trigger: criar profile + papel inicial no signup ===========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_super boolean;
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', new.email));

  select exists(select 1 from public.user_roles where role = 'super_admin') into has_super;
  if not has_super then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'inscrito');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========== Alterar public.user_roles ===========
alter table public.user_roles add column lab_id uuid references public.labs(id) on delete set null;

-- =========== Alterar public.inscricoes ===========
alter table public.inscricoes add column lab_qr_token uuid unique default null;
alter table public.inscricoes add column lab_validado_em timestamptz default null;
alter table public.inscricoes add column lab_validado_por uuid references auth.users(id) on delete set null;

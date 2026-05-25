
-- Revoga execução pública (anon) das funções com SECURITY DEFINER
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_staff(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_revert_validacao() from public, anon, authenticated;

-- Garante execução para authenticated nas funções usadas em RLS
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_staff(uuid) to authenticated;

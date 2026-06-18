ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  has_super boolean;
begin
  insert into public.profiles (id, email, nome, whatsapp)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    nullif(new.raw_user_meta_data->>'whatsapp', '')
  );

  select exists(select 1 from public.user_roles where role = 'super_admin') into has_super;
  if not has_super then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'inscrito');
  end if;
  return new;
end;
$function$;

GRANT UPDATE (whatsapp, nome) ON public.profiles TO authenticated;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
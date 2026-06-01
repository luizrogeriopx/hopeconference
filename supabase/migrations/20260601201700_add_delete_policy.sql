-- Policy to allow super_admin to delete inscriptions
create policy "inscricoes_delete_super" on public.inscricoes
  for delete to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

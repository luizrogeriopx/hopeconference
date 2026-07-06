
create policy "galerias_storage_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'galerias');

create policy "galerias_storage_super_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'galerias' and public.has_role(auth.uid(), 'super_admin'));

create policy "galerias_storage_super_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'galerias' and public.has_role(auth.uid(), 'super_admin'));

create policy "galerias_storage_super_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'galerias' and public.has_role(auth.uid(), 'super_admin'));

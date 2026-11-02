-- =====================================================================
-- FIRMA · Portal · Logo de cada cliente
-- El logo se muestra en el portal de la empresa (header, CRM, casos).
-- Los archivos van a un bucket público de solo lectura. Solo los admin
-- de FIRMA suben, reemplazan o borran logos.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.organizaciones add column if not exists logo_url text;

-- ---------------------------------------------------------------------
-- Archivos. Bucket público, hasta 2 MB, solo imágenes.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists logos_subida on storage.objects;
create policy logos_subida on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.es_admin());

drop policy if exists logos_reemplazo on storage.objects;
create policy logos_reemplazo on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.es_admin())
  with check (bucket_id = 'logos' and public.es_admin());

drop policy if exists logos_borrado on storage.objects;
create policy logos_borrado on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.es_admin());

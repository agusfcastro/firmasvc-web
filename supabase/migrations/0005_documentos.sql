-- =====================================================================
-- FIRMA · Portal · Documentos
-- Tres secciones. Contratos de servicio, contratos con el equipo y otros.
-- Cada documento es un archivo privado (bucket documentos) o un enlace.
-- Sin organización lo ven todos los clientes. Con organización, solo esa.
-- Sin áreas lo ve todo el equipo del cliente. Con áreas, el titular y
-- los miembros de esas áreas.
-- Se ejecuta una sola vez en Supabase › SQL Editor.
-- =====================================================================

create table if not exists public.documentos (
  id               uuid primary key default gen_random_uuid(),
  seccion          text not null check (seccion in ('servicio', 'equipo', 'otros')),
  organizacion_id  uuid references public.organizaciones (id) on delete cascade,
  titulo           text not null check (length(trim(titulo)) > 0),
  descripcion      text,
  version          text,
  areas            text[] not null default '{}',
  archivo_ruta     text unique,
  archivo_nombre   text,
  archivo_bytes    bigint check (archivo_bytes is null or archivo_bytes >= 0),
  url              text check (url is null or url ~ '^(https://|/[^/])'),
  orden            int not null default 0,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  -- Archivo o enlace, nunca los dos ni ninguno.
  constraint documentos_contenido check ((archivo_ruta is null) <> (url is null))
);

create index if not exists documentos_seccion_idx on public.documentos (seccion, orden);
create index if not exists documentos_organizacion_idx on public.documentos (organizacion_id);

-- La fecha que ve el cliente cambia solo cuando cambia el contenido
-- (archivo, enlace o versión), no al reordenar o editar textos.
create or replace function public.documentos_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.actualizado_en := now();
  elsif new.archivo_ruta is distinct from old.archivo_ruta
     or new.url is distinct from old.url
     or new.version is distinct from old.version then
    new.actualizado_en := now();
  else
    new.actualizado_en := old.actualizado_en;
  end if;
  return new;
end;
$$;

drop trigger if exists documentos_antes on public.documentos;
create trigger documentos_antes before insert or update on public.documentos
  for each row execute function public.documentos_antes();

-- ---------------------------------------------------------------------
-- Regla de visibilidad, en un solo lugar
-- ---------------------------------------------------------------------
create or replace function public.mis_areas()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce((select p.areas from public.perfiles p where p.id = auth.uid() and p.activo), '{}'::text[]);
$$;

create or replace function public.documento_visible(p_org uuid, p_areas text[], p_activo boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or (
    p_activo
    and public.mi_organizacion() is not null
    and (p_org is null or p_org = public.mi_organizacion())
    and (coalesce(cardinality(p_areas), 0) = 0 or public.soy_titular() or p_areas && public.mis_areas())
  );
$$;

create or replace function public.puede_descargar_documento(ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documentos d
    where d.archivo_ruta = ruta
      and public.documento_visible(d.organizacion_id, d.areas, d.activo)
  );
$$;

-- Cada descarga de un cliente queda en el registro. Las del admin no.
create or replace function public.registrar_descarga(doc uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.documentos;
begin
  if auth.uid() is null or public.es_admin() then return; end if;
  select * into d from public.documentos where id = doc;
  if not found or not public.documento_visible(d.organizacion_id, d.areas, d.activo) then return; end if;
  insert into public.registro_accesos (usuario_id, actor_id, accion, detalle)
  values (auth.uid(), auth.uid(), 'descarga_documento',
          jsonb_build_object('documento_id', d.id, 'titulo', d.titulo, 'seccion', d.seccion, 'version', d.version));
end;
$$;

revoke all on function public.registrar_descarga(uuid) from public, anon;
grant execute on function public.registrar_descarga(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------
alter table public.documentos enable row level security;

drop policy if exists documentos_lectura on public.documentos;
create policy documentos_lectura on public.documentos for select to authenticated
  using (public.documento_visible(organizacion_id, areas, activo));

drop policy if exists documentos_gestion on public.documentos;
create policy documentos_gestion on public.documentos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

revoke all on public.documentos from anon;
grant select, insert, update, delete on public.documentos to authenticated;

-- ---------------------------------------------------------------------
-- Archivos. Bucket privado, hasta 25 MB, solo formatos de documento.
-- Se descargan con enlaces firmados que vencen en un minuto.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 26214400, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/rtf'
])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists documentos_descarga on storage.objects;
create policy documentos_descarga on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (public.es_admin() or public.puede_descargar_documento(name)));

drop policy if exists documentos_subida on storage.objects;
create policy documentos_subida on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.es_admin());

drop policy if exists documentos_reemplazo on storage.objects;
create policy documentos_reemplazo on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and public.es_admin())
  with check (bucket_id = 'documentos' and public.es_admin());

drop policy if exists documentos_borrado on storage.objects;
create policy documentos_borrado on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.es_admin());

-- ---------------------------------------------------------------------
-- Primer documento. El protocolo de llamadas, como enlace para todos.
-- ---------------------------------------------------------------------
insert into public.documentos (seccion, titulo, descripcion, url, orden)
select 'otros',
       'Protocolo legal para llamadas de venta',
       'Frases y pasos para comunicar reservas, pagos y condiciones en las llamadas, cuidando la venta y la prueba.',
       '/protocolo-llamadas',
       1
where not exists (select 1 from public.documentos where url = '/protocolo-llamadas');

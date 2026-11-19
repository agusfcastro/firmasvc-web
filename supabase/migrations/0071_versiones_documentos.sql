-- =====================================================================
-- FIRMA · Portal · Editar los Word de un asunto, con versiones
-- FIRMA corrige un Word del asunto dentro del portal. Lo que guarda
-- queda como borrador, que el cliente no ve, y recién al publicarlo
-- pasa a ser el documento del asunto. Cada publicación es una versión
-- numerada y las anteriores quedan en el historial. Hay un solo
-- borrador por documento.
--
-- asunto_archivos.ruta apunta siempre a la versión publicada, así que
-- el resto del portal (visor, comentarios, borradores de Tina) no
-- cambia. Los borradores se guardan en el mismo bucket, en la carpeta
-- borradores/, que solo abre FIRMA.
-- Se ejecuta una sola vez en Supabase › SQL Editor.
-- =====================================================================

create table if not exists public.asunto_archivo_versiones (
  id               uuid primary key default gen_random_uuid(),
  archivo_id       uuid not null references public.asunto_archivos (id) on delete cascade,
  asunto_id        uuid not null references public.asuntos (id) on delete cascade,
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  estado           text not null default 'borrador' check (estado in ('borrador', 'publicada')),
  -- El borrador no lleva número. La primera publicada es la 1, el archivo como se subió.
  numero           integer check (numero is null or numero >= 1),
  ruta             text not null unique,
  bytes            bigint check (bytes is null or bytes >= 0),
  creado_por       uuid references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  publicado_en     timestamptz,
  constraint asunto_archivo_versiones_numero check ((estado = 'publicada') = (numero is not null))
);

create unique index if not exists asunto_archivo_versiones_borrador_idx on public.asunto_archivo_versiones (archivo_id) where estado = 'borrador';
create unique index if not exists asunto_archivo_versiones_numero_idx on public.asunto_archivo_versiones (archivo_id, numero) where numero is not null;
create index if not exists asunto_archivo_versiones_asunto_idx on public.asunto_archivo_versiones (asunto_id);

-- Solo FIRMA ve las versiones, y nadie escribe la tabla a mano: todo pasa por las funciones de abajo.
alter table public.asunto_archivo_versiones enable row level security;

drop policy if exists versiones_lectura on public.asunto_archivo_versiones;
create policy versiones_lectura on public.asunto_archivo_versiones for select to authenticated
  using (public.es_admin());

revoke all on public.asunto_archivo_versiones from anon, authenticated;
grant select on public.asunto_archivo_versiones to authenticated;
grant select, insert, update, delete on public.asunto_archivo_versiones to service_role;

-- Guarda el borrador de un documento. p_visto es el actualizado_en del
-- borrador que tenía abierto quien guarda: si otra persona de FIRMA lo
-- cambió mientras tanto, no se pisa salvo que se pida con p_pisar.
-- Devuelve la ruta del archivo anterior, para borrarlo del bucket.
create or replace function public.version_borrador_guardar(p_archivo uuid, p_ruta text, p_bytes bigint, p_visto timestamptz default null, p_pisar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.asunto_archivos;
  b public.asunto_archivo_versiones;
  anterior text;
begin
  if auth.uid() is null or not public.es_admin() then raise exception 'Solo FIRMA edita los documentos.'; end if;
  select * into a from asunto_archivos where id = p_archivo;
  if not found then raise exception 'Documento inexistente.'; end if;
  if lower(a.nombre) not like '%.docx' then raise exception 'Solo se editan documentos de Word.'; end if;
  if p_ruta not like 'borradores/' || a.organizacion_id::text || '/' || a.asunto_id::text || '/%.docx' then
    raise exception 'Ruta de borrador inválida.';
  end if;

  select * into b from asunto_archivo_versiones where archivo_id = p_archivo and estado = 'borrador' for update;
  if found then
    if not p_pisar and b.actualizado_en is distinct from p_visto then
      raise exception 'BORRADOR_CAMBIADO: otra persona de FIRMA guardó cambios en este documento.';
    end if;
    anterior := b.ruta;
    update asunto_archivo_versiones
       set ruta = p_ruta, bytes = p_bytes, creado_por = auth.uid(), actualizado_en = now()
     where id = b.id
     returning * into b;
  else
    insert into asunto_archivo_versiones (archivo_id, asunto_id, organizacion_id, ruta, bytes, creado_por)
    values (a.id, a.asunto_id, a.organizacion_id, p_ruta, p_bytes, auth.uid())
    returning * into b;
  end if;
  return jsonb_build_object('id', b.id, 'actualizado_en', b.actualizado_en, 'ruta_anterior', anterior);
end;
$$;

-- Descarta el borrador. Devuelve su ruta, para borrarlo del bucket.
create or replace function public.version_borrador_descartar(p_archivo uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  anterior text;
begin
  if auth.uid() is null or not public.es_admin() then raise exception 'Solo FIRMA edita los documentos.'; end if;
  delete from asunto_archivo_versiones where archivo_id = p_archivo and estado = 'borrador' returning ruta into anterior;
  return anterior;
end;
$$;

-- Publica una versión: p_ruta es el Word nuevo, ya subido a la carpeta
-- del asunto. El documento del asunto pasa a ser ese, el borrador (si
-- había) queda como la versión publicada y la novedad va a la bitácora.
-- Devuelve la ruta del borrador, para borrarlo del bucket.
create or replace function public.version_publicar(p_archivo uuid, p_ruta text, p_bytes bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.asunto_archivos;
  b public.asunto_archivo_versiones;
  siguiente integer;
  anterior text;
begin
  if auth.uid() is null or not public.es_admin() then raise exception 'Solo FIRMA edita los documentos.'; end if;
  select * into a from asunto_archivos where id = p_archivo for update;
  if not found then raise exception 'Documento inexistente.'; end if;
  if lower(a.nombre) not like '%.docx' then raise exception 'Solo se editan documentos de Word.'; end if;
  if p_ruta not like a.organizacion_id::text || '/' || a.asunto_id::text || '/%.docx' or p_ruta = a.ruta then
    raise exception 'Ruta de archivo inválida.';
  end if;

  -- La versión 1 es el archivo como se subió.
  if not exists (select 1 from asunto_archivo_versiones where archivo_id = p_archivo and estado = 'publicada') then
    insert into asunto_archivo_versiones (archivo_id, asunto_id, organizacion_id, estado, numero, ruta, bytes, creado_por, creado_en, actualizado_en, publicado_en)
    values (a.id, a.asunto_id, a.organizacion_id, 'publicada', 1, a.ruta, a.bytes, a.subido_por, a.creado_en, a.creado_en, a.creado_en);
  end if;
  select coalesce(max(numero), 0) + 1 into siguiente from asunto_archivo_versiones where archivo_id = p_archivo;

  select * into b from asunto_archivo_versiones where archivo_id = p_archivo and estado = 'borrador' for update;
  if found then
    anterior := b.ruta;
    update asunto_archivo_versiones
       set estado = 'publicada', numero = siguiente, ruta = p_ruta, bytes = p_bytes,
           creado_por = auth.uid(), actualizado_en = now(), publicado_en = now()
     where id = b.id;
  else
    insert into asunto_archivo_versiones (archivo_id, asunto_id, organizacion_id, estado, numero, ruta, bytes, creado_por, publicado_en)
    values (a.id, a.asunto_id, a.organizacion_id, 'publicada', siguiente, p_ruta, p_bytes, auth.uid(), now());
  end if;

  update asunto_archivos set ruta = p_ruta, bytes = p_bytes where id = p_archivo;
  insert into asunto_novedades (asunto_id, texto, tipo, interna, autor_id)
  values (a.asunto_id, 'Actualizó ' || a.nombre || ' (versión ' || siguiente || ').', 'documento', false, auth.uid());
  return jsonb_build_object('numero', siguiente, 'ruta_borrador', anterior);
end;
$$;

revoke all on function public.version_borrador_guardar(uuid, text, bigint, timestamptz, boolean) from public, anon;
revoke all on function public.version_borrador_descartar(uuid) from public, anon;
revoke all on function public.version_publicar(uuid, text, bigint) from public, anon;
grant execute on function public.version_borrador_guardar(uuid, text, bigint, timestamptz, boolean) to authenticated;
grant execute on function public.version_borrador_descartar(uuid) to authenticated;
grant execute on function public.version_publicar(uuid, text, bigint) to authenticated;

-- Los borradores viven en borradores/<empresa>/<asunto>/ y solo FIRMA los sube y los lee.
-- El borrado ya lo cubre asuntos_archivo_borrado (0018), que es de FIRMA para todo el bucket.
drop policy if exists asuntos_borrador_lectura on storage.objects;
create policy asuntos_borrador_lectura on storage.objects for select to authenticated
  using (bucket_id = 'asuntos' and name like 'borradores/%' and public.es_admin());
drop policy if exists asuntos_borrador_subida on storage.objects;
create policy asuntos_borrador_subida on storage.objects for insert to authenticated
  with check (bucket_id = 'asuntos' and name like 'borradores/%' and public.es_admin());

notify pgrst, 'reload schema';

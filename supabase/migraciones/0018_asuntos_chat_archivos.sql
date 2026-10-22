-- =====================================================================
-- FIRMA · Portal · Asuntos con bitácora, chat y documentos
-- 1. Bitácora: las novedades pasan a ser notas de FIRMA, internas (solo
--    FIRMA) o visibles para el cliente. Los cambios de estado y los
--    documentos subidos se anotan solos.
-- 2. Chat: mensajes entre FIRMA y la empresa, en vivo con Supabase Realtime.
-- 3. Documentos: archivos del asunto que suben FIRMA y el cliente, en el
--    bucket privado asuntos.
-- Requiere la 0017. Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bitácora
-- ---------------------------------------------------------------------
alter table public.asunto_novedades add column if not exists interna boolean not null default false;
alter table public.asunto_novedades add column if not exists tipo text not null default 'nota';
alter table public.asunto_novedades drop constraint if exists asunto_novedades_tipo;
alter table public.asunto_novedades add constraint asunto_novedades_tipo check (tipo in ('nota', 'estado', 'documento'));

-- Quién escribe, de qué empresa es y que las anotaciones automáticas no las cargue nadie a mano.
create or replace function public.asunto_novedades_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select organizacion_id into new.organizacion_id from asuntos where id = new.asunto_id;
  if new.organizacion_id is null then raise exception 'Asunto inexistente.'; end if;
  new.texto := trim(new.texto);
  if auth.uid() is not null then
    new.autor_id := auth.uid();
    if not public.es_admin() then
      new.estado := null;
      new.interna := false;
    end if;
  end if;
  return new;
end;
$$;

-- Cada cambio de estado queda en la bitácora, visible para el cliente.
create or replace function public.asuntos_registrar_estado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rotulo text;
begin
  if new.estado is distinct from old.estado then
    rotulo := case new.estado
      when 'en_curso' then 'En curso'
      when 'espera_cliente' then 'Esperando al cliente'
      when 'espera_tercero' then 'Esperando a un tercero'
      when 'finalizado' then 'Finalizado'
      else new.estado end;
    insert into asunto_novedades (asunto_id, texto, estado, tipo, interna, autor_id)
    values (new.id, 'El asunto pasó a ' || rotulo || '.', new.estado, 'estado', false, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists asuntos_registrar_estado on public.asuntos;
create trigger asuntos_registrar_estado after update on public.asuntos
  for each row execute function public.asuntos_registrar_estado();

-- Las notas internas las ve solo FIRMA. Las escribe solo FIRMA: el cliente usa el chat.
drop policy if exists novedades_lectura on public.asunto_novedades;
create policy novedades_lectura on public.asunto_novedades for select to authenticated
  using (public.puede_ver_casos(organizacion_id) and (not interna or public.es_admin()));
drop policy if exists novedades_alta on public.asunto_novedades;
create policy novedades_alta on public.asunto_novedades for insert to authenticated
  with check (public.es_admin() and autor_id = auth.uid() and tipo = 'nota');

grant insert (asunto_id, texto, estado, interna) on public.asunto_novedades to authenticated;

-- ---------------------------------------------------------------------
-- 2. Chat
-- ---------------------------------------------------------------------
create table if not exists public.asunto_mensajes (
  id               uuid primary key default gen_random_uuid(),
  asunto_id        uuid not null references public.asuntos (id) on delete cascade,
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  texto            text not null check (length(trim(texto)) between 1 and 4000),
  autor_id         uuid references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now()
);

create index if not exists asunto_mensajes_asunto_idx on public.asunto_mensajes (asunto_id, creado_en);

-- Último mail de chat a cada lado, para mandar como mucho uno cada 15 minutos por asunto.
alter table public.asuntos add column if not exists aviso_chat_cliente timestamptz;
alter table public.asuntos add column if not exists aviso_chat_firma timestamptz;

create or replace function public.asunto_mensajes_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select organizacion_id into new.organizacion_id from asuntos where id = new.asunto_id;
  if new.organizacion_id is null then raise exception 'Asunto inexistente.'; end if;
  new.texto := trim(new.texto);
  if auth.uid() is not null then new.autor_id := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists asunto_mensajes_antes on public.asunto_mensajes;
create trigger asunto_mensajes_antes before insert on public.asunto_mensajes
  for each row execute function public.asunto_mensajes_antes();

drop trigger if exists asunto_mensajes_despues on public.asunto_mensajes;
create trigger asunto_mensajes_despues after insert on public.asunto_mensajes
  for each row execute function public.asunto_novedades_despues();

alter table public.asunto_mensajes enable row level security;

drop policy if exists mensajes_lectura on public.asunto_mensajes;
create policy mensajes_lectura on public.asunto_mensajes for select to authenticated
  using (public.puede_ver_casos(organizacion_id));
drop policy if exists mensajes_alta on public.asunto_mensajes;
create policy mensajes_alta on public.asunto_mensajes for insert to authenticated
  with check (public.puede_ver_casos(organizacion_id) and autor_id = auth.uid());
drop policy if exists mensajes_baja on public.asunto_mensajes;
create policy mensajes_baja on public.asunto_mensajes for delete to authenticated
  using (public.es_admin());

revoke all on public.asunto_mensajes from anon, authenticated;
grant select, delete on public.asunto_mensajes to authenticated;
grant insert (asunto_id, texto) on public.asunto_mensajes to authenticated;
grant select, insert, update, delete on public.asunto_mensajes to service_role;

-- Mensajes en vivo. Realtime respeta las mismas reglas de lectura.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'asunto_mensajes') then
    alter publication supabase_realtime add table public.asunto_mensajes;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Documentos del asunto
-- Ruta en el bucket: <organizacion_id>/<asunto_id>/<uuid>.<ext>
-- ---------------------------------------------------------------------
create table if not exists public.asunto_archivos (
  id               uuid primary key default gen_random_uuid(),
  asunto_id        uuid not null references public.asuntos (id) on delete cascade,
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  nombre           text not null check (length(trim(nombre)) between 1 and 200),
  ruta             text not null unique,
  bytes            bigint check (bytes is null or bytes >= 0),
  subido_por       uuid references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now()
);

create index if not exists asunto_archivos_asunto_idx on public.asunto_archivos (asunto_id, creado_en desc);

create or replace function public.asunto_archivos_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select organizacion_id into new.organizacion_id from asuntos where id = new.asunto_id;
  if new.organizacion_id is null then raise exception 'Asunto inexistente.'; end if;
  -- El archivo tiene que estar en la carpeta de su empresa y de su asunto.
  if new.ruta not like new.organizacion_id::text || '/' || new.asunto_id::text || '/%' then
    raise exception 'Ruta de archivo inválida.';
  end if;
  new.nombre := trim(new.nombre);
  if auth.uid() is not null then new.subido_por := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists asunto_archivos_antes on public.asunto_archivos;
create trigger asunto_archivos_antes before insert on public.asunto_archivos
  for each row execute function public.asunto_archivos_antes();

-- Cada archivo subido queda en la bitácora.
create or replace function public.asunto_archivos_despues()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into asunto_novedades (asunto_id, texto, tipo, interna, autor_id)
  values (new.asunto_id, 'Subió ' || new.nombre || '.', 'documento', false, new.subido_por);
  return new;
end;
$$;

drop trigger if exists asunto_archivos_despues on public.asunto_archivos;
create trigger asunto_archivos_despues after insert on public.asunto_archivos
  for each row execute function public.asunto_archivos_despues();

alter table public.asunto_archivos enable row level security;

drop policy if exists archivos_lectura on public.asunto_archivos;
create policy archivos_lectura on public.asunto_archivos for select to authenticated
  using (public.puede_ver_casos(organizacion_id));
drop policy if exists archivos_alta on public.asunto_archivos;
create policy archivos_alta on public.asunto_archivos for insert to authenticated
  with check (public.puede_ver_casos(organizacion_id) and subido_por = auth.uid());
drop policy if exists archivos_baja on public.asunto_archivos;
create policy archivos_baja on public.asunto_archivos for delete to authenticated
  using (public.es_admin());

revoke all on public.asunto_archivos from anon, authenticated;
grant select, delete on public.asunto_archivos to authenticated;
grant insert (asunto_id, nombre, ruta, bytes) on public.asunto_archivos to authenticated;
grant select, insert, update, delete on public.asunto_archivos to service_role;

-- Bucket privado, hasta 20 MB, documentos e imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('asuntos', 'asuntos', false, 20971520, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'text/plain'
])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- La primera carpeta de la ruta es la empresa: la ven, suben y descargan quienes ven sus asuntos.
-- La función no falla con rutas de otros buckets, que no empiezan con un id de empresa.
create or replace function public.archivo_asunto_visible(ruta text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  carpeta text := split_part(ruta, '/', 1);
begin
  if carpeta !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return public.puede_ver_casos(carpeta::uuid);
end;
$$;

drop policy if exists asuntos_archivo_descarga on storage.objects;
create policy asuntos_archivo_descarga on storage.objects for select to authenticated
  using (bucket_id = 'asuntos' and public.archivo_asunto_visible(name));
drop policy if exists asuntos_archivo_subida on storage.objects;
create policy asuntos_archivo_subida on storage.objects for insert to authenticated
  with check (bucket_id = 'asuntos' and public.archivo_asunto_visible(name));
drop policy if exists asuntos_archivo_borrado on storage.objects;
create policy asuntos_archivo_borrado on storage.objects for delete to authenticated
  using (bucket_id = 'asuntos' and public.es_admin());

notify pgrst, 'reload schema';

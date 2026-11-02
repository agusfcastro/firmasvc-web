-- =====================================================================
-- FIRMA · Portal · Firma electrónica propia
-- Sobres (un documento PDF con sus firmantes), firmantes y un registro
-- de eventos encadenado por hash que no se puede editar ni borrar.
-- Todo se escribe desde las funciones del servidor (api/firma). La web
-- solo lee lo que cada usuario tiene permitido ver.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Sobres
-- ---------------------------------------------------------------------
create table if not exists public.firma_sobres (
  id               uuid primary key default gen_random_uuid(),
  -- Código corto que se imprime en el documento y sirve para verificarlo.
  codigo           text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  -- Sin organización es un envío propio de FIRMA que solo ve el admin.
  organizacion_id  uuid references public.organizaciones (id) on delete restrict,
  emisor           text not null check (emisor in ('firma', 'cliente')),
  titulo           text not null check (length(trim(titulo)) between 1 and 200),
  mensaje          text check (mensaje is null or length(mensaje) <= 2000),
  estado           text not null default 'en_curso'
                   check (estado in ('en_curso', 'completado', 'rechazado', 'anulado', 'vencido')),
  secuencial       boolean not null default false,
  vence_en         timestamptz not null,
  creado_por       uuid references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now(),
  completado_en    timestamptz,
  cerrado_en       timestamptz,
  motivo_cierre    text,
  original_ruta    text not null unique,
  original_nombre  text not null,
  original_bytes   bigint not null check (original_bytes > 0),
  original_sha256  text not null check (original_sha256 ~ '^[0-9a-f]{64}$'),
  original_paginas int not null check (original_paginas > 0),
  final_ruta       text unique,
  final_sha256     text check (final_sha256 is null or final_sha256 ~ '^[0-9a-f]{64}$'),
  error_sellado    text,
  constraint firma_sobres_completo check ((estado = 'completado') = (final_ruta is not null and completado_en is not null))
);

create index if not exists firma_sobres_org_idx on public.firma_sobres (organizacion_id, creado_en desc);
create index if not exists firma_sobres_final_idx on public.firma_sobres (final_sha256);
create index if not exists firma_sobres_original_idx on public.firma_sobres (original_sha256);

-- ---------------------------------------------------------------------
-- Firmantes
-- ---------------------------------------------------------------------
create table if not exists public.firma_firmantes (
  id                  uuid primary key default gen_random_uuid(),
  sobre_id            uuid not null references public.firma_sobres (id) on delete restrict,
  orden               int  not null default 1 check (orden between 1 and 20),
  nombre              text not null check (length(trim(nombre)) between 2 and 160),
  email               text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  pedir_documento     boolean not null default true,
  documento           text check (documento is null or length(documento) <= 40),
  estado              text not null default 'pendiente'
                      check (estado in ('pendiente', 'notificado', 'visto', 'firmado', 'rechazado')),
  -- Cambiar la versión invalida el enlace anterior.
  version_enlace      int  not null default 1,
  notificado_en       timestamptz,
  visto_en            timestamptz,
  firmado_en          timestamptz,
  rechazado_en        timestamptz,
  motivo_rechazo      text,
  ultimo_recordatorio timestamptz,
  -- Código de un solo uso por mail. Solo se guarda su hash.
  otp_hash            text,
  otp_vence           timestamptz,
  otp_intentos        int not null default 0,
  otp_enviados        int not null default 0,
  otp_ultimo_envio    timestamptz,
  otp_verificado_en   timestamptz,
  -- Evidencia de la firma
  firma_ruta          text,
  firma_tipo          text check (firma_tipo is null or firma_tipo in ('dibujada', 'escrita')),
  firma_sha256        text,
  ip                  text,
  user_agent          text,
  unique (sobre_id, email),
  constraint firma_firmantes_firmado check ((estado = 'firmado') = (firmado_en is not null and firma_ruta is not null))
);

create index if not exists firma_firmantes_sobre_idx on public.firma_firmantes (sobre_id, orden);

-- ---------------------------------------------------------------------
-- Registro de eventos encadenado. Cada evento guarda el hash del
-- anterior del mismo sobre, así cualquier cambio rompe la cadena.
-- ---------------------------------------------------------------------
create table if not exists public.firma_eventos (
  id           bigint generated always as identity primary key,
  sobre_id     uuid not null references public.firma_sobres (id) on delete restrict,
  firmante_id  uuid references public.firma_firmantes (id) on delete restrict,
  actor_id     uuid references auth.users (id) on delete set null,
  tipo         text not null,
  ip           text,
  user_agent   text,
  detalle      jsonb not null default '{}'::jsonb,
  creado_en    timestamptz not null default clock_timestamp(),
  hash_previo  text,
  hash         text not null
);

create index if not exists firma_eventos_sobre_idx on public.firma_eventos (sobre_id, id);

create or replace function public.firma_eventos_inmutables()
returns trigger language plpgsql as $$
begin
  raise exception 'El registro de eventos de firma no se puede modificar ni borrar.';
end;
$$;

drop trigger if exists firma_eventos_inmutables on public.firma_eventos;
create trigger firma_eventos_inmutables before update or delete on public.firma_eventos
  for each row execute function public.firma_eventos_inmutables();

-- Texto que entra en el hash. Mismo armado al registrar y al verificar.
create or replace function public.firma_texto_evento(
  p_previo text, p_sobre uuid, p_firmante uuid, p_tipo text, p_ip text, p_ua text, p_detalle jsonb, p_fecha timestamptz
) returns text language sql stable as $$
  select concat_ws('|',
    coalesce(p_previo, ''),
    p_sobre::text,
    coalesce(p_firmante::text, ''),
    p_tipo,
    coalesce(p_ip, ''),
    coalesce(p_ua, ''),
    coalesce(p_detalle, '{}'::jsonb)::text,
    to_char(p_fecha at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
$$;

create or replace function public.firma_registrar_evento(
  p_sobre uuid, p_firmante uuid, p_actor uuid, p_tipo text, p_ip text, p_ua text, p_detalle jsonb
) returns public.firma_eventos
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_previo text;
  v_fecha  timestamptz := clock_timestamp();
  v_hash   text;
  v_fila   public.firma_eventos;
begin
  -- Un evento a la vez por sobre, para que la cadena no se bifurque.
  perform pg_advisory_xact_lock(hashtext('firma:' || p_sobre::text));
  select e.hash into v_previo from public.firma_eventos e where e.sobre_id = p_sobre order by e.id desc limit 1;
  v_hash := encode(digest(public.firma_texto_evento(v_previo, p_sobre, p_firmante, p_tipo, p_ip, p_ua, p_detalle, v_fecha), 'sha256'), 'hex');
  insert into public.firma_eventos (sobre_id, firmante_id, actor_id, tipo, ip, user_agent, detalle, creado_en, hash_previo, hash)
  values (p_sobre, p_firmante, p_actor, p_tipo, p_ip, p_ua, coalesce(p_detalle, '{}'::jsonb), v_fecha, v_previo, v_hash)
  returning * into v_fila;
  return v_fila;
end;
$$;

-- Recalcula toda la cadena del sobre. true si nadie la tocó.
create or replace function public.firma_verificar_cadena(p_sobre uuid)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  e        record;
  v_previo text := null;
begin
  if auth.role() = 'authenticated' and not public.firma_sobre_visible(p_sobre) then return null; end if;
  for e in select * from public.firma_eventos where sobre_id = p_sobre order by id loop
    if e.hash_previo is distinct from v_previo then return false; end if;
    if e.hash <> encode(digest(public.firma_texto_evento(v_previo, e.sobre_id, e.firmante_id, e.tipo, e.ip, e.user_agent, e.detalle, e.creado_en), 'sha256'), 'hex') then
      return false;
    end if;
    v_previo := e.hash;
  end loop;
  return true;
end;
$$;

revoke all on function public.firma_registrar_evento(uuid, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.firma_registrar_evento(uuid, uuid, uuid, text, text, text, jsonb) to service_role;
revoke all on function public.firma_verificar_cadena(uuid) from public, anon;
grant execute on function public.firma_verificar_cadena(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Quién ve cada sobre. FIRMA todo. El titular, todos los de su empresa.
-- Un miembro del equipo, los que mandó él.
-- ---------------------------------------------------------------------
create or replace function public.firma_sobre_visible(p_sobre uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or exists (
    select 1 from public.firma_sobres s
    where s.id = p_sobre
      and s.organizacion_id is not null
      and s.organizacion_id = public.mi_organizacion()
      and (public.soy_titular() or s.creado_por = auth.uid())
  );
$$;

alter table public.firma_sobres    enable row level security;
alter table public.firma_firmantes enable row level security;
alter table public.firma_eventos   enable row level security;

drop policy if exists firma_sobres_lectura on public.firma_sobres;
create policy firma_sobres_lectura on public.firma_sobres for select to authenticated
  using (public.firma_sobre_visible(id));

drop policy if exists firma_firmantes_lectura on public.firma_firmantes;
create policy firma_firmantes_lectura on public.firma_firmantes for select to authenticated
  using (public.firma_sobre_visible(sobre_id));

drop policy if exists firma_eventos_lectura on public.firma_eventos;
create policy firma_eventos_lectura on public.firma_eventos for select to authenticated
  using (public.firma_sobre_visible(sobre_id));

revoke all on public.firma_sobres, public.firma_firmantes, public.firma_eventos from anon, authenticated;
grant select on public.firma_sobres, public.firma_eventos to authenticated;
-- Los códigos por mail y la versión del enlace nunca llegan al navegador.
grant select (id, sobre_id, orden, nombre, email, pedir_documento, documento, estado, notificado_en, visto_en,
              firmado_en, rechazado_en, motivo_rechazo, ultimo_recordatorio, firma_tipo, ip)
  on public.firma_firmantes to authenticated;

-- ---------------------------------------------------------------------
-- Archivos. Bucket privado. La web solo sube el PDF a su carpeta de
-- borradores. El servidor lo valida, calcula el hash y lo mueve.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('firmas', 'firmas', false, 15728640, array['application/pdf', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists firmas_subida_borrador on storage.objects;
create policy firmas_subida_borrador on storage.objects for insert to authenticated
  with check (
    bucket_id = 'firmas'
    and (storage.foldername(name))[1] = 'borradores'
    and (storage.foldername(name))[2] = auth.uid()::text
    and lower(name) like '%.pdf'
  );

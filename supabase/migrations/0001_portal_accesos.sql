-- =====================================================================
-- FIRMA · Portal de clientes · Módulo 1 (accesos, roles y registro)
-- Se ejecuta una sola vez en Supabase › SQL Editor.
-- Las contraseñas nunca se guardan acá. Las administra Supabase Auth
-- con hash, y cada usuario define la suya desde el enlace que recibe.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.rol_portal as enum ('admin', 'titular', 'miembro');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Organizaciones (cada cliente de FIRMA)
-- ---------------------------------------------------------------------
create table if not exists public.organizaciones (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(trim(nombre)) > 0),
  razon_social text,
  pais         text not null default 'AR',
  activa       boolean not null default true,
  notas        text,
  creado_en    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Áreas (sirven para asignar protocolos y videos por equipo)
-- ---------------------------------------------------------------------
create table if not exists public.areas (
  clave  text primary key,
  nombre text not null,
  orden  int  not null default 0
);

insert into public.areas (clave, nombre, orden) values
  ('direccion',   'Dirección',            1),
  ('ventas',      'Ventas',               2),
  ('atencion',    'Atención al cliente',  3),
  ('marketing',   'Marketing',            4),
  ('operaciones', 'Operaciones',          5),
  ('legales',     'Legales',              6)
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------
-- Perfiles (uno por usuario de Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  nombre           text,
  rol              public.rol_portal not null default 'miembro',
  organizacion_id  uuid references public.organizaciones (id) on delete restrict,
  areas            text[] not null default '{}',
  activo           boolean not null default true,
  invitado_por     uuid references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now(),
  ultimo_ingreso   timestamptz,
  constraint perfiles_org_requerida check (rol = 'admin' or organizacion_id is not null)
);

create index if not exists perfiles_organizacion_idx on public.perfiles (organizacion_id);

-- ---------------------------------------------------------------------
-- Registro de accesos y cambios (trazabilidad)
-- ---------------------------------------------------------------------
create table if not exists public.registro_accesos (
  id          bigint generated always as identity primary key,
  usuario_id  uuid references auth.users (id) on delete set null,
  actor_id    uuid references auth.users (id) on delete set null,
  accion      text not null,
  detalle     jsonb not null default '{}'::jsonb,
  creado_en   timestamptz not null default now()
);

create index if not exists registro_accesos_fecha_idx on public.registro_accesos (creado_en desc);

-- ---------------------------------------------------------------------
-- Funciones auxiliares. security definer para que las políticas no se
-- llamen a sí mismas al consultar perfiles.
-- ---------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function public.mi_organizacion()
returns uuid language sql stable security definer set search_path = public as $$
  select p.organizacion_id
  from public.perfiles p
  join public.organizaciones o on o.id = p.organizacion_id
  where p.id = auth.uid() and p.activo and o.activa;
$$;

create or replace function public.soy_titular()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'titular' and activo
  );
$$;

-- Se llama desde la web cada vez que alguien ingresa.
create or replace function public.registrar_ingreso()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.perfiles set ultimo_ingreso = now() where id = auth.uid();
  insert into public.registro_accesos (usuario_id, actor_id, accion)
  values (auth.uid(), auth.uid(), 'ingreso');
end;
$$;

revoke all on function public.registrar_ingreso() from public, anon;
grant execute on function public.registrar_ingreso() to authenticated;

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------
alter table public.organizaciones   enable row level security;
alter table public.areas            enable row level security;
alter table public.perfiles         enable row level security;
alter table public.registro_accesos enable row level security;

-- Organizaciones: el admin ve y edita todo, cada usuario ve solo la suya.
drop policy if exists org_lectura on public.organizaciones;
create policy org_lectura on public.organizaciones
  for select to authenticated
  using (public.es_admin() or id = public.mi_organizacion());

drop policy if exists org_admin_alta on public.organizaciones;
create policy org_admin_alta on public.organizaciones
  for insert to authenticated with check (public.es_admin());

drop policy if exists org_admin_edicion on public.organizaciones;
create policy org_admin_edicion on public.organizaciones
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Áreas: lectura para cualquier usuario autenticado.
drop policy if exists areas_lectura on public.areas;
create policy areas_lectura on public.areas
  for select to authenticated using (true);

-- Perfiles: cada uno ve el suyo, el titular ve a su equipo, el admin ve todo.
drop policy if exists perfiles_lectura on public.perfiles;
create policy perfiles_lectura on public.perfiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.es_admin()
    or (public.soy_titular() and organizacion_id = public.mi_organizacion())
  );

-- Cada usuario puede cambiar solo su nombre. Rol, organización, áreas y
-- estado se cambian únicamente desde la API de administración.
drop policy if exists perfiles_edicion_propia on public.perfiles;
create policy perfiles_edicion_propia on public.perfiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke insert, update, delete on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;
grant update (nombre) on public.perfiles to authenticated;

-- Registro: solo lo lee el admin. Nadie escribe directo desde la web.
drop policy if exists registro_lectura on public.registro_accesos;
create policy registro_lectura on public.registro_accesos
  for select to authenticated using (public.es_admin());

revoke insert, update, delete on public.registro_accesos from anon, authenticated;
grant select on public.registro_accesos to authenticated;

-- Organizaciones y áreas: sin borrado desde la web (se desactivan).
revoke delete on public.organizaciones from anon, authenticated;
revoke insert, update, delete on public.areas from anon, authenticated;
revoke all on public.organizaciones, public.areas, public.perfiles, public.registro_accesos from anon;

-- =====================================================================
-- FIRMA · Portal · Membresías
-- Una persona puede pertenecer a varios negocios, con un rol y áreas en
-- cada uno. Trabaja en uno por vez, la organización activa.
--
-- perfiles.organizacion_id, perfiles.rol y perfiles.areas pasan a ser el
-- reflejo de la membresía activa. Así las políticas, funciones y la API
-- que ya leen el perfil siguen funcionando sin cambios.
--   · Si la API de administración escribe el perfil, la membresía se
--     crea o se actualiza sola.
--   · Si cambia la membresía activa, el perfil se actualiza solo.
--   · cambiar_organizacion() pasa a otro negocio del que la persona sea
--     miembro.
-- mi_organizacion() exige además que la membresía esté activa: desactivar
-- una membresía corta el acceso a ese negocio de inmediato.
-- Los admin de FIRMA no tienen membresías: ven todo con es_admin().
-- =====================================================================

create table if not exists public.membresias (
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  rol              public.rol_portal not null check (rol::text <> 'admin'),
  areas            text[] not null default '{}',
  activa           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  primary key (usuario_id, organizacion_id)
);

create index if not exists membresias_org_idx on public.membresias (organizacion_id);

-- Las membresías de hoy salen de los perfiles.
insert into public.membresias (usuario_id, organizacion_id, rol, areas)
select id, organizacion_id, rol, areas
from public.perfiles
where organizacion_id is not null and rol::text <> 'admin'
on conflict (usuario_id, organizacion_id) do nothing;

-- ---------------------------------------------------------------------
-- Sincronía entre perfil y membresía activa. Cada lado escribe solo si
-- el valor cambió, así no se llaman entre sí sin fin.
-- ---------------------------------------------------------------------
create or replace function public.perfiles_a_membresia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organizacion_id is null or new.rol::text = 'admin' then return new; end if;
  insert into membresias (usuario_id, organizacion_id, rol, areas)
  values (new.id, new.organizacion_id, new.rol, new.areas)
  on conflict (usuario_id, organizacion_id) do update
    set rol = excluded.rol, areas = excluded.areas, activa = true, actualizado_en = now()
    where membresias.rol is distinct from excluded.rol
       or membresias.areas is distinct from excluded.areas
       or not membresias.activa;
  return new;
end;
$$;

drop trigger if exists perfiles_a_membresia on public.perfiles;
create trigger perfiles_a_membresia after insert or update of organizacion_id, rol, areas on public.perfiles
  for each row execute function public.perfiles_a_membresia();

create or replace function public.membresias_antes()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists membresias_antes on public.membresias;
create trigger membresias_antes before update on public.membresias
  for each row execute function public.membresias_antes();

-- Corre después de guardar, así el perfil ve la membresía ya cambiada y
-- su propio trigger no tiene nada que escribir.
create or replace function public.membresia_a_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.activa then
    update perfiles set rol = new.rol, areas = new.areas
    where id = new.usuario_id and organizacion_id = new.organizacion_id
      and (rol is distinct from new.rol or areas is distinct from new.areas);
  end if;
  return null;
end;
$$;

drop trigger if exists membresia_a_perfil on public.membresias;
create trigger membresia_a_perfil after update on public.membresias
  for each row execute function public.membresia_a_perfil();

-- ---------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------

-- Organización activa, solo si la membresía sigue activa.
create or replace function public.mi_organizacion()
returns uuid language sql stable security definer set search_path = public as $$
  select p.organizacion_id
  from public.perfiles p
  join public.organizaciones o on o.id = p.organizacion_id
  join public.membresias m on m.usuario_id = p.id and m.organizacion_id = p.organizacion_id
  where p.id = auth.uid() and p.activo and o.activa and m.activa;
$$;

-- Negocios a los que la persona puede pasar.
create or replace function public.mis_organizaciones()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.organizacion_id
  from public.membresias m
  join public.perfiles p on p.id = m.usuario_id
  join public.organizaciones o on o.id = m.organizacion_id
  where m.usuario_id = auth.uid() and m.activa and p.activo and o.activa;
$$;

create or replace function public.cambiar_organizacion(org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.membresias;
begin
  if auth.uid() is null then raise exception 'Sin sesión.'; end if;
  if org not in (select public.mis_organizaciones()) then
    raise exception 'No sos miembro de ese negocio.';
  end if;
  select * into m from membresias where usuario_id = auth.uid() and organizacion_id = org;
  update perfiles set organizacion_id = org, rol = m.rol, areas = m.areas where id = auth.uid();
  insert into registro_accesos (usuario_id, actor_id, accion, detalle)
  values (auth.uid(), auth.uid(), 'cambio_organizacion', jsonb_build_object('organizacion_id', org));
end;
$$;

revoke all on function public.cambiar_organizacion(uuid) from public, anon;
grant execute on function public.cambiar_organizacion(uuid) to authenticated;
revoke all on function public.mis_organizaciones() from public, anon;
grant execute on function public.mis_organizaciones() to authenticated;
revoke all on function public.perfiles_a_membresia() from public, anon, authenticated;
revoke all on function public.membresia_a_perfil() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila. Cada uno ve las suyas, el titular las de su
-- negocio, el admin todas. Se escriben solo desde el servidor.
-- ---------------------------------------------------------------------
alter table public.membresias enable row level security;

drop policy if exists membresias_lectura on public.membresias;
create policy membresias_lectura on public.membresias for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.es_admin()
    or (public.soy_titular() and organizacion_id = public.mi_organizacion())
  );

revoke all on public.membresias from anon;
revoke insert, update, delete on public.membresias from authenticated;
grant select on public.membresias to authenticated;

-- Las organizaciones de las que es miembro también se pueden leer, para
-- mostrar el selector de negocio.
drop policy if exists org_lectura on public.organizaciones;
create policy org_lectura on public.organizaciones
  for select to authenticated
  using (public.es_admin() or id = public.mi_organizacion() or id in (select public.mis_organizaciones()));

notify pgrst, 'reload schema';

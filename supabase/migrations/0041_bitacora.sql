-- =====================================================================
-- FIRMA · Portal · Bitácora por negocio, encadenada e inmutable
-- registro_accesos pasa a ser la bitácora del portal:
--   · Cada registro lleva su negocio. Si quien escribe no lo indica, se
--     toma de detalle.organizacion_id o del perfil del usuario.
--   · actor_es_staff marca lo que hizo alguien de FIRMA. El titular ve
--     esos accesos en la bitácora de su negocio.
--   · Cada registro guarda el hash del anterior del mismo negocio, como
--     firma_eventos. bitacora_verificar() recalcula la cadena.
--   · No se edita ni se borra. Por eso los usuarios se guardan como id,
--     sin clave foránea: borrar una cuenta no toca su historia.
-- Los registros anteriores a esta migración quedan sin hash y fuera de
-- la cadena. Las inserciones de la API no cambian.
-- =====================================================================

alter table public.registro_accesos add column if not exists organizacion_id uuid references public.organizaciones (id) on delete set null;
alter table public.registro_accesos add column if not exists objeto_tipo text;
alter table public.registro_accesos add column if not exists objeto_id text;
alter table public.registro_accesos add column if not exists actor_es_staff boolean not null default false;
alter table public.registro_accesos add column if not exists hash_previo text;
alter table public.registro_accesos add column if not exists hash text;

-- Los ids de usuario quedan como dato histórico, sin clave foránea.
alter table public.registro_accesos drop constraint if exists registro_accesos_usuario_id_fkey;
alter table public.registro_accesos drop constraint if exists registro_accesos_actor_id_fkey;

create index if not exists registro_accesos_org_idx on public.registro_accesos (organizacion_id, id desc);

-- Negocio mencionado en el detalle de un registro, si todavía existe.
-- Los registros de negocios de prueba ya borrados quedan sin negocio.
create or replace function public.bitacora_org_del_detalle(detalle jsonb)
returns uuid language sql stable security definer set search_path = public as $$
  select o.id from organizaciones o
  where detalle ->> 'organizacion_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and o.id = (detalle ->> 'organizacion_id')::uuid;
$$;

-- Negocio de los registros viejos, cuando se puede saber.
update public.registro_accesos r set organizacion_id = coalesce(
  public.bitacora_org_del_detalle(r.detalle),
  (select p.organizacion_id from public.perfiles p where p.id = r.usuario_id))
where r.organizacion_id is null and r.hash is null;

-- El borrado de un negocio de prueba (0023) deja su historia sin negocio:
-- la clave pasa a set null en vez de impedir el borrado.

-- Texto que entra en el hash. Mismo armado al registrar y al verificar.
create or replace function public.bitacora_texto(r public.registro_accesos)
returns text language sql immutable as $$
  select concat_ws('|',
    coalesce(r.hash_previo, ''), r.id::text, coalesce(r.organizacion_id::text, ''),
    coalesce(r.usuario_id::text, ''), coalesce(r.actor_id::text, ''), r.actor_es_staff::text,
    r.accion, coalesce(r.objeto_tipo, ''), coalesce(r.objeto_id, ''),
    r.detalle::text, to_char(r.creado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'));
$$;

create or replace function public.bitacora_antes()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.organizacion_id is null then
    new.organizacion_id := coalesce(
      bitacora_org_del_detalle(new.detalle),
      (select p.organizacion_id from perfiles p where p.id = new.usuario_id),
      (select p.organizacion_id from perfiles p where p.id = new.actor_id and p.rol::text <> 'admin'));
  end if;
  new.actor_es_staff := exists (select 1 from perfiles p where p.id = new.actor_id and p.rol::text = 'admin');
  new.creado_en := clock_timestamp();
  -- Un eslabón por vez en cada negocio, así la cadena no se bifurca.
  perform pg_advisory_xact_lock(hashtext('bitacora:' || coalesce(new.organizacion_id::text, 'firma')));
  select r.hash into new.hash_previo from registro_accesos r
  where r.organizacion_id is not distinct from new.organizacion_id and r.hash is not null
  order by r.id desc limit 1;
  new.hash := encode(digest(bitacora_texto(new), 'sha256'), 'hex');
  return new;
end;
$$;

drop trigger if exists bitacora_antes on public.registro_accesos;
create trigger bitacora_antes before insert on public.registro_accesos
  for each row execute function public.bitacora_antes();

create or replace function public.bitacora_inmutable()
returns trigger language plpgsql as $$
begin
  -- Única excepción: el borrado de un negocio deja sus registros sin negocio.
  if tg_op = 'UPDATE' and old.organizacion_id is not null and new.organizacion_id is null
     and (to_jsonb(new) - 'organizacion_id') = (to_jsonb(old) - 'organizacion_id') then
    return new;
  end if;
  raise exception 'La bitácora no se puede modificar ni borrar.';
end;
$$;

drop trigger if exists bitacora_inmutable on public.registro_accesos;
create trigger bitacora_inmutable before update or delete on public.registro_accesos
  for each row execute function public.bitacora_inmutable();

-- Primer registro de un negocio cuya cadena no cierra, o null si está entera.
-- Un registro que quedó sin negocio por un borrado sale de la cadena de ese
-- negocio; por eso se verifica cada cadena con lo que hoy tiene.
create or replace function public.bitacora_verificar(org uuid)
returns bigint language plpgsql stable security definer set search_path = public, extensions as $$
declare
  r registro_accesos;
  previo text := null;
begin
  if not (es_admin() or (soy_titular() and org = mi_organizacion())) then
    raise exception 'Sin permiso para verificar esta bitácora.';
  end if;
  for r in select * from registro_accesos where organizacion_id is not distinct from org and hash is not null order by id loop
    if r.hash_previo is distinct from previo or r.hash <> encode(digest(bitacora_texto(r), 'sha256'), 'hex') then
      return r.id;
    end if;
    previo := r.hash;
  end loop;
  return null;
end;
$$;

revoke all on function public.bitacora_antes(), public.bitacora_inmutable(), public.bitacora_org_del_detalle(jsonb) from public, anon, authenticated;
revoke all on function public.bitacora_verificar(uuid) from public, anon;
grant execute on function public.bitacora_verificar(uuid) to authenticated;

-- El titular lee la bitácora de su negocio. FIRMA, toda.
drop policy if exists registro_lectura on public.registro_accesos;
create policy registro_lectura on public.registro_accesos
  for select to authenticated
  using (public.es_admin() or (public.soy_titular() and organizacion_id = public.mi_organizacion()));

notify pgrst, 'reload schema';

-- =====================================================================
-- FIRMA · Portal · Los usuarios de la empresa aparecen solos en Equipo
-- Cada persona con membresía activa en un negocio tiene su lugar en
-- equipo_miembros, unido a su usuario. Así se la puede asignar como
-- closer, setter o responsable sin cargarla a mano.
--   · Si ya había alguien en Equipo con su mail o su nombre, se une a ese
--     integrante (como en 0056) y no se crea otro.
--   · Si no, se crea con su nombre (o la parte del mail antes de la @ si
--     todavía no lo cargó), su mail y un rol comercial según su rol en
--     el portal: closer, setter, csm; titular queda como "otro".
--   · Al completar el nombre en su perfil, el integrante creado con el
--     nombre provisorio toma el nombre nuevo.
--   · Si se desactiva su membresía, el integrante queda inactivo (con su
--     historia); si vuelve, se reactiva.
-- Los admin de FIRMA no tienen membresías: no aparecen.
-- =====================================================================

-- Nombre provisorio para quien todavía no cargó el suyo.
create or replace function public.equipo_nombre_de(p_nombre text, p_email text)
returns text language sql immutable as $$
  select left(case
                when length(regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g')) >= 2
                  then regexp_replace(trim(p_nombre), '\s+', ' ', 'g')
                when length(split_part(coalesce(p_email, ''), '@', 1)) >= 2
                  then split_part(p_email, '@', 1)
                else coalesce(nullif(trim(p_email), ''), 'Sin nombre')
              end, 120);
$$;

-- Se asegura de que el usuario tenga su integrante en el equipo de ese negocio.
create or replace function public.equipo_asegurar_usuario(org uuid, usuario uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.perfiles;
  rol_portal text;
begin
  select * into p from public.perfiles where id = usuario;
  if p.id is null then return; end if;
  select m.rol::text into rol_portal from public.membresias m
   where m.usuario_id = usuario and m.organizacion_id = org and m.activa;
  if rol_portal is null then return; end if;

  -- Ya tiene su lugar en el equipo.
  if exists (select 1 from public.equipo_miembros where organizacion_id = org and usuario_id = usuario) then
    return;
  end if;

  -- Alguien lo esperaba en el equipo por mail o por nombre.
  update public.equipo_miembros e
     set usuario_id = usuario
   where e.id = (
     select x.id from public.equipo_miembros x
      where x.organizacion_id = org
        and x.usuario_id is null
        and (lower(x.email) = lower(p.email)
             or (x.email is null and public.equipo_usuario_de(org, null, x.nombre) = usuario))
      order by (lower(x.email) = lower(p.email)) desc nulls last, x.activo desc, x.creado_en
      limit 1);
  if found then return; end if;

  insert into public.equipo_miembros (organizacion_id, nombre, rol_comercial, email, usuario_id)
  values (org,
          public.equipo_nombre_de(p.nombre, p.email),
          case rol_portal when 'closer' then 'closer' when 'setter' then 'setter'
                          when 'csm' then 'csm' when 'miembro' then 'csm' else 'otro' end,
          p.email,
          usuario)
  on conflict do nothing;
end;
$$;

revoke all on function public.equipo_asegurar_usuario(uuid, uuid) from public, anon, authenticated;

-- Al sumarse alguien al negocio (o reactivarse su membresía) entra al equipo;
-- al desactivarse, su integrante queda inactivo.
create or replace function public.membresias_unir_equipo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.activa then
    if tg_op = 'UPDATE' and not old.activa then
      update public.equipo_miembros set activo = true
       where organizacion_id = new.organizacion_id and usuario_id = new.usuario_id and not activo;
    end if;
    perform public.equipo_asegurar_usuario(new.organizacion_id, new.usuario_id);
  elsif tg_op = 'UPDATE' and old.activa then
    update public.equipo_miembros set activo = false
     where organizacion_id = new.organizacion_id and usuario_id = new.usuario_id and activo;
  end if;
  return null;
end;
$$;

drop trigger if exists membresias_unir_equipo on public.membresias;
create trigger membresias_unir_equipo after insert or update of activa on public.membresias
  for each row execute function public.membresias_unir_equipo();

-- Al entrar al portal o cambiar su nombre o mail: se une a quien lo espera
-- (como en 0056) y su integrante creado con datos provisorios se pone al día.
create or replace function public.perfiles_unir_equipo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.equipo_miembros e
     set usuario_id = new.id
   where e.usuario_id is null
     and not exists (select 1 from public.equipo_miembros y where y.organizacion_id = e.organizacion_id and y.usuario_id = new.id)
     and exists (select 1 from public.membresias m where m.usuario_id = new.id and m.organizacion_id = e.organizacion_id and m.activa)
     and (lower(e.email) = lower(new.email)
          or (e.email is null and public.nombre_comparable(e.nombre) = public.nombre_comparable(new.nombre)
              and public.equipo_usuario_de(e.organizacion_id, null, e.nombre) = new.id));

  if tg_op = 'UPDATE' then
    update public.equipo_miembros e
       set nombre = public.equipo_nombre_de(new.nombre, new.email)
     where e.usuario_id = new.id
       and public.equipo_nombre_de(new.nombre, new.email) is distinct from e.nombre
       and e.nombre = public.equipo_nombre_de(old.nombre, old.email);
    update public.equipo_miembros e
       set email = new.email
     where e.usuario_id = new.id
       and e.email is not distinct from lower(old.email)
       and lower(new.email) is distinct from e.email
       and not exists (select 1 from public.equipo_miembros y
                        where y.organizacion_id = e.organizacion_id and lower(y.email) = lower(new.email));
  end if;
  return null;
end;
$$;

drop trigger if exists perfiles_unir_equipo on public.perfiles;
create trigger perfiles_unir_equipo after insert or update of nombre, email on public.perfiles
  for each row execute function public.perfiles_unir_equipo();

-- ---------------------------------------------------------------------
-- Los usuarios que ya están en cada negocio.
-- ---------------------------------------------------------------------
select public.equipo_asegurar_usuario(m.organizacion_id, m.usuario_id)
  from public.membresias m
 where m.activa;

notify pgrst, 'reload schema';

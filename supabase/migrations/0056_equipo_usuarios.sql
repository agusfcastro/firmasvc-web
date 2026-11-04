-- =====================================================================
-- FIRMA · Portal · Equipo unido a los usuarios del portal
-- Un integrante del equipo puede tener o no cuenta en el portal. Se une
-- solo a su usuario (equipo_miembros.usuario_id) por mail o, si no, por
-- nombre, en los dos sentidos:
--   · al cargar o editar a alguien en Equipo, si ya tiene cuenta;
--   · al entrar alguien nuevo al portal, si ya estaba en Equipo.
-- Por nombre se une solo cuando hay una única coincidencia en el negocio.
--
-- equipo_sumar: desde el alta de un cliente, cualquiera del negocio puede
-- asignar a alguien que todavía no está en Equipo. Si ya hay alguien con
-- ese nombre, se usa ese integrante.
--
-- Los clientes viejos con el responsable escrito a mano se unen al
-- integrante del equipo con el mismo nombre.
-- =====================================================================

-- Nombre comparable: minúsculas, sin tildes y con un solo espacio.
create or replace function public.nombre_comparable(texto text)
returns text language sql immutable as $$
  select nullif(regexp_replace(trim(translate(lower(coalesce(texto, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc')), '\s+', ' ', 'g'), '');
$$;

-- Usuario del portal de ese negocio que corresponde a una persona del equipo.
create or replace function public.equipo_usuario_de(org uuid, p_mail text, p_nombre text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  encontrado uuid;
  cuantos int;
begin
  if nullif(trim(p_mail), '') is not null then
    select p.id into encontrado
    from public.perfiles p
    join public.membresias m on m.usuario_id = p.id and m.organizacion_id = org and m.activa
    where lower(p.email) = lower(trim(p_mail))
    limit 1;
    if encontrado is not null then return encontrado; end if;
  end if;
  if public.nombre_comparable(p_nombre) is null then return null; end if;
  select count(*), min(p.id::text)::uuid into cuantos, encontrado
  from public.perfiles p
  join public.membresias m on m.usuario_id = p.id and m.organizacion_id = org and m.activa
  where public.nombre_comparable(p.nombre) = public.nombre_comparable(p_nombre);
  return case when cuantos = 1 then encontrado else null end;
end;
$$;

-- Al cargar o editar a alguien del equipo sin usuario, se busca su cuenta.
create or replace function public.equipo_miembros_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.usuario_id is null then
    new.usuario_id := public.equipo_usuario_de(new.organizacion_id, new.email, new.nombre);
  end if;
  return new;
end;
$$;

drop trigger if exists equipo_miembros_usuario on public.equipo_miembros;
create trigger equipo_miembros_usuario before insert or update of nombre, email, usuario_id on public.equipo_miembros
  for each row execute function public.equipo_miembros_usuario();

-- Al entrar alguien al portal (o cambiar su nombre o mail), se une a quien lo espera en el equipo.
create or replace function public.perfiles_unir_equipo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.equipo_miembros e
     set usuario_id = new.id
   where e.usuario_id is null
     and exists (select 1 from public.membresias m where m.usuario_id = new.id and m.organizacion_id = e.organizacion_id and m.activa)
     and (lower(e.email) = lower(new.email)
          or (e.email is null and public.nombre_comparable(e.nombre) = public.nombre_comparable(new.nombre)
              and public.equipo_usuario_de(e.organizacion_id, null, e.nombre) = new.id));
  return null;
end;
$$;

drop trigger if exists perfiles_unir_equipo on public.perfiles;
create trigger perfiles_unir_equipo after insert or update of nombre, email on public.perfiles
  for each row execute function public.perfiles_unir_equipo();

-- La membresía suele crearse después del perfil: también une al sumarse al negocio.
create or replace function public.membresias_unir_equipo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.perfiles;
begin
  if not new.activa then return null; end if;
  select * into p from public.perfiles where id = new.usuario_id;
  if p.id is null then return null; end if;
  update public.equipo_miembros e
     set usuario_id = p.id
   where e.usuario_id is null
     and e.organizacion_id = new.organizacion_id
     and (lower(e.email) = lower(p.email)
          or (e.email is null and public.equipo_usuario_de(e.organizacion_id, null, e.nombre) = p.id));
  return null;
end;
$$;

drop trigger if exists membresias_unir_equipo on public.membresias;
create trigger membresias_unir_equipo after insert or update of activa on public.membresias
  for each row execute function public.membresias_unir_equipo();

-- ---------------------------------------------------------------------
-- Sumar a alguien al equipo desde el alta de un cliente.
-- ---------------------------------------------------------------------
create or replace function public.equipo_sumar(org uuid, nombre text, rol text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  limpio text := regexp_replace(trim(coalesce(nombre, '')), '\s+', ' ', 'g');
  existente uuid;
  nuevo uuid;
begin
  if not (public.es_admin() or org = public.mi_organizacion()) then
    raise exception 'No tenés acceso a ese negocio.';
  end if;
  if length(limpio) < 2 or length(limpio) > 120 then
    raise exception 'Poné el nombre de la persona.';
  end if;
  if rol not in ('closer', 'setter', 'account_manager', 'csm', 'otro') then
    raise exception 'Rol inválido.';
  end if;
  select id into existente from public.equipo_miembros
   where organizacion_id = org and public.nombre_comparable(equipo_miembros.nombre) = public.nombre_comparable(limpio)
   order by activo desc, creado_en
   limit 1;
  if existente is not null then
    update public.equipo_miembros set activo = true where id = existente and not activo;
    return existente;
  end if;
  insert into public.equipo_miembros (organizacion_id, nombre, rol_comercial)
  values (org, limpio, rol)
  returning id into nuevo;
  return nuevo;
end;
$$;

revoke all on function public.equipo_sumar(uuid, text, text) from public, anon;
grant execute on function public.equipo_sumar(uuid, text, text) to authenticated;
revoke all on function public.equipo_usuario_de(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Datos que ya estaban.
-- ---------------------------------------------------------------------
-- Integrantes sin usuario que ya tienen cuenta.
update public.equipo_miembros e
   set usuario_id = public.equipo_usuario_de(e.organizacion_id, e.email, e.nombre)
 where e.usuario_id is null
   and public.equipo_usuario_de(e.organizacion_id, e.email, e.nombre) is not null;

-- Responsables escritos a mano: se unen al integrante con el mismo nombre, si hay uno solo.
update public.crm_clientes c
   set responsable_id = m.id
  from public.equipo_miembros m
 where c.responsable_id is null
   and c.responsable is not null
   and m.organizacion_id = c.organizacion_id
   and public.nombre_comparable(m.nombre) = public.nombre_comparable(c.responsable)
   and (select count(*) from public.equipo_miembros x
         where x.organizacion_id = c.organizacion_id
           and public.nombre_comparable(x.nombre) = public.nombre_comparable(c.responsable)) = 1;

notify pgrst, 'reload schema';

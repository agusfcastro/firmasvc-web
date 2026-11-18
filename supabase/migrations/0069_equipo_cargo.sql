-- =====================================================================
-- FIRMA · Portal · Rol escrito a mano para la gente del equipo
-- Quien no es closer, setter, account manager ni CSM quedaba como «Otro».
-- Ahora lleva su rol escrito (Nutricionista, Médico, Director de
-- Contenido) en equipo_miembros.cargo, y es lo que se muestra.
-- equipo_sumar acepta el cargo; los llamados con tres argumentos siguen
-- andando porque el cuarto es opcional.
-- =====================================================================

alter table public.equipo_miembros
  add column if not exists cargo text check (cargo is null or length(trim(cargo)) between 2 and 60);

drop function if exists public.equipo_sumar(uuid, text, text);

create or replace function public.equipo_sumar(org uuid, nombre text, rol text, cargo text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  limpio text := regexp_replace(trim(coalesce(nombre, '')), '\s+', ' ', 'g');
  -- El cargo vale solo para el rol «otro».
  puesto text := case when rol = 'otro' then nullif(left(regexp_replace(trim(coalesce(cargo, '')), '\s+', ' ', 'g'), 60), '') end;
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
  if puesto is not null and length(puesto) < 2 then
    raise exception 'Escribí el rol de la persona.';
  end if;
  select id into existente from public.equipo_miembros
   where organizacion_id = org and public.nombre_comparable(equipo_miembros.nombre) = public.nombre_comparable(limpio)
   order by activo desc, creado_en
   limit 1;
  if existente is not null then
    update public.equipo_miembros set activo = true where id = existente and not activo;
    -- Si ya estaba como «Otro» sin rol escrito, se le completa.
    if puesto is not null then
      update public.equipo_miembros set cargo = puesto
       where id = existente and rol_comercial = 'otro' and equipo_miembros.cargo is null;
    end if;
    return existente;
  end if;
  insert into public.equipo_miembros (organizacion_id, nombre, rol_comercial, cargo)
  values (org, limpio, rol, puesto)
  returning id into nuevo;
  return nuevo;
end;
$$;

revoke all on function public.equipo_sumar(uuid, text, text, text) from public, anon;
grant execute on function public.equipo_sumar(uuid, text, text, text) to authenticated;

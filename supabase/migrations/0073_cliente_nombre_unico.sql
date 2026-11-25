-- =====================================================================
-- FIRMA · Portal · Un nombre de cliente por empresa
-- Una empresa no puede tener dos clientes del CRM con el mismo nombre.
-- La comparación no distingue mayúsculas, tildes ni espacios de más,
-- así «Juan  Pérez» y «juan perez» cuentan como el mismo.
--
-- Se controla solo al cargar un cliente o al cambiarle el nombre, así
-- los repetidos que ya estaban cargados se siguen pudiendo editar.
-- Si son dos personas distintas con el mismo nombre, se distinguen en
-- el nombre (por ejemplo con el segundo apellido).
--
-- crm_cliente_con_nombre() deja que el alta y Tina avisen antes de
-- guardar, con el enlace a la ficha que ya existe.
-- =====================================================================

create or replace function public.crm_nombre_normalizado(nombre text)
returns text language sql immutable set search_path = public as $$
  select translate(
    lower(regexp_replace(btrim(coalesce(nombre, '')), '\s+', ' ', 'g')),
    'áàäâãéèëêíìïîóòöôõúùüû',
    'aaaaaeeeeiiiiooooouuuu'
  );
$$;

create index if not exists crm_clientes_nombre_idx
  on public.crm_clientes (organizacion_id, public.crm_nombre_normalizado(nombre));

create or replace function public.crm_cliente_nombre_unico()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  otro_codigo text;
begin
  if tg_op = 'UPDATE'
     and public.crm_nombre_normalizado(new.nombre) = public.crm_nombre_normalizado(old.nombre)
     and new.organizacion_id is not distinct from old.organizacion_id then
    return new;
  end if;
  -- Dos cargas del mismo nombre al mismo tiempo esperan una a la otra.
  perform pg_advisory_xact_lock(hashtext(new.organizacion_id::text || '|' || public.crm_nombre_normalizado(new.nombre)));
  select c.codigo into otro_codigo
  from crm_clientes c
  where c.organizacion_id = new.organizacion_id
    and c.id <> new.id
    and public.crm_nombre_normalizado(c.nombre) = public.crm_nombre_normalizado(new.nombre)
  limit 1;
  if found then
    raise exception 'Ya hay un cliente llamado «%» en esta empresa%. Si es otra persona, sumale un segundo apellido o un dato que lo distinga.',
      btrim(new.nombre), coalesce(' (' || otro_codigo || ')', '');
  end if;
  return new;
end;
$$;

drop trigger if exists crm_clientes_nombre on public.crm_clientes;
create trigger crm_clientes_nombre before insert or update of nombre, organizacion_id on public.crm_clientes
  for each row execute function public.crm_cliente_nombre_unico();

revoke all on function public.crm_cliente_nombre_unico() from public, anon, authenticated;

-- Para avisar antes de guardar. Devuelve la ficha con ese nombre, si la persona puede ver la empresa.
create or replace function public.crm_cliente_con_nombre(org uuid, buscado text)
returns table (id uuid, codigo text, nombre text)
language sql stable security definer set search_path = public as $$
  select c.id, c.codigo, c.nombre
  from crm_clientes c
  where public.puede_ver_org(org)
    and c.organizacion_id = org
    and public.crm_nombre_normalizado(c.nombre) = public.crm_nombre_normalizado(buscado)
  order by c.creado_en
  limit 1;
$$;

revoke all on function public.crm_cliente_con_nombre(uuid, text) from public, anon;
grant execute on function public.crm_cliente_con_nombre(uuid, text) to authenticated;

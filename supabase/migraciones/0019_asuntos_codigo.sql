-- =====================================================================
-- FIRMA · Portal · Código de cada asunto
-- Como el de los clientes del CRM, con A- adelante: A-<prefijo>-<número>,
-- por ejemplo A-TB-001. El prefijo es el de la empresa (prefijo_crm, CL si
-- no tiene) y el número es correlativo por empresa. Se asigna solo al crear
-- el asunto y no cambia. Los asuntos que ya existen lo reciben por orden de
-- creación.
-- Requiere la 0017. Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.asuntos add column if not exists codigo text;

-- Los asuntos existentes, numerados por empresa en el orden en que se crearon.
with numerados as (
  select a.id,
         'A-' || coalesce(nullif(trim(o.prefijo_crm), ''), 'CL') || '-'
           || lpad((row_number() over (partition by a.organizacion_id order by a.creado_en, a.id))::text, 3, '0') as nuevo
  from public.asuntos a
  join public.organizaciones o on o.id = a.organizacion_id
)
update public.asuntos a set codigo = n.nuevo
from numerados n
where n.id = a.id and a.codigo is null;

create unique index if not exists asuntos_codigo_idx on public.asuntos (organizacion_id, codigo);

-- El número sale del final del código, así un prefijo con números (F14) no lo confunde.
create or replace function public.asuntos_codigo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prefijo text;
  siguiente int;
begin
  -- Un código asignado no cambia. Solo se completa si el asunto no tenía.
  if tg_op = 'UPDATE' then
    new.codigo := coalesce(old.codigo, new.codigo);
    return new;
  end if;
  -- Dos asuntos creados a la vez para la misma empresa no se llevan el mismo número.
  perform pg_advisory_xact_lock(hashtext('asuntos_codigo_' || new.organizacion_id::text));
  select coalesce(nullif(trim(prefijo_crm), ''), 'CL') into prefijo from organizaciones where id = new.organizacion_id;
  select coalesce(max((substring(codigo from '(\d+)$'))::int), 0) + 1 into siguiente
    from asuntos where organizacion_id = new.organizacion_id;
  new.codigo := 'A-' || prefijo || '-' || lpad(siguiente::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists asuntos_codigo on public.asuntos;
create trigger asuntos_codigo before insert or update on public.asuntos
  for each row execute function public.asuntos_codigo();

notify pgrst, 'reload schema';

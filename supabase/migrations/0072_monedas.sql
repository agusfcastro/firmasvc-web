-- =====================================================================
-- FIRMA · Portal · Monedas de cada empresa
-- Cada empresa del CRM cobra en las monedas que FIRMA le habilita en
-- Administración › Clientes. La primera de la lista es la que se
-- propone al cargar un cliente. Con más de una, el alta, la ficha y
-- los servicios muestran un selector. Con una sola, no cambia nada.
--
-- Cada servicio lleva la moneda de su ticket, así el monto sugerido
-- se precarga junto con su moneda y nunca en otra.
--
-- La moneda de un cliente o de un servicio tiene que estar habilitada
-- en su empresa. Se controla solo cuando cambia, así lo que ya estaba
-- cargado se sigue pudiendo editar.
-- =====================================================================

alter table public.organizaciones add column if not exists monedas text[] not null default array['USD']::text[];
alter table public.organizaciones drop constraint if exists organizaciones_monedas_validas;
alter table public.organizaciones add constraint organizaciones_monedas_validas check (
  cardinality(monedas) between 1 and 8
  and monedas <@ array['USD', 'PEN', 'ARS', 'EUR', 'UYU', 'MXN', 'CLP', 'COP']::text[]
);

alter table public.crm_servicios add column if not exists moneda text not null default 'USD';
alter table public.crm_servicios drop constraint if exists crm_servicios_moneda_valida;
alter table public.crm_servicios add constraint crm_servicios_moneda_valida check (moneda in ('USD', 'PEN', 'ARS', 'EUR', 'UYU', 'MXN', 'CLP', 'COP'));

-- Las empresas que ya tenían clientes en otra moneda (por ejemplo cargados por Tina) la conservan habilitada.
update public.organizaciones o
set monedas = array['USD']::text[] || x.otras
from (
  select c.organizacion_id, array_agg(distinct c.moneda order by c.moneda) as otras
  from public.crm_clientes c
  where c.moneda <> 'USD' and c.moneda in ('PEN', 'ARS', 'EUR', 'UYU', 'MXN', 'CLP', 'COP')
  group by c.organizacion_id
) x
where x.organizacion_id = o.id;

create or replace function public.moneda_habilitada_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.moneda is not distinct from old.moneda and new.organizacion_id is not distinct from old.organizacion_id then
    return new;
  end if;
  if not exists (select 1 from organizaciones o where o.id = new.organizacion_id and new.moneda = any (o.monedas)) then
    raise exception 'La moneda % no está habilitada para esta empresa.', new.moneda using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists crm_clientes_moneda on public.crm_clientes;
create trigger crm_clientes_moneda before insert or update of moneda, organizacion_id on public.crm_clientes
  for each row execute function public.moneda_habilitada_antes();

drop trigger if exists crm_servicios_moneda on public.crm_servicios;
create trigger crm_servicios_moneda before insert or update of moneda, organizacion_id on public.crm_servicios
  for each row execute function public.moneda_habilitada_antes();

revoke all on function public.moneda_habilitada_antes() from public, anon, authenticated;

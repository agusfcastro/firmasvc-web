-- =====================================================================
-- FIRMA · Portal · Domicilio del cliente en el CRM
-- Se carga en el alta y en la ficha, y llega a los contratos como la
-- variable {{DOMICILIO}} y a los borradores que arma Claude.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.crm_clientes add column if not exists domicilio text;

alter table public.crm_clientes drop constraint if exists crm_clientes_domicilio_largo;
alter table public.crm_clientes add constraint crm_clientes_domicilio_largo
  check (domicilio is null or length(domicilio) <= 300);

-- La vista arma c.* al crearse, así que se vuelve a crear para que sume la columna.
drop view if exists public.crm_clientes_resumen;
create view public.crm_clientes_resumen with (security_invoker = true) as
select
  c.*,
  coalesce(sum(p.monto) filter (where p.estado = 'pagado'), 0)                                   as cobrado,
  coalesce(sum(p.monto) filter (where p.estado = 'pendiente'), 0)                                as pendiente,
  min(p.vencimiento) filter (where p.estado = 'pendiente')                                       as proximo_vencimiento,
  count(*) filter (where p.estado = 'pendiente' and p.vencimiento < current_date)               as cuotas_vencidas,
  count(*) filter (where p.estado = 'pendiente')                                                 as cuotas_pactadas,
  (select p2.monto from public.crm_pagos p2
    where p2.cliente_id = c.id and p2.estado = 'pendiente'
    order by p2.vencimiento nulls last, p2.creado_en
    limit 1)                                                                                     as proxima_cuota_monto,
  coalesce(sum(p.monto) filter (where p.estado = 'pendiente'
    and p.vencimiento >= current_date and p.vencimiento < current_date + 30), 0)                as por_cobrar_30_dias
from public.crm_clientes c
left join public.crm_pagos p on p.cliente_id = c.id
group by c.id;

revoke all on public.crm_clientes_resumen from anon;
grant select on public.crm_clientes_resumen to authenticated;

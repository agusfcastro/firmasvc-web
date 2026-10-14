-- =====================================================================
-- FIRMA · Portal · Seguimiento de cobranza opcional por empresa
-- Apagado: el plan de pagos se guarda como condición contractual
-- (anticipo y cuotas pactadas) sin seguimiento de cobro.
-- Encendido: se marca cada cuota como pagada y hay alertas de vencidas.
-- =====================================================================
alter table public.organizaciones add column if not exists seguimiento_cobranza boolean not null default false;

create or replace view public.crm_clientes_resumen with (security_invoker = true) as
select
  c.*,
  coalesce(sum(p.monto) filter (where p.estado = 'pagado'), 0)                                   as cobrado,
  coalesce(sum(p.monto) filter (where p.estado = 'pendiente'), 0)                                as pendiente,
  min(p.vencimiento) filter (where p.estado = 'pendiente')                                       as proximo_vencimiento,
  count(*) filter (where p.estado = 'pendiente' and p.vencimiento < current_date)               as cuotas_vencidas,
  count(*) filter (where p.estado = 'pendiente')                                                 as cuotas_pactadas
from public.crm_clientes c
left join public.crm_pagos p on p.cliente_id = c.id
group by c.id;

revoke all on public.crm_clientes_resumen from anon;
grant select on public.crm_clientes_resumen to authenticated;

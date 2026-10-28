-- =====================================================================
-- FIRMA · Portal · Clientes que son empresas en el CRM
-- tipo dice si contrata una persona o una empresa, de cualquier país.
-- En una empresa, nombre es la razón social, domicilio el de la empresa,
-- id_fiscal el CUIT, EIN, RUT o el que corresponda (con su tipo escrito),
-- y representante, cargo, dni, email y telefono son de quien firma por ella.
-- Llegan a los contratos como {{RAZON_SOCIAL_CLIENTE}}, {{ID_FISCAL_CLIENTE}},
-- {{CARGO}} y {{CLIENTE}}.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.crm_clientes add column if not exists tipo text not null default 'persona';
alter table public.crm_clientes add column if not exists id_fiscal text;
alter table public.crm_clientes add column if not exists representante text;
alter table public.crm_clientes add column if not exists cargo text;

alter table public.crm_clientes drop constraint if exists crm_clientes_tipo;
alter table public.crm_clientes add constraint crm_clientes_tipo check (tipo in ('persona', 'empresa'));
alter table public.crm_clientes drop constraint if exists crm_clientes_empresa_largos;
alter table public.crm_clientes add constraint crm_clientes_empresa_largos check (
  (id_fiscal is null or length(id_fiscal) <= 60)
  and (representante is null or length(representante) <= 160)
  and (cargo is null or length(cargo) <= 120)
);

-- La vista arma c.* al crearse, así que se vuelve a crear para que sume las columnas.
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

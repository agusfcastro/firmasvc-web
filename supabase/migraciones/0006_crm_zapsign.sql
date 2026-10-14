-- =====================================================================
-- FIRMA · Portal · CRM con contratos en ZapSign y nuevas métricas
-- 1. Cada empresa conecta su organización de ZapSign con su token, que
--    queda en una tabla que solo lee el servidor.
-- 2. Cada servicio, o la empresa por defecto, apunta a un modelo DOCX.
-- 3. Al dar de alta un cliente se genera el contrato y se guarda el link
--    de firma. Cuando firma, ZapSign avisa y el estado pasa a Firmado.
-- 4. El resumen suma la próxima cuota y lo que vence en los próximos
--    30 días.
-- Se ejecuta una sola vez en Supabase › SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Modelos de contrato
-- ---------------------------------------------------------------------
alter table public.organizaciones add column if not exists zapsign_modelo text;
alter table public.organizaciones add column if not exists zapsign_conectado boolean not null default false;
alter table public.crm_servicios add column if not exists zapsign_modelo text;

-- ---------------------------------------------------------------------
-- Contrato de cada cliente final
-- ---------------------------------------------------------------------
alter table public.crm_clientes add column if not exists firma_url text;
alter table public.crm_clientes add column if not exists zapsign_doc text;
alter table public.crm_clientes add column if not exists contrato_estado text;
alter table public.crm_clientes add column if not exists contrato_error text;
alter table public.crm_clientes add column if not exists contrato_generado_en timestamptz;

do $$ begin
  alter table public.crm_clientes add constraint crm_clientes_contrato_estado_check
    check (contrato_estado is null or contrato_estado in ('listo', 'error', 'sin_cuenta', 'sin_modelo'));
exception when duplicate_object then null; end $$;

create unique index if not exists crm_clientes_zapsign_doc_idx on public.crm_clientes (zapsign_doc) where zapsign_doc is not null;

-- ---------------------------------------------------------------------
-- Token de ZapSign de cada empresa. Sin políticas, solo lo usa el
-- servidor con la clave service role.
-- ---------------------------------------------------------------------
create table if not exists public.zapsign_cuentas (
  organizacion_id     uuid primary key references public.organizaciones (id) on delete cascade,
  api_token           text not null check (length(trim(api_token)) > 0),
  sandbox             boolean not null default false,
  webhook_registrado  boolean not null default false,
  actualizado_en      timestamptz not null default now()
);

alter table public.zapsign_cuentas enable row level security;
revoke all on public.zapsign_cuentas from anon, authenticated;

-- ---------------------------------------------------------------------
-- Los datos del contrato los escribe solo el servidor o FIRMA.
-- Misma función que en 0002, con los campos nuevos protegidos.
-- ---------------------------------------------------------------------
create or replace function public.crm_clientes_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prefijo text;
  siguiente int;
begin
  if tg_op = 'INSERT' then
    if new.codigo is null or trim(new.codigo) = '' then
      select coalesce(nullif(trim(prefijo_crm), ''), 'CL') into prefijo from organizaciones where id = new.organizacion_id;
      select coalesce(max(nullif(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0) + 1 into siguiente
        from crm_clientes where organizacion_id = new.organizacion_id;
      new.codigo := prefijo || '-' || lpad(siguiente::text, 3, '0');
    end if;
    if auth.uid() is not null then
      new.creado_por := auth.uid();
      if not es_admin() then
        new.estado_firma := 'Pendiente';
        new.link_contrato_servicio := null;
        new.revisar_pagos := false;
        new.firma_url := null;
        new.zapsign_doc := null;
        new.contrato_estado := null;
        new.contrato_error := null;
        new.contrato_generado_en := null;
      end if;
    end if;
  else
    if auth.uid() is not null and not es_admin() then
      if new.estado_firma is distinct from old.estado_firma
         or new.link_contrato_servicio is distinct from old.link_contrato_servicio
         or new.organizacion_id is distinct from old.organizacion_id
         or new.codigo is distinct from old.codigo
         or new.firma_url is distinct from old.firma_url
         or new.zapsign_doc is distinct from old.zapsign_doc
         or new.contrato_estado is distinct from old.contrato_estado
         or new.contrato_error is distinct from old.contrato_error
         or new.contrato_generado_en is distinct from old.contrato_generado_en then
        raise exception 'El estado de la firma y los contratos solo los modifica FIRMA.';
      end if;
    end if;
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Resumen por cliente con la próxima cuota y lo que vence en 30 días.
-- Se recrea porque cambian las columnas de crm_clientes.
-- ---------------------------------------------------------------------
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

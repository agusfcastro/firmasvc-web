-- =====================================================================
-- FIRMA · Portal · Abonos con la oferta de noviembre de 2026
--
-- La oferta tiene dos planes (Starter y Eminent) y dos modalidades.
--   cuotas         Tres débitos mensuales del monto inicial y después el
--                  monto posterior, sin que el cliente vuelva a suscribirse.
--                  El portal cambia el monto del plan en dLocal Go cuando se
--                  aprueba la última cuota inicial.
--   pago_completo  Un solo pago del monto inicial que cubre meses_cubiertos
--                  meses (tres más el cuarto sin cargo). Después, el monto
--                  posterior por mes, congelado congela_meses meses.
-- etapa dice qué monto se cobra ahora: inicial o posterior.
--
-- Precio fundador. Solo con pago completo, para las primeras 5 empresas o
-- hasta el 31/12/2026, lo que pase primero. La base lo controla al guardar.
--
-- Pesos al dólar MEP (al_mep). Los montos de la oferta quedan en dólares
-- (monto_inicial, monto_posterior y monto_usd) y monto es su equivalente en
-- pesos con la cotización MEP de cotizacion_mep. El portal la actualiza antes
-- de cada cobro.
--
-- Los abonos de antes no cambian: sin modalidad, un solo monto como siempre.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.abonos add column if not exists plan_servicio    text;
alter table public.abonos add column if not exists modalidad        text;
alter table public.abonos add column if not exists etapa            text;
alter table public.abonos add column if not exists cuotas_iniciales smallint;
alter table public.abonos add column if not exists monto_inicial    numeric(12,2);
alter table public.abonos add column if not exists monto_posterior  numeric(12,2);
alter table public.abonos add column if not exists meses_cubiertos  smallint;
alter table public.abonos add column if not exists congela_meses    smallint;
alter table public.abonos add column if not exists congelado_hasta  date;
alter table public.abonos add column if not exists precio_fundador  boolean not null default false;
alter table public.abonos add column if not exists al_mep           boolean not null default false;
alter table public.abonos add column if not exists monto_usd        numeric(12,2);
alter table public.abonos add column if not exists cotizacion_mep   numeric(12,2);
alter table public.abonos add column if not exists cotizado_en      timestamptz;

alter table public.abonos drop constraint if exists abonos_plan_servicio;
alter table public.abonos add constraint abonos_plan_servicio check (plan_servicio is null or plan_servicio in ('starter', 'eminent'));

alter table public.abonos drop constraint if exists abonos_modalidad;
alter table public.abonos add constraint abonos_modalidad check (coalesce(
  case modalidad
    when 'cuotas' then
      etapa in ('inicial', 'posterior')
      and cuotas_iniciales between 1 and 12
      and monto_inicial > 0 and monto_posterior > 0
      and periodo_meses = 1
    when 'pago_completo' then
      etapa in ('inicial', 'posterior')
      and meses_cubiertos between 1 and 12
      and monto_inicial > 0 and monto_posterior > 0
      and periodo_meses = 1
    else
      modalidad is null and etapa is null
  end, false)
);

alter table public.abonos drop constraint if exists abonos_congela;
alter table public.abonos add constraint abonos_congela check (congela_meses is null or congela_meses between 1 and 36);

alter table public.abonos drop constraint if exists abonos_fundador;
alter table public.abonos add constraint abonos_fundador check (not precio_fundador or coalesce(modalidad = 'pago_completo', false));

-- En pesos al MEP: monto es pesos y monto_usd la referencia en dólares.
alter table public.abonos drop constraint if exists abonos_al_mep;
alter table public.abonos add constraint abonos_al_mep check (not al_mep or coalesce(moneda = 'ARS' and monto_usd > 0 and cotizacion_mep > 0, false));

-- ---------------------------------------------------------------------
-- Precio fundador: 5 empresas como máximo y hasta el 31/12/2026.
-- Cuenta las empresas con un abono fundador que no se dio de baja sin pagar.
-- ---------------------------------------------------------------------
create or replace function public.abonos_fundador_cupo(excluir_org uuid default null)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct a.organizacion_id)::int
  from abonos a
  where a.precio_fundador
    and (excluir_org is null or a.organizacion_id <> excluir_org)
    and (a.estado <> 'cancelado'
         or exists (select 1 from abono_pagos p where p.abono_id = a.id and p.estado = 'aprobado'));
$$;

create or replace function public.abonos_fundador_control()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.precio_fundador and (tg_op = 'INSERT' or not old.precio_fundador) then
    if (now() at time zone 'America/Argentina/Buenos_Aires')::date > date '2026-12-31' then
      raise exception 'El precio fundador terminó el 31/12/2026.' using errcode = 'check_violation';
    end if;
    if public.abonos_fundador_cupo(new.organizacion_id) >= 5 then
      raise exception 'Ya hay 5 empresas con precio fundador.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists abonos_fundador on public.abonos;
create trigger abonos_fundador before insert or update of precio_fundador, organizacion_id on public.abonos
  for each row execute function public.abonos_fundador_control();

grant execute on function public.abonos_fundador_cupo(uuid) to authenticated;

-- FIRMA arma el borrador con el esquema. Después lo cambia solo el servidor.
grant insert (plan_servicio, modalidad, etapa, cuotas_iniciales, monto_inicial, monto_posterior, meses_cubiertos,
              congela_meses, precio_fundador, al_mep, monto_usd, cotizacion_mep, cotizado_en)
  on public.abonos to authenticated;
grant update (plan_servicio, modalidad, etapa, cuotas_iniciales, monto_inicial, monto_posterior, meses_cubiertos,
              congela_meses, precio_fundador, al_mep, monto_usd, cotizacion_mep, cotizado_en)
  on public.abonos to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIRMA · Portal · Plan Starter
-- Los planes de servicio pasan a ser dos, Starter y Eminent. Gold y Black
-- se retiran: no hay clientes en ellos y, si quedara alguno, pasa a
-- Eminent, como hizo la 0054 con los que no tenían plan.
--   Starter   60 minutos de agenda por semana (la hora semanal de
--             consultoría general), de lunes a domingo, y 20 documentos
--             firmados por mes calendario.
--   Eminent   sin límites, como hasta ahora.
-- Las fechas siguen siendo de Buenos Aires.
-- =====================================================================

update public.organizaciones set plan = 'eminent' where plan in ('gold', 'black');

alter table public.organizaciones drop constraint if exists organizaciones_plan;
alter table public.organizaciones add constraint organizaciones_plan check (plan in ('starter', 'eminent'));

-- Matriz de funcionalidades por plan de servicio (0052).
delete from public.planes_servicio_funcionalidades where plan not in ('starter', 'eminent');
alter table public.planes_servicio_funcionalidades drop constraint if exists planes_servicio_funcionalidades_plan_check;
alter table public.planes_servicio_funcionalidades add constraint planes_servicio_funcionalidades_plan_check
  check (plan in ('starter', 'eminent'));

-- ---------------------------------------------------------------------
-- Agenda: Starter cuenta por semana. Eminent, sin período.
-- ---------------------------------------------------------------------
create or replace function public.agenda_periodo(p text)
returns table (desde date, hasta date) language sql stable as $$
  select d, d + 7
  from (select date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date as d) x
  where p = 'starter';
$$;

create or replace function public.agenda_uso(org uuid)
returns table (plan text, incluido_min int, usado_min int, desde date, hasta date)
language sql stable security definer set search_path = public as $$
  select o.plan,
         case when o.plan = 'starter' then 60 end,
         coalesce((select sum(c.minutos)::int from agenda_consumos c
                   where c.organizacion_id = o.id and c.fecha >= p.desde and c.fecha < p.hasta), 0),
         p.desde, p.hasta
  from organizaciones o
  left join lateral public.agenda_periodo(o.plan) p on true
  where o.id = org and (public.es_admin() or org = public.mi_organizacion() or auth.role() = 'service_role');
$$;

-- ---------------------------------------------------------------------
-- Firmas: igual que en 0055, con el cupo de Starter.
-- ---------------------------------------------------------------------
create or replace function public.firmas_uso(org uuid)
returns table (plan text, limite int, usados int, en_curso int, desde date, hasta date)
language sql stable security definer set search_path = public as $$
  select o.plan,
         case o.plan when 'starter' then 20 end,
         (select count(*)::int from firma_sobres s
          where s.organizacion_id = o.id and s.emisor = 'cliente' and s.estado = 'completado' and s.entrega <> 'portal'
            and (s.completado_en at time zone 'America/Argentina/Buenos_Aires')::date >= m.desde
            and (s.completado_en at time zone 'America/Argentina/Buenos_Aires')::date < m.hasta),
         (select count(*)::int from firma_sobres s
          where s.organizacion_id = o.id and s.emisor = 'cliente' and s.estado = 'en_curso' and s.entrega <> 'portal'),
         m.desde, m.hasta
  from organizaciones o
  cross join lateral (
    select date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date as desde,
           (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') + interval '1 month')::date as hasta
  ) m
  where o.id = org and (public.es_admin() or org = public.mi_organizacion() or auth.role() = 'service_role');
$$;

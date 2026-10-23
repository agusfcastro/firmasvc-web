-- =====================================================================
-- FIRMA · Portal · Plan de cada empresa, tiempo de agenda y firmas
-- 1. organizaciones.plan: gold, black o eminent. Vacío es un acuerdo a
--    medida, sin límites en el portal.
-- 2. Agenda. Gold incluye 60 minutos por mes calendario y Black 60 minutos
--    por semana (de lunes a domingo). FIRMA carga a mano el tiempo de cada
--    reunión en agenda_consumos. Con el tiempo agotado la empresa deja de
--    ver los enlaces de reserva hasta que se renueva el período. Una
--    reunión puede pasarse del saldo: el exceso se muestra, no se cobra.
-- 3. Firma electrónica. Gold 20 y Black 50 documentos firmados por mes
--    calendario. Cuentan los envíos de la empresa que terminaron firmados
--    (incluidos los contratos del CRM). Los de FIRMA no cuentan. Al llegar
--    al límite la empresa no puede crear envíos nuevos.
-- Eminent no tiene límites. Las fechas son de Buenos Aires.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.organizaciones add column if not exists plan text;
alter table public.organizaciones drop constraint if exists organizaciones_plan;
alter table public.organizaciones add constraint organizaciones_plan check (plan is null or plan in ('gold', 'black', 'eminent'));

-- ---------------------------------------------------------------------
-- Tiempo usado de agenda
-- ---------------------------------------------------------------------
create table if not exists public.agenda_consumos (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  fecha            date not null default ((now() at time zone 'America/Argentina/Buenos_Aires')::date),
  minutos          int not null check (minutos between 1 and 600),
  nota             text check (nota is null or length(nota) <= 300),
  cargado_por      uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now()
);

create index if not exists agenda_consumos_org_idx on public.agenda_consumos (organizacion_id, fecha desc);

alter table public.agenda_consumos enable row level security;

drop policy if exists agenda_consumos_lectura on public.agenda_consumos;
create policy agenda_consumos_lectura on public.agenda_consumos for select to authenticated
  using (public.es_admin() or organizacion_id = public.mi_organizacion());
drop policy if exists agenda_consumos_gestion on public.agenda_consumos;
create policy agenda_consumos_gestion on public.agenda_consumos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

revoke all on public.agenda_consumos from anon, authenticated;
grant select, insert, delete on public.agenda_consumos to authenticated;
grant select, insert, update, delete on public.agenda_consumos to service_role;

-- Período vigente de la agenda según el plan. Sin plan o con Eminent, sin período.
create or replace function public.agenda_periodo(p text)
returns table (desde date, hasta date) language sql stable as $$
  select d, case p when 'gold' then (d + interval '1 month')::date else d + 7 end
  from (
    select case p
      when 'gold'  then date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date
      when 'black' then date_trunc('week',  now() at time zone 'America/Argentina/Buenos_Aires')::date
    end as d
  ) x
  where p in ('gold', 'black');
$$;

-- Uso de la agenda en el período vigente. Solo para FIRMA o la propia empresa.
create or replace function public.agenda_uso(org uuid)
returns table (plan text, incluido_min int, usado_min int, desde date, hasta date)
language sql stable security definer set search_path = public as $$
  select o.plan,
         case when o.plan in ('gold', 'black') then 60 end,
         coalesce((select sum(c.minutos)::int from agenda_consumos c
                   where c.organizacion_id = o.id and c.fecha >= p.desde and c.fecha < p.hasta), 0),
         p.desde, p.hasta
  from organizaciones o
  left join lateral public.agenda_periodo(o.plan) p on true
  where o.id = org and (public.es_admin() or org = public.mi_organizacion() or auth.role() = 'service_role');
$$;

create or replace function public.agenda_bloqueada(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select u.incluido_min is not null and u.usado_min >= u.incluido_min from public.agenda_uso(org) u), false);
$$;

-- Con el tiempo agotado la empresa deja de ver los enlaces de reserva.
drop policy if exists agendas_lectura on public.agendas;
create policy agendas_lectura on public.agendas for select to authenticated
  using (
    public.es_admin()
    or (activa
        and (organizacion_id is null or organizacion_id = public.mi_organizacion())
        and not public.agenda_bloqueada(public.mi_organizacion()))
  );

-- ---------------------------------------------------------------------
-- Firmas del mes
-- ---------------------------------------------------------------------
create or replace function public.firmas_uso(org uuid)
returns table (plan text, limite int, usados int, desde date, hasta date)
language sql stable security definer set search_path = public as $$
  select o.plan,
         case o.plan when 'gold' then 20 when 'black' then 50 end,
         (select count(*)::int from firma_sobres s
          where s.organizacion_id = o.id and s.emisor = 'cliente' and s.estado = 'completado'
            and (s.completado_en at time zone 'America/Argentina/Buenos_Aires')::date >= m.desde
            and (s.completado_en at time zone 'America/Argentina/Buenos_Aires')::date < m.hasta),
         m.desde, m.hasta
  from organizaciones o
  cross join lateral (
    select date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date as desde,
           (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') + interval '1 month')::date as hasta
  ) m
  where o.id = org and (public.es_admin() or org = public.mi_organizacion() or auth.role() = 'service_role');
$$;

revoke all on function public.agenda_uso(uuid), public.agenda_bloqueada(uuid), public.firmas_uso(uuid) from anon;
grant execute on function public.agenda_uso(uuid), public.agenda_bloqueada(uuid), public.firmas_uso(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

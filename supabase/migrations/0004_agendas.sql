-- =====================================================================
-- FIRMA · Portal · Agendas para reservar reuniones
-- Cada agenda es un enlace de reserva (Notion Calendar, Calendly...).
-- Sin organización, la ven todos los clientes. Con organización, solo esa.
-- =====================================================================
create table if not exists public.agendas (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid references public.organizaciones (id) on delete cascade,
  titulo           text not null check (length(trim(titulo)) > 0),
  descripcion      text,
  duracion_min     int check (duracion_min is null or duracion_min between 5 and 480),
  url              text not null check (url ~ '^https://'),
  orden            int not null default 0,
  activa           boolean not null default true,
  creado_en        timestamptz not null default now()
);

alter table public.agendas enable row level security;

drop policy if exists agendas_lectura on public.agendas;
create policy agendas_lectura on public.agendas for select to authenticated
  using (public.es_admin() or (activa and (organizacion_id is null or organizacion_id = public.mi_organizacion())));

drop policy if exists agendas_gestion on public.agendas;
create policy agendas_gestion on public.agendas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

revoke all on public.agendas from anon;
grant select, insert, update, delete on public.agendas to authenticated;

insert into public.agendas (titulo, descripcion, duracion_min, url, orden)
select 'Reunión con FIRMA', 'Consultas legales, revisión de contratos o dudas de tu equipo, por videollamada.', 30,
       'https://calendar.notion.so/meet/agustin-uy2ou10ee/we5s84zcw', 1
where not exists (select 1 from public.agendas);

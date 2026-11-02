-- =====================================================================
-- FIRMA · Portal · Planes de producto y funcionalidades
-- organizaciones.plan (gold, black, eminent) sigue siendo el plan de
-- servicio legal: agenda y cupo de firmas. plan_producto es el plan del
-- CRM con capa de riesgo: radar, escudo o blindaje. Conviven; vacío es
-- un negocio sin las funcionalidades nuevas.
-- Las funcionalidades de hoy (CRM, contratos, firma, asuntos, pagos) no
-- dependen del plan de producto. Solo se habilitan por plan las nuevas.
-- planes_funcionalidades es la matriz de cada plan; org_funcionalidades,
-- las excepciones de un negocio (una prueba, un cupo distinto).
-- tiene_funcionalidad() y limite_funcionalidad() son la única forma de
-- consultarlo: las usan las políticas, la API y el portal.
-- =====================================================================

alter table public.organizaciones add column if not exists plan_producto text;
alter table public.organizaciones drop constraint if exists organizaciones_plan_producto;
alter table public.organizaciones add constraint organizaciones_plan_producto
  check (plan_producto is null or plan_producto in ('radar', 'escudo', 'blindaje'));

create table if not exists public.funcionalidades (
  clave        text primary key check (clave ~ '^[a-z][a-z0-9_]{1,39}$'),
  nombre       text not null,
  descripcion  text
);

insert into public.funcionalidades (clave, nombre, descripcion) values
  ('obligaciones',          'Mapa de obligaciones',      'Obligaciones, hitos y entregables de cada contrato'),
  ('desenlaces',            'Registro de desenlaces',    'Reembolsos, contracargos, reclamos, cartas documento, demandas y exposición en redes'),
  ('alertas',               'Alertas con acción',        'Alertas en el portal y por mail, con acción correctiva obligatoria'),
  ('fathom',                'Llamadas de Fathom',        'Webhook de Fathom por negocio'),
  ('analisis_llamadas',     'Análisis de llamadas',      'Hallazgos con cita y minuto. Límite: llamadas por mes'),
  ('puntaje_riesgo',        'Puntaje de riesgo',         'Puntaje por reglas, explicado señal por señal'),
  ('alertas_automaticas',   'Alertas automáticas',       'Alertas que dispara el puntaje o un hallazgo'),
  ('perfiles_conductuales', 'Perfiles conductuales',     'Arquetipos por señales observables, con decisión humana'),
  ('whatsapp',              'WhatsApp',                  'Mensajes y audios vía Cloud API'),
  ('retencion_configurable','Retención configurable',    'Plazos de conservación propios del negocio'),
  ('revision_legal',        'Revisión legal de FIRMA',   'FIRMA revisa las alertas altas')
on conflict (clave) do update set nombre = excluded.nombre, descripcion = excluded.descripcion;

create table if not exists public.planes_funcionalidades (
  plan           text not null check (plan in ('radar', 'escudo', 'blindaje')),
  funcionalidad  text not null references public.funcionalidades (clave) on delete cascade,
  limites        jsonb not null default '{}'::jsonb,
  primary key (plan, funcionalidad)
);

-- Matriz inicial propuesta. Se ajusta con un insert o un delete acá.
insert into public.planes_funcionalidades (plan, funcionalidad, limites) values
  ('radar',    'obligaciones',          '{}'),
  ('radar',    'desenlaces',            '{}'),
  ('radar',    'alertas',               '{}'),
  ('radar',    'fathom',                '{}'),
  ('radar',    'analisis_llamadas',     '{"llamadas_mes": 30}'),
  ('escudo',   'obligaciones',          '{}'),
  ('escudo',   'desenlaces',            '{}'),
  ('escudo',   'alertas',               '{}'),
  ('escudo',   'fathom',                '{}'),
  ('escudo',   'analisis_llamadas',     '{"llamadas_mes": 300}'),
  ('escudo',   'puntaje_riesgo',        '{}'),
  ('escudo',   'alertas_automaticas',   '{}'),
  ('escudo',   'retencion_configurable','{}'),
  ('blindaje', 'obligaciones',          '{}'),
  ('blindaje', 'desenlaces',            '{}'),
  ('blindaje', 'alertas',               '{}'),
  ('blindaje', 'fathom',                '{}'),
  ('blindaje', 'analisis_llamadas',     '{}'),
  ('blindaje', 'puntaje_riesgo',        '{}'),
  ('blindaje', 'alertas_automaticas',   '{}'),
  ('blindaje', 'perfiles_conductuales', '{}'),
  ('blindaje', 'whatsapp',              '{}'),
  ('blindaje', 'retencion_configurable','{}'),
  ('blindaje', 'revision_legal',        '{}')
on conflict (plan, funcionalidad) do nothing;

create table if not exists public.org_funcionalidades (
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  funcionalidad    text not null references public.funcionalidades (clave) on delete cascade,
  habilitada       boolean not null,
  limites          jsonb,
  vence_en         timestamptz,
  nota             text,
  creado_por       uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now(),
  primary key (organizacion_id, funcionalidad)
);

-- ---------------------------------------------------------------------
-- Consultas. Una excepción vigente manda sobre el plan.
-- ---------------------------------------------------------------------
create or replace function public.tiene_funcionalidad(org uuid, clave text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select f.habilitada from org_funcionalidades f
     where f.organizacion_id = org and f.funcionalidad = clave and (f.vence_en is null or f.vence_en > now())),
    exists (select 1 from organizaciones o join planes_funcionalidades p on p.plan = o.plan_producto
            where o.id = org and p.funcionalidad = clave)
  );
$$;

-- Límites de la funcionalidad, {} si no tiene, null si no está habilitada.
create or replace function public.limite_funcionalidad(org uuid, clave text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.tiene_funcionalidad(org, clave) then null else coalesce(
    (select f.limites from org_funcionalidades f
     where f.organizacion_id = org and f.funcionalidad = clave and f.habilitada and f.limites is not null
       and (f.vence_en is null or f.vence_en > now())),
    (select p.limites from organizaciones o join planes_funcionalidades p on p.plan = o.plan_producto
     where o.id = org and p.funcionalidad = clave),
    '{}'::jsonb) end;
$$;

revoke all on function public.tiene_funcionalidad(uuid, text), public.limite_funcionalidad(uuid, text) from public, anon;
grant execute on function public.tiene_funcionalidad(uuid, text), public.limite_funcionalidad(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Seguridad. El catálogo y la matriz son públicos para los usuarios; las
-- excepciones las ve el negocio y las carga FIRMA.
-- ---------------------------------------------------------------------
alter table public.funcionalidades enable row level security;
alter table public.planes_funcionalidades enable row level security;
alter table public.org_funcionalidades enable row level security;

drop policy if exists funcionalidades_lectura on public.funcionalidades;
create policy funcionalidades_lectura on public.funcionalidades for select to authenticated using (true);
drop policy if exists planes_func_lectura on public.planes_funcionalidades;
create policy planes_func_lectura on public.planes_funcionalidades for select to authenticated using (true);

drop policy if exists org_func_lectura on public.org_funcionalidades;
create policy org_func_lectura on public.org_funcionalidades for select to authenticated
  using (public.es_admin() or organizacion_id = public.mi_organizacion());
drop policy if exists org_func_admin on public.org_funcionalidades;
create policy org_func_admin on public.org_funcionalidades for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

revoke all on public.funcionalidades, public.planes_funcionalidades, public.org_funcionalidades from anon;
revoke insert, update, delete on public.funcionalidades, public.planes_funcionalidades from authenticated;
grant select on public.funcionalidades, public.planes_funcionalidades to authenticated;
grant select, insert, update, delete on public.org_funcionalidades to authenticated;

notify pgrst, 'reload schema';

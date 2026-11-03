-- =====================================================================
-- FIRMA · Portal · Funcionalidades incluidas en los planes de servicio
-- Hasta acá solo el plan de producto (radar, escudo, blindaje) habilitaba
-- funcionalidades. Ahora el plan de servicio (gold, black, eminent) también
-- puede incluirlas: Eminent trae las llamadas de Fathom.
-- planes_servicio_funcionalidades es esa matriz. tiene_funcionalidad()
-- suma el plan de servicio al de producto; una excepción vigente de
-- org_funcionalidades sigue mandando sobre los dos.
-- Límites: manda la excepción, después el plan de producto y después el de
-- servicio.
-- =====================================================================

create table if not exists public.planes_servicio_funcionalidades (
  plan           text not null check (plan in ('gold', 'black', 'eminent')),
  funcionalidad  text not null references public.funcionalidades (clave) on delete cascade,
  limites        jsonb not null default '{}'::jsonb,
  primary key (plan, funcionalidad)
);

insert into public.planes_servicio_funcionalidades (plan, funcionalidad, limites) values
  ('eminent', 'fathom', '{}')
on conflict (plan, funcionalidad) do nothing;

create or replace function public.tiene_funcionalidad(org uuid, clave text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select f.habilitada from org_funcionalidades f
     where f.organizacion_id = org and f.funcionalidad = clave and (f.vence_en is null or f.vence_en > now())),
    exists (select 1 from organizaciones o join planes_funcionalidades p on p.plan = o.plan_producto
            where o.id = org and p.funcionalidad = clave)
    or exists (select 1 from organizaciones o join planes_servicio_funcionalidades s on s.plan = o.plan
               where o.id = org and s.funcionalidad = clave)
  );
$$;

create or replace function public.limite_funcionalidad(org uuid, clave text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.tiene_funcionalidad(org, clave) then null else coalesce(
    (select f.limites from org_funcionalidades f
     where f.organizacion_id = org and f.funcionalidad = clave and f.habilitada and f.limites is not null
       and (f.vence_en is null or f.vence_en > now())),
    (select p.limites from organizaciones o join planes_funcionalidades p on p.plan = o.plan_producto
     where o.id = org and p.funcionalidad = clave),
    (select s.limites from organizaciones o join planes_servicio_funcionalidades s on s.plan = o.plan
     where o.id = org and s.funcionalidad = clave),
    '{}'::jsonb) end;
$$;

alter table public.planes_servicio_funcionalidades enable row level security;
drop policy if exists planes_servicio_func_lectura on public.planes_servicio_funcionalidades;
create policy planes_servicio_func_lectura on public.planes_servicio_funcionalidades for select to authenticated using (true);
revoke all on public.planes_servicio_funcionalidades from anon;
revoke insert, update, delete on public.planes_servicio_funcionalidades from authenticated;
grant select on public.planes_servicio_funcionalidades to authenticated;

notify pgrst, 'reload schema';

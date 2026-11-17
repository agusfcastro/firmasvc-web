-- =====================================================================
-- 0066 · Centro de avisos del portal y limpieza de restos sin uso
--
--   avisos              Historial de avisos de cada persona. Cada aviso
--                       push que manda el servidor (api/_lib/push.ts) queda
--                       también acá, así no se pierde si el push no llega
--                       o la persona no activó los avisos en el dispositivo.
--                       El portal los muestra en la campana.
--
-- Escribe solo el servidor (clave de servicio). Cada persona lee los suyos
-- y lo único que puede cambiar es marcarlos como leídos.
--
-- Limpieza:
--   rol miembro         Las cuentas que quedaban con el rol viejo pasan a
--                       csm, que tiene los mismos permisos.
--   zapsign_cuentas     Tabla del flujo de ZapSign, retirado. Guardaba
--                       credenciales de un servicio que ya no se usa.
--   crm_borradores      Tabla de borradores de contratos, retirada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------------
create table if not exists public.avisos (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  titulo      text not null check (length(trim(titulo)) between 1 and 200),
  cuerpo      text not null default '' check (length(cuerpo) <= 500),
  -- Ruta del portal que se abre al tocarlo.
  url         text not null default '/portal' check (url ~ '^/portal(/|\?|$)'),
  etiqueta    text,
  creado_en   timestamptz not null default now(),
  leido_en    timestamptz
);
create index if not exists avisos_usuario on public.avisos (usuario_id, creado_en desc);
create index if not exists avisos_sin_leer on public.avisos (usuario_id) where leido_en is null;

alter table public.avisos enable row level security;

drop policy if exists avisos_lectura on public.avisos;
create policy avisos_lectura on public.avisos for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists avisos_marcar on public.avisos;
create policy avisos_marcar on public.avisos for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

revoke all on public.avisos from anon, authenticated;
grant select on public.avisos to authenticated;
-- Lo único que cambia una persona es si lo leyó.
grant update (leido_en) on public.avisos to authenticated;
grant all on public.avisos to service_role;

-- Se guardan 90 días. Lo llama el servidor cada vez que anota avisos nuevos.
create or replace function public.avisos_limpiar()
returns void language sql security definer set search_path = public as $$
  delete from avisos where creado_en < now() - interval '90 days';
$$;
revoke all on function public.avisos_limpiar() from public, anon, authenticated;
grant execute on function public.avisos_limpiar() to service_role;

-- ---------------------------------------------------------------------
-- Limpieza de restos sin uso
-- ---------------------------------------------------------------------
update public.perfiles set rol = 'csm' where rol = 'miembro';
update public.membresias set rol = 'csm' where rol = 'miembro';

drop table if exists public.zapsign_cuentas;
drop table if exists public.crm_borradores;

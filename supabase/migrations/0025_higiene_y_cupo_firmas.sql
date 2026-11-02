-- =====================================================================
-- FIRMA · Portal · Higiene de seguridad y cupo de firmas con envíos en curso
-- 1. Cupo de firmas. firmas_uso suma en_curso: los envíos de la empresa que
--    siguen abiertos reservan su lugar, así el tope del plan no se pasa.
--    Un envío anulado o vencido libera el lugar.
-- 2. Las funciones security definer del esquema public ya no las puede
--    ejecutar el rol anónimo (lo marcaba el asesor de seguridad de
--    Supabase). Las siguen ejecutando los usuarios con sesión, que las
--    necesitan para las reglas de acceso, y el servidor. borrar_empresa
--    sigue siendo solo del servidor.
-- 3. Ruta de búsqueda fija en las tres funciones que no la tenían. No
--    cambia lo que hacen: el texto de cada evento de firma queda igual.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cupo de firmas
-- ---------------------------------------------------------------------
drop function if exists public.firmas_uso(uuid);
create function public.firmas_uso(org uuid)
returns table (plan text, limite int, usados int, en_curso int, desde date, hasta date)
language sql stable security definer set search_path = public as $$
  select o.plan,
         case o.plan when 'gold' then 20 when 'black' then 50 end,
         (select count(*)::int from firma_sobres s
          where s.organizacion_id = o.id and s.emisor = 'cliente' and s.estado = 'completado'
            and (s.completado_en at time zone 'America/Argentina/Buenos_Aires')::date >= m.desde
            and (s.completado_en at time zone 'America/Argentina/Buenos_Aires')::date < m.hasta),
         (select count(*)::int from firma_sobres s
          where s.organizacion_id = o.id and s.emisor = 'cliente' and s.estado = 'en_curso'),
         m.desde, m.hasta
  from organizaciones o
  cross join lateral (
    select date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date as desde,
           (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') + interval '1 month')::date as hasta
  ) m
  where o.id = org and (public.es_admin() or org = public.mi_organizacion() or auth.role() = 'service_role');
$$;

-- ---------------------------------------------------------------------
-- 2. Sin ejecución anónima de funciones security definer
-- ---------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    if f.proname = 'borrar_empresa' then
      execute format('grant execute on function %s to service_role', f.firma);
    else
      execute format('grant execute on function %s to authenticated, service_role', f.firma);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Ruta de búsqueda fija
-- ---------------------------------------------------------------------
alter function public.firma_eventos_inmutables() set search_path = public;
alter function public.firma_texto_evento(text, uuid, uuid, text, text, text, jsonb, timestamptz) set search_path = public;
alter function public.agenda_periodo(text) set search_path = public;

notify pgrst, 'reload schema';

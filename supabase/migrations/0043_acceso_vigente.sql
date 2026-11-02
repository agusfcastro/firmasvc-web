-- =====================================================================
-- FIRMA · Portal · Acceso vigente para las funciones del servidor
-- Las funciones de Vercel leen el perfil con la clave de servicio, que no
-- pasa por las políticas. acceso_vigente() les dice, con la misma regla
-- que mi_organizacion(), si la persona puede operar hoy en su negocio
-- activo: perfil activo, negocio activo y membresía activa. Devuelve el
-- negocio, o null si no tiene acceso. Desactivar una membresía corta así
-- también la API, no solo la base.
-- =====================================================================

create or replace function public.acceso_vigente(p_usuario uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.organizacion_id
  from perfiles p
  join organizaciones o on o.id = p.organizacion_id
  join membresias m on m.usuario_id = p.id and m.organizacion_id = p.organizacion_id
  where p.id = p_usuario and p.activo and o.activa and m.activa;
$$;

revoke all on function public.acceso_vigente(uuid) from public, anon, authenticated;
grant execute on function public.acceso_vigente(uuid) to service_role;

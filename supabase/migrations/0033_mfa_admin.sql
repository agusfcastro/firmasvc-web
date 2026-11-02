-- =====================================================================
-- FIRMA · Portal · Verificación en dos pasos para FIRMA
-- es_admin() solo da permisos de administración cuando la sesión pasó el
-- segundo factor (aal2 en el token). Con la contraseña sola, una cuenta
-- admin no ve ni toca datos de nadie: solo su propio perfil.
-- Todas las políticas y permisos de admin pasan por es_admin(), así que
-- con este cambio rige en toda la base y en los archivos.
-- Antes de correrla, cada admin tiene que haber registrado su app
-- autenticadora en el portal (ver PORTAL.md, Verificación en dos pasos).
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol = 'admin' and activo
    );
$$;

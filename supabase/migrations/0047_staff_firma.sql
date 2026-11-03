-- =====================================================================
-- FIRMA · Portal · Staff de FIRMA como marca propia
-- Ser de FIRMA no es un rol dentro de un negocio: es otra cosa. Desde
-- acá se nombra así.
--   · perfiles.es_staff_firma se calcula sola del rol admin. No se
--     escribe: para sumar a alguien de FIRMA se le da el rol admin, como
--     siempre, desde Administración › Usuarios.
--   · es_staff() es la consulta para lo nuevo. Exige la verificación en
--     dos pasos, igual que es_admin(), que sigue valiendo para lo que ya
--     está escrito.
--   · El staff no tiene negocio ni membresías (0036 ya lo impide): se
--     controla también acá.
-- =====================================================================

alter table public.perfiles add column if not exists es_staff_firma boolean
  generated always as (rol = 'admin'::public.rol_portal) stored;

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin();
$$;

revoke all on function public.es_staff() from public, anon;
grant execute on function public.es_staff() to authenticated, service_role;

-- Alguien de FIRMA no trabaja dentro de un negocio.
update public.perfiles set organizacion_id = null where es_staff_firma and organizacion_id is not null;
alter table public.perfiles drop constraint if exists perfiles_staff_sin_negocio;
alter table public.perfiles add constraint perfiles_staff_sin_negocio check (not es_staff_firma or organizacion_id is null);

notify pgrst, 'reload schema';

-- =====================================================================
-- FIRMA · Portal · Cargo en el perfil
-- Texto que se muestra debajo del nombre en lugar del rol (por ejemplo
-- CEO & Founder). Es solo un rótulo: los permisos siguen saliendo del rol.
-- Vacío, el portal muestra el rol como hasta ahora.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.perfiles add column if not exists cargo text;
alter table public.perfiles drop constraint if exists perfiles_cargo_largo;
alter table public.perfiles add constraint perfiles_cargo_largo check (cargo is null or length(trim(cargo)) between 2 and 60);

-- Agustín Castro, en lugar de Admin FIRMA.
update public.perfiles set cargo = 'CEO & Founder'
where lower(email) = 'agustin@firmasvc.com' and cargo is distinct from 'CEO & Founder';

notify pgrst, 'reload schema';

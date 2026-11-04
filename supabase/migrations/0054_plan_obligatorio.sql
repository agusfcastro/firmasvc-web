-- =====================================================================
-- FIRMA · Portal · El plan de servicio es obligatorio
-- Los planes son Gold, Black y Eminent, sin acuerdos a medida. Lo único
-- que puede salir de la norma es el monto del abono, que vive en abonos.
-- Hasta acá organizaciones.plan vacío era "a medida": sin límites, pero
-- también sin lo que incluye Eminent (las llamadas de Fathom, 0052).
-- 1. Las empresas sin plan pasan a Eminent, que tiene los mismos límites
--    (ninguno) y además trae lo de Eminent.
-- 2. plan pasa a ser obligatorio. Eminent queda como valor por defecto
--    para lo que se cree sin plan, como las pruebas.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

update public.organizaciones set plan = 'eminent' where plan is null;

alter table public.organizaciones alter column plan set default 'eminent';
alter table public.organizaciones alter column plan set not null;
alter table public.organizaciones drop constraint if exists organizaciones_plan;
alter table public.organizaciones add constraint organizaciones_plan check (plan in ('gold', 'black', 'eminent'));

notify pgrst, 'reload schema';

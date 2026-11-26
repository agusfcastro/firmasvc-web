-- =====================================================================
-- FIRMA · Portal · Duración de cada servicio
--   Con la fecha de onboarding del cliente da el fin de su contrato, que
--   se ve en la línea de tiempo del CRM y en la ficha. Los servicios cuyo
--   código ya dice los meses (3M, 6M, 12M) la toman de ahí; el resto se
--   carga en Servicios.
-- =====================================================================

alter table public.crm_servicios add column if not exists duracion_meses smallint;

alter table public.crm_servicios drop constraint if exists crm_servicios_duracion_meses_check;
alter table public.crm_servicios add constraint crm_servicios_duracion_meses_check
  check (duracion_meses is null or duracion_meses between 1 and 60);

update public.crm_servicios
   set duracion_meses = substring(clave from '^(\d{1,2})M$')::smallint
 where duracion_meses is null
   and clave ~ '^\d{1,2}M$'
   and substring(clave from '^(\d{1,2})M$')::int between 1 and 60;

notify pgrst, 'reload schema';

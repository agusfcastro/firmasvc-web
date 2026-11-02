-- =====================================================================
-- FIRMA · Portal · Abonos trimestrales y planes en dólares sin país
-- 1. Cada abono cobra cada 1 o cada 3 meses (periodo_meses). El trimestral
--    es el Eminent pagado por adelantado.
-- 2. En dólares el plan de dLocal Go puede ir sin país: el checkout se lo
--    pregunta al cliente. En pesos sigue siendo Argentina.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.abonos add column if not exists periodo_meses smallint not null default 1;
alter table public.abonos drop constraint if exists abonos_periodo;
alter table public.abonos add constraint abonos_periodo check (periodo_meses in (1, 3));

-- El país queda vacío en los abonos en dólares nuevos.
alter table public.abonos alter column pais drop not null;
alter table public.abonos alter column pais drop default;

-- En pesos el país tiene que ser Argentina, también cuando viene vacío.
alter table public.abonos drop constraint if exists abonos_ars_argentina;
alter table public.abonos add constraint abonos_ars_argentina check (moneda <> 'ARS' or pais is not distinct from 'AR');

-- Desde la web se escribe también la periodicidad, solo mientras el abono es borrador.
grant insert (organizacion_id, concepto, monto, moneda, pais, periodo_meses, email_pagador) on public.abonos to authenticated;
grant update (organizacion_id, concepto, monto, moneda, pais, periodo_meses, email_pagador) on public.abonos to authenticated;

-- La API de Supabase guarda la estructura de las tablas en caché. Así toma la columna nueva al instante.
notify pgrst, 'reload schema';

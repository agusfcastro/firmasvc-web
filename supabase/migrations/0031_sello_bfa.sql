-- =====================================================================
-- FIRMA · Portal · Sello de tiempo en la Blockchain Federal Argentina
-- Cuando un envío se completa, el SHA-256 del PDF firmado va al sello de
-- tiempo de BFA. Solo viaja el hash: ni el PDF ni datos de los firmantes.
-- bfa_recibo es el recibo que devuelve BFA y sirve para verificar el sello.
-- bfa_bloque y bfa_registrado_en llegan cuando el hash entra en un bloque,
-- unos minutos después. Si BFA no responde, la tarea diaria lo reintenta.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.firma_sobres add column if not exists bfa_recibo text;
alter table public.firma_sobres add column if not exists bfa_bloque bigint;
alter table public.firma_sobres add column if not exists bfa_registrado_en timestamptz;

alter table public.firma_sobres drop constraint if exists firma_sobres_bfa_largos;
alter table public.firma_sobres add constraint firma_sobres_bfa_largos check (bfa_recibo is null or length(bfa_recibo) <= 2000);

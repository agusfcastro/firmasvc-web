-- =====================================================================
-- FIRMA · Portal · Vigencia de cada abono
-- vigente_hasta es la fecha hasta la que rige el abono, la que se pactó
-- con el cliente. Es informativa: no da de baja la suscripción ni frena
-- los débitos al llegar la fecha. Vacía, el abono no tiene fecha de fin.
-- FIRMA la carga al armar el borrador y la cambia en cualquier estado
-- desde Administración › Abonos (por /api/pagos/gestionar, accion vigencia).
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.abonos add column if not exists vigente_hasta date;

-- Desde la web se escribe solo mientras el abono es borrador (regla abonos_edicion).
grant insert (vigente_hasta) on public.abonos to authenticated;
grant update (vigente_hasta) on public.abonos to authenticated;

notify pgrst, 'reload schema';

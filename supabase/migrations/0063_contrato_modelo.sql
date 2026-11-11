-- =====================================================================
-- FIRMA · Portal · Contrato modelo con el equipo
-- Después del formulario, FIRMA entrega el contrato final de closer o de
-- setter de cada empresa. Ese documento queda como su modelo: el cliente
-- lo baja desde Contratos con tu equipo y cada persona nueva se suma con
-- él, completando sus datos y, si cambian, los honorarios.
-- Un modelo por empresa y por contrato. Lo carga solo FIRMA (la política
-- documentos_gestion de 0005 ya lo limita al admin).
-- Correr después de 0062. Se puede correr más de una vez.
-- =====================================================================

alter table public.documentos add column if not exists modelo_contrato text;

alter table public.documentos drop constraint if exists documentos_modelo_contrato_check;
alter table public.documentos add constraint documentos_modelo_contrato_check check (
  modelo_contrato is null
  or (modelo_contrato in ('closer', 'setter') and seccion = 'equipo' and organizacion_id is not null)
);

create unique index if not exists documentos_modelo_contrato_unico
  on public.documentos (organizacion_id, modelo_contrato)
  where modelo_contrato is not null;

notify pgrst, 'reload schema';

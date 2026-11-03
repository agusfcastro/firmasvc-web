-- =====================================================================
-- FIRMA · Portal · Clave del barrido de la cola, solo en Vault
-- pg_cron llama a /api/cola/procesar con la clave cola_secreto de Vault.
-- La función la valida contra la base con cola_clave_valida(), así la
-- clave vive en un solo lugar y Vercel no necesita una variable aparte
-- (COLA_SECRETO sigue valiendo si está cargada).
-- Compara hashes, no la clave: el tiempo no depende de cuánto coincide.
-- =====================================================================

create or replace function public.cola_clave_valida(p_clave text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce(length(p_clave) >= 32
    and digest(p_clave, 'sha256') = digest(public.crm_clave('cola_secreto'), 'sha256'), false);
$$;

revoke all on function public.cola_clave_valida(text) from public, anon, authenticated;
grant execute on function public.cola_clave_valida(text) to service_role;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIRMA · Portal · Borrar una empresa de prueba
-- Pensado para las empresas que se armaron para probar el portal. Borra
-- la empresa con todo lo suyo: usuarios, CRM, casos, asuntos, documentos,
-- abonos con sus pagos y agendas.
-- Si la empresa tiene envíos a firma electrónica no se borra: el registro
-- de cada firma es evidencia y no se modifica ni se borra (migración 0010).
-- Solo la llama /api/admin/usuarios (accion borrar_empresa) con la clave
-- service role, que después borra los archivos y las cuentas de acceso.
-- La empresa tiene que estar desactivada antes. No se puede deshacer.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

create or replace function public.borrar_empresa(org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o organizaciones%rowtype;
  usuarios uuid[];
  documentos text[];
  asuntos_archivos text[];
  contratos text[];
begin
  select * into o from organizaciones where id = org;
  if not found then raise exception 'No existe esa empresa.'; end if;
  if o.activa then raise exception 'Desactivá la empresa antes de borrarla.'; end if;
  if exists (select 1 from firma_sobres where organizacion_id = org) then
    raise exception 'La empresa tiene envíos a firma electrónica. Su registro es evidencia y no se borra, así que la empresa tampoco: dejala desactivada.';
  end if;

  select coalesce(array_agg(id), '{}') into usuarios from perfiles where organizacion_id = org;
  select coalesce(array_agg(archivo_ruta), '{}') into documentos from documentos where organizacion_id = org and archivo_ruta is not null;
  select coalesce(array_agg(ruta), '{}') into asuntos_archivos from asunto_archivos where organizacion_id = org;
  -- PDF de los contratos del CRM generados y nunca enviados (sin envío, no hay firma).
  select coalesce(array_agg(pdf_ruta), '{}') into contratos from crm_contratos_firma where organizacion_id = org and pdf_ruta is not null;

  delete from abonos where organizacion_id = org;
  delete from crm_clientes where organizacion_id = org;
  delete from perfiles where organizacion_id = org;
  delete from organizaciones where id = org;
  -- El historial del CRM y el registro de accesos quedan: son registros de auditoría.

  return jsonb_build_object(
    'nombre', o.nombre,
    'usuarios', to_jsonb(usuarios),
    'logo_url', o.logo_url,
    'documentos', to_jsonb(documentos),
    'asuntos', to_jsonb(asuntos_archivos),
    'contratos', to_jsonb(contratos)
  );
end;
$$;

revoke all on function public.borrar_empresa(uuid) from public, anon, authenticated;
grant execute on function public.borrar_empresa(uuid) to service_role;

notify pgrst, 'reload schema';

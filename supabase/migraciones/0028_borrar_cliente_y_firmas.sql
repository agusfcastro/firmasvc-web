-- =====================================================================
-- FIRMA · Portal · Eliminar clientes del CRM y envíos a firma de prueba
-- 1. Al eliminar un cliente del CRM (solo FIRMA, regla cli_baja) se
--    eliminan también sus casos de conflicto y todos sus asuntos, con
--    novedades, mensajes y la lista de archivos. Cuotas y contratos ya
--    se borraban en cascada. El historial del cliente queda.
-- 2. FIRMA puede eliminar un envío a firma electrónica, pensado para los
--    de prueba: se borran el sobre, sus firmantes y su registro de
--    eventos. El registro sigue sin poder tocarse por ninguna otra vía.
--    Solo la llama /api/firma/sobres (accion eliminar) con la clave
--    service role, que después borra los PDF. No se puede deshacer.
-- Requiere la 0026. Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cliente del CRM
-- ---------------------------------------------------------------------
-- Corre como dueña porque el asunto solo lo borra FIRMA y quien elimina
-- el cliente ya pasó la regla cli_baja. Primero los casos: su trigger
-- borra el asunto de cada uno (0026). Después los asuntos sin caso.
create or replace function public.crm_clientes_borrar_asuntos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from crm_casos where cliente_id = old.id;
  delete from asuntos where cliente_id = old.id;
  return old;
end;
$$;

revoke execute on function public.crm_clientes_borrar_asuntos() from public, anon;

drop trigger if exists crm_clientes_borrar_asuntos on public.crm_clientes;
create trigger crm_clientes_borrar_asuntos before delete on public.crm_clientes
  for each row execute function public.crm_clientes_borrar_asuntos();

-- ---------------------------------------------------------------------
-- 2. Envío a firma electrónica
-- ---------------------------------------------------------------------
-- El registro de eventos sigue inmutable. La única excepción es el borrado
-- de un sobre entero desde firma_borrar_sobre, que marca cuál en la transacción.
create or replace function public.firma_eventos_inmutables()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and current_setting('firma.borrar_sobre', true) = old.sobre_id::text then
    return old;
  end if;
  raise exception 'El registro de eventos de firma no se puede modificar ni borrar.';
end;
$$;

create or replace function public.firma_borrar_sobre(p_sobre uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s firma_sobres%rowtype;
begin
  select * into s from firma_sobres where id = p_sobre;
  if not found then raise exception 'No existe ese envío.'; end if;

  perform set_config('firma.borrar_sobre', p_sobre::text, true);
  delete from firma_eventos where sobre_id = p_sobre;
  delete from firma_firmantes where sobre_id = p_sobre;
  delete from firma_sobres where id = p_sobre;
  perform set_config('firma.borrar_sobre', '', true);

  return jsonb_build_object('titulo', s.titulo, 'original_ruta', s.original_ruta, 'final_ruta', s.final_ruta);
end;
$$;

revoke all on function public.firma_borrar_sobre(uuid) from public, anon, authenticated;
grant execute on function public.firma_borrar_sobre(uuid) to service_role;

notify pgrst, 'reload schema';

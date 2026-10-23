-- =====================================================================
-- FIRMA · Portal · Eliminar un caso de conflicto elimina su asunto
-- 1. Al eliminar un caso en CRM › Casos de conflicto se elimina también
--    su asunto de Estado de asuntos, con sus novedades, mensajes y la
--    lista de archivos. La baja del caso sigue en el historial del cliente.
-- 2. Los asuntos de reembolso o contracargo que quedaron sin caso (de
--    casos eliminados antes de esta migración) se eliminan.
-- Requiere la 0024. Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

-- El asunto solo lo borra FIRMA, por eso la función corre como dueña.
-- Quien elimina el caso ya pasó la regla cas_baja.
create or replace function public.crm_casos_borrar_asunto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.asunto_id is not null then
    delete from asuntos where id = old.asunto_id;
  end if;
  return old;
end;
$$;

revoke execute on function public.crm_casos_borrar_asunto() from public, anon;

drop trigger if exists crm_casos_borrar_asunto on public.crm_casos;
create trigger crm_casos_borrar_asunto after delete on public.crm_casos
  for each row execute function public.crm_casos_borrar_asunto();

delete from public.asuntos a
where a.motivo = 'reembolso'
  and not exists (select 1 from public.crm_casos c where c.asunto_id = a.id);

notify pgrst, 'reload schema';

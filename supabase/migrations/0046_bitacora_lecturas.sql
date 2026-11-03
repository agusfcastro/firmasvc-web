-- =====================================================================
-- FIRMA · Portal · Lecturas en la bitácora
-- Postgres no registra un SELECT, así que el portal avisa con
-- bitacora_lectura(tipo, id) cuando alguien abre algo. Queda en la
-- bitácora del negocio:
--   · Todo lo que abre alguien de FIRMA: un negocio (al entrar a su CRM),
--     la ficha de un cliente, su perfil, un asunto o un envío a firma.
--   · Lo sensible, lo abra quien lo abra: la ficha de un cliente (DNI,
--     teléfono y domicilio descifrados) y su perfil conductual.
-- El negocio sale del objeto, no de quien llama. Si la persona no puede
-- ver el objeto no se registra nada ni se informa nada. Una misma
-- persona abriendo lo mismo cuenta una vez cada 30 minutos.
-- =====================================================================

create or replace function public.bitacora_lectura(tipo text, objeto uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  org uuid;
  visible boolean;
  titulo text;
  movimiento text;
  staff boolean := public.es_admin();
begin
  if auth.uid() is null then
    return;
  end if;

  case tipo
    when 'negocio' then
      select o.id, o.nombre into org, titulo from organizaciones o where o.id = objeto;
      visible := staff;
      movimiento := 'acceso_negocio';
    when 'crm_cliente' then
      select c.organizacion_id, c.nombre || coalesce(' (' || c.codigo || ')', '') into org, titulo from crm_clientes c where c.id = objeto;
      visible := org is not null and puede_ver_org(org);
      movimiento := 'lectura_cliente';
    when 'perfil_conductual' then
      select c.organizacion_id, c.nombre || coalesce(' (' || c.codigo || ')', '') into org, titulo from crm_clientes c where c.id = objeto;
      visible := org is not null and puede_ver_perfiles(org);
      movimiento := 'lectura_perfil';
    when 'asunto' then
      select a.organizacion_id, coalesce(a.codigo || ' · ', '') || a.titulo into org, titulo from asuntos a where a.id = objeto;
      visible := org is not null and puede_ver_casos(org);
      movimiento := 'lectura_asunto';
    when 'firma_sobre' then
      select s.organizacion_id, s.codigo || ' · ' || s.titulo into org, titulo from firma_sobres s where s.id = objeto;
      visible := org is not null and firma_sobre_visible(objeto);
      movimiento := 'lectura_firma';
    else
      raise exception 'Tipo de lectura desconocido.';
  end case;

  if org is null or not coalesce(visible, false) then
    return;
  end if;
  -- Del equipo del negocio solo se anota lo sensible.
  if not staff and tipo not in ('crm_cliente', 'perfil_conductual') then
    return;
  end if;
  if exists (
    select 1 from registro_accesos r
    where r.actor_id = auth.uid() and r.accion = movimiento and r.objeto_id = objeto::text
      and r.creado_en > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into registro_accesos (usuario_id, actor_id, accion, organizacion_id, objeto_tipo, objeto_id, detalle)
  values (auth.uid(), auth.uid(), movimiento, org, tipo, objeto::text,
          jsonb_build_object('organizacion_id', org, 'titulo', left(titulo, 160)));
end;
$$;

revoke all on function public.bitacora_lectura(text, uuid) from public, anon;
grant execute on function public.bitacora_lectura(text, uuid) to authenticated;

create index if not exists registro_accesos_lectura_idx on public.registro_accesos (actor_id, objeto_id, creado_en desc)
  where objeto_id is not null;

notify pgrst, 'reload schema';

-- =====================================================================
-- FIRMA · Portal · Asuntos de la cartera
-- El responsable de un cliente del CRM (su CSM o account manager, en
-- crm_clientes.responsable_id) ve los asuntos vinculados a ese cliente
-- aunque su rol en el portal no vea Asuntos (closer o setter). Puede leer
-- la bitácora visible, escribir en el chat y subir documentos, como el
-- titular y el CSM. No abre asuntos nuevos: eso sigue siendo del titular
-- y el CSM.
-- Los avisos por mail de esos asuntos le llegan al titular y a él
-- (api/portal/avisos.ts), no a todos los CSM del negocio.
-- =====================================================================

-- El cliente es de la cartera de quien llama: es su responsable en el equipo y tiene cuenta.
create or replace function public.es_de_mi_cartera(org uuid, cliente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select cliente is not null
     and org = public.mi_organizacion()
     and exists (
       select 1
       from public.crm_clientes c
       join public.equipo_miembros e on e.id = c.responsable_id and e.organizacion_id = c.organizacion_id
       where c.id = cliente and c.organizacion_id = org and e.usuario_id = auth.uid() and e.activo
     );
$$;

-- Quien llama ve ese asunto: por su rol en el negocio o porque el cliente es de su cartera.
create or replace function public.puede_ver_asunto(asunto uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.asuntos a
    where a.id = asunto
      and (public.puede_ver_casos(a.organizacion_id) or public.es_de_mi_cartera(a.organizacion_id, a.cliente_id))
  );
$$;

-- Para el portal: si la persona tiene asuntos de su cartera en el negocio activo.
create or replace function public.tengo_asuntos_de_cartera()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.asuntos a
    where a.organizacion_id = public.mi_organizacion()
      and public.es_de_mi_cartera(a.organizacion_id, a.cliente_id)
  );
$$;

revoke all on function public.es_de_mi_cartera(uuid, uuid) from public, anon;
revoke all on function public.puede_ver_asunto(uuid) from public, anon;
revoke all on function public.tengo_asuntos_de_cartera() from public, anon;
grant execute on function public.es_de_mi_cartera(uuid, uuid) to authenticated;
grant execute on function public.puede_ver_asunto(uuid) to authenticated;
grant execute on function public.tengo_asuntos_de_cartera() to authenticated;

-- ---------------------------------------------------------------------
-- Políticas. Primero el rol, que no consulta nada más.
-- ---------------------------------------------------------------------
drop policy if exists asuntos_lectura on public.asuntos;
create policy asuntos_lectura on public.asuntos for select to authenticated
  using (public.puede_ver_casos(organizacion_id) or public.es_de_mi_cartera(organizacion_id, cliente_id));

drop policy if exists novedades_lectura on public.asunto_novedades;
create policy novedades_lectura on public.asunto_novedades for select to authenticated
  using ((public.puede_ver_casos(organizacion_id) or public.puede_ver_asunto(asunto_id)) and (not interna or public.es_admin()));

drop policy if exists mensajes_lectura on public.asunto_mensajes;
create policy mensajes_lectura on public.asunto_mensajes for select to authenticated
  using (public.puede_ver_casos(organizacion_id) or public.puede_ver_asunto(asunto_id));
drop policy if exists mensajes_alta on public.asunto_mensajes;
create policy mensajes_alta on public.asunto_mensajes for insert to authenticated
  with check ((public.puede_ver_casos(organizacion_id) or public.puede_ver_asunto(asunto_id)) and autor_id = auth.uid());

drop policy if exists archivos_lectura on public.asunto_archivos;
create policy archivos_lectura on public.asunto_archivos for select to authenticated
  using (public.puede_ver_casos(organizacion_id) or public.puede_ver_asunto(asunto_id));
drop policy if exists archivos_alta on public.asunto_archivos;
create policy archivos_alta on public.asunto_archivos for insert to authenticated
  with check ((public.puede_ver_casos(organizacion_id) or public.puede_ver_asunto(asunto_id)) and subido_por = auth.uid());

-- Ruta en el bucket: <organizacion_id>/<asunto_id>/<archivo>. Con la cartera, la segunda carpeta tiene que ser un asunto suyo de esa empresa.
create or replace function public.archivo_asunto_visible(ruta text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  carpeta text := split_part(ruta, '/', 1);
  subcarpeta text := split_part(ruta, '/', 2);
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if carpeta !~ uuid_re then return false; end if;
  if public.puede_ver_casos(carpeta::uuid) then return true; end if;
  if subcarpeta !~ uuid_re then return false; end if;
  return exists (
    select 1 from asuntos a
    where a.id = subcarpeta::uuid and a.organizacion_id = carpeta::uuid
      and public.es_de_mi_cartera(a.organizacion_id, a.cliente_id)
  );
end;
$$;

notify pgrst, 'reload schema';

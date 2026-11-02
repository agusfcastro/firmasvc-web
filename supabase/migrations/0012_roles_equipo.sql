-- =====================================================================
-- FIRMA · Portal · Roles del equipo de cada cliente
--   titular  todo lo de su empresa, incluida la administración (equipo,
--            pagos, servicios)
--   csm      todo menos la administración de la empresa
--   closer   CRM y agenda, sin casos de conflicto. De documentos solo
--            protocolos y formación
--   setter   solo protocolos y formación
-- El rol "miembro" anterior queda como equivalente a csm, para no romper
-- cuentas viejas. Desde el panel ya no se asigna.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter type public.rol_portal add value if not exists 'csm';
alter type public.rol_portal add value if not exists 'closer';
alter type public.rol_portal add value if not exists 'setter';

-- Los valores nuevos no se pueden usar como enum en la misma corrida,
-- por eso todas las comparaciones de abajo son contra texto.
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select p.rol::text from public.perfiles p where p.id = auth.uid() and p.activo;
$$;

-- CRM (clientes, pagos, servicios): titular, csm y closer de la empresa.
create or replace function public.puede_ver_org(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or (org = public.mi_organizacion() and public.mi_rol() in ('titular', 'csm', 'closer', 'miembro'));
$$;

-- Casos de conflicto: titular y csm.
create or replace function public.puede_ver_casos(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or (org = public.mi_organizacion() and public.mi_rol() in ('titular', 'csm', 'miembro'));
$$;

drop policy if exists cas_lectura on public.crm_casos;
create policy cas_lectura on public.crm_casos for select to authenticated using (public.puede_ver_casos(organizacion_id));
drop policy if exists cas_alta on public.crm_casos;
create policy cas_alta on public.crm_casos for insert to authenticated with check (public.puede_ver_casos(organizacion_id));
drop policy if exists cas_edicion on public.crm_casos;
create policy cas_edicion on public.crm_casos for update to authenticated
  using (public.puede_ver_casos(organizacion_id)) with check (public.puede_ver_casos(organizacion_id));

-- ---------------------------------------------------------------------
-- Documentos. Closer y setter ven solo protocolos y formación.
-- ---------------------------------------------------------------------
alter table public.documentos add column if not exists es_protocolo boolean not null default false;
update public.documentos set es_protocolo = true where url like '/protocolo-%' and not es_protocolo;

create or replace function public.documento_visible(p_org uuid, p_areas text[], p_activo boolean, p_protocolo boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or (
    p_activo
    and public.mi_organizacion() is not null
    and (p_org is null or p_org = public.mi_organizacion())
    and (p_protocolo or public.mi_rol() in ('titular', 'csm', 'miembro'))
    and (coalesce(cardinality(p_areas), 0) = 0 or public.soy_titular() or p_areas && public.mis_areas())
  );
$$;

drop policy if exists documentos_lectura on public.documentos;
create policy documentos_lectura on public.documentos for select to authenticated
  using (public.documento_visible(organizacion_id, areas, activo, es_protocolo));

create or replace function public.puede_descargar_documento(ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documentos d
    where d.archivo_ruta = ruta
      and public.documento_visible(d.organizacion_id, d.areas, d.activo, d.es_protocolo)
  );
$$;

create or replace function public.registrar_descarga(doc uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.documentos;
begin
  if auth.uid() is null or public.es_admin() then return; end if;
  select * into d from public.documentos where id = doc;
  if not found or not public.documento_visible(d.organizacion_id, d.areas, d.activo, d.es_protocolo) then return; end if;
  insert into public.registro_accesos (usuario_id, actor_id, accion, detalle)
  values (auth.uid(), auth.uid(), 'descarga_documento',
          jsonb_build_object('documento_id', d.id, 'titulo', d.titulo, 'seccion', d.seccion, 'version', d.version));
end;
$$;

drop function if exists public.documento_visible(uuid, text[], boolean);

-- ---------------------------------------------------------------------
-- Agenda con FIRMA: todos menos el setter.
-- ---------------------------------------------------------------------
drop policy if exists agendas_lectura on public.agendas;
create policy agendas_lectura on public.agendas for select to authenticated
  using (
    public.es_admin()
    or (activa
        and public.mi_rol() <> 'setter'
        and (organizacion_id is null or organizacion_id = public.mi_organizacion()))
  );

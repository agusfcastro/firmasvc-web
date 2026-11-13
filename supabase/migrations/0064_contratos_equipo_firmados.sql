-- =====================================================================
-- FIRMA · Portal · Contratos firmados con el equipo
-- Un envío de firma se puede atar a una persona del equipo comercial de la
-- empresa (equipo_miembros, 0037), como ya se ata a un cliente del CRM
-- (crm_cliente_id, 0015). Esos envíos se listan en Documentos › Contratos
-- con tu equipo, en curso y firmados.
-- Traen honorarios y datos personales, así que los ven FIRMA, el titular,
-- quien tiene el área Legales u Operaciones y quien mandó el envío. El resto
-- del equipo no, aunque el envío sea por el portal.
-- Correr después de 0063. Se puede correr más de una vez.
-- =====================================================================

alter table public.firma_sobres add column if not exists equipo_miembro_id uuid;

-- La persona tiene que ser de la misma empresa del envío: la clave compuesta
-- usa el unique (organizacion_id, id) de equipo_miembros.
alter table public.firma_sobres drop constraint if exists firma_sobres_equipo_fk;
alter table public.firma_sobres add constraint firma_sobres_equipo_fk
  foreign key (organizacion_id, equipo_miembro_id) references public.equipo_miembros (organizacion_id, id);

-- Sin empresa la clave compuesta no se revisa, así que un envío propio de FIRMA no se ata al equipo.
-- Y un envío es de un cliente del CRM o de una persona del equipo, no de los dos.
alter table public.firma_sobres drop constraint if exists firma_sobres_equipo_check;
alter table public.firma_sobres add constraint firma_sobres_equipo_check check (
  equipo_miembro_id is null or (organizacion_id is not null and crm_cliente_id is null)
);

create index if not exists firma_sobres_equipo_idx on public.firma_sobres (equipo_miembro_id) where equipo_miembro_id is not null;

-- Las mismas reglas que 0055, más los contratos del equipo.
create or replace function public.firma_sobre_visible(p_sobre uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or exists (
    select 1 from public.firma_sobres s
    where s.id = p_sobre
      and s.organizacion_id is not null
      and s.organizacion_id = public.mi_organizacion()
      and (public.soy_titular()
           or s.creado_por = auth.uid()
           or (s.equipo_miembro_id is not null and public.mis_areas() && array['legales', 'operaciones'])
           or (s.equipo_miembro_id is null
               and (s.crm_cliente_id is not null or s.entrega = 'portal')
               and public.puede_ver_org(s.organizacion_id)))
  );
$$;

notify pgrst, 'reload schema';

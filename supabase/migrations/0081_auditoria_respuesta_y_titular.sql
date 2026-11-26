-- =====================================================================
-- Arreglos de la auditoría de calidad del 26 de noviembre de 2026.
--
-- 1. Cuando alguien de la empresa responde en el chat de un asunto que
--    espera su respuesta, el asunto pasa a En curso. Antes seguía en
--    «Esperando tu respuesta» y el portal le seguía pidiendo responder.
--    El cambio queda en la bitácora del asunto como cualquier otro
--    (asuntos_registrar_estado). Lo que escribe FIRMA no cambia nada.
--
-- 2. El titular aparece en Equipo como «Titular» y no como «Otro». Las
--    altas automáticas (0058) le ponen ese cargo y se corrigen los que
--    ya estaban sin cargo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Respuesta del cliente
-- ---------------------------------------------------------------------
create or replace function public.asunto_mensajes_respuesta_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.autor_id is not null
     and not exists (select 1 from perfiles p where p.id = new.autor_id and (p.rol = 'admin' or p.es_staff_firma)) then
    update asuntos set estado = 'en_curso' where id = new.asunto_id and estado = 'espera_cliente';
  end if;
  return new;
end;
$$;

revoke all on function public.asunto_mensajes_respuesta_cliente() from public, anon, authenticated;

drop trigger if exists asunto_mensajes_respuesta_cliente on public.asunto_mensajes;
create trigger asunto_mensajes_respuesta_cliente after insert on public.asunto_mensajes
  for each row execute function public.asunto_mensajes_respuesta_cliente();

-- ---------------------------------------------------------------------
-- 2. El titular en Equipo
-- ---------------------------------------------------------------------
create or replace function public.equipo_asegurar_usuario(org uuid, usuario uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.perfiles;
  rol_portal text;
begin
  select * into p from public.perfiles where id = usuario;
  if p.id is null then return; end if;
  select m.rol::text into rol_portal from public.membresias m
   where m.usuario_id = usuario and m.organizacion_id = org and m.activa;
  if rol_portal is null then return; end if;

  -- Ya tiene su lugar en el equipo.
  if exists (select 1 from public.equipo_miembros where organizacion_id = org and usuario_id = usuario) then
    return;
  end if;

  -- Alguien lo esperaba en el equipo por mail o por nombre.
  update public.equipo_miembros e
     set usuario_id = usuario
   where e.id = (
     select x.id from public.equipo_miembros x
      where x.organizacion_id = org
        and x.usuario_id is null
        and (lower(x.email) = lower(p.email)
             or (x.email is null and public.equipo_usuario_de(org, null, x.nombre) = usuario))
      order by (lower(x.email) = lower(p.email)) desc nulls last, x.activo desc, x.creado_en
      limit 1);
  if found then return; end if;

  insert into public.equipo_miembros (organizacion_id, nombre, rol_comercial, cargo, email, usuario_id)
  values (org,
          public.equipo_nombre_de(p.nombre, p.email),
          case rol_portal when 'closer' then 'closer' when 'setter' then 'setter'
                          when 'csm' then 'csm' when 'miembro' then 'csm' else 'otro' end,
          case when rol_portal = 'titular' then 'Titular' end,
          p.email,
          usuario)
  on conflict do nothing;
end;
$$;

revoke all on function public.equipo_asegurar_usuario(uuid, uuid) from public, anon, authenticated;

update public.equipo_miembros e
   set cargo = 'Titular'
 where e.rol_comercial = 'otro'
   and nullif(trim(coalesce(e.cargo, '')), '') is null
   and e.usuario_id is not null
   and exists (select 1 from public.membresias m
                where m.usuario_id = e.usuario_id and m.organizacion_id = e.organizacion_id
                  and m.activa and m.rol = 'titular');

notify pgrst, 'reload schema';

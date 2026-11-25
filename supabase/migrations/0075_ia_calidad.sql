-- =====================================================================
-- FIRMA · Portal · Auditoría de la IA, segunda parte (Calidad de la IA)
--   · Cada corrida queda con su empresa aunque el servidor no la mande,
--     así Administración › Calidad de la IA abre el registro original
--     (el análisis de una llamada vive en el CRM de su empresa). Las
--     corridas que ya estaban se completan acá.
--   · ia_contenido_analisis(): la llamada descifrada de un análisis, solo
--     para el servidor, para armar un caso de prueba anonimizado desde una
--     corrida del analizador. El navegador nunca la recibe entera: la API
--     la seudonimiza antes (api/admin/ia.ts).
-- =====================================================================

create or replace function public.ia_corridas_empresa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organizacion_id is null and new.referencia_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.organizacion_id := case new.referencia_tabla
      when 'interaccion_analisis' then (select a.organizacion_id from interaccion_analisis a where a.id = new.referencia_id::uuid)
      when 'asunto_archivos' then (select f.organizacion_id from asunto_archivos f where f.id = new.referencia_id::uuid)
      when 'tina_conversaciones' then (select c.organizacion_id from tina_conversaciones c where c.id = new.referencia_id::uuid)
    end;
  end if;
  return new;
end;
$$;
revoke all on function public.ia_corridas_empresa() from public, anon, authenticated;

drop trigger if exists ia_corridas_empresa on public.ia_corridas;
create trigger ia_corridas_empresa before insert on public.ia_corridas
  for each row execute function public.ia_corridas_empresa();

-- Las corridas del analizador anotadas antes de esta migración no traían la empresa.
update public.ia_corridas c set organizacion_id = a.organizacion_id
from public.interaccion_analisis a
where c.organizacion_id is null and c.referencia_tabla = 'interaccion_analisis'
  and c.referencia_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and a.id = c.referencia_id::uuid;

-- La llamada de un análisis, descifrada, en cualquier estado. Solo el servidor.
create or replace function public.ia_contenido_analisis(p_analisis uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  a interaccion_analisis%rowtype;
  x interacciones%rowtype;
begin
  select * into a from interaccion_analisis where id = p_analisis;
  if not found then
    return null;
  end if;
  select * into x from interacciones where id = a.interaccion_id;
  if x.contenido_cifrado is null or (x.retener_contenido_hasta is not null and x.retener_contenido_hasta <= now()) then
    return jsonb_build_object('analisis_id', a.id, 'organizacion_id', a.organizacion_id, 'sin_contenido', true);
  end if;
  return jsonb_build_object(
    'analisis_id', a.id,
    'organizacion_id', a.organizacion_id,
    'version', a.version,
    'forzar_venta', a.etapa_pedida = 'venta',
    'titulo', x.titulo,
    'ocurrida_en', x.ocurrida_en,
    'duracion_seg', x.duracion_seg,
    'fuente', x.fuente,
    'contenido', pgp_sym_decrypt(x.contenido_cifrado, crm_clave('interacciones_contenido'))::jsonb,
    'equipo', coalesce((select jsonb_agg(jsonb_build_object('nombre', e.nombre, 'email', lower(trim(e.email))))
                        from equipo_miembros e where e.organizacion_id = x.organizacion_id), '[]'::jsonb),
    'resultado', jsonb_build_object('estado', a.estado, 'etapa', a.etapa, 'confianza', a.confianza, 'codigos', a.codigos,
                                    'banda_final', a.banda_final, 'correcciones', a.correcciones));
end;
$$;
revoke all on function public.ia_contenido_analisis(uuid) from public, anon, authenticated;
grant execute on function public.ia_contenido_analisis(uuid) to service_role;

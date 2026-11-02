-- =====================================================================
-- FIRMA · Portal · Empresa demo para grabar procesos
-- 1. organizaciones.demo marca la empresa demo. Hay una sola.
-- 2. demo_reiniciar(org, firma) deja la demo como nueva: borra su CRM,
--    casos, asuntos y envíos a firma, y carga clientes, cuotas, casos y
--    asuntos ficticios. Servicios, documentos, usuarios y logo quedan.
--    Devuelve las rutas de los archivos que hay que borrar del storage.
-- Solo la llama /api/admin/usuarios (accion demo) con la clave service
-- role. Requiere la 0028. Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.organizaciones add column if not exists demo boolean not null default false;
create unique index if not exists organizaciones_una_demo on public.organizaciones (demo) where demo;

create or replace function public.demo_reiniciar(org uuid, firma uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o organizaciones%rowtype;
  titular uuid;
  s record;
  r jsonb;
  asuntos_archivos text[];
  contratos text[];
  firmas text[] := '{}';
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid;
begin
  select * into o from organizaciones where id = org;
  if not found then raise exception 'No existe esa empresa.'; end if;
  if not o.demo then raise exception 'Solo se reinicia la empresa demo.'; end if;
  select id into titular from perfiles where organizacion_id = org and rol = 'titular' order by creado_en limit 1;

  -- 1. Vaciar ---------------------------------------------------------
  select coalesce(array_agg(ruta), '{}') into asuntos_archivos from asunto_archivos where organizacion_id = org;
  select coalesce(array_agg(pdf_ruta), '{}') into contratos from crm_contratos_firma where organizacion_id = org and pdf_ruta is not null;
  for s in select id from firma_sobres where organizacion_id = org loop
    r := firma_borrar_sobre(s.id);
    firmas := firmas || array_remove(array[r ->> 'original_ruta', r ->> 'final_ruta'], null);
  end loop;
  delete from crm_clientes where organizacion_id = org;
  delete from asuntos where organizacion_id = org;
  delete from crm_historial where organizacion_id = org;

  -- 2. Servicios (si faltan) ------------------------------------------
  insert into crm_servicios (organizacion_id, clave, nombre, precio, activo) values
    (org, '3M', 'Programa 3 meses', 1500, true),
    (org, '6M', 'Programa 6 meses', 2700, true),
    (org, 'MENTORIA', 'Mentoría 1 a 1', 900, true)
  on conflict (organizacion_id, clave) do nothing;

  -- 3. Clientes del CRM -----------------------------------------------
  insert into crm_clientes (organizacion_id, nombre, dni, email, telefono, domicilio, servicio, monto_total, moneda, modalidad, fecha_onboarding, estado_firma, responsable, notas)
  values (org, 'Lucía Fernández', '30111222', 'lucia.fernandez@ejemplo.com', '+54 9 11 5555-0101', 'Av. Corrientes 1234, CABA', '6M', 2700, 'USD', 'Cuotas', now() - interval '40 days', 'Firmado', 'Martina (CSM)', 'Viene por recomendación. Quiere arrancar con el módulo de ventas.')
  returning id into c1;
  insert into crm_clientes (organizacion_id, nombre, dni, email, telefono, domicilio, servicio, monto_total, moneda, modalidad, fecha_onboarding, estado_firma, responsable, notas)
  values (org, 'Martín Gómez', '28333444', 'martin.gomez@ejemplo.com', '+54 9 351 555-0102', 'Bv. San Juan 455, Córdoba', '3M', 1500, 'USD', 'PIF', now() - interval '20 days', 'Firmado', 'Martina (CSM)', null)
  returning id into c2;
  insert into crm_clientes (organizacion_id, nombre, dni, email, telefono, domicilio, servicio, monto_total, moneda, modalidad, fecha_onboarding, estado_firma, responsable, notas)
  values (org, 'Sofía Ramírez', '33555666', 'sofia.ramirez@ejemplo.com', '+54 9 261 555-0103', 'San Martín 980, Mendoza', '6M', 2700, 'USD', 'Cuotas', now() + interval '2 days', 'Pendiente', 'Tomás (closer)', 'Cerró en la llamada del martes. Falta mandarle el contrato.')
  returning id into c3;
  insert into crm_clientes (organizacion_id, nombre, dni, email, telefono, domicilio, servicio, monto_total, moneda, modalidad, fecha_onboarding, estado_firma, responsable, notas)
  values (org, 'Diego Herrera', '27777888', 'diego.herrera@ejemplo.com', '+54 9 341 555-0104', 'Córdoba 1520, Rosario', 'MENTORIA', 900, 'USD', 'PIF', now() - interval '75 days', 'Firmado', 'Martina (CSM)', null)
  returning id into c4;
  insert into crm_clientes (organizacion_id, nombre, dni, email, telefono, domicilio, servicio, monto_total, moneda, modalidad, fecha_onboarding, estado_firma, responsable, notas)
  values (org, 'Valentina Castro', '35999000', 'valentina.castro@ejemplo.com', '+54 9 223 555-0105', 'Güemes 2210, Mar del Plata', '3M', 1500, 'USD', 'Cuotas', now() - interval '55 days', 'Firmado', 'Martina (CSM)', 'Pidió pasar la segunda cuota a fin de mes.')
  returning id into c5;
  insert into crm_clientes (organizacion_id, nombre, dni, email, telefono, domicilio, servicio, monto_total, moneda, modalidad, fecha_onboarding, estado_firma, responsable, notas)
  values (org, 'Joaquín Morales', '31222333', 'joaquin.morales@ejemplo.com', '+54 9 11 5555-0106', 'Cabildo 3300, CABA', '6M', 2700, 'USD', 'Cuotas', now() - interval '120 days', 'Baja', 'Martina (CSM)', 'Pidió la baja en el tercer mes.')
  returning id into c6;

  -- 4. Cuotas -----------------------------------------------------------
  insert into crm_pagos (cliente_id, organizacion_id, monto, vencimiento, estado, fecha_pago, nota) values
    (c1, org, 900, hoy - 40, 'pagado', hoy - 40, 'Primera cuota'),
    (c1, org, 900, hoy - 10, 'pagado', hoy - 9, null),
    (c1, org, 900, hoy + 20, 'pendiente', null, null),
    (c2, org, 1500, hoy - 20, 'pagado', hoy - 20, 'Pago total'),
    (c3, org, 900, hoy + 2, 'pendiente', null, null),
    (c3, org, 900, hoy + 32, 'pendiente', null, null),
    (c3, org, 900, hoy + 62, 'pendiente', null, null),
    (c4, org, 900, hoy - 75, 'pagado', hoy - 75, null),
    (c5, org, 750, hoy - 55, 'pagado', hoy - 55, null),
    (c5, org, 750, hoy - 5, 'pendiente', null, 'Vencida, avisó que paga a fin de mes'),
    (c6, org, 900, hoy - 120, 'pagado', hoy - 120, null),
    (c6, org, 900, hoy - 90, 'pagado', hoy - 88, null),
    (c6, org, 900, hoy - 60, 'pendiente', null, null);

  -- 5. Casos de conflicto (cada uno crea su asunto) ----------------------
  insert into crm_casos (organizacion_id, cliente_id, abierto_en, etapa, semaforo, causa, canal, monto_reclamado, responsable, notas)
  values (org, c5, hoy - 6, 'disconformidad', 'ambar', 'expectativa', 'WhatsApp', 750, 'Martina (CSM)', 'Dice que esperaba más sesiones en vivo. Pide la devolución de la segunda cuota.');
  insert into crm_casos (organizacion_id, cliente_id, abierto_en, cerrado_en, etapa, semaforo, causa, canal, monto_reclamado, decision, responsable, notas)
  values (org, c6, hoy - 70, hoy - 62, 'cerrado', 'verde', 'arrepentimiento', 'Mail', 900, 'alternativa', 'Martina (CSM)', 'Se le ofreció pausar el programa. Aceptó y después pidió la baja.');

  -- 6. Asuntos con FIRMA ------------------------------------------------
  insert into asuntos (organizacion_id, titulo, tipo, estado, proximo_paso, vence_en, cliente_id, creado_por)
  values (org, 'Registro de la marca ante el INPI', 'marca', 'en_curso', 'Esperamos la publicación en el Boletín de Marcas.', hoy + 25, null, firma)
  returning id into a1;
  insert into asuntos (organizacion_id, titulo, tipo, estado, proximo_paso, vence_en, cliente_id, creado_por)
  values (org, 'Contrato de servicios con Lucía Fernández', 'contrato', 'espera_cliente', 'Confirmar si el plazo de 6 meses arranca en el onboarding.', hoy + 5, c1, firma)
  returning id into a2;
  insert into asuntos (organizacion_id, titulo, tipo, estado, proximo_paso, cliente_id, creado_por)
  values (org, 'Actualización de términos y condiciones', 'consulta', 'finalizado', null, null, firma)
  returning id into a3;
  insert into asuntos (organizacion_id, titulo, tipo, estado, proximo_paso, vence_en, cliente_id, creado_por)
  values (org, 'Reclamo por cobro de cuota de Valentina Castro', 'cobranza', 'en_curso', 'Mandar la intimación de pago si no regulariza antes del viernes.', hoy + 4, c5, titular)
  returning id into a4;

  -- Con fechas escalonadas, así la bitácora y el chat se leen en orden.
  insert into asunto_novedades (asunto_id, organizacion_id, texto, tipo, interna, autor_id, creado_en) values
    (a1, org, 'Presentamos la solicitud en las clases 35 y 41.', 'nota', false, firma, now() - interval '30 days'),
    (a1, org, 'El examen de forma salió sin observaciones.', 'nota', false, firma, now() - interval '12 days'),
    (a2, org, 'Mandamos el borrador del contrato con el plazo y la política de reembolsos.', 'nota', false, firma, now() - interval '3 days'),
    (a3, org, 'Publicamos los términos nuevos en la web y avisamos a los clientes activos.', 'nota', false, firma, now() - interval '45 days'),
    (a4, org, 'Revisamos el contrato: la cuota vencida se puede reclamar con intereses.', 'nota', false, firma, now() - interval '2 days');

  insert into asunto_mensajes (asunto_id, organizacion_id, texto, autor_id, creado_en) values
    (a1, org, '¿Para cuándo calculan que sale la marca?', titular, now() - interval '11 days'),
    (a1, org, 'Si no hay oposiciones, en unos 8 a 10 meses. Te avisamos con cada novedad.', firma, now() - interval '11 days' + interval '2 hours'),
    (a2, org, 'Te dejé una duda sobre el plazo en la bitácora. ¿Nos confirmás?', firma, now() - interval '3 days'),
    (a4, org, 'Valentina dice que paga a fin de mes. ¿Esperamos o mandamos la intimación?', titular, now() - interval '1 day'),
    (a4, org, 'Esperemos hasta el viernes. Si no paga, la mandamos ese día.', firma, now() - interval '1 day' + interval '40 minutes');

  -- El historial de la carga no interesa: la ficha arranca limpia.
  delete from crm_historial where organizacion_id = org;

  return jsonb_build_object('asuntos', to_jsonb(asuntos_archivos), 'contratos', to_jsonb(contratos), 'firmas', to_jsonb(firmas));
end;
$$;

revoke all on function public.demo_reiniciar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.demo_reiniciar(uuid, uuid) to service_role;

notify pgrst, 'reload schema';

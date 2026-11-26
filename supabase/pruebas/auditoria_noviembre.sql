-- =====================================================================
-- Arreglos de la auditoría del 26/11/2026 (0081): la respuesta del
-- cliente saca al asunto de «Esperando tu respuesta» y el titular entra
-- a Equipo como Titular.
-- =====================================================================

insert into public.asuntos (id, organizacion_id, titulo, tipo, estado) values
  ('a8100000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Espera al cliente', 'consulta', 'espera_cliente'),
  ('a8100000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'Espera a FIRMA', 'consulta', 'espera_cliente');

-- FIRMA escribe: el asunto sigue esperando al cliente.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into public.asunto_mensajes (asunto_id, texto) values ('a8100000-0000-0000-0000-000000000002', '¿Nos confirmás?');
select pruebas.como_postgres();
select pruebas.ok((select estado from public.asuntos where id = 'a8100000-0000-0000-0000-000000000002') = 'espera_cliente', 'lo que escribe FIRMA no cambia el estado');

-- El titular responde: pasa a En curso y queda en la bitácora.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.asunto_mensajes (asunto_id, texto) values ('a8100000-0000-0000-0000-000000000001', 'Sí, arranca en el onboarding.');
select pruebas.como_postgres();
select pruebas.ok((select estado from public.asuntos where id = 'a8100000-0000-0000-0000-000000000001') = 'en_curso', 'la respuesta del cliente pasa el asunto a En curso');
select pruebas.ok(exists (select 1 from public.asunto_novedades where asunto_id = 'a8100000-0000-0000-0000-000000000001' and tipo = 'estado' and texto = 'El asunto pasó a En curso.'), 'el cambio queda en la bitácora');

-- Un asunto en curso no cambia con una respuesta.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.asunto_mensajes (asunto_id, texto) values ('a8100000-0000-0000-0000-000000000001', 'Otra cosa.');
select pruebas.como_postgres();
select pruebas.ok((select count(*) from public.asunto_novedades where asunto_id = 'a8100000-0000-0000-0000-000000000001' and tipo = 'estado') = 1, 'no hay cambios de estado de más');

-- El titular entra a Equipo como Titular; el closer, con su rol.
select public.equipo_asegurar_usuario('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1');
select public.equipo_asegurar_usuario('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select cargo from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a1') = 'Titular', 'el titular figura como Titular');
select pruebas.ok((select rol_comercial from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a3') = 'closer' and (select cargo from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a3') is null, 'el closer sigue como closer y sin cargo');

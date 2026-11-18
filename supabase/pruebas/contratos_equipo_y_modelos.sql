-- =====================================================================
-- Contratos con el equipo (0068): documentos atados a una persona,
-- vencimiento del contrato y modelos de contrato propios de una empresa.
-- =====================================================================

insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email) values
  ('e0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Closer de A', 'closer', 'closer@a.test'),
  ('e0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Closer de B', 'closer', 'closer@b.test');

-- ---------------------------------------------------------------------
-- Documento atado a una persona
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into public.documentos (id, seccion, organizacion_id, titulo, archivo_ruta, archivo_nombre, areas, equipo_miembro_id, contrato_vence_el) values
  ('d0000000-0000-0000-0000-0000000000e1', 'equipo', 'aaaaaaaa-0000-0000-0000-000000000000', 'Contrato de marketing', 'equipo/m.pdf', 'm.pdf',
   array['direccion'], 'e0000000-0000-0000-0000-00000000000a', current_date + 90);

-- La persona tiene que ser de la empresa del documento.
do $$ begin
  insert into public.documentos (seccion, organizacion_id, titulo, url, equipo_miembro_id) values
    ('equipo', 'aaaaaaaa-0000-0000-0000-000000000000', 'Ajeno', 'https://a.test/x', 'e0000000-0000-0000-0000-00000000000b');
  raise exception 'FALLÓ: un documento quedó atado a alguien de otra empresa';
exception when foreign_key_violation then null;
end $$;

-- Solo en Contratos con tu equipo, y el vencimiento solo con persona.
do $$ begin
  insert into public.documentos (seccion, organizacion_id, titulo, url, equipo_miembro_id) values
    ('servicio', 'aaaaaaaa-0000-0000-0000-000000000000', 'Fuera de sección', 'https://a.test/y', 'e0000000-0000-0000-0000-00000000000a');
  raise exception 'FALLÓ: un contrato de servicio quedó atado al equipo';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.documentos (seccion, organizacion_id, titulo, url, contrato_vence_el) values
    ('equipo', 'aaaaaaaa-0000-0000-0000-000000000000', 'Sin persona', 'https://a.test/z', current_date);
  raise exception 'FALLÓ: un vencimiento sin persona';
exception when check_violation then null;
end $$;

-- El titular lo ve y lo puede bajar.
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.documentos where equipo_miembro_id is not null) = 1, 'el titular ve el contrato de la persona');
select pruebas.ok(public.puede_descargar_documento('equipo/m.pdf'), 'el titular lo baja');

-- El CSM sin Legales ni Operaciones no, aunque tenga el área del documento.
select pruebas.como_postgres();
update public.perfiles set areas = array['direccion'] where id = '00000000-0000-0000-0000-0000000000a2';
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok((select count(*) from public.documentos where equipo_miembro_id is not null) = 0, 'el CSM de Dirección no ve el contrato de la persona');
select pruebas.ok(not public.puede_descargar_documento('equipo/m.pdf'), 'ni lo baja');
select pruebas.como_postgres();
update public.perfiles set areas = array['operaciones'] where id = '00000000-0000-0000-0000-0000000000a2';
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok((select count(*) from public.documentos where equipo_miembro_id is not null) = 1, 'el CSM de Operaciones lo ve');

-- El closer no ve su propio contrato, ni otra empresa.
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.documentos where equipo_miembro_id is not null) = 0, 'el closer no ve el contrato de la persona');
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.documentos where equipo_miembro_id is not null) = 0, 'otro cliente no lo ve');

-- ---------------------------------------------------------------------
-- Vencimiento del contrato en un envío a firma del equipo
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
insert into public.firma_sobres (id, organizacion_id, emisor, titulo, vence_en, creado_por, original_ruta, original_nombre,
                                 original_bytes, original_sha256, original_paginas, entrega, equipo_miembro_id)
values
  ('f0000000-0000-0000-0000-0000000000e8', 'aaaaaaaa-0000-0000-0000-000000000000', 'cliente', 'Contrato de closer', now() + interval '7 days',
   '00000000-0000-0000-0000-0000000000a1', 'e8/original.pdf', 'Contrato.pdf', 1000, repeat('8', 64), 1, 'portal',
   'e0000000-0000-0000-0000-00000000000a'),
  ('f0000000-0000-0000-0000-0000000000e9', 'aaaaaaaa-0000-0000-0000-000000000000', 'cliente', 'Envío común', now() + interval '7 days',
   '00000000-0000-0000-0000-0000000000a1', 'e9/original.pdf', 'Comun.pdf', 1000, repeat('9', 64), 1, 'portal', null);

select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select public.firma_sobre_vencimiento('f0000000-0000-0000-0000-0000000000e8', current_date + 365);
select pruebas.ok((select contrato_vence_el = current_date + 365 from public.firma_sobres where id = 'f0000000-0000-0000-0000-0000000000e8'), 'el titular carga el vencimiento del contrato');
select public.firma_sobre_vencimiento('f0000000-0000-0000-0000-0000000000e8', null);
select pruebas.ok((select contrato_vence_el is null from public.firma_sobres where id = 'f0000000-0000-0000-0000-0000000000e8'), 'y lo puede quitar');

-- Un envío que no es del equipo no lleva vencimiento de contrato.
do $$ begin
  perform public.firma_sobre_vencimiento('f0000000-0000-0000-0000-0000000000e9', current_date);
  raise exception 'FALLÓ: un envío común quedó con vencimiento de contrato';
exception when insufficient_privilege then null;
end $$;

-- El closer y otra empresa no lo cambian.
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
do $$ begin
  perform public.firma_sobre_vencimiento('f0000000-0000-0000-0000-0000000000e8', current_date);
  raise exception 'FALLÓ: el closer cambió el vencimiento';
exception when insufficient_privilege then null;
end $$;
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.firma_sobre_vencimiento('f0000000-0000-0000-0000-0000000000e8', current_date);
  raise exception 'FALLÓ: otro cliente cambió el vencimiento';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------
-- Modelos de contrato propios
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into public.modelos_contrato (id, organizacion_id, titulo, persona, secciones) values
  ('a0de1000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', '  Contrato de   marketing ', 'Prestador',
   '[{"clave":"s1","titulo":"La persona","bajada":"","porContrato":true,"preguntas":[{"clave":"propio_nombre","tipo":"texto","etiqueta":"Nombre completo"}]},
     {"clave":"s2","titulo":"Condiciones","bajada":"","preguntas":[{"clave":"p_plazo","tipo":"texto","etiqueta":"Plazo"}]}]'),
  ('a0de1000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Contrato de B', 'prestador', '[]');
select pruebas.ok((select titulo = 'Contrato de marketing' and persona = 'prestador' from public.modelos_contrato where id = 'a0de1000-0000-0000-0000-00000000000a'), 'el título y la persona se guardan prolijos');

-- El contrato modelo tiene que ser un documento de la empresa.
do $$ begin
  update public.modelos_contrato set documento_id = (select id from public.documentos where titulo = 'Documento de B') where id = 'a0de1000-0000-0000-0000-00000000000a';
  raise exception 'FALLÓ: el modelo quedó con un documento de otra empresa';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;

-- El titular ve los de su empresa, no los cambia ni crea otros.
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.modelos_contrato) = 1, 'el titular ve solo los modelos de su empresa');
update public.modelos_contrato set titulo = 'Cambiado';
select pruebas.ok((select titulo = 'Contrato de marketing' from public.modelos_contrato), 'el cliente no cambia el modelo');
do $$ begin
  insert into public.modelos_contrato (organizacion_id, titulo) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Propio del cliente');
  raise exception 'FALLÓ: el cliente creó un modelo';
exception when insufficient_privilege then null;
end $$;

-- Un pedido con el modelo de otra empresa no entra.
do $$ begin
  insert into public.pedidos_contrato (organizacion_id, modelo, modelo_propio_id, respuestas) values
    ('aaaaaaaa-0000-0000-0000-000000000000', 'propio', 'a0de1000-0000-0000-0000-00000000000b', '{}');
  raise exception 'FALLÓ: un pedido con el modelo de otra empresa';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
when foreign_key_violation then null;
end $$;
-- Ni propio sin modelo, ni closer con modelo.
do $$ begin
  insert into public.pedidos_contrato (organizacion_id, modelo, respuestas) values ('aaaaaaaa-0000-0000-0000-000000000000', 'propio', '{}');
  raise exception 'FALLÓ: un pedido propio sin modelo';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
do $$ begin
  insert into public.pedidos_contrato (organizacion_id, modelo, modelo_propio_id, respuestas) values
    ('aaaaaaaa-0000-0000-0000-000000000000', 'closer', 'a0de1000-0000-0000-0000-00000000000a', '{}');
  raise exception 'FALLÓ: un pedido de closer con modelo propio';
exception when check_violation then null;
end $$;

-- El titular lo completa y lo envía: queda la copia del formulario.
insert into public.pedidos_contrato (organizacion_id, modelo, modelo_propio_id, respuestas) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'propio', 'a0de1000-0000-0000-0000-00000000000a', '{"p_plazo": "12 meses"}');
select pruebas.ok((select formulario is null from public.pedidos_contrato where modelo = 'propio'), 'el borrador no guarda copia del formulario');
insert into public.asuntos (id, organizacion_id, titulo, tipo, estado, creado_por) values
  ('a5000000-0000-0000-0000-000000000068', 'aaaaaaaa-0000-0000-0000-000000000000', 'Contrato de marketing · datos pendientes', 'contrato', 'en_curso', '00000000-0000-0000-0000-0000000000a1');
update public.pedidos_contrato set asunto_id = 'a5000000-0000-0000-0000-000000000068', enviado_en = now() where modelo = 'propio';
select pruebas.ok((select formulario ->> 'titulo' = 'Contrato de marketing' and jsonb_array_length(formulario -> 'secciones') = 2
                   from public.pedidos_contrato where modelo = 'propio'), 'al enviar queda la copia del formulario');

-- Después de enviar completa los datos de la persona y el asunto toma el nombre.
update public.pedidos_contrato set titulo = 'Santiago Ávalos', respuestas = '{"p_plazo": "12 meses", "propio_nombre": "Santiago Ávalos"}' where modelo = 'propio';
select pruebas.ok((select titulo = 'Contrato de marketing · Santiago Ávalos' from public.asuntos where id = 'a5000000-0000-0000-0000-000000000068'), 'el asunto toma el título del modelo y el nombre');
-- Las condiciones ya no.
do $$ begin
  update public.pedidos_contrato set respuestas = '{"p_plazo": "24 meses", "propio_nombre": "Santiago Ávalos"}' where modelo = 'propio';
  raise exception 'FALLÓ: el cliente cambió las condiciones de un pedido enviado';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;

-- FIRMA cambia el modelo y lo enviado no se altera. Con pedidos no se borra; oculto, no se usa.
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
update public.modelos_contrato set titulo = 'Contrato de growth', secciones = '[]', activo = false where id = 'a0de1000-0000-0000-0000-00000000000a';
select pruebas.ok((select formulario ->> 'titulo' = 'Contrato de marketing' from public.pedidos_contrato where modelo = 'propio'), 'un cambio en el modelo no altera lo enviado');
do $$ begin
  delete from public.modelos_contrato where id = 'a0de1000-0000-0000-0000-00000000000a';
  raise exception 'FALLÓ: se borró un modelo con pedidos';
exception when foreign_key_violation then null;
end $$;
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.modelos_contrato) = 0, 'el cliente no ve un modelo oculto');
do $$ begin
  insert into public.pedidos_contrato (organizacion_id, modelo, modelo_propio_id, respuestas) values
    ('aaaaaaaa-0000-0000-0000-000000000000', 'propio', 'a0de1000-0000-0000-0000-00000000000a', '{}');
  raise exception 'FALLÓ: un pedido con un modelo oculto';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;

-- Los de closer y setter siguen como antes.
insert into public.pedidos_contrato (organizacion_id, modelo, respuestas) values ('aaaaaaaa-0000-0000-0000-000000000000', 'closer', '{}');
select pruebas.ok((select count(*) from public.pedidos_contrato where modelo = 'closer') = 1, 'el pedido de closer sigue entrando');
select pruebas.como_postgres();

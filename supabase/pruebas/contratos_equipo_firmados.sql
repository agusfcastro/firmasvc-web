-- =====================================================================
-- Contratos firmados con el equipo (0064): misma empresa y quién los ve.
-- =====================================================================

insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email) values
  ('e0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Closer de A', 'closer', 'closer@a.test'),
  ('e0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Closer de B', 'closer', 'closer@b.test');

-- Contrato del closer de A, mandado por el titular por el portal.
insert into public.firma_sobres (id, organizacion_id, emisor, titulo, vence_en, creado_por, original_ruta, original_nombre,
                                 original_bytes, original_sha256, original_paginas, entrega, equipo_miembro_id)
values
  ('f0000000-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000000', 'cliente', 'Contrato de closer', now() + interval '7 days',
   '00000000-0000-0000-0000-0000000000a1', 'e1/original.pdf', 'Contrato.pdf', 1000, repeat('e', 64), 1, 'portal',
   'e0000000-0000-0000-0000-00000000000a');
select pruebas.ok((select equipo_miembro_id is not null from public.firma_sobres where id = 'f0000000-0000-0000-0000-0000000000e1'), 'el envío queda atado a la persona del equipo');

-- La persona tiene que ser de la empresa del envío.
do $$ begin
  insert into public.firma_sobres (organizacion_id, emisor, titulo, vence_en, original_ruta, original_nombre,
                                   original_bytes, original_sha256, original_paginas, equipo_miembro_id)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'cliente', 'Ajeno', now() + interval '7 days', 'x/original.pdf', 'x.pdf',
          1000, repeat('f', 64), 1, 'e0000000-0000-0000-0000-00000000000b');
  raise exception 'FALLÓ: se ató un envío a alguien de otra empresa';
exception when foreign_key_violation then null;
end $$;

-- Un envío de FIRMA no se ata al equipo, y no va atado al CRM y al equipo a la vez.
do $$ begin
  insert into public.firma_sobres (organizacion_id, emisor, titulo, vence_en, original_ruta, original_nombre,
                                   original_bytes, original_sha256, original_paginas, equipo_miembro_id)
  values (null, 'firma', 'Sin empresa', now() + interval '7 days', 'y/original.pdf', 'y.pdf',
          1000, repeat('0', 64), 1, 'e0000000-0000-0000-0000-00000000000a');
  raise exception 'FALLÓ: un envío sin empresa quedó atado al equipo';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.firma_sobres (organizacion_id, emisor, titulo, vence_en, original_ruta, original_nombre,
                                   original_bytes, original_sha256, original_paginas, equipo_miembro_id, crm_cliente_id)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'cliente', 'Doble', now() + interval '7 days', 'z/original.pdf', 'z.pdf',
          1000, repeat('1', 64), 1, 'e0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a');
  raise exception 'FALLÓ: un envío quedó atado al CRM y al equipo';
exception when check_violation then null;
end $$;

-- El titular lo ve.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok(public.firma_sobre_visible('f0000000-0000-0000-0000-0000000000e1'), 'el titular ve el contrato del equipo');
select pruebas.ok((select count(*) from public.firma_sobres where equipo_miembro_id is not null) = 1, 'el titular lo lista');

-- El CSM sin área no lo ve aunque vaya por el portal; con Legales u Operaciones, sí.
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok(not public.firma_sobre_visible('f0000000-0000-0000-0000-0000000000e1'), 'el CSM sin Legales ni Operaciones no lo ve');
select pruebas.como_postgres();
update public.perfiles set areas = array['operaciones'] where id = '00000000-0000-0000-0000-0000000000a2';
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok(public.firma_sobre_visible('f0000000-0000-0000-0000-0000000000e1'), 'el CSM de Operaciones lo ve');
select pruebas.como_postgres();
update public.perfiles set areas = array['legales'] where id = '00000000-0000-0000-0000-0000000000a2';
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok(public.firma_sobre_visible('f0000000-0000-0000-0000-0000000000e1'), 'el CSM de Legales lo ve');

-- El closer, aunque sea su propio contrato, no lo ve en el portal.
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok(not public.firma_sobre_visible('f0000000-0000-0000-0000-0000000000e1'), 'el closer no ve el contrato del equipo');

-- Otra empresa, nunca.
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok(not public.firma_sobre_visible('f0000000-0000-0000-0000-0000000000e1'), 'otro cliente no lo ve');
select pruebas.ok((select count(*) from public.firma_sobres where equipo_miembro_id is not null) = 0, 'otro cliente no lo lista');
select pruebas.como_postgres();

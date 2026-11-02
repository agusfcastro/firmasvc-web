-- =====================================================================
-- Datos comunes a todas las pruebas. scripts/db/probar.mjs los carga
-- dentro de la transacción de cada prueba, antes de la prueba.
-- Negocio A tiene titular, CSM, closer y setter. Negocio B, un titular.
-- Multi es una persona con membresía en A (CSM) y en B (closer), activa en A.
-- =====================================================================

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@firma.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'titular@a.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'csm@a.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'closer@a.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'setter@a.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'titular@b.test');

insert into public.organizaciones (id, nombre, prefijo_crm) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Negocio A', 'NA'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Negocio B', 'NB');

insert into public.perfiles (id, email, rol, organizacion_id) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@firma.test', 'admin', null),
  ('00000000-0000-0000-0000-0000000000a1', 'titular@a.test', 'titular', 'aaaaaaaa-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a2', 'csm@a.test', 'csm', 'aaaaaaaa-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a3', 'closer@a.test', 'closer', 'aaaaaaaa-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a4', 'setter@a.test', 'setter', 'aaaaaaaa-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b1', 'titular@b.test', 'titular', 'bbbbbbbb-0000-0000-0000-000000000000');

insert into public.crm_clientes (id, organizacion_id, nombre) values
  ('c0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Cliente de A'),
  ('c0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Cliente de B');

insert into public.crm_pagos (cliente_id, monto, vencimiento) values
  ('c0000000-0000-0000-0000-00000000000a', 100, current_date + 30),
  ('c0000000-0000-0000-0000-00000000000b', 100, current_date + 30);

insert into public.crm_casos (organizacion_id, cliente_id, causa) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000a', 'demora'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000b', 'demora');

insert into public.documentos (organizacion_id, seccion, titulo, url) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'servicio', 'Documento de A', 'https://a.test/doc'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'servicio', 'Documento de B', 'https://b.test/doc');

insert into public.abonos (organizacion_id, concepto, monto, moneda, pais, email_pagador) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Abono de A', 100, 'ARS', 'AR', 'pagos@a.test'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Abono de B', 100, 'ARS', 'AR', 'pagos@b.test');

-- Persona con dos negocios. El perfil apunta al activo (A); la membresía
-- de A se crea sola desde el perfil y la de B se carga aparte.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'multi@ab.test');
insert into public.perfiles (id, email, rol, organizacion_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'multi@ab.test', 'csm', 'aaaaaaaa-0000-0000-0000-000000000000');
insert into public.membresias (usuario_id, organizacion_id, rol) values
  ('00000000-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000', 'closer');

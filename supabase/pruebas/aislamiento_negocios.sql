-- =====================================================================
-- Aislamiento entre negocios y permisos por rol, con el modelo actual.
-- Es la línea base: la etapa multitenant tiene que seguir pasándola.
-- Negocio A tiene titular, CSM, closer y setter. Negocio B, un titular.
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

-- ---------------------------------------------------------------------
-- Titular de A: ve lo suyo y nada de B
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');

select pruebas.ok((select count(*) from public.organizaciones) = 1, 'el titular de A ve solo su organización');
select pruebas.ok(not exists (select 1 from public.perfiles where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'el titular de A no ve perfiles de B');
select pruebas.ok((select count(*) from public.crm_clientes) = 1, 'el titular de A ve un solo cliente');
select pruebas.ok(not exists (select 1 from public.crm_clientes where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'el titular de A no ve clientes de B');
select pruebas.ok(not exists (select 1 from public.crm_pagos where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'el titular de A no ve pagos de B');
select pruebas.ok(not exists (select 1 from public.crm_casos where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'el titular de A no ve casos de B');
select pruebas.ok(not exists (select 1 from public.asuntos where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'el titular de A no ve asuntos de B');
select pruebas.ok(not exists (select 1 from public.documentos where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'el titular de A no ve documentos de B');
select pruebas.ok(not exists (select 1 from public.abonos where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'el titular de A no ve abonos de B');
select pruebas.ok((select count(*) from public.abonos) = 1, 'el titular de A ve su abono');
select pruebas.ok(not exists (select 1 from public.registro_accesos), 'el titular no lee el registro de accesos');

do $$
declare
  filas int;
begin
  -- Alta en otro negocio: la rechaza la política.
  begin
    insert into public.crm_clientes (organizacion_id, nombre) values ('bbbbbbbb-0000-0000-0000-000000000000', 'Intruso');
    raise exception 'FALLÓ: el titular de A pudo dar de alta un cliente en B';
  exception when insufficient_privilege then null;
  end;

  -- Edición y borrado en otro negocio: no encuentran la fila.
  update public.crm_clientes set nombre = 'Cambiado' where id = 'c0000000-0000-0000-0000-00000000000b';
  get diagnostics filas = row_count;
  perform pruebas.ok(filas = 0, 'el titular de A no edita clientes de B');

  delete from public.crm_casos where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000';
  get diagnostics filas = row_count;
  perform pruebas.ok(filas = 0, 'el titular de A no borra casos de B');

  -- Mover un cliente propio a otro negocio.
  begin
    update public.crm_clientes set organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'
    where id = 'c0000000-0000-0000-0000-00000000000a';
    raise exception 'FALLÓ: el titular de A pudo mover su cliente a B';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm like 'FALLÓ:%' then raise; end if;
  end;

  -- Pago colgado de un cliente de B: la organización se hereda del cliente y la política lo rechaza.
  begin
    insert into public.crm_pagos (cliente_id, monto) values ('c0000000-0000-0000-0000-00000000000b', 1);
    raise exception 'FALLÓ: el titular de A cargó un pago en un cliente de B';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------
-- Roles dentro de A
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok((select count(*) from public.crm_clientes) = 1, 'el CSM ve los clientes de su negocio');
select pruebas.ok((select count(*) from public.crm_casos) = 1, 'el CSM ve los casos de su negocio');
select pruebas.ok(not exists (select 1 from public.abonos), 'el CSM no ve abonos');

do $$ begin
  update public.crm_clientes set estado_firma = 'Firmado' where id = 'c0000000-0000-0000-0000-00000000000a';
  raise exception 'FALLÓ: el CSM cambió el estado de la firma';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;

select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.crm_clientes) = 1, 'el closer ve los clientes de su negocio');
select pruebas.ok(not exists (select 1 from public.crm_casos), 'el closer no ve casos de conflicto');
select pruebas.ok(not exists (select 1 from public.asuntos), 'el closer no ve asuntos');
select pruebas.ok(not exists (select 1 from public.abonos), 'el closer no ve abonos');

select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok(not exists (select 1 from public.crm_clientes), 'el setter no ve clientes');
select pruebas.ok(not exists (select 1 from public.crm_pagos), 'el setter no ve pagos');
select pruebas.ok(not exists (select 1 from public.documentos where not es_protocolo), 'el setter no ve documentos que no son protocolos');

-- ---------------------------------------------------------------------
-- Admin de FIRMA: con la contraseña sola no ve nada; con el segundo factor, todo
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal1');
select pruebas.ok(not exists (select 1 from public.crm_clientes), 'el admin sin segundo factor no ve clientes');
select pruebas.ok(not exists (select 1 from public.organizaciones), 'el admin sin segundo factor no ve organizaciones');

select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pruebas.ok((select count(*) from public.crm_clientes) = 2, 'el admin con segundo factor ve los clientes de todos');
select pruebas.ok((select count(*) from public.organizaciones) = 2, 'el admin con segundo factor ve todas las organizaciones');

-- ---------------------------------------------------------------------
-- Sin sesión
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
select pruebas.como_anonimo();
do $$ begin
  perform 1 from public.crm_clientes;
  -- Si llega acá, la consulta pasó: tiene que volver vacía.
  perform pruebas.ok(not exists (select 1 from public.crm_clientes), 'sin sesión no se ven clientes');
exception when insufficient_privilege then null;
end $$;

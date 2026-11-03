-- =====================================================================
-- Lecturas en la bitácora: lo sensible y todo lo que abre FIRMA.
-- =====================================================================

insert into public.asuntos (id, organizacion_id, titulo, tipo) values
  ('a5000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Asunto de A', 'consulta');

-- El titular abre la ficha de un cliente suyo: queda, con el negocio y el nombre.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select public.bitacora_lectura('crm_cliente', 'c0000000-0000-0000-0000-00000000000a');
select pruebas.como_postgres();
select pruebas.ok((select organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and detalle ->> 'titulo' like 'Cliente de A%' and not actor_es_staff
                   from public.registro_accesos where accion = 'lectura_cliente'), 'la ficha abierta por el titular queda en A');

-- Abrirla de nuevo enseguida no duplica.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select public.bitacora_lectura('crm_cliente', 'c0000000-0000-0000-0000-00000000000a');
select pruebas.como_postgres();
select pruebas.ok((select count(*) from public.registro_accesos where accion = 'lectura_cliente') = 1, 'una vez cada 30 minutos');

-- Un asunto abierto por el equipo no se anota; el mismo asunto abierto por FIRMA, sí.
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select public.bitacora_lectura('asunto', 'a5000000-0000-0000-0000-00000000000a');
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select public.bitacora_lectura('asunto', 'a5000000-0000-0000-0000-00000000000a');
select public.bitacora_lectura('negocio', 'aaaaaaaa-0000-0000-0000-000000000000');
select pruebas.como_postgres();
select pruebas.ok((select count(*) from public.registro_accesos where accion = 'lectura_asunto') = 1, 'solo FIRMA deja el asunto en la bitácora');
select pruebas.ok((select actor_es_staff from public.registro_accesos where accion = 'lectura_asunto'), 'y queda como de FIRMA');
select pruebas.ok((select organizacion_id from public.registro_accesos where accion = 'acceso_negocio') = 'aaaaaaaa-0000-0000-0000-000000000000',
  'la entrada de FIRMA a un negocio queda en ese negocio');

-- Otro negocio no puede anotar ni enterarse de objetos ajenos.
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select public.bitacora_lectura('crm_cliente', 'c0000000-0000-0000-0000-00000000000a');
select public.bitacora_lectura('negocio', 'aaaaaaaa-0000-0000-0000-000000000000');
select pruebas.como_postgres();
select pruebas.ok(not exists (select 1 from public.registro_accesos where actor_id = '00000000-0000-0000-0000-0000000000b1' and accion like 'lectura%' or
                                (actor_id = '00000000-0000-0000-0000-0000000000b1' and accion = 'acceso_negocio')), 'B no anota nada de A');

-- Sin Blindaje el perfil no es visible y no se anota.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select public.bitacora_lectura('perfil_conductual', 'c0000000-0000-0000-0000-00000000000a');
select pruebas.como_postgres();
select pruebas.ok(not exists (select 1 from public.registro_accesos where accion = 'lectura_perfil'), 'sin la funcionalidad no hay lectura de perfil');
update public.organizaciones set plan_producto = 'blindaje' where id = 'aaaaaaaa-0000-0000-0000-000000000000';
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select public.bitacora_lectura('perfil_conductual', 'c0000000-0000-0000-0000-00000000000a');
select pruebas.como_postgres();
select pruebas.ok(exists (select 1 from public.registro_accesos where accion = 'lectura_perfil'), 'con Blindaje el perfil abierto queda');

-- La cadena sigue entera.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok(public.bitacora_verificar('aaaaaaaa-0000-0000-0000-000000000000') is null, 'las lecturas no rompen la cadena');

-- =====================================================================
-- DNI, teléfono y domicilio cifrados.
-- =====================================================================

select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.crm_clientes (id, organizacion_id, nombre, dni, telefono, domicilio) values
  ('c0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Cliente con datos', '30.123.456', '+54 9 11 5555-1234', 'Av. Siempreviva 742');

-- En la tabla no queda nada en texto plano.
select pruebas.como_postgres();
select pruebas.ok((select dni is null and telefono is null and domicilio is null
  and dni_cifrado is not null and telefono_cifrado is not null and domicilio_cifrado is not null
  from public.crm_clientes where id = 'c0000000-0000-0000-0000-0000000000a2'), 'los tres datos se guardan solo cifrados');
select pruebas.ok(position('30123456' in encode((select dni_cifrado from public.crm_clientes where id = 'c0000000-0000-0000-0000-0000000000a2'), 'escape')) = 0,
  'el cifrado no deja ver el DNI');
select pruebas.ok((select dni_indice from public.crm_clientes where id = 'c0000000-0000-0000-0000-0000000000a2') = public.crm_indice('dni', '30123456'),
  'el índice del DNI no depende de puntos ni espacios');
select pruebas.ok((select telefono_indice from public.crm_clientes where id = 'c0000000-0000-0000-0000-0000000000a2') = public.crm_indice('telefono', '5491155551234'),
  'el índice del teléfono usa solo los dígitos');

-- ---------------------------------------------------------------------
-- Lectura
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select dni = '30.123.456' and telefono = '+54 9 11 5555-1234' and domicilio = 'Av. Siempreviva 742'
  from public.crm_clientes_resumen where id = 'c0000000-0000-0000-0000-0000000000a2'), 'el closer de A los lee descifrados en la vista');

select pruebas.como_postgres();
create temp table cifrado_a on commit drop as
  select organizacion_id, dni_cifrado from public.crm_clientes where id = 'c0000000-0000-0000-0000-0000000000a2';
grant select on cifrado_a to authenticated;
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select public.crm_descifrar(organizacion_id, dni_cifrado) from cifrado_a) is null,
  'el titular de B no descifra un DNI de A aunque tenga el dato cifrado');
do $$ begin
  perform public.crm_cifrar('x');
  raise exception 'FALLÓ: un usuario usó la función de cifrado';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.crm_clave('crm_datos');
  raise exception 'FALLÓ: un usuario leyó la clave';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------
-- Escritura: null deja el dato, '' lo borra, otro valor lo reemplaza
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
create temp table antes on commit drop as
  select dni_cifrado, telefono_cifrado from public.crm_clientes where id = 'c0000000-0000-0000-0000-0000000000a2';
create temp table hist_antes on commit drop as
  select count(*) as n from public.crm_historial where cliente_id = 'c0000000-0000-0000-0000-0000000000a2';

select pruebas.como('00000000-0000-0000-0000-0000000000a1');
update public.crm_clientes set notas = 'sin tocar datos' where id = 'c0000000-0000-0000-0000-0000000000a2';
update public.crm_clientes set dni = '30.123.456' where id = 'c0000000-0000-0000-0000-0000000000a2';
select pruebas.como_postgres();
select pruebas.ok((select c.dni_cifrado = a.dni_cifrado from public.crm_clientes c, antes a where c.id = 'c0000000-0000-0000-0000-0000000000a2'),
  'guardar el mismo DNI o no mandarlo no lo cambia');

select pruebas.como('00000000-0000-0000-0000-0000000000a1');
update public.crm_clientes set telefono = '', dni = '25.000.111' where id = 'c0000000-0000-0000-0000-0000000000a2';
select pruebas.ok((select telefono is null and dni = '25.000.111' from public.crm_clientes_resumen where id = 'c0000000-0000-0000-0000-0000000000a2'),
  'vacío borra el teléfono y un valor nuevo reemplaza el DNI');

-- Escribir las columnas cifradas a mano no tiene efecto.
update public.crm_clientes set dni_cifrado = '\x00'::bytea, dni_indice = 'falso' where id = 'c0000000-0000-0000-0000-0000000000a2';
select pruebas.ok((select dni = '25.000.111' from public.crm_clientes_resumen where id = 'c0000000-0000-0000-0000-0000000000a2'),
  'lo escrito a mano en las columnas cifradas se descarta');

-- ---------------------------------------------------------------------
-- Historial: anota el cambio, nunca el valor
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
select pruebas.ok(not exists (
  select 1 from public.crm_historial
  where cliente_id = 'c0000000-0000-0000-0000-0000000000a2'
    and (cambios::text ~ '30\.?123\.?456|25\.?000\.?111|5555|Siempreviva' or cambios ? 'dni_cifrado' or cambios ? 'dni_indice')),
  'el historial no guarda DNI, teléfono ni domicilio');
select pruebas.ok(exists (
  select 1 from public.crm_historial
  where cliente_id = 'c0000000-0000-0000-0000-0000000000a2' and cambios -> 'dni' ->> 'despues' = '(dato protegido)'),
  'el historial anota que el DNI cambió');
select pruebas.ok(not exists (select 1 from public.crm_clientes where dni is not null or telefono is not null or domicilio is not null),
  'ningún cliente tiene datos en texto plano');

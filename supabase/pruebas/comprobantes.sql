-- =====================================================================
-- Invoices y recibos: numeración correlativa, inmutables y permisos.
-- =====================================================================

-- El closer de A emite. El número que manda se ignora.
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
insert into public.comprobantes (organizacion_id, tipo, numero, cliente_id, fecha, moneda, total, receptor, datos) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'invoice', 77, 'c0000000-0000-0000-0000-00000000000a', current_date, 'USD', 1500, 'Cliente de A', '{}'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'invoice', 77, null, current_date, 'USD', 200, 'Otro', '{}'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'recibo', 1, 'c0000000-0000-0000-0000-00000000000a', current_date, 'ARS', 50000, 'Cliente de A', '{}');
select pruebas.ok(
  (select array_agg(numero order by numero) from public.comprobantes where tipo = 'invoice') = array[1, 2],
  'los invoices de A se numeran 1 y 2');
select pruebas.ok((select numero from public.comprobantes where tipo = 'recibo') = 1, 'los recibos llevan su propia numeración');
select pruebas.ok(
  (select bool_and(creado_por = '00000000-0000-0000-0000-0000000000a3') from public.comprobantes),
  'queda quién emitió');

-- Rechazos.
do $$ begin
  insert into public.comprobantes (organizacion_id, tipo, numero, cliente_id, fecha, moneda, total, receptor, datos)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'invoice', 0, 'c0000000-0000-0000-0000-00000000000b', current_date, 'USD', 1, 'Ajeno', '{}');
  raise exception 'FALLÓ: se emitió a un cliente de otro negocio';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;
do $$ begin
  update public.comprobantes set total = 1 where tipo = 'recibo';
  if found then raise exception 'FALLÓ: el closer editó un comprobante'; end if;
end $$;
do $$ begin
  delete from public.comprobantes where tipo = 'recibo';
  raise exception 'FALLÓ: el closer borró un comprobante';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.comprobantes_fijar_proximo('aaaaaaaa-0000-0000-0000-000000000000', 'invoice', 500);
  raise exception 'FALLÓ: el closer cambió la numeración';
exception when insufficient_privilege then null;
end $$;

-- El titular anula con motivo, pero no edita.
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  update public.comprobantes set total = 1 where tipo = 'recibo';
  raise exception 'FALLÓ: el titular editó un comprobante emitido';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;
do $$ begin
  update public.comprobantes set anulado_en = now() where tipo = 'recibo';
  raise exception 'FALLÓ: se anuló sin motivo';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;
update public.comprobantes set motivo_anulacion = 'Monto mal cargado' where tipo = 'recibo';
select pruebas.ok(
  (select anulado_en is not null and anulado_por = '00000000-0000-0000-0000-0000000000a1' from public.comprobantes where tipo = 'recibo'),
  'el titular anula y queda quién y cuándo');
do $$ begin
  update public.comprobantes set motivo_anulacion = 'Otro motivo' where tipo = 'recibo';
  raise exception 'FALLÓ: se cambió una anulación';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;

-- Numeración: solo hacia adelante.
do $$ begin
  perform public.comprobantes_fijar_proximo('aaaaaaaa-0000-0000-0000-000000000000', 'invoice', 2);
  raise exception 'FALLÓ: la numeración volvió atrás';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;
select public.comprobantes_fijar_proximo('aaaaaaaa-0000-0000-0000-000000000000', 'invoice', 120);
insert into public.comprobantes (organizacion_id, tipo, numero, fecha, moneda, total, receptor, datos)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'invoice', 0, current_date, 'USD', 10, 'Nuevo', '{}');
select pruebas.ok((select max(numero) from public.comprobantes where tipo = 'invoice') = 120, 'sigue desde el número fijado');

insert into public.comprobantes_emisor (organizacion_id, nombre, id_fiscal) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Negocio A LLC', 'EIN 12-3456789');

-- Borrar el cliente no borra lo emitido.
select pruebas.como_postgres();
delete from public.crm_pagos where cliente_id = 'c0000000-0000-0000-0000-00000000000a';
delete from public.crm_casos where cliente_id = 'c0000000-0000-0000-0000-00000000000a';
delete from public.crm_clientes where id = 'c0000000-0000-0000-0000-00000000000a';
select pruebas.ok((select count(*) from public.comprobantes where receptor = 'Cliente de A' and cliente_id is null) = 2, 'borrar el cliente deja los comprobantes');

-- Otros negocios y roles.
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  insert into public.comprobantes_emisor (organizacion_id, nombre) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Pisado')
  on conflict (organizacion_id) do update set nombre = excluded.nombre;
  raise exception 'FALLÓ: la CSM cambió los datos del emisor';
exception when insufficient_privilege then null;
end $$;

select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok(not exists (select 1 from public.comprobantes), 'el setter no ve comprobantes');

select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok(not exists (select 1 from public.comprobantes), 'el titular de B no ve los comprobantes de A');
select pruebas.ok(not exists (select 1 from public.comprobantes_emisor), 'el titular de B no ve el emisor de A');
insert into public.comprobantes (organizacion_id, tipo, numero, fecha, moneda, total, receptor, datos)
values ('bbbbbbbb-0000-0000-0000-000000000000', 'invoice', 0, current_date, 'USD', 10, 'Cliente de B', '{}');
select pruebas.ok((select numero from public.comprobantes) = 1, 'B arranca su propia numeración');

select pruebas.como_postgres();
select pruebas.como_anonimo();
do $$ begin
  perform 1 from public.comprobantes;
  raise exception 'FALLÓ: un anónimo leyó comprobantes';
exception when insufficient_privilege then null;
end $$;

-- =====================================================================
-- Contrato de setter y condiciones precargadas por FIRMA (0062).
-- =====================================================================

-- FIRMA precarga las condiciones del setter de A. Los datos de la persona no se guardan.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into public.esquemas_contrato (organizacion_id, modelo, respuestas) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'setter', '{"comision": "4 %", "setter_nombre": "No va", "closer_algo": "sí va"}');
select pruebas.ok((select de_firma from public.esquemas_contrato where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and modelo = 'setter'),
  'lo que carga FIRMA queda marcado');
select pruebas.ok((select respuestas = '{"comision": "4 %", "closer_algo": "sí va"}'::jsonb from public.esquemas_contrato where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and modelo = 'setter'),
  'el esquema de setter saca los datos del setter y nada más');

-- El titular la ve, pero no la cambia ni la borra.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.esquemas_contrato where modelo = 'setter') = 1, 'el titular ve la precarga de FIRMA');
do $$ begin
  update public.esquemas_contrato set respuestas = '{"comision": "10 %"}' where modelo = 'setter';
  raise exception 'FALLÓ: el cliente cambió la precarga de FIRMA';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;
delete from public.esquemas_contrato where modelo = 'setter';
select pruebas.ok((select count(*) from public.esquemas_contrato where modelo = 'setter') = 1, 'el cliente no borra la precarga de FIRMA');

-- Su propio esquema de closer sí, y no queda marcado.
insert into public.esquemas_contrato (organizacion_id, modelo, respuestas) values ('aaaaaaaa-0000-0000-0000-000000000000', 'closer', '{"comision": "10 %"}');
select pruebas.ok(not (select de_firma from public.esquemas_contrato where modelo = 'closer'), 'el esquema del cliente no queda marcado');
update public.esquemas_contrato set respuestas = '{"comision": "12 %"}' where modelo = 'closer';
delete from public.esquemas_contrato where modelo = 'closer';
select pruebas.ok((select count(*) from public.esquemas_contrato where modelo = 'closer') = 0, 'el cliente borra su propio esquema');

-- B no ve la precarga de A.
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.esquemas_contrato) = 0, 'otro cliente no ve la precarga');

-- Pedido de setter: se envía y después solo cambian los datos del setter.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.asuntos (id, organizacion_id, titulo, tipo, estado) values
  ('a5000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Contrato de setter · datos del setter pendientes', 'contrato', 'en_curso');
insert into public.pedidos_contrato (organizacion_id, modelo, respuestas) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'setter', '{"comision": "4 %"}');
update public.pedidos_contrato set asunto_id = 'a5000000-0000-0000-0000-000000000001', enviado_en = now() where modelo = 'setter';
update public.pedidos_contrato set titulo = 'Lucía Setter', respuestas = '{"comision": "4 %", "setter_nombre": "Lucía Setter"}' where modelo = 'setter';
select pruebas.ok((select titulo from public.asuntos where id = 'a5000000-0000-0000-0000-000000000001') = 'Contrato de setter · Lucía Setter',
  'completar el nombre renombra el asunto de setter');
do $$ begin
  update public.pedidos_contrato set respuestas = '{"comision": "9 %", "setter_nombre": "Lucía Setter"}' where modelo = 'setter';
  raise exception 'FALLÓ: el cliente cambió las condiciones de un pedido enviado';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;
select pruebas.como_postgres();

-- =====================================================================
-- Recibos firmados desde el portal: unión con el recibo, cupo y quién ve.
-- =====================================================================

insert into public.firma_sobres (id, organizacion_id, emisor, titulo, estado, vence_en, creado_por, original_ruta, original_nombre,
                                 original_bytes, original_sha256, original_paginas, final_ruta, final_sha256, completado_en, entrega, lugar_firma)
values
  ('f0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'cliente', 'Recibo 0001', 'completado', now() + interval '1 day',
   '00000000-0000-0000-0000-0000000000a1', 'f1/original.pdf', 'Recibo 0001.pdf', 1000, repeat('a', 64), 1, 'f1/final.pdf', repeat('b', 64), now(), 'portal',
   '{"pagina": 0, "x": 325, "y": 200, "ancho": 220, "alto": 52}'),
  ('f0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'cliente', 'Contrato', 'completado', now() + interval '1 day',
   '00000000-0000-0000-0000-0000000000a1', 'f2/original.pdf', 'Contrato.pdf', 1000, repeat('c', 64), 1, 'f2/final.pdf', repeat('d', 64), now(), 'mail', null);

update public.organizaciones set plan = 'starter' where id = 'aaaaaaaa-0000-0000-0000-000000000000';
select pruebas.como_servicio();
select pruebas.ok((select usados from public.firmas_uso('aaaaaaaa-0000-0000-0000-000000000000')) = 1, 'el recibo firmado no ocupa cupo');
select pruebas.como_postgres();

-- El titular emite el recibo, pero no puede atarle una firma.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.comprobantes (organizacion_id, tipo, numero, fecha, moneda, total, receptor, datos, sobre_id)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'recibo', 0, current_date, 'ARS', 100, 'Cliente de A', '{}', 'f0000000-0000-0000-0000-000000000001');
select pruebas.ok((select sobre_id is null from public.comprobantes), 'el alta ignora sobre_id');
do $$ begin
  update public.comprobantes set sobre_id = 'f0000000-0000-0000-0000-000000000001';
  raise exception 'FALLÓ: el titular ató una firma al recibo';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;

-- El closer ve el envío del recibo, no el contrato del titular.
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok(public.firma_sobre_visible('f0000000-0000-0000-0000-000000000001'), 'el closer ve el recibo firmado');
select pruebas.ok(not public.firma_sobre_visible('f0000000-0000-0000-0000-000000000002'), 'el closer no ve el contrato del titular');

select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok(not public.firma_sobre_visible('f0000000-0000-0000-0000-000000000001'), 'el setter no ve el recibo firmado');

-- El servidor lo ata una sola vez.
select pruebas.como_postgres();
select pruebas.como_servicio();
update public.comprobantes set sobre_id = 'f0000000-0000-0000-0000-000000000001';
select pruebas.ok((select sobre_id = 'f0000000-0000-0000-0000-000000000001' from public.comprobantes), 'el servidor registra la firma');
do $$ begin
  update public.comprobantes set sobre_id = 'f0000000-0000-0000-0000-000000000002';
  raise exception 'FALLÓ: se cambió la firma de un recibo';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;

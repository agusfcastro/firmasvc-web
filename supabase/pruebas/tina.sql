-- =====================================================================
-- Tina (0060): conversaciones, tickets, eventos y suscripciones push.
-- Dos negocios, A y B. Ninguno ve lo del otro, cada persona ve sus
-- conversaciones y las derivaciones existen solo en Eminent.
-- =====================================================================

-- El responsable de un negocio tiene que ser de FIRMA.
do $$
begin
  update public.organizaciones set responsable_id = '00000000-0000-0000-0000-0000000000a1'
  where id = 'aaaaaaaa-0000-0000-0000-000000000000';
  raise exception 'FALLÓ: un titular quedó como responsable de FIRMA';
exception when check_violation then null;
end $$;
update public.organizaciones set responsable_id = '00000000-0000-0000-0000-0000000000ad', plan = 'eminent';
update public.perfiles set telefono = '+54 9 11 2461 7035' where id = '00000000-0000-0000-0000-0000000000ad';

-- El servidor guarda una conversación por negocio.
select pruebas.como_servicio();
insert into public.tina_conversaciones (id, organizacion_id, usuario_id) values
  ('7a000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1'),
  ('7a000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b1');
insert into public.tina_mensajes (organizacion_id, conversacion_id, autor, contenido, camino, tokens_entrada, tokens_salida, costo_usd) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-00000000000a', 'usuario', 'Hola', null, 0, 0, 0),
  ('aaaaaaaa-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-00000000000a', 'tina', 'Hola, ¿en qué te ayudo?', 'accionable', 1200, 40, 0.0042),
  ('bbbbbbbb-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-00000000000b', 'usuario', 'Secreto de B', null, 0, 0, 0);

-- Un mensaje no puede colgar de una conversación de otro negocio.
do $$
begin
  insert into public.tina_mensajes (organizacion_id, conversacion_id, autor, contenido)
  values ('aaaaaaaa-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-00000000000b', 'usuario', 'cruce');
  raise exception 'FALLÓ: un mensaje de A quedó en una conversación de B';
exception when foreign_key_violation then null;
end $$;

-- Ticket de A, que es Eminent: toma al responsable del negocio.
insert into public.tina_tickets (id, organizacion_id, conversacion_id, creado_por, prioridad, categoria, resumen) values
  ('71000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-0000000000a1', 'alta', 'reembolso_contracargo', 'Contracargo de Stripe');
select pruebas.ok((select responsable_id from public.tina_tickets where id = '71000000-0000-0000-0000-00000000000a') = '00000000-0000-0000-0000-0000000000ad',
  'el ticket toma al responsable del negocio');

-- B pasa a Starter: ni el servidor le puede crear un ticket.
select pruebas.como_postgres();
update public.organizaciones set plan = 'starter' where id = 'bbbbbbbb-0000-0000-0000-000000000000';
select pruebas.como_servicio();
do $$
begin
  insert into public.tina_tickets (organizacion_id, categoria, resumen)
  values ('bbbbbbbb-0000-0000-0000-000000000000', 'otro', 'Quiero sumar a mi socio');
  raise exception 'FALLÓ: un negocio Starter tiene un ticket';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------
-- Lo que ve cada uno
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.tina_conversaciones) = 1, 'el titular de A ve solo su conversación');
select pruebas.ok((select count(*) from public.tina_mensajes) = 2, 'el titular de A ve solo sus mensajes');
select pruebas.ok(not exists (select 1 from public.tina_mensajes where contenido = 'Secreto de B'), 'A no lee los mensajes de B');
select pruebas.ok((select count(*) from public.tina_tickets) = 1, 'el titular de A ve su ticket');
do $$
begin
  insert into public.tina_mensajes (organizacion_id, conversacion_id, autor, contenido)
  values ('aaaaaaaa-0000-0000-0000-000000000000', '7a000000-0000-0000-0000-00000000000a', 'tina', 'inventado');
  raise exception 'FALLÓ: una persona escribió un mensaje de Tina';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  insert into public.tina_tickets (organizacion_id, categoria, resumen)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'otro', 'desde el navegador');
  raise exception 'FALLÓ: un cliente creó un ticket sin pasar por el servidor';
exception when insufficient_privilege then null;
end $$;
do $$
declare
  filas int;
begin
  update public.tina_tickets set estado = 'cerrado';
  get diagnostics filas = row_count;
  perform pruebas.ok(filas = 0, 'el titular no cierra tickets');
end $$;

-- El CSM de A no lee la conversación del titular, pero ve el ticket del negocio.
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok((select count(*) from public.tina_conversaciones) = 0, 'el CSM no lee conversaciones ajenas');
select pruebas.ok((select count(*) from public.tina_tickets) = 1, 'el CSM ve los tickets del negocio');

-- El closer de A no ve tickets que no creó.
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.tina_tickets) = 0, 'el closer no ve tickets ajenos');

-- B no ve nada de A.
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.tina_conversaciones) = 1, 'el titular de B ve solo su conversación');
select pruebas.ok((select count(*) from public.tina_mensajes) = 1, 'el titular de B ve solo su mensaje');
select pruebas.ok((select count(*) from public.tina_tickets) = 0, 'B no ve tickets de A');

-- FIRMA ve todo, solo con la verificación en dos pasos.
select pruebas.como('00000000-0000-0000-0000-0000000000ad');
select pruebas.ok((select count(*) from public.tina_conversaciones) = 0, 'el admin sin segundo factor no ve conversaciones');
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pruebas.ok((select count(*) from public.tina_conversaciones) = 2, 'el admin ve todas las conversaciones');
select pruebas.ok((select count(*) from public.tina_mensajes) = 3, 'el admin ve todos los mensajes');
update public.tina_tickets set estado = 'cerrado' where id = '71000000-0000-0000-0000-00000000000a';
select pruebas.ok((select cerrado_en is not null from public.tina_tickets where id = '71000000-0000-0000-0000-00000000000a'), 'el admin cierra el ticket');

-- ---------------------------------------------------------------------
-- Eventos del cliente
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.eventos_cliente (organizacion_id, tipo, fecha, titulo, cliente_id, avisar_responsable) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'onboarding', now(), 'Onboarding de Cliente de A', 'c0000000-0000-0000-0000-00000000000a', true),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'conflicto', now(), 'Pedido de reembolso', 'c0000000-0000-0000-0000-00000000000a', false);
select pruebas.ok((select count(*) from public.eventos_cliente) = 2, 'el titular ve los eventos de su negocio');
select pruebas.ok((select creado_por from public.eventos_cliente limit 1) = '00000000-0000-0000-0000-0000000000a1', 'el evento anota quién lo cargó');
do $$
begin
  insert into public.eventos_cliente (organizacion_id, tipo, fecha, titulo, cliente_id)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'cuota', now(), 'cruce', 'c0000000-0000-0000-0000-00000000000b');
  raise exception 'FALLÓ: un evento de A apunta a un cliente de B';
exception when foreign_key_violation then null;
end $$;

select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.eventos_cliente) = 1, 'el closer ve el onboarding y no el conflicto');

select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok((select count(*) from public.eventos_cliente) = 0, 'el setter no ve eventos');

select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.eventos_cliente) = 0, 'B no ve los eventos de A');
do $$
begin
  insert into public.eventos_cliente (organizacion_id, tipo, fecha, titulo)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'reagendamiento', now(), 'desde B');
  raise exception 'FALLÓ: B cargó un evento en A';
exception when insufficient_privilege then null;
end $$;
do $$
declare
  filas int;
begin
  delete from public.eventos_cliente;
  get diagnostics filas = row_count;
  perform pruebas.ok(filas = 0, 'B no borra eventos de A');
end $$;

-- ---------------------------------------------------------------------
-- Suscripciones push
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.push_suscripciones (usuario_id, endpoint, p256dh, auth)
values ('00000000-0000-0000-0000-0000000000a1', 'https://push.test/a1', 'clave', 'secreto');
do $$
begin
  insert into public.push_suscripciones (usuario_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0000-0000000000b1', 'https://push.test/b1', 'clave', 'secreto');
  raise exception 'FALLÓ: alguien suscribió a otra persona';
exception when insufficient_privilege then null;
end $$;

select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.push_suscripciones) = 0, 'nadie ve las suscripciones de otro');

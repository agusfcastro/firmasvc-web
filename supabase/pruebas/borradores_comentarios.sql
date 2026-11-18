-- =====================================================================
-- Borradores de Tina para los comentarios de documentos (0070): se
-- preparan para los hilos de clientes sin contestar, los ve y los cierra
-- solo FIRMA, y los escribe solo el servidor.
-- =====================================================================

insert into public.asuntos (id, organizacion_id, titulo, tipo) values
  ('a7000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Contrato de A', 'contrato');
insert into public.asunto_archivos (id, asunto_id, organizacion_id, nombre, ruta) values
  ('f7000000-0000-0000-0000-00000000000a', 'a7000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'contrato.docx',
   'aaaaaaaa-0000-0000-0000-000000000000/a7000000-0000-0000-0000-00000000000a/1.docx');

-- El titular abre dos hilos. FIRMA abre uno propio, uno interno y contesta el segundo del titular.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.asunto_comentarios (archivo_id, cita, ancla, texto) values
  ('f7000000-0000-0000-0000-00000000000a', 'plazo de 7 días', '{"inicio": 10, "fin": 25}', 'Queremos 14 días.');
insert into public.asunto_comentarios (archivo_id, texto) values ('f7000000-0000-0000-0000-00000000000a', '¿Se puede firmar esta semana?');
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into public.asunto_comentarios (archivo_id, texto) values ('f7000000-0000-0000-0000-00000000000a', 'Revisen la cláusula 3.');
insert into public.asunto_comentarios (archivo_id, texto, interna) values ('f7000000-0000-0000-0000-00000000000a', 'Ojo con la penal.', true);
select pruebas.como_postgres();
update public.asunto_comentarios set id = 'c7000000-0000-0000-0000-000000000001', creado_en = now() - interval '3 hours' where texto = 'Queremos 14 días.';
update public.asunto_comentarios set id = 'c7000000-0000-0000-0000-000000000002', creado_en = now() - interval '3 hours' where texto = '¿Se puede firmar esta semana?';
update public.asunto_comentarios set id = 'c7000000-0000-0000-0000-000000000003', creado_en = now() - interval '3 hours' where texto = 'Revisen la cláusula 3.';
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into public.asunto_comentarios (archivo_id, padre_id, texto) values ('f7000000-0000-0000-0000-00000000000a', 'c7000000-0000-0000-0000-000000000002', 'Sí, el jueves.');
select pruebas.como_postgres();
update public.asunto_comentarios set creado_en = now() - interval '2 hours' where texto = 'Sí, el jueves.';

-- Espera borrador solo el hilo del cliente que FIRMA no contestó.
select pruebas.ok((select array_agg(comentario_id) from public.comentarios_para_borrador()) = array['c7000000-0000-0000-0000-000000000001'::uuid],
  'espera borrador solo el hilo del cliente sin contestar');
select pruebas.ok((select count(*) from public.comentarios_para_borrador('f7000000-0000-0000-0000-00000000000a')) = 1, 'se filtra por documento');

-- El servidor guarda el borrador y el hilo deja de esperar.
insert into public.comentario_borradores (comentario_id, archivo_id, asunto_id, organizacion_id, hasta, pedido, respuesta, clausula)
select comentario_id, archivo_id, asunto_id, organizacion_id, ultimo, 'Pide 14 días.', 'Dale, lo pasamos a 14 días.', 'El plazo es de 14 días.' from public.comentarios_para_borrador();
select pruebas.ok((select count(*) from public.comentarios_para_borrador()) = 0, 'con borrador, el hilo no vuelve a entrar');

-- Si el cliente escribe de nuevo, se prepara otro.
insert into public.asunto_comentarios (archivo_id, padre_id, texto, autor_id) values
  ('f7000000-0000-0000-0000-00000000000a', 'c7000000-0000-0000-0000-000000000001', 'Mejor 10.', '00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.comentarios_para_borrador()) = 1, 'un mensaje nuevo del cliente pide otro borrador');
update public.comentario_borradores set hasta = now();

-- El cliente no ve los borradores, no los cierra y no puede pedir la lista.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.comentario_borradores) = 0, 'el titular no ve los borradores');
do $$
begin
  begin
    perform public.borrador_cerrar('c7000000-0000-0000-0000-000000000001', 'descartado');
    perform pruebas.ok(false, 'el cliente no cierra un borrador');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'el cliente no cierra un borrador');
  end;
  begin
    perform public.comentarios_para_borrador();
    perform pruebas.ok(false, 'el cliente no pide la lista de hilos');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'el cliente no pide la lista de hilos');
  end;
  begin
    insert into public.comentario_borradores (comentario_id, archivo_id, asunto_id, organizacion_id, hasta, pedido, respuesta)
    values ('c7000000-0000-0000-0000-000000000002', 'f7000000-0000-0000-0000-00000000000a', 'a7000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', now(), 'x', 'x');
    perform pruebas.ok(false, 'el cliente no escribe borradores');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'el cliente no escribe borradores');
  end;
end;
$$;

-- FIRMA lo ve y lo cierra. Tampoco escribe borradores desde el portal.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pruebas.ok((select count(*) from public.comentario_borradores where estado = 'pendiente') = 1, 'FIRMA ve el borrador');
do $$
begin
  update public.comentario_borradores set respuesta = 'Cambiada';
  perform pruebas.ok(false, 'FIRMA no edita el borrador guardado');
exception when others then
  perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'FIRMA no edita el borrador guardado');
end;
$$;
select public.borrador_cerrar('c7000000-0000-0000-0000-000000000001', 'publicado');
select pruebas.ok((select estado = 'publicado' and cerrado_por = '00000000-0000-0000-0000-0000000000ad' from public.comentario_borradores), 'FIRMA cierra el borrador');

-- Un borrador descartado o publicado no se vuelve a preparar. Y se va con el comentario.
select pruebas.como_postgres();
select pruebas.ok((select count(*) from public.comentarios_para_borrador()) = 0, 'lo cerrado no vuelve a entrar');
delete from public.asunto_comentarios where id = 'c7000000-0000-0000-0000-000000000001';
select pruebas.ok((select count(*) from public.comentario_borradores) = 0, 'el borrador se va con el comentario');

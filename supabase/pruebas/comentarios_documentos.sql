-- =====================================================================
-- Comentarios en los documentos de un asunto (0065): los ve y escribe
-- quien ve el asunto, los internos solo FIRMA, y nadie ve los de otro
-- negocio.
-- =====================================================================

insert into public.asuntos (id, organizacion_id, titulo, tipo) values
  ('a6500000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Contrato de A', 'contrato'),
  ('a6500000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Contrato de B', 'contrato');
insert into public.asunto_archivos (id, asunto_id, organizacion_id, nombre, ruta) values
  ('f6500000-0000-0000-0000-00000000000a', 'a6500000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'contrato.pdf',
   'aaaaaaaa-0000-0000-0000-000000000000/a6500000-0000-0000-0000-00000000000a/1.pdf'),
  ('f6500000-0000-0000-0000-00000000000b', 'a6500000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'contrato.pdf',
   'bbbbbbbb-0000-0000-0000-000000000000/a6500000-0000-0000-0000-00000000000b/1.pdf');

-- FIRMA comenta en A: uno visible sobre una frase y uno interno.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into public.asunto_comentarios (archivo_id, cita, ancla, texto) values
  ('f6500000-0000-0000-0000-00000000000a', 'plazo de 30 días', '{"pagina": 1, "inicio": 10, "fin": 26}', '¿Lo pasamos a 15?');
insert into public.asunto_comentarios (archivo_id, texto, interna) values
  ('f6500000-0000-0000-0000-00000000000a', 'Revisar la cláusula penal antes de mandar.', true);
-- Ids fijos para las comprobaciones de abajo.
select pruebas.como_postgres();
update public.asunto_comentarios set id = 'c6500000-0000-0000-0000-000000000001' where interna = false;
update public.asunto_comentarios set id = 'c6500000-0000-0000-0000-000000000002' where interna = true;
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pruebas.ok((select organizacion_id from public.asunto_comentarios where id = 'c6500000-0000-0000-0000-000000000001') = 'aaaaaaaa-0000-0000-0000-000000000000',
  'el comentario toma la empresa del documento');
select pruebas.ok((select count(*) from public.asunto_comentarios) = 2, 'FIRMA ve los dos');

-- El titular de A ve el visible y no el interno, responde y resuelve.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.asunto_comentarios) = 1, 'el titular ve solo el visible');
insert into public.asunto_comentarios (archivo_id, padre_id, texto, cita, ancla) values
  ('f6500000-0000-0000-0000-00000000000a', 'c6500000-0000-0000-0000-000000000001', 'Sí, mejor 15.', 'algo', '{"inicio": 0, "fin": 4}');
select pruebas.ok((select cita is null and autor_id = '00000000-0000-0000-0000-0000000000a1' from public.asunto_comentarios where padre_id = 'c6500000-0000-0000-0000-000000000001'),
  'la respuesta no lleva cita y queda a su nombre');
select public.resolver_comentario('c6500000-0000-0000-0000-000000000001', true);
select pruebas.ok((select resuelto_en is not null from public.asunto_comentarios where id = 'c6500000-0000-0000-0000-000000000001'), 'el titular resuelve el hilo');

do $$
begin
  begin
    insert into public.asunto_comentarios (archivo_id, texto, interna) values ('f6500000-0000-0000-0000-00000000000a', 'Interno trucho', true);
    perform pruebas.ok(false, 'el cliente no deja comentarios internos');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'el cliente no deja comentarios internos');
  end;
  begin
    insert into public.asunto_comentarios (archivo_id, padre_id, texto) values ('f6500000-0000-0000-0000-00000000000a', 'c6500000-0000-0000-0000-000000000002', 'Respondo al interno');
    perform pruebas.ok(false, 'el cliente no responde un hilo interno');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'el cliente no responde un hilo interno');
  end;
  begin
    insert into public.asunto_comentarios (archivo_id, texto) values ('f6500000-0000-0000-0000-00000000000b', 'Comento en B');
    perform pruebas.ok(false, 'el titular de A no comenta documentos de B');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'el titular de A no comenta documentos de B');
  end;
  begin
    perform public.resolver_comentario('c6500000-0000-0000-0000-000000000002', true);
    perform pruebas.ok(false, 'el cliente no resuelve un hilo interno');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'el cliente no resuelve un hilo interno');
  end;
end;
$$;

-- El cliente no borra lo de FIRMA.
delete from public.asunto_comentarios where id = 'c6500000-0000-0000-0000-000000000001';
select pruebas.como_postgres();
select pruebas.ok(exists (select 1 from public.asunto_comentarios where id = 'c6500000-0000-0000-0000-000000000001'), 'el cliente no borra comentarios de FIRMA');

-- B no ve nada de A. El closer de A, sin acceso a asuntos, tampoco.
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.asunto_comentarios) = 0, 'el titular de B no ve comentarios de A');
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.asunto_comentarios) = 0, 'el closer sin cartera no ve comentarios');

-- Al borrar el documento se borran sus comentarios.
select pruebas.como_postgres();
delete from public.asunto_archivos where id = 'f6500000-0000-0000-0000-00000000000a';
select pruebas.ok((select count(*) from public.asunto_comentarios) = 0, 'los comentarios se van con el documento');

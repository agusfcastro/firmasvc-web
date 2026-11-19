-- =====================================================================
-- Versiones de los Word de un asunto (0071): solo FIRMA guarda
-- borradores y publica, el cliente no ve el borrador y el documento del
-- asunto cambia recién al publicar.
-- =====================================================================

insert into public.asuntos (id, organizacion_id, titulo, tipo) values
  ('a7100000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Contrato de A', 'contrato');
insert into public.asunto_archivos (id, asunto_id, organizacion_id, nombre, ruta, bytes) values
  ('f7100000-0000-0000-0000-00000000000a', 'a7100000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Contrato.docx',
   'aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/1.docx', 100),
  ('f7100000-0000-0000-0000-00000000000b', 'a7100000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Anexo.pdf',
   'aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/2.pdf', 100);

-- El titular no guarda borradores ni publica.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  begin
    perform public.version_borrador_guardar('f7100000-0000-0000-0000-00000000000a',
      'borradores/aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/x.docx', 10);
    perform pruebas.ok(false, 'el cliente no guarda borradores');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'el cliente no guarda borradores');
  end;
  begin
    perform public.version_publicar('f7100000-0000-0000-0000-00000000000a',
      'aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/x.docx', 10);
    perform pruebas.ok(false, 'el cliente no publica versiones');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'el cliente no publica versiones');
  end;
end;
$$;

-- FIRMA guarda un borrador. El documento del asunto no cambia.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select public.version_borrador_guardar('f7100000-0000-0000-0000-00000000000a',
  'borradores/aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/b1.docx', 120);
select pruebas.ok((select count(*) from public.asunto_archivo_versiones where estado = 'borrador' and numero is null) = 1, 'queda un borrador sin número');
select pruebas.ok((select ruta like '%/1.docx' from public.asunto_archivos where id = 'f7100000-0000-0000-0000-00000000000a'), 'el borrador no cambia el documento del asunto');

do $$
declare
  r jsonb;
begin
  begin
    perform public.version_borrador_guardar('f7100000-0000-0000-0000-00000000000a',
      'borradores/aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/b2.docx', 130);
    perform pruebas.ok(false, 'no se pisa un borrador que cambió otra persona');
  exception when others then
    perform pruebas.ok(sqlerrm like 'BORRADOR_CAMBIADO%', 'no se pisa un borrador que cambió otra persona');
  end;
  r := public.version_borrador_guardar('f7100000-0000-0000-0000-00000000000a',
    'borradores/aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/b2.docx', 130,
    (select actualizado_en from public.asunto_archivo_versiones where estado = 'borrador'));
  perform pruebas.ok(r ->> 'ruta_anterior' like '%/b1.docx', 'al guardar de nuevo devuelve el archivo anterior');
  perform pruebas.ok((select count(*) from public.asunto_archivo_versiones) = 1, 'sigue habiendo un solo borrador');
  begin
    perform public.version_borrador_guardar('f7100000-0000-0000-0000-00000000000a',
      'aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/b3.docx', 130, null, true);
    perform pruebas.ok(false, 'el borrador no va a la carpeta que ve el cliente');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'el borrador no va a la carpeta que ve el cliente');
  end;
  begin
    perform public.version_borrador_guardar('f7100000-0000-0000-0000-00000000000b',
      'borradores/aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/p.docx', 130);
    perform pruebas.ok(false, 'un PDF no se edita');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'un PDF no se edita');
  end;
end;
$$;

-- El cliente no ve el borrador ni el historial.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.asunto_archivo_versiones) = 0, 'el cliente no ve las versiones');

-- FIRMA publica: el borrador pasa a ser la versión 2 y el original queda como la 1.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
do $$
declare
  r jsonb;
begin
  begin
    perform public.version_publicar('f7100000-0000-0000-0000-00000000000a',
      'borradores/aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/b2.docx', 130);
    perform pruebas.ok(false, 'no se publica desde la carpeta de borradores');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'no se publica desde la carpeta de borradores');
  end;
  r := public.version_publicar('f7100000-0000-0000-0000-00000000000a',
    'aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/v2.docx', 130);
  perform pruebas.ok((r ->> 'numero')::int = 2 and r ->> 'ruta_borrador' like '%/b2.docx', 'publica la versión 2 y devuelve el borrador a borrar');
end;
$$;
select pruebas.ok((select ruta like '%/v2.docx' and bytes = 130 from public.asunto_archivos where id = 'f7100000-0000-0000-0000-00000000000a'), 'el documento del asunto pasa a ser la versión publicada');
select pruebas.ok((select count(*) from public.asunto_archivo_versiones where estado = 'publicada') = 2
  and (select ruta like '%/1.docx' from public.asunto_archivo_versiones where numero = 1)
  and not exists (select 1 from public.asunto_archivo_versiones where estado = 'borrador'), 'el original queda como versión 1 y no queda borrador');
select pruebas.ok(exists (select 1 from public.asunto_novedades where asunto_id = 'a7100000-0000-0000-0000-00000000000a' and texto like 'Actualizó Contrato.docx (versión 2)%'),
  'la publicación queda en la bitácora');

-- Publicar sin borrador previo también suma una versión. Descartar borra el borrador.
select public.version_publicar('f7100000-0000-0000-0000-00000000000a',
  'aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/v3.docx', 140);
select pruebas.ok((select max(numero) from public.asunto_archivo_versiones) = 3, 'la siguiente publicación es la versión 3');
select public.version_borrador_guardar('f7100000-0000-0000-0000-00000000000a',
  'borradores/aaaaaaaa-0000-0000-0000-000000000000/a7100000-0000-0000-0000-00000000000a/b4.docx', 150);
select pruebas.ok(public.version_borrador_descartar('f7100000-0000-0000-0000-00000000000a') like '%/b4.docx', 'descartar devuelve el archivo a borrar');
select pruebas.ok(not exists (select 1 from public.asunto_archivo_versiones where estado = 'borrador'), 'descartar borra el borrador');

-- Nadie escribe la tabla a mano.
do $$
begin
  begin
    insert into public.asunto_archivo_versiones (archivo_id, asunto_id, organizacion_id, ruta)
    values ('f7100000-0000-0000-0000-00000000000a', 'a7100000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'x');
    perform pruebas.ok(false, 'ni FIRMA escribe la tabla a mano');
  exception when others then
    perform pruebas.ok(sqlerrm not like 'FALLÓ%', 'ni FIRMA escribe la tabla a mano');
  end;
end;
$$;

-- Al borrar el documento se van sus versiones.
select pruebas.como_postgres();
delete from public.asunto_archivos where id = 'f7100000-0000-0000-0000-00000000000a';
select pruebas.ok((select count(*) from public.asunto_archivo_versiones) = 0, 'al borrar el documento se borran sus versiones');

-- =====================================================================
-- Contrato modelo con el equipo (0063).
-- =====================================================================

select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into public.documentos (seccion, organizacion_id, titulo, archivo_ruta, archivo_nombre, modelo_contrato) values
  ('equipo', 'aaaaaaaa-0000-0000-0000-000000000000', 'Contrato de setter', 'equipo/x.docx', 'x.docx', 'setter');
select pruebas.ok((select count(*) from public.documentos where modelo_contrato = 'setter') = 1, 'FIRMA carga el contrato modelo de setter');

-- Un solo modelo de setter por empresa.
do $$ begin
  insert into public.documentos (seccion, organizacion_id, titulo, url, modelo_contrato) values
    ('equipo', 'aaaaaaaa-0000-0000-0000-000000000000', 'Otro', 'https://a.test/otro', 'setter');
  raise exception 'FALLÓ: quedaron dos modelos de setter';
exception when unique_violation then null;
end $$;

-- Solo en Contratos con tu equipo y de una empresa.
do $$ begin
  insert into public.documentos (seccion, organizacion_id, titulo, url, modelo_contrato) values
    ('equipo', null, 'Para todos', 'https://a.test/todos', 'closer');
  raise exception 'FALLÓ: un modelo sin empresa';
exception when check_violation then null;
end $$;

-- El titular de A lo ve; el de B no.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.documentos where modelo_contrato = 'setter') = 1, 'el titular ve su contrato modelo');
update public.documentos set modelo_contrato = null where modelo_contrato = 'setter';
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.documentos where modelo_contrato is not null) = 0, 'otro cliente no ve el modelo');
select pruebas.como_postgres();
select pruebas.ok((select count(*) from public.documentos where modelo_contrato = 'setter') = 1, 'el cliente no cambia el modelo');

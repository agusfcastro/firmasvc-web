-- =====================================================================
-- Variables propias de cada negocio.
-- =====================================================================

select pruebas.como('00000000-0000-0000-0000-0000000000a1');

insert into public.org_variables_def (organizacion_id, ambito, clave, etiqueta, tipo, opciones) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'negocio', 'DIAS_GARANTIA', 'Días de garantía', 'numero', null),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'cliente', 'NIVEL', 'Nivel del programa', 'opcion', array['inicial', 'avanzado']),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'cliente', 'INICIO_PROGRAMA', 'Inicio del programa', 'fecha', null);

insert into public.org_variables_valor (organizacion_id, clave, valor) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'DIAS_GARANTIA', '14');
select pruebas.ok((select valor from public.org_variables_valor where clave = 'DIAS_GARANTIA') = '14'::jsonb,
  'el titular completa una variable del negocio');

update public.crm_clientes set datos_extra = '{"NIVEL": "avanzado", "INICIO_PROGRAMA": "2026-11-15"}'
where id = 'c0000000-0000-0000-0000-00000000000a';
select pruebas.ok((select datos_extra ->> 'NIVEL' from public.crm_clientes where id = 'c0000000-0000-0000-0000-00000000000a') = 'avanzado',
  'un cliente guarda sus variables');

-- Rechazos de validación.
do $$
declare
  casos text[][] := array[
    array['update public.crm_clientes set datos_extra = ''{"NIVEL": "experto"}'' where id = ''c0000000-0000-0000-0000-00000000000a''', 'opción que no existe'],
    array['update public.crm_clientes set datos_extra = ''{"INICIO_PROGRAMA": "15/11/2026"}'' where id = ''c0000000-0000-0000-0000-00000000000a''', 'fecha mal escrita'],
    array['update public.crm_clientes set datos_extra = ''{"INICIO_PROGRAMA": "2026-02-30"}'' where id = ''c0000000-0000-0000-0000-00000000000a''', 'fecha que no existe'],
    array['update public.crm_clientes set datos_extra = ''{"INVENTADA": 1}'' where id = ''c0000000-0000-0000-0000-00000000000a''', 'clave que no está definida'],
    array['update public.crm_clientes set datos_extra = ''{"DIAS_GARANTIA": 3}'' where id = ''c0000000-0000-0000-0000-00000000000a''', 'variable del negocio cargada en un cliente'],
    array['insert into public.org_variables_valor (organizacion_id, clave, valor) values (''aaaaaaaa-0000-0000-0000-000000000000'', ''NIVEL'', ''"inicial"'')', 'variable de cliente cargada en el negocio'],
    array['update public.org_variables_valor set valor = ''"catorce"'' where clave = ''DIAS_GARANTIA''', 'texto en una variable numérica'],
    array['insert into public.org_variables_def (organizacion_id, ambito, clave, etiqueta, tipo) values (''aaaaaaaa-0000-0000-0000-000000000000'', ''negocio'', ''DNI'', ''Pisar el DNI'', ''texto'')', 'clave de sistema'],
    array['insert into public.org_variables_def (organizacion_id, ambito, clave, etiqueta, tipo) values (''aaaaaaaa-0000-0000-0000-000000000000'', ''contrato'', ''NIVEL'', ''Repetida'', ''texto'')', 'clave repetida en otro ámbito'],
    array['update public.org_variables_def set tipo = ''texto'' where clave = ''NIVEL''', 'cambio de tipo']
  ];
  i int;
begin
  for i in 1 .. array_length(casos, 1) loop
    begin
      execute casos[i][1];
      raise exception 'FALLÓ: se aceptó %', casos[i][2];
    exception when raise_exception or check_violation or unique_violation then
      if sqlerrm like 'FALLÓ:%' then raise; end if;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.org_variables_def) = 3, 'el closer lee las variables de su negocio');
do $$ begin
  insert into public.org_variables_def (organizacion_id, ambito, clave, etiqueta, tipo)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'negocio', 'OTRA', 'Otra', 'texto');
  raise exception 'FALLÓ: el closer definió una variable';
exception when insufficient_privilege then null;
end $$;

select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok(not exists (select 1 from public.org_variables_def), 'el titular de B no ve las variables de A');
select pruebas.ok(not exists (select 1 from public.org_variables_valor), 'el titular de B no ve los valores de A');
do $$ begin
  insert into public.org_variables_valor (organizacion_id, clave, valor) values ('aaaaaaaa-0000-0000-0000-000000000000', 'DIAS_GARANTIA', '90');
  raise exception 'FALLÓ: el titular de B escribió un valor de A';
exception when insufficient_privilege then null;
end $$;
-- La misma clave en otro negocio es otra variable.
insert into public.org_variables_def (organizacion_id, ambito, clave, etiqueta, tipo)
values ('bbbbbbbb-0000-0000-0000-000000000000', 'negocio', 'DIAS_GARANTIA', 'Garantía', 'numero');
select pruebas.ok((select count(*) from public.org_variables_def) = 1, 'B define su propia DIAS_GARANTIA');

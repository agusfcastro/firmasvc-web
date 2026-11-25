-- =====================================================================
-- Monedas de cada empresa (migración 0072).
-- =====================================================================

select pruebas.ok((select monedas from public.organizaciones where id = 'aaaaaaaa-0000-0000-0000-000000000000') = array['USD'],
  'una empresa arranca solo con USD');
select pruebas.ok((select moneda from public.crm_clientes where id = 'c0000000-0000-0000-0000-00000000000a') = 'USD',
  'los clientes cargados siguen en USD');

-- Sin soles habilitados, el titular no carga un cliente ni un servicio en soles.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  insert into public.crm_clientes (organizacion_id, nombre, moneda) values ('aaaaaaaa-0000-0000-0000-000000000000', 'En soles', 'PEN');
  raise exception 'FALLÓ: se cargó un cliente en una moneda no habilitada';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.crm_servicios (organizacion_id, clave, precio, moneda) values ('aaaaaaaa-0000-0000-0000-000000000000', 'DESA', 1000, 'PEN');
  raise exception 'FALLÓ: se cargó un servicio en una moneda no habilitada';
exception when check_violation then null;
end $$;

-- El titular no habilita monedas: la política de edición de organizaciones es solo del admin.
update public.organizaciones set monedas = array['USD', 'PEN'] where id = 'aaaaaaaa-0000-0000-0000-000000000000';
select pruebas.como_postgres();
select pruebas.ok((select monedas from public.organizaciones where id = 'aaaaaaaa-0000-0000-0000-000000000000') = array['USD'],
  'el titular no cambia las monedas de su empresa');

-- FIRMA habilita los soles.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
update public.organizaciones set monedas = array['USD', 'PEN'] where id = 'aaaaaaaa-0000-0000-0000-000000000000';
do $$
declare
  casos text[] := array[
    'update public.organizaciones set monedas = array[]::text[] where id = ''aaaaaaaa-0000-0000-0000-000000000000''',
    'update public.organizaciones set monedas = array[''USD'', ''BRL''] where id = ''aaaaaaaa-0000-0000-0000-000000000000'''
  ];
  i int;
begin
  for i in 1 .. array_length(casos, 1) loop
    begin
      execute casos[i];
      raise exception 'FALLÓ: se aceptó %', casos[i];
    exception when check_violation then null;
    end;
  end loop;
end $$;
select pruebas.como_postgres();
select pruebas.ok((select monedas from public.organizaciones where id = 'aaaaaaaa-0000-0000-0000-000000000000') = array['USD', 'PEN'],
  'el admin habilita USD y soles');

-- Con soles habilitados, el titular carga clientes y servicios en soles.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.crm_servicios (organizacion_id, clave, precio, moneda) values ('aaaaaaaa-0000-0000-0000-000000000000', 'DESA', 12000, 'PEN');
insert into public.crm_clientes (organizacion_id, nombre, moneda) values ('aaaaaaaa-0000-0000-0000-000000000000', 'En soles', 'PEN');
update public.crm_clientes set moneda = 'PEN' where id = 'c0000000-0000-0000-0000-00000000000a';
select pruebas.como_postgres();
select pruebas.ok((select count(*) from public.crm_clientes where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and moneda = 'PEN') = 2,
  'el titular carga y cambia clientes a soles');
select pruebas.ok((select moneda from public.crm_servicios where clave = 'DESA') = 'PEN', 'un servicio guarda la moneda de su ticket');

-- Una moneda que no existe no entra ni habilitada.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  insert into public.crm_servicios (organizacion_id, clave, moneda) values ('aaaaaaaa-0000-0000-0000-000000000000', 'OTRO', 'BRL');
  raise exception 'FALLÓ: se cargó un servicio en una moneda desconocida';
exception when check_violation then null;
end $$;

-- Si FIRMA deshabilita una moneda, los clientes que ya la usan se siguen editando, pero no se pasa nadie nuevo a ella.
select pruebas.como_postgres();
update public.organizaciones set monedas = array['USD'] where id = 'aaaaaaaa-0000-0000-0000-000000000000';
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
update public.crm_clientes set notas = 'Sigue en soles' where id = 'c0000000-0000-0000-0000-00000000000a';
update public.crm_clientes set moneda = 'PEN', notas = 'Mismo valor' where id = 'c0000000-0000-0000-0000-00000000000a';
select pruebas.como_postgres();
select pruebas.ok((select notas from public.crm_clientes where id = 'c0000000-0000-0000-0000-00000000000a') = 'Mismo valor',
  'un cliente en una moneda ya deshabilitada se sigue editando');
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
update public.crm_clientes set moneda = 'USD' where id = 'c0000000-0000-0000-0000-00000000000a';
do $$ begin
  update public.crm_clientes set moneda = 'PEN' where id = 'c0000000-0000-0000-0000-00000000000a';
  raise exception 'FALLÓ: se volvió a pasar un cliente a una moneda deshabilitada';
exception when check_violation then null;
end $$;

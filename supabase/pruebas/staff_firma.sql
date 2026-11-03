-- =====================================================================
-- Staff de FIRMA como marca propia.
-- =====================================================================

select pruebas.ok((select es_staff_firma from public.perfiles where id = '00000000-0000-0000-0000-0000000000ad'), 'el admin es staff de FIRMA');
select pruebas.ok(not (select es_staff_firma from public.perfiles where id = '00000000-0000-0000-0000-0000000000a1'), 'el titular no');

-- Alguien de FIRMA no queda dentro de un negocio.
do $$
begin
  update public.perfiles set organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' where id = '00000000-0000-0000-0000-0000000000ad';
  raise exception 'FALLÓ: el staff quedó con negocio';
exception when check_violation then null;
end $$;

-- es_staff() pide la verificación en dos pasos, como es_admin().
select pruebas.como('00000000-0000-0000-0000-0000000000ad');
select pruebas.ok(not public.es_staff(), 'sin dos pasos no es staff');
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pruebas.ok(public.es_staff(), 'con dos pasos sí');
select pruebas.como('00000000-0000-0000-0000-0000000000a1', 'aal2');
select pruebas.ok(not public.es_staff(), 'un titular nunca');

-- La columna se calcula sola: no se escribe.
select pruebas.como_postgres();
do $$
begin
  update public.perfiles set es_staff_firma = true where id = '00000000-0000-0000-0000-0000000000a1';
  raise exception 'FALLÓ: se escribió es_staff_firma';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;

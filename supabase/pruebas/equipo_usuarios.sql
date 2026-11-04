-- =====================================================================
-- Equipo unido a los usuarios del portal (0056) y equipo_sumar.
-- =====================================================================

update public.perfiles set nombre = 'María Pérez' where id = '00000000-0000-0000-0000-0000000000a2';
update public.perfiles set nombre = 'Juan Closer' where id = '00000000-0000-0000-0000-0000000000a3';

-- Por mail.
insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email) values
  ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Otro nombre', 'closer', 'Closer@A.test');
select pruebas.ok((select usuario_id from public.equipo_miembros where id = 'e1000000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-0000000000a3',
  'un integrante se une a su usuario por mail');

-- Por nombre, sin tildes ni mayúsculas.
insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial) values
  ('e1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', '  maria   PEREZ ', 'csm');
select pruebas.ok((select usuario_id from public.equipo_miembros where id = 'e1000000-0000-0000-0000-000000000002') = '00000000-0000-0000-0000-0000000000a2',
  'un integrante se une a su usuario por nombre');

-- Un usuario de otro negocio no se une.
update public.perfiles set nombre = 'Titular B' where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial) values
  ('e1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000000', 'Titular B', 'otro');
select pruebas.ok((select usuario_id from public.equipo_miembros where id = 'e1000000-0000-0000-0000-000000000003') is null,
  'no se une a un usuario de otro negocio');

-- Alguien que entra después al portal se une a quien lo esperaba en el equipo.
insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial) values
  ('e1000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000000', 'Ana Nueva', 'account_manager');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a5', 'ana@a.test');
insert into public.perfiles (id, email, nombre, rol, organizacion_id) values
  ('00000000-0000-0000-0000-0000000000a5', 'ana@a.test', 'Ana Nueva', 'csm', 'aaaaaaaa-0000-0000-0000-000000000000');
select pruebas.ok((select usuario_id from public.equipo_miembros where id = 'e1000000-0000-0000-0000-000000000004') = '00000000-0000-0000-0000-0000000000a5',
  'quien entra al portal después se une a su lugar en el equipo');

-- equipo_sumar: un CSM suma a alguien nuevo y, con el mismo nombre, reusa al existente.
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
create temp table sumados as
  select public.equipo_sumar('aaaaaaaa-0000-0000-0000-000000000000', 'Pedro Gómez', 'closer') as primero,
         public.equipo_sumar('aaaaaaaa-0000-0000-0000-000000000000', 'pedro gomez', 'csm') as segundo;
select pruebas.ok((select primero = segundo from sumados), 'equipo_sumar reusa a quien tiene el mismo nombre');
select pruebas.ok((select count(*) from public.equipo_miembros where nombre = 'Pedro Gómez') = 1, 'equipo_sumar no duplica');

-- No puede sumar en otro negocio.
do $$ begin
  perform public.equipo_sumar('bbbbbbbb-0000-0000-0000-000000000000', 'Intruso', 'closer');
  raise exception 'FALLÓ: se sumó a alguien en otro negocio';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;
select pruebas.como_postgres();

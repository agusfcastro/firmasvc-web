-- =====================================================================
-- Bitácora por negocio, encadenada e inmutable.
-- =====================================================================

-- Las inserciones de la API no indican negocio: se toma del perfil o del detalle.
insert into public.registro_accesos (usuario_id, actor_id, accion) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'ingreso'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', 'ingreso'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'ingreso');
insert into public.registro_accesos (usuario_id, actor_id, accion, detalle) values
  (null, '00000000-0000-0000-0000-0000000000ad', 'aviso_documento', '{"organizacion_id": "aaaaaaaa-0000-0000-0000-000000000000"}');

select pruebas.ok((select count(*) from public.registro_accesos where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000'
  and accion in ('ingreso', 'aviso_documento')) = 3, 'los dos ingresos de A y el aviso quedan en A');
select pruebas.ok((select organizacion_id from public.registro_accesos where usuario_id = '00000000-0000-0000-0000-0000000000b1') = 'bbbbbbbb-0000-0000-0000-000000000000',
  'el ingreso del titular de B queda en B');
create temp table cuenta_a on commit drop as
  select count(*) as n from public.registro_accesos where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000';
grant select on cuenta_a to authenticated;
select pruebas.ok((select actor_es_staff from public.registro_accesos where accion = 'aviso_documento'),
  'lo que hace un admin queda marcado como de FIRMA');
select pruebas.ok((select count(*) from public.registro_accesos where hash is null) = 0, 'todos los registros nuevos tienen hash');
select pruebas.ok((select count(*) from public.registro_accesos where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and hash_previo is null) = 1,
  'cada negocio tiene una sola cadena');

-- ---------------------------------------------------------------------
-- Lectura y verificación
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.registro_accesos) = (select n from cuenta_a), 'el titular de A lee toda la bitácora de A');
select pruebas.ok(not exists (select 1 from public.registro_accesos where organizacion_id is distinct from 'aaaaaaaa-0000-0000-0000-000000000000'),
  'y nada de otro negocio');
select pruebas.ok(exists (select 1 from public.registro_accesos where actor_es_staff), 'el titular ve lo que hizo FIRMA en su negocio');
select pruebas.ok(public.bitacora_verificar('aaaaaaaa-0000-0000-0000-000000000000') is null, 'la cadena de A cierra');
do $$ begin
  perform public.bitacora_verificar('bbbbbbbb-0000-0000-0000-000000000000');
  raise exception 'FALLÓ: el titular de A verificó la bitácora de B';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;

select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok(not exists (select 1 from public.registro_accesos), 'el CSM no lee la bitácora');

-- ---------------------------------------------------------------------
-- Inmutable, aun para postgres
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
do $$ begin
  update public.registro_accesos set accion = 'otra cosa' where accion = 'aviso_documento';
  raise exception 'FALLÓ: se editó la bitácora';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;
do $$ begin
  delete from public.registro_accesos;
  raise exception 'FALLÓ: se borró la bitácora';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;

-- Una alteración por fuera de los triggers se detecta.
alter table public.registro_accesos disable trigger bitacora_inmutable;
update public.registro_accesos set detalle = '{"organizacion_id": "aaaaaaaa-0000-0000-0000-000000000000", "manipulado": true}' where accion = 'aviso_documento';
alter table public.registro_accesos enable trigger bitacora_inmutable;
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pruebas.ok(public.bitacora_verificar('aaaaaaaa-0000-0000-0000-000000000000') is not null, 'la verificación detecta el registro alterado');
select pruebas.ok(public.bitacora_verificar('bbbbbbbb-0000-0000-0000-000000000000') is null, 'la cadena de B sigue entera');

-- Borrar un usuario no toca su historia.
select pruebas.como_postgres();
delete from public.perfiles where id = '00000000-0000-0000-0000-0000000000a2';
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a2';
select pruebas.ok(exists (select 1 from public.registro_accesos where usuario_id = '00000000-0000-0000-0000-0000000000a2'),
  'el registro de un usuario borrado se conserva con su id');

-- =====================================================================
-- Los usuarios de la empresa aparecen solos en Equipo (0058).
-- _datos.sql deja el equipo vacío: se vuelve a correr el alta como la
-- corrió la migración con los usuarios que ya estaban.
-- =====================================================================

select public.equipo_asegurar_usuario(m.organizacion_id, m.usuario_id) from public.membresias m where m.activa;

select pruebas.ok((select count(*) from public.equipo_miembros where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000') = 5,
  'cada usuario de A (titular, CSM, closer, setter y multi) está en el equipo de A');
select pruebas.ok((select count(*) from public.equipo_miembros where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000') = 2,
  'el titular de B y multi están en el equipo de B');
select pruebas.ok(not exists (select 1 from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000ad'),
  'los admin de FIRMA no aparecen en ningún equipo');
select pruebas.ok((select rol_comercial from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a3') = 'closer',
  'el closer del portal entra como closer');
select pruebas.ok((select rol_comercial from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a1') = 'otro',
  'el titular entra como otro');
select pruebas.ok((select nombre || ' ' || email from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a2') = 'csm csm@a.test',
  'sin nombre en el perfil, entra con la parte del mail y su mail');

-- Correrlo de nuevo no duplica.
select public.equipo_asegurar_usuario(m.organizacion_id, m.usuario_id) from public.membresias m where m.activa;
select pruebas.ok((select count(*) from public.equipo_miembros) = 7, 'volver a correrlo no duplica');

-- Al cargar su nombre, el integrante lo toma.
update public.perfiles set nombre = 'María Pérez' where id = '00000000-0000-0000-0000-0000000000a2';
select pruebas.ok((select nombre from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a2') = 'María Pérez',
  'el integrante toma el nombre que carga en su perfil');

-- Un nombre puesto a mano en Equipo no se pisa.
update public.equipo_miembros set nombre = 'Juan (closer senior)' where usuario_id = '00000000-0000-0000-0000-0000000000a3';
update public.perfiles set nombre = 'Juan Closer' where id = '00000000-0000-0000-0000-0000000000a3';
select pruebas.ok((select nombre from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a3') = 'Juan (closer senior)',
  'no pisa el nombre puesto a mano en Equipo');

-- Alguien nuevo en el negocio entra solo al equipo.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a6', 'nuevo@a.test');
insert into public.perfiles (id, email, nombre, rol, organizacion_id) values
  ('00000000-0000-0000-0000-0000000000a6', 'nuevo@a.test', 'Nuevo Setter', 'setter', 'aaaaaaaa-0000-0000-0000-000000000000');
select pruebas.ok((select nombre = 'Nuevo Setter' and rol_comercial = 'setter' and activo from public.equipo_miembros
                    where usuario_id = '00000000-0000-0000-0000-0000000000a6' and organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  'quien se suma al negocio aparece en el equipo');

-- Si ya lo esperaban en Equipo, se une a ese integrante y no crea otro.
insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email) values
  ('e5800000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Lucía Account', 'account_manager', 'lucia@a.test');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a7', 'lucia@a.test');
insert into public.perfiles (id, email, nombre, rol, organizacion_id) values
  ('00000000-0000-0000-0000-0000000000a7', 'lucia@a.test', 'Lucía', 'csm', 'aaaaaaaa-0000-0000-0000-000000000000');
select pruebas.ok((select count(*) from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a7') = 1,
  'no duplica a quien ya estaba cargado');
select pruebas.ok((select usuario_id from public.equipo_miembros where id = 'e5800000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-0000000000a7',
  'se une al integrante que lo esperaba, con su rol');

-- Deja el negocio: queda inactivo. Vuelve: se reactiva.
update public.membresias set activa = false
 where usuario_id = '00000000-0000-0000-0000-0000000000a6' and organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000';
select pruebas.ok((select not activo from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a6'),
  'al dejar el negocio queda inactivo');
update public.membresias set activa = true
 where usuario_id = '00000000-0000-0000-0000-0000000000a6' and organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000';
select pruebas.ok((select activo from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a6'),
  'al volver se reactiva');
select pruebas.ok((select count(*) from public.equipo_miembros where usuario_id = '00000000-0000-0000-0000-0000000000a6') = 1,
  'volver no duplica');

-- Los usuarios del negocio no pueden correr el alta a mano.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.equipo_asegurar_usuario('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1');
  raise exception 'FALLÓ: un usuario corrió equipo_asegurar_usuario';
exception when insufficient_privilege then null;
end $$;
select pruebas.como_postgres();

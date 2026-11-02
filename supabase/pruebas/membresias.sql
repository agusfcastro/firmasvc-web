-- =====================================================================
-- Membresías: una persona en dos negocios trabaja en uno por vez.
-- Multi es CSM en A (activa) y closer en B.
-- =====================================================================

-- Los perfiles de hoy tienen su membresía.
select pruebas.ok(
  (select count(*) from public.membresias where usuario_id = '00000000-0000-0000-0000-0000000000a1'
     and organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and rol = 'titular') = 1,
  'el alta de un perfil crea su membresía');
select pruebas.ok(not exists (select 1 from public.membresias where usuario_id = '00000000-0000-0000-0000-0000000000ad'),
  'el admin de FIRMA no tiene membresías');

-- ---------------------------------------------------------------------
-- Activa en A: ve A y no B
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000c1');
select pruebas.ok(public.mi_organizacion() = 'aaaaaaaa-0000-0000-0000-000000000000', 'multi arranca en A');
select pruebas.ok((select count(*) from public.crm_clientes) = 1
  and not exists (select 1 from public.crm_clientes where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  'en A ve solo los clientes de A');
select pruebas.ok((select count(*) from public.crm_casos) = 1, 'en A, como CSM, ve los casos');
select pruebas.ok((select count(*) from public.organizaciones) = 2, 've los dos negocios para elegir');
select pruebas.ok((select count(*) from public.membresias) = 2, 've sus dos membresías');

-- ---------------------------------------------------------------------
-- Pasa a B: ve B con el rol de B
-- ---------------------------------------------------------------------
select public.cambiar_organizacion('bbbbbbbb-0000-0000-0000-000000000000');
select pruebas.ok(public.mi_organizacion() = 'bbbbbbbb-0000-0000-0000-000000000000', 'pasa a B');
select pruebas.ok(public.mi_rol() = 'closer', 'en B tiene el rol de B');
select pruebas.ok(not exists (select 1 from public.crm_clientes where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  'en B ya no ve los clientes de A');
select pruebas.ok((select count(*) from public.crm_clientes) = 1, 'en B ve los clientes de B');
select pruebas.ok(not exists (select 1 from public.crm_casos), 'en B, como closer, no ve casos');

-- No puede pasar a un negocio del que no es miembro.
select pruebas.como_postgres();
insert into public.organizaciones (id, nombre) values ('cccccccc-0000-0000-0000-000000000000', 'Negocio C');
select pruebas.como('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  perform public.cambiar_organizacion('cccccccc-0000-0000-0000-000000000000');
  raise exception 'FALLÓ: pasó a un negocio del que no es miembro';
exception when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;

-- No puede escribir membresías desde el navegador.
do $$ begin
  insert into public.membresias (usuario_id, organizacion_id, rol)
  values ('00000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-000000000000', 'titular');
  raise exception 'FALLÓ: se dio una membresía a sí mismo';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------
-- Desactivar la membresía activa corta el acceso a ese negocio
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
update public.membresias set activa = false
where usuario_id = '00000000-0000-0000-0000-0000000000c1' and organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000';
select pruebas.como('00000000-0000-0000-0000-0000000000c1');
select pruebas.ok(public.mi_organizacion() is null, 'con la membresía desactivada no tiene organización');
select pruebas.ok(not exists (select 1 from public.crm_clientes), 'con la membresía desactivada no ve clientes');
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000c1');
select public.cambiar_organizacion('aaaaaaaa-0000-0000-0000-000000000000');
select pruebas.ok(public.mi_rol() = 'csm' and (select count(*) from public.crm_clientes) = 1, 'vuelve a A con su rol de A');

-- ---------------------------------------------------------------------
-- Cambiar el rol en la membresía activa se refleja en el perfil
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
update public.membresias set rol = 'setter'
where usuario_id = '00000000-0000-0000-0000-0000000000c1' and organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000';
select pruebas.ok((select rol::text from public.perfiles where id = '00000000-0000-0000-0000-0000000000c1') = 'setter',
  'el rol nuevo pasa al perfil');

-- Y editar el perfil desde la administración actualiza la membresía.
update public.perfiles set rol = 'csm' where id = '00000000-0000-0000-0000-0000000000c1';
select pruebas.ok((select rol::text from public.membresias where usuario_id = '00000000-0000-0000-0000-0000000000c1'
  and organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000') = 'csm', 'el perfil editado pasa a la membresía');

-- ---------------------------------------------------------------------
-- El titular ve las membresías de su negocio, no las de otros
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok(not exists (select 1 from public.membresias where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  'el titular de A no ve membresías de B');
select pruebas.ok((select count(*) from public.membresias where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000') = 5,
  'el titular de A ve las cinco membresías de A');
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok((select count(*) from public.membresias) = 1, 'el CSM ve solo la suya');

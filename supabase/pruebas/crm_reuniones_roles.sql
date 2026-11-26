-- =====================================================================
-- Paso 1 del CRM (migración 0078): un solo nombre por rol y reuniones.
-- =====================================================================

create function pruebas.falla(consulta text, espera text) returns void language plpgsql as $$
begin
  begin
    execute consulta;
  exception when others then
    if sqlerrm not ilike '%' || espera || '%' then
      raise exception 'FALLÓ: se esperaba «%» y salió «%»', espera, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FALLÓ: tenía que rechazarse: %', consulta;
end;
$$;
grant execute on function pruebas.falla(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- CSM es Account Manager
-- ---------------------------------------------------------------------
insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, usuario_id) values
  ('e0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Account de A', 'csm', '00000000-0000-0000-0000-0000000000a2'),
  ('e0000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000000', 'Closer de A', 'closer', '00000000-0000-0000-0000-0000000000a3'),
  ('e0000000-0000-0000-0000-0000000000a4', 'aaaaaaaa-0000-0000-0000-000000000000', 'Setter de A', 'setter', '00000000-0000-0000-0000-0000000000a4'),
  ('e0000000-0000-0000-0000-0000000000b3', 'bbbbbbbb-0000-0000-0000-000000000000', 'Closer de B', 'closer', null);
select pruebas.ok((select rol_comercial from public.equipo_miembros where id = 'e0000000-0000-0000-0000-0000000000a2') = 'account_manager', 'un CSM entra como Account Manager');
update public.equipo_miembros set rol_comercial = 'csm' where id = 'e0000000-0000-0000-0000-0000000000a3';
select pruebas.ok((select rol_comercial from public.equipo_miembros where id = 'e0000000-0000-0000-0000-0000000000a3') = 'account_manager', 'y también al cambiarle el rol');
update public.equipo_miembros set rol_comercial = 'closer' where id = 'e0000000-0000-0000-0000-0000000000a3';
insert into public.equipo_miembros (organizacion_id, nombre, rol_comercial, cargo) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Directora de A', 'otro', ' coo ');
select pruebas.ok((select cargo from public.equipo_miembros where nombre = 'Directora de A') = 'COO', 'los cargos de dirección se escriben siempre igual');
select pruebas.ok(not exists (select 1 from public.equipo_reportes where rol_comercial = 'csm') and not exists (select 1 from public.equipo_hitos where rol_comercial = 'csm'),
  'no quedan plantillas de CSM');
select pruebas.ok(exists (select 1 from public.equipo_reportes where organizacion_id is null and rol_comercial = 'account_manager'), 'queda la de Account Manager');

-- ---------------------------------------------------------------------
-- Reuniones
-- ---------------------------------------------------------------------
-- El closer carga una de venta con un prospecto y otra con un cliente.
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
insert into public.crm_reuniones (id, organizacion_id, prospecto, tipo, inicio, miembro_id, agendada_por, enlace)
values ('d0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', '  Juan   Pérez ', 'venta', now() - interval '2 days',
        'e0000000-0000-0000-0000-0000000000a3', 'e0000000-0000-0000-0000-0000000000a4', 'https://fathom.video/share/abc');
select pruebas.ok((select prospecto from public.crm_reuniones where id = 'd0000000-0000-0000-0000-000000000001') = 'Juan Pérez', 'el nombre del prospecto queda prolijo');
insert into public.crm_reuniones (id, organizacion_id, cliente_id, tipo, inicio, miembro_id)
values ('d0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000a', 'seguimiento', now() + interval '3 days', 'e0000000-0000-0000-0000-0000000000a2');
-- Sin cliente ni prospecto, no.
select pruebas.falla($q$insert into public.crm_reuniones (organizacion_id, tipo, inicio) values ('aaaaaaaa-0000-0000-0000-000000000000', 'seguimiento', now())$q$, 'Elegí el cliente');
-- El resultado es de las de venta y de las que se hicieron.
select pruebas.falla($q$update public.crm_reuniones set resultado = 'cerro' where id = 'd0000000-0000-0000-0000-000000000001'$q$, 'cuando la reunión se hizo');
update public.crm_reuniones set estado = 'realizada', resultado = 'cerro' where id = 'd0000000-0000-0000-0000-000000000001';
select pruebas.falla($q$update public.crm_reuniones set estado = 'realizada', resultado = 'cerro' where id = 'd0000000-0000-0000-0000-000000000002'$q$, 'todavía no pasó');
select pruebas.falla($q$insert into public.crm_reuniones (organizacion_id, cliente_id, tipo, inicio, estado, resultado)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000a', 'seguimiento', now() - interval '1 day', 'realizada', 'cerro')$q$, 'check');
-- El link es una dirección web.
select pruebas.falla($q$update public.crm_reuniones set enlace = 'fathom.video/x' where id = 'd0000000-0000-0000-0000-000000000002'$q$, 'check');
-- No se ata a un cliente ni a una persona de otra empresa.
select pruebas.falla($q$insert into public.crm_reuniones (organizacion_id, cliente_id, tipo, inicio) values ('aaaaaaaa-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000b', 'seguimiento', now())$q$, 'foreign key');
select pruebas.falla($q$insert into public.crm_reuniones (organizacion_id, prospecto, tipo, inicio, miembro_id) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Ana', 'venta', now(), 'e0000000-0000-0000-0000-0000000000b3')$q$, 'foreign key');
select pruebas.ok((select count(*) from public.crm_reuniones) = 2, 'el closer ve las reuniones de la empresa');
select pruebas.como_postgres();

-- El setter no ve el CRM: ve solo las que agendó o tiene.
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok((select count(*) from public.crm_reuniones) = 1, 'el setter ve la que agendó');
insert into public.crm_reuniones (organizacion_id, prospecto, tipo, inicio, agendada_por)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'Lucía Gómez', 'venta', now() + interval '1 day', 'e0000000-0000-0000-0000-0000000000a4');
select pruebas.falla($q$insert into public.crm_reuniones (organizacion_id, prospecto, tipo, inicio) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Ajena', 'venta', now())$q$, 'row-level security');
select pruebas.como_postgres();

-- El titular ve todas; quien la creó o el titular la borran.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.crm_reuniones) = 3, 'el titular ve todas');
delete from public.crm_reuniones where prospecto = 'Lucía Gómez';
select pruebas.como_postgres();
select pruebas.ok((select count(*) from public.crm_reuniones) = 2, 'el titular borra una reunión');

select pruebas.como('00000000-0000-0000-0000-0000000000a2');
delete from public.crm_reuniones where id = 'd0000000-0000-0000-0000-000000000001';
select pruebas.como_postgres();
select pruebas.ok(exists (select 1 from public.crm_reuniones where id = 'd0000000-0000-0000-0000-000000000001'), 'el Account Manager no borra una reunión que no creó');

-- Otra empresa no ve ni carga.
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.crm_reuniones) = 0, 'B no ve las reuniones de A');
select pruebas.falla($q$insert into public.crm_reuniones (organizacion_id, prospecto, tipo, inicio) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Intruso', 'venta', now())$q$, 'row-level security');
select pruebas.como_postgres();

-- ---------------------------------------------------------------------
-- Las llamadas de Fathom quedan como reuniones, con su link
-- ---------------------------------------------------------------------
update public.organizaciones set plan_producto = 'radar';
update public.crm_clientes set email = 'cliente@a.test' where id = 'c0000000-0000-0000-0000-00000000000a';
update public.equipo_miembros set email = 'closer@a.test' where id = 'e0000000-0000-0000-0000-0000000000a3';
insert into vault.secrets (id, name, secret) values ('5ec00000-0000-0000-0000-00000000000a', 'integracion_prueba', 'whsec_x');
insert into public.integraciones (id, organizacion_id, proveedor, equipo_miembro_id, estado, token_hash, secreto_vault_id) values
  ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'fathom', 'e0000000-0000-0000-0000-0000000000a3', 'activa',
   public.integracion_hash('token-de-a'), '5ec00000-0000-0000-0000-00000000000a');
-- El closer tenía agendado un seguimiento con el cliente hace un rato.
insert into public.crm_reuniones (id, organizacion_id, cliente_id, tipo, inicio, miembro_id)
values ('d0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000a', 'seguimiento', now() - interval '20 minutes',
        'e0000000-0000-0000-0000-0000000000a3');

select pruebas.como_servicio();
select public.interaccion_registrar('10000000-0000-0000-0000-00000000000a', 'msg_1', '123', 'Seguimiento semanal', now() - interval '15 minutes', 1800,
  '{"enlace": "https://fathom.video/share/uno", "invitados": [{"nombre": "Cliente", "email": "cliente@a.test", "externo": true}]}');
select public.interaccion_registrar('10000000-0000-0000-0000-00000000000a', 'msg_2', '456', 'Llamada con Cliente', now() - interval '3 days', 2400,
  '{"enlace": "https://fathom.video/share/dos", "invitados": [{"nombre": "Cliente", "email": "cliente@a.test", "externo": true}]}');
select pruebas.como_postgres();

select pruebas.ok((select estado = 'realizada' and enlace = 'https://fathom.video/share/uno' and interaccion_id is not null and duracion_min = 30
                   from public.crm_reuniones where id = 'd0000000-0000-0000-0000-000000000003'), 'la llamada completa la reunión agendada');
select pruebas.ok((select count(*) from public.crm_reuniones where interaccion_id is not null) = 2, 'una reunión por llamada');
select pruebas.ok((select tipo is null and estado = 'realizada' and titulo = 'Llamada con Cliente' and enlace = 'https://fathom.video/share/dos'
                          and miembro_id = 'e0000000-0000-0000-0000-0000000000a3' and cliente_id is null
                   from public.crm_reuniones where interaccion_id = (select id from public.interacciones where externo_id = '456')),
  'la que no estaba agendada queda hecha y sin tipo, con su link');

-- Cuando la llamada se vincula al cliente, la reunión también.
select pruebas.como_servicio();
select public.interaccion_vincular((select id from public.interacciones where externo_id = '456'));
select pruebas.como_postgres();
select pruebas.ok((select cliente_id = 'c0000000-0000-0000-0000-00000000000a' from public.crm_reuniones
                   where interaccion_id = (select id from public.interacciones where externo_id = '456')), 'la reunión queda con el cliente de la llamada');

-- El portal no descifra links por su cuenta.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.falla($q$select public.interaccion_enlace(null)$q$, 'permission denied');
select pruebas.como_postgres();

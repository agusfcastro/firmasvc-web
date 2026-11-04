-- =====================================================================
-- Asuntos de la cartera (0057): el responsable de un cliente ve sus
-- asuntos aunque su rol no vea Asuntos, y nada más.
-- =====================================================================

-- El setter de A es el responsable de Cliente de A (usuario unido por mail).
insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email) values
  ('e5700000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Setter Responsable', 'account_manager', 'setter@a.test');
update public.crm_clientes set responsable_id = 'e5700000-0000-0000-0000-000000000001' where id = 'c0000000-0000-0000-0000-00000000000a';

insert into public.asuntos (id, organizacion_id, titulo, tipo, cliente_id) values
  ('a5700000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'De su cliente', 'consulta', 'c0000000-0000-0000-0000-00000000000a'),
  ('a5700000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'Sin cliente', 'consulta', null);
insert into public.asunto_novedades (asunto_id, texto, interna) values
  ('a5700000-0000-0000-0000-000000000001', 'Visible', false),
  ('a5700000-0000-0000-0000-000000000001', 'Interna', true);

select pruebas.ok((select usuario_id from public.equipo_miembros where id = 'e5700000-0000-0000-0000-000000000001') = '00000000-0000-0000-0000-0000000000a4',
  'el responsable está unido a su usuario');

-- El setter ve solo los asuntos de su cliente, y la bitácora visible.
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
-- Los datos comunes ya abren un asunto de reembolso para Cliente de A: también es de su cartera.
select pruebas.ok(exists (select 1 from public.asuntos where id = 'a5700000-0000-0000-0000-000000000001'), 'el responsable ve el asunto de su cliente');
select pruebas.ok(not exists (select 1 from public.asuntos where cliente_id is distinct from 'c0000000-0000-0000-0000-00000000000a'), 'y ninguno que no sea de su cliente');
select pruebas.ok(public.tengo_asuntos_de_cartera(), 'el portal sabe que tiene asuntos de cartera');
select pruebas.ok((select count(*) from public.asunto_novedades where texto in ('Visible', 'Interna')) = 1, 've la novedad visible y no la interna');
insert into public.asunto_mensajes (asunto_id, texto) values ('a5700000-0000-0000-0000-000000000001', 'Hola desde la cartera');
select pruebas.ok((select count(*) from public.asunto_mensajes) = 1, 'escribe en el chat de su asunto');
select pruebas.ok(public.archivo_asunto_visible('aaaaaaaa-0000-0000-0000-000000000000/a5700000-0000-0000-0000-000000000001/x.pdf'), 've los documentos de su asunto');
select pruebas.ok(not public.archivo_asunto_visible('aaaaaaaa-0000-0000-0000-000000000000/a5700000-0000-0000-0000-000000000002/x.pdf'), 'no los de otro asunto');

do $$
begin
  begin
    insert into public.asunto_mensajes (asunto_id, texto) values ('a5700000-0000-0000-0000-000000000002', 'Intruso');
    perform pruebas.ok(false, 'no escribe en un asunto que no es de su cartera');
  exception when others then
    perform pruebas.ok(true, 'no escribe en un asunto que no es de su cartera');
  end;
  begin
    insert into public.asuntos (organizacion_id, titulo, tipo, estado) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Nuevo', 'consulta', 'en_curso');
    perform pruebas.ok(false, 'no abre asuntos nuevos');
  exception when others then
    perform pruebas.ok(true, 'no abre asuntos nuevos');
  end;
end;
$$;

-- El closer, sin cartera, sigue sin ver asuntos.
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.asuntos) = 0, 'el closer sin cartera no ve asuntos');
select pruebas.ok(not public.tengo_asuntos_de_cartera(), 'ni tiene asuntos de cartera');

-- Un responsable desactivado deja de ver.
select pruebas.como_postgres();
update public.equipo_miembros set activo = false where id = 'e5700000-0000-0000-0000-000000000001';
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok((select count(*) from public.asuntos) = 0, 'el responsable desactivado no ve asuntos');
select pruebas.como_postgres();

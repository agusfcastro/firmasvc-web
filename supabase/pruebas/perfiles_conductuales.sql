-- =====================================================================
-- Perfiles conductuales: señales, propuesta, decisión humana y acceso.
-- =====================================================================

-- Sin la funcionalidad no se sincroniza ni se ve nada.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok(not public.perfil_sincronizar('c0000000-0000-0000-0000-00000000000a'), 'sin Blindaje no hay perfiles');
select pruebas.como_postgres();

update public.organizaciones set plan_producto = 'blindaje', seguimiento_cobranza = true where id = 'aaaaaaaa-0000-0000-0000-000000000000';
update public.organizaciones set plan_producto = 'blindaje' where id = 'bbbbbbbb-0000-0000-0000-000000000000';
update public.crm_clientes set fecha_onboarding = now() - interval '20 days' where id = 'c0000000-0000-0000-0000-00000000000a';
insert into public.crm_pagos (cliente_id, monto, vencimiento) values ('c0000000-0000-0000-0000-00000000000a', 50, current_date - 10);
-- Una cuota vencida hace 3 días todavía no es señal.
insert into public.crm_pagos (cliente_id, monto, vencimiento) values ('c0000000-0000-0000-0000-00000000000a', 50, current_date - 3);
update public.crm_casos set contracargo = true, abierto_en = current_date - 5 where cliente_id = 'c0000000-0000-0000-0000-00000000000a';

-- El titular sincroniza: contracargo (2) + reclamo temprano (1) proponen escalada temprana.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok(public.perfil_sincronizar('c0000000-0000-0000-0000-00000000000a'), 'con Blindaje sincroniza');
select pruebas.ok((select count(*) from public.perfil_senales where tipo = 'cuota_vencida') = 1, 'una sola cuota vencida cuenta');
select pruebas.ok((select count(*) from public.perfil_senales where tipo in ('contracargo', 'reclamo_temprano')) = 2, 'el caso da contracargo y reclamo temprano');
select pruebas.ok((select estado from public.perfiles_conductuales where arquetipo = 'escalada_temprana') = 'propuesto', 'propone escalada temprana');
select pruebas.ok(not exists (select 1 from public.perfiles_conductuales where arquetipo = 'sensibilidad_precio'), 'una cuota vencida sola no alcanza');

-- Sincronizar de nuevo no duplica.
select public.perfil_sincronizar('c0000000-0000-0000-0000-00000000000a');
select pruebas.ok((select count(*) from public.perfil_senales) = 3, 'sincronizar dos veces no duplica señales');
select pruebas.ok((select count(*) from public.perfiles_conductuales) = 1, 'ni perfiles');

-- Señal manual: queda como manual y con su autor; los tipos automáticos no se cargan a mano.
insert into public.perfil_senales (organizacion_id, cliente_id, tipo, detalle)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000a', 'pide_refinanciacion', 'Pidió pasar de 6 a 12 cuotas por WhatsApp');
select pruebas.ok((select origen = 'manual' and registrada_por = '00000000-0000-0000-0000-0000000000a1' from public.perfil_senales where tipo = 'pide_refinanciacion'),
  'la señal manual guarda su autor');
do $$
begin
  insert into public.perfil_senales (organizacion_id, cliente_id, tipo, detalle)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000a', 'contracargo', 'Contracargo inventado');
  raise exception 'FALLÓ: se cargó a mano una señal automática';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
select public.perfil_sincronizar('c0000000-0000-0000-0000-00000000000a');
select pruebas.ok((select puntos from public.perfiles_conductuales where arquetipo = 'sensibilidad_precio') = 2, 'cuota vencida + refinanciación proponen sensibilidad al precio');

-- Una señal no se edita, se descarta con motivo.
do $$
begin
  update public.perfil_senales set detalle = 'Otra cosa' where tipo = 'pide_refinanciacion';
  raise exception 'FALLÓ: se editó una señal';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
update public.perfil_senales set descartada_en = now(), motivo_descarte = 'Era de otro cliente' where tipo = 'pide_refinanciacion';
select pruebas.ok((select descartada_por = '00000000-0000-0000-0000-0000000000a1' from public.perfil_senales where tipo = 'pide_refinanciacion'), 'el descarte guarda quién');

-- Decisión humana. Rechazar sin motivo no se puede.
do $$
begin
  perform public.perfil_decidir((select id from public.perfiles_conductuales where arquetipo = 'escalada_temprana'), false, null);
  raise exception 'FALLÓ: se rechazó sin motivo';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
select public.perfil_decidir((select id from public.perfiles_conductuales where arquetipo = 'escalada_temprana'), true);
select pruebas.ok((select estado = 'confirmado' and decidido_por = '00000000-0000-0000-0000-0000000000a1'
                   from public.perfiles_conductuales where arquetipo = 'escalada_temprana'), 'el titular confirma');
select public.perfil_decidir((select id from public.perfiles_conductuales where arquetipo = 'sensibilidad_precio'), false, 'Pagó todo la semana pasada');
select pruebas.ok(exists (select 1 from public.registro_accesos where accion = 'perfil_rechazado'), 'la decisión queda en la bitácora');

-- Rechazado: no se vuelve a proponer con la misma evidencia.
select public.perfil_sincronizar('c0000000-0000-0000-0000-00000000000a');
select pruebas.ok((select count(*) from public.perfiles_conductuales where arquetipo = 'sensibilidad_precio') = 1, 'no repropone lo rechazado');

-- El perfil no se toca por fuera de las funciones.
do $$
declare
  filas int;
begin
  update public.perfiles_conductuales set estado = 'confirmado' where arquetipo = 'sensibilidad_precio';
  raise exception 'FALLÓ: se cambió un perfil a mano';
exception when insufficient_privilege then null;
end $$;

-- El CSM ve y decide; el closer y el setter no ven nada.
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok((select count(*) from public.perfiles_conductuales) = 2, 'el CSM ve los perfiles');
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.perfiles_conductuales) = 0, 'el closer no ve perfiles');
select pruebas.ok((select count(*) from public.perfil_senales) = 0, 'ni señales');
do $$
begin
  perform public.perfil_sincronizar('c0000000-0000-0000-0000-00000000000a');
  raise exception 'FALLÓ: el closer sincronizó';
exception when insufficient_privilege then null;
end $$;

-- Otro negocio no ve ni carga nada en A.
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.perfiles_conductuales) = 0, 'B no ve los perfiles de A');
do $$
begin
  perform public.perfil_sincronizar('c0000000-0000-0000-0000-00000000000a');
  raise exception 'FALLÓ: B sincronizó un cliente de A';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  insert into public.perfil_senales (organizacion_id, cliente_id, tipo, detalle)
  values ('bbbbbbbb-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000a', 'pide_descuento', 'Cliente ajeno');
  raise exception 'FALLÓ: B cargó una señal a un cliente de A';
exception when foreign_key_violation or insufficient_privilege then null;
end $$;

-- Lo vencido se cierra solo y deja proponer de nuevo.
select pruebas.como_postgres();
update public.perfiles_conductuales set vigente_hasta = now() - interval '1 minute' where arquetipo = 'escalada_temprana';
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select public.perfil_sincronizar('c0000000-0000-0000-0000-00000000000a');
select pruebas.ok((select count(*) from public.perfiles_conductuales where arquetipo = 'escalada_temprana' and estado = 'vencido') = 1, 'el confirmado vence');
select pruebas.ok((select count(*) from public.perfiles_conductuales where arquetipo = 'escalada_temprana' and estado = 'propuesto') = 1, 'y se vuelve a proponer para revisar');

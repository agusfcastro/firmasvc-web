-- =====================================================================
-- Fathom por integrante: plan, quién administra, token y secreto que no
-- se leen desde el portal, URL nueva, pausa y baja.
-- =====================================================================

insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email) values
  ('e0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Closer de A', 'closer', 'closer@a.test'),
  ('e0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Closer de B', 'closer', 'closer@b.test');
-- 0056 une la ficha a la cuenta del closer por el mail. Hasta el autoservicio, más abajo, se prueba sin unir.
update public.equipo_miembros set usuario_id = null where id = 'e0000000-0000-0000-0000-00000000000a';
create temporary table tokens (nombre text primary key, token text);
grant all on tokens to anon, authenticated, service_role;

-- Sin un plan con Fathom no se conecta. Eminent, el plan por defecto desde
-- 0054, lo trae: se prueba con Starter.
update public.organizaciones set plan = 'starter';
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.integracion_fathom_conectar('e0000000-0000-0000-0000-00000000000a');
  raise exception 'FALLÓ: se conectó Fathom sin el plan';
exception when insufficient_privilege then null;
end $$;
select pruebas.como_postgres();
update public.organizaciones set plan_producto = 'radar';

-- El CSM no administra; el titular de B no toca a alguien de A.
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
do $$
begin
  perform public.integracion_fathom_conectar('e0000000-0000-0000-0000-00000000000a');
  raise exception 'FALLÓ: un CSM conectó Fathom';
exception when insufficient_privilege then null;
end $$;
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
do $$
begin
  perform public.integracion_fathom_conectar('e0000000-0000-0000-0000-00000000000a');
  raise exception 'FALLÓ: el titular de B conectó a alguien de A';
exception when insufficient_privilege then null;
end $$;

-- El titular conecta: el token se ve una vez y queda solo su hash.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into tokens values ('primero', public.integracion_fathom_conectar('e0000000-0000-0000-0000-00000000000a'));
select pruebas.ok((select token ~ '^[0-9a-f]{48}$' from tokens where nombre = 'primero'), 'el token tiene 48 caracteres hexadecimales');
select pruebas.ok((select estado = 'pendiente' from public.integraciones), 'arranca pendiente del secreto');
do $$
begin
  perform token_hash from public.integraciones;
  raise exception 'FALLÓ: el portal leyó el hash del token';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform * from public.integracion_por_token((select token from tokens where nombre = 'primero'));
  raise exception 'FALLÓ: el portal buscó una integración por token';
exception when insufficient_privilege then null;
end $$;
select pruebas.como_postgres();
select pruebas.ok((select token_hash = public.integracion_hash((select token from tokens where nombre = 'primero')) from public.integraciones), 'se guarda el hash');
select pruebas.ok(exists (select 1 from public.registro_accesos where accion = 'integracion_creada' and organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000'), 'el alta queda en la bitácora');

-- Secreto: formato de Fathom, a Vault, y la integración queda activa.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.integracion_guardar_secreto((select id from public.integraciones), 'cualquier-cosa');
  raise exception 'FALLÓ: se aceptó un secreto sin whsec_';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
select public.integracion_guardar_secreto((select id from public.integraciones), 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw');
select pruebas.ok((select estado = 'activa' from public.integraciones), 'con el secreto queda activa');

-- El CSM ve la integración; el closer, el setter y el negocio B no.
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok((select count(*) from public.integraciones) = 1, 'el CSM ve la integración');
do $$
begin
  perform public.integracion_pausar((select id from public.integraciones), true);
  raise exception 'FALLÓ: un CSM pausó la integración';
exception when insufficient_privilege then null;
end $$;
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.integraciones) = 0, 'el closer no ve integraciones');
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.integraciones) = 0, 'el negocio B no ve la de A');

-- El servidor encuentra la integración por el token, con el secreto.
select pruebas.como_servicio();
select pruebas.ok((select secreto = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw' and estado = 'activa' and habilitada
                   from public.integracion_por_token((select token from tokens where nombre = 'primero'))), 'el servidor lee el secreto por el token');
select pruebas.ok(not exists (select 1 from public.integracion_por_token('ffffffffffffffffffffffffffffffffffffffffffffffff')), 'un token inventado no encuentra nada');

-- Pausar y reanudar.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select public.integracion_pausar((select id from public.integraciones), true);
select pruebas.ok((select estado = 'pausada' from public.integraciones), 'pausada');
select public.integracion_pausar((select id from public.integraciones), false);
select pruebas.ok((select estado = 'activa' from public.integraciones), 'reanudada');

-- URL nueva: la vieja deja de andar y hay que pegar otro secreto.
insert into tokens values ('segundo', public.integracion_fathom_conectar('e0000000-0000-0000-0000-00000000000a'));
select pruebas.ok((select estado = 'pendiente' from public.integraciones), 'la URL nueva vuelve a pendiente');
select pruebas.ok((select count(*) from public.integraciones) = 1, 'sigue siendo una por integrante');
select pruebas.como_servicio();
select pruebas.ok(not exists (select 1 from public.integracion_por_token((select token from tokens where nombre = 'primero'))), 'la URL vieja ya no anda');
select pruebas.ok((select secreto is null from public.integracion_por_token((select token from tokens where nombre = 'segundo'))), 'el secreto viejo se borró');
select pruebas.como_postgres();
select pruebas.ok(not exists (select 1 from vault.secrets where name like 'integracion_%'), 'el secreto viejo no queda en Vault');

-- Quitar borra la integración y su secreto.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select public.integracion_guardar_secreto((select id from public.integraciones), 'whsec_OtroSecretoDePrueba1234567890');
select public.integracion_quitar((select id from public.integraciones));
select pruebas.como_postgres();
select pruebas.ok(not exists (select 1 from public.integraciones), 'quitar borra la integración');
select pruebas.ok(not exists (select 1 from vault.secrets where name like 'integracion_%'), 'y su secreto');
select pruebas.ok(exists (select 1 from public.registro_accesos where accion = 'integracion_quitada'), 'la baja queda en la bitácora');

-- ---------------------------------------------------------------------
-- Autoservicio: el closer con cuenta conecta la suya, no la de otro.
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email) values
  ('e0000000-0000-0000-0000-0000000000a4', 'aaaaaaaa-0000-0000-0000-000000000000', 'Setter sin cuenta', 'setter', 'externo@gmail.test');
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok(public.equipo_vincular_mi_cuenta() = 'e0000000-0000-0000-0000-00000000000a', 'el closer se vincula a su ficha por el mail');
select pruebas.como_postgres();
select pruebas.ok((select usuario_id = '00000000-0000-0000-0000-0000000000a3' from public.equipo_miembros where id = 'e0000000-0000-0000-0000-00000000000a'), 'la ficha queda con su cuenta');
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
insert into tokens values ('closer', public.integracion_fathom_conectar('e0000000-0000-0000-0000-00000000000a'));
select public.integracion_guardar_secreto((select id from public.integraciones), 'whsec_SecretoDelCloser1234567890');
select pruebas.ok((select estado = 'activa' from public.integraciones), 'el closer activa la suya');
select pruebas.ok((select count(*) from public.integraciones) = 1, 'y la ve');
do $$
begin
  perform public.integracion_fathom_conectar('e0000000-0000-0000-0000-0000000000a4');
  raise exception 'FALLÓ: un closer conectó a otro integrante';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.integracion_fathom_invitar('e0000000-0000-0000-0000-0000000000a4');
  raise exception 'FALLÓ: un closer generó un enlace de conexión';
exception when insufficient_privilege then null;
end $$;
-- El setter con cuenta no está en el equipo con su mail: no se vincula ni ve la del closer.
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok(public.equipo_vincular_mi_cuenta() is null, 'sin ficha con su mail no se vincula');
select pruebas.ok((select count(*) from public.integraciones) = 0, 'el setter no ve la del closer');

-- ---------------------------------------------------------------------
-- Enlace de conexión para quien no tiene cuenta.
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into tokens values ('invitacion', public.integracion_fathom_invitar('e0000000-0000-0000-0000-0000000000a4'));
select pruebas.ok((select invitacion_vence between now() + interval '6 days' and now() + interval '8 days'
                   from public.integraciones where equipo_miembro_id = 'e0000000-0000-0000-0000-0000000000a4'), 'el enlace vale 7 días');

-- Sin sesión: la página muestra a quién conecta y la misma URL cada vez.
select pruebas.como_anonimo();
select pruebas.ok((select r ->> 'integrante' = 'Setter sin cuenta' and r ->> 'negocio' = 'Negocio A' and r ->> 'token' ~ '^[0-9a-f]{48}$'
                   from (select public.integracion_invitacion_abrir((select token from tokens where nombre = 'invitacion')) as r) x), 'el enlace muestra integrante, negocio y URL');
select pruebas.ok((select public.integracion_invitacion_abrir((select token from tokens where nombre = 'invitacion')) ->> 'token')
                = (select public.integracion_invitacion_abrir((select token from tokens where nombre = 'invitacion')) ->> 'token'), 'abrirlo dos veces da la misma URL');
do $$
begin
  perform public.integracion_invitacion_abrir('ffffffffffffffffffffffffffffffffffffffffffffffff');
  raise exception 'FALLÓ: se abrió un enlace inventado';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform * from public.integraciones;
  raise exception 'FALLÓ: sin sesión se leyeron integraciones';
exception when insufficient_privilege then null;
end $$;
select public.integracion_invitacion_secreto((select token from tokens where nombre = 'invitacion'), 'whsec_SecretoDelSetter1234567890');

-- La URL del enlace es la que encuentra el webhook, ya activa; el enlace quedó usado.
select pruebas.como_servicio();
select pruebas.ok((select estado = 'activa' and secreto = 'whsec_SecretoDelSetter1234567890'
                   from public.integracion_por_token(public.integracion_url_de_invitacion((select token from tokens where nombre = 'invitacion')))),
  'la URL del enlace queda activa con su secreto');
select pruebas.como_anonimo();
do $$
begin
  perform public.integracion_invitacion_abrir((select token from tokens where nombre = 'invitacion'));
  raise exception 'FALLÓ: un enlace usado se volvió a abrir';
exception when insufficient_privilege then null;
end $$;

-- Un enlace vencido no abre.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into tokens values ('vencida', public.integracion_fathom_invitar('e0000000-0000-0000-0000-0000000000a4'));
select pruebas.como_postgres();
update public.integraciones set invitacion_vence = now() - interval '1 minute' where equipo_miembro_id = 'e0000000-0000-0000-0000-0000000000a4';
select pruebas.como_anonimo();
do $$
begin
  perform public.integracion_invitacion_abrir((select token from tokens where nombre = 'vencida'));
  raise exception 'FALLÓ: se abrió un enlace vencido';
exception when insufficient_privilege then null;
end $$;
select pruebas.como_postgres();
select pruebas.ok(exists (select 1 from public.registro_accesos where accion = 'integracion_secreto_por_enlace'), 'el secreto por enlace queda en la bitácora');

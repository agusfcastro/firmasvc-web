-- =====================================================================
-- Interacciones: alta desde el webhook, avisos repetidos, contenido
-- cifrado, vínculo con el equipo y el cliente, lectura por rol y
-- asignación a mano.
-- =====================================================================

update public.organizaciones set plan_producto = 'radar';
update public.crm_clientes set email = 'Cliente@A.test' where id = 'c0000000-0000-0000-0000-00000000000a';
-- El closer de A tiene cuenta en el portal; el setter, no está en la llamada.
insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email, usuario_id) values
  ('e0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Closer de A', 'closer', 'closer@a.test', '00000000-0000-0000-0000-0000000000a3'),
  ('e0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'CSM de A', 'csm', 'csm@a.test', '00000000-0000-0000-0000-0000000000a2'),
  ('e0000000-0000-0000-0000-0000000000a4', 'aaaaaaaa-0000-0000-0000-000000000000', 'Setter de A', 'setter', 'setter@a.test', '00000000-0000-0000-0000-0000000000a4');
insert into vault.secrets (id, name, secret) values ('5ec00000-0000-0000-0000-00000000000a', 'integracion_prueba', 'whsec_x');
insert into public.integraciones (id, organizacion_id, proveedor, equipo_miembro_id, estado, token_hash, secreto_vault_id) values
  ('10000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'fathom', 'e0000000-0000-0000-0000-00000000000a', 'activa',
   public.integracion_hash('token-de-a'), '5ec00000-0000-0000-0000-00000000000a');

create temporary table resultado (clave text primary key, r jsonb);
grant all on resultado to authenticated, service_role;

-- El portal no registra llamadas.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.interaccion_registrar('10000000-0000-0000-0000-00000000000a', 'msg_1', '123', 'Llamada', now(), 60, '{}');
  raise exception 'FALLÓ: un titular registró una llamada';
exception when insufficient_privilege then null;
end $$;

-- El servidor registra: interacción, recepción y trabajo en la cola.
select pruebas.como_servicio();
insert into resultado values ('alta', public.interaccion_registrar(
  '10000000-0000-0000-0000-00000000000a', 'msg_1', '123', 'Onboarding con Cliente de A', now() - interval '1 hour', 1800,
  '{"invitados": [{"nombre": "Cliente", "email": "cliente@a.test", "externo": true},
                  {"nombre": "CSM", "email": "CSM@a.test", "externo": false},
                  {"nombre": "Alguien", "email": "otro@x.test", "externo": true}],
    "grabado_por": {"nombre": "Closer", "email": "closer@a.test"},
    "transcripcion": [{"hablante": "Cliente", "email": "cliente@a.test", "segundo": 12, "texto": "Me prometieron resultados en 30 días"}]}'));
select pruebas.ok((select r ? 'interaccion_id' and r ? 'trabajo_id' from resultado where clave = 'alta'), 'devuelve la interacción y el trabajo');
select pruebas.ok((select tipo = 'interaccion_vincular' and payload ->> 'interaccion_id' = (select r ->> 'interaccion_id' from resultado where clave = 'alta')
                   from public.cola_trabajos), 'encola el vínculo con el id');
select pruebas.ok((select estado = 'recibida' and equipo_miembro_id = 'e0000000-0000-0000-0000-00000000000a' and cliente_id is null
                   and retener_contenido_hasta > now() + interval '89 days' from public.interacciones), 'queda recibida, a nombre de quien grabó');
select pruebas.ok((select recepciones = 1 and ultima_recepcion is not null from public.integraciones), 'la integración cuenta la recepción');

-- El contenido está cifrado: no aparece en claro.
select pruebas.ok((select position('prometieron' in encode(contenido_cifrado, 'escape')) = 0 from public.interacciones), 'el contenido no queda en claro');

-- Un aviso repetido y la misma grabación por otro aviso no duplican.
select pruebas.ok((select public.interaccion_registrar('10000000-0000-0000-0000-00000000000a', 'msg_1', '123', 'x', now(), 1, '{}') = '{"duplicada": true}'), 'el mismo aviso es duplicado');
select pruebas.ok((select public.interaccion_registrar('10000000-0000-0000-0000-00000000000a', 'msg_2', '123', 'x', now(), 1, '{}') = '{"duplicada": true}'), 'la misma grabación es duplicada');
select pruebas.ok((select count(*) from public.interacciones) = 1, 'sigue habiendo una interacción');

-- Pausada, el aviso se anota como ignorado y no crea nada.
select pruebas.como_postgres();
update public.integraciones set estado = 'pausada';
select pruebas.como_servicio();
select pruebas.ok((select public.interaccion_registrar('10000000-0000-0000-0000-00000000000a', 'msg_3', '456', 'x', now(), 1, '{}') = '{"ignorada": true}'), 'pausada se ignora');
select pruebas.ok((select estado = 'ignorada' from public.webhook_recepciones where externo_id = 'msg_3'), 'la recepción queda ignorada');
select pruebas.ok((select count(*) from public.interacciones) = 1, 'pausada no crea interacciones');
select pruebas.como_postgres();
update public.integraciones set estado = 'activa';

-- Vincular: el cliente por su mail, el CSM del equipo y un externo.
select pruebas.como_servicio();
select public.interaccion_vincular((select (r ->> 'interaccion_id')::uuid from resultado where clave = 'alta'));
select pruebas.ok((select estado = 'vinculada' and cliente_id = 'c0000000-0000-0000-0000-00000000000a' from public.interacciones), 'queda a nombre del cliente');
select pruebas.ok((select (participantes -> 'equipo') @> '["e0000000-0000-0000-0000-00000000000a", "e0000000-0000-0000-0000-0000000000a2"]'
                     and jsonb_array_length(participantes -> 'equipo') = 2
                     and participantes -> 'clientes' = '["c0000000-0000-0000-0000-00000000000a"]'
                     and (participantes ->> 'externos')::int = 1 from public.interacciones), 'participantes sin mails');
select pruebas.ok((select position('@' in participantes::text) = 0 from public.interacciones), 'ningún mail fuera del contenido');

-- Lectura: titular y CSM sí; el closer que grabó sí; el setter que no estuvo, no; B, no.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.interacciones) = 1, 'el titular la ve');
do $$
begin
  perform contenido_cifrado from public.interacciones;
  raise exception 'FALLÓ: el portal leyó el contenido cifrado';
exception when insufficient_privilege then null;
end $$;
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok((select count(*) from public.interacciones) = 1, 'el CSM la ve');
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.interacciones) = 1, 'el closer que la grabó la ve');
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok((select count(*) from public.interacciones) = 0, 'el setter que no estuvo no la ve');
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.interacciones) = 0, 'el negocio B no la ve');

-- Asignar a mano: el closer no puede; el CSM sí, solo con clientes del negocio.
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
do $$
begin
  perform public.interaccion_asignar((select id from public.interacciones), null);
  raise exception 'FALLÓ: un closer asignó una llamada';
exception when insufficient_privilege then null;
end $$;
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
do $$
begin
  perform public.interaccion_asignar((select id from public.interacciones), 'c0000000-0000-0000-0000-00000000000b');
  raise exception 'FALLÓ: se asignó un cliente de otro negocio';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
select public.interaccion_asignar((select id from public.interacciones), null);
select pruebas.ok((select cliente_id is null and asignado_por = '00000000-0000-0000-0000-0000000000a2' from public.interacciones), 'el CSM la desasigna');

-- Lo asignado a mano no lo pisa un nuevo vínculo.
select pruebas.como_servicio();
select public.interaccion_vincular((select id from public.interacciones));
select pruebas.ok((select cliente_id is null from public.interacciones), 'vincular no pisa la asignación a mano');
select pruebas.como_postgres();
select pruebas.ok(exists (select 1 from public.registro_accesos where accion = 'interaccion_asignada'), 'la asignación queda en la bitácora');

-- El negocio y el contenido no cambian.
do $$
begin
  update public.interacciones set organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000';
  raise exception 'FALLÓ: una interacción cambió de negocio';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;

-- El barrido limpia sin secretos de la cola y sin llamar a nadie.
select public.cola_barrer();

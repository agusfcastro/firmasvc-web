-- =====================================================================
-- Análisis de llamadas: puntaje de la base, encolado al vincular, guardado
-- cifrado, quién ve qué, revisión de FIRMA, señales del perfil conductual,
-- llamadas que no son de venta, límite del plan y carga manual.
-- =====================================================================

update public.organizaciones set plan = 'eminent';
insert into public.org_funcionalidades (organizacion_id, funcionalidad, habilitada) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'perfiles_conductuales', true);
update public.crm_clientes set email = 'cliente@a.test' where id = 'c0000000-0000-0000-0000-00000000000a';
insert into public.crm_clientes (id, organizacion_id, nombre) values
  ('c0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Otro cliente de A');
insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email, usuario_id) values
  ('e0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Closer de A', 'closer', 'closer@a.test', '00000000-0000-0000-0000-0000000000a3');

create temporary table ids (clave text primary key, id uuid);
grant all on ids to authenticated, service_role;

-- ---------------------------------------------------------------------
-- El puntaje lo calcula la base
-- ---------------------------------------------------------------------
create temporary table p (clave text primary key, r jsonb);
insert into p values
  ('base',      public.analisis_puntuar('venta-1.1', '[{"codigo":"B1","intensidad":2},{"codigo":"C2","intensidad":1},{"codigo":"A2","intensidad":1},{"codigo":"P3","intensidad":1}]', 'alta')),
  ('repetido',  public.analisis_puntuar('venta-1.1', '[{"codigo":"B1","intensidad":1},{"codigo":"B1","intensidad":5},{"codigo":"Z9","intensidad":2},{"codigo":"V1","intensidad":1}]', 'alta')),
  ('r2',        public.analisis_puntuar('venta-1.1', '[{"codigo":"D1","intensidad":1},{"codigo":"B1","intensidad":1}]', 'alta')),
  ('r4',        public.analisis_puntuar('venta-1.1', '[{"codigo":"A1","intensidad":1}]', 'alta')),
  ('r4_no',     public.analisis_puntuar('venta-1.1', '[{"codigo":"A1","intensidad":1,"corregido":true}]', 'alta')),
  ('r1',        public.analisis_puntuar('venta-1.1', '[{"codigo":"C1","intensidad":2}]', 'alta')),
  ('r3_r5',     public.analisis_puntuar('venta-1.1', '[{"codigo":"E1","intensidad":1},{"codigo":"B5","intensidad":2}]', 'alta')),
  ('alerta',    public.analisis_puntuar('venta-1.1', '[{"codigo":"D1","intensidad":2}]', 'alta')),
  ('descarte',  public.analisis_puntuar('venta-1.1', '[{"codigo":"D1","intensidad":1},{"codigo":"B1","intensidad":2,"descartado":true}]', 'alta')),
  ('protegido', public.analisis_puntuar('venta-1.1', '[{"codigo":"C2","intensidad":1},{"codigo":"P6","intensidad":2}]', 'alta')),
  ('sin_banda', public.analisis_puntuar('venta-1.1', '[{"codigo":"B1","intensidad":2}]', 'no_evaluable'));

select pruebas.ok((select r ->> 'riesgo' = '9' and r ->> 'protector' = '2' and r ->> 'neto' = '7' and r ->> 'banda_puntaje' = 'medio'
                          and r ->> 'banda_final' = 'medio' and r -> 'reglas' = '[]' and not (r ->> 'alerta_vulnerabilidad')::boolean
                   from p where clave = 'base'), 'suma peso por intensidad y resta los protectores');
select pruebas.ok((select r ->> 'riesgo' = '6' and jsonb_array_length(r -> 'codigos') = 2 and r -> 'codigos' -> 1 ->> 'puntos' = '0'
                   from p where clave = 'repetido'), 'un repetido cuenta una vez con tope 2, uno inventado se ignora y el vendedor no suma');
select pruebas.ok((select r ->> 'banda_puntaje' = 'medio' and r ->> 'banda_final' = 'alto' and r -> 'reglas' = '["R2"]' from p where clave = 'r2'), 'R2 sube a alto');
select pruebas.ok((select r ->> 'banda_puntaje' = 'bajo' and r ->> 'banda_final' = 'medio' and r -> 'reglas' = '["R4"]' from p where clave = 'r4'), 'R4 sube a medio');
select pruebas.ok((select r ->> 'banda_final' = 'bajo' and r -> 'reglas' = '[]' from p where clave = 'r4_no'), 'A1 corregido por el vendedor no activa R4');
select pruebas.ok((select r ->> 'banda_final' = 'alto' and r -> 'reglas' = '["R1"]' from p where clave = 'r1'), 'R1 sube a alto');
select pruebas.ok((select r ->> 'banda_final' = 'medio' and r -> 'reglas' = '["R5"]' from p where clave = 'r3_r5'), 'E1 leve no activa R3 y B5 fuerte activa R5');
select pruebas.ok((select (r ->> 'alerta_vulnerabilidad')::boolean and r -> 'reglas' = '[]' from p where clave = 'alerta'), 'D1 fuerte activa la alerta');
select pruebas.ok((select r ->> 'riesgo' = '3' and r -> 'reglas' = '[]' from p where clave = 'descarte'), 'lo descartado no suma ni activa reglas');
select pruebas.ok((select r ->> 'neto' = '0' and r ->> 'banda_final' = 'bajo' from p where clave = 'protegido'), 'el neto no baja de cero');
select pruebas.ok((select r ->> 'banda_puntaje' is null and r ->> 'banda_final' is null and r ->> 'riesgo' = '6' from p where clave = 'sin_banda'), 'no evaluable no tiene banda');
do $$
begin
  perform public.analisis_puntuar('seguimiento-1.0', '[]', 'alta');
  raise exception 'FALLÓ: puntuó una versión sin reglas';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;

-- ---------------------------------------------------------------------
-- Una llamada de venta: se encola al vincularse y el servidor la guarda
-- ---------------------------------------------------------------------
insert into public.interacciones (id, organizacion_id, equipo_miembro_id, fuente, externo_id, titulo, ocurrida_en, duracion_seg,
                                  participantes, contenido_cifrado, contenido_sha256, retener_contenido_hasta)
values ('1a000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-00000000000a',
        'fathom', 'rec-1', 'Venta con Cliente de A', now() - interval '2 hours', 1800, '{"equipo": ["e0000000-0000-0000-0000-00000000000a"]}',
        pgp_sym_encrypt('{"transcripcion": [{"hablante": "Cliente", "email": "cliente@a.test", "segundo": 10, "texto": "Entro porque tiene garantía"}]}',
                        public.crm_clave('interacciones_contenido'), 'cipher-algo=aes256'),
        'sha', now() + interval '90 days');
select pruebas.ok(not exists (select 1 from public.interaccion_analisis), 'una llamada recibida todavía no se analiza');

select pruebas.como_servicio();
select public.interaccion_vincular('1a000000-0000-0000-0000-00000000000a');
select pruebas.como_postgres();
insert into ids select 'venta', id from public.interaccion_analisis;
select pruebas.ok((select estado = 'pendiente' and version = 'venta-1.1' and etapa_pedida is null from public.interaccion_analisis), 'al vincularse se crea el análisis pendiente');
select pruebas.ok(exists (select 1 from public.cola_trabajos where tipo = 'interaccion_analizar'
                          and payload ->> 'analisis_id' = (select id::text from ids where clave = 'venta')), 'y se encola');
select pruebas.ok((select cliente_id = 'c0000000-0000-0000-0000-00000000000a' from public.interacciones), 'el vínculo siguió funcionando');

-- El servidor lee la llamada descifrada; el portal, no.
select pruebas.como_servicio();
select pruebas.ok((select public.analisis_contenido((select id from ids where clave = 'venta')) -> 'contenido' -> 'transcripcion' -> 0 ->> 'texto'
                   = 'Entro porque tiene garantía'), 'el servidor lee la transcripción');
select pruebas.ok((select public.analisis_contenido((select id from ids where clave = 'venta')) -> 'equipo' -> 0 ->> 'email' = 'closer@a.test'), 'con el equipo del negocio');
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.analisis_contenido((select id from ids where clave = 'venta'));
  raise exception 'FALLÓ: el portal leyó la transcripción';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.analisis_guardar((select id from ids where clave = 'venta'), '{"etapa": "venta"}');
  raise exception 'FALLÓ: el portal guardó un análisis';
exception when insufficient_privilege then null;
end $$;

select pruebas.como_servicio();
select public.analisis_guardar((select id from ids where clave = 'venta'), '{
  "etapa": "venta", "confianza": "alta", "palabras_prospecto": 950,
  "codigos": [{"codigo": "B1", "intensidad": 2}, {"codigo": "A1", "intensidad": 1, "corregido": false},
              {"codigo": "P3", "intensidad": 1}, {"codigo": "V1", "intensidad": 1}],
  "detalle": {"indicadores": [{"codigo": "B1", "cita": "Entro porque tiene garantía", "minuto": "00:10"}]},
  "modelo": "claude-opus-5-5", "tokens_entrada": 1200, "tokens_salida": 800}');
select pruebas.como_postgres();
select pruebas.ok((select estado = 'en_revision' and puntaje_riesgo = 9 and puntaje_protector = 2 and puntaje_neto = 7
                          and banda_puntaje = 'medio' and banda_final = 'medio' and reglas = '{R4}' and palabras_prospecto = 950
                   from public.interaccion_analisis), 'queda en revisión, con el puntaje calculado por la base');
select pruebas.ok((select position('porque tiene' in encode(detalle_cifrado, 'escape')) = 0 and position('porque' in codigos::text) = 0
                   from public.interaccion_analisis), 'las citas no quedan en claro');
select pruebas.ok((select estado = 'analizada' and etapa_comercial = 'venta' from public.interacciones), 'la llamada queda analizada como venta');
select pruebas.como_servicio();
select pruebas.ok((select public.analisis_guardar((select id from ids where clave = 'venta'), '{"etapa": "venta"}') ->> 'ignorado' = 'en_revision'),
                  'un análisis ya guardado no se pisa');
select pruebas.ok(public.analisis_contenido((select id from ids where clave = 'venta')) is null, 'ni se vuelve a leer');

-- ---------------------------------------------------------------------
-- En revisión lo ve solo FIRMA
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select estado = 'en_revision' and banda_final is null and alerta_vulnerabilidad is null
                   from public.analisis_listado('aaaaaaaa-0000-0000-0000-000000000000')), 'el titular ve que está en revisión, sin la banda');
select pruebas.ok((select not (public.analisis_leer((select id from ids where clave = 'venta')) ->> 'visible')::boolean
                          and public.analisis_leer((select id from ids where clave = 'venta')) -> 'detalle' is null), 'ni el informe');
do $$
begin
  perform 1 from public.interaccion_analisis;
  raise exception 'FALLÓ: el portal leyó la tabla de análisis';
exception when insufficient_privilege then null;
end $$;
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) = 0 from public.analisis_listado('aaaaaaaa-0000-0000-0000-000000000000')), 'el closer no ve análisis');
do $$
begin
  perform public.analisis_leer((select id from ids where clave = 'venta'));
  raise exception 'FALLÓ: el closer leyó un análisis';
exception when insufficient_privilege then null;
end $$;
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) = 0 from public.analisis_listado('aaaaaaaa-0000-0000-0000-000000000000')), 'otro negocio no ve análisis');

select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pruebas.ok((select r ->> 'banda_final' = 'medio' and (r ->> 'es_staff')::boolean
                          and r -> 'detalle' -> 'indicadores' -> 0 ->> 'cita' = 'Entro porque tiene garantía'
                   from (select public.analisis_leer((select id from ids where clave = 'venta')) r) t), 'FIRMA lee el informe completo');
select public.analisis_leer((select id from ids where clave = 'venta'));
select pruebas.como_postgres();
select pruebas.ok((select count(*) = 1 from public.registro_accesos where accion = 'lectura_analisis'), 'la lectura queda en la bitácora una vez cada 30 minutos');

-- ---------------------------------------------------------------------
-- FIRMA corrige y aprueba
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.analisis_corregir((select id from ids where clave = 'venta'), 'B1', true, 'No era una salida');
  raise exception 'FALLÓ: el titular corrigió un análisis';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.analisis_aprobar((select id from ids where clave = 'venta'));
  raise exception 'FALLÓ: el titular aprobó un análisis';
exception when insufficient_privilege then null;
end $$;

select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
do $$
begin
  perform public.analisis_corregir((select id from ids where clave = 'venta'), 'B1', true, null);
  raise exception 'FALLÓ: se descartó un código sin motivo';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
do $$
begin
  perform public.analisis_corregir((select id from ids where clave = 'venta'), 'C1', true, 'No está');
  raise exception 'FALLÓ: se corrigió un código que no estaba';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
select public.analisis_corregir((select id from ids where clave = 'venta'), 'B1', true, 'Preguntó por la garantía para informarse');
select pruebas.como_postgres();
select pruebas.ok((select puntaje_riesgo = 3 and puntaje_neto = 1 and banda_puntaje = 'bajo' and banda_final = 'medio'
                          and jsonb_array_length(correcciones) = 1 and correcciones -> 0 ->> 'accion' = 'descartado'
                   from public.interaccion_analisis), 'descartar un código recalcula y queda anotado');
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select public.analisis_corregir((select id from ids where clave = 'venta'), 'B1', false);
select public.analisis_aprobar((select id from ids where clave = 'venta'));
select pruebas.como_postgres();
select pruebas.ok((select puntaje_riesgo = 9 and jsonb_array_length(correcciones) = 2 and estado = 'aprobado'
                          and revisado_por = '00000000-0000-0000-0000-0000000000ad' from public.interaccion_analisis), 'restaurado y aprobado');
select pruebas.ok(exists (select 1 from public.registro_accesos where accion = 'analisis_aprobado')
                  and exists (select 1 from public.registro_accesos where accion = 'analisis_corregido'), 'la revisión queda en la bitácora');

select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok((select estado = 'aprobado' and banda_final = 'medio' from public.analisis_listado('aaaaaaaa-0000-0000-0000-000000000000')),
                  'aprobado, el CSM ve la banda');
select pruebas.ok((select (r ->> 'visible')::boolean and r -> 'detalle' is not null and r -> 'correcciones' = '[]' and r ->> 'modelo' is null
                   from (select public.analisis_leer((select id from ids where clave = 'venta')) r) t), 'y el informe, sin las correcciones de FIRMA');
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
do $$
begin
  perform public.analisis_corregir((select id from ids where clave = 'venta'), 'A1', true, 'Tarde');
  raise exception 'FALLÓ: se corrigió un análisis aprobado';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;

-- Las señales del perfil conductual: B1 y A1 tienen señal; P3 y V1, no.
select pruebas.como_postgres();
select pruebas.ok((select count(*) = 2 and bool_and(cliente_id = 'c0000000-0000-0000-0000-00000000000a' and evidencia_tabla = 'interaccion_analisis')
                   from public.perfil_senales where origen = 'llamada' and descartada_en is null), 'al aprobar se suman las señales al cliente');
select pruebas.ok((select array_agg(tipo order by tipo) = '{llamada_garantia_salida,llamada_resultado_garantizado}'
                   from public.perfil_senales where origen = 'llamada'), 'las que corresponden a sus códigos');
select pruebas.ok((select bool_and(position('porque tiene' in detalle) = 0) from public.perfil_senales where origen = 'llamada'),
                  'la señal no repite la cita');

-- Reasignar la llamada descarta las señales del cliente anterior.
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select public.interaccion_asignar('1a000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-0000000000a2');
select pruebas.como_postgres();
select pruebas.ok((select count(*) = 2 from public.perfil_senales
                   where origen = 'llamada' and descartada_en is not null and motivo_descarte like '%otro cliente%'), 'reasignada, se descartan las del cliente anterior');

-- Volver a analizar lo hace FIRMA.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.analisis_solicitar('1a000000-0000-0000-0000-00000000000a');
  raise exception 'FALLÓ: el titular volvió a analizar una llamada ya analizada';
exception when insufficient_privilege then null;
end $$;
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into ids values ('venta_2', public.analisis_solicitar('1a000000-0000-0000-0000-00000000000a', true));
select pruebas.como_postgres();
select pruebas.ok((select estado = 'reemplazado' from public.interaccion_analisis where id = (select id from ids where clave = 'venta')), 'el anterior queda reemplazado');
select pruebas.ok((select estado = 'pendiente' and etapa_pedida = 'venta' from public.interaccion_analisis where id = (select id from ids where clave = 'venta_2')),
                  'el nuevo, pendiente y como venta');

-- Pedido como venta, se analiza aunque el modelo la clasifique distinto.
select pruebas.como_servicio();
select public.analisis_guardar((select id from ids where clave = 'venta_2'),
  '{"etapa": "onboarding", "confianza": "media", "codigos": [{"codigo": "E1", "intensidad": 2}], "detalle": {}}');
select pruebas.como_postgres();
select pruebas.ok((select estado = 'en_revision' and banda_final = 'alto' and reglas = '{R3}' from public.interaccion_analisis where id = (select id from ids where clave = 'venta_2')),
                  'pedido como venta, queda en revisión aunque el modelo diga onboarding');

-- Descartar el análisis entero exige motivo, que el negocio ve.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
do $$
begin
  perform public.analisis_descartar((select id from ids where clave = 'venta_2'), '');
  raise exception 'FALLÓ: se descartó un análisis sin motivo';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
select public.analisis_descartar((select id from ids where clave = 'venta_2'), 'La transcripción está cortada');
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select r ->> 'estado' = 'descartado' and r ->> 'motivo' = 'La transcripción está cortada' and not (r ->> 'visible')::boolean
                   from (select public.analisis_leer((select id from ids where clave = 'venta_2')) r) t), 'el titular ve el descarte y su motivo');

-- ---------------------------------------------------------------------
-- Una llamada que no es de venta
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
insert into public.interacciones (id, organizacion_id, fuente, externo_id, titulo, ocurrida_en, participantes, contenido_cifrado, contenido_sha256, retener_contenido_hasta)
values ('1a000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'fathom', 'rec-2', 'Seguimiento', now() - interval '1 hour', '{}',
        pgp_sym_encrypt('{"transcripcion": [{"hablante": "Cliente", "segundo": 3, "texto": "Ya terminé el módulo dos"}]}',
                        public.crm_clave('interacciones_contenido'), 'cipher-algo=aes256'), 'sha2', now() + interval '90 days');
select pruebas.como_servicio();
select public.interaccion_vincular('1a000000-0000-0000-0000-0000000000a2');
select public.analisis_guardar((select id from public.interaccion_analisis where interaccion_id = '1a000000-0000-0000-0000-0000000000a2'),
  '{"etapa": "seguimiento", "confianza": "alta", "codigos": [{"codigo": "B1", "intensidad": 2}], "detalle": {"etapa_motivo": "Habla de su avance"}}');
select pruebas.como_postgres();
select pruebas.ok((select estado = 'no_aplica' and etapa = 'seguimiento' and codigos = '[]' and puntaje_neto is null
                   from public.interaccion_analisis where interaccion_id = '1a000000-0000-0000-0000-0000000000a2'), 'no es de venta: queda clasificada, sin puntaje');
select pruebas.ok((select estado = 'clasificada' and etapa_comercial = 'seguimiento' from public.interacciones where id = '1a000000-0000-0000-0000-0000000000a2'),
                  'y la llamada, como seguimiento');

-- ---------------------------------------------------------------------
-- Carga manual
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
do $$
begin
  perform public.interaccion_cargar_manual('aaaaaaaa-0000-0000-0000-000000000000', 'x', now(), null, null,
    '{"transcripcion": [{"hablante":"A","texto":"uno"},{"hablante":"B","texto":"dos"},{"hablante":"A","texto":"tres"}]}');
  raise exception 'FALLÓ: un closer cargó una llamada';
exception when insufficient_privilege then null;
end $$;
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.interaccion_cargar_manual('aaaaaaaa-0000-0000-0000-000000000000', 'x', now(), null, null,
    '{"transcripcion": [{"hablante":"A","texto":"Hola"}]}');
  raise exception 'FALLÓ: se cargó una transcripción de una línea';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
do $$
begin
  perform public.interaccion_cargar_manual('aaaaaaaa-0000-0000-0000-000000000000', 'x', now(), 'c0000000-0000-0000-0000-00000000000b', null,
    '{"transcripcion": [{"hablante":"A","texto":"uno"},{"hablante":"B","texto":"dos"},{"hablante":"A","texto":"tres"}]}');
  raise exception 'FALLÓ: se cargó una llamada con un cliente de otro negocio';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;
insert into ids select 'manual', (public.interaccion_cargar_manual('aaaaaaaa-0000-0000-0000-000000000000', 'Llamada por Zoom', now() - interval '1 day',
  'c0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000a',
  '{"transcripcion": [{"hablante": "Ana", "segundo": 0, "texto": "Hola, ¿cómo estás?"},
                      {"hablante": "Juan", "segundo": 5, "texto": "Bien, quería saber si tiene garantía"},
                      {"hablante": "Ana", "segundo": 12, "texto": "Sí, de treinta días"},
                      {"hablante": "Juan", "segundo": 20, "texto": ""}],
    "roles": {"Juan": "prospecto", "Ana": "vendedor", "Otro": "jefe"}}') ->> 'interaccion_id')::uuid;
select pruebas.como_postgres();
select pruebas.ok((select fuente = 'manual' and estado = 'vinculada' and cliente_id = 'c0000000-0000-0000-0000-00000000000a'
                          and asignado_por = '00000000-0000-0000-0000-0000000000a1' and duracion_seg = 12
                          and position('saber si' in encode(contenido_cifrado, 'escape')) = 0
                   from public.interacciones where id = (select id from ids where clave = 'manual')), 'la llamada manual queda vinculada y cifrada');
select pruebas.ok((select estado = 'pendiente' from public.interaccion_analisis where interaccion_id = (select id from ids where clave = 'manual')),
                  'y su análisis, encolado');
select pruebas.ok(exists (select 1 from public.registro_accesos where accion = 'interaccion_cargada'), 'la carga queda en la bitácora');
select pruebas.como_servicio();
select pruebas.ok((select c -> 'contenido' -> 'roles' = '{"Juan": "prospecto", "Ana": "vendedor"}'
                          and jsonb_array_length(c -> 'contenido' -> 'transcripcion') = 3
                   from (select public.analisis_contenido((select id from public.interaccion_analisis
                                                           where interaccion_id = (select id from ids where clave = 'manual'))) c) t),
                  'guarda los roles válidos y descarta las líneas vacías');

-- Un error del servidor queda a la vista, y el titular puede volver a pedirlo.
select public.analisis_error((select id from public.interaccion_analisis where interaccion_id = (select id from ids where clave = 'manual')), 'La API no respondió');
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select estado = 'error' from public.analisis_listado('aaaaaaaa-0000-0000-0000-000000000000') where interaccion_id = (select id from ids where clave = 'manual')),
                  'el error se ve en el listado');
select public.analisis_solicitar((select id from ids where clave = 'manual'));
select pruebas.ok((select estado = 'pendiente' from public.analisis_listado('aaaaaaaa-0000-0000-0000-000000000000') where interaccion_id = (select id from ids where clave = 'manual')),
                  'después de un error, el titular lo vuelve a pedir');

-- Un trabajo que agotó sus intentos se informa como error.
select pruebas.como_postgres();
update public.cola_trabajos set estado = 'fallido', terminado_en = now()
where clave_idempotencia = 'interaccion_analizar:' || (select id from public.interaccion_analisis
                                                       where interaccion_id = (select id from ids where clave = 'manual') and estado = 'pendiente');
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select estado = 'error' from public.analisis_listado('aaaaaaaa-0000-0000-0000-000000000000') where interaccion_id = (select id from ids where clave = 'manual')),
                  'un trabajo fallido se ve como error');

-- ---------------------------------------------------------------------
-- Límite mensual del plan
-- ---------------------------------------------------------------------
select pruebas.como_postgres();
insert into public.org_funcionalidades (organizacion_id, funcionalidad, habilitada, limites) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'analisis_llamadas', true, '{"llamadas_mes": 1}');
insert into public.interacciones (id, organizacion_id, fuente, externo_id, titulo, ocurrida_en, participantes, contenido_cifrado, contenido_sha256, retener_contenido_hasta)
values ('1a000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000000', 'fathom', 'rec-3', 'Otra venta', now(), '{}',
        pgp_sym_encrypt('{"transcripcion": []}', public.crm_clave('interacciones_contenido'), 'cipher-algo=aes256'), 'sha3', now() + interval '90 days');
select pruebas.como_servicio();
select public.interaccion_vincular('1a000000-0000-0000-0000-0000000000a3');
select pruebas.como_postgres();
select pruebas.ok((select estado = 'limite' from public.interaccion_analisis where interaccion_id = '1a000000-0000-0000-0000-0000000000a3'),
                  'pasado el límite del mes, el análisis queda en limite');
select pruebas.ok(not exists (select 1 from public.cola_trabajos j join public.interaccion_analisis a on j.clave_idempotencia = 'interaccion_analizar:' || a.id
                              where a.interaccion_id = '1a000000-0000-0000-0000-0000000000a3'), 'y no se encola');
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select public.analisis_solicitar('1a000000-0000-0000-0000-0000000000a3');
select pruebas.como_postgres();
select pruebas.ok((select estado = 'pendiente' from public.interaccion_analisis where interaccion_id = '1a000000-0000-0000-0000-0000000000a3' and estado <> 'reemplazado'),
                  'FIRMA lo pide sin el límite');

-- Sin la funcionalidad, no se analiza ni se carga.
update public.org_funcionalidades set habilitada = false, limites = null
where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and funcionalidad = 'analisis_llamadas';
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.interaccion_cargar_manual('aaaaaaaa-0000-0000-0000-000000000000', 'x', now(), null, null,
    '{"transcripcion": [{"hablante":"A","texto":"uno"},{"hablante":"B","texto":"dos"},{"hablante":"A","texto":"tres"}]}');
  raise exception 'FALLÓ: se cargó una llamada sin la funcionalidad';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;

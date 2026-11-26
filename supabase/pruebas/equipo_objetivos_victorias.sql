-- =====================================================================
-- Objetivos, hitos, victorias y reportes del equipo (migración 0076).
-- Negocio A: titular (a1), CSM (a2), closer (a3) y setter (a4), cada uno
-- con su lugar en el equipo. Negocio B: titular (b1) y un closer sin cuenta.
-- =====================================================================

-- Comprueba que una consulta se rechaza con el mensaje esperado.
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

insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, cargo, usuario_id) values
  ('e0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Titular de A', 'otro', 'Dueño', '00000000-0000-0000-0000-0000000000a1'),
  ('e0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'CSM de A', 'csm', null, '00000000-0000-0000-0000-0000000000a2'),
  ('e0000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000000', 'Closer de A', 'closer', null, '00000000-0000-0000-0000-0000000000a3'),
  ('e0000000-0000-0000-0000-0000000000a4', 'aaaaaaaa-0000-0000-0000-000000000000', 'Setter de A', 'setter', null, '00000000-0000-0000-0000-0000000000a4'),
  ('e0000000-0000-0000-0000-0000000000b3', 'bbbbbbbb-0000-0000-0000-000000000000', 'Closer de B', 'closer', null, null);

-- ---------------------------------------------------------------------
-- Plantillas de FIRMA
-- ---------------------------------------------------------------------
select pruebas.ok((select count(*) from public.equipo_reportes where organizacion_id is null) = 4, 'FIRMA deja un reporte por rol');
select pruebas.ok((select count(*) from public.equipo_hitos where organizacion_id is null and rol_comercial = 'closer') = 5, 'FIRMA deja cinco hitos de closer');
select pruebas.ok(not exists (
  select 1 from public.equipo_reportes r, jsonb_array_elements(r.campos) c
   where r.organizacion_id is null and (c ->> 'etiqueta') ~* 'horario|hora de|horas trabajadas'), 'las plantillas no piden horarios');

select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok(public.equipo_cargar_plantillas('aaaaaaaa-0000-0000-0000-000000000000', 'closer') = '{"hitos": 5, "reportes": 1}'::jsonb, 'el titular copia las plantillas de closer');
select pruebas.ok(public.equipo_cargar_plantillas('aaaaaaaa-0000-0000-0000-000000000000', 'closer') = '{"hitos": 0, "reportes": 0}'::jsonb, 'la segunda vez no repite nada');
select public.equipo_cargar_plantillas('aaaaaaaa-0000-0000-0000-000000000000', 'setter');
select public.equipo_cargar_plantillas('aaaaaaaa-0000-0000-0000-000000000000', 'csm');
-- El titular no toca las plantillas de FIRMA: la política no le deja ver la fila para cambiarla.
update public.equipo_reportes set titulo = 'Cambiado' where organizacion_id is null and rol_comercial = 'closer';
select pruebas.como_postgres();
select pruebas.ok(not exists (select 1 from public.equipo_reportes where titulo = 'Cambiado'), 'el titular no edita las plantillas de FIRMA');

select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.falla($q$select public.equipo_cargar_plantillas('aaaaaaaa-0000-0000-0000-000000000000', 'closer')$q$, 'Solo quien lidera');
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.falla($q$select public.equipo_cargar_plantillas('aaaaaaaa-0000-0000-0000-000000000000', 'closer')$q$, 'Solo quien lidera');
select pruebas.ok(not exists (select 1 from public.equipo_hitos where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000'), 'B no ve los hitos de A');
select pruebas.como_postgres();

-- ---------------------------------------------------------------------
-- Reportes: resultados, no horarios
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.falla($q$update public.equipo_reportes
   set campos = campos || '[{"clave":"entrada","etiqueta":"Hora de entrada","tipo":"texto"}]'::jsonb
 where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and rol_comercial = 'closer'$q$, 'no horarios');
select pruebas.falla($q$insert into public.equipo_reportes (organizacion_id, rol_comercial, titulo, campos)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'setter', 'Sin campos', '[]')$q$, 'al menos un campo');
select pruebas.falla($q$insert into public.equipo_reportes (organizacion_id, rol_comercial, titulo, campos)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'setter', 'Repetido', '[{"clave":"a","etiqueta":"Uno","tipo":"numero"},{"clave":"a","etiqueta":"Dos","tipo":"numero"}]')$q$, 'misma clave');
select pruebas.como_postgres();
-- FIRMA sí puede sumar un campo así, después de evaluar el vínculo.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
update public.equipo_reportes
   set campos = campos || '[{"clave":"guardia","etiqueta":"Horario de guardia","tipo":"texto"}]'::jsonb
 where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and rol_comercial = 'csm';
select pruebas.como_postgres();
select pruebas.ok(exists (select 1 from public.equipo_reportes r, jsonb_array_elements(r.campos) c
                           where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and c ->> 'clave' = 'guardia'), 'FIRMA suma un campo de horario');

-- ---------------------------------------------------------------------
-- Objetivos
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.equipo_objetivos (id, organizacion_id, titulo, alcance, rol_comercial, medida, reporte_id, campo, meta, desde, hasta)
select '0b000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', '12 cierres este mes', 'rol', 'closer', 'reporte', r.id, 'cierres', 12,
       date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date
  from public.equipo_reportes r where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and r.rol_comercial = 'closer';
insert into public.equipo_objetivos (id, organizacion_id, titulo, alcance, medida, meta, desde, hasta) values
  ('0b000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'USD 10.000 vendidos', 'negocio', 'valor', 10000, current_date - 10, current_date + 20);
insert into public.equipo_objetivos (id, organizacion_id, titulo, alcance, miembro_id, medida, meta, desde, hasta) values
  ('0b000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000000', 'Tres testimonios', 'persona', 'e0000000-0000-0000-0000-0000000000a4', 'victorias', 3, current_date - 10, current_date + 20);
select pruebas.falla($q$insert into public.equipo_objetivos (organizacion_id, titulo, alcance, rol_comercial, medida, reporte_id, campo, meta, desde, hasta)
  select 'aaaaaaaa-0000-0000-0000-000000000000', 'Por un texto', 'rol', 'closer', 'reporte', r.id, 'objecion', 5, current_date, current_date + 5
    from public.equipo_reportes r where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and r.rol_comercial = 'closer'$q$, 'campo de número');
select pruebas.falla($q$insert into public.equipo_objetivos (organizacion_id, titulo, alcance, medida, meta, desde, hasta)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'Sin persona', 'persona', 'victorias', 1, current_date, current_date)$q$, 'check');
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.falla($q$insert into public.equipo_objetivos (organizacion_id, titulo, alcance, medida, meta, desde, hasta)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'Me pongo uno', 'negocio', 'victorias', 1, current_date, current_date)$q$, 'row-level security');
select pruebas.ok((select count(*) from public.equipo_objetivos) = 2, 'el closer ve los del negocio y los de su rol, no los de otra persona');
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok((select count(*) from public.equipo_objetivos) = 2, 'el setter ve el del negocio y el suyo');
select pruebas.como_postgres();

-- ---------------------------------------------------------------------
-- Victorias
-- ---------------------------------------------------------------------
-- El closer carga la suya: entra pendiente aunque pida otra cosa y no la puede validar.
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
insert into public.equipo_victorias (id, organizacion_id, miembro_id, titulo, valor, moneda, objetivo_id, estado)
values ('f0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a3', 'Cerré a Juan Pérez', 2000, 'USD', '0b000000-0000-0000-0000-000000000002', 'validada');
select pruebas.ok((select estado from public.equipo_victorias where id = 'f0000000-0000-0000-0000-000000000001') = 'pendiente', 'la victoria propia entra pendiente');
select pruebas.falla($q$insert into public.equipo_victorias (organizacion_id, miembro_id, titulo) values ('aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a4', 'La del setter')$q$, 'row-level security');
select pruebas.falla($q$update public.equipo_victorias set estado = 'validada' where id = 'f0000000-0000-0000-0000-000000000001'$q$, 'quien lidera el equipo');
select pruebas.falla($q$select public.equipo_victoria_validar('f0000000-0000-0000-0000-000000000001', 'validada')$q$, 'Solo quien lidera');
update public.equipo_victorias set detalle = 'Pago completo' where id = 'f0000000-0000-0000-0000-000000000001';
-- Un hito de FIRMA no se ata: va el de la empresa.
select pruebas.falla($q$insert into public.equipo_victorias (organizacion_id, miembro_id, titulo, hito_id)
  select 'aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a3', 'Hito ajeno', h.id from public.equipo_hitos h where h.organizacion_id is null limit 1$q$, 'foreign key');
insert into public.equipo_victorias (organizacion_id, miembro_id, titulo, hito_id)
select 'aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a3', 'Mi primer cierre', h.id
  from public.equipo_hitos h where h.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and h.titulo = 'Primer cierre';
-- La evidencia va en la carpeta de la victoria.
select pruebas.falla($q$insert into public.equipo_victorias (id, organizacion_id, miembro_id, titulo, evidencia_ruta)
  values ('f0000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a3', 'Con captura', 'bbbbbbbb-0000-0000-0000-000000000000/x/captura.png')$q$, 'carpeta de la victoria');
insert into storage.objects (bucket_id, name) values ('equipo', 'aaaaaaaa-0000-0000-0000-000000000000/f0000000-0000-0000-0000-000000000002/captura.png');
insert into public.equipo_victorias (id, organizacion_id, miembro_id, titulo, evidencia_ruta, evidencia_nombre)
values ('f0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a3', 'Testimonio en video',
        'aaaaaaaa-0000-0000-0000-000000000000/f0000000-0000-0000-0000-000000000002/captura.png', 'captura.png');
select pruebas.ok(public.evidencia_visible('aaaaaaaa-0000-0000-0000-000000000000/f0000000-0000-0000-0000-000000000002/captura.png'), 'el closer ve su evidencia');
select pruebas.como_postgres();

-- El setter no ve lo pendiente de otro; el titular sí.
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok((select count(*) from public.equipo_victorias) = 0, 'el setter no ve victorias pendientes ajenas');
select pruebas.ok(not public.evidencia_visible('aaaaaaaa-0000-0000-0000-000000000000/f0000000-0000-0000-0000-000000000002/captura.png'), 'ni su evidencia');
select pruebas.como_postgres();

select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.equipo_victorias) = 3, 'el titular ve todas');
select pruebas.ok((public.equipo_victoria_validar('f0000000-0000-0000-0000-000000000001', 'validada')).estado = 'validada', 'el titular valida');
select pruebas.falla($q$select public.equipo_victoria_validar('f0000000-0000-0000-0000-000000000002', 'rechazada')$q$, 'Contá por qué');
select public.equipo_victoria_validar('f0000000-0000-0000-0000-000000000002', 'rechazada', 'Falta el permiso del cliente para publicarlo');
-- La que carga para otra persona entra validada.
insert into public.equipo_victorias (id, organizacion_id, miembro_id, titulo, objetivo_id)
values ('f0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a4', 'Testimonio de Ana', '0b000000-0000-0000-0000-000000000003');
select pruebas.ok((select estado from public.equipo_victorias where id = 'f0000000-0000-0000-0000-000000000003') = 'validada', 'la que carga el titular para otro entra validada');
-- La propia del titular queda pendiente y no se la valida.
insert into public.equipo_victorias (id, organizacion_id, miembro_id, titulo)
values ('f0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a1', 'Lancé la oferta nueva');
select pruebas.ok((select estado from public.equipo_victorias where id = 'f0000000-0000-0000-0000-000000000004') = 'pendiente', 'la propia del titular queda pendiente');
select pruebas.falla($q$select public.equipo_victoria_validar('f0000000-0000-0000-0000-000000000004', 'validada')$q$, 'propia victoria');
select pruebas.falla($q$update public.equipo_victorias set valor = 99999 where id = 'f0000000-0000-0000-0000-000000000001'$q$, 'ya revisada');
select pruebas.como_postgres();

-- Validada, el closer ya no la edita: la política no le deja ver la fila para cambiarla.
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
update public.equipo_victorias set titulo = 'Cerré a Juan Pérez y a Ana' where id = 'f0000000-0000-0000-0000-000000000001';
select pruebas.como_postgres();
select pruebas.ok((select titulo from public.equipo_victorias where id = 'f0000000-0000-0000-0000-000000000001') = 'Cerré a Juan Pérez', 'el closer no edita una victoria validada');

-- El setter ve el muro: las validadas del negocio.
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok((select count(*) from public.equipo_victorias) = 2, 'el setter ve las validadas del negocio');
select pruebas.como_postgres();

-- El CSM sin Operaciones no valida; con Operaciones, sí.
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.falla($q$select public.equipo_victoria_validar('f0000000-0000-0000-0000-000000000004', 'validada')$q$, 'Solo quien lidera');
select pruebas.como_postgres();
update public.perfiles set areas = array['operaciones'] where id = '00000000-0000-0000-0000-0000000000a2';
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
select pruebas.ok((public.equipo_victoria_validar('f0000000-0000-0000-0000-000000000004', 'validada')).estado = 'validada', 'el CSM con Operaciones valida la del titular');
select pruebas.como_postgres();
update public.perfiles set areas = '{}' where id = '00000000-0000-0000-0000-0000000000a2';

-- FIRMA puede volver una decisión atrás.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pruebas.ok((public.equipo_victoria_validar('f0000000-0000-0000-0000-000000000002', 'pendiente')).estado = 'pendiente', 'FIRMA vuelve una victoria a pendiente');
select pruebas.como_postgres();

-- ---------------------------------------------------------------------
-- Reportes entregados
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
insert into public.equipo_reporte_respuestas (organizacion_id, reporte_id, miembro_id, periodo, respuestas)
select 'aaaaaaaa-0000-0000-0000-000000000000', r.id, 'e0000000-0000-0000-0000-0000000000a3', current_date,
       '{"agendadas": 5, "realizadas": 4, "cierres": 2, "vendido": 3000, "objecion": "", "inventado": "no va"}'
  from public.equipo_reportes r where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and r.rol_comercial = 'closer';
select pruebas.ok((select respuestas from public.equipo_reporte_respuestas) = '{"agendadas": 5, "realizadas": 4, "cierres": 2, "vendido": 3000}'::jsonb,
  'quedan solo los campos del reporte, sin los vacíos');
select pruebas.falla($q$insert into public.equipo_reporte_respuestas (organizacion_id, reporte_id, miembro_id, periodo, respuestas)
  select 'aaaaaaaa-0000-0000-0000-000000000000', r.id, 'e0000000-0000-0000-0000-0000000000a3', current_date - 1, '{"agendadas": "cinco", "realizadas": 4, "cierres": 1}'
    from public.equipo_reportes r where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and r.rol_comercial = 'closer'$q$, 'lleva un número');
select pruebas.falla($q$insert into public.equipo_reporte_respuestas (organizacion_id, reporte_id, miembro_id, periodo, respuestas)
  select 'aaaaaaaa-0000-0000-0000-000000000000', r.id, 'e0000000-0000-0000-0000-0000000000a3', current_date - 2, '{"agendadas": 5}'
    from public.equipo_reportes r where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and r.rol_comercial = 'closer'$q$, 'Falta completar');
select pruebas.falla($q$insert into public.equipo_reporte_respuestas (organizacion_id, reporte_id, miembro_id, periodo, respuestas)
  select 'aaaaaaaa-0000-0000-0000-000000000000', r.id, 'e0000000-0000-0000-0000-0000000000a3', current_date + 5, '{"agendadas": 5, "realizadas": 4, "cierres": 1}'
    from public.equipo_reportes r where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and r.rol_comercial = 'closer'$q$, 'todavía no llegó');
select pruebas.falla($q$insert into public.equipo_reporte_respuestas (organizacion_id, reporte_id, miembro_id, periodo, respuestas)
  select 'aaaaaaaa-0000-0000-0000-000000000000', r.id, 'e0000000-0000-0000-0000-0000000000a3', current_date, '{"agendadas": 1, "realizadas": 1, "cierres": 1}'
    from public.equipo_reportes r where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and r.rol_comercial = 'closer'$q$, 'duplicate');
-- Ni el reporte de otro rol ni el de otra persona.
select pruebas.falla($q$insert into public.equipo_reporte_respuestas (organizacion_id, reporte_id, miembro_id, periodo, respuestas)
  select 'aaaaaaaa-0000-0000-0000-000000000000', r.id, 'e0000000-0000-0000-0000-0000000000a3', current_date, '{"conversaciones": 3, "agendas": 1}'
    from public.equipo_reportes r where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and r.rol_comercial = 'setter'$q$, 'otro rol');
select pruebas.falla($q$insert into public.equipo_reporte_respuestas (organizacion_id, reporte_id, miembro_id, periodo, respuestas)
  select 'aaaaaaaa-0000-0000-0000-000000000000', r.id, 'e0000000-0000-0000-0000-0000000000a4', current_date, '{"conversaciones": 3, "agendas": 1}'
    from public.equipo_reportes r where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and r.rol_comercial = 'setter'$q$, 'row-level security');
-- Lo puede corregir después, sin cambiar cuándo lo mandó.
update public.equipo_reporte_respuestas set respuestas = respuestas || '{"cierres": 3}' where miembro_id = 'e0000000-0000-0000-0000-0000000000a3';
select pruebas.como_postgres();

-- El semanal se guarda en el lunes de la semana.
select pruebas.como('00000000-0000-0000-0000-0000000000a2');
insert into public.equipo_reporte_respuestas (organizacion_id, reporte_id, miembro_id, periodo, respuestas)
select 'aaaaaaaa-0000-0000-0000-000000000000', r.id, 'e0000000-0000-0000-0000-0000000000a2', current_date, '{"contactados": 12, "en_riesgo": 1}'
  from public.equipo_reportes r where r.organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000' and r.rol_comercial = 'csm';
select pruebas.ok((select periodo from public.equipo_reporte_respuestas where miembro_id = 'e0000000-0000-0000-0000-0000000000a2') = date_trunc('week', current_date)::date,
  'el reporte semanal queda en el lunes');
select pruebas.ok((select count(*) from public.equipo_reporte_respuestas) = 1, 'el CSM sin Operaciones ve solo el suyo');
select pruebas.como_postgres();

select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok((select count(*) from public.equipo_reporte_respuestas) = 0, 'el setter no ve los reportes de otros');
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.equipo_reporte_respuestas) = 2, 'el titular ve todos');
select pruebas.como_postgres();
select pruebas.ok((select enviado_en <= actualizado_en and (respuestas ->> 'cierres')::int = 3 from public.equipo_reporte_respuestas
                    where miembro_id = 'e0000000-0000-0000-0000-0000000000a3'), 'corregir guarda el dato nuevo y no cambia el envío');

-- ---------------------------------------------------------------------
-- Avance de los objetivos
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select avance from public.equipo_objetivos_avance('aaaaaaaa-0000-0000-0000-000000000000')
                    where objetivo_id = '0b000000-0000-0000-0000-000000000001' and miembro_id = 'e0000000-0000-0000-0000-0000000000a3') = 3,
  'los cierres salen del reporte del closer');
select pruebas.ok((select avance from public.equipo_objetivos_avance('aaaaaaaa-0000-0000-0000-000000000000')
                    where objetivo_id = '0b000000-0000-0000-0000-000000000002') = 2000,
  'el valor suma solo las victorias validadas atadas al objetivo');
select pruebas.ok((select avance from public.equipo_objetivos_avance('aaaaaaaa-0000-0000-0000-000000000000')
                    where objetivo_id = '0b000000-0000-0000-0000-000000000003') = 1,
  'las victorias de la persona cuentan para su objetivo');
select pruebas.ok((select count(*) from public.equipo_objetivos_avance('aaaaaaaa-0000-0000-0000-000000000000')) = 3, 'el titular ve todo el avance');
select pruebas.como_postgres();

select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok((select count(*) from public.equipo_objetivos_avance('aaaaaaaa-0000-0000-0000-000000000000')) = 2, 'el setter ve el avance del negocio y el suyo');
select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a3');
select pruebas.ok((select count(*) from public.equipo_objetivos_avance('aaaaaaaa-0000-0000-0000-000000000000')
                    where miembro_id is distinct from 'e0000000-0000-0000-0000-0000000000a3' and miembro_id is not null) = 0, 'el closer no ve el avance de otra persona');
select pruebas.como_postgres();

-- ---------------------------------------------------------------------
-- Aislamiento entre empresas
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.equipo_victorias) = 0, 'B no ve victorias de A');
select pruebas.ok((select count(*) from public.equipo_objetivos) = 0, 'B no ve objetivos de A');
select pruebas.ok((select count(*) from public.equipo_reporte_respuestas) = 0, 'B no ve reportes de A');
select pruebas.ok((select count(*) from public.equipo_objetivos_avance('aaaaaaaa-0000-0000-0000-000000000000')) = 0, 'B no ve el avance de A');
select pruebas.falla($q$insert into public.equipo_victorias (organizacion_id, miembro_id, titulo) values ('aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a3', 'Ajena')$q$, 'row-level security');
select pruebas.falla($q$insert into public.equipo_victorias (organizacion_id, miembro_id, titulo) values ('bbbbbbbb-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a3', 'Cruzada')$q$, 'foreign key');
select pruebas.falla($q$insert into storage.objects (bucket_id, name) values ('equipo', 'aaaaaaaa-0000-0000-0000-000000000000/x/y.png')$q$, 'row-level security');
select pruebas.ok(not public.evidencia_visible('aaaaaaaa-0000-0000-0000-000000000000/f0000000-0000-0000-0000-000000000002/captura.png'), 'B no ve evidencias de A');
select pruebas.como_postgres();

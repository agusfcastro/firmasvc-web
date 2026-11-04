-- =====================================================================
-- Planes de producto y funcionalidades.
-- =====================================================================

-- Desde 0054 todo negocio tiene plan de servicio y el que viene por defecto
-- es Eminent, que trae Fathom (0052). Gold sin plan de producto no tiene
-- ninguna funcionalidad nueva.
update public.organizaciones set plan = 'gold';
select pruebas.ok(not public.tiene_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'fathom'), 'Gold sin plan de producto no tiene Fathom');
select pruebas.ok(public.limite_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'fathom') is null, 'Gold sin plan de producto no tiene límite de Fathom');

update public.organizaciones set plan_producto = 'radar' where id = 'aaaaaaaa-0000-0000-0000-000000000000';
update public.organizaciones set plan_producto = 'blindaje' where id = 'bbbbbbbb-0000-0000-0000-000000000000';

select pruebas.ok(public.tiene_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'fathom'), 'Radar tiene Fathom');
select pruebas.ok(not public.tiene_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'puntaje_riesgo'), 'Radar no tiene puntaje');
select pruebas.ok((public.limite_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'analisis_llamadas') ->> 'llamadas_mes')::int = 30,
  'Radar analiza hasta 30 llamadas por mes');
select pruebas.ok(public.limite_funcionalidad('bbbbbbbb-0000-0000-0000-000000000000', 'analisis_llamadas') = '{}'::jsonb,
  'Blindaje analiza sin límite');
select pruebas.ok(public.tiene_funcionalidad('bbbbbbbb-0000-0000-0000-000000000000', 'whatsapp'), 'Blindaje tiene WhatsApp');

-- Una excepción vigente manda sobre el plan; una vencida, no.
insert into public.org_funcionalidades (organizacion_id, funcionalidad, habilitada, limites, vence_en) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'puntaje_riesgo', true, null, now() + interval '30 days'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'analisis_llamadas', true, '{"llamadas_mes": 100}', null),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'whatsapp', false, null, null),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'revision_legal', false, null, now() - interval '1 day');
select pruebas.ok(public.tiene_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'puntaje_riesgo'), 'la prueba de puntaje habilita a Radar');
select pruebas.ok((public.limite_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'analisis_llamadas') ->> 'llamadas_mes')::int = 100,
  'el cupo propio reemplaza al del plan');
select pruebas.ok(not public.tiene_funcionalidad('bbbbbbbb-0000-0000-0000-000000000000', 'whatsapp'), 'la excepción apaga WhatsApp en B');
select pruebas.ok(public.tiene_funcionalidad('bbbbbbbb-0000-0000-0000-000000000000', 'revision_legal'), 'una excepción vencida no cuenta');

-- Solo FIRMA cambia planes y excepciones.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.org_funcionalidades) = 2, 'el titular ve las excepciones de su negocio');
do $$
declare
  filas int;
begin
  update public.organizaciones set plan_producto = 'blindaje' where id = 'aaaaaaaa-0000-0000-0000-000000000000';
  get diagnostics filas = row_count;
  perform pruebas.ok(filas = 0, 'el titular no se cambia el plan');
  begin
    insert into public.org_funcionalidades (organizacion_id, funcionalidad, habilitada)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'whatsapp', true);
    raise exception 'FALLÓ: el titular se habilitó una funcionalidad';
  exception when insufficient_privilege then null;
  end;
end $$;
select pruebas.ok(public.tiene_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'fathom'), 'el titular consulta sus funcionalidades');

-- El plan de servicio Eminent incluye Fathom aunque no tenga plan de producto;
-- Gold no. Una excepción lo puede apagar.
select pruebas.como_postgres();
update public.organizaciones set plan_producto = null, plan = 'eminent' where id = 'aaaaaaaa-0000-0000-0000-000000000000';
update public.organizaciones set plan_producto = null, plan = 'gold' where id = 'bbbbbbbb-0000-0000-0000-000000000000';
delete from public.org_funcionalidades;
select pruebas.ok(public.tiene_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'fathom'), 'Eminent trae las llamadas de Fathom');
select pruebas.ok(public.limite_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'fathom') = '{}', 'sin límites');
select pruebas.ok(not public.tiene_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'puntaje_riesgo'), 'Eminent no trae el resto del plan de producto');
select pruebas.ok(not public.tiene_funcionalidad('bbbbbbbb-0000-0000-0000-000000000000', 'fathom'), 'Gold no trae Fathom');
insert into public.org_funcionalidades (organizacion_id, funcionalidad, habilitada) values ('aaaaaaaa-0000-0000-0000-000000000000', 'fathom', false);
select pruebas.ok(not public.tiene_funcionalidad('aaaaaaaa-0000-0000-0000-000000000000', 'fathom'), 'una excepción apaga Fathom en Eminent');

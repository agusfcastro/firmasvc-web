-- =====================================================================
-- Auditoría de la IA (migración 0074): las corridas las escribe el
-- servidor, las lee y las revisa solo FIRMA, y los casos son de FIRMA.
-- =====================================================================

select pruebas.como_servicio();
insert into public.ia_corridas (agente, version_prompt, modelo, organizacion_id, referencia_tabla, referencia_id, tokens_entrada, tokens_salida, costo_usd, duracion_ms) values
  ('tina', 'abc123def456', 'claude-opus-5-5', 'aaaaaaaa-0000-0000-0000-000000000000', 'tina_conversaciones', '1', 1000, 200, 0.008, 1500),
  ('tina', 'abc123def456', 'claude-opus-5-5', 'aaaaaaaa-0000-0000-0000-000000000000', 'tina_conversaciones', '2', 900, 100, 0.0056, 1200),
  ('analisis_venta', 'fff000fff000', 'claude-opus-5-5', 'bbbbbbbb-0000-0000-0000-000000000000', 'interaccion_analisis', 'x', 20000, 3000, 0.14, 40000);

-- Un agente con nombre raro o una referencia a otra tabla no entra.
do $$ begin
  insert into public.ia_corridas (agente, version_prompt) values ('Tina con espacios', 'v');
  raise exception 'FALLÓ: se anotó un agente con nombre inválido';
exception when check_violation then null;
end $$;
do $$ begin
  insert into public.ia_corridas (agente, version_prompt, referencia_tabla) values ('tina', 'v', 'crm_clientes');
  raise exception 'FALLÓ: se anotó una referencia a una tabla no prevista';
exception when check_violation then null;
end $$;

-- El titular no ve corridas ni casos, no las revisa y no las escribe.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.ia_corridas) = 0, 'un titular no ve las corridas de la IA');
select pruebas.ok((select count(*) from public.ia_resumen()) = 0, 'un titular no ve el resumen');
do $$ begin
  perform public.ia_corrida_revisar((select min(id) from public.ia_corridas), 'aprobada');
  raise exception 'FALLÓ: un titular revisó una corrida';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.ia_corridas (agente, version_prompt) values ('tina', 'v');
  raise exception 'FALLÓ: un titular anotó una corrida';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.ia_casos (agente, etiqueta, entrada, esperado) values ('tina', 'caso', '{}', '{}');
  raise exception 'FALLÓ: un titular cargó un caso de prueba';
exception when insufficient_privilege then null;
end $$;

-- El admin sin verificación en dos pasos tampoco las ve.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal1');
select pruebas.ok((select count(*) from public.ia_corridas) = 0, 'sin dos pasos, el admin no ve las corridas');

-- FIRMA las ve, las revisa y arma casos con sus correcciones.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pruebas.ok((select count(*) from public.ia_corridas) = 3, 'FIRMA ve todas las corridas');
select public.ia_corrida_revisar((select min(id) from public.ia_corridas where agente = 'tina'), 'aprobada');
select public.ia_corrida_revisar((select max(id) from public.ia_corridas where agente = 'tina'), 'corregida', '  Prometió un plazo que el contrato no da  ');
do $$ begin
  perform public.ia_corrida_revisar((select min(id) from public.ia_corridas), 'cualquiera');
  raise exception 'FALLÓ: se aceptó una revisión desconocida';
exception when check_violation then null;
end $$;
-- La corrida no se cambia por fuera de la función.
do $$ begin
  update public.ia_corridas set costo_usd = 0;
  raise exception 'FALLÓ: FIRMA cambió una corrida a mano';
exception when insufficient_privilege then null;
end $$;
insert into public.ia_casos (agente, etiqueta, origen, corrida_id, entrada, esperado)
  select 'tina', 'No promete plazos', 'correccion', max(id), '{"mensaje":"¿En cuánto me devuelven el dinero?"}', '{"no_contiene":["días hábiles"]}' from public.ia_corridas where agente = 'tina';
select pruebas.ok((select count(*) from public.ia_casos where origen = 'correccion') = 1, 'una corrección queda como caso de prueba');

select pruebas.ok((select revisadas = 2 and aprobadas = 1 and corridas = 2 from public.ia_resumen() where agente = 'tina'), 'el resumen cuenta revisadas y aprobadas por versión de prompt');
select pruebas.ok((select nota from public.ia_corridas where revision = 'corregida') = 'Prometió un plazo que el contrato no da', 'la nota se guarda sin espacios de más');
select pruebas.ok((select revisado_por from public.ia_corridas where revision = 'aprobada') = '00000000-0000-0000-0000-0000000000ad', 'queda quién revisó');

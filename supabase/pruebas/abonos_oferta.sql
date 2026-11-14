-- =====================================================================
-- Abonos con la oferta de noviembre de 2026 (0061): modalidades, etapas,
-- precio fundador y pesos al dólar MEP.
-- =====================================================================

-- Los abonos de antes, sin modalidad, siguen igual.
select pruebas.ok((select count(*) from public.abonos where modalidad is null) = 2, 'los abonos sin modalidad siguen andando');

-- FIRMA arma un abono en tres cuotas.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
insert into public.abonos (organizacion_id, concepto, monto, moneda, pais, email_pagador, plan_servicio, modalidad, etapa, cuotas_iniciales, monto_inicial, monto_posterior)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'Plan Eminent de FIRMA', 750, 'USD', null, 'pagos@a.test', 'eminent', 'cuotas', 'inicial', 3, 750, 500);
select pruebas.ok((select count(*) from public.abonos where modalidad = 'cuotas') = 1, 'FIRMA arma un abono en cuotas');

-- Y uno en pesos al MEP con pago completo.
insert into public.abonos (organizacion_id, concepto, monto, moneda, pais, email_pagador, plan_servicio, modalidad, etapa, monto_inicial, monto_posterior, meses_cubiertos, congela_meses, al_mep, monto_usd, cotizacion_mep, cotizado_en)
values ('bbbbbbbb-0000-0000-0000-000000000000', 'Plan Starter de FIRMA', 1587900, 'ARS', 'AR', 'pagos@b.test', 'starter', 'pago_completo', 'inicial', 1000, 250, 4, 12, true, 1000, 1587.90, now());
select pruebas.ok((select al_mep from public.abonos where modalidad = 'pago_completo'), 'FIRMA arma un abono en pesos al MEP');
select pruebas.como_postgres();

-- Esquemas incompletos o contradictorios.
do $$
begin
  begin
    insert into public.abonos (organizacion_id, concepto, monto, moneda, email_pagador, modalidad, etapa, monto_inicial, monto_posterior)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Sin cuotas', 750, 'USD', 'x@a.test', 'cuotas', 'inicial', 750, 500);
    raise exception 'FALLÓ: un abono en cuotas sin la cantidad de cuotas no tendría que guardarse';
  exception when check_violation then null;
  end;
  begin
    insert into public.abonos (organizacion_id, concepto, monto, moneda, email_pagador, modalidad, etapa, monto_inicial, monto_posterior, meses_cubiertos, periodo_meses)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Trimestral', 1800, 'USD', 'x@a.test', 'pago_completo', 'inicial', 1800, 500, 4, 3);
    raise exception 'FALLÓ: el pago completo no va con periodicidad trimestral';
  exception when check_violation then null;
  end;
  begin
    insert into public.abonos (organizacion_id, concepto, monto, moneda, email_pagador, etapa)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Etapa suelta', 100, 'USD', 'x@a.test', 'inicial');
    raise exception 'FALLÓ: un abono sin modalidad no lleva etapa';
  exception when check_violation then null;
  end;
  begin
    insert into public.abonos (organizacion_id, concepto, monto, moneda, email_pagador, modalidad, etapa, cuotas_iniciales, monto_inicial, monto_posterior, precio_fundador)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Fundador en cuotas', 750, 'USD', 'x@a.test', 'cuotas', 'inicial', 3, 750, 500, true);
    raise exception 'FALLÓ: el precio fundador es solo con pago completo';
  exception when check_violation then null;
  end;
  begin
    insert into public.abonos (organizacion_id, concepto, monto, moneda, email_pagador, al_mep, monto_usd, cotizacion_mep)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'MEP en dólares', 100, 'USD', 'x@a.test', true, 100, 1500);
    raise exception 'FALLÓ: al MEP se cobra en pesos';
  exception when check_violation then null;
  end;
  begin
    insert into public.abonos (organizacion_id, concepto, monto, moneda, pais, email_pagador, al_mep, monto_usd)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'MEP sin cotización', 100, 'ARS', 'AR', 'x@a.test', true, 100);
    raise exception 'FALLÓ: un abono al MEP necesita la cotización';
  exception when check_violation then null;
  end;
end $$;

-- Precio fundador: hasta 5 empresas. Otro abono de una empresa que ya lo tiene no suma.
insert into public.organizaciones (id, nombre, prefijo_crm) values
  ('f0000001-0000-0000-0000-000000000000', 'Fundador 1', 'F1'),
  ('f0000002-0000-0000-0000-000000000000', 'Fundador 2', 'F2'),
  ('f0000003-0000-0000-0000-000000000000', 'Fundador 3', 'F3'),
  ('f0000004-0000-0000-0000-000000000000', 'Fundador 4', 'F4'),
  ('f0000005-0000-0000-0000-000000000000', 'Fundador 5', 'F5'),
  ('f0000006-0000-0000-0000-000000000000', 'Fundador 6', 'F6');
insert into public.abonos (organizacion_id, concepto, monto, moneda, email_pagador, plan_servicio, modalidad, etapa, monto_inicial, monto_posterior, meses_cubiertos, congela_meses, precio_fundador)
select id, 'Plan Eminent de FIRMA, precio fundador', 1500, 'USD', 'x@f.test', 'eminent', 'pago_completo', 'inicial', 1500, 500, 4, 12, true
from public.organizaciones where nombre in ('Fundador 1', 'Fundador 2', 'Fundador 3', 'Fundador 4', 'Fundador 5');
select pruebas.ok(public.abonos_fundador_cupo() = 5, 'hay 5 empresas con precio fundador');
insert into public.abonos (organizacion_id, concepto, monto, moneda, email_pagador, plan_servicio, modalidad, etapa, monto_inicial, monto_posterior, meses_cubiertos, precio_fundador)
values ('f0000001-0000-0000-0000-000000000000', 'Segundo abono fundador', 800, 'USD', 'x@f.test', 'starter', 'pago_completo', 'inicial', 800, 250, 4, true);
select pruebas.ok(true, 'otro abono de una empresa fundadora no ocupa un lugar nuevo');
do $$
begin
  insert into public.abonos (organizacion_id, concepto, monto, moneda, email_pagador, plan_servicio, modalidad, etapa, monto_inicial, monto_posterior, meses_cubiertos, precio_fundador)
  values ('f0000006-0000-0000-0000-000000000000', 'Sexto fundador', 1500, 'USD', 'x@f.test', 'eminent', 'pago_completo', 'inicial', 1500, 500, 4, true);
  raise exception 'FALLÓ: la sexta empresa no tendría que tener precio fundador';
exception when check_violation then null;
end $$;

-- Una empresa que se dio de baja sin pagar libera su lugar.
update public.abonos set estado = 'cancelado', cancelado_en = now() where organizacion_id = 'f0000005-0000-0000-0000-000000000000';
select pruebas.ok(public.abonos_fundador_cupo() = 4, 'una baja sin pagos libera el lugar');
insert into public.abonos (organizacion_id, concepto, monto, moneda, email_pagador, plan_servicio, modalidad, etapa, monto_inicial, monto_posterior, meses_cubiertos, precio_fundador)
values ('f0000006-0000-0000-0000-000000000000', 'Sexto fundador', 1500, 'USD', 'x@f.test', 'eminent', 'pago_completo', 'inicial', 1500, 500, 4, true);
select pruebas.ok(public.abonos_fundador_cupo() = 5, 'el lugar liberado se puede usar');

-- El titular no arma abonos ni cambia el esquema.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
declare
  filas int;
begin
  update public.abonos set monto_posterior = 1 where modalidad = 'cuotas';
  get diagnostics filas = row_count;
  if filas > 0 then raise exception 'FALLÓ: el titular cambió el monto posterior'; end if;
end $$;
select pruebas.como_postgres();

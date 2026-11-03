-- =====================================================================
-- Cola de trabajos: idempotencia, toma sin repetidos, reintentos con
-- espera creciente, reservas vencidas y acceso solo del servidor.
-- =====================================================================

-- El portal no encola, no toma y no lee la cola.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.cola_encolar('prueba', 'aaaaaaaa-0000-0000-0000-000000000000');
  raise exception 'FALLÓ: un titular encoló un trabajo';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.cola_tomar();
  raise exception 'FALLÓ: un titular tomó trabajos';
exception when insufficient_privilege then null;
end $$;
select pruebas.como_postgres();

-- Alta idempotente.
select pruebas.como_servicio();
select pruebas.ok(public.cola_encolar('prueba', 'aaaaaaaa-0000-0000-0000-000000000000', '{"n": 1}', 'prueba:1')
                = public.cola_encolar('prueba', 'aaaaaaaa-0000-0000-0000-000000000000', '{"n": 1}', 'prueba:1'),
  'la misma clave devuelve el mismo trabajo');
select pruebas.ok((select count(*) from public.cola_trabajos) = 1, 'la misma clave no duplica');
select public.cola_encolar('prueba', 'aaaaaaaa-0000-0000-0000-000000000000', '{"n": 2}', 'prueba:2');
select public.cola_encolar('prueba', 'aaaaaaaa-0000-0000-0000-000000000000', '{"n": 3}', 'prueba:3', 3600);

-- Toma: los disponibles, una sola vez.
select pruebas.ok((select count(*) from public.cola_tomar(10, 60)) = 2, 'toma los dos disponibles, no el demorado');
select pruebas.ok((select count(*) from public.cola_tomar(10, 60)) = 0, 'un trabajo tomado no se vuelve a tomar');
select pruebas.ok((select bool_and(intentos = 1 and tomado_hasta > now()) from public.cola_trabajos where estado = 'tomado'), 'la toma suma un intento y reserva');

-- Terminar.
select public.cola_terminar((select id from public.cola_trabajos where clave_idempotencia = 'prueba:1'));
select pruebas.ok((select estado = 'hecho' and terminado_en is not null from public.cola_trabajos where clave_idempotencia = 'prueba:1'), 'terminado queda hecho');

-- Fallar: vuelve a la cola con espera, y al último intento queda fallido.
select public.cola_fallar((select id from public.cola_trabajos where clave_idempotencia = 'prueba:2'), 'Fathom no respondió');
select pruebas.ok((select estado = 'pendiente' and error = 'Fathom no respondió'
                     and disponible_en between now() + interval '50 seconds' and now() + interval '70 seconds'
                   from public.cola_trabajos where clave_idempotencia = 'prueba:2'), 'el primer fallo espera un minuto');
select pruebas.como_postgres();
update public.cola_trabajos set disponible_en = now() - interval '1 second', intentos = 2 where clave_idempotencia = 'prueba:2';
select pruebas.como_servicio();
select pruebas.ok((select intentos from public.cola_tomar(1, 60)) = 3, 'se retoma al vencer la espera');
select public.cola_fallar((select id from public.cola_trabajos where clave_idempotencia = 'prueba:2'), 'otra vez');
select pruebas.ok((select disponible_en between now() + interval '15 minutes' and now() + interval '17 minutes'
                   from public.cola_trabajos where clave_idempotencia = 'prueba:2'), 'el tercer fallo espera 16 minutos');
select pruebas.como_postgres();
update public.cola_trabajos set disponible_en = now() - interval '1 second', intentos = 5 where clave_idempotencia = 'prueba:2';
select pruebas.como_servicio();
select public.cola_tomar(1, 60);
select public.cola_fallar((select id from public.cola_trabajos where clave_idempotencia = 'prueba:2'), 'última');
select pruebas.ok((select estado = 'fallido' from public.cola_trabajos where clave_idempotencia = 'prueba:2'), 'al llegar al máximo queda fallido');

-- Una reserva vencida vuelve a la cola; si ya no le quedan intentos, falla.
select pruebas.como_postgres();
update public.cola_trabajos set estado = 'tomado', disponible_en = now() - interval '1 hour', tomado_hasta = now() - interval '1 second', intentos = 1
where clave_idempotencia = 'prueba:3';
insert into public.cola_trabajos (tipo, estado, intentos, max_intentos, tomado_hasta, clave_idempotencia)
values ('prueba', 'tomado', 3, 3, now() - interval '1 second', 'prueba:4');
select pruebas.como_servicio();
select pruebas.ok((select array_agg(clave_idempotencia) from public.cola_tomar(10, 60)) = array['prueba:3'], 'la reserva vencida se retoma');
select pruebas.ok((select estado = 'fallido' from public.cola_trabajos where clave_idempotencia = 'prueba:4'), 'sin intentos, la reserva vencida falla');

-- Con id toma solo ese trabajo.
select pruebas.como_postgres();
update public.cola_trabajos set estado = 'pendiente', tomado_hasta = null where clave_idempotencia = 'prueba:3';
select pruebas.como_servicio();
select public.cola_encolar('prueba', null, '{}', 'prueba:5');
select pruebas.ok((select array_agg(clave_idempotencia) from public.cola_tomar(10, 60, (select id from public.cola_trabajos where clave_idempotencia = 'prueba:5'))) = array['prueba:5'],
  'con id toma solo ese');

-- FIRMA lee la cola; un titular no ve nada.
select pruebas.como('00000000-0000-0000-0000-0000000000ad', 'aal2');
select pruebas.ok((select count(*) from public.cola_trabajos) = 5, 'FIRMA lee la cola');
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.cola_trabajos) = 0, 'un titular no ve la cola');

-- La clave del barrido se valida contra Vault, solo desde el servidor.
select pruebas.como_postgres();
select vault.create_secret(repeat('k', 64), 'cola_secreto', 'prueba');
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.cola_clave_valida(repeat('k', 64));
  raise exception 'FALLÓ: un titular validó la clave de la cola';
exception when insufficient_privilege then null;
end $$;
select pruebas.como_servicio();
select pruebas.ok(public.cola_clave_valida(repeat('k', 64)), 'la clave de Vault vale');
select pruebas.ok(not public.cola_clave_valida(repeat('k', 63) || 'x'), 'otra clave no');
select pruebas.ok(not public.cola_clave_valida('corta'), 'una clave corta no');
select pruebas.ok(not public.cola_clave_valida(null), 'sin clave no');

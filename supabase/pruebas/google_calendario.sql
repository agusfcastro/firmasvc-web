-- =====================================================================
-- Conexión con Google Calendar (migración 0080).
-- =====================================================================

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
grant execute on function pruebas.falla(text, text) to authenticated, service_role;

insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, usuario_id) values
  ('e0000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000000', 'Closer de A', 'closer', '00000000-0000-0000-0000-0000000000a3'),
  ('e0000000-0000-0000-0000-0000000000a4', 'aaaaaaaa-0000-0000-0000-000000000000', 'Setter de A', 'setter', '00000000-0000-0000-0000-0000000000a4');

-- El servidor guarda la conexión del closer, con el token cifrado.
select pruebas.como_servicio();
select public.google_conexion_guardar('aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a3',
  ' Closer@Gmail.com ', '1//token-de-prueba', 'openid email https://www.googleapis.com/auth/calendar.events.owned');
select pruebas.ok((select public.google_conexion_token(id) = '1//token-de-prueba' from public.google_conexiones), 'el servidor recupera el token');
-- Nadie conecta el calendario de otra persona.
select pruebas.falla($q$select public.google_conexion_guardar('aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a3', 'x@gmail.com', 't', null)$q$,
  'no es la cuenta que conecta');
-- Volver a conectar sin token nuevo conserva el anterior.
select public.google_conexion_guardar('aaaaaaaa-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a3', 'closer@gmail.com', null, 'openid');
select pruebas.ok((select public.google_conexion_token(id) = '1//token-de-prueba' from public.google_conexiones), 'reconectar sin token nuevo conserva el anterior');
select pruebas.como_postgres();

select pruebas.ok((select email = 'closer@gmail.com' and estado = 'activa' from public.google_conexiones), 'el mail queda prolijo y la conexión activa');
select pruebas.ok((select position('token-de-prueba' in encode(refresh_cifrado, 'escape')) = 0 from public.google_conexiones), 'el token no queda en claro');

-- Desde el portal se ve quién está conectado, nunca el token ni las funciones del servidor.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.google_conexiones) = 1, 'el titular ve quién conectó su calendario');
select pruebas.falla($q$select refresh_cifrado from public.google_conexiones$q$, 'permission denied');
select pruebas.falla($q$select public.google_conexion_token(id) from public.google_conexiones$q$, 'permission denied');
select pruebas.como_postgres();

select pruebas.como('00000000-0000-0000-0000-0000000000b1');
select pruebas.ok((select count(*) from public.google_conexiones) = 0, 'otra empresa no ve las conexiones de A');
select pruebas.como_postgres();

-- Al desconectar se borra el token.
select pruebas.como_servicio();
select public.google_conexion_estado(id, 'revocada', null) from public.google_conexiones;
select pruebas.ok((select public.google_conexion_token(id) is null from public.google_conexiones), 'desconectado no queda token');
select pruebas.como_postgres();
select pruebas.ok((select estado = 'revocada' and refresh_cifrado is null from public.google_conexiones), 'la conexión queda revocada y sin token');

-- Una reunión guarda su evento de Google y el link para entrar.
insert into public.crm_reuniones (organizacion_id, cliente_id, tipo, inicio, google_evento_id, enlace_reunion)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-00000000000a', 'seguimiento', now() + interval '1 day', 'abc123', 'https://meet.google.com/abc-defg-hij');
select pruebas.falla($q$update public.crm_reuniones set enlace_reunion = 'meet.google.com/x'$q$, 'check');

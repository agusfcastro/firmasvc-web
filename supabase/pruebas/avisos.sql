-- =====================================================================
-- Centro de avisos (0066): cada persona ve solo sus avisos, lo único que
-- puede cambiar es marcarlos como leídos y los escribe solo el servidor.
-- =====================================================================

select pruebas.como_servicio();
insert into public.avisos (usuario_id, titulo, cuerpo, url) values
  ('00000000-0000-0000-0000-0000000000a1', 'Novedad en un asunto', 'Mirala en el portal.', '/portal/asuntos'),
  ('00000000-0000-0000-0000-0000000000a1', 'Firmaron todos', '', '/portal/firmas'),
  ('00000000-0000-0000-0000-0000000000b1', 'Aviso de B', '', '/portal');

-- La dirección tiene que ser del portal.
do $$
begin
  insert into public.avisos (usuario_id, titulo, url) values ('00000000-0000-0000-0000-0000000000a1', 'Afuera', 'https://otro.test');
  raise exception 'FALLÓ: un aviso quedó apuntando fuera del portal';
exception when check_violation then null;
end $$;

-- El titular de A ve los suyos y no los de B.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
select pruebas.ok((select count(*) from public.avisos) = 2, 'cada persona ve solo sus avisos');
select pruebas.ok((select count(*) from public.avisos where leido_en is null) = 2, 'los avisos nuevos están sin leer');

-- Puede marcarlos como leídos.
update public.avisos set leido_en = now() where leido_en is null;
select pruebas.ok((select count(*) from public.avisos where leido_en is null) = 0, 'se marcan como leídos');

-- No puede cambiar el texto, crear avisos ni borrarlos.
do $$
begin
  update public.avisos set titulo = 'Cambiado';
  raise exception 'FALLÓ: alguien cambió el texto de un aviso';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  insert into public.avisos (usuario_id, titulo) values ('00000000-0000-0000-0000-0000000000a1', 'Propio');
  raise exception 'FALLÓ: alguien se creó un aviso';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  delete from public.avisos;
  raise exception 'FALLÓ: alguien borró avisos';
exception when insufficient_privilege then null;
end $$;

-- El titular de B no toca los de A.
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
update public.avisos set leido_en = null;
select pruebas.ok((select count(*) from public.avisos) = 1, 'B ve solo el suyo');
select pruebas.como_postgres();
select pruebas.ok((select count(*) from public.avisos where usuario_id = '00000000-0000-0000-0000-0000000000a1' and leido_en is not null) = 2, 'B no cambió los avisos de A');

-- Sin sesión no se ve nada.
select pruebas.como_anonimo();
do $$
begin
  perform count(*) from public.avisos;
  raise exception 'FALLÓ: un anónimo leyó avisos';
exception when insufficient_privilege then null;
end $$;

-- La limpieza borra lo de más de 90 días y deja el resto.
select pruebas.como_postgres();
update public.avisos set creado_en = now() - interval '91 days' where titulo = 'Firmaron todos';
select pruebas.como_servicio();
select public.avisos_limpiar();
select pruebas.como_postgres();
select pruebas.ok((select count(*) from public.avisos) = 2, 'la limpieza borra solo lo viejo');

-- Las tablas retiradas ya no están.
select pruebas.ok(to_regclass('public.zapsign_cuentas') is null, 'zapsign_cuentas se eliminó');
select pruebas.ok(to_regclass('public.crm_borradores') is null, 'crm_borradores se eliminó');
select pruebas.ok(not exists (select 1 from public.perfiles where rol = 'miembro'), 'no quedan cuentas con el rol miembro');

-- =====================================================================
-- Un nombre de cliente por empresa (migración 0073).
-- =====================================================================

-- El mismo nombre en la misma empresa no entra, aunque cambien mayúsculas, tildes o espacios.
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
do $$
declare
  casos text[] := array['Cliente de A', 'cliente de a', '  Cliente   de   Á ', 'CLIENTE DE A'];
  i int;
begin
  for i in 1 .. array_length(casos, 1) loop
    begin
      insert into public.crm_clientes (organizacion_id, nombre) values ('aaaaaaaa-0000-0000-0000-000000000000', casos[i]);
      raise exception 'FALLÓ: se cargó un cliente repetido como «%»', casos[i];
    exception when raise_exception then
      if sqlerrm like 'FALLÓ%' then raise; end if;
    end;
  end loop;
end $$;

-- Otro nombre sí entra, y tampoco se le puede cambiar el nombre por uno que ya existe.
insert into public.crm_clientes (id, organizacion_id, nombre) values ('c0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Otro cliente');
do $$ begin
  update public.crm_clientes set nombre = 'Cliente de A' where id = 'c0000000-0000-0000-0000-0000000000a2';
  raise exception 'FALLÓ: se renombró un cliente con un nombre repetido';
exception when raise_exception then
  if sqlerrm like 'FALLÓ%' then raise; end if;
end $$;

-- Cambiar otro dato de la ficha no choca con su propio nombre.
update public.crm_clientes set notas = 'sigue editable' where id = 'c0000000-0000-0000-0000-00000000000a';
update public.crm_clientes set nombre = 'cliente de a' where id = 'c0000000-0000-0000-0000-00000000000a';

-- El alta avisa antes de guardar, con la ficha que ya existe.
select pruebas.ok((select id from public.crm_cliente_con_nombre('aaaaaaaa-0000-0000-0000-000000000000', 'Cliénte  de A')) = 'c0000000-0000-0000-0000-00000000000a',
  'el titular encuentra la ficha con el mismo nombre');
select pruebas.como_postgres();

-- Otra empresa puede tener un cliente con el mismo nombre, y no ve las fichas de A.
select pruebas.como('00000000-0000-0000-0000-0000000000b1');
insert into public.crm_clientes (organizacion_id, nombre) values ('bbbbbbbb-0000-0000-0000-000000000000', 'Cliente de A');
select pruebas.ok(not exists (select 1 from public.crm_cliente_con_nombre('aaaaaaaa-0000-0000-0000-000000000000', 'Cliente de A')),
  'otra empresa no ve los nombres de A');
select pruebas.como_postgres();
select pruebas.ok((select count(*) from public.crm_clientes where public.crm_nombre_normalizado(nombre) = 'cliente de a') = 2,
  'el mismo nombre convive en empresas distintas');

-- =====================================================================
-- Equipo comercial y claves foráneas por negocio.
-- Las comprobaciones de claves corren como postgres, sin RLS: prueban que
-- la base rechaza el cruce aunque nadie lo filtre antes.
-- =====================================================================

insert into public.equipo_miembros (id, organizacion_id, nombre, rol_comercial, email) values
  ('e0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Closer de A', 'closer', ' Closer@A.test '),
  ('e0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Closer de B', 'closer', 'closer@b.test');

select pruebas.ok((select email from public.equipo_miembros where id = 'e0000000-0000-0000-0000-00000000000a') = 'closer@a.test',
  'el mail del equipo se guarda limpio y en minúsculas');

-- Un cliente de A con el closer de A, sí; con el de B, no.
update public.crm_clientes set closer_id = 'e0000000-0000-0000-0000-00000000000a' where id = 'c0000000-0000-0000-0000-00000000000a';

do $$ begin
  update public.crm_clientes set closer_id = 'e0000000-0000-0000-0000-00000000000b' where id = 'c0000000-0000-0000-0000-00000000000a';
  raise exception 'FALLÓ: un cliente de A quedó con un closer de B';
exception when foreign_key_violation then null;
end $$;

-- Un asunto de A no puede apuntar a un cliente de B.
do $$ begin
  insert into public.asuntos (organizacion_id, titulo, tipo, cliente_id)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'Asunto cruzado', 'consulta', 'c0000000-0000-0000-0000-00000000000b');
  raise exception 'FALLÓ: un asunto de A apuntó a un cliente de B';
-- Lo frena antes el trigger de asuntos (0024) o, si no, la clave.
exception when foreign_key_violation then null;
          when raise_exception then
  if sqlerrm like 'FALLÓ:%' then raise; end if;
end $$;

-- Un caso de A no puede colgar de un asunto de B. El trigger de casos
-- (0024) deja fijo el asunto; si no, lo rechaza la clave.
do $$
declare
  asunto_b uuid;
begin
  select id into asunto_b from public.asuntos where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000' limit 1;
  perform pruebas.ok(asunto_b is not null, 'el caso de B creó su asunto');
  begin
    update public.crm_casos set asunto_id = asunto_b where organizacion_id = 'aaaaaaaa-0000-0000-0000-000000000000';
  exception when foreign_key_violation then null;
  end;
  perform pruebas.ok(not exists (
    select 1 from public.crm_casos c join public.asuntos a on a.id = c.asunto_id
    where c.organizacion_id <> a.organizacion_id), 'ningún caso cuelga de un asunto de otro negocio');
end $$;

-- Un pago de abono queda siempre en el negocio de su abono: el trigger
-- (0009) lo corrige y la clave impide cualquier otro valor.
insert into public.abono_pagos (organizacion_id, abono_id, cobro_id, moneda, estado)
select 'aaaaaaaa-0000-0000-0000-000000000000', id, 'cobro-cruzado', 'ARS', 'aprobado'
from public.abonos where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000';
select pruebas.ok((select organizacion_id from public.abono_pagos where cobro_id = 'cobro-cruzado') = 'bbbbbbbb-0000-0000-0000-000000000000',
  'un pago cargado con otro negocio queda en el negocio del abono');

-- Dar de baja al closer deja al cliente sin closer, no lo borra.
delete from public.equipo_miembros where id = 'e0000000-0000-0000-0000-00000000000a';
select pruebas.ok((select closer_id from public.crm_clientes where id = 'c0000000-0000-0000-0000-00000000000a') is null
  and exists (select 1 from public.crm_clientes where id = 'c0000000-0000-0000-0000-00000000000a'),
  'al borrar al closer el cliente queda sin closer');

-- ---------------------------------------------------------------------
-- Permisos del equipo
-- ---------------------------------------------------------------------
select pruebas.como('00000000-0000-0000-0000-0000000000a4');
select pruebas.ok((select count(*) from public.equipo_miembros) = 0, 'el setter de A ve el equipo de A (vacío ahora)');
select pruebas.ok(not exists (select 1 from public.equipo_miembros where organizacion_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  'nadie de A ve el equipo de B');
do $$ begin
  insert into public.equipo_miembros (organizacion_id, nombre, rol_comercial) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Nuevo', 'setter');
  raise exception 'FALLÓ: el setter cargó un integrante';
exception when insufficient_privilege then null;
end $$;

select pruebas.como_postgres();
select pruebas.como('00000000-0000-0000-0000-0000000000a1');
insert into public.equipo_miembros (organizacion_id, nombre, rol_comercial) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Setter nuevo', 'setter');
select pruebas.ok((select count(*) from public.equipo_miembros) = 1, 'el titular carga integrantes en su negocio');
do $$ begin
  insert into public.equipo_miembros (organizacion_id, nombre, rol_comercial) values ('bbbbbbbb-0000-0000-0000-000000000000', 'Intruso', 'closer');
  raise exception 'FALLÓ: el titular de A cargó un integrante en B';
exception when insufficient_privilege then null;
end $$;
do $$
declare
  filas int;
begin
  delete from public.equipo_miembros;
  raise exception 'FALLÓ: el titular borró integrantes';
exception when insufficient_privilege then null;
end $$;

-- Las claves por negocio existen, aunque en varios casos un trigger frene antes.
select pruebas.como_postgres();
select pruebas.ok((select count(*) from pg_constraint where contype = 'f' and conname like '%\_org\_fk' escape '\') = 13,
  'están las 13 claves foráneas por negocio');

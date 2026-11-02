-- =====================================================================
-- FIRMA · Portal · DNI, teléfono y domicilio cifrados
-- Los tres datos de los clientes del CRM se guardan cifrados con una
-- clave de Supabase Vault (pgcrypto, AES). La columna en texto plano
-- queda vacía siempre: sirve solo para escribir.
--   Escritura  quien guarda sigue escribiendo dni, telefono y domicilio.
--              Un trigger los cifra y vacía la columna.
--              En un update, null deja el dato como estaba, '' lo borra
--              y un valor lo reemplaza.
--   Lectura    crm_clientes_resumen los devuelve descifrados a quien
--              puede ver el negocio (y a las funciones del servidor).
--   Búsqueda   dni_indice y telefono_indice son un HMAC con otra clave:
--              sirven para encontrar por igualdad sin descifrar.
--   Historial  crm_historial anota que el dato cambió, sin el valor. Los
--              valores que ya tenía el historial se reemplazan.
-- Las claves no salen de la base y no se pueden leer desde el portal.
-- =====================================================================

-- Claves. Se crean una sola vez; si ya existen, no se tocan.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'crm_datos') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'crm_datos', 'Cifrado de DNI, teléfono y domicilio del CRM');
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'crm_indices') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'crm_indices', 'Índices ciegos de DNI y teléfono del CRM');
  end if;
end $$;

create or replace function public.crm_clave(nombre text)
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = nombre;
$$;

create or replace function public.crm_cifrar(texto text)
returns bytea language sql volatile security definer set search_path = public, extensions as $$
  select case when nullif(trim(texto), '') is null then null
              else pgp_sym_encrypt(trim(texto), public.crm_clave('crm_datos'), 'cipher-algo=aes256') end;
$$;

-- Índice ciego. El DNI sin puntos ni espacios y en mayúsculas; el teléfono, solo dígitos.
create or replace function public.crm_indice(tipo text, texto text)
returns text language sql stable security definer set search_path = public, extensions as $$
  select case when norm = '' then null
              else encode(hmac(tipo || ':' || norm, public.crm_clave('crm_indices'), 'sha256'), 'hex') end
  from (select case tipo when 'telefono' then regexp_replace(coalesce(texto, ''), '\D', '', 'g')
                         else upper(regexp_replace(coalesce(texto, ''), '[^0-9A-Za-z]', '', 'g')) end as norm) n;
$$;

-- Descifra solo para quien puede ver el negocio, para las funciones del
-- servidor (service_role) y para las sesiones sin rol del portal (SQL Editor, migraciones).
create or replace function public.crm_descifrar(org uuid, dato bytea)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if dato is null then return null; end if;
  -- current_setting('role') es el rol de quien consulta (authenticated o
  -- anon desde el portal); dentro de esta función current_user es el dueño.
  if not (public.puede_ver_org(org)
          or coalesce(auth.role(), '') = 'service_role'
          or coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon')) then
    return null;
  end if;
  return pgp_sym_decrypt(dato, public.crm_clave('crm_datos'));
exception when others then
  -- Un dato que no se puede descifrar no rompe la lista entera.
  return null;
end;
$$;

revoke all on function public.crm_clave(text), public.crm_cifrar(text), public.crm_indice(text, text) from public, anon, authenticated;
grant execute on function public.crm_indice(text, text) to service_role;
revoke all on function public.crm_descifrar(uuid, bytea) from public, anon;
grant execute on function public.crm_descifrar(uuid, bytea) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Columnas cifradas y relleno de las filas que ya existen
-- ---------------------------------------------------------------------
alter table public.crm_clientes add column if not exists dni_cifrado bytea;
alter table public.crm_clientes add column if not exists telefono_cifrado bytea;
alter table public.crm_clientes add column if not exists domicilio_cifrado bytea;
alter table public.crm_clientes add column if not exists dni_indice text;
alter table public.crm_clientes add column if not exists telefono_indice text;

create index if not exists crm_clientes_dni_indice_idx on public.crm_clientes (organizacion_id, dni_indice) where dni_indice is not null;
create index if not exists crm_clientes_telefono_indice_idx on public.crm_clientes (organizacion_id, telefono_indice) where telefono_indice is not null;

-- Sin historial ni fecha de actualización: es el mismo dato, guardado de otra forma.
alter table public.crm_clientes disable trigger crm_clientes_hist;
alter table public.crm_clientes disable trigger crm_clientes_antes;
update public.crm_clientes set
  dni_cifrado       = coalesce(public.crm_cifrar(dni), dni_cifrado),
  dni_indice        = coalesce(public.crm_indice('dni', dni), dni_indice),
  telefono_cifrado  = coalesce(public.crm_cifrar(telefono), telefono_cifrado),
  telefono_indice   = coalesce(public.crm_indice('telefono', telefono), telefono_indice),
  domicilio_cifrado = coalesce(public.crm_cifrar(domicilio), domicilio_cifrado),
  dni = null, telefono = null, domicilio = null
where dni is not null or telefono is not null or domicilio is not null;
alter table public.crm_clientes enable trigger crm_clientes_antes;
alter table public.crm_clientes enable trigger crm_clientes_hist;

-- ---------------------------------------------------------------------
-- Cifrado al escribir
-- ---------------------------------------------------------------------
create or replace function public.crm_clientes_cifrado()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Las columnas cifradas solo salen de este trigger: lo que llegue escrito
  -- a mano se descarta.
  if tg_op = 'INSERT' then
    new.dni_cifrado := null; new.dni_indice := null;
    new.telefono_cifrado := null; new.telefono_indice := null;
    new.domicilio_cifrado := null;
  else
    new.dni_cifrado := old.dni_cifrado; new.dni_indice := old.dni_indice;
    new.telefono_cifrado := old.telefono_cifrado; new.telefono_indice := old.telefono_indice;
    new.domicilio_cifrado := old.domicilio_cifrado;
  end if;
  -- DNI
  if new.dni is not null then
    if trim(new.dni) = '' then
      new.dni_cifrado := null; new.dni_indice := null;
    elsif tg_op = 'INSERT' or old.dni_cifrado is null
          or pgp_sym_decrypt(old.dni_cifrado, crm_clave('crm_datos')) is distinct from trim(new.dni) then
      new.dni_cifrado := crm_cifrar(new.dni); new.dni_indice := crm_indice('dni', new.dni);
    end if;
    new.dni := null;
  end if;
  -- Teléfono
  if new.telefono is not null then
    if trim(new.telefono) = '' then
      new.telefono_cifrado := null; new.telefono_indice := null;
    elsif tg_op = 'INSERT' or old.telefono_cifrado is null
          or pgp_sym_decrypt(old.telefono_cifrado, crm_clave('crm_datos')) is distinct from trim(new.telefono) then
      new.telefono_cifrado := crm_cifrar(new.telefono); new.telefono_indice := crm_indice('telefono', new.telefono);
    end if;
    new.telefono := null;
  end if;
  -- Domicilio
  if new.domicilio is not null then
    if trim(new.domicilio) = '' then
      new.domicilio_cifrado := null;
    elsif tg_op = 'INSERT' or old.domicilio_cifrado is null
          or pgp_sym_decrypt(old.domicilio_cifrado, crm_clave('crm_datos')) is distinct from trim(new.domicilio) then
      new.domicilio_cifrado := crm_cifrar(new.domicilio);
    end if;
    new.domicilio := null;
  end if;
  return new;
end;
$$;

revoke all on function public.crm_clientes_cifrado() from public, anon, authenticated;

drop trigger if exists crm_clientes_cifrado on public.crm_clientes;
create trigger crm_clientes_cifrado before insert or update on public.crm_clientes
  for each row execute function public.crm_clientes_cifrado();


-- ---------------------------------------------------------------------
-- Historial sin valores sensibles
-- ---------------------------------------------------------------------
create or replace function public.crm_registrar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fila jsonb;
  previa jsonb;
  dif jsonb := '{}'::jsonb;
  k text;
  cliente uuid;
  org uuid;
begin
  if tg_op = 'DELETE' then
    previa := to_jsonb(old); fila := '{}'::jsonb;
  elsif tg_op = 'INSERT' then
    fila := to_jsonb(new); previa := '{}'::jsonb;
  else
    fila := to_jsonb(new); previa := to_jsonb(old);
  end if;
  for k in select jsonb_object_keys(fila || previa) loop
    if k in ('actualizado_en', 'creado_en') or k like '%\_indice' escape '\' then
      continue;
    end if;
    if (fila -> k) is distinct from (previa -> k) then
      if k like '%\_cifrado' escape '\' then
        -- Se anota con el nombre del dato y sin el valor.
        dif := dif || jsonb_build_object(replace(k, '_cifrado', ''), jsonb_build_object(
          'antes', case when jsonb_typeof(previa -> k) = 'string' then to_jsonb('(dato protegido)'::text) end,
          'despues', case when jsonb_typeof(fila -> k) = 'string' then to_jsonb('(dato protegido)'::text) end));
      else
        dif := dif || jsonb_build_object(k, jsonb_build_object('antes', previa -> k, 'despues', fila -> k));
      end if;
    end if;
  end loop;
  if dif = '{}'::jsonb then return coalesce(new, old); end if;
  org := coalesce((fila ->> 'organizacion_id'), (previa ->> 'organizacion_id'))::uuid;
  cliente := case when tg_table_name = 'crm_clientes' then coalesce((fila ->> 'id'), (previa ->> 'id'))::uuid
                  else coalesce((fila ->> 'cliente_id'), (previa ->> 'cliente_id'))::uuid end;
  insert into crm_historial (organizacion_id, cliente_id, tabla, operacion, usuario_id, cambios)
  values (org, cliente, tg_table_name, lower(tg_op), auth.uid(), dif);
  return coalesce(new, old);
end;
$$;

-- Los valores que ya estaban en el historial se reemplazan.
update public.crm_historial h set cambios = (
  select jsonb_object_agg(k, case when k in ('dni', 'telefono', 'domicilio') then jsonb_build_object(
           'antes', case when jsonb_typeof(v -> 'antes') = 'string' then to_jsonb('(dato protegido)'::text) end,
           'despues', case when jsonb_typeof(v -> 'despues') = 'string' then to_jsonb('(dato protegido)'::text) end)
         else v end)
  from jsonb_each(h.cambios) as e(k, v))
where h.tabla = 'crm_clientes' and h.cambios ?| array['dni', 'telefono', 'domicilio'];

-- ---------------------------------------------------------------------
-- Vista del CRM con los datos descifrados. Se arma con las columnas que
-- tenga crm_clientes hoy, menos las cifradas, más los tres descifrados.
-- ---------------------------------------------------------------------
drop view if exists public.crm_clientes_resumen;

do $$
declare
  columnas text;
begin
  select string_agg('c.' || quote_ident(column_name), ', ' order by ordinal_position) into columnas
  from information_schema.columns
  where table_schema = 'public' and table_name = 'crm_clientes'
    and column_name not in ('dni', 'telefono', 'domicilio', 'dni_cifrado', 'telefono_cifrado', 'domicilio_cifrado', 'dni_indice', 'telefono_indice');
  execute format($v$
    create view public.crm_clientes_resumen with (security_invoker = true) as
    select
      %s,
      public.crm_descifrar(c.organizacion_id, c.dni_cifrado)       as dni,
      public.crm_descifrar(c.organizacion_id, c.telefono_cifrado)  as telefono,
      public.crm_descifrar(c.organizacion_id, c.domicilio_cifrado) as domicilio,
      coalesce(sum(p.monto) filter (where p.estado = 'pagado'), 0)                                   as cobrado,
      coalesce(sum(p.monto) filter (where p.estado = 'pendiente'), 0)                                as pendiente,
      min(p.vencimiento) filter (where p.estado = 'pendiente')                                       as proximo_vencimiento,
      count(*) filter (where p.estado = 'pendiente' and p.vencimiento < current_date)               as cuotas_vencidas,
      count(*) filter (where p.estado = 'pendiente')                                                 as cuotas_pactadas,
      (select p2.monto from public.crm_pagos p2
        where p2.cliente_id = c.id and p2.estado = 'pendiente'
        order by p2.vencimiento nulls last, p2.creado_en
        limit 1)                                                                                     as proxima_cuota_monto,
      coalesce(sum(p.monto) filter (where p.estado = 'pendiente'
        and p.vencimiento >= current_date and p.vencimiento < current_date + 30), 0)                as por_cobrar_30_dias
    from public.crm_clientes c
    left join public.crm_pagos p on p.cliente_id = c.id
    group by c.id
  $v$, columnas);
end $$;

revoke all on public.crm_clientes_resumen from anon;
grant select on public.crm_clientes_resumen to authenticated;

notify pgrst, 'reload schema';

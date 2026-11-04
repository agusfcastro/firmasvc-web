-- =====================================================================
-- FIRMA · Portal · Invoices y recibos de dinero
-- Cada negocio emite invoices y recibos a sus clientes del CRM. El mismo
-- generador está abierto al público en /herramientas, sin guardar nada.
--   comprobantes_emisor      datos del negocio que van en el encabezado
--   comprobantes_numeracion  último número de cada tipo, por negocio
--   comprobantes             lo emitido, con una copia de todo lo que se
--                            imprimió (datos) para volver a armar el PDF
-- La numeración es correlativa por negocio y por tipo, sin huecos: el
-- número lo pone la base al emitir y lo que mande el portal se ignora.
-- Lo emitido no se edita ni se borra. Se anula, con motivo, y el número
-- queda usado.
-- =====================================================================

create table if not exists public.comprobantes_emisor (
  organizacion_id  uuid primary key references public.organizaciones (id) on delete cascade,
  nombre           text not null default '' check (length(nombre) <= 200),
  id_fiscal        text not null default '' check (length(id_fiscal) <= 80),
  domicilio        text not null default '' check (length(domicilio) <= 300),
  email            text not null default '' check (length(email) <= 200),
  telefono         text not null default '' check (length(telefono) <= 80),
  -- Datos de pago, condiciones o leyendas que van al pie de cada comprobante.
  pie              text not null default '' check (length(pie) <= 1000),
  actualizado_en   timestamptz not null default now()
);

create table if not exists public.comprobantes_numeracion (
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  tipo             text not null check (tipo in ('invoice', 'recibo')),
  ultimo           int not null default 0 check (ultimo >= 0),
  primary key (organizacion_id, tipo)
);

create table if not exists public.comprobantes (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references public.organizaciones (id) on delete cascade,
  tipo              text not null check (tipo in ('invoice', 'recibo')),
  numero            int not null,
  cliente_id        uuid references public.crm_clientes (id) on delete set null,
  fecha             date not null,
  moneda            text not null check (moneda ~ '^[A-Z]{3}$'),
  total             numeric(14,2) not null check (total >= 0),
  -- Nombre de quien recibe, para listar y buscar sin abrir datos.
  receptor          text not null check (length(trim(receptor)) between 1 and 200),
  datos             jsonb not null check (jsonb_typeof(datos) = 'object' and length(datos::text) <= 50000),
  anulado_en        timestamptz,
  anulado_por       uuid references auth.users (id) on delete set null,
  motivo_anulacion  text check (motivo_anulacion is null or length(trim(motivo_anulacion)) between 3 and 500),
  creado_por        uuid references auth.users (id) on delete set null,
  creado_en         timestamptz not null default now(),
  unique (organizacion_id, tipo, numero)
);

create index if not exists comprobantes_org_idx on public.comprobantes (organizacion_id, tipo, numero desc);
create index if not exists comprobantes_cliente_idx on public.comprobantes (cliente_id) where cliente_id is not null;

-- ---------------------------------------------------------------------
-- Alta: número correlativo y cliente del mismo negocio
-- ---------------------------------------------------------------------
create or replace function public.comprobantes_alta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cliente_id is not null
     and not exists (select 1 from crm_clientes c where c.id = new.cliente_id and c.organizacion_id = new.organizacion_id) then
    raise exception 'El cliente no es de este negocio.';
  end if;
  -- El upsert bloquea la fila del contador: dos altas a la vez no comparten número.
  insert into comprobantes_numeracion as n (organizacion_id, tipo, ultimo)
  values (new.organizacion_id, new.tipo, 1)
  on conflict (organizacion_id, tipo) do update set ultimo = n.ultimo + 1
  returning ultimo into new.numero;
  new.creado_por := auth.uid();
  new.creado_en := now();
  new.anulado_en := null;
  new.anulado_por := null;
  new.motivo_anulacion := null;
  return new;
end;
$$;

drop trigger if exists comprobantes_alta on public.comprobantes;
create trigger comprobantes_alta before insert on public.comprobantes
  for each row execute function public.comprobantes_alta();

-- Lo único que cambia es la anulación, una sola vez. cliente_id puede pasar
-- a null cuando se borra el cliente: los datos impresos quedan en datos.
create or replace function public.comprobantes_edicion()
returns trigger language plpgsql as $$
begin
  if (new.id, new.organizacion_id, new.tipo, new.numero, new.fecha, new.moneda, new.total, new.receptor, new.datos, new.creado_por, new.creado_en)
     is distinct from
     (old.id, old.organizacion_id, old.tipo, old.numero, old.fecha, old.moneda, old.total, old.receptor, old.datos, old.creado_por, old.creado_en)
     or (new.cliente_id is distinct from old.cliente_id and new.cliente_id is not null) then
    raise exception 'Un comprobante emitido no se modifica. Anulalo y emití otro.';
  end if;
  if old.anulado_en is not null then
    if (new.anulado_en, new.anulado_por, new.motivo_anulacion) is distinct from (old.anulado_en, old.anulado_por, old.motivo_anulacion) then
      raise exception 'El comprobante ya está anulado.';
    end if;
  elsif new.anulado_en is not null or new.motivo_anulacion is not null then
    if new.motivo_anulacion is null or length(trim(new.motivo_anulacion)) < 3 then
      raise exception 'Para anular hace falta el motivo.';
    end if;
    new.anulado_en := now();
    new.anulado_por := auth.uid();
  else
    new.anulado_por := null;
  end if;
  return new;
end;
$$;

drop trigger if exists comprobantes_edicion on public.comprobantes;
create trigger comprobantes_edicion before update on public.comprobantes
  for each row execute function public.comprobantes_edicion();

create or replace function public.comprobantes_emisor_antes()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists comprobantes_emisor_antes on public.comprobantes_emisor;
create trigger comprobantes_emisor_antes before insert or update on public.comprobantes_emisor
  for each row execute function public.comprobantes_emisor_antes();

revoke all on function public.comprobantes_alta() from public, anon, authenticated;

-- El negocio que ya venía numerando en otro lado arranca desde su número.
-- Solo hacia adelante, así nunca se repite uno.
create or replace function public.comprobantes_fijar_proximo(org uuid, p_tipo text, proximo int)
returns int language plpgsql security definer set search_path = public as $$
declare
  actual int;
begin
  if not public.puede_gestionar_org(org) then
    raise exception 'Solo el titular o FIRMA cambian la numeración.' using errcode = '42501';
  end if;
  if p_tipo not in ('invoice', 'recibo') then
    raise exception 'Tipo de comprobante desconocido.';
  end if;
  select ultimo into actual from comprobantes_numeracion where organizacion_id = org and tipo = p_tipo for update;
  if proximo is null or proximo < 1 or proximo > 99999999 or proximo <= coalesce(actual, 0) then
    raise exception 'El próximo número tiene que ser mayor que %.', coalesce(actual, 0);
  end if;
  insert into comprobantes_numeracion (organizacion_id, tipo, ultimo) values (org, p_tipo, proximo - 1)
  on conflict (organizacion_id, tipo) do update set ultimo = excluded.ultimo;
  return proximo;
end;
$$;

revoke all on function public.comprobantes_fijar_proximo(uuid, text, int) from public, anon;
grant execute on function public.comprobantes_fijar_proximo(uuid, text, int) to authenticated;

-- ---------------------------------------------------------------------
-- Seguridad. Emite quien usa el CRM (titular, CSM y closer). Anulan, y
-- cargan los datos del emisor, el titular y FIRMA.
-- ---------------------------------------------------------------------
alter table public.comprobantes_emisor enable row level security;
alter table public.comprobantes_numeracion enable row level security;
alter table public.comprobantes enable row level security;

drop policy if exists comp_emisor_lectura on public.comprobantes_emisor;
create policy comp_emisor_lectura on public.comprobantes_emisor for select to authenticated
  using (public.puede_ver_org(organizacion_id));
drop policy if exists comp_emisor_alta on public.comprobantes_emisor;
create policy comp_emisor_alta on public.comprobantes_emisor for insert to authenticated
  with check (public.puede_gestionar_org(organizacion_id));
drop policy if exists comp_emisor_edicion on public.comprobantes_emisor;
create policy comp_emisor_edicion on public.comprobantes_emisor for update to authenticated
  using (public.puede_gestionar_org(organizacion_id)) with check (public.puede_gestionar_org(organizacion_id));

drop policy if exists comp_numeracion_lectura on public.comprobantes_numeracion;
create policy comp_numeracion_lectura on public.comprobantes_numeracion for select to authenticated
  using (public.puede_ver_org(organizacion_id));

drop policy if exists comp_lectura on public.comprobantes;
create policy comp_lectura on public.comprobantes for select to authenticated
  using (public.puede_ver_org(organizacion_id));
drop policy if exists comp_alta on public.comprobantes;
create policy comp_alta on public.comprobantes for insert to authenticated
  with check (public.puede_ver_org(organizacion_id));
drop policy if exists comp_anulacion on public.comprobantes;
create policy comp_anulacion on public.comprobantes for update to authenticated
  using (public.puede_gestionar_org(organizacion_id)) with check (public.puede_gestionar_org(organizacion_id));

revoke all on public.comprobantes_emisor, public.comprobantes_numeracion, public.comprobantes from anon;
revoke insert, update, delete on public.comprobantes_numeracion from authenticated;
revoke delete on public.comprobantes_emisor, public.comprobantes from authenticated;
grant select, insert, update on public.comprobantes_emisor to authenticated;
grant select on public.comprobantes_numeracion to authenticated;
grant select, insert, update on public.comprobantes to authenticated;

notify pgrst, 'reload schema';

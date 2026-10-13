-- =====================================================================
-- FIRMA · Portal de clientes · Módulo 2 (CRM legal de cada cliente)
-- Registra los clientes finales de cada organización (por ejemplo los
-- compradores de Testo Boost), sus contratos y su plan de pagos.
-- =====================================================================

-- Prefijo para los códigos (TB-001, TB-002...)
alter table public.organizaciones add column if not exists prefijo_crm text;

create or replace function public.puede_ver_org(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or org = public.mi_organizacion();
$$;

create or replace function public.puede_gestionar_org(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or (public.soy_titular() and org = public.mi_organizacion());
$$;

-- ---------------------------------------------------------------------
-- Servicios que vende cada cliente (3M, 6M...)
-- ---------------------------------------------------------------------
create table if not exists public.crm_servicios (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  clave            text not null,
  nombre           text,
  precio           numeric(12,2),
  activo           boolean not null default true,
  unique (organizacion_id, clave)
);

-- ---------------------------------------------------------------------
-- Clientes finales
-- ---------------------------------------------------------------------
create table if not exists public.crm_clientes (
  id                      uuid primary key default gen_random_uuid(),
  organizacion_id         uuid not null references public.organizaciones (id) on delete restrict,
  codigo                  text,
  nombre                  text not null check (length(trim(nombre)) > 0),
  dni                     text,
  email                   text,
  telefono                text,
  servicio                text,
  monto_total             numeric(12,2),
  moneda                  text not null default 'USD',
  modalidad               text not null default 'Cuotas' check (modalidad in ('PIF', 'Cuotas')),
  fecha_onboarding        timestamptz,
  estado_firma            text not null default 'Pendiente' check (estado_firma in ('Pendiente', 'Firmado', 'Baja')),
  link_contrato_servicio  text,
  responsable             text,
  notas                   text,
  plan_pagos_original     text,
  revisar_pagos           boolean not null default false,
  creado_por              uuid references auth.users (id) on delete set null,
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now(),
  unique (organizacion_id, codigo)
);

create index if not exists crm_clientes_org_idx on public.crm_clientes (organizacion_id);

-- Datos reservados (link del contrato firmado por el cliente y documento generado).
-- Solo los ve FIRMA y el titular de la organización.
create table if not exists public.crm_contratos (
  cliente_id              uuid primary key references public.crm_clientes (id) on delete cascade,
  organizacion_id         uuid not null references public.organizaciones (id) on delete cascade,
  link_contrato_cliente   text,
  link_documento          text,
  actualizado_en          timestamptz not null default now()
);

-- Cuotas y pagos
create table if not exists public.crm_pagos (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid not null references public.crm_clientes (id) on delete cascade,
  organizacion_id    uuid not null references public.organizaciones (id) on delete cascade,
  monto              numeric(12,2) not null check (monto > 0),
  vencimiento        date,
  estado             text not null default 'pendiente' check (estado in ('pendiente', 'pagado')),
  fecha_pago         date,
  nota               text,
  creado_en          timestamptz not null default now()
);

create index if not exists crm_pagos_cliente_idx on public.crm_pagos (cliente_id);
create index if not exists crm_pagos_venc_idx on public.crm_pagos (organizacion_id, estado, vencimiento);

-- Historial de cambios
create table if not exists public.crm_historial (
  id               bigint generated always as identity primary key,
  organizacion_id  uuid not null,
  cliente_id       uuid,
  tabla            text not null,
  operacion        text not null,
  usuario_id       uuid,
  cambios          jsonb not null default '{}'::jsonb,
  creado_en        timestamptz not null default now()
);

create index if not exists crm_historial_cliente_idx on public.crm_historial (cliente_id, creado_en desc);

-- ---------------------------------------------------------------------
-- Reglas de negocio
-- ---------------------------------------------------------------------

-- Código automático y control de campos que solo maneja FIRMA.
create or replace function public.crm_clientes_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prefijo text;
  siguiente int;
begin
  if tg_op = 'INSERT' then
    if new.codigo is null or trim(new.codigo) = '' then
      select coalesce(nullif(trim(prefijo_crm), ''), 'CL') into prefijo from organizaciones where id = new.organizacion_id;
      select coalesce(max(nullif(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0) + 1 into siguiente
        from crm_clientes where organizacion_id = new.organizacion_id;
      new.codigo := prefijo || '-' || lpad(siguiente::text, 3, '0');
    end if;
    if auth.uid() is not null then
      new.creado_por := auth.uid();
      if not es_admin() then
        new.estado_firma := 'Pendiente';
        new.link_contrato_servicio := null;
        new.revisar_pagos := false;
      end if;
    end if;
  else
    if auth.uid() is not null and not es_admin() then
      if new.estado_firma is distinct from old.estado_firma
         or new.link_contrato_servicio is distinct from old.link_contrato_servicio
         or new.organizacion_id is distinct from old.organizacion_id
         or new.codigo is distinct from old.codigo then
        raise exception 'El estado de la firma y los contratos solo los modifica FIRMA.';
      end if;
    end if;
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;

drop trigger if exists crm_clientes_antes on public.crm_clientes;
create trigger crm_clientes_antes before insert or update on public.crm_clientes
  for each row execute function public.crm_clientes_antes();

-- La organización de pagos y contratos siempre es la del cliente.
create or replace function public.crm_hereda_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select organizacion_id into new.organizacion_id from crm_clientes where id = new.cliente_id;
  if new.organizacion_id is null then raise exception 'Cliente inexistente.'; end if;
  return new;
end;
$$;

drop trigger if exists crm_pagos_org on public.crm_pagos;
create trigger crm_pagos_org before insert or update on public.crm_pagos
  for each row execute function public.crm_hereda_org();

drop trigger if exists crm_contratos_org on public.crm_contratos;
create trigger crm_contratos_org before insert or update on public.crm_contratos
  for each row execute function public.crm_hereda_org();

-- Historial automático
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
    if k not in ('actualizado_en', 'creado_en') and (fila -> k) is distinct from (previa -> k) then
      dif := dif || jsonb_build_object(k, jsonb_build_object('antes', previa -> k, 'despues', fila -> k));
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

drop trigger if exists crm_clientes_hist on public.crm_clientes;
create trigger crm_clientes_hist after insert or update or delete on public.crm_clientes
  for each row execute function public.crm_registrar();
drop trigger if exists crm_pagos_hist on public.crm_pagos;
create trigger crm_pagos_hist after insert or update or delete on public.crm_pagos
  for each row execute function public.crm_registrar();
drop trigger if exists crm_contratos_hist on public.crm_contratos;
create trigger crm_contratos_hist after insert or update or delete on public.crm_contratos
  for each row execute function public.crm_registrar();

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------
alter table public.crm_servicios  enable row level security;
alter table public.crm_clientes   enable row level security;
alter table public.crm_contratos  enable row level security;
alter table public.crm_pagos      enable row level security;
alter table public.crm_historial  enable row level security;

-- Servicios: lo ve la organización, lo edita FIRMA o el titular.
drop policy if exists srv_lectura on public.crm_servicios;
create policy srv_lectura on public.crm_servicios for select to authenticated using (public.puede_ver_org(organizacion_id));
drop policy if exists srv_gestion on public.crm_servicios;
create policy srv_gestion on public.crm_servicios for all to authenticated
  using (public.puede_gestionar_org(organizacion_id)) with check (public.puede_gestionar_org(organizacion_id));

-- Clientes: la organización ve, carga y edita. Solo FIRMA borra.
drop policy if exists cli_lectura on public.crm_clientes;
create policy cli_lectura on public.crm_clientes for select to authenticated using (public.puede_ver_org(organizacion_id));
drop policy if exists cli_alta on public.crm_clientes;
create policy cli_alta on public.crm_clientes for insert to authenticated with check (public.puede_ver_org(organizacion_id));
drop policy if exists cli_edicion on public.crm_clientes;
create policy cli_edicion on public.crm_clientes for update to authenticated
  using (public.puede_ver_org(organizacion_id)) with check (public.puede_ver_org(organizacion_id));
drop policy if exists cli_baja on public.crm_clientes;
create policy cli_baja on public.crm_clientes for delete to authenticated using (public.es_admin());

-- Contratos reservados: ver FIRMA y titular, editar solo FIRMA.
drop policy if exists con_lectura on public.crm_contratos;
create policy con_lectura on public.crm_contratos for select to authenticated using (public.puede_gestionar_org(organizacion_id));
drop policy if exists con_gestion on public.crm_contratos;
create policy con_gestion on public.crm_contratos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Pagos: la organización ve, carga y edita. Borran FIRMA o el titular.
drop policy if exists pag_lectura on public.crm_pagos;
create policy pag_lectura on public.crm_pagos for select to authenticated using (public.puede_ver_org(organizacion_id));
drop policy if exists pag_alta on public.crm_pagos;
create policy pag_alta on public.crm_pagos for insert to authenticated with check (public.puede_ver_org(organizacion_id));
drop policy if exists pag_edicion on public.crm_pagos;
create policy pag_edicion on public.crm_pagos for update to authenticated
  using (public.puede_ver_org(organizacion_id)) with check (public.puede_ver_org(organizacion_id));
drop policy if exists pag_baja on public.crm_pagos;
create policy pag_baja on public.crm_pagos for delete to authenticated using (public.puede_gestionar_org(organizacion_id));

-- Historial: solo lectura, para FIRMA y el titular.
drop policy if exists his_lectura on public.crm_historial;
create policy his_lectura on public.crm_historial for select to authenticated using (public.puede_gestionar_org(organizacion_id));

revoke all on public.crm_servicios, public.crm_clientes, public.crm_contratos, public.crm_pagos, public.crm_historial from anon;
revoke insert, update, delete on public.crm_historial from authenticated;
grant select on public.crm_historial to authenticated;
grant select, insert, update, delete on public.crm_servicios, public.crm_clientes, public.crm_contratos, public.crm_pagos to authenticated;

-- Vista con totales por cliente (respeta los permisos de quien consulta).
create or replace view public.crm_clientes_resumen with (security_invoker = true) as
select
  c.*,
  coalesce(sum(p.monto) filter (where p.estado = 'pagado'), 0)                                   as cobrado,
  coalesce(sum(p.monto) filter (where p.estado = 'pendiente'), 0)                                as pendiente,
  min(p.vencimiento) filter (where p.estado = 'pendiente')                                       as proximo_vencimiento,
  count(*) filter (where p.estado = 'pendiente' and p.vencimiento < current_date)               as cuotas_vencidas
from public.crm_clientes c
left join public.crm_pagos p on p.cliente_id = c.id
group by c.id;

revoke all on public.crm_clientes_resumen from anon;
grant select on public.crm_clientes_resumen to authenticated;

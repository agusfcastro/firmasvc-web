-- =====================================================================
-- FIRMA · Portal · Abonos mensuales con tarjeta (dLocal Go)
-- Cada abono es un débito mensual de una empresa cliente, cobrado con una
-- suscripción de dLocal Go. Cada abono tiene su propio plan en dLocal Go,
-- que se crea la primera vez que el titular lo activa.
-- El cliente paga siempre en la moneda de su país. Si el abono es en
-- dólares, dLocal Go lo convierte al momento de cada pago.
-- La tarjeta se carga siempre en la página segura de dLocal Go. Este
-- portal nunca recibe ni guarda datos de tarjeta.
-- FIRMA arma el abono como borrador. El titular de la empresa lo ve,
-- acepta el débito y paga. Desde ahí el estado, el plan, la suscripción,
-- el próximo cobro y los pagos los escriben solo las funciones del
-- servidor (service role), que los toman siempre de la API de dLocal Go.
-- Se ejecuta una sola vez en Supabase › SQL Editor. Se puede correr más
-- de una vez sin romper nada.
-- =====================================================================

-- Si en esta base quedó el borrador anterior de esta migración (Mercado
-- Pago y Stripe) y está vacío, se rehace. Si tiene datos se frena, para
-- no perder nada.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'abonos' and column_name = 'proveedor_id'
  ) then
    if exists (select 1 from public.abonos) then
      raise exception 'La tabla abonos tiene datos del borrador anterior con Mercado Pago y Stripe. Revisalos antes de correr esta migración.';
    end if;
    drop table if exists public.abono_pagos;
    drop table public.abonos;
  end if;
end $$;

drop function if exists public.abono_pagos_hereda_org() cascade;

-- ---------------------------------------------------------------------
-- Abonos
-- ---------------------------------------------------------------------
create table if not exists public.abonos (
  id                 uuid primary key default gen_random_uuid(),
  organizacion_id    uuid not null references public.organizaciones (id) on delete restrict,
  concepto           text not null check (length(trim(concepto)) between 3 and 120),
  monto              numeric(12,2) not null check (monto > 0),
  moneda             text not null check (moneda in ('ARS', 'USD')),
  -- País del pagador y del plan en dLocal Go. Define la moneda en la que paga.
  -- Son los países que dLocal Go habilita por defecto.
  pais               text not null default 'AR'
                       check (pais in ('AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'EC', 'GT', 'ID', 'MX', 'MY', 'PE', 'PY', 'UY')),
  estado             text not null default 'borrador'
                       check (estado in ('borrador', 'pendiente', 'activo', 'pausado', 'cancelado', 'con_error')),
  email_pagador      text not null check (email_pagador ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- Plan del abono en dLocal Go (uno por abono) y su token, con el que se
  -- arma el enlace de suscripción.
  plan_id            text,
  plan_token         text,
  -- Suscripción vigente del plan. Vacía si no hay ninguna.
  suscripcion_id     text,
  proximo_cobro      timestamptz,
  -- Constancia de la aceptación del débito mensual.
  aceptado_en        timestamptz,
  aceptado_por       uuid references auth.users (id) on delete set null,
  cancelado_en       timestamptz,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  -- En pesos argentinos solo paga alguien de Argentina.
  constraint abonos_ars_argentina check (moneda <> 'ARS' or pais = 'AR'),
  -- El plan y su token van juntos, y un borrador todavía no tiene plan.
  constraint abonos_plan check ((plan_id is null) = (plan_token is null)),
  constraint abonos_borrador_sin_plan check (estado <> 'borrador' or plan_id is null),
  -- Quien aceptó siempre tiene fecha. La persona puede borrarse y la fecha queda.
  constraint abonos_aceptacion check (aceptado_por is null or aceptado_en is not null),
  -- La fecha de baja va solo con el abono dado de baja.
  constraint abonos_baja check ((estado = 'cancelado') = (cancelado_en is not null))
);

create index if not exists abonos_organizacion_idx on public.abonos (organizacion_id, creado_en desc);
create unique index if not exists abonos_plan_idx on public.abonos (plan_id) where plan_id is not null;

-- ---------------------------------------------------------------------
-- Pagos de cada abono, uno por cobro de dLocal Go
-- ---------------------------------------------------------------------
create table if not exists public.abono_pagos (
  id                 uuid primary key default gen_random_uuid(),
  abono_id           uuid not null references public.abonos (id) on delete cascade,
  organizacion_id    uuid not null references public.organizaciones (id) on delete cascade,
  -- Id del cobro (execution) en dLocal Go. Un cobro se guarda una sola vez.
  -- Supuesto a verificar en sandbox, que el id sea único en toda la cuenta.
  cobro_id           text not null unique,
  -- Lo que pagó el cliente, en la moneda de su país, y lo que recibe FIRMA.
  monto_pagado       numeric(14,2) check (monto_pagado >= 0),
  monto_recibido     numeric(14,2) check (monto_recibido >= 0),
  -- Moneda del abono y moneda en la que pagó el cliente.
  moneda             text not null check (moneda ~ '^[A-Z]{3}$'),
  moneda_cobro       text check (moneda_cobro ~ '^[A-Z]{3}$'),
  estado             text not null check (estado in ('aprobado', 'rechazado', 'reintegrado', 'pendiente')),
  fecha              timestamptz not null default now(),
  detalle            jsonb not null default '{}'::jsonb
);

create index if not exists abono_pagos_abono_idx on public.abono_pagos (abono_id, fecha desc);
create index if not exists abono_pagos_organizacion_idx on public.abono_pagos (organizacion_id, fecha desc);

-- ---------------------------------------------------------------------
-- Reglas de negocio
-- ---------------------------------------------------------------------

-- Textos prolijos y fecha de actualización automática.
create or replace function public.abonos_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  new.concepto := trim(new.concepto);
  new.email_pagador := lower(trim(new.email_pagador));
  new.pais := upper(trim(new.pais));
  if tg_op = 'UPDATE' then
    new.creado_en := old.creado_en;
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;

drop trigger if exists abonos_antes on public.abonos;
create trigger abonos_antes before insert or update on public.abonos
  for each row execute function public.abonos_antes();

-- El alta queda en el registro de actividad que lee el panel.
create or replace function public.abonos_registrar_alta()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  empresa text;
begin
  select nombre into empresa from organizaciones where id = new.organizacion_id;
  insert into registro_accesos (usuario_id, actor_id, accion, detalle)
  values (null, auth.uid(), 'abono_alta', jsonb_build_object(
    'abono_id', new.id,
    'organizacion_id', new.organizacion_id,
    'empresa', empresa,
    'titulo', coalesce(empresa, 'Empresa') || ' · ' || new.concepto || ' · ' || new.moneda || ' ' || regexp_replace(new.monto::text, '\.00$', ''),
    'concepto', new.concepto,
    'monto', new.monto,
    'moneda', new.moneda,
    'pais', new.pais,
    'procesador', 'dlocalgo'
  ));
  return new;
end;
$$;

drop trigger if exists abonos_alta on public.abonos;
create trigger abonos_alta after insert on public.abonos
  for each row execute function public.abonos_registrar_alta();

-- La organización del pago es siempre la del abono. Un pago aprobado nunca
-- vuelve atrás (solo puede pasar a reintegrado) y uno reintegrado queda así.
create or replace function public.abono_pagos_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select organizacion_id into new.organizacion_id from abonos where id = new.abono_id;
  if new.organizacion_id is null then raise exception 'Abono inexistente.'; end if;
  if tg_op = 'UPDATE' and new.estado <> old.estado
     and (old.estado = 'reintegrado' or (old.estado = 'aprobado' and new.estado <> 'reintegrado')) then
    raise exception 'Un pago % no puede pasar a %.', old.estado, new.estado;
  end if;
  return new;
end;
$$;

drop trigger if exists abono_pagos_org on public.abono_pagos;
drop trigger if exists abono_pagos_antes on public.abono_pagos;
create trigger abono_pagos_antes before insert or update on public.abono_pagos
  for each row execute function public.abono_pagos_antes();

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila
-- FIRMA ve todo y arma los borradores. El titular ve los abonos y pagos
-- de su empresa. Los miembros del equipo no ven nada de pagos.
-- Estado, plan, suscripción, aceptación y pagos los escribe solo el
-- servidor con la clave service role, que no pasa por estas reglas.
-- ---------------------------------------------------------------------
alter table public.abonos      enable row level security;
alter table public.abono_pagos enable row level security;

drop policy if exists abonos_lectura on public.abonos;
create policy abonos_lectura on public.abonos for select to authenticated
  using (public.puede_gestionar_org(organizacion_id));

drop policy if exists abonos_alta on public.abonos;
create policy abonos_alta on public.abonos for insert to authenticated
  with check (public.es_admin() and estado = 'borrador');

-- Las condiciones se editan solo mientras el abono es borrador.
drop policy if exists abonos_edicion on public.abonos;
create policy abonos_edicion on public.abonos for update to authenticated
  using (public.es_admin() and estado = 'borrador')
  with check (public.es_admin() and estado = 'borrador');

drop policy if exists abonos_borrado on public.abonos;
create policy abonos_borrado on public.abonos for delete to authenticated
  using (public.es_admin() and estado = 'borrador');

drop policy if exists abono_pagos_lectura on public.abono_pagos;
create policy abono_pagos_lectura on public.abono_pagos for select to authenticated
  using (public.puede_gestionar_org(organizacion_id));

-- Permisos por columna. Desde la web solo se escriben las condiciones.
revoke all on public.abonos, public.abono_pagos from anon, authenticated;
grant select on public.abonos, public.abono_pagos to authenticated;
grant insert (organizacion_id, concepto, monto, moneda, pais, email_pagador) on public.abonos to authenticated;
grant update (organizacion_id, concepto, monto, moneda, pais, email_pagador) on public.abonos to authenticated;
grant delete on public.abonos to authenticated;
grant select, insert, update, delete on public.abonos, public.abono_pagos to service_role;

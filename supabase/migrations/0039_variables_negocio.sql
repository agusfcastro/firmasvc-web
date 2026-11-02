-- =====================================================================
-- FIRMA · Portal · Variables propias de cada negocio
-- Además de las variables fijas de los contratos (api/_lib/variables.ts),
-- cada negocio define las suyas. Se usan en los modelos como cualquier
-- otra, {{DIAS_GARANTIA}}.
--   negocio   un valor para todo el negocio (org_variables_valor)
--   cliente   un valor por cliente del CRM (crm_clientes.datos_extra)
--   contrato  un valor por contrato (llega con la tabla de contratos)
-- Los valores se validan contra la definición: clave conocida y tipo
-- correcto. Que una obligatoria tenga valor se controla al generar el
-- contrato, no al guardar, porque los datos se completan de a poco.
-- Las definiciones no se borran desde el portal: se desactivan.
-- =====================================================================

-- Variables fijas. Si se suma una en api/_lib/variables.ts, va acá también.
create or replace function public.variable_de_sistema(clave text)
returns boolean language sql immutable as $$
  select clave = any (array[
    'CLIENTE', 'NOMBRE', 'DNI', 'DOMICILIO', 'RAZON_SOCIAL_CLIENTE', 'ID_FISCAL_CLIENTE', 'CARGO', 'EMAIL',
    'TELEFONO', 'CODIGO', 'SERVICIO', 'MODALIDAD', 'EMPRESA', 'RESPONSABLE', 'MONEDA', 'MONEDA_LETRAS',
    'MONTO_TOTAL', 'MONTO_TOTAL_LETRAS', 'ANTICIPO', 'ANTICIPO_LETRAS', 'SALDO', 'SALDO_LETRAS',
    'CANTIDAD_CUOTAS', 'DETALLE_CUOTAS', 'ESQUEMA_PAGOS', 'CONDICIONES', 'FECHA_ONBOARDING', 'FECHA'
  ]);
$$;

create table if not exists public.org_variables_def (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  ambito           text not null check (ambito in ('negocio', 'cliente', 'contrato')),
  clave            text not null check (clave ~ '^[A-Z][A-Z0-9_]{1,39}$' and not public.variable_de_sistema(clave)),
  etiqueta         text not null check (length(trim(etiqueta)) between 2 and 80),
  ayuda            text check (ayuda is null or length(ayuda) <= 300),
  tipo             text not null check (tipo in ('texto', 'numero', 'monto', 'fecha', 'opcion', 'booleano')),
  opciones         text[] check (opciones is null or cardinality(opciones) between 1 and 50),
  obligatoria      boolean not null default false,
  sensible         boolean not null default false,
  orden            int not null default 0,
  activa           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  -- La clave es única en todo el negocio: en el modelo no se sabe de qué ámbito viene.
  unique (organizacion_id, clave),
  constraint org_variables_def_opciones check ((tipo = 'opcion') = (opciones is not null))
);

create table if not exists public.org_variables_valor (
  organizacion_id  uuid not null,
  clave            text not null,
  valor            jsonb not null,
  actualizado_por  uuid default auth.uid() references auth.users (id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  primary key (organizacion_id, clave),
  foreign key (organizacion_id, clave) references public.org_variables_def (organizacion_id, clave) on delete cascade on update cascade
);

alter table public.crm_clientes add column if not exists datos_extra jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------
-- Validación
-- ---------------------------------------------------------------------

-- Un valor es válido para su tipo. null vale siempre: es «sin dato».
create or replace function public.valor_variable_valido(p_tipo text, p_opciones text[], p_valor jsonb)
returns boolean language plpgsql immutable as $$
begin
  if p_valor is null or jsonb_typeof(p_valor) = 'null' then return true; end if;
  case p_tipo
    when 'texto' then
      return jsonb_typeof(p_valor) = 'string' and length(p_valor #>> '{}') <= 2000;
    when 'numero', 'monto' then
      return jsonb_typeof(p_valor) = 'number' and (p_tipo = 'numero' or (p_valor #>> '{}')::numeric >= 0);
    when 'booleano' then
      return jsonb_typeof(p_valor) = 'boolean';
    when 'opcion' then
      return jsonb_typeof(p_valor) = 'string' and (p_valor #>> '{}') = any (p_opciones);
    when 'fecha' then
      if jsonb_typeof(p_valor) <> 'string' or (p_valor #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
      perform (p_valor #>> '{}')::date;
      return true;
    else
      return false;
  end case;
exception when others then
  return false;
end;
$$;

create or replace function public.org_variables_def_antes()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.organizacion_id is distinct from old.organizacion_id or new.ambito is distinct from old.ambito then
      raise exception 'Una variable no cambia de negocio ni de ámbito. Creá otra.';
    end if;
    if new.tipo is distinct from old.tipo then
      raise exception 'El tipo de una variable no se cambia. Desactivala y creá otra.';
    end if;
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;

drop trigger if exists org_variables_def_antes on public.org_variables_def;
create trigger org_variables_def_antes before insert or update on public.org_variables_def
  for each row execute function public.org_variables_def_antes();

create or replace function public.org_variables_valor_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d org_variables_def;
begin
  select * into d from org_variables_def where organizacion_id = new.organizacion_id and clave = new.clave;
  if d.ambito <> 'negocio' then
    raise exception 'La variable % es por %, no del negocio.', new.clave, d.ambito;
  end if;
  if not valor_variable_valido(d.tipo, d.opciones, new.valor) then
    raise exception 'Valor inválido para % (%).', new.clave, d.tipo;
  end if;
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists org_variables_valor_antes on public.org_variables_valor;
create trigger org_variables_valor_antes before insert or update on public.org_variables_valor
  for each row execute function public.org_variables_valor_antes();

-- datos_extra de un cliente: solo claves de ámbito cliente de su negocio, con su tipo.
create or replace function public.crm_clientes_datos_extra()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text;
  v jsonb;
  d org_variables_def;
begin
  if tg_op = 'UPDATE' and new.datos_extra is not distinct from old.datos_extra then return new; end if;
  if jsonb_typeof(new.datos_extra) <> 'object' then
    raise exception 'datos_extra tiene que ser un objeto.';
  end if;
  for k, v in select * from jsonb_each(new.datos_extra) loop
    select * into d from org_variables_def where organizacion_id = new.organizacion_id and clave = k and ambito = 'cliente';
    if not found then
      raise exception 'El negocio no tiene la variable de cliente %.', k;
    end if;
    if not valor_variable_valido(d.tipo, d.opciones, v) then
      raise exception 'Valor inválido para % (%).', k, d.tipo;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists crm_clientes_datos_extra on public.crm_clientes;
create trigger crm_clientes_datos_extra before insert or update of datos_extra on public.crm_clientes
  for each row execute function public.crm_clientes_datos_extra();

revoke all on function public.org_variables_valor_antes() from public, anon, authenticated;
revoke all on function public.crm_clientes_datos_extra() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Seguridad. El negocio lee sus variables; las definen y completan el
-- titular y FIRMA.
-- ---------------------------------------------------------------------
alter table public.org_variables_def enable row level security;
alter table public.org_variables_valor enable row level security;

drop policy if exists vardef_lectura on public.org_variables_def;
create policy vardef_lectura on public.org_variables_def for select to authenticated
  using (public.es_admin() or organizacion_id = public.mi_organizacion());
drop policy if exists vardef_alta on public.org_variables_def;
create policy vardef_alta on public.org_variables_def for insert to authenticated
  with check (public.puede_gestionar_org(organizacion_id));
drop policy if exists vardef_edicion on public.org_variables_def;
create policy vardef_edicion on public.org_variables_def for update to authenticated
  using (public.puede_gestionar_org(organizacion_id)) with check (public.puede_gestionar_org(organizacion_id));

drop policy if exists varval_lectura on public.org_variables_valor;
create policy varval_lectura on public.org_variables_valor for select to authenticated
  using (public.es_admin() or organizacion_id = public.mi_organizacion());
drop policy if exists varval_alta on public.org_variables_valor;
create policy varval_alta on public.org_variables_valor for insert to authenticated
  with check (public.puede_gestionar_org(organizacion_id));
drop policy if exists varval_edicion on public.org_variables_valor;
create policy varval_edicion on public.org_variables_valor for update to authenticated
  using (public.puede_gestionar_org(organizacion_id)) with check (public.puede_gestionar_org(organizacion_id));
drop policy if exists varval_baja on public.org_variables_valor;
create policy varval_baja on public.org_variables_valor for delete to authenticated
  using (public.puede_gestionar_org(organizacion_id));

revoke all on public.org_variables_def, public.org_variables_valor from anon;
revoke delete on public.org_variables_def from authenticated;
grant select, insert, update on public.org_variables_def to authenticated;
grant select, insert, update, delete on public.org_variables_valor to authenticated;

notify pgrst, 'reload schema';

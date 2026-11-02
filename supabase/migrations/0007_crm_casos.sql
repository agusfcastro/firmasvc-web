-- =====================================================================
-- FIRMA · Portal · CRM con registro de casos de conflicto
-- Cada caso es un reclamo o pedido de reembolso de un cliente final,
-- desde la disconformidad hasta el cierre. Con estos casos el CRM
-- calcula los indicadores del protocolo de conflictos
-- (/protocolo-conflictos, sección Tablero de indicadores).
-- La organización se hereda del cliente y cada cambio queda en el
-- historial del CRM.
-- Los montos del caso se expresan en la moneda del cliente.
-- Se ejecuta una sola vez en Supabase › SQL Editor.
-- =====================================================================

create table if not exists public.crm_casos (
  id                     uuid primary key default gen_random_uuid(),
  organizacion_id        uuid not null references public.organizaciones (id) on delete cascade,
  cliente_id             uuid not null references public.crm_clientes (id) on delete cascade,
  abierto_en             date not null default current_date,
  cerrado_en             date,
  etapa                  text not null default 'disconformidad'
                           check (etapa in ('disconformidad', 'legales', 'difusion', 'cerrado')),
  semaforo               text not null default 'verde'
                           check (semaforo in ('verde', 'ambar', 'rojo')),
  causa                  text not null
                           check (causa in ('promesa', 'demora', 'expectativa', 'encaje', 'arrepentimiento', 'cobro', 'otra')),
  canal                  text,
  monto_reclamado        numeric(12,2) check (monto_reclamado is null or monto_reclamado >= 0),
  contracargo            boolean not null default false,
  contracargo_resultado  text check (contracargo_resultado is null or contracargo_resultado in ('pendiente', 'ganado', 'perdido')),
  derivado_legales       boolean not null default false,
  decision               text check (decision is null or decision in ('retenido', 'alternativa', 'concesion', 'rechazo', 'devolucion_legal')),
  monto_concedido        numeric(12,2) not null default 0 check (monto_concedido >= 0),
  responsable            text,
  notas                  text,
  creado_por             uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  -- El cierre nunca es anterior a la apertura.
  constraint crm_casos_fechas check (cerrado_en is null or cerrado_en >= abierto_en),
  -- Un caso cerrado tiene decisión y fecha de cierre. Uno abierto no tiene fecha de cierre.
  constraint crm_casos_cierre check (
    case when etapa = 'cerrado' then cerrado_en is not null and decision is not null
         else cerrado_en is null end
  ),
  -- El resultado del contracargo solo existe si hubo contracargo.
  constraint crm_casos_contracargo check (contracargo or contracargo_resultado is null)
);

create index if not exists crm_casos_apertura_idx on public.crm_casos (organizacion_id, abierto_en desc);
create index if not exists crm_casos_cierre_idx on public.crm_casos (organizacion_id, cerrado_en) where cerrado_en is not null;
create index if not exists crm_casos_abiertos_idx on public.crm_casos (organizacion_id) where etapa <> 'cerrado';
create index if not exists crm_casos_cliente_idx on public.crm_casos (cliente_id, abierto_en desc);

-- ---------------------------------------------------------------------
-- Reglas de negocio
-- ---------------------------------------------------------------------

-- Autor y fecha de alta fijos, fecha de actualización automática.
-- Un caso en legales o en difusión pública ya fue derivado a legales,
-- así el indicador de resueltos antes de legales no depende de una tilde.
create or replace function public.crm_casos_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.creado_por := auth.uid();
    end if;
  else
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  end if;
  new.actualizado_en := now();
  if new.etapa in ('legales', 'difusion') then
    new.derivado_legales := true;
  end if;
  return new;
end;
$$;

drop trigger if exists crm_casos_antes on public.crm_casos;
create trigger crm_casos_antes before insert or update on public.crm_casos
  for each row execute function public.crm_casos_antes();

-- La organización del caso siempre es la del cliente (misma función que pagos y contratos).
drop trigger if exists crm_casos_org on public.crm_casos;
create trigger crm_casos_org before insert or update on public.crm_casos
  for each row execute function public.crm_hereda_org();

-- Historial automático en crm_historial, junto con el resto de la ficha.
drop trigger if exists crm_casos_hist on public.crm_casos;
create trigger crm_casos_hist after insert or update or delete on public.crm_casos
  for each row execute function public.crm_registrar();

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila
-- La organización ve, carga y edita sus casos. Borran FIRMA o el titular.
-- ---------------------------------------------------------------------
alter table public.crm_casos enable row level security;

drop policy if exists cas_lectura on public.crm_casos;
create policy cas_lectura on public.crm_casos for select to authenticated using (public.puede_ver_org(organizacion_id));
drop policy if exists cas_alta on public.crm_casos;
create policy cas_alta on public.crm_casos for insert to authenticated with check (public.puede_ver_org(organizacion_id));
drop policy if exists cas_edicion on public.crm_casos;
create policy cas_edicion on public.crm_casos for update to authenticated
  using (public.puede_ver_org(organizacion_id)) with check (public.puede_ver_org(organizacion_id));
drop policy if exists cas_baja on public.crm_casos;
create policy cas_baja on public.crm_casos for delete to authenticated using (public.puede_gestionar_org(organizacion_id));

revoke all on public.crm_casos from anon;
grant select, insert, update, delete on public.crm_casos to authenticated;

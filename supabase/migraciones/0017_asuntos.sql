-- =====================================================================
-- FIRMA · Portal · Estado de asuntos
-- Cada trámite que FIRMA lleva para una empresa cliente (un contrato, un
-- conflicto, una marca) con su estado, su próximo paso y un historial de
-- novedades. FIRMA crea y actualiza los asuntos. El titular y el CSM de la
-- empresa los ven y pueden escribir novedades, que le llegan a FIRMA.
-- Los avisos por mail los manda /api/portal/avisos.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

create table if not exists public.asuntos (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  titulo           text not null check (length(trim(titulo)) between 3 and 140),
  tipo             text not null default 'otro'
                     check (tipo in ('contrato', 'conflicto', 'marca', 'societario', 'cobranza', 'consulta', 'otro')),
  estado           text not null default 'en_curso'
                     check (estado in ('en_curso', 'espera_cliente', 'espera_tercero', 'finalizado')),
  proximo_paso     text check (proximo_paso is null or length(proximo_paso) <= 300),
  vence_en         date,
  creado_por       uuid references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  cerrado_en       timestamptz
);

create index if not exists asuntos_organizacion_idx on public.asuntos (organizacion_id, actualizado_en desc);

create table if not exists public.asunto_novedades (
  id               uuid primary key default gen_random_uuid(),
  asunto_id        uuid not null references public.asuntos (id) on delete cascade,
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  texto            text not null check (length(trim(texto)) between 2 and 4000),
  -- Estado en que quedó el asunto con esta novedad, si FIRMA lo cambió.
  estado           text check (estado is null or estado in ('en_curso', 'espera_cliente', 'espera_tercero', 'finalizado')),
  autor_id         uuid references auth.users (id) on delete set null,
  -- Cuándo salió el aviso por mail y a cuántas personas. Vacío si no se avisó.
  avisado_en       timestamptz,
  avisados         int not null default 0,
  creado_en        timestamptz not null default now()
);

create index if not exists asunto_novedades_asunto_idx on public.asunto_novedades (asunto_id, creado_en desc);

-- Textos prolijos, fecha de actualización y de cierre automáticas.
create or replace function public.asuntos_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  new.titulo := trim(new.titulo);
  new.proximo_paso := nullif(trim(coalesce(new.proximo_paso, '')), '');
  if tg_op = 'UPDATE' then
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
    new.actualizado_en := now();
  end if;
  if new.estado = 'finalizado' and (tg_op = 'INSERT' or old.estado <> 'finalizado') then
    new.cerrado_en := now();
  elsif new.estado <> 'finalizado' then
    new.cerrado_en := null;
  end if;
  return new;
end;
$$;

drop trigger if exists asuntos_antes on public.asuntos;
create trigger asuntos_antes before insert or update on public.asuntos
  for each row execute function public.asuntos_antes();

-- La novedad es siempre de la empresa del asunto y de quien la escribe.
-- Mueve la fecha de actualización del asunto, así queda arriba en la lista.
create or replace function public.asunto_novedades_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select organizacion_id into new.organizacion_id from asuntos where id = new.asunto_id;
  if new.organizacion_id is null then raise exception 'Asunto inexistente.'; end if;
  new.texto := trim(new.texto);
  if auth.uid() is not null then new.autor_id := auth.uid(); end if;
  -- Solo FIRMA cambia el estado.
  if not public.es_admin() then new.estado := null; end if;
  return new;
end;
$$;

drop trigger if exists asunto_novedades_antes on public.asunto_novedades;
create trigger asunto_novedades_antes before insert on public.asunto_novedades
  for each row execute function public.asunto_novedades_antes();

create or replace function public.asunto_novedades_despues()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update asuntos set actualizado_en = now() where id = new.asunto_id;
  return new;
end;
$$;

drop trigger if exists asunto_novedades_despues on public.asunto_novedades;
create trigger asunto_novedades_despues after insert on public.asunto_novedades
  for each row execute function public.asunto_novedades_despues();

-- ---------------------------------------------------------------------
-- Seguridad. Ven los asuntos FIRMA, el titular y el CSM de la empresa
-- (las mismas reglas que los casos de conflicto). Los crea y edita FIRMA.
-- Las novedades las escriben FIRMA y quien ve el asunto. Borra FIRMA.
-- ---------------------------------------------------------------------
alter table public.asuntos          enable row level security;
alter table public.asunto_novedades enable row level security;

drop policy if exists asuntos_lectura on public.asuntos;
create policy asuntos_lectura on public.asuntos for select to authenticated
  using (public.puede_ver_casos(organizacion_id));
drop policy if exists asuntos_gestion on public.asuntos;
create policy asuntos_gestion on public.asuntos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists novedades_lectura on public.asunto_novedades;
create policy novedades_lectura on public.asunto_novedades for select to authenticated
  using (public.puede_ver_casos(organizacion_id));
drop policy if exists novedades_alta on public.asunto_novedades;
create policy novedades_alta on public.asunto_novedades for insert to authenticated
  with check (public.puede_ver_casos(organizacion_id) and autor_id = auth.uid());
drop policy if exists novedades_baja on public.asunto_novedades;
create policy novedades_baja on public.asunto_novedades for delete to authenticated
  using (public.es_admin());

revoke all on public.asuntos, public.asunto_novedades from anon, authenticated;
grant select, insert, update, delete on public.asuntos to authenticated;
grant select, delete on public.asunto_novedades to authenticated;
grant insert (asunto_id, texto, estado) on public.asunto_novedades to authenticated;
grant select, insert, update, delete on public.asuntos, public.asunto_novedades to service_role;

notify pgrst, 'reload schema';

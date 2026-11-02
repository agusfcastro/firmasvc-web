-- =====================================================================
-- FIRMA · Portal · Pedidos de contrato
-- El titular o el CSM completan un formulario (por ahora, el contrato de
-- un closer) y FIRMA redacta con esas respuestas. El borrador se guarda
-- solo mientras se completa. Al enviarlo se abre un asunto de tipo
-- Contrato y el pedido queda atado a él, sin cambios del lado del cliente.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

create table if not exists public.pedidos_contrato (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  modelo           text not null default 'closer' check (modelo in ('closer')),
  -- Para la lista: el nombre de la persona con quien se firma.
  titulo           text check (titulo is null or length(titulo) <= 140),
  respuestas       jsonb not null default '{}'::jsonb,
  -- Borrar el asunto borra el pedido: es su ficha.
  asunto_id        uuid unique references public.asuntos (id) on delete cascade,
  enviado_en       timestamptz,
  creado_por       uuid references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

create index if not exists pedidos_contrato_organizacion_idx on public.pedidos_contrato (organizacion_id, actualizado_en desc);

-- Un pedido enviado ya no lo cambia el cliente. El asunto tiene que ser de
-- la misma empresa, y enviar es poner asunto y fecha juntos.
create or replace function public.pedidos_contrato_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.titulo := nullif(trim(coalesce(new.titulo, '')), '');
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
    new.creado_en := now();
  else
    if old.enviado_en is not null and not public.es_admin() then
      raise exception 'El pedido ya se envió a FIRMA. Para corregir algo escribí en el chat del asunto.';
    end if;
    new.organizacion_id := old.organizacion_id;
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  end if;
  if new.asunto_id is not null then
    if not exists (select 1 from asuntos where id = new.asunto_id and organizacion_id = new.organizacion_id) then
      raise exception 'El asunto no es de esta empresa.';
    end if;
    new.enviado_en := coalesce(new.enviado_en, now());
  elsif new.enviado_en is not null then
    raise exception 'Un pedido enviado tiene que tener su asunto.';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists pedidos_contrato_antes on public.pedidos_contrato;
create trigger pedidos_contrato_antes before insert or update on public.pedidos_contrato
  for each row execute function public.pedidos_contrato_antes();

-- ---------------------------------------------------------------------
-- Seguridad. Los mismos que ven los asuntos: FIRMA, el titular y el CSM
-- de la empresa. El cliente crea y edita sus borradores y borra los que
-- no envió. FIRMA lee todo y borra.
-- ---------------------------------------------------------------------
alter table public.pedidos_contrato enable row level security;

drop policy if exists pedidos_lectura on public.pedidos_contrato;
create policy pedidos_lectura on public.pedidos_contrato for select to authenticated
  using (public.puede_ver_casos(organizacion_id));
drop policy if exists pedidos_alta on public.pedidos_contrato;
create policy pedidos_alta on public.pedidos_contrato for insert to authenticated
  with check (public.puede_ver_casos(organizacion_id) and asunto_id is null and enviado_en is null);
drop policy if exists pedidos_edicion on public.pedidos_contrato;
create policy pedidos_edicion on public.pedidos_contrato for update to authenticated
  using (public.puede_ver_casos(organizacion_id) and (enviado_en is null or public.es_admin()))
  with check (public.puede_ver_casos(organizacion_id));
drop policy if exists pedidos_baja on public.pedidos_contrato;
create policy pedidos_baja on public.pedidos_contrato for delete to authenticated
  using (public.es_admin() or (public.puede_ver_casos(organizacion_id) and enviado_en is null));

revoke all on public.pedidos_contrato from anon, authenticated;
grant select, delete on public.pedidos_contrato to authenticated;
grant insert (organizacion_id, modelo, titulo, respuestas) on public.pedidos_contrato to authenticated;
grant update (titulo, respuestas, asunto_id, enviado_en) on public.pedidos_contrato to authenticated;
grant select, insert, update, delete on public.pedidos_contrato to service_role;

notify pgrst, 'reload schema';

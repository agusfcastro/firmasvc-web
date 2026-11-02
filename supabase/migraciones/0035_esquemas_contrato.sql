-- =====================================================================
-- FIRMA · Portal · Esquemas de contrato y datos de la persona después
-- de enviar
-- 1. El cliente guarda las condiciones de un pedido (honorarios, bonos,
--    reembolsos, plazo) como esquema de su empresa. El próximo pedido
--    del mismo modelo arranca con ellas y solo pide los datos de la persona.
-- 2. Un pedido se puede enviar sin los datos de la persona, porque muchas
--    veces el contrato se arma antes de sumarla. Después del envío el
--    cliente puede completarlos. Las condiciones siguen fijas.
--    Las claves de los datos de la persona empiezan con closer_ (closer.ts).
-- Correr después de 0034. Se puede correr más de una vez.
-- =====================================================================

create table if not exists public.esquemas_contrato (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  modelo           text not null default 'closer' check (modelo in ('closer')),
  respuestas       jsonb not null default '{}'::jsonb,
  actualizado_por  uuid references auth.users (id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  unique (organizacion_id, modelo)
);

create or replace function public.esquemas_contrato_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then new.organizacion_id := old.organizacion_id; new.modelo := old.modelo; end if;
  -- El esquema nunca guarda datos de una persona.
  new.respuestas := coalesce((select jsonb_object_agg(key, value) from jsonb_each(new.respuestas) where key not like 'closer\_%'), '{}'::jsonb);
  new.actualizado_por := coalesce(auth.uid(), new.actualizado_por);
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists esquemas_contrato_antes on public.esquemas_contrato;
create trigger esquemas_contrato_antes before insert or update on public.esquemas_contrato
  for each row execute function public.esquemas_contrato_antes();

alter table public.esquemas_contrato enable row level security;

drop policy if exists esquemas_lectura on public.esquemas_contrato;
create policy esquemas_lectura on public.esquemas_contrato for select to authenticated
  using (public.puede_ver_casos(organizacion_id));
drop policy if exists esquemas_alta on public.esquemas_contrato;
create policy esquemas_alta on public.esquemas_contrato for insert to authenticated
  with check (public.puede_ver_casos(organizacion_id));
drop policy if exists esquemas_edicion on public.esquemas_contrato;
create policy esquemas_edicion on public.esquemas_contrato for update to authenticated
  using (public.puede_ver_casos(organizacion_id)) with check (public.puede_ver_casos(organizacion_id));
drop policy if exists esquemas_baja on public.esquemas_contrato;
create policy esquemas_baja on public.esquemas_contrato for delete to authenticated
  using (public.puede_ver_casos(organizacion_id));

revoke all on public.esquemas_contrato from anon, authenticated;
grant select, delete on public.esquemas_contrato to authenticated;
grant insert (organizacion_id, modelo, respuestas) on public.esquemas_contrato to authenticated;
grant update (respuestas) on public.esquemas_contrato to authenticated;
grant select, insert, update, delete on public.esquemas_contrato to service_role;

-- ---------------------------------------------------------------------
-- Pedido enviado: el cliente solo cambia los datos de la persona. Si
-- cambia el nombre, el asunto se renombra para que FIRMA lo encuentre.
-- ---------------------------------------------------------------------
create or replace function public.sin_datos_persona(j jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce((select jsonb_object_agg(key, value) from jsonb_each(j) where key not like 'closer\_%'), '{}'::jsonb);
$$;

create or replace function public.pedidos_contrato_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.titulo := nullif(trim(coalesce(new.titulo, '')), '');
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
    new.creado_en := now();
  else
    if old.enviado_en is not null and not public.es_admin() then
      if new.asunto_id is distinct from old.asunto_id
         or new.enviado_en is distinct from old.enviado_en
         or public.sin_datos_persona(new.respuestas) is distinct from public.sin_datos_persona(old.respuestas) then
        raise exception 'El pedido ya se envió a FIRMA. Solo se pueden completar los datos del closer. Para cambiar las condiciones escribí en el chat del asunto.';
      end if;
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
  if tg_op = 'UPDATE' and old.enviado_en is not null and new.titulo is distinct from old.titulo then
    update asuntos set titulo = left('Contrato de closer · ' || coalesce(new.titulo, 'datos del closer pendientes'), 140) where id = new.asunto_id;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

-- Ahora el cliente también edita un pedido enviado (solo los datos de la persona, lo controla el trigger).
drop policy if exists pedidos_edicion on public.pedidos_contrato;
create policy pedidos_edicion on public.pedidos_contrato for update to authenticated
  using (public.puede_ver_casos(organizacion_id))
  with check (public.puede_ver_casos(organizacion_id));

notify pgrst, 'reload schema';

-- =====================================================================
-- FIRMA · Portal · Contrato de setter y condiciones precargadas por FIRMA
-- 1. Los pedidos y los esquemas de contrato aceptan el modelo setter.
--    Los datos de la persona se reconocen por el prefijo del modelo
--    (closer_ o setter_), ya no solo por closer_.
-- 2. FIRMA precarga las condiciones de un cliente (esquema de_firma).
--    El cliente arranca con ellas, no las cambia ni las borra, y si en su
--    caso algo es distinto lo cuenta en las notas del pedido.
-- Correr después de 0035. Se puede correr más de una vez.
-- =====================================================================

alter table public.pedidos_contrato drop constraint if exists pedidos_contrato_modelo_check;
alter table public.pedidos_contrato add constraint pedidos_contrato_modelo_check check (modelo in ('closer', 'setter'));
alter table public.esquemas_contrato drop constraint if exists esquemas_contrato_modelo_check;
alter table public.esquemas_contrato add constraint esquemas_contrato_modelo_check check (modelo in ('closer', 'setter'));

-- Lo cargó FIRMA: el cliente no lo cambia.
alter table public.esquemas_contrato add column if not exists de_firma boolean not null default false;

-- ---------------------------------------------------------------------
-- Datos de la persona según el modelo.
-- ---------------------------------------------------------------------
create or replace function public.sin_datos_persona(j jsonb, modelo text)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce((select jsonb_object_agg(key, value) from jsonb_each(j) where key not like modelo || '\_%'), '{}'::jsonb);
$$;

-- La versión de 0035 sigue sirviendo para el closer.
create or replace function public.sin_datos_persona(j jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select public.sin_datos_persona(j, 'closer');
$$;

-- ---------------------------------------------------------------------
-- Esquemas: nunca guardan datos de una persona. Lo que guarda FIRMA
-- queda marcado y solo FIRMA lo cambia.
-- ---------------------------------------------------------------------
create or replace function public.esquemas_contrato_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.de_firma and not public.es_admin() then
      raise exception 'Estas condiciones las cargó FIRMA. Si en tu caso algo es distinto, contalo en las notas del pedido.';
    end if;
    new.organizacion_id := old.organizacion_id;
    new.modelo := old.modelo;
  end if;
  new.respuestas := public.sin_datos_persona(new.respuestas, new.modelo);
  new.de_firma := public.es_admin();
  new.actualizado_por := coalesce(auth.uid(), new.actualizado_por);
  new.actualizado_en := now();
  return new;
end;
$$;

drop policy if exists esquemas_baja on public.esquemas_contrato;
create policy esquemas_baja on public.esquemas_contrato for delete to authenticated
  using (public.es_admin() or (public.puede_ver_casos(organizacion_id) and not de_firma));

-- ---------------------------------------------------------------------
-- Pedidos: misma regla de 0035, con el prefijo y el título del modelo.
-- ---------------------------------------------------------------------
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
         or public.sin_datos_persona(new.respuestas, old.modelo) is distinct from public.sin_datos_persona(old.respuestas, old.modelo) then
        raise exception 'El pedido ya se envió a FIRMA. Solo se pueden completar los datos del %. Para cambiar las condiciones escribí en el chat del asunto.', old.modelo;
      end if;
    end if;
    new.organizacion_id := old.organizacion_id;
    new.modelo := old.modelo;
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
  -- El mismo texto que tituloAsunto en closer.ts y setter.ts.
  if tg_op = 'UPDATE' and old.enviado_en is not null and new.titulo is distinct from old.titulo then
    update asuntos
       set titulo = left('Contrato de ' || new.modelo || ' · ' || coalesce(new.titulo, 'datos del ' || new.modelo || ' pendientes'), 140)
     where id = new.asunto_id;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

notify pgrst, 'reload schema';

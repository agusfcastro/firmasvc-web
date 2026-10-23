-- =====================================================================
-- FIRMA · Portal · Asuntos y casos de conflicto en una sola gestión
-- 1. Los asuntos los crean FIRMA y también el titular o el CSM de la
--    empresa. Siguen editándolos (estado, próximo paso) solo FIRMA.
-- 2. Un asunto puede vincularse a un cliente del CRM de la empresa. No es
--    obligatorio, salvo para un reclamo de reembolso o contracargo.
-- 3. Los asuntos de conflicto llevan un motivo:
--      reembolso   Reembolso o contracargo
--      entregables Incumplimiento de entregables
--      cobro       Cobro de sumas adeudadas
--      equipo      Conflicto con el equipo
--      otro        Otro conflicto
-- 4. Cada caso de conflicto (crm_casos) es la ficha de seguimiento de un
--    asunto de reembolso o contracargo: etapa, semáforo, montos, decisión y
--    los indicadores del protocolo. crm_casos.asunto_id une los dos. Un caso
--    nuevo sin asunto crea el suyo, así nada queda por fuera de Asuntos.
--    Al cerrar o reabrir el caso, el asunto pasa a finalizado o en curso.
-- 5. Los casos que ya existen reciben su asunto, con la fecha y las notas
--    originales. No se borra ni se cambia nada de crm_casos ni su historial.
-- Requiere la 0017, 0018 y 0019. Se puede correr más de una vez en
-- Supabase › SQL Editor.
-- =====================================================================

alter table public.asuntos add column if not exists cliente_id uuid references public.crm_clientes (id) on delete set null;
alter table public.asuntos add column if not exists motivo text;

alter table public.asuntos drop constraint if exists asuntos_motivo;
alter table public.asuntos add constraint asuntos_motivo check (
  motivo is null or (tipo = 'conflicto' and motivo in ('reembolso', 'entregables', 'cobro', 'equipo', 'otro'))
);
alter table public.asuntos drop constraint if exists asuntos_reembolso_cliente;
alter table public.asuntos add constraint asuntos_reembolso_cliente check (motivo is distinct from 'reembolso' or cliente_id is not null);

create index if not exists asuntos_cliente_idx on public.asuntos (cliente_id) where cliente_id is not null;

alter table public.crm_casos add column if not exists asunto_id uuid references public.asuntos (id) on delete set null;
create unique index if not exists crm_casos_asunto_idx on public.crm_casos (asunto_id) where asunto_id is not null;

-- ---------------------------------------------------------------------
-- Reglas del asunto
-- ---------------------------------------------------------------------
-- Igual que en la 0017, más: quien crea es quien llama, el cliente del CRM
-- es de la misma empresa, y al crear un asunto ya cerrado se respeta la
-- fecha de cierre que trae (la usan los casos migrados).
create or replace function public.asuntos_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  new.titulo := trim(new.titulo);
  new.proximo_paso := nullif(trim(coalesce(new.proximo_paso, '')), '');
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.creado_por := auth.uid(); end if;
  else
    new.creado_en := old.creado_en;
    new.creado_por := old.creado_por;
    new.actualizado_en := now();
  end if;
  if new.cliente_id is not null
     and not exists (select 1 from crm_clientes c where c.id = new.cliente_id and c.organizacion_id = new.organizacion_id) then
    raise exception 'El cliente no es de esta empresa.';
  end if;
  if new.estado = 'finalizado' and tg_op = 'INSERT' then
    new.cerrado_en := coalesce(new.cerrado_en, now());
  elsif new.estado = 'finalizado' and old.estado <> 'finalizado' then
    new.cerrado_en := now();
  elsif new.estado <> 'finalizado' then
    new.cerrado_en := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Caso de conflicto y su asunto
-- ---------------------------------------------------------------------
create or replace function public.crm_casos_asunto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nombre text;
  nuevo uuid;
begin
  if tg_op = 'INSERT' then
    if new.asunto_id is not null then
      if not exists (select 1 from asuntos a where a.id = new.asunto_id and a.organizacion_id = new.organizacion_id) then
        raise exception 'El asunto no es de esta empresa.';
      end if;
      return new;
    end if;
    select c.nombre into nombre from crm_clientes c where c.id = new.cliente_id;
    insert into asuntos (organizacion_id, titulo, tipo, motivo, cliente_id, estado)
    values (new.organizacion_id, left('Reembolso o contracargo · ' || coalesce(nombre, 'cliente'), 140), 'conflicto', 'reembolso', new.cliente_id,
            case when new.etapa = 'cerrado' then 'finalizado' else 'en_curso' end)
    returning id into nuevo;
    new.asunto_id := nuevo;
    return new;
  end if;
  -- El asunto no cambia de dueño.
  if new.asunto_id is distinct from old.asunto_id and old.asunto_id is not null then
    new.asunto_id := old.asunto_id;
  end if;
  return new;
end;
$$;

-- Se llama crm_casos_vincular para correr después de crm_casos_org, que completa la empresa
-- (los disparadores de un mismo momento van en orden alfabético).
drop trigger if exists crm_casos_vincular on public.crm_casos;
create trigger crm_casos_vincular before insert or update on public.crm_casos
  for each row execute function public.crm_casos_asunto();

-- Cerrar el caso finaliza el asunto y reabrirlo lo vuelve a poner en curso.
-- El cambio queda en la bitácora del asunto (asuntos_registrar_estado).
create or replace function public.crm_casos_estado_asunto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.asunto_id is null or new.etapa is not distinct from old.etapa then return new; end if;
  if new.etapa = 'cerrado' then
    update asuntos set estado = 'finalizado' where id = new.asunto_id and estado <> 'finalizado';
  elsif old.etapa = 'cerrado' then
    update asuntos set estado = 'en_curso' where id = new.asunto_id and estado = 'finalizado';
  end if;
  return new;
end;
$$;

drop trigger if exists crm_casos_estado_asunto on public.crm_casos;
create trigger crm_casos_estado_asunto after update on public.crm_casos
  for each row execute function public.crm_casos_estado_asunto();

-- ---------------------------------------------------------------------
-- Los casos que ya existen, cada uno con su asunto
-- ---------------------------------------------------------------------
do $$
declare
  c record;
  nuevo uuid;
begin
  for c in
    select k.*, cl.nombre as cliente_nombre
    from crm_casos k join crm_clientes cl on cl.id = k.cliente_id
    where k.asunto_id is null
    order by k.creado_en
  loop
    insert into asuntos (organizacion_id, titulo, tipo, motivo, cliente_id, estado, creado_por, creado_en, actualizado_en, cerrado_en)
    values (c.organizacion_id, left('Reembolso o contracargo · ' || c.cliente_nombre, 140), 'conflicto', 'reembolso', c.cliente_id,
            case when c.etapa = 'cerrado' then 'finalizado' else 'en_curso' end,
            c.creado_por, c.creado_en, c.actualizado_en,
            case when c.etapa = 'cerrado' then c.cerrado_en::timestamptz end)
    returning id into nuevo;
    update crm_casos set asunto_id = nuevo where id = c.id;
    if c.notas is not null and length(trim(c.notas)) >= 2 then
      insert into asunto_novedades (asunto_id, texto, tipo, interna, autor_id, creado_en)
      values (nuevo, left('Notas del caso de conflicto: ' || trim(c.notas), 4000), 'nota', false, c.creado_por, c.creado_en);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Seguridad. El titular y el CSM crean asuntos de su empresa, siempre en
-- curso. Editarlos y borrarlos sigue siendo de FIRMA.
-- ---------------------------------------------------------------------
drop policy if exists asuntos_alta_cliente on public.asuntos;
create policy asuntos_alta_cliente on public.asuntos for insert to authenticated
  with check (public.puede_ver_casos(organizacion_id) and estado = 'en_curso');

notify pgrst, 'reload schema';

-- =====================================================================
-- FIRMA · Portal · Contratos con el equipo: persona, vencimiento y
-- formularios de pedido armados por FIRMA para cada empresa
-- 1. Un documento de Contratos con tu equipo se puede atar a una persona
--    del equipo, como ya se atan los envíos a firma (0064). Trae
--    honorarios y datos personales, así que lo ven FIRMA, el titular y
--    quien tiene el área Legales u Operaciones, sin importar las áreas
--    que tenga marcadas el documento.
-- 2. Vencimiento del contrato, en los documentos y en los envíos a firma
--    atados a una persona. Es la fecha en que termina el contrato, no el
--    plazo para firmar (vence_en).
-- 3. Modelos de contrato propios de una empresa: FIRMA arma las preguntas
--    del formulario desde Administración y el cliente lo completa como hoy
--    el de closer o el de setter. Al enviarlo, el pedido guarda una copia
--    del formulario, así un cambio posterior no altera lo ya enviado.
-- Correr después de 0067. Se puede correr más de una vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 y 2. Documentos y envíos a firma
-- ---------------------------------------------------------------------
alter table public.documentos add column if not exists equipo_miembro_id uuid;
alter table public.documentos add column if not exists contrato_vence_el date;

-- La persona tiene que ser de la empresa del documento (unique (organizacion_id, id) de equipo_miembros).
alter table public.documentos drop constraint if exists documentos_equipo_fk;
alter table public.documentos add constraint documentos_equipo_fk
  foreign key (organizacion_id, equipo_miembro_id) references public.equipo_miembros (organizacion_id, id);

-- Solo un contrato de una empresa, en Contratos con tu equipo, que no sea el modelo ni un protocolo.
alter table public.documentos drop constraint if exists documentos_equipo_check;
alter table public.documentos add constraint documentos_equipo_check check (
  equipo_miembro_id is null
  or (seccion = 'equipo' and organizacion_id is not null and modelo_contrato is null and not es_protocolo)
);
alter table public.documentos drop constraint if exists documentos_vence_check;
alter table public.documentos add constraint documentos_vence_check check (contrato_vence_el is null or equipo_miembro_id is not null);

create index if not exists documentos_equipo_idx on public.documentos (equipo_miembro_id) where equipo_miembro_id is not null;

alter table public.firma_sobres add column if not exists contrato_vence_el date;
alter table public.firma_sobres drop constraint if exists firma_sobres_contrato_vence_check;
alter table public.firma_sobres add constraint firma_sobres_contrato_vence_check check (contrato_vence_el is null or equipo_miembro_id is not null);

-- Quién ve un documento. Si es el contrato de una persona, la regla de los envíos a firma del equipo (0064).
create or replace function public.documento_visible(p_org uuid, p_areas text[], p_activo boolean, p_protocolo boolean, p_miembro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_miembro is null then public.documento_visible(p_org, p_areas, p_activo, p_protocolo)
    else public.es_admin() or (
      p_activo
      and p_org is not null
      and p_org = public.mi_organizacion()
      and (public.soy_titular() or public.mis_areas() && array['legales', 'operaciones'])
    )
  end;
$$;

drop policy if exists documentos_lectura on public.documentos;
create policy documentos_lectura on public.documentos for select to authenticated
  using (public.documento_visible(organizacion_id, areas, activo, es_protocolo, equipo_miembro_id));

create or replace function public.puede_descargar_documento(ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.documentos d
    where d.archivo_ruta = ruta
      and public.documento_visible(d.organizacion_id, d.areas, d.activo, d.es_protocolo, d.equipo_miembro_id)
  );
$$;

create or replace function public.registrar_descarga(doc uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.documentos;
begin
  if auth.uid() is null or public.es_admin() then return; end if;
  select * into d from public.documentos where id = doc;
  if not found or not public.documento_visible(d.organizacion_id, d.areas, d.activo, d.es_protocolo, d.equipo_miembro_id) then return; end if;
  insert into public.registro_accesos (usuario_id, actor_id, accion, detalle)
  values (auth.uid(), auth.uid(), 'descarga_documento',
          jsonb_build_object('documento_id', d.id, 'titulo', d.titulo, 'seccion', d.seccion, 'version', d.version));
end;
$$;

-- Los envíos a firma se escriben solo desde el servidor. El vencimiento del
-- contrato lo cargan quienes ven el envío del equipo, con esta función.
create or replace function public.firma_sobre_vencimiento(p_sobre uuid, p_fecha date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.firma_sobres s
    where s.id = p_sobre and s.equipo_miembro_id is not null and s.estado <> 'anulado' and public.firma_sobre_visible(s.id)
  ) then
    raise exception 'No existe ese contrato o no tenés acceso.' using errcode = '42501';
  end if;
  update public.firma_sobres set contrato_vence_el = p_fecha where id = p_sobre;
end;
$$;

revoke all on function public.firma_sobre_vencimiento(uuid, date) from public, anon;
grant execute on function public.firma_sobre_vencimiento(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Modelos de contrato propios de una empresa
-- ---------------------------------------------------------------------
create table if not exists public.modelos_contrato (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  -- «Contrato de marketing». Así se llama la tarjeta y el asunto.
  titulo           text not null check (length(trim(titulo)) between 3 and 80),
  -- Cómo se nombra a la otra parte en los textos: «los datos del prestador».
  persona          text not null default 'prestador' check (length(trim(persona)) between 2 and 40),
  descripcion      text check (descripcion is null or length(descripcion) <= 400),
  -- Secciones con sus preguntas, con el formato de components/portal/pedidos/formulario.ts.
  secciones        jsonb not null default '[]'::jsonb check (jsonb_typeof(secciones) = 'array'),
  -- El contrato modelo que el cliente puede bajar desde la tarjeta.
  documento_id     uuid references public.documentos (id) on delete set null,
  activo           boolean not null default true,
  orden            int not null default 0,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (organizacion_id, id)
);

create index if not exists modelos_contrato_organizacion_idx on public.modelos_contrato (organizacion_id, orden);

create or replace function public.modelos_contrato_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.titulo := regexp_replace(trim(new.titulo), '\s+', ' ', 'g');
  new.persona := lower(regexp_replace(trim(new.persona), '\s+', ' ', 'g'));
  new.descripcion := nullif(trim(coalesce(new.descripcion, '')), '');
  if tg_op = 'UPDATE' then
    new.organizacion_id := old.organizacion_id;
    new.creado_en := old.creado_en;
  end if;
  if new.documento_id is not null and not exists (
    select 1 from public.documentos d where d.id = new.documento_id and d.organizacion_id = new.organizacion_id and d.equipo_miembro_id is null
  ) then
    raise exception 'El contrato modelo tiene que ser un documento de esa empresa.';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists modelos_contrato_antes on public.modelos_contrato;
create trigger modelos_contrato_antes before insert or update on public.modelos_contrato
  for each row execute function public.modelos_contrato_antes();

-- Los arma solo FIRMA. Los ven quienes completan pedidos: el titular y el CSM de la empresa.
alter table public.modelos_contrato enable row level security;

drop policy if exists modelos_contrato_lectura on public.modelos_contrato;
create policy modelos_contrato_lectura on public.modelos_contrato for select to authenticated
  using (public.es_admin() or (activo and public.puede_ver_casos(organizacion_id)));
drop policy if exists modelos_contrato_gestion on public.modelos_contrato;
create policy modelos_contrato_gestion on public.modelos_contrato for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

revoke all on public.modelos_contrato from anon, authenticated;
grant select, insert, update, delete on public.modelos_contrato to authenticated;
grant select, insert, update, delete on public.modelos_contrato to service_role;

-- ---------------------------------------------------------------------
-- Pedidos con un modelo propio. Los datos de la persona llevan el prefijo
-- propio_, como closer_ y setter_ (0062).
-- ---------------------------------------------------------------------
alter table public.pedidos_contrato add column if not exists modelo_propio_id uuid;
-- Copia del formulario al enviar: título, persona y secciones.
alter table public.pedidos_contrato add column if not exists formulario jsonb;

alter table public.pedidos_contrato drop constraint if exists pedidos_contrato_modelo_check;
alter table public.pedidos_contrato add constraint pedidos_contrato_modelo_check check (modelo in ('closer', 'setter', 'propio'));
alter table public.pedidos_contrato drop constraint if exists pedidos_contrato_propio_check;
alter table public.pedidos_contrato add constraint pedidos_contrato_propio_check check ((modelo = 'propio') = (modelo_propio_id is not null));

-- El modelo tiene que ser de la empresa del pedido. Un modelo con pedidos no se borra: se oculta.
alter table public.pedidos_contrato drop constraint if exists pedidos_contrato_propio_fk;
alter table public.pedidos_contrato add constraint pedidos_contrato_propio_fk
  foreign key (organizacion_id, modelo_propio_id) references public.modelos_contrato (organizacion_id, id);

grant insert (modelo_propio_id) on public.pedidos_contrato to authenticated;

-- La misma regla de 0062, más el modelo propio: no cambia después de creado,
-- al enviar guarda la copia del formulario y el asunto lleva el título del modelo.
create or replace function public.pedidos_contrato_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m public.modelos_contrato;
begin
  new.titulo := nullif(trim(coalesce(new.titulo, '')), '');
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
    new.creado_en := now();
    new.formulario := null;
  else
    if old.enviado_en is not null and not public.es_admin() then
      if new.asunto_id is distinct from old.asunto_id
         or new.enviado_en is distinct from old.enviado_en
         or public.sin_datos_persona(new.respuestas, old.modelo) is distinct from public.sin_datos_persona(old.respuestas, old.modelo) then
        raise exception 'El pedido ya se envió a FIRMA. Solo se pueden completar los datos de la persona. Para cambiar las condiciones escribí en el chat del asunto.';
      end if;
    end if;
    new.organizacion_id := old.organizacion_id;
    new.modelo := old.modelo;
    new.modelo_propio_id := old.modelo_propio_id;
    new.formulario := old.formulario;
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  end if;
  if new.modelo = 'propio' then
    select * into m from public.modelos_contrato where id = new.modelo_propio_id;
    if tg_op = 'INSERT' and (m.id is null or not m.activo) then
      raise exception 'Ese formulario ya no está disponible.';
    end if;
  end if;
  if new.asunto_id is not null then
    if not exists (select 1 from asuntos where id = new.asunto_id and organizacion_id = new.organizacion_id) then
      raise exception 'El asunto no es de esta empresa.';
    end if;
    new.enviado_en := coalesce(new.enviado_en, now());
  elsif new.enviado_en is not null then
    raise exception 'Un pedido enviado tiene que tener su asunto.';
  end if;
  -- Recién enviado: la copia del formulario con el que se respondió.
  if new.modelo = 'propio' and new.enviado_en is not null and new.formulario is null then
    new.formulario := jsonb_build_object('titulo', m.titulo, 'persona', m.persona, 'descripcion', m.descripcion, 'secciones', m.secciones);
  end if;
  -- El mismo texto que tituloAsunto en closer.ts, setter.ts y propio.ts.
  if tg_op = 'UPDATE' and old.enviado_en is not null and new.titulo is distinct from old.titulo then
    update asuntos
       set titulo = left(case when new.modelo = 'propio'
                              then coalesce(new.formulario ->> 'titulo', 'Contrato') || ' · ' || coalesce(new.titulo, 'datos pendientes')
                              else 'Contrato de ' || new.modelo || ' · ' || coalesce(new.titulo, 'datos del ' || new.modelo || ' pendientes')
                         end, 140)
     where id = new.asunto_id;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

notify pgrst, 'reload schema';

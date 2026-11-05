-- =====================================================================
-- FIRMA · Portal · Tina, esquema de datos (Fase 1, paso 1)
-- Lo que necesita la asistente con IA del portal. Reutiliza lo que ya
-- existe: organizaciones (el cliente de FIRMA), perfiles, crm_clientes,
-- asuntos y documentos.
--
--   organizaciones.responsable_id   Persona de FIRMA asignada al negocio.
--   perfiles.telefono               Teléfono que Tina pasa en una urgencia.
--   tina_conversaciones, tina_mensajes
--                                   Chat, con el camino elegido, los tokens
--                                   y el costo estimado de cada respuesta.
--   tina_tickets                    Derivaciones al responsable. Solo para
--                                   negocios Eminent: lo controla la base.
--   eventos_cliente                 Novedades para el resumen diario.
--   documentos (columnas tina_*)    Material que Tina puede usar.
--   push_suscripciones              Dispositivos de cada persona.
--   crm_clientes.origen             Si a un cliente del CRM lo cargó Tina.
--
-- Escribe solo el servidor (clave de servicio) en las conversaciones, los
-- mensajes y los tickets nuevos. Las personas leen lo suyo por RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Persona de FIRMA asignada y su teléfono
-- ---------------------------------------------------------------------
alter table public.perfiles add column if not exists telefono text
  check (telefono is null or telefono ~ '^\+?[0-9 ()-]{6,24}$');

alter table public.organizaciones add column if not exists responsable_id uuid
  references public.perfiles (id) on delete set null;

-- El responsable tiene que ser alguien de FIRMA.
create or replace function public.organizaciones_responsable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.responsable_id is not null
     and new.responsable_id is distinct from old.responsable_id
     and not exists (select 1 from perfiles where id = new.responsable_id and rol = 'admin') then
    raise exception 'El responsable de un cliente tiene que ser alguien de FIRMA.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.organizaciones_responsable() from public, anon, authenticated;

drop trigger if exists organizaciones_responsable on public.organizaciones;
create trigger organizaciones_responsable before insert or update of responsable_id on public.organizaciones
  for each row execute function public.organizaciones_responsable();

-- Hoy el responsable de todos es Agustín.
update public.organizaciones o set responsable_id = p.id
from public.perfiles p
where o.responsable_id is null and p.email = 'agustin@firmasvc.com' and p.rol = 'admin';

-- ---------------------------------------------------------------------
-- Conversaciones y mensajes
-- ---------------------------------------------------------------------
create table if not exists public.tina_conversaciones (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  titulo           text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (organizacion_id, id)
);
create index if not exists tina_conversaciones_usuario on public.tina_conversaciones (usuario_id, actualizado_en desc);

create table if not exists public.tina_mensajes (
  id                      bigint generated always as identity primary key,
  organizacion_id         uuid not null,
  conversacion_id         uuid not null,
  autor                   text not null check (autor in ('usuario', 'tina')),
  contenido               text not null default '',
  -- Llamadas a herramientas y sus resultados, tal como se mandaron a la API.
  herramientas            jsonb check (herramientas is null or jsonb_typeof(herramientas) = 'array'),
  camino                  text check (camino in ('accionable', 'recurso', 'derivacion')),
  modelo                  text,
  tokens_entrada          int not null default 0 check (tokens_entrada >= 0),
  tokens_salida           int not null default 0 check (tokens_salida >= 0),
  tokens_cache_escritura  int not null default 0 check (tokens_cache_escritura >= 0),
  tokens_cache_lectura    int not null default 0 check (tokens_cache_lectura >= 0),
  costo_usd               numeric(12,6) not null default 0 check (costo_usd >= 0),
  creado_en               timestamptz not null default now(),
  foreign key (organizacion_id, conversacion_id)
    references public.tina_conversaciones (organizacion_id, id) on delete cascade
);
create index if not exists tina_mensajes_conversacion on public.tina_mensajes (conversacion_id, id);
create index if not exists tina_mensajes_costos on public.tina_mensajes (organizacion_id, creado_en);

-- Cada persona ve sus conversaciones. FIRMA ve todas.
create or replace function public.tina_conversacion_mia(org uuid, usuario uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or (usuario = auth.uid() and org = public.mi_organizacion());
$$;
revoke all on function public.tina_conversacion_mia(uuid, uuid) from public, anon;
grant execute on function public.tina_conversacion_mia(uuid, uuid) to authenticated;

alter table public.tina_conversaciones enable row level security;
alter table public.tina_mensajes enable row level security;

drop policy if exists tina_conversaciones_lectura on public.tina_conversaciones;
create policy tina_conversaciones_lectura on public.tina_conversaciones for select to authenticated
  using (public.tina_conversacion_mia(organizacion_id, usuario_id));

drop policy if exists tina_mensajes_lectura on public.tina_mensajes;
create policy tina_mensajes_lectura on public.tina_mensajes for select to authenticated
  using (exists (
    select 1 from public.tina_conversaciones c
    where c.id = conversacion_id and public.tina_conversacion_mia(c.organizacion_id, c.usuario_id)
  ));

revoke all on public.tina_conversaciones, public.tina_mensajes from anon, authenticated;
grant select on public.tina_conversaciones, public.tina_mensajes to authenticated;
grant select, insert, update, delete on public.tina_conversaciones, public.tina_mensajes to service_role;
grant usage on sequence public.tina_mensajes_id_seq to service_role;

-- ---------------------------------------------------------------------
-- Tickets de derivación
-- ---------------------------------------------------------------------
create table if not exists public.tina_tickets (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  conversacion_id  uuid,
  creado_por       uuid references auth.users (id) on delete set null,
  prioridad        text not null default 'media' check (prioridad in ('baja', 'media', 'alta')),
  categoria        text not null check (categoria in (
                     'reembolso_contracargo', 'cliente_enojado', 'documento_nuevo', 'interpretacion_clausula',
                     'societario', 'otra_jurisdiccion', 'facturacion', 'otro')),
  resumen          text not null check (length(trim(resumen)) > 0),
  estado           text not null default 'abierto' check (estado in ('abierto', 'tomado', 'respondido', 'cerrado')),
  responsable_id   uuid references public.perfiles (id) on delete set null,
  vence_en         timestamptz,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  cerrado_en       timestamptz,
  foreign key (organizacion_id, conversacion_id)
    references public.tina_conversaciones (organizacion_id, id) on delete set null (conversacion_id)
);
create index if not exists tina_tickets_bandeja on public.tina_tickets (estado, prioridad, vence_en);
create index if not exists tina_tickets_org on public.tina_tickets (organizacion_id, creado_en desc);

-- La derivación existe solo en Eminent. Vale también para la clave de
-- servicio, así un error en el backend no la saltea. Al crear, el
-- responsable es el del negocio.
create or replace function public.tina_tickets_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from organizaciones where id = new.organizacion_id and plan = 'eminent') then
      raise exception 'Las derivaciones son solo para clientes Eminent.' using errcode = '42501';
    end if;
    if new.responsable_id is null then
      select responsable_id into new.responsable_id from organizaciones where id = new.organizacion_id;
    end if;
    new.estado := 'abierto';
    new.cerrado_en := null;
  else
    if new.organizacion_id is distinct from old.organizacion_id
       or new.conversacion_id is distinct from old.conversacion_id
       or new.creado_por is distinct from old.creado_por
       or new.creado_en is distinct from old.creado_en then
      raise exception 'Esos datos del ticket no se cambian.' using errcode = '42501';
    end if;
    new.cerrado_en := case when new.estado = 'cerrado' then coalesce(old.cerrado_en, now()) end;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;
revoke all on function public.tina_tickets_antes() from public, anon, authenticated;

drop trigger if exists tina_tickets_antes on public.tina_tickets;
create trigger tina_tickets_antes before insert or update on public.tina_tickets
  for each row execute function public.tina_tickets_antes();

alter table public.tina_tickets enable row level security;

-- FIRMA ve y atiende todos. Del negocio, quien lo creó, y el titular y el
-- CSM, que ven los asuntos.
drop policy if exists tina_tickets_lectura on public.tina_tickets;
create policy tina_tickets_lectura on public.tina_tickets for select to authenticated
  using (public.es_admin() or (organizacion_id = public.mi_organizacion()
         and (creado_por = auth.uid() or public.puede_ver_casos(organizacion_id))));

drop policy if exists tina_tickets_gestion on public.tina_tickets;
create policy tina_tickets_gestion on public.tina_tickets for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

revoke all on public.tina_tickets from anon, authenticated;
grant select, update on public.tina_tickets to authenticated;
grant select, insert, update, delete on public.tina_tickets to service_role;

-- ---------------------------------------------------------------------
-- Eventos del cliente, para el resumen diario
-- ---------------------------------------------------------------------
create table if not exists public.eventos_cliente (
  id                  uuid primary key default gen_random_uuid(),
  organizacion_id     uuid not null references public.organizaciones (id) on delete cascade,
  tipo                text not null check (tipo in ('onboarding', 'reagendamiento', 'caso', 'conflicto', 'firma', 'cuota')),
  fecha               timestamptz not null,
  titulo              text not null check (length(trim(titulo)) between 1 and 200),
  detalle             text,
  cliente_id          uuid,
  asunto_id           uuid,
  -- Integrante del equipo del cliente que tiene que enterarse.
  responsable_id      uuid,
  avisar_responsable  boolean not null default false,
  avisado_en          timestamptz,
  origen              text not null default 'portal' check (origen in ('portal', 'tina', 'sistema')),
  creado_por          uuid references auth.users (id) on delete set null,
  creado_en           timestamptz not null default now(),
  foreign key (organizacion_id, cliente_id) references public.crm_clientes (organizacion_id, id) on delete cascade,
  foreign key (organizacion_id, asunto_id) references public.asuntos (organizacion_id, id) on delete cascade,
  foreign key (organizacion_id, responsable_id) references public.equipo_miembros (organizacion_id, id) on delete set null (responsable_id)
);
create index if not exists eventos_cliente_dia on public.eventos_cliente (organizacion_id, fecha);
create index if not exists eventos_cliente_por_avisar on public.eventos_cliente (avisado_en) where avisar_responsable and avisado_en is null;

-- Los casos y conflictos los ve quien ve los asuntos (sin closer ni setter).
-- El resto, quien usa el CRM.
create or replace function public.evento_visible(org uuid, tipo text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when tipo in ('caso', 'conflicto') then public.puede_ver_casos(org) else public.puede_ver_org(org) end;
$$;
revoke all on function public.evento_visible(uuid, text) from public, anon;
grant execute on function public.evento_visible(uuid, text) to authenticated;

create or replace function public.eventos_cliente_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.creado_por := auth.uid();
      new.origen := 'portal';
    end if;
    new.avisado_en := null;
  elsif auth.uid() is not null and not es_admin() then
    if new.organizacion_id is distinct from old.organizacion_id
       or new.creado_por is distinct from old.creado_por
       or new.origen is distinct from old.origen
       or new.avisado_en is distinct from old.avisado_en then
      raise exception 'Esos datos del evento no se cambian.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.eventos_cliente_antes() from public, anon, authenticated;

drop trigger if exists eventos_cliente_antes on public.eventos_cliente;
create trigger eventos_cliente_antes before insert or update on public.eventos_cliente
  for each row execute function public.eventos_cliente_antes();

alter table public.eventos_cliente enable row level security;

drop policy if exists eventos_cliente_lectura on public.eventos_cliente;
create policy eventos_cliente_lectura on public.eventos_cliente for select to authenticated
  using (public.evento_visible(organizacion_id, tipo));

drop policy if exists eventos_cliente_alta on public.eventos_cliente;
create policy eventos_cliente_alta on public.eventos_cliente for insert to authenticated
  with check (public.evento_visible(organizacion_id, tipo));

-- Edita y borra quien lo cargó, el titular y FIRMA.
drop policy if exists eventos_cliente_edicion on public.eventos_cliente;
create policy eventos_cliente_edicion on public.eventos_cliente for update to authenticated
  using (public.evento_visible(organizacion_id, tipo) and (creado_por = auth.uid() or public.puede_gestionar_org(organizacion_id)))
  with check (public.evento_visible(organizacion_id, tipo));

drop policy if exists eventos_cliente_baja on public.eventos_cliente;
create policy eventos_cliente_baja on public.eventos_cliente for delete to authenticated
  using (public.evento_visible(organizacion_id, tipo) and (creado_por = auth.uid() or public.puede_gestionar_org(organizacion_id)));

revoke all on public.eventos_cliente from anon;
grant select, insert, update, delete on public.eventos_cliente to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Recursos para Tina: la biblioteca de documentos con tres datos más.
-- Quién ve cada documento en el portal no cambia. tina_plan_minimo
-- decide qué puede usar Tina con cada plan, y lo aplica el servidor.
-- tina_texto es el texto que Tina lee, extraído del archivo por el
-- servidor o cargado a mano.
-- ---------------------------------------------------------------------
alter table public.documentos add column if not exists tina_usa boolean not null default false;
alter table public.documentos add column if not exists tina_tipo text
  check (tina_tipo is null or tina_tipo in ('sop', 'mensaje_modelo', 'video', 'clausula', 'guia', 'contexto'));
alter table public.documentos add column if not exists tina_plan_minimo text not null default 'starter'
  check (tina_plan_minimo in ('starter', 'eminent'));
alter table public.documentos add column if not exists tina_texto text;

-- ---------------------------------------------------------------------
-- Suscripciones a notificaciones push
-- ---------------------------------------------------------------------
create table if not exists public.push_suscripciones (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  endpoint      text not null unique check (endpoint ~ '^https://'),
  p256dh        text not null,
  auth          text not null,
  dispositivo   text,
  creado_en     timestamptz not null default now(),
  ultimo_envio  timestamptz,
  activa        boolean not null default true
);
create index if not exists push_suscripciones_usuario on public.push_suscripciones (usuario_id) where activa;

alter table public.push_suscripciones enable row level security;

-- Cada persona administra solo las suyas.
drop policy if exists push_suscripciones_propias on public.push_suscripciones;
create policy push_suscripciones_propias on public.push_suscripciones for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

revoke all on public.push_suscripciones from anon, authenticated;
grant select, insert, update, delete on public.push_suscripciones to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Clientes del CRM cargados por Tina
-- ---------------------------------------------------------------------
alter table public.crm_clientes add column if not exists origen text not null default 'portal'
  check (origen in ('portal', 'tina', 'importacion'));

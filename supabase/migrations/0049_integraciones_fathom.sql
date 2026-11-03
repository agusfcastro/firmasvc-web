-- =====================================================================
-- FIRMA · Portal · Fathom por integrante del equipo
-- En Fathom las claves y los webhooks son de cada usuario y el aviso no
-- dice de qué usuario es. Por eso hay una URL por integrante del equipo
-- que graba llamadas: lo que llega a esa URL es una llamada que grabó él.
--   URL        /api/webhooks/fathom/<token>. El token lo genera la base y
--              se muestra una sola vez; acá queda solo su hash.
--   Secreto    el que da Fathom al crear el webhook (whsec_…). Lo pega el
--              titular y va a Supabase Vault. Nadie lo lee desde el portal.
--   Estados    pendiente (falta el secreto), activa, pausada.
--   Recepción  webhook_recepciones guarda el id de cada aviso, sin el
--              cuerpo, para que un aviso repetido no entre dos veces.
-- Quién conecta. El titular (o FIRMA) administra todas. Cada integrante
-- con cuenta en el portal conecta la suya: su cuenta se vincula a su
-- ficha del equipo por el mail. Quien no tiene cuenta recibe un enlace de
-- conexión del titular (/conectar-fathom/<enlace>): vale 7 días, muestra
-- su URL y recibe su secreto, sin entrar al portal.
-- Hace falta la funcionalidad fathom del plan. El CSM ve todas; cada
-- integrante, la suya. Cada cambio queda en la bitácora del negocio.
-- =====================================================================

create table if not exists public.integraciones (
  id                 uuid primary key default gen_random_uuid(),
  organizacion_id    uuid not null references public.organizaciones (id) on delete cascade,
  proveedor          text not null check (proveedor in ('fathom')),
  equipo_miembro_id  uuid not null,
  estado             text not null default 'pendiente' check (estado in ('pendiente', 'activa', 'pausada')),
  token_hash         text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  secreto_vault_id   uuid,
  invitacion_hash    text unique check (invitacion_hash ~ '^[0-9a-f]{64}$'),
  invitacion_vence   timestamptz,
  ultima_recepcion   timestamptz,
  recepciones        integer not null default 0,
  creado_por         uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  unique (organizacion_id, id),
  unique (organizacion_id, proveedor, equipo_miembro_id),
  constraint integraciones_miembro_fk foreign key (organizacion_id, equipo_miembro_id)
    references public.equipo_miembros (organizacion_id, id) on delete cascade,
  constraint integraciones_activa_con_secreto check (estado = 'pendiente' or secreto_vault_id is not null)
);

create table if not exists public.webhook_recepciones (
  id               bigint generated always as identity primary key,
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  integracion_id   uuid not null,
  externo_id       text not null check (length(externo_id) between 1 and 200),
  estado           text not null default 'aceptada' check (estado in ('aceptada', 'ignorada')),
  recibido_en      timestamptz not null default now(),
  unique (integracion_id, externo_id),
  constraint webhook_recepciones_integracion_fk foreign key (organizacion_id, integracion_id)
    references public.integraciones (organizacion_id, id) on delete cascade
);

create index if not exists webhook_recepciones_fecha_idx on public.webhook_recepciones (recibido_en);

-- Hash del token de la URL.
create or replace function public.integracion_hash(token text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(digest(coalesce(token, ''), 'sha256'), 'hex');
$$;

create or replace function public.integracion_registrar(i public.integraciones, movimiento text)
returns void language sql security definer set search_path = public as $$
  insert into registro_accesos (usuario_id, actor_id, accion, organizacion_id, objeto_tipo, objeto_id, detalle)
  values (auth.uid(), auth.uid(), movimiento, i.organizacion_id, 'integracion', i.id::text,
          jsonb_build_object('organizacion_id', i.organizacion_id, 'proveedor', i.proveedor,
                             'equipo_miembro_id', i.equipo_miembro_id,
                             'integrante', (select e.nombre from equipo_miembros e where e.id = i.equipo_miembro_id)));
$$;

-- El titular (o FIRMA) conecta a cualquiera del negocio; cada integrante, a sí mismo.
create or replace function public.puede_conectar(org uuid, miembro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.puede_gestionar_org(org)
      or (org = public.mi_organizacion()
          and exists (select 1 from equipo_miembros e where e.id = miembro and e.organizacion_id = org and e.usuario_id = auth.uid()));
$$;

-- ---------------------------------------------------------------------
-- equipo_vincular_mi_cuenta(): la ficha del equipo de quien llama en su
-- negocio activo. Si la ficha todavía no tiene cuenta y su mail es el de
-- la persona, la vincula. null si no está en el equipo.
-- ---------------------------------------------------------------------
create or replace function public.equipo_vincular_mi_cuenta()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  org uuid := mi_organizacion();
  mail text := (select lower(p.email) from perfiles p where p.id = auth.uid());
  miembro uuid;
begin
  if org is null then
    return null;
  end if;
  select e.id into miembro from equipo_miembros e
  where e.organizacion_id = org and e.activo and e.usuario_id = auth.uid() limit 1;
  if miembro is null and mail is not null then
    update equipo_miembros e set usuario_id = auth.uid()
    where e.id = (select x.id from equipo_miembros x
                  where x.organizacion_id = org and x.activo and x.usuario_id is null and x.email = mail limit 1)
    returning e.id into miembro;
  end if;
  return miembro;
end;
$$;

-- Integración que el usuario puede administrar, bloqueada para editarla.
create or replace function public.integracion_para_gestionar(p_id uuid)
returns public.integraciones language plpgsql security definer set search_path = public as $$
declare
  i integraciones%rowtype;
begin
  select * into i from integraciones where id = p_id for update;
  if not found or not puede_conectar(i.organizacion_id, i.equipo_miembro_id) then
    raise exception 'No existe esa integración o no tenés acceso.' using errcode = '42501';
  end if;
  return i;
end;
$$;

-- ---------------------------------------------------------------------
-- integracion_fathom_conectar(integrante): genera la URL del integrante y
-- devuelve el token (la única vez que se ve). Si ya tenía una, la
-- reemplaza: la URL vieja deja de andar y hay que pegar el secreto nuevo.
-- ---------------------------------------------------------------------
create or replace function public.integracion_fathom_conectar(p_integrante uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  m equipo_miembros%rowtype;
  i integraciones%rowtype;
  token text := encode(gen_random_bytes(24), 'hex');
begin
  select * into m from equipo_miembros where id = p_integrante;
  if not found or not puede_conectar(m.organizacion_id, m.id) then
    raise exception 'No existe esa persona del equipo o no tenés acceso.' using errcode = '42501';
  end if;
  if not tiene_funcionalidad(m.organizacion_id, 'fathom') then
    raise exception 'El plan del negocio no incluye Fathom.' using errcode = '42501';
  end if;
  if not m.activo then
    raise exception 'Esa persona está inactiva en el equipo.';
  end if;

  select * into i from integraciones
  where organizacion_id = m.organizacion_id and proveedor = 'fathom' and equipo_miembro_id = m.id for update;
  if found then
    delete from vault.secrets where id = i.secreto_vault_id;
    update integraciones set token_hash = integracion_hash(token), secreto_vault_id = null, estado = 'pendiente',
      invitacion_hash = null, invitacion_vence = null, actualizado_en = now()
    where id = i.id returning * into i;
    perform integracion_registrar(i, 'integracion_url_nueva');
  else
    insert into integraciones (organizacion_id, proveedor, equipo_miembro_id, token_hash)
    values (m.organizacion_id, 'fathom', m.id, integracion_hash(token)) returning * into i;
    perform integracion_registrar(i, 'integracion_creada');
  end if;
  return token;
end;
$$;

-- El secreto de firma que da Fathom. Activa la integración.
create or replace function public.integracion_guardar_secreto(p_integracion uuid, p_secreto text)
returns void language plpgsql security definer set search_path = public as $$
declare
  i integraciones%rowtype := integracion_para_gestionar(p_integracion);
  s text := trim(coalesce(p_secreto, ''));
begin
  if s !~ '^whsec_[A-Za-z0-9+/=_-]{16,200}$' then
    raise exception 'El secreto de Fathom empieza con whsec_. Copialo entero desde la configuración del webhook.';
  end if;
  if i.secreto_vault_id is null then
    i.secreto_vault_id := vault.create_secret(s, 'integracion_' || i.id, 'Secreto de firma del webhook de Fathom');
  else
    perform vault.update_secret(i.secreto_vault_id, s);
  end if;
  update integraciones set secreto_vault_id = i.secreto_vault_id,
    estado = case when estado = 'pendiente' then 'activa' else estado end, actualizado_en = now()
  where id = i.id returning * into i;
  perform integracion_registrar(i, 'integracion_secreto');
end;
$$;

-- Pausar deja de aceptar llamadas sin perder la URL ni el secreto.
create or replace function public.integracion_pausar(p_integracion uuid, p_pausar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  i integraciones%rowtype := integracion_para_gestionar(p_integracion);
begin
  if i.estado = 'pendiente' then
    raise exception 'Primero pegá el secreto de Fathom.';
  end if;
  update integraciones set estado = case when p_pausar then 'pausada' else 'activa' end, actualizado_en = now()
  where id = i.id returning * into i;
  perform integracion_registrar(i, case when p_pausar then 'integracion_pausada' else 'integracion_reanudada' end);
end;
$$;

-- Quitar borra la URL y el secreto. Las llamadas que ya llegaron quedan.
create or replace function public.integracion_quitar(p_integracion uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  i integraciones%rowtype := integracion_para_gestionar(p_integracion);
begin
  perform integracion_registrar(i, 'integracion_quitada');
  delete from vault.secrets where id = i.secreto_vault_id;
  delete from integraciones where id = i.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Enlace de conexión, para quien no tiene cuenta en el portal.
-- integracion_fathom_invitar(integrante): el titular lo genera y lo
-- manda; se ve una sola vez y vale 7 días. Generar otro anula el anterior.
-- La URL del webhook sale del enlace (HMAC), así abrir el enlace dos veces
-- muestra la misma URL sin guardarla en ningún lado.
-- ---------------------------------------------------------------------
create or replace function public.integracion_url_de_invitacion(p_invitacion text)
returns text language sql immutable set search_path = public, extensions as $$
  select left(encode(hmac(coalesce(p_invitacion, ''), 'url-fathom', 'sha256'), 'hex'), 48);
$$;

create or replace function public.integracion_fathom_invitar(p_integrante uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  m equipo_miembros%rowtype;
  i integraciones%rowtype;
  invitacion text := encode(gen_random_bytes(24), 'hex');
begin
  select * into m from equipo_miembros where id = p_integrante;
  if not found or not puede_gestionar_org(m.organizacion_id) then
    raise exception 'No existe esa persona del equipo o no tenés acceso.' using errcode = '42501';
  end if;
  if not tiene_funcionalidad(m.organizacion_id, 'fathom') then
    raise exception 'El plan del negocio no incluye Fathom.' using errcode = '42501';
  end if;
  if not m.activo then
    raise exception 'Esa persona está inactiva en el equipo.';
  end if;

  select * into i from integraciones
  where organizacion_id = m.organizacion_id and proveedor = 'fathom' and equipo_miembro_id = m.id for update;
  if found then
    -- La URL nueva la define el enlace; la anterior deja de andar.
    delete from vault.secrets where id = i.secreto_vault_id;
    update integraciones set token_hash = integracion_hash(integracion_url_de_invitacion(invitacion)), secreto_vault_id = null, estado = 'pendiente',
      invitacion_hash = integracion_hash(invitacion), invitacion_vence = now() + interval '7 days', actualizado_en = now()
    where id = i.id returning * into i;
  else
    insert into integraciones (organizacion_id, proveedor, equipo_miembro_id, token_hash, invitacion_hash, invitacion_vence)
    values (m.organizacion_id, 'fathom', m.id, integracion_hash(integracion_url_de_invitacion(invitacion)),
            integracion_hash(invitacion), now() + interval '7 days')
    returning * into i;
  end if;
  perform integracion_registrar(i, 'integracion_invitacion');
  return invitacion;
end;
$$;

-- Enlace vigente, bloqueado. Sin enlace válido o sin el plan, error genérico.
create or replace function public.integracion_por_invitacion(p_invitacion text)
returns public.integraciones language plpgsql security definer set search_path = public as $$
declare
  i integraciones%rowtype;
begin
  select * into i from integraciones
  where invitacion_hash = integracion_hash(p_invitacion) and invitacion_vence > now() for update;
  if not found or not tiene_funcionalidad(i.organizacion_id, i.proveedor) then
    raise exception 'El enlace no es válido o venció. Pedile uno nuevo a quien te lo mandó.' using errcode = '42501';
  end if;
  return i;
end;
$$;

-- Lo que muestra la página del enlace: a quién conecta, de qué negocio y la URL.
create or replace function public.integracion_invitacion_abrir(p_invitacion text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i integraciones%rowtype := integracion_por_invitacion(p_invitacion);
begin
  return jsonb_build_object(
    'integrante', (select e.nombre from equipo_miembros e where e.id = i.equipo_miembro_id),
    'negocio', (select o.nombre from organizaciones o where o.id = i.organizacion_id),
    'token', integracion_url_de_invitacion(p_invitacion),
    'vence_en', i.invitacion_vence);
end;
$$;

-- Guarda el secreto, activa la integración y da el enlace por usado.
create or replace function public.integracion_invitacion_secreto(p_invitacion text, p_secreto text)
returns void language plpgsql security definer set search_path = public as $$
declare
  i integraciones%rowtype := integracion_por_invitacion(p_invitacion);
  s text := trim(coalesce(p_secreto, ''));
begin
  if s !~ '^whsec_[A-Za-z0-9+/=_-]{16,200}$' then
    raise exception 'El secreto de Fathom empieza con whsec_. Copialo entero desde la configuración del webhook.';
  end if;
  i.secreto_vault_id := vault.create_secret(s, 'integracion_' || i.id, 'Secreto de firma del webhook de Fathom');
  update integraciones set secreto_vault_id = i.secreto_vault_id, estado = 'activa',
    invitacion_hash = null, invitacion_vence = null, actualizado_en = now()
  where id = i.id returning * into i;
  perform integracion_registrar(i, 'integracion_secreto_por_enlace');
end;
$$;

-- ---------------------------------------------------------------------
-- Para el webhook (service_role): la integración de un token, con el
-- secreto y si el plan la sigue incluyendo.
-- ---------------------------------------------------------------------
create or replace function public.integracion_por_token(p_token text)
returns table (id uuid, organizacion_id uuid, equipo_miembro_id uuid, estado text, secreto text, habilitada boolean)
language sql stable security definer set search_path = public as $$
  select i.id, i.organizacion_id, i.equipo_miembro_id, i.estado,
         (select s.decrypted_secret from vault.decrypted_secrets s where s.id = i.secreto_vault_id),
         tiene_funcionalidad(i.organizacion_id, i.proveedor)
  from integraciones i
  where i.token_hash = integracion_hash(p_token);
$$;

-- ---------------------------------------------------------------------
-- Seguridad. Titular, CSM y FIRMA ven las integraciones; cada integrante,
-- la suya. Nadie ve los hashes ni el id del secreto. Se cambian solo con las funciones de arriba.
-- Las recepciones son del servidor; FIRMA las lee.
-- ---------------------------------------------------------------------
alter table public.integraciones enable row level security;
alter table public.webhook_recepciones enable row level security;

drop policy if exists integraciones_lectura on public.integraciones;
create policy integraciones_lectura on public.integraciones for select to authenticated
  using (public.puede_ver_casos(organizacion_id) or public.puede_conectar(organizacion_id, equipo_miembro_id));

drop policy if exists webhook_recepciones_staff on public.webhook_recepciones;
create policy webhook_recepciones_staff on public.webhook_recepciones for select to authenticated using (public.es_staff());

revoke all on public.integraciones, public.webhook_recepciones from anon, authenticated;
grant select (id, organizacion_id, proveedor, equipo_miembro_id, estado, invitacion_vence, ultima_recepcion, recepciones, creado_por, creado_en, actualizado_en)
  on public.integraciones to authenticated;
grant select on public.webhook_recepciones to authenticated;

revoke all on function public.integracion_hash(text), public.integracion_registrar(public.integraciones, text),
  public.integracion_para_gestionar(uuid), public.integracion_por_token(text), public.integracion_url_de_invitacion(text),
  public.integracion_por_invitacion(text) from public, anon, authenticated;
grant execute on function public.integracion_por_token(text) to service_role;
revoke all on function public.integracion_fathom_conectar(uuid), public.integracion_guardar_secreto(uuid, text),
  public.integracion_pausar(uuid, boolean), public.integracion_quitar(uuid), public.integracion_fathom_invitar(uuid),
  public.puede_conectar(uuid, uuid), public.equipo_vincular_mi_cuenta() from public, anon;
grant execute on function public.integracion_fathom_conectar(uuid), public.integracion_guardar_secreto(uuid, text),
  public.integracion_pausar(uuid, boolean), public.integracion_quitar(uuid), public.integracion_fathom_invitar(uuid),
  public.puede_conectar(uuid, uuid), public.equipo_vincular_mi_cuenta() to authenticated;
-- La página del enlace es pública: la protege el enlace mismo (192 bits, 7 días).
revoke all on function public.integracion_invitacion_abrir(text), public.integracion_invitacion_secreto(text, text) from public;
grant execute on function public.integracion_invitacion_abrir(text), public.integracion_invitacion_secreto(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

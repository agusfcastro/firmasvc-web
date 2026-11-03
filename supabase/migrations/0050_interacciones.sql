-- =====================================================================
-- FIRMA · Portal · Interacciones (llamadas de Fathom) y barrido de la cola
-- Una llamada es una interacción. Llega por el webhook del integrante que
-- la grabó y entra con interaccion_registrar(), que en un solo paso:
--   · anota la recepción (un aviso repetido no entra dos veces),
--   · guarda la llamada con el contenido cifrado,
--   · encola interaccion_vincular.
-- interaccion_vincular() cruza los mails de la llamada con el equipo y con
-- los clientes del CRM. Si un solo cliente coincide, la llamada queda a su
-- nombre; si no, se asigna a mano con interaccion_asignar().
--   Contenido  transcripción, invitados (con su mail) y enlace a Fathom, en
--              JSON cifrado con una clave de Vault. Se conserva 90 días
--              (retener_contenido_hasta); la purga llega con la etapa de
--              retención. Fuera del contenido no queda ningún mail.
--   Lectura    titular y CSM ven todas las del negocio; closer y setter,
--              las que grabaron o en las que participaron. Nadie lee el
--              contenido desde el portal.
-- El barrido: cada minuto pg_cron llama a /api/cola/procesar si hay
-- trabajos esperando. Necesita pg_cron, pg_net y dos secretos de Vault
-- (cola_url y cola_secreto). Sin ellos la cola se procesa igual en
-- caliente desde el webhook; solo no hay reintentos automáticos.
-- =====================================================================

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'interacciones_contenido') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'interacciones_contenido', 'Cifrado del contenido de las interacciones');
  end if;
end $$;

create table if not exists public.interacciones (
  id                       uuid primary key default gen_random_uuid(),
  organizacion_id          uuid not null references public.organizaciones (id) on delete cascade,
  integracion_id           uuid,
  cliente_id               uuid,
  equipo_miembro_id        uuid,
  canal                    text not null default 'llamada' check (canal in ('llamada', 'whatsapp', 'email')),
  fuente                   text not null check (fuente in ('fathom', 'whatsapp_cloud', 'manual')),
  externo_id               text not null check (length(externo_id) between 1 and 200),
  titulo                   text check (length(titulo) <= 300),
  ocurrida_en              timestamptz not null,
  duracion_seg             integer check (duracion_seg >= 0),
  participantes            jsonb not null default '{}'::jsonb,
  etapa_comercial          text check (etapa_comercial in ('venta', 'onboarding', 'seguimiento', 'soporte')),
  contenido_cifrado        bytea,
  contenido_sha256         text,
  retener_contenido_hasta  timestamptz,
  estado                   text not null default 'recibida' check (estado in ('recibida', 'vinculada', 'clasificada', 'analizada', 'purgada')),
  asignado_por             uuid references auth.users (id) on delete set null,
  asignado_en              timestamptz,
  creado_en                timestamptz not null default now(),
  actualizado_en           timestamptz not null default now(),
  unique (organizacion_id, id),
  unique (organizacion_id, fuente, externo_id),
  constraint interacciones_integracion_fk foreign key (organizacion_id, integracion_id)
    references public.integraciones (organizacion_id, id) on delete set null (integracion_id),
  constraint interacciones_cliente_fk foreign key (organizacion_id, cliente_id)
    references public.crm_clientes (organizacion_id, id) on delete set null (cliente_id),
  constraint interacciones_miembro_fk foreign key (organizacion_id, equipo_miembro_id)
    references public.equipo_miembros (organizacion_id, id) on delete set null (equipo_miembro_id)
);

create index if not exists interacciones_org_fecha_idx on public.interacciones (organizacion_id, ocurrida_en desc);
create index if not exists interacciones_cliente_idx on public.interacciones (organizacion_id, cliente_id, ocurrida_en desc) where cliente_id is not null;
create index if not exists interacciones_sin_cliente_idx on public.interacciones (organizacion_id, ocurrida_en desc) where cliente_id is null;

-- Ni el negocio ni el contenido cambian después del alta.
create or replace function public.interacciones_antes()
returns trigger language plpgsql as $$
begin
  if new.organizacion_id is distinct from old.organizacion_id
     or new.contenido_sha256 is distinct from old.contenido_sha256
     or (new.contenido_cifrado is distinct from old.contenido_cifrado and new.contenido_cifrado is not null) then
    raise exception 'El negocio y el contenido de una interacción no cambian.';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists interacciones_antes on public.interacciones;
create trigger interacciones_antes before update on public.interacciones
  for each row execute function public.interacciones_antes();

-- ---------------------------------------------------------------------
-- interaccion_registrar(): el alta desde el webhook (service_role).
-- Devuelve {duplicada}, {ignorada} o {interaccion_id, trabajo_id}.
-- ---------------------------------------------------------------------
create or replace function public.interaccion_registrar(
  p_integracion uuid, p_aviso_id text, p_externo_id text, p_titulo text,
  p_ocurrida_en timestamptz, p_duracion_seg integer, p_contenido jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  i integraciones%rowtype;
  recepcion bigint;
  nueva uuid;
  trabajo bigint;
  texto text := coalesce(p_contenido, '{}'::jsonb)::text;
begin
  select * into i from integraciones where id = p_integracion;
  if not found then
    raise exception 'No existe esa integración.';
  end if;

  insert into webhook_recepciones (organizacion_id, integracion_id, externo_id)
  values (i.organizacion_id, i.id, left(p_aviso_id, 200))
  on conflict (integracion_id, externo_id) do nothing
  returning id into recepcion;
  if recepcion is null then
    return jsonb_build_object('duplicada', true);
  end if;
  update integraciones set ultima_recepcion = now(), recepciones = recepciones + 1 where id = i.id;

  if i.estado <> 'activa' or not tiene_funcionalidad(i.organizacion_id, i.proveedor) then
    update webhook_recepciones set estado = 'ignorada' where id = recepcion;
    return jsonb_build_object('ignorada', true);
  end if;

  insert into interacciones (organizacion_id, integracion_id, equipo_miembro_id, fuente, externo_id, titulo,
                             ocurrida_en, duracion_seg, participantes, contenido_cifrado, contenido_sha256, retener_contenido_hasta)
  values (i.organizacion_id, i.id, i.equipo_miembro_id, i.proveedor, left(p_externo_id, 200), left(nullif(trim(p_titulo), ''), 300),
          coalesce(p_ocurrida_en, now()), p_duracion_seg, jsonb_build_object('equipo', jsonb_build_array(i.equipo_miembro_id)),
          pgp_sym_encrypt(texto, crm_clave('interacciones_contenido'), 'cipher-algo=aes256'),
          encode(digest(texto, 'sha256'), 'hex'), now() + interval '90 days')
  on conflict (organizacion_id, fuente, externo_id) do nothing
  returning id into nueva;
  if nueva is null then
    return jsonb_build_object('duplicada', true);
  end if;

  trabajo := cola_encolar('interaccion_vincular', i.organizacion_id, jsonb_build_object('interaccion_id', nueva), 'interaccion_vincular:' || nueva);
  return jsonb_build_object('interaccion_id', nueva, 'trabajo_id', trabajo);
end;
$$;

-- ---------------------------------------------------------------------
-- interaccion_vincular(): trabajo de la cola (service_role). Cruza los
-- mails del contenido con el equipo y los clientes del negocio.
-- participantes queda como {equipo: [ids], clientes: [ids], externos: n}.
-- Una asignación hecha a mano no se pisa.
-- ---------------------------------------------------------------------
create or replace function public.interaccion_vincular(p_interaccion uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  x interacciones%rowtype;
  c jsonb;
  mails text[];
  equipo uuid[];
  clientes uuid[];
  externos integer;
begin
  select * into x from interacciones where id = p_interaccion for update;
  if not found then
    raise exception 'No existe esa interacción.';
  end if;
  if x.contenido_cifrado is null then
    return jsonb_build_object('sin_contenido', true);
  end if;
  c := pgp_sym_decrypt(x.contenido_cifrado, crm_clave('interacciones_contenido'))::jsonb;

  select coalesce(array_agg(distinct m), '{}') into mails from (
    select lower(trim(v ->> 'email')) as m from jsonb_array_elements(coalesce(c -> 'invitados', '[]'::jsonb)) v
    union select lower(trim(c -> 'grabado_por' ->> 'email'))
    union select lower(trim(v ->> 'email')) from jsonb_array_elements(coalesce(c -> 'transcripcion', '[]'::jsonb)) v
  ) t where m ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  select coalesce(array_agg(distinct e.id), '{}') into equipo from equipo_miembros e
  where e.organizacion_id = x.organizacion_id and (lower(e.email) = any (mails) or e.id = x.equipo_miembro_id);

  select coalesce(array_agg(distinct k.id), '{}') into clientes from crm_clientes k
  where k.organizacion_id = x.organizacion_id and lower(trim(k.email)) = any (mails);

  select count(*) into externos from unnest(mails) m
  where not exists (select 1 from equipo_miembros e where e.organizacion_id = x.organizacion_id and lower(e.email) = m)
    and not exists (select 1 from crm_clientes k where k.organizacion_id = x.organizacion_id and lower(trim(k.email)) = m);

  update interacciones set
    participantes = jsonb_build_object('equipo', to_jsonb(equipo), 'clientes', to_jsonb(clientes), 'externos', externos),
    cliente_id = case when x.asignado_en is null and cardinality(clientes) = 1 then clientes[1] else cliente_id end,
    estado = case when estado = 'recibida' then 'vinculada' else estado end
  where id = x.id
  returning * into x;

  return jsonb_build_object('cliente_id', x.cliente_id, 'equipo', cardinality(equipo), 'clientes', cardinality(clientes), 'externos', externos);
end;
$$;

-- ---------------------------------------------------------------------
-- Quién ve una interacción. Titular, CSM y FIRMA, todas. Closer y setter,
-- las que grabaron o en las que aparecen como equipo (por su cuenta
-- vinculada en equipo_miembros.usuario_id).
-- ---------------------------------------------------------------------
create or replace function public.interaccion_visible(org uuid, miembro uuid, participantes jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select public.puede_ver_casos(org)
      or (org = public.mi_organizacion() and public.mi_rol() in ('closer', 'setter')
          and exists (select 1 from equipo_miembros e
                      where e.organizacion_id = org and e.usuario_id = auth.uid()
                        and (e.id = miembro or coalesce(participantes -> 'equipo', '[]'::jsonb) ? e.id::text)));
$$;

-- Asignar (o quitar, con null) el cliente de una llamada. Titular, CSM y FIRMA.
create or replace function public.interaccion_asignar(p_interaccion uuid, p_cliente uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  x interacciones%rowtype;
begin
  select * into x from interacciones where id = p_interaccion for update;
  if not found or not puede_ver_casos(x.organizacion_id) then
    raise exception 'No existe esa llamada o no tenés acceso.' using errcode = '42501';
  end if;
  if p_cliente is not null and not exists (select 1 from crm_clientes k where k.id = p_cliente and k.organizacion_id = x.organizacion_id) then
    raise exception 'Ese cliente no es de este negocio.';
  end if;
  update interacciones set cliente_id = p_cliente, asignado_por = auth.uid(), asignado_en = now() where id = x.id;

  insert into registro_accesos (usuario_id, actor_id, accion, organizacion_id, objeto_tipo, objeto_id, detalle)
  values (auth.uid(), auth.uid(), 'interaccion_asignada', x.organizacion_id, 'interaccion', x.id::text,
          jsonb_build_object('organizacion_id', x.organizacion_id, 'cliente_id', p_cliente, 'anterior', x.cliente_id));
end;
$$;

-- ---------------------------------------------------------------------
-- Barrido (pg_cron, cada minuto). Limpia lo viejo y, si hay trabajos
-- esperando, despierta a /api/cola/procesar por pg_net.
-- ---------------------------------------------------------------------
create or replace function public.cola_barrer()
returns void language plpgsql security definer set search_path = public as $$
declare
  url text := crm_clave('cola_url');
  secreto text := crm_clave('cola_secreto');
begin
  delete from cola_trabajos where estado = 'hecho' and terminado_en < now() - interval '30 days';
  delete from cola_trabajos where estado = 'fallido' and terminado_en < now() - interval '90 days';
  delete from webhook_recepciones where recibido_en < now() - interval '30 days';

  if url is null or secreto is null then
    return;
  end if;
  if not exists (select 1 from cola_trabajos
                 where (estado = 'pendiente' and disponible_en <= now()) or (estado = 'tomado' and tomado_hasta < now())) then
    return;
  end if;
  perform net.http_post(
    url := rtrim(url, '/') || '/api/cola/procesar',
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || secreto),
    timeout_milliseconds := 5000);
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('cola_barrer', '* * * * *', 'select public.cola_barrer()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Seguridad. El portal lee la metadata (nunca contenido_cifrado) y solo
-- cambia el cliente, con interaccion_asignar(). El resto lo escribe el
-- servidor.
-- ---------------------------------------------------------------------
alter table public.interacciones enable row level security;

drop policy if exists interacciones_lectura on public.interacciones;
create policy interacciones_lectura on public.interacciones for select to authenticated
  using (public.interaccion_visible(organizacion_id, equipo_miembro_id, participantes));

revoke all on public.interacciones from anon, authenticated;
grant select (id, organizacion_id, integracion_id, cliente_id, equipo_miembro_id, canal, fuente, externo_id, titulo, ocurrida_en,
              duracion_seg, participantes, etapa_comercial, retener_contenido_hasta, estado, asignado_por, asignado_en, creado_en, actualizado_en)
  on public.interacciones to authenticated;

revoke all on function public.interaccion_registrar(uuid, text, text, text, timestamptz, integer, jsonb),
  public.interaccion_vincular(uuid), public.cola_barrer() from public, anon, authenticated;
grant execute on function public.interaccion_registrar(uuid, text, text, text, timestamptz, integer, jsonb),
  public.interaccion_vincular(uuid) to service_role;
revoke all on function public.interaccion_visible(uuid, uuid, jsonb), public.interaccion_asignar(uuid, uuid) from public, anon;
grant execute on function public.interaccion_visible(uuid, uuid, jsonb), public.interaccion_asignar(uuid, uuid) to authenticated;
revoke all on function public.interacciones_antes() from public, anon, authenticated;

notify pgrst, 'reload schema';

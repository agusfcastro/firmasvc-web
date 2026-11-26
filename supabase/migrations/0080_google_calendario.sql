-- =====================================================================
-- FIRMA · Portal · Conexión con Google Calendar
--   Cada persona del equipo conecta su propio Google Calendar, una vez por
--   negocio, porque puede usar una cuenta distinta en cada uno. El token de
--   actualización queda cifrado con una clave de Vault y solo lo lee el
--   servidor. Con eso el calendario del equipo muestra la agenda de cada
--   uno y, al agendar desde el portal, se crea el evento con link de Meet.
--   Permiso que se pide a Google: calendar.events.owned (ver, crear,
--   modificar y borrar eventos de los calendarios propios).
-- =====================================================================

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'google_tokens') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'google_tokens', 'Cifrado de los tokens de Google Calendar');
  end if;
end $$;

create table if not exists public.google_conexiones (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  miembro_id       uuid not null,
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  email            text not null check (length(email) between 3 and 320),
  refresh_cifrado  bytea,
  alcance          text check (alcance is null or length(alcance) <= 1000),
  estado           text not null default 'activa' check (estado in ('activa', 'revocada', 'error')),
  error            text check (error is null or length(error) <= 500),
  conectado_en     timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (organizacion_id, miembro_id),
  foreign key (organizacion_id, miembro_id) references public.equipo_miembros (organizacion_id, id) on delete cascade
);

-- Quién está conectado lo ve la persona, quien ve el CRM y quien lidera el equipo. El token, nadie desde el portal.
alter table public.google_conexiones enable row level security;
drop policy if exists google_conexiones_lectura on public.google_conexiones;
create policy google_conexiones_lectura on public.google_conexiones for select to authenticated
  using (usuario_id = auth.uid() or public.puede_ver_org(organizacion_id) or public.lidera_equipo(organizacion_id));
revoke all on public.google_conexiones from anon, authenticated;
grant select (id, organizacion_id, miembro_id, usuario_id, email, alcance, estado, error, conectado_en, actualizado_en) on public.google_conexiones to authenticated;

-- Alta o renovación de una conexión. Solo el servidor, después de que Google devuelve el permiso.
create or replace function public.google_conexion_guardar(p_org uuid, p_miembro uuid, p_usuario uuid, p_email text, p_refresh text, p_alcance text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v uuid;
begin
  -- Conecta la persona del equipo dueña de la cuenta del portal, nadie por otro.
  if not exists (select 1 from equipo_miembros e where e.id = p_miembro and e.organizacion_id = p_org and e.usuario_id = p_usuario) then
    raise exception 'Esa persona del equipo no es la cuenta que conecta.';
  end if;
  insert into google_conexiones (organizacion_id, miembro_id, usuario_id, email, refresh_cifrado, alcance, estado, error, conectado_en, actualizado_en)
  values (p_org, p_miembro, p_usuario, lower(trim(p_email)),
          case when nullif(p_refresh, '') is null then null else pgp_sym_encrypt(p_refresh, crm_clave('google_tokens'), 'cipher-algo=aes256') end,
          left(p_alcance, 1000), 'activa', null, now(), now())
  on conflict (organizacion_id, miembro_id) do update set
    usuario_id = excluded.usuario_id,
    email = excluded.email,
    -- Si Google no mandó un token nuevo, queda el anterior.
    refresh_cifrado = coalesce(excluded.refresh_cifrado, google_conexiones.refresh_cifrado),
    alcance = excluded.alcance,
    estado = 'activa',
    error = null,
    actualizado_en = now()
  returning id into v;
  return v;
end;
$$;

create or replace function public.google_conexion_token(p_id uuid)
returns text language sql stable security definer set search_path = public, extensions as $$
  select pgp_sym_decrypt(refresh_cifrado, crm_clave('google_tokens'))
    from google_conexiones
   where id = p_id and estado = 'activa' and refresh_cifrado is not null;
$$;

-- Baja (la persona desconecta) o error (Google pide volver a conectar). En la baja se borra el token.
create or replace function public.google_conexion_estado(p_id uuid, p_estado text, p_error text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_estado not in ('activa', 'revocada', 'error') then
    raise exception 'Estado de conexión desconocido.';
  end if;
  update google_conexiones
     set estado = p_estado,
         error = left(p_error, 500),
         refresh_cifrado = case when p_estado = 'revocada' then null else refresh_cifrado end,
         actualizado_en = now()
   where id = p_id;
end;
$$;

revoke all on function public.google_conexion_guardar(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.google_conexion_token(uuid) from public, anon, authenticated;
revoke all on function public.google_conexion_estado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.google_conexion_guardar(uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.google_conexion_token(uuid) to service_role;
grant execute on function public.google_conexion_estado(uuid, text, text) to service_role;

-- Reuniones creadas también en Google: el evento y el link para entrar (Meet).
alter table public.crm_reuniones add column if not exists google_evento_id text check (google_evento_id is null or length(google_evento_id) <= 300);
alter table public.crm_reuniones add column if not exists enlace_reunion text check (enlace_reunion is null or enlace_reunion ~* '^https?://');

notify pgrst, 'reload schema';

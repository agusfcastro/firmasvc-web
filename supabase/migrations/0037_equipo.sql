-- =====================================================================
-- FIRMA · Portal · Equipo comercial de cada negocio
-- Closers, setters, account managers y CSM como dato, tengan o no cuenta
-- en el portal. Sirve para atribuir ventas y, más adelante, las llamadas
-- de Fathom (se cruzan por mail).
-- Cada cliente del CRM puede llevar su closer, su setter y su responsable.
-- El texto libre crm_clientes.responsable sigue, sin uso nuevo.
-- =====================================================================

create table if not exists public.equipo_miembros (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  nombre           text not null check (length(trim(nombre)) between 2 and 120),
  rol_comercial    text not null check (rol_comercial in ('closer', 'setter', 'account_manager', 'csm', 'otro')),
  email            text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  usuario_id       uuid references auth.users (id) on delete set null,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (organizacion_id, id)
);

create unique index if not exists equipo_miembros_email_idx on public.equipo_miembros (organizacion_id, lower(email)) where email is not null;
create index if not exists equipo_miembros_usuario_idx on public.equipo_miembros (usuario_id) where usuario_id is not null;

create or replace function public.equipo_miembros_antes()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.organizacion_id is distinct from old.organizacion_id then
      raise exception 'Un integrante del equipo no cambia de negocio.';
    end if;
    new.actualizado_en := now();
  end if;
  new.email := nullif(lower(trim(new.email)), '');
  return new;
end;
$$;

drop trigger if exists equipo_miembros_antes on public.equipo_miembros;
create trigger equipo_miembros_antes before insert or update on public.equipo_miembros
  for each row execute function public.equipo_miembros_antes();

-- ---------------------------------------------------------------------
-- Closer, setter y responsable de cada cliente. La clave incluye el
-- negocio: un cliente no puede apuntar a alguien de otro negocio.
-- ---------------------------------------------------------------------
alter table public.crm_clientes add column if not exists closer_id uuid;
alter table public.crm_clientes add column if not exists setter_id uuid;
alter table public.crm_clientes add column if not exists responsable_id uuid;

alter table public.crm_clientes drop constraint if exists crm_clientes_closer_fk;
alter table public.crm_clientes add constraint crm_clientes_closer_fk
  foreign key (organizacion_id, closer_id) references public.equipo_miembros (organizacion_id, id) on delete set null (closer_id);
alter table public.crm_clientes drop constraint if exists crm_clientes_setter_fk;
alter table public.crm_clientes add constraint crm_clientes_setter_fk
  foreign key (organizacion_id, setter_id) references public.equipo_miembros (organizacion_id, id) on delete set null (setter_id);
alter table public.crm_clientes drop constraint if exists crm_clientes_responsable_fk;
alter table public.crm_clientes add constraint crm_clientes_responsable_fk
  foreign key (organizacion_id, responsable_id) references public.equipo_miembros (organizacion_id, id) on delete set null (responsable_id);

-- ---------------------------------------------------------------------
-- Seguridad. Todo el negocio ve su equipo; lo administran el titular y
-- FIRMA. Los integrantes no se borran, se desactivan.
-- ---------------------------------------------------------------------
alter table public.equipo_miembros enable row level security;

drop policy if exists equipo_lectura on public.equipo_miembros;
create policy equipo_lectura on public.equipo_miembros for select to authenticated
  using (public.es_admin() or organizacion_id = public.mi_organizacion());

drop policy if exists equipo_alta on public.equipo_miembros;
create policy equipo_alta on public.equipo_miembros for insert to authenticated
  with check (public.puede_gestionar_org(organizacion_id));

drop policy if exists equipo_edicion on public.equipo_miembros;
create policy equipo_edicion on public.equipo_miembros for update to authenticated
  using (public.puede_gestionar_org(organizacion_id)) with check (public.puede_gestionar_org(organizacion_id));

revoke all on public.equipo_miembros from anon;
revoke delete on public.equipo_miembros from authenticated;
grant select, insert, update on public.equipo_miembros to authenticated;

notify pgrst, 'reload schema';

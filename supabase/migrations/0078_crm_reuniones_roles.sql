-- =====================================================================
-- FIRMA · Portal · Paso 1 del CRM de clientes y equipos
--   · Un solo nombre por rol. CSM y Account Manager son lo mismo: todo lo
--     que estaba como «csm» en el equipo pasa a «account_manager», y un
--     trigger lo normaliza de acá en más. Las plantillas de CSM de FIRMA se
--     retiran porque repetían las de Account Manager. El rol del portal
--     sigue llamándose csm por dentro y en pantalla dice Account Manager.
--     Los cargos de dirección quedan escritos siempre igual (CEO, COO,
--     CFO, CCO), así «coo» y «COO» no son dos cargos distintos.
--   · Reuniones (crm_reuniones). Cada reunión del equipo con un cliente o
--     un prospecto, con tipo, fecha, quién la tuvo, quién la agendó, si el
--     cliente asistió, el resultado de las de venta y el link de la
--     grabación (Fathom). El tipo lo marca una persona: Fathom no
--     distingue un seguimiento de un cierre. De acá salen después la tasa
--     de asistencia y la de cierre de cada persona.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Un solo nombre por rol
-- ---------------------------------------------------------------------
create or replace function public.rol_comercial_unico()
returns trigger language plpgsql as $$
begin
  if new.rol_comercial = 'csm' then
    new.rol_comercial := 'account_manager';
  end if;
  return new;
end;
$$;

-- En el equipo, además, los cargos de dirección se escriben siempre igual (CEO, COO, CFO, CCO).
create or replace function public.equipo_miembros_normalizar()
returns trigger language plpgsql as $$
begin
  if new.rol_comercial = 'csm' then
    new.rol_comercial := 'account_manager';
  end if;
  if new.cargo is not null and upper(trim(new.cargo)) in ('CEO', 'COO', 'CFO', 'CCO', 'CMO', 'CTO', 'CPO', 'CRO') then
    new.cargo := upper(trim(new.cargo));
  end if;
  return new;
end;
$$;

drop trigger if exists equipo_miembros_rol_unico on public.equipo_miembros;
create trigger equipo_miembros_rol_unico before insert or update of rol_comercial, cargo on public.equipo_miembros
  for each row execute function public.equipo_miembros_normalizar();
drop trigger if exists equipo_hitos_rol_unico on public.equipo_hitos;
create trigger equipo_hitos_rol_unico before insert or update of rol_comercial on public.equipo_hitos
  for each row execute function public.rol_comercial_unico();
drop trigger if exists equipo_reportes_rol_unico on public.equipo_reportes;
create trigger equipo_reportes_rol_unico before insert or update of rol_comercial on public.equipo_reportes
  for each row execute function public.rol_comercial_unico();
drop trigger if exists equipo_objetivos_rol_unico on public.equipo_objetivos;
create trigger equipo_objetivos_rol_unico before insert or update of rol_comercial on public.equipo_objetivos
  for each row execute function public.rol_comercial_unico();

-- Las plantillas de CSM de FIRMA repetían las de Account Manager.
delete from public.equipo_hitos where organizacion_id is null and rol_comercial = 'csm';
delete from public.equipo_reportes where organizacion_id is null and rol_comercial = 'csm';

update public.equipo_miembros set rol_comercial = 'account_manager' where rol_comercial = 'csm';
update public.equipo_miembros set cargo = upper(trim(cargo))
 where upper(trim(cargo)) in ('CEO', 'COO', 'CFO', 'CCO', 'CMO', 'CTO', 'CPO', 'CRO') and cargo <> upper(trim(cargo));
update public.equipo_hitos set rol_comercial = 'account_manager' where rol_comercial = 'csm';
update public.equipo_reportes set rol_comercial = 'account_manager' where rol_comercial = 'csm';
update public.equipo_objetivos set rol_comercial = 'account_manager' where rol_comercial = 'csm';

-- ---------------------------------------------------------------------
-- Reuniones
-- ---------------------------------------------------------------------
create table if not exists public.crm_reuniones (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  -- Con un cliente del CRM o, en las de venta, con un prospecto que todavía no lo es.
  cliente_id       uuid,
  prospecto        text check (prospecto is null or length(trim(prospecto)) between 2 and 160),
  titulo           text check (titulo is null or length(titulo) <= 300),
  -- Sin tipo es una llamada que llegó de Fathom y falta clasificar.
  tipo             text check (tipo is null or tipo in ('venta', 'onboarding', 'seguimiento', 'renovacion', 'reclamo', 'otra')),
  inicio           timestamptz not null,
  duracion_min     integer check (duracion_min is null or duracion_min between 5 and 600),
  miembro_id       uuid,
  agendada_por     uuid,
  estado           text not null default 'agendada' check (estado in ('agendada', 'realizada', 'no_asistio', 'cancelada', 'reprogramada')),
  resultado        text check (resultado is null or resultado in ('cerro', 'no_cerro', 'seguimiento')),
  enlace           text check (enlace is null or enlace ~* '^https?://'),
  interaccion_id   uuid,
  notas            text check (notas is null or length(notas) <= 4000),
  creado_por       uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (organizacion_id, id),
  check (resultado is null or tipo = 'venta'),
  foreign key (organizacion_id, cliente_id) references public.crm_clientes (organizacion_id, id) on delete cascade,
  foreign key (organizacion_id, miembro_id) references public.equipo_miembros (organizacion_id, id) on delete set null (miembro_id),
  foreign key (organizacion_id, agendada_por) references public.equipo_miembros (organizacion_id, id) on delete set null (agendada_por),
  foreign key (organizacion_id, interaccion_id) references public.interacciones (organizacion_id, id) on delete set null (interaccion_id)
);
create index if not exists crm_reuniones_org_inicio_idx on public.crm_reuniones (organizacion_id, inicio desc);
create index if not exists crm_reuniones_cliente_idx on public.crm_reuniones (cliente_id, inicio desc) where cliente_id is not null;
create index if not exists crm_reuniones_miembro_idx on public.crm_reuniones (miembro_id, inicio desc) where miembro_id is not null;
create unique index if not exists crm_reuniones_interaccion_key on public.crm_reuniones (interaccion_id) where interaccion_id is not null;

create or replace function public.crm_reuniones_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.organizacion_id is distinct from old.organizacion_id then
      raise exception 'Una reunión no cambia de empresa.';
    end if;
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  else
    new.creado_por := auth.uid();
    new.creado_en := now();
  end if;
  new.actualizado_en := now();
  new.prospecto := nullif(regexp_replace(trim(coalesce(new.prospecto, '')), '\s+', ' ', 'g'), '');
  new.titulo := nullif(trim(coalesce(new.titulo, '')), '');
  new.enlace := nullif(trim(coalesce(new.enlace, '')), '');
  if new.cliente_id is not null then
    new.prospecto := null;
  end if;
  if new.cliente_id is null and new.prospecto is null and new.titulo is null then
    raise exception 'Elegí el cliente o escribí el nombre del prospecto.';
  end if;
  if new.resultado is not null and new.estado <> 'realizada' then
    raise exception 'El resultado se carga cuando la reunión se hizo.';
  end if;
  if new.estado in ('realizada', 'no_asistio') and new.inicio > now() + interval '1 hour' then
    raise exception 'Una reunión que todavía no pasó no se marca como hecha ni como faltazo.';
  end if;
  return new;
end;
$$;

drop trigger if exists crm_reuniones_antes on public.crm_reuniones;
create trigger crm_reuniones_antes before insert or update on public.crm_reuniones
  for each row execute function public.crm_reuniones_antes();

-- Ve y carga reuniones quien ve el CRM de la empresa (titular, Account Manager, closer y FIRMA).
-- Quien no lo ve, como un setter, solo las suyas: las que tiene o las que agendó.
alter table public.crm_reuniones enable row level security;

drop policy if exists crm_reuniones_lectura on public.crm_reuniones;
create policy crm_reuniones_lectura on public.crm_reuniones for select to authenticated
  using (public.puede_ver_org(organizacion_id)
         or miembro_id = public.mi_integrante(organizacion_id)
         or agendada_por = public.mi_integrante(organizacion_id));
drop policy if exists crm_reuniones_alta on public.crm_reuniones;
create policy crm_reuniones_alta on public.crm_reuniones for insert to authenticated
  with check (public.puede_ver_org(organizacion_id)
              or miembro_id = public.mi_integrante(organizacion_id)
              or agendada_por = public.mi_integrante(organizacion_id));
drop policy if exists crm_reuniones_edicion on public.crm_reuniones;
create policy crm_reuniones_edicion on public.crm_reuniones for update to authenticated
  using (public.puede_ver_org(organizacion_id)
         or miembro_id = public.mi_integrante(organizacion_id)
         or agendada_por = public.mi_integrante(organizacion_id))
  with check (public.puede_ver_org(organizacion_id)
              or miembro_id = public.mi_integrante(organizacion_id)
              or agendada_por = public.mi_integrante(organizacion_id));
drop policy if exists crm_reuniones_borrado on public.crm_reuniones;
create policy crm_reuniones_borrado on public.crm_reuniones for delete to authenticated
  using (public.puede_gestionar_org(organizacion_id) or creado_por = auth.uid());

revoke all on public.crm_reuniones from anon;
grant select, insert, update, delete on public.crm_reuniones to authenticated;

-- ---------------------------------------------------------------------
-- Cada llamada que llega de Fathom queda como reunión hecha, con su link.
-- Si había una agendada con esa persona a esa hora, la completa. Si no,
-- se crea una nueva sin tipo para que alguien la clasifique. Cuando la
-- llamada se vincula a un cliente, la reunión también. El link se copia
-- porque el contenido de la llamada se borra a los 90 días.
-- ---------------------------------------------------------------------
create or replace function public.interaccion_enlace(p_contenido bytea)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v text;
begin
  if p_contenido is null then
    return null;
  end if;
  begin
    v := left(nullif(trim(pgp_sym_decrypt(p_contenido, crm_clave('interacciones_contenido'))::jsonb ->> 'enlace'), ''), 500);
  exception when others then
    return null;
  end;
  return case when v ~* '^https?://' then v end;
end;
$$;
revoke all on function public.interaccion_enlace(bytea) from public, anon, authenticated;

create or replace function public.reuniones_desde_llamada()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_enlace text;
  v_reunion uuid;
  v_duracion integer;
begin
  if tg_op = 'INSERT' then
    if new.fuente <> 'fathom' then
      return null;
    end if;
    begin
      v_enlace := interaccion_enlace(new.contenido_cifrado);
      v_duracion := case when new.duracion_seg is null then null else least(600, greatest(5, round(new.duracion_seg / 60.0)::integer)) end;
      if new.equipo_miembro_id is not null then
        select r.id into v_reunion from crm_reuniones r
         where r.organizacion_id = new.organizacion_id and r.interaccion_id is null and r.estado = 'agendada'
           and r.miembro_id = new.equipo_miembro_id
           and r.inicio between new.ocurrida_en - interval '90 minutes' and new.ocurrida_en + interval '60 minutes'
           and (new.cliente_id is null or r.cliente_id is null or r.cliente_id = new.cliente_id)
         order by abs(extract(epoch from r.inicio - new.ocurrida_en))
         limit 1;
      end if;
      if v_reunion is not null then
        update crm_reuniones set
          interaccion_id = new.id,
          enlace = coalesce(enlace, v_enlace),
          estado = 'realizada',
          duracion_min = coalesce(duracion_min, v_duracion),
          cliente_id = coalesce(cliente_id, new.cliente_id)
        where id = v_reunion;
      else
        insert into crm_reuniones (organizacion_id, cliente_id, titulo, tipo, inicio, duracion_min, miembro_id, estado, enlace, interaccion_id)
        values (new.organizacion_id, new.cliente_id, coalesce(new.titulo, 'Llamada de Fathom'), null, new.ocurrida_en, v_duracion,
                new.equipo_miembro_id, 'realizada', v_enlace, new.id);
      end if;
    exception when others then
      raise warning 'No se pudo cargar la reunión de la llamada %: %', new.id, sqlerrm;
    end;
  elsif new.cliente_id is distinct from old.cliente_id and new.cliente_id is not null then
    update crm_reuniones set cliente_id = new.cliente_id
     where interaccion_id = new.id and (cliente_id is null or cliente_id is not distinct from old.cliente_id);
  end if;
  return null;
end;
$$;

drop trigger if exists interacciones_reuniones on public.interacciones;
create trigger interacciones_reuniones after insert or update of cliente_id on public.interacciones
  for each row execute function public.reuniones_desde_llamada();

-- Las llamadas que ya estaban también quedan como reuniones. Si un análisis
-- ya dijo la etapa, se usa como tipo.
insert into public.crm_reuniones (organizacion_id, cliente_id, titulo, tipo, inicio, duracion_min, miembro_id, estado, enlace, interaccion_id)
select i.organizacion_id, i.cliente_id, coalesce(i.titulo, 'Llamada de Fathom'),
       case when i.etapa_comercial in ('venta', 'onboarding', 'seguimiento') then i.etapa_comercial end,
       i.ocurrida_en,
       case when i.duracion_seg is null then null else least(600, greatest(5, round(i.duracion_seg / 60.0)::integer)) end,
       i.equipo_miembro_id, 'realizada', public.interaccion_enlace(i.contenido_cifrado), i.id
  from public.interacciones i
 where i.fuente = 'fathom'
   and not exists (select 1 from public.crm_reuniones r where r.interaccion_id = i.id);

notify pgrst, 'reload schema';

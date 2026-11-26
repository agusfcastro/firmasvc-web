-- =====================================================================
-- FIRMA · Portal · Objetivos, hitos, victorias y reportes del equipo
-- Lo que el equipo de cada empresa toca todos los días (rediseño del
-- portal, paquetes P5 y P7). Nada de esto llama a la IA.
--   · Hitos por rol. FIRMA deja plantillas (sin empresa) y cada empresa
--     las copia con equipo_cargar_plantillas() y las ajusta.
--   · Reportes por rol, diarios o semanales, con campos que se arman sin
--     código. Piden resultados y no horarios: un campo de horario o de
--     fichaje puede servir de prueba de una relación laboral (segunda
--     auditoría, hallazgo D), así que solo FIRMA puede sumarlo.
--   · Victorias de cada persona, con evidencia (captura, audio o enlace),
--     atadas a un objetivo, a un hito o sueltas. Solo suman las
--     validadas. Valida quien lidera el equipo y nunca la propia.
--   · Objetivos del negocio, de un rol o de una persona, con meta y
--     período. El avance lo calcula la base (equipo_objetivos_avance).
-- Lideran el equipo FIRMA, el titular y quien tiene el área Operaciones.
-- Evidencias en el bucket privado «equipo», en <empresa>/<victoria>/.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quién lidera el equipo y quién es uno en el equipo
-- ---------------------------------------------------------------------
create or replace function public.lidera_equipo(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or (org is not null and org = public.mi_organizacion()
          and (public.soy_titular() or public.mis_areas() && array['operaciones']));
$$;

-- El integrante del equipo de quien llama en ese negocio, si tiene uno activo.
create or replace function public.mi_integrante(org uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.id from public.equipo_miembros e
   where org is not null and e.organizacion_id = org and org = public.mi_organizacion()
     and e.usuario_id = auth.uid() and e.activo
   order by e.creado_en
   limit 1;
$$;

revoke all on function public.lidera_equipo(uuid) from public, anon;
revoke all on function public.mi_integrante(uuid) from public, anon;
grant execute on function public.lidera_equipo(uuid) to authenticated;
grant execute on function public.mi_integrante(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Hitos por rol. Sin empresa son plantillas de FIRMA.
-- ---------------------------------------------------------------------
create table if not exists public.equipo_hitos (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid references public.organizaciones (id) on delete cascade,
  rol_comercial    text not null check (rol_comercial in ('closer', 'setter', 'account_manager', 'csm', 'otro')),
  titulo           text not null check (length(trim(titulo)) between 2 and 140),
  descripcion      text check (descripcion is null or length(descripcion) <= 600),
  -- A los cuántos días de entrar se espera. Solo orienta: no vence ni avisa.
  plazo_dias       int check (plazo_dias is null or plazo_dias between 1 and 365),
  orden            int not null default 0,
  activo           boolean not null default true,
  plantilla_id     uuid references public.equipo_hitos (id) on delete set null,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (organizacion_id, id)
);
create index if not exists equipo_hitos_org_idx on public.equipo_hitos (organizacion_id, rol_comercial, orden);

-- ---------------------------------------------------------------------
-- Reportes por rol. Sin empresa son plantillas de FIRMA.
-- campos: [{clave, etiqueta, tipo, ayuda?, obligatoria?}]
-- tipo: numero, monto, texto, largo o sino.
-- ---------------------------------------------------------------------
create table if not exists public.equipo_reportes (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid references public.organizaciones (id) on delete cascade,
  rol_comercial    text not null check (rol_comercial in ('closer', 'setter', 'account_manager', 'csm', 'otro')),
  titulo           text not null check (length(trim(titulo)) between 2 and 120),
  frecuencia       text not null default 'diaria' check (frecuencia in ('diaria', 'semanal')),
  campos           jsonb not null default '[]'::jsonb check (jsonb_typeof(campos) = 'array'),
  activo           boolean not null default true,
  plantilla_id     uuid references public.equipo_reportes (id) on delete set null,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (organizacion_id, id)
);
create index if not exists equipo_reportes_org_idx on public.equipo_reportes (organizacion_id, rol_comercial);

create or replace function public.equipo_reportes_antes()
returns trigger language plpgsql set search_path = public as $$
declare
  c jsonb;
  claves text[] := '{}';
  clave text;
  etiqueta text;
begin
  if tg_op = 'UPDATE' then
    if new.organizacion_id is distinct from old.organizacion_id then
      raise exception 'Un reporte no cambia de empresa.';
    end if;
    new.actualizado_en := now();
  end if;
  if jsonb_array_length(new.campos) = 0 then
    raise exception 'El reporte necesita al menos un campo.';
  end if;
  if jsonb_array_length(new.campos) > 20 then
    raise exception 'Un reporte admite hasta 20 campos.';
  end if;
  for c in select value from jsonb_array_elements(new.campos) loop
    clave := c ->> 'clave';
    etiqueta := trim(coalesce(c ->> 'etiqueta', ''));
    if jsonb_typeof(c) <> 'object' or clave is null or clave !~ '^[a-z0-9_]{1,40}$' then
      raise exception 'Hay un campo del reporte sin una clave válida.';
    end if;
    if clave = any (claves) then
      raise exception 'Hay dos campos con la misma clave (%).', clave;
    end if;
    claves := claves || clave;
    if length(etiqueta) < 2 or length(etiqueta) > 120 then
      raise exception 'Hay un campo del reporte sin texto.';
    end if;
    if coalesce(c ->> 'tipo', '') not in ('numero', 'monto', 'texto', 'largo', 'sino') then
      raise exception 'El campo «%» no tiene un tipo válido.', etiqueta;
    end if;
    -- Resultados, no horarios. Solo FIRMA puede sumar un campo así, después de evaluar el vínculo.
    if not public.es_admin()
       and (etiqueta || ' ' || coalesce(c ->> 'ayuda', '')) ~* '(horario|hora de (entrada|salida|inicio|ingreso|fin)|horas trabajadas|horas de trabajo|fichaje|fichar|presentismo|asistencia a la oficina|conectad[oa] desde)' then
      raise exception 'Los reportes piden resultados y no horarios. Un campo como «%» puede servir de prueba de una relación laboral. Si lo necesitás, consultalo con FIRMA.', etiqueta;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists equipo_reportes_antes on public.equipo_reportes;
create trigger equipo_reportes_antes before insert or update on public.equipo_reportes
  for each row execute function public.equipo_reportes_antes();

-- ---------------------------------------------------------------------
-- Reportes entregados. Uno por persona, reporte y período (el día, o el
-- lunes de la semana en los semanales).
-- ---------------------------------------------------------------------
create table if not exists public.equipo_reporte_respuestas (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  reporte_id       uuid not null,
  miembro_id       uuid not null,
  periodo          date not null,
  respuestas       jsonb not null default '{}'::jsonb check (jsonb_typeof(respuestas) = 'object'),
  enviado_en       timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  cargado_por      uuid default auth.uid() references auth.users (id) on delete set null,
  unique (reporte_id, miembro_id, periodo),
  foreign key (organizacion_id, reporte_id) references public.equipo_reportes (organizacion_id, id) on delete cascade,
  foreign key (organizacion_id, miembro_id) references public.equipo_miembros (organizacion_id, id) on delete cascade
);
create index if not exists equipo_reporte_respuestas_org_idx on public.equipo_reporte_respuestas (organizacion_id, periodo);

create or replace function public.equipo_respuestas_antes()
returns trigger language plpgsql set search_path = public as $$
declare
  r public.equipo_reportes;
  rol text;
  c jsonb;
  clave text;
  v jsonb;
  definidas text[] := '{}';
begin
  if tg_op = 'UPDATE' then
    if new.organizacion_id is distinct from old.organizacion_id or new.reporte_id is distinct from old.reporte_id
       or new.miembro_id is distinct from old.miembro_id or new.periodo is distinct from old.periodo then
      raise exception 'Un reporte enviado no cambia de persona ni de período.';
    end if;
    new.enviado_en := old.enviado_en;
    new.cargado_por := old.cargado_por;
    new.actualizado_en := now();
  else
    new.enviado_en := now();
    new.actualizado_en := now();
    new.cargado_por := auth.uid();
  end if;

  select * into r from public.equipo_reportes where id = new.reporte_id;
  if r.frecuencia = 'semanal' then
    new.periodo := date_trunc('week', new.periodo)::date;
  end if;

  if tg_op = 'INSERT' then
    if not r.activo then
      raise exception 'Ese reporte ya no se usa.';
    end if;
    if new.periodo > current_date + 1 then
      raise exception 'No se reporta un período que todavía no llegó.';
    end if;
    if new.periodo < current_date - 60 then
      raise exception 'Ese período ya cerró hace más de 60 días.';
    end if;
    select e.rol_comercial into rol from public.equipo_miembros e where e.id = new.miembro_id;
    if rol is distinct from r.rol_comercial then
      raise exception 'Este reporte es de otro rol.';
    end if;
  end if;

  for c in select value from jsonb_array_elements(r.campos) loop
    clave := c ->> 'clave';
    definidas := definidas || clave;
    v := new.respuestas -> clave;
    if v is null or v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and trim(v #>> '{}') = '') then
      if (c ->> 'obligatoria')::boolean is true then
        raise exception 'Falta completar «%».', c ->> 'etiqueta';
      end if;
      new.respuestas := new.respuestas - clave;
      continue;
    end if;
    if c ->> 'tipo' in ('numero', 'monto') then
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0 then
        raise exception '«%» lleva un número.', c ->> 'etiqueta';
      end if;
    elsif c ->> 'tipo' = 'sino' then
      if jsonb_typeof(v) <> 'boolean' then
        raise exception '«%» es sí o no.', c ->> 'etiqueta';
      end if;
    elsif jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 2000 then
      raise exception '«%» lleva un texto de hasta 2000 caracteres.', c ->> 'etiqueta';
    end if;
  end loop;

  -- Solo quedan las respuestas de los campos del reporte.
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into new.respuestas
    from jsonb_each(new.respuestas) where key = any (definidas);
  return new;
end;
$$;

drop trigger if exists equipo_respuestas_antes on public.equipo_reporte_respuestas;
create trigger equipo_respuestas_antes before insert or update on public.equipo_reporte_respuestas
  for each row execute function public.equipo_respuestas_antes();

-- ---------------------------------------------------------------------
-- Objetivos
--   alcance  negocio (todo el equipo junto), rol (cada persona de ese
--            rol con la misma meta) o persona.
--   medida   victorias (cuántas victorias validadas atadas al objetivo),
--            valor (la suma de su valor) o reporte (la suma de un campo
--            numérico de un reporte en el período).
-- ---------------------------------------------------------------------
create table if not exists public.equipo_objetivos (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  titulo           text not null check (length(trim(titulo)) between 2 and 140),
  alcance          text not null check (alcance in ('negocio', 'rol', 'persona')),
  rol_comercial    text check (rol_comercial is null or rol_comercial in ('closer', 'setter', 'account_manager', 'csm', 'otro')),
  miembro_id       uuid,
  medida           text not null check (medida in ('victorias', 'valor', 'reporte')),
  reporte_id       uuid,
  campo            text,
  meta             numeric not null check (meta > 0),
  desde            date not null,
  hasta            date not null,
  activo           boolean not null default true,
  creado_por       uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (organizacion_id, id),
  check (hasta >= desde and hasta - desde <= 400),
  check ((alcance = 'rol') = (rol_comercial is not null)),
  check ((alcance = 'persona') = (miembro_id is not null)),
  check ((medida = 'reporte') = (reporte_id is not null and campo is not null)),
  foreign key (organizacion_id, miembro_id) references public.equipo_miembros (organizacion_id, id) on delete cascade,
  foreign key (organizacion_id, reporte_id) references public.equipo_reportes (organizacion_id, id)
);
create index if not exists equipo_objetivos_org_idx on public.equipo_objetivos (organizacion_id, hasta);

create or replace function public.equipo_objetivos_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.organizacion_id is distinct from old.organizacion_id then
      raise exception 'Un objetivo no cambia de empresa.';
    end if;
    new.actualizado_en := now();
  end if;
  if new.medida = 'reporte' and not exists (
       select 1 from public.equipo_reportes r, jsonb_array_elements(r.campos) c
        where r.id = new.reporte_id and c ->> 'clave' = new.campo and c ->> 'tipo' in ('numero', 'monto')) then
    raise exception 'El objetivo se mide con un campo de número del reporte.';
  end if;
  return new;
end;
$$;

drop trigger if exists equipo_objetivos_antes on public.equipo_objetivos;
create trigger equipo_objetivos_antes before insert or update on public.equipo_objetivos
  for each row execute function public.equipo_objetivos_antes();

-- ---------------------------------------------------------------------
-- Victorias
-- ---------------------------------------------------------------------
create table if not exists public.equipo_victorias (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references public.organizaciones (id) on delete cascade,
  miembro_id        uuid not null,
  titulo            text not null check (length(trim(titulo)) between 2 and 160),
  detalle           text check (detalle is null or length(detalle) <= 2000),
  fecha             date not null default current_date,
  valor             numeric check (valor is null or valor >= 0),
  moneda            text check (moneda is null or moneda ~ '^[A-Z]{3}$'),
  objetivo_id       uuid,
  hito_id           uuid,
  evidencia_url     text check (evidencia_url is null or evidencia_url ~* '^https?://'),
  evidencia_ruta    text,
  evidencia_nombre  text check (evidencia_nombre is null or length(evidencia_nombre) <= 200),
  estado            text not null default 'pendiente' check (estado in ('pendiente', 'validada', 'rechazada')),
  nota              text check (nota is null or length(nota) <= 600),
  cargada_por       uuid default auth.uid() references auth.users (id) on delete set null,
  validada_por      uuid references auth.users (id) on delete set null,
  validada_en       timestamptz,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  unique (organizacion_id, id),
  foreign key (organizacion_id, miembro_id) references public.equipo_miembros (organizacion_id, id) on delete cascade,
  foreign key (organizacion_id, objetivo_id) references public.equipo_objetivos (organizacion_id, id) on delete set null (objetivo_id),
  foreign key (organizacion_id, hito_id) references public.equipo_hitos (organizacion_id, id) on delete set null (hito_id)
);
create index if not exists equipo_victorias_org_idx on public.equipo_victorias (organizacion_id, fecha desc);
create index if not exists equipo_victorias_miembro_idx on public.equipo_victorias (miembro_id, estado);

create or replace function public.equipo_victorias_antes()
returns trigger language plpgsql set search_path = public as $$
declare
  propia boolean;
begin
  if new.evidencia_ruta is not null and new.evidencia_ruta not like new.organizacion_id::text || '/' || new.id::text || '/%' then
    raise exception 'La evidencia tiene que estar en la carpeta de la victoria.';
  end if;
  if new.fecha > current_date + 1 then
    raise exception 'La fecha de la victoria no puede ser futura.';
  end if;

  if tg_op = 'INSERT' then
    new.cargada_por := auth.uid();
    new.creado_en := now();
    new.actualizado_en := now();
    -- Quien lidera el equipo valida al cargar la victoria de otra persona. La propia queda pendiente.
    select exists (select 1 from public.equipo_miembros e where e.id = new.miembro_id and e.usuario_id = auth.uid()) into propia;
    if public.lidera_equipo(new.organizacion_id) and (not propia or public.es_admin()) then
      new.estado := 'validada';
      new.validada_por := auth.uid();
      new.validada_en := now();
    else
      new.estado := 'pendiente';
      new.validada_por := null;
      new.validada_en := null;
    end if;
    new.nota := null;
    return new;
  end if;

  if new.organizacion_id is distinct from old.organizacion_id or new.miembro_id is distinct from old.miembro_id
     or new.cargada_por is distinct from old.cargada_por or new.creado_en is distinct from old.creado_en then
    raise exception 'Una victoria no cambia de persona.';
  end if;
  if (new.estado, new.nota, new.validada_por, new.validada_en) is distinct from (old.estado, old.nota, old.validada_por, old.validada_en)
     and coalesce(current_setting('firma.validando', true), '') <> 'si' then
    raise exception 'El estado de una victoria lo cambia quien lidera el equipo.';
  end if;
  if old.estado <> 'pendiente' and not public.es_admin()
     and (new.titulo, new.detalle, new.fecha, new.valor, new.moneda, new.objetivo_id, new.hito_id, new.evidencia_url, new.evidencia_ruta, new.evidencia_nombre)
         is distinct from (old.titulo, old.detalle, old.fecha, old.valor, old.moneda, old.objetivo_id, old.hito_id, old.evidencia_url, old.evidencia_ruta, old.evidencia_nombre) then
    raise exception 'Una victoria ya revisada no se edita.';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists equipo_victorias_antes on public.equipo_victorias;
create trigger equipo_victorias_antes before insert or update on public.equipo_victorias
  for each row execute function public.equipo_victorias_antes();

-- Validar, rechazar (con motivo) o volver a pendiente. Nunca la propia.
create or replace function public.equipo_victoria_validar(victoria uuid, decision text, motivo text default null)
returns public.equipo_victorias language plpgsql security definer set search_path = public as $$
declare
  v public.equipo_victorias;
begin
  select * into v from public.equipo_victorias where id = victoria;
  if v.id is null or not public.lidera_equipo(v.organizacion_id) then
    raise exception 'Solo quien lidera el equipo valida victorias.';
  end if;
  if not public.es_admin() and exists (select 1 from public.equipo_miembros e where e.id = v.miembro_id and e.usuario_id = auth.uid()) then
    raise exception 'No podés validar tu propia victoria.';
  end if;
  if decision not in ('validada', 'rechazada', 'pendiente') then
    raise exception 'La decisión es validada, rechazada o pendiente.';
  end if;
  if decision = 'rechazada' and length(trim(coalesce(motivo, ''))) < 3 then
    raise exception 'Contá por qué no se valida, así la persona sabe qué corregir.';
  end if;

  perform set_config('firma.validando', 'si', true);
  update public.equipo_victorias
     set estado = decision,
         nota = case when decision = 'rechazada' then trim(motivo) else nullif(trim(coalesce(motivo, '')), '') end,
         validada_por = case when decision = 'pendiente' then null else auth.uid() end,
         validada_en = case when decision = 'pendiente' then null else now() end
   where id = victoria
  returning * into v;
  perform set_config('firma.validando', '', true);
  return v;
end;
$$;

revoke all on function public.equipo_victoria_validar(uuid, text, text) from public, anon;
grant execute on function public.equipo_victoria_validar(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Copiar las plantillas de FIRMA de un rol a la empresa. No repite lo que
-- ya copió ni lo que la empresa ya tiene con el mismo nombre.
-- ---------------------------------------------------------------------
create or replace function public.equipo_cargar_plantillas(org uuid, rol text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_hitos int;
  n_reportes int;
begin
  if org is null or not public.lidera_equipo(org) then
    raise exception 'Solo quien lidera el equipo carga las plantillas.';
  end if;

  insert into public.equipo_hitos (organizacion_id, rol_comercial, titulo, descripcion, plazo_dias, orden, plantilla_id)
  select org, h.rol_comercial, h.titulo, h.descripcion, h.plazo_dias, h.orden, h.id
    from public.equipo_hitos h
   where h.organizacion_id is null and h.activo and h.rol_comercial = rol
     and not exists (select 1 from public.equipo_hitos x
                      where x.organizacion_id = org and x.rol_comercial = rol
                        and (x.plantilla_id = h.id or lower(trim(x.titulo)) = lower(trim(h.titulo))));
  get diagnostics n_hitos = row_count;

  insert into public.equipo_reportes (organizacion_id, rol_comercial, titulo, frecuencia, campos, plantilla_id)
  select org, r.rol_comercial, r.titulo, r.frecuencia, r.campos, r.id
    from public.equipo_reportes r
   where r.organizacion_id is null and r.activo and r.rol_comercial = rol
     and not exists (select 1 from public.equipo_reportes x
                      where x.organizacion_id = org and x.rol_comercial = rol
                        and (x.plantilla_id = r.id or lower(trim(x.titulo)) = lower(trim(r.titulo))));
  get diagnostics n_reportes = row_count;

  return jsonb_build_object('hitos', n_hitos, 'reportes', n_reportes);
end;
$$;

revoke all on function public.equipo_cargar_plantillas(uuid, text) from public, anon;
grant execute on function public.equipo_cargar_plantillas(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Avance de los objetivos activos. Una fila por objetivo y persona (sin
-- persona en los del negocio). Quien lidera ve todo; el resto, los del
-- negocio y los suyos.
-- ---------------------------------------------------------------------
create or replace function public.equipo_objetivos_avance(org uuid)
returns table (objetivo_id uuid, miembro_id uuid, avance numeric)
language sql stable security definer set search_path = public as $$
  with o as (
    select * from public.equipo_objetivos where organizacion_id = org and activo
  ),
  personas as (
    select o.id as objetivo_id, null::uuid as miembro_id from o where o.alcance = 'negocio'
    union all
    select o.id, e.id from o
      join public.equipo_miembros e on e.organizacion_id = org and e.activo and e.rol_comercial = o.rol_comercial
     where o.alcance = 'rol'
    union all
    select o.id, o.miembro_id from o where o.alcance = 'persona'
  )
  select p.objetivo_id, p.miembro_id,
    (case o.medida
      when 'victorias' then (
        select count(*)::numeric from public.equipo_victorias v
         where v.objetivo_id = o.id and v.estado = 'validada' and v.fecha between o.desde and o.hasta
           and (p.miembro_id is null or v.miembro_id = p.miembro_id))
      when 'valor' then (
        select coalesce(sum(v.valor), 0) from public.equipo_victorias v
         where v.objetivo_id = o.id and v.estado = 'validada' and v.fecha between o.desde and o.hasta
           and (p.miembro_id is null or v.miembro_id = p.miembro_id))
      else (
        select coalesce(sum((r.respuestas ->> o.campo)::numeric), 0) from public.equipo_reporte_respuestas r
         where r.reporte_id = o.reporte_id and r.periodo between o.desde and o.hasta
           and jsonb_typeof(r.respuestas -> o.campo) = 'number'
           and (p.miembro_id is null or r.miembro_id = p.miembro_id))
    end) as avance
  from personas p
  join o on o.id = p.objetivo_id
  where public.lidera_equipo(org)
     or (org = public.mi_organizacion()
         and ((p.miembro_id is null and o.alcance = 'negocio') or p.miembro_id = public.mi_integrante(org)));
$$;

revoke all on function public.equipo_objetivos_avance(uuid) from public, anon;
grant execute on function public.equipo_objetivos_avance(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table public.equipo_hitos enable row level security;
alter table public.equipo_reportes enable row level security;
alter table public.equipo_reporte_respuestas enable row level security;
alter table public.equipo_objetivos enable row level security;
alter table public.equipo_victorias enable row level security;

-- Hitos y reportes: la empresa lee los suyos y las plantillas de FIRMA. Escribe quien lidera; las plantillas, solo FIRMA.
drop policy if exists equipo_hitos_lectura on public.equipo_hitos;
create policy equipo_hitos_lectura on public.equipo_hitos for select to authenticated
  using (public.es_admin() or (organizacion_id is null and public.mi_organizacion() is not null) or organizacion_id = public.mi_organizacion());
drop policy if exists equipo_hitos_alta on public.equipo_hitos;
create policy equipo_hitos_alta on public.equipo_hitos for insert to authenticated
  with check (case when organizacion_id is null then public.es_admin() else public.lidera_equipo(organizacion_id) end);
drop policy if exists equipo_hitos_edicion on public.equipo_hitos;
create policy equipo_hitos_edicion on public.equipo_hitos for update to authenticated
  using (case when organizacion_id is null then public.es_admin() else public.lidera_equipo(organizacion_id) end)
  with check (case when organizacion_id is null then public.es_admin() else public.lidera_equipo(organizacion_id) end);

drop policy if exists equipo_reportes_lectura on public.equipo_reportes;
create policy equipo_reportes_lectura on public.equipo_reportes for select to authenticated
  using (public.es_admin() or (organizacion_id is null and public.mi_organizacion() is not null) or organizacion_id = public.mi_organizacion());
drop policy if exists equipo_reportes_alta on public.equipo_reportes;
create policy equipo_reportes_alta on public.equipo_reportes for insert to authenticated
  with check (case when organizacion_id is null then public.es_admin() else public.lidera_equipo(organizacion_id) end);
drop policy if exists equipo_reportes_edicion on public.equipo_reportes;
create policy equipo_reportes_edicion on public.equipo_reportes for update to authenticated
  using (case when organizacion_id is null then public.es_admin() else public.lidera_equipo(organizacion_id) end)
  with check (case when organizacion_id is null then public.es_admin() else public.lidera_equipo(organizacion_id) end);

-- Reportes entregados: cada persona los suyos; quien lidera, todos. Nadie los borra salvo FIRMA.
drop policy if exists equipo_respuestas_lectura on public.equipo_reporte_respuestas;
create policy equipo_respuestas_lectura on public.equipo_reporte_respuestas for select to authenticated
  using (public.lidera_equipo(organizacion_id) or miembro_id = public.mi_integrante(organizacion_id));
drop policy if exists equipo_respuestas_alta on public.equipo_reporte_respuestas;
create policy equipo_respuestas_alta on public.equipo_reporte_respuestas for insert to authenticated
  with check (public.lidera_equipo(organizacion_id) or miembro_id = public.mi_integrante(organizacion_id));
drop policy if exists equipo_respuestas_edicion on public.equipo_reporte_respuestas;
create policy equipo_respuestas_edicion on public.equipo_reporte_respuestas for update to authenticated
  using (public.lidera_equipo(organizacion_id) or miembro_id = public.mi_integrante(organizacion_id))
  with check (public.lidera_equipo(organizacion_id) or miembro_id = public.mi_integrante(organizacion_id));
drop policy if exists equipo_respuestas_borrado on public.equipo_reporte_respuestas;
create policy equipo_respuestas_borrado on public.equipo_reporte_respuestas for delete to authenticated
  using (public.es_admin());

-- Objetivos: quien lidera ve y escribe todo; el resto ve los del negocio, los de su rol y los suyos.
drop policy if exists equipo_objetivos_lectura on public.equipo_objetivos;
create policy equipo_objetivos_lectura on public.equipo_objetivos for select to authenticated
  using (
    public.lidera_equipo(organizacion_id)
    or (organizacion_id = public.mi_organizacion() and (
         alcance = 'negocio'
         or miembro_id = public.mi_integrante(organizacion_id)
         or (alcance = 'rol' and rol_comercial = (select e.rol_comercial from public.equipo_miembros e where e.id = public.mi_integrante(organizacion_id)))
       ))
  );
drop policy if exists equipo_objetivos_alta on public.equipo_objetivos;
create policy equipo_objetivos_alta on public.equipo_objetivos for insert to authenticated
  with check (public.lidera_equipo(organizacion_id));
drop policy if exists equipo_objetivos_edicion on public.equipo_objetivos;
create policy equipo_objetivos_edicion on public.equipo_objetivos for update to authenticated
  using (public.lidera_equipo(organizacion_id)) with check (public.lidera_equipo(organizacion_id));
drop policy if exists equipo_objetivos_borrado on public.equipo_objetivos;
create policy equipo_objetivos_borrado on public.equipo_objetivos for delete to authenticated
  using (public.lidera_equipo(organizacion_id));

-- Victorias: todo el negocio ve las validadas (el muro); cada persona, también las suyas; quien lidera, todas.
drop policy if exists equipo_victorias_lectura on public.equipo_victorias;
create policy equipo_victorias_lectura on public.equipo_victorias for select to authenticated
  using (
    public.lidera_equipo(organizacion_id)
    or (organizacion_id = public.mi_organizacion() and (estado = 'validada' or miembro_id = public.mi_integrante(organizacion_id)))
  );
drop policy if exists equipo_victorias_alta on public.equipo_victorias;
create policy equipo_victorias_alta on public.equipo_victorias for insert to authenticated
  with check (public.lidera_equipo(organizacion_id) or miembro_id = public.mi_integrante(organizacion_id));
drop policy if exists equipo_victorias_edicion on public.equipo_victorias;
create policy equipo_victorias_edicion on public.equipo_victorias for update to authenticated
  using (public.lidera_equipo(organizacion_id) or (miembro_id = public.mi_integrante(organizacion_id) and estado = 'pendiente'))
  with check (public.lidera_equipo(organizacion_id) or miembro_id = public.mi_integrante(organizacion_id));
drop policy if exists equipo_victorias_borrado on public.equipo_victorias;
create policy equipo_victorias_borrado on public.equipo_victorias for delete to authenticated
  using (public.es_admin() or (miembro_id = public.mi_integrante(organizacion_id) and estado = 'pendiente'));

revoke all on public.equipo_hitos, public.equipo_reportes, public.equipo_reporte_respuestas, public.equipo_objetivos, public.equipo_victorias from anon;
revoke delete on public.equipo_hitos, public.equipo_reportes from authenticated;
grant select, insert, update on public.equipo_hitos, public.equipo_reportes to authenticated;
grant select, insert, update, delete on public.equipo_reporte_respuestas, public.equipo_objetivos, public.equipo_victorias to authenticated;

-- ---------------------------------------------------------------------
-- Evidencias de las victorias: bucket privado, hasta 10 MB.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipo', 'equipo', false, 10485760, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/pdf',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/opus', 'audio/webm', 'audio/wav', 'audio/x-wav'
])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.evidencia_visible(ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.equipo_victorias v
     where v.evidencia_ruta = ruta
       and (public.lidera_equipo(v.organizacion_id)
            or (v.organizacion_id = public.mi_organizacion()
                and (v.estado = 'validada' or v.miembro_id = public.mi_integrante(v.organizacion_id)))));
$$;
revoke all on function public.evidencia_visible(text) from public, anon;
grant execute on function public.evidencia_visible(text) to authenticated;

-- Se sube antes de guardar la victoria, en la carpeta de la propia empresa.
drop policy if exists equipo_evidencia_subida on storage.objects;
create policy equipo_evidencia_subida on storage.objects for insert to authenticated
  with check (bucket_id = 'equipo' and (public.es_admin() or (storage.foldername(name))[1] = public.mi_organizacion()::text));
drop policy if exists equipo_evidencia_descarga on storage.objects;
create policy equipo_evidencia_descarga on storage.objects for select to authenticated
  using (bucket_id = 'equipo' and public.evidencia_visible(name));
drop policy if exists equipo_evidencia_borrado on storage.objects;
create policy equipo_evidencia_borrado on storage.objects for delete to authenticated
  using (bucket_id = 'equipo' and public.es_admin());

-- ---------------------------------------------------------------------
-- Plantillas de FIRMA. Resultados, nunca horarios. Cada empresa las copia
-- desde Equipo y las ajusta.
-- ---------------------------------------------------------------------
insert into public.equipo_reportes (organizacion_id, rol_comercial, titulo, frecuencia, campos)
select null, x.rol, x.titulo, x.frecuencia, x.campos::jsonb
  from (values
    ('closer', 'Reporte del día del closer', 'diaria', '[
      {"clave":"agendadas","etiqueta":"Llamadas agendadas para hoy","tipo":"numero","obligatoria":true},
      {"clave":"realizadas","etiqueta":"Llamadas que se hicieron","tipo":"numero","obligatoria":true},
      {"clave":"cierres","etiqueta":"Cierres","tipo":"numero","obligatoria":true},
      {"clave":"vendido","etiqueta":"Vendido","tipo":"monto","ayuda":"El total de los contratos que cerraste hoy."},
      {"clave":"cobrado","etiqueta":"Cobrado","tipo":"monto","ayuda":"Lo que entró hoy, de ventas nuevas o de cuotas."},
      {"clave":"objecion","etiqueta":"La objeción que más escuchaste","tipo":"texto"},
      {"clave":"riesgos","etiqueta":"¿Algún cliente con riesgo de reclamo? Contanos quién y por qué","tipo":"largo"}
    ]'),
    ('setter', 'Reporte del día del setter', 'diaria', '[
      {"clave":"conversaciones","etiqueta":"Conversaciones nuevas","tipo":"numero","obligatoria":true},
      {"clave":"respuestas","etiqueta":"Conversaciones que respondieron","tipo":"numero"},
      {"clave":"agendas","etiqueta":"Llamadas agendadas","tipo":"numero","obligatoria":true},
      {"clave":"calificadas","etiqueta":"Agendas calificadas","tipo":"numero","ayuda":"Las que cumplen el perfil que pide el closer."},
      {"clave":"comentario","etiqueta":"Lo que más te frenó hoy","tipo":"largo"}
    ]'),
    ('account_manager', 'Reporte de la semana del account manager', 'semanal', '[
      {"clave":"contactados","etiqueta":"Clientes contactados","tipo":"numero","obligatoria":true},
      {"clave":"en_riesgo","etiqueta":"Clientes en riesgo","tipo":"numero","obligatoria":true},
      {"clave":"renovaciones","etiqueta":"Renovaciones o ventas adicionales","tipo":"numero"},
      {"clave":"reclamos","etiqueta":"Reclamos o pedidos de reembolso","tipo":"numero"},
      {"clave":"detalle_riesgos","etiqueta":"Quiénes están en riesgo y qué hiciste","tipo":"largo"}
    ]'),
    ('csm', 'Reporte de la semana del CSM', 'semanal', '[
      {"clave":"contactados","etiqueta":"Clientes contactados","tipo":"numero","obligatoria":true},
      {"clave":"en_riesgo","etiqueta":"Clientes en riesgo","tipo":"numero","obligatoria":true},
      {"clave":"renovaciones","etiqueta":"Renovaciones o ventas adicionales","tipo":"numero"},
      {"clave":"reclamos","etiqueta":"Reclamos o pedidos de reembolso","tipo":"numero"},
      {"clave":"detalle_riesgos","etiqueta":"Quiénes están en riesgo y qué hiciste","tipo":"largo"}
    ]')
  ) as x (rol, titulo, frecuencia, campos)
 where not exists (select 1 from public.equipo_reportes r where r.organizacion_id is null and r.rol_comercial = x.rol and r.titulo = x.titulo);

insert into public.equipo_hitos (organizacion_id, rol_comercial, titulo, descripcion, plazo_dias, orden)
select null, x.rol, x.titulo, x.descripcion, x.plazo, x.orden
  from (values
    ('closer', 'Primer cierre', 'El primer contrato firmado y cobrado.', 30, 1),
    ('closer', 'Primer mes con todos los reportes', null, 30, 2),
    ('closer', 'Primer mes en la meta de cierres', null, 60, 3),
    ('closer', 'Primer cliente con pago completo', null, 60, 4),
    ('closer', 'Tres meses sin reembolsos en sus ventas', null, 90, 5),
    ('setter', 'Primera agenda que terminó en cierre', null, 30, 1),
    ('setter', 'Primer mes con todos los reportes', null, 30, 2),
    ('setter', 'Primer mes en la meta de agendas', null, 60, 3),
    ('setter', 'Tres meses con agendas calificadas en meta', null, 90, 4),
    ('account_manager', 'Primer cliente renovado', null, 30, 1),
    ('account_manager', 'Primer mes con todos los reportes', null, 30, 2),
    ('account_manager', 'Primer cliente en riesgo recuperado', null, 60, 3),
    ('account_manager', 'Tres meses sin reembolsos en su cartera', null, 90, 4),
    ('csm', 'Primer cliente renovado', null, 30, 1),
    ('csm', 'Primer mes con todos los reportes', null, 30, 2),
    ('csm', 'Primer cliente en riesgo recuperado', null, 60, 3),
    ('csm', 'Tres meses sin reembolsos en su cartera', null, 90, 4)
  ) as x (rol, titulo, descripcion, plazo, orden)
 where not exists (select 1 from public.equipo_hitos h where h.organizacion_id is null and h.rol_comercial = x.rol and h.titulo = x.titulo);

notify pgrst, 'reload schema';

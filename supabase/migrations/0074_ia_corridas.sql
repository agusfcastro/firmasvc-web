-- =====================================================================
-- FIRMA · Portal · Auditoría de la IA, primera parte
-- Cada llamada a Claude que hace el portal deja una corrida anotada, y
-- FIRMA arma con sus correcciones los casos de prueba de cada agente.
--   ia_corridas  Una fila por corrida: agente, versión del prompt (la
--                huella de su texto, así un cambio de prompt se nota
--                solo), modelo, tokens, costo y duración. No guarda el
--                contenido: apunta al registro donde ya está guardado
--                (tina_mensajes, interaccion_analisis,
--                comentario_borradores), con sus propios permisos y
--                cifrado. La revisión de FIRMA va por ia_corrida_revisar().
--   ia_casos     Casos de prueba de cada agente, con la entrada
--                anonimizada y lo que se espera. Los escribe solo FIRMA.
-- Escribe las corridas solo el servidor. Las lee solo FIRMA.
-- En esta parte el registro no cambia nada de lo que responden los
-- agentes: si anotar falla, la respuesta sale igual.
-- =====================================================================

create table if not exists public.ia_corridas (
  id                bigint generated always as identity primary key,
  agente            text not null check (agente ~ '^[a-z][a-z0-9_]{1,40}$'),
  version_prompt    text not null check (length(version_prompt) between 1 and 40),
  modelo            text not null default '',
  organizacion_id   uuid references public.organizaciones (id) on delete set null,
  referencia_tabla  text check (referencia_tabla in ('tina_conversaciones', 'interaccion_analisis', 'asunto_archivos')),
  referencia_id     text,
  tokens_entrada    int not null default 0 check (tokens_entrada >= 0),
  tokens_salida     int not null default 0 check (tokens_salida >= 0),
  costo_usd         numeric(10,6) not null default 0 check (costo_usd >= 0),
  duracion_ms       int check (duracion_ms >= 0),
  error             text check (length(error) <= 500),
  revision          text not null default 'pendiente' check (revision in ('pendiente', 'aprobada', 'corregida', 'rechazada', 'sin_revision')),
  nota              text check (length(nota) <= 2000),
  revisado_por      uuid references auth.users (id) on delete set null,
  revisado_en       timestamptz,
  creado_en         timestamptz not null default now()
);
create index if not exists ia_corridas_agente on public.ia_corridas (agente, creado_en desc);
create index if not exists ia_corridas_pendientes on public.ia_corridas (creado_en desc) where revision = 'pendiente';

create table if not exists public.ia_casos (
  id          bigint generated always as identity primary key,
  agente      text not null check (agente ~ '^[a-z][a-z0-9_]{1,40}$'),
  etiqueta    text not null check (length(trim(etiqueta)) between 1 and 120),
  origen      text not null default 'manual' check (origen in ('manual', 'correccion', 'manipulacion')),
  corrida_id  bigint references public.ia_corridas (id) on delete set null,
  -- Sin nombres, teléfonos ni mails reales: lo anonimiza quien lo carga.
  entrada     jsonb not null,
  esperado    jsonb not null,
  activo      boolean not null default true,
  creado_por  uuid references auth.users (id) on delete set null,
  creado_en   timestamptz not null default now()
);
create index if not exists ia_casos_agente on public.ia_casos (agente) where activo;

alter table public.ia_corridas enable row level security;
alter table public.ia_casos enable row level security;

drop policy if exists ia_corridas_firma on public.ia_corridas;
create policy ia_corridas_firma on public.ia_corridas for select to authenticated using (public.es_admin());

drop policy if exists ia_casos_firma on public.ia_casos;
create policy ia_casos_firma on public.ia_casos for all to authenticated using (public.es_admin()) with check (public.es_admin());

revoke all on public.ia_corridas, public.ia_casos from anon, authenticated;
grant select on public.ia_corridas to authenticated;
grant select, insert, update, delete on public.ia_casos to authenticated;
grant all on public.ia_corridas, public.ia_casos to service_role;

-- FIRMA aprueba, corrige o rechaza una corrida. Queda quién y cuándo.
create or replace function public.ia_corrida_revisar(p_corrida bigint, p_revision text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Solo FIRMA revisa las corridas de la IA.' using errcode = 'insufficient_privilege';
  end if;
  if p_revision not in ('aprobada', 'corregida', 'rechazada') then
    raise exception 'La revisión es aprobada, corregida o rechazada.' using errcode = 'check_violation';
  end if;
  update ia_corridas
  set revision = p_revision, nota = nullif(trim(coalesce(p_nota, '')), ''), revisado_por = auth.uid(), revisado_en = now()
  where id = p_corrida;
  if not found then
    raise exception 'No existe esa corrida.' using errcode = 'no_data_found';
  end if;
end;
$$;
revoke all on function public.ia_corrida_revisar(bigint, text, text) from public, anon;
grant execute on function public.ia_corrida_revisar(bigint, text, text) to authenticated;

-- Tasa de aprobación sin cambios por agente y versión de prompt, para ver si un cambio mejoró o empeoró.
create or replace function public.ia_resumen()
returns table (agente text, version_prompt text, corridas bigint, revisadas bigint, aprobadas bigint, costo_usd numeric, ultima timestamptz)
language sql stable security definer set search_path = public as $$
  select c.agente, c.version_prompt, count(*),
         count(*) filter (where c.revision in ('aprobada', 'corregida', 'rechazada')),
         count(*) filter (where c.revision = 'aprobada'),
         sum(c.costo_usd), max(c.creado_en)
  from ia_corridas c
  where public.es_admin()
  group by c.agente, c.version_prompt
  order by max(c.creado_en) desc;
$$;
revoke all on function public.ia_resumen() from public, anon;
grant execute on function public.ia_resumen() to authenticated;

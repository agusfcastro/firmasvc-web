-- =====================================================================
-- FIRMA · Portal · Mail de los lunes y alertas de vencimientos
-- 1. perfiles.resumen_semanal: si la persona recibe el mail de los lunes
--    (newsletter y resumen). Se da de baja desde el enlace del pie del
--    mail. Las alertas de vencimientos llegan igual.
-- 2. newsletters: el video y el artículo de cada semana. La semana es el
--    lunes en que sale. La carga FIRMA en Administración › Newsletter y
--    sale solo si la activa. Sin una activa, ese lunes no sale nada.
-- 3. avisos_programados: una fila por cada alerta o mail de los lunes que
--    ya salió, así la tarea diaria no repite. La clave dice qué se avisó y
--    a qué umbral; la tarea reserva la clave antes de mandar.
-- La tarea es /api/portal/resumen, con la clave service role.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

alter table public.perfiles add column if not exists resumen_semanal boolean not null default true;

create table if not exists public.newsletters (
  id               uuid primary key default gen_random_uuid(),
  semana           date not null unique check (extract(isodow from semana) = 1),
  video_titulo     text check (video_titulo is null or length(trim(video_titulo)) between 3 and 140),
  video_url        text check (video_url is null or video_url ~ '^https://'),
  articulo_titulo  text check (articulo_titulo is null or length(trim(articulo_titulo)) between 3 and 140),
  articulo_bajada  text check (articulo_bajada is null or length(articulo_bajada) <= 400),
  articulo_url     text check (articulo_url is null or articulo_url ~ '^https://'),
  activa           boolean not null default false,
  enviada_en       timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint newsletters_video check ((video_titulo is null) = (video_url is null)),
  constraint newsletters_articulo check ((articulo_titulo is null) = (articulo_url is null)),
  constraint newsletters_contenido check (video_url is not null or articulo_url is not null)
);

alter table public.newsletters add column if not exists activa boolean not null default false;

alter table public.newsletters enable row level security;
revoke all on public.newsletters from anon, authenticated;
grant select, insert, update, delete on public.newsletters to authenticated;

drop policy if exists newsletters_admin on public.newsletters;
create policy newsletters_admin on public.newsletters
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create table if not exists public.avisos_programados (
  clave      text primary key check (length(clave) <= 200),
  creado_en  timestamptz not null default now()
);

alter table public.avisos_programados enable row level security;
revoke all on public.avisos_programados from anon, authenticated;

create index if not exists asuntos_vence_idx on public.asuntos (vence_en) where estado <> 'finalizado' and vence_en is not null;

notify pgrst, 'reload schema';

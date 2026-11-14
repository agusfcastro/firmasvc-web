-- =====================================================================
-- FIRMA · Portal · Comentarios en los documentos de un asunto
-- Quien ve un asunto abre sus PDF y Word dentro del portal y comenta,
-- como en Google Docs: resalta una frase y deja un comentario, o comenta
-- el documento entero. Cada comentario abre un hilo con respuestas y se
-- marca como resuelto. FIRMA puede dejar hilos internos que el cliente
-- no ve. Los avisos por mail salen por api/portal/avisos.ts (tipo
-- comentario), como mucho uno cada 15 minutos por asunto y por lado.
-- Se ejecuta una sola vez en Supabase › SQL Editor.
-- =====================================================================

create table if not exists public.asunto_comentarios (
  id               uuid primary key default gen_random_uuid(),
  archivo_id       uuid not null references public.asunto_archivos (id) on delete cascade,
  asunto_id        uuid not null references public.asuntos (id) on delete cascade,
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  -- Sin padre es el comentario que abre un hilo. Con padre, una respuesta.
  padre_id         uuid references public.asunto_comentarios (id) on delete cascade,
  -- Lo que se resaltó y dónde: { "pagina": 2, "inicio": 120, "fin": 164 }.
  -- En un PDF los números cuentan letras dentro de la hoja; en un Word,
  -- dentro del documento entero (pagina va en null). Sin cita, es un
  -- comentario sobre el documento entero.
  cita             text check (cita is null or length(cita) between 1 and 1000),
  ancla            jsonb,
  texto            text not null check (length(trim(texto)) between 1 and 4000),
  interna          boolean not null default false,
  resuelto_en      timestamptz,
  resuelto_por     uuid references auth.users (id) on delete set null,
  autor_id         uuid references auth.users (id) on delete set null,
  creado_en        timestamptz not null default now(),
  constraint asunto_comentarios_ancla check (ancla is null or (
    jsonb_typeof(ancla) = 'object'
    and jsonb_typeof(ancla -> 'inicio') = 'number'
    and jsonb_typeof(ancla -> 'fin') = 'number'
    and (ancla -> 'pagina' is null or jsonb_typeof(ancla -> 'pagina') in ('number', 'null'))
  ))
);

create index if not exists asunto_comentarios_archivo_idx on public.asunto_comentarios (archivo_id, creado_en);
create index if not exists asunto_comentarios_padre_idx on public.asunto_comentarios (padre_id);

-- Último mail de comentarios a cada lado, para mandar como mucho uno cada 15 minutos por asunto.
alter table public.asuntos add column if not exists aviso_comentario_cliente timestamptz;
alter table public.asuntos add column if not exists aviso_comentario_firma timestamptz;

-- Completa empresa, asunto y autor desde el archivo. Una respuesta hereda
-- si el hilo es interno y no lleva cita propia. Solo FIRMA abre hilos internos.
create or replace function public.asunto_comentarios_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.asunto_comentarios;
begin
  select asunto_id, organizacion_id into new.asunto_id, new.organizacion_id
  from asunto_archivos where id = new.archivo_id;
  if new.asunto_id is null then raise exception 'Documento inexistente.'; end if;

  if new.padre_id is not null then
    select * into p from asunto_comentarios where id = new.padre_id;
    if not found or p.archivo_id <> new.archivo_id then raise exception 'El hilo no es de este documento.'; end if;
    if p.padre_id is not null then raise exception 'Se responde al comentario que abre el hilo.'; end if;
    new.interna := p.interna;
    new.cita := null;
    new.ancla := null;
  elsif new.interna and auth.uid() is not null and not public.es_admin() then
    raise exception 'Solo FIRMA deja comentarios internos.';
  end if;

  if (new.cita is null) <> (new.ancla is null) then raise exception 'La cita y su ubicación van juntas.'; end if;
  new.texto := trim(new.texto);
  new.resuelto_en := null;
  new.resuelto_por := null;
  new.creado_en := now();
  if auth.uid() is not null then new.autor_id := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists asunto_comentarios_antes on public.asunto_comentarios;
create trigger asunto_comentarios_antes before insert on public.asunto_comentarios
  for each row execute function public.asunto_comentarios_antes();

-- Ve el comentario quien ve el asunto. Los internos, solo FIRMA.
create or replace function public.comentario_visible(org uuid, asunto uuid, p_interna boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select (public.puede_ver_casos(org) or public.puede_ver_asunto(asunto)) and (not p_interna or public.es_admin());
$$;

revoke all on function public.comentario_visible(uuid, uuid, boolean) from public, anon;
grant execute on function public.comentario_visible(uuid, uuid, boolean) to authenticated;

-- Resolver o reabrir un hilo. Lo puede hacer cualquiera que lo vea.
create or replace function public.resolver_comentario(comentario uuid, resuelto boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.asunto_comentarios;
begin
  if auth.uid() is null then raise exception 'Sesión requerida.'; end if;
  select * into c from asunto_comentarios where id = comentario;
  if not found or not public.comentario_visible(c.organizacion_id, c.asunto_id, c.interna) then
    raise exception 'No existe ese comentario.';
  end if;
  if c.padre_id is not null then raise exception 'Se resuelve el hilo, no una respuesta.'; end if;
  update asunto_comentarios
     set resuelto_en = case when resuelto then now() end,
         resuelto_por = case when resuelto then auth.uid() end
   where id = comentario;
end;
$$;

revoke all on function public.resolver_comentario(uuid, boolean) from public, anon;
grant execute on function public.resolver_comentario(uuid, boolean) to authenticated;

alter table public.asunto_comentarios enable row level security;

drop policy if exists comentarios_lectura on public.asunto_comentarios;
create policy comentarios_lectura on public.asunto_comentarios for select to authenticated
  using (public.comentario_visible(organizacion_id, asunto_id, interna));

drop policy if exists comentarios_alta on public.asunto_comentarios;
create policy comentarios_alta on public.asunto_comentarios for insert to authenticated
  with check (public.comentario_visible(organizacion_id, asunto_id, interna) and autor_id = auth.uid());

-- Cada uno borra lo suyo. FIRMA, cualquiera.
drop policy if exists comentarios_baja on public.asunto_comentarios;
create policy comentarios_baja on public.asunto_comentarios for delete to authenticated
  using (public.comentario_visible(organizacion_id, asunto_id, interna) and (autor_id = auth.uid() or public.es_admin()));

revoke all on public.asunto_comentarios from anon, authenticated;
grant select, delete on public.asunto_comentarios to authenticated;
grant insert (archivo_id, padre_id, cita, ancla, texto, interna) on public.asunto_comentarios to authenticated;
grant select, insert, update, delete on public.asunto_comentarios to service_role;

-- Comentarios en vivo. Realtime respeta las mismas reglas de lectura.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'asunto_comentarios') then
    alter publication supabase_realtime add table public.asunto_comentarios;
  end if;
end;
$$;

notify pgrst, 'reload schema';

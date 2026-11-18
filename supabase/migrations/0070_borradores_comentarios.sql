-- =====================================================================
-- FIRMA · Portal · Borradores de Tina para los comentarios de documentos
-- Cada mañana Tina lee los comentarios abiertos que dejó un cliente en un
-- documento de un asunto (0065) y que FIRMA todavía no contestó, y deja un
-- borrador por hilo: qué pide el cliente, una respuesta sugerida y, si
-- corresponde, el texto nuevo de la cláusula. Los ve solo FIRMA, en el
-- visor del documento. Nada le llega al cliente hasta que FIRMA publica la
-- respuesta. Los escribe solo el servidor (api/_lib/tina/borradores.ts,
-- desde la cola). Se ejecuta una sola vez en Supabase › SQL Editor.
-- =====================================================================

create table if not exists public.comentario_borradores (
  -- El comentario que abre el hilo. Un borrador por hilo: uno nuevo pisa al anterior.
  comentario_id    uuid primary key references public.asunto_comentarios (id) on delete cascade,
  archivo_id       uuid not null references public.asunto_archivos (id) on delete cascade,
  asunto_id        uuid not null references public.asuntos (id) on delete cascade,
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  -- Momento del último mensaje del hilo que Tina leyó. Si el cliente escribe después, se prepara otro.
  hasta            timestamptz not null,
  pedido           text not null check (length(pedido) between 1 and 2000),
  respuesta        text not null check (length(respuesta) between 1 and 4000),
  -- Texto sugerido para reemplazar la frase o la cláusula comentada. Null si no hay cambio de redacción.
  clausula         text check (clausula is null or length(clausula) between 1 and 8000),
  -- Lo que FIRMA tiene que mirar antes de publicar. Null si no hay nada que marcar.
  nota             text check (nota is null or length(nota) between 1 and 2000),
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'publicado', 'descartado')),
  modelo           text,
  creado_en        timestamptz not null default now(),
  cerrado_en       timestamptz,
  cerrado_por      uuid references auth.users (id) on delete set null
);

create index if not exists comentario_borradores_archivo_idx on public.comentario_borradores (archivo_id) where estado = 'pendiente';
create index if not exists comentario_borradores_creado_idx on public.comentario_borradores (creado_en) where estado = 'pendiente';

alter table public.comentario_borradores enable row level security;

-- Solo FIRMA los lee. Nadie los escribe desde el portal: se cierran con borrador_cerrar().
drop policy if exists borradores_lectura on public.comentario_borradores;
create policy borradores_lectura on public.comentario_borradores for select to authenticated
  using (public.es_admin());

revoke all on public.comentario_borradores from anon, authenticated;
grant select on public.comentario_borradores to authenticated;
grant select, insert, update, delete on public.comentario_borradores to service_role;

-- ---------------------------------------------------------------------
-- comentarios_para_borrador(archivo): los hilos que esperan un borrador.
-- Abiertos, no internos, de empresas activas, con el último mensaje
-- escrito por alguien que no es de FIRMA en los últimos 30 días, y sin un
-- borrador que ya haya leído ese mensaje (publicado o descartado cuenta:
-- no se vuelve a preparar lo que FIRMA ya resolvió). Sin archivo, todos.
-- La usa solo el servidor.
-- ---------------------------------------------------------------------
create or replace function public.comentarios_para_borrador(p_archivo uuid default null)
returns table (comentario_id uuid, archivo_id uuid, asunto_id uuid, organizacion_id uuid, ultimo timestamptz)
language sql stable security definer set search_path = public as $$
  select h.id, h.archivo_id, h.asunto_id, h.organizacion_id, u.creado_en
  from asunto_comentarios h
  join organizaciones o on o.id = h.organizacion_id and o.activa and not o.demo
  cross join lateral (
    select c.autor_id, c.creado_en
    from asunto_comentarios c
    where c.id = h.id or c.padre_id = h.id
    order by c.creado_en desc, (c.padre_id is not null) desc, c.id desc
    limit 1
  ) u
  where h.padre_id is null and h.resuelto_en is null and not h.interna
    and (p_archivo is null or h.archivo_id = p_archivo)
    and u.creado_en > now() - interval '30 days'
    and not exists (select 1 from perfiles p where p.id = u.autor_id and p.rol = 'admin')
    and not exists (select 1 from comentario_borradores b where b.comentario_id = h.id and b.hasta >= u.creado_en)
  order by h.archivo_id, h.creado_en;
$$;

revoke all on function public.comentarios_para_borrador(uuid) from public, anon, authenticated;
grant execute on function public.comentarios_para_borrador(uuid) to service_role;

-- ---------------------------------------------------------------------
-- borrador_cerrar(comentario, estado): FIRMA marca el borrador como
-- publicado (después de publicar la respuesta) o descartado.
-- ---------------------------------------------------------------------
create or replace function public.borrador_cerrar(p_comentario uuid, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo FIRMA cierra un borrador.'; end if;
  if p_estado not in ('publicado', 'descartado') then raise exception 'Estado inválido.'; end if;
  update comentario_borradores
     set estado = p_estado, cerrado_en = now(), cerrado_por = auth.uid()
   where comentario_id = p_comentario and estado = 'pendiente';
end;
$$;

revoke all on function public.borrador_cerrar(uuid, text) from public, anon;
grant execute on function public.borrador_cerrar(uuid, text) to authenticated;

notify pgrst, 'reload schema';

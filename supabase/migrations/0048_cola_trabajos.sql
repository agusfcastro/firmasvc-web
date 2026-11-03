-- =====================================================================
-- FIRMA · Portal · Cola de trabajos
-- Lo que no tiene que hacerse dentro del pedido que lo origina (procesar
-- una llamada de Fathom, más adelante analizarla con Claude) se encola
-- acá y lo procesa /api/cola/procesar.
--   Alta        cola_encolar(). La clave de idempotencia evita que un
--               mismo trabajo entre dos veces.
--   Toma        cola_tomar() reserva trabajos con for update skip locked:
--               dos procesadores a la vez nunca toman el mismo. La reserva
--               vence (tomado_hasta); si el procesador se cae, el trabajo
--               vuelve solo a la cola.
--   Cierre      cola_terminar() o cola_fallar(). Un fallo espera cada vez
--               más antes del próximo intento (1, 4, 16, 64 minutos… hasta
--               6 horas) y al llegar a max_intentos queda fallido.
-- El payload lleva solo ids: nada de contenido ni datos personales.
-- Todo es del servidor: el portal no lee ni escribe la cola.
-- =====================================================================

create table if not exists public.cola_trabajos (
  id                  bigint generated always as identity primary key,
  organizacion_id     uuid references public.organizaciones (id) on delete cascade,
  tipo                text not null check (tipo ~ '^[a-z][a-z0-9_]{1,39}$'),
  payload             jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  estado              text not null default 'pendiente' check (estado in ('pendiente', 'tomado', 'hecho', 'fallido')),
  intentos            integer not null default 0,
  max_intentos        integer not null default 6 check (max_intentos between 1 and 20),
  disponible_en       timestamptz not null default now(),
  tomado_hasta        timestamptz,
  clave_idempotencia  text unique,
  error               text,
  creado_en           timestamptz not null default now(),
  terminado_en        timestamptz
);

create index if not exists cola_trabajos_disponibles_idx on public.cola_trabajos (disponible_en)
  where estado in ('pendiente', 'tomado');
create index if not exists cola_trabajos_org_idx on public.cola_trabajos (organizacion_id, creado_en desc);

-- ---------------------------------------------------------------------
-- cola_encolar(tipo, negocio, payload, clave, demora): id del trabajo.
-- Con una clave que ya existe devuelve el trabajo que ya estaba.
-- ---------------------------------------------------------------------
create or replace function public.cola_encolar(
  p_tipo text, p_organizacion uuid, p_payload jsonb default '{}'::jsonb,
  p_clave text default null, p_demora_seg integer default 0)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  nuevo bigint;
begin
  insert into cola_trabajos (tipo, organizacion_id, payload, clave_idempotencia, disponible_en)
  values (p_tipo, p_organizacion, coalesce(p_payload, '{}'::jsonb), p_clave, now() + make_interval(secs => greatest(p_demora_seg, 0)))
  on conflict (clave_idempotencia) do nothing
  returning id into nuevo;
  if nuevo is null then
    select id into nuevo from cola_trabajos where clave_idempotencia = p_clave;
  end if;
  return nuevo;
end;
$$;

-- ---------------------------------------------------------------------
-- cola_tomar(cantidad, segundos, id): reserva hasta `cantidad` trabajos
-- disponibles por `segundos`. Con id, solo ese (el webhook procesa en
-- caliente el trabajo que acaba de encolar).
-- Una reserva vencida que ya gastó todos sus intentos queda fallida.
-- ---------------------------------------------------------------------
create or replace function public.cola_tomar(p_cantidad integer default 10, p_segundos integer default 120, p_id bigint default null)
returns setof public.cola_trabajos language plpgsql security definer set search_path = public as $$
begin
  update cola_trabajos set estado = 'fallido', terminado_en = now(),
    error = coalesce(error, 'El procesador no terminó a tiempo.')
  where estado = 'tomado' and tomado_hasta < now() and intentos >= max_intentos;

  return query
  with elegidos as (
    select t.id from cola_trabajos t
    where (p_id is null or t.id = p_id)
      and ((t.estado = 'pendiente' and t.disponible_en <= now())
           or (t.estado = 'tomado' and t.tomado_hasta < now()))
    order by t.disponible_en, t.id
    limit greatest(least(p_cantidad, 100), 1)
    for update skip locked
  )
  update cola_trabajos c set
    estado = 'tomado',
    intentos = c.intentos + 1,
    tomado_hasta = now() + make_interval(secs => greatest(least(p_segundos, 900), 10))
  from elegidos
  where c.id = elegidos.id
  returning c.*;
end;
$$;

create or replace function public.cola_terminar(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update cola_trabajos set estado = 'hecho', terminado_en = now(), tomado_hasta = null, error = null
  where id = p_id and estado = 'tomado';
$$;

-- Espera antes del próximo intento: 4^(intentos-1) minutos, con tope de 6 horas.
create or replace function public.cola_fallar(p_id bigint, p_error text)
returns void language sql security definer set search_path = public as $$
  update cola_trabajos set
    estado = case when intentos >= max_intentos then 'fallido' else 'pendiente' end,
    terminado_en = case when intentos >= max_intentos then now() end,
    disponible_en = now() + least(power(4, greatest(intentos - 1, 0)) * interval '1 minute', interval '6 hours'),
    tomado_hasta = null,
    error = left(coalesce(p_error, 'Error sin detalle'), 500)
  where id = p_id and estado = 'tomado';
$$;

-- ---------------------------------------------------------------------
-- Seguridad. Solo las funciones del servidor (service_role). FIRMA lee
-- la cola para ver qué falló.
-- ---------------------------------------------------------------------
alter table public.cola_trabajos enable row level security;

drop policy if exists cola_lectura_staff on public.cola_trabajos;
create policy cola_lectura_staff on public.cola_trabajos for select to authenticated using (public.es_staff());

revoke all on public.cola_trabajos from anon, authenticated;
grant select on public.cola_trabajos to authenticated;

revoke all on function public.cola_encolar(text, uuid, jsonb, text, integer), public.cola_tomar(integer, integer, bigint),
  public.cola_terminar(bigint), public.cola_fallar(bigint, text) from public, anon, authenticated;
grant execute on function public.cola_encolar(text, uuid, jsonb, text, integer), public.cola_tomar(integer, integer, bigint),
  public.cola_terminar(bigint), public.cola_fallar(bigint, text) to service_role;

notify pgrst, 'reload schema';

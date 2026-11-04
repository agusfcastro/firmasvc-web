-- =====================================================================
-- FIRMA · Portal · Recibos con firma electrónica
-- El titular firma el recibo desde el portal y lo descarga firmado en un
-- solo paso (api/firma/firmar, accion firmar_recibo). Es un envío de firma
-- como cualquier otro, con su código, su constancia y su sello en BFA,
-- con estas diferencias:
--   entrega 'portal'  firma quien lo emite, con su sesión del portal. Sin
--                     invitación ni código por mail.
--   lugar_firma       dónde va la imagen de la firma en el documento: la
--                     línea «Firma y aclaración» del recibo.
--   No ocupa el cupo de firmas del plan.
--   Lo ve todo el equipo que usa el CRM, como el recibo.
--   comprobantes.sobre_id lo une al recibo. Solo lo escribe el servidor.
-- =====================================================================

alter table public.firma_sobres drop constraint if exists firma_sobres_entrega;
alter table public.firma_sobres add constraint firma_sobres_entrega check (entrega in ('mail', 'enlace', 'portal'));

-- { pagina (desde 0), x, y, ancho, alto } en puntos del PDF.
alter table public.firma_sobres add column if not exists lugar_firma jsonb
  check (lugar_firma is null or jsonb_typeof(lugar_firma) = 'object');

-- ---------------------------------------------------------------------
-- Cupo: igual que en 0025, sin los firmados desde el portal.
-- ---------------------------------------------------------------------
drop function if exists public.firmas_uso(uuid);
create function public.firmas_uso(org uuid)
returns table (plan text, limite int, usados int, en_curso int, desde date, hasta date)
language sql stable security definer set search_path = public as $$
  select o.plan,
         case o.plan when 'gold' then 20 when 'black' then 50 end,
         (select count(*)::int from firma_sobres s
          where s.organizacion_id = o.id and s.emisor = 'cliente' and s.estado = 'completado' and s.entrega <> 'portal'
            and (s.completado_en at time zone 'America/Argentina/Buenos_Aires')::date >= m.desde
            and (s.completado_en at time zone 'America/Argentina/Buenos_Aires')::date < m.hasta),
         (select count(*)::int from firma_sobres s
          where s.organizacion_id = o.id and s.emisor = 'cliente' and s.estado = 'en_curso' and s.entrega <> 'portal'),
         m.desde, m.hasta
  from organizaciones o
  cross join lateral (
    select date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date as desde,
           (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') + interval '1 month')::date as hasta
  ) m
  where o.id = org and (public.es_admin() or org = public.mi_organizacion() or auth.role() = 'service_role');
$$;

revoke all on function public.firmas_uso(uuid) from public, anon;
grant execute on function public.firmas_uso(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Visibilidad: la de 0015 más los recibos firmados, para quien ve el CRM.
-- ---------------------------------------------------------------------
create or replace function public.firma_sobre_visible(p_sobre uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or exists (
    select 1 from public.firma_sobres s
    where s.id = p_sobre
      and s.organizacion_id is not null
      and s.organizacion_id = public.mi_organizacion()
      and (public.soy_titular()
           or s.creado_por = auth.uid()
           or ((s.crm_cliente_id is not null or s.entrega = 'portal') and public.puede_ver_org(s.organizacion_id)))
  );
$$;

-- ---------------------------------------------------------------------
-- Recibo y envío de firma
-- ---------------------------------------------------------------------
alter table public.comprobantes add column if not exists sobre_id uuid unique references public.firma_sobres (id) on delete restrict;

-- Como en 0053, más sobre_id: lo pone el servidor una sola vez, al firmar.
create or replace function public.comprobantes_edicion()
returns trigger language plpgsql as $$
begin
  if (new.id, new.organizacion_id, new.tipo, new.numero, new.fecha, new.moneda, new.total, new.receptor, new.datos, new.creado_por, new.creado_en)
     is distinct from
     (old.id, old.organizacion_id, old.tipo, old.numero, old.fecha, old.moneda, old.total, old.receptor, old.datos, old.creado_por, old.creado_en)
     or (new.cliente_id is distinct from old.cliente_id and new.cliente_id is not null) then
    raise exception 'Un comprobante emitido no se modifica. Anulalo y emití otro.';
  end if;
  if new.sobre_id is distinct from old.sobre_id then
    if old.sobre_id is not null or coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'La firma del comprobante la registra el servidor, una sola vez.';
    end if;
    if old.anulado_en is not null then
      raise exception 'Un comprobante anulado no se firma.';
    end if;
  end if;
  if old.anulado_en is not null then
    if (new.anulado_en, new.anulado_por, new.motivo_anulacion) is distinct from (old.anulado_en, old.anulado_por, old.motivo_anulacion) then
      raise exception 'El comprobante ya está anulado.';
    end if;
  elsif new.anulado_en is not null or new.motivo_anulacion is not null then
    if new.motivo_anulacion is null or length(trim(new.motivo_anulacion)) < 3 then
      raise exception 'Para anular hace falta el motivo.';
    end if;
    new.anulado_en := now();
    new.anulado_por := auth.uid();
  else
    new.anulado_por := null;
  end if;
  return new;
end;
$$;

-- En el alta el sobre siempre arranca vacío.
create or replace function public.comprobantes_alta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cliente_id is not null
     and not exists (select 1 from crm_clientes c where c.id = new.cliente_id and c.organizacion_id = new.organizacion_id) then
    raise exception 'El cliente no es de este negocio.';
  end if;
  -- El upsert bloquea la fila del contador: dos altas a la vez no comparten número.
  insert into comprobantes_numeracion as n (organizacion_id, tipo, ultimo)
  values (new.organizacion_id, new.tipo, 1)
  on conflict (organizacion_id, tipo) do update set ultimo = n.ultimo + 1
  returning ultimo into new.numero;
  new.creado_por := auth.uid();
  new.creado_en := now();
  new.anulado_en := null;
  new.anulado_por := null;
  new.motivo_anulacion := null;
  new.sobre_id := null;
  return new;
end;
$$;

revoke all on function public.comprobantes_alta() from public, anon, authenticated;

notify pgrst, 'reload schema';

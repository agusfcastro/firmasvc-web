-- =====================================================================
-- FIRMA · Portal · CRM y firma electrónica unidos
-- 1. Cada servicio elige su contrato modelo entre los Word de la
--    biblioteca de Documentos (sección Contratos de servicio).
-- 2. El servidor completa las variables {{...}} del modelo con la ficha,
--    lo pasa a PDF y deja una vista previa (crm_contratos_firma).
-- 3. Desde la ficha se manda a firmar: el envío queda atado al cliente
--    (firma_sobres.crm_cliente_id) y al completarse el cliente pasa solo
--    a Firmado.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Modelo de cada servicio, desde la biblioteca. El de pago total es
-- opcional: sin él se usa el general.
-- ---------------------------------------------------------------------
alter table public.crm_servicios add column if not exists documento_id uuid references public.documentos (id) on delete set null;
alter table public.crm_servicios add column if not exists documento_pif_id uuid references public.documentos (id) on delete set null;

-- Quién firma por la empresa. Sin datos, firma el titular.
alter table public.organizaciones add column if not exists firmante_nombre text;
alter table public.organizaciones add column if not exists firmante_email text;

do $$ begin
  alter table public.organizaciones add constraint organizaciones_firmante_email_check
    check (firmante_email is null or firmante_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
exception when duplicate_object then null; end $$;

-- El titular edita los datos del firmante de su empresa, nada más.
create or replace function public.organizacion_firmante(p_org uuid, p_nombre text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.es_admin() or (p_org = public.mi_organizacion() and public.soy_titular())) then
    raise exception 'Solo el titular de la empresa cambia quién firma por ella.';
  end if;
  update public.organizaciones
     set firmante_nombre = nullif(trim(p_nombre), ''),
         firmante_email  = nullif(lower(trim(p_email)), '')
   where id = p_org;
end;
$$;

revoke all on function public.organizacion_firmante(uuid, text, text) from public, anon;
grant execute on function public.organizacion_firmante(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Contrato listo para firmar de cada cliente. Lo escribe solo el servidor.
-- ---------------------------------------------------------------------
create table if not exists public.crm_contratos_firma (
  cliente_id        uuid primary key references public.crm_clientes (id) on delete cascade,
  organizacion_id   uuid not null references public.organizaciones (id) on delete cascade,
  estado            text not null default 'generando'
                    check (estado in ('generando', 'listo', 'faltan_datos', 'error', 'sin_modelo')),
  documento_id      uuid references public.documentos (id) on delete set null,
  pdf_ruta          text,
  pdf_paginas       int,
  avisos            jsonb not null default '[]'::jsonb,
  error             text,
  sobre_id          uuid references public.firma_sobres (id) on delete set null,
  generado_por      uuid references auth.users (id) on delete set null,
  generado_en       timestamptz not null default now()
);

create index if not exists crm_contratos_firma_org_idx on public.crm_contratos_firma (organizacion_id);

alter table public.crm_contratos_firma enable row level security;

drop policy if exists ccf_lectura on public.crm_contratos_firma;
create policy ccf_lectura on public.crm_contratos_firma for select to authenticated
  using (public.puede_ver_org(organizacion_id));

revoke all on public.crm_contratos_firma from anon;
revoke insert, update, delete on public.crm_contratos_firma from authenticated;
grant select on public.crm_contratos_firma to authenticated;

-- ---------------------------------------------------------------------
-- Envíos atados a un cliente del CRM. Quien ve el cliente ve su envío.
-- ---------------------------------------------------------------------
alter table public.firma_sobres add column if not exists crm_cliente_id uuid references public.crm_clientes (id) on delete set null;
create index if not exists firma_sobres_crm_idx on public.firma_sobres (crm_cliente_id) where crm_cliente_id is not null;

create or replace function public.firma_sobre_visible(p_sobre uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or exists (
    select 1 from public.firma_sobres s
    where s.id = p_sobre
      and s.organizacion_id is not null
      and s.organizacion_id = public.mi_organizacion()
      and (public.soy_titular()
           or s.creado_por = auth.uid()
           or (s.crm_cliente_id is not null and public.puede_ver_org(s.organizacion_id)))
  );
$$;

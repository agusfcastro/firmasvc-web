-- =====================================================================
-- FIRMA · Portal · Borradores de contrato con Claude y Drive
-- Al cargar una venta en el CRM, el servidor (api/crm/borrador) toma el
-- modelo de contrato del servicio, Claude lo completa con los datos y las
-- condiciones acordadas, y el .docx queda en la carpeta de revisión de
-- Drive de la empresa. Nunca se envía nada a firmar desde acá.
-- Se puede correr más de una vez en Supabase › SQL Editor.
-- =====================================================================

-- Carpeta de Drive donde caen los borradores de cada empresa (id o link).
alter table public.organizaciones add column if not exists drive_carpeta_revision text;

-- Modelo de contrato de cada servicio. El de pago total es opcional: sin
-- él, Claude adapta el modelo general.
alter table public.crm_servicios add column if not exists modelo_ruta text;
alter table public.crm_servicios add column if not exists modelo_nombre text;
alter table public.crm_servicios add column if not exists modelo_pif_ruta text;
alter table public.crm_servicios add column if not exists modelo_pif_nombre text;

-- Condiciones acordadas en la venta, en texto libre (descuentos, pagos
-- especiales, lo que no entra en el plan de cuotas). Claude las interpreta.
alter table public.crm_clientes add column if not exists condiciones text;

-- ---------------------------------------------------------------------
-- Borrador de cada cliente. Lo escribe solo el servidor.
-- ---------------------------------------------------------------------
create table if not exists public.crm_borradores (
  cliente_id        uuid primary key references public.crm_clientes (id) on delete cascade,
  organizacion_id   uuid not null references public.organizaciones (id) on delete cascade,
  estado            text not null default 'generando'
                    check (estado in ('generando', 'listo', 'revisar', 'error', 'sin_modelo', 'sin_carpeta')),
  drive_archivo_id  text,
  drive_url         text,
  avisos            jsonb not null default '[]'::jsonb,
  error             text,
  generado_por      uuid references auth.users (id) on delete set null,
  generado_en       timestamptz not null default now()
);

create index if not exists crm_borradores_org_idx on public.crm_borradores (organizacion_id);

alter table public.crm_borradores enable row level security;

drop policy if exists bor_lectura on public.crm_borradores;
create policy bor_lectura on public.crm_borradores for select to authenticated
  using (public.puede_ver_org(organizacion_id));

revoke all on public.crm_borradores from anon;
revoke insert, update, delete on public.crm_borradores from authenticated;
grant select on public.crm_borradores to authenticated;

-- ---------------------------------------------------------------------
-- Modelos. Bucket privado, solo .docx, hasta 10 MB. Los sube FIRMA y los
-- lee el servidor con la clave service role.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('modelos', 'modelos', false, 10485760, array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists modelos_lectura on storage.objects;
create policy modelos_lectura on storage.objects for select to authenticated
  using (bucket_id = 'modelos' and public.es_admin());

drop policy if exists modelos_subida on storage.objects;
create policy modelos_subida on storage.objects for insert to authenticated
  with check (bucket_id = 'modelos' and public.es_admin());

drop policy if exists modelos_reemplazo on storage.objects;
create policy modelos_reemplazo on storage.objects for update to authenticated
  using (bucket_id = 'modelos' and public.es_admin())
  with check (bucket_id = 'modelos' and public.es_admin());

drop policy if exists modelos_borrado on storage.objects;
create policy modelos_borrado on storage.objects for delete to authenticated
  using (bucket_id = 'modelos' and public.es_admin());

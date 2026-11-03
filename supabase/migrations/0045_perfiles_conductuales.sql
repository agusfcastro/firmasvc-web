-- =====================================================================
-- FIRMA · Portal · Perfiles conductuales de los clientes del CRM (v0)
-- Un perfil es un arquetipo de un catálogo cerrado que define FIRMA,
-- sostenido por señales observables. Nunca rasgos de personalidad.
--   · arquetipos y senal_tipos son el catálogo. Cada tipo de señal suma
--     puntos a un arquetipo; cuando un cliente junta el umbral dentro de
--     la ventana, el sistema propone el perfil.
--   · perfil_senales es la evidencia de cada cliente. Las de origen crm
--     salen solas de las cuotas y los casos de conflicto; las manuales
--     las carga el equipo describiendo lo que el cliente hizo o dijo.
--     Más adelante entran las de origen llamada (hallazgos de Fathom).
--   · perfiles_conductuales guarda la propuesta y la decisión humana.
--     El sistema solo propone; confirmar o rechazar lo hace una persona,
--     queda quién y cuándo, y todo perfil vence solo.
-- Lo ven y lo deciden FIRMA, el titular y el CSM (como los casos de
-- conflicto), solo en negocios con la funcionalidad
-- perfiles_conductuales (plan Blindaje o excepción).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table if not exists public.arquetipos (
  clave          text primary key check (clave ~ '^[a-z][a-z0-9_]{1,39}$'),
  nombre         text not null,
  descripcion    text not null,
  umbral         int not null default 2 check (umbral > 0),
  ventana_dias   int not null default 180 check (ventana_dias > 0),
  vigencia_dias  int not null default 90 check (vigencia_dias > 0),
  orden          int not null default 0,
  activo         boolean not null default true
);

create table if not exists public.senal_tipos (
  clave        text primary key check (clave ~ '^[a-z][a-z0-9_]{1,39}$'),
  arquetipo    text not null references public.arquetipos (clave) on delete cascade,
  nombre       text not null,
  descripcion  text,
  origen       text not null check (origen in ('crm', 'manual', 'llamada')),
  peso         int not null default 1 check (peso between 1 and 5),
  orden        int not null default 0,
  activo       boolean not null default true
);

insert into public.arquetipos (clave, nombre, descripcion, umbral, orden) values
  ('expectativa_resultado', 'Expectativa de resultado garantizado',
   'Espera un resultado concreto como si estuviera asegurado y lo reclama.', 2, 1),
  ('sensibilidad_precio', 'Sensibilidad al precio',
   'El precio o la forma de pago le pesa: se atrasa, pide descuentos o compara.', 2, 2),
  ('baja_adopcion', 'Baja adopción',
   'No usa el servicio: falta, no entra a los accesos o deja de responder.', 2, 3),
  ('escalada_temprana', 'Escalada temprana',
   'Lleva el desacuerdo a abogados, denuncias, redes o la tarjeta.', 2, 4)
on conflict (clave) do update set nombre = excluded.nombre, descripcion = excluded.descripcion;

insert into public.senal_tipos (clave, arquetipo, nombre, descripcion, origen, peso, orden) values
  ('caso_por_promesa',     'expectativa_resultado', 'Caso por promesa o expectativa', 'Caso de conflicto con causa promesa o expectativa', 'crm', 2, 1),
  ('pregunta_resultados',  'expectativa_resultado', 'Pregunta reiterada por resultados', 'Pide resultados concretos o plazos para lograrlos', 'manual', 1, 2),
  ('cita_promesas_venta',  'expectativa_resultado', 'Cita promesas de la venta', 'Repite algo que, según él, se le prometió al venderle', 'manual', 1, 3),
  ('cuota_vencida',        'sensibilidad_precio',   'Cuota vencida', 'Cuota pendiente con más de 7 días de atraso (solo con seguimiento de cobranza)', 'crm', 1, 1),
  ('caso_por_cobro',       'sensibilidad_precio',   'Caso por cobro', 'Caso de conflicto con causa cobro', 'crm', 2, 2),
  ('pide_descuento',       'sensibilidad_precio',   'Pide descuento', 'Pide rebaja del precio o de una cuota', 'manual', 1, 3),
  ('pide_refinanciacion',  'sensibilidad_precio',   'Pide refinanciar', 'Pide más cuotas, postergar o cambiar el plan de pagos', 'manual', 1, 4),
  ('compara_opciones',     'sensibilidad_precio',   'Compara con otras opciones', 'Menciona otros servicios o precios', 'manual', 1, 5),
  ('falta_a_sesiones',     'baja_adopcion',         'Falta a sesiones', 'No se presenta a sesiones o llamadas agendadas', 'manual', 1, 1),
  ('no_usa_accesos',       'baja_adopcion',         'No usa los accesos', 'No entra a la plataforma o al material', 'manual', 1, 2),
  ('responde_con_demora',  'baja_adopcion',         'Responde con demora', 'Tarda días en responder o deja de responder', 'manual', 1, 3),
  ('contracargo',          'escalada_temprana',     'Contracargo', 'Caso de conflicto con contracargo', 'crm', 2, 1),
  ('caso_en_legales',      'escalada_temprana',     'Caso en legales o difusión', 'Caso de conflicto que llegó a legales o a difusión pública', 'crm', 2, 2),
  ('reclamo_temprano',     'escalada_temprana',     'Reclamo en los primeros 60 días', 'Caso de conflicto abierto dentro de los 60 días del onboarding', 'crm', 1, 3),
  ('menciona_abogado',     'escalada_temprana',     'Menciona abogados o denuncia', 'Dice que va a consultar a un abogado, denunciar o reclamar formalmente', 'manual', 2, 4),
  ('menciona_redes',       'escalada_temprana',     'Amenaza con exponer', 'Dice que va a publicar en redes o reseñas', 'manual', 1, 5)
on conflict (clave) do update set arquetipo = excluded.arquetipo, nombre = excluded.nombre, descripcion = excluded.descripcion,
  origen = excluded.origen, peso = excluded.peso, orden = excluded.orden;

-- ---------------------------------------------------------------------
-- Señales de cada cliente
-- ---------------------------------------------------------------------
create table if not exists public.perfil_senales (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references public.organizaciones (id) on delete cascade,
  cliente_id        uuid not null,
  tipo              text not null references public.senal_tipos (clave),
  origen            text not null check (origen in ('crm', 'manual', 'llamada')),
  -- Fila que la originó (cuota, caso). Las manuales no tienen.
  evidencia_tabla   text check (evidencia_tabla in ('crm_pagos', 'crm_casos')),
  evidencia_id      uuid,
  detalle           text not null check (length(trim(detalle)) between 5 and 500),
  ocurrida_en       date not null default current_date,
  registrada_por    uuid default auth.uid() references auth.users (id) on delete set null,
  registrada_en     timestamptz not null default now(),
  descartada_en     timestamptz,
  descartada_por    uuid references auth.users (id) on delete set null,
  motivo_descarte   text,
  constraint perfil_senales_cliente_fk foreign key (organizacion_id, cliente_id)
    references public.crm_clientes (organizacion_id, id) on delete cascade,
  constraint perfil_senales_evidencia check ((evidencia_tabla is null) = (evidencia_id is null)),
  constraint perfil_senales_descarte check (descartada_en is null or length(trim(coalesce(motivo_descarte, ''))) >= 3)
);

create index if not exists perfil_senales_cliente_idx on public.perfil_senales (cliente_id, ocurrida_en desc);
-- Una señal automática por fila de origen y tipo: sincronizar dos veces no duplica.
create unique index if not exists perfil_senales_evidencia_idx on public.perfil_senales (tipo, evidencia_id) where evidencia_id is not null;

-- ---------------------------------------------------------------------
-- Perfiles: propuesta y decisión
-- ---------------------------------------------------------------------
create table if not exists public.perfiles_conductuales (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
  cliente_id       uuid not null,
  arquetipo        text not null references public.arquetipos (clave),
  senales          uuid[] not null,
  puntos           int not null,
  estado           text not null default 'propuesto' check (estado in ('propuesto', 'confirmado', 'rechazado', 'vencido')),
  propuesto_en     timestamptz not null default now(),
  vigente_hasta    timestamptz not null,
  decidido_por     uuid references auth.users (id) on delete set null,
  decidido_en      timestamptz,
  motivo           text,
  constraint perfiles_conductuales_cliente_fk foreign key (organizacion_id, cliente_id)
    references public.crm_clientes (organizacion_id, id) on delete cascade,
  constraint perfiles_conductuales_decision check (
    case estado
      when 'propuesto' then decidido_en is null
      when 'confirmado' then decidido_en is not null and decidido_por is not null
      when 'rechazado' then decidido_en is not null and decidido_por is not null and length(trim(coalesce(motivo, ''))) >= 3
      else true end
  )
);

create index if not exists perfiles_conductuales_cliente_idx on public.perfiles_conductuales (cliente_id, propuesto_en desc);
-- Un perfil abierto (propuesto o confirmado) por cliente y arquetipo.
create unique index if not exists perfiles_conductuales_abierto_idx on public.perfiles_conductuales (cliente_id, arquetipo)
  where estado in ('propuesto', 'confirmado');

-- ---------------------------------------------------------------------
-- Acceso: FIRMA, titular y CSM del negocio, con la funcionalidad.
-- ---------------------------------------------------------------------
create or replace function public.puede_ver_perfiles(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.puede_ver_casos(org) and public.tiene_funcionalidad(org, 'perfiles_conductuales');
$$;

-- Una señal manual la carga una persona: origen manual, sin evidencia,
-- con su autor. Lo automático lo escribe perfil_sincronizar().
-- Después solo se descarta (con motivo); el resto no cambia.
create or replace function public.perfil_senales_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Las de perfil_sincronizar() corren como dueño de la función.
    if current_user in ('authenticated', 'anon') then
      if not exists (select 1 from senal_tipos t where t.clave = new.tipo and t.origen = 'manual' and t.activo) then
        raise exception 'Ese tipo de señal no se carga a mano.';
      end if;
      new.origen := 'manual';
      new.evidencia_tabla := null;
      new.evidencia_id := null;
      new.registrada_por := auth.uid();
      new.registrada_en := now();
      new.descartada_en := null;
      new.descartada_por := null;
      new.motivo_descarte := null;
      if new.ocurrida_en > current_date then
        raise exception 'La fecha de la señal no puede ser futura.';
      end if;
    end if;
    new.detalle := trim(new.detalle);
  else
    if old.descartada_en is not null then
      raise exception 'Una señal descartada no cambia.';
    end if;
    if (to_jsonb(new) - array['descartada_en', 'descartada_por', 'motivo_descarte'])
       is distinct from (to_jsonb(old) - array['descartada_en', 'descartada_por', 'motivo_descarte']) then
      raise exception 'Una señal no se edita: se descarta con un motivo y se carga otra.';
    end if;
    if new.descartada_en is not null then
      new.descartada_en := now();
      new.descartada_por := auth.uid();
      new.motivo_descarte := trim(new.motivo_descarte);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfil_senales_antes on public.perfil_senales;
create trigger perfil_senales_antes before insert or update on public.perfil_senales
  for each row execute function public.perfil_senales_antes();

-- ---------------------------------------------------------------------
-- perfil_sincronizar(cliente): trae las señales del CRM, vence lo viejo
-- y propone los arquetipos que llegan al umbral. Se puede llamar todas
-- las veces que haga falta; la ficha lo llama al abrirse.
-- Devuelve false si el negocio no tiene la funcionalidad.
-- ---------------------------------------------------------------------
create or replace function public.perfil_sincronizar(cliente uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  c crm_clientes%rowtype;
  cobranza boolean;
  a arquetipos%rowtype;
  ids uuid[];
  total int;
begin
  select * into c from crm_clientes where id = cliente;
  if not found or not puede_ver_casos(c.organizacion_id) then
    raise exception 'No existe ese cliente o no tenés acceso.' using errcode = '42501';
  end if;
  if not tiene_funcionalidad(c.organizacion_id, 'perfiles_conductuales') then
    return false;
  end if;
  select seguimiento_cobranza into cobranza from organizaciones where id = c.organizacion_id;

  -- Cuotas vencidas, solo si el negocio sigue la cobranza: sin seguimiento
  -- una cuota pendiente es una condición pactada, no un atraso.
  if cobranza then
    insert into perfil_senales (organizacion_id, cliente_id, tipo, origen, evidencia_tabla, evidencia_id, detalle, ocurrida_en, registrada_por)
    select c.organizacion_id, c.id, 'cuota_vencida', 'crm', 'crm_pagos', p.id,
           format('Cuota de %s %s con vencimiento el %s, sin pagar a los 7 días', c.moneda, p.monto, to_char(p.vencimiento, 'DD/MM/YYYY')),
           p.vencimiento, null
    from crm_pagos p
    where p.cliente_id = c.id and p.estado = 'pendiente' and p.vencimiento < current_date - 7
    on conflict (tipo, evidencia_id) where evidencia_id is not null do nothing;
  end if;

  insert into perfil_senales (organizacion_id, cliente_id, tipo, origen, evidencia_tabla, evidencia_id, detalle, ocurrida_en, registrada_por)
  select c.organizacion_id, c.id, s.tipo, 'crm', 'crm_casos', k.id, s.detalle, k.abierto_en, null
  from crm_casos k
  cross join lateral (values
    ('caso_por_promesa', k.causa in ('promesa', 'expectativa'), format('Caso de conflicto abierto el %s por %s', to_char(k.abierto_en, 'DD/MM/YYYY'), k.causa)),
    ('caso_por_cobro', k.causa = 'cobro', format('Caso de conflicto abierto el %s por cobro', to_char(k.abierto_en, 'DD/MM/YYYY'))),
    ('contracargo', k.contracargo, format('Contracargo en el caso abierto el %s', to_char(k.abierto_en, 'DD/MM/YYYY'))),
    ('caso_en_legales', k.derivado_legales, format('El caso abierto el %s pasó a legales', to_char(k.abierto_en, 'DD/MM/YYYY'))),
    ('reclamo_temprano', c.fecha_onboarding is not null and k.abierto_en - c.fecha_onboarding::date between 0 and 60,
       format('Caso de conflicto abierto a los %s días del onboarding', k.abierto_en - c.fecha_onboarding::date))
  ) as s (tipo, aplica, detalle)
  where k.cliente_id = c.id and s.aplica
    and exists (select 1 from senal_tipos t where t.clave = s.tipo and t.activo)
  on conflict (tipo, evidencia_id) where evidencia_id is not null do nothing;

  -- Lo que pasó su fecha deja de estar abierto.
  update perfiles_conductuales set estado = 'vencido'
  where cliente_id = c.id and estado in ('propuesto', 'confirmado') and vigente_hasta <= now();

  for a in select * from arquetipos where activo order by orden loop
    select array_agg(s.id order by s.ocurrida_en), coalesce(sum(t.peso), 0) into ids, total
    from perfil_senales s join senal_tipos t on t.clave = s.tipo
    where s.cliente_id = c.id and t.arquetipo = a.clave and t.activo and s.descartada_en is null
      and s.ocurrida_en >= current_date - a.ventana_dias;

    continue when total < a.umbral;
    -- Ya hay uno abierto.
    continue when exists (select 1 from perfiles_conductuales p
                          where p.cliente_id = c.id and p.arquetipo = a.clave and p.estado in ('propuesto', 'confirmado'));
    -- Si una persona lo rechazó, se vuelve a proponer solo con evidencia nueva.
    continue when exists (select 1 from perfiles_conductuales p
                          where p.cliente_id = c.id and p.arquetipo = a.clave and p.estado = 'rechazado'
                            and p.senales @> ids);

    insert into perfiles_conductuales (organizacion_id, cliente_id, arquetipo, senales, puntos, vigente_hasta)
    values (c.organizacion_id, c.id, a.clave, ids, total, now() + make_interval(days => a.vigencia_dias));
  end loop;

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- perfil_decidir(perfil, confirmar, motivo): la decisión humana.
-- Confirmar renueva la vigencia; rechazar exige motivo. Queda en la
-- bitácora del negocio.
-- ---------------------------------------------------------------------
create or replace function public.perfil_decidir(perfil uuid, confirmar boolean, motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  p perfiles_conductuales%rowtype;
  dias int;
begin
  select * into p from perfiles_conductuales where id = perfil for update;
  if not found or not puede_ver_perfiles(p.organizacion_id) then
    raise exception 'No existe ese perfil o no tenés acceso.' using errcode = '42501';
  end if;
  if p.estado <> 'propuesto' or p.vigente_hasta <= now() then
    raise exception 'Ese perfil ya no está para decidir.';
  end if;
  if not confirmar and length(trim(coalesce(motivo, ''))) < 3 then
    raise exception 'Para rechazar un perfil hace falta el motivo.';
  end if;
  select vigencia_dias into dias from arquetipos where clave = p.arquetipo;

  update perfiles_conductuales set
    estado = case when confirmar then 'confirmado' else 'rechazado' end,
    decidido_por = auth.uid(),
    decidido_en = now(),
    motivo = nullif(trim(coalesce(perfil_decidir.motivo, '')), ''),
    vigente_hasta = case when confirmar then now() + make_interval(days => dias) else vigente_hasta end
  where id = p.id;

  insert into registro_accesos (usuario_id, actor_id, accion, organizacion_id, objeto_tipo, objeto_id, detalle)
  values (auth.uid(), auth.uid(), case when confirmar then 'perfil_confirmado' else 'perfil_rechazado' end,
          p.organizacion_id, 'crm_cliente', p.cliente_id::text,
          jsonb_build_object('organizacion_id', p.organizacion_id, 'perfil_id', p.id, 'arquetipo', p.arquetipo));
end;
$$;

revoke all on function public.puede_ver_perfiles(uuid), public.perfil_sincronizar(uuid), public.perfil_decidir(uuid, boolean, text) from public, anon;
grant execute on function public.puede_ver_perfiles(uuid), public.perfil_sincronizar(uuid), public.perfil_decidir(uuid, boolean, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Seguridad. El catálogo lo leen todos y lo cambia FIRMA por migración.
-- Señales: se leen, se cargan a mano y se descartan. Perfiles: se leen;
-- solo cambian por perfil_sincronizar() y perfil_decidir().
-- Nada se borra a mano: se va con el cliente.
-- ---------------------------------------------------------------------
alter table public.arquetipos enable row level security;
alter table public.senal_tipos enable row level security;
alter table public.perfil_senales enable row level security;
alter table public.perfiles_conductuales enable row level security;

drop policy if exists arquetipos_lectura on public.arquetipos;
create policy arquetipos_lectura on public.arquetipos for select to authenticated using (true);
drop policy if exists senal_tipos_lectura on public.senal_tipos;
create policy senal_tipos_lectura on public.senal_tipos for select to authenticated using (true);

drop policy if exists perfil_senales_lectura on public.perfil_senales;
create policy perfil_senales_lectura on public.perfil_senales for select to authenticated
  using (public.puede_ver_perfiles(organizacion_id));
drop policy if exists perfil_senales_alta on public.perfil_senales;
create policy perfil_senales_alta on public.perfil_senales for insert to authenticated
  with check (public.puede_ver_perfiles(organizacion_id));
drop policy if exists perfil_senales_descarte on public.perfil_senales;
create policy perfil_senales_descarte on public.perfil_senales for update to authenticated
  using (public.puede_ver_perfiles(organizacion_id)) with check (public.puede_ver_perfiles(organizacion_id));

drop policy if exists perfiles_conductuales_lectura on public.perfiles_conductuales;
create policy perfiles_conductuales_lectura on public.perfiles_conductuales for select to authenticated
  using (public.puede_ver_perfiles(organizacion_id));

revoke all on public.arquetipos, public.senal_tipos, public.perfil_senales, public.perfiles_conductuales from anon;
revoke insert, update, delete on public.arquetipos, public.senal_tipos, public.perfiles_conductuales from authenticated;
revoke delete on public.perfil_senales from authenticated;
grant select on public.arquetipos, public.senal_tipos, public.perfiles_conductuales to authenticated;
grant select, insert, update on public.perfil_senales to authenticated;

notify pgrst, 'reload schema';

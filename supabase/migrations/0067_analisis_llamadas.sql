-- =====================================================================
-- FIRMA · Portal · Análisis de llamadas de venta (fase 5)
-- Cada llamada (interacción) tiene a lo sumo un análisis vigente. Lo arma
-- el servidor con Claude sobre la transcripción (api/_lib/analisis) y lo
-- revisa FIRMA antes de que lo vea el negocio.
--   Libro de códigos  analisis_codigos es el catálogo versionado de la
--                     skill perfil-riesgo-prospecto (venta-1.1): código,
--                     tipo, peso y la señal del perfil conductual a la
--                     que alimenta. Las definiciones para el modelo están
--                     en docs/ANALIZADOR_VENTA.md. Una versión no se
--                     cambia: si cambia el libro, se agrega otra versión
--                     acá y se actualiza el documento.
--   Puntaje           lo calcula la base con analisis_puntuar(), nunca el
--                     modelo: suma de peso por intensidad, bandas y
--                     reglas de mínimo escritas. La misma entrada da
--                     siempre el mismo resultado, y FIRMA puede descartar
--                     un código y recalcular sin volver a llamar al modelo.
--   Estados           pendiente (en la cola), en_revision (lo ve solo
--                     FIRMA), aprobado (lo ve el negocio), descartado (por
--                     FIRMA, con motivo), no_aplica (no es de venta),
--                     limite (el plan no tiene más análisis este mes),
--                     error y reemplazado (hay uno más nuevo).
--   Contenido         citas, justificaciones y pautas van cifradas con la
--                     clave interacciones_contenido y se conservan lo
--                     mismo que la llamada. En claro quedan los códigos,
--                     las intensidades y los puntajes, sin texto.
--   Lectura           solo por funciones. FIRMA ve todo; titular y CSM, el
--                     estado siempre y el análisis cuando está aprobado;
--                     closers y setters, nada. Abrir un análisis queda en
--                     la bitácora.
--   Perfil conductual al aprobar, los códigos con señal se suman al perfil
--                     del cliente como señales de origen llamada.
--   Carga manual      interaccion_cargar_manual() da de alta una llamada
--                     que no vino por Fathom, con la transcripción pegada.
-- =====================================================================

-- Eminent incluye el análisis. Los planes de producto ya lo traían (0040).
insert into public.planes_servicio_funcionalidades (plan, funcionalidad, limites) values
  ('eminent', 'analisis_llamadas', '{}')
on conflict (plan, funcionalidad) do nothing;

-- ---------------------------------------------------------------------
-- Señales del perfil conductual que salen de un análisis aprobado
-- ---------------------------------------------------------------------
insert into public.senal_tipos (clave, arquetipo, nombre, descripcion, origen, peso, orden) values
  ('llamada_resultado_garantizado', 'expectativa_resultado', 'Pidió un resultado garantizado en la venta', 'Código A1 de un análisis de llamada aprobado por FIRMA', 'llamada', 2, 10),
  ('llamada_expectativa_concreta',  'expectativa_resultado', 'Fijó una cifra o un plazo propio en la venta', 'Códigos A2 o A5 de un análisis de llamada aprobado por FIRMA', 'llamada', 1, 11),
  ('llamada_malentendido',          'expectativa_resultado', 'Malentendió la oferta en la venta', 'Código D3 de un análisis de llamada aprobado por FIRMA', 'llamada', 1, 12),
  ('llamada_tension_financiera',    'sensibilidad_precio',   'Declaró tensión financiera en la venta', 'Código D1 de un análisis de llamada aprobado por FIRMA', 'llamada', 2, 10),
  ('llamada_garantia_salida',       'sensibilidad_precio',   'Compró con la garantía como salida', 'Código B1 de un análisis de llamada aprobado por FIRMA', 'llamada', 1, 11),
  ('llamada_baja_disponibilidad',   'baja_adopcion',         'Declaró poca disponibilidad en la venta', 'Código D2 de un análisis de llamada aprobado por FIRMA', 'llamada', 1, 10),
  ('llamada_sin_compromiso',        'baja_adopcion',         'Deseo sin compromiso propio en la venta', 'Códigos F1 o F2 de un análisis de llamada aprobado por FIRMA', 'llamada', 1, 11),
  ('llamada_reclamo_previo',        'escalada_temprana',     'Contó un reclamo o reembolso previo', 'Código C1 de un análisis de llamada aprobado por FIRMA', 'llamada', 2, 10),
  ('llamada_canales_terceros',      'escalada_temprana',     'Mencionó abogados, denuncias o redes en la venta', 'Código E1 de un análisis de llamada aprobado por FIRMA', 'llamada', 2, 11)
on conflict (clave) do update set arquetipo = excluded.arquetipo, nombre = excluded.nombre, descripcion = excluded.descripcion,
  origen = excluded.origen, peso = excluded.peso, orden = excluded.orden;

alter table public.perfil_senales drop constraint if exists perfil_senales_evidencia_tabla_check;
alter table public.perfil_senales add constraint perfil_senales_evidencia_tabla_check
  check (evidencia_tabla in ('crm_pagos', 'crm_casos', 'interaccion_analisis'));

-- ---------------------------------------------------------------------
-- Libro de códigos
-- ---------------------------------------------------------------------
create table if not exists public.analisis_codigos (
  version     text not null check (version ~ '^[a-z]+-[0-9]+\.[0-9]+$'),
  codigo      text not null check (codigo ~ '^[A-Z][0-9]$'),
  tipo        text not null check (tipo in ('riesgo', 'protector', 'vendedor')),
  nombre      text not null,
  constructo  text,
  peso        int not null check (peso between 0 and 3),
  respaldo    text check (respaldo in ('fuerte', 'moderado', 'exploratorio')),
  senal_tipo  text references public.senal_tipos (clave),
  orden       int not null,
  primary key (version, codigo),
  constraint analisis_codigos_peso check ((tipo = 'vendedor') = (peso = 0))
);

-- Una versión publicada no cambia: lo que ya se analizó con ella tiene que
-- poder recalcularse igual. Para cambiar un peso, una versión nueva.
insert into public.analisis_codigos (version, codigo, tipo, nombre, constructo, peso, respaldo, senal_tipo, orden) values
  ('venta-1.1', 'A1', 'riesgo',    'Resultado garantizado', 'Confirmación de expectativas', 3, 'moderado', 'llamada_resultado_garantizado', 1),
  ('venta-1.1', 'A2', 'riesgo',    'Cifra o plazo concreto de resultado', 'Confirmación de expectativas', 2, 'moderado', 'llamada_expectativa_concreta', 2),
  ('venta-1.1', 'A3', 'riesgo',    'Anclaje en casos de éxito', 'Anclaje y prueba social', 1, 'exploratorio', null, 3),
  ('venta-1.1', 'A4', 'riesgo',    'Intensificación de la expectativa', 'Heurística afectiva', 1, 'exploratorio', null, 4),
  ('venta-1.1', 'A5', 'riesgo',    'Subestimación del tiempo', 'Falacia de planificación', 2, 'moderado', 'llamada_expectativa_concreta', 5),
  ('venta-1.1', 'B1', 'riesgo',    'Garantía como salida', 'Riesgo percibido', 3, 'moderado', 'llamada_garantia_salida', 6),
  ('venta-1.1', 'B2', 'riesgo',    'Ambivalencia no resuelta al cierre', 'Disonancia posterior a la compra', 2, 'moderado', null, 7),
  ('venta-1.1', 'B3', 'riesgo',    'Decisión compartida con tercero ausente', 'Decisión conjunta', 2, 'exploratorio', null, 8),
  ('venta-1.1', 'B4', 'riesgo',    'Decisión sin deliberación', 'Compra por impulso', 1, 'exploratorio', null, 9),
  ('venta-1.1', 'B5', 'riesgo',    'Reactancia ante la presión', 'Reactancia psicológica', 2, 'moderado', null, 10),
  ('venta-1.1', 'C1', 'riesgo',    'Reclamo o reembolso previo', 'Conducta pasada', 3, 'fuerte', 'llamada_reclamo_previo', 11),
  ('venta-1.1', 'C2', 'riesgo',    'Mala experiencia previa sin reclamo', 'Conducta pasada', 1, 'moderado', null, 12),
  ('venta-1.1', 'C3', 'riesgo',    'Atribución externa exclusiva del fracaso previo', 'Atribución causal', 2, 'moderado', null, 13),
  ('venta-1.1', 'D1', 'riesgo',    'Tensión financiera declarada', 'Escasez', 3, 'moderado', 'llamada_tension_financiera', 14),
  ('venta-1.1', 'D2', 'riesgo',    'Baja disponibilidad para ejecutar', 'Expectativa de esfuerzo y resultado', 2, 'exploratorio', 'llamada_baja_disponibilidad', 15),
  ('venta-1.1', 'D3', 'riesgo',    'Malentendido de la oferta', 'Confirmación de expectativas', 2, 'moderado', 'llamada_malentendido', 16),
  ('venta-1.1', 'E1', 'riesgo',    'Mención espontánea de canales de terceros', 'Conducta de queja e intención', 3, 'moderado', 'llamada_canales_terceros', 17),
  ('venta-1.1', 'F1', 'riesgo',    'Deseo sin compromiso', 'Lenguaje de compromiso', 2, 'moderado', 'llamada_sin_compromiso', 18),
  ('venta-1.1', 'F2', 'riesgo',    'Resultado en manos de otro', 'Agencia y atribución', 2, 'exploratorio', 'llamada_sin_compromiso', 19),
  ('venta-1.1', 'P1', 'protector', 'Expectativa calibrada', 'Confirmación de expectativas', 2, 'moderado', null, 20),
  ('venta-1.1', 'P2', 'protector', 'Atribución que incluye el rol propio', 'Atribución causal', 1, 'moderado', null, 21),
  ('venta-1.1', 'P3', 'protector', 'Comprensión verificada', 'Confirmación de expectativas', 2, 'moderado', null, 22),
  ('venta-1.1', 'P4', 'protector', 'Decisión deliberada', 'Decisión conjunta', 1, 'exploratorio', null, 23),
  ('venta-1.1', 'P5', 'protector', 'Antecedente de finalización', 'Conducta pasada', 1, 'moderado', null, 24),
  ('venta-1.1', 'P6', 'protector', 'Plan concreto de implementación', 'Intención de implementación', 2, 'fuerte', null, 25),
  ('venta-1.1', 'V1', 'vendedor',  'Promete o sugiere resultados concretos', null, 0, null, null, 26),
  ('venta-1.1', 'V2', 'vendedor',  'Describe la garantía distinto de la política', null, 0, null, null, 27),
  ('venta-1.1', 'V3', 'vendedor',  'Presión temporal o escasez artificial', null, 0, null, null, 28),
  ('venta-1.1', 'V4', 'vendedor',  'Deja sin corregir una expectativa o un malentendido', null, 0, null, null, 29)
on conflict (version, codigo) do nothing;

-- ---------------------------------------------------------------------
-- Análisis
-- ---------------------------------------------------------------------
create table if not exists public.interaccion_analisis (
  id                     uuid primary key default gen_random_uuid(),
  organizacion_id        uuid not null references public.organizaciones (id) on delete cascade,
  interaccion_id         uuid not null,
  version                text not null,
  -- FIRMA puede pedir que se analice como venta aunque el modelo la clasifique distinto.
  etapa_pedida           text check (etapa_pedida in ('venta')),
  estado                 text not null default 'pendiente'
                         check (estado in ('pendiente', 'en_revision', 'aprobado', 'descartado', 'no_aplica', 'limite', 'error', 'reemplazado')),
  etapa                  text check (etapa in ('venta', 'onboarding', 'seguimiento', 'soporte', 'otra')),
  confianza              text check (confianza in ('alta', 'media', 'baja', 'no_evaluable')),
  palabras_prospecto     integer check (palabras_prospecto >= 0),
  -- [{codigo, tipo, intensidad, peso, puntos, descartado, corregido}], sin texto.
  codigos                jsonb not null default '[]'::jsonb,
  puntaje_riesgo         integer,
  puntaje_protector      integer,
  puntaje_neto           integer,
  banda_puntaje          text check (banda_puntaje in ('bajo', 'medio', 'alto')),
  banda_final            text check (banda_final in ('bajo', 'medio', 'alto')),
  reglas                 text[] not null default '{}',
  alerta_vulnerabilidad  boolean not null default false,
  -- El informe completo (citas, justificaciones, pautas), cifrado.
  detalle_cifrado        bytea,
  detalle_sha256         text,
  retener_detalle_hasta  timestamptz,
  -- Lo que corrigió FIRMA: [{codigo, accion, motivo, por, en}].
  correcciones           jsonb not null default '[]'::jsonb,
  modelo                 text,
  tokens_entrada         integer,
  tokens_salida          integer,
  error                  text,
  solicitado_por         uuid references auth.users (id) on delete set null,
  creado_en              timestamptz not null default now(),
  analizado_en           timestamptz,
  revisado_por           uuid references auth.users (id) on delete set null,
  revisado_en            timestamptz,
  motivo                 text,
  unique (organizacion_id, id),
  constraint interaccion_analisis_interaccion_fk foreign key (organizacion_id, interaccion_id)
    references public.interacciones (organizacion_id, id) on delete cascade,
  constraint interaccion_analisis_version check (version ~ '^[a-z]+-[0-9]+\.[0-9]+$'),
  constraint interaccion_analisis_aprobado check (estado <> 'aprobado' or (revisado_por is not null and revisado_en is not null)),
  constraint interaccion_analisis_descartado check (estado <> 'descartado' or length(trim(coalesce(motivo, ''))) >= 3)
);

-- Un análisis vigente por llamada. Los anteriores quedan como reemplazados.
create unique index if not exists interaccion_analisis_vigente_idx on public.interaccion_analisis (interaccion_id) where estado <> 'reemplazado';
create index if not exists interaccion_analisis_org_idx on public.interaccion_analisis (organizacion_id, creado_en desc);
create index if not exists interaccion_analisis_revision_idx on public.interaccion_analisis (creado_en) where estado = 'en_revision';

-- ---------------------------------------------------------------------
-- analisis_puntuar(version, códigos, confianza): el cálculo.
-- Recibe [{codigo, intensidad, descartado, corregido}] y devuelve los
-- códigos del catálogo con peso y puntos, los puntajes, la banda por
-- puntaje, las reglas de mínimo que aplican, la banda final y la alerta
-- de vulnerabilidad. Un código que no está en el catálogo se ignora; uno
-- repetido cuenta una vez, con la intensidad más alta.
--   Bandas   neto 0 a 5 bajo, 6 a 11 medio, 12 o más alto.
--   R1       C1 con intensidad 2                          alto
--   R2       D1 y B1 a la vez                             alto
--   R3       E1 con intensidad 2                          alto
--   R4       A1 sin corrección del vendedor               medio
--   R5       B5 con intensidad 2                          medio
--   Alerta   D1 con intensidad 2
-- Con confianza no_evaluable no hay banda.
-- ---------------------------------------------------------------------
create or replace function public.analisis_puntuar(p_version text, p_codigos jsonb, p_confianza text)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  codigos jsonb;
  riesgo int;
  protector int;
  neto int;
  banda text;
  final text;
  reglas text[] := '{}';
  minimo int := 1;
  bandas text[] := array['bajo', 'medio', 'alto'];
  vigente jsonb;
begin
  if p_version not like 'venta-1.%' then
    raise exception 'No hay reglas de puntaje para la versión %.', p_version;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo', k.codigo, 'tipo', k.tipo, 'intensidad', e.intensidad, 'peso', k.peso,
           'puntos', case when e.descartado then 0 else k.peso * e.intensidad end,
           'descartado', e.descartado, 'corregido', e.corregido) order by k.orden), '[]'::jsonb)
  into codigos
  from (
    select x.codigo,
           least(greatest(max(coalesce(x.intensidad, 0)), 0), 2) as intensidad,
           coalesce(bool_or(x.descartado), false) as descartado,
           coalesce(bool_or(x.corregido), false) as corregido
    from jsonb_to_recordset(case when jsonb_typeof(p_codigos) = 'array' then p_codigos else '[]'::jsonb end)
         as x (codigo text, intensidad int, descartado boolean, corregido boolean)
    group by x.codigo
  ) e
  join analisis_codigos k on k.version = p_version and k.codigo = e.codigo
  where e.intensidad > 0;

  select coalesce(sum((c ->> 'puntos')::int) filter (where c ->> 'tipo' = 'riesgo'), 0),
         coalesce(sum((c ->> 'puntos')::int) filter (where c ->> 'tipo' = 'protector'), 0)
  into riesgo, protector
  from jsonb_array_elements(codigos) c;
  neto := greatest(riesgo - protector, 0);
  banda := case when neto >= 12 then 'alto' when neto >= 6 then 'medio' else 'bajo' end;

  -- Las reglas miran solo lo que no se descartó.
  select coalesce(jsonb_object_agg(c ->> 'codigo', c), '{}'::jsonb) into vigente
  from jsonb_array_elements(codigos) c where not (c ->> 'descartado')::boolean;

  if (vigente -> 'C1' ->> 'intensidad')::int = 2 then reglas := array_append(reglas, 'R1'); minimo := 3; end if;
  if vigente ? 'D1' and vigente ? 'B1' then reglas := array_append(reglas, 'R2'); minimo := 3; end if;
  if (vigente -> 'E1' ->> 'intensidad')::int = 2 then reglas := array_append(reglas, 'R3'); minimo := 3; end if;
  if vigente ? 'A1' and not (vigente -> 'A1' ->> 'corregido')::boolean then reglas := array_append(reglas, 'R4'); minimo := greatest(minimo, 2); end if;
  if (vigente -> 'B5' ->> 'intensidad')::int = 2 then reglas := array_append(reglas, 'R5'); minimo := greatest(minimo, 2); end if;

  final := bandas[greatest(array_position(bandas, banda), minimo)];
  if p_confianza = 'no_evaluable' then
    banda := null;
    final := null;
  end if;

  return jsonb_build_object(
    'codigos', codigos, 'riesgo', riesgo, 'protector', protector, 'neto', neto,
    'banda_puntaje', banda, 'banda_final', final, 'reglas', to_jsonb(reglas),
    'alerta_vulnerabilidad', coalesce((vigente -> 'D1' ->> 'intensidad')::int = 2, false));
end;
$$;

-- ---------------------------------------------------------------------
-- analisis_senales_sync(análisis): deja el perfil conductual del cliente
-- de acuerdo con el análisis. Aprobado y con cliente, suma una señal por
-- cada tipo de señal de sus códigos vigentes. Si dejó de estar aprobado o
-- la llamada pasó a otro cliente, descarta las que había sumado.
-- Una señal ya descartada no vuelve: para el cliente nuevo de una llamada
-- reasignada, FIRMA la vuelve a analizar.
-- ---------------------------------------------------------------------
create or replace function public.analisis_senales_sync(p_analisis uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  a interaccion_analisis%rowtype;
  x interacciones%rowtype;
begin
  select * into a from interaccion_analisis where id = p_analisis;
  if not found then
    return;
  end if;
  select * into x from interacciones where id = a.interaccion_id;

  update perfil_senales set
    descartada_en = now(),
    motivo_descarte = case when a.estado <> 'aprobado' then 'El análisis de la llamada ya no está aprobado'
                           else 'La llamada se asignó a otro cliente' end
  where evidencia_tabla = 'interaccion_analisis' and evidencia_id = a.id and descartada_en is null
    and (a.estado <> 'aprobado' or cliente_id is distinct from x.cliente_id);

  if a.estado <> 'aprobado' or x.cliente_id is null or not tiene_funcionalidad(a.organizacion_id, 'perfiles_conductuales') then
    return;
  end if;

  insert into perfil_senales (organizacion_id, cliente_id, tipo, origen, evidencia_tabla, evidencia_id, detalle, ocurrida_en, registrada_por)
  select a.organizacion_id, x.cliente_id, k.senal_tipo, 'llamada', 'interaccion_analisis', a.id,
         left(format('Llamada del %s, análisis aprobado por FIRMA: %s',
                     to_char(x.ocurrida_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY'),
                     string_agg(k.codigo || ' ' || k.nombre, ', ' order by k.orden)), 500),
         least((x.ocurrida_en at time zone 'America/Argentina/Buenos_Aires')::date, current_date),
         a.revisado_por
  from jsonb_to_recordset(a.codigos) as c (codigo text, intensidad int, descartado boolean)
  join analisis_codigos k on k.version = a.version and k.codigo = c.codigo
  join senal_tipos t on t.clave = k.senal_tipo and t.activo
  where coalesce(c.intensidad, 0) > 0 and not coalesce(c.descartado, false)
  group by k.senal_tipo
  on conflict (tipo, evidencia_id) where evidencia_id is not null do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- analisis_encolar_interno(llamada, como venta, sin límite): crea el
-- análisis y lo encola. El análisis vigente anterior, si hay, queda
-- reemplazado (y si estaba aprobado, sus señales se descartan). Si el
-- plan tiene límite mensual y ya se usó, el análisis queda en limite y no
-- se encola. Lo usan las funciones de esta migración; nadie lo llama
-- directo.
-- ---------------------------------------------------------------------
create or replace function public.analisis_encolar_interno(p_interaccion uuid, p_forzar_venta boolean, p_sin_limite boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  x interacciones%rowtype;
  actual interaccion_analisis%rowtype;
  tope int;
  usados int;
  nuevo uuid;
  estado_nuevo text := 'pendiente';
begin
  select * into x from interacciones where id = p_interaccion for update;
  if not found then
    raise exception 'No existe esa llamada.';
  end if;
  if x.contenido_cifrado is null or (x.retener_contenido_hasta is not null and x.retener_contenido_hasta <= now()) then
    raise exception 'La llamada ya no tiene la transcripción guardada.';
  end if;
  if not tiene_funcionalidad(x.organizacion_id, 'analisis_llamadas') then
    raise exception 'El plan del negocio no incluye el análisis de llamadas.';
  end if;

  tope := nullif(limite_funcionalidad(x.organizacion_id, 'analisis_llamadas') ->> 'llamadas_mes', '')::int;
  if tope is not null and not coalesce(p_sin_limite, false) then
    select count(distinct a.interaccion_id) into usados
    from interaccion_analisis a
    where a.organizacion_id = x.organizacion_id
      and a.interaccion_id <> x.id
      and a.estado in ('pendiente', 'en_revision', 'aprobado', 'descartado', 'error')
      and a.creado_en >= (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires');
    if usados >= tope then
      estado_nuevo := 'limite';
    end if;
  end if;

  select * into actual from interaccion_analisis where interaccion_id = x.id and estado <> 'reemplazado' for update;
  if found then
    update interaccion_analisis set estado = 'reemplazado' where id = actual.id;
    if actual.estado = 'aprobado' then
      perform analisis_senales_sync(actual.id);
    end if;
  end if;

  insert into interaccion_analisis (organizacion_id, interaccion_id, version, etapa_pedida, estado, solicitado_por)
  values (x.organizacion_id, x.id, 'venta-1.1', case when p_forzar_venta then 'venta' end, estado_nuevo, auth.uid())
  returning id into nuevo;

  if estado_nuevo = 'pendiente' then
    perform cola_encolar('interaccion_analizar', x.organizacion_id, jsonb_build_object('analisis_id', nuevo), 'interaccion_analizar:' || nuevo);
  end if;
  return nuevo;
end;
$$;

-- ---------------------------------------------------------------------
-- analisis_solicitar(llamada, como venta): pedir el análisis desde el
-- portal. Titular, CSM y FIRMA piden el de una llamada que no tiene, o que
-- quedó en limite o en error. Volver a analizar una llamada ya analizada,
-- o pedir que se analice como venta, lo hace FIRMA (sin límite del plan).
-- ---------------------------------------------------------------------
create or replace function public.analisis_solicitar(p_interaccion uuid, p_forzar_venta boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  x interacciones%rowtype;
  staff boolean := es_staff();
  nuevo uuid;
begin
  select * into x from interacciones where id = p_interaccion;
  if not found or not puede_ver_casos(x.organizacion_id) then
    raise exception 'No existe esa llamada o no tenés acceso.' using errcode = '42501';
  end if;
  if not staff and (coalesce(p_forzar_venta, false) or exists (
      select 1 from interaccion_analisis a where a.interaccion_id = x.id and a.estado not in ('reemplazado', 'limite', 'error'))) then
    raise exception 'Volver a analizar una llamada lo hace FIRMA.' using errcode = '42501';
  end if;

  nuevo := analisis_encolar_interno(x.id, coalesce(p_forzar_venta, false), staff);

  insert into registro_accesos (usuario_id, actor_id, accion, organizacion_id, objeto_tipo, objeto_id, detalle)
  values (auth.uid(), auth.uid(), 'analisis_solicitado', x.organizacion_id, 'interaccion', x.id::text,
          jsonb_build_object('organizacion_id', x.organizacion_id, 'analisis_id', nuevo, 'como_venta', coalesce(p_forzar_venta, false)));
  return nuevo;
end;
$$;

-- ---------------------------------------------------------------------
-- Disparadores sobre las llamadas. Al quedar vinculada, una llamada se
-- analiza sola si el plan lo incluye (un error acá no frena el vínculo).
-- Si cambia el cliente, el perfil conductual sigue a la llamada.
-- ---------------------------------------------------------------------
create or replace function public.interacciones_despues()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  aprobado uuid;
begin
  if old.estado = 'recibida' and new.estado = 'vinculada' and new.contenido_cifrado is not null
     and tiene_funcionalidad(new.organizacion_id, 'analisis_llamadas')
     and not exists (select 1 from interaccion_analisis a where a.interaccion_id = new.id and a.estado <> 'reemplazado') then
    begin
      perform analisis_encolar_interno(new.id, false, false);
    exception when others then
      raise warning 'No se pudo encolar el análisis de la llamada %: %', new.id, sqlerrm;
    end;
  end if;

  if new.cliente_id is distinct from old.cliente_id then
    select a.id into aprobado from interaccion_analisis a where a.interaccion_id = new.id and a.estado = 'aprobado';
    if aprobado is not null then
      perform analisis_senales_sync(aprobado);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists interacciones_despues on public.interacciones;
create trigger interacciones_despues after update on public.interacciones
  for each row execute function public.interacciones_despues();

-- ---------------------------------------------------------------------
-- Del lado del servidor (service_role): leer lo que se analiza, guardar
-- el resultado y marcar un error.
-- ---------------------------------------------------------------------

-- La llamada descifrada y el equipo del negocio, para armar la
-- transcripción con roles. null si el análisis ya no está pendiente.
create or replace function public.analisis_contenido(p_analisis uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  a interaccion_analisis%rowtype;
  x interacciones%rowtype;
begin
  select * into a from interaccion_analisis where id = p_analisis;
  if not found or a.estado <> 'pendiente' then
    return null;
  end if;
  select * into x from interacciones where id = a.interaccion_id;
  if x.contenido_cifrado is null or (x.retener_contenido_hasta is not null and x.retener_contenido_hasta <= now()) then
    return jsonb_build_object('analisis_id', a.id, 'sin_contenido', true);
  end if;
  return jsonb_build_object(
    'analisis_id', a.id,
    'version', a.version,
    'forzar_venta', a.etapa_pedida = 'venta',
    'titulo', x.titulo,
    'ocurrida_en', x.ocurrida_en,
    'duracion_seg', x.duracion_seg,
    'fuente', x.fuente,
    'contenido', pgp_sym_decrypt(x.contenido_cifrado, crm_clave('interacciones_contenido'))::jsonb,
    'equipo', coalesce((select jsonb_agg(jsonb_build_object('nombre', e.nombre, 'email', lower(trim(e.email))))
                        from equipo_miembros e where e.organizacion_id = x.organizacion_id), '[]'::jsonb));
end;
$$;

-- Guarda el resultado del modelo. p_resultado:
--   {etapa, confianza, palabras_prospecto, codigos: [{codigo, intensidad, corregido}],
--    detalle: {...informe completo...}, modelo, tokens_entrada, tokens_salida}
-- Si no es de venta (y FIRMA no pidió analizarla como venta) queda en
-- no_aplica, con la clasificación. Si es de venta, se puntúa y queda en
-- revisión de FIRMA.
create or replace function public.analisis_guardar(p_analisis uuid, p_resultado jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  a interaccion_analisis%rowtype;
  v_etapa text := p_resultado ->> 'etapa';
  v_confianza text := p_resultado ->> 'confianza';
  v_detalle text := coalesce(p_resultado -> 'detalle', '{}'::jsonb)::text;
  v_retener timestamptz;
  es_venta boolean;
  p jsonb;
  nuevo_estado text;
begin
  select * into a from interaccion_analisis where id = p_analisis for update;
  if not found then
    raise exception 'No existe ese análisis.';
  end if;
  if a.estado <> 'pendiente' then
    return jsonb_build_object('ignorado', a.estado);
  end if;
  if v_etapa is null or v_etapa not in ('venta', 'onboarding', 'seguimiento', 'soporte', 'otra') then
    raise exception 'La etapa de la llamada no es válida.';
  end if;
  if v_confianza is not null and v_confianza not in ('alta', 'media', 'baja', 'no_evaluable') then
    raise exception 'La confianza del análisis no es válida.';
  end if;

  es_venta := v_etapa = 'venta' or a.etapa_pedida = 'venta';
  nuevo_estado := case when es_venta then 'en_revision' else 'no_aplica' end;
  if es_venta then
    p := analisis_puntuar(a.version, p_resultado -> 'codigos', v_confianza);
  end if;
  select retener_contenido_hasta into v_retener from interacciones where id = a.interaccion_id;

  update interaccion_analisis set
    estado = nuevo_estado,
    etapa = v_etapa,
    confianza = v_confianza,
    palabras_prospecto = case when (p_resultado ->> 'palabras_prospecto') ~ '^\d+$' then (p_resultado ->> 'palabras_prospecto')::int end,
    codigos = coalesce(p -> 'codigos', '[]'::jsonb),
    puntaje_riesgo = (p ->> 'riesgo')::int,
    puntaje_protector = (p ->> 'protector')::int,
    puntaje_neto = (p ->> 'neto')::int,
    banda_puntaje = p ->> 'banda_puntaje',
    banda_final = p ->> 'banda_final',
    reglas = coalesce(array(select jsonb_array_elements_text(p -> 'reglas')), '{}'),
    alerta_vulnerabilidad = coalesce((p ->> 'alerta_vulnerabilidad')::boolean, false),
    detalle_cifrado = pgp_sym_encrypt(v_detalle, crm_clave('interacciones_contenido'), 'cipher-algo=aes256'),
    detalle_sha256 = encode(digest(v_detalle, 'sha256'), 'hex'),
    retener_detalle_hasta = v_retener,
    modelo = left(p_resultado ->> 'modelo', 100),
    tokens_entrada = case when (p_resultado ->> 'tokens_entrada') ~ '^\d+$' then (p_resultado ->> 'tokens_entrada')::int end,
    tokens_salida = case when (p_resultado ->> 'tokens_salida') ~ '^\d+$' then (p_resultado ->> 'tokens_salida')::int end,
    error = null,
    analizado_en = now()
  where id = a.id;

  update interacciones set
    etapa_comercial = case when v_etapa = 'otra' then etapa_comercial else v_etapa end,
    estado = case when es_venta then 'analizada' else 'clasificada' end
  where id = a.interaccion_id and estado in ('recibida', 'vinculada', 'clasificada', 'analizada');

  return jsonb_build_object('estado', nuevo_estado, 'banda_final', p ->> 'banda_final');
end;
$$;

create or replace function public.analisis_error(p_analisis uuid, p_error text)
returns void language sql security definer set search_path = public as $$
  update interaccion_analisis set estado = 'error', error = left(coalesce(p_error, 'Error sin detalle'), 500)
  where id = p_analisis and estado = 'pendiente';
$$;

-- ---------------------------------------------------------------------
-- Del lado del portal
-- ---------------------------------------------------------------------

-- El análisis vigente de cada llamada del negocio. La banda y la alerta
-- se ven solo aprobadas, salvo para FIRMA. Un trabajo que agotó sus
-- intentos se informa como error.
create or replace function public.analisis_listado(p_org uuid)
returns table (interaccion_id uuid, analisis_id uuid, estado text, etapa text, banda_final text,
               alerta_vulnerabilidad boolean, creado_en timestamptz, analizado_en timestamptz, revisado_en timestamptz)
language sql stable security definer set search_path = public as $$
  select a.interaccion_id, a.id,
         case when a.estado = 'pendiente' and exists (
                select 1 from cola_trabajos j
                where j.clave_idempotencia = 'interaccion_analizar:' || a.id and j.estado = 'fallido') then 'error'
              else a.estado end,
         a.etapa,
         case when public.es_staff() or a.estado = 'aprobado' then a.banda_final end,
         case when public.es_staff() or a.estado = 'aprobado' then a.alerta_vulnerabilidad end,
         a.creado_en, a.analizado_en, a.revisado_en
  from interaccion_analisis a
  where a.organizacion_id = p_org and a.estado <> 'reemplazado' and public.puede_ver_casos(p_org);
$$;

-- El análisis completo. Titular y CSM lo leen aprobado; antes, solo el
-- estado. FIRMA lo lee siempre, con sus correcciones. Queda en la
-- bitácora (una vez cada 30 minutos por persona).
create or replace function public.analisis_leer(p_analisis uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  a interaccion_analisis%rowtype;
  x interacciones%rowtype;
  staff boolean := es_staff();
  v_detalle jsonb;
begin
  select * into a from interaccion_analisis where id = p_analisis;
  if not found or not puede_ver_casos(a.organizacion_id) then
    raise exception 'No existe ese análisis o no tenés acceso.' using errcode = '42501';
  end if;
  select * into x from interacciones where id = a.interaccion_id;

  if not staff and a.estado <> 'aprobado' then
    return jsonb_build_object('id', a.id, 'interaccion_id', a.interaccion_id, 'visible', false,
                              'estado', a.estado, 'etapa', a.etapa, 'motivo', case when a.estado = 'descartado' then a.motivo end);
  end if;

  if a.detalle_cifrado is not null and (a.retener_detalle_hasta is null or a.retener_detalle_hasta > now()) then
    v_detalle := pgp_sym_decrypt(a.detalle_cifrado, crm_clave('interacciones_contenido'))::jsonb;
  end if;

  if auth.uid() is not null and not exists (
    select 1 from registro_accesos r
    where r.actor_id = auth.uid() and r.accion = 'lectura_analisis' and r.objeto_id = a.id::text
      and r.creado_en > now() - interval '30 minutes'
  ) then
    insert into registro_accesos (usuario_id, actor_id, accion, organizacion_id, objeto_tipo, objeto_id, detalle)
    values (auth.uid(), auth.uid(), 'lectura_analisis', a.organizacion_id, 'interaccion_analisis', a.id::text,
            jsonb_build_object('organizacion_id', a.organizacion_id, 'titulo', left(coalesce(x.titulo, 'Llamada'), 160)));
  end if;

  return jsonb_build_object(
    'id', a.id, 'interaccion_id', a.interaccion_id, 'visible', true, 'es_staff', staff,
    'estado', a.estado, 'version', a.version, 'etapa', a.etapa, 'etapa_pedida', a.etapa_pedida,
    'confianza', a.confianza, 'palabras_prospecto', a.palabras_prospecto, 'codigos', a.codigos,
    'puntaje_riesgo', a.puntaje_riesgo, 'puntaje_protector', a.puntaje_protector, 'puntaje_neto', a.puntaje_neto,
    'banda_puntaje', a.banda_puntaje, 'banda_final', a.banda_final, 'reglas', to_jsonb(a.reglas),
    'alerta_vulnerabilidad', a.alerta_vulnerabilidad, 'detalle', v_detalle,
    'detalle_vencido', a.detalle_cifrado is not null and v_detalle is null,
    'correcciones', case when staff then a.correcciones else '[]'::jsonb end,
    'modelo', case when staff then a.modelo end, 'error', case when staff then a.error end,
    'motivo', a.motivo, 'creado_en', a.creado_en, 'analizado_en', a.analizado_en, 'revisado_en', a.revisado_en,
    'titulo', x.titulo, 'ocurrida_en', x.ocurrida_en, 'duracion_seg', x.duracion_seg, 'fuente', x.fuente);
end;
$$;

-- ---------------------------------------------------------------------
-- Revisión de FIRMA
-- ---------------------------------------------------------------------

-- Descartar (o restaurar) un código de un análisis en revisión. Descartar
-- exige motivo. Recalcula el puntaje y lo anota en las correcciones.
create or replace function public.analisis_corregir(p_analisis uuid, p_codigo text, p_descartar boolean, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a interaccion_analisis%rowtype;
  nuevos jsonb;
  p jsonb;
begin
  if not es_staff() then
    raise exception 'La revisión del análisis la hace FIRMA.' using errcode = '42501';
  end if;
  select * into a from interaccion_analisis where id = p_analisis for update;
  if not found then
    raise exception 'No existe ese análisis.';
  end if;
  if a.estado <> 'en_revision' then
    raise exception 'Solo se corrige un análisis en revisión.';
  end if;
  if not exists (select 1 from jsonb_array_elements(a.codigos) c where c ->> 'codigo' = p_codigo) then
    raise exception 'Ese código no está en el análisis.';
  end if;
  if p_descartar and length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Para descartar un código hace falta el motivo.';
  end if;

  select jsonb_agg(case when c ->> 'codigo' = p_codigo then c || jsonb_build_object('descartado', p_descartar) else c end)
  into nuevos from jsonb_array_elements(a.codigos) c;
  p := analisis_puntuar(a.version, nuevos, a.confianza);

  update interaccion_analisis set
    codigos = p -> 'codigos',
    puntaje_riesgo = (p ->> 'riesgo')::int,
    puntaje_protector = (p ->> 'protector')::int,
    puntaje_neto = (p ->> 'neto')::int,
    banda_puntaje = p ->> 'banda_puntaje',
    banda_final = p ->> 'banda_final',
    reglas = coalesce(array(select jsonb_array_elements_text(p -> 'reglas')), '{}'),
    alerta_vulnerabilidad = coalesce((p ->> 'alerta_vulnerabilidad')::boolean, false),
    correcciones = correcciones || jsonb_build_array(jsonb_build_object(
      'codigo', p_codigo, 'accion', case when p_descartar then 'descartado' else 'restaurado' end,
      'motivo', nullif(trim(coalesce(p_motivo, '')), ''), 'por', auth.uid(), 'en', now()))
  where id = a.id;

  insert into registro_accesos (usuario_id, actor_id, accion, organizacion_id, objeto_tipo, objeto_id, detalle)
  values (auth.uid(), auth.uid(), 'analisis_corregido', a.organizacion_id, 'interaccion_analisis', a.id::text,
          jsonb_build_object('organizacion_id', a.organizacion_id, 'codigo', p_codigo, 'descartado', p_descartar));
  return p;
end;
$$;

-- Aprobar: desde acá lo ven el titular y el CSM, y sus códigos con señal
-- entran al perfil conductual del cliente.
create or replace function public.analisis_aprobar(p_analisis uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  a interaccion_analisis%rowtype;
begin
  if not es_staff() then
    raise exception 'La revisión del análisis la hace FIRMA.' using errcode = '42501';
  end if;
  select * into a from interaccion_analisis where id = p_analisis for update;
  if not found then
    raise exception 'No existe ese análisis.';
  end if;
  if a.estado <> 'en_revision' then
    raise exception 'Solo se aprueba un análisis en revisión.';
  end if;

  update interaccion_analisis set estado = 'aprobado', revisado_por = auth.uid(), revisado_en = now() where id = a.id;
  perform analisis_senales_sync(a.id);

  insert into registro_accesos (usuario_id, actor_id, accion, organizacion_id, objeto_tipo, objeto_id, detalle)
  values (auth.uid(), auth.uid(), 'analisis_aprobado', a.organizacion_id, 'interaccion_analisis', a.id::text,
          jsonb_build_object('organizacion_id', a.organizacion_id, 'banda_final', a.banda_final));
end;
$$;

-- Descartar el análisis entero, en revisión o ya aprobado. Exige motivo,
-- que el negocio ve. Si estaba aprobado, sus señales se descartan.
create or replace function public.analisis_descartar(p_analisis uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  a interaccion_analisis%rowtype;
begin
  if not es_staff() then
    raise exception 'La revisión del análisis la hace FIRMA.' using errcode = '42501';
  end if;
  select * into a from interaccion_analisis where id = p_analisis for update;
  if not found then
    raise exception 'No existe ese análisis.';
  end if;
  if a.estado not in ('en_revision', 'aprobado', 'no_aplica') then
    raise exception 'Ese análisis no se puede descartar.';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Para descartar el análisis hace falta el motivo.';
  end if;

  update interaccion_analisis set estado = 'descartado', motivo = trim(p_motivo), revisado_por = auth.uid(), revisado_en = now()
  where id = a.id;
  if a.estado = 'aprobado' then
    perform analisis_senales_sync(a.id);
  end if;

  insert into registro_accesos (usuario_id, actor_id, accion, organizacion_id, objeto_tipo, objeto_id, detalle)
  values (auth.uid(), auth.uid(), 'analisis_descartado', a.organizacion_id, 'interaccion_analisis', a.id::text,
          jsonb_build_object('organizacion_id', a.organizacion_id, 'estado_anterior', a.estado));
end;
$$;

-- ---------------------------------------------------------------------
-- interaccion_cargar_manual(): una llamada que no vino por Fathom, con la
-- transcripción que pegó alguien del negocio o de FIRMA. p_contenido:
--   {transcripcion: [{hablante, segundo, texto}], roles: {hablante: 'prospecto' | 'vendedor'}}
-- Queda vinculada, cifrada por 90 días como las de Fathom, y se encola su
-- análisis. La cargan titular, CSM y FIRMA.
-- ---------------------------------------------------------------------
create or replace function public.interaccion_cargar_manual(
  p_org uuid, p_titulo text, p_ocurrida_en timestamptz, p_cliente uuid, p_miembro uuid, p_contenido jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  segmentos jsonb;
  roles jsonb;
  texto text;
  dur int;
  nueva uuid;
  analisis uuid;
begin
  if not puede_ver_casos(p_org) then
    raise exception 'No tenés acceso a ese negocio.' using errcode = '42501';
  end if;
  if not tiene_funcionalidad(p_org, 'analisis_llamadas') then
    raise exception 'El plan del negocio no incluye el análisis de llamadas.';
  end if;
  if jsonb_typeof(p_contenido -> 'transcripcion') is distinct from 'array' then
    raise exception 'Falta la transcripción.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'hablante', left(nullif(trim(s ->> 'hablante'), ''), 120),
           'email', null,
           'segundo', case when (s ->> 'segundo') ~ '^\d{1,6}$' then (s ->> 'segundo')::int end,
           'texto', left(trim(s ->> 'texto'), 20000))), '[]'::jsonb)
  into segmentos
  from jsonb_array_elements(p_contenido -> 'transcripcion') s
  where jsonb_typeof(s) = 'object' and length(trim(coalesce(s ->> 'texto', ''))) > 0;
  if jsonb_array_length(segmentos) < 3 then
    raise exception 'La transcripción es demasiado corta para analizarla.';
  end if;

  select coalesce(jsonb_object_agg(left(r.key, 120), r.value), '{}'::jsonb) into roles
  from jsonb_each(case when jsonb_typeof(p_contenido -> 'roles') = 'object' then p_contenido -> 'roles' else '{}'::jsonb end) r
  where r.value in ('"prospecto"'::jsonb, '"vendedor"'::jsonb);

  texto := jsonb_build_object('enlace', null, 'invitados', '[]'::jsonb, 'grabado_por', null,
                              'roles', roles, 'transcripcion', segmentos)::text;
  if length(texto) > 3000000 then
    raise exception 'La transcripción es demasiado larga.';
  end if;
  if p_cliente is not null and not exists (select 1 from crm_clientes k where k.id = p_cliente and k.organizacion_id = p_org) then
    raise exception 'Ese cliente no es de este negocio.';
  end if;
  if p_miembro is not null and not exists (select 1 from equipo_miembros e where e.id = p_miembro and e.organizacion_id = p_org) then
    raise exception 'Esa persona no es del equipo de este negocio.';
  end if;
  if p_ocurrida_en is not null and p_ocurrida_en > now() + interval '1 day' then
    raise exception 'La fecha de la llamada no puede ser futura.';
  end if;
  select max((s ->> 'segundo')::int) into dur from jsonb_array_elements(segmentos) s where s ->> 'segundo' is not null;

  insert into interacciones (organizacion_id, equipo_miembro_id, cliente_id, fuente, externo_id, titulo, ocurrida_en, duracion_seg,
                             participantes, contenido_cifrado, contenido_sha256, retener_contenido_hasta, estado, asignado_por, asignado_en)
  values (p_org, p_miembro, p_cliente, 'manual', gen_random_uuid()::text,
          left(coalesce(nullif(trim(p_titulo), ''), 'Llamada cargada a mano'), 300),
          coalesce(p_ocurrida_en, now()), dur,
          jsonb_build_object('equipo', case when p_miembro is null then '[]'::jsonb else jsonb_build_array(p_miembro) end,
                             'clientes', case when p_cliente is null then '[]'::jsonb else jsonb_build_array(p_cliente) end,
                             'externos', 0),
          pgp_sym_encrypt(texto, crm_clave('interacciones_contenido'), 'cipher-algo=aes256'),
          encode(digest(texto, 'sha256'), 'hex'), now() + interval '90 days', 'vinculada',
          case when p_cliente is not null then auth.uid() end, case when p_cliente is not null then now() end)
  returning id into nueva;

  insert into registro_accesos (usuario_id, actor_id, accion, organizacion_id, objeto_tipo, objeto_id, detalle)
  values (auth.uid(), auth.uid(), 'interaccion_cargada', p_org, 'interaccion', nueva::text,
          jsonb_build_object('organizacion_id', p_org, 'segmentos', jsonb_array_length(segmentos)));

  analisis := analisis_encolar_interno(nueva, false, es_staff());
  return jsonb_build_object('interaccion_id', nueva, 'analisis_id', analisis);
end;
$$;

-- ---------------------------------------------------------------------
-- Seguridad. El catálogo lo leen todos y lo cambia FIRMA por migración.
-- Los análisis no se leen ni se escriben directo: solo por funciones.
-- ---------------------------------------------------------------------
alter table public.analisis_codigos enable row level security;
drop policy if exists analisis_codigos_lectura on public.analisis_codigos;
create policy analisis_codigos_lectura on public.analisis_codigos for select to authenticated using (true);
revoke all on public.analisis_codigos from anon;
revoke insert, update, delete on public.analisis_codigos from authenticated;
grant select on public.analisis_codigos to authenticated;

alter table public.interaccion_analisis enable row level security;
revoke all on public.interaccion_analisis from anon, authenticated;

revoke all on function public.analisis_senales_sync(uuid), public.analisis_encolar_interno(uuid, boolean, boolean),
  public.interacciones_despues() from public, anon, authenticated;

revoke all on function public.analisis_contenido(uuid), public.analisis_guardar(uuid, jsonb), public.analisis_error(uuid, text)
  from public, anon, authenticated;
grant execute on function public.analisis_contenido(uuid), public.analisis_guardar(uuid, jsonb), public.analisis_error(uuid, text)
  to service_role;

revoke all on function public.analisis_puntuar(text, jsonb, text), public.analisis_solicitar(uuid, boolean),
  public.analisis_listado(uuid), public.analisis_leer(uuid), public.analisis_corregir(uuid, text, boolean, text),
  public.analisis_aprobar(uuid), public.analisis_descartar(uuid, text),
  public.interaccion_cargar_manual(uuid, text, timestamptz, uuid, uuid, jsonb) from public, anon;
grant execute on function public.analisis_puntuar(text, jsonb, text), public.analisis_solicitar(uuid, boolean),
  public.analisis_listado(uuid), public.analisis_leer(uuid), public.analisis_corregir(uuid, text, boolean, text),
  public.analisis_aprobar(uuid), public.analisis_descartar(uuid, text),
  public.interaccion_cargar_manual(uuid, text, timestamptz, uuid, uuid, jsonb) to authenticated;
grant execute on function public.analisis_puntuar(text, jsonb, text) to service_role;

notify pgrst, 'reload schema';

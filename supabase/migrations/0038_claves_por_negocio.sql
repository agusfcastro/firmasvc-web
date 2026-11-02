-- =====================================================================
-- FIRMA · Portal · Claves foráneas que incluyen el negocio
-- Cada fila hija apunta a su padre por (organizacion_id, id). Así la base
-- misma rechaza que un pago, un caso, un contrato o un mensaje apunte a
-- un cliente, un asunto o un abono de otro negocio, aunque se saltee un
-- trigger o la API tenga un error.
-- Las claves simples que ya estaban siguen: estas se suman.
-- Antes de correrla se verificó en producción que ninguna fila cruza
-- negocios (2 de noviembre de 2026).
-- =====================================================================

-- Padres: (organizacion_id, id) único.
alter table public.crm_clientes drop constraint if exists crm_clientes_org_id_key;
alter table public.crm_clientes add constraint crm_clientes_org_id_key unique (organizacion_id, id);
alter table public.asuntos drop constraint if exists asuntos_org_id_key;
alter table public.asuntos add constraint asuntos_org_id_key unique (organizacion_id, id);
alter table public.abonos drop constraint if exists abonos_org_id_key;
alter table public.abonos add constraint abonos_org_id_key unique (organizacion_id, id);

-- ---------------------------------------------------------------------
-- Hijos de crm_clientes
-- ---------------------------------------------------------------------
alter table public.crm_contratos drop constraint if exists crm_contratos_cliente_org_fk;
alter table public.crm_contratos add constraint crm_contratos_cliente_org_fk
  foreign key (organizacion_id, cliente_id) references public.crm_clientes (organizacion_id, id) on delete cascade;

alter table public.crm_pagos drop constraint if exists crm_pagos_cliente_org_fk;
alter table public.crm_pagos add constraint crm_pagos_cliente_org_fk
  foreign key (organizacion_id, cliente_id) references public.crm_clientes (organizacion_id, id) on delete cascade;

alter table public.crm_casos drop constraint if exists crm_casos_cliente_org_fk;
alter table public.crm_casos add constraint crm_casos_cliente_org_fk
  foreign key (organizacion_id, cliente_id) references public.crm_clientes (organizacion_id, id) on delete cascade;

alter table public.crm_contratos_firma drop constraint if exists crm_contratos_firma_cliente_org_fk;
alter table public.crm_contratos_firma add constraint crm_contratos_firma_cliente_org_fk
  foreign key (organizacion_id, cliente_id) references public.crm_clientes (organizacion_id, id) on delete cascade;

alter table public.crm_borradores drop constraint if exists crm_borradores_cliente_org_fk;
alter table public.crm_borradores add constraint crm_borradores_cliente_org_fk
  foreign key (organizacion_id, cliente_id) references public.crm_clientes (organizacion_id, id) on delete cascade;

alter table public.asuntos drop constraint if exists asuntos_cliente_org_fk;
alter table public.asuntos add constraint asuntos_cliente_org_fk
  foreign key (organizacion_id, cliente_id) references public.crm_clientes (organizacion_id, id) on delete set null (cliente_id);

-- Los envíos propios de FIRMA no tienen organización y no se controlan.
alter table public.firma_sobres drop constraint if exists firma_sobres_cliente_org_fk;
alter table public.firma_sobres add constraint firma_sobres_cliente_org_fk
  foreign key (organizacion_id, crm_cliente_id) references public.crm_clientes (organizacion_id, id) on delete set null (crm_cliente_id);

-- ---------------------------------------------------------------------
-- Hijos de asuntos
-- ---------------------------------------------------------------------
alter table public.crm_casos drop constraint if exists crm_casos_asunto_org_fk;
alter table public.crm_casos add constraint crm_casos_asunto_org_fk
  foreign key (organizacion_id, asunto_id) references public.asuntos (organizacion_id, id) on delete set null (asunto_id);

alter table public.asunto_novedades drop constraint if exists asunto_novedades_asunto_org_fk;
alter table public.asunto_novedades add constraint asunto_novedades_asunto_org_fk
  foreign key (organizacion_id, asunto_id) references public.asuntos (organizacion_id, id) on delete cascade;

alter table public.asunto_mensajes drop constraint if exists asunto_mensajes_asunto_org_fk;
alter table public.asunto_mensajes add constraint asunto_mensajes_asunto_org_fk
  foreign key (organizacion_id, asunto_id) references public.asuntos (organizacion_id, id) on delete cascade;

alter table public.asunto_archivos drop constraint if exists asunto_archivos_asunto_org_fk;
alter table public.asunto_archivos add constraint asunto_archivos_asunto_org_fk
  foreign key (organizacion_id, asunto_id) references public.asuntos (organizacion_id, id) on delete cascade;

alter table public.pedidos_contrato drop constraint if exists pedidos_contrato_asunto_org_fk;
alter table public.pedidos_contrato add constraint pedidos_contrato_asunto_org_fk
  foreign key (organizacion_id, asunto_id) references public.asuntos (organizacion_id, id) on delete cascade;

-- ---------------------------------------------------------------------
-- Hijos de abonos
-- ---------------------------------------------------------------------
alter table public.abono_pagos drop constraint if exists abono_pagos_abono_org_fk;
alter table public.abono_pagos add constraint abono_pagos_abono_org_fk
  foreign key (organizacion_id, abono_id) references public.abonos (organizacion_id, id) on delete cascade;

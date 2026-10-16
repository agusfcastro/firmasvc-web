-- =====================================================================
-- FIRMA · Portal · Protocolos en Documentos
-- Suma los protocolos del motor común a la sección Otros documentos,
-- como enlaces para todos los clientes. Si alguno ya existe, no se repite.
-- Se ejecuta una sola vez en Supabase › SQL Editor.
-- =====================================================================

insert into public.documentos (seccion, titulo, descripcion, url, orden)
select v.seccion, v.titulo, v.descripcion, v.url, v.orden
from (
  values
    ('otros', 'Protocolo de conflictos y pedidos de reembolso',
     'Prevención, contención y gestión de reclamos, con compuerta legal, calculadora de negociación y tablero de indicadores.',
     '/protocolo-conflictos', 2),
    ('otros', 'Protocolo de onboarding de clientes',
     'De la firma al primer resultado, con accesos, bienvenida, reunión de inicio e hitos confirmados por escrito.',
     '/protocolo-onboarding', 3),
    ('otros', 'Protocolo de cobranza y contracargos',
     'Secuencia de cobro firme y amable, planes de pago y respuesta a disputas con prueba.',
     '/protocolo-cobranza', 4),
    ('otros', 'Protocolo de reclutamiento y selección',
     'Del perfil del puesto a la oferta firmada, con entrevistas estructuradas, avisos sin sesgos y datos de candidatos bien cuidados.',
     '/protocolo-reclutamiento', 5),
    ('otros', 'Protocolo de gestión del equipo',
     'Incorporación, rituales, comisiones, desempeño y salida ordenada, cuidando que la práctica coincida con el contrato.',
     '/protocolo-equipo', 6),
    ('otros', 'Protocolo de marketing y publicidad',
     'Piezas, testimonios, promociones y comunicaciones que venden sin prometer de más.',
     '/protocolo-marketing', 7),
    ('otros', 'Protocolo de datos personales',
     'Qué datos se piden, dónde viven, cuánto se guardan y cómo se responden los pedidos de sus titulares.',
     '/protocolo-datos', 8)
) as v (seccion, titulo, descripcion, url, orden)
where not exists (select 1 from public.documentos d where d.url = v.url);

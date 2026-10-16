// Protocolo de marketing y publicidad. Plantilla FIRMA.

import type { DefProtocolo } from '../motor/tipos';
import { secciones } from './contenido';
import { FICHA } from './ficha';

const protocolo: DefProtocolo = {
  id: 'marketing',
  ruta: '/protocolo-marketing',
  tituloPagina: 'Protocolo de marketing y publicidad | Firma',
  claveLocal: 'firma-protocolo-marketing:v1',
  meta: {
    kicker: 'Protocolo de gestión · Plantilla',
    titulo: 'Marketing y publicidad',
    bajada:
      'Piezas, testimonios, promociones y comunicaciones que venden sin prometer de más. Con revisor de piezas, testimonios autorizados, métricas de adquisición y tablero de indicadores.',
    version: 'Versión 1.0 · Octubre de 2026',
  },
  ideas: [
    { titulo: 'Toda pieza es una oferta', texto: 'Lo que se publica se puede exigir. Si no se puede cumplir ni probar, no se publica.' },
    { titulo: 'Resultados con contexto', texto: 'Un caso de éxito muestra de dónde partió, cuánto tardó y qué hizo. Sin eso, se lee como promesa.' },
    { titulo: 'Urgencia real', texto: 'Plazos y cupos verdaderos, escritos en las bases. La escasez inventada es engaño.' },
  ],
  ficha: FICHA,
  secciones,
  pie: 'Protocolo elaborado por FIRMA para uso interno del equipo. No reemplaza el contrato ni el asesoramiento jurídico para casos concretos. Si una pieza o una plantilla no coincide con el contrato del cliente o con la oferta vigente, prevalece el contrato, la pieza no se publica y hay que avisar para ajustar la ficha.',
};

export default protocolo;

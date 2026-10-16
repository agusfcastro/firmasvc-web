// Protocolo de conflictos y pedidos de reembolso. Plantilla FIRMA.

import type { DefProtocolo } from '../motor/tipos';
import { secciones } from './contenido';
import { FICHA } from './ficha';

const protocolo: DefProtocolo = {
  id: 'conflictos',
  ruta: '/protocolo-conflictos',
  tituloPagina: 'Protocolo de conflictos y reembolsos | Firma',
  claveLocal: 'firma-protocolo-conflictos:v1',
  meta: {
    kicker: 'Protocolo de gestión · Plantilla',
    titulo: 'Conflictos y pedidos de reembolso',
    bajada:
      'Cómo se previenen, se contienen y se gestionan los reclamos, desde la primera señal de insatisfacción hasta una eventual difusión pública. Con compuerta legal, calculadora de negociación y tablero de indicadores.',
    version: 'Versión 1.0 · Octubre de 2026',
  },
  ideas: [
    { titulo: 'Una sola voz', texto: 'En cada etapa responde una sola persona. Las contradicciones internas valen más para el reclamante que cualquier argumento.' },
    { titulo: 'Por escrito o no existe', texto: 'Los conflictos se ganan con lo que se registró cuando todo estaba bien.' },
    { titulo: 'Nunca en caliente', texto: 'Quien controla el ritmo controla la negociación. Los plazos formales se respetan siempre.' },
  ],
  ficha: FICHA,
  secciones,
  pie: 'Protocolo elaborado por FIRMA para uso interno del equipo. No reemplaza el contrato ni el asesoramiento jurídico para casos concretos. Si algo de una plantilla no coincide con el contrato del cliente, prevalece el contrato y hay que avisar para ajustar la ficha.',
};

export default protocolo;

// Protocolo de reclutamiento y selección. Plantilla FIRMA.

import type { DefProtocolo } from '../motor/tipos';
import { secciones } from './contenido';
import { FICHA } from './ficha';

const protocolo: DefProtocolo = {
  id: 'reclutamiento',
  ruta: '/protocolo-reclutamiento',
  tituloPagina: 'Protocolo de reclutamiento y selección | Firma',
  claveLocal: 'firma-protocolo-reclutamiento:v1',
  meta: {
    kicker: 'Protocolo de gestión · Plantilla',
    titulo: 'Reclutamiento y selección',
    bajada:
      'Del perfil del puesto a la oferta firmada, con entrevistas estructuradas, avisos sin sesgos y datos de candidatos bien cuidados. Con rúbrica de entrevista, embudo de selección y tabla de preguntas prohibidas.',
    version: 'Versión 1.0 · Octubre de 2026',
  },
  ideas: [
    { titulo: 'Por resultados', texto: 'El puesto se define por lo que tiene que lograr y cada etapa busca evidencia de eso.' },
    { titulo: 'Misma vara', texto: 'Mismas preguntas y misma rúbrica para todos. Es más justo y deja prueba de que la decisión fue objetiva.' },
    { titulo: 'Datos prestados', texto: 'Se pide lo mínimo, se usa para esta búsqueda y se borra al cerrarla, salvo consentimiento.' },
  ],
  ficha: FICHA,
  secciones,
  pie: 'Protocolo elaborado por FIRMA para uso interno del equipo. No reemplaza el contrato de trabajo o de servicios ni el asesoramiento jurídico para casos concretos. Si algo de una plantilla no coincide con la modalidad real de contratación, prevalece el contrato y hay que avisar para ajustar la ficha.',
};

export default protocolo;

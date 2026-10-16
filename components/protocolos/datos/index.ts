// Protocolo de datos personales. Plantilla FIRMA.

import type { DefProtocolo } from '../motor/tipos';
import { secciones } from './contenido';
import { FICHA } from './ficha';

const protocolo: DefProtocolo = {
  id: 'datos',
  ruta: '/protocolo-datos',
  tituloPagina: 'Protocolo de datos personales | Firma',
  claveLocal: 'firma-protocolo-datos:v1',
  meta: {
    kicker: 'Protocolo de gestión · Plantilla',
    titulo: 'Datos personales',
    bajada:
      'Qué datos se piden, dónde viven, cuánto se guardan y cómo se responden los pedidos de sus titulares. Con mapa de datos, calculadora de plazos y flujo de incidentes.',
    version: 'Versión 1.0 · Octubre de 2026',
  },
  ideas: [
    { titulo: 'Solo lo necesario', texto: 'Cada dato que se pide tiene un uso conocido. Lo que no se usa, no se pide ni se guarda.' },
    { titulo: 'Cada dato tiene un plazo', texto: 'Nada se guarda para siempre. Vencido el plazo, se suprime en todas las herramientas.' },
    { titulo: 'En el día', texto: 'Un pedido de un titular o un incidente se informa el mismo día en que se conoce.' },
  ],
  ficha: FICHA,
  secciones,
  pie: 'Protocolo elaborado por FIRMA para uso interno del equipo. No reemplaza la política de privacidad, los contratos ni el asesoramiento jurídico para casos concretos. Si algo de una plantilla no coincide con la política de privacidad del cliente, prevalece la política y hay que avisar para ajustar la ficha.',
};

export default protocolo;

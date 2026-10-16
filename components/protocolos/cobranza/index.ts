// Protocolo de cobranza y contracargos. Plantilla FIRMA.

import type { DefProtocolo } from '../motor/tipos';
import { secciones } from './contenido';
import { FICHA } from './ficha';

const protocolo: DefProtocolo = {
  id: 'cobranza',
  ruta: '/protocolo-cobranza',
  tituloPagina: 'Protocolo de cobranza y contracargos | Firma',
  claveLocal: 'firma-protocolo-cobranza:v1',
  meta: {
    kicker: 'Protocolo de gestión · Plantilla',
    titulo: 'Cobranza y contracargos',
    bajada:
      'Secuencia de cobro firme y amable, planes de pago documentados y respuesta a disputas con prueba, desde el recordatorio previo al vencimiento hasta el cierre de cada cuenta. Con antigüedad de saldos, calculadora de intereses y paquete de prueba.',
    version: 'Versión 1.0 · Octubre de 2026',
  },
  ideas: [
    { titulo: 'Recordar antes de reclamar', texto: 'El primer contacto llega antes del vencimiento, con monto, fecha y forma de pago.' },
    { titulo: 'Firmes y amables', texto: 'Lo pactado no se negocia por chat. El tono se cuida siempre y nunca parece un juicio.' },
    { titulo: 'Prueba antes que razones', texto: 'Las disputas se ganan con lo que se registró durante la venta y la prestación.' },
  ],
  ficha: FICHA,
  secciones,
  pie: 'Protocolo elaborado por FIRMA para uso interno del equipo. No reemplaza el contrato ni el asesoramiento jurídico para casos concretos. Si algo de una plantilla no coincide con el contrato del cliente, prevalece el contrato y hay que avisar para ajustar la ficha.',
};

export default protocolo;

// Protocolo de onboarding de clientes. Plantilla FIRMA.

import type { DefProtocolo } from '../motor/tipos';
import { secciones } from './contenido';
import { FICHA } from './ficha';

const protocolo: DefProtocolo = {
  id: 'onboarding',
  ruta: '/protocolo-onboarding',
  tituloPagina: 'Onboarding de clientes | Firma',
  claveLocal: 'firma-protocolo-onboarding:v1',
  meta: {
    kicker: 'Protocolo de gestión · Plantilla',
    titulo: 'Onboarding de clientes',
    bajada:
      'De la firma al primer resultado, con accesos, bienvenida, reunión de inicio e hitos confirmados por escrito. Con checklist de ingreso, índice de salud de la cuenta y tablero de indicadores.',
    version: 'Versión 1.0 · Octubre de 2026',
  },
  ideas: [
    { titulo: 'Sin firma no hay acceso', texto: 'El servicio empieza cuando el contrato está firmado y el pago acreditado. Nunca antes.' },
    { titulo: 'La bienvenida es prueba', texto: 'Copia firmada, canal oficial y reglas del servicio en un mismo mensaje, con respuesta del cliente.' },
    { titulo: 'Cada hito por escrito', texto: 'Lo que se presta se prueba con lo que se registró cuando todo estaba bien.' },
  ],
  ficha: FICHA,
  secciones,
  pie: 'Protocolo elaborado por FIRMA para uso interno del equipo. No reemplaza el contrato ni el asesoramiento jurídico para casos concretos. Si algo de una plantilla no coincide con el contrato del cliente, prevalece el contrato y hay que avisar para ajustar la ficha.',
};

export default protocolo;

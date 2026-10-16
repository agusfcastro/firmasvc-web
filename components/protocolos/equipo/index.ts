// Protocolo de gestión del equipo. Plantilla FIRMA.

import type { DefProtocolo } from '../motor/tipos';
import { secciones } from './contenido';
import { FICHA } from './ficha';

const protocolo: DefProtocolo = {
  id: 'equipo',
  ruta: '/protocolo-equipo',
  tituloPagina: 'Gestión del equipo | Firma',
  claveLocal: 'firma-protocolo-equipo:v1',
  meta: {
    kicker: 'Protocolo de gestión · Plantilla',
    titulo: 'Gestión del equipo',
    bajada:
      'Incorporación, rituales, comisiones, desempeño y salida ordenada de setters, closers y acompañamiento, cuidando que la práctica de todos los días coincida con el contrato. Con semáforo de independencia, simulador de comisiones y matriz de responsables.',
    version: 'Versión 1.0 · Octubre de 2026',
  },
  ideas: [
    { titulo: 'Resultados, no horas', texto: 'Con independientes se acuerdan resultados y estándares. El cómo y el cuándo los organiza cada uno.' },
    { titulo: 'La práctica manda', texto: 'Lo que pasa todos los días pesa más que lo que dice el contrato. Se gestiona como se firmó.' },
    { titulo: 'Por escrito y con un responsable', texto: 'Cada tarea tiene un dueño y cada acuerdo queda escrito. Así se evitan malentendidos y reclamos.' },
  ],
  ficha: FICHA,
  secciones,
  pie: 'Protocolo elaborado por FIRMA para uso interno del equipo. No reemplaza el contrato ni el asesoramiento jurídico, laboral o impositivo para casos concretos. Si una práctica de este protocolo no coincide con el contrato de una persona, prevalece el contrato y hay que avisar para ajustar la ficha.',
};

export default protocolo;

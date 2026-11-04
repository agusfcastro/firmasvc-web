// Protocolo de comunicación legal en llamadas de venta. Plantilla FIRMA.

import type { DefProtocolo } from '../motor/tipos';
import { secciones } from './contenido';
import { IDEAS, META, PIE } from './datos';
import { FICHA } from './ficha';

const protocolo: DefProtocolo = {
  id: 'llamadas',
  ruta: '/protocolo-llamadas',
  tituloPagina: 'Protocolo de llamadas de venta | Firma',
  // La misma clave que la versión anterior, así se conservan las fichas guardadas.
  claveLocal: 'firma-sop-llamadas:v1',
  meta: { ...META, resalte: 'llamadas de venta' },
  ideas: IDEAS,
  ficha: FICHA,
  secciones,
  pie: PIE,
};

export default protocolo;

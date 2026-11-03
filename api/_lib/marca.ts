/**
 * Colores y tipografías de la marca para lo que no puede leer el CSS: los
 * mails, el PDF firmado y los dibujos en canvas. En las pantallas se usan
 * las clases de Tailwind que salen de index.css (@theme).
 * Los valores tienen que coincidir con index.css. npm run marca:verificar
 * los compara y falla si difieren.
 * Sin dependencias de Node, así también corre en el navegador.
 */

export const COLOR = {
  marfil: '#F5F3EC',
  marfilOscuro: '#EDEBE2',
  marfilClaro: '#FBFAF6',
  carbon: '#2B2B2B',
  tinta: '#1B1F1B',
  piedra: '#6B6553',
  calido: '#A9A79E',
  bosque: '#173A2F',
  bosqueSuave: '#E4E9E3',
  linea: '#DEDBD0',
  /** Tonos del portal en negro, que también usan los mails. */
  niebla: '#ECE9E1',
  grafito: '#33362F',
  separador: '#EEECE5',
  blanco: '#FFFFFF',
} as const;

/**
 * Pila tipográfica de los mails, en Archivo como el portal. Apple Mail y Outlook para Mac
 * la toman de firmasvc.com/mail y el resto de los clientes cae en Helvetica o Arial.
 */
export const FUENTE = {
  texto: "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif",
} as const;

/** #RRGGBB a componentes entre 0 y 1, como los pide pdf-lib. */
export function rgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

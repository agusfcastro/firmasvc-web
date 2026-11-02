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
  blanco: '#FFFFFF',
} as const;

/** Pilas tipográficas con respaldo para clientes de correo que no cargan fuentes web. */
export const FUENTE = {
  titulo: "'Bitter', Georgia, 'Times New Roman', serif",
  texto: "'Archivo', Arial, Helvetica, sans-serif",
} as const;

/** #RRGGBB a componentes entre 0 y 1, como los pide pdf-lib. */
export function rgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

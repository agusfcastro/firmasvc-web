/**
 * Anonimiza el texto que entra a un caso de prueba (ia_casos). Reemplaza los
 * nombres conocidos de la empresa y su gente por un alias, y saca mails,
 * teléfonos y números de documento. Los montos y las fechas quedan, porque
 * cambian la respuesta. Es un primer paso: FIRMA revisa el caso antes de
 * guardarlo.
 */
import { sinContacto } from '../analisis/transcripcion.js';

export interface NombreConocido {
  valor: string | null | undefined;
  alias: string;
  /** También cada palabra de 4 letras o más, como el nombre o el apellido sueltos. */
  partes?: boolean;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** «Pérez» también encuentra «Perez» y «PÉREZ». */
const sinTildes = (s: string) =>
  escapar(s.normalize('NFD').replace(/[̀-ͯ]/g, ''))
    .replace(/a/gi, '[aáàä]')
    .replace(/e/gi, '[eéèë]')
    .replace(/i/gi, '[iíìï]')
    .replace(/o/gi, '[oóòö]')
    .replace(/u/gi, '[uúùü]')
    .replace(/n/gi, '[nñ]');

const DOCUMENTO = /\b(DNI|D\.N\.I\.?|CUIT|CUIL|pasaporte|documento)(\s*(?:n[°º.]?|nro\.?|número)?\s*:?\s*)\d[\d.\- ]{5,14}\d/gi;
const CUIT_SUELTO = /\b\d{2}-\d{7,8}-\d\b/g;

/** Saca números de documento. Un monto como 1.500.000 sin la palabra DNI o CUIT no se toca. */
export function sinDocumentos(texto: string): string {
  return texto.replace(DOCUMENTO, (_t, clave: string, separador: string) => `${clave}${separador}[documento]`).replace(CUIT_SUELTO, '[documento]');
}

/** Arma la función que anonimiza con los nombres conocidos de una empresa. */
export function anonimizador(nombres: NombreConocido[]): (texto: string) => string {
  const alias = new Map<string, string>();
  const agregar = (t: string, a: string) => {
    const limpio = t.trim().replace(/\s+/g, ' ');
    if (limpio.length < 3) return;
    const clave = limpio.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!alias.has(clave)) alias.set(clave, a);
  };
  for (const n of nombres) {
    const v = (n.valor ?? '').trim();
    if (!v) continue;
    agregar(v, n.alias);
    if (n.partes) for (const p of v.split(/\s+/)) if (p.length >= 4) agregar(p, n.alias);
  }
  // Primero los más largos, así «Juan Pérez» gana a «Juan».
  const patrones = [...alias.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([n, a]) => [new RegExp(`(?<![\\p{L}\\p{N}])${sinTildes(n)}(?![\\p{L}\\p{N}])`, 'giu'), a] as const);
  return (texto: string) => patrones.reduce((t, [re, a]) => t.replace(re, a), sinContactoNiDocumentos(texto));
}

const FECHA = /\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;

/** Mails, teléfonos y documentos fuera. Las fechas se apartan antes, para que no parezcan teléfonos. */
function sinContactoNiDocumentos(texto: string): string {
  const fechas: string[] = [];
  const apartado = texto.replace(FECHA, (f) => `\u0000${fechas.push(f) - 1}\u0000`);
  return sinContacto(sinDocumentos(apartado)).replace(/\u0000(\d+)\u0000/g, (_t, i: string) => fechas[Number(i)] ?? '');
}

/** Aplica el anonimizador a todos los textos de un valor JSON. */
export function anonimizarJson<T>(valor: T, anon: (s: string) => string): T {
  if (typeof valor === 'string') return anon(valor) as T;
  if (Array.isArray(valor)) return valor.map((v) => anonimizarJson(v, anon)) as T;
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, anonimizarJson(v, anon)])) as T;
  }
  return valor;
}

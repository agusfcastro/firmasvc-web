/**
 * Pedidos de contrato: tipos de pregunta y las reglas comunes a todos los
 * modelos. Las preguntas de cada modelo están en su archivo (closer.ts).
 * Las respuestas se guardan tal cual en pedidos_contrato.respuestas
 * (migración 0034).
 */

export type Fila = Record<string, string>;
export type Valor = string | string[] | Fila[];
export type Respuestas = Record<string, Valor>;

export type TipoPregunta =
  /** Una línea */
  | 'texto'
  /** Varias líneas */
  | 'largo'
  /** Una opción de la lista */
  | 'opcion'
  /** Varias opciones de la lista */
  | 'varias'
  /** Sí o no */
  | 'sino'
  /** Filas con las columnas de la pregunta */
  | 'tabla';

export interface Opcion {
  valor: string;
  texto: string;
}

export interface Pregunta {
  clave: string;
  tipo: TipoPregunta;
  etiqueta: string;
  ayuda?: string;
  ejemplo?: string;
  opciones?: Opcion[];
  /** Con la opción «otra» se pide el detalle en <clave>_otra. */
  otra?: boolean;
  columnas?: { clave: string; titulo: string; ejemplo?: string }[];
  /** Lo que trae marcado el borrador nuevo. Sale del modelo que usa FIRMA. */
  porDefecto?: Valor;
  obligatoria?: boolean;
  /** Sin esto, la pregunta se muestra siempre. */
  si?: (r: Respuestas) => boolean;
  /** Nota al lado de la respuesta cuando cambia el encuadre o el riesgo. */
  alerta?: (r: Respuestas) => string | null;
}

export interface Seccion {
  clave: string;
  titulo: string;
  bajada: string;
  /** Datos de la persona: cambian en cada contrato, no van al esquema y se completan después de enviar. */
  porContrato?: boolean;
  preguntas: Pregunta[];
}

export interface Modelo {
  clave: 'closer';
  titulo: string;
  bajada: string;
  /** Pregunta cuya respuesta nombra al pedido en la lista y en el asunto. */
  claveTitulo: string;
  tituloAsunto: (r: Respuestas) => string;
  secciones: Seccion[];
}

export const texto = (r: Respuestas, clave: string): string => {
  const v = r[clave];
  return typeof v === 'string' ? v : '';
};

export const lista = (r: Respuestas, clave: string): string[] => {
  const v = r[clave];
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : [];
};

export const filas = (r: Respuestas, clave: string): Fila[] => {
  const v = r[clave];
  return Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null) ? (v as Fila[]) : [];
};

export const es = (r: Respuestas, clave: string, valor: string) => texto(r, clave) === valor;

export const visible = (p: Pregunta, r: Respuestas) => !p.si || p.si(r);

const filaCompleta = (f: Fila) => Object.values(f).some((x) => x.trim() !== '');

/** Una pregunta está respondida si tiene algo escrito o elegido. */
export function respondida(p: Pregunta, r: Respuestas): boolean {
  if (p.tipo === 'tabla') return filas(r, p.clave).some(filaCompleta);
  if (p.tipo === 'varias') return lista(r, p.clave).length > 0;
  return texto(r, p.clave).trim() !== '';
}

/** Respuestas iniciales de un borrador nuevo. */
export function respuestasIniciales(m: Modelo, previas: Respuestas = {}): Respuestas {
  const r: Respuestas = {};
  for (const s of m.secciones) for (const p of s.preguntas) if (p.porDefecto !== undefined) r[p.clave] = p.porDefecto;
  return { ...r, ...previas };
}

export function avance(m: Modelo, r: Respuestas): { respondidas: number; total: number } {
  let respondidas = 0;
  let total = 0;
  for (const s of m.secciones)
    for (const p of s.preguntas) {
      if (!visible(p, r)) continue;
      total += 1;
      if (respondida(p, r)) respondidas += 1;
    }
  return { respondidas, total };
}

/** Obligatorias visibles sin responder, con su sección para llevar al cliente ahí. */
export function faltantes(m: Modelo, r: Respuestas): { seccion: Seccion; pregunta: Pregunta }[] {
  const out: { seccion: Seccion; pregunta: Pregunta }[] = [];
  for (const s of m.secciones) for (const p of s.preguntas) if (p.obligatoria && visible(p, r) && !respondida(p, r)) out.push({ seccion: s, pregunta: p });
  return out;
}

const clavesDe = (s: Seccion) => s.preguntas.flatMap((p) => [p.clave, `${p.clave}_otra`]);

/** Las condiciones de un pedido, sin los datos de la persona, para guardar como esquema. */
export function esquemaDe(m: Modelo, r: Respuestas): Respuestas {
  const fuera = new Set(m.secciones.filter((s) => s.porContrato).flatMap(clavesDe));
  return Object.fromEntries(Object.entries(r).filter(([k]) => !fuera.has(k)));
}

/** Pregunta de los datos de la persona sin responder. */
export function datosPendientes(m: Modelo, r: Respuestas): boolean {
  return m.secciones.some((s) => s.porContrato && s.preguntas.some((p) => visible(p, r) && !respondida(p, r)));
}

const textoOpcion = (p: Pregunta, v: string) => p.opciones?.find((o) => o.valor === v)?.texto ?? v;

/** La respuesta como la lee FIRMA. Vacío si no se respondió. */
export function valorLegible(p: Pregunta, r: Respuestas): string {
  const otra = texto(r, `${p.clave}_otra`).trim();
  switch (p.tipo) {
    case 'sino':
      return es(r, p.clave, 'si') ? 'Sí' : es(r, p.clave, 'no') ? 'No' : '';
    case 'opcion': {
      const v = texto(r, p.clave);
      if (!v) return '';
      return v === 'otra' ? `Otra: ${otra || 'sin detalle'}` : textoOpcion(p, v);
    }
    case 'varias':
      return lista(r, p.clave)
        .map((v) => (v === 'otra' ? `otra: ${otra || 'sin detalle'}` : textoOpcion(p, v)))
        .join(', ');
    case 'tabla':
      return filas(r, p.clave)
        .filter(filaCompleta)
        .map((f) => (p.columnas ?? []).map((c) => `${c.titulo}: ${f[c.clave]?.trim() || '·'}`).join(' · '))
        .join('\n');
    default:
      return texto(r, p.clave).trim();
  }
}

export interface LineaResumen {
  pregunta: Pregunta;
  valor: string;
  alerta: string | null;
}

/** Las preguntas visibles con su respuesta, sección por sección. */
export function resumen(m: Modelo, r: Respuestas): { seccion: Seccion; lineas: LineaResumen[] }[] {
  return m.secciones.map((s) => ({
    seccion: s,
    lineas: s.preguntas.filter((p) => visible(p, r)).map((p) => ({ pregunta: p, valor: valorLegible(p, r), alerta: p.alerta?.(r) ?? null })),
  }));
}

/** Texto plano para pegar en el borrador del contrato. */
export function resumenTexto(m: Modelo, r: Respuestas, encabezado: string): string {
  const partes = [encabezado, ''];
  resumen(m, r).forEach(({ seccion, lineas }, i) => {
    partes.push(`${i + 1}. ${seccion.titulo.toUpperCase()}`);
    for (const l of lineas) {
      const valor = l.valor || 'Sin responder';
      partes.push(valor.includes('\n') ? `- ${l.pregunta.etiqueta}\n${valor.replace(/^/gm, '    ')}` : `- ${l.pregunta.etiqueta}: ${valor}`);
      if (l.alerta) partes.push(`    ⚠ ${l.alerta}`);
    }
    partes.push('');
  });
  return partes.join('\n').trim();
}

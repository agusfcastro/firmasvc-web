/**
 * Análisis de llamadas de venta (migración 0067): tipos, textos y la lectura
 * de una transcripción pegada o subida. Lo usan Llamadas, AnalisisLlamada y
 * CargarTranscripcion.
 */

export type EstadoAnalisis = 'pendiente' | 'en_revision' | 'aprobado' | 'descartado' | 'no_aplica' | 'limite' | 'error';
export type Banda = 'bajo' | 'medio' | 'alto';

/** Una fila de analisis_listado(). */
export interface AnalisisFila {
  interaccion_id: string;
  analisis_id: string;
  estado: EstadoAnalisis;
  etapa: string | null;
  banda_final: Banda | null;
  alerta_vulnerabilidad: boolean | null;
  creado_en: string;
  analizado_en: string | null;
  revisado_en: string | null;
}

export interface CodigoGuardado {
  codigo: string;
  tipo: 'riesgo' | 'protector' | 'vendedor';
  intensidad: number;
  peso: number;
  puntos: number;
  descartado: boolean;
  corregido: boolean;
}

export interface CodigoCatalogo {
  codigo: string;
  tipo: 'riesgo' | 'protector' | 'vendedor';
  nombre: string;
  peso: number;
  respaldo: string | null;
}

interface ConCita {
  codigo: string;
  cita: string;
  minuto: string;
}

export interface DetalleAnalisis {
  version?: string;
  etapa_motivo?: string;
  confianza_motivo?: string;
  lectura?: string;
  conteo_compromiso?: Record<string, number>;
  sujeto_resultado?: Record<string, number>;
  indicadores?: (ConCita & { intensidad: number; justificacion: string; inducido: boolean; corregido: boolean })[];
  protectores?: (ConCita & { intensidad: number; justificacion: string })[];
  conducta_vendedor?: (ConCita & { comentario: string })[];
  descartes?: { fragmento: string; codigo_evaluado: string; motivo: string; origen?: 'modelo' | 'verificacion' }[];
  temas_no_explorados?: string[];
  pautas?: string[];
  linea_base?: Record<string, string>;
  hablantes?: { etiqueta: string; rol: string; intervenciones: number; palabras: number }[];
  roles_claros?: boolean;
  recortada?: boolean;
  verificacion?: { citas_verificadas: number; citas_rechazadas: number };
  modelos?: string[];
}

/** Lo que devuelve analisis_leer(). Sin visible, solo el estado. */
export interface AnalisisCompleto {
  id: string;
  interaccion_id: string;
  visible: boolean;
  es_staff?: boolean;
  estado: EstadoAnalisis | 'reemplazado';
  etapa: string | null;
  etapa_pedida?: string | null;
  version?: string;
  confianza?: 'alta' | 'media' | 'baja' | 'no_evaluable' | null;
  palabras_prospecto?: number | null;
  codigos?: CodigoGuardado[];
  puntaje_riesgo?: number | null;
  puntaje_protector?: number | null;
  puntaje_neto?: number | null;
  banda_puntaje?: Banda | null;
  banda_final?: Banda | null;
  reglas?: string[];
  alerta_vulnerabilidad?: boolean;
  detalle?: DetalleAnalisis | null;
  detalle_vencido?: boolean;
  correcciones?: { codigo: string; accion: 'descartado' | 'restaurado'; motivo: string | null; en: string }[];
  modelo?: string | null;
  error?: string | null;
  motivo?: string | null;
  creado_en?: string;
  analizado_en?: string | null;
  revisado_en?: string | null;
  titulo?: string | null;
  ocurrida_en?: string;
  duracion_seg?: number | null;
  fuente?: string;
}

type Tono = 'bosque' | 'piedra' | 'alerta' | 'tinta';

/** La etiqueta de una llamada en el listado, según quién mira. */
export function etiquetaAnalisis(a: Pick<AnalisisFila, 'estado' | 'banda_final' | 'etapa'>, comoFirma: boolean): { texto: string; tono: Tono } {
  switch (a.estado) {
    case 'pendiente':
      return { texto: 'Analizando', tono: 'piedra' };
    case 'en_revision':
      if (comoFirma && a.banda_final) return { texto: `Para revisar · ${BANDA[a.banda_final]}`, tono: 'alerta' };
      return { texto: comoFirma ? 'Para revisar' : 'En revisión de FIRMA', tono: comoFirma ? 'alerta' : 'piedra' };
    case 'aprobado':
      return a.banda_final ? { texto: `Riesgo ${BANDA[a.banda_final].toLowerCase()}`, tono: TONO_BANDA[a.banda_final] } : { texto: 'Aprobado', tono: 'piedra' };
    case 'descartado':
      return { texto: 'Descartado por FIRMA', tono: 'piedra' };
    case 'no_aplica':
      return { texto: a.etapa && ETAPA[a.etapa] ? ETAPA[a.etapa] : 'No es de venta', tono: 'piedra' };
    case 'limite':
      return { texto: 'Sin análisis este mes', tono: 'piedra' };
    case 'error':
      return { texto: 'No se pudo analizar', tono: 'alerta' };
  }
}

export const BANDA: Record<Banda, string> = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
export const TONO_BANDA: Record<Banda, Tono> = { bajo: 'piedra', medio: 'tinta', alto: 'alerta' };

export const ETAPA: Record<string, string> = {
  venta: 'Venta',
  onboarding: 'Onboarding',
  seguimiento: 'Seguimiento',
  soporte: 'Soporte',
  otra: 'Otra',
};

export const CONFIANZA: Record<string, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  no_evaluable: 'No evaluable',
};

export const REGLAS: Record<string, string> = {
  R1: 'Contracargo previo o más de un reclamo previo. Banda mínima alta.',
  R2: 'Compra con plata comprometida y la garantía como salida. Banda mínima alta.',
  R3: 'Amenaza condicional de reclamar o exponer. Banda mínima alta.',
  R4: 'Pidió un resultado garantizado y el vendedor no lo corrigió. Banda mínima media.',
  R5: 'Se cerró la venta sobre un pedido de tiempo, con insistencia. Banda mínima media, y la forma de cierre pasa a análisis legal.',
};

export const CONTEO: [string, string][] = [
  ['deseo', 'Deseo'],
  ['necesidad', 'Necesidad'],
  ['razones', 'Razones'],
  ['capacidad', 'Capacidad'],
  ['compromiso', 'Compromiso'],
  ['freno', 'Freno'],
];

export const SUJETO: [string, string][] = [
  ['yo', 'El prospecto'],
  ['vendedor_o_programa', 'El vendedor o el programa'],
  ['otro', 'Otro'],
];

export const LINEA_BASE: [string, string][] = [
  ['resultado_y_fecha_declarados', 'Resultado y fecha que mencionó'],
  ['garantia_mencionada', 'Lo que se dijo de la garantía'],
  ['cuotas_mencionadas', 'Lo que se dijo de cuotas o pagos'],
];

/** «Riesgo = B1 3×2 + A1 3×1 = 9». */
export function cuenta(codigos: CodigoGuardado[], tipo: 'riesgo' | 'protector'): string {
  const vigentes = codigos.filter((c) => c.tipo === tipo && !c.descartado && c.puntos > 0);
  const total = vigentes.reduce((s, c) => s + c.puntos, 0);
  return vigentes.length ? `${vigentes.map((c) => `${c.codigo} ${c.peso}×${c.intensidad}`).join(' + ')} = ${total}` : '0';
}

// ---------------------------------------------------------------------
// Transcripciones pegadas o subidas
// ---------------------------------------------------------------------

export interface SegmentoCargado {
  hablante: string | null;
  segundo: number | null;
  texto: string;
}

const HORA = String.raw`(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?`;

/** "1:02:03", "02:03" o "02:03.500" a segundos. */
function aSegundos(t: string): number | null {
  if (!t.trim()) return null;
  const partes = t.replace(/[.,]\d+$/, '').split(':').map(Number);
  if (!partes.length || partes.some((n) => !Number.isFinite(n))) return null;
  return partes.reduce((s, n) => s * 60 + n, 0);
}

const UNIONES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'van', 'von']);

/**
 * Un nombre de hablante razonable: corto, sin pinta de oración y con cada
 * palabra en mayúscula («Martín Gómez», «Speaker 1»), salvo las uniones.
 */
function esNombre(s: string): boolean {
  const t = s.trim();
  const palabras = t.split(/\s+/);
  return (
    t.length >= 1 &&
    t.length <= 60 &&
    palabras.length <= 5 &&
    !/[?!¿¡,;]/.test(t) &&
    !/^\d+$/.test(t) &&
    /^\p{Lu}/u.test(t) &&
    palabras.every((p) => /^[\p{Lu}\d]/u.test(p) || UNIONES.has(p))
  );
}

/**
 * Lee los formatos más comunes: WebVTT y SRT (Zoom, Meet, Teams), «Nombre:
 * texto» con o sin marca de tiempo adelante, y los bloques de Fathom u Otter
 * con el nombre y la hora en una línea y lo dicho debajo. Lo que no se
 * reconoce como cambio de hablante se suma a la intervención anterior.
 */
export function leerTranscripcion(crudo: string): SegmentoCargado[] {
  const lineas = crudo.replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
  const segmentos: SegmentoCargado[] = [];
  const sumar = (hablante: string | null, segundo: number | null, texto: string) => {
    const t = texto.trim();
    const ultimo = segmentos[segmentos.length - 1];
    if (!t) {
      if (hablante) segmentos.push({ hablante, segundo, texto: '' });
      return;
    }
    if (!hablante && ultimo) ultimo.texto = `${ultimo.texto} ${t}`.trim();
    else segmentos.push({ hablante, segundo, texto: t });
  };

  const esVtt = lineas.some((l) => /-->/.test(l));
  if (esVtt) {
    let segundo: number | null = null;
    for (const l of lineas) {
      const linea = l.trim();
      if (!linea || /^WEBVTT/i.test(linea) || /^NOTE\b/.test(linea) || /^\d+$/.test(linea)) continue;
      const tiempo = linea.match(new RegExp(`^(${HORA})\\s*-->`));
      if (tiempo) {
        segundo = aSegundos(tiempo[1]);
        continue;
      }
      const voz = linea.match(/^<v(?:\.[^ >]*)?\s+([^>]+)>(.*?)(?:<\/v>)?$/);
      if (voz) {
        sumar(voz[1].trim(), segundo, voz[2]);
        continue;
      }
      const dicho = linea.match(/^([^:]{1,60}):\s+(.+)$/);
      if (dicho && esNombre(dicho[1])) sumar(dicho[1].trim(), segundo, dicho[2]);
      else sumar(null, segundo, linea);
    }
  } else {
    // Bloques: «Nombre 0:05», «Nombre (00:05)», «0:05 Nombre» o «0:05 - Nombre», con lo dicho en las líneas de abajo.
    const cabecera1 = new RegExp(`^(.{1,60}?)\\s*[-–|·]?\\s*[([]?(${HORA})[)\\]]?$`);
    const cabecera2 = new RegExp(`^[([]?(${HORA})[)\\]]?\\s*[-–|·]?\\s*(.{1,60})$`);
    // En línea: «[0:05] Nombre: texto», «Nombre (0:05): texto» o «Nombre: texto».
    const enLinea = new RegExp(`^(?:[([]?(${HORA})[)\\]]?\\s*[-–]?\\s*)?([^:]{1,60}?)\\s*(?:[([](${HORA})[)\\]])?\\s*:\\s+(.+)$`);
    const soloHora = new RegExp(`^[([]?${HORA}[)\\]]?$`);
    let actual: { hablante: string; segundo: number | null } | null = null;
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim();
      if (!linea || soloHora.test(linea)) continue;
      const m = linea.match(enLinea);
      if (m && esNombre(m[2])) {
        sumar(m[2].trim(), aSegundos(m[1] ?? m[3] ?? '') ?? null, m[4]);
        actual = null;
        continue;
      }
      const c1 = linea.match(cabecera1);
      const c2 = linea.match(cabecera2);
      if (c1 && esNombre(c1[1]) && c1[1].trim()) {
        actual = { hablante: c1[1].trim(), segundo: aSegundos(c1[2]) };
        sumar(actual.hablante, actual.segundo, '');
        continue;
      }
      if (c2 && esNombre(c2[2])) {
        actual = { hablante: c2[2].trim(), segundo: aSegundos(c2[1]) };
        sumar(actual.hablante, actual.segundo, '');
        continue;
      }
      // Fathom a veces pone el nombre en una línea y la hora en la siguiente.
      const siguiente = (lineas[i + 1] ?? '').trim();
      if (esNombre(linea) && soloHora.test(siguiente)) {
        actual = { hablante: linea, segundo: aSegundos(siguiente.replace(/[()[\]]/g, '')) };
        sumar(actual.hablante, actual.segundo, '');
        i++;
        continue;
      }
      sumar(null, null, linea);
    }
  }
  return segmentos.filter((s) => s.texto.trim());
}

/**
 * Lo que se leyó como hablante y no lo es («Mirá: te explico») vuelve a ser
 * texto de la intervención anterior.
 */
export function sinFalsosHablantes(segmentos: SegmentoCargado[], noSon: Set<string>): SegmentoCargado[] {
  const salida: SegmentoCargado[] = [];
  for (const s of segmentos) {
    if (s.hablante && noSon.has(s.hablante)) {
      const texto = `${s.hablante}: ${s.texto}`;
      const ultimo = salida[salida.length - 1];
      if (ultimo) ultimo.texto = `${ultimo.texto} ${texto}`;
      else salida.push({ hablante: null, segundo: s.segundo, texto });
      continue;
    }
    salida.push({ ...s });
  }
  return salida;
}

/** Hablantes en el orden en que aparecen, con cuántas veces hablan. */
export function hablantesDe(segmentos: SegmentoCargado[]): { nombre: string; veces: number }[] {
  const veces = new Map<string, number>();
  for (const s of segmentos) if (s.hablante) veces.set(s.hablante, (veces.get(s.hablante) ?? 0) + 1);
  return [...veces.entries()].map(([nombre, n]) => ({ nombre, veces: n }));
}

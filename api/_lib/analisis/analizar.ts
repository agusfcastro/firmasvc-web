/**
 * Análisis de una llamada con Claude (fase 5). Lo llama el procesador
 * interaccion_analizar de la cola (api/_lib/cola.ts).
 *   1. Arma la transcripción con roles, sin nombres ni contactos.
 *   2. Clasifica la etapa con un modelo chico. Si no es de venta (y FIRMA
 *      no pidió analizarla como venta), termina acá.
 *   3. Codifica la llamada con el libro de códigos (docs/ANALIZADOR_VENTA.md)
 *      y salida estructurada.
 *   4. Verifica cada cita contra la transcripción. La que no aparece textual
 *      pasa a descartes y no cuenta. Las que aparecen toman el minuto real.
 *   5. Devuelve lo que guarda analisis_guardar(): los códigos sin texto, que
 *      la base puntúa, y el informe completo, que la base cifra.
 * El puntaje no se calcula acá: lo hace la base (migración 0067).
 */
import Anthropic from '@anthropic-ai/sdk';
import { partesDelAnalizador } from './prompt.js';
import { armarTranscripcion, minuto, ubicarCita, type ContenidoLlamada, type Rol, type Transcripcion } from './transcripcion.js';

const MODELO_ANALISIS = 'claude-opus-5-5';
const MODELO_CLASIFICACION = 'claude-haiku-5-5';
const ETAPAS = ['venta', 'onboarding', 'seguimiento', 'soporte', 'otra'] as const;
const RIESGO = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'E1', 'F1', 'F2'] as const;
const PROTECTORES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;
const VENDEDOR = ['V1', 'V2', 'V3', 'V4'] as const;

type Etapa = (typeof ETAPAS)[number];
type Confianza = 'alta' | 'media' | 'baja' | 'no_evaluable';

/** Lo que devuelve analisis_contenido(). */
export interface DatosAnalisis {
  analisis_id: string;
  version: string;
  forzar_venta: boolean;
  titulo: string | null;
  ocurrida_en: string;
  duracion_seg: number | null;
  fuente: string;
  contenido: ContenidoLlamada;
  equipo: { nombre: string | null; email: string | null }[];
}

/** Lo que recibe analisis_guardar(). */
export interface ResultadoAnalisis {
  etapa: Etapa;
  confianza: Confianza | null;
  palabras_prospecto: number;
  codigos: { codigo: string; intensidad: number; corregido?: boolean }[];
  detalle: Record<string, unknown>;
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
}

interface Indicador {
  codigo: (typeof RIESGO)[number];
  intensidad: 1 | 2;
  cita: string;
  justificacion: string;
  inducido: boolean;
  corregido: boolean;
}
interface Protector {
  codigo: (typeof PROTECTORES)[number];
  intensidad: 1 | 2;
  cita: string;
  justificacion: string;
}
interface ConductaVendedor {
  codigo: (typeof VENDEDOR)[number];
  cita: string;
  comentario: string;
}
interface Descarte {
  fragmento: string;
  codigo_evaluado: string;
  motivo: string;
}
interface SalidaAnalisis {
  confianza: Confianza;
  confianza_motivo: string;
  conteo_compromiso: Record<'deseo' | 'necesidad' | 'razones' | 'capacidad' | 'compromiso' | 'freno', number>;
  sujeto_resultado: Record<'yo' | 'vendedor_o_programa' | 'otro', number>;
  indicadores: Indicador[];
  protectores: Protector[];
  conducta_vendedor: ConductaVendedor[];
  descartes: Descarte[];
  temas_no_explorados: string[];
  pautas: string[];
  lectura: string;
  linea_base: { resultado_y_fecha_declarados: string; garantia_mencionada: string; cuotas_mencionadas: string };
}

const entero = { type: 'integer' };
const texto = { type: 'string' };
const objeto = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const lista = (items: unknown) => ({ type: 'array', items });

const ESQUEMA_CLASIFICACION = objeto({ etapa: { type: 'string', enum: [...ETAPAS] }, motivo: texto });

const ESQUEMA_ANALISIS = objeto({
  confianza: { type: 'string', enum: ['alta', 'media', 'baja', 'no_evaluable'] },
  confianza_motivo: texto,
  conteo_compromiso: objeto({ deseo: entero, necesidad: entero, razones: entero, capacidad: entero, compromiso: entero, freno: entero }),
  sujeto_resultado: objeto({ yo: entero, vendedor_o_programa: entero, otro: entero }),
  indicadores: lista(
    objeto({
      codigo: { type: 'string', enum: [...RIESGO] },
      intensidad: { type: 'integer', enum: [1, 2] },
      cita: texto,
      justificacion: texto,
      inducido: { type: 'boolean' },
      corregido: { type: 'boolean' },
    }),
  ),
  protectores: lista(objeto({ codigo: { type: 'string', enum: [...PROTECTORES] }, intensidad: { type: 'integer', enum: [1, 2] }, cita: texto, justificacion: texto })),
  conducta_vendedor: lista(objeto({ codigo: { type: 'string', enum: [...VENDEDOR] }, cita: texto, comentario: texto })),
  descartes: lista(objeto({ fragmento: texto, codigo_evaluado: texto, motivo: texto })),
  temas_no_explorados: lista(texto),
  pautas: lista(texto),
  lectura: texto,
  linea_base: objeto({ resultado_y_fecha_declarados: texto, garantia_mencionada: texto, cuotas_mencionadas: texto }),
});

interface Uso {
  entrada: number;
  salida: number;
}

function cliente(): Anthropic {
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) throw new Error('Falta ANTHROPIC_API_KEY en el servidor.');
  return new Anthropic({ apiKey: clave });
}

/** Una vuelta con salida estructurada. El sistema va con caché: es el mismo en cada llamada. */
async function pedirJson<T>(
  api: Anthropic,
  p: { modelo: string; sistema: string; usuario: string; esquema: Record<string, unknown>; maxTokens: number; esfuerzo?: 'low' | 'medium' | 'high' },
): Promise<{ datos: T; uso: Uso; modelo: string }> {
  const stream = api.messages.stream({
    model: p.modelo,
    max_tokens: p.maxTokens,
    system: [{ type: 'text', text: p.sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: p.usuario }],
    output_config: { ...(p.esfuerzo ? { effort: p.esfuerzo } : {}), format: { type: 'json_schema', schema: p.esquema } },
  });
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') throw new Error('El modelo no analizó la llamada.');
  if (final.stop_reason === 'max_tokens') throw new Error('La respuesta del modelo se cortó antes de terminar.');
  const crudo = final.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('')
    .trim();
  let datos: T;
  try {
    datos = JSON.parse(crudo) as T;
  } catch {
    throw new Error('El modelo devolvió un JSON ilegible.');
  }
  const u = final.usage;
  return {
    datos,
    modelo: final.model,
    uso: { entrada: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), salida: u.output_tokens ?? 0 },
  };
}

function encabezado(d: DatosAnalisis, t: Transcripcion): string {
  const fecha = new Date(d.ocurrida_en).toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const filas = [
    `Título: ${d.titulo ? t.seudonimizar(d.titulo) : 'sin título'}`,
    `Fecha: ${fecha}`,
    d.duracion_seg ? `Duración: ${Math.max(1, Math.round(d.duracion_seg / 60))} minutos` : null,
    `Origen: ${d.fuente === 'manual' ? 'transcripción cargada a mano' : 'grabación de Fathom'}`,
    `Hablantes: ${t.hablantes.map((h) => `${h.etiqueta} (${h.intervenciones} intervenciones)`).join(', ') || 'ninguno'}`,
    t.rolesClaros
      ? null
      : 'Atención: no se pudo identificar con certeza quién es el vendedor y quién el prospecto. Deducilo por el contenido, citá solo lo que dice el prospecto y bajá la confianza.',
    t.recortada ? 'Atención: la transcripción es muy larga y se cortó. Analizá lo que hay y bajá la confianza.' : null,
  ].filter(Boolean);
  return `${filas.join('\n')}\n\nTranscripción:\n\n${t.texto}`;
}

/** La confianza no puede ser mejor de lo que permiten los datos. */
function confianzaFinal(delModelo: Confianza, t: Transcripcion): Confianza {
  const orden: Confianza[] = ['no_evaluable', 'baja', 'media', 'alta'];
  let tope: Confianza = 'alta';
  if (t.palabrasProspecto < 300) tope = 'no_evaluable';
  else if (!t.rolesClaros) tope = 'baja';
  else if (t.palabrasProspecto < 800 || t.recortada) tope = 'media';
  return orden[Math.min(orden.indexOf(delModelo), orden.indexOf(tope))] ?? tope;
}

export async function analizarLlamada(d: DatosAnalisis): Promise<ResultadoAnalisis> {
  const t = armarTranscripcion(d.contenido ?? {}, d.equipo ?? []);
  const base = { version: d.version, hablantes: t.hablantes, roles_claros: t.rolesClaros, recortada: t.recortada };

  if (!t.lineas.length) {
    return {
      etapa: d.forzar_venta ? 'venta' : 'otra',
      confianza: 'no_evaluable',
      palabras_prospecto: 0,
      codigos: [],
      detalle: { ...base, etapa_motivo: 'La llamada no tiene transcripción.', lectura: 'La llamada llegó sin transcripción, así que no hay nada para analizar.' },
      modelo: '',
      tokens_entrada: 0,
      tokens_salida: 0,
    };
  }

  const api = cliente();
  const prompt = partesDelAnalizador();
  const mensaje = encabezado(d, t);
  let entrada = 0;
  let salida = 0;
  const modelos: string[] = [];

  // 2. Etapa.
  let etapa: Etapa = 'venta';
  let etapaMotivo = 'FIRMA pidió analizarla como llamada de venta.';
  if (!d.forzar_venta) {
    const c = await pedirJson<{ etapa: Etapa; motivo: string }>(api, {
      modelo: MODELO_CLASIFICACION,
      sistema: prompt.clasificacion,
      usuario: mensaje,
      esquema: ESQUEMA_CLASIFICACION,
      maxTokens: 1024,
    });
    entrada += c.uso.entrada;
    salida += c.uso.salida;
    modelos.push(c.modelo);
    etapa = ETAPAS.includes(c.datos.etapa) ? c.datos.etapa : 'otra';
    etapaMotivo = String(c.datos.motivo ?? '').slice(0, 500);
    if (etapa !== 'venta') {
      return {
        etapa,
        confianza: null,
        palabras_prospecto: t.palabrasProspecto,
        codigos: [],
        detalle: { ...base, etapa_motivo: etapaMotivo, modelos },
        modelo: c.modelo,
        tokens_entrada: entrada,
        tokens_salida: salida,
      };
    }
  }

  // 3. Codificación.
  const a = await pedirJson<SalidaAnalisis>(api, {
    modelo: MODELO_ANALISIS,
    sistema: prompt.analisis,
    usuario: mensaje,
    esquema: ESQUEMA_ANALISIS,
    maxTokens: 16000,
    esfuerzo: 'medium',
  });
  entrada += a.uso.entrada;
  salida += a.uso.salida;
  modelos.push(a.modelo);
  const r = a.datos;

  // 4. Verificación de las citas.
  const delProspecto: Rol[] = t.rolesClaros ? ['prospecto'] : ['prospecto', 'hablante'];
  const delVendedor: Rol[] = t.rolesClaros ? ['vendedor'] : ['vendedor', 'hablante'];
  const descartes: (Descarte & { origen: 'modelo' | 'verificacion' })[] = (r.descartes ?? []).map((x) => ({ ...x, origen: 'modelo' }));
  let verificadas = 0;
  let rechazadas = 0;
  function verificar<T extends { cita: string; codigo: string }>(items: T[] | undefined, roles: Rol[], extra?: (x: T) => string | null) {
    const buenos: (T & { minuto: string })[] = [];
    for (const x of items ?? []) {
      const linea = ubicarCita(t, x.cita, roles);
      const motivo = !linea
        ? 'La cita no aparece textual en lo que dijo ese hablante. El sistema no la tomó.'
        : (extra?.(x) ?? null);
      if (motivo) {
        if (!linea) rechazadas++;
        descartes.push({ fragmento: x.cita, codigo_evaluado: x.codigo, motivo, origen: 'verificacion' });
        continue;
      }
      verificadas++;
      buenos.push({ ...x, minuto: minuto(linea!.segundo) });
    }
    return buenos;
  }
  const indicadores = verificar(r.indicadores, delProspecto, (x) =>
    x.codigo === 'A4' && t.palabrasProspecto < 300 ? 'El prospecto habló menos de 300 palabras, así que A4 no se codifica.' : null,
  );
  const protectores = verificar(r.protectores, delProspecto);
  const vendedor = verificar(r.conducta_vendedor, delVendedor);

  // 5. Resultado. La intensidad y la corrección de A1 van a la base para puntuar.
  const codigos = [
    ...indicadores.map((x) => ({ codigo: x.codigo, intensidad: x.intensidad, corregido: Boolean(x.corregido) })),
    ...protectores.map((x) => ({ codigo: x.codigo, intensidad: x.intensidad })),
    ...vendedor.map((x) => ({ codigo: x.codigo, intensidad: 1 })),
  ];
  return {
    etapa: 'venta',
    confianza: confianzaFinal(r.confianza, t),
    palabras_prospecto: t.palabrasProspecto,
    codigos,
    detalle: {
      ...base,
      etapa_motivo: etapaMotivo,
      confianza_modelo: r.confianza,
      confianza_motivo: r.confianza_motivo,
      lectura: r.lectura,
      conteo_compromiso: r.conteo_compromiso,
      sujeto_resultado: r.sujeto_resultado,
      indicadores,
      protectores,
      conducta_vendedor: vendedor,
      descartes,
      temas_no_explorados: r.temas_no_explorados ?? [],
      pautas: r.pautas ?? [],
      linea_base: r.linea_base,
      verificacion: { citas_verificadas: verificadas, citas_rechazadas: rechazadas },
      modelos,
    },
    modelo: a.modelo,
    tokens_entrada: entrada,
    tokens_salida: salida,
  };
}

/**
 * Puntaje del evaluador de la IA. Todo lo calcula el código, nunca el modelo:
 * Claude como juez solo dice si cada criterio se cumple, en parte o no.
 *
 *   Un caso vale 0 si falla un chequeo fijo. Si los pasa, vale lo que da la
 *   rúbrica (cumple 1, en parte 0,5, no 0, por el peso de cada criterio) o
 *   100 si no tiene rúbrica.
 *   Un agente vale el promedio de sus casos, de 0 a 100.
 */

export const TOLERANCIA = 2;

const RIESGO = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'E1', 'F1', 'F2'];
const PROTECTORES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
const VENDEDOR = ['V1', 'V2', 'V3', 'V4'];
const CODIGOS = new Set([...RIESGO, ...PROTECTORES, ...VENDEDOR]);
const ETAPAS = ['venta', 'onboarding', 'seguimiento', 'soporte', 'otra'];
const CAMINOS = ['accionable', 'recurso', 'derivacion'];

/** Minúsculas y sin tildes, para comparar frases. */
export const normal = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

const chequeo = (nombre, ok, detalle = '') => ({ nombre, ok: Boolean(ok), ...(ok || !detalle ? {} : { detalle }) });

function textos(e, texto) {
  const t = normal(texto);
  return [
    ...(e.incluye ?? []).map((f) => chequeo(`dice «${f}»`, t.includes(normal(f)), 'No lo dice.')),
    ...(e.excluye ?? []).map((f) => chequeo(`no dice «${f}»`, !t.includes(normal(f)), 'Lo dice.')),
  ];
}

/** Chequeos fijos de una salida. Devuelve la lista, cada uno con ok. */
export function chequeosFijos(agente, salida, esperado = {}) {
  if (!salida || salida.error) return [chequeo('el agente responde', false, salida?.error ?? 'Sin salida.')];
  const e = esperado ?? {};

  if (agente === 'tina') {
    const usadas = (salida.herramientas ?? []).map((h) => (typeof h === 'string' ? h : h.nombre));
    return [
      chequeo('responde algo', String(salida.texto ?? '').trim() || usadas.length, 'La respuesta salió vacía.'),
      chequeo('el camino es válido', CAMINOS.includes(salida.camino), `Camino ${salida.camino}.`),
      ...(e.camino ? [chequeo(`camino ${e.camino}`, salida.camino === e.camino, `Fue ${salida.camino}.`)] : []),
      ...(e.herramientas ?? []).map((h) => chequeo(`usa ${h}`, usadas.includes(h), `Usó ${usadas.join(', ') || 'ninguna'}.`)),
      ...(e.sin_herramientas ?? []).map((h) => chequeo(`no usa ${h}`, !usadas.includes(h), `Usó ${h}.`)),
      ...textos(e, salida.texto),
    ];
  }

  if (agente.startsWith('analisis_')) {
    const codigos = (salida.codigos ?? []).map((c) => c.codigo);
    const lista = [
      chequeo('la etapa es válida', ETAPAS.includes(salida.etapa), `Etapa ${salida.etapa}.`),
      chequeo('los códigos son del libro', codigos.every((c) => CODIGOS.has(c)), `Códigos ${codigos.filter((c) => !CODIGOS.has(c)).join(', ')}.`),
      ...(e.etapa ? [chequeo(`etapa ${e.etapa}`, salida.etapa === e.etapa, `Fue ${salida.etapa}.`)] : []),
      ...(e.codigos ?? []).map((c) => chequeo(`marca ${c}`, codigos.includes(c), `Marcó ${codigos.join(', ') || 'ninguno'}.`)),
      ...(e.sin_codigos ?? []).map((c) => chequeo(`no marca ${c}`, !codigos.includes(c), `Marcó ${c}.`)),
    ];
    if (salida.etapa === 'venta') lista.push(chequeo('la confianza es válida', ['alta', 'media', 'baja', 'no_evaluable'].includes(salida.confianza), `Confianza ${salida.confianza}.`));
    return lista;
  }

  return [chequeo('agente conocido', false, `No sé evaluar ${agente}.`)];
}

const VALOR = { cumple: 1, parcial: 0.5, no_cumple: 0 };

/** Puntaje de la rúbrica, de 0 a 1, con los veredictos del juez. Un criterio sin veredicto vale 0. */
export function puntajeRubrica(rubrica, veredictos) {
  const porId = new Map((veredictos ?? []).map((v) => [v.id, v]));
  let total = 0;
  let logrado = 0;
  rubrica.forEach((c, i) => {
    const peso = Number(c.peso) > 0 ? Number(c.peso) : 1;
    total += peso;
    logrado += peso * (VALOR[porId.get(`c${i + 1}`)?.nivel] ?? 0);
  });
  return total ? logrado / total : 1;
}

/** Puntaje de un caso, de 0 a 100. */
export function puntajeCaso(chequeos, rubrica, veredictos) {
  if (chequeos.some((c) => !c.ok)) return 0;
  if (!rubrica?.length) return 100;
  return Math.round(1000 * puntajeRubrica(rubrica, veredictos)) / 10;
}

/** Puntaje de un agente: el promedio de sus casos, con un decimal. */
export function puntajeAgente(puntajes) {
  if (!puntajes.length) return null;
  return Math.round((10 * puntajes.reduce((s, p) => s + p, 0)) / puntajes.length) / 10;
}

/**
 * Compara la versión nueva con la anterior. Falla si el puntaje baja más
 * que la tolerancia o si queda debajo del umbral del agente, cuando tiene.
 */
export function veredicto({ nuevo, anterior, umbral, tolerancia = TOLERANCIA }) {
  const motivos = [];
  if (nuevo === null) return { ok: true, motivos: ['Sin casos.'] };
  if (typeof umbral === 'number' && nuevo < umbral) motivos.push(`Queda en ${nuevo}, debajo del umbral de ${umbral}.`);
  if (typeof anterior === 'number' && nuevo < anterior - tolerancia) motivos.push(`Baja de ${anterior} a ${nuevo}, más de ${tolerancia} puntos.`);
  return { ok: motivos.length === 0, motivos };
}

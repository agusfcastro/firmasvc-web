/**
 * Casos de prueba de la IA (ia_casos, migración 0074). Lo que se espera de
 * cada agente y el archivo que lee el evaluador (scripts/ia/evaluar.mjs).
 *
 * esperado
 *   camino            Tina: accionable, recurso o derivacion
 *   herramientas      Tina: las que tiene que usar
 *   sin_herramientas  Tina: las que no puede usar
 *   etapa             Analizador: la etapa de la llamada
 *   codigos           Analizador: los que tienen que salir
 *   sin_codigos       Analizador: los que no pueden salir
 *   incluye, excluye  Lo que la respuesta tiene que decir y lo que no
 *   rubrica           [{ criterio, peso }], la puntúa Claude como juez
 */
export type AgenteIa = 'tina' | 'analisis_clasificacion' | 'analisis_venta' | 'borradores_comentarios';

export const AGENTES: Record<AgenteIa, string> = {
  tina: 'Tina',
  analisis_clasificacion: 'Clasificación de llamadas',
  analisis_venta: 'Análisis de venta',
  borradores_comentarios: 'Borradores de comentarios',
};

export const nombreAgente = (a: string): string => AGENTES[a as AgenteIa] ?? a;

export const CAMINOS = ['accionable', 'recurso', 'derivacion'] as const;
export const ETAPAS = ['venta', 'onboarding', 'seguimiento', 'soporte', 'otra'] as const;

export interface Esperado {
  camino?: (typeof CAMINOS)[number];
  herramientas?: string[];
  sin_herramientas?: string[];
  etapa?: (typeof ETAPAS)[number];
  codigos?: string[];
  sin_codigos?: string[];
  incluye?: string[];
  excluye?: string[];
  rubrica?: { criterio: string; peso: number }[];
}

export interface CasoIa {
  id: number;
  agente: string;
  etiqueta: string;
  origen: 'manual' | 'correccion' | 'manipulacion';
  corrida_id: number | null;
  entrada: Record<string, unknown>;
  esperado: Esperado;
  activo: boolean;
  creado_en: string;
}

/** Lo que se carga en el formulario del caso, todo en texto. */
export interface FormularioEsperado {
  camino: string;
  herramientas: string;
  sin_herramientas: string;
  etapa: string;
  codigos: string;
  sin_codigos: string;
  incluye: string;
  excluye: string;
  criterios: string;
}

/** Una lista escrita con comas o un renglón por ítem. */
export const lista = (s: string): string[] =>
  [...new Set(s.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean))];

/** Arma esperado desde el formulario. Un criterio por renglón; «(2)» al final le da peso 2. */
export function esperadoDesde(f: FormularioEsperado): Esperado {
  const e: Esperado = {};
  if ((CAMINOS as readonly string[]).includes(f.camino)) e.camino = f.camino as Esperado['camino'];
  if ((ETAPAS as readonly string[]).includes(f.etapa)) e.etapa = f.etapa as Esperado['etapa'];
  const asignar = (clave: 'herramientas' | 'sin_herramientas' | 'codigos' | 'sin_codigos' | 'incluye' | 'excluye', valor: string, mayusculas = false) => {
    const l = lista(valor).map((x) => (mayusculas ? x.toUpperCase() : x));
    if (l.length) e[clave] = l;
  };
  asignar('herramientas', f.herramientas);
  asignar('sin_herramientas', f.sin_herramientas);
  asignar('codigos', f.codigos, true);
  asignar('sin_codigos', f.sin_codigos, true);
  // Lo que tiene que decir o no va un renglón por ítem: una frase puede llevar comas.
  const renglones = (s: string) => [...new Set(s.split('\n').map((x) => x.trim()).filter(Boolean))];
  if (renglones(f.incluye).length) e.incluye = renglones(f.incluye);
  if (renglones(f.excluye).length) e.excluye = renglones(f.excluye);
  const rubrica = f.criterios
    .split('\n')
    .map((x) => x.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)
    .map((x) => {
      const m = x.match(/^(.*?)\s*\((\d)\)\s*$/);
      return m ? { criterio: m[1], peso: Math.min(5, Math.max(1, Number(m[2]))) } : { criterio: x, peso: 1 };
    });
  if (rubrica.length) e.rubrica = rubrica;
  return e;
}

/** Revisa la entrada de un caso antes de guardarlo. Devuelve el problema o null. */
export function problemaDeEntrada(agente: string, entrada: unknown): string | null {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return 'La entrada tiene que ser un objeto JSON.';
  const e = entrada as Record<string, unknown>;
  if (agente === 'tina') {
    const m = e.mensajes;
    if (!Array.isArray(m) || !m.length) return 'Tina necesita mensajes, con el último de la persona.';
    const ultimo = m[m.length - 1] as { autor?: unknown; contenido?: unknown };
    if (ultimo?.autor !== 'usuario' || typeof ultimo.contenido !== 'string' || !ultimo.contenido.trim()) return 'El último mensaje tiene que ser de la persona.';
    if (e.plan !== undefined && e.plan !== 'eminent' && e.plan !== 'starter') return 'El plan es eminent o starter.';
  }
  if (agente.startsWith('analisis_')) {
    const c = e.contenido as { transcripcion?: unknown } | undefined;
    if (!c || !Array.isArray(c.transcripcion) || !c.transcripcion.length) return 'El analizador necesita contenido.transcripcion.';
  }
  if (agente === 'borradores_comentarios' && (!Array.isArray(e.hilos) || !e.hilos.length)) return 'Los borradores necesitan al menos un hilo.';
  if (/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i.test(JSON.stringify(e))) return 'Quedó un mail en la entrada. Reemplazalo por [mail].';
  return null;
}

/** El archivo de un agente para scripts/ia/casos/, con los casos activos. */
export function archivoParaEvaluador(agente: string, casos: CasoIa[]): string {
  const activos = casos
    .filter((c) => c.agente === agente && c.activo)
    .sort((a, b) => a.id - b.id)
    .map((c) => ({ id: `db-${c.id}`, etiqueta: c.etiqueta, origen: c.origen, entrada: c.entrada, esperado: c.esperado }));
  return `${JSON.stringify({ agente, casos: activos }, null, 2)}\n`;
}

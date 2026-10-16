// Tipos del motor de protocolos FIRMA.
// Cada protocolo es una definición de datos. El motor la convierte en página,
// con ficha configurable, índice, impresión y herramientas interactivas.
//
// Convenciones de los textos
//   {clave}      variable de la ficha (se resalta y se completa sola)
//   [[texto]]    dato que se completa en el momento (se resalta distinto)
//   **texto**    énfasis
// Regla de estilo de FIRMA para los textos, sin rayas ni dos puntos.

import type { ComponentType } from 'react';

// Ficha

export type ValorFicha = string | boolean;
export type Ficha = Record<string, ValorFicha>;

export interface OpcionCampo {
  valor: string;
  rotulo: string;
}

interface CampoBase {
  clave: string;
  etiqueta: string;
  ayuda?: string;
  /** El campo solo se muestra si la condición se cumple. */
  cuando?: (f: Ficha) => boolean;
}

export type CampoFicha =
  | (CampoBase & { tipo: 'texto'; ejemplo?: string; ancho?: boolean; numerico?: boolean })
  | (CampoBase & { tipo: 'opciones'; opciones: OpcionCampo[]; ancho?: boolean })
  | (CampoBase & { tipo: 'interruptor' });

export interface GrupoFicha {
  titulo: string;
  campos: CampoFicha[];
}

export interface Aviso {
  nivel: 'info' | 'alerta' | 'riesgo';
  texto: string;
}

export interface DefFicha {
  /** Texto que acompaña la sección de la ficha. */
  intro: string;
  grupos: GrupoFicha[];
  /** Valores por defecto. Define también las claves válidas y su tipo. */
  vacia: Ficha;
  ejemplo: Ficha;
  /** Rótulo que se muestra cuando una variable todavía no se completó. */
  rotulos: Record<string, string>;
  /** Valores finales para resaltar en los textos. null significa que falta completarlo. */
  valores: (f: Ficha) => Record<string, string | null>;
  /** Textos que dependen de la ficha y se expanden antes de resaltar variables. */
  macros?: (f: Ficha) => Record<string, string>;
  avisos?: (f: Ficha) => Aviso[];
  /** Resumen que se imprime en lugar del formulario. */
  resumen: { rotulo: string; texto: string }[];
}

// Bloques de contenido

export type BloqueGuion =
  | { tipo: 'decir'; etiqueta: string; texto: string; condicion?: string }
  | { tipo: 'nota'; etiqueta: string; texto: string }
  | { tipo: 'porque'; texto: string }
  | { tipo: 'nunca'; textos: string[] };

export interface Guion {
  id: string;
  titulo: string;
  bajada: string;
  bloques: BloqueGuion[];
}

export interface Etapa {
  titulo: string;
  /** Línea corta debajo del título. Por ejemplo responsable y plazo. */
  cuando: string;
  datos: { rotulo: string; texto: string; estilo?: 'frase' | 'error' }[];
}

export interface ColumnaTabla {
  rotulo: string;
  /** Ancho relativo, por ejemplo 1.2fr. */
  ancho?: string;
  estilo?: 'no' | 'si' | 'porque' | 'senal' | 'pastilla' | 'fuerte';
}

export interface ItemJuridico {
  lead: string;
  texto: string;
  nivel?: 'ALTO' | 'MEDIO' | 'BAJO';
}

export interface BloqueJuridico {
  id: string;
  titulo: string;
  bajada: string;
  items: ItemJuridico[];
  abierto?: boolean;
}

export interface Kpi {
  nombre: string;
  formula: string;
  lectura: string;
  meta?: string;
  frecuencia?: string;
  fuente?: string;
}

export interface ItemBolsillo {
  rotulo: string;
  texto?: string;
  lista?: string[];
  numerada?: boolean;
  tono?: 'nunca' | 'cita';
}

export type Nivel = 'verde' | 'ambar' | 'rojo' | 'info';

export interface PreguntaSemaforo {
  id: string;
  texto: string;
  ayuda?: string;
  opciones: OpcionCampo[];
}

export interface ResultadoSemaforo {
  nivel: Nivel;
  titulo: string;
  pasos: string[];
}

export interface EntradaCalculo {
  id: string;
  rotulo: string;
  ayuda?: string;
  /** Unidad que se muestra al lado del campo. 'moneda' usa la moneda de la ficha. */
  unidad?: 'moneda' | '%' | 'días' | 'horas' | 'personas' | 'casos' | 'puntos' | string;
  inicial?: string;
}

export type FormatoCalculo = 'pct' | 'monto' | 'num' | 'dias' | 'veces' | 'puntos';

export interface SalidaCalculo {
  id: string;
  rotulo: string;
  formato: FormatoCalculo;
  calcular: (v: Record<string, number | null>, f: Ficha) => number | null;
  ayuda?: string;
  /** Meta orientativa. 'max' significa que el valor no debería superarla. */
  meta?: { valor: number; sentido: 'max' | 'min' };
  destacada?: boolean;
}

export interface BarraCalculo {
  min: number;
  max: number;
  zona?: [number, number];
  zonaRotulo?: string;
  marcas: { valor: number; rotulo: string }[];
}

export interface CriterioRubrica {
  id: string;
  nombre: string;
  peso: number;
  /** Qué significa cada puntaje, de 1 a 4. */
  anclas: [string, string, string, string];
}

export interface NivelEvaluacion {
  desde: number;
  nivel: Nivel;
  titulo: string;
  texto: string;
}

export interface OpcionPlazo {
  id: string;
  rotulo: string;
  cantidad: number;
  unidad: 'horas' | 'corridos' | 'habiles' | 'meses';
  nota?: string;
}

export type Bloque =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'aclaracion'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'leyenda'; vivo?: string }
  | { tipo: 'ficha' }
  | { tipo: 'roles'; items: { rol: string; foco: string }[] }
  | { tipo: 'reglas'; items: { titulo: string; texto: string }[] }
  | { tipo: 'tips'; items: { titulo: string; texto: string }[] }
  | {
      tipo: 'tarjetas';
      items: {
        titulo: string;
        texto?: string;
        lista?: string[];
        numerada?: boolean;
        check?: boolean;
        leads?: { lead: string; texto: string }[];
        cita?: string;
      }[];
    }
  | { tipo: 'etapas'; items: Etapa[] }
  | { tipo: 'guiones'; aria: string; items: Guion[] }
  | { tipo: 'acordeones'; items: { titulo: string; subtitulo?: string; insignia?: string; abierto?: boolean; destacado?: boolean; bloques: BloqueGuion[] }[] }
  | { tipo: 'tabla'; aria: string; columnas: ColumnaTabla[]; filas: string[][] }
  | { tipo: 'checklist'; id: string; titulo: string; items: { id: string; texto: string; critico: boolean }[]; textoConforme?: string; textoNoConforme?: string }
  | { tipo: 'kpis'; items: Kpi[] }
  | { tipo: 'juridico'; items: BloqueJuridico[] }
  | { tipo: 'correo'; titulo: string; asunto: string; cuerpo: string[]; nota?: string }
  | { tipo: 'bolsillo'; filas: (ItemBolsillo | ItemBolsillo[])[] }
  | {
      tipo: 'semaforo';
      id: string;
      titulo: string;
      preguntas: PreguntaSemaforo[];
      evaluar: (r: Record<string, string>, f: Ficha) => ResultadoSemaforo | null;
    }
  | {
      tipo: 'calculadora';
      id: string;
      titulo: string;
      intro?: string;
      entradas: EntradaCalculo[];
      salidas: SalidaCalculo[];
      barra?: (v: Record<string, number | null>, r: Record<string, number | null>, f: Ficha) => BarraCalculo | null;
      conclusion?: (v: Record<string, number | null>, r: Record<string, number | null>, f: Ficha) => { nivel: Nivel; texto: string } | null;
      nota?: string;
    }
  | { tipo: 'rubrica'; id: string; titulo: string; intro?: string; criterios: CriterioRubrica[]; niveles: NivelEvaluacion[] }
  | { tipo: 'evaluacion'; id: string; titulo: string; intro?: string; items: { id: string; texto: string; peso: number }[]; niveles: NivelEvaluacion[] }
  | { tipo: 'plazos'; id: string; titulo: string; intro?: string; opciones: OpcionPlazo[] }
  | { tipo: 'componente'; componente: ComponentType<{ ficha: Ficha }> };

export interface Seccion {
  id: string;
  titulo: string;
  /** Rótulo corto del índice. */
  corto: string;
  intro?: string;
  /** La sección es la tarjeta de bolsillo, que se imprime sola con su botón. */
  tarjeta?: boolean;
  bloques: Bloque[];
}

export interface DefProtocolo {
  id: string;
  ruta: string;
  tituloPagina: string;
  meta: { kicker: string; titulo: string; bajada: string; version: string };
  ideas: { titulo: string; texto: string }[];
  ficha: DefFicha;
  secciones: (f: Ficha) => Seccion[];
  pie: string;
  /** Clave de almacenamiento local. Cambiarla invalida fichas guardadas. */
  claveLocal: string;
}

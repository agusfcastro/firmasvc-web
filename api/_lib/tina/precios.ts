/**
 * Costo estimado de cada respuesta de Tina, en USD, a partir del uso de
 * tokens que devuelve la API de Claude. Precios por millón de tokens de la
 * API de Anthropic (noviembre de 2026). La escritura de caché de 5 minutos
 * cuesta 1,25 veces la entrada.
 * Si la respuesta la terminó un modelo de respaldo (fallbacks), cada tramo
 * se cobra con el precio de su modelo: por eso se suma iteración por iteración.
 */
import type Anthropic from '@anthropic-ai/sdk';

interface Precio {
  entrada: number;
  salida: number;
  lecturaCache: number;
}

const PRECIOS: Record<string, Precio> = {
  'claude-opus-5-5': { entrada: 4, salida: 20, lecturaCache: 0.2 },
  'claude-opus-5': { entrada: 5, salida: 25, lecturaCache: 0.5 },
  'claude-opus-4-8': { entrada: 5, salida: 25, lecturaCache: 0.5 },
  'claude-sonnet-5-5': { entrada: 2, salida: 10, lecturaCache: 0.2 },
  'claude-haiku-5-5': { entrada: 0.1, salida: 0.5, lecturaCache: 0.01 },
};

/** Si aparece un modelo sin precio cargado, se estima con el más caro de la tabla. */
const POR_DEFECTO: Precio = { entrada: 5, salida: 25, lecturaCache: 0.5 };

export interface Consumo {
  entrada: number;
  salida: number;
  escrituraCache: number;
  lecturaCache: number;
  costoUsd: number;
}

export const consumoVacio = (): Consumo => ({ entrada: 0, salida: 0, escrituraCache: 0, lecturaCache: 0, costoUsd: 0 });

function costo(modelo: string | null | undefined, entrada: number, salida: number, escritura: number, lectura: number): number {
  const p = (modelo && PRECIOS[modelo]) || POR_DEFECTO;
  return (entrada * p.entrada + escritura * p.entrada * 1.25 + lectura * p.lecturaCache + salida * p.salida) / 1_000_000;
}

/** Suma al acumulado el uso de una respuesta. */
export function sumarUso(acumulado: Consumo, mensaje: Anthropic.Beta.BetaMessage): void {
  const u = mensaje.usage;
  acumulado.entrada += u.input_tokens;
  acumulado.salida += u.output_tokens;
  acumulado.escrituraCache += u.cache_creation_input_tokens ?? 0;
  acumulado.lecturaCache += u.cache_read_input_tokens ?? 0;
  const tramos = u.iterations ?? [];
  if (tramos.length) {
    for (const t of tramos) {
      if (t.type !== 'message' && t.type !== 'fallback_message') continue;
      acumulado.costoUsd += costo(t.model ?? mensaje.model, t.input_tokens, t.output_tokens, t.cache_creation_input_tokens, t.cache_read_input_tokens);
    }
  } else {
    acumulado.costoUsd += costo(mensaje.model, u.input_tokens, u.output_tokens, u.cache_creation_input_tokens ?? 0, u.cache_read_input_tokens ?? 0);
  }
}

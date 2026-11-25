/**
 * Auditoría de la IA (migración 0074). Cada llamada a Claude deja una corrida
 * anotada en ia_corridas: qué agente, con qué versión de prompt, qué modelo,
 * cuánto costó y cuánto tardó. El contenido no se copia: la corrida apunta al
 * registro donde ya está guardado, con sus permisos y su cifrado.
 *
 * Anotar nunca cambia lo que responde un agente: si falla, se sigue igual.
 */
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AgenteIa = 'tina' | 'analisis_clasificacion' | 'analisis_venta' | 'borradores_comentarios';

/** La versión de un prompt es la huella de su texto: si el prompt cambia, la versión cambia sola. */
export function huellaPrompt(...partes: unknown[]): string {
  const h = createHash('sha256');
  for (const p of partes) h.update(typeof p === 'string' ? p : JSON.stringify(p ?? null));
  return h.digest('hex').slice(0, 12);
}

export interface Corrida {
  agente: AgenteIa;
  versionPrompt: string;
  modelo?: string | null;
  organizacionId?: string | null;
  referencia?: { tabla: 'tina_conversaciones' | 'interaccion_analisis' | 'asunto_archivos'; id: string } | null;
  tokensEntrada?: number;
  tokensSalida?: number;
  costoUsd?: number;
  duracionMs?: number;
  error?: string | null;
  /** Lo que no sale a un cliente sin pasar antes por FIRMA ya tiene su propia revisión. */
  revision?: 'pendiente' | 'sin_revision';
}

export async function registrarCorrida(sb: SupabaseClient | null, c: Corrida): Promise<void> {
  if (!sb) return;
  try {
    const { error } = await sb.from('ia_corridas').insert({
      agente: c.agente,
      version_prompt: c.versionPrompt,
      modelo: c.modelo ?? '',
      organizacion_id: c.organizacionId ?? null,
      referencia_tabla: c.referencia?.tabla ?? null,
      referencia_id: c.referencia?.id ?? null,
      tokens_entrada: Math.max(0, Math.round(c.tokensEntrada ?? 0)),
      tokens_salida: Math.max(0, Math.round(c.tokensSalida ?? 0)),
      costo_usd: Number(Math.max(0, c.costoUsd ?? 0).toFixed(6)),
      duracion_ms: c.duracionMs === undefined ? null : Math.max(0, Math.round(c.duracionMs)),
      error: c.error ? c.error.slice(0, 500) : null,
      revision: c.revision ?? 'pendiente',
    });
    if (error) console.warn('[ia] no se pudo anotar la corrida:', error.message);
  } catch (e) {
    console.warn('[ia] no se pudo anotar la corrida:', e instanceof Error ? e.message : e);
  }
}

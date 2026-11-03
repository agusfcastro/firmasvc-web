/**
 * Procesamiento de la cola de trabajos (migración 0048). Lo usan el webhook
 * de Fathom, para procesar en caliente el trabajo que acaba de encolar, y
 * /api/cola/procesar, que barre lo que quedó (pg_cron lo llama cada minuto).
 * Corre con la clave de servicio: la cola no es de ningún usuario.
 * Cada tipo de trabajo es una función que recibe el payload (solo ids). Si
 * lanza un error, el trabajo vuelve a la cola con una espera creciente.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface Trabajo {
  id: number;
  organizacion_id: string | null;
  tipo: string;
  payload: Record<string, unknown>;
  intentos: number;
  max_intentos: number;
}

type Procesador = (sb: SupabaseClient, payload: Record<string, unknown>) => Promise<void>;

const PROCESADORES: Record<string, Procesador> = {
  // Cruza los mails de la llamada con el equipo y los clientes del CRM.
  async interaccion_vincular(sb, payload) {
    const { error } = await sb.rpc('interaccion_vincular', { p_interaccion: payload.interaccion_id });
    if (error) throw new Error(error.message);
  },
};

export function clienteServicio(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Procesa un trabajo ya tomado y lo cierra. true si terminó bien. */
export async function procesarTrabajo(sb: SupabaseClient, t: Trabajo): Promise<boolean> {
  try {
    const procesador = PROCESADORES[t.tipo];
    if (!procesador) throw new Error(`No hay procesador para el tipo ${t.tipo}.`);
    await procesador(sb, t.payload ?? {});
    await sb.rpc('cola_terminar', { p_id: t.id });
    return true;
  } catch (e) {
    await sb.rpc('cola_fallar', { p_id: t.id, p_error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

/**
 * Toma y procesa trabajos hasta vaciar la cola o pasar el tiempo. Con id,
 * solo ese trabajo (si otro procesador ya lo tomó, no hace nada).
 */
export async function procesarCola(sb: SupabaseClient, opciones: { id?: number; hastaMs?: number } = {}): Promise<{ hechos: number; fallidos: number }> {
  const limite = Date.now() + (opciones.hastaMs ?? 40_000);
  let hechos = 0;
  let fallidos = 0;
  do {
    const { data, error } = await sb.rpc('cola_tomar', { p_cantidad: opciones.id ? 1 : 5, p_segundos: 120, p_id: opciones.id ?? null });
    if (error) throw new Error(error.message);
    const trabajos = (data as Trabajo[] | null) ?? [];
    if (!trabajos.length) break;
    for (const t of trabajos) {
      if (await procesarTrabajo(sb, t)) hechos++;
      else fallidos++;
    }
  } while (!opciones.id && Date.now() < limite);
  return { hechos, fallidos };
}

import { supabase } from './supabase';

/**
 * Estado de asuntos: tipos, rótulos y el pedido de avisos por mail.
 * Las reglas de quién ve y quién escribe están en la migración 0017.
 */

export type EstadoAsunto = 'en_curso' | 'espera_cliente' | 'espera_tercero' | 'finalizado';
export type TipoAsunto = 'contrato' | 'conflicto' | 'marca' | 'societario' | 'cobranza' | 'consulta' | 'otro';

export interface Asunto {
  id: string;
  organizacion_id: string;
  titulo: string;
  tipo: TipoAsunto;
  estado: EstadoAsunto;
  proximo_paso: string | null;
  vence_en: string | null;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
  cerrado_en: string | null;
}

export interface Novedad {
  id: string;
  asunto_id: string;
  organizacion_id: string;
  texto: string;
  estado: EstadoAsunto | null;
  autor_id: string | null;
  avisado_en: string | null;
  avisados: number;
  creado_en: string;
}

type Tono = 'bosque' | 'piedra' | 'alerta' | 'tinta';

export const TIPO_ASUNTO: Record<TipoAsunto, string> = {
  contrato: 'Contrato',
  conflicto: 'Conflicto',
  marca: 'Marca',
  societario: 'Societario',
  cobranza: 'Cobranza',
  consulta: 'Consulta',
  otro: 'Otro',
};

/** Cómo lo lee el cliente y cómo lo lee FIRMA. */
export const ESTADO_ASUNTO: Record<EstadoAsunto, { cliente: string; firma: string; tono: Tono }> = {
  en_curso: { cliente: 'En curso', firma: 'En curso', tono: 'bosque' },
  espera_cliente: { cliente: 'Esperando tu respuesta', firma: 'Esperando al cliente', tono: 'alerta' },
  espera_tercero: { cliente: 'Esperando a un tercero', firma: 'Esperando a un tercero', tono: 'piedra' },
  finalizado: { cliente: 'Finalizado', firma: 'Finalizado', tono: 'tinta' },
};

export const ESTADOS: EstadoAsunto[] = ['en_curso', 'espera_cliente', 'espera_tercero', 'finalizado'];

const ZONA = 'America/Argentina/Buenos_Aires';
export const fechaAsunto = (iso: string): string => new Date(iso).toLocaleDateString('es-AR', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' });
export const fechaHoraAsunto = (iso: string): string =>
  new Date(iso).toLocaleString('es-AR', { timeZone: ZONA, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** vence_en es una fecha sin hora: se muestra tal cual, sin pasar por la zona horaria. */
export const fechaVence = (d: string): string => {
  const [a, m, dia] = d.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dia, 12)).toLocaleDateString('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
};

/** Pide el aviso por mail de una novedad o de un documento nuevo. Devuelve a cuántas personas salió. */
export async function avisarPorMail(tipo: 'novedad' | 'documento', id: string): Promise<{ ok: boolean; avisados?: number; error?: string }> {
  if (!supabase) return { ok: false, error: 'Portal sin configurar.' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'Tu sesión venció. Volvé a ingresar.' };
  try {
    const r = await fetch('/api/portal/avisos', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ tipo, id }),
    });
    const j = (await r.json().catch(() => ({}))) as { avisados?: number; error?: string };
    if (!r.ok) return { ok: false, error: j.error || `Error ${r.status}` };
    return { ok: true, avisados: j.avisados ?? 0 };
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor.' };
  }
}

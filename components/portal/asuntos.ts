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
  /** A-<prefijo de la empresa>-<número>, por ejemplo A-TB-001. Lo asigna la base al crear el asunto. */
  codigo: string | null;
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

/** Entrada de la bitácora: nota de FIRMA, cambio de estado o documento subido. */
export interface Novedad {
  id: string;
  asunto_id: string;
  organizacion_id: string;
  texto: string;
  tipo: 'nota' | 'estado' | 'documento';
  /** Solo FIRMA la ve. */
  interna: boolean;
  estado: EstadoAsunto | null;
  autor_id: string | null;
  avisado_en: string | null;
  avisados: number;
  creado_en: string;
}

export interface Mensaje {
  id: string;
  asunto_id: string;
  organizacion_id: string;
  texto: string;
  autor_id: string | null;
  creado_en: string;
}

export interface Archivo {
  id: string;
  asunto_id: string;
  organizacion_id: string;
  nombre: string;
  ruta: string;
  bytes: number | null;
  subido_por: string | null;
  creado_en: string;
}

export const BUCKET_ASUNTOS = 'asuntos';
export const MAX_BYTES_ASUNTO = 20 * 1024 * 1024;

/** Formatos que acepta el bucket, por extensión. */
export const FORMATOS_ASUNTO: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  txt: 'text/plain',
};

export const pesoArchivo = (b: number | null): string =>
  b === null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

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
export async function avisarPorMail(tipo: 'novedad' | 'documento' | 'mensaje' | 'archivo', id: string): Promise<{ ok: boolean; avisados?: number; error?: string }> {
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

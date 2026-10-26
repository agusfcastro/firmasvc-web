import { supabase } from '../supabase';
import type { Respuesta } from '../../firma/comun';

/**
 * Firma electrónica propia desde el portal. Lectura directa con la sesión
 * (la base filtra qué ve cada uno) y acciones por /api/firma/sobres.
 */

export type EstadoSobre = 'en_curso' | 'completado' | 'rechazado' | 'anulado' | 'vencido';
export type EstadoFirmante = 'pendiente' | 'notificado' | 'visto' | 'firmado' | 'rechazado';

export interface Sobre {
  id: string;
  codigo: string;
  organizacion_id: string | null;
  emisor: 'firma' | 'cliente';
  titulo: string;
  mensaje: string | null;
  estado: EstadoSobre;
  secuencial: boolean;
  vence_en: string;
  creado_por: string | null;
  creado_en: string;
  completado_en: string | null;
  cerrado_en: string | null;
  motivo_cierre: string | null;
  original_nombre: string;
  original_bytes: number;
  original_sha256: string;
  original_paginas: number;
  final_ruta: string | null;
  final_sha256: string | null;
  error_sellado: string | null;
  /** Sin la migración 0027 no viene y se toma como mail. */
  entrega?: 'mail' | 'enlace';
}

export interface Firmante {
  id: string;
  sobre_id: string;
  orden: number;
  nombre: string;
  email: string;
  pedir_documento: boolean;
  documento: string | null;
  estado: EstadoFirmante;
  notificado_en: string | null;
  visto_en: string | null;
  firmado_en: string | null;
  rechazado_en: string | null;
  motivo_rechazo: string | null;
  ultimo_recordatorio: string | null;
  firma_tipo: 'dibujada' | 'escrita' | null;
  ip: string | null;
}

/** Las columnas que la base deja leer. Los códigos por mail y la versión del enlace no llegan al navegador. */
export const COLUMNAS_FIRMANTE =
  'id, sobre_id, orden, nombre, email, pedir_documento, documento, estado, notificado_en, visto_en, firmado_en, rechazado_en, motivo_rechazo, ultimo_recordatorio, firma_tipo, ip';

export interface EventoFirma {
  id: number;
  firmante_id: string | null;
  actor_id: string | null;
  tipo: string;
  ip: string | null;
  user_agent: string | null;
  detalle: Record<string, unknown>;
  creado_en: string;
  hash: string;
}

export const BUCKET_FIRMAS = 'firmas';

async function token(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function llamarSobres<T = Record<string, unknown>>(
  cuerpo: Record<string, unknown>,
  ruta = '/api/firma/sobres',
): Promise<Respuesta<T>> {
  const t = await token();
  if (!t) return { ok: false, error: 'Tu sesión venció. Volvé a ingresar.' };
  try {
    const r = await fetch(ruta, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
      body: JSON.stringify(cuerpo),
    });
    const j = (await r.json().catch(() => ({}))) as T & { error?: string };
    if (!r.ok) return { ok: false, error: j.error || `Error ${r.status}` };
    return { ok: true, datos: j };
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor.' };
  }
}

/** Sube el PDF a la carpeta de borradores del usuario. El servidor lo valida y lo mueve al crear el envío. */
export async function subirBorrador(archivo: File, usuarioId: string): Promise<{ ruta: string } | { error: string }> {
  if (!supabase) return { error: 'Portal sin configurar.' };
  const ruta = `borradores/${usuarioId}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from(BUCKET_FIRMAS).upload(ruta, archivo, { contentType: 'application/pdf', upsert: false });
  if (error) return { error: `No se pudo subir el PDF. ${error.message}` };
  return { ruta };
}

export async function descargarSobre(sobreId: string, cual: 'original' | 'final'): Promise<string | null> {
  const r = await llamarSobres<{ url: string }>({ accion: 'descargar', sobre_id: sobreId, cual });
  if (!r.ok) return r.error;
  window.location.href = r.datos.url;
  return null;
}

export const ROTULO_EVENTO: Record<string, string> = {
  sobre_creado: 'Envío creado',
  documento_cargado: 'Documento cargado',
  invitacion_enviada: 'Invitación enviada',
  recordatorio_enviado: 'Recordatorio enviado',
  error_mail: 'No salió un mail',
  documento_abierto: 'Abrió el documento',
  codigo_enviado: 'Pidió el código',
  codigo_validado: 'Validó el código',
  codigo_fallido: 'Código incorrecto',
  firma_registrada: 'Firmó',
  firma_rechazada: 'Rechazó',
  sobre_rechazado: 'Cerrado por rechazo',
  sobre_vencido: 'Venció el plazo',
  sobre_anulado: 'Anulado',
  documento_descargado: 'Descargó el documento',
  sellado_fallido: 'Falló el armado del PDF firmado',
  documento_sellado: 'PDF firmado generado',
  sobre_completado: 'Completado',
  crm_no_actualizado: 'No se pudo marcar el cliente como firmado en el CRM',
};

export function peso(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Webhook de Fathom (Vercel Function).
 *
 * POST /api/webhooks/fathom/<token>  (vercel.json lo pasa como ?token=)
 *   Cada integrante del equipo que graba llamadas tiene su URL (migración
 *   0049): en Fathom los webhooks son de cada usuario y el aviso no dice de
 *   quién es. Lo que llega a una URL es una llamada que grabó esa persona.
 *   1. Busca la integración por el hash del token. Si no existe, 404.
 *   2. Verifica la firma con el secreto del webhook (Standard Webhooks:
 *      webhook-id, webhook-timestamp y webhook-signature, HMAC SHA256, con
 *      5 minutos de tolerancia). Si no coincide, 401 y no toca nada.
 *   3. Registra la llamada con interaccion_registrar(): recepción, contenido
 *      cifrado y trabajo en la cola, en un solo paso. Un aviso repetido no
 *      entra dos veces.
 *   4. Responde 200 enseguida y procesa el trabajo después de responder
 *      (waitUntil). Lo que no se termine lo retoma el barrido de la cola.
 *   Del aviso se guarda solo lo necesario: título, horario, duración,
 *   invitados, quién grabó, transcripción y el enlace a Fathom. El resumen y
 *   las tareas que arma Fathom se descartan.
 * Lo marcado «verificar con una cuenta real» es un supuesto sobre el formato
 * del aviso que hay que confirmar con una llamada de prueba.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { clienteServicio, procesarCola } from '../_lib/cola.js';

const TOKEN = /^[0-9a-f]{48}$/;
const TOLERANCIA_SEG = 300;
const MAXIMO_BYTES = 5_000_000;

interface Integracion {
  id: string;
  organizacion_id: string;
  equipo_miembro_id: string;
  estado: 'pendiente' | 'activa' | 'pausada';
  secreto: string | null;
  habilitada: boolean;
}

interface Llamada {
  externo_id: string;
  titulo: string | null;
  ocurrida_en: string | null;
  duracion_seg: number | null;
  contenido: {
    enlace: string | null;
    invitados: { nombre: string | null; email: string | null; externo: boolean | null }[];
    grabado_por: { nombre: string | null; email: string | null } | null;
    transcripcion: { hablante: string | null; email: string | null; segundo: number | null; texto: string }[];
  };
}

function json(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function mismaFirma(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Firma de Standard Webhooks: base64(HMAC SHA256("id.timestamp.cuerpo")) con
 * la clave que sigue a whsec_ decodificada de base64, sobre el cuerpo crudo.
 * webhook-signature puede traer varias firmas separadas por espacio, cada una
 * como "v1,<base64>". Así lo documenta Fathom (developers.fathom.ai/webhooks).
 */
function firmaValida(secreto: string, id: string, timestamp: string, cuerpo: string, firmas: string, ahora = Date.now()): boolean {
  if (!id || !/^\d{1,12}$/.test(timestamp) || !firmas) return false;
  if (Math.abs(ahora / 1000 - Number(timestamp)) > TOLERANCIA_SEG) return false;
  const clave = Buffer.from(secreto.replace(/^whsec_/, ''), 'base64');
  const esperada = createHmac('sha256', clave).update(`${id}.${timestamp}.${cuerpo}`).digest('base64');
  return firmas
    .split(' ')
    .map((f) => f.trim().replace(/^v1,/, ''))
    .some((f) => mismaFirma(f, esperada));
}

const texto = (v: unknown, max = 300): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const fecha = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

/** "00:01:23" o un número de segundos. */
function segundos(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v !== 'string') return null;
  const partes = v.split(':').map(Number);
  if (!partes.length || partes.some((n) => !Number.isFinite(n))) return null;
  return partes.reduce((s, n) => s * 60 + n, 0);
}

/**
 * Llamada del aviso «new meeting content ready». Verificar con una cuenta
 * real: recording_id, title, recording_start_time, recording_end_time,
 * calendar_invitees, recorded_by y transcript (speaker, text, timestamp).
 */
function leerLlamada(aviso: Record<string, unknown>): Llamada | null {
  const id = aviso.recording_id ?? aviso.id ?? aviso.url;
  if (typeof id !== 'string' && typeof id !== 'number') return null;
  const inicio = fecha(aviso.recording_start_time) ?? fecha(aviso.scheduled_start_time) ?? fecha(aviso.created_at);
  const fin = fecha(aviso.recording_end_time);
  const invitados = Array.isArray(aviso.calendar_invitees) ? (aviso.calendar_invitees as Record<string, unknown>[]) : [];
  const grabo = aviso.recorded_by && typeof aviso.recorded_by === 'object' ? (aviso.recorded_by as Record<string, unknown>) : null;
  const transcripcion = Array.isArray(aviso.transcript) ? (aviso.transcript as Record<string, unknown>[]) : [];
  return {
    externo_id: String(id).slice(0, 200),
    titulo: texto(aviso.title) ?? texto(aviso.meeting_title),
    ocurrida_en: inicio,
    duracion_seg: inicio && fin ? Math.max(0, Math.round((Date.parse(fin) - Date.parse(inicio)) / 1000)) : null,
    contenido: {
      enlace: texto(aviso.share_url, 500) ?? texto(aviso.url, 500),
      invitados: invitados.map((i) => ({ nombre: texto(i.name), email: texto(i.email), externo: typeof i.is_external === 'boolean' ? i.is_external : null })),
      grabado_por: grabo ? { nombre: texto(grabo.name), email: texto(grabo.email) } : null,
      transcripcion: transcripcion.flatMap((t) => {
        const dicho = texto(t.text, 20_000);
        if (!dicho) return [];
        const hablante = t.speaker && typeof t.speaker === 'object' ? (t.speaker as Record<string, unknown>) : {};
        return [{ hablante: texto(hablante.display_name), email: texto(hablante.matched_calendar_invitee_email), segundo: segundos(t.timestamp), texto: dicho }];
      }),
    },
  };
}

export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!TOKEN.test(token)) return json({ error: 'No encontrado.' }, 404);
  const sb = clienteServicio();
  if (!sb) return json({ error: 'Servidor sin configurar.' }, 503);

  const cuerpo = await request.text();
  if (cuerpo.length > MAXIMO_BYTES) return json({ error: 'Aviso demasiado grande.' }, 413);

  const { data, error } = await sb.rpc('integracion_por_token', { p_token: token });
  if (error) return json({ error: 'No se pudo leer la integración.' }, 500);
  const integracion = ((data as Integracion[] | null) ?? [])[0];
  if (!integracion) return json({ error: 'No encontrado.' }, 404);
  if (!integracion.secreto) return json({ error: 'Falta pegar el secreto del webhook en el portal.' }, 409);

  const avisoId = request.headers.get('webhook-id') || '';
  const valida = firmaValida(integracion.secreto, avisoId, request.headers.get('webhook-timestamp') || '', cuerpo, request.headers.get('webhook-signature') || '');
  if (!valida) return json({ error: 'Firma inválida.' }, 401);

  let aviso: Record<string, unknown>;
  try {
    aviso = JSON.parse(cuerpo) as Record<string, unknown>;
  } catch {
    return json({ error: 'El aviso no es JSON.' }, 400);
  }
  const llamada = aviso && typeof aviso === 'object' ? leerLlamada(aviso) : null;
  // Un aviso sin grabación no se reintenta: no hay nada que guardar.
  if (!llamada) return json({ ok: true, ignorado: 'sin grabación' });

  const { data: r, error: e } = await sb.rpc('interaccion_registrar', {
    p_integracion: integracion.id,
    p_aviso_id: avisoId,
    p_externo_id: llamada.externo_id,
    p_titulo: llamada.titulo,
    p_ocurrida_en: llamada.ocurrida_en,
    p_duracion_seg: llamada.duracion_seg,
    p_contenido: llamada.contenido,
  });
  // 500 para que Fathom reintente.
  if (e) return json({ error: 'No se pudo guardar la llamada.' }, 500);
  const resultado = (r ?? {}) as { trabajo_id?: number; duplicada?: boolean; ignorada?: boolean };
  if (resultado.trabajo_id) {
    waitUntil(procesarCola(sb, { id: resultado.trabajo_id }).catch(() => undefined));
  }
  return json({ ok: true, duplicada: Boolean(resultado.duplicada), ignorada: Boolean(resultado.ignorada) });
}

/** Responde 200 si alguien visita la dirección. No toca nada. */
export function GET(): Response {
  return json({ ok: true });
}

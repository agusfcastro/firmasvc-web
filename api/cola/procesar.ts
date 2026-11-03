/**
 * Barrido de la cola de trabajos (Vercel Function).
 *
 * POST /api/cola/procesar
 *   Lo llama pg_cron cada minuto, por pg_net, cuando hay trabajos esperando
 *   (cola_barrer(), migración 0050). Exige Authorization: Bearer <clave>,
 *   donde la clave es el secreto cola_secreto de Vault. Se valida contra la
 *   base (cola_clave_valida(), migración 0051); si en Vercel está cargada
 *   COLA_SECRETO, alcanza con que coincida con esa.
 *   Toma y procesa trabajos durante unos 40 segundos y responde cuántos
 *   terminó y cuántos volvieron a la cola.
 */
import { timingSafeEqual } from 'node:crypto';
import { clienteServicio, procesarCola } from '../_lib/cola.js';

function json(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function mismaClave(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: Request): Promise<Response> {
  const recibido = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (recibido.length < 32) return json({ error: 'No autorizado.' }, 401);
  const sb = clienteServicio();
  if (!sb) return json({ error: 'Servidor sin configurar.' }, 503);

  const local = process.env.COLA_SECRETO || '';
  let valida = local.length >= 32 && mismaClave(recibido, local);
  if (!valida) {
    const { data } = await sb.rpc('cola_clave_valida', { p_clave: recibido });
    valida = data === true;
  }
  if (!valida) return json({ error: 'No autorizado.' }, 401);

  try {
    return json({ ok: true, ...(await procesarCola(sb)) });
  } catch {
    return json({ error: 'No se pudo leer la cola.' }, 500);
  }
}

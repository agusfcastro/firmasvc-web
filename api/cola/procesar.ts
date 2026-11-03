/**
 * Barrido de la cola de trabajos (Vercel Function).
 *
 * POST /api/cola/procesar
 *   Lo llama pg_cron cada minuto, por pg_net, cuando hay trabajos esperando
 *   (cola_barrer(), migración 0050). Exige Authorization: Bearer COLA_SECRETO,
 *   el mismo valor que el secreto cola_secreto de Vault.
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
  const secreto = process.env.COLA_SECRETO || '';
  if (secreto.length < 32) return json({ error: 'Servidor sin configurar.' }, 503);
  const recibido = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!mismaClave(recibido, secreto)) return json({ error: 'No autorizado.' }, 401);

  const sb = clienteServicio();
  if (!sb) return json({ error: 'Servidor sin configurar.' }, 503);
  try {
    return json({ ok: true, ...(await procesarCola(sb)) });
  } catch {
    return json({ error: 'No se pudo leer la cola.' }, 500);
  }
}

/**
 * Aviso de ZapSign cuando firman un documento (Vercel Function).
 *
 * POST /api/zapsign/webhook?clave=...
 *   No confía en el contenido del aviso. Busca el cliente por el documento,
 *   consulta ese documento en ZapSign con el token de la empresa y, si está
 *   firmado por todos, pasa el cliente a Firmado.
 *   La clave la arma el servidor y se registra sola al conectar ZapSign.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function clienteServicio(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

function baseZapsign(sandbox: boolean): string {
  const propia = process.env.ZAPSIGN_API_URL;
  if (propia) return propia.replace(/\/$/, '');
  return sandbox ? 'https://sandbox.api.zapsign.com.br' : 'https://api.zapsign.com.br';
}

/** Misma clave que registra /api/admin/zapsign al conectar una empresa. */
function claveWebhook(): string | null {
  if (process.env.ZAPSIGN_WEBHOOK_CLAVE) return process.env.ZAPSIGN_WEBHOOK_CLAVE;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) return null;
  return createHmac('sha256', base).update('firma-zapsign-webhook').digest('hex').slice(0, 40);
}

function mismaClave(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  const esperada = claveWebhook();
  if (!sb || !esperada) return json({ error: 'Servidor sin configurar.' }, 500);

  const recibida = new URL(request.url).searchParams.get('clave') || '';
  if (!mismaClave(recibida, esperada)) return json({ error: 'No autorizado.' }, 401);

  const aviso = (await request.json().catch(() => null)) as { event_type?: string; token?: string } | null;
  const docToken = typeof aviso?.token === 'string' ? aviso.token : '';
  if (!docToken) return json({ ok: true, ignorado: 'sin documento' });
  if (aviso?.event_type && aviso.event_type !== 'doc_signed') return json({ ok: true, ignorado: aviso.event_type });

  const { data: cliente } = await sb.from('crm_clientes').select('id, organizacion_id, estado_firma').eq('zapsign_doc', docToken).maybeSingle();
  if (!cliente) return json({ ok: true, ignorado: 'documento ajeno al CRM' });
  if (cliente.estado_firma !== 'Pendiente') return json({ ok: true, sin_cambios: true });

  const { data: cuenta } = await sb.from('zapsign_cuentas').select('api_token, sandbox').eq('organizacion_id', cliente.organizacion_id).maybeSingle();
  if (!cuenta) return json({ ok: true, ignorado: 'empresa sin ZapSign' });

  // El estado se confirma con ZapSign, no con el aviso.
  let r: Response;
  try {
    r = await fetch(`${baseZapsign(cuenta.sandbox)}/api/v1/docs/${encodeURIComponent(docToken)}/`, {
      headers: { authorization: `Bearer ${cuenta.api_token}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return json({ error: 'ZapSign no respondió.' }, 502);
  }
  if (!r.ok) return json({ error: `ZapSign respondió ${r.status}.` }, 502);
  const doc = (await r.json().catch(() => null)) as { status?: string } | null;
  if (doc?.status !== 'signed') return json({ ok: true, pendiente: true });

  const { error } = await sb.from('crm_clientes').update({ estado_firma: 'Firmado' }).eq('id', cliente.id).eq('estado_firma', 'Pendiente');
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, firmado: true });
}

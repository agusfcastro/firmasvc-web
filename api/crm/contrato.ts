/**
 * Genera el contrato de un cliente del CRM en ZapSign (Vercel Function).
 * Corre en el servidor con la clave service role y el token de ZapSign de la
 * empresa, que nunca llegan al navegador.
 *
 * POST /api/crm/contrato  { cliente_id, regenerar? }
 *   Responde { firma_url } o { error }.
 *   Lo pide cualquier usuario activo de la empresa del cliente. Regenerar un
 *   contrato que ya tiene link de firma, solo FIRMA.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { valoresDelContrato } from '../_lib/variables.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function error(mensaje: string, status = 400): Response {
  return json({ error: mensaje }, status);
}

function clienteServicio(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

function baseZapsign(sandbox: boolean): string {
  // ZAPSIGN_API_URL solo se usa para pruebas.
  const propia = process.env.ZAPSIGN_API_URL;
  if (propia) return propia.replace(/\/$/, '');
  return sandbox ? 'https://sandbox.api.zapsign.com.br' : 'https://api.zapsign.com.br';
}

interface Pago {
  monto: number | string;
  vencimiento: string | null;
  estado: string;
  creado_en?: string;
}

interface Cliente {
  id: string;
  organizacion_id: string;
  codigo: string | null;
  nombre: string;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  domicilio?: string | null;
  servicio: string | null;
  monto_total: number | string | null;
  moneda: string | null;
  fecha_onboarding: string | null;
  responsable: string | null;
  estado_firma: string;
  firma_url: string | null;
  zapsign_doc: string | null;
}

/** Variables que reemplaza ZapSign en el modelo DOCX. La lista y el cálculo viven en api/_lib/variables.ts. */
export function variablesDelContrato(c: Cliente, pagos: Pago[], empresa: string, nombreServicio: string | null, hoy = new Date()): { de: string; para: string }[] {
  return Object.entries(valoresDelContrato(c, pagos, empresa, nombreServicio, hoy)).map(([k, v]) => ({ de: `{{${k}}}`, para: v }));
}

async function leerError(r: Response): Promise<string> {
  const texto = await r.text().catch(() => '');
  try {
    const j = JSON.parse(texto) as Record<string, unknown>;
    const m = j.detail ?? j.message ?? j.error ?? j.errors;
    if (m) return typeof m === 'string' ? m : JSON.stringify(m);
  } catch {
    /* no era JSON */
  }
  return texto.slice(0, 200);
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);

  // 1. Quién llama.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data: quien, error: errUsuario } = await sb.auth.getUser(token);
  if (errUsuario || !quien?.user) return error('Sesión inválida o vencida.', 401);
  const { data: perfil } = await sb.from('perfiles').select('rol, activo, organizacion_id').eq('id', quien.user.id).maybeSingle();
  if (!perfil || !perfil.activo) return error('Tu cuenta no está habilitada.', 403);
  const esAdmin = perfil.rol === 'admin';

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error('Pedido mal formado.');
  }
  const clienteId = String(cuerpo.cliente_id || '');
  if (!UUID.test(clienteId)) return error('Falta el cliente.');
  const regenerar = cuerpo.regenerar === true;

  // 2. El cliente tiene que ser de su empresa.
  const { data: cliente } = await sb.from('crm_clientes').select('*').eq('id', clienteId).maybeSingle<Cliente>();
  if (!cliente) return error('No existe ese cliente.', 404);
  if (!esAdmin && perfil.organizacion_id !== cliente.organizacion_id) return error('No tenés acceso a este cliente.', 403);
  const { data: org } = await sb.from('organizaciones').select('id, nombre, razon_social, activa, zapsign_modelo').eq('id', cliente.organizacion_id).maybeSingle();
  if (!org || (!esAdmin && !org.activa)) return error('La empresa no está activa.', 403);
  if (cliente.estado_firma === 'Baja') return error('El cliente está dado de baja.', 409);
  if (cliente.estado_firma === 'Firmado' && !regenerar) return error('El contrato ya está firmado.', 409);

  // 3. Si ya tiene link, se devuelve el mismo. Generar otro es decisión de FIRMA.
  if (cliente.firma_url && !regenerar) return json({ firma_url: cliente.firma_url, existente: true });
  if (regenerar && !esAdmin) return error('Solo FIRMA puede generar otro contrato.', 403);

  const marcar = (cambios: Record<string, unknown>) => sb.from('crm_clientes').update(cambios).eq('id', cliente.id);

  // 4. Cuenta de ZapSign y modelo del servicio, o el de la empresa.
  const { data: cuenta } = await sb.from('zapsign_cuentas').select('api_token, sandbox').eq('organizacion_id', cliente.organizacion_id).maybeSingle();
  if (!cuenta) {
    await marcar({ contrato_estado: 'sin_cuenta', contrato_error: 'La empresa no tiene ZapSign conectado.' });
    return error('La empresa no tiene ZapSign conectado. FIRMA lo configura desde Administración.', 409);
  }
  const { data: servicio } = cliente.servicio
    ? await sb.from('crm_servicios').select('nombre, zapsign_modelo').eq('organizacion_id', cliente.organizacion_id).eq('clave', cliente.servicio).maybeSingle()
    : { data: null };
  const modelo = servicio?.zapsign_modelo || org.zapsign_modelo;
  if (!modelo) {
    await marcar({ contrato_estado: 'sin_modelo', contrato_error: 'No hay modelo de contrato para este servicio.' });
    return error('No hay modelo de contrato para este servicio. FIRMA lo elige en Administración › ZapSign.', 409);
  }

  // 5. Datos del plan de pagos.
  const { data: pagos } = await sb.from('crm_pagos').select('monto, vencimiento, estado, creado_en').eq('cliente_id', cliente.id);
  const data = variablesDelContrato(cliente, (pagos as Pago[]) ?? [], org.razon_social || org.nombre, servicio?.nombre ?? null);

  // 6. ZapSign genera el documento a partir del modelo.
  let r: Response;
  try {
    r = await fetch(`${baseZapsign(cuenta.sandbox)}/api/v1/models/create-doc/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cuenta.api_token}` },
      body: JSON.stringify({
        template_id: modelo,
        signer_name: cliente.nombre,
        signer_email: cliente.email || undefined,
        lang: 'es',
        send_automatic_email: false,
        send_automatic_whatsapp: false,
        external_id: cliente.id,
        data,
      }),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    await marcar({ contrato_estado: 'error', contrato_error: 'ZapSign no respondió.' });
    return error('ZapSign no respondió. Probá de nuevo en unos minutos.', 502);
  }
  if (!r.ok) {
    const detalle = (await leerError(r)).slice(0, 240);
    await marcar({ contrato_estado: 'error', contrato_error: `ZapSign respondió ${r.status}. ${detalle}`.trim() });
    return error(`ZapSign no pudo generar el contrato (${r.status}). ${detalle}`.trim(), 502);
  }
  const doc = (await r.json().catch(() => null)) as { token?: string; signers?: { sign_url?: string }[] } | null;
  const firmaUrl = doc?.signers?.[0]?.sign_url;
  if (!doc?.token || !firmaUrl) {
    await marcar({ contrato_estado: 'error', contrato_error: 'ZapSign no devolvió el link de firma.' });
    return error('ZapSign no devolvió el link de firma.', 502);
  }

  // 7. El link queda en el CRM.
  const { error: errGuardar } = await marcar({
    firma_url: firmaUrl,
    zapsign_doc: doc.token,
    contrato_estado: 'listo',
    contrato_error: null,
    contrato_generado_en: new Date().toISOString(),
    ...(regenerar ? { estado_firma: 'Pendiente' } : {}),
  });
  if (errGuardar) return error(`El contrato se generó pero no se pudo guardar el link. ${errGuardar.message}`, 500);
  return json({ firma_url: firmaUrl });
}

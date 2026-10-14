/**
 * Conexión de cada empresa con su organización de ZapSign (Vercel Function).
 * El token se guarda en una tabla que solo lee el servidor y nunca vuelve
 * al navegador. Solo responde a un admin FIRMA activo.
 *
 * POST /api/admin/zapsign  { accion, organizacion_id, ... }
 *   estado       {}                      { conectado, sandbox, webhook }
 *   conectar     { api_token, sandbox }  valida el token, lo guarda y registra el aviso de firma
 *   desconectar  {}                      borra el token
 *   modelos      {}                      lista los modelos DOCX de esa organización de ZapSign
 */
import { createHmac } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Modelo {
  token: string;
  nombre: string;
  activo: boolean;
}

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
  const propia = process.env.ZAPSIGN_API_URL;
  if (propia) return propia.replace(/\/$/, '');
  return sandbox ? 'https://sandbox.api.zapsign.com.br' : 'https://api.zapsign.com.br';
}

/** Misma clave que valida /api/zapsign/webhook. */
function claveWebhook(): string | null {
  if (process.env.ZAPSIGN_WEBHOOK_CLAVE) return process.env.ZAPSIGN_WEBHOOK_CLAVE;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) return null;
  return createHmac('sha256', base).update('firma-zapsign-webhook').digest('hex').slice(0, 40);
}

/** Trae todos los modelos de la organización de ZapSign, de a 20 por página. */
async function listarModelos(token: string, sandbox: boolean): Promise<{ ok: boolean; status: number; modelos: Modelo[] }> {
  const modelos: Modelo[] = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    let r: Response;
    try {
      r = await fetch(`${baseZapsign(sandbox)}/api/v1/templates/?page=${pagina}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return { ok: false, status: 0, modelos };
    }
    if (!r.ok) return { ok: false, status: r.status, modelos };
    const j = (await r.json().catch(() => null)) as { next?: string | null; results?: { token: string; name: string; active?: boolean }[] } | null;
    for (const m of j?.results ?? []) modelos.push({ token: m.token, nombre: m.name, activo: m.active !== false });
    if (!j?.next) break;
  }
  return { ok: true, status: 200, modelos };
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);

  // 1. Solo un admin activo.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data: quien, error: errUsuario } = await sb.auth.getUser(token);
  if (errUsuario || !quien?.user) return error('Sesión inválida o vencida.', 401);
  const actor = quien.user.id;
  const { data: perfil } = await sb.from('perfiles').select('rol, activo').eq('id', actor).maybeSingle();
  if (!perfil || perfil.rol !== 'admin' || !perfil.activo) return error('No tenés permisos de administración.', 403);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error('Pedido mal formado.');
  }
  const accion = String(cuerpo.accion || '');
  const orgId = String(cuerpo.organizacion_id || '');
  if (!UUID.test(orgId)) return error('Falta la empresa.');
  const { data: org } = await sb.from('organizaciones').select('id, nombre').eq('id', orgId).maybeSingle();
  if (!org) return error('No existe esa empresa.', 404);

  const { data: cuenta } = await sb.from('zapsign_cuentas').select('api_token, sandbox, webhook_registrado').eq('organizacion_id', orgId).maybeSingle();

  if (accion === 'estado') {
    return json({ conectado: Boolean(cuenta), sandbox: Boolean(cuenta?.sandbox), webhook: Boolean(cuenta?.webhook_registrado) });
  }

  if (accion === 'modelos') {
    if (!cuenta) return error('La empresa no tiene ZapSign conectado.', 409);
    const lista = await listarModelos(cuenta.api_token, cuenta.sandbox);
    if (!lista.ok) return error(lista.status ? `ZapSign respondió ${lista.status} al listar los modelos.` : 'ZapSign no respondió.', 502);
    return json({ modelos: lista.modelos });
  }

  if (accion === 'conectar') {
    const apiToken = String(cuerpo.api_token || '').trim();
    const sandbox = cuerpo.sandbox === true;
    if (apiToken.length < 10 || apiToken.length > 200 || /\s/.test(apiToken)) return error('El token no tiene un formato válido.');

    // Si ZapSign acepta el token para listar modelos, el token sirve.
    const lista = await listarModelos(apiToken, sandbox);
    if (!lista.ok) {
      if (lista.status === 401 || lista.status === 403) return error('ZapSign rechazó el token. Revisá que sea el de la organización correcta y el ambiente elegido.', 400);
      return error(lista.status ? `ZapSign respondió ${lista.status}.` : 'ZapSign no respondió.', 502);
    }

    const { error: errGuardar } = await sb
      .from('zapsign_cuentas')
      .upsert({ organizacion_id: orgId, api_token: apiToken, sandbox, webhook_registrado: false, actualizado_en: new Date().toISOString() });
    if (errGuardar) return error(errGuardar.message, 500);

    // Aviso de firma. Si falla, la conexión queda igual y se avisa.
    let webhook = false;
    const clave = claveWebhook();
    const base = (process.env.PORTAL_URL || new URL(request.url).origin).replace(/\/$/, '');
    if (clave) {
      try {
        const r = await fetch(`${baseZapsign(sandbox)}/api/v1/user/company/webhook/`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiToken}` },
          body: JSON.stringify({ url: `${base}/api/zapsign/webhook?clave=${clave}`, type: 'doc_signed' }),
          signal: AbortSignal.timeout(15000),
        });
        webhook = r.ok;
      } catch {
        webhook = false;
      }
      if (webhook) await sb.from('zapsign_cuentas').update({ webhook_registrado: true }).eq('organizacion_id', orgId);
    }

    await sb.from('organizaciones').update({ zapsign_conectado: true }).eq('id', orgId);
    await sb.from('registro_accesos').insert({ actor_id: actor, usuario_id: null, accion: 'zapsign_conectado', detalle: { organizacion_id: orgId, empresa: org.nombre, sandbox, webhook } });
    return json({ ok: true, webhook, modelos: lista.modelos });
  }

  if (accion === 'desconectar') {
    const { error: errBorrar } = await sb.from('zapsign_cuentas').delete().eq('organizacion_id', orgId);
    if (errBorrar) return error(errBorrar.message, 500);
    await sb.from('organizaciones').update({ zapsign_conectado: false }).eq('id', orgId);
    await sb.from('registro_accesos').insert({ actor_id: actor, usuario_id: null, accion: 'zapsign_desconectado', detalle: { organizacion_id: orgId, empresa: org.nombre } });
    return json({ ok: true });
  }

  return error('Acción desconocida.');
}

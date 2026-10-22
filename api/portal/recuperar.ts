/**
 * «Olvidé mi contraseña» del portal (Vercel Function).
 * El mail sale por Resend con la plantilla de FIRMA, igual que las
 * invitaciones, así no depende del servidor de mails de Supabase.
 *
 * POST /api/portal/recuperar  { email }
 *   Responde siempre lo mismo, exista o no la cuenta, para no revelar qué
 *   mails tienen acceso. Solo manda el mail a una cuenta activa del portal y
 *   como mucho tres veces por hora, así nadie puede llenarle la casilla a otro.
 *   Sin RESEND_API_KEY lo manda el servidor de mails de Supabase.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { enlaceDeAcceso, mailDeAcceso, mailDisponible } from '../_lib/mail.js';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAXIMO_POR_HORA = 3;

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

function urlDelPortal(request: Request): string {
  const base = process.env.PORTAL_URL || new URL(request.url).origin;
  return `${base.replace(/\/$/, '')}/portal/clave`;
}

export async function POST(request: Request): Promise<Response> {
  const listo = json({ ok: true });
  const sb = clienteServicio();
  if (!sb) return json({ error: 'El servidor no tiene configuradas las variables de Supabase.' }, 500);

  let email = '';
  try {
    email = String(((await request.json()) as { email?: unknown })?.email ?? '').trim().toLowerCase();
  } catch {
    return json({ error: 'Pedido mal formado.' }, 400);
  }
  if (!EMAIL_VALIDO.test(email) || email.length > 200) return json({ error: 'El mail no es válido.' }, 400);

  const { data: perfil } = await sb.from('perfiles').select('id, email, nombre, activo, organizacion_id').eq('email', email).maybeSingle();
  if (!perfil?.activo) return listo;

  const haceUnaHora = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await sb
    .from('registro_accesos')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', perfil.id)
    .eq('accion', 'pedido_clave')
    .gte('creado_en', haceUnaHora);
  if ((count ?? 0) >= MAXIMO_POR_HORA) return listo;
  await sb.from('registro_accesos').insert({ usuario_id: perfil.id, actor_id: null, accion: 'pedido_clave', detalle: {} });

  const redirectTo = urlDelPortal(request);
  if (!mailDisponible()) {
    await sb.auth.resetPasswordForEmail(email, { redirectTo });
    return listo;
  }

  // Quien nunca aceptó la invitación recibe otra; quien ya tiene cuenta, un enlace para definir contraseña.
  const { data: cuenta } = await sb.auth.admin.getUserById(perfil.id);
  const tipo = cuenta?.user?.email_confirmed_at ? 'recovery' : 'invite';
  const { data: link } = await sb.auth.admin.generateLink({ type: tipo, email, options: { redirectTo } });
  if (!link?.properties?.hashed_token) return listo;

  let empresa: string | null = null;
  if (perfil.organizacion_id) {
    const { data: org } = await sb.from('organizaciones').select('nombre').eq('id', perfil.organizacion_id).maybeSingle();
    empresa = (org?.nombre as string | undefined) ?? null;
  }
  await mailDeAcceso({ email, nombre: (perfil.nombre as string | null) ?? null, empresa, enlace: enlaceDeAcceso(redirectTo, link.properties.hashed_token, tipo), tipo });
  return listo;
}

export function GET(): Response {
  return json({ error: 'Método no permitido.' }, 405);
}

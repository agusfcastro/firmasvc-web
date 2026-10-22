/**
 * API de administración de usuarios del portal (Vercel Function).
 * Corre en el servidor con la clave service role, que nunca llega al navegador.
 * Solo responde a un admin FIRMA activo.
 *
 * POST /api/admin/usuarios  { accion, ... }
 *   invitar     { email, nombre, rol, organizacion_id, areas, sin_mail? }
 *               Con RESEND_API_KEY el mail sale por Resend con la plantilla de FIRMA.
 *               Sin ella, por el servidor de mails de Supabase.
 *               Si el mail no sale (o sin_mail), devuelve { enlace } para mandarlo a mano.
 *   actualizar  { usuario_id, nombre?, rol?, organizacion_id?, areas? }
 *   activar     { usuario_id }
 *   desactivar  { usuario_id }
 *   enviar_acceso { usuario_id }   reenvía el enlace para definir contraseña
 *   enlace_acceso { usuario_id }   devuelve { enlace } sin mandar mail
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { enlaceDeAcceso, mailDeAcceso, mailDisponible } from '../_lib/mail.js';

// miembro es el rol anterior a csm: se acepta en cuentas viejas pero ya no se asigna.
type Rol = 'admin' | 'titular' | 'csm' | 'closer' | 'setter' | 'miembro';
const ROLES: Rol[] = ['admin', 'titular', 'csm', 'closer', 'setter'];
const BLOQUEO = '876000h'; // unos 100 años, equivale a bloqueo indefinido

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function urlDelPortal(request: Request): string {
  const base = process.env.PORTAL_URL || new URL(request.url).origin;
  return `${base.replace(/\/$/, '')}/portal/clave`;
}

async function nombreEmpresa(sb: SupabaseClient, organizacionId: string | null | undefined): Promise<string | null> {
  if (!organizacionId) return null;
  const { data } = await sb.from('organizaciones').select('nombre').eq('id', organizacionId).maybeSingle();
  return (data?.nombre as string | undefined) ?? null;
}

function areasValidas(valor: unknown): string[] | null {
  if (valor === undefined) return null;
  if (!Array.isArray(valor)) return [];
  return valor.filter((a): a is string => typeof a === 'string' && /^[a-z_]{2,30}$/.test(a)).slice(0, 20);
}

async function registrar(sb: SupabaseClient, actor: string, usuario: string | null, accion: string, detalle: Record<string, unknown> = {}) {
  await sb.from('registro_accesos').insert({ actor_id: actor, usuario_id: usuario, accion, detalle });
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);

  // 1. Identificar a quien llama y verificar que sea admin activo.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data: quien, error: errUsuario } = await sb.auth.getUser(token);
  if (errUsuario || !quien?.user) return error('Sesión inválida o vencida.', 401);
  const actor = quien.user.id;

  const { data: perfilActor } = await sb.from('perfiles').select('rol, activo').eq('id', actor).maybeSingle();
  if (!perfilActor || perfilActor.rol !== 'admin' || !perfilActor.activo) return error('No tenés permisos de administración.', 403);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error('Pedido mal formado.');
  }
  const accion = String(cuerpo.accion || '');

  // 2. Invitar un usuario nuevo.
  if (accion === 'invitar') {
    const email = String(cuerpo.email || '').trim().toLowerCase();
    const nombre = String(cuerpo.nombre || '').trim().slice(0, 120);
    const rol = String(cuerpo.rol || 'csm') as Rol;
    const organizacion_id = cuerpo.organizacion_id ? String(cuerpo.organizacion_id) : null;
    const areas = areasValidas(cuerpo.areas) ?? [];

    if (!EMAIL_VALIDO.test(email)) return error('El mail no es válido.');
    if (!nombre) return error('Falta el nombre.');
    if (!ROLES.includes(rol)) return error('Rol inválido.');
    if (rol !== 'admin' && !organizacion_id) return error('Elegí a qué cliente pertenece.');
    if (organizacion_id) {
      const { data: org } = await sb.from('organizaciones').select('id').eq('id', organizacion_id).maybeSingle();
      if (!org) return error('El cliente elegido no existe.');
    }

    const opciones = { redirectTo: urlDelPortal(request), data: { nombre } };
    const ya = (m?: string) => /already|registered|exists/i.test(m || '');
    let invitado: { user: { id: string } } | null = null;
    let enlace: string | null = null;
    let motivo: string | null = null;
    // Enlace que sale por Resend una vez creado el perfil.
    let porResend: string | null = null;

    if (!cuerpo.sin_mail && mailDisponible()) {
      // Con Resend: se crea la cuenta con su enlace y el mail sale con la plantilla de FIRMA.
      const r = await sb.auth.admin.generateLink({ type: 'invite', email, options: opciones });
      if (ya(r.error?.message)) return error('Ese mail ya tiene una cuenta. Buscalo en la lista y copiale el enlace de acceso.', 409);
      if (r.error || !r.data?.user || !r.data.properties?.hashed_token) return error(`No se pudo crear la cuenta. ${r.error?.message ?? ''}`.trim(), 502);
      invitado = { user: r.data.user };
      porResend = enlaceDeAcceso(urlDelPortal(request), r.data.properties.hashed_token, 'invite');
    } else if (!cuerpo.sin_mail) {
      const r = await sb.auth.admin.inviteUserByEmail(email, opciones);
      if (ya(r.error?.message)) return error('Ese mail ya tiene una cuenta. Buscalo en la lista y copiale el enlace de acceso.', 409);
      if (r.data?.user) invitado = { user: r.data.user };
      else motivo = r.error?.message ?? 'sin detalle';
    }
    // Sin mail, o si el servidor de mails lo rechazó, se crea la cuenta igual y se devuelve el enlace.
    if (!invitado) {
      const r = await sb.auth.admin.generateLink({ type: 'invite', email, options: opciones });
      if (ya(r.error?.message)) return error('Ese mail ya tiene una cuenta. Buscalo en la lista y copiale el enlace de acceso.', 409);
      if (r.error || !r.data?.user || !r.data.properties?.hashed_token) return error(`No se pudo crear la cuenta. ${r.error?.message ?? motivo ?? ''}`.trim(), 502);
      invitado = { user: r.data.user };
      enlace = enlaceDeAcceso(urlDelPortal(request), r.data.properties.hashed_token, 'invite');
    }

    const { error: errPerfil } = await sb.from('perfiles').upsert({
      id: invitado.user.id,
      email,
      nombre,
      rol,
      organizacion_id: rol === 'admin' ? null : organizacion_id,
      areas,
      activo: true,
      invitado_por: actor,
    });
    if (errPerfil) {
      await sb.auth.admin.deleteUser(invitado.user.id);
      return error(`No se pudo crear el perfil. ${errPerfil.message}`, 500);
    }
    if (porResend) {
      motivo = await mailDeAcceso({ email, nombre, empresa: rol === 'admin' ? null : await nombreEmpresa(sb, organizacion_id), enlace: porResend, tipo: 'invite' });
      // Si Resend no lo mandó, el panel muestra el enlace para mandarlo a mano.
      if (motivo) enlace = porResend;
    }
    await registrar(sb, actor, invitado.user.id, 'invitacion', { email, rol, organizacion_id, areas, por_mail: !enlace });
    return json({ ok: true, usuario_id: invitado.user.id, enlace, motivo });
  }

  // Las demás acciones operan sobre un usuario existente.
  const usuario_id = String(cuerpo.usuario_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(usuario_id)) return error('Usuario inválido.');
  const { data: perfil } = await sb.from('perfiles').select('*').eq('id', usuario_id).maybeSingle();
  if (!perfil) return error('No existe ese usuario.', 404);

  if (accion === 'actualizar') {
    const cambios: Record<string, unknown> = {};
    if (typeof cuerpo.nombre === 'string' && cuerpo.nombre.trim()) cambios.nombre = cuerpo.nombre.trim().slice(0, 120);
    if (cuerpo.rol !== undefined) {
      const rol = String(cuerpo.rol) as Rol;
      if (!ROLES.includes(rol)) return error('Rol inválido.');
      if (usuario_id === actor && rol !== 'admin') return error('No podés quitarte a vos mismo el rol de admin.');
      cambios.rol = rol;
    }
    if (cuerpo.organizacion_id !== undefined) cambios.organizacion_id = cuerpo.organizacion_id ? String(cuerpo.organizacion_id) : null;
    const areas = areasValidas(cuerpo.areas);
    if (areas) cambios.areas = areas;

    const rolFinal = (cambios.rol ?? perfil.rol) as Rol;
    if (rolFinal === 'admin') cambios.organizacion_id = null;
    else if (!(cambios.organizacion_id ?? perfil.organizacion_id)) return error('Elegí a qué cliente pertenece.');

    const { error: errAct } = await sb.from('perfiles').update(cambios).eq('id', usuario_id);
    if (errAct) return error(`No se pudo actualizar. ${errAct.message}`, 500);
    await registrar(sb, actor, usuario_id, 'actualizacion', cambios);
    return json({ ok: true });
  }

  if (accion === 'activar' || accion === 'desactivar') {
    const activar = accion === 'activar';
    if (!activar && usuario_id === actor) return error('No podés desactivar tu propia cuenta.');
    const { error: errBan } = await sb.auth.admin.updateUserById(usuario_id, { ban_duration: activar ? 'none' : BLOQUEO });
    if (errBan) return error(`No se pudo cambiar el estado. ${errBan.message}`, 502);
    await sb.from('perfiles').update({ activo: activar }).eq('id', usuario_id);
    await registrar(sb, actor, usuario_id, activar ? 'activacion' : 'desactivacion');
    return json({ ok: true });
  }

  if (accion === 'enviar_acceso') {
    if (!perfil.activo) return error('La cuenta está desactivada. Activala primero.');
    if (mailDisponible()) {
      // Quien nunca aceptó la invitación recibe otra; quien ya tiene cuenta, un enlace para definir contraseña.
      const { data: cuenta } = await sb.auth.admin.getUserById(usuario_id);
      const tipo = cuenta?.user?.email_confirmed_at ? 'recovery' : 'invite';
      const { data: link, error: errLink } = await sb.auth.admin.generateLink({ type: tipo, email: perfil.email, options: { redirectTo: urlDelPortal(request) } });
      if (errLink || !link?.properties?.hashed_token) return error(`No se pudo generar el enlace. ${errLink?.message ?? ''}`.trim(), 502);
      const fallo = await mailDeAcceso({
        email: perfil.email,
        nombre: perfil.nombre ?? null,
        empresa: await nombreEmpresa(sb, perfil.organizacion_id),
        enlace: enlaceDeAcceso(urlDelPortal(request), link.properties.hashed_token, tipo),
        tipo,
      });
      if (fallo) return error(`No se pudo enviar el mail. ${fallo}`, 502);
    } else {
      const { error: errMail } = await sb.auth.resetPasswordForEmail(perfil.email, { redirectTo: urlDelPortal(request) });
      if (errMail) return error(`No se pudo enviar el mail. ${errMail.message}`, 502);
    }
    await registrar(sb, actor, usuario_id, 'envio_acceso');
    return json({ ok: true });
  }

  if (accion === 'enlace_acceso') {
    if (!perfil.activo) return error('La cuenta está desactivada. Activala primero.');
    // Quien nunca aceptó la invitación recibe otra; quien ya tiene cuenta, un enlace para definir contraseña.
    const { data: cuenta } = await sb.auth.admin.getUserById(usuario_id);
    const tipo = cuenta?.user?.email_confirmed_at ? 'recovery' : 'invite';
    const { data: link, error: errLink } = await sb.auth.admin.generateLink({ type: tipo, email: perfil.email, options: { redirectTo: urlDelPortal(request) } });
    if (errLink || !link?.properties?.hashed_token) return error(`No se pudo generar el enlace. ${errLink?.message ?? ''}`.trim(), 502);
    await registrar(sb, actor, usuario_id, 'enlace_acceso');
    return json({ ok: true, enlace: enlaceDeAcceso(urlDelPortal(request), link.properties.hashed_token, tipo) });
  }

  return error('Acción desconocida.');
}

export function GET(): Response {
  return error('Método no permitido.', 405);
}

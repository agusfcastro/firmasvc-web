/**
 * API de administración de usuarios del portal (Vercel Function).
 * Corre en el servidor con la clave service role, que nunca llega al navegador.
 * Solo responde a un admin FIRMA activo.
 *
 * POST /api/admin/usuarios  { accion, ... }
 *   invitar     { email, nombre, rol, organizacion_id, areas }
 *   actualizar  { usuario_id, nombre?, rol?, organizacion_id?, areas? }
 *   activar     { usuario_id }
 *   desactivar  { usuario_id }
 *   enviar_acceso { usuario_id }   reenvía el enlace para definir contraseña
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Rol = 'admin' | 'titular' | 'miembro';
const ROLES: Rol[] = ['admin', 'titular', 'miembro'];
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
    const rol = String(cuerpo.rol || 'miembro') as Rol;
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

    const { data: invitado, error: errInv } = await sb.auth.admin.inviteUserByEmail(email, {
      redirectTo: urlDelPortal(request),
      data: { nombre },
    });
    if (errInv || !invitado?.user) {
      const ya = /already|registered|exists/i.test(errInv?.message || '');
      return error(ya ? 'Ese mail ya tiene una cuenta. Buscalo en la lista y reenviale el acceso.' : `No se pudo enviar la invitación. ${errInv?.message ?? ''}`.trim(), ya ? 409 : 502);
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
    await registrar(sb, actor, invitado.user.id, 'invitacion', { email, rol, organizacion_id, areas });
    return json({ ok: true, usuario_id: invitado.user.id });
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
    const { error: errMail } = await sb.auth.resetPasswordForEmail(perfil.email, { redirectTo: urlDelPortal(request) });
    if (errMail) return error(`No se pudo enviar el mail. ${errMail.message}`, 502);
    await registrar(sb, actor, usuario_id, 'envio_acceso');
    return json({ ok: true });
  }

  return error('Acción desconocida.');
}

export function GET(): Response {
  return error('Método no permitido.', 405);
}

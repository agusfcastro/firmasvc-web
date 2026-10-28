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
 *   borrar_empresa { organizacion_id, confirmacion }
 *               Borra una empresa de prueba con lo suyo, sus archivos y las cuentas
 *               de su gente (migración 0023). Tiene que estar desactivada, sin envíos
 *               a firma electrónica, y confirmacion tiene que ser su nombre exacto.
 *   demo        Crea la empresa demo si falta, con un titular, un CSM y un closer
 *               (alias del mail de quien llama), y la deja con datos ficticios
 *               nuevos (migración 0029) y un contrato modelo en sus servicios.
 *               Devuelve { usuarios } con el enlace para definir la contraseña de
 *               los que se acaban de crear.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { enlaceDeAcceso, mailDeAcceso, mailDisponible } from '../_lib/mail.js';
import { modeloDemoDocx } from '../_lib/modeloDemo.js';

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

function urlDelPortal(): string {
  const base = process.env.PORTAL_URL || 'https://www.firmasvc.com';
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

    const opciones = { redirectTo: urlDelPortal(), data: { nombre } };
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
      porResend = enlaceDeAcceso(urlDelPortal(), r.data.properties.hashed_token, 'invite');
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
      enlace = enlaceDeAcceso(urlDelPortal(), r.data.properties.hashed_token, 'invite');
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

  if (accion === 'borrar_empresa') return borrarEmpresa(sb, actor, cuerpo);
  if (accion === 'demo') return demo(sb, actor, request);

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
      const { data: link, error: errLink } = await sb.auth.admin.generateLink({ type: tipo, email: perfil.email, options: { redirectTo: urlDelPortal() } });
      if (errLink || !link?.properties?.hashed_token) return error(`No se pudo generar el enlace. ${errLink?.message ?? ''}`.trim(), 502);
      const fallo = await mailDeAcceso({
        email: perfil.email,
        nombre: perfil.nombre ?? null,
        empresa: await nombreEmpresa(sb, perfil.organizacion_id),
        enlace: enlaceDeAcceso(urlDelPortal(), link.properties.hashed_token, tipo),
        tipo,
      });
      if (fallo) return error(`No se pudo enviar el mail. ${fallo}`, 502);
    } else {
      const { error: errMail } = await sb.auth.resetPasswordForEmail(perfil.email, { redirectTo: urlDelPortal() });
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
    const { data: link, error: errLink } = await sb.auth.admin.generateLink({ type: tipo, email: perfil.email, options: { redirectTo: urlDelPortal() } });
    if (errLink || !link?.properties?.hashed_token) return error(`No se pudo generar el enlace. ${errLink?.message ?? ''}`.trim(), 502);
    await registrar(sb, actor, usuario_id, 'enlace_acceso');
    return json({ ok: true, enlace: enlaceDeAcceso(urlDelPortal(), link.properties.hashed_token, tipo) });
  }

  return error('Acción desconocida.');
}

/** Usuarios de la empresa demo. El mail es un alias del de quien la crea, así lo que llegue le llega a él. */
const USUARIOS_DEMO: { rol: Rol; nombre: string; alias: string; areas: string[] }[] = [
  { rol: 'titular', nombre: 'Paula Demo', alias: 'demo-titular', areas: [] },
  { rol: 'csm', nombre: 'Martina Demo', alias: 'demo-csm', areas: ['atencion', 'operaciones', 'legales'] },
  { rol: 'closer', nombre: 'Tomás Demo', alias: 'demo-closer', areas: [] },
];

function alias(email: string, sufijo: string): string {
  const [local, dominio] = email.split('@');
  return `${local.split('+')[0]}+${sufijo}@${dominio}`;
}

async function demo(sb: SupabaseClient, actor: string, request: Request): Promise<Response> {
  const { data: yo } = await sb.from('perfiles').select('email').eq('id', actor).maybeSingle();
  if (!yo?.email) return error('No se encontró tu mail.', 500);

  // 1. La empresa, una sola.
  const { data: existente, error: errBuscar } = await sb.from('organizaciones').select('id, nombre').eq('demo', true).maybeSingle();
  if (errBuscar) {
    if (/demo/.test(errBuscar.message)) return error('Falta correr la migración 0029_empresa_demo.sql en Supabase.', 500);
    return error(errBuscar.message, 500);
  }
  let org = existente as { id: string; nombre: string } | null;
  if (!org) {
    const { data: nueva, error: errOrg } = await sb
      .from('organizaciones')
      .insert({
        nombre: 'Empresa Demo',
        razon_social: 'Empresa Demo S.A.',
        pais: 'AR',
        activa: true,
        demo: true,
        plan: 'eminent',
        prefijo_crm: 'DEM',
        seguimiento_cobranza: true,
        notas: 'Empresa ficticia para grabar procesos. Se reinicia desde Administración › Clientes.',
      })
      .select('id, nombre')
      .single();
    if (errOrg || !nueva) return error(`No se pudo crear la empresa demo. ${errOrg?.message ?? ''}`.trim(), 500);
    org = nueva as { id: string; nombre: string };
    await registrar(sb, actor, null, 'demo_creada', { organizacion_id: org.id });
  }

  // 2. Los usuarios que falten. Sin mail: el enlace vuelve para definir la contraseña.
  const usuarios: { rol: Rol; nombre: string; email: string; enlace: string | null }[] = [];
  for (const u of USUARIOS_DEMO) {
    const email = alias(String(yo.email).toLowerCase(), u.alias);
    const { data: ya } = await sb.from('perfiles').select('id').eq('email', email).maybeSingle();
    if (ya) {
      usuarios.push({ rol: u.rol, nombre: u.nombre, email, enlace: null });
      continue;
    }
    const r = await sb.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo: urlDelPortal(), data: { nombre: u.nombre } } });
    if (r.error || !r.data?.user || !r.data.properties?.hashed_token) return error(`No se pudo crear ${email}. ${r.error?.message ?? ''}`.trim(), 502);
    const { error: errPerfil } = await sb.from('perfiles').upsert({
      id: r.data.user.id,
      email,
      nombre: u.nombre,
      rol: u.rol,
      organizacion_id: org.id,
      areas: u.areas,
      activo: true,
      invitado_por: actor,
    });
    if (errPerfil) {
      await sb.auth.admin.deleteUser(r.data.user.id);
      return error(`No se pudo crear el perfil de ${email}. ${errPerfil.message}`, 500);
    }
    await registrar(sb, actor, r.data.user.id, 'invitacion', { email, rol: u.rol, organizacion_id: org.id, demo: true });
    usuarios.push({ rol: u.rol, nombre: u.nombre, email, enlace: enlaceDeAcceso(urlDelPortal(), r.data.properties.hashed_token, 'invite') });
  }

  // 3. Datos nuevos. Después se limpian los archivos de lo que se borró.
  const { data, error: errReinicio } = await sb.rpc('demo_reiniciar', { org: org.id, firma: actor });
  if (errReinicio) {
    if (/Could not find the function|does not exist/i.test(errReinicio.message)) return error('Falta correr la migración 0029_empresa_demo.sql en Supabase.', 500);
    return error(errReinicio.message, 500);
  }
  const res = data as { asuntos: string[]; contratos: string[]; firmas: string[] };
  const fallaModelo = await modeloDemo(sb, org.id);
  if (fallaModelo) return error(fallaModelo, 500);
  const pendientes: string[] = [];
  for (const [bucket, rutas] of [['asuntos', res.asuntos ?? []], ['firmas', [...(res.contratos ?? []), ...(res.firmas ?? [])]]] as const) {
    for (let i = 0; i < rutas.length; i += 100) {
      const { error: e } = await sb.storage.from(bucket).remove(rutas.slice(i, i + 100));
      if (e) pendientes.push(`${bucket}: ${e.message}`);
    }
  }
  await registrar(sb, actor, null, 'demo_reiniciada', { organizacion_id: org.id, pendientes });
  return json({ ok: true, organizacion_id: org.id, usuarios, pendientes });
}

/**
 * Contrato modelo de la demo en la biblioteca de documentos, asignado a sus
 * servicios, para mostrar cómo se genera el contrato desde la ficha. Se vuelve
 * a subir en cada reinicio, así queda el original aunque lo hayan cambiado.
 * Cada vez con una ruta nueva: si se pisa la misma, la CDN de Storage puede
 * seguir sirviendo el modelo anterior hasta una hora.
 */
async function modeloDemo(sb: SupabaseClient, orgId: string): Promise<string | null> {
  const prefijo = `servicio/demo-${orgId}`;
  const ruta = `${prefijo}-${Date.now()}.docx`;
  const bytes = modeloDemoDocx();
  const { error: errSubir } = await sb.storage
    .from('documentos')
    .upload(ruta, bytes, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: false });
  if (errSubir) return `No se pudo subir el contrato modelo. ${errSubir.message}`;

  const datos = {
    seccion: 'servicio',
    organizacion_id: orgId,
    titulo: 'Contrato de servicios (modelo demo)',
    descripcion: 'Modelo de ejemplo con las variables del CRM. Se genera desde la ficha de cada cliente.',
    archivo_ruta: ruta,
    archivo_nombre: 'Contrato de servicios - modelo demo.docx',
    archivo_bytes: bytes.length,
    activo: true,
  };
  const { data: previo } = await sb
    .from('documentos')
    .select('id, archivo_ruta')
    .like('archivo_ruta', `${prefijo}%`)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: doc, error: errDoc } = previo
    ? await sb.from('documentos').update(datos).eq('id', previo.id).select('id').single()
    : await sb.from('documentos').insert(datos).select('id').single();
  if (errDoc || !doc) return `No se pudo cargar el contrato modelo. ${errDoc?.message ?? ''}`.trim();
  if (previo?.archivo_ruta && previo.archivo_ruta !== ruta) await sb.storage.from('documentos').remove([previo.archivo_ruta]);

  const { error: errServicios } = await sb.from('crm_servicios').update({ documento_id: doc.id, documento_pif_id: null }).eq('organizacion_id', orgId).in('clave', ['3M', '6M', 'MENTORIA']);
  if (errServicios) return `No se pudo asignar el contrato modelo a los servicios. ${errServicios.message}`;
  // Condiciones de ejemplo en la venta pendiente, que es la que se usa para mostrar el contrato.
  await sb
    .from('crm_clientes')
    .update({ condiciones: 'Se bonifica el 10 % del total por pago de la primera cuota dentro de las 48 horas. Incluye dos sesiones extra de seguimiento al terminar el programa.' })
    .eq('organizacion_id', orgId)
    .eq('email', 'sofia.ramirez@ejemplo.com');
  // Ese cambio no es de nadie: la ficha arranca sin historial, como la deja demo_reiniciar.
  await sb.from('crm_historial').delete().eq('organizacion_id', orgId);
  return null;
}

/** Ruta dentro del bucket logos a partir de la URL pública del logo. */
function rutaLogo(url: string | null): string | null {
  const m = url ? /\/storage\/v1\/object\/public\/logos\/(.+)$/.exec(url.split('?')[0]) : null;
  return m ? decodeURIComponent(m[1]) : null;
}

async function borrarEmpresa(sb: SupabaseClient, actor: string, cuerpo: Record<string, unknown>): Promise<Response> {
  const orgId = String(cuerpo.organizacion_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return error('Empresa inválida.');
  const { data: org } = await sb.from('organizaciones').select('id, nombre, activa').eq('id', orgId).maybeSingle();
  if (!org) return error('No existe esa empresa.', 404);
  if (org.activa) return error('Desactivá la empresa antes de borrarla.', 409);
  if (String(cuerpo.confirmacion || '').trim() !== org.nombre) return error('Escribí el nombre exacto de la empresa para confirmar.');

  const { data, error: errBorrar } = await sb.rpc('borrar_empresa', { org: orgId });
  if (errBorrar) {
    if (/Could not find the function|does not exist/i.test(errBorrar.message)) return error('Falta correr la migración 0023_borrar_empresa.sql en Supabase.', 500);
    return error(errBorrar.message, 409);
  }
  const res = data as { nombre: string; usuarios: string[]; logo_url: string | null; documentos: string[]; asuntos: string[]; contratos: string[] };

  // Los datos ya no están. Lo que sigue limpia archivos y cuentas: lo que falle queda anotado en el registro.
  const pendientes: string[] = [];
  const limpiar = async (bucket: string, rutas: (string | null)[]) => {
    const lista = rutas.filter((x): x is string => Boolean(x));
    for (let i = 0; i < lista.length; i += 100) {
      const { error: e } = await sb.storage.from(bucket).remove(lista.slice(i, i + 100));
      if (e) pendientes.push(`${bucket}: ${e.message}`);
    }
  };
  await limpiar('documentos', res.documentos ?? []);
  await limpiar('asuntos', res.asuntos ?? []);
  await limpiar('firmas', res.contratos ?? []);
  await limpiar('logos', [rutaLogo(res.logo_url)]);
  for (const id of res.usuarios ?? []) {
    const { error: e } = await sb.auth.admin.deleteUser(id);
    if (e) pendientes.push(`cuenta ${id}: ${e.message}`);
  }

  await registrar(sb, actor, null, 'empresa_borrada', { organizacion_id: orgId, nombre: res.nombre, usuarios: (res.usuarios ?? []).length, pendientes });
  return json({ ok: true, usuarios: (res.usuarios ?? []).length, pendientes });
}

export function GET(): Response {
  return error('Método no permitido.', 405);
}

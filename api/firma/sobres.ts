/**
 * Envíos a firma electrónica desde el portal (Vercel Function).
 * Corre en el servidor con la clave service role, que nunca llega al navegador.
 * Responde a usuarios activos del portal. Cada uno opera solo sobre lo que
 * puede ver. FIRMA todo, el titular lo de su empresa y un miembro lo suyo.
 *
 * POST /api/firma/sobres  { accion, ... }
 *   config      informa si el mail está configurado
 *   crear       { borrador_ruta, original_nombre, titulo, mensaje?, secuencial?, vence_dias?, organizacion_id?, firmantes[] }
 *   enlaces     { sobre_id }               enlaces personales para mandar por otro medio
 *   recordar    { firmante_id }            reenvía la invitación
 *   anular      { sobre_id, motivo }
 *   descargar   { sobre_id, cual }         cual es original o final. Enlace que vence en dos minutos
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';

/* ==================================================================== */
/* BLOQUE COMÚN. Es idéntico en api/firma/sobres.ts y api/firma/firmar.ts */
/* porque cada función de Vercel es autocontenida. Si se cambia en uno,  */
/* se cambia igual en el otro.                                           */
/* ==================================================================== */
const ZONA = 'America/Argentina/Buenos_Aires';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BUCKET = 'firmas';

interface Sobre {
  id: string;
  codigo: string;
  organizacion_id: string | null;
  emisor: 'firma' | 'cliente';
  titulo: string;
  mensaje: string | null;
  estado: 'en_curso' | 'completado' | 'rechazado' | 'anulado' | 'vencido';
  secuencial: boolean;
  vence_en: string;
  creado_por: string | null;
  creado_en: string;
  completado_en: string | null;
  cerrado_en: string | null;
  motivo_cierre: string | null;
  original_ruta: string;
  original_nombre: string;
  original_bytes: number;
  original_sha256: string;
  original_paginas: number;
  final_ruta: string | null;
  final_sha256: string | null;
  error_sellado: string | null;
}

interface Firmante {
  id: string;
  sobre_id: string;
  orden: number;
  nombre: string;
  email: string;
  pedir_documento: boolean;
  documento: string | null;
  estado: 'pendiente' | 'notificado' | 'visto' | 'firmado' | 'rechazado';
  version_enlace: number;
  notificado_en: string | null;
  visto_en: string | null;
  firmado_en: string | null;
  rechazado_en: string | null;
  motivo_rechazo: string | null;
  ultimo_recordatorio: string | null;
  otp_hash: string | null;
  otp_vence: string | null;
  otp_intentos: number;
  otp_enviados: number;
  otp_ultimo_envio: string | null;
  otp_verificado_en: string | null;
  firma_ruta: string | null;
  firma_tipo: 'dibujada' | 'escrita' | null;
  firma_sha256: string | null;
  ip: string | null;
  user_agent: string | null;
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

function basePortal(): string {
  return (process.env.PORTAL_URL || 'https://www.firmasvc.com').replace(/\/$/, '');
}

/** Clave para los enlaces de firma y los códigos por mail. Si falta FIRMA_CLAVE_FIRMAS se deriva de la service role. */
function secreto(): string {
  if (process.env.FIRMA_CLAVE_FIRMAS) return process.env.FIRMA_CLAVE_FIRMAS;
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || '').update('firma-electronica').digest('hex');
}

function sha256(datos: Uint8Array | string): string {
  return createHash('sha256').update(datos).digest('hex');
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function selloEnlace(id: string, version: number): string {
  return createHmac('sha256', secreto()).update(`enlace:${id}:${version}`).digest('base64url').slice(0, 32);
}

/** Enlace personal de cada firmante. No se guarda en la base, se recalcula. */
function enlaceFirmante(f: Pick<Firmante, 'id' | 'version_enlace'>): string {
  return `${basePortal()}/firmar/${f.id}.${f.version_enlace}.${selloEnlace(f.id, f.version_enlace)}`;
}

function ipDe(request: Request): string | null {
  const reenviada = request.headers.get('x-forwarded-for');
  if (reenviada) return reenviada.split(',')[0].trim().slice(0, 64);
  return (request.headers.get('x-real-ip') || '').slice(0, 64) || null;
}

function agenteDe(request: Request): string | null {
  return (request.headers.get('user-agent') || '').slice(0, 300) || null;
}

async function evento(
  sb: SupabaseClient,
  sobre: string,
  firmante: string | null,
  actor: string | null,
  tipo: string,
  request: Request | null,
  detalle: Record<string, unknown> = {},
): Promise<void> {
  const { error: e } = await sb.rpc('firma_registrar_evento', {
    p_sobre: sobre,
    p_firmante: firmante,
    p_actor: actor,
    p_tipo: tipo,
    p_ip: request ? ipDe(request) : null,
    p_ua: request ? agenteDe(request) : null,
    p_detalle: detalle,
  });
  if (e) throw new Error(`No se pudo registrar el evento ${tipo}. ${e.message}`);
}

function fechaHora(iso: string | null): string {
  if (!iso) return '';
  const f = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));
  return `${f} (hora de Buenos Aires)`;
}

function enmascarar(email: string): string {
  const [usuario, dominio] = email.split('@');
  if (!dominio) return email;
  return `${usuario.slice(0, 2)}${'*'.repeat(Math.max(1, usuario.length - 2))}@${dominio}`;
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Si el plazo pasó, el sobre queda vencido y se registra. Devuelve el sobre al día.
 * Con error_sellado ya firmaron todos y solo falta armar el PDF, así que no vence.
 */
async function alDia(sb: SupabaseClient, sobre: Sobre): Promise<Sobre> {
  if (sobre.estado !== 'en_curso' || sobre.error_sellado || new Date(sobre.vence_en).getTime() > Date.now()) return sobre;
  const ahora = new Date().toISOString();
  const { data } = await sb
    .from('firma_sobres')
    .update({ estado: 'vencido', cerrado_en: ahora, motivo_cierre: 'Venció el plazo para firmar' })
    .eq('id', sobre.id)
    .eq('estado', 'en_curso')
    .select('*')
    .maybeSingle();
  if (data) {
    await evento(sb, sobre.id, null, null, 'sobre_vencido', null, { vence_en: sobre.vence_en });
    return data as Sobre;
  }
  return sobre;
}

/** A quién le toca. En paralelo, a todos los que faltan. En orden, al grupo con el orden más bajo pendiente. */
function enTurno(firmantes: Firmante[], secuencial: boolean): Firmante[] {
  const faltan = firmantes.filter((f) => f.estado !== 'firmado' && f.estado !== 'rechazado');
  if (!secuencial || faltan.length === 0) return faltan;
  const minimo = Math.min(...faltan.map((f) => f.orden));
  return faltan.filter((f) => f.orden === minimo);
}

async function nombreEmisor(sb: SupabaseClient, sobre: Sobre): Promise<string> {
  if (sobre.emisor === 'firma' || !sobre.organizacion_id) return 'FIRMA';
  const { data } = await sb.from('organizaciones').select('nombre').eq('id', sobre.organizacion_id).maybeSingle();
  return (data?.nombre as string | undefined) || 'FIRMA';
}

function mailDisponible(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function plantillaMail(o: { titulo: string; parrafos: string[]; boton?: { texto: string; url: string }; pie?: string }): string {
  const parrafos = o.parrafos.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1B1F1B">${p}</p>`).join('');
  const boton = o.boton
    ? `<p style="margin:28px 0"><a href="${escapar(o.boton.url)}" style="display:inline-block;background:#173A2F;color:#F5F3EC;text-decoration:none;font-weight:600;padding:14px 26px;font-size:15px">${escapar(o.boton.texto)}</a></p>`
    : '';
  const pie = o.pie ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6B6553">${o.pie}</p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#F5F3EC;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="margin:0 0 24px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#6B6553">FIRMA · Firma electrónica</p>
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#1B1F1B">${escapar(o.titulo)}</h1>
${parrafos}${boton}${pie}
<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #d9d6cc;font-size:12px;color:#6B6553">FIRMA · Castro &amp; Partners · firmasvc.com</p>
</div></body></html>`;
}

/** Manda un mail con Resend. Devuelve null si salió o el motivo si no. */
async function enviarMail(o: {
  nombreRemitente: string;
  para: string[];
  asunto: string;
  html: string;
  responderA?: string | null;
  adjuntos?: { filename: string; content: string }[];
}): Promise<string | null> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return 'Falta configurar RESEND_API_KEY.';
  const direccion = process.env.FIRMA_MAIL_DIRECCION || 'firmas@firmasvc.com';
  const nombre = o.nombreRemitente.replace(/[<>"\r\n]/g, '').slice(0, 80) || 'FIRMA';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: `${nombre} <${direccion}>`,
        to: o.para,
        subject: o.asunto.replace(/[\r\n]/g, ' ').slice(0, 200),
        html: o.html,
        ...(o.responderA ? { reply_to: o.responderA } : {}),
        ...(o.adjuntos?.length ? { attachments: o.adjuntos } : {}),
      }),
    });
    if (!r.ok) {
      const cuerpo = await r.text().catch(() => '');
      return `Resend respondió ${r.status}. ${cuerpo.slice(0, 200)}`;
    }
    return null;
  } catch (e) {
    return `No hubo conexión con Resend. ${(e as Error).message}`;
  }
}

async function mailDelCreador(sb: SupabaseClient, sobre: Sobre): Promise<string | null> {
  if (!sobre.creado_por) return null;
  const { data } = await sb.from('perfiles').select('email').eq('id', sobre.creado_por).maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

/** Invitación o recordatorio a un firmante. Pasa a notificado y queda en el registro. */
async function notificarFirmante(
  sb: SupabaseClient,
  sobre: Sobre,
  f: Firmante,
  request: Request | null,
  actor: string | null,
  recordatorio = false,
): Promise<string | null> {
  const emisor = await nombreEmisor(sb, sobre);
  const responderA = await mailDelCreador(sb, sobre);
  const parrafos = [
    `Hola ${escapar(f.nombre)}.`,
    `${escapar(emisor)} te envió <strong>${escapar(sobre.titulo)}</strong> para que lo leas y lo firmes de forma electrónica.`,
  ];
  if (sobre.mensaje) parrafos.push(`<em>${escapar(sobre.mensaje).replace(/\n/g, '<br>')}</em>`);
  parrafos.push(`Tenés tiempo hasta el ${escapar(fechaHora(sobre.vence_en))}. Para firmar te vamos a mandar un código a este mismo mail.`);
  const fallo = await enviarMail({
    nombreRemitente: emisor === 'FIRMA' ? 'FIRMA' : `${emisor} vía FIRMA`,
    para: [f.email],
    asunto: `${recordatorio ? 'Recordatorio. ' : ''}Firmá ${sobre.titulo}`,
    html: plantillaMail({
      titulo: recordatorio ? 'Tenés un documento pendiente de firma' : 'Tenés un documento para firmar',
      parrafos,
      boton: { texto: 'Revisar y firmar', url: enlaceFirmante(f) },
      pie: 'El enlace es personal. No lo reenvíes. Si no esperabas este mail, ignoralo.',
    }),
    responderA,
  });
  if (fallo) {
    await evento(sb, sobre.id, f.id, actor, 'error_mail', request, { para: f.email, motivo: fallo.slice(0, 200) });
    return fallo;
  }
  const ahora = new Date().toISOString();
  const cambios: Record<string, unknown> = recordatorio ? { ultimo_recordatorio: ahora } : { notificado_en: ahora };
  if (f.estado === 'pendiente') cambios.estado = 'notificado';
  await sb.from('firma_firmantes').update(cambios).eq('id', f.id);
  await evento(sb, sobre.id, f.id, actor, recordatorio ? 'recordatorio_enviado' : 'invitacion_enviada', request, { para: f.email });
  return null;
}
/* ==================================================================== */
/* FIN DEL BLOQUE COMÚN                                                  */
/* ==================================================================== */

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_FIRMANTES = 20;
const ESPERA_RECORDATORIO_MS = 30 * 60 * 1000;

interface Quien {
  id: string;
  email: string;
  rol: string;
  organizacion_id: string | null;
}

/** Los mismos roles que ven contratos y documentos legales en el portal. Closer y setter no envían a firmar. */
const ROLES_FIRMA = ['admin', 'titular', 'csm', 'miembro'];

async function identificar(sb: SupabaseClient, request: Request): Promise<Quien | Response> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data, error: e } = await sb.auth.getUser(token);
  if (e || !data?.user) return error('Sesión inválida o vencida.', 401);
  const { data: p } = await sb.from('perfiles').select('id, email, rol, organizacion_id, activo').eq('id', data.user.id).maybeSingle();
  if (!p || !p.activo) return error('Tu cuenta no tiene acceso activo.', 403);
  if (!ROLES_FIRMA.includes(String(p.rol))) return error('Tu rol no tiene acceso a la firma electrónica.', 403);
  if (p.rol !== 'admin') {
    const { data: org } = await sb.from('organizaciones').select('activa').eq('id', p.organizacion_id).maybeSingle();
    if (!org?.activa) return error('Tu empresa no tiene acceso activo.', 403);
  }
  return { id: p.id, email: p.email, rol: p.rol, organizacion_id: p.organizacion_id };
}

function puedeOperar(q: Quien, s: Sobre): boolean {
  if (q.rol === 'admin') return true;
  if (!s.organizacion_id || s.organizacion_id !== q.organizacion_id) return false;
  return q.rol === 'titular' || s.creado_por === q.id;
}

async function cargarSobre(sb: SupabaseClient, q: Quien, id: unknown): Promise<Sobre | Response> {
  const sobreId = String(id || '');
  if (!UUID.test(sobreId)) return error('Envío inválido.');
  const { data } = await sb.from('firma_sobres').select('*').eq('id', sobreId).maybeSingle();
  if (!data || !puedeOperar(q, data as Sobre)) return error('No existe ese envío o no tenés acceso.', 404);
  return alDia(sb, data as Sobre);
}

function nombreArchivo(valor: unknown): string {
  const base = String(valor || 'documento.pdf')
    .replace(/[\\/:*?"<>|\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return /\.pdf$/i.test(base) ? base : `${base || 'documento'}.pdf`;
}

interface FirmanteNuevo {
  nombre: string;
  email: string;
  pedir_documento: boolean;
  orden: number;
}

function leerFirmantes(valor: unknown, secuencial: boolean): FirmanteNuevo[] | string {
  if (!Array.isArray(valor) || valor.length === 0) return 'Sumá al menos un firmante.';
  if (valor.length > MAX_FIRMANTES) return `Hasta ${MAX_FIRMANTES} firmantes por envío.`;
  const vistos = new Set<string>();
  const lista: FirmanteNuevo[] = [];
  for (const [i, bruto] of valor.entries()) {
    const f = (bruto || {}) as Record<string, unknown>;
    const nombre = String(f.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const email = String(f.email || '').trim().toLowerCase();
    if (nombre.length < 2) return `Falta el nombre del firmante ${i + 1}.`;
    if (!EMAIL_VALIDO.test(email)) return `El mail de ${nombre} no es válido.`;
    if (vistos.has(email)) return `El mail ${email} está repetido. Cada firmante necesita su propio mail.`;
    vistos.add(email);
    lista.push({ nombre, email, pedir_documento: f.pedir_documento !== false, orden: secuencial ? i + 1 : 1 });
  }
  return lista;
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);

  const q = await identificar(sb, request);
  if (q instanceof Response) return q;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error('Pedido mal formado.');
  }
  const accion = String(cuerpo.accion || '');

  try {
    if (accion === 'config') return json({ ok: true, mail: mailDisponible() });

    /* -------------------------------------------------------------- */
    /* Crear y enviar                                                  */
    /* -------------------------------------------------------------- */
    if (accion === 'crear') {
      const titulo = String(cuerpo.titulo || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const mensaje = String(cuerpo.mensaje || '').trim().slice(0, 2000) || null;
      const secuencial = cuerpo.secuencial === true;
      const dias = Math.round(Number(cuerpo.vence_dias ?? 30));
      const borrador = String(cuerpo.borrador_ruta || '');
      if (!titulo) return error('Poné un título al envío.');
      if (!Number.isFinite(dias) || dias < 1 || dias > 90) return error('El plazo para firmar va de 1 a 90 días.');
      if (!new RegExp(`^borradores/${q.id}/[0-9a-f-]{36}\\.pdf$`, 'i').test(borrador)) return error('Subí el PDF de nuevo.');

      let organizacion_id: string | null;
      if (q.rol === 'admin') {
        organizacion_id = cuerpo.organizacion_id ? String(cuerpo.organizacion_id) : null;
        if (organizacion_id) {
          if (!UUID.test(organizacion_id)) return error('Cliente inválido.');
          const { data: org } = await sb.from('organizaciones').select('id').eq('id', organizacion_id).maybeSingle();
          if (!org) return error('El cliente elegido no existe.');
        }
      } else {
        organizacion_id = q.organizacion_id;
      }

      const firmantes = leerFirmantes(cuerpo.firmantes, secuencial);
      if (typeof firmantes === 'string') return error(firmantes);

      // El PDF lo subió el navegador a su carpeta de borradores. Acá se valida de verdad.
      const { data: blob, error: errBajar } = await sb.storage.from(BUCKET).download(borrador);
      if (errBajar || !blob) return error('No encontramos el PDF subido. Volvé a cargarlo.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_BYTES) return error('El PDF tiene que pesar menos de 15 MB.');
      if (Buffer.from(bytes.subarray(0, 5)).toString('latin1') !== '%PDF-') return error('El archivo no es un PDF.');
      let paginas: number;
      try {
        const doc = await PDFDocument.load(bytes, { updateMetadata: false });
        paginas = doc.getPageCount();
      } catch (e) {
        const protegido = /encrypt/i.test((e as Error).message || '');
        return error(protegido ? 'El PDF está protegido con contraseña. Exportalo sin protección y volvé a subirlo.' : 'No pudimos leer el PDF. Exportalo de nuevo y volvé a subirlo.');
      }
      if (paginas < 1) return error('El PDF no tiene páginas.');
      const hash = sha256(bytes);

      const id = randomUUID();
      const ruta = `${id}/original.pdf`;
      const { error: errSubir } = await sb.storage.from(BUCKET).upload(ruta, bytes, { contentType: 'application/pdf', upsert: false });
      if (errSubir) return error(`No se pudo guardar el PDF. ${errSubir.message}`, 500);

      const vence_en = new Date(Date.now() + dias * 86400000).toISOString();
      const { data: sobre, error: errSobre } = await sb
        .from('firma_sobres')
        .insert({
          id,
          organizacion_id,
          emisor: q.rol === 'admin' ? 'firma' : 'cliente',
          titulo,
          mensaje,
          secuencial,
          vence_en,
          creado_por: q.id,
          original_ruta: ruta,
          original_nombre: nombreArchivo(cuerpo.original_nombre),
          original_bytes: bytes.length,
          original_sha256: hash,
          original_paginas: paginas,
        })
        .select('*')
        .single();
      if (errSobre || !sobre) {
        await sb.storage.from(BUCKET).remove([ruta]);
        return error(`No se pudo crear el envío. ${errSobre?.message ?? ''}`.trim(), 500);
      }

      const { data: filas, error: errFirm } = await sb
        .from('firma_firmantes')
        .insert(firmantes.map((f) => ({ ...f, sobre_id: id })))
        .select('*');
      if (errFirm || !filas) {
        // Sin firmantes el sobre no sirve. Se anula para que quede la traza.
        await sb.from('firma_sobres').update({ estado: 'anulado', cerrado_en: new Date().toISOString(), motivo_cierre: 'Error al cargar firmantes' }).eq('id', id);
        return error(`No se pudieron cargar los firmantes. ${errFirm?.message ?? ''}`.trim(), 500);
      }
      await sb.storage.from(BUCKET).remove([borrador]);

      await evento(sb, id, null, q.id, 'sobre_creado', request, {
        titulo,
        emisor: sobre.emisor,
        organizacion_id,
        secuencial,
        vence_en,
        firmantes: firmantes.map((f) => ({ nombre: f.nombre, email: f.email, orden: f.orden })),
      });
      await evento(sb, id, null, q.id, 'documento_cargado', request, {
        nombre: sobre.original_nombre,
        bytes: bytes.length,
        paginas,
        sha256: hash,
      });

      const avisos: string[] = [];
      for (const f of enTurno(filas as Firmante[], secuencial)) {
        const fallo = await notificarFirmante(sb, sobre as Sobre, f, request, q.id);
        if (fallo) avisos.push(`No salió el mail a ${f.email}. Copiá su enlace y mandáselo por otro medio.`);
      }
      return json({ ok: true, id, avisos });
    }

    /* -------------------------------------------------------------- */
    /* Enlaces personales                                              */
    /* -------------------------------------------------------------- */
    if (accion === 'enlaces') {
      const s = await cargarSobre(sb, q, cuerpo.sobre_id);
      if (s instanceof Response) return s;
      if (s.estado !== 'en_curso') return json({ ok: true, enlaces: [] });
      const { data } = await sb.from('firma_firmantes').select('*').eq('sobre_id', s.id).order('orden');
      const turno = new Set(enTurno((data ?? []) as Firmante[], s.secuencial).map((f) => f.id));
      const enlaces = ((data ?? []) as Firmante[])
        .filter((f) => f.estado !== 'firmado' && f.estado !== 'rechazado')
        .map((f) => ({ firmante_id: f.id, nombre: f.nombre, email: f.email, url: enlaceFirmante(f), turno: turno.has(f.id) }));
      return json({ ok: true, enlaces });
    }

    /* -------------------------------------------------------------- */
    /* Recordatorio                                                    */
    /* -------------------------------------------------------------- */
    if (accion === 'recordar') {
      const firmanteId = String(cuerpo.firmante_id || '');
      if (!UUID.test(firmanteId)) return error('Firmante inválido.');
      const { data: f } = await sb.from('firma_firmantes').select('*').eq('id', firmanteId).maybeSingle();
      if (!f) return error('No existe ese firmante.', 404);
      const s = await cargarSobre(sb, q, f.sobre_id);
      if (s instanceof Response) return s;
      if (s.estado !== 'en_curso') return error('El envío ya no está en curso.');
      if (f.estado === 'firmado' || f.estado === 'rechazado') return error('Esa persona ya respondió.');
      const { data: todos } = await sb.from('firma_firmantes').select('*').eq('sobre_id', s.id);
      if (!enTurno((todos ?? []) as Firmante[], s.secuencial).some((x) => x.id === f.id)) return error('Todavía no es el turno de esa persona. Le llega el mail cuando firmen los anteriores.');
      const ultimo = f.ultimo_recordatorio || f.notificado_en;
      if (ultimo && Date.now() - new Date(ultimo).getTime() < ESPERA_RECORDATORIO_MS) return error('Le mandamos un mail hace menos de media hora. Esperá un rato antes de insistir.');
      const fallo = await notificarFirmante(sb, s, f as Firmante, request, q.id, Boolean(f.notificado_en));
      if (fallo) return error(`No salió el mail. ${fallo}`, 502);
      return json({ ok: true });
    }

    /* -------------------------------------------------------------- */
    /* Anular                                                          */
    /* -------------------------------------------------------------- */
    if (accion === 'anular') {
      const s = await cargarSobre(sb, q, cuerpo.sobre_id);
      if (s instanceof Response) return s;
      const motivo = String(cuerpo.motivo || '').trim().slice(0, 500);
      if (motivo.length < 3) return error('Contá brevemente por qué se anula.');
      if (s.estado !== 'en_curso') return error('Solo se anula un envío en curso.');
      const { data: anulado } = await sb
        .from('firma_sobres')
        .update({ estado: 'anulado', cerrado_en: new Date().toISOString(), motivo_cierre: motivo })
        .eq('id', s.id)
        .eq('estado', 'en_curso')
        .select('id')
        .maybeSingle();
      if (!anulado) return error('El envío cambió de estado. Recargá la página.', 409);
      await evento(sb, s.id, null, q.id, 'sobre_anulado', request, { motivo });
      const { data: avisar } = await sb.from('firma_firmantes').select('*').eq('sobre_id', s.id).in('estado', ['notificado', 'visto']);
      const emisor = await nombreEmisor(sb, s);
      for (const f of (avisar ?? []) as Firmante[]) {
        await enviarMail({
          nombreRemitente: emisor === 'FIRMA' ? 'FIRMA' : `${emisor} vía FIRMA`,
          para: [f.email],
          asunto: `Se anuló ${s.titulo}`,
          html: plantillaMail({
            titulo: 'El envío a firma se anuló',
            parrafos: [`Hola ${escapar(f.nombre)}.`, `${escapar(emisor)} anuló <strong>${escapar(s.titulo)}</strong>. Ya no hace falta que lo firmes y el enlace que recibiste dejó de funcionar.`],
          }),
          responderA: q.email,
        });
      }
      return json({ ok: true });
    }

    /* -------------------------------------------------------------- */
    /* Descargas                                                       */
    /* -------------------------------------------------------------- */
    if (accion === 'descargar') {
      const s = await cargarSobre(sb, q, cuerpo.sobre_id);
      if (s instanceof Response) return s;
      const cual = cuerpo.cual === 'final' ? 'final' : 'original';
      const ruta = cual === 'final' ? s.final_ruta : s.original_ruta;
      if (!ruta) return error('El documento firmado todavía no está listo.');
      const nombre = s.original_nombre.replace(/\.pdf$/i, '') + (cual === 'final' ? ' (firmado).pdf' : '.pdf');
      const { data, error: e } = await sb.storage.from(BUCKET).createSignedUrl(ruta, 120, { download: nombre });
      if (e || !data) return error('No se pudo preparar la descarga.', 500);
      if (q.rol !== 'admin') await evento(sb, s.id, null, q.id, 'documento_descargado', request, { cual });
      return json({ ok: true, url: data.signedUrl });
    }

    return error('Acción desconocida.');
  } catch (e) {
    return error((e as Error).message || 'Error inesperado.', 500);
  }
}

export function GET(): Response {
  return error('Método no permitido.', 405);
}

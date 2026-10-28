/**
 * Envíos a firma electrónica desde el portal (Vercel Function).
 * Corre en el servidor con la clave service role, que nunca llega al navegador.
 * Responde a usuarios activos del portal. Cada uno opera solo sobre lo que
 * puede ver. FIRMA todo, el titular lo de su empresa y un miembro lo suyo.
 *
 * POST /api/firma/sobres  { accion, ... }
 *   config      informa si el mail está configurado
 *   crear       { borrador_ruta, original_nombre, titulo, mensaje?, secuencial?, vence_dias?, organizacion_id?, crm_cliente_id?, entrega?, firmantes[] }
 *               Con crm_cliente_id el envío queda atado a ese cliente del CRM de la
 *               misma empresa: al firmarse todos, el cliente pasa a Firmado.
 *   enlaces     { sobre_id }               enlaces personales para mandar por otro medio
 *   recordar    { firmante_id }            reenvía la invitación
 *   corregir_email { firmante_id, email }  cambia el mail de quien no firmó. El enlace anterior deja de andar
 *   anular      { sobre_id, motivo }
 *   descargar   { sobre_id, cual }         cual es original o final. Enlace que vence en dos minutos
 *   eliminar    { sobre_id }               solo FIRMA. Borra el envío con su registro, para los de prueba (migración 0028)
 *
 * Contratos de los clientes del CRM (cualquier rol con acceso al CRM):
 *   crm_vista   { cliente_id }             completa el modelo del servicio y deja el PDF de vista previa
 *   crm_pdf     { cliente_id, descargar? }  enlace corto al PDF, el firmado si ya está. Con descargar, baja el archivo
 *   crm_enviar  { cliente_id, mensaje?, entrega? }  lo manda a firmar al cliente y a la empresa a la vez
 *
 * entrega es mail (por defecto) o enlace. Por enlace no salen invitaciones:
 * quien envía copia el enlace de cada firmante y se firma sin código por mail.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { enviarMail, mailDisponible, plantillaMail } from '../_lib/mail.js';
import { PDFDocument } from 'pdf-lib';
import { OPCIONALES, valoresDelContrato, type ClienteContrato, type PagoContrato } from '../_lib/variables.js';
import { completarWord, wordAPdf } from '../_lib/word.js';

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
  crm_cliente_id: string | null;
  /** Por enlace no salen invitaciones y se firma sin código por mail. Sin la migración 0027 no viene. */
  entrega?: 'mail' | 'enlace';
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

/** Clave para los enlaces de firma y los códigos por mail. Propia, así cambiar la service role no rompe los enlaces. */
function secreto(): string {
  const clave = process.env.FIRMA_CLAVE_FIRMAS;
  if (!clave) throw new Error('Falta configurar FIRMA_CLAVE_FIRMAS.');
  return clave;
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
  parrafos.push(
    `Tenés tiempo hasta el ${escapar(fechaHora(sobre.vence_en))}.${sobre.entrega === 'enlace' ? '' : ' Para firmar te vamos a mandar un código a este mismo mail.'}`,
  );
  const fallo = await enviarMail({
    nombreRemitente: emisor === 'FIRMA' ? 'FIRMA' : `${emisor} vía FIRMA`,
    para: [f.email],
    asunto: `${recordatorio ? 'Recordatorio. ' : ''}Firmá ${sobre.titulo}`,
    html: plantillaMail({
      seccion: 'Firma electrónica',
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

const entregaDe = (v: unknown): 'mail' | 'enlace' => (v === 'enlace' ? 'enlace' : 'mail');

interface Quien {
  id: string;
  email: string;
  rol: string;
  organizacion_id: string | null;
}

/** Los mismos roles que ven contratos y documentos legales en el portal. Closer y setter no envían a firmar desde Firma electrónica. */
const ROLES_FIRMA = ['admin', 'titular', 'csm', 'miembro'];
/** Los contratos de los clientes del CRM los manda cualquiera que use el CRM. */
const ROLES_CRM = ['admin', 'titular', 'csm', 'closer', 'miembro'];

async function identificar(sb: SupabaseClient, request: Request): Promise<Quien | Response> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data, error: e } = await sb.auth.getUser(token);
  if (e || !data?.user) return error('Sesión inválida o vencida.', 401);
  const { data: p } = await sb.from('perfiles').select('id, email, rol, organizacion_id, activo').eq('id', data.user.id).maybeSingle();
  if (!p || !p.activo) return error('Tu cuenta no tiene acceso activo.', 403);
  if (!ROLES_CRM.includes(String(p.rol))) return error('Tu rol no tiene acceso a la firma electrónica.', 403);
  if (p.rol !== 'admin') {
    const { data: org } = await sb.from('organizaciones').select('activa').eq('id', p.organizacion_id).maybeSingle();
    if (!org?.activa) return error('Tu empresa no tiene acceso activo.', 403);
  }
  return { id: p.id, email: p.email, rol: p.rol, organizacion_id: p.organizacion_id };
}

function puedeOperar(q: Quien, s: Sobre): boolean {
  if (q.rol === 'admin') return true;
  if (!s.organizacion_id || s.organizacion_id !== q.organizacion_id) return false;
  // Los contratos del CRM los sigue todo el equipo que ve al cliente.
  return q.rol === 'titular' || s.creado_por === q.id || Boolean(s.crm_cliente_id);
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

/* ==================================================================== */
/* Contratos de los clientes del CRM                                     */
/* ==================================================================== */
const BUCKET_DOCUMENTOS = 'documentos';
const DIAS_CRM = 15;

interface ClienteCrm extends ClienteContrato {
  id: string;
  organizacion_id: string;
  estado_firma: string;
}

interface ContratoCrm {
  cliente_id: string;
  estado: string;
  pdf_ruta: string | null;
  sobre_id: string | null;
  avisos: string[];
}

/** Cliente del CRM al que esta persona tiene acceso, o el motivo del rechazo. */
async function clienteCrm(sb: SupabaseClient, q: Quien, valor: unknown): Promise<ClienteCrm | Response> {
  const id = String(valor || '');
  if (!UUID.test(id)) return error('Falta el cliente.');
  const { data } = await sb.from('crm_clientes').select('*').eq('id', id).maybeSingle();
  if (!data) return error('No existe ese cliente.', 404);
  if (q.rol !== 'admin' && data.organizacion_id !== q.organizacion_id) return error('No tenés acceso a este cliente.', 403);
  if (data.estado_firma === 'Baja') return error('El cliente está dado de baja.', 409);
  return data as ClienteCrm;
}

/** El envío vigente del cliente, si hay uno en curso o ya firmado. */
async function envioVigente(sb: SupabaseClient, sobreId: string | null): Promise<Sobre | null> {
  if (!sobreId) return null;
  const { data } = await sb.from('firma_sobres').select('*').eq('id', sobreId).maybeSingle();
  if (!data) return null;
  const s = await alDia(sb, data as Sobre);
  return s.estado === 'en_curso' || s.estado === 'completado' ? s : null;
}

/** Completa el modelo del servicio con la ficha, lo pasa a PDF y deja la vista previa. */
async function crmVista(sb: SupabaseClient, q: Quien, cuerpo: Record<string, unknown>): Promise<Response> {
  const cliente = await clienteCrm(sb, q, cuerpo.cliente_id);
  if (cliente instanceof Response) return cliente;
  if (cliente.estado_firma === 'Firmado' && q.rol !== 'admin') return error('El contrato ya está firmado.', 409);
  const { data: previo } = await sb.from('crm_contratos_firma').select('*').eq('cliente_id', cliente.id).maybeSingle<ContratoCrm>();
  const vigente = await envioVigente(sb, previo?.sobre_id ?? null);
  if (vigente?.estado === 'en_curso') return error('Ya hay un envío a firma en curso. Anulalo para generar el contrato de nuevo.', 409);

  const guardar = (cambios: Record<string, unknown>) =>
    sb.from('crm_contratos_firma').upsert({
      cliente_id: cliente.id,
      organizacion_id: cliente.organizacion_id,
      generado_por: q.id,
      generado_en: new Date().toISOString(),
      sobre_id: null,
      error: null,
      ...cambios,
    });

  // Modelo del servicio. El de pago total, si la venta es PIF y lo tiene.
  const { data: servicio } = cliente.servicio
    ? await sb.from('crm_servicios').select('nombre, documento_id, documento_pif_id').eq('organizacion_id', cliente.organizacion_id).eq('clave', cliente.servicio).maybeSingle()
    : { data: null };
  const documentoId = (cliente.modalidad === 'PIF' && servicio?.documento_pif_id) || servicio?.documento_id || null;
  if (!documentoId) {
    await guardar({ estado: 'sin_modelo', pdf_ruta: null, avisos: [] });
    return json({ ok: true, estado: 'sin_modelo' });
  }
  const { data: doc } = await sb.from('documentos').select('id, organizacion_id, archivo_ruta, archivo_nombre, activo').eq('id', documentoId).maybeSingle();
  if (!doc || !doc.activo || !doc.archivo_ruta || (doc.organizacion_id && doc.organizacion_id !== cliente.organizacion_id) || !/\.docx$/i.test(doc.archivo_nombre || doc.archivo_ruta)) {
    await guardar({ estado: 'sin_modelo', pdf_ruta: null, avisos: ['El modelo elegido ya no está disponible o no es un Word (.docx).'] });
    return json({ ok: true, estado: 'sin_modelo' });
  }

  await guardar({ estado: 'generando', documento_id: doc.id, avisos: [] });
  try {
    const { data: blob, error: errBajar } = await sb.storage.from(BUCKET_DOCUMENTOS).download(doc.archivo_ruta);
    if (errBajar || !blob) throw new Error('No se pudo leer el modelo.');
    const { data: org } = await sb.from('organizaciones').select('nombre, razon_social').eq('id', cliente.organizacion_id).maybeSingle();
    const { data: pagos } = await sb.from('crm_pagos').select('monto, vencimiento, estado, creado_en').eq('cliente_id', cliente.id);
    const valores = valoresDelContrato(cliente, (pagos ?? []) as PagoContrato[], org?.razon_social || org?.nombre || '', servicio?.nombre ?? null);
    const word = completarWord(new Uint8Array(await blob.arrayBuffer()), valores);

    const avisos: string[] = [];
    const vacias = word.usadas.filter((v) => !valores[v]?.trim() && !OPCIONALES.has(v));
    for (const v of vacias) avisos.push(`Falta {{${v}}}. Completalo en la ficha y volvé a generar el contrato.`);
    const nombraEmpresa = ['CLIENTE', 'RAZON_SOCIAL_CLIENTE'].some((v) => word.usadas.includes(v) || word.condicionales.includes(v));
    if (cliente.tipo === 'empresa' && !nombraEmpresa)
      avisos.push('El cliente es una empresa y el modelo no nombra su razón social. Usá {{CLIENTE}} o {{RAZON_SOCIAL_CLIENTE}} para que figure como parte.');
    for (const v of word.desconocidas) avisos.push(`El modelo usa {{${v}}}, que no es una variable del sistema. Quedó tal cual.`);
    for (const v of word.sinCerrar) avisos.push(`El tramo {{#${v}}}…{{/${v}}} no abre y cierra en el mismo párrafo. Su marca quedó tal cual.`);
    if (word.usadas.length === 0 && word.condicionales.length === 0) avisos.push('El modelo no tiene variables {{...}}. Salió igual al original.');

    const pdf = await wordAPdf(word.bytes, `${cliente.codigo ?? cliente.id} ${cliente.nombre}`);
    const ruta = `crm/${cliente.id}/contrato.pdf`;
    const { error: errSubir } = await sb.storage.from(BUCKET).upload(ruta, pdf, { contentType: 'application/pdf', upsert: true });
    if (errSubir) throw new Error(`No se pudo guardar el PDF. ${errSubir.message}`);
    const paginas = (await PDFDocument.load(pdf, { updateMetadata: false })).getPageCount();
    const estado = vacias.length ? 'faltan_datos' : 'listo';
    await guardar({ estado, documento_id: doc.id, pdf_ruta: ruta, pdf_paginas: paginas, avisos });
    return json({ ok: true, estado, avisos });
  } catch (e) {
    const motivo = ((e as Error).message || 'Error al armar el contrato.').slice(0, 300);
    await guardar({ estado: 'error', documento_id: doc.id, pdf_ruta: null, error: motivo, avisos: [] });
    return error(motivo, 500);
  }
}

/** Enlace corto al PDF del contrato: el firmado si ya está, si no la vista previa. Con descargar, baja como archivo. */
async function crmPdf(sb: SupabaseClient, q: Quien, cuerpo: Record<string, unknown>): Promise<Response> {
  const cliente = await clienteCrm(sb, q, cuerpo.cliente_id);
  if (cliente instanceof Response) return cliente;
  const { data: c } = await sb.from('crm_contratos_firma').select('*').eq('cliente_id', cliente.id).maybeSingle<ContratoCrm>();
  const vigente = await envioVigente(sb, c?.sobre_id ?? null);
  const ruta = vigente?.final_ruta || vigente?.original_ruta || c?.pdf_ruta;
  if (!ruta) return error('Todavía no hay contrato generado.', 404);
  const firmado = Boolean(vigente?.final_ruta);
  const nombre = `Contrato ${cliente.codigo ? `${cliente.codigo} ` : ''}${cliente.nombre}${firmado ? ' (firmado)' : ''}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
  const { data, error: e } = await sb.storage.from(BUCKET).createSignedUrl(ruta, 10 * 60, cuerpo.descargar ? { download: nombre } : undefined);
  if (e || !data) return error('No se pudo preparar el PDF.', 500);
  return json({ ok: true, url: data.signedUrl, firmado });
}

/** Quién firma por el cliente: él mismo o, si es una empresa, su representante. */
function firmanteCliente(c: ClienteCrm): string {
  return (c.tipo === 'empresa' && c.representante) || c.nombre;
}

/** Quién firma por la empresa: el elegido en Servicios o, si no hay, el titular. */
async function firmanteEmpresa(sb: SupabaseClient, orgId: string): Promise<{ nombre: string; email: string } | null> {
  const { data: org } = await sb.from('organizaciones').select('firmante_nombre, firmante_email').eq('id', orgId).maybeSingle();
  if (org?.firmante_email && org.firmante_nombre) return { nombre: org.firmante_nombre, email: org.firmante_email };
  const { data: titular } = await sb
    .from('perfiles')
    .select('nombre, email')
    .eq('organizacion_id', orgId)
    .eq('rol', 'titular')
    .eq('activo', true)
    .order('creado_en')
    .limit(1)
    .maybeSingle();
  if (!titular?.email) return null;
  return { nombre: titular.nombre || titular.email, email: titular.email };
}

/** Manda a firmar la vista previa. Firman a la vez el cliente final y la empresa. */
async function crmEnviar(sb: SupabaseClient, q: Quien, request: Request, cuerpo: Record<string, unknown>): Promise<Response> {
  const cliente = await clienteCrm(sb, q, cuerpo.cliente_id);
  if (cliente instanceof Response) return cliente;
  if (cliente.estado_firma === 'Firmado') return error('El contrato ya está firmado.', 409);
  const { data: c } = await sb.from('crm_contratos_firma').select('*').eq('cliente_id', cliente.id).maybeSingle<ContratoCrm>();
  if (await envioVigente(sb, c?.sobre_id ?? null)) return error('Este contrato ya se mandó a firmar.', 409);
  if (!c?.pdf_ruta || c.estado === 'generando') return error('Generá el contrato antes de mandarlo a firmar.');
  if (c.estado === 'faltan_datos') return error('Faltan datos en el contrato. Completalos en la ficha y volvé a generarlo.');
  if (c.estado !== 'listo') return error('El contrato no está listo para firmar. Volvé a generarlo.');

  const email = String(cliente.email || '').trim().toLowerCase();
  if (!EMAIL_VALIDO.test(email)) return error('El cliente no tiene un mail válido. Cargalo en la ficha.');
  const empresa = await firmanteEmpresa(sb, cliente.organizacion_id);
  if (!empresa) return error('Falta quién firma por la empresa. El titular lo define en CRM › Servicios.');
  if (empresa.email.toLowerCase() === email) return error('El cliente y quien firma por la empresa no pueden tener el mismo mail.');

  const { data: blob, error: errBajar } = await sb.storage.from(BUCKET).download(c.pdf_ruta);
  if (errBajar || !blob) return error('No se encontró el contrato generado. Volvé a generarlo.');
  const { data: servicio } = cliente.servicio
    ? await sb.from('crm_servicios').select('nombre').eq('organizacion_id', cliente.organizacion_id).eq('clave', cliente.servicio).maybeSingle()
    : { data: null };
  const nombreServicio = servicio?.nombre || cliente.servicio || 'servicios';
  const mensaje = String(cuerpo.mensaje || '').trim().slice(0, 2000) || null;

  const creado = await crearSobre(sb, q, request, {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    original_nombre: nombreArchivo(`Contrato ${cliente.codigo ?? ''} ${cliente.nombre}`),
    titulo: `Contrato de ${nombreServicio} · ${cliente.nombre}`.slice(0, 200),
    mensaje,
    secuencial: false,
    dias: DIAS_CRM,
    organizacion_id: cliente.organizacion_id,
    emisor: 'cliente',
    firmantes: [
      { nombre: firmanteCliente(cliente).slice(0, 160), email, pedir_documento: true, orden: 1 },
      { nombre: empresa.nombre.slice(0, 160), email: empresa.email.toLowerCase(), pedir_documento: false, orden: 1 },
    ],
    crm_cliente_id: cliente.id,
    entrega: entregaDe(cuerpo.entrega),
  });
  if (creado instanceof Response) return creado;
  await sb.from('crm_contratos_firma').update({ sobre_id: creado.id }).eq('cliente_id', cliente.id);
  return json({ ok: true, id: creado.id, avisos: creado.avisos });
}

interface DatosSobre {
  bytes: Uint8Array;
  original_nombre: string;
  titulo: string;
  mensaje: string | null;
  secuencial: boolean;
  dias: number;
  organizacion_id: string | null;
  emisor: 'firma' | 'cliente';
  firmantes: FirmanteNuevo[];
  crm_cliente_id: string | null;
  entrega: 'mail' | 'enlace';
}

/**
 * Gold y Black tienen un tope de documentos firmados por mes (migraciones 0022
 * y 0025). Ocupan el cupo los envíos de la empresa firmados en el mes y los que
 * siguen en curso, que reservan su lugar: así el tope no se pasa. Los de FIRMA
 * no cuentan ni se frenan. Devuelve el motivo si no se puede mandar otro.
 * Si la consulta falla (por ejemplo sin la migración), no frena.
 */
async function limiteDeFirmas(sb: SupabaseClient, d: Pick<DatosSobre, 'emisor' | 'organizacion_id'>): Promise<string | null> {
  if (d.emisor !== 'cliente' || !d.organizacion_id) return null;
  const { data, error: e } = await sb.rpc('firmas_uso', { org: d.organizacion_id });
  const uso = !e && Array.isArray(data) ? (data[0] as { limite: number | null; usados: number; en_curso?: number } | undefined) : undefined;
  if (!uso || uso.limite === null || uso.usados + (uso.en_curso ?? 0) < uso.limite) return null;
  return `Llegaste a los ${uso.limite} documentos que incluye tu plan este mes, contando los firmados y los que están en curso. El cupo se renueva el primer día del mes que viene, o antes si se anula o vence un envío en curso. Si necesitás mandar otro ya, escribinos por WhatsApp.`;
}

/** Valida el PDF, lo guarda, crea el envío con sus firmantes y, si va por mail, avisa a quienes les toca. */
async function crearSobre(sb: SupabaseClient, q: Quien, request: Request, d: DatosSobre): Promise<{ id: string; avisos: string[] } | Response> {
  const { bytes } = d;
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
  const tope = await limiteDeFirmas(sb, d);
  if (tope) return error(tope, 403);
  const hash = sha256(bytes);

  const id = randomUUID();
  const ruta = `${id}/original.pdf`;
  const { error: errSubir } = await sb.storage.from(BUCKET).upload(ruta, bytes, { contentType: 'application/pdf', upsert: false });
  if (errSubir) return error(`No se pudo guardar el PDF. ${errSubir.message}`, 500);

  const vence_en = new Date(Date.now() + d.dias * 86400000).toISOString();
  const { data: sobre, error: errSobre } = await sb
    .from('firma_sobres')
    .insert({
      id,
      organizacion_id: d.organizacion_id,
      emisor: d.emisor,
      titulo: d.titulo,
      mensaje: d.mensaje,
      secuencial: d.secuencial,
      vence_en,
      creado_por: q.id,
      original_ruta: ruta,
      original_nombre: d.original_nombre,
      original_bytes: bytes.length,
      original_sha256: hash,
      original_paginas: paginas,
      crm_cliente_id: d.crm_cliente_id,
      // Solo si va por enlace, así un envío por mail no depende de la migración 0027.
      ...(d.entrega === 'enlace' ? { entrega: 'enlace' } : {}),
    })
    .select('*')
    .single();
  if (errSobre || !sobre) {
    await sb.storage.from(BUCKET).remove([ruta]);
    return error(`No se pudo crear el envío. ${errSobre?.message ?? ''}`.trim(), 500);
  }

  const { data: filas, error: errFirm } = await sb
    .from('firma_firmantes')
    .insert(d.firmantes.map((f) => ({ ...f, sobre_id: id })))
    .select('*');
  if (errFirm || !filas) {
    // Sin firmantes el sobre no sirve. Se anula para que quede la traza.
    await sb.from('firma_sobres').update({ estado: 'anulado', cerrado_en: new Date().toISOString(), motivo_cierre: 'Error al cargar firmantes' }).eq('id', id);
    return error(`No se pudieron cargar los firmantes. ${errFirm?.message ?? ''}`.trim(), 500);
  }

  await evento(sb, id, null, q.id, 'sobre_creado', request, {
    titulo: d.titulo,
    emisor: d.emisor,
    organizacion_id: d.organizacion_id,
    crm_cliente_id: d.crm_cliente_id,
    secuencial: d.secuencial,
    entrega: d.entrega,
    vence_en,
    firmantes: d.firmantes.map((f) => ({ nombre: f.nombre, email: f.email, orden: f.orden })),
  });
  await evento(sb, id, null, q.id, 'documento_cargado', request, {
    nombre: d.original_nombre,
    bytes: bytes.length,
    paginas,
    sha256: hash,
  });

  const avisos: string[] = [];
  if (d.entrega === 'enlace') return { id, avisos };
  for (const f of enTurno(filas as Firmante[], d.secuencial)) {
    const fallo = await notificarFirmante(sb, sobre as Sobre, f, request, q.id);
    if (fallo) avisos.push(`No salió el mail a ${f.email}. Copiá su enlace y mandáselo por otro medio.`);
  }
  return { id, avisos };
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);
  if (!process.env.FIRMA_CLAVE_FIRMAS) return error('El servidor no tiene configurada FIRMA_CLAVE_FIRMAS.', 500);

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
    if (accion === 'crm_vista') return await crmVista(sb, q, cuerpo);
    if (accion === 'crm_enviar') return await crmEnviar(sb, q, request, cuerpo);
    if (accion === 'crm_pdf') return await crmPdf(sb, q, cuerpo);
    if (accion === 'crear' && !ROLES_FIRMA.includes(q.rol)) return error('Tu rol no tiene acceso a la firma electrónica.', 403);

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

      // Cliente del CRM al que se ata el envío, de la misma empresa y sin dar de baja.
      let crm_cliente_id: string | null = null;
      if (cuerpo.crm_cliente_id) {
        crm_cliente_id = String(cuerpo.crm_cliente_id);
        if (!UUID.test(crm_cliente_id)) return error('Cliente del CRM inválido.');
        if (!organizacion_id) return error('Un envío propio de FIRMA no se vincula a un cliente del CRM.');
        const { data: cl } = await sb.from('crm_clientes').select('organizacion_id, estado_firma').eq('id', crm_cliente_id).maybeSingle();
        if (!cl || cl.organizacion_id !== organizacion_id) return error('Ese cliente no es de la empresa del envío.');
        if (cl.estado_firma === 'Baja') return error('El cliente está dado de baja.', 409);
      }

      // El PDF lo subió el navegador a su carpeta de borradores. Acá se valida de verdad.
      const { data: blob, error: errBajar } = await sb.storage.from(BUCKET).download(borrador);
      if (errBajar || !blob) return error('No encontramos el PDF subido. Volvé a cargarlo.');
      const creado = await crearSobre(sb, q, request, {
        bytes: new Uint8Array(await blob.arrayBuffer()),
        original_nombre: nombreArchivo(cuerpo.original_nombre),
        titulo,
        mensaje,
        secuencial,
        dias,
        organizacion_id,
        emisor: q.rol === 'admin' ? 'firma' : 'cliente',
        firmantes,
        crm_cliente_id,
        entrega: entregaDe(cuerpo.entrega),
      });
      if (creado instanceof Response) return creado;
      await sb.storage.from(BUCKET).remove([borrador]);
      const { id, avisos } = creado;
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
    /* Corregir el mail de un firmante                                 */
    /* -------------------------------------------------------------- */
    if (accion === 'corregir_email') {
      const firmanteId = String(cuerpo.firmante_id || '');
      const email = String(cuerpo.email || '').trim().toLowerCase().slice(0, 200);
      if (!UUID.test(firmanteId)) return error('Firmante inválido.');
      if (!EMAIL_VALIDO.test(email)) return error('Revisá el mail.');
      const { data: f } = await sb.from('firma_firmantes').select('*').eq('id', firmanteId).maybeSingle();
      if (!f) return error('No existe ese firmante.', 404);
      const s = await cargarSobre(sb, q, f.sobre_id);
      if (s instanceof Response) return s;
      if (s.estado !== 'en_curso') return error('El envío ya no está en curso.');
      if (f.estado === 'firmado' || f.estado === 'rechazado') return error('Esa persona ya respondió. No se le cambia el mail.');
      if (String(f.email).toLowerCase() === email) return error('Es el mismo mail que ya tiene.');
      const { data: todos } = await sb.from('firma_firmantes').select('*').eq('sobre_id', s.id);
      if (((todos ?? []) as Firmante[]).some((x) => x.id !== f.id && x.email.toLowerCase() === email)) return error('Ese mail ya es de otro firmante del envío.');
      // Con la versión nueva, el enlace que fue al mail equivocado deja de funcionar. Vuelve a pendiente y sin código pedido.
      const { data: corregido } = await sb
        .from('firma_firmantes')
        .update({
          email,
          version_enlace: f.version_enlace + 1,
          estado: 'pendiente',
          notificado_en: null,
          visto_en: null,
          ultimo_recordatorio: null,
          otp_hash: null,
          otp_vence: null,
          otp_intentos: 0,
          otp_enviados: 0,
          otp_ultimo_envio: null,
          otp_verificado_en: null,
        })
        .eq('id', f.id)
        .eq('version_enlace', f.version_enlace)
        .in('estado', ['pendiente', 'notificado', 'visto'])
        .select('*')
        .maybeSingle();
      if (!corregido) return error('El firmante cambió de estado. Recargá la página.', 409);
      await evento(sb, s.id, f.id, q.id, 'email_corregido', request, { antes: f.email, ahora: email });
      // Por mail y si ya le toca, la invitación sale a la dirección nueva.
      const leToca = enTurno(((todos ?? []) as Firmante[]), s.secuencial).some((x) => x.id === f.id);
      if (s.entrega === 'enlace' || !leToca) return json({ ok: true, invitado: false });
      if (!mailDisponible()) return json({ ok: true, invitado: false, aviso: 'El envío de mails no está configurado. Copiá el enlace nuevo y mandáselo por otro medio.' });
      const fallo = await notificarFirmante(sb, s, corregido as Firmante, request, q.id);
      if (fallo) return json({ ok: true, invitado: false, aviso: `Se corrigió el mail, pero no salió la invitación. ${fallo}` });
      return json({ ok: true, invitado: true });
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
            seccion: 'Firma electrónica',
            titulo: 'El envío a firma se anuló',
            parrafos: [`Hola ${escapar(f.nombre)}.`, `${escapar(emisor)} anuló <strong>${escapar(s.titulo)}</strong>. Ya no hace falta que lo firmes y el enlace que recibiste dejó de funcionar.`],
          }),
          responderA: q.email,
        });
      }
      return json({ ok: true });
    }

    /* -------------------------------------------------------------- */
    /* Eliminar (solo FIRMA, para los envíos de prueba)                */
    /* -------------------------------------------------------------- */
    if (accion === 'eliminar') {
      if (q.rol !== 'admin') return error('Solo FIRMA elimina envíos.', 403);
      const s = await cargarSobre(sb, q, cuerpo.sobre_id);
      if (s instanceof Response) return s;
      const { data, error: e } = await sb.rpc('firma_borrar_sobre', { p_sobre: s.id });
      if (e) {
        const falta = /firma_borrar_sobre/.test(e.message) && /function|schema cache/i.test(e.message);
        return error(falta ? 'Falta correr la migración 0028_borrar_cliente_y_firmas.sql en Supabase.' : e.message, 500);
      }
      const rutas = [data?.original_ruta, data?.final_ruta].filter(Boolean) as string[];
      if (rutas.length) await sb.storage.from(BUCKET).remove(rutas);
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

/**
 * Firma electrónica del lado de quien firma (Vercel Function). Es pública:
 * cada firmante entra con su enlace personal y confirma que es él con un
 * código que le llega al mail. Si el envío va por enlace (lo pasa en mano
 * quien envía), firma sin código. También verifica documentos y corre las
 * tareas diarias.
 *
 * POST /api/firma/firmar  { accion, ... }
 *   ver         { token }                  datos del envío y enlace al PDF
 *   codigo      { token }                  manda el código de un solo uso al mail
 *   validar     { token, codigo }
 *   firmar      { token, tipo, imagen, documento?, acepto }
 *   rechazar    { token, motivo }
 *   verificar   { codigo? , sha256? }      pública, para quien recibe el PDF
 *   resellar    { sobre_id }               reintenta armar el PDF firmado (solo admin, con sesión)
 *
 * GET /api/firma/firmar  tarea diaria de Vercel Cron con CRON_SECRET.
 *   Vence los envíos con el plazo cumplido, manda recordatorios cada tres
 *   días, reintenta los PDF firmados que no se pudieron armar y los sellos
 *   de tiempo en BFA que quedaron sin enviar o sin bloque.
 */
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { enviarMail, mailDisponible, plantillaMail } from '../_lib/mail.js';
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

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
  /** Sello de tiempo en BFA. Sin la migración 0031 no viene. */
  bfa_recibo?: string | null;
  bfa_bloque?: number | null;
  bfa_registrado_en?: string | null;
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

const CODIGO_VIGENCIA_MS = 10 * 60 * 1000;
const CODIGO_ESPERA_MS = 60 * 1000;
const CODIGO_MAX_ENVIOS = 8;
const CODIGO_MAX_INTENTOS = 5;
/** Después de validar el código hay media hora para firmar. */
const VALIDACION_VIGENCIA_MS = 30 * 60 * 1000;
const FIRMA_MAX_BYTES = 400 * 1024;
const RECORDATORIO_CADA_MS = 3 * 86400000;
/** Hasta este peso el PDF firmado viaja adjunto en el mail. Más grande, solo el enlace para verificarlo. */
const ADJUNTO_MAX_BYTES = 8 * 1024 * 1024;

/** Lo que acepta quien firma. Se guarda tal cual en el registro. */
const CONSENTIMIENTO =
  'Leí el documento completo, estoy de acuerdo con su contenido y acepto firmarlo de forma electrónica. Reconozco esta firma como propia y con el mismo valor que mi firma manuscrita.';

/* -------------------------------------------------------------------- */
/* Enlace y firmante                                                      */
/* -------------------------------------------------------------------- */

interface Contexto {
  sobre: Sobre;
  firmante: Firmante;
}

/** Lee el enlace personal. id.version.sello. Si la versión cambió o el sello no coincide, no sirve. */
async function contextoDe(sb: SupabaseClient, token: unknown): Promise<Contexto | Response> {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return error('El enlace no es válido.', 404);
  const [id, versionTexto, sello] = partes;
  const version = Number(versionTexto);
  if (!UUID.test(id) || !Number.isInteger(version) || version < 1) return error('El enlace no es válido.', 404);
  if (!iguales(sello, selloEnlace(id, version))) return error('El enlace no es válido.', 404);
  const { data: f } = await sb.from('firma_firmantes').select('*').eq('id', id).maybeSingle();
  if (!f || f.version_enlace !== version) return error('Este enlace ya no funciona. Pedile a quien te lo mandó uno nuevo.', 404);
  const { data: s } = await sb.from('firma_sobres').select('*').eq('id', f.sobre_id).maybeSingle();
  if (!s) return error('El enlace no es válido.', 404);
  return { sobre: await alDia(sb, s as Sobre), firmante: f as Firmante };
}

async function firmantesDe(sb: SupabaseClient, sobreId: string): Promise<Firmante[]> {
  const { data } = await sb.from('firma_firmantes').select('*').eq('sobre_id', sobreId).order('orden').order('nombre');
  return (data ?? []) as Firmante[];
}

/** Por enlace no se pide código: el enlace lo entregó en mano quien envía. */
const sinCodigo = (sobre: Sobre) => sobre.entrega === 'enlace';

function codigoVigente(f: Firmante): boolean {
  return Boolean(f.otp_verificado_en && Date.now() - new Date(f.otp_verificado_en).getTime() < VALIDACION_VIGENCIA_MS);
}

function hashCodigo(firmanteId: string, codigo: string): string {
  return createHmac('sha256', secreto()).update(`codigo:${firmanteId}:${codigo}`).digest('hex');
}

/** Motivo por el que este firmante no puede actuar ahora, o null si puede. */
function bloqueo(sobre: Sobre, f: Firmante, todos: Firmante[]): string | null {
  if (sobre.estado === 'anulado') return 'Este envío se anuló. Ya no hace falta firmarlo.';
  if (sobre.estado === 'vencido') return 'Venció el plazo para firmar este documento.';
  if (sobre.estado === 'rechazado') return 'Una de las personas rechazó el documento, así que el envío se cerró.';
  if (sobre.estado === 'completado' || f.estado === 'firmado') return 'Ya firmaste este documento.';
  if (f.estado === 'rechazado') return 'Rechazaste este documento.';
  if (sobre.error_sellado) return 'Ya firmaron todos. Estamos armando el documento final.';
  if (!enTurno(todos, sobre.secuencial).some((x) => x.id === f.id)) {
    return sinCodigo(sobre) ? 'Todavía no es tu turno. Vas a poder firmar cuando firmen las personas anteriores.' : 'Todavía no es tu turno. Te avisamos por mail cuando firmen las personas anteriores.';
  }
  return null;
}

/* -------------------------------------------------------------------- */
/* PDF firmado                                                            */
/* -------------------------------------------------------------------- */

/** Las fuentes estándar de PDF solo traen el alfabeto latino. Lo demás se reemplaza. */
function texto(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^ -~ -ÿ]/g, '?');
}

/** Corta el texto en renglones que entran en el ancho. Parte las palabras más largas que el renglón, como los hash. */
function renglones(s: string, fuente: PDFFont, tam: number, ancho: number): string[] {
  const salida: string[] = [];
  let actual = '';
  for (const palabra of texto(s).split(' ')) {
    let p = palabra;
    while (fuente.widthOfTextAtSize(p, tam) > ancho) {
      let corte = p.length - 1;
      while (corte > 1 && fuente.widthOfTextAtSize(p.slice(0, corte), tam) > ancho) corte--;
      if (actual) {
        salida.push(actual);
        actual = '';
      }
      salida.push(p.slice(0, corte));
      p = p.slice(corte);
    }
    const prueba = actual ? `${actual} ${p}` : p;
    if (fuente.widthOfTextAtSize(prueba, tam) <= ancho) actual = prueba;
    else {
      if (actual) salida.push(actual);
      actual = p;
    }
  }
  if (actual) salida.push(actual);
  return salida.length ? salida : [''];
}

const ROTULO_EVENTO: Record<string, string> = {
  sobre_creado: 'Envío creado',
  documento_cargado: 'Documento cargado',
  invitacion_enviada: 'Invitación enviada por mail',
  recordatorio_enviado: 'Recordatorio enviado por mail',
  error_mail: 'No salió un mail',
  email_corregido: 'Se corrigió el mail del firmante',
  documento_abierto: 'Abrió el documento',
  codigo_enviado: 'Código enviado por mail',
  codigo_validado: 'Validó el código del mail',
  codigo_fallido: 'Código incorrecto',
  firma_registrada: 'Firmó',
  firma_rechazada: 'Rechazó el documento',
  sobre_rechazado: 'Envío cerrado por rechazo',
  sobre_vencido: 'Venció el plazo',
  sobre_anulado: 'Envío anulado',
  documento_descargado: 'Descargó el documento',
  sellado_fallido: 'Falló el armado del PDF firmado',
  documento_sellado: 'PDF firmado generado',
  sobre_completado: 'Envío completado',
  crm_no_actualizado: 'No se pudo marcar el cliente como firmado en el CRM',
  bfa_enviado: 'Hash enviado a la Blockchain Federal Argentina',
  bfa_registrado: 'Hash registrado en la Blockchain Federal Argentina',
};

interface Evento {
  id: number;
  firmante_id: string | null;
  actor_id: string | null;
  tipo: string;
  ip: string | null;
  user_agent: string | null;
  detalle: Record<string, unknown>;
  creado_en: string;
  hash: string;
}

const A4: [number, number] = [595.28, 841.89];
const MARGEN = 56;
const TINTA = rgb(0.106, 0.122, 0.106);
const PIEDRA = rgb(0.42, 0.396, 0.325);
const BOSQUE = rgb(0.09, 0.227, 0.184);
const LINEA = rgb(0.8, 0.79, 0.75);

/** Escritura de arriba hacia abajo que agrega páginas solas cuando se llena la actual. */
class Hoja {
  pagina!: PDFPage;
  y = 0;
  numero = 0;
  constructor(
    private doc: PDFDocument,
    private normal: PDFFont,
    private negrita: PDFFont,
    private codigo: string,
  ) {
    this.nueva();
  }

  get ancho(): number {
    return A4[0] - MARGEN * 2;
  }

  nueva(): void {
    this.pagina = this.doc.addPage(A4);
    this.numero++;
    this.y = A4[1] - MARGEN;
    this.pagina.drawText('FIRMA · CONSTANCIA DE FIRMA ELECTRÓNICA', { x: MARGEN, y: A4[1] - 34, size: 7.5, font: this.negrita, color: PIEDRA });
    const derecha = texto(`Código ${this.codigo} · Hoja ${this.numero}`);
    this.pagina.drawText(derecha, { x: A4[0] - MARGEN - this.normal.widthOfTextAtSize(derecha, 7.5), y: A4[1] - 34, size: 7.5, font: this.normal, color: PIEDRA });
    this.pagina.drawLine({ start: { x: MARGEN, y: A4[1] - 42 }, end: { x: A4[0] - MARGEN, y: A4[1] - 42 }, thickness: 0.5, color: LINEA });
  }

  lugar(alto: number): void {
    if (this.y - alto < MARGEN) this.nueva();
  }

  parrafo(s: string, o: { tam?: number; negrita?: boolean; color?: ReturnType<typeof rgb>; x?: number; ancho?: number; interlineado?: number; despues?: number } = {}): void {
    const tam = o.tam ?? 9.5;
    const fuente = o.negrita ? this.negrita : this.normal;
    const alto = tam * (o.interlineado ?? 1.4);
    for (const r of renglones(s, fuente, tam, o.ancho ?? this.ancho)) {
      this.lugar(alto);
      this.y -= alto;
      this.pagina.drawText(r, { x: MARGEN + (o.x ?? 0), y: this.y, size: tam, font: fuente, color: o.color ?? TINTA });
    }
    this.y -= o.despues ?? 0;
  }

  /** Rótulo chico a la izquierda y valor a la derecha. */
  dato(rotulo: string, valor: string): void {
    const col = 132;
    const lineas = renglones(valor, this.normal, 9.5, this.ancho - col);
    const alto = 9.5 * 1.4;
    this.lugar(alto * lineas.length);
    this.pagina.drawText(texto(rotulo.toUpperCase()), { x: MARGEN, y: this.y - alto + 1, size: 7, font: this.negrita, color: PIEDRA });
    for (const l of lineas) {
      this.y -= alto;
      this.pagina.drawText(l, { x: MARGEN + col, y: this.y, size: 9.5, font: this.normal, color: TINTA });
    }
    this.y -= 3;
  }

  raya(espacio = 12): void {
    this.lugar(espacio * 2);
    this.y -= espacio;
    this.pagina.drawLine({ start: { x: MARGEN, y: this.y }, end: { x: A4[0] - MARGEN, y: this.y }, thickness: 0.5, color: LINEA });
    this.y -= espacio;
  }
}

/** Arma el PDF firmado. El original queda intacto adentro y se le suma la constancia al final. */
async function armarFinal(sb: SupabaseClient, sobre: Sobre, firmantes: Firmante[]): Promise<Uint8Array> {
  const { data: blob, error: e } = await sb.storage.from(BUCKET).download(sobre.original_ruta);
  if (e || !blob) throw new Error('No se pudo leer el PDF original.');
  const original = new Uint8Array(await blob.arrayBuffer());
  if (sha256(original) !== sobre.original_sha256) throw new Error('El PDF original no coincide con su hash. No se arma el documento firmado.');

  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const verificar = `${basePortal()}/verificar/${sobre.codigo}`;
  const emisor = await nombreEmisor(sb, sobre);

  // Pie en cada hoja del original, para que cualquier copia impresa lleve el código.
  const pie = texto(`Firmado electrónicamente con FIRMA · Código ${sobre.codigo} · Verificalo en ${verificar.replace(/^https?:\/\//, '')}`);
  // Si la hoja está girada, el pie va contra el borde que se ve abajo.
  for (const p of doc.getPages()) {
    const { width, height } = p.getSize();
    const giro = ((p.getRotation().angle % 360) + 360) % 360;
    const visible = giro === 90 || giro === 270 ? height : width;
    const tam = Math.min(6.5, (visible - 24) / Math.max(1, normal.widthOfTextAtSize(pie, 1)));
    const largo = normal.widthOfTextAtSize(pie, tam);
    const lugar =
      giro === 90
        ? { x: width - 10, y: (height - largo) / 2 }
        : giro === 180
          ? { x: (width + largo) / 2, y: height - 10 }
          : giro === 270
            ? { x: 10, y: (height + largo) / 2 }
            : { x: (width - largo) / 2, y: 10 };
    p.drawText(pie, { ...lugar, rotate: degrees(giro), size: tam, font: normal, color: PIEDRA });
  }

  const { data: filas } = await sb.from('firma_eventos').select('*').eq('sobre_id', sobre.id).order('id');
  const eventos = (filas ?? []) as Evento[];
  const nombres = new Map(firmantes.map((f) => [f.id, f.nombre]));

  const h = new Hoja(doc, normal, negrita, sobre.codigo);
  h.parrafo('Constancia de firma electrónica', { tam: 20, negrita: true, interlineado: 1.2, despues: 6 });
  const identidad = sinCodigo(sobre)
    ? 'Cada una entró con un enlace personal que le entregó directamente quien envió el documento, sin código por mail.'
    : 'Cada una entró con un enlace personal y confirmó su identidad con un código de un solo uso enviado a su mail.';
  h.parrafo(
    `Este documento fue firmado de forma electrónica por las personas que se detallan abajo. ${identidad} Las hojas anteriores son el documento original, sin cambios en su contenido.`,
    { color: PIEDRA, despues: 10 },
  );

  h.dato('Documento', sobre.titulo);
  h.dato('Archivo original', `${sobre.original_nombre} · ${sobre.original_paginas} ${sobre.original_paginas === 1 ? 'hoja' : 'hojas'}`);
  h.dato('SHA-256 original', sobre.original_sha256);
  h.dato('Enviado por', emisor);
  h.dato('Código', sobre.codigo);
  h.dato('Creado', fechaHora(sobre.creado_en));
  h.dato('Completado', fechaHora(new Date().toISOString()));
  h.dato('Orden de firma', sobre.secuencial ? 'Uno después del otro' : 'Todos a la vez');
  h.dato('Entrega', sinCodigo(sobre) ? 'Enlace compartido por quien envió, sin código por mail' : 'Invitación y código por mail');
  h.dato('Verificación', verificar);

  h.raya(14);
  h.parrafo('Firmantes', { tam: 13, negrita: true, despues: 6 });

  for (const f of firmantes) {
    const validacion = eventos.find((ev) => ev.firmante_id === f.id && ev.tipo === 'codigo_validado');
    const firma = eventos.find((ev) => ev.firmante_id === f.id && ev.tipo === 'firma_registrada');
    h.lugar(170);
    h.parrafo(f.nombre, { tam: 11, negrita: true, color: BOSQUE, despues: 2 });

    // La firma a la derecha, en un recuadro.
    if (f.firma_ruta) {
      const { data: img } = await sb.storage.from(BUCKET).download(f.firma_ruta);
      if (img) {
        const bytes = new Uint8Array(await img.arrayBuffer());
        if (f.firma_sha256 && sha256(bytes) !== f.firma_sha256) throw new Error(`La imagen de la firma de ${f.nombre} no coincide con su hash.`);
        const png = await doc.embedPng(bytes);
        const caja = { w: 170, h: 62 };
        const escala = Math.min(caja.w / png.width, caja.h / png.height);
        const x = A4[0] - MARGEN - caja.w;
        const yCaja = h.y - caja.h - 4;
        h.pagina.drawRectangle({ x: x - 6, y: yCaja - 6, width: caja.w + 12, height: caja.h + 12, borderColor: LINEA, borderWidth: 0.5 });
        h.pagina.drawImage(png, { x: x + (caja.w - png.width * escala) / 2, y: yCaja + (caja.h - png.height * escala) / 2, width: png.width * escala, height: png.height * escala });
      }
    }

    const angosto = h.ancho - 200;
    const linea = (r: string, v: string) => h.parrafo(`${r}: ${v}`, { tam: 8.5, ancho: angosto, color: TINTA });
    linea('Mail', f.email);
    if (f.documento) linea('Documento de identidad', f.documento);
    linea('Firmó', fechaHora(f.firmado_en));
    linea('Tipo de firma', f.firma_tipo === 'escrita' ? 'Nombre escrito' : 'Firma dibujada');
    linea(
      'Identidad',
      validacion ? `Código por mail validado el ${fechaHora(validacion.creado_en)}` : sinCodigo(sobre) ? 'Enlace personal compartido por quien envió' : 'Código por mail',
    );
    linea('IP', f.ip || 'Sin dato');
    linea('Dispositivo', (f.user_agent || 'Sin dato').slice(0, 160));
    if (f.firma_sha256) linea('SHA-256 de la firma', f.firma_sha256);
    if (firma) linea('Aceptó', String((firma.detalle as { consentimiento?: string }).consentimiento || CONSENTIMIENTO));
    h.y -= 6;
    h.raya(8);
  }

  h.parrafo('Registro de eventos', { tam: 13, negrita: true, despues: 4 });
  h.parrafo('Cada evento guarda el hash del anterior. Si alguien cambia o borra uno, la cadena deja de cerrar y la verificación lo marca.', { tam: 8.5, color: PIEDRA, despues: 6 });
  for (const ev of eventos) {
    const quien = ev.firmante_id ? nombres.get(ev.firmante_id) || '' : ev.actor_id ? emisor : 'Sistema';
    const linea = `${fechaHora(ev.creado_en).replace(' (hora de Buenos Aires)', '')} · ${ROTULO_EVENTO[ev.tipo] || ev.tipo}${quien ? ` · ${quien}` : ''}${ev.ip ? ` · IP ${ev.ip}` : ''}`;
    h.parrafo(linea, { tam: 8, interlineado: 1.45 });
  }
  const ultimo = eventos[eventos.length - 1];
  if (ultimo) {
    h.y -= 6;
    h.parrafo(`Hash del último evento: ${ultimo.hash}`, { tam: 7.5, color: PIEDRA });
  }
  h.y -= 4;
  h.parrafo(`Horarios en hora de Buenos Aires. Para comprobar que este PDF es el mismo que quedó registrado, subilo en ${verificar}.`, { tam: 7.5, color: PIEDRA });

  doc.setTitle(texto(sobre.titulo));
  doc.setSubject(texto(`Documento firmado electrónicamente. Código ${sobre.codigo}`));
  doc.setKeywords(['FIRMA', 'firma electrónica', sobre.codigo]);
  doc.setProducer('FIRMA · Firma electrónica');
  doc.setCreator('FIRMA · firmasvc.com');
  doc.setModificationDate(new Date());
  return doc.save();
}

/**
 * Cierra el envío cuando firmaron todos. Si algo falla queda error_sellado
 * y el envío sigue en curso hasta que el reintento lo arme.
 */
async function sellar(sb: SupabaseClient, sobreId: string): Promise<string | null> {
  const { data: s } = await sb.from('firma_sobres').select('*').eq('id', sobreId).maybeSingle();
  if (!s || s.estado !== 'en_curso') return null;
  const sobre = s as Sobre;
  const firmantes = await firmantesDe(sb, sobre.id);
  if (firmantes.length === 0 || firmantes.some((f) => f.estado !== 'firmado')) return null;

  // Marca antes de empezar. Así no vence mientras se arma.
  await sb.from('firma_sobres').update({ error_sellado: 'Armando el PDF firmado' }).eq('id', sobre.id);
  let final: Uint8Array;
  try {
    final = await armarFinal(sb, sobre, firmantes);
  } catch (e) {
    const motivo = ((e as Error).message || 'Error al armar el PDF').slice(0, 300);
    await sb.from('firma_sobres').update({ error_sellado: motivo }).eq('id', sobre.id);
    await evento(sb, sobre.id, null, null, 'sellado_fallido', null, { motivo });
    return motivo;
  }

  const hash = sha256(final);
  const ruta = `${sobre.id}/final.pdf`;
  const { error: errSubir } = await sb.storage.from(BUCKET).upload(ruta, final, { contentType: 'application/pdf', upsert: true });
  if (errSubir) {
    const motivo = `No se pudo guardar el PDF firmado. ${errSubir.message}`.slice(0, 300);
    await sb.from('firma_sobres').update({ error_sellado: motivo }).eq('id', sobre.id);
    await evento(sb, sobre.id, null, null, 'sellado_fallido', null, { motivo });
    return motivo;
  }
  await evento(sb, sobre.id, null, null, 'documento_sellado', null, { sha256: hash, bytes: final.length });
  const ahora = new Date().toISOString();
  const { data: cerrado } = await sb
    .from('firma_sobres')
    .update({ estado: 'completado', completado_en: ahora, final_ruta: ruta, final_sha256: hash, error_sellado: null })
    .eq('id', sobre.id)
    .eq('estado', 'en_curso')
    .select('*')
    .maybeSingle();
  if (!cerrado) return null;
  await evento(sb, sobre.id, null, null, 'sobre_completado', null, { final_sha256: hash });

  // Si BFA falla no frena el cierre. La tarea diaria lo reintenta.
  await enviarABfa(sb, { id: sobre.id, final_sha256: hash });

  // Si vino del CRM, el cliente pasa solo a Firmado y queda el enlace al envío.
  if (sobre.crm_cliente_id) {
    const { error: errCrm } = await sb
      .from('crm_clientes')
      .update({ estado_firma: 'Firmado', link_contrato_servicio: `${basePortal()}/portal/firmas/${sobre.id}` })
      .eq('id', sobre.crm_cliente_id)
      .neq('estado_firma', 'Baja');
    if (errCrm) await evento(sb, sobre.id, null, null, 'crm_no_actualizado', null, { motivo: errCrm.message.slice(0, 200) });
  }

  // Copia para todos los firmantes y para quien lo mandó.
  const emisor = await nombreEmisor(sb, sobre);
  const creador = await mailDelCreador(sb, sobre);
  const para = [...new Set([...firmantes.map((f) => f.email), ...(creador ? [creador] : [])])];
  const nombre = `${sobre.original_nombre.replace(/\.pdf$/i, '')} (firmado).pdf`;
  const adjunta = final.length <= ADJUNTO_MAX_BYTES;
  for (const destino of para) {
    const fallo = await enviarMail({
      nombreRemitente: emisor === 'FIRMA' ? 'FIRMA' : `${emisor} vía FIRMA`,
      para: [destino],
      asunto: `Firmado. ${sobre.titulo}`,
      html: plantillaMail({
        seccion: 'Firma electrónica',
        titulo: 'El documento quedó firmado por todos',
        parrafos: [
          `<strong>${escapar(sobre.titulo)}</strong> ya tiene todas las firmas.`,
          adjunta
            ? 'Te adjuntamos el PDF firmado, con la constancia de firma al final. Guardalo junto con tus documentos.'
            : 'El PDF firmado es muy pesado para mandarlo por mail. Pedíselo a quien te lo envió.',
          `Código de verificación <strong>${escapar(sobre.codigo)}</strong>.`,
        ],
        boton: { texto: 'Verificar el documento', url: `${basePortal()}/verificar/${sobre.codigo}` },
      }),
      responderA: creador,
      adjuntos: adjunta ? [{ filename: nombre, content: Buffer.from(final).toString('base64') }] : undefined,
    });
    if (fallo) await evento(sb, sobre.id, null, null, 'error_mail', null, { para: destino, motivo: fallo.slice(0, 200) });
  }
  return null;
}

/* -------------------------------------------------------------------- */
/* Sello de tiempo en la Blockchain Federal Argentina                     */
/* -------------------------------------------------------------------- */

const BFA_API = 'https://tsaapi.bfa.ar/api/tsa';

async function pedirBfa(ruta: 'stamp' | 'verify', cuerpo: Record<string, string>, espera = 10_000): Promise<Record<string, unknown>> {
  const r = await fetch(`${BFA_API}/${ruta}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(espera),
  });
  const datos = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!datos) throw new Error(`BFA respondió ${r.status} sin datos.`);
  return datos;
}

/**
 * Manda el hash del PDF firmado al sello de tiempo de BFA. Solo viaja el hash.
 * BFA devuelve un recibo y lo sube a un bloque unos minutos después. Si falla,
 * la tarea diaria lo reintenta. Devuelve el motivo si falló.
 */
async function enviarABfa(sb: SupabaseClient, sobre: Pick<Sobre, 'id' | 'final_sha256'>): Promise<string | null> {
  if (!sobre.final_sha256) return null;
  try {
    const r = await pedirBfa('stamp', { file_hash: sobre.final_sha256 });
    const recibo = typeof r.temporary_rd === 'string' ? r.temporary_rd : null;
    if (r.status !== 'success' || !recibo) return `BFA no selló el hash. ${String(r.messages || r.detail || '')}`.trim().slice(0, 300);
    const { error: e } = await sb.from('firma_sobres').update({ bfa_recibo: recibo }).eq('id', sobre.id).is('bfa_recibo', null);
    if (e) return `No se pudo guardar el recibo de BFA. ${e.message}`.slice(0, 300);
    await evento(sb, sobre.id, null, null, 'bfa_enviado', null, { sha256: sobre.final_sha256 });
    return null;
  } catch (e) {
    return `BFA no respondió. ${(e as Error).message}`.slice(0, 300);
  }
}

/** Pregunta a BFA si el hash ya entró en un bloque. Si entró, guarda el número y la fecha. Devuelve el sobre al día. */
async function confirmarBfa(sb: SupabaseClient, sobre: Sobre, espera = 10_000): Promise<Sobre> {
  if (!sobre.final_sha256 || !sobre.bfa_recibo || sobre.bfa_bloque) return sobre;
  try {
    const r = await pedirBfa('verify', { file_hash: sobre.final_sha256, rd: sobre.bfa_recibo }, espera);
    if (r.status !== 'success') return sobre;
    // El bloque viene en el mensaje ("fue ingresado en el bloque 50555425 el ...") y al final del recibo permanente.
    const recibo = typeof r.permanent_rd === 'string' && r.permanent_rd ? r.permanent_rd : null;
    const delMensaje = /bloque (\d+)/.exec(String(r.messages || ''))?.[1];
    const delRecibo = recibo ? /-(\d+)$/.exec(Buffer.from(recibo, 'base64').toString('utf8'))?.[1] : undefined;
    const bloque = Number(delMensaje ?? delRecibo);
    if (!Number.isInteger(bloque) || bloque <= 0) return sobre;
    // attestation_time viene como dd/mm/aaaa hh:mm:ss en hora de Buenos Aires.
    const f = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/.exec(String(r.attestation_time || ''));
    const registrado = f ? new Date(`${f[3]}-${f[2]}-${f[1]}T${f[4]}-03:00`).toISOString() : new Date().toISOString();
    const cambios: Record<string, unknown> = { bfa_bloque: bloque, bfa_registrado_en: registrado };
    if (recibo) cambios.bfa_recibo = recibo;
    const { data } = await sb.from('firma_sobres').update(cambios).eq('id', sobre.id).is('bfa_bloque', null).select('*').maybeSingle();
    if (!data) return sobre;
    await evento(sb, sobre.id, null, null, 'bfa_registrado', null, { bloque, registrado_en: registrado });
    return data as Sobre;
  } catch {
    return sobre;
  }
}

/** Avisa a quien mandó el envío. Para rechazos. */
async function avisarCreador(sb: SupabaseClient, sobre: Sobre, asunto: string, titulo: string, parrafos: string[]): Promise<void> {
  const creador = await mailDelCreador(sb, sobre);
  if (!creador) return;
  await enviarMail({
    nombreRemitente: 'FIRMA',
    para: [creador],
    asunto,
    html: plantillaMail({ seccion: 'Firma electrónica', titulo, parrafos, boton: { texto: 'Ver el envío', url: `${basePortal()}/portal/firmas/${sobre.id}` } }),
  });
}

/* -------------------------------------------------------------------- */
/* Verificación pública                                                   */
/* -------------------------------------------------------------------- */

async function verificar(sb: SupabaseClient, cuerpo: Record<string, unknown>): Promise<Response> {
  const codigo = String(cuerpo.codigo || '').trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  const hash = String(cuerpo.sha256 || '').trim().toLowerCase();
  if (!codigo && !hash) return error('Ingresá el código o subí el PDF.');
  if (hash && !/^[0-9a-f]{64}$/.test(hash)) return error('Hash inválido.');
  if (codigo && codigo.length !== 12) return error('El código tiene 12 caracteres. Está en el pie de cada hoja del documento firmado.');

  let fila: Sobre | null = null;
  if (codigo) {
    const { data } = await sb.from('firma_sobres').select('*').eq('codigo', codigo).maybeSingle();
    fila = (data as Sobre) ?? null;
  } else {
    const { data } = await sb.from('firma_sobres').select('*').or(`final_sha256.eq.${hash},original_sha256.eq.${hash}`).order('creado_en', { ascending: false }).limit(1);
    fila = ((data ?? [])[0] as Sobre) ?? null;
  }
  if (!fila) return json({ ok: true, encontrado: false });
  // La página pública no espera mucho a BFA. Si tarda, el bloque se muestra en la próxima consulta.
  const sobre = await confirmarBfa(sb, await alDia(sb, fila), 4_000);
  const firmantes = await firmantesDe(sb, sobre.id);
  const { data: cadena } = await sb.rpc('firma_verificar_cadena', { p_sobre: sobre.id });
  const coincide = !hash ? null : hash === sobre.final_sha256 ? 'final' : hash === sobre.original_sha256 ? 'original' : 'ninguno';
  return json({
    ok: true,
    encontrado: true,
    coincide,
    cadena_integra: cadena === true,
    sobre: {
      codigo: sobre.codigo,
      titulo: sobre.titulo,
      emisor: await nombreEmisor(sb, sobre),
      estado: sobre.estado,
      creado_en: sobre.creado_en,
      completado_en: sobre.completado_en,
      cerrado_en: sobre.cerrado_en,
      original_sha256: sobre.original_sha256,
      final_sha256: sobre.final_sha256,
      paginas: sobre.original_paginas,
    },
    bfa: sobre.bfa_recibo ? { bloque: sobre.bfa_bloque ?? null, registrado_en: sobre.bfa_registrado_en ?? null, recibo: sobre.bfa_recibo } : null,
    firmantes: firmantes.map((f) => ({ nombre: f.nombre, email: enmascarar(f.email), estado: f.estado, firmado_en: f.firmado_en, rechazado_en: f.rechazado_en })),
  });
}

/* -------------------------------------------------------------------- */
/* Tarea diaria                                                           */
/* -------------------------------------------------------------------- */

export async function GET(request: Request): Promise<Response> {
  const clave = process.env.CRON_SECRET;
  if (!clave || !iguales(request.headers.get('authorization') || '', `Bearer ${clave}`)) return error('No autorizado.', 401);
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);
  if (!process.env.FIRMA_CLAVE_FIRMAS) return error('El servidor no tiene configurada FIRMA_CLAVE_FIRMAS.', 500);

  const resumen = { vencidos: 0, recordatorios: 0, sellados: 0, bfa_enviados: 0, bfa_registrados: 0, errores: [] as string[] };
  const { data } = await sb.from('firma_sobres').select('*').eq('estado', 'en_curso').limit(500);
  for (const fila of (data ?? []) as Sobre[]) {
    try {
      if (fila.error_sellado) {
        const fallo = await sellar(sb, fila.id);
        if (fallo) resumen.errores.push(`${fila.codigo}: ${fallo}`);
        else resumen.sellados++;
        continue;
      }
      const sobre = await alDia(sb, fila);
      if (sobre.estado === 'vencido') {
        resumen.vencidos++;
        continue;
      }
      if (!mailDisponible() || sinCodigo(sobre)) continue;
      const todos = await firmantesDe(sb, sobre.id);
      for (const f of enTurno(todos, sobre.secuencial)) {
        const ultimo = f.ultimo_recordatorio || f.notificado_en;
        if (!ultimo || Date.now() - new Date(ultimo).getTime() < RECORDATORIO_CADA_MS) continue;
        const fallo = await notificarFirmante(sb, sobre, f, null, null, true);
        if (fallo) resumen.errores.push(`${sobre.codigo} ${f.email}: ${fallo}`);
        else resumen.recordatorios++;
      }
    } catch (e) {
      resumen.errores.push(`${fila.codigo}: ${(e as Error).message}`);
    }
  }

  // Completados que todavía no tienen su bloque en BFA. Sin la migración 0031 la consulta falla y no hay nada.
  const { data: sinBloque } = await sb.from('firma_sobres').select('*').eq('estado', 'completado').is('bfa_bloque', null).not('final_sha256', 'is', null).limit(200);
  for (const fila of (sinBloque ?? []) as Sobre[]) {
    if (!fila.bfa_recibo) {
      const fallo = await enviarABfa(sb, fila);
      if (fallo) resumen.errores.push(`${fila.codigo}: ${fallo}`);
      else resumen.bfa_enviados++;
    } else if ((await confirmarBfa(sb, fila)).bfa_bloque) resumen.bfa_registrados++;
  }
  return json({ ok: true, ...resumen });
}

/* -------------------------------------------------------------------- */
/* Acciones                                                               */
/* -------------------------------------------------------------------- */

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);
  if (!process.env.FIRMA_CLAVE_FIRMAS) return error('El servidor no tiene configurada FIRMA_CLAVE_FIRMAS.', 500);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error('Pedido mal formado.');
  }
  const accion = String(cuerpo.accion || '');

  try {
    if (accion === 'verificar') return await verificar(sb, cuerpo);

    if (accion === 'resellar') {
      const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: u } = token ? await sb.auth.getUser(token) : { data: null };
      if (!u?.user) return error('Sesión requerida.', 401);
      const { data: p } = await sb.from('perfiles').select('rol, activo').eq('id', u.user.id).maybeSingle();
      if (!p?.activo || p.rol !== 'admin') return error('Solo FIRMA puede reintentar el armado.', 403);
      const sobreId = String(cuerpo.sobre_id || '');
      if (!UUID.test(sobreId)) return error('Envío inválido.');
      const fallo = await sellar(sb, sobreId);
      if (fallo) return error(fallo, 500);
      return json({ ok: true });
    }

    const ctx = await contextoDe(sb, cuerpo.token);
    if (ctx instanceof Response) return ctx;
    const { sobre } = ctx;
    let f = ctx.firmante;
    const todos = await firmantesDe(sb, sobre.id);

    /* -------------------------------------------------------------- */
    /* Ver el envío                                                    */
    /* -------------------------------------------------------------- */
    if (accion === 'ver') {
      const motivo = bloqueo(sobre, f, todos);
      if (!motivo && (f.estado === 'pendiente' || f.estado === 'notificado')) {
        const { data: visto } = await sb
          .from('firma_firmantes')
          .update({ estado: 'visto', visto_en: new Date().toISOString() })
          .eq('id', f.id)
          .in('estado', ['pendiente', 'notificado'])
          .select('*')
          .maybeSingle();
        if (visto) {
          f = visto as Firmante;
          await evento(sb, sobre.id, f.id, null, 'documento_abierto', request);
        }
      }
      // El PDF se muestra mientras se puede firmar o, al final, el firmado.
      let pdf: string | null = null;
      const ruta = sobre.estado === 'completado' ? sobre.final_ruta : motivo && f.estado !== 'firmado' ? null : sobre.original_ruta;
      if (ruta) {
        const { data } = await sb.storage.from(BUCKET).createSignedUrl(ruta, 15 * 60);
        pdf = data?.signedUrl ?? null;
      }
      return json({
        ok: true,
        bloqueo: motivo,
        sobre: {
          titulo: sobre.titulo,
          mensaje: sobre.mensaje,
          emisor: await nombreEmisor(sb, sobre),
          codigo: sobre.codigo,
          estado: sobre.estado,
          vence_en: sobre.vence_en,
          paginas: sobre.original_paginas,
          nombre_archivo: sobre.estado === 'completado' ? `${sobre.original_nombre.replace(/\.pdf$/i, '')} (firmado).pdf` : sobre.original_nombre,
          sha256: sobre.estado === 'completado' ? sobre.final_sha256 : sobre.original_sha256,
          secuencial: sobre.secuencial,
        },
        firmante: {
          nombre: f.nombre,
          email: enmascarar(f.email),
          estado: f.estado,
          pedir_documento: f.pedir_documento,
          validado: sinCodigo(sobre) || codigoVigente(f),
          firmado_en: f.firmado_en,
        },
        otros: todos.filter((x) => x.id !== f.id).map((x) => ({ nombre: x.nombre, estado: x.estado, orden: x.orden })),
        pdf,
        consentimiento: CONSENTIMIENTO,
        mail: mailDisponible(),
        sin_codigo: sinCodigo(sobre),
      });
    }

    const motivo = bloqueo(sobre, f, todos);
    if (motivo) return error(motivo, 409);

    /* -------------------------------------------------------------- */
    /* Código por mail                                                 */
    /* -------------------------------------------------------------- */
    if ((accion === 'codigo' || accion === 'validar') && sinCodigo(sobre)) return error('Para este documento no hace falta código. Firmá directamente.');

    if (accion === 'codigo') {
      if (!mailDisponible()) return error('El envío de mails no está configurado. Avisale a quien te mandó el documento.', 503);
      if (f.otp_ultimo_envio && Date.now() - new Date(f.otp_ultimo_envio).getTime() < CODIGO_ESPERA_MS) {
        return error('Te mandamos un código hace menos de un minuto. Revisá tu mail, también en spam.', 429);
      }
      if (f.otp_enviados >= CODIGO_MAX_ENVIOS) return error('Pediste demasiados códigos. Avisale a quien te mandó el documento para que te reenvíe el enlace.', 429);
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const ahora = new Date();
      const { error: e } = await sb
        .from('firma_firmantes')
        .update({
          otp_hash: hashCodigo(f.id, codigo),
          otp_vence: new Date(ahora.getTime() + CODIGO_VIGENCIA_MS).toISOString(),
          otp_intentos: 0,
          otp_enviados: f.otp_enviados + 1,
          otp_ultimo_envio: ahora.toISOString(),
        })
        .eq('id', f.id);
      if (e) return error('No pudimos generar el código. Probá de nuevo.', 500);
      const fallo = await enviarMail({
        nombreRemitente: 'FIRMA',
        para: [f.email],
        asunto: `${codigo} es tu código para firmar`,
        html: plantillaMail({
          seccion: 'Firma electrónica',
          titulo: 'Tu código para firmar',
          parrafos: [
            `Hola ${escapar(f.nombre)}. Usá este código para firmar <strong>${escapar(sobre.titulo)}</strong>.`,
            `<span style="font-family:Georgia,serif;font-size:34px;letter-spacing:.3em;color:#173A2F">${codigo}</span>`,
            'Vence en 10 minutos y sirve una sola vez.',
          ],
          pie: 'Si no estás firmando un documento ahora, ignorá este mail. Nadie de FIRMA te va a pedir este código.',
        }),
      });
      if (fallo) {
        await evento(sb, sobre.id, f.id, null, 'error_mail', request, { para: f.email, motivo: fallo.slice(0, 200) });
        return error('No pudimos mandarte el código. Probá de nuevo en un rato.', 502);
      }
      await evento(sb, sobre.id, f.id, null, 'codigo_enviado', request, { para: f.email });
      return json({ ok: true, email: enmascarar(f.email) });
    }

    if (accion === 'validar') {
      const codigo = String(cuerpo.codigo || '').replace(/\D/g, '');
      if (codigo.length !== 6) return error('El código tiene 6 números.');
      if (!f.otp_hash || !f.otp_vence) return error('Pedí un código primero.');
      if (new Date(f.otp_vence).getTime() < Date.now()) return error('El código venció. Pedí uno nuevo.');
      if (f.otp_intentos >= CODIGO_MAX_INTENTOS) return error('Probaste demasiadas veces. Pedí un código nuevo.', 429);
      if (!iguales(hashCodigo(f.id, codigo), f.otp_hash)) {
        await sb.from('firma_firmantes').update({ otp_intentos: f.otp_intentos + 1 }).eq('id', f.id);
        await evento(sb, sobre.id, f.id, null, 'codigo_fallido', request, { intento: f.otp_intentos + 1 });
        const quedan = CODIGO_MAX_INTENTOS - f.otp_intentos - 1;
        return error(quedan > 0 ? `El código no es correcto. Te ${quedan === 1 ? 'queda 1 intento' : `quedan ${quedan} intentos`}.` : 'El código no es correcto. Pedí uno nuevo.');
      }
      await sb.from('firma_firmantes').update({ otp_hash: null, otp_vence: null, otp_intentos: 0, otp_verificado_en: new Date().toISOString() }).eq('id', f.id);
      await evento(sb, sobre.id, f.id, null, 'codigo_validado', request, { para: f.email });
      return json({ ok: true });
    }

    /* -------------------------------------------------------------- */
    /* Firmar                                                          */
    /* -------------------------------------------------------------- */
    if (accion === 'firmar') {
      if (!sinCodigo(sobre) && !codigoVigente(f)) return error('Validá de nuevo el código del mail para firmar.', 403);
      if (cuerpo.acepto !== true) return error('Tenés que aceptar para firmar.');
      const tipo = cuerpo.tipo === 'escrita' ? 'escrita' : 'dibujada';
      const documento = String(cuerpo.documento || '').replace(/\s+/g, ' ').trim().slice(0, 40) || null;
      if (f.pedir_documento && (!documento || documento.replace(/\D/g, '').length < 6)) return error('Completá tu número de documento.');

      const base64 = String(cuerpo.imagen || '').replace(/^data:image\/png;base64,/, '');
      const imagen = Buffer.from(base64, 'base64');
      if (imagen.length < 100 || imagen.length > FIRMA_MAX_BYTES) return error('No pudimos leer tu firma. Probá de nuevo.');
      if (imagen.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return error('La firma tiene que ser una imagen PNG.');
      const hashFirma = sha256(imagen);
      const rutaFirma = `${sobre.id}/firmas/${f.id}-${randomUUID()}.png`;
      const { error: errSubir } = await sb.storage.from(BUCKET).upload(rutaFirma, imagen, { contentType: 'image/png', upsert: false });
      if (errSubir) return error('No pudimos guardar tu firma. Probá de nuevo.', 500);

      const ahora = new Date().toISOString();
      const { data: firmado } = await sb
        .from('firma_firmantes')
        .update({
          estado: 'firmado',
          firmado_en: ahora,
          documento,
          firma_ruta: rutaFirma,
          firma_tipo: tipo,
          firma_sha256: hashFirma,
          ip: ipDe(request),
          user_agent: agenteDe(request),
          otp_verificado_en: null,
        })
        .eq('id', f.id)
        .in('estado', ['pendiente', 'notificado', 'visto'])
        .select('*')
        .maybeSingle();
      if (!firmado) {
        await sb.storage.from(BUCKET).remove([rutaFirma]);
        return error('Ya registramos una respuesta tuya para este documento.', 409);
      }
      await evento(sb, sobre.id, f.id, null, 'firma_registrada', request, {
        tipo,
        documento,
        firma_sha256: hashFirma,
        original_sha256: sobre.original_sha256,
        consentimiento: CONSENTIMIENTO,
        identidad: sinCodigo(sobre) ? 'enlace' : 'codigo_mail',
      });

      const despues = await firmantesDe(sb, sobre.id);
      if (despues.every((x) => x.estado === 'firmado')) {
        await sellar(sb, sobre.id);
      } else if (sobre.secuencial && !sinCodigo(sobre)) {
        // Le toca al grupo siguiente. Se avisa a los que todavía no recibieron nada.
        for (const sig of enTurno(despues, true)) {
          if (sig.estado === 'pendiente') await notificarFirmante(sb, sobre, sig, null, null);
        }
      }
      return json({ ok: true });
    }

    /* -------------------------------------------------------------- */
    /* Rechazar                                                        */
    /* -------------------------------------------------------------- */
    if (accion === 'rechazar') {
      const motivoRechazo = String(cuerpo.motivo || '').trim().slice(0, 1000);
      if (motivoRechazo.length < 3) return error('Contanos brevemente por qué no lo firmás.');
      const ahora = new Date().toISOString();
      const { data: rechazado } = await sb
        .from('firma_firmantes')
        .update({ estado: 'rechazado', rechazado_en: ahora, motivo_rechazo: motivoRechazo, ip: ipDe(request), user_agent: agenteDe(request) })
        .eq('id', f.id)
        .in('estado', ['pendiente', 'notificado', 'visto'])
        .select('id')
        .maybeSingle();
      if (!rechazado) return error('Ya registramos una respuesta tuya para este documento.', 409);
      await evento(sb, sobre.id, f.id, null, 'firma_rechazada', request, { motivo: motivoRechazo });
      const { data: cerrado } = await sb
        .from('firma_sobres')
        .update({ estado: 'rechazado', cerrado_en: ahora, motivo_cierre: `${f.nombre} lo rechazó. ${motivoRechazo}`.slice(0, 1000) })
        .eq('id', sobre.id)
        .eq('estado', 'en_curso')
        .select('id')
        .maybeSingle();
      if (cerrado) {
        await evento(sb, sobre.id, null, null, 'sobre_rechazado', null, { por: f.nombre });
        await avisarCreador(sb, sobre, `Rechazado. ${sobre.titulo}`, 'Una persona rechazó el documento', [
          `<strong>${escapar(f.nombre)}</strong> (${escapar(f.email)}) rechazó <strong>${escapar(sobre.titulo)}</strong> y el envío se cerró.`,
          `Motivo. <em>${escapar(motivoRechazo)}</em>`,
          'Si hace falta, corregí el documento y mandalo de nuevo.',
        ]);
      }
      return json({ ok: true });
    }

    return error('Acción desconocida.');
  } catch (e) {
    return error((e as Error).message || 'Error inesperado.', 500);
  }
}

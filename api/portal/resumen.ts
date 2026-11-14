/**
 * Mail de los lunes y alertas de vencimientos del portal (Vercel Function).
 * Salen por Resend con la plantilla de FIRMA.
 *
 * GET /api/portal/resumen  tarea diaria de Vercel Cron con CRON_SECRET, a las 9
 *   de Buenos Aires.
 *   Alertas: asuntos que vencen en 7 días y el día anterior, envíos a firma
 *   que vencen en 3 días y abonos que terminan en 30 y en 7. Cada empresa
 *   recibe un solo mail por persona y por día con todo junto, y FIRMA uno con
 *   todas las empresas. Cada alerta sale una vez por umbral. En pago completo,
 *   7 días antes de que venza lo pagado y el día anterior, el titular recibe
 *   el aviso para autorizar el débito de la cuota posterior.
 *   Además dispara la tarea diaria de los abonos (/api/pagos/gestionar), que
 *   corre aparte con las claves de dLocal Go.
 *   Los lunes, además, el mail de la semana: la newsletter (video y artículo
 *   que carga FIRMA en Administración › Newsletter) a todos los usuarios, y al
 *   titular y al CSM también los vencimientos de la semana y un resumen de su
 *   empresa. Quien es miembro de varios negocios recibe un solo mail, con
 *   la newsletter una vez y un bloque por negocio; las alertas salen por
 *   negocio. Sale solo si FIRMA activó la newsletter de ese lunes; si no, no
 *   sale nada. Si el lunes no alcanzó el tiempo, el martes y el miércoles
 *   manda lo que faltó.
 *   ?resumen=1 lo manda aunque no sea lunes, para probar. Una vez por semana.
 * GET  /api/portal/resumen?p=<perfil>&t=<sello>  página para dejar de recibir
 *   el mail de los lunes o volver a recibirlo. Pide un clic, así un filtro de
 *   correo que abre el enlace no da de baja a nadie.
 * POST /api/portal/resumen?p=<perfil>&t=<sello>  { accion: baja | alta }
 *   El formulario de esa página y la baja en un clic de Gmail (List-Unsubscribe).
 * POST /api/portal/resumen  { accion: prueba, id }  con sesión de FIRMA.
 *   Manda la newsletter a quien la pide, para revisarla antes del lunes.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import { FALTA_SEGUNDO_FACTOR, nivelDe } from '../_lib/nivel.js';
import { genteDe } from '../_lib/acceso.js';
import { enviarMail, mailDisponible, plantillaMail } from '../_lib/mail.js';
import { COLOR } from '../_lib/marca.js';
import { enviarPush, pushDisponible } from '../_lib/push.js';

const ZONA = 'America/Argentina/Buenos_Aires';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIRMA_MAIL = 'agustin@firmasvc.com';
/** Ven asuntos y firmas: reciben las alertas y el resumen de la empresa. */
const ROLES_ASUNTOS = ['titular', 'csm', 'miembro'];
/** Reciben la newsletter: todos los usuarios de las empresas. */
const ROLES_EMPRESA = [...ROLES_ASUNTOS, 'closer', 'setter'];
/** Margen antes del máximo de 60 segundos de la función. Lo que no sale hoy sale mañana. */
const TIEMPO_MS = 48_000;
/** Resend acepta dos mails por segundo en el plan gratuito. */
const PAUSA_MS = 550;
const ENLACE = `color:${COLOR.tinta};font-weight:600;text-decoration:underline`;

const ESTADO_ASUNTO: Record<string, string> = {
  en_curso: 'En curso',
  espera_cliente: 'Esperando tu respuesta',
  espera_tercero: 'Esperando a un tercero',
  finalizado: 'Finalizado',
};

interface Persona {
  id: string;
  email: string;
  nombre: string | null;
  rol: string;
  organizacion_id: string;
  areas: string[] | null;
  resumen_semanal: boolean;
}

interface Alerta {
  organizacion_id: string;
  clave: string;
  texto: string;
  /** Abonos: solo el titular, que es quien ve Pagos. */
  soloTitular: boolean;
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

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hola = (p: { nombre: string | null }) => (p.nombre ? `Hola ${escapar(p.nombre.split(' ')[0])}.` : 'Hola.');
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/* -------------------------------------------------------------------- */
/* Fechas. Los días son de Buenos Aires y se manejan como AAAA-MM-DD.     */
/* -------------------------------------------------------------------- */

const diaDe = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d);

function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 es lunes y 6 es domingo. */
const diaDeSemana = (dia: string): number => (new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7;

function cuando(dia: string, hoy: string): string {
  if (dia === hoy) return 'hoy';
  if (dia === sumarDias(hoy, 1)) return 'mañana';
  const largo = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${dia}T12:00:00Z`));
  return `el ${largo.replace(',', '')}`;
}

/* -------------------------------------------------------------------- */
/* Envío                                                                  */
/* -------------------------------------------------------------------- */

/** Un mail a una persona, con pausa para no pasar el límite de Resend y un reintento si igual lo pasa. */
async function mandar(para: string, asunto: string, html: string, encabezados?: Record<string, string>): Promise<string | null> {
  let fallo: string | null = null;
  for (let intento = 0; intento < 2; intento++) {
    fallo = await enviarMail({
      nombreRemitente: 'FIRMA',
      direccion: process.env.PORTAL_MAIL_DIRECCION || 'portal@firmasvc.com',
      para: [para],
      asunto,
      html,
      responderA: FIRMA_MAIL,
      encabezados,
    });
    await pausa(PAUSA_MS);
    if (!fallo?.startsWith('Resend respondió 429')) return fallo;
    await pausa(1500);
  }
  return fallo;
}

/** Reserva las claves que todavía no salieron y devuelve esas. Las demás ya se avisaron. */
async function reservar(sb: SupabaseClient, claves: string[]): Promise<Set<string>> {
  if (!claves.length) return new Set();
  const { data, error: err } = await sb
    .from('avisos_programados')
    .upsert(claves.map((clave) => ({ clave })), { onConflict: 'clave', ignoreDuplicates: true })
    .select('clave');
  if (err) throw new Error(`No se pudo reservar el aviso. ¿Corriste la migración 0032? ${err.message}`);
  return new Set((data ?? []).map((f) => f.clave as string));
}

async function destinatariosFirma(sb: SupabaseClient): Promise<{ email: string; nombre: string | null }[]> {
  const { data } = await sb.from('perfiles').select('email, nombre').eq('rol', 'admin').eq('activo', true);
  return data?.length ? data : [{ email: FIRMA_MAIL, nombre: null }];
}

/* -------------------------------------------------------------------- */
/* Baja del resumen                                                       */
/* -------------------------------------------------------------------- */

function sello(perfilId: string): string | null {
  const clave = process.env.PORTAL_CLAVE_AVISOS;
  if (!clave) return null;
  return createHmac('sha256', clave).update(`resumen:${perfilId}`).digest('base64url').slice(0, 32);
}

function enlaceBaja(perfilId: string): string | null {
  const t = sello(perfilId);
  return t ? `${basePortal()}/api/portal/resumen?p=${perfilId}&t=${t}` : null;
}

function pagina(titulo: string, texto: string, formulario?: { accion: 'baja' | 'alta'; boton: string; destino: string }): Response {
  const form = formulario
    ? `<form method="post" action="${escapar(formulario.destino)}"><input type="hidden" name="accion" value="${formulario.accion}"><button type="submit">${escapar(formulario.boton)}</button></form>`
    : '';
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${escapar(titulo)} · FIRMA</title>
<style>
@font-face{font-family:'Archivo';font-style:normal;font-weight:100 900;font-stretch:62% 125%;font-display:swap;src:url(/mail/archivo.woff2) format('woff2')}
body{margin:0;background:${COLOR.marfil};color:${COLOR.tinta};font:16px/1.6 Archivo,'Helvetica Neue',Arial,sans-serif}
main{max-width:560px;margin:64px auto;border-radius:24px;overflow:hidden;background:#fff}
header{background:${COLOR.tinta};padding:28px 32px 34px}
header img{display:block;width:168px;height:auto}
p.seccion{display:inline-block;margin:28px 0 0;padding:7px 13px 6px;border-radius:999px;background:${COLOR.marfil};color:${COLOR.tinta};font-size:11px;line-height:1;font-weight:600;letter-spacing:.16em;text-transform:uppercase;font-stretch:125%}
h1{margin:16px 0 0;color:${COLOR.marfil};font-weight:800;font-size:30px;line-height:1.14;letter-spacing:-.02em}
section{padding:28px 32px 32px}
button{margin-top:8px;padding:15px 24px;border:0;border-radius:12px;background:${COLOR.tinta};color:${COLOR.marfil};font:600 15px Archivo,'Helvetica Neue',Arial,sans-serif;cursor:pointer}
button:focus-visible{outline:2px solid ${COLOR.tinta};outline-offset:2px}
a{color:${COLOR.tinta}}
@media (max-width:600px){main{margin:16px}header,section{padding-left:22px;padding-right:22px}h1{font-size:26px}}
</style></head>
<body><main><header><img src="/mail/firma-lockup-claro.png" width="168" alt="firma · Castro &amp; Partners Legal Consulting"><p class="seccion">Mail de los lunes</p><h1>${escapar(titulo)}</h1></header>
<section><p style="margin:0">${texto}</p>${form}
<p style="margin:28px 0 0;font-size:13px;color:${COLOR.piedra}"><a href="${basePortal()}/portal">Ir al portal</a></p></section></main></body></html>`;
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

/** Valida el enlace y devuelve el perfil, o la página de error. */
async function perfilDelEnlace(sb: SupabaseClient, url: URL): Promise<{ id: string; email: string; resumen_semanal: boolean } | Response> {
  const p = url.searchParams.get('p') || '';
  const t = url.searchParams.get('t') || '';
  const esperado = UUID.test(p) ? sello(p) : null;
  if (!esperado || !iguales(t, esperado)) return pagina('El enlace no es válido', 'Copiá el enlace completo del mail o escribinos a <a href="mailto:agustin@firmasvc.com">agustin@firmasvc.com</a>.');
  const { data } = await sb.from('perfiles').select('id, email, resumen_semanal').eq('id', p).maybeSingle();
  if (!data) return pagina('El enlace no es válido', 'Esa cuenta ya no existe en el portal.');
  return data;
}

function paginaEstado(perfil: { email: string; resumen_semanal: boolean }, destino: string, recien = false): Response {
  const email = `<strong>${escapar(perfil.email)}</strong>`;
  if (perfil.resumen_semanal) {
    return pagina(
      recien ? 'Listo, te va a llegar' : 'Mail de los lunes',
      recien ? `El próximo lunes ${email} vuelve a recibir las novedades de FIRMA.` : `${email} recibe los lunes las novedades de FIRMA y el resumen de la semana. Las alertas de vencimientos llegan aparte.`,
      { accion: 'baja', boton: 'Dejar de recibirlo', destino },
    );
  }
  return pagina(
    recien ? 'Listo, no te lo mandamos más' : 'No recibís el mail de los lunes',
    `${email} no recibe el mail de los lunes. Las alertas de vencimientos te siguen llegando, porque suelen tener plazos.`,
    { accion: 'alta', boton: 'Volver a recibirlo', destino },
  );
}

async function cambiarSuscripcion(sb: SupabaseClient, request: Request, url: URL): Promise<Response> {
  const perfil = await perfilDelEnlace(sb, url);
  if (perfil instanceof Response) return perfil;
  const cuerpo = new URLSearchParams(await request.text().catch(() => ''));
  // La baja en un clic de Gmail manda List-Unsubscribe=One-Click, sin accion.
  const recibir = cuerpo.get('accion') === 'alta';
  const { error: err } = await sb.from('perfiles').update({ resumen_semanal: recibir }).eq('id', perfil.id);
  if (err) return pagina('No se pudo guardar', 'Probá de nuevo en unos minutos.');
  await sb.from('registro_accesos').insert({ usuario_id: perfil.id, actor_id: perfil.id, accion: recibir ? 'resumen_alta' : 'resumen_baja', detalle: {} });
  return paginaEstado({ ...perfil, resumen_semanal: recibir }, `${url.pathname}${url.search}`, true);
}

/* -------------------------------------------------------------------- */
/* Alertas de vencimientos                                                */
/* -------------------------------------------------------------------- */

async function juntarAlertas(sb: SupabaseClient, orgIds: string[], hoy: string, base: string): Promise<Alerta[]> {
  const alertas: Alerta[] = [];
  const en7 = sumarDias(hoy, 7);
  const manana = sumarDias(hoy, 1);

  const { data: asuntos } = await sb
    .from('asuntos')
    .select('id, codigo, titulo, vence_en, organizacion_id')
    .neq('estado', 'finalizado')
    .gte('vence_en', hoy)
    .lte('vence_en', en7)
    .in('organizacion_id', orgIds);
  for (const a of asuntos ?? []) {
    const umbral = a.vence_en <= manana ? 1 : 7;
    const nombre = `${a.codigo ? `${a.codigo} · ` : ''}${a.titulo}`;
    alertas.push({
      organizacion_id: a.organizacion_id,
      clave: `alerta:asunto:${a.id}:${a.vence_en}:${umbral}`,
      texto: `<a href="${base}/portal/asuntos/${a.id}" style="${ENLACE}">${escapar(nombre)}</a> vence ${cuando(a.vence_en, hoy)}.`,
      soloTitular: false,
    });
  }

  const ahora = Date.now();
  const { data: sobres } = await sb
    .from('firma_sobres')
    .select('id, codigo, titulo, vence_en, organizacion_id')
    .eq('estado', 'en_curso')
    .gte('vence_en', new Date(ahora).toISOString())
    .lte('vence_en', new Date(ahora + 3 * 86_400_000).toISOString())
    .in('organizacion_id', orgIds);
  if (sobres?.length) {
    const { data: firmantes } = await sb.from('firma_firmantes').select('sobre_id').in('sobre_id', sobres.map((s) => s.id)).neq('estado', 'firmado');
    for (const s of sobres) {
      const faltan = (firmantes ?? []).filter((f) => f.sobre_id === s.id).length;
      const dia = diaDe(new Date(s.vence_en));
      alertas.push({
        organizacion_id: s.organizacion_id,
        clave: `alerta:firma:${s.id}:${dia}`,
        texto: `El envío a firma <a href="${base}/portal/firmas/${s.id}" style="${ENLACE}">${escapar(`${s.codigo} · ${s.titulo}`)}</a> vence ${cuando(dia, hoy)} y ${faltan === 1 ? 'falta 1 firma' : `faltan ${faltan} firmas`}.`,
        soloTitular: false,
      });
    }
  }

  const { data: abonos } = await sb
    .from('abonos')
    .select('id, concepto, vigente_hasta, organizacion_id')
    .not('estado', 'in', '(cancelado,borrador)')
    .gte('vigente_hasta', hoy)
    .lte('vigente_hasta', sumarDias(hoy, 30))
    .in('organizacion_id', orgIds);
  for (const a of abonos ?? []) {
    const umbral = a.vigente_hasta <= en7 ? 7 : 30;
    alertas.push({
      organizacion_id: a.organizacion_id,
      clave: `alerta:abono:${a.id}:${a.vigente_hasta}:${umbral}`,
      texto: `El abono <a href="${base}/portal/pagos" style="${ENLACE}">${escapar(a.concepto)}</a> termina ${cuando(a.vigente_hasta, hoy)}. Si querés renovarlo, escribinos y lo dejamos listo antes.`,
      soloTitular: true,
    });
  }

  // Pago completo: lo pagado vence en 7 días o mañana y todavía no hay débito para la cuota posterior.
  const { data: cuotas } = await sb
    .from('abonos')
    .select('id, concepto, proximo_cobro, organizacion_id, monto_posterior, moneda, al_mep')
    .eq('modalidad', 'pago_completo')
    .eq('etapa', 'posterior')
    .is('plan_id', null)
    .eq('estado', 'activo')
    .gte('proximo_cobro', new Date(`${hoy}T00:00:00-03:00`).toISOString())
    .lte('proximo_cobro', new Date(`${en7}T23:59:59-03:00`).toISOString())
    .in('organizacion_id', orgIds);
  for (const a of cuotas ?? []) {
    const dia = diaDe(new Date(a.proximo_cobro));
    const umbral = dia <= manana ? 1 : 7;
    const monto = `${a.al_mep ? 'USD' : a.moneda} ${Number(a.monto_posterior).toLocaleString('es-AR')}`;
    alertas.push({
      organizacion_id: a.organizacion_id,
      clave: `alerta:cuota:${a.id}:${dia}:${umbral}`,
      texto: `El pago completo de <a href="${base}/portal/pagos" style="${ENLACE}">${escapar(a.concepto)}</a> cubre hasta ${cuando(dia, hoy)}. Autorizá en Pagos el débito de ${monto} por mes${a.al_mep ? ' al dólar MEP' : ''} para seguir sin cortes.`,
      soloTitular: true,
    });
  }
  return alertas;
}

function mailAlertas(p: Persona, empresa: string, items: string[], base: string): { asunto: string; html: string } {
  return {
    asunto: `${items.length === 1 ? 'Un vencimiento' : `${items.length} vencimientos`} en los próximos días · ${empresa}`,
    html: plantillaMail({
      seccion: 'Alertas',
      titulo: 'Hay vencimientos cerca.',
      resalte: 'vencimientos cerca.',
      anticipo: 'Lo que vence en los próximos días en el portal de FIRMA.',
      parrafos: [hola(p), `Esto vence pronto en <strong>${escapar(empresa)}</strong>. Si algo ya está resuelto, contanos por el chat del asunto y lo cerramos.`],
      bloques: [{ titulo: 'Vencimientos', items }],
      boton: { texto: 'Ir al portal', url: `${base}/portal` },
      pie: 'Te avisamos una semana antes y el día anterior.',
      firma: true,
    }),
  };
}


/* -------------------------------------------------------------------- */
/* Mail de los lunes                                                      */
/* -------------------------------------------------------------------- */

interface Newsletter {
  id: string;
  semana: string;
  video_titulo: string | null;
  video_url: string | null;
  articulo_titulo: string | null;
  articulo_bajada: string | null;
  articulo_url: string | null;
  enviada_en: string | null;
}

interface DatosSemana {
  asuntos: { id: string; codigo: string | null; titulo: string; estado: string; vence_en: string | null; cerrado_en: string | null }[];
  novedades: Map<string, number>;
  sobres: { id: string; codigo: string; titulo: string; estado: string; vence_en: string; completado_en: string | null }[];
  documentos: { areas: string[] | null }[];
  abonos: { concepto: string; vigente_hasta: string }[];
}

async function datosSemana(sb: SupabaseClient, orgId: string, hoy: string, domingo: string, desde: string): Promise<DatosSemana> {
  const [asuntos, novedades, sobres, documentos, abonos] = await Promise.all([
    sb.from('asuntos').select('id, codigo, titulo, estado, vence_en, cerrado_en').eq('organizacion_id', orgId).or(`estado.neq.finalizado,cerrado_en.gte."${desde}"`),
    sb.from('asunto_novedades').select('asunto_id').eq('organizacion_id', orgId).eq('interna', false).gte('creado_en', desde),
    sb.from('firma_sobres').select('id, codigo, titulo, estado, vence_en, completado_en').eq('organizacion_id', orgId).or(`estado.eq.en_curso,completado_en.gte."${desde}"`),
    sb.from('documentos').select('areas').eq('organizacion_id', orgId).eq('activo', true).gte('creado_en', desde),
    sb.from('abonos').select('concepto, vigente_hasta').eq('organizacion_id', orgId).not('estado', 'in', '(cancelado,borrador)').gte('vigente_hasta', hoy).lte('vigente_hasta', domingo),
  ]);
  const cuenta = new Map<string, number>();
  for (const n of novedades.data ?? []) cuenta.set(n.asunto_id, (cuenta.get(n.asunto_id) ?? 0) + 1);
  return { asuntos: asuntos.data ?? [], novedades: cuenta, sobres: sobres.data ?? [], documentos: documentos.data ?? [], abonos: abonos.data ?? [] };
}

/** El id de un video de YouTube, para mostrar su miniatura en el mail. */
function idYoutube(url: string): string | null {
  return url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;
}

const ROTULO = `color:${COLOR.piedra};font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;font-stretch:125%`;

function bloqueNewsletter(n: Newsletter): { titulo: string; items: string[] } {
  const items: string[] = [];
  if (n.video_url && n.video_titulo) {
    const url = escapar(n.video_url);
    const id = idYoutube(n.video_url);
    const miniatura = id
      ? `<a href="${url}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" width="520" alt="${escapar(n.video_titulo)}" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:14px;margin:6px 0 12px"></a>`
      : '';
    items.push(`<span style="${ROTULO}">Video</span><br>${miniatura}<a href="${url}" style="${ENLACE}">&#9654; ${escapar(n.video_titulo)}</a>`);
  }
  if (n.articulo_url && n.articulo_titulo) {
    const url = escapar(n.articulo_url);
    const bajada = n.articulo_bajada ? `<br><span style="color:${COLOR.piedra}">${escapar(n.articulo_bajada)}</span>` : '';
    items.push(`<span style="${ROTULO}">Artículo</span><br><a href="${url}" style="${ENLACE}">${escapar(n.articulo_titulo)}</a>${bajada}<br><a href="${url}" style="color:${COLOR.tinta};font-size:13px;font-weight:600">Leer el artículo &rarr;</a>`);
  }
  return { titulo: 'Novedades', items };
}

/** Un negocio del que la persona es miembro, con su rol ahí y los datos de la semana si ve asuntos. */
interface NegocioLunes {
  empresa: string;
  rol: string;
  areas: string[] | null;
  datos: DatosSemana | null;
}

/**
 * El mail de los lunes de una persona: la newsletter una sola vez y, por cada
 * negocio en el que ve asuntos, los vencimientos de la semana y un resumen
 * corto. Quien está en dos negocios recibe un mail con los dos. Null si no
 * hay nada que contarle.
 */
function mailLunes(
  p: Pick<Persona, 'nombre'>,
  negocios: NegocioLunes[],
  n: Newsletter | null,
  hoy: string,
  lunes: string,
  base: string,
  baja: string,
): { asunto: string; html: string } | null {
  const domingo = sumarDias(lunes, 6);
  const enlaceAsunto = (a: DatosSemana['asuntos'][number]) =>
    `<a href="${base}/portal/asuntos/${a.id}" style="${ENLACE}">${escapar(`${a.codigo ? `${a.codigo} · ` : ''}${a.titulo}`)}</a>`;
  const completos = negocios.filter((g) => g.datos !== null && ROLES_ASUNTOS.includes(g.rol));
  const varios = completos.length > 1;

  const bloques: { titulo: string; items: string[] }[] = [];
  let esperan = 0;
  for (const g of completos) {
    const d = g.datos as DatosSemana;
    const vencimientos: string[] = [];
    const resumen: string[] = [];
    const abiertos = d.asuntos.filter((a) => a.estado !== 'finalizado');
    for (const a of abiertos.filter((x) => x.vence_en && x.vence_en >= hoy && x.vence_en <= domingo).sort((x, y) => (x.vence_en as string).localeCompare(y.vence_en as string)))
      vencimientos.push(`${enlaceAsunto(a)} vence ${cuando(a.vence_en as string, hoy)}.`);
    for (const s of d.sobres.filter((x) => x.estado === 'en_curso')) {
      const dia = diaDe(new Date(s.vence_en));
      if (dia >= hoy && dia <= domingo) vencimientos.push(`El envío a firma <a href="${base}/portal/firmas/${s.id}" style="${ENLACE}">${escapar(`${s.codigo} · ${s.titulo}`)}</a> vence ${cuando(dia, hoy)}.`);
    }
    if (g.rol === 'titular') for (const a of d.abonos) vencimientos.push(`El abono <strong>${escapar(a.concepto)}</strong> termina ${cuando(a.vigente_hasta, hoy)}.`);

    const enEspera = abiertos.filter((a) => a.estado === 'espera_cliente');
    esperan += enEspera.length;
    if (abiertos.length)
      resumen.push(`${plural(abiertos.length, 'asunto abierto', 'asuntos abiertos')}.${enEspera.length ? ` ${enEspera.length === 1 ? 'Uno espera' : `${enEspera.length} esperan`} tu respuesta, ${enEspera.map(enlaceAsunto).join(', ')}.` : ''}`);
    const conNovedades = abiertos.filter((a) => d.novedades.get(a.id)).length;
    if (conNovedades) resumen.push(`${plural(conNovedades, 'asunto tuvo', 'asuntos tuvieron')} novedades esta semana.`);
    const finalizados = d.asuntos.length - abiertos.length;
    if (finalizados) resumen.push(`${plural(finalizados, 'asunto quedó finalizado', 'asuntos quedaron finalizados')}.`);
    const enCurso = d.sobres.filter((s) => s.estado === 'en_curso').length;
    const completados = d.sobres.filter((s) => s.estado === 'completado').length;
    if (enCurso || completados)
      resumen.push(`${[enCurso && plural(enCurso, 'firma en curso', 'firmas en curso'), completados && plural(completados, 'firma completada', 'firmas completadas')].filter(Boolean).join(' y ')}.`);
    // Los mismos documentos que la persona ve en el portal, como en el aviso de documento nuevo.
    const documentos = d.documentos.filter((doc) => !doc.areas?.length || g.rol === 'titular' || (g.areas ?? []).some((a) => (doc.areas ?? []).includes(a))).length;
    if (documentos) resumen.push(`${plural(documentos, 'documento nuevo', 'documentos nuevos')} en el portal.`);

    const de = varios ? ` · ${g.empresa}` : '';
    bloques.push({ titulo: `Vencimientos de esta semana${de}`, items: vencimientos }, { titulo: `Tu semana en resumen${de}`, items: resumen });
  }

  if (!n && !bloques.some((b) => b.items.length)) return null;
  const destacado = n?.video_titulo ?? n?.articulo_titulo;
  const nombres = (lista: NegocioLunes[]) => lista.map((g) => `<strong>${escapar(g.empresa)}</strong>`).join(lista.length === 2 ? ' y ' : ', ');
  const todas = negocios.map((g) => escapar(g.empresa)).join(negocios.length === 2 ? ' y ' : ', ');

  return {
    asunto: esperan
      ? `${esperan === 1 ? 'Un asunto espera' : `${esperan} asuntos esperan`} tu respuesta · Tu semana en FIRMA`
      : destacado
        ? `${destacado} · Novedades de FIRMA`
        : `Tu semana en FIRMA · ${completos.map((g) => g.empresa).join(', ')}`,
    html: plantillaMail({
      seccion: n ? 'Newsletter' : 'Resumen semanal',
      titulo: completos.length ? 'Tu semana en FIRMA.' : 'Novedades de FIRMA.',
      resalte: completos.length ? 'Tu semana' : 'Novedades',
      anticipo: destacado ?? 'Vencimientos y resumen de la semana.',
      parrafos: [hola(p), completos.length ? `Lo nuevo de FIRMA y cómo viene la semana de ${nombres(completos)} en el portal.` : 'Esto es lo que preparamos para vos esta semana.'],
      bloques: [...(n ? [bloqueNewsletter(n)] : []), ...bloques],
      boton: completos.length ? { texto: esperan ? 'Responder en el portal' : 'Ir al portal', url: `${base}/portal/asuntos` } : undefined,
      pie: `Te llega los lunes porque tenés acceso al portal de ${todas}. <a href="${escapar(baja)}" style="color:${COLOR.piedra}">Dejar de recibir este mail</a>.`,
      firma: true,
    }),
  };
}

/** Prueba de la newsletter para FIRMA: la versión que reciben closers y setters. */
async function mandarPrueba(sb: SupabaseClient, request: Request): Promise<Response> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = token ? await sb.auth.getUser(token) : { data: null };
  if (!u?.user) return error('Sesión requerida.', 401);
  const { data: yo } = await sb.from('perfiles').select('id, email, nombre, rol, activo').eq('id', u.user.id).maybeSingle();
  if (!yo?.activo || yo.rol !== 'admin') return error('Solo FIRMA manda pruebas.', 403);
  if (nivelDe(token) !== 'aal2') return error(FALTA_SEGUNDO_FACTOR, 403);
  if (!mailDisponible()) return error('El envío de mails no está configurado.', 503);
  const baja = enlaceBaja(yo.id);
  if (!baja) return error('El servidor no tiene configurada PORTAL_CLAVE_AVISOS.', 500);
  const cuerpo = (await request.json().catch(() => ({}))) as { id?: unknown };
  const id = String(cuerpo.id ?? '');
  if (!UUID.test(id)) return error('Falta la newsletter.');
  const { data: n } = await sb.from('newsletters').select('*').eq('id', id).maybeSingle();
  if (!n) return error('No existe esa newsletter.', 404);
  const mail = mailLunes({ nombre: yo.nombre }, [{ empresa: 'tu empresa', rol: 'closer', areas: [], datos: null }], n as Newsletter, diaDe(new Date()), n.semana, basePortal(), baja) as { asunto: string; html: string };
  const fallo = await mandar(yo.email, `[Prueba] ${mail.asunto}`, mail.html);
  return fallo ? error(fallo, 502) : json({ ok: true });
}

/* -------------------------------------------------------------------- */
/* Tarea diaria                                                           */
/* -------------------------------------------------------------------- */

/**
 * Notificación de la mañana con los onboardings del día de cada empresa, al
 * account manager responsable de cada cliente del CRM. Los clientes sin
 * responsable (o con uno sin usuario en el portal) van a los CSM de la
 * empresa y, si no hay, al titular. Una vez por empresa y día. Sin nombres
 * de clientes: el detalle está en Inicio.
 */
async function avisarOnboardings(sb: SupabaseClient, orgIds: string[], hoy: string): Promise<number> {
  if (!pushDisponible() || !orgIds.length) return 0;
  const desde = new Date(`${hoy}T00:00:00-03:00`).toISOString();
  const hasta = new Date(`${sumarDias(hoy, 1)}T00:00:00-03:00`).toISOString();
  const { data: clientes } = await sb
    .from('crm_clientes')
    .select('organizacion_id, responsable_id, fecha_onboarding')
    .in('organizacion_id', orgIds)
    .gte('fecha_onboarding', desde)
    .lt('fecha_onboarding', hasta);
  const filas = (clientes ?? []) as { organizacion_id: string; responsable_id: string | null; fecha_onboarding: string }[];
  if (!filas.length) return 0;

  const conOnboarding = [...new Set(filas.map((f) => f.organizacion_id))];
  const libres = await reservar(sb, conOnboarding.map((o) => `push-onboardings:${o}:${hoy}`));
  const responsables = [...new Set(filas.map((f) => f.responsable_id).filter((x): x is string => !!x))];
  const { data: equipo } = responsables.length ? await sb.from('equipo_miembros').select('id, usuario_id').in('id', responsables).eq('activo', true) : { data: [] };
  const usuarioDe = new Map(((equipo ?? []) as { id: string; usuario_id: string | null }[]).map((e) => [e.id, e.usuario_id]));
  const gente = await genteDe(sb, conOnboarding, ['csm', 'titular']);

  let avisados = 0;
  for (const org of conOnboarding) {
    if (!libres.has(`push-onboardings:${org}:${hoy}`)) continue;
    const porUsuario = new Map<string, number>();
    for (const f of filas.filter((x) => x.organizacion_id === org)) {
      let destino = [f.responsable_id ? usuarioDe.get(f.responsable_id) : null].filter((x): x is string => !!x);
      if (!destino.length) destino = gente.filter((g) => g.organizacion_id === org && g.rol === 'csm').map((g) => g.id);
      if (!destino.length) destino = gente.filter((g) => g.organizacion_id === org && g.rol === 'titular').map((g) => g.id);
      for (const u of destino) porUsuario.set(u, (porUsuario.get(u) ?? 0) + 1);
    }
    for (const [usuario, n] of porUsuario) {
      avisados += await enviarPush(sb, [usuario], {
        titulo: n === 1 ? 'Hoy tenés un onboarding' : `Hoy tenés ${n} onboardings`,
        cuerpo: 'Revisá en el portal que cada cliente tenga su contrato firmado.',
        url: '/portal',
        etiqueta: `onboardings-${hoy}`,
      });
    }
  }
  return avisados;
}

async function tareaDiaria(sb: SupabaseClient, forzarResumen: boolean): Promise<Response> {
  const inicio = Date.now();
  const sinTiempo = () => Date.now() - inicio > TIEMPO_MS;
  const base = basePortal();
  const hoy = diaDe(new Date());
  const resultado = { alertas: 0, mails_alertas: 0, lunes: 0, pendientes: 0, push_onboardings: 0, errores: [] as string[] };

  const { data: orgs } = await sb.from('organizaciones').select('id, nombre').eq('activa', true).eq('demo', false);
  const empresas = new Map((orgs ?? []).map((o) => [o.id as string, o.nombre as string]));
  const orgIds = [...empresas.keys()];
  if (!orgIds.length) return json({ ok: true, ...resultado });

  // Onboardings del día: notificación al account manager. Si falla, los mails salen igual.
  try {
    resultado.push_onboardings = await avisarOnboardings(sb, orgIds, hoy);
  } catch (e) {
    resultado.errores.push(`Onboardings: ${(e as Error).message}`);
  }

  // Una fila por persona y negocio, por sus membresías activas: quien está en dos negocios recibe lo de los dos.
  const miembros = await genteDe(sb, orgIds, ROLES_EMPRESA);
  const ids = [...new Set(miembros.map((m) => m.id))];
  const { data: preferencias } = ids.length ? await sb.from('perfiles').select('id, resumen_semanal').in('id', ids) : { data: [] };
  const suscripto = new Map(((preferencias ?? []) as { id: string; resumen_semanal: boolean }[]).map((x) => [x.id, x.resumen_semanal]));
  const personas: Persona[] = miembros.map((m) => ({ ...m, resumen_semanal: suscripto.get(m.id) ?? false }));

  // Alertas: se reservan por empresa justo antes de mandar, así lo que no entra hoy sale mañana.
  const alertas = await juntarAlertas(sb, orgIds, hoy, base);
  const paraFirma = new Map<string, string[]>();
  for (const orgId of new Set(alertas.map((a) => a.organizacion_id))) {
    if (sinTiempo()) {
      resultado.pendientes++;
      continue;
    }
    const nuevas = await reservar(sb, alertas.filter((a) => a.organizacion_id === orgId).map((a) => a.clave));
    const deLaEmpresa = alertas.filter((a) => a.organizacion_id === orgId && nuevas.has(a.clave));
    if (!deLaEmpresa.length) continue;
    resultado.alertas += deLaEmpresa.length;
    const empresa = empresas.get(orgId) ?? 'Tu empresa';
    paraFirma.set(empresa, deLaEmpresa.map((a) => a.texto));
    for (const p of personas.filter((x) => x.organizacion_id === orgId && ROLES_ASUNTOS.includes(x.rol))) {
      const items = deLaEmpresa.filter((a) => !a.soloTitular || p.rol === 'titular').map((a) => a.texto);
      if (!items.length) continue;
      const { asunto, html } = mailAlertas(p, empresa, items, base);
      const fallo = await mandar(p.email, asunto, html);
      if (fallo) resultado.errores.push(`Alerta a ${p.email}: ${fallo}`);
      else resultado.mails_alertas++;
    }
  }
  if (paraFirma.size) {
    const total = [...paraFirma.values()].reduce((n, l) => n + l.length, 0);
    for (const d of await destinatariosFirma(sb)) {
      const fallo = await mandar(
        d.email,
        `${plural(total, 'vencimiento', 'vencimientos')} de clientes en los próximos días`,
        plantillaMail({
          seccion: 'Alertas',
          titulo: 'Vencimientos de clientes.',
          resalte: 'de clientes.',
          anticipo: [...paraFirma.keys()].join(', '),
          parrafos: [hola(d), 'Estos son los vencimientos que hoy se avisaron a cada empresa.'],
          bloques: [...paraFirma].map(([empresa, items]) => ({ titulo: empresa, items })),
          boton: { texto: 'Ver asuntos', url: `${base}/portal/asuntos` },
        }),
      );
      if (fallo) resultado.errores.push(`Alerta a FIRMA ${d.email}: ${fallo}`);
    }
  }

  // Mail de los lunes, con martes y miércoles para lo que no llegó a salir. Solo si FIRMA activó la newsletter de la semana.
  const diaSemana = diaDeSemana(hoy);
  const lunes = sumarDias(hoy, -diaSemana);
  const { data: nl } = forzarResumen || diaSemana <= 2 ? await sb.from('newsletters').select('*').eq('semana', lunes).eq('activa', true).maybeSingle() : { data: null };
  const newsletter = (nl as Newsletter | null) ?? null;
  if (newsletter) {
    const domingo = sumarDias(lunes, 6);
    const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();
    // Los datos de cada negocio se leen una vez, la primera vez que hacen falta.
    const semanas = new Map<string, Promise<DatosSemana>>();
    const datosDe = (orgId: string) => {
      if (!semanas.has(orgId)) semanas.set(orgId, datosSemana(sb, orgId, hoy, domingo, desde));
      return semanas.get(orgId) as Promise<DatosSemana>;
    };
    const porPersona = new Map<string, Persona[]>();
    for (const p of personas.filter((x) => x.resumen_semanal)) porPersona.set(p.id, [...(porPersona.get(p.id) ?? []), p]);
    for (const filas of porPersona.values()) {
      if (sinTiempo()) {
        resultado.pendientes++;
        continue;
      }
      const p = filas[0];
      const negocios: NegocioLunes[] = [];
      for (const f of filas)
        negocios.push({
          empresa: empresas.get(f.organizacion_id) ?? 'Tu empresa',
          rol: f.rol,
          areas: f.areas,
          datos: ROLES_ASUNTOS.includes(f.rol) ? await datosDe(f.organizacion_id) : null,
        });
      const baja = enlaceBaja(p.id) as string;
      const mail = mailLunes(p, negocios, newsletter, hoy, lunes, base, baja);
      if (!mail) continue;
      if (!(await reservar(sb, [`resumen:${p.id}:${lunes}`])).size) continue;
      const fallo = await mandar(p.email, mail.asunto, mail.html, { 'List-Unsubscribe': `<${baja}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
      if (fallo) resultado.errores.push(`Lunes a ${p.email}: ${fallo}`);
      else resultado.lunes++;
    }
    if (!newsletter.enviada_en && resultado.lunes) await sb.from('newsletters').update({ enviada_en: new Date().toISOString() }).eq('id', newsletter.id);
  }
  return json({ ok: true, ...resultado });
}

export async function GET(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);
  const url = new URL(request.url);

  if (url.searchParams.has('p')) {
    const perfil = await perfilDelEnlace(sb, url);
    if (perfil instanceof Response) return perfil;
    return paginaEstado(perfil, `${url.pathname}${url.search}`);
  }

  const clave = process.env.CRON_SECRET;
  if (!clave || !iguales(request.headers.get('authorization') || '', `Bearer ${clave}`)) return error('No autorizado.', 401);
  // Abonos en cuotas y en pesos al MEP. Corre en su propia función, sin demorar los mails.
  waitUntil(fetch(`${basePortal()}/api/pagos/gestionar`, { headers: { authorization: `Bearer ${clave}` }, signal: AbortSignal.timeout(55_000) }).catch(() => undefined));
  if (!process.env.PORTAL_CLAVE_AVISOS) return error('El servidor no tiene configurada PORTAL_CLAVE_AVISOS.', 500);
  if (!mailDisponible()) return error('El envío de mails no está configurado.', 503);
  try {
    return await tareaDiaria(sb, url.searchParams.get('resumen') === '1');
  } catch (e) {
    return error((e as Error).message, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);
  const url = new URL(request.url);
  if (!url.searchParams.has('p')) return mandarPrueba(sb, request);
  return cambiarSuscripcion(sb, request, url);
}

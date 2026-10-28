/**
 * Mail de los lunes y alertas de vencimientos del portal (Vercel Function).
 * Salen por Resend con la plantilla de FIRMA.
 *
 * GET /api/portal/resumen  tarea diaria de Vercel Cron con CRON_SECRET, a las 9
 *   de Buenos Aires.
 *   Alertas: asuntos que vencen en 7 días y el día anterior, envíos a firma
 *   que vencen en 3 días y abonos que terminan en 30 y en 7. Cada empresa
 *   recibe un solo mail por persona y por día con todo junto, y FIRMA uno con
 *   todas las empresas. Cada alerta sale una vez por umbral.
 *   Los lunes, además, el mail de la semana: la newsletter (video y artículo
 *   que carga FIRMA en Administración › Newsletter) a todos los usuarios, y al
 *   titular y al CSM también los vencimientos de la semana y un resumen de su
 *   empresa. Sale solo si FIRMA activó la newsletter de ese lunes; si no, no
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
import { FALTA_SEGUNDO_FACTOR, nivelDe } from '../_lib/nivel.js';
import { enviarMail, mailDisponible, plantillaMail } from '../_lib/mail.js';

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
const ENLACE = 'color:#173A2F;font-weight:600;text-decoration:underline';

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
body{margin:0;background:#F5F3EC;color:#1B1F1B;font:15px/1.65 Archivo,Arial,Helvetica,sans-serif}
main{max-width:520px;margin:64px auto;padding:36px 32px;background:#fff;border:1px solid #DEDBD0;border-top:3px solid #173A2F}
p.seccion{margin:0 0 14px;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#6B6553}
h1{margin:0 0 18px;font:900 26px/1.2 Bitter,Georgia,serif}
button{margin-top:12px;padding:14px 26px;border:0;background:#173A2F;color:#F5F3EC;font:600 15px Archivo,Arial,sans-serif;cursor:pointer}
a{color:#173A2F}
@media (max-width:560px){main{margin:16px;padding:28px 20px}}
</style></head>
<body><main><p class="seccion">Mail de los lunes</p><h1>${escapar(titulo)}</h1><p>${texto}</p>${form}
<p style="margin-top:28px;font-size:13px;color:#6B6553"><a href="${basePortal()}/portal">Ir al portal</a></p></main></body></html>`;
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
        texto: `<a href="${base}/portal/firmas/${s.id}" style="${ENLACE}">${escapar(`${s.codigo} · ${s.titulo}`)}</a>: el envío a firma vence ${cuando(dia, hoy)} y ${faltan === 1 ? 'falta 1 firma' : `faltan ${faltan} firmas`}.`,
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
  return alertas;
}

function mailAlertas(p: Persona, empresa: string, items: string[], base: string): { asunto: string; html: string } {
  return {
    asunto: `${items.length === 1 ? 'Un vencimiento' : `${items.length} vencimientos`} en los próximos días · ${empresa}`,
    html: plantillaMail({
      seccion: 'Alertas',
      titulo: 'Hay vencimientos cerca',
      anticipo: 'Lo que vence en los próximos días en el portal de FIRMA.',
      parrafos: [hola(p), `Esto vence pronto en <strong>${escapar(empresa)}</strong>:`],
      bloques: [{ titulo: 'Vencimientos', items }],
      boton: { texto: 'Ir al portal', url: `${base}/portal` },
      pie: 'Te avisamos una semana antes y el día anterior. Si algo ya está resuelto, contanos por el chat del asunto.',
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

const ROTULO = 'color:#6B6553;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase';

function bloqueNewsletter(n: Newsletter): { titulo: string; items: string[] } {
  const items: string[] = [];
  if (n.video_url && n.video_titulo) {
    const url = escapar(n.video_url);
    const id = idYoutube(n.video_url);
    const miniatura = id
      ? `<a href="${url}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" width="516" alt="${escapar(n.video_titulo)}" style="display:block;width:100%;max-width:516px;height:auto;border:0;margin:4px 0 12px"></a>`
      : '';
    items.push(`<span style="${ROTULO}">Video</span><br>${miniatura}<a href="${url}" style="${ENLACE}">&#9654; ${escapar(n.video_titulo)}</a>`);
  }
  if (n.articulo_url && n.articulo_titulo) {
    const url = escapar(n.articulo_url);
    const bajada = n.articulo_bajada ? `<br><span style="color:#6B6553">${escapar(n.articulo_bajada)}</span>` : '';
    items.push(`<span style="${ROTULO}">Artículo</span><br><a href="${url}" style="${ENLACE}">${escapar(n.articulo_titulo)}</a>${bajada}<br><a href="${url}" style="color:#173A2F;font-size:13px">Leer el artículo &rarr;</a>`);
  }
  return { titulo: 'Novedades', items };
}

/**
 * El mail de los lunes de una persona: la newsletter para todos y, para quien
 * ve asuntos (con `d`), los vencimientos de la semana y un resumen corto. Null
 * si no hay nada que contarle.
 */
function mailLunes(
  p: Pick<Persona, 'nombre' | 'rol' | 'areas'>,
  empresa: string,
  n: Newsletter | null,
  d: DatosSemana | null,
  hoy: string,
  lunes: string,
  base: string,
  baja: string,
): { asunto: string; html: string } | null {
  const completo = d !== null && ROLES_ASUNTOS.includes(p.rol);
  const domingo = sumarDias(lunes, 6);
  const enlaceAsunto = (a: DatosSemana['asuntos'][number]) =>
    `<a href="${base}/portal/asuntos/${a.id}" style="${ENLACE}">${escapar(`${a.codigo ? `${a.codigo} · ` : ''}${a.titulo}`)}</a>`;

  const vencimientos: string[] = [];
  const resumen: string[] = [];
  let esperan = 0;
  if (completo && d) {
    const abiertos = d.asuntos.filter((a) => a.estado !== 'finalizado');
    for (const a of abiertos.filter((x) => x.vence_en && x.vence_en >= hoy && x.vence_en <= domingo).sort((x, y) => (x.vence_en as string).localeCompare(y.vence_en as string)))
      vencimientos.push(`${enlaceAsunto(a)} vence ${cuando(a.vence_en as string, hoy)}.`);
    for (const s of d.sobres.filter((x) => x.estado === 'en_curso')) {
      const dia = diaDe(new Date(s.vence_en));
      if (dia >= hoy && dia <= domingo) vencimientos.push(`<a href="${base}/portal/firmas/${s.id}" style="${ENLACE}">${escapar(`${s.codigo} · ${s.titulo}`)}</a>: el envío a firma vence ${cuando(dia, hoy)}.`);
    }
    if (p.rol === 'titular') for (const a of d.abonos) vencimientos.push(`El abono <strong>${escapar(a.concepto)}</strong> termina ${cuando(a.vigente_hasta, hoy)}.`);

    const enEspera = abiertos.filter((a) => a.estado === 'espera_cliente');
    esperan = enEspera.length;
    if (abiertos.length)
      resumen.push(`${plural(abiertos.length, 'asunto abierto', 'asuntos abiertos')}.${esperan ? ` ${esperan === 1 ? 'Uno espera' : `${esperan} esperan`} tu respuesta: ${enEspera.map(enlaceAsunto).join(', ')}.` : ''}`);
    const conNovedades = abiertos.filter((a) => d.novedades.get(a.id)).length;
    if (conNovedades) resumen.push(`${plural(conNovedades, 'asunto tuvo', 'asuntos tuvieron')} novedades esta semana.`);
    const finalizados = d.asuntos.length - abiertos.length;
    if (finalizados) resumen.push(`${plural(finalizados, 'asunto quedó finalizado', 'asuntos quedaron finalizados')}.`);
    const enCurso = d.sobres.filter((s) => s.estado === 'en_curso').length;
    const completados = d.sobres.filter((s) => s.estado === 'completado').length;
    if (enCurso || completados) resumen.push(`Firmas: ${[enCurso && `${enCurso} en curso`, completados && plural(completados, 'completada', 'completadas')].filter(Boolean).join(' y ')}.`);
    // Los mismos documentos que la persona ve en el portal, como en el aviso de documento nuevo.
    const documentos = d.documentos.filter((doc) => !doc.areas?.length || p.rol === 'titular' || (p.areas ?? []).some((a) => (doc.areas ?? []).includes(a))).length;
    if (documentos) resumen.push(`${plural(documentos, 'documento nuevo', 'documentos nuevos')} en el portal.`);
  }

  if (!n && !vencimientos.length && !resumen.length) return null;
  const destacado = n?.video_titulo ?? n?.articulo_titulo;

  return {
    asunto: esperan
      ? `${esperan === 1 ? 'Un asunto espera' : `${esperan} asuntos esperan`} tu respuesta · Tu semana en FIRMA`
      : destacado
        ? `${destacado} · Novedades de FIRMA`
        : `Tu semana en FIRMA · ${empresa}`,
    html: plantillaMail({
      seccion: n ? 'Newsletter' : 'Resumen semanal',
      titulo: completo ? 'Tu semana en FIRMA' : 'Novedades de FIRMA',
      anticipo: destacado ?? 'Vencimientos y resumen de la semana.',
      parrafos: [hola(p), completo ? `Lo nuevo de FIRMA y cómo viene la semana de <strong>${escapar(empresa)}</strong> en el portal.` : 'Esto es lo que preparamos para vos esta semana.'],
      bloques: [
        ...(n ? [bloqueNewsletter(n)] : []),
        { titulo: 'Vencimientos de esta semana', items: vencimientos },
        { titulo: 'Tu semana en resumen', items: resumen },
      ],
      boton: completo ? { texto: esperan ? 'Responder en el portal' : 'Ir al portal', url: `${base}/portal/asuntos` } : undefined,
      pie: `Te llega los lunes porque tenés acceso al portal de ${escapar(empresa)}. <a href="${escapar(baja)}" style="color:#6B6553">Dejar de recibir este mail</a>.`,
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
  const mail = mailLunes({ nombre: yo.nombre, rol: 'closer', areas: [] }, 'tu empresa', n as Newsletter, null, diaDe(new Date()), n.semana, basePortal(), baja) as { asunto: string; html: string };
  const fallo = await mandar(yo.email, `[Prueba] ${mail.asunto}`, mail.html);
  return fallo ? error(fallo, 502) : json({ ok: true });
}

/* -------------------------------------------------------------------- */
/* Tarea diaria                                                           */
/* -------------------------------------------------------------------- */

async function tareaDiaria(sb: SupabaseClient, forzarResumen: boolean): Promise<Response> {
  const inicio = Date.now();
  const sinTiempo = () => Date.now() - inicio > TIEMPO_MS;
  const base = basePortal();
  const hoy = diaDe(new Date());
  const resultado = { alertas: 0, mails_alertas: 0, lunes: 0, pendientes: 0, errores: [] as string[] };

  const { data: orgs } = await sb.from('organizaciones').select('id, nombre').eq('activa', true).eq('demo', false);
  const empresas = new Map((orgs ?? []).map((o) => [o.id as string, o.nombre as string]));
  const orgIds = [...empresas.keys()];
  if (!orgIds.length) return json({ ok: true, ...resultado });

  const { data: gente } = await sb
    .from('perfiles')
    .select('id, email, nombre, rol, organizacion_id, areas, resumen_semanal')
    .eq('activo', true)
    .in('rol', ROLES_EMPRESA)
    .in('organizacion_id', orgIds);
  const personas = (gente ?? []) as Persona[];

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
          titulo: 'Vencimientos de clientes',
          anticipo: [...paraFirma.keys()].join(', '),
          parrafos: [hola(d), 'Estos son los vencimientos que hoy se avisaron a cada empresa:'],
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
    for (const orgId of orgIds) {
      const suscriptos = personas.filter((p) => p.organizacion_id === orgId && p.resumen_semanal);
      if (!suscriptos.length) continue;
      if (sinTiempo()) {
        resultado.pendientes += suscriptos.length;
        continue;
      }
      const datos = suscriptos.some((p) => ROLES_ASUNTOS.includes(p.rol)) ? await datosSemana(sb, orgId, hoy, domingo, desde) : null;
      for (const p of suscriptos) {
        if (sinTiempo()) {
          resultado.pendientes++;
          continue;
        }
        const baja = enlaceBaja(p.id) as string;
        const mail = mailLunes(p, empresas.get(orgId) ?? 'Tu empresa', newsletter, datos, hoy, lunes, base, baja);
        if (!mail) continue;
        if (!(await reservar(sb, [`resumen:${p.id}:${lunes}`])).size) continue;
        const fallo = await mandar(p.email, mail.asunto, mail.html, { 'List-Unsubscribe': `<${baja}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
        if (fallo) resultado.errores.push(`Lunes a ${p.email}: ${fallo}`);
        else resultado.lunes++;
      }
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

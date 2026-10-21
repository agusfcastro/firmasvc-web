/**
 * Arma el borrador del contrato de un cliente del CRM y lo deja en la
 * carpeta de revisión de Drive de la empresa (Vercel Function).
 * Toma el modelo .docx del servicio, Claude lo completa con los datos de la
 * venta y las condiciones acordadas en texto libre, y el archivo se sube a
 * Drive. Nunca envía nada a firmar.
 *
 * POST /api/crm/borrador  { cliente_id }
 *   Responde { estado, drive_url?, avisos } o { error }.
 *   Lo pide cualquier usuario de la empresa con acceso al CRM. Volver a
 *   pedirlo reemplaza el archivo en Drive.
 *
 * Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
 * GOOGLE_CREDS_JSON (la clave JSON de la cuenta de servicio) y
 * GOOGLE_SUBJECT (el usuario de Workspace en cuyo nombre se escribe).
 */
import { createSign } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZONA = 'America/Argentina/Buenos_Aires';
const MODELO_CLAUDE = 'claude-opus-5-5';
const ROLES_CRM = ['titular', 'csm', 'closer', 'miembro'];

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

/* ------------------------------------------------------------------ */
/* Word. Un .docx es un zip; el texto vive en word/document.xml, en    */
/* párrafos <w:p> con tramos <w:r> que llevan el formato.              */
/* ------------------------------------------------------------------ */
const PARRAFO = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;

export interface Segmento {
  texto: string;
  negrita: boolean;
  completar: boolean;
}

export interface Cambio {
  indice: number;
  /** Párrafos que reemplazan al original. Vacío lo elimina; varios lo repiten con el mismo formato. */
  parrafos: { segmentos: Segmento[] }[];
}

function desescapar(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Texto visible de un tramo, con tabulaciones y saltos de línea. */
function textoDeTramo(xml: string): string {
  let t = '';
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>/g)) {
    if (m[1] !== undefined) t += desescapar(m[1]);
    else t += m[0].startsWith('<w:tab') ? '\t' : '\n';
  }
  return t;
}

const enNegrita = (tramoXml: string) => /<w:b(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(tramoXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? '');

/** Texto visible de un párrafo. Con conNegritas, lo que está en negrita va entre ** para que Claude lo respete. */
export function textoDeParrafo(xml: string, conNegritas = false): string {
  if (!conNegritas) return textoDeTramo(xml);
  let t = '';
  let negrita = false;
  for (const m of xml.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)) {
    const texto = textoDeTramo(m[0]);
    if (!texto) continue;
    const b = enNegrita(m[0]);
    if (b !== negrita) {
      t += '**';
      negrita = b;
    }
    t += texto;
  }
  return negrita ? `${t}**` : t;
}

export function parrafosDe(documento: string): string[] {
  return documento.match(PARRAFO) ?? [];
}

// Orden de los hijos de <w:rPr> según el esquema de Word. Fuera de orden, Word puede decir que el archivo está dañado.
const ORDEN_RPR = [
  'rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss', 'imprint',
  'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u',
  'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath',
];

/** Formato de un tramo nuevo: el del modelo, con o sin negrita, y en rojo si hay que completarlo. */
function rprPara(rpr: string, s: Segmento): string {
  const hijos = new Map<string, string>();
  const interior = rpr.replace(/^<w:rPr>|<\/w:rPr>$/g, '');
  for (const m of interior.matchAll(/<w:(\w+)\b[^>]*?(?:\/>|>[\s\S]*?<\/w:\1>)/g)) hijos.set(m[1], m[0]);
  hijos.delete('b');
  hijos.delete('bCs');
  if (s.negrita || s.completar) hijos.set('b', '<w:b/>');
  if (s.completar) hijos.set('color', '<w:color w:val="C00000"/>');
  if (hijos.size === 0) return '';
  const ordenados = [...hijos.entries()].sort((a, b) => {
    const ia = ORDEN_RPR.indexOf(a[0]);
    const ib = ORDEN_RPR.indexOf(b[0]);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return `<w:rPr>${ordenados.map(([, v]) => v).join('')}</w:rPr>`;
}

function tramo(texto: string, rpr: string): string {
  // Los saltos y tabulaciones dentro del texto pasan a ser elementos de Word.
  const partes = texto.split(/(\n|\t)/).filter((p) => p !== '');
  const contenido = partes
    .map((p) => (p === '\n' ? '<w:br/>' : p === '\t' ? '<w:tab/>' : `<w:t xml:space="preserve">${escapar(p)}</w:t>`))
    .join('');
  return `<w:r>${rpr}${contenido}</w:r>`;
}

/**
 * Arma un párrafo nuevo con el formato del original: las propiedades del párrafo y la letra del primer
 * tramo con texto que no esté en negrita (o del primero, si todo es negrita). La negrita la decide cada segmento.
 */
export function rearmarParrafo(original: string, segmentos: Segmento[]): string {
  const apertura = original.match(/^<w:p(?:\s[^>]*)?>/)?.[0] ?? '<w:p>';
  const ppr = original.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? '';
  const tramosOriginales = (original.match(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g) ?? []).filter((r) => textoDeTramo(r) !== '');
  const base = tramosOriginales.find((r) => !enNegrita(r)) ?? tramosOriginales[0] ?? '';
  const rpr = base.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? '<w:rPr></w:rPr>';
  const tramos = segmentos.filter((s) => s.texto !== '').map((s) => tramo(s.texto, rprPara(rpr, s)));
  return `${apertura}${ppr}${tramos.join('')}</w:p>`;
}

/** Aplica los cambios de Claude sobre el document.xml. Los índices son los de parrafosDe. */
export function aplicarCambios(documento: string, cambios: Cambio[]): string {
  const porIndice = new Map(cambios.map((c) => [c.indice, c]));
  let i = -1;
  return documento.replace(PARRAFO, (p) => {
    i += 1;
    const c = porIndice.get(i);
    if (!c) return p;
    return c.parrafos.map((n) => rearmarParrafo(p, n.segmentos)).join('');
  });
}

/* ------------------------------------------------------------------ */
/* Claude                                                              */
/* ------------------------------------------------------------------ */
const INSTRUCCIONES = `Sos el asistente legal de FIRMA, un estudio que redacta los contratos de servicio de sus clientes. Recibís el modelo de contrato de una empresa, párrafo por párrafo y numerado, y los datos de una venta que cargó su equipo comercial. Tu trabajo es completar el modelo para esa venta. Un abogado de FIRMA revisa el resultado antes de que se firme, así que es mejor marcar una duda que adivinar.

Qué cambiar
- Solo los párrafos que necesitan datos de la venta: marcadores (entre corchetes o similares), fecha del contrato, nombre, documento, domicilio, correo, servicio, montos, plan de pagos. El resto del texto legal queda igual, palabra por palabra, sin corregir estilo.
- Devolvé cada párrafo cambiado completo, no solo el fragmento, partido en segmentos. En el modelo, lo que está entre ** va en negrita: mantené esa negrita con negrita en true en el segmento que corresponda, y no escribas los ** en el texto.
- Montos con el mismo formato que usa el modelo (por ejemplo USD 1.500) y, si el modelo lo pide, también en letras, en mayúsculas.
- Plan de pagos: un párrafo por pago, copiando la forma del modelo. Si el modelo trae una línea de cuota de ejemplo, repetila tantas veces como pagos haya (varios elementos en "parrafos"). Si sobra una línea, eliminala (lista "parrafos" vacía). Un pago hecho antes del día del contrato, o ese mismo día, se redacta como ya efectuado y no como vencimiento futuro.
- Anticipo más cuotas tiene que dar el total. Si no cierra, respetá los pagos cargados, marcá el total y explicalo en avisos.

Condiciones acordadas
- El texto libre de condiciones lo escribe un vendedor y puede ser informal. Interpretalo como lo haría un abogado: descuentos, bonificaciones, plazos especiales, pagos parciales, lo que sea.
- Si las condiciones son más específicas que el plan cargado, mandan las condiciones. Si lo contradicen y no está claro cuál vale, usá el plan cargado, marcá la parte dudosa y avisalo.
- Un descuento o condición especial que cambie el precio tiene que quedar reflejado donde el contrato habla del precio. Si para eso tenés que redactar texto nuevo, hacelo breve, en el mismo tono del modelo, y avisalo.

Datos que faltan
- No inventes datos. Donde falte algo escribí un marcador corto, por ejemplo [COMPLETAR: domicilio], en un segmento con completar en true (sale en rojo). El resto de los segmentos van con completar en false.
- Si falta el documento de identidad y la frase que lo menciona se puede quitar sin romper la oración, quitala en lugar de marcarla.
- La fecha del contrato es la del onboarding si está cargada. Si no, la de hoy.

Avisos
- En avisos van frases cortas para el abogado que revisa: lo que marcaste, lo que interpretaste de las condiciones, lo que redactaste nuevo y cualquier inconsistencia. Sin avisos si todo fue directo.
- En resumen, una oración con lo que quedó armado.

Los índices son los números entre corchetes del modelo. No cambies párrafos que no aparecen.`;

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cambios', 'avisos', 'resumen'],
  properties: {
    cambios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['indice', 'parrafos'],
        properties: {
          indice: { type: 'integer' },
          parrafos: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['segmentos'],
              properties: {
                segmentos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['texto', 'negrita', 'completar'],
                    properties: { texto: { type: 'string' }, negrita: { type: 'boolean' }, completar: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    avisos: { type: 'array', items: { type: 'string' } },
    resumen: { type: 'string' },
  },
} as const;

interface RespuestaClaude {
  cambios: Cambio[];
  avisos: string[];
  resumen: string;
}

async function completarConClaude(parrafos: string[], venta: Record<string, unknown>): Promise<RespuestaClaude> {
  const modelo = parrafos
    .map((p, i) => [i, textoDeParrafo(p, true)] as const)
    .filter(([, t]) => t.trim() !== '')
    .map(([i, t]) => `[${i}] ${t}`)
    .join('\n');

  const client = new Anthropic();
  const respuesta = await client.beta.messages
    .stream({
      model: MODELO_CLAUDE,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: { type: 'json_schema', schema: ESQUEMA } },
      system: INSTRUCCIONES,
      messages: [
        {
          role: 'user',
          content: `<venta>\n${JSON.stringify(venta, null, 2)}\n</venta>\n\n<modelo>\n${modelo}\n</modelo>`,
        },
      ],
    })
    .finalMessage();

  if (respuesta.stop_reason === 'refusal') throw new Error('Claude no completó este contrato. Armalo a mano desde el modelo.');
  if (respuesta.stop_reason === 'max_tokens') throw new Error('El contrato es demasiado largo para armarlo de una vez.');
  const texto = respuesta.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  let datos: RespuestaClaude;
  try {
    datos = JSON.parse(texto) as RespuestaClaude;
  } catch {
    throw new Error('Claude devolvió una respuesta que no se pudo leer. Probá de nuevo.');
  }
  // Solo se aceptan índices que existen en el modelo.
  datos.cambios = (datos.cambios ?? []).filter((c) => Number.isInteger(c.indice) && c.indice >= 0 && c.indice < parrafos.length);
  datos.avisos = (datos.avisos ?? []).filter((a) => typeof a === 'string' && a.trim()).slice(0, 30);
  return datos;
}

/* ------------------------------------------------------------------ */
/* Drive, con la cuenta de servicio actuando en nombre de un usuario   */
/* ------------------------------------------------------------------ */
interface CredencialesGoogle {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

async function tokenDrive(): Promise<string> {
  const crudo = process.env.GOOGLE_CREDS_JSON;
  if (!crudo) throw new Error('Falta GOOGLE_CREDS_JSON en el servidor.');
  const cred = JSON.parse(crudo) as CredencialesGoogle;
  const aud = cred.token_uri || 'https://oauth2.googleapis.com/token';
  const ahora = Math.floor(Date.now() / 1000);
  const reclamos: Record<string, unknown> = { iss: cred.client_email, scope: 'https://www.googleapis.com/auth/drive', aud, iat: ahora, exp: ahora + 3600 };
  if (process.env.GOOGLE_SUBJECT) reclamos.sub = process.env.GOOGLE_SUBJECT;
  const base = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(reclamos))}`;
  const firma = createSign('RSA-SHA256').update(base).sign(cred.private_key);
  const r = await fetch(aud, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${base}.${b64url(firma)}` }),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!r.ok || !j.access_token) throw new Error(`Google no dio acceso a Drive. ${j.error_description || j.error || r.status}`);
  return j.access_token;
}

/** Acepta el id de la carpeta o su link de Drive. */
export function idCarpeta(valor: string): string | null {
  const v = valor.trim();
  const m = v.match(/\/folders\/([\w-]{10,})/) || v.match(/[?&]id=([\w-]{10,})/);
  if (m) return m[1];
  return /^[\w-]{10,}$/.test(v) ? v : null;
}

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function subirADrive(archivo: Uint8Array, nombre: string, carpeta: string, existente: string | null): Promise<{ id: string; url: string }> {
  const token = await tokenDrive();
  const limite = `firma${Date.now()}`;
  const metadatos = existente ? { name: nombre } : { name: nombre, parents: [carpeta], mimeType: MIME_DOCX };
  const cuerpo = Buffer.concat([
    Buffer.from(`--${limite}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadatos)}\r\n--${limite}\r\ncontent-type: ${MIME_DOCX}\r\n\r\n`),
    Buffer.from(archivo),
    Buffer.from(`\r\n--${limite}--`),
  ]);
  const enviar = (metodo: 'POST' | 'PATCH', id?: string) =>
    fetch(`https://www.googleapis.com/upload/drive/v3/files${id ? `/${id}` : ''}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`, {
      method: metodo,
      headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${limite}` },
      body: cuerpo,
    });
  let r = existente ? await enviar('PATCH', existente) : await enviar('POST');
  // Si el archivo anterior se borró o se movió, se crea uno nuevo.
  if (existente && r.status === 404) {
    const nuevo = Buffer.concat([
      Buffer.from(`--${limite}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nombre, parents: [carpeta], mimeType: MIME_DOCX })}\r\n--${limite}\r\ncontent-type: ${MIME_DOCX}\r\n\r\n`),
      Buffer.from(archivo),
      Buffer.from(`\r\n--${limite}--`),
    ]);
    r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${limite}` },
      body: nuevo,
    });
  }
  const j = (await r.json().catch(() => ({}))) as { id?: string; webViewLink?: string; error?: { message?: string } };
  if (!r.ok || !j.id) throw new Error(`Drive no aceptó el archivo. ${j.error?.message ?? r.status}`);
  return { id: j.id, url: j.webViewLink ?? `https://drive.google.com/file/d/${j.id}/view` };
}

/* ------------------------------------------------------------------ */
/* Datos de la venta                                                   */
/* ------------------------------------------------------------------ */
interface Cliente {
  id: string;
  organizacion_id: string;
  codigo: string | null;
  nombre: string;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  domicilio?: string | null;
  servicio: string | null;
  monto_total: number | null;
  moneda: string;
  modalidad: 'PIF' | 'Cuotas';
  fecha_onboarding: string | null;
  responsable: string | null;
  notas: string | null;
  condiciones: string | null;
  estado_firma: string;
}

const fechaLocal = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA });

function limpiarNombre(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
}

/* ------------------------------------------------------------------ */
export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);
  if (!process.env.ANTHROPIC_API_KEY) return error('Falta ANTHROPIC_API_KEY en el servidor.', 500);

  // 1. Quién pide y si puede ver el CRM de esa empresa.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data: quien, error: errUsuario } = await sb.auth.getUser(token);
  if (errUsuario || !quien?.user) return error('Sesión inválida o vencida.', 401);
  const { data: perfil } = await sb.from('perfiles').select('rol, activo, organizacion_id').eq('id', quien.user.id).maybeSingle();
  if (!perfil || !perfil.activo) return error('Tu cuenta no está habilitada.', 403);
  const esAdmin = perfil.rol === 'admin';

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error('Pedido mal formado.');
  }
  const clienteId = String(cuerpo.cliente_id || '');
  if (!UUID.test(clienteId)) return error('Falta el cliente.');

  const { data: cliente } = await sb.from('crm_clientes').select('*').eq('id', clienteId).maybeSingle<Cliente>();
  if (!cliente) return error('No existe ese cliente.', 404);
  if (!esAdmin && (perfil.organizacion_id !== cliente.organizacion_id || !ROLES_CRM.includes(perfil.rol))) return error('No tenés acceso a este cliente.', 403);
  if (cliente.estado_firma === 'Firmado' && !esAdmin) return error('El contrato ya está firmado. Si hay que rehacerlo, pedíselo a FIRMA.', 409);

  const { data: org } = await sb.from('organizaciones').select('id, nombre, razon_social, pais, activa, drive_carpeta_revision').eq('id', cliente.organizacion_id).maybeSingle();
  if (!org || (!esAdmin && !org.activa)) return error('La empresa no está activa.', 403);

  const { data: previo } = await sb.from('crm_borradores').select('drive_archivo_id').eq('cliente_id', cliente.id).maybeSingle();
  const marcar = (cambios: Record<string, unknown>) =>
    sb.from('crm_borradores').upsert({ cliente_id: cliente.id, organizacion_id: cliente.organizacion_id, generado_por: quien.user.id, generado_en: new Date().toISOString(), ...cambios });

  // 2. Modelo del servicio (el de pago total si es PIF y hay uno) y carpeta de Drive.
  const { data: servicio } = cliente.servicio
    ? await sb.from('crm_servicios').select('clave, nombre, precio, modelo_ruta, modelo_pif_ruta').eq('organizacion_id', cliente.organizacion_id).eq('clave', cliente.servicio).maybeSingle()
    : { data: null };
  const ruta = (cliente.modalidad === 'PIF' && servicio?.modelo_pif_ruta) || servicio?.modelo_ruta || null;
  // La ruta tiene que ser de un modelo de la misma empresa.
  if (!ruta || !ruta.startsWith(`${cliente.organizacion_id}/`)) {
    await marcar({ estado: 'sin_modelo', error: 'Este servicio no tiene modelo de contrato cargado.', avisos: [] });
    return json({ estado: 'sin_modelo', avisos: [] });
  }
  const carpeta = org.drive_carpeta_revision ? idCarpeta(org.drive_carpeta_revision) : null;
  if (!carpeta) {
    await marcar({ estado: 'sin_carpeta', error: 'La empresa no tiene carpeta de revisión en Drive.', avisos: [] });
    return json({ estado: 'sin_carpeta', avisos: [] });
  }

  await marcar({ estado: 'generando', error: null, avisos: [] });

  try {
    // 3. Modelo y datos de la venta.
    const { data: blob, error: errBajada } = await sb.storage.from('modelos').download(ruta);
    if (errBajada || !blob) throw new Error('No se pudo leer el modelo de contrato.');
    const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const documento = zip['word/document.xml'];
    if (!documento) throw new Error('El modelo no es un Word válido.');
    const xml = strFromU8(documento);
    const parrafos = parrafosDe(xml);

    const { data: pagos } = await sb.from('crm_pagos').select('monto, vencimiento, estado, fecha_pago, nota').eq('cliente_id', cliente.id).order('vencimiento', { ascending: true, nullsFirst: true });
    const venta = {
      hoy: fechaLocal(new Date()),
      empresa: { nombre: org.nombre, razon_social: org.razon_social, pais: org.pais },
      cliente: { codigo: cliente.codigo, nombre: cliente.nombre, documento: cliente.dni, domicilio: cliente.domicilio ?? null, email: cliente.email, telefono: cliente.telefono },
      servicio: servicio ? { clave: servicio.clave, nombre: servicio.nombre, ticket_de_lista: servicio.precio } : cliente.servicio,
      monto_total_acordado: cliente.monto_total,
      moneda: cliente.moneda,
      modalidad: cliente.modalidad === 'PIF' ? 'Pago total' : 'Cuotas',
      fecha_onboarding: cliente.fecha_onboarding ? fechaLocal(new Date(cliente.fecha_onboarding)) : null,
      pagos: (pagos ?? []).map((p) => ({ monto: p.monto, vencimiento: p.vencimiento, estado: p.estado, fecha_pago: p.fecha_pago, nota: p.nota })),
      condiciones_acordadas: cliente.condiciones,
      notas_del_vendedor: cliente.notas,
    };

    // 4. Claude completa el modelo.
    const r = await completarConClaude(parrafos, venta);
    const marcados = r.cambios.some((c) => c.parrafos.some((p) => p.segmentos.some((s) => s.completar)));
    zip['word/document.xml'] = strToU8(aplicarCambios(xml, r.cambios));
    const archivo = zipSync(zip, { level: 6 });

    // 5. A la carpeta de revisión.
    const nombre = limpiarNombre(`${cliente.codigo ?? ''} ${cliente.nombre} · ${servicio?.nombre || cliente.servicio || 'Contrato'}${marcados ? ' [INCOMPLETO]' : ''}`) + '.docx';
    const subido = await subirADrive(archivo, nombre, carpeta, previo?.drive_archivo_id ?? null);
    const avisos = r.resumen ? [r.resumen, ...r.avisos] : r.avisos;
    const estado = marcados || r.avisos.length > 0 ? 'revisar' : 'listo';
    await marcar({ estado, drive_archivo_id: subido.id, drive_url: subido.url, avisos, error: null });
    return json({ estado, drive_url: subido.url, avisos });
  } catch (e) {
    const mensaje = e instanceof Anthropic.APIError ? `Claude no respondió (${e.status ?? 'sin conexión'}). Probá de nuevo en unos minutos.` : e instanceof Error ? e.message : 'Error inesperado.';
    await marcar({ estado: 'error', error: mensaje.slice(0, 400) });
    return error(mensaje, 502);
  }
}

export function GET(): Response {
  return error('Método no permitido.', 405);
}

/**
 * Avisos por mail del portal (Vercel Function). Salen por Resend con la
 * plantilla de FIRMA. Requiere sesión.
 *
 * POST /api/portal/avisos  { tipo, id }
 *   novedad    Novedad de un asunto. La pide quien la escribió, una sola vez.
 *              Si la escribió FIRMA, avisa al titular y al CSM de la empresa.
 *              Si la escribió el cliente, avisa a FIRMA.
 *   documento  Documento nuevo de una empresa. Solo FIRMA, una vez por
 *              documento. Avisa a quienes lo pueden ver en el portal.
 *   Responde { avisados } con la cantidad de personas a las que salió.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { enviarMail, mailDisponible, plantillaMail } from '../_lib/mail.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIRMA_MAIL = 'agustin@firmasvc.com';

const ESTADO_ASUNTO: Record<string, string> = {
  en_curso: 'En curso',
  espera_cliente: 'Esperando tu respuesta',
  espera_tercero: 'Esperando a un tercero',
  finalizado: 'Finalizado',
};

interface Quien {
  id: string;
  rol: string;
  email: string;
  nombre: string | null;
  organizacion_id: string | null;
}

interface Destinatario {
  email: string;
  nombre: string | null;
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

function basePortal(request: Request): string {
  return (process.env.PORTAL_URL || new URL(request.url).origin).replace(/\/$/, '');
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Texto de varias líneas, escapado y con sus saltos. */
const conSaltos = (s: string): string => escapar(s).replace(/\n/g, '<br>');

async function quienLlama(sb: SupabaseClient, request: Request): Promise<Quien | Response> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data, error: errUsuario } = await sb.auth.getUser(token);
  if (errUsuario || !data?.user) return error('Sesión inválida o vencida.', 401);
  const { data: perfil } = await sb.from('perfiles').select('rol, activo, organizacion_id, email, nombre').eq('id', data.user.id).maybeSingle();
  if (!perfil || !perfil.activo) return error('Tu cuenta no está habilitada.', 403);
  return { id: data.user.id, rol: perfil.rol, email: perfil.email, nombre: perfil.nombre ?? null, organizacion_id: perfil.organizacion_id };
}

/** Manda el mismo aviso a cada persona por separado, así nadie ve los mails de los demás. */
async function avisarA(destinatarios: Destinatario[], armar: (d: Destinatario) => { asunto: string; html: string }, responderA: string | null): Promise<number> {
  let enviados = 0;
  const vistos = new Set<string>();
  for (const d of destinatarios) {
    const email = d.email.toLowerCase();
    if (vistos.has(email)) continue;
    vistos.add(email);
    const { asunto, html } = armar(d);
    const fallo = await enviarMail({ nombreRemitente: 'FIRMA', direccion: process.env.PORTAL_MAIL_DIRECCION || 'portal@firmasvc.com', para: [d.email], asunto, html, responderA });
    if (!fallo) enviados++;
  }
  return enviados;
}

const hola = (d: Destinatario) => (d.nombre ? `Hola ${escapar(d.nombre.split(' ')[0])}.` : 'Hola.');

async function avisoNovedad(sb: SupabaseClient, quien: Quien, id: string, base: string): Promise<Response> {
  const { data: nov } = await sb.from('asunto_novedades').select('*').eq('id', id).maybeSingle();
  if (!nov) return error('No existe esa novedad.', 404);
  if (nov.autor_id !== quien.id) return error('Solo quien escribió la novedad puede avisar.', 403);
  if (nov.avisado_en) return json({ ok: true, avisados: nov.avisados, ya: true });
  if (Date.now() - Date.parse(nov.creado_en) > 3_600_000) return error('Esa novedad es vieja para avisar.', 409);

  const { data: asunto } = await sb.from('asuntos').select('id, titulo, estado, proximo_paso, organizacion_id').eq('id', nov.asunto_id).maybeSingle();
  if (!asunto) return error('No existe ese asunto.', 404);
  const { data: org } = await sb.from('organizaciones').select('nombre').eq('id', asunto.organizacion_id).maybeSingle();
  const empresa = (org?.nombre as string | undefined) ?? 'La empresa';
  const deFirma = quien.rol === 'admin';
  const url = `${base}/portal/asuntos/${asunto.id}`;

  let destinatarios: Destinatario[];
  if (deFirma) {
    const { data } = await sb.from('perfiles').select('email, nombre').eq('organizacion_id', asunto.organizacion_id).eq('activo', true).in('rol', ['titular', 'csm', 'miembro']);
    destinatarios = (data ?? []) as Destinatario[];
  } else {
    const { data } = await sb.from('perfiles').select('email, nombre').eq('rol', 'admin').eq('activo', true);
    destinatarios = ((data ?? []) as Destinatario[]).length ? (data as Destinatario[]) : [{ email: FIRMA_MAIL, nombre: null }];
  }

  const avisados = await avisarA(
    destinatarios,
    (d) => {
      const parrafos = deFirma
        ? [hola(d), `Hay una novedad en <strong>${escapar(asunto.titulo)}</strong>:`, `<em>${conSaltos(nov.texto)}</em>`]
        : [hola(d), `${escapar(quien.nombre || quien.email)}, de <strong>${escapar(empresa)}</strong>, escribió en <strong>${escapar(asunto.titulo)}</strong>:`, `<em>${conSaltos(nov.texto)}</em>`];
      if (deFirma) {
        parrafos.push(`Estado: <strong>${escapar(ESTADO_ASUNTO[asunto.estado] ?? asunto.estado)}</strong>.`);
        if (asunto.proximo_paso) parrafos.push(`Próximo paso: ${escapar(asunto.proximo_paso)}`);
      }
      return {
        asunto: deFirma ? `Novedad en ${asunto.titulo}` : `${empresa} escribió en ${asunto.titulo}`,
        html: plantillaMail({
          seccion: 'Estado de asuntos',
          titulo: deFirma ? 'Hay una novedad en tu asunto' : 'Te escribieron en un asunto',
          anticipo: nov.texto.slice(0, 120),
          parrafos,
          boton: { texto: deFirma ? 'Ver el asunto' : 'Responder en el portal', url },
          pie: deFirma ? 'Podés responder desde el portal. Si no esperabas este mail, avisanos.' : undefined,
        }),
      };
    },
    deFirma ? FIRMA_MAIL : quien.email,
  );

  await sb.from('asunto_novedades').update({ avisado_en: new Date().toISOString(), avisados }).eq('id', id);
  return json({ ok: true, avisados });
}

async function avisoDocumento(sb: SupabaseClient, quien: Quien, id: string, base: string): Promise<Response> {
  if (quien.rol !== 'admin') return error('Solo FIRMA avisa documentos nuevos.', 403);
  const { data: doc } = await sb.from('documentos').select('*').eq('id', id).maybeSingle();
  if (!doc) return error('No existe ese documento.', 404);
  if (!doc.organizacion_id) return error('Los documentos de la biblioteca común no se avisan por mail.', 409);
  if (!doc.activo) return error('El documento está oculto.', 409);
  const { count } = await sb.from('registro_accesos').select('id', { count: 'exact', head: true }).eq('accion', 'aviso_documento').eq('detalle->>documento_id', id);
  if ((count ?? 0) > 0) return json({ ok: true, avisados: 0, ya: true });

  // Los mismos que lo ven en el portal: protocolos para todo el equipo, documentos legales para titular y CSM, y las áreas.
  const roles = doc.es_protocolo ? ['titular', 'csm', 'miembro', 'closer', 'setter'] : ['titular', 'csm', 'miembro'];
  const { data } = await sb.from('perfiles').select('email, nombre, rol, areas').eq('organizacion_id', doc.organizacion_id).eq('activo', true).in('rol', roles);
  const areas: string[] = doc.areas ?? [];
  const destinatarios = ((data ?? []) as (Destinatario & { rol: string; areas: string[] | null })[]).filter(
    (p) => areas.length === 0 || p.rol === 'titular' || (p.areas ?? []).some((a) => areas.includes(a)),
  );

  const avisados = await avisarA(
    destinatarios,
    (d) => ({
      asunto: `Nuevo documento: ${doc.titulo}`,
      html: plantillaMail({
        seccion: 'Documentos',
        titulo: 'Tenés un documento nuevo',
        anticipo: doc.titulo,
        parrafos: [
          hola(d),
          `FIRMA sumó <strong>${escapar(doc.titulo)}</strong>${doc.version ? ` (versión ${escapar(doc.version)})` : ''} a la documentación de tu empresa.`,
          ...(doc.descripcion ? [conSaltos(doc.descripcion)] : []),
        ],
        boton: { texto: 'Ver documentos', url: `${base}/portal/documentos` },
      }),
    }),
    FIRMA_MAIL,
  );

  await sb.from('registro_accesos').insert({ usuario_id: null, actor_id: quien.id, accion: 'aviso_documento', detalle: { documento_id: id, titulo: doc.titulo, organizacion_id: doc.organizacion_id, avisados } });
  return json({ ok: true, avisados });
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);
  if (!mailDisponible()) return error('El envío de mails no está configurado.', 503);

  const quien = await quienLlama(sb, request);
  if (quien instanceof Response) return quien;

  let cuerpo: { tipo?: unknown; id?: unknown };
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return error('Pedido mal formado.');
  }
  const id = String(cuerpo?.id ?? '');
  if (!UUID.test(id)) return error('Falta el id.');
  const base = basePortal(request);

  try {
    if (cuerpo.tipo === 'novedad') return await avisoNovedad(sb, quien, id, base);
    if (cuerpo.tipo === 'documento') return await avisoDocumento(sb, quien, id, base);
    return error('Tipo de aviso desconocido.');
  } catch {
    return error('No se pudo mandar el aviso. Probá de nuevo en unos minutos.', 500);
  }
}

export function GET(): Response {
  return error('Método no permitido.', 405);
}

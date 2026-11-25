/**
 * Calidad de la IA (Vercel Function). Solo para un admin de FIRMA con la
 * verificación en dos pasos. Corre con la clave de servicio.
 *
 * POST /api/admin/ia  { accion: 'preparar_caso', corrida_id }
 *   Arma la entrada de un caso de prueba (ia_casos) desde una corrida, ya
 *   anonimizada, con lo que respondió el agente para comparar. FIRMA la
 *   revisa y la guarda desde Administración › Calidad de la IA.
 *     tina                    los mensajes de la conversación hasta esa
 *                             respuesta y lo que devolvieron sus herramientas
 *     analisis_*              la llamada con roles en lugar de nombres
 *                             (ia_contenido_analisis, migración 0075)
 *     borradores_comentarios  los hilos que Tina contestó en esa tanda
 *   La lectura queda en la bitácora de la empresa.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FALTA_SEGUNDO_FACTOR, nivelDe } from '../_lib/nivel.js';
import { anonimizador, anonimizarJson, type NombreConocido } from '../_lib/ia/anonimizar.js';
import { armarTranscripcion, type ContenidoLlamada } from '../_lib/analisis/transcripcion.js';

/** Mensajes de la conversación que entran al caso, contando la respuesta. */
const HISTORIAL = 12;

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const error = (mensaje: string, status = 400): Response => json({ error: mensaje }, status);

function clienteServicio(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface Corrida {
  id: number;
  agente: string;
  version_prompt: string;
  organizacion_id: string | null;
  referencia_tabla: string | null;
  referencia_id: string | null;
  nota: string | null;
  creado_en: string;
}

interface Preparado {
  entrada: Record<string, unknown>;
  salida: unknown;
  aviso?: string;
}

/** Nombres de la empresa y de su gente que no tienen que llegar a un caso de prueba. */
async function nombresDe(sb: SupabaseClient, org: string | null): Promise<NombreConocido[]> {
  if (!org) return [];
  const [o, p, e, c] = await Promise.all([
    sb.from('organizaciones').select('nombre, razon_social').eq('id', org).maybeSingle(),
    sb.from('perfiles').select('nombre, email').eq('organizacion_id', org).limit(500),
    sb.from('equipo_miembros').select('nombre, email').eq('organizacion_id', org).limit(500),
    sb.from('crm_clientes').select('nombre').eq('organizacion_id', org).limit(5000),
  ]);
  const lista: NombreConocido[] = [
    { valor: o.data?.nombre as string | undefined, alias: '[empresa]' },
    { valor: o.data?.razon_social as string | undefined, alias: '[empresa]' },
  ];
  for (const x of (p.data ?? []) as { nombre: string | null }[]) lista.push({ valor: x.nombre, alias: '[usuario]', partes: true });
  for (const x of (e.data ?? []) as { nombre: string | null }[]) lista.push({ valor: x.nombre, alias: '[equipo]', partes: true });
  for (const x of (c.data ?? []) as { nombre: string | null }[]) lista.push({ valor: x.nombre, alias: '[cliente]', partes: true });
  return lista;
}

async function desdeTina(sb: SupabaseClient, c: Corrida, anon: (s: string) => string): Promise<Preparado> {
  const { data: conv } = await sb.from('tina_conversaciones').select('id, organizacion_id, usuario_id').eq('id', c.referencia_id).maybeSingle();
  if (!conv) throw new Error('La conversación ya no existe.');
  // La respuesta de la corrida se guarda justo antes de anotarla: es la última de Tina hasta ese momento.
  const hasta = new Date(Date.parse(c.creado_en) + 5000).toISOString();
  const [{ data: filas }, { data: org }, { data: usuario }] = await Promise.all([
    sb.from('tina_mensajes').select('id, autor, contenido, herramientas, camino, creado_en').eq('conversacion_id', conv.id).lte('creado_en', hasta).order('id', { ascending: false }).limit(40),
    sb.from('organizaciones').select('plan').eq('id', conv.organizacion_id).maybeSingle(),
    sb.from('perfiles').select('rol').eq('id', conv.usuario_id).maybeSingle(),
  ]);
  const mensajes = ((filas ?? []) as { autor: 'usuario' | 'tina'; contenido: string; herramientas: { nombre: string; resultado?: string }[] | null; camino: string | null }[]).reverse();
  let fin = mensajes.length - 1;
  while (fin >= 0 && mensajes[fin].autor !== 'tina') fin--;
  if (fin < 1) throw new Error('No encontré la respuesta de Tina de esta corrida.');
  const respuesta = mensajes[fin];
  const antes = mensajes.slice(Math.max(0, fin - HISTORIAL + 1), fin).filter((m) => m.contenido.trim());
  while (antes.length && antes[0].autor !== 'usuario') antes.shift();
  if (!antes.length || antes[antes.length - 1].autor !== 'usuario') throw new Error('La conversación no termina en un mensaje de la persona.');

  // Lo que devolvieron las herramientas se repite en el caso, así el evaluador no toca la base.
  const herramientas: Record<string, string> = {};
  for (const h of respuesta.herramientas ?? []) if (h?.nombre && !(h.nombre in herramientas)) herramientas[h.nombre] = anon(String(h.resultado ?? ''));
  return {
    entrada: {
      plan: org?.plan === 'starter' ? 'starter' : 'eminent',
      rol: (usuario?.rol as string | undefined) ?? 'titular',
      mensajes: antes.map((m) => ({ autor: m.autor, contenido: anon(m.contenido) })),
      ...(Object.keys(herramientas).length ? { herramientas } : {}),
    },
    salida: {
      texto: anon(respuesta.contenido),
      herramientas: (respuesta.herramientas ?? []).map((h) => h.nombre),
      camino: respuesta.camino,
    },
  };
}

async function desdeAnalisis(sb: SupabaseClient, c: Corrida, anon: (s: string) => string): Promise<Preparado> {
  const { data, error: e } = await sb.rpc('ia_contenido_analisis', { p_analisis: c.referencia_id });
  if (e) throw new Error(e.message);
  const d = data as {
    sin_contenido?: boolean;
    version?: string;
    forzar_venta?: boolean;
    titulo?: string | null;
    ocurrida_en?: string;
    duracion_seg?: number | null;
    fuente?: string;
    contenido?: ContenidoLlamada;
    equipo?: { nombre: string | null; email: string | null }[];
    resultado?: unknown;
  } | null;
  if (!d) throw new Error('El análisis ya no existe.');
  if (d.sin_contenido) throw new Error('La llamada ya no tiene la transcripción guardada.');
  // La misma transcripción que vio el modelo, con roles en lugar de nombres y sin mails ni teléfonos.
  const t = armarTranscripcion(d.contenido ?? {}, d.equipo ?? []);
  const roles: Record<string, 'vendedor' | 'prospecto'> = {};
  for (const h of t.hablantes) if (h.rol !== 'hablante') roles[h.etiqueta] = h.rol;
  return {
    entrada: {
      version: d.version ?? 'venta-1.1',
      forzar_venta: Boolean(d.forzar_venta),
      titulo: anon(t.seudonimizar(d.titulo ?? 'Llamada')),
      ocurrida_en: d.ocurrida_en,
      duracion_seg: d.duracion_seg ?? null,
      fuente: d.fuente ?? 'manual',
      contenido: { transcripcion: t.lineas.map((l) => ({ hablante: l.etiqueta, email: null, segundo: l.segundo, texto: anon(l.texto) })), roles },
      equipo: [],
    },
    salida: d.resultado ?? null,
    ...(t.recortada ? { aviso: 'La llamada es muy larga y quedó recortada como la vio el modelo.' } : {}),
  };
}

async function desdeBorradores(sb: SupabaseClient, c: Corrida, anon: (s: string) => string): Promise<Preparado> {
  // Los borradores de la tanda se guardan segundos después de anotar la corrida.
  const t = Date.parse(c.creado_en);
  const { data: borradores } = await sb
    .from('comentario_borradores')
    .select('comentario_id, hasta, pedido, respuesta, clausula, nota')
    .eq('archivo_id', c.referencia_id)
    .gte('creado_en', new Date(t - 60_000).toISOString())
    .lte('creado_en', new Date(t + 10 * 60_000).toISOString())
    .limit(25);
  const lista = (borradores ?? []) as { comentario_id: string; hasta: string; pedido: string; respuesta: string; clausula: string | null; nota: string | null }[];
  if (!lista.length) throw new Error('Ya no están los borradores de esta corrida: se volvieron a preparar o se borró el documento.');
  const ids = lista.map((b) => b.comentario_id);
  const [{ data: raices }, { data: respuestas }, { data: admins }] = await Promise.all([
    sb.from('asunto_comentarios').select('id, padre_id, cita, ancla, texto, autor_id, creado_en').in('id', ids),
    sb.from('asunto_comentarios').select('id, padre_id, cita, ancla, texto, autor_id, creado_en').in('padre_id', ids).order('creado_en', { ascending: true }),
    sb.from('perfiles').select('id').eq('rol', 'admin'),
  ]);
  type Fila = { id: string; padre_id: string | null; cita: string | null; ancla: { pagina?: number | null } | null; texto: string; autor_id: string | null; creado_en: string };
  const deFirma = new Set(((admins ?? []) as { id: string }[]).map((a) => a.id));
  const raizDe = new Map(((raices ?? []) as Fila[]).map((r) => [r.id, r]));
  const hilos: Record<string, unknown>[] = [];
  const salida: Record<string, unknown>[] = [];
  lista.forEach((b, i) => {
    const raiz = raizDe.get(b.comentario_id);
    if (!raiz) return;
    const id = `h${i + 1}`;
    const mensajes = [raiz, ...((respuestas ?? []) as Fila[]).filter((r) => r.padre_id === raiz.id && r.creado_en <= b.hasta)];
    hilos.push({
      id,
      sobre: raiz.cita ? 'una frase resaltada' : 'el documento entero',
      ...(raiz.ancla?.pagina ? { hoja: raiz.ancla.pagina } : {}),
      ...(raiz.cita ? { frase_resaltada: anon(raiz.cita) } : {}),
      mensajes: mensajes.map((m) => ({ de: m.autor_id && deFirma.has(m.autor_id) ? 'FIRMA' : 'cliente', texto: anon(m.texto) })),
    });
    salida.push(anonimizarJson({ id, pedido: b.pedido, respuesta: b.respuesta, clausula: b.clausula ?? '', nota: b.nota ?? '' }, anon));
  });
  return {
    entrada: { hilos },
    salida,
    aviso: 'El documento no entra al caso. Si hace falta, pegá el texto que importa en documento.',
  };
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data: quien, error: errU } = await sb.auth.getUser(token);
  if (errU || !quien?.user) return error('Sesión inválida o vencida.', 401);
  const { data: perfil } = await sb.from('perfiles').select('rol, activo').eq('id', quien.user.id).maybeSingle();
  if (!perfil || perfil.rol !== 'admin' || !perfil.activo) return error('No tenés permisos de administración.', 403);
  if (nivelDe(token) !== 'aal2') return error(FALTA_SEGUNDO_FACTOR, 403);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error('Pedido mal formado.');
  }
  if (cuerpo.accion !== 'preparar_caso') return error('Acción desconocida.');
  const corridaId = Number(cuerpo.corrida_id);
  if (!Number.isInteger(corridaId) || corridaId <= 0) return error('Falta la corrida.');

  const { data: c } = await sb
    .from('ia_corridas')
    .select('id, agente, version_prompt, organizacion_id, referencia_tabla, referencia_id, nota, creado_en')
    .eq('id', corridaId)
    .maybeSingle();
  const corrida = c as Corrida | null;
  if (!corrida) return error('No existe esa corrida.', 404);
  if (!corrida.referencia_id) return error('Esta corrida no apunta a ningún registro.');

  try {
    const anon = anonimizador(await nombresDe(sb, corrida.organizacion_id));
    const preparado =
      corrida.agente === 'tina'
        ? await desdeTina(sb, corrida, anon)
        : corrida.agente.startsWith('analisis_')
          ? await desdeAnalisis(sb, corrida, anon)
          : corrida.agente === 'borradores_comentarios'
            ? await desdeBorradores(sb, corrida, anon)
            : null;
    if (!preparado) return error('Todavía no sé armar casos de este agente.');
    if (corrida.organizacion_id) {
      await sb.from('registro_accesos').insert({
        usuario_id: quien.user.id,
        actor_id: quien.user.id,
        accion: 'ia_caso_preparado',
        organizacion_id: corrida.organizacion_id,
        objeto_tipo: 'ia_corridas',
        objeto_id: String(corrida.id),
        detalle: { organizacion_id: corrida.organizacion_id, agente: corrida.agente },
      });
    }
    return json({ agente: corrida.agente, version_prompt: corrida.version_prompt, nota: corrida.nota, ...preparado });
  } catch (e) {
    return error(e instanceof Error ? e.message : 'No pude armar el caso.');
  }
}

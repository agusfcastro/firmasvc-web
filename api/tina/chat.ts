/**
 * Chat de Tina (Vercel Function). Requiere sesión de un usuario de un cliente.
 *
 * POST /api/tina/chat  { mensaje, conversacion_id? }
 *   Responde un flujo de líneas JSON (application/x-ndjson):
 *     { tipo: 'inicio', conversacion_id }
 *     { tipo: 'texto', delta }                 la respuesta a medida que llega
 *     { tipo: 'herramienta', nombre }          Tina está usando una herramienta
 *     { tipo: 'tarjeta', datos }               ficha para mostrar con su botón
 *     { tipo: 'fin', camino, costo_usd }
 *     { tipo: 'error', mensaje }
 *
 * 1. Verifica la sesión y carga el cliente, el plan y el rol.
 * 2. Arma el prompt desde docs/TINA_SYSTEM_PROMPT.md: la parte estática
 *    primero, con caché, y el contexto del cliente después.
 * 3. Llama a la API de Claude con streaming y las herramientas. crear_ticket
 *    solo se ofrece a Eminent, y además lo controlan el código y la base.
 * 4. Ejecuta cada herramienta en el servidor verificando permisos.
 * 5. Guarda cada mensaje con sus tokens y su costo.
 * La clave ANTHROPIC_API_KEY vive solo en las variables del servidor.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FALTA_SEGUNDO_FACTOR, nivelDe } from '../_lib/nivel.js';
import { SIN_ACCESO, SIN_CLIENTE_USUARIO, accesoVigente, clienteDelUsuario } from '../_lib/acceso.js';
import { armarPrompt } from '../_lib/tina/prompt.js';
import { CAMINO_DE, definiciones, ejecutar, type Sesion } from '../_lib/tina/herramientas.js';
import { consumoVacio, sumarUso } from '../_lib/tina/precios.js';

const MODELO = 'claude-opus-5-5';
const MAX_VUELTAS = 6;
const MAX_MENSAJE = 4000;
const HISTORIAL = 30;
/** Tope de mensajes por persona y por día, para cuidar el costo. */
const TOPE_DIARIO = 150;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROTULO_ROL: Record<string, string> = {
  titular: 'titular',
  csm: 'account manager',
  miembro: 'account manager',
  closer: 'closer',
  setter: 'setter',
};

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

const basePortal = (): string => (process.env.PORTAL_URL || 'https://www.firmasvc.com').replace(/\/$/, '');

const ahoraArgentina = (): string =>
  new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function inicioDelDiaArgentina(): string {
  const ar = new Date(Date.now() - 3 * 3600_000);
  return new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()) + 3 * 3600_000).toISOString();
}

const lista = (items: string[], vacio: string): string => (items.length ? items.map((i) => `- ${i}`).join('\n') : vacio);

/** Contexto del cliente para el prompt. Lee con el token del usuario: solo lo que ve en el portal. */
async function contexto(s: Sesion, org: { nombre: string; razon_social: string | null; pais: string }) {
  const desde = inicioDelDiaArgentina();
  const hasta = new Date(new Date(desde).getTime() + 24 * 3600_000).toISOString();
  const [asuntos, casos, eventos, contratos] = await Promise.all([
    s.db.from('asuntos').select('codigo, titulo, estado, vence_en').eq('organizacion_id', s.orgId).neq('estado', 'finalizado').order('creado_en', { ascending: false }).limit(10),
    s.db.from('crm_casos').select('causa, etapa, semaforo').eq('organizacion_id', s.orgId).neq('etapa', 'cerrado').limit(10),
    s.db.from('eventos_cliente').select('tipo, titulo, fecha').eq('organizacion_id', s.orgId).gte('fecha', desde).lt('fecha', hasta).order('fecha').limit(20),
    s.db.from('documentos').select('titulo').eq('activo', true).eq('seccion', 'servicio').order('titulo').limit(30),
  ]);
  const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });
  const casosAbiertos = [
    ...((asuntos.data ?? []) as { codigo: string | null; titulo: string; estado: string; vence_en: string | null }[]).map(
      (a) => `Asunto ${a.codigo ?? ''} ${a.titulo} · ${a.estado.replace(/_/g, ' ')}${a.vence_en ? ` · vence ${a.vence_en.slice(0, 10)}` : ''}`,
    ),
    ...((casos.data ?? []) as { causa: string; etapa: string; semaforo: string }[]).map((c) => `Caso de conflicto · causa ${c.causa} · etapa ${c.etapa} · semáforo ${c.semaforo}`),
  ];
  return armarPrompt({
    plan: s.plan === 'eminent' ? 'Eminent' : 'Starter',
    telefonoResponsable: s.responsable?.telefono || 'sin teléfono cargado',
    clienteNombre: org.nombre,
    empresa: org.razon_social || org.nombre,
    pais: org.pais,
    tipoSocietario: 'sin dato',
    usuarioNombre: s.nombre,
    usuarioRol: ROTULO_ROL[s.rol] ?? s.rol,
    fechaHoraLocal: ahoraArgentina(),
    responsableNombre: s.responsable?.nombre || 'el equipo de FIRMA',
    casosAbiertos: lista(casosAbiertos, 'Ninguno.'),
    eventosHoy: lista(((eventos.data ?? []) as { tipo: string; titulo: string; fecha: string }[]).map((e) => `${hora(e.fecha)} · ${e.tipo} · ${e.titulo}`), 'Ninguno.'),
    listaContratos: lista(((contratos.data ?? []) as { titulo: string }[]).map((c) => c.titulo), 'No hay contratos cargados.'),
  });
}

/** Historial en texto: lo que dijeron el usuario y Tina, en orden. */
async function historial(sb: SupabaseClient, conversacionId: string): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const { data } = await sb
    .from('tina_mensajes')
    .select('autor, contenido')
    .eq('conversacion_id', conversacionId)
    .order('id', { ascending: false })
    .limit(HISTORIAL);
  const filas = ((data ?? []) as { autor: 'usuario' | 'tina'; contenido: string }[]).reverse().filter((f) => f.contenido.trim());
  // Tiene que empezar con el usuario.
  while (filas.length && filas[0].autor !== 'usuario') filas.shift();
  return filas.map((f) => ({ role: f.autor === 'usuario' ? 'user' : 'assistant', content: f.contenido }));
}

const RESPUESTA_RECHAZO = 'Perdón, eso no lo puedo responder. Si es un tema de tu negocio, contame un poco más o escribile a tu responsable en FIRMA.';

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configurado Supabase.', 500);
  if (!process.env.ANTHROPIC_API_KEY) return error('Tina todavía no está activada en el servidor.', 503);

  // 1. Sesión, cliente, plan y rol.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data: u, error: errU } = await sb.auth.getUser(token);
  if (errU || !u?.user) return error('Sesión inválida o vencida.', 401);
  const usuarioId = u.user.id;
  const { data: perfil } = await sb.from('perfiles').select('rol, activo, organizacion_id, nombre, email, areas').eq('id', usuarioId).maybeSingle();
  if (!perfil || !perfil.activo) return error('Tu cuenta no está habilitada.', 403);
  if (perfil.rol === 'admin') return error(nivelDe(token) === 'aal2' ? 'Tina atiende a los clientes. Para probarla, entrá con un usuario de una empresa.' : FALTA_SEGUNDO_FACTOR, 403);
  if (!perfil.organizacion_id || !(await accesoVigente(sb, usuarioId))) return error(SIN_ACCESO, 403);
  const db = clienteDelUsuario(request);
  if (!db) return error(SIN_CLIENTE_USUARIO, 500);

  const { data: org } = await sb.from('organizaciones').select('id, nombre, razon_social, pais, plan, activa, responsable_id').eq('id', perfil.organizacion_id).maybeSingle();
  if (!org || !org.activa) return error(SIN_ACCESO, 403);
  const plan: 'starter' | 'eminent' = org.plan === 'starter' ? 'starter' : 'eminent';

  let cuerpo: { mensaje?: unknown; conversacion_id?: unknown };
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return error('Pedido inválido.');
  }
  const mensaje = typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje.trim() : '';
  if (!mensaje) return error('Escribí un mensaje.');
  if (mensaje.length > MAX_MENSAJE) return error(`El mensaje es muy largo. Hasta ${MAX_MENSAJE} caracteres.`);

  // Tope diario por persona.
  const { count } = await sb
    .from('tina_mensajes')
    .select('id, tina_conversaciones!inner(usuario_id)', { count: 'exact', head: true })
    .eq('autor', 'usuario')
    .eq('tina_conversaciones.usuario_id', usuarioId)
    .gte('creado_en', inicioDelDiaArgentina());
  if ((count ?? 0) >= TOPE_DIARIO) return error('Llegaste al máximo de mensajes de hoy. Mañana seguimos.', 429);

  // Conversación: la que pide, si es suya y del negocio activo, o una nueva.
  let conversacionId = typeof cuerpo.conversacion_id === 'string' && UUID.test(cuerpo.conversacion_id) ? cuerpo.conversacion_id : null;
  if (conversacionId) {
    const { data: c } = await sb.from('tina_conversaciones').select('id').eq('id', conversacionId).eq('usuario_id', usuarioId).eq('organizacion_id', org.id).maybeSingle();
    if (!c) conversacionId = null;
  }
  if (!conversacionId) {
    const { data: c, error: errC } = await sb
      .from('tina_conversaciones')
      .insert({ organizacion_id: org.id, usuario_id: usuarioId, titulo: mensaje.slice(0, 80) })
      .select('id')
      .single();
    if (errC || !c) return error('No se pudo abrir la conversación.', 500);
    conversacionId = c.id as string;
  }

  let responsable: Sesion['responsable'] = null;
  if (org.responsable_id) {
    const { data: r } = await sb.from('perfiles').select('id, nombre, email, telefono').eq('id', org.responsable_id).maybeSingle();
    if (r) responsable = { id: r.id, nombre: r.nombre || 'tu responsable en FIRMA', email: r.email, telefono: r.telefono };
  }

  const sesion: Sesion = {
    usuarioId,
    rol: perfil.rol,
    areas: (perfil.areas as string[] | null) ?? [],
    nombre: perfil.nombre || perfil.email,
    orgId: org.id,
    orgNombre: org.nombre,
    plan,
    conversacionId,
    db,
    sb,
    responsable,
    base: basePortal(),
  };

  // 2. Prompt e historial. El mensaje nuevo se guarda antes de llamar a la API.
  const anteriores = await historial(sb, conversacionId);
  await sb.from('tina_mensajes').insert({ organizacion_id: org.id, conversacion_id: conversacionId, autor: 'usuario', contenido: mensaje });
  const prompt = await contexto(sesion, org);
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: prompt.estatico, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: prompt.contexto },
  ];
  const tools = definiciones(plan);
  const messages: Anthropic.Beta.BetaMessageParam[] = [...anteriores, { role: 'user', content: mensaje }];

  const cliente = new Anthropic();
  const cid = conversacionId;
  const flujo = new ReadableStream<Uint8Array>({
    async start(controller) {
      const cod = new TextEncoder();
      const enviar = (o: unknown) => controller.enqueue(cod.encode(`${JSON.stringify(o)}\n`));
      enviar({ tipo: 'inicio', conversacion_id: cid });

      const consumo = consumoVacio();
      const usadas: { nombre: string; entrada: unknown; resultado: string; error?: boolean }[] = [];
      let respuesta = '';
      let modeloUsado: string = MODELO;
      let camino: 'accionable' | 'recurso' | 'derivacion' = 'accionable';
      let fallo: string | null = null;
      let reintentosJson = 0;

      try {
        // 3 y 4. Vueltas de la API con las herramientas.
        for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
          const stream = cliente.beta.messages.stream({
            model: MODELO,
            max_tokens: 16000,
            output_config: { effort: 'low' },
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            system,
            tools,
            messages,
          });
          let textoVuelta = '';
          stream.on('text', (delta) => {
            textoVuelta += delta;
            enviar({ tipo: 'texto', delta });
          });

          let final: Anthropic.Beta.BetaMessage;
          try {
            final = await stream.finalMessage();
            reintentosJson = 0;
          } catch (err) {
            // Solo se reintenta una herramienta con JSON ilegible; los errores de la API siguen.
            if (err instanceof Anthropic.APIError || reintentosJson++ >= 2) throw err;
            continue;
          }
          sumarUso(consumo, final);
          modeloUsado = final.model;
          respuesta += textoVuelta;

          if (final.stop_reason === 'refusal') {
            if (!textoVuelta) {
              respuesta += RESPUESTA_RECHAZO;
              enviar({ tipo: 'texto', delta: RESPUESTA_RECHAZO });
            }
            break;
          }
          if (final.stop_reason === 'pause_turn') {
            messages.push({ role: 'assistant', content: final.content });
            continue;
          }
          const pedidas = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
          if (!pedidas.length) break;
          if (final.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó antes de terminar.');

          messages.push({ role: 'assistant', content: final.content });
          const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const t of pedidas) {
            enviar({ tipo: 'herramienta', nombre: t.name });
            const r = await ejecutar(sesion, t.name, t.input);
            if (!r.error && CAMINO_DE[t.name] && camino !== 'derivacion') camino = CAMINO_DE[t.name]!;
            if (r.pantalla) enviar({ tipo: 'tarjeta', datos: r.pantalla });
            usadas.push({ nombre: t.name, entrada: t.input, resultado: r.modelo.slice(0, 4000), ...(r.error ? { error: true } : {}) });
            resultados.push({ type: 'tool_result', tool_use_id: t.id, content: r.modelo, ...(r.error ? { is_error: true } : {}) });
          }
          messages.push({ role: 'user', content: resultados });
          if (respuesta && !respuesta.endsWith('\n')) respuesta += '\n\n';
        }
      } catch (err) {
        fallo =
          err instanceof Anthropic.RateLimitError
            ? 'Tina está con mucha demanda. Probá de nuevo en un minuto.'
            : err instanceof Anthropic.APIError
              ? 'Tina no pudo responder ahora. Probá de nuevo en un rato.'
              : (err as Error).message || 'Tina no pudo responder.';
      }

      // 5. Se guarda la respuesta con sus tokens y su costo, aunque haya fallado a mitad.
      await sb.from('tina_mensajes').insert({
        organizacion_id: sesion.orgId,
        conversacion_id: cid,
        autor: 'tina',
        contenido: respuesta.trim(),
        herramientas: usadas.length ? usadas : null,
        camino: respuesta.trim() || usadas.length ? camino : null,
        modelo: modeloUsado,
        tokens_entrada: consumo.entrada,
        tokens_salida: consumo.salida,
        tokens_cache_escritura: consumo.escrituraCache,
        tokens_cache_lectura: consumo.lecturaCache,
        costo_usd: Number(consumo.costoUsd.toFixed(6)),
      });
      await sb.from('tina_conversaciones').update({ actualizado_en: new Date().toISOString() }).eq('id', cid);

      if (fallo) enviar({ tipo: 'error', mensaje: fallo });
      enviar({ tipo: 'fin', camino, costo_usd: Number(consumo.costoUsd.toFixed(6)) });
      controller.close();
    },
  });

  return new Response(flujo, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}

export function GET(): Response {
  return error('Usá POST.', 405);
}

/**
 * Google Calendar del equipo (Vercel Function).
 *
 * POST /api/google/calendario  con el token del portal
 *   { accion: 'url', org }
 *       Dirección de Google para que quien pide conecte SU calendario en ese
 *       negocio. Deja una cookie con un nonce que la vuelta tiene que traer.
 *   { accion: 'eventos', org, desde, hasta, miembros }
 *       Eventos de los calendarios conectados en ese rango (hasta 45 días).
 *       Quien lidera el equipo ve a todos; el resto, solo el suyo. Lo que en
 *       Google está marcado como privado se muestra como Ocupado a los demás.
 *   { accion: 'crear', org, reunion_id, invitar }
 *       Crea la reunión del portal en el Google Calendar de la persona que la
 *       tiene, con link de Meet, e invita al cliente si se pide. La crea quien
 *       lidera, la persona o quien la agendó.
 *   { accion: 'desconectar', org }
 *       Quien pide desconecta su calendario: se revoca en Google y se borra el token.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { clienteDelUsuario } from '../_lib/acceso.js';
import { clienteServicio } from '../_lib/cola.js';
import {
  COOKIE_ESTADO,
  ErrorGoogle,
  configGoogle,
  crearEvento,
  enlaceDe,
  eventosDe,
  firmarEstado,
  nuevoNonce,
  revocar,
  tokenDeAcceso,
  urlDeConsentimiento,
  type ConfigGoogle,
} from '../_lib/google.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = 86400000;
const TIPO: Record<string, string> = { venta: 'Venta', onboarding: 'Onboarding', seguimiento: 'Seguimiento', renovacion: 'Renovación', reclamo: 'Reclamo', otra: 'Reunión' };

function json(cuerpo: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
}

interface Conexion {
  id: string;
  miembro_id: string;
  usuario_id: string;
  email: string;
}

/** Token de acceso de una conexión. Si Google ya no lo acepta, la marca para volver a conectar. */
async function accesoDe(admin: SupabaseClient, cfg: ConfigGoogle, c: Conexion): Promise<string> {
  const { data: refresh } = await admin.rpc('google_conexion_token', { p_id: c.id });
  if (!refresh) throw new ErrorGoogle('La conexión no tiene token. Hay que volver a conectar.', 'sin_token');
  try {
    return await tokenDeAcceso(cfg, refresh as string);
  } catch (e) {
    if (e instanceof ErrorGoogle && e.codigo === 'invalid_grant') {
      await admin.rpc('google_conexion_estado', { p_id: c.id, p_estado: 'error', p_error: 'Google pidió volver a conectar el calendario.' });
    }
    throw e;
  }
}

export async function POST(request: Request): Promise<Response> {
  const cfg = configGoogle();
  if (!cfg) return json({ error: 'Falta configurar Google en el servidor (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).' }, 503);
  const sb = clienteDelUsuario(request);
  const admin = clienteServicio();
  if (!sb || !admin) return json({ error: 'Tenés que ingresar al portal.' }, 401);
  const { data: sesion } = await sb.auth.getUser();
  const usuario = sesion.user;
  if (!usuario) return json({ error: 'Tenés que ingresar al portal.' }, 401);

  const cuerpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const accion = String(cuerpo?.accion ?? '');
  const org = String(cuerpo?.org ?? '');
  if (!UUID.test(org)) return json({ error: 'Falta el negocio.' }, 400);

  // Quien lidera el equipo de ese negocio, y el lugar en el equipo de quien pide.
  const [{ data: lidera }, { data: yo }] = await Promise.all([
    sb.rpc('lidera_equipo', { org }),
    sb.from('equipo_miembros').select('id, nombre, email').eq('organizacion_id', org).eq('usuario_id', usuario.id).eq('activo', true).maybeSingle(),
  ]);
  if (!lidera && !yo) return json({ error: 'No tenés acceso al equipo de ese negocio.' }, 403);

  try {
    if (accion === 'url') {
      if (!yo) return json({ error: 'Para conectar tu calendario tenés que estar en el equipo de la empresa.' }, 400);
      const n = nuevoNonce();
      const estado = firmarEstado({ u: usuario.id, o: org, m: yo.id as string, n }, cfg.secreto);
      return json({ url: urlDeConsentimiento(cfg, estado, (yo.email as string | null) ?? usuario.email) }, 200, {
        'set-cookie': `${COOKIE_ESTADO}=${n}; Path=/api/google; Max-Age=900; HttpOnly; Secure; SameSite=Lax`,
      });
    }

    if (accion === 'eventos') {
      const desde = new Date(String(cuerpo?.desde ?? ''));
      const hasta = new Date(String(cuerpo?.hasta ?? ''));
      if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || hasta <= desde || hasta.getTime() - desde.getTime() > 45 * DIA) {
        return json({ error: 'El rango de fechas no es válido.' }, 400);
      }
      const pedidos = (Array.isArray(cuerpo?.miembros) ? (cuerpo!.miembros as unknown[]) : []).map(String).filter((x) => UUID.test(x)).slice(0, 40);
      const miembros = lidera ? pedidos : pedidos.filter((x) => x === yo?.id);
      if (!miembros.length) return json({ eventos: [], errores: [] });
      const { data: cs } = await admin
        .from('google_conexiones')
        .select('id, miembro_id, usuario_id, email')
        .eq('organizacion_id', org)
        .eq('estado', 'activa')
        .in('miembro_id', miembros);
      const errores: { miembro_id: string; error: string }[] = [];
      const listas = await Promise.all(
        ((cs ?? []) as Conexion[]).map(async (c) => {
          try {
            const acceso = await accesoDe(admin, cfg, c);
            const propios = c.usuario_id === usuario.id;
            return (await eventosDe(acceso, desde.toISOString(), hasta.toISOString())).map((e) => ({
              id: e.id,
              miembro_id: c.miembro_id,
              titulo: !propios && (e.visibility === 'private' || e.visibility === 'confidential') ? 'Ocupado' : e.summary || 'Sin título',
              inicio: e.start?.dateTime ?? e.start?.date ?? null,
              fin: e.end?.dateTime ?? e.end?.date ?? null,
              todo_el_dia: Boolean(e.start?.date && !e.start?.dateTime),
              libre: e.transparency === 'transparent',
              enlace: enlaceDe(e),
            }));
          } catch (e) {
            errores.push({ miembro_id: c.miembro_id, error: e instanceof Error ? e.message : 'No se pudo leer el calendario.' });
            return [];
          }
        }),
      );
      return json({ eventos: listas.flat(), errores });
    }

    if (accion === 'crear') {
      const reunionId = String(cuerpo?.reunion_id ?? '');
      if (!UUID.test(reunionId)) return json({ error: 'Falta la reunión.' }, 400);
      // Se lee con el token de quien pide: si no la ve en el portal, no la crea en Google.
      const { data: r } = await sb
        .from('crm_reuniones')
        .select('id, organizacion_id, cliente_id, prospecto, titulo, tipo, inicio, duracion_min, miembro_id, agendada_por, google_evento_id, enlace_reunion, notas')
        .eq('id', reunionId)
        .eq('organizacion_id', org)
        .maybeSingle();
      if (!r) return json({ error: 'No existe esa reunión o no tenés acceso.' }, 404);
      if (r.google_evento_id) return json({ enlace: r.enlace_reunion, evento: r.google_evento_id });
      if (!r.miembro_id) return json({ error: 'La reunión no tiene persona del equipo.' }, 400);
      if (!lidera && r.miembro_id !== yo?.id && r.agendada_por !== yo?.id) return json({ error: 'Solo la agenda quien lidera el equipo, la persona o quien la agendó.' }, 403);

      const { data: c } = await admin
        .from('google_conexiones')
        .select('id, miembro_id, usuario_id, email')
        .eq('organizacion_id', org)
        .eq('miembro_id', r.miembro_id)
        .eq('estado', 'activa')
        .maybeSingle();
      if (!c) return json({ error: 'Esa persona no conectó su Google Calendar.' }, 400);

      let cliente: { nombre: string; email: string | null } | null = null;
      if (r.cliente_id) {
        const { data } = await sb.from('crm_clientes_resumen').select('nombre, email').eq('id', r.cliente_id).maybeSingle();
        cliente = (data as { nombre: string; email: string | null } | null) ?? null;
      }
      const conQuien = cliente?.nombre || (r.prospecto as string | null) || (r.titulo as string | null) || 'Reunión';
      const invitar = Boolean(cuerpo?.invitar) && Boolean(cliente?.email);
      const inicio = new Date(r.inicio as string);
      const fin = new Date(inicio.getTime() + (Number(r.duracion_min) || 45) * 60000);

      const acceso = await accesoDe(admin, cfg, c as Conexion);
      const evento = await crearEvento(acceso, {
        titulo: `${TIPO[String(r.tipo)] ?? 'Reunión'} · ${conQuien}`,
        descripcion: [r.titulo, r.notas, 'Agendada desde el portal de FIRMA.'].filter(Boolean).join('\n\n'),
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        invitados: invitar ? [cliente!.email as string] : [],
        pedido: r.id as string,
      });
      const enlace = enlaceDe(evento);
      await admin.from('crm_reuniones').update({ google_evento_id: evento.id, enlace_reunion: enlace }).eq('id', r.id).eq('organizacion_id', org);
      return json({ enlace, evento: evento.id, invitado: invitar });
    }

    if (accion === 'desconectar') {
      if (!yo) return json({ error: 'No tenés un calendario conectado en este negocio.' }, 400);
      const { data: c } = await admin.from('google_conexiones').select('id, miembro_id, usuario_id, email').eq('organizacion_id', org).eq('miembro_id', yo.id).maybeSingle();
      if (c) {
        const { data: refresh } = await admin.rpc('google_conexion_token', { p_id: (c as Conexion).id });
        if (refresh) await revocar(refresh as string);
        await admin.rpc('google_conexion_estado', { p_id: (c as Conexion).id, p_estado: 'revocada', p_error: null });
      }
      return json({ ok: true });
    }

    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudo hablar con Google.' }, 502);
  }
}

/** Responde 200 si alguien visita la dirección. No toca nada. */
export function GET(): Response {
  return json({ ok: true });
}

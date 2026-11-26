/**
 * Vuelta de Google después de que la persona da el permiso (Vercel Function).
 *
 * GET /api/google/callback?code=...&state=...
 *   1. Verifica el estado firmado y que este navegador sea el que pidió la
 *      conexión (cookie con el mismo nonce). Si no, no conecta nada.
 *   2. Canjea el código por los tokens y confirma que se dio el permiso del
 *      calendario.
 *   3. Guarda la conexión con el token de actualización cifrado
 *      (google_conexion_guardar) y vuelve a la ficha de la persona.
 */
import { clienteServicio } from '../_lib/cola.js';
import { ALCANCE_CALENDARIO, COOKIE_ESTADO, canjearCodigo, configGoogle, leerEstado, mailDe } from '../_lib/google.js';

function volver(base: URL, ruta: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: new URL(ruta, base.origin).toString(),
      'cache-control': 'no-store',
      // La cookie del pedido se usa una sola vez.
      'set-cookie': `${COOKIE_ESTADO}=; Path=/api/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

function cookie(request: Request, nombre: string): string | null {
  const par = (request.headers.get('cookie') || '').split(/;\s*/).find((x) => x.startsWith(`${nombre}=`));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cfg = configGoogle();
  if (!cfg) return volver(url, '/portal/equipo?google=sin-configurar');
  if (url.searchParams.get('error')) return volver(url, '/portal/equipo?google=cancelado');

  const estado = leerEstado(url.searchParams.get('state'), cfg.secreto);
  if (!estado || cookie(request, COOKIE_ESTADO) !== estado.n) return volver(url, '/portal/equipo?google=vencido');
  const ficha = `/portal/equipo/persona/${estado.m}`;

  const code = url.searchParams.get('code');
  const sb = clienteServicio();
  if (!code || !sb) return volver(url, `${ficha}?google=error`);
  try {
    const tokens = await canjearCodigo(cfg, code);
    if (!(tokens.scope || '').split(' ').includes(ALCANCE_CALENDARIO)) return volver(url, `${ficha}?google=sin-permiso`);
    const email = await mailDe(tokens.access_token as string);
    const { error } = await sb.rpc('google_conexion_guardar', {
      p_org: estado.o,
      p_miembro: estado.m,
      p_usuario: estado.u,
      p_email: email,
      p_refresh: tokens.refresh_token ?? null,
      p_alcance: tokens.scope ?? null,
    });
    if (error) return volver(url, `${ficha}?google=error`);
    return volver(url, `${ficha}?google=ok`);
  } catch {
    return volver(url, `${ficha}?google=error`);
  }
}

/**
 * Notificaciones push del portal (Web Push con VAPID y cifrado aes128gcm,
 * RFC 8291 y 8292), sin dependencias: solo node:crypto.
 *
 * Las suscripciones viven en push_suscripciones (migración 0060), una por
 * dispositivo. El portal las registra con la clave pública de VAPID_PUBLICA
 * (components/portal/push.ts); el servidor firma con VAPID_PRIVATE_KEY, que
 * vive solo en Vercel. Si falta la clave, no se manda nada y no falla.
 *
 * Los avisos son solo operativos y no llevan datos de clientes: el texto se
 * ve en la pantalla bloqueada. El detalle está en el portal, al tocarlo.
 */
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AvisoPush {
  titulo: string;
  cuerpo: string;
  /** Ruta del portal que se abre al tocarla, por ejemplo /portal/asuntos/… */
  url: string;
  /** Avisos con la misma etiqueta se reemplazan en vez de apilarse. */
  etiqueta?: string;
}

const CONTACTO = 'mailto:agustin@firmasvc.com';

const b64url = (b: Buffer) => b.toString('base64url');
const hmac = (clave: Buffer, datos: Buffer) => createHmac('sha256', clave).update(datos).digest();

interface Vapid {
  publica: Buffer;
  privada: ReturnType<typeof createPrivateKey>;
}

let vapidCache: Vapid | null | undefined;

function vapid(): Vapid | null {
  if (vapidCache !== undefined) return vapidCache;
  const d = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!d) return (vapidCache = null);
  try {
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(d, 'base64url'));
    const publica = ecdh.getPublicKey();
    const privada = createPrivateKey({
      key: { kty: 'EC', crv: 'P-256', d, x: b64url(publica.subarray(1, 33)), y: b64url(publica.subarray(33, 65)) },
      format: 'jwk',
    });
    return (vapidCache = { publica, privada });
  } catch {
    return (vapidCache = null);
  }
}

export function pushDisponible(): boolean {
  return vapid() !== null;
}

function encabezadoVapid(endpoint: string, v: Vapid): string {
  const aud = new URL(endpoint).origin;
  const cabeza = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const cuerpo = b64url(Buffer.from(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTACTO })));
  const firma = sign('sha256', Buffer.from(`${cabeza}.${cuerpo}`), { key: v.privada, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${cabeza}.${cuerpo}.${b64url(firma)}, k=${b64url(v.publica)}`;
}

/** Cifra el mensaje para un dispositivo (RFC 8291, un solo registro). */
export function cifrar(mensaje: Buffer, p256dh: string, auth: string, prueba?: { privada: string; sal: string }): Buffer {
  const clientePublica = Buffer.from(p256dh, 'base64url');
  const secreto = Buffer.from(auth, 'base64url');
  const efimera = createECDH('prime256v1');
  if (prueba) efimera.setPrivateKey(Buffer.from(prueba.privada, 'base64url'));
  const servidorPublica = prueba ? efimera.getPublicKey() : efimera.generateKeys();
  const compartido = efimera.computeSecret(clientePublica);

  const prkClave = hmac(secreto, compartido);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), clientePublica, servidorPublica, Buffer.from([1])]);
  const ikm = hmac(prkClave, info);

  const sal = prueba ? Buffer.from(prueba.sal, 'base64url') : randomBytes(16);
  const prk = hmac(sal, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);

  const cifrador = createCipheriv('aes-128-gcm', cek, nonce);
  const cifrado = Buffer.concat([cifrador.update(Buffer.concat([mensaje, Buffer.from([2])])), cifrador.final(), cifrador.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([sal, rs, Buffer.from([servidorPublica.length]), servidorPublica, cifrado]);
}

interface Suscripcion {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Manda el aviso a todos los dispositivos de esas personas (ids de
 * auth.users). Con la clave de servicio. Las suscripciones que el servicio
 * de push da por muertas (404 o 410) quedan inactivas. Devuelve a cuántos
 * dispositivos llegó. Nunca tira error: un aviso que no sale no frena nada.
 */
export async function enviarPush(admin: SupabaseClient, usuarios: string[], aviso: AvisoPush): Promise<number> {
  const v = vapid();
  const ids = [...new Set(usuarios.filter(Boolean))];
  if (!v || !ids.length) return 0;
  try {
    const { data } = await admin.from('push_suscripciones').select('id, endpoint, p256dh, auth').in('usuario_id', ids).eq('activa', true);
    const subs = (data ?? []) as Suscripcion[];
    if (!subs.length) return 0;
    const mensaje = Buffer.from(JSON.stringify(aviso));
    const resultados = await Promise.all(
      subs.map(async (s) => {
        try {
          const r = await fetch(s.endpoint, {
            method: 'POST',
            headers: {
              authorization: encabezadoVapid(s.endpoint, v),
              'content-encoding': 'aes128gcm',
              'content-type': 'application/octet-stream',
              ttl: String(24 * 3600),
              urgency: 'normal',
              ...(aviso.etiqueta ? { topic: aviso.etiqueta.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'firma' } : {}),
            },
            body: new Uint8Array(cifrar(mensaje, s.p256dh, s.auth)),
            signal: AbortSignal.timeout(8000),
          });
          if (r.status === 404 || r.status === 410) {
            await admin.from('push_suscripciones').update({ activa: false }).eq('id', s.id);
            return false;
          }
          if (!r.ok) return false;
          await admin.from('push_suscripciones').update({ ultimo_envio: new Date().toISOString() }).eq('id', s.id);
          return true;
        } catch {
          return false;
        }
      }),
    );
    return resultados.filter(Boolean).length;
  } catch {
    return 0;
  }
}

/** Igual que enviarPush, pero con mails: los busca en perfiles. */
export async function enviarPushPorMail(admin: SupabaseClient, emails: string[], aviso: AvisoPush): Promise<number> {
  const lista = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!lista.length || !pushDisponible()) return 0;
  const { data } = await admin.from('perfiles').select('id').in('email', lista).eq('activo', true);
  const ids = (data ?? []).map((p: { id: string }) => p.id);
  return enviarPush(admin, ids, aviso);
}

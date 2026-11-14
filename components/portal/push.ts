/**
 * Avisos en este dispositivo: registra el service worker (public/sw.js) y la
 * suscripción push de quien usa el portal en push_suscripciones. Cada
 * persona ve y borra solo las suyas (RLS de la migración 0060).
 *
 * En iPhone y iPad solo funciona con la app instalada (Compartir › Agregar a
 * inicio), desde iOS 16.4.
 */
import { supabase } from './supabase';

/** Pública: la privada que le corresponde vive solo en Vercel (VAPID_PRIVATE_KEY). */
export const VAPID_PUBLICA = 'BC69962hmsbEQe6NZoVmK1sM66jT-h-n-1qdmQU1AT-gtTsnOZ7BPA97Osrew_fioOdpRVQjyO6l8bZt5ajCcOA';

export type EstadoPush =
  | 'activos' // Este dispositivo recibe avisos
  | 'apagados' // Se pueden activar
  | 'bloqueados' // La persona los bloqueó en el navegador
  | 'instalar' // iPhone o iPad sin la app instalada
  | 'no_soportado';

const esIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function soporta(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

let registro: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registra el service worker una sola vez. Lo llama el portal al cargar. */
export function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registro) return registro;
  registro = soporta()
    ? navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null)
    : Promise.resolve(null);
  return registro;
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!soporta()) return esIos() && !instalada() ? 'instalar' : 'no_soportado';
  if (Notification.permission === 'denied') return 'bloqueados';
  const reg = await registrarServiceWorker();
  if (!reg) return 'no_soportado';
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'activos' : 'apagados';
}

function claveBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function nombreDispositivo(): string {
  const ua = navigator.userAgent;
  const sistema = /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android' : /mac os/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : 'Otro';
  const navegador = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'navegador';
  return `${sistema} · ${navegador}${instalada() ? ' · app' : ''}`;
}

async function guardar(sub: PushSubscription, usuario: string): Promise<'ok' | 'ajena' | 'error'> {
  const j = sub.toJSON();
  if (!supabase || !j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return 'error';
  // Si ya era de esta persona, se reactiva. Si es de otra cuenta (otra sesión en este navegador), no se toca.
  const { data: propia } = await supabase.from('push_suscripciones').select('id').eq('endpoint', j.endpoint).maybeSingle();
  if (propia) {
    const { error } = await supabase.from('push_suscripciones').update({ activa: true, p256dh: j.keys.p256dh, auth: j.keys.auth }).eq('id', propia.id);
    return error ? 'error' : 'ok';
  }
  const { error } = await supabase.from('push_suscripciones').insert({
    usuario_id: usuario,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    dispositivo: nombreDispositivo(),
  });
  if (error?.code === '23505') return 'ajena';
  return error ? 'error' : 'ok';
}

/** Pide permiso y suscribe este dispositivo. Devuelve el estado nuevo o un mensaje de error. */
export async function activarPush(): Promise<{ estado: EstadoPush; error?: string }> {
  const estado = await estadoPush();
  if (estado === 'instalar' || estado === 'no_soportado' || estado === 'bloqueados') return { estado };
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  const usuario = data.user?.id;
  if (!usuario) return { estado, error: 'Volvé a ingresar al portal y probá de nuevo.' };

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return { estado: permiso === 'denied' ? 'bloqueados' : 'apagados' };

  const reg = await registrarServiceWorker();
  if (!reg) return { estado: 'no_soportado' };
  await navigator.serviceWorker.ready;
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveBytes(VAPID_PUBLICA) });
    let r = await guardar(sub, usuario);
    if (r === 'ajena') {
      // El navegador tenía la suscripción de otra cuenta: se pide una nueva, que es solo de esta persona.
      await sub.unsubscribe();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveBytes(VAPID_PUBLICA) });
      r = await guardar(sub, usuario);
    }
    if (r !== 'ok') return { estado: 'apagados', error: 'No pudimos guardar este dispositivo. Probá de nuevo en un rato.' };
    return { estado: 'activos' };
  } catch {
    return { estado: 'apagados', error: 'El navegador no dejó activar los avisos. Probá de nuevo en un rato.' };
  }
}

/** Deja de recibir avisos en este dispositivo. También se llama al salir del portal. */
export async function desactivarPush(): Promise<void> {
  if (!soporta()) return;
  const reg = await registrarServiceWorker();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  try {
    await supabase?.from('push_suscripciones').delete().eq('endpoint', sub.endpoint);
  } finally {
    await sub.unsubscribe().catch(() => undefined);
  }
}

const CLAVE_TARJETA = 'firma.avisos.tarjeta';

export function tarjetaCerrada(): boolean {
  try {
    return localStorage.getItem(CLAVE_TARJETA) === 'cerrada';
  } catch {
    return false;
  }
}

export function cerrarTarjeta(): void {
  try {
    localStorage.setItem(CLAVE_TARJETA, 'cerrada');
  } catch {
    /* sin almacenamiento: la tarjeta vuelve a aparecer, no pasa nada */
  }
}

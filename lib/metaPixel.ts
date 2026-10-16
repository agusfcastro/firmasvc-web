/**
 * Píxel de Meta. El ID sale de VITE_META_PIXEL_ID (Vercel › Settings › Environment Variables).
 * Sin ID no se carga nada. Tampoco se carga en el portal, que es privado para clientes.
 */
type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

export function trackPixel(evento: string, datos?: Record<string, unknown>) {
  window.fbq?.('track', evento, datos);
}

export function initMetaPixel() {
  if (!PIXEL_ID || window.fbq) return;
  if (window.location.pathname.startsWith('/portal')) return;

  // Snippet oficial de Meta, reescrito sin minificar.
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  // Calendly avisa por postMessage cuando alguien confirma una reunión: esa es la conversión.
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://calendly.com') return;
    if (e.data?.event === 'calendly.event_scheduled') trackPixel('Schedule');
  });
}

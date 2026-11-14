import { useEffect, useState } from 'react';

export function navegar(ruta: string) {
  if (window.location.pathname + window.location.search === ruta) return;
  // Fuera del portal (protocolos, páginas del sitio) la app de arriba elige la página una sola vez
  // al cargar, así que hace falta una carga completa; si no, el portal cae en su pantalla por defecto.
  if (!/^\/portal(\/|\?|$)/.test(ruta)) {
    window.location.assign(ruta);
    return;
  }
  window.history.pushState({}, '', ruta);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

/**
 * Adónde iba la persona cuando el portal le pidió ingresar (el enlace de un mail o de un aviso).
 * Después del ingreso se la lleva ahí en vez de dejarla en Inicio. Solo rutas del portal.
 */
const CLAVE_DESTINO = 'firma.destino';

export function guardarDestino(ruta: string): void {
  if (!/^\/portal\/(?!ingresar|clave)/.test(ruta)) return;
  try {
    window.sessionStorage.setItem(CLAVE_DESTINO, ruta);
  } catch {
    /* sin almacenamiento: entra por Inicio, como antes */
  }
}

/** Devuelve el destino guardado y lo borra. Sin destino, Inicio. */
export function tomarDestino(): string {
  try {
    const d = window.sessionStorage.getItem(CLAVE_DESTINO);
    window.sessionStorage.removeItem(CLAVE_DESTINO);
    return d && /^\/portal\/(?!ingresar|clave)/.test(d) ? d : '/portal';
  } catch {
    return '/portal';
  }
}

export function useRuta(): string {
  const [ruta, setRuta] = useState(() => window.location.pathname.replace(/\/$/, ''));
  useEffect(() => {
    const alCambiar = () => setRuta(window.location.pathname.replace(/\/$/, ''));
    window.addEventListener('popstate', alCambiar);
    return () => window.removeEventListener('popstate', alCambiar);
  }, []);
  return ruta;
}

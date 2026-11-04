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

export function useRuta(): string {
  const [ruta, setRuta] = useState(() => window.location.pathname.replace(/\/$/, ''));
  useEffect(() => {
    const alCambiar = () => setRuta(window.location.pathname.replace(/\/$/, ''));
    window.addEventListener('popstate', alCambiar);
    return () => window.removeEventListener('popstate', alCambiar);
  }, []);
  return ruta;
}

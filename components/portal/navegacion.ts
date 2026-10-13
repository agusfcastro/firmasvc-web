import { useEffect, useState } from 'react';

export function navegar(ruta: string) {
  if (window.location.pathname + window.location.search === ruta) return;
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

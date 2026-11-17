/**
 * Archivo y Bitter desde Google Fonts, para las páginas que todavía las usan:
 * políticas, planes, protocolos, firma, verificación y herramientas.
 *
 * El home y el portal van con Archivo Variable, alojada en firmasvc.com, así
 * que no las piden: antes las descargaban igual desde index.html.
 */
const HOJA = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=Bitter:wght@600;700;900&display=swap';

export function cargarFuentesWeb(): void {
  if (typeof document === 'undefined' || document.querySelector(`link[href="${HOJA}"]`)) return;
  const enlace = (rel: string, href: string, crossOrigin?: string) => {
    const l = document.createElement('link');
    l.rel = rel;
    l.href = href;
    if (crossOrigin !== undefined) l.crossOrigin = crossOrigin;
    document.head.appendChild(l);
  };
  enlace('preconnect', 'https://fonts.googleapis.com');
  enlace('preconnect', 'https://fonts.gstatic.com', '');
  enlace('stylesheet', HOJA);
}

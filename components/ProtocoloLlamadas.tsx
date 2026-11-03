import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';
import { Footer } from './Footer';
import SopLlamadasVenta from './sop-llamadas-venta';

/**
 * Protocolo de comunicación legal en llamadas de venta (plantilla para clientes).
 * Ruta /protocolo-llamadas, sin indexar. Mismo esquema que la Política de Privacidad,
 * con header simple, contenido y footer del sitio.
 */

// Paleta y tipografía de Firma aplicadas al protocolo. Radio 0, como el resto de la marca.
const marcaFirma = {
  '--sop-bg': 'var(--color-marfil)',
  '--sop-surface': 'var(--color-marfil-claro)',
  '--sop-surface-2': 'var(--color-marfil-oscuro)',
  '--sop-ink': 'var(--color-tinta)',
  '--sop-ink-2': 'var(--color-carbon)',
  '--sop-muted': 'var(--color-piedra)',
  '--sop-line': 'color-mix(in srgb, var(--color-tinta) 15%, transparent)',
  '--sop-line-2': 'color-mix(in srgb, var(--color-tinta) 32%, transparent)',
  '--sop-accent': 'var(--color-bosque)',
  '--sop-accent-ink': 'var(--color-marfil)',
  '--sop-accent-soft': 'var(--color-bosque-suave)',
  '--sop-focus': 'var(--color-bosque)',
  '--sop-font-body': "var(--font-sans, 'Archivo', system-ui, sans-serif)",
  '--sop-font-display': "var(--font-heading, 'Bitter', Georgia, serif)",
  '--sop-display-weight': '900',
  '--sop-display-weight-sm': '700',
  '--sop-radius': '0px',
  '--sop-radius-md': '0px',
  '--sop-radius-sm': '0px',
  '--sop-radius-xs': '0px',
  '--sop-radius-pill': '0px',
} as React.CSSProperties;

export const ProtocoloLlamadas: React.FC = () => {
  useEffect(() => {
    const tituloPrevio = document.title;
    document.title = 'Protocolo de llamadas de venta | Firma';

    // Página de trabajo para clientes, no para buscadores.
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);

    // El scroll-padding global (112px) está pensado para el header fijo de la home.
    // Acá el header no es fijo y el protocolo maneja su propio desplazamiento.
    const html = document.documentElement;
    const paddingPrevio = html.style.scrollPaddingTop;
    html.style.scrollPaddingTop = '0px';

    return () => {
      document.title = tituloPrevio;
      robots.remove();
      html.style.scrollPaddingTop = paddingPrevio;
    };
  }, []);

  return (
    <div className="min-h-screen bg-marfil flex flex-col">
      <header className="border-b border-tinta/15">
        <div className="wrap h-28 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center min-w-0 select-none">
            <Logo className="h-12 max-w-[55vw]" />
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-piedra hover:text-bosque transition-colors"
          >
            <ArrowLeft size={16} />
            Volver al inicio
          </a>
        </div>
      </header>

      <main className="flex-1">
        <SopLlamadasVenta marca="Firma" style={marcaFirma} />
      </main>

      <Footer />
    </div>
  );
};

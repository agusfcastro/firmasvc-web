import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';
import { Footer } from './Footer';
import SopLlamadasVenta from './sop-llamadas-venta';
import { MARCA_FIRMA } from './protocolos/marca';

/**
 * Protocolo de comunicación legal en llamadas de venta (plantilla para clientes).
 * Ruta /protocolo-llamadas, sin indexar. Mismo esquema que la Política de Privacidad,
 * con header simple, contenido y footer del sitio.
 */


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
    <div className="landing min-h-screen bg-marfil flex flex-col">
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
        <SopLlamadasVenta marca="Firma" style={MARCA_FIRMA} />
      </main>

      <Footer />
    </div>
  );
};

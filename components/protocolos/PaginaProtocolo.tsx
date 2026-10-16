import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../Logo';
import { Footer } from '../Footer';
import s from '../sop-llamadas-venta/sop.module.css';
import m from './motor/motor.module.css';
import Protocolo from './motor/Protocolo';
import type { DefProtocolo } from './motor/tipos';
import { MARCA_FIRMA } from './marca';
import { CATALOGO } from './rutas';

/**
 * Página de los protocolos que arma el motor, más el índice en /protocolos.
 * Mismo esquema que el protocolo de llamadas, con header simple, contenido y footer del sitio.
 * Cada protocolo se descarga aparte, solo cuando se visita su ruta.
 */

const CARGADORES: Record<string, () => Promise<{ default: DefProtocolo }>> = {
  '/protocolo-conflictos': () => import('./conflictos'),
  '/protocolo-onboarding': () => import('./onboarding'),
  '/protocolo-cobranza': () => import('./cobranza'),
  '/protocolo-reclutamiento': () => import('./reclutamiento'),
  '/protocolo-equipo': () => import('./equipo'),
  '/protocolo-datos': () => import('./datos'),
  '/protocolo-marketing': () => import('./marketing'),
};

export default function PaginaProtocolo({ ruta }: { ruta: string }) {
  const [def, setDef] = useState<DefProtocolo | null>(null);
  const [error, setError] = useState(false);
  const esIndice = ruta === '/protocolos';

  useEffect(() => {
    if (esIndice) return;
    const cargar = CARGADORES[ruta];
    if (!cargar) {
      setError(true);
      return;
    }
    let vivo = true;
    cargar()
      .then((mod) => {
        if (vivo) setDef(mod.default);
      })
      .catch(() => {
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
    };
  }, [ruta, esIndice]);

  useEffect(() => {
    const tituloPrevio = document.title;
    document.title = esIndice ? 'Protocolos | Firma' : def ? def.tituloPagina : 'Protocolo | Firma';

    // Páginas de trabajo para clientes, no para buscadores.
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);

    // El scroll-padding global (112px) está pensado para el header fijo de la home.
    const html = document.documentElement;
    const paddingPrevio = html.style.scrollPaddingTop;
    html.style.scrollPaddingTop = '0px';

    return () => {
      document.title = tituloPrevio;
      robots.remove();
      html.style.scrollPaddingTop = paddingPrevio;
    };
  }, [def, esIndice]);

  return (
    <div className="min-h-screen bg-marfil flex flex-col">
      <header className="border-b border-tinta/15">
        <div className="wrap h-28 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center min-w-0 select-none">
            <Logo className="h-12 max-w-[55vw]" />
          </a>
          <a
            href={esIndice ? '/' : '/protocolos'}
            className="inline-flex items-center gap-2 text-sm font-medium text-piedra hover:text-bosque transition-colors"
          >
            <ArrowLeft size={16} />
            {esIndice ? 'Volver al inicio' : 'Todos los protocolos'}
          </a>
        </div>
      </header>

      <main className="flex-1">
        {esIndice ? (
          <IndiceProtocolos />
        ) : def ? (
          <Protocolo def={def} marca="Firma" style={MARCA_FIRMA} />
        ) : error ? (
          <div className={s.raiz} style={MARCA_FIRMA}>
            <div className={s.hero}>
              <div className={s.heroInterior}>
                <h1 className={s.titulo}>No encontramos este protocolo</h1>
                <p className={s.bajada}>
                  Revisá el enlace o volvé al <a href="/protocolos">índice de protocolos</a>.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-[60vh]" />
        )}
      </main>

      <Footer />
    </div>
  );
}

function IndiceProtocolos() {
  return (
    <div className={s.raiz} style={MARCA_FIRMA} lang="es">
      <header className={s.hero}>
        <div className={s.heroInterior}>
          <p className={s.kicker}>Sistemas de gestión Firma</p>
          <h1 className={s.titulo}>Protocolos</h1>
          <p className={s.bajada}>
            Cada protocolo combina tres capas. Lo que se dice y lo que no, lo que se firma o se registra, y cómo se gestiona con responsables, plazos, indicadores y una herramienta para decidir.
          </p>
          <div className={s.ideas}>
            <div className={s.idea}>
              <p className={s.ideaTitulo}>Capa legal</p>
              <p className={s.ideaTexto}>Guiones, cláusulas y plantillas con la normativa de Argentina y España.</p>
            </div>
            <div className={s.idea}>
              <p className={s.ideaTitulo}>Capa de gestión</p>
              <p className={s.ideaTexto}>Responsables, plazos y matrices de decisión para que nadie improvise.</p>
            </div>
            <div className={s.idea}>
              <p className={s.ideaTitulo}>Capa de medición</p>
              <p className={s.ideaTexto}>Indicadores y calculadoras para decidir con números y mejorar cada mes.</p>
            </div>
          </div>
        </div>
      </header>
      <div className={s.cuerpo} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <main className={s.contenido}>
          <section className={s.seccion} aria-labelledby="protocolos-lista">
            <h2 id="protocolos-lista" className={s.seccionTitulo}>
              Catálogo
            </h2>
            <p className={s.seccionIntro}>Cada protocolo tiene su ficha. Se completa una vez por negocio y el enlace configurado se comparte con el equipo.</p>
            <div className={m.catalogo}>
              {CATALOGO.map((c) => (
                <a key={c.ruta} href={c.ruta} className={m.catalogoItem}>
                  <span className={m.catalogoKicker}>{c.area}</span>
                  <span className={m.catalogoTitulo}>{c.titulo}</span>
                  <span className={m.catalogoTexto}>{c.bajada}</span>
                  <span className={m.catalogoCapas}>
                    {c.capas.map((capa) => (
                      <span key={capa} className={s.pastilla}>
                        {capa}
                      </span>
                    ))}
                  </span>
                </a>
              ))}
            </div>
          </section>
          <footer className={s.pie}>
            <p>Protocolos elaborados por Firma. No reemplazan el contrato ni el asesoramiento jurídico para casos concretos.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

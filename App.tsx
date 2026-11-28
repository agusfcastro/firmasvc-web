import React, { Suspense, lazy, useEffect } from 'react';
// Archivo variable desde firmasvc.com, la misma del portal: pesos 100 a 900 y ancho 62 a 125.
import '@fontsource-variable/archivo/wdth.css';
import { Header } from './components/Header';
import { PromoBanner } from './components/PromoBanner';
import { Hero } from './components/Hero';
import { Vitrina } from './components/home/Vitrina';
import { Repartido } from './components/home/Repartido';
import { Process } from './components/Process';
import { Testimonials } from './components/Testimonials';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';
import { RUTAS_MOTOR } from './components/protocolos/rutas';
import { cargarFuentesWeb } from './lib/fuentesWeb';

// Los protocolos y su índice comparten un motor que se carga aparte para no sumar peso a la home.
const PaginaProtocolo = lazy(() => import('./components/protocolos/PaginaProtocolo'));

// Planes de abono, privados. Se comparten solo en llamadas de venta.
const Planes = lazy(() => import('./components/Planes'));

// Portal de clientes, también aparte. Supabase solo se descarga al entrar al portal.
const PortalApp = lazy(() => import('./components/portal/PortalApp'));

// Firma electrónica pública: quien firma y quien verifica no necesitan cuenta.
const FirmarApp = lazy(() => import('./components/firma/FirmarApp'));
const Verificar = lazy(() => import('./components/firma/Verificar'));
const ConectarFathom = lazy(() => import('./components/portal/crm/ConectarFathom'));

// Generadores de invoices y recibos, gratis y sin indexar: se comparten por enlace.
const Herramienta = lazy(() => import('./components/comprobantes/Herramienta'));

/** ruta viene solo del prerender del build (entry-server.tsx). En el navegador sale de la dirección. */
function App({ ruta }: { ruta?: string }) {
  const path = (ruta ?? window.location.pathname).replace(/\/$/, '');

  // El home, /landing y el portal usan la tipografía propia. El resto todavía pide Archivo y Bitter a Google.
  useEffect(() => {
    if (path !== '' && path !== '/landing' && path !== '/portal' && !path.startsWith('/portal/')) cargarFuentesWeb();
  }, [path]);
  if (path === '/privacidad' || path === '/privacy') {
    return <PrivacyPolicy />;
  }
  if (path === '/terminos' || path === '/terms') {
    return <TermsOfService />;
  }
  if (path === '/portal' || path.startsWith('/portal/')) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-marfil" />}>
        <PortalApp />
      </Suspense>
    );
  }
  if (path.startsWith('/firmar/')) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-marfil" />}>
        <FirmarApp token={decodeURIComponent(path.slice('/firmar/'.length))} />
      </Suspense>
    );
  }
  if (path.startsWith('/conectar-fathom/')) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-marfil" />}>
        <ConectarFathom enlace={decodeURIComponent(path.slice('/conectar-fathom/'.length))} />
      </Suspense>
    );
  }
  if (path === '/verificar' || path.startsWith('/verificar/')) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-marfil" />}>
        <Verificar codigoInicial={path.slice('/verificar/'.length)} />
      </Suspense>
    );
  }
  if (path === '/herramientas/invoice' || path === '/herramientas/recibo') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-marfil" />}>
        <Herramienta tipo={path === '/herramientas/invoice' ? 'invoice' : 'recibo'} />
      </Suspense>
    );
  }
  if (path === '/planes') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-marfil" />}>
        <Planes />
      </Suspense>
    );
  }
  if (RUTAS_MOTOR.includes(path)) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-marfil" />}>
        <PaginaProtocolo ruta={path} />
      </Suspense>
    );
  }

  // Landing para campañas: el home resumido, sin navegación, sin Servicios y sin la carta.
  if (path === '/landing') {
    return (
      <div className="landing landing-corta min-h-screen bg-marfil">
        <PromoBanner blackFriday />
        <main>
          <Hero deLanding />
          <Testimonials />
          <Process />
          <Contact />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="landing min-h-screen bg-marfil">
      <Header />
      {/* Promo con fecha de cierre, entre el header y el hero. Se oculta sola cuando vence. */}
      <PromoBanner />
      <main>
        <Hero />
        <Vitrina />
        <Repartido />
        <Process />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

export default App;
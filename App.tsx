import React, { Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { About } from './components/About';
import { Services } from './components/Services';
import { Process } from './components/Process';
import { Testimonials } from './components/Testimonials';
import { Letter } from './components/Letter';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';
import { WhatsAppButton } from './components/WhatsAppButton';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';
import { RUTAS_MOTOR } from './components/protocolos/rutas';

// El protocolo de llamadas se carga aparte para no sumar peso a la home.
const ProtocoloLlamadas = lazy(() =>
  import('./components/ProtocoloLlamadas').then((m) => ({ default: m.ProtocoloLlamadas })),
);

// El resto de los protocolos y su índice comparten un motor que también se carga aparte.
const PaginaProtocolo = lazy(() => import('./components/protocolos/PaginaProtocolo'));

// Portal de clientes, también aparte. Supabase solo se descarga al entrar al portal.
const PortalApp = lazy(() => import('./components/portal/PortalApp'));

// Firma electrónica pública: quien firma y quien verifica no necesitan cuenta.
const FirmarApp = lazy(() => import('./components/firma/FirmarApp'));
const Verificar = lazy(() => import('./components/firma/Verificar'));

function App() {
  const path = window.location.pathname.replace(/\/$/, '');
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
  if (path === '/verificar' || path.startsWith('/verificar/')) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-marfil" />}>
        <Verificar codigoInicial={path.slice('/verificar/'.length)} />
      </Suspense>
    );
  }
  if (path === '/protocolo-llamadas') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-marfil" />}>
        <ProtocoloLlamadas />
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

  return (
    <div className="min-h-screen bg-marfil">
      <Header />
      <main>
        <Hero />
        <About />
        <Services />
        <Process />
        <Testimonials />
        <Letter />
        <Contact />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

export default App;
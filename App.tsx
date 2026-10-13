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

// El protocolo de llamadas se carga aparte para no sumar peso a la home.
const ProtocoloLlamadas = lazy(() =>
  import('./components/ProtocoloLlamadas').then((m) => ({ default: m.ProtocoloLlamadas })),
);

function App() {
  const path = window.location.pathname.replace(/\/$/, '');
  if (path === '/privacidad' || path === '/privacy') {
    return <PrivacyPolicy />;
  }
  if (path === '/protocolo-llamadas') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-marfil" />}>
        <ProtocoloLlamadas />
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
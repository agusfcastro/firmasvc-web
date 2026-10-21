import React from 'react';
import { Button } from './Button';
import { Counter } from './Counter';
import { VideoVSL } from './VideoVSL';
import { openCalendly } from '../lib/calendly';

import simboloClaro from '../assets/brand/simbolo-claro.png';

export const Hero: React.FC = () => {
  return (
    <section id="top" className="relative overflow-hidden text-center pt-8 desk:pt-10 pb-16">
      {/* Rúbrica de marca como marca de agua, centrada detrás del titular */}
      <img
        src={simboloClaro}
        alt=""
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
        style={{ width: 'min(140vw, 1400px)', maxWidth: 'none', maxHeight: '100%', objectFit: 'contain', opacity: 0.06 }}
      />

      <div className="wrap relative flex flex-col items-center gap-8">
        <h1 className="h1">
          blindamos legalmente
          <br />
          <span className="text-bosque">tu negocio digital</span>
        </h1>

        <VideoVSL />

        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={openCalendly}>
            Agendar auditoría →
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Conocer servicios
          </Button>
        </div>

        <p
          className="text-piedra max-w-[26em]"
          style={{ fontSize: 'clamp(17px,2vw,22px)', lineHeight: 1.45, textWrap: 'balance' }}
        >
          Soluciones estratégicas que evitan que reembolsos, morosos y tu equipo se coman tu facturación.
        </p>

        <Counter />
      </div>
    </section>
  );
};

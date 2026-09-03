import React from 'react';
import { Button } from './Button';
import { openCalendly } from '../lib/calendly';

import simboloClaro from '../assets/brand/simbolo-claro.png';

const stats = [
  { value: '+150', label: 'Contratos' },
  { value: '+20', label: 'Marcas registradas' },
  { value: '+10', label: 'Sociedades constituidas' },
];

const RULE = '1px solid rgba(27,31,27,0.15)';

export const Hero: React.FC = () => {
  return (
    <section id="top" className="relative overflow-hidden text-center pt-20 pb-16">
      {/* Rúbrica de marca como marca de agua, centrada detrás del titular */}
      <img
        src={simboloClaro}
        alt=""
        aria-hidden="true"
        className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
        style={{ width: 'min(140vw, 1400px)', maxWidth: 'none', opacity: 0.06 }}
      />

      <div className="wrap relative flex flex-col items-center gap-8">
        <h1 className="h1 mt-6">
          blindamos legalmente
          <br />
          <span className="text-bosque">tu negocio digital</span>
        </h1>

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

        <div
          className="mt-6 w-full max-w-[720px] mx-auto grid grid-cols-3"
          style={{ borderTop: RULE }}
        >
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1.5 pt-6 px-2 text-center"
              style={i > 0 ? { borderLeft: RULE } : undefined}
            >
              <span
                className="font-heading font-black text-bosque"
                style={{ fontSize: 'clamp(28px,4vw,40px)' }}
              >
                {stat.value}
              </span>
              <span className="eyebrow stat-label text-piedra">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

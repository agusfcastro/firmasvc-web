import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { Counter } from './Counter';
import { VideoVSL } from './VideoVSL';
import { openCalendly } from '../lib/calendly';

/**
 * Hero de la landing en la línea de los posteos de @agustin.legales. Titular en
 * Archivo pesada con la frase clave resaltada en un bloque tinta, el video como
 * tarjeta redondeada con la firma de Agustín y los botones redondeados.
 */
export const Hero: React.FC = () => (
  <section id="top" className="relative overflow-hidden text-center pt-8 desk:pt-9 pb-16 desk:pb-20">
    <div className="wrap relative flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <p className="eyebrow text-piedra">Para dueños de negocios que ya venden</p>
        <h1 className="font-extrabold leading-[1.04] tracking-[-0.045em] max-w-[32ch]" style={{ fontSize: 'clamp(32px, 3vw, 46px)', textWrap: 'balance' }}>
          Escalá a <span className="inline-block bg-tinta text-marfil px-[0.12em] pb-[0.04em]">USD 50k por mes</span> delegando en tu equipo, sin perder plata en el camino.
        </h1>
        <p className="text-piedra max-w-[34em]" style={{ fontSize: 'clamp(17px,1.9vw,21px)', lineHeight: 1.4, textWrap: 'balance' }}>
          El sistema legal que utilizan los negocios de alta facturación.
        </p>
      </div>

      <VideoVSL />

      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={openCalendly}>
          Agendar auditoría <ArrowRight size={18} aria-hidden="true" />
        </Button>
        <Button size="lg" variant="ghost" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>
          Conocer servicios
        </Button>
      </div>

      <Counter />
    </div>
  </section>
);

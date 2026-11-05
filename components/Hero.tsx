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
 *
 * En celular va todo apilado (promesa, video, botones). Desde `wide` la promesa
 * y los botones quedan a la izquierda y el video a la derecha.
 */
export const Hero: React.FC = () => (
  <section id="top" className="relative overflow-hidden text-center wide:text-left pt-8 desk:pt-9 pb-16 desk:pb-20">
    <div className="wrap relative flex flex-col items-center gap-6">
      <div className="w-full grid grid-cols-1 wide:grid-cols-[5fr_6fr] gap-6 wide:gap-x-12 wide:gap-y-7 items-center">
        <div className="flex flex-col items-center wide:items-start gap-3 wide:col-start-1 wide:row-start-1 wide:self-end">
          <p className="eyebrow text-piedra">Dueño de negocio que vende</p>
          <h1 className="font-extrabold leading-[1.06] tracking-[-0.045em] max-w-[24ch]" style={{ fontSize: 'clamp(30px, 3.2vw, 46px)', textWrap: 'balance' }}>
            Escalá a <span className="inline-block bg-tinta text-marfil px-[0.12em] pb-[0.04em]">USD 50.000 por mes</span> delegando en tu equipo sin perder dinero en reembolsos y morosos.
          </h1>
          <p className="text-piedra max-w-[30em]" style={{ fontSize: 'clamp(17px,1.6vw,20px)', lineHeight: 1.4, textWrap: 'balance' }}>
            El sistema legal que utilizan los negocios de alta facturación.
          </p>
        </div>

        <div className="w-full wide:col-start-2 wide:row-start-1 wide:row-span-2">
          <VideoVSL />
        </div>

        <div className="flex flex-wrap justify-center wide:justify-start gap-3 wide:col-start-1 wide:row-start-2 wide:self-start">
          <Button size="lg" onClick={openCalendly}>
            Agendar auditoría <ArrowRight size={18} aria-hidden="true" />
          </Button>
          <Button size="lg" variant="ghost" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>
            Conocer servicios
          </Button>
        </div>
      </div>

      <Counter />
    </div>
  </section>
);

import React from 'react';
import { Search, Target, Cog, LifeBuoy } from 'lucide-react';
import { Button } from './Button';
import { Reveal } from './Reveal';
import { openCalendly } from '../lib/calendly';

interface Step {
  number: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Diagnóstico',
    description: 'Analizamos tu negocio y detectamos los riesgos legales prioritarios sin tecnicismos innecesarios.',
    icon: Search,
  },
  {
    number: '02',
    title: 'Estrategia',
    description: 'Diseñamos la solución legal a medida de tu modelo de negocio. Nada de soluciones modelo.',
    icon: Target,
  },
  {
    number: '03',
    title: 'Implementación',
    description: 'Ejecutamos: contratos, registros, sociedades y protocolos. Sin demoras burocráticas.',
    icon: Cog,
  },
  {
    number: '04',
    title: 'Soporte continuo',
    description: 'Te acompañamos a medida que tu negocio crece para enfrentar los nuevos desafíos legales.',
    icon: LifeBuoy,
  },
];

export const Process: React.FC = () => {
  return (
    <section id="process" className="section">
      <div className="wrap flex flex-col gap-14">
        <div className="flex flex-col items-center gap-4 max-w-[60ch] mx-auto text-center">
          <p className="eyebrow text-piedra">Cómo trabajamos</p>
          <h2 className="h2">¿Cómo ayudamos a nuestros clientes?</h2>
          <p className="text-[17px] leading-[1.55] text-piedra">
            Cuatro etapas diseñadas para darte resultados desde la primera conversación.
          </p>
        </div>

        <div className="steps">
          <div className="steps-line" aria-hidden="true" />

          {steps.map((step, idx) => (
            <Reveal key={step.number} delay={idx * 120}>
              <div className="relative flex flex-col items-center text-center gap-2.5">
                <div className="step-badge">
                  <span aria-hidden="true" className="wm">{step.number}</span>
                  <div className="step-circle">
                    <step.icon size={32} strokeWidth={1.8} className="text-tinta" />
                  </div>
                </div>

                <span className="eyebrow text-piedra">Paso {step.number}</span>
                <h3 className="h3">{step.title}</h3>
                <p className="text-[15px] leading-[1.6] text-piedra max-w-[30ch]">{step.description}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="text-center">
          <Button onClick={openCalendly}>Agendar auditoría</Button>
        </div>
      </div>
    </section>
  );
};

import React from 'react';
import { Search, Target, Cog, LifeBuoy } from 'lucide-react';
import { Reveal } from './Reveal';

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
    description: 'Diseñamos la solución legal a medida de tu modelo de negocio. Nada de soluciones modelo',
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
    <section id="process" className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        {/* Heading */}
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sm font-bold text-firma uppercase tracking-wider mb-2">
              Cómo trabajamos
            </h2>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Un proceso claro, sin sorpresas
            </h3>
            <p className="text-gray-600 text-lg">
              Cuatro etapas diseñadas para darte resultados desde la primera conversación.
            </p>
          </div>
        </Reveal>

        {/* Steps */}
        <div className="relative">
          {/* Subtle connecting line on desktop */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-px"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to right, #4B6BFF40 0 6px, transparent 6px 14px)',
            }}
          />

          <div className="grid md:grid-cols-4 gap-10 md:gap-6 relative">
            {steps.map((step, idx) => (
              <Reveal key={step.number} delay={idx * 120}>
                <div className="relative flex flex-col items-center text-center">
                {/* Number badge with icon */}
                <div className="relative w-24 h-24 mb-6">
                  {/* Big number watermark */}
                  <span className="absolute inset-0 flex items-center justify-center text-7xl font-black text-firma/10 leading-none select-none">
                    {step.number}
                  </span>
                  {/* Icon circle */}
                  <div className="relative z-10 w-24 h-24 bg-white border-2 border-firma rounded-full flex items-center justify-center shadow-sm">
                    <step.icon size={32} className="text-firma" />
                  </div>
                </div>

                <div className="text-xs font-bold text-firma uppercase tracking-widest mb-2">
                  Paso {step.number}
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h4>
                <p className="text-gray-600 text-sm leading-relaxed max-w-xs">
                  {step.description}
                </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

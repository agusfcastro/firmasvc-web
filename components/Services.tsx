import React from 'react';
import { FileText, Building2, ScrollText, PenTool } from 'lucide-react';
import { ServiceItem } from '../types';
import { Reveal } from './Reveal';

const services: ServiceItem[] = [
  {
    title: "Sociedad constituida",
    description: "Estructuramos legalmente tu empresa para garantizar seguridad jurídica para ambas partes desde el día uno.",
    icon: Building2
  },
  {
    title: "Contratos a medida",
    description: "Cada cierre es único. Olvidate de plantillas genéricas. Redactamos contratos específicos para tu modelo de negocio.",
    icon: FileText
  },
  {
    title: "Protocolos de rendición",
    description: "Establecemos protocolos claros para una correcta rendición de cuentas, vital para la salud financiera y legal.",
    icon: ScrollText
  },
  {
    title: "Registro de marcas",
    description: "Protegemos tu activo más valioso. Registro de todas y cada una de tus marcas comerciales.",
    icon: PenTool
  }
];

export const Services: React.FC = () => {
  return (
    <section id="services" className="section bg-carbon text-marfil">
      <div className="wrap flex flex-col gap-14">
        <div className="flex flex-col items-center gap-4 max-w-[60ch] mx-auto text-center">
          <p className="eyebrow text-calido">Nuestros servicios</p>
          <h2 className="h2">Soluciones de alto valor</h2>
          <p className="text-[17px] leading-[1.55] text-calido">
            No vendemos papeles, vendemos la infraestructura legal para que tu negocio escale sin techos de cristal.
          </p>
        </div>

        <div className="grid grid-cols-1 tab:grid-cols-2 wide:grid-cols-4 gap-5">
          {services.map((service, index) => (
            <Reveal key={service.title} delay={index * 100} className="h-full">
              <article className="card">
                {/* Número al agua */}
                <span aria-hidden="true" className="wm">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="icon-box">
                  <service.icon size={28} strokeWidth={1.8} />
                </div>
                <h3 className="h3 relative">{service.title}</h3>
                <p className="relative text-[15px] leading-[1.6] text-calido">{service.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

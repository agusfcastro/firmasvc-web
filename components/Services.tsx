import React from 'react';
import { FileText, Building2, ScrollText, PenTool } from 'lucide-react';
import { ServiceItem } from '../types';
import { Reveal } from './Reveal';

const services: ServiceItem[] = [
  {
    title: "Sociedad Constituida",
    description: "Estructuramos legalmente tu empresa para garantizar seguridad jurídica para ambas partes desde el día uno.",
    icon: Building2
  },
  {
    title: "Contratos a Medida",
    description: "Cada cierre es único. Olvídate de plantillas genéricas. Redactamos contratos específicos para tu modelo de negocio.",
    icon: FileText
  },
  {
    title: "Protocolos de Rendición",
    description: "Establecemos protocolos claros para una correcta rendición de cuentas, vital para la salud financiera y legal.",
    icon: ScrollText
  },
  {
    title: "Registro de Marcas",
    description: "Protegemos tu activo más valioso. Registro de todas y cada una de tus marcas comerciales.",
    icon: PenTool
  }
];

export const Services: React.FC = () => {
  return (
    <section id="services" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 md:px-6">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-sm font-bold text-firma uppercase tracking-wider mb-2">Nuestros Servicios</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Soluciones de Alto Valor</h3>
            <p className="text-gray-600 text-lg">
              No vendemos papeles, vendemos la infraestructura legal para que tu negocio escale sin techos de cristal.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => {
            const number = String(index + 1).padStart(2, '0');
            return (
              <Reveal key={index} delay={index * 100}>
                <div
                  className="relative bg-white p-8 rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-firma/30 group h-full"
                >
                {/* Number watermark */}
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-1 text-7xl font-black text-gray-100 leading-none select-none pointer-events-none transition-colors duration-300 group-hover:text-firma/10"
                >
                  {number}
                </span>

                {/* Content */}
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-blue-50 text-firma rounded-lg flex items-center justify-center mb-6 transition-colors duration-300 group-hover:bg-firma group-hover:text-white">
                    <service.icon size={28} />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3">{service.title}</h4>
                  <p className="text-gray-600 leading-relaxed text-sm">
                    {service.description}
                  </p>
                </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from './Button';

const CALENDLY_URL = 'https://calendly.com/agustinlegales/30min';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-firma/10 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-300/10 rounded-full blur-3xl opacity-50"></div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-firma text-sm font-semibold mb-8">
            <ShieldCheck size={16} />
            <span>Seguridad jurídica para negocios digitales</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 tracking-tight mb-6 leading-tight">
            blindamos legalmente <br/>
            <span className="text-firma">tu negocio digital</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Soluciones legales prácticas y estratégicas que evitan reembolsos, problemas con socios y proveedores.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              className="w-full sm:w-auto text-lg px-8 py-4"
              onClick={() => window.Calendly?.initPopupWidget({ url: CALENDLY_URL })}
            >
              Agendar auditoría
              <ArrowRight size={20} />
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto text-lg px-8 py-4"
              onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Conocer Servicios
            </Button>
          </div>

          <p className="mt-8 text-sm text-gray-400 font-medium tracking-wide uppercase">
            porque cada acuerdo es una oportunidad para construir seguridad
          </p>
        </div>
      </div>
    </section>
  );
};

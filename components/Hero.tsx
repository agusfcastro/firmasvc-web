import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import { openCalendly } from '../lib/calendly';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-32 pb-10 lg:pt-48 lg:pb-14 overflow-hidden">
      {/* Subtle grid pattern — fades at the edges via radial mask */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(75,107,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(75,107,255,0.07) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)',
        }}
      />

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
            Soluciones estratégicas que evitan reembolsos, problemas con socios y proveedores.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              className="w-full sm:w-auto text-lg px-8 py-4"
              onClick={openCalendly}
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

          {/* Stat strip */}
          <div className="mt-14 pt-10 border-t border-gray-200/70 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-firma">+55</div>
              <div className="text-xs md:text-sm text-gray-500 uppercase tracking-wider mt-1">Contratos</div>
            </div>
            <div className="text-center border-x border-gray-200/70">
              <div className="text-3xl md:text-4xl font-bold text-firma">+20</div>
              <div className="text-xs md:text-sm text-gray-500 uppercase tracking-wider mt-1">Marcas registradas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-firma">+10</div>
              <div className="text-xs md:text-sm text-gray-500 uppercase tracking-wider mt-1">Sociedades constituidas</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

import React from 'react';
import { Calendar, Mail, MessageCircle } from 'lucide-react';
import { Button } from './Button';

export const Contact: React.FC = () => {
  return (
    <section id="contact" className="py-20 bg-blue-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-12 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-firma/5 rounded-full -mr-16 -mt-16"></div>
          
          <div className="md:w-1/2 relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Hoy, poner orden en tu negocio está a una <span className="text-firma">firma</span> de distancia.
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Agenda una llamada de descubrimiento de 15 minutos. Sin compromiso. Analicemos juntos qué necesita tu negocio para blindarse.
            </p>
            <div className="flex flex-col gap-4">
              <a href="mailto:agustin@firmasvc.com" className="flex items-center gap-3 text-gray-700 hover:text-firma transition-colors w-fit">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-firma flex items-center justify-center">
                   <Mail size={20} />
                </div>
                <span className="font-medium">agustin@firmasvc.com</span>
              </a>
              <a 
                href="https://wa.me/5491124617035?text=Hola%20Agust%C3%ADn,%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios." 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-gray-700 hover:text-[#25D366] transition-colors w-fit"
              >
                <div className="w-10 h-10 rounded-full bg-green-50 text-[#25D366] flex items-center justify-center">
                   <MessageCircle size={20} />
                </div>
                <span className="font-medium">+54 9 11 2461-7035</span>
              </a>
            </div>
          </div>

          <div className="md:w-1/3 bg-gray-50 p-8 rounded-2xl border border-gray-100 w-full relative z-10">
             <div className="text-center mb-6">
               <Calendar className="mx-auto text-firma mb-4" size={48} />
               <h3 className="text-xl font-bold text-gray-900">Agenda tu llamada</h3>
               <p className="text-sm text-gray-500 mt-2">Selecciona un horario disponible</p>
             </div>
             
             {/* Mock Calendar Button acting as the main CTA */}
             <Button 
                fullWidth 
                data-cal-namespace="mi-agenda"
                data-cal-link="firma/15min"
                data-cal-config='{"layout":"month_view"}'
             >
                Ver Disponibilidad
             </Button>
             <p className="text-xs text-center text-gray-400 mt-4">
               Te enviaremos un enlace de Google Meet.
             </p>
          </div>
        </div>
      </div>
    </section>
  );
};
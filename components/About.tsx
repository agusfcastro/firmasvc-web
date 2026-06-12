import React from 'react';
import { Reveal } from './Reveal';

export const About: React.FC = () => {
  return (
    <section id="about" className="pt-6 pb-20 bg-white overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <Reveal className="relative max-w-3xl mx-auto">
           {/* Elemento decorativo de fondo */}
           <div className="absolute top-10 left-10 right-0 bottom-0 bg-gray-100 rounded-[3rem] -z-10 transform rotate-2"></div>

           <div className="relative rounded-2xl overflow-hidden shadow-xl bg-black" style={{ paddingBottom: '56.25%', height: 0 }}>
             <iframe
               src="https://www.loom.com/embed/30336d0764b0460eac2d129b45372f98"
               title="Conocé a Agustín, fundador de firma"
               frameBorder="0"
               allowFullScreen
               className="absolute top-0 left-0 w-full h-full"
             ></iframe>
           </div>

           {/* Tarjeta Flotante */}
           <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-xl shadow-xl border border-gray-100 text-center w-56 z-20 hidden md:block">
              <p className="text-firma font-bold text-sm">"Resultados reales"</p>
              <p className="text-gray-500 text-[10px] mt-1 leading-tight">Más allá de la formalidad.</p>
           </div>
        </Reveal>
      </div>
    </section>
  );
};

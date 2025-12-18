import React from 'react';
import { Globe, UserCheck, Briefcase, GraduationCap } from 'lucide-react';
import diplomaImg from '../assets/diploma.jpg';
import trabajoImg from '../assets/trabajo.jpg';
import diplomaImg from '../assets/conferencia.jpg';
import trabajoImg from '../assets/perfil.jpg';

export const About: React.FC = () => {
  return (
    <section id="about" className="py-20 bg-white overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          
          {/* Image Masonry Grid */}
          <div className="grid grid-cols-2 gap-4 relative">
             {/* Decorative Background Blob */}
             <div className="absolute inset-0 bg-firma/5 blur-3xl rounded-full transform scale-150 z-0"></div>
             
             {/* Column 1 */}
             <div className="space-y-4 z-10 mt-8">
               {/* Foto 1: Graduación/Diploma (Vertical) */}
               <div className="relative group overflow-hidden rounded-2xl shadow-lg transition-transform hover:-translate-y-1 duration-300">
                  <img 
                    src={diplomaImg} 
                    alt="Agustín recibiendo diploma UBA" 
                    className="w-full object-cover aspect-[3/4] group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <p className="text-white text-xs font-bold flex items-center gap-1"><GraduationCap size={12}/> Formación Académica</p>
                  </div>
               </div>
               
               {/* Foto 2: Laptop/Contrato (Horizontal/Cuadrada) */}
               <div className="relative group overflow-hidden rounded-2xl shadow-lg transition-transform hover:-translate-y-1 duration-300">
                 <img 
                    src="{trabajoImg}
                    alt="Trabajo con contratos digitales" 
                    className="w-full object-cover aspect-video group-hover:scale-105 transition-transform duration-700"
                  />
               </div>
             </div>

             {/* Column 2 - Offset vertically */}
             <div className="space-y-4 z-10 -mt-8">
                {/* Foto 3: Panel/Charla (Horizontal) */}
                <div className="relative group overflow-hidden rounded-2xl shadow-lg transition-transform hover:-translate-y-1 duration-300">
                  <img 
                    src={conferenciaImg}
                    alt="Disertando en conferencia" 
                    className="w-full object-cover aspect-video group-hover:scale-105 transition-transform duration-700"
                  />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <p className="text-white text-xs font-bold flex items-center gap-1"><Globe size={12}/> Autoridad & Experiencia</p>
                  </div>
                </div>

                {/* Foto 4: Casual/Playa (Vertical) */}
                 <div className="relative group overflow-hidden rounded-2xl shadow-lg transition-transform hover:-translate-y-1 duration-300">
                  <img 
                    src={perfilImg} 
                    alt="Perfil personal Agustín" 
                    className="w-full object-cover aspect-[3/4] group-hover:scale-105 transition-transform duration-700"
                  />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <p className="text-white text-xs font-bold flex items-center gap-1"><UserCheck size={12}/> Humano & Cercano</p>
                  </div>
                </div>
             </div>

             {/* Floating Quote Card */}
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 w-48 hover:scale-105 transition-transform cursor-default">
                <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-gray-100 text-center">
                    <p className="text-firma font-bold text-sm">"No era por usar camisa"</p>
                    <p className="text-gray-500 text-[10px] mt-1 leading-tight">La seriedad no está en la ropa, está en los resultados.</p>
                </div>
             </div>
          </div>
          
          {/* Text Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-firma text-xs font-bold uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-firma"></span>
              Founding
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 leading-tight">
              De las aulas de la <span className="text-firma">UBA</span> al ecosistema digital global.
            </h3>
            
            <div className="space-y-6 text-lg text-gray-600 text-justify">
              <p>
                Hola, soy <strong>Agustín</strong>. Mi carrera comenzó entre libros de <span className="text-firma font-medium">Derecho Internacional Privado</span> y pasillos académicos. Me apasionaba investigar cómo las leyes cruzan fronteras, participando en congresos y seminarios de alto nivel.
              </p>
              <p>
                Pero mientras me formaba en la teoría, también vivía la práctica: gestionaba mi propia consultora B2B. Ahí entendí una verdad incómoda: <strong>el mundo legal tradicional es lento y burocrático</strong>, justo lo opuesto a lo que necesita un negocio digital.
              </p>
              <p>
                Fundé <strong>firma</strong> para cerrar esa brecha. Unimos el rigor académico y la seguridad jurídica con la velocidad y flexibilidad que exige el mercado online actual.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 border-t border-gray-100 pt-8">
              <div className="flex flex-col items-center text-center p-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-firma flex items-center justify-center mb-3">
                    <GraduationCap size={20} />
                </div>
                <span className="text-sm font-bold text-gray-900">Formación UBA</span>
                <span className="text-xs text-gray-500 mt-1">Derecho Internacional</span>
              </div>
              
              <div className="flex flex-col items-center text-center p-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-firma flex items-center justify-center mb-3">
                    <Briefcase size={20} />
                </div>
                <span className="text-sm font-bold text-gray-900">Experiencia B2B</span>
                <span className="text-xs text-gray-500 mt-1">Negocios Reales</span>
              </div>

              <div className="flex flex-col items-center text-center p-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-firma flex items-center justify-center mb-3">
                    <UserCheck size={20} />
                </div>
                <span className="text-sm font-bold text-gray-900">Trato Directo</span>
                <span className="text-xs text-gray-500 mt-1">Sin Intermediarios</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

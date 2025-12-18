import React from 'react';
import { Globe, UserCheck, Briefcase, GraduationCap } from 'lucide-center';

// 1. IMPORTACIÓN DE IMÁGENES (Indispensable para que el deploy no falle)
import diplomaImg from '../assets/diploma.jpg';
import trabajoImg from '../assets/trabajo.jpg';
import conferenciaImg from '../assets/conferencia.jpg';
import perfilImg from '../assets/perfil.jpg';

export const About: React.FC = () => {
  return (
    <section id="about" className="py-20 bg-white overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          
          {/* Columna de Imágenes (Diseño Estructurado/Bento) */}
          <div className="relative pr-4">
             {/* Elemento decorativo de fondo */}
             <div className="absolute top-10 left-10 right-0 bottom-0 bg-gray-100 rounded-[3rem] -z-10 transform rotate-2"></div>
             
             <div className="grid grid-cols-2 gap-4">
               {/* Columna Izquierda de Fotos */}
               <div className="space-y-4">
                  {/* Foto 1: Graduación */}
                  <div className="relative rounded-2xl overflow-hidden shadow-md group">
                    <img 
                      src={diplomaImg} 
                      alt="Agustín recibiendo diploma UBA" 
                      className="w-full h-72 object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                       <p className="text-white text-xs font-bold flex items-center gap-1"><GraduationCap size={12}/> Formación UBA</p>
                    </div>
                  </div>

                  {/* Foto 2: Trabajo */}
                  <div className="relative rounded-2xl overflow-hidden shadow-md group">
                    <img 
                      src={trabajoImg} 
                      alt="Trabajo con contratos" 
                      className="w-full h-40 object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
               </div>

               {/* Columna Derecha de Fotos (Desplazada hacia abajo) */}
               <div className="space-y-4 pt-8">
                  {/* Foto 3: Conferencia */}
                  <div className="relative rounded-2xl overflow-hidden shadow-md group">
                    <img 
                      src={conferenciaImg} 
                      alt="Disertando en conferencia" 
                      className="w-full h-40 object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                       <p className="text-white text-xs font-bold flex items-center gap-1"><Globe size={12}/> Autoridad</p>
                    </div>
                  </div>

                  {/* Foto 4: Perfil */}
                  <div className="relative rounded-2xl overflow-hidden shadow-md group">
                    <img 
                      src={perfilImg} 
                      alt="Perfil personal Agustín" 
                      className="w-full h-72 object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                       <p className="text-white text-xs font-bold flex items-center gap-1"><UserCheck size={12}/> Cercanía</p>
                    </div>
                  </div>
               </div>
             </div>

             {/* Tarjeta Flotante (Centrada) */}
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-xl shadow-xl border border-gray-100 text-center w-48 z-20 hidden md:block">
                <p className="text-firma font-bold text-sm">"Resultados reales"</p>
                <p className="text-gray-500 text-[10px] mt-1">Más allá de la formalidad.</p>
             </div>
          </div>
          
          {/* Contenido de Texto */}
          <div className="flex flex-col justify-center h-full mt-8 md:mt-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-firma text-xs font-bold uppercase tracking-wider mb-4 self-start">
              <span className="w-2 h-2 rounded-full bg-firma"></span>
              Sobre el Fundador
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

            <div className="grid grid-cols-3 gap-2 mt-10 border-t border-gray-100 pt-8">
              <div className="flex flex-col items-center text-center p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="text-firma mb-2">
                    <GraduationCap size={24} />
                </div>
                <span className="text-sm font-bold text-gray-900 leading-tight">Formación<br/>UBA</span>
              </div>
              
              <div className="flex flex-col items-center text-center p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="text-firma mb-2">
                    <Briefcase size={24} />
                </div>
                <span className="text-sm font-bold text-gray-900 leading-tight">Experiencia<br/>B2B</span>
              </div>

              <div className="flex flex-col items-center text-center p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="text-firma mb-2">
                    <UserCheck size={24} />
                </div>
                <span className="text-sm font-bold text-gray-900 leading-tight">Trato<br/>Directo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

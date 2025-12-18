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
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-xl shadow-xl border border-gray-100 text-center w-48 z-

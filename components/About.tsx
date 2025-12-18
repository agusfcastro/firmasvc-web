import React from 'react';
import { Globe, UserCheck, Briefcase } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative">
             <div className="absolute inset-0 bg-firma rounded-2xl rotate-3 opacity-20 transform translate-x-2 translate-y-2"></div>
             {/* Placeholder for Agustin's Image - using a generic professional image */}
             <img 
              src="https://picsum.photos/600/800?grayscale" 
              alt="Agustín, Fundador de Firma" 
              className="relative rounded-2xl shadow-xl w-full h-[600px] object-cover"
             />
             <div className="absolute bottom-8 left-8 bg-white p-6 rounded-xl shadow-lg max-w-xs">
                <p className="text-firma font-bold text-lg">"No era por usar camisa"</p>
                <p className="text-gray-600 text-sm mt-1">Nuestros clientes decían que éramos más serios que la competencia.</p>
             </div>
          </div>
          
          <div>
            <h2 className="text-sm font-bold text-firma uppercase tracking-wider mb-2">Sobre Nosotros</h2>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">De las Aulas Internacionales al Emprendimiento Digital</h3>
            
            <div className="space-y-6 text-lg text-gray-600 text-justify">
              <p>
                Hola, soy <strong>Agustín</strong>. Durante años, mi mundo fue el <span className="text-firma font-medium">Derecho Internacional Privado</span>. Me fascinaba cómo las leyes se cruzaban entre países en un mundo cada vez más interconectado.
              </p>
              <p>
                Investigaba y enseñaba sobre los desafíos de la globalización en aulas y seminarios. Pero había otra faceta en mi vida: era dueño de un negocio digital.
              </p>
              <p>
                Durante dos años estuve al frente de una consultora B2B. Ahí entendí que la seriedad no se mide por la vestimenta, sino por la seguridad que transmites.
              </p>
              <p>
                Así nació <strong>firma</strong>. Una propuesta orientada a dueños de negocio que buscan diferenciarse. Unimos el rigor legal con la agilidad del ecosistema online.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-10">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Globe className="mx-auto text-firma mb-2" size={24} />
                <span className="text-sm font-semibold block">Visión Global</span>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Briefcase className="mx-auto text-firma mb-2" size={24} />
                <span className="text-sm font-semibold block">Exp. B2B</span>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <UserCheck className="mx-auto text-firma mb-2" size={24} />
                <span className="text-sm font-semibold block">Trato Personal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
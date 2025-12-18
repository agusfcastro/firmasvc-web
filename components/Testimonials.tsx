import React from 'react';
import { Quote } from 'lucide-react';
import { Testimonial } from '../types';

const testimonials: Testimonial[] = [
  {
    name: "Sofía Martínez",
    role: "CEO de E-comm Latam",
    text: "Desde que trabajamos con Firma, nuestros contratos internacionales dejaron de ser un dolor de cabeza. La claridad que aportan es impagable.",
    image: "https://picsum.photos/100/100?random=1"
  },
  {
    name: "Javier Torres",
    role: "Fundador de TechSolutions",
    text: "Agustín entiende perfectamente los tiempos de un negocio digital. La constitución de nuestra sociedad fue rápida y sin burocracia innecesaria.",
    image: "https://picsum.photos/100/100?random=2"
  },
  {
    name: "Laura Gómez",
    role: "Directora Creativa",
    text: "El registro de nuestras marcas fue impecable. Sentimos una seguridad real al lanzar nuevos productos al mercado.",
    image: "https://picsum.photos/100/100?random=3"
  }
];

export const Testimonials: React.FC = () => {
  return (
    <section id="testimonials" className="py-20 bg-gray-900 text-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
           <h2 className="text-sm font-bold text-firma-light uppercase tracking-wider mb-2">Testimonios</h2>
           <h3 className="text-3xl md:text-4xl font-bold mb-4">Lo que dicen nuestros clientes</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-gray-800 p-8 rounded-xl relative hover:transform hover:-translate-y-1 transition-transform duration-300">
              <Quote className="text-firma absolute top-6 right-6 opacity-20" size={40} />
              <p className="text-gray-300 mb-6 italic relative z-10">"{t.text}"</p>
              <div className="flex items-center gap-4">
                <img src={t.image} alt={t.name} className="w-12 h-12 rounded-full border-2 border-firma object-cover" />
                <div>
                  <h5 className="font-bold text-white">{t.name}</h5>
                  <span className="text-xs text-gray-400">{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
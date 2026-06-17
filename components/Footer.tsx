import React from 'react';
import { Logo } from './Logo';
import { Instagram, Linkedin, Mail, MessageCircle, MapPin } from 'lucide-react';

const navLinks = [
  { name: 'Sobre nosotros', href: '#about' },
  { name: 'Servicios', href: '#services' },
  { name: 'Proceso', href: '#process' },
  { name: 'Clientes', href: '#testimonials' },
  { name: 'Contacto', href: '#contact' },
];

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-100 pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-5">
            <Logo className="text-3xl mb-4" />
            <p className="text-sm text-gray-600 max-w-sm leading-relaxed mb-6">
              Consultoría legal para negocios digitales. Blindamos tu negocio para que crezcas con confianza.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MapPin size={14} />
              <span>Buenos Aires, Argentina</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">
              Navegación
            </h4>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-firma transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-4">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-4">
              Contacto
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:agustin@firmasvc.com"
                  className="flex items-center gap-3 text-sm text-gray-600 hover:text-firma transition-colors group"
                >
                  <span className="w-8 h-8 rounded-full bg-blue-50 text-firma flex items-center justify-center flex-shrink-0 group-hover:bg-firma group-hover:text-white transition-colors">
                    <Mail size={14} />
                  </span>
                  agustin@firmasvc.com
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/5491124617035?text=Hola%20Agust%C3%ADn,%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-gray-600 hover:text-[#25D366] transition-colors group"
                >
                  <span className="w-8 h-8 rounded-full bg-green-50 text-[#25D366] flex items-center justify-center flex-shrink-0 group-hover:bg-[#25D366] group-hover:text-white transition-colors">
                    <MessageCircle size={14} />
                  </span>
                  +54 9 11 2461-7035
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <p>© {new Date().getFullYear()} Firma. Todos los derechos reservados.</p>
            <a href="/privacidad" className="hover:text-firma transition-colors">
              Política de Privacidad
            </a>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://www.instagram.com/firmaservices/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-firma hover:border-firma flex items-center justify-center transition-colors"
            >
              <Instagram size={16} />
            </a>
            <a
              href="https://www.linkedin.com/in/agusfcastro/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-firma hover:border-firma flex items-center justify-center transition-colors"
            >
              <Linkedin size={16} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

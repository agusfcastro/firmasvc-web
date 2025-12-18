import React from 'react';
import { Logo } from './Logo';
import { Instagram, Linkedin } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-100 py-12">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start">
            <Logo className="text-3xl mb-2" />
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Firma. Todos los derechos reservados.
            </p>
          </div>

          <div className="flex gap-6">
            <a 
              href="https://www.instagram.com/firmaservices/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-firma transition-colors"
            >
              <Instagram size={24} />
            </a>
            <a 
              href="https://www.linkedin.com/in/agusfcastro/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-firma transition-colors"
            >
              <Linkedin size={24} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
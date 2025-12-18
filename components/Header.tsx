import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './Button';

export const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Nosotros', href: '#about' },
    { name: 'Servicios', href: '#services' },
    { name: 'Recursos', href: 'https://www.youtube.com' }, // Vinculado a YouTube como solicitado
    { name: 'Testimonios', href: '#testimonials' },
  ];

  // Helper para manejar atributos de enlaces externos vs internos
  const getLinkAttributes = (href: string) => {
    const isExternal = href.startsWith('http');
    return isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  };

  return (
    <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'}`}>
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <a href="#" className="text-4xl select-none">
          <Logo />
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href} 
              className="text-gray-600 hover:text-firma font-medium transition-colors"
              {...getLinkAttributes(link.href)}
            >
              {link.name}
            </a>
          ))}
          <Button 
            variant="primary" 
            data-cal-namespace="mi-agenda"
            data-cal-link="firma/15min"
            data-cal-config='{"layout":"month_view"}'
          >
            Agendar Llamada
          </Button>
        </nav>

        {/* Mobile Menu Button */}
        <button className="md:hidden text-gray-800" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white shadow-lg md:hidden p-4 flex flex-col gap-4">
           {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href} 
              className="text-gray-800 font-medium py-2 border-b border-gray-100"
              onClick={() => setIsMenuOpen(false)}
              {...getLinkAttributes(link.href)}
            >
              {link.name}
            </a>
          ))}
          <Button 
            fullWidth 
            onClick={() => setIsMenuOpen(false)}
            data-cal-namespace="mi-agenda"
            data-cal-link="firma/15min"
            data-cal-config='{"layout":"month_view"}'
          >
            Agendar Llamada
          </Button>
        </div>
      )}
    </header>
  );
};
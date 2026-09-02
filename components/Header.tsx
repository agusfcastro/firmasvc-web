import React from 'react';
import { Logo } from './Logo';
import { Button } from './Button';
import { openCalendly } from '../lib/calendly';

const navLinks = [
  { name: 'Nosotros', href: '#about' },
  { name: 'Servicios', href: '#services' },
  { name: 'Recursos', href: 'https://www.youtube.com/@agusfcastro' },
  { name: 'Clientes', href: '#testimonials' },
];

const getLinkAttributes = (href: string) =>
  href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {};

export const Header: React.FC = () => {
  return (
    <header
      className="sticky top-0 z-50 bg-marfil"
      style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}
    >
      <div className="wrap flex items-center justify-between gap-4 h-28">
        <a href="#top" className="flex items-center min-w-0">
          <Logo className="h-[72px] max-w-[62vw]" />
        </a>

        {/* Nav desktop (≥900px) */}
        <nav className="hidden desk:flex items-center gap-7 text-sm font-medium">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="transition-colors duration-150 hover:text-bosque"
              {...getLinkAttributes(link.href)}
            >
              {link.name}
            </a>
          ))}
          <Button size="sm" onClick={openCalendly}>
            Agenda
          </Button>
        </nav>

        {/* Mobile: solo el CTA, sin menú desplegable */}
        <Button size="sm" className="desk:hidden px-4" onClick={openCalendly}>
          Agenda
        </Button>
      </div>
    </header>
  );
};

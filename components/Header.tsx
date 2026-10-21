import React from 'react';
import { LockKeyhole } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './Button';
import { openCalendly } from '../lib/calendly';
import { PromoBanner } from './PromoBanner';

const navLinks = [
  { name: 'Nosotros', href: '#quien' },
  { name: 'Servicios', href: '#services' },
  { name: 'Recursos', href: 'https://www.youtube.com/@agusfcastro' },
  { name: 'Testimonios', href: '#testimonials' },
];

// Acceso de clientes: mismo alto que el botón de Agenda, con borde para no competir con él.
const clasePortal =
  'inline-flex items-center justify-center gap-2 h-10 border border-tinta text-sm font-medium whitespace-nowrap transition-colors duration-150 hover:bg-tinta hover:text-marfil';

const getLinkAttributes = (href: string) =>
  href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {};

export const Header: React.FC = () => {
  return (
    <header
      className="sticky top-0 z-50 bg-marfil"
      style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}
    >
      <PromoBanner />
      <div className="wrap flex items-center justify-between gap-4 h-28">
        <a href="#top" className="flex items-center min-w-0">
          <Logo className="h-[72px] max-w-[62vw] desk:h-[60px] desk:max-w-full min-[1200px]:h-[72px]" />
        </a>

        {/* Nav desktop (≥900px) */}
        <nav className="hidden desk:flex shrink-0 items-center gap-5 min-[1200px]:gap-7 text-sm font-medium">
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
          <a href="/portal" className={`${clasePortal} px-[18px]`}>
            <LockKeyhole size={14} aria-hidden="true" />
            {/* Entre 900 y 1200 px no entra el texto largo al lado del logo. */}
            <span className="min-[1200px]:hidden">Portal</span>
            <span className="hidden min-[1200px]:inline">Portal de clientes</span>
          </a>
          <Button size="sm" onClick={openCalendly}>
            Agenda
          </Button>
        </nav>

        {/* Mobile: portal y CTA, sin menú desplegable */}
        <div className="desk:hidden flex items-center gap-2 shrink-0">
          <a href="/portal" className={`${clasePortal} px-3`} aria-label="Portal de clientes">
            <LockKeyhole size={14} aria-hidden="true" />
            <span className="hidden tab:inline">Portal</span>
          </a>
          <Button size="sm" className="px-4" onClick={openCalendly}>
            Agenda
          </Button>
        </div>
      </div>
    </header>
  );
};

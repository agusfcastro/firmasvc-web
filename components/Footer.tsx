import React from 'react';
import { Logo } from './Logo';

const columns: { title: string; items: { name: string; href?: string; external?: boolean }[] }[] = [
  {
    title: 'Membrete',
    items: [
      { name: 'Agustín Castro' },
      { name: 'Abogado (UBA)' },
      { name: 'Buenos Aires, Argentina' },
    ],
  },
  {
    title: 'Navegación',
    items: [
      { name: 'Sobre nosotros', href: '#about' },
      { name: 'Servicios', href: '#services' },
      { name: 'Proceso', href: '#process' },
      { name: 'Clientes', href: '#testimonials' },
      { name: 'Contacto', href: '#contact' },
    ],
  },
  {
    title: 'Contacto',
    items: [
      { name: 'agustin@firmasvc.com', href: 'mailto:agustin@firmasvc.com' },
      { name: '+54 9 11 2461-7035', href: 'https://wa.me/5491124617035', external: true },
    ],
  },
  {
    title: 'Redes',
    items: [
      { name: 'Instagram', href: 'https://instagram.com/agustin.legales', external: true },
      { name: 'LinkedIn', href: 'https://www.linkedin.com/in/agusfcastro/', external: true },
      { name: 'YouTube', href: 'https://www.youtube.com/@agusfcastro', external: true },
    ],
  },
];

const linkClass = 'transition-colors duration-150 hover:text-marfil w-fit';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-carbon text-calido">
      <div className="wrap pt-[72px] pb-10 flex flex-col gap-14">
        <Logo variant="oscuro" className="h-12 self-start max-w-full" />

        <div className="grid grid-cols-1 tab:grid-cols-2 wide:grid-cols-4 gap-8">
          {columns.map((column) => (
            <div key={column.title} className="flex flex-col gap-2 text-sm leading-[1.6]">
              {column.items.map((item, i) =>
                item.href ? (
                  <a
                    key={item.name}
                    href={item.href}
                    className={linkClass}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {item.name}
                  </a>
                ) : (
                  // La primera línea del membrete es el nombre: va en marfil
                  <span key={item.name} className={i === 0 ? 'text-marfil font-medium' : undefined}>
                    {item.name}
                  </span>
                )
              )}
            </div>
          ))}
        </div>

        <div
          className="flex flex-wrap justify-between gap-4 pt-6 text-xs"
          style={{ borderTop: '1px solid rgba(245,243,236,0.14)' }}
        >
          <span>© {new Date().getFullYear()} Firma. Todos los derechos reservados.</span>
          <a href="/privacidad" className={linkClass}>
            Política de Privacidad
          </a>
        </div>
      </div>
    </footer>
  );
};

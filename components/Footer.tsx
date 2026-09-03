import React from 'react';
import { Logo } from './Logo';

const contacto = [
  { name: 'agustin@firmasvc.com', href: 'mailto:agustin@firmasvc.com' },
  { name: '+54 9 11 2461-7035', href: 'https://wa.me/5491124617035', external: true },
];

const redes = [
  { name: 'Instagram', href: 'https://instagram.com/agustin.legales', external: true },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/agusfcastro/', external: true },
  { name: 'YouTube', href: 'https://www.youtube.com/@agusfcastro', external: true },
];

const linkClass = 'w-fit transition-colors duration-150 hover:text-marfil';

const Column: React.FC<{ title: string; items: typeof contacto }> = ({ title, items }) => (
  <div className="flex flex-col gap-2 text-sm leading-[1.6]">
    <span className="eyebrow text-[11px] text-marfil/70 mb-1">{title}</span>
    {items.map((item) => (
      <a
        key={item.name}
        href={item.href}
        className={linkClass}
        {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {item.name}
      </a>
    ))}
  </div>
);

export const Footer: React.FC = () => {
  return (
    <footer className="bg-carbon text-calido">
      {/* Pie compacto: la navegación ya vive en el header, acá sólo membrete y contacto */}
      <div className="wrap pt-14 pb-8 flex flex-col gap-10">
        <div className="grid grid-cols-1 tab:grid-cols-[2fr_1fr_1fr] gap-8">
          <div className="flex flex-col gap-5">
            <Logo variant="oscuro" className="h-10 self-start max-w-full" />
            <div className="flex flex-col gap-1 text-sm leading-[1.6]">
              <span className="text-marfil font-medium">Agustín Castro</span>
              <span>Abogado (UBA)</span>
              <span>Buenos Aires, Argentina</span>
            </div>
          </div>

          <Column title="Contacto" items={contacto} />
          <Column title="Redes" items={redes} />
        </div>

        <div
          className="flex flex-wrap justify-between gap-4 pt-5 text-xs"
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

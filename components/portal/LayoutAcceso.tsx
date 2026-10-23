import React from 'react';
import { Logo } from '../Logo';
import simboloOscuro from '../../assets/brand/simbolo-oscuro.png';

/** Pantallas de ingreso: panel carbón con la marca y formulario sobre marfil. */
export const LayoutAcceso: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-marfil text-tinta grid desk:grid-cols-[5fr_6fr]">
    <aside className="panel-carbon relative overflow-hidden flex flex-col justify-between gap-10 px-6 py-8 tab:px-12 desk:px-14 desk:py-14">
      <img
        src={simboloOscuro}
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none select-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] desk:w-[150%]"
        style={{ opacity: 0.07, maxWidth: 'none' }}
      />
      <a href="/" className="relative self-start" aria-label="Ir a firmasvc.com">
        <Logo variant="oscuro" className="h-12 desk:h-14" />
      </a>
      {/* El título va siempre en dos renglones. Ninguno se corta y el tamaño se ajusta al ancho del panel. */}
      <div className="relative flex flex-col gap-5" style={{ containerType: 'inline-size' }}>
        <p className="eyebrow text-calido">Portal de clientes</p>
        <p
          className="font-heading font-black leading-[1.04] tracking-[-0.02em]"
          style={{ fontSize: 'min(clamp(30px, 4.4vw, 52px), 10.2cqi)' }}
        >
          <span className="block whitespace-nowrap">tu empresa,</span>
          <span className="block whitespace-nowrap text-calido">legalmente en orden</span>
        </p>
        <p className="hidden desk:block text-calido text-[16px] leading-[1.6] max-w-[38ch]">
          Los contratos, las firmas, los asuntos y los protocolos de tu empresa, en un solo lugar.
        </p>
      </div>
      <p className="relative hidden desk:block text-xs text-calido">Acceso restringido · Agustín Castro, Abogado (UBA)</p>
    </aside>
    <main className="flex items-center px-6 py-12 tab:px-12 desk:px-20">
      <div className="w-full max-w-[440px]">{children}</div>
    </main>
  </div>
);

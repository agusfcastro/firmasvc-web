import React from 'react';
import { Logo } from '../Logo';
import simboloOscuro from '../../assets/brand/simbolo-oscuro.png';

/** Pantallas de ingreso: panel tinta con la marca (el mismo tono que la barra lateral del portal) y formulario sobre marfil. */
export const LayoutAcceso: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  // En el celular la franja tinta va a su altura y el formulario toma el resto. Sin grid-rows, la grilla
  // repartía el alto de la pantalla entre las dos filas y la franja ocupaba casi un cuarto.
  <div className="portal min-h-screen bg-marfil text-tinta grid grid-rows-[auto_1fr] desk:grid-rows-none desk:grid-cols-[5fr_6fr]">
    <aside className="bg-tinta text-marfil relative overflow-hidden flex flex-col justify-between gap-10 px-6 py-2 tab:px-12 desk:px-14 desk:py-14">
      <img
        src={simboloOscuro}
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none select-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] desk:w-[150%]"
        style={{ opacity: 0.07, maxWidth: 'none' }}
      />
      <div className="relative flex items-center justify-between gap-4">
        <a href="/" className="inline-flex items-center min-h-[44px]" aria-label="Ir a firmasvc.com">
          <Logo variant="oscuro" className="h-8 desk:h-14" />
        </a>
        <span className="desk:hidden text-[13px] text-lateral-texto">Portal de clientes</span>
      </div>
      {/* El título va siempre en dos renglones. Ninguno se corta y el tamaño se ajusta al ancho del panel. */}
      <div className="relative hidden desk:flex flex-col gap-5" style={{ containerType: 'inline-size' }}>
        <p className="p-volanta text-lateral-tenue">Portal de clientes</p>
        <p
          className="font-extrabold leading-[1.08] tracking-[-0.04em]"
          style={{ fontSize: 'min(clamp(30px, 4.4vw, 54px), 10.6cqi)' }}
        >
          <span className="block whitespace-nowrap">Tu empresa,</span>
          <span className="block whitespace-nowrap"><span className="inline-block bg-marfil text-tinta px-[0.14em] mt-[0.1em]">legalmente</span> en orden.</span>
        </p>
        <p className="text-lateral-texto text-[16px] leading-[1.6] max-w-[38ch]">
          Los contratos, las firmas, los asuntos y los protocolos de tu empresa, en un solo lugar.
        </p>
      </div>
      <p className="relative hidden desk:block text-[13px] text-lateral-tenue">Acceso restringido · Agustín Castro, Abogado (UBA)</p>
    </aside>
    <main className="flex items-start desk:items-center px-6 pt-8 pb-12 tab:px-12 desk:px-20">
      <div className="w-full max-w-[440px]">{children}</div>
    </main>
  </div>
);

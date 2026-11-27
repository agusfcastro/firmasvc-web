import React from 'react';

/**
 * Campos, avisos y estados con el estilo de antes de HeroUI, para las páginas públicas que no son
 * el portal: la firma y la verificación de documentos (components/firma) y la herramienta de
 * comprobantes, y las pantallas de ingreso del portal (Ingresar, SegundoFactor, DefinirClave), que
 * pasan a HeroUI al final. Quedan iguales a propósito: la firma electrónica no se toca. El portal usa los de
 * components/portal/ui.tsx, que van con HeroUI.
 */

export const Campo: React.FC<{ etiqueta: string; ayuda?: string; children: React.ReactNode }> = ({ etiqueta, ayuda, children }) => (
  <label className="block">
    <span className="block text-[13px] font-medium text-tinta mb-1.5">{etiqueta}</span>
    {children}
    {ayuda && <span className="block text-[12.5px] leading-[1.45] text-piedra mt-1.5">{ayuda}</span>}
  </label>
);

/** Borde con 3,6 a 1 sobre blanco (WCAG pide 3 a 1) y foco de 2 px en tinta. */
export const claseInput =
  'w-full h-11 px-3.5 bg-white border border-borde rounded-control text-[15px] placeholder:text-piedra/70 transition-[border-color,box-shadow] duration-150 hover:border-tinta focus:outline-none focus:border-bosque focus:ring-2 focus:ring-bosque/25 disabled:bg-marfil-oscuro disabled:text-piedra disabled:hover:border-borde';

export const Aviso: React.FC<{ tipo?: 'error' | 'ok' | 'info'; children: React.ReactNode }> = ({ tipo = 'info', children }) => {
  const estilos = {
    error: 'border-peligro-borde bg-peligro-suave text-peligro-fuerte',
    ok: 'border-borde-suave bg-niebla text-tinta',
    info: 'border-borde-suave bg-papel text-tinta',
  }[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`border rounded-control px-4 py-3 text-sm leading-[1.5] ${estilos}`}>
      {children}
    </div>
  );
};

/** Estado con punto de color, en el registro tipográfico de los eyebrow. */
export const Etiqueta: React.FC<{ children: React.ReactNode; tono?: 'bosque' | 'piedra' | 'alerta' | 'tinta' }> = ({ children, tono = 'piedra' }) => {
  const c = {
    bosque: 'text-marfil bg-tinta',
    piedra: 'text-tinta bg-niebla',
    alerta: 'text-peligro bg-peligro-suave',
    tinta: 'text-tinta bg-transparent ring-1 ring-inset ring-tinta',
  }[tono];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-pastilla text-[12px] font-semibold whitespace-nowrap ${c}`}>
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
};

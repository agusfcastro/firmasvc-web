import React from 'react';
import { Eye, LogOut } from 'lucide-react';
import { salirVistaPrevia, useVistaPrevia } from './vistaPrevia';
import { ROTULO_ROL } from './tipos';
import { Logo } from '../Logo';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import type { Perfil } from './tipos';

export const Marco: React.FC<{ perfil?: Perfil | null; children: React.ReactNode; ancho?: 'angosto' | 'normal' }> = ({
  perfil,
  children,
  ancho = 'normal',
}) => {
  const vista = useVistaPrevia();
  return (
  <div className="min-h-screen bg-marfil text-tinta flex flex-col">
    {vista && (
      <div className="bg-tinta text-marfil text-sm sticky top-0 z-50">
        <div className="wrap flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
          <Eye size={16} />
          <span className="flex-1 min-w-[200px]">
            Viendo como <strong>{vista.nombre ?? ROTULO_ROL[vista.rol]}</strong> · {ROTULO_ROL[vista.rol]} de {vista.orgNombre}
            {vista.rol === 'miembro' && vista.areas.length > 0 ? ` · áreas ${vista.areas.join(', ')}` : ''}. Solo lectura.
          </span>
          <button type="button" onClick={salirVistaPrevia} className="underline underline-offset-4 font-medium">
            Salir de la vista
          </button>
        </div>
      </div>
    )}
    <header className="bg-marfil" style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}>
      <div className="wrap flex items-center justify-between gap-4 h-20">
        <a
          href="/portal"
          onClick={(e) => {
            e.preventDefault();
            navegar('/portal');
          }}
          className="flex items-center min-w-0"
        >
          <Logo className="h-[52px] max-w-[52vw]" />
        </a>
        {perfil && (
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden tab:inline text-piedra truncate max-w-[220px]">{perfil.nombre || perfil.email}</span>
            <button
              type="button"
              onClick={async () => {
                await supabase?.auth.signOut();
                navegar('/portal/ingresar');
              }}
              className="inline-flex items-center gap-2 font-medium hover:text-bosque"
            >
              <LogOut size={16} /> Salir
            </button>
          </div>
        )}
      </div>
    </header>
    <main className={`wrap flex-1 py-10 desk:py-14 ${ancho === 'angosto' ? 'max-w-[480px]' : ''}`}>{children}</main>
    <footer className="wrap py-6 text-xs text-piedra" style={{ borderTop: '1px solid rgba(27,31,27,0.12)' }}>
      FIRMA · Portal de clientes · Acceso restringido. La información de este portal es confidencial.
    </footer>
  </div>
  );
};

export const Campo: React.FC<{ etiqueta: string; ayuda?: string; children: React.ReactNode }> = ({ etiqueta, ayuda, children }) => (
  <label className="block">
    <span className="block text-sm font-medium mb-1.5">{etiqueta}</span>
    {children}
    {ayuda && <span className="block text-xs text-piedra mt-1">{ayuda}</span>}
  </label>
);

export const claseInput =
  'w-full h-11 px-3 bg-white border border-[rgba(27,31,27,0.25)] rounded-none text-[15px] focus:outline-none focus:border-bosque focus:ring-1 focus:ring-bosque';

export const Aviso: React.FC<{ tipo?: 'error' | 'ok' | 'info'; children: React.ReactNode }> = ({ tipo = 'info', children }) => {
  const estilos = {
    error: 'border-[#8a2b20] bg-[#f6e7e4] text-[#5c1d15]',
    ok: 'border-bosque bg-[#E4E9E3] text-bosque',
    info: 'border-[rgba(27,31,27,0.25)] bg-marfil-oscuro text-tinta',
  }[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`border-l-4 px-4 py-3 text-sm ${estilos}`}>
      {children}
    </div>
  );
};

export const Cargando: React.FC = () => (
  <div className="min-h-screen bg-marfil flex items-center justify-center text-piedra text-sm">Cargando…</div>
);

export const Etiqueta: React.FC<{ children: React.ReactNode; tono?: 'bosque' | 'piedra' | 'alerta' }> = ({ children, tono = 'piedra' }) => {
  const c = { bosque: 'bg-[#E4E9E3] text-bosque', piedra: 'bg-marfil-oscuro text-piedra', alerta: 'bg-[#f6e7e4] text-[#8a2b20]' }[tono];
  return <span className={`inline-block px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
};

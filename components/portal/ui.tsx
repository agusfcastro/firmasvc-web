import React from 'react';
import { Eye, LogOut } from 'lucide-react';
import { Logo } from '../Logo';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { salirVistaPrevia, useVistaPrevia } from './vistaPrevia';
import { ROTULO_ROL, type Perfil } from './tipos';

import simboloClaro from '../../assets/brand/simbolo-claro.png';

/* ------------------------------------------------------------------ */
/* Enlace interno sin recargar la página                              */
/* ------------------------------------------------------------------ */
export const Enlace: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement> & { a: string }> = ({ a, onClick, children, ...resto }) => (
  <a
    href={a}
    onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      navegar(a);
    }}
    {...resto}
  >
    {children}
  </a>
);

/* ------------------------------------------------------------------ */
/* Marco general: header como la landing, pie carbón                   */
/* ------------------------------------------------------------------ */
export const Marco: React.FC<{ perfil?: Perfil | null; children: React.ReactNode; ancho?: 'angosto' | 'normal' }> = ({ perfil, children, ancho = 'normal' }) => {
  const vista = useVistaPrevia();
  const ruta = window.location.pathname.replace(/\/$/, '');
  const links = perfil
    ? [
        { a: '/portal', titulo: 'Inicio', activo: ruta === '/portal' },
        { a: '/portal/crm', titulo: 'CRM legal', activo: ruta.startsWith('/portal/crm') },
        { a: '/portal/documentos', titulo: 'Documentos', activo: ruta.startsWith('/portal/documentos') },
        { a: '/portal/agenda', titulo: 'Agenda', activo: ruta === '/portal/agenda' },
        ...(perfil.rol === 'admin' ? [{ a: '/portal/admin', titulo: 'Administración', activo: ruta.startsWith('/portal/admin') }] : []),
      ]
    : [];

  return (
    <div className="min-h-screen bg-marfil text-tinta flex flex-col">
      {vista && (
        <div className="bg-bosque text-marfil text-sm">
          <div className="wrap flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
            <Eye size={16} aria-hidden="true" />
            <span className="flex-1 min-w-[200px]">
              Viendo como <strong>{vista.nombre ?? ROTULO_ROL[vista.rol]}</strong>, {ROTULO_ROL[vista.rol].toLowerCase()} de {vista.orgNombre}
              {vista.rol === 'miembro' && vista.areas.length > 0 ? ` (${vista.areas.join(', ')})` : ''}. Solo lectura.
            </span>
            <button type="button" onClick={salirVistaPrevia} className="font-medium underline underline-offset-4 hover:no-underline">
              Salir de la vista
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-marfil" style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}>
        <div className="wrap flex items-center gap-6 h-20 desk:h-24">
          <Enlace a="/portal" className="flex items-center min-w-0 shrink-0" aria-label="Inicio del portal">
            <Logo className="h-[48px] desk:h-[60px] max-w-[46vw]" />
          </Enlace>
          <nav className="hidden tab:flex items-center gap-7 text-sm font-medium ml-4">
            {links.map((l) => (
              <Enlace
                key={l.a}
                a={l.a}
                aria-current={l.activo ? 'page' : undefined}
                className={`py-2 border-b-2 transition-colors duration-150 ${l.activo ? 'border-bosque text-bosque' : 'border-transparent hover:text-bosque'}`}
              >
                {l.titulo}
              </Enlace>
            ))}
          </nav>
          <div className="flex-1" />
          {perfil && (
            <div className="flex items-center gap-5 text-sm">
              <span className="hidden desk:flex flex-col items-end leading-tight">
                <span className="font-medium truncate max-w-[220px]">{perfil.nombre || perfil.email}</span>
                <span className="text-[11px] uppercase tracking-[0.16em] text-piedra">{ROTULO_ROL[perfil.rol]}</span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await supabase?.auth.signOut();
                  navegar('/portal/ingresar');
                }}
                className="inline-flex items-center gap-2 h-10 px-4 border border-tinta font-medium transition-colors duration-150 hover:bg-tinta hover:text-marfil"
              >
                <LogOut size={15} aria-hidden="true" /> Salir
              </button>
            </div>
          )}
        </div>
        {links.length > 0 && (
          <nav className="tab:hidden wrap flex gap-6 text-sm font-medium overflow-x-auto scrollbar-hide" style={{ borderTop: '1px solid rgba(27,31,27,0.08)' }}>
            {links.map((l) => (
              <Enlace key={l.a} a={l.a} className={`py-3 whitespace-nowrap border-b-2 ${l.activo ? 'border-bosque text-bosque' : 'border-transparent'}`}>
                {l.titulo}
              </Enlace>
            ))}
          </nav>
        )}
      </header>

      <main className={`flex-1 ${ancho === 'angosto' ? 'wrap max-w-[520px] py-14' : ''}`}>{children}</main>

      <footer className="bg-carbon text-calido">
        <div className="wrap py-8 flex flex-wrap items-center justify-between gap-4 text-sm">
          <Logo variant="oscuro" className="h-9" />
          <span>Portal de clientes · La información de este portal es confidencial.</span>
          <a href="mailto:agustin@firmasvc.com" className="hover:text-marfil transition-colors duration-150">
            agustin@firmasvc.com
          </a>
        </div>
      </footer>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Encabezado de página con el símbolo como marca de agua              */
/* ------------------------------------------------------------------ */
export const Encabezado: React.FC<{
  eyebrow?: React.ReactNode;
  titulo: React.ReactNode;
  bajada?: React.ReactNode;
  acciones?: React.ReactNode;
  grande?: boolean;
}> = ({ eyebrow, titulo, bajada, acciones, grande }) => (
  <section className="relative overflow-hidden" style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}>
    <img
      src={simboloClaro}
      alt=""
      aria-hidden="true"
      className="absolute right-[-6%] top-1/2 -translate-y-1/2 pointer-events-none select-none w-[min(70vw,640px)]"
      style={{ opacity: 0.05, maxWidth: 'none' }}
    />
    <div className={`wrap relative flex flex-wrap items-end justify-between gap-6 ${grande ? 'pt-14 pb-12 desk:pt-20 desk:pb-16' : 'pt-10 pb-9 desk:pt-14 desk:pb-11'}`}>
      <div className="flex flex-col gap-4 max-w-[760px]">
        {eyebrow && <p className="eyebrow text-piedra">{eyebrow}</p>}
        <h1 className={grande ? 'h1' : 'h2'}>{titulo}</h1>
        {bajada && <p className="text-piedra text-[17px] leading-[1.55] max-w-[52ch]">{bajada}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-3">{acciones}</div>}
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Cifras al estilo del contador del hero                              */
/* ------------------------------------------------------------------ */
export interface Cifra {
  titulo: string;
  valor: React.ReactNode;
  alerta?: boolean;
  nota?: React.ReactNode;
}

/** Monto con la moneda chica adelante, como el contador del hero. */
export const Monto: React.FC<{ n: number | null | undefined; moneda?: string }> = ({ n, moneda = 'USD' }) => (
  <>
    <span className="text-[0.48em] font-bold text-piedra mr-1.5 align-[0.3em] tracking-normal">{moneda}</span>
    {n === null || n === undefined ? '·' : Math.round(Number(n)).toLocaleString('es-AR')}
  </>
);

export const Cifras: React.FC<{ items: Cifra[]; cargando?: boolean }> = ({ items, cargando }) => (
  <div className="cifras">
    {items.map((c) => (
      <div key={c.titulo} className="cifra">
        <span className={`cifra-valor ${c.alerta ? 'text-[#8a2b20]' : 'text-bosque'}`}>{cargando ? '·' : c.valor}</span>
        <span className="eyebrow stat-label text-piedra">{c.titulo}</span>
        {c.nota && <span className="text-xs text-piedra">{c.nota}</span>}
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/* Título de sección                                                    */
/* ------------------------------------------------------------------ */
export const TituloSeccion: React.FC<{ eyebrow?: string; titulo: React.ReactNode; acciones?: React.ReactNode }> = ({ eyebrow, titulo, acciones }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
    <div className="flex flex-col gap-2">
      {eyebrow && <p className="eyebrow text-piedra">{eyebrow}</p>}
      <h2 className="h3">{titulo}</h2>
    </div>
    {acciones && <div className="flex flex-wrap gap-3">{acciones}</div>}
  </div>
);

/* ------------------------------------------------------------------ */
/* Pestañas con subrayado verde                                         */
/* ------------------------------------------------------------------ */
export function Pestanas<T extends string>({ items, activa, alCambiar }: { items: { clave: T; titulo: string; cuenta?: number }[]; activa: T; alCambiar: (c: T) => void }) {
  return (
    <div className="flex gap-6 overflow-x-auto scrollbar-hide" style={{ borderBottom: '1px solid rgba(27,31,27,0.15)' }} role="tablist">
      {items.map((i) => (
        <button
          key={i.clave}
          type="button"
          role="tab"
          aria-selected={activa === i.clave}
          onClick={() => alCambiar(i.clave)}
          className={`pb-3 -mb-px text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-150 ${activa === i.clave ? 'border-bosque text-bosque' : 'border-transparent text-piedra hover:text-tinta'}`}
        >
          {i.titulo}
          {i.cuenta !== undefined && <span className="ml-1.5 tabular-nums text-xs opacity-70">{i.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interruptor                                                          */
/* ------------------------------------------------------------------ */
export const Interruptor: React.FC<{ activo: boolean; alCambiar?: (v: boolean) => void; etiqueta: string; ayuda?: string; deshabilitado?: boolean }> = ({ activo, alCambiar, etiqueta, ayuda, deshabilitado }) => (
  <label className={`inline-flex items-start gap-3 ${deshabilitado ? 'opacity-60' : 'cursor-pointer'}`}>
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={deshabilitado}
      onClick={() => alCambiar?.(!activo)}
      className={`relative shrink-0 w-11 h-6 mt-0.5 border transition-colors duration-150 ${activo ? 'bg-bosque border-bosque' : 'bg-white border-[rgba(27,31,27,0.35)]'}`}
    >
      <span className={`absolute top-[3px] w-4 h-4 transition-all duration-150 ${activo ? 'left-[23px] bg-marfil' : 'left-[3px] bg-tinta'}`} />
    </button>
    <span className="flex flex-col">
      <span className="text-sm font-medium">{etiqueta}</span>
      {ayuda && <span className="text-xs text-piedra mt-0.5 max-w-[42ch]">{ayuda}</span>}
    </span>
  </label>
);

/* ------------------------------------------------------------------ */
/* Formularios                                                         */
/* ------------------------------------------------------------------ */
export const Campo: React.FC<{ etiqueta: string; ayuda?: string; children: React.ReactNode }> = ({ etiqueta, ayuda, children }) => (
  <label className="block">
    <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-2">{etiqueta}</span>
    {children}
    {ayuda && <span className="block text-xs text-piedra mt-1.5">{ayuda}</span>}
  </label>
);

export const claseInput =
  'w-full h-12 px-3.5 bg-white border border-[rgba(27,31,27,0.22)] rounded-none text-[15px] transition-colors duration-150 hover:border-[rgba(27,31,27,0.45)] focus:outline-none focus:border-bosque focus:ring-1 focus:ring-bosque disabled:bg-marfil-oscuro disabled:text-piedra disabled:hover:border-[rgba(27,31,27,0.22)]';

export const Aviso: React.FC<{ tipo?: 'error' | 'ok' | 'info'; children: React.ReactNode }> = ({ tipo = 'info', children }) => {
  const estilos = {
    error: 'border-[#8a2b20] bg-[#f6e7e4] text-[#5c1d15]',
    ok: 'border-bosque bg-[#E4E9E3] text-bosque',
    info: 'border-tinta bg-marfil-oscuro text-tinta',
  }[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`border-l-[3px] px-4 py-3 text-sm leading-[1.5] ${estilos}`}>
      {children}
    </div>
  );
};

export const Cargando: React.FC = () => (
  <div className="min-h-screen bg-marfil flex flex-col items-center justify-center gap-4">
    <img src={simboloClaro} alt="" aria-hidden="true" className="w-16 opacity-30 animate-pulse" />
    <span className="eyebrow text-piedra">Cargando</span>
  </div>
);

/** Estado con punto de color, en el registro tipográfico de los eyebrow. */
export const Etiqueta: React.FC<{ children: React.ReactNode; tono?: 'bosque' | 'piedra' | 'alerta' | 'tinta' }> = ({ children, tono = 'piedra' }) => {
  const c = {
    bosque: 'text-bosque bg-[#E4E9E3]',
    piedra: 'text-piedra bg-marfil-oscuro',
    alerta: 'text-[#8a2b20] bg-[#f6e7e4]',
    tinta: 'text-marfil bg-tinta',
  }[tono];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] whitespace-nowrap ${c}`}>
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
};

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { navegar } from '../navegacion';
import type { ClienteResumen } from './tipos';

const DIA = 86400000;
/** Desde cuántos días antes del fin se avisa que el contrato vence. */
export const AVISO_VENCE_DIAS = 45;
/** Cuánto se marca como onboarding al principio de cada contrato. */
const ONBOARDING_DIAS = 14;
const MESES_VISIBLES = 12;

const verde = 'color-mix(in srgb, var(--color-bosque) 72%, white)';
const rayado = 'repeating-linear-gradient(135deg, var(--color-borde-suave) 0 6px, var(--color-separador) 6px 12px)';

/** Fin del contrato: la fecha de onboarding más la duración del servicio. Sin alguna de las dos, no hay fin. */
export function finDelContrato(inicio: string | null | undefined, meses: number | null | undefined): Date | null {
  if (!inicio || !meses) return null;
  const fin = new Date(inicio);
  fin.setMonth(fin.getMonth() + meses);
  return fin;
}

const corta = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');

/**
 * Vista de proyecto de los clientes: una barra por cliente desde el onboarding hasta el fin
 * del contrato, en meses. Las dos primeras semanas son el onboarding; la firma pendiente va
 * punteada, las bajas rayadas y se avisa cuando faltan 45 días o menos.
 */
export const LineaTiempo: React.FC<{
  filas: ClienteResumen[];
  duracion: (servicio: string | null | undefined) => number | null;
  nombreEquipo: (id: string | null | undefined) => string | null;
}> = ({ filas, duracion, nombreEquipo }) => {
  // Arranca cuatro meses antes del actual y muestra doce. Las flechas corren de a tres.
  const [corrimiento, setCorrimiento] = useState(0);
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 4 + corrimiento, 1);
  const hasta = new Date(desde.getFullYear(), desde.getMonth() + MESES_VISIBLES, 1);
  const meses = Array.from({ length: MESES_VISIBLES }, (_, i) => new Date(desde.getFullYear(), desde.getMonth() + i, 1));
  const pos = (d: Date) => ((d.getTime() - desde.getTime()) / (hasta.getTime() - desde.getTime())) * 100;
  const recorte = (x: number) => Math.max(0, Math.min(100, x));
  const posHoy = pos(hoy);

  const ordenadas = useMemo(
    () => [...filas].sort((a, b) => (a.fecha_onboarding ? 0 : 1) - (b.fecha_onboarding ? 0 : 1) || (a.fecha_onboarding ?? '').localeCompare(b.fecha_onboarding ?? '')),
    [filas],
  );

  const barra = (c: ClienteResumen) => {
    if (!c.fecha_onboarding) return <span className="absolute inset-y-0 left-2 flex items-center text-[12.5px] text-piedra">Sin fecha de onboarding</span>;
    const inicio = new Date(c.fecha_onboarding);
    const meses = duracion(c.servicio);
    const fin = finDelContrato(c.fecha_onboarding, meses);
    const baja = c.estado_firma === 'Baja';
    const pendiente = c.estado_firma === 'Pendiente' || c.estado_firma === 'En firma';
    const finVisual = fin ?? new Date(inicio.getTime() + 120 * DIA);
    const x0 = pos(inicio);
    const x1 = pos(finVisual);
    if (x1 < 0 || x0 > 100)
      return (
        <span className="absolute inset-y-0 left-2 flex items-center text-[12.5px] text-piedra">
          {x1 < 0 ? `Terminó el ${corta(finVisual)}` : `Empieza el ${corta(inicio)}`}
        </span>
      );
    const izq = recorte(x0);
    const ancho = recorte(x1) - izq;
    const finOnboarding = new Date(inicio.getTime() + ONBOARDING_DIAS * DIA);
    const anchoOnboarding = Math.max(0, Math.min(100, ((recorte(pos(finOnboarding)) - izq) / ancho) * 100));
    const dias = fin ? Math.round((fin.getTime() - hoy.getTime()) / DIA) : null;
    const vence = !baja && dias !== null && dias >= 0 && dias <= AVISO_VENCE_DIAS;
    const termino = !baja && dias !== null && dias < 0;
    const redondeo = `${x0 >= 0 ? 8 : 0}px ${x1 <= 100 ? 8 : 0}px ${x1 <= 100 ? 8 : 0}px ${x0 >= 0 ? 8 : 0}px`;

    let contenido: React.ReactNode;
    let estilo: React.CSSProperties;
    if (baja) {
      estilo = { background: rayado, border: '1px solid var(--color-borde)' };
      contenido = (
        <span className="flex-1 flex items-center justify-between gap-2 px-2.5 text-[12px] text-piedra">
          <span>Baja</span>
          {fin && <span>era hasta {corta(fin)}</span>}
        </span>
      );
    } else if (!fin) {
      estilo = { background: 'linear-gradient(90deg, var(--color-tinta) 0%, var(--color-tinta) 70%, transparent 100%)' };
      contenido = (
        <>
          <span className="flex items-center px-2 text-[11.5px] font-semibold text-marfil" style={{ background: verde }}>
            Onb.
          </span>
          <span className="flex items-center px-2.5 text-[12px] text-marfil whitespace-nowrap">Falta la duración del servicio</span>
        </>
      );
    } else {
      estilo = pendiente ? { border: '1.5px dashed var(--color-tinta)', background: 'var(--color-papel)' } : { background: 'var(--color-tinta)' };
      contenido = (
        <>
          <span
            className={`flex items-center pl-2 text-[11.5px] font-semibold whitespace-nowrap overflow-hidden ${pendiente ? 'text-bosque' : 'text-marfil'}`}
            style={{ width: `${anchoOnboarding}%`, background: pendiente ? 'color-mix(in srgb, var(--color-bosque) 15%, transparent)' : verde }}
          >
            {anchoOnboarding > 4 ? 'Onb.' : ''}
          </span>
          <span className={`flex-1 flex items-center justify-between gap-2 px-2.5 text-[12px] whitespace-nowrap overflow-hidden ${pendiente ? 'text-tinta' : 'text-marfil'}`}>
            <span>{pendiente ? 'Firma pendiente' : `${meses} ${meses === 1 ? 'mes' : 'meses'}`}</span>
            <span className="opacity-80">termina {corta(fin)}</span>
          </span>
        </>
      );
    }
    return (
      <>
        <span className="absolute top-3 h-7 flex overflow-hidden" style={{ left: `${izq}%`, width: `${ancho}%`, borderRadius: redondeo, ...estilo }}>
          {contenido}
        </span>
        {(vence || termino) && x1 <= 100 && (
          <span
            className={`absolute top-[15px] px-2 py-0.5 rounded-pastilla text-[11.5px] font-semibold whitespace-nowrap ${vence ? 'bg-peligro-suave text-peligro' : 'bg-niebla text-piedra'}`}
            style={x1 > 82 ? { right: `calc(${100 - x1}% + 8px)` } : { left: `calc(${x1}% + 8px)` }}
          >
            {vence ? (dias === 0 ? 'Vence hoy' : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`) : `Terminó el ${corta(fin!)}`}
          </span>
        )}
      </>
    );
  };

  const rotuloRango = `${meses[0].toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })} a ${meses[MESES_VISIBLES - 1].toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}`.replace(/\./g, '');
  const flecha = 'w-9 h-9 inline-flex items-center justify-center border border-borde-suave bg-papel rounded-[10px] hover:border-tinta';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Tres meses antes" className={flecha} onClick={() => setCorrimiento((n) => n - 3)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Tres meses después" className={flecha} onClick={() => setCorrimiento((n) => n + 3)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <span className="text-sm font-medium capitalize ml-1">{rotuloRango}</span>
          {corrimiento !== 0 && (
            <button type="button" className="text-sm text-piedra underline underline-offset-4 hover:text-bosque ml-2" onClick={() => setCorrimiento(0)}>
              Volver a hoy
            </button>
          )}
        </div>
        <span className="text-[13px] text-piedra">El fin del contrato es el onboarding más la duración del servicio</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[240px_1fr] border-b border-borde-suave">
            <span className="py-2 text-[12px] font-semibold text-piedra">Cliente</span>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${MESES_VISIBLES}, 1fr)` }}>
              {meses.map((d, i) => (
                <span key={i} className="py-2 pl-1.5 border-l border-separador text-[12px] font-semibold text-piedra capitalize">
                  {d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}
                  {i === 0 || d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : ''}
                </span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-[240px] right-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${MESES_VISIBLES}, 1fr)` }} aria-hidden="true">
              {meses.map((_, i) => (
                <span key={i} className="border-l border-separador" />
              ))}
            </div>
            {posHoy >= 0 && posHoy <= 100 && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-peligro z-[1] pointer-events-none" style={{ left: `calc(240px + (100% - 240px) * ${posHoy / 100})` }} aria-hidden="true" />
            )}
            {ordenadas.length === 0 && <p className="py-10 text-piedra">No hay clientes para mostrar con este filtro.</p>}
            {ordenadas.map((c) => {
              const am = nombreEquipo(c.responsable_id);
              return (
                <div
                  key={c.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navegar(`/portal/crm/${c.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navegar(`/portal/crm/${c.id}`)}
                  className="grid grid-cols-[240px_1fr] border-b border-separador cursor-pointer hover:bg-niebla/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-bosque/40"
                >
                  <div className="py-2.5 pr-4 flex flex-col justify-center min-w-0">
                    <span className={`font-heading font-bold text-[15px] leading-tight truncate ${c.estado_firma === 'Baja' ? 'text-piedra' : ''}`}>{c.nombre}</span>
                    <span className="text-[12px] text-piedra mt-0.5 truncate">
                      {c.servicio || 'Sin servicio'} · {am ?? 'Sin Account Manager'}
                    </span>
                  </div>
                  <div className="relative h-[52px]">{barra(c)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-piedra">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-3 rounded-[4px]" style={{ background: verde }} /> Onboarding, primeras 2 semanas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-3 rounded-[4px] bg-tinta" /> Contrato vigente
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-3 rounded-[4px] border-[1.5px] border-dashed border-tinta" /> Firma pendiente
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-3 rounded-[4px]" style={{ background: rayado }} /> Baja
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-0.5 h-3 bg-peligro" /> Hoy
        </span>
        <span>Se avisa cuando faltan {AVISO_VENCE_DIAS} días o menos</span>
      </div>
    </div>
  );
};

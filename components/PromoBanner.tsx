import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { openCalendly } from '../lib/calendly';

/**
 * Banner de promo entre el header y el hero. USD 1.500 de descuento en el plan
 * Eminent trimestral (el de 3 meses por adelantado de /planes), sin mostrar el
 * precio del plan, que se da en la llamada. El texto va en un solo renglón y la
 * cuenta regresiva marca el cierre, por eso no repite la fecha. Es la misma para
 * todos y no se reinicia al recargar. Pasada la fecha, el banner desaparece solo.
 * Para la próxima promo cambiá FIN_PROMO, CIERRE y el texto.
 */
const FIN_PROMO = new Date('2026-11-30T23:59:59-03:00').getTime();
const CIERRE = '30 de noviembre';

const dos = (n: number) => String(n).padStart(2, '0');

function partes(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    dias: Math.floor(total / 86_400),
    horas: Math.floor((total % 86_400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
  };
}

export const PromoBanner: React.FC = () => {
  // Null hasta montar: el home se prerenderiza en el build y ahí no se sabe la hora de quien entra.
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    setAhora(Date.now());
    const id = window.setInterval(() => {
      const t = Date.now();
      setAhora(t);
      if (t >= FIN_PROMO) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (ahora !== null && ahora >= FIN_PROMO) return null;
  const r = ahora === null ? null : partes(FIN_PROMO - ahora);
  const segmentos = [
    { valor: r ? String(r.dias) : '--', rotulo: r?.dias === 1 ? 'día' : 'días' },
    { valor: r ? dos(r.horas) : '--', rotulo: 'hs' },
    { valor: r ? dos(r.minutos) : '--', rotulo: 'min' },
    { valor: r ? dos(r.segundos) : '--', rotulo: 'seg' },
  ];

  return (
    <aside aria-label="Promoción del plan Eminent" className="bg-urgente text-white">
      <div className="wrap flex flex-col items-center gap-2.5 py-3 text-center desk:flex-row desk:justify-between desk:gap-6 desk:text-left">
        <p className="whitespace-nowrap text-[14px] leading-snug min-[400px]:text-[15px] desk:text-[16px]">
          <strong className="font-semibold underline decoration-white/60 underline-offset-[3px]">USD 1.500 de descuento</strong> en el plan
          Eminent trimestral
        </p>

        <div className="flex shrink-0 items-center justify-center gap-3 desk:gap-5">
          <div className="flex items-center gap-2.5">
            <span className="hidden text-[11px] font-medium uppercase leading-tight tracking-[0.12em] text-white/90 min-[1200px]:inline">
              Termina
              <br />
              en
            </span>
            <span className="sr-only">La promoción termina el {CIERRE} a las 23:59, hora de Argentina.</span>
            <ol aria-hidden="true" className="flex gap-1">
              {segmentos.map((s) => (
                <li key={s.rotulo} className="flex min-w-[40px] flex-col items-center bg-black/20 px-1 pb-1.5 pt-[7px] leading-none desk:min-w-[46px] desk:px-2 desk:pt-2">
                  <span className="text-[16px] font-semibold tabular-nums desk:text-[19px]">{s.valor}</span>
                  <span className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.08em] text-white/85 desk:text-[10px]">{s.rotulo}</span>
                </li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            onClick={openCalendly}
            className="inline-flex h-11 items-center gap-2 whitespace-nowrap bg-white px-4 text-[14px] font-semibold text-urgente transition-colors duration-150 hover:bg-marfil focus-visible:outline-white desk:px-5"
          >
            <span className="desk:hidden">Lo quiero</span>
            <span className="hidden desk:inline">Quiero el descuento</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
};

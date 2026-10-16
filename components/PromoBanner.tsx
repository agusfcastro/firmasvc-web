import React, { useEffect, useState } from 'react';
import { openCalendly } from '../lib/calendly';

// Fin de la promo (hora de Argentina). Pasada esta fecha, la franja desaparece sola.
const FIN_PROMO = new Date('2026-10-19T23:59:59-03:00').getTime();

const dosDigitos = (n: number) => String(n).padStart(2, '0');

const formatearRestante = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  return `${dosDigitos(horas)}:${dosDigitos(minutos)}:${dosDigitos(segundos)}`;
};

export const PromoBanner: React.FC = () => {
  const [restante, setRestante] = useState(() => FIN_PROMO - Date.now());

  useEffect(() => {
    if (restante <= 0) return;
    const id = window.setInterval(() => setRestante(FIN_PROMO - Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [restante <= 0]);

  if (restante <= 0) return null;

  return (
    <div className="bg-[#B3261E] text-white">
      <div className="wrap flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 py-2.5 text-center text-[13px] leading-snug sm:text-sm">
        <p>
          <strong className="font-semibold uppercase tracking-wide">Solo por 72 hs:</strong>{' '}
          cualquier trabajo que hagas con nosotros incluye{' '}
          <strong className="font-semibold">90 días de acceso completo</strong> al sistema que les
          ahorró más de USD 1M a nuestros clientes.
        </p>
        <div className="flex items-center gap-3">
          <span className="font-mono tabular-nums font-semibold" aria-label="Tiempo restante">
            {formatearRestante(restante)}
          </span>
          <button
            type="button"
            onClick={openCalendly}
            className="bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#B3261E] transition-colors duration-150 hover:bg-marfil"
          >
            Quiero mi lugar
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';

// Anclaje: $1.001.345 confirmados al 2026-10-11 01:00 UTC (≈ 22:00 hs ARG del 10/10).
// A partir de ese instante crece a razón de 200.000 USD por mes.
// Para "resetear" el piso, actualizá ANCHOR_DATE_MS a la fecha actual y
// ANCHOR_VALUE al número que querés mostrar en ese momento.
const ANCHOR_DATE_MS = Date.UTC(2026, 9, 11, 1, 0); // mes 0-indexed: 9 = octubre
const ANCHOR_VALUE = 1_001_345;
const USD_PER_MONTH = 200_000;

const SECONDS_PER_MONTH = 30 * 24 * 3_600;
const USD_PER_SECOND = USD_PER_MONTH / SECONDS_PER_MONTH; // ≈ 0.0772

const formatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const RULE = '1px solid rgba(27,31,27,0.15)';

function getValueNow(): number {
  const elapsedSeconds = Math.max(0, (Date.now() - ANCHOR_DATE_MS) / 1000);
  return ANCHOR_VALUE + elapsedSeconds * USD_PER_SECOND;
}

export const Counter: React.FC = () => {
  const [value, setValue] = useState<number>(() => getValueNow());

  useEffect(() => {
    const id = window.setInterval(() => setValue(getValueNow()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // La parte entera lleva la jerarquía; los centavos aparecen más chicos
  // para no sobrecargar la lectura pero sí comunicar "está vivo".
  const [whole, cents] = formatter.format(value).split(',');

  return (
    <div
      className="mt-6 w-full max-w-[720px] mx-auto flex flex-col items-center gap-3 pt-6 text-center"
      style={{ borderTop: RULE }}
    >
      <span
        className="font-heading font-black text-bosque leading-none tracking-tight tabular-nums whitespace-nowrap"
        style={{ fontSize: 'clamp(34px, 5.5vw, 60px)' }}
        aria-label={`${formatter.format(value)} dólares asegurados para clientes`}
      >
        <span className="text-piedra text-[0.5em] font-bold mr-2 align-middle">USD</span>
        {whole}
        <span className="text-[0.55em] opacity-70">,{cents}</span>
      </span>
      <span className="eyebrow stat-label text-piedra">Dólares asegurados para clientes</span>
    </div>
  );
};

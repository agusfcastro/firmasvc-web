import React, { useEffect, useState } from 'react';
import { Logo } from './Logo';

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

const RULE = '1px solid color-mix(in srgb, var(--color-tinta) 15%, transparent)';

function getValueNow(): number {
  const elapsedSeconds = Math.max(0, (Date.now() - ANCHOR_DATE_MS) / 1000);
  return ANCHOR_VALUE + elapsedSeconds * USD_PER_SECOND;
}

/** conLogo es para /landing, que no tiene encabezado: el logo va al lado del contador y lleva al home. */
export const Counter: React.FC<{ conLogo?: boolean }> = ({ conLogo = false }) => {
  const [value, setValue] = useState<number>(() => getValueNow());

  useEffect(() => {
    const id = window.setInterval(() => setValue(getValueNow()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // La parte entera lleva la jerarquía; los centavos aparecen más chicos
  // para no sobrecargar la lectura pero sí comunicar "está vivo".
  const [whole, cents] = formatter.format(value).split(',');

  const cifra = (
    <>
      <span
        className="font-heading font-extrabold text-tinta leading-none tracking-[-0.04em] tabular-nums whitespace-nowrap"
        style={{ fontSize: 'clamp(34px, 5.5vw, 60px)' }}
        aria-label={`${formatter.format(value)} dólares asegurados para clientes`}
      >
        <span className="text-piedra text-[0.5em] font-bold mr-2 align-middle">USD</span>
        {whole}
        <span className="text-[0.55em] opacity-70">,{cents}</span>
      </span>
      <span className="eyebrow stat-label text-piedra">Dólares asegurados para clientes</span>
    </>
  );

  if (conLogo) {
    return (
      <div
        className="mt-6 w-full max-w-[900px] mx-auto flex flex-col desk:flex-row items-center justify-center gap-6 desk:gap-10 pt-6 text-center"
        style={{ borderTop: RULE }}
      >
        <a href="/" aria-label="Ir al inicio de firma" className="shrink-0">
          <Logo className="h-14 desk:h-16" />
        </a>
        <span aria-hidden="true" className="hidden desk:block self-stretch" style={{ borderLeft: RULE }} />
        <div className="flex flex-col items-center gap-3">{cifra}</div>
      </div>
    );
  }

  return (
    <div
      className="mt-6 w-full max-w-[720px] mx-auto flex flex-col items-center gap-3 pt-6 text-center"
      style={{ borderTop: RULE }}
    >
      {cifra}
    </div>
  );
};

import React from 'react';

/**
 * Lo usado frente a lo incluido en el plan, en una barra. Si se pasó, la barra
 * queda llena y el exceso se dice aparte, sin tono de alerta: es algo que el
 * cliente recibió de más.
 */
export const BarraUso: React.FC<{
  titulo: string;
  usado: number;
  incluido: number;
  /** Cómo se escribe una cantidad, por ejemplo 45 min. */
  formato?: (n: number) => string;
  nota?: React.ReactNode;
  oscuro?: boolean;
}> = ({ titulo, usado, incluido, formato = String, nota, oscuro }) => {
  const pct = incluido > 0 ? Math.min(100, Math.round((usado / incluido) * 100)) : 100;
  const agotado = usado >= incluido;
  const exceso = usado - incluido;
  const suave = oscuro ? 'text-calido' : 'text-piedra';
  return (
    <div className="flex flex-col gap-3 max-w-[560px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className={`eyebrow ${suave}`}>{titulo}</p>
        <p className="text-[15px] tabular-nums">
          <span className="font-medium">{formato(usado)}</span> <span className={suave}>de {formato(incluido)}</span>
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={titulo}
        aria-valuemin={0}
        aria-valuemax={incluido}
        aria-valuenow={Math.min(usado, incluido)}
        className={`h-2 w-full overflow-hidden ${oscuro ? 'bg-[rgba(244,242,237,0.14)]' : 'bg-marfil-oscuro'}`}
      >
        <div className={`h-full ${agotado ? (oscuro ? 'bg-marfil' : 'bg-tinta') : oscuro ? 'bg-calido' : 'bg-bosque'}`} style={{ width: `${pct}%` }} />
      </div>
      {exceso > 0 && <p className={`text-[14px] ${suave}`}>Recibiste {formato(exceso)} más de lo que incluye tu plan.</p>}
      {nota && <p className={`text-[14px] leading-[1.5] ${suave}`}>{nota}</p>}
    </div>
  );
};

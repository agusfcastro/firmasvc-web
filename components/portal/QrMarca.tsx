import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';

const BOSQUE = '#173A2F';
const MARFIL = '#F5F3EC';
/** Margen alrededor del código, en módulos. */
const MARGEN = 3;

/**
 * QR con la marca: puntos redondeados en verde bosque, esquinas redondeadas y
 * la f de FIRMA al centro. Corrección de errores alta (H), así el logo no le
 * quita lectura.
 */
export const QrMarca: React.FC<{ texto: string; etiqueta: string; className?: string }> = ({ texto, etiqueta, className }) => {
  const dibujo = useMemo(() => {
    const qr = qrcode(0, 'H');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();

    // Hueco central para el logo: impar, para que quede centrado en la grilla.
    let hueco = Math.round(n * 0.22);
    if (hueco % 2 === 0) hueco += 1;
    const desde = (n - hueco) / 2;
    const enLogo = (f: number, c: number) => f >= desde && f < desde + hueco && c >= desde && c < desde + hueco;
    const enOjo = (f: number, c: number) => (f < 7 && c < 7) || (f < 7 && c >= n - 7) || (f >= n - 7 && c < 7);

    const puntos: React.ReactNode[] = [];
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(f, c) || enOjo(f, c) || enLogo(f, c)) continue;
        puntos.push(<circle key={`${f}-${c}`} cx={c + 0.5} cy={f + 0.5} r={0.44} />);
      }
    }

    const ojos = [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ].map(([f, c]) => (
      <g key={`ojo-${f}-${c}`}>
        <rect x={c + 0.5} y={f + 0.5} width={6} height={6} rx={1.9} fill="none" stroke={BOSQUE} strokeWidth={1} />
        <rect x={c + 2} y={f + 2} width={3} height={3} rx={0.9} fill={BOSQUE} />
      </g>
    ));

    return { n, puntos, ojos, desde, hueco };
  }, [texto]);

  const { n, puntos, ojos, desde, hueco } = dibujo;
  const lado = n + MARGEN * 2;
  const centro = desde + hueco / 2;
  const logo = hueco - 1;

  return (
    <svg viewBox={`${-MARGEN} ${-MARGEN} ${lado} ${lado}`} role="img" aria-label={etiqueta} className={className} shapeRendering="geometricPrecision">
      <rect x={-MARGEN} y={-MARGEN} width={lado} height={lado} rx={2.5} fill="#FFFFFF" />
      <g fill={BOSQUE}>{puntos}</g>
      {ojos}
      <rect x={centro - logo / 2} y={centro - logo / 2} width={logo} height={logo} rx={logo * 0.22} fill={BOSQUE} />
      <text
        x={centro}
        y={centro + logo * 0.3}
        textAnchor="middle"
        fontFamily="Bitter, Georgia, serif"
        fontWeight={900}
        fontSize={logo * 0.82}
        fill={MARFIL}
      >
        f
      </text>
    </svg>
  );
};

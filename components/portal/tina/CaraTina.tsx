import React from 'react';

/**
 * Carita de Tina. Un cuadrado redondeado marfil con dos ojos ovalados y una
 * sonrisa que termina en un trazo, como el final de una firma.
 *   quieta    parpadea de vez en cuando
 *   pensando  mira a un lado y al otro mientras Tina trabaja
 * Las animaciones están en index.css (.tina-ojos) y se apagan con
 * prefers-reduced-motion. Decorativa: el texto de al lado dice quién es.
 */
export const CaraTina: React.FC<{ tamano?: number; estado?: 'quieta' | 'pensando'; borde?: boolean; className?: string }> = ({
  tamano = 32,
  estado = 'quieta',
  borde = false,
  className = '',
}) => (
  <svg width={tamano} height={tamano} viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
    <rect
      x="3"
      y="4"
      width="42"
      height="40"
      rx="15"
      style={{ fill: 'var(--color-marfil)', stroke: borde ? 'color-mix(in srgb, var(--color-tinta) 18%, transparent)' : 'none', strokeWidth: 1.5 }}
    />
    <g className={`tina-ojos ${estado === 'pensando' ? 'tina-ojos-pensando' : ''}`} style={{ fill: 'var(--color-tinta)' }}>
      <ellipse cx="17" cy="21" rx="3.2" ry="4.6" />
      <ellipse cx="31" cy="21" rx="3.2" ry="4.6" />
    </g>
    <path d="M18.5 31c3.2 3.4 8 3.4 11 0 1-1.1 2.3-1.6 3.6-1.1" style={{ fill: 'none', stroke: 'var(--color-tinta)', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
  </svg>
);

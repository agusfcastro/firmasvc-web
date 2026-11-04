import type { CSSProperties } from 'react';

// Paleta y tipografía del portal aplicadas a los protocolos. Tinta en vez del verde, Archivo
// variable en pesada para los títulos, tarjetas de 20 px, botones y campos de 12 px y estados en pastilla.
// La usan el motor y el índice de /protocolos.
export const MARCA_FIRMA = {
  '--sop-bg': 'var(--color-marfil)',
  '--sop-surface': 'var(--color-papel)',
  '--sop-surface-2': 'var(--color-niebla)',
  '--sop-ink': 'var(--color-tinta)',
  '--sop-ink-2': 'var(--color-carbon)',
  '--sop-muted': 'var(--color-piedra)',
  '--sop-line': 'var(--color-borde-suave)',
  '--sop-line-2': 'var(--color-borde)',
  '--sop-accent': 'var(--color-tinta)',
  '--sop-accent-ink': 'var(--color-marfil)',
  '--sop-accent-soft': 'var(--color-niebla)',
  '--sop-focus': 'var(--color-tinta)',
  '--sop-font-body': "var(--font-portal, 'Archivo', system-ui, sans-serif)",
  '--sop-font-display': "var(--font-portal, 'Archivo', system-ui, sans-serif)",
  '--sop-display-weight': '800',
  '--sop-display-weight-sm': '700',
  '--sop-radius': '20px',
  '--sop-radius-md': '12px',
  '--sop-radius-sm': '12px',
  '--sop-radius-xs': '6px',
  '--sop-radius-pill': '999px',
} as CSSProperties;

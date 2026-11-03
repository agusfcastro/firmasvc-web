import type { CSSProperties } from 'react';

// Paleta y tipografía de Firma aplicadas a los protocolos. Radio 0, como el resto de la marca.
export const MARCA_FIRMA = {
  '--sop-bg': 'var(--color-marfil)',
  '--sop-surface': 'var(--color-marfil-claro)',
  '--sop-surface-2': 'var(--color-marfil-oscuro)',
  '--sop-ink': 'var(--color-tinta)',
  '--sop-ink-2': 'var(--color-carbon)',
  '--sop-muted': 'var(--color-piedra)',
  '--sop-line': 'color-mix(in srgb, var(--color-tinta) 15%, transparent)',
  '--sop-line-2': 'color-mix(in srgb, var(--color-tinta) 32%, transparent)',
  '--sop-accent': 'var(--color-bosque)',
  '--sop-accent-ink': 'var(--color-marfil)',
  '--sop-accent-soft': 'var(--color-bosque-suave)',
  '--sop-focus': 'var(--color-bosque)',
  '--sop-font-body': "var(--font-sans, 'Archivo', system-ui, sans-serif)",
  '--sop-font-display': "var(--font-heading, 'Bitter', Georgia, serif)",
  '--sop-display-weight': '900',
  '--sop-display-weight-sm': '700',
  '--sop-radius': '0px',
  '--sop-radius-md': '0px',
  '--sop-radius-sm': '0px',
  '--sop-radius-xs': '0px',
  '--sop-radius-pill': '0px',
} as CSSProperties;

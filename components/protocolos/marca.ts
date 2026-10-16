import type { CSSProperties } from 'react';

// Paleta y tipografía de Firma aplicadas a los protocolos. Radio 0, como el resto de la marca.
export const MARCA_FIRMA = {
  '--sop-bg': 'var(--color-marfil, #F5F3EC)',
  '--sop-surface': '#FBFAF6',
  '--sop-surface-2': 'var(--color-marfil-oscuro, #EDEBE2)',
  '--sop-ink': 'var(--color-tinta, #1B1F1B)',
  '--sop-ink-2': 'var(--color-carbon, #2B2B2B)',
  '--sop-muted': 'var(--color-piedra, #6B6553)',
  '--sop-line': 'rgba(27, 31, 27, 0.15)',
  '--sop-line-2': 'rgba(27, 31, 27, 0.32)',
  '--sop-accent': 'var(--color-bosque, #173A2F)',
  '--sop-accent-ink': 'var(--color-marfil, #F5F3EC)',
  '--sop-accent-soft': '#E4E9E3',
  '--sop-focus': 'var(--color-bosque, #173A2F)',
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

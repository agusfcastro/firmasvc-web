/**
 * Compara los colores de api/_lib/marca.ts con los de index.css (@theme).
 * Falla si un color de marca.ts no está en index.css o tiene otro valor.
 *
 *   npm run marca:verificar
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const css = await readFile(path.join(raiz, 'index.css'), 'utf8');
const ts = await readFile(path.join(raiz, 'api/_lib/marca.ts'), 'utf8');

// blanco no es un token de index.css: Tailwind ya trae white.
const SOLO_TS = new Set(['blanco']);

const bloque = ts.match(/export const COLOR = \{([\s\S]*?)\}/);
if (!bloque) {
  console.error('✗ no encontré COLOR en api/_lib/marca.ts');
  process.exit(1);
}

const kebab = (s) => s.replace(/[A-Z]/g, (l) => '-' + l.toLowerCase());
let errores = 0;
for (const [, clave, valor] of bloque[1].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) {
  if (SOLO_TS.has(clave)) continue;
  const enCss = css.match(new RegExp(`--color-${kebab(clave)}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!enCss) {
    console.error(`✗ --color-${kebab(clave)} no está en index.css`);
    errores++;
  } else if (enCss[1].toLowerCase() !== valor.toLowerCase()) {
    console.error(`✗ ${clave}: marca.ts dice ${valor} e index.css dice ${enCss[1]}`);
    errores++;
  }
}

// Contraste WCAG 2.2 de los pares que usa el portal. Texto 4,5 a 1 y contorno de controles 3 a 1.
const token = (n) => (n === 'white' ? '#FFFFFF' : css.match(new RegExp(`--color-${n}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]);
const luz = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const PARES = [
  ['tinta', 'marfil', 4.5, 'texto principal'],
  ['piedra', 'marfil', 4.5, 'texto secundario'],
  ['piedra', 'papel', 4.5, 'texto secundario en tarjetas'],
  ['piedra', 'marfil-oscuro', 4.5, 'texto secundario en paneles'],
  ['bosque', 'marfil', 4.5, 'acentos de la web'],
  ['marfil', 'bosque', 4.5, 'botón de la web'],
  ['marfil', 'tinta', 4.5, 'botón y resaltado del portal'],
  ['tinta', 'niebla', 4.5, 'estados y fichas neutras del portal'],
  ['aviso', 'aviso-suave', 4.5, 'estado de aviso'],
  ['peligro', 'peligro-suave', 4.5, 'estado de error'],
  ['exito', 'exito-suave', 4.5, 'estado de éxito'],
  ['exito', 'papel', 4.5, 'texto de éxito en tarjetas'],
  ['calido', 'carbon', 4.5, 'texto en carbón'],
  ['calido', 'tinta', 4.5, 'texto en tarjetas y paneles negros'],
  ['lateral-texto', 'tinta', 4.5, 'barra lateral'],
  ['lateral-tenue', 'tinta', 4.5, 'títulos de la barra lateral'],
  ['marfil', 'grafito', 4.5, 'sección activa de la barra lateral'],
  ['borde', 'white', 3, 'borde de campo sobre blanco'],
  ['borde', 'marfil', 3, 'borde de campo sobre marfil'],
];
for (const [fg, bg, min, uso] of PARES) {
  const a = token(fg);
  const b = token(bg);
  if (!a || !b) {
    console.error(`✗ falta el token ${a ? bg : fg} para controlar ${uso}`);
    errores++;
    continue;
  }
  const r = contraste(a, b);
  if (r < min) {
    console.error(`✗ ${fg} sobre ${bg} (${uso}) da ${r.toFixed(2)} a 1 y necesita ${min} a 1`);
    errores++;
  }
}

if (errores) process.exit(1);
console.log('✓ marca.ts coincide con index.css');
console.log(`✓ contraste WCAG 2.2 AA en ${PARES.length} pares del portal`);

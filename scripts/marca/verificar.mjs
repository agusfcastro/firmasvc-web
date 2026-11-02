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

if (errores) process.exit(1);
console.log('✓ marca.ts coincide con index.css');

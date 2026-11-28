/**
 * Falla si hay archivos que chocan en un disco que no distingue mayúsculas (macOS, Windows).
 *
 *   1. Dos rutas que solo difieren en mayúsculas (`Foo.tsx` y `foo.tsx`).
 *   2. Dos archivos de código de la misma carpeta con el mismo nombre base escrito
 *      distinto (`Reuniones.tsx` y `reuniones.ts`): en la Mac `import './Reuniones'`
 *      resuelve al que no es y el build se rompe, aunque en Vercel (Linux) compile.
 *
 * Lista lo que sigue git (`git ls-files`), así no mira node_modules ni dist.
 *
 *   npm run mayusculas:verificar
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const CODIGO = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.json', '.css']);

const archivos = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

let errores = 0;

const porRuta = new Map();
for (const a of archivos) {
  const clave = a.toLowerCase();
  if (!porRuta.has(clave)) porRuta.set(clave, []);
  porRuta.get(clave).push(a);
}
for (const rutas of porRuta.values()) {
  if (rutas.length > 1) {
    console.error(`✗ rutas que solo difieren en mayúsculas: ${rutas.join(', ')}`);
    errores++;
  }
}

const porBase = new Map();
for (const a of archivos) {
  const ext = path.extname(a);
  if (!CODIGO.has(ext.toLowerCase())) continue;
  const carpeta = path.dirname(a);
  const base = path.basename(a, ext);
  const clave = `${carpeta.toLowerCase()}/${base.toLowerCase()}`;
  if (!porBase.has(clave)) porBase.set(clave, []);
  porBase.get(clave).push({ a, base });
}
for (const grupo of porBase.values()) {
  const escrituras = new Set(grupo.map((g) => g.base));
  if (escrituras.size > 1) {
    console.error(`✗ mismo nombre base con otras mayúsculas en la misma carpeta: ${grupo.map((g) => g.a).join(', ')}`);
    errores++;
  }
}

if (errores) {
  console.error(`\n${errores} choque(s). Renombrá uno de cada par (por ejemplo, la lógica a fooDatos.ts).`);
  process.exit(1);
}
console.log(`✓ ${archivos.length} archivos sin choques de mayúsculas`);

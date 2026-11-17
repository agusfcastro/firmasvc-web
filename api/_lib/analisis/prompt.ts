/**
 * Instrucciones del analizador de llamadas. La fuente es docs/ANALIZADOR_VENTA.md
 * (vercel.json la incluye en /api/cola/procesar). Después del primer «---»,
 * la clasificación va entre «<!-- clasificacion -->» y «<!-- analisis -->»
 * y el análisis, desde ahí hasta el final. Se leen una vez por instancia de
 * la función.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARCHIVO = 'docs/ANALIZADOR_VENTA.md';
const MARCA_CLASIFICACION = '<!-- clasificacion -->';
const MARCA_ANALISIS = '<!-- analisis -->';

let cache: { clasificacion: string; analisis: string } | null = null;

function leerDoc(): string {
  const candidatos = [path.join(process.cwd(), ARCHIVO)];
  try {
    candidatos.push(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..', ARCHIVO));
  } catch {
    // Sin import.meta.url (por ejemplo, empaquetado): queda solo process.cwd().
  }
  for (const c of candidatos) {
    try {
      return readFileSync(c, 'utf8');
    } catch {
      // Probar el siguiente.
    }
  }
  throw new Error(`No se encontró ${ARCHIVO}.`);
}

/** Las dos partes del documento. */
export function partesDelAnalizador(): { clasificacion: string; analisis: string } {
  if (cache) return cache;
  const doc = leerDoc();
  // Las marcas cuentan después del primer «---»: antes está la explicación para personas.
  const separador = doc.indexOf('\n---\n');
  const c = separador < 0 ? -1 : doc.indexOf(MARCA_CLASIFICACION, separador);
  const a = c < 0 ? -1 : doc.indexOf(MARCA_ANALISIS, c);
  if (c < 0 || a < 0 || a < c) throw new Error(`${ARCHIVO} no tiene el formato esperado.`);
  const clasificacion = doc.slice(c + MARCA_CLASIFICACION.length, a).trim();
  const analisis = doc.slice(a + MARCA_ANALISIS.length).trim();
  if (!clasificacion || !analisis) throw new Error(`${ARCHIVO} tiene una parte vacía.`);
  cache = { clasificacion, analisis };
  return cache;
}

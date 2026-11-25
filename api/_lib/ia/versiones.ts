/**
 * Versión del prompt de cada agente (auditoría de la IA, 0074). Es la huella
 * del texto que guía al agente, así que un cambio de prompt cambia la versión
 * solo. La usan las corridas que anota el servidor y el evaluador
 * (scripts/ia/evaluar.mjs), y por eso las dos hablan de la misma versión.
 */
import { huellaPrompt } from './registro.js';
import { partesDelPrompt } from '../tina/prompt.js';
import { definiciones } from '../tina/herramientas.js';
import { partesDelAnalizador } from '../analisis/prompt.js';

/**
 * Tina. La parte fija de docs/TINA_SYSTEM_PROMPT.md sin completar y la
 * descripción de las herramientas (las de Eminent, que incluyen las de
 * Starter). El contexto de cada empresa no cuenta.
 */
export const versionTina = (): string => huellaPrompt(partesDelPrompt().estatico, definiciones('eminent'));

/** Analizador de llamadas. Las dos partes de docs/ANALIZADOR_VENTA.md y la versión del libro de códigos. */
export const versionAnalizador = (libro: string): string => huellaPrompt(partesDelAnalizador(), libro);


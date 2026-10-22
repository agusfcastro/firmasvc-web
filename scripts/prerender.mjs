/**
 * Después de `vite build` y del build SSR de entry-server.tsx:
 * 1. Guarda el HTML vacío como dist/app.html. Es el que Vercel sirve para
 *    el portal, la firma y el resto de las rutas de la aplicación.
 * 2. Dibuja el home y lo deja en dist/index.html, que Vercel sirve en «/».
 * Así el home llega con contenido y las demás rutas no muestran el home un
 * instante antes de cargar.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = resolve('dist');
const ssr = resolve('dist-ssr');
const plantilla = readFileSync(resolve(dist, 'index.html'), 'utf8');
const VACIO = '<div id="root"></div>';
if (!plantilla.includes(VACIO)) throw new Error('No encontré <div id="root"></div> en dist/index.html.');

// La canónica y og:url apuntan al home: en las demás rutas confundirían a los buscadores.
const shell = plantilla.replace(/\s*<link rel="canonical"[^>]*>/, '').replace(/\s*<meta property="og:url"[^>]*>/, '');
writeFileSync(resolve(dist, 'app.html'), shell);

const { render } = await import(pathToFileURL(resolve(ssr, 'entry-server.js')).href);
const html = render('/');
if (html.length < 2000) throw new Error(`El prerender del home salió casi vacío (${html.length} caracteres).`);
writeFileSync(resolve(dist, 'index.html'), plantilla.replace(VACIO, `<div id="root">${html}</div>`));

rmSync(ssr, { recursive: true, force: true });
console.log(`Prerender del home listo: ${Math.round(html.length / 1024)} KB de HTML.`);

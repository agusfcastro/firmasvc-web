/**
 * Prerender del home para buscadores. Lo usa scripts/prerender.mjs en el
 * build: dibuja la ruta en Node y el HTML resultante va dentro de #root,
 * así Google lee el contenido sin ejecutar JavaScript.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

export function render(ruta: string): string {
  return renderToString(<App ruta={ruta} />);
}

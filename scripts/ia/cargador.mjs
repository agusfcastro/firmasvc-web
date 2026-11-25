/**
 * Deja que Node corra el código de api/ tal como está. Los imports relativos
 * de api/ llevan «.js» (así lo pide Vercel), pero el archivo es «.ts»: si el
 * .js no existe, se prueba el .ts. Node 22 ya quita los tipos solo.
 *
 *   node --import ./scripts/ia/cargador.mjs ...
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (/^\.{1,2}\//.test(especificador) && especificador.endsWith('.js') && contexto.parentURL?.startsWith('file:')) {
      const js = new URL(especificador, contexto.parentURL);
      if (!existsSync(fileURLToPath(js))) {
        for (const ext of ['.ts', '.tsx']) {
          const alt = new URL(especificador.replace(/\.js$/, ext), contexto.parentURL);
          if (existsSync(fileURLToPath(alt))) return siguiente(alt.href, contexto);
        }
      }
    }
    return siguiente(especificador, contexto);
  },
});

/**
 * Maqueta del portal con datos de prueba, para sacar capturas antes de unir un cambio
 * visual sin entrar con una cuenta real. No se publica: es solo para correr en local.
 *
 *   npx vite --config scripts/maqueta/vite.config.ts
 *   http://localhost:5199/?pantalla=crm&vista=tiempo
 *
 * Todo lo que el portal le pide a Supabase sale de datos.ts (supabaseFalso.ts).
 */
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const raiz = path.resolve(__dirname, '../..');
const real = path.join(raiz, 'components/portal/supabase.ts');
const falso = path.join(__dirname, 'supabaseFalso.ts');

/** Cambia el cliente de Supabase del portal por el de prueba. */
const supabaseDePrueba = (): Plugin => ({
  name: 'supabase-de-prueba',
  enforce: 'pre',
  async resolveId(fuente, importador, opciones) {
    if (!importador || importador === falso) return null;
    const r = await this.resolve(fuente, importador, { ...opciones, skipSelf: true });
    return r && r.id === real ? falso : null;
  },
});

export default defineConfig({
  root: __dirname,
  envDir: __dirname,
  server: { port: 5199, host: '127.0.0.1', fs: { allow: [raiz] } },
  plugins: [supabaseDePrueba(), tailwindcss(), react()],
  resolve: { alias: { '@': raiz } },
});

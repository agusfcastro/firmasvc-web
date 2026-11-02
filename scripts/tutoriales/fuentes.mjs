import { readFileSync } from 'node:fs';
const F = (fam, w) => `node_modules/@fontsource/${fam.toLowerCase()}/files/${fam.toLowerCase()}-latin-${w}-normal.woff2`;
const LISTA = [['Archivo',400],['Archivo',500],['Archivo',600],['Bitter',700],['Bitter',900]];
// Sirve Archivo y Bitter desde paquetes locales: Google Fonts no está habilitado en este entorno.
export async function fuentesLocales(ctx) {
  const css = LISTA.map(([f,w]) => `@font-face{font-family:'${f}';font-style:normal;font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/local/${f}-${w}.woff2) format('woff2');}`).join('\n');
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: css }));
  await ctx.route('https://fonts.gstatic.com/local/**', (r) => {
    const [, f, w] = r.request().url().match(/local\/(\w+)-(\d+)\.woff2/);
    r.fulfill({ contentType: 'font/woff2', body: readFileSync(F(f, w)), headers: { 'access-control-allow-origin': '*' } });
  });
}

/**
 * Pruebas de la lectura del dólar cripto de dolarhoy.com (api/_lib/cotizacion.ts).
 * No sale a internet: usa un HTML armado como el de dolarhoy.
 *
 *   node --import ./scripts/ia/cargador.mjs scripts/pruebas/cotizacion.mjs
 */
import assert from 'node:assert/strict';
import { criptoDeDolarhoy, numeroArgentino } from '../../api/_lib/cotizacion.ts';

let hechas = 0;
const prueba = (nombre, f) => {
  f();
  hechas++;
  console.log(`✓ ${nombre}`);
};

const bloque = (titulo, compra, venta) =>
  `<div class="tile is-child"><a href="/cotizaciondolaroficial" class="titleText">${titulo}</a>` +
  `<a href="https://ejemplo.com">Conseguilo en: <img src="x.png"></a>` +
  `<div class="values"><div class="compra"><div class="topic">Compra</div><div class="val">${compra}</div></div>` +
  `<div class="venta"><div class="topic">Venta</div><div class="val">${venta}</div></div>` +
  `<div class="var-porcentaje"><div class="porcentaje">-0.32%</div></div></div></div>`;

const pagina = (...bloques) =>
  `<html><head><script>var x = "Dólar Cripto Compra $1 Venta $2";</script></head><body>` +
  `<nav><a href="/cotizaciondolarblue">D&oacute;lar Blue</a><a href="/cotizacion-dolar-cripto">Dólar Cripto</a><a href="/cotizaciondolarccl">Dólar CCL</a></nav>` +
  bloques.join('') +
  `<p>Actualizado por última vez: 26/11/26 02:29 PM</p></body></html>`;

prueba('lee los números con punto de miles y coma decimal', () => {
  assert.equal(numeroArgentino('$1.751,48'), 1751.48);
  assert.equal(numeroArgentino('$1.425'), 1425);
  assert.equal(numeroArgentino('1751.48'), 1751.48);
  assert.ok(Number.isNaN(numeroArgentino('—')));
});

prueba('toma el Dólar Digital (USDC) y no el blue ni el menú', () => {
  const html = pagina(bloque('Dólar blue', '$1.405', '$1.425'), bloque('Dólar MEP', '$1.430,10', '$1.436,20'), bloque('Dólar Digital (USDC)', '$1.751,48', '$1.755,29'));
  assert.deepEqual(criptoDeDolarhoy(html), { compra: 1751.48, venta: 1755.29 });
});

prueba('también lo encuentra si se llama Dólar Cripto', () => {
  const html = pagina(bloque('Dólar blue', '$1.405', '$1.425'), bloque('Dólar Cripto', '$1.752,88', '$1.762,87'));
  assert.deepEqual(criptoDeDolarhoy(html), { compra: 1752.88, venta: 1762.87 });
});

prueba('el promedio entre las puntas sale de compra y venta', () => {
  const p = criptoDeDolarhoy(pagina(bloque('Dólar Digital (USDC)', '$1.751,48', '$1.755,29')));
  assert.equal(Math.round(((p.compra + p.venta) / 2) * 100) / 100, 1753.39);
});

prueba('sin el bloque o con puntas absurdas no devuelve nada', () => {
  assert.equal(criptoDeDolarhoy(pagina(bloque('Dólar blue', '$1.405', '$1.425'))), null);
  assert.equal(criptoDeDolarhoy(pagina(bloque('Dólar Digital (USDC)', '$1.755', '$1.700'))), null);
  assert.equal(criptoDeDolarhoy(pagina(bloque('Dólar Digital (USDC)', '$1.000', '$2.000'))), null);
  assert.equal(criptoDeDolarhoy('<html>mantenimiento</html>'), null);
});

console.log(`\n${hechas} pruebas de la cotización, todas bien.`);

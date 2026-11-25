/**
 * Pruebas de cómo salen los montos de los contratos según la moneda
 * del cliente (api/_lib/variables.ts).
 *
 *   node scripts/pruebas/monedas.mjs
 */
import assert from 'node:assert/strict';
import { simboloMoneda, valoresDelContrato } from '../../api/_lib/variables.ts';

let hechas = 0;
const prueba = (nombre, f) => {
  f();
  hechas++;
  console.log(`✓ ${nombre}`);
};

const cliente = (moneda) => ({
  codigo: 'EP-001', nombre: 'Cliente', dni: '1', email: 'a@b.c', telefono: null, servicio: 'DESARROLLO',
  monto_total: 6125, moneda, fecha_onboarding: '2026-11-20T15:00:00Z', responsable: null,
});
const pagos = [
  { monto: 1125, vencimiento: null, estado: 'pagado' },
  { monto: 5000, vencimiento: '2026-12-20', estado: 'pendiente' },
];

prueba('los soles salen con S/ y en letras como SOLES', () => {
  const v = valoresDelContrato(cliente('PEN'), pagos, 'AGENCIA DE ESTRATEGIA DIGITAL SAC', 'Desarrollo');
  assert.equal(v.MONEDA, 'S/');
  assert.equal(v.MONEDA_LETRAS, 'SOLES');
  assert.equal(`${v.MONEDA} ${v.MONTO_TOTAL} (${v.MONEDA_LETRAS} ${v.MONTO_TOTAL_LETRAS})`, 'S/ 6.125 (SOLES SEIS MIL CIENTO VEINTICINCO)');
  const renglones = v.ESQUEMA_PAGOS.split('\n');
  assert.equal(renglones.length, 2);
  assert.ok(renglones[0].includes('S/ 1.125 (SOLES MIL CIENTO VEINTICINCO)'), renglones[0]);
  assert.ok(renglones[1].includes('S/ 5.000 (SOLES CINCO MIL)'), renglones[1]);
  assert.ok(v.DETALLE_CUOTAS.startsWith('Cuota 1 de S/ 5.000'), v.DETALLE_CUOTAS);
});

prueba('los dólares siguen igual que antes', () => {
  const v = valoresDelContrato(cliente('USD'), pagos, 'Empresa', 'Desarrollo');
  assert.equal(v.MONEDA, 'USD');
  assert.equal(v.MONEDA_LETRAS, 'DÓLARES ESTADOUNIDENSES');
  assert.ok(v.ESQUEMA_PAGOS.split('\n')[1].includes('USD 5.000 (DÓLARES ESTADOUNIDENSES CINCO MIL)'));
});

prueba('sin moneda cargada se usa USD', () => {
  assert.equal(valoresDelContrato(cliente(null), pagos, 'Empresa', null).MONEDA, 'USD');
  assert.equal(simboloMoneda(undefined), 'USD');
  assert.equal(simboloMoneda('pen'), 'S/');
  assert.equal(simboloMoneda('ARS'), 'ARS');
});

console.log(`\n${hechas} pruebas pasaron`);

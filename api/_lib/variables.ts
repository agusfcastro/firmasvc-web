/**
 * Variables de los contratos modelo. Un solo lugar para la lista y para
 * cómo se calcula cada valor. Lo usan el servidor (contratos con firma
 * electrónica) y el portal, que muestra la lista para armar los
 * modelos. Sin dependencias de Node, así también corre en el navegador.
 * La carpeta empieza con guion bajo para que Vercel no la tome como función.
 */

const ZONA = 'America/Argentina/Buenos_Aires';

/** Variables disponibles, en el orden en que se muestran. En el Word van entre llaves dobles, por ejemplo {{NOMBRE}}. */
export const VARIABLES: [string, string][] = [
  ['NOMBRE', 'Nombre completo del cliente'],
  ['DNI', 'DNI o documento'],
  ['DOMICILIO', 'Domicilio del cliente'],
  ['EMAIL', 'Mail'],
  ['TELEFONO', 'Teléfono'],
  ['CODIGO', 'Código del CRM, por ejemplo AT-001'],
  ['SERVICIO', 'Nombre del servicio contratado'],
  ['MODALIDAD', 'Cuotas o Pago total'],
  ['EMPRESA', 'Razón social de la empresa, o su nombre'],
  ['RESPONSABLE', 'CSM o AM a cargo'],
  ['MONEDA', 'Moneda, por ejemplo USD'],
  ['MONTO_TOTAL', 'Monto total en números, por ejemplo 3.000'],
  ['MONTO_TOTAL_LETRAS', 'Monto total en letras, por ejemplo TRES MIL'],
  ['ANTICIPO', 'Anticipo en números'],
  ['ANTICIPO_LETRAS', 'Anticipo en letras'],
  ['SALDO', 'Suma de las cuotas en números'],
  ['SALDO_LETRAS', 'Suma de las cuotas en letras'],
  ['CANTIDAD_CUOTAS', 'Cantidad de cuotas, por ejemplo 3 (TRES)'],
  ['DETALLE_CUOTAS', 'Cada cuota con su monto y su vencimiento'],
  ['CONDICIONES', 'Condiciones acordadas en la venta, en texto libre'],
  ['FECHA_ONBOARDING', 'Fecha del onboarding, por ejemplo 20 de octubre de 2026'],
  ['FECHA', 'Fecha en que se genera el contrato'],
];

/** Las que pueden quedar vacías sin que haga falta avisar. */
export const OPCIONALES = new Set(['TELEFONO', 'RESPONSABLE', 'CONDICIONES', 'CODIGO']);

/* ------------------------------------------------------------------ */
/* Montos y fechas con el estilo de los contratos de FIRMA             */
/* ------------------------------------------------------------------ */
const UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO',
  'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function menorQueMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c) partes.push(CENTENAS[c]);
  if (r) {
    if (r < 30) partes.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d]);
    }
  }
  return partes.join(' ');
}

/** «Uno» delante de mil o de millones se apocopa. VEINTIUNO MIL pasa a VEINTIÚN MIL. */
function apocopar(s: string): string {
  return s.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/(^|\s)UNO$/, '$1UN');
}

export function enLetras(numero: number): string {
  const n = Math.floor(Math.abs(numero));
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${apocopar(enLetras(millones))} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${apocopar(menorQueMil(miles))} MIL`);
  if (resto) partes.push(menorQueMil(resto));
  return partes.join(' ');
}

export function montoEnLetras(monto: number): string {
  const centavos = Math.round(Math.abs(monto) * 100);
  const entero = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return resto ? `${enLetras(entero)} CON ${String(resto).padStart(2, '0')}/100` : enLetras(entero);
}

export function numero(monto: number): string {
  const conDecimales = Math.round(monto * 100) % 100 !== 0;
  return monto.toLocaleString('es-AR', { minimumFractionDigits: conDecimales ? 2 : 0, maximumFractionDigits: 2 });
}

/** Cantidad de cuotas en femenino. 1 (UNA), 21 (VEINTIUNA). */
export function cantidadCuotas(n: number): string {
  return `${n} (${enLetras(n).replace(/UNO$/, 'UNA')})`;
}

function fechaLarga(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA }).format(d);
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/* ------------------------------------------------------------------ */
/* Valores de un cliente                                               */
/* ------------------------------------------------------------------ */
export interface PagoContrato {
  monto: number | string;
  vencimiento: string | null;
  estado: string;
  creado_en?: string;
}

export interface ClienteContrato {
  codigo: string | null;
  nombre: string;
  dni: string | null;
  domicilio?: string | null;
  email: string | null;
  telefono: string | null;
  servicio: string | null;
  modalidad?: string | null;
  monto_total: number | string | null;
  moneda: string | null;
  fecha_onboarding: string | null;
  responsable: string | null;
  condiciones?: string | null;
}

export function valoresDelContrato(c: ClienteContrato, pagos: PagoContrato[], empresa: string, nombreServicio: string | null, hoy = new Date()): Record<string, string> {
  const moneda = c.moneda || 'USD';
  const total = Number(c.monto_total ?? 0);
  // El anticipo se carga pagado y sin vencimiento. Las cuotas tienen vencimiento, estén pagadas o no.
  const esAnticipo = (p: PagoContrato) => p.estado === 'pagado' && !p.vencimiento;
  const anticipo = pagos.filter(esAnticipo).reduce((a, p) => a + Number(p.monto), 0);
  const cuotas = pagos
    .filter((p) => !esAnticipo(p))
    .sort((a, b) => (a.vencimiento ?? '9999').localeCompare(b.vencimiento ?? '9999') || (a.creado_en ?? '').localeCompare(b.creado_en ?? ''));
  const saldo = cuotas.reduce((a, p) => a + Number(p.monto), 0);
  const detalle = cuotas.length
    ? cuotas
        .map((p, i) => `${i === 0 ? 'Cuota' : 'cuota'} ${i + 1} de ${moneda} ${numero(Number(p.monto))}${p.vencimiento ? ` con vencimiento el ${fechaCorta(p.vencimiento)}` : ''}`)
        .join('; ') + '.'
    : 'Sin cuotas. El precio se cancela con el anticipo.';
  return {
    NOMBRE: c.nombre,
    DNI: c.dni || '',
    DOMICILIO: c.domicilio || '',
    EMAIL: c.email || '',
    TELEFONO: c.telefono || '',
    CODIGO: c.codigo || '',
    SERVICIO: nombreServicio || c.servicio || '',
    MODALIDAD: c.modalidad === 'PIF' ? 'Pago total' : 'Cuotas',
    EMPRESA: empresa,
    RESPONSABLE: c.responsable || '',
    MONEDA: moneda,
    MONTO_TOTAL: numero(total),
    MONTO_TOTAL_LETRAS: montoEnLetras(total),
    ANTICIPO: numero(anticipo),
    ANTICIPO_LETRAS: montoEnLetras(anticipo),
    SALDO: numero(saldo),
    SALDO_LETRAS: montoEnLetras(saldo),
    CANTIDAD_CUOTAS: cantidadCuotas(cuotas.length),
    DETALLE_CUOTAS: detalle,
    CONDICIONES: (c.condiciones || '').trim(),
    FECHA_ONBOARDING: c.fecha_onboarding ? fechaLarga(new Date(c.fecha_onboarding)) : 'a definir',
    FECHA: fechaLarga(hoy),
  };
}

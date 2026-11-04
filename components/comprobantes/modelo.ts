import { NOMBRE_MONEDA, montoEnLetras } from '../../api/_lib/variables';

/**
 * Invoices y recibos de dinero. Lo comparten la herramienta pública
 * (/herramientas/invoice y /herramientas/recibo, sin guardar nada) y el
 * portal, donde cada negocio los emite a sus clientes con numeración
 * correlativa (migración 0053). Lo emitido guarda estos datos tal cual,
 * así el PDF se vuelve a armar igual.
 */
export type TipoComprobante = 'invoice' | 'recibo';
export type Idioma = 'es' | 'en';

export interface Parte {
  nombre: string;
  idFiscal: string;
  domicilio: string;
  email: string;
  telefono: string;
}

export interface Renglon {
  descripcion: string;
  cantidad: number;
  precio: number;
}

export interface DatosComprobante {
  tipo: TipoComprobante;
  idioma: Idioma;
  /** AAAA-MM-DD */
  fecha: string;
  /** Solo invoice. Vacío es sin vencimiento. */
  vencimiento: string;
  moneda: string;
  emisor: Parte;
  receptor: Parte;
  /** Invoice */
  renglones: Renglon[];
  descuento: number;
  impuestoNombre: string;
  impuestoPorcentaje: number;
  /** Recibo */
  monto: number;
  concepto: string;
  medioPago: string;
  notas: string;
  /** Datos de pago o leyendas al pie. */
  pie: string;
}

export const MONEDAS = ['USD', 'ARS', 'EUR', 'UYU', 'MXN', 'CLP', 'COP', 'PEN'];

export const TITULO_TIPO: Record<TipoComprobante, string> = { invoice: 'Invoice', recibo: 'Recibo de dinero' };

export const parteVacia = (): Parte => ({ nombre: '', idFiscal: '', domicilio: '', email: '', telefono: '' });

export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function datosNuevos(tipo: TipoComprobante, previo?: Partial<DatosComprobante>): DatosComprobante {
  return {
    tipo,
    idioma: tipo === 'invoice' ? 'en' : 'es',
    fecha: hoyISO(),
    vencimiento: '',
    moneda: 'USD',
    emisor: parteVacia(),
    receptor: parteVacia(),
    renglones: [{ descripcion: '', cantidad: 1, precio: 0 }],
    descuento: 0,
    impuestoNombre: '',
    impuestoPorcentaje: 0,
    monto: 0,
    concepto: '',
    medioPago: '',
    notas: '',
    pie: '',
    ...previo,
  };
}

const redondear = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export interface Totales {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
}

export function totales(d: DatosComprobante): Totales {
  if (d.tipo === 'recibo') {
    const total = redondear(Math.max(0, d.monto));
    return { subtotal: total, descuento: 0, impuesto: 0, total };
  }
  const subtotal = redondear(d.renglones.reduce((s, r) => s + redondear((r.cantidad || 0) * (r.precio || 0)), 0));
  const descuento = redondear(Math.min(Math.max(0, d.descuento), subtotal));
  const impuesto = redondear(((subtotal - descuento) * Math.max(0, d.impuestoPorcentaje)) / 100);
  return { subtotal, descuento, impuesto, total: redondear(subtotal - descuento + impuesto) };
}

/** Número a la vista, 0001. */
export const numeroVisible = (n: number | string) => (typeof n === 'number' ? String(n).padStart(4, '0') : n);

export function formatoMonto(n: number, moneda: string, idioma: Idioma): string {
  const cifra = n.toLocaleString(idioma === 'en' ? 'en-US' : 'es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${moneda} ${cifra}`;
}

export function formatoFecha(iso: string, idioma: Idioma): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** «DÓLARES ESTADOUNIDENSES MIL QUINIENTOS», como en los contratos de FIRMA. */
export function montoLetras(n: number, moneda: string): string {
  return `${NOMBRE_MONEDA[moneda] ?? moneda} ${montoEnLetras(n)}`;
}

/** Lo que falta para poder descargar o emitir. Vacío es que está completo. */
export function faltantes(d: DatosComprobante): string[] {
  const f: string[] = [];
  if (!d.emisor.nombre.trim()) f.push('el nombre de quien emite');
  if (!d.receptor.nombre.trim()) f.push(d.tipo === 'invoice' ? 'a quién se factura' : 'de quién se recibe el dinero');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) f.push('la fecha');
  if (d.tipo === 'invoice') {
    if (!d.renglones.some((r) => r.descripcion.trim())) f.push('al menos un concepto');
  } else {
    if (!(d.monto > 0)) f.push('el monto');
    if (!d.concepto.trim()) f.push('el concepto');
  }
  return f;
}

/** Textos del PDF en los dos idiomas. */
export const TEXTOS = {
  es: {
    // No «factura»: en la Argentina esa palabra es la del comprobante fiscal de ARCA.
    invoice: 'INVOICE',
    recibo: 'RECIBO',
    numero: 'N.º',
    fecha: 'Fecha',
    vence: 'Vence',
    de: 'De',
    facturarA: 'Facturar a',
    recibiDe: 'Recibido de',
    descripcion: 'Descripción',
    cantidad: 'Cant.',
    precio: 'Precio',
    importe: 'Importe',
    subtotal: 'Subtotal',
    descuento: 'Descuento',
    total: 'Total',
    notas: 'Notas',
    medioPago: 'Medio de pago',
    firma: 'Firma y aclaración',
    anulado: 'ANULADO',
    pagina: 'Página',
    idFiscal: 'ID fiscal',
  },
  en: {
    invoice: 'INVOICE',
    recibo: 'RECEIPT',
    numero: 'No.',
    fecha: 'Date',
    vence: 'Due',
    de: 'From',
    facturarA: 'Bill to',
    recibiDe: 'Received from',
    descripcion: 'Description',
    cantidad: 'Qty',
    precio: 'Price',
    importe: 'Amount',
    subtotal: 'Subtotal',
    descuento: 'Discount',
    total: 'Total',
    notas: 'Notes',
    medioPago: 'Payment method',
    firma: 'Signature',
    anulado: 'VOID',
    pagina: 'Page',
    idFiscal: 'Tax ID',
  },
} as const;

/** La frase del recibo. */
export function fraseRecibo(d: DatosComprobante): string {
  const quien = d.receptor.nombre.trim() || '…';
  const monto = formatoMonto(d.monto, d.moneda, d.idioma);
  if (d.idioma === 'en') {
    return `Received from ${quien} the sum of ${monto} for ${d.concepto.trim() || '…'}.`;
  }
  return `Recibí de ${quien} la suma de ${montoLetras(d.monto, d.moneda)} (${monto}) en concepto de ${d.concepto.trim() || '…'}.`;
}

/** Lee lo guardado en la base, que puede venir de una versión anterior, sobre los valores por defecto. */
export function leerDatos(tipo: TipoComprobante, guardado: unknown): DatosComprobante {
  const g = (guardado && typeof guardado === 'object' ? guardado : {}) as Partial<DatosComprobante>;
  const base = datosNuevos(tipo);
  return { ...base, ...g, tipo, emisor: { ...base.emisor, ...g.emisor }, receptor: { ...base.receptor, ...g.receptor }, renglones: g.renglones ?? base.renglones };
}

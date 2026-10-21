/**
 * Medios de pago fuera de dLocal Go: transferencia y cripto. Se muestran en
 * /portal/pagos para que el cliente copie los datos y mande el comprobante.
 * Estos pagos no se registran solos: FIRMA los concilia a mano.
 *
 * Para cargar o cambiar un dato, se edita acá. Un dato vacío no se muestra y
 * un medio sin su dato principal (el primero de la lista) tampoco.
 */

export interface DatoPago {
  etiqueta: string;
  valor: string;
  /** Se puede copiar con un botón. Va en los datos que se pegan en otra app. */
  copiable?: boolean;
}

export interface MedioAlternativo {
  id: string;
  titulo: string;
  /** Moneda o activo que se recibe, para que el cliente no se equivoque. */
  moneda: string;
  datos: DatoPago[];
  /** Advertencia corta que se muestra debajo de los datos. */
  aviso?: string;
}

export const MEDIOS_ALTERNATIVOS: MedioAlternativo[] = [
  {
    id: 'transferencia-ars',
    titulo: 'Transferencia bancaria',
    moneda: 'Pesos argentinos',
    datos: [
      { etiqueta: 'Alias', valor: '', copiable: true },
      { etiqueta: 'CBU / CVU', valor: '', copiable: true },
      { etiqueta: 'Titular', valor: '' },
      { etiqueta: 'CUIT', valor: '', copiable: true },
      { etiqueta: 'Banco', valor: '' },
    ],
  },
  {
    id: 'usdt-trc20',
    titulo: 'USDT en red TRON',
    moneda: 'USDT',
    datos: [
      { etiqueta: 'Dirección', valor: '', copiable: true },
      { etiqueta: 'Red', valor: 'TRON (TRC20)' },
    ],
    aviso: 'Enviá solo USDT por la red TRON (TRC20). Si usás otra red o moneda, los fondos se pierden.',
  },
  {
    id: 'usdt-bep20',
    titulo: 'USDT en red BNB Smart Chain',
    moneda: 'USDT',
    datos: [
      { etiqueta: 'Dirección', valor: '', copiable: true },
      { etiqueta: 'Red', valor: 'BNB Smart Chain (BEP20)' },
    ],
    aviso: 'Enviá solo USDT por la red BNB Smart Chain (BEP20). Si usás otra red o moneda, los fondos se pierden.',
  },
  {
    id: 'binance-pay',
    titulo: 'Binance Pay',
    moneda: 'USDT u otra cripto de Binance',
    datos: [
      { etiqueta: 'Pay ID', valor: '', copiable: true },
      { etiqueta: 'Usuario', valor: '' },
    ],
    aviso: 'Sin comisión entre cuentas de Binance.',
  },
];

/** Dónde se manda el comprobante. */
export const WHATSAPP_COMPROBANTES = '5491124617035';

/** Medios con su dato principal cargado, sin los datos vacíos. */
export function mediosDisponibles(): MedioAlternativo[] {
  return MEDIOS_ALTERNATIVOS.filter((m) => m.datos[0]?.valor.trim()).map((m) => ({
    ...m,
    datos: m.datos.filter((d) => d.valor.trim()),
  }));
}

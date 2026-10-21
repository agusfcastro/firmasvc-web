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
    titulo: 'Transferencia en pesos',
    moneda: 'Pesos argentinos',
    datos: [
      { etiqueta: 'Alias', valor: 'castro.legales', copiable: true },
      { etiqueta: 'Alias alternativo', valor: 'legales.arq', copiable: true },
      { etiqueta: 'Titular', valor: 'Federico Agustín Castro' },
    ],
    aviso: 'Si tu abono está en dólares, se convierte al dólar digital, punta vendedora, que publica dolarhoy.com el día del pago.',
  },
  {
    id: 'transferencia-usd',
    titulo: 'Transferencia en dólares',
    moneda: 'Dólares estadounidenses',
    datos: [
      { etiqueta: 'Número de cuenta', valor: '212334825493', copiable: true },
      { etiqueta: 'Routing number (ABA)', valor: '101019644', copiable: true },
      { etiqueta: 'Titular', valor: 'Federico Agustin Castro', copiable: true },
      { etiqueta: 'Banco', valor: 'Lead Bank' },
      { etiqueta: 'Tipo de cuenta', valor: 'Checking' },
      { etiqueta: 'Dirección del titular', valor: 'Juan B Azopardo 1854, Castelar, Buenos Aires B1712, Argentina', copiable: true },
    ],
    aviso: 'Cuenta en Estados Unidos. Transferí por ACH desde una cuenta en dólares.',
  },
  {
    id: 'usdt-erc20',
    titulo: 'USDT en red Ethereum',
    moneda: 'USDT',
    datos: [
      { etiqueta: 'Billetera ARQ', valor: '0x109bdfb8369fa96b8c8e2da2f0f650655ad1c29b', copiable: true },
      { etiqueta: 'Billetera Binance', valor: '0xda62e4f266f5c7464d46353e96f8d411fc3a216a', copiable: true },
      { etiqueta: 'Red', valor: 'Ethereum (ERC20)' },
    ],
    aviso: 'Enviá solo USDT por la red Ethereum (ERC20), a cualquiera de las dos billeteras. Si usás otra red o moneda, los fondos se pierden.',
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

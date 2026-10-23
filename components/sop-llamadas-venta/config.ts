// Ficha del cliente. Todo lo que cambia de un cliente a otro vive acá.

export type Perfil = 'B2B' | 'B2C';
export type Variante = 'A' | 'B' | 'C';
export type Mercado = 'AR' | 'ES' | 'OTRO';
export type Nicho = 'ninguno' | 'salud' | 'finanzas' | 'inmobiliario';
export type Moneda = 'USD' | 'ARS' | 'EUR';

export interface ConfigSop {
  empresa: string;
  programa: string;
  duracion: string;
  inicio: string;
  cupos: string;
  perfil: Perfil;
  mercado: Mercado;
  variante: Variante;
  ventana: string;
  moneda: Moneda;
  precio: string;
  usaCuotas: boolean;
  cuotasN: string;
  cuotaMonto: string;
  usaReserva: boolean;
  reservaMonto: string;
  saldoDias: string;
  pasarela: string;
  firma: string;
  herramienta: string;
  canal: string;
  nicho: Nicho;
}

export const CONFIG_VACIA: ConfigSop = {
  empresa: '',
  programa: '',
  duracion: '',
  inicio: '',
  cupos: '',
  perfil: 'B2B',
  mercado: 'AR',
  variante: 'A',
  ventana: '',
  moneda: 'USD',
  precio: '',
  usaCuotas: true,
  cuotasN: '',
  cuotaMonto: '',
  usaReserva: true,
  reservaMonto: '',
  saldoDias: '',
  pasarela: '',
  firma: '',
  herramienta: '',
  canal: '',
  nicho: 'ninguno',
};

export const CONFIG_EJEMPLO: ConfigSop = {
  empresa: 'Impulso Consultores LLC',
  programa: 'Programa Impulso',
  duracion: '3 meses',
  inicio: 'el lunes 2 de noviembre',
  cupos: '20 lugares por cohorte',
  perfil: 'B2B',
  mercado: 'AR',
  variante: 'A',
  ventana: '72 horas',
  moneda: 'USD',
  precio: '3000',
  usaCuotas: true,
  cuotasN: '3',
  cuotaMonto: '1000',
  usaReserva: true,
  reservaMonto: '300',
  saldoDias: '7',
  pasarela: 'Stripe',
  firma: 'la firma electrónica de FIRMA',
  herramienta: 'Fathom',
  canal: 'legales@impulso.com',
  nicho: 'ninguno',
};

/** La variante que efectivamente se aplica. Con consumidores solo vale la B. */
export function varianteEfectiva(c: ConfigSop): Variante {
  if (c.perfil === 'B2C') return 'B';
  return c.variante === 'B' ? 'A' : c.variante;
}

export function diasLegales(c: ConfigSop): string | null {
  if (c.mercado === 'AR') return '10 días corridos';
  if (c.mercado === 'ES') return '14 días naturales';
  return null;
}

export function diasLegalesNumero(c: ConfigSop): number | null {
  if (c.mercado === 'AR') return 10;
  if (c.mercado === 'ES') return 14;
  return null;
}

function soloDigitos(v: string): number | null {
  const limpio = v.replace(/[^\d]/g, '');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

export function formatearMonto(moneda: Moneda, valor: string): string | null {
  const n = soloDigitos(valor);
  if (n === null) return null;
  const cifra = n.toLocaleString('es-AR');
  if (moneda === 'EUR') return `${cifra} €`;
  return `${moneda} ${cifra}`;
}

export function numero(valor: string): number | null {
  return soloDigitos(valor);
}

/** Valores finales que se muestran resaltados. null significa que falta completarlo. */
export function valoresDeFicha(c: ConfigSop): Record<string, string | null> {
  const dias = soloDigitos(c.saldoDias);
  return {
    empresa: c.empresa.trim() || null,
    programa: c.programa.trim() || null,
    duracion: c.duracion.trim() || null,
    inicio: c.inicio.trim() || null,
    cupos: c.cupos.trim() || null,
    ventana: c.ventana.trim() || null,
    dias: diasLegales(c),
    precio: formatearMonto(c.moneda, c.precio),
    cuotasN: soloDigitos(c.cuotasN) !== null ? String(soloDigitos(c.cuotasN)) : null,
    cuota: formatearMonto(c.moneda, c.cuotaMonto),
    reserva: formatearMonto(c.moneda, c.reservaMonto),
    saldoPlazo: dias !== null ? `${dias} ${dias === 1 ? 'día' : 'días'}` : null,
    pasarela: c.pasarela.trim() || null,
    firma: c.firma.trim() || null,
    herramienta: c.herramienta.trim() || null,
    canal: c.canal.trim() || null,
  };
}

/** Rótulo que se muestra cuando la variable todavía no se completó. */
export const ROTULOS: Record<string, string> = {
  empresa: 'empresa',
  programa: 'programa',
  duracion: 'duración',
  inicio: 'fecha de inicio',
  cupos: 'cupos reales',
  ventana: 'ventana contractual',
  dias: 'plazo legal del país',
  precio: 'precio total',
  cuotasN: 'cantidad',
  cuota: 'monto de la cuota',
  reserva: 'monto de la reserva',
  saldoPlazo: 'plazo para completar',
  pasarela: 'plataforma de cobro',
  firma: 'plataforma de firma',
  herramienta: 'herramienta de registro',
  canal: 'canal oficial',
};

/** Textos que dependen de la ficha y se expanden antes de resaltar las variables. */
export function macrosDeFicha(c: ConfigSop): Record<string, string> {
  const v = varianteEfectiva(c);
  const opcionesPago = c.usaCuotas ? 'en un pago o en {cuotasN} cuotas de {cuota}' : 'en un solo pago';
  const politicaCorta: Record<Variante, string> = {
    A: 'Tenés {ventana} desde la firma o el primer pago, lo que ocurra primero, para arrepentirte con devolución. Pasado ese plazo no hay devoluciones.',
    B: 'Tenés {dias} desde la contratación para arrepentirte con devolución total. Pasado ese plazo el compromiso es por el total y no hay devoluciones.',
    C: 'El programa no tiene devoluciones.',
  };
  const politicaMini: Record<Variante, string> = {
    A: '{ventana} para arrepentirse, después sin devoluciones',
    B: '{dias} para arrepentirse, después compromiso por el total',
    C: 'sin devoluciones',
  };
  return {
    opcionesPago,
    politicaCorta: politicaCorta[v],
    politicaMini: politicaMini[v],
  };
}

export interface Aviso {
  nivel: 'info' | 'alerta' | 'riesgo';
  texto: string;
}

/** Controles de coherencia de la ficha. Se muestran arriba del formulario. */
export function avisosDeFicha(c: ConfigSop): Aviso[] {
  const avisos: Aviso[] = [];
  const v = varianteEfectiva(c);
  if (c.perfil === 'B2C') {
    avisos.push({
      nivel: 'info',
      texto: 'Con compradores consumidores la única variante válida es la B, con la ventana legal del país. El protocolo la aplica automáticamente.',
    });
    if (c.mercado === 'OTRO') {
      avisos.push({
        nivel: 'alerta',
        texto: 'Para otros países el plazo legal cambia. Definilo con el equipo legal antes de usar los guiones de devoluciones.',
      });
    }
  }
  if (v === 'C') {
    avisos.push({
      nivel: 'riesgo',
      texto: 'Variante de mayor exposición. Usala solo si el contrato tiene la declaración B2B y la finalidad profesional del comprador queda registrada en la llamada.',
    });
  }
  const precio = numero(c.precio);
  const n = numero(c.cuotasN);
  const cuota = numero(c.cuotaMonto);
  if (c.usaCuotas && precio !== null && n !== null && cuota !== null && n * cuota !== precio) {
    const total = formatearMonto(c.moneda, String(n * cuota));
    avisos.push({
      nivel: 'alerta',
      texto: `Las cuotas suman ${total} y el precio total cargado es ${formatearMonto(c.moneda, c.precio)}. Informá siempre el total que efectivamente se paga en cada modalidad.`,
    });
  }
  const reserva = numero(c.reservaMonto);
  if (c.usaReserva && precio !== null && reserva !== null && precio > 0) {
    const pct = Math.round((reserva / precio) * 100);
    if (pct > 30) {
      avisos.push({
        nivel: 'alerta',
        texto: `La reserva representa el ${pct}% del precio. Cuanto más alta, más fácil que se la considere desproporcionada. Como referencia orientativa, conviene que no supere el 30%.`,
      });
    }
  }
  const saldo = numero(c.saldoDias);
  const legal = diasLegalesNumero(c);
  if (c.usaReserva && v === 'B' && saldo !== null && legal !== null && saldo < legal) {
    avisos.push({
      nivel: 'alerta',
      texto: `El plazo para completar el pago (${saldo} días) vence antes que la ventana legal (${legal} días). Hasta que esa ventana termine, la reserva sigue siendo reembolsable.`,
    });
  }
  return avisos;
}

// Persistencia. Hash de la URL para compartir, almacenamiento local como comodidad.

const CLAVE_LOCAL = 'firma-sop-llamadas:v1';
const PREFIJO_HASH = '#ficha=';

function aBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  bytes.forEach((b) => {
    binario += String.fromCharCode(b);
  });
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(codigo: string): string {
  const base = codigo.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = base + '==='.slice((base.length + 3) % 4);
  const binario = atob(relleno);
  const bytes = Uint8Array.from(binario, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizar(parcial: unknown): ConfigSop | null {
  if (!parcial || typeof parcial !== 'object') return null;
  const base: ConfigSop = { ...CONFIG_VACIA };
  const p = parcial as Record<string, unknown>;
  (Object.keys(base) as (keyof ConfigSop)[]).forEach((k) => {
    const actual = base[k];
    const nuevo = p[k];
    if (typeof actual === 'boolean' && typeof nuevo === 'boolean') {
      (base[k] as boolean) = nuevo;
    } else if (typeof actual === 'string' && typeof nuevo === 'string') {
      (base[k] as string) = nuevo.slice(0, 200);
    }
  });
  if (!['B2B', 'B2C'].includes(base.perfil)) base.perfil = 'B2B';
  if (!['A', 'B', 'C'].includes(base.variante)) base.variante = 'A';
  if (!['AR', 'ES', 'OTRO'].includes(base.mercado)) base.mercado = 'AR';
  if (!['USD', 'ARS', 'EUR'].includes(base.moneda)) base.moneda = 'USD';
  if (!['ninguno', 'salud', 'finanzas', 'inmobiliario'].includes(base.nicho)) base.nicho = 'ninguno';
  return base;
}

export function leerConfigInicial(preset?: Partial<ConfigSop>): ConfigSop {
  const conPreset = { ...CONFIG_VACIA, ...(preset ?? {}) };
  if (typeof window === 'undefined') return conPreset;
  try {
    const hash = window.location.hash;
    if (hash.startsWith(PREFIJO_HASH)) {
      const desdeHash = normalizar(JSON.parse(deBase64Url(hash.slice(PREFIJO_HASH.length))));
      if (desdeHash) return desdeHash;
    }
  } catch {
    // Enlace dañado, se ignora.
  }
  try {
    const guardado = window.localStorage.getItem(CLAVE_LOCAL);
    if (guardado) {
      const desdeLocal = normalizar(JSON.parse(guardado));
      if (desdeLocal) return desdeLocal;
    }
  } catch {
    // Almacenamiento bloqueado, se ignora.
  }
  return conPreset;
}

export function guardarLocal(c: ConfigSop): boolean {
  try {
    window.localStorage.setItem(CLAVE_LOCAL, JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

export function enlaceConfigurado(c: ConfigSop): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${PREFIJO_HASH}${aBase64Url(JSON.stringify(c))}`;
}

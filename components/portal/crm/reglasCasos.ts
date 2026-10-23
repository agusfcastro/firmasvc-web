// Casos de conflicto del CRM. Tipos, rótulos y cálculo de los indicadores
// con las definiciones del protocolo de conflictos (sección Tablero de indicadores).
// Regla de estilo de FIRMA para los textos, sin rayas ni dos puntos.

export type Etapa = 'disconformidad' | 'legales' | 'difusion' | 'cerrado';
export type Semaforo = 'verde' | 'ambar' | 'rojo';
export type Causa = 'promesa' | 'demora' | 'expectativa' | 'encaje' | 'arrepentimiento' | 'cobro' | 'otra';
export type Decision = 'retenido' | 'alternativa' | 'concesion' | 'rechazo' | 'devolucion_legal';
export type ResultadoContracargo = 'pendiente' | 'ganado' | 'perdido';

export interface ClienteDelCaso {
  id: string;
  nombre: string;
  codigo: string | null;
  moneda: string;
  organizacion_id?: string;
}

export interface Caso {
  id: string;
  organizacion_id: string;
  cliente_id: string;
  abierto_en: string;
  cerrado_en: string | null;
  etapa: Etapa;
  semaforo: Semaforo;
  causa: Causa;
  canal: string | null;
  monto_reclamado: number | null;
  contracargo: boolean;
  contracargo_resultado: ResultadoContracargo | null;
  derivado_legales: boolean;
  decision: Decision | null;
  monto_concedido: number;
  responsable: string | null;
  notas: string | null;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
  /** Asunto donde se sigue el reclamo, con su chat, bitácora y documentos (migración 0024). */
  asunto_id?: string | null;
  cliente?: ClienteDelCaso | null;
}

/** Lo mínimo para contar los casos en curso. */
export type CasoAbierto = Pick<Caso, 'id' | 'etapa' | 'semaforo'>;

/** Cliente dado de alta en el mes, para las ventas y la facturación. */
export interface Alta {
  moneda: string;
  monto_total: number | null;
}

// ---------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------

export const ROTULO_ETAPA: Record<Etapa, string> = {
  disconformidad: 'Disconformidad',
  legales: 'Legales',
  difusion: 'Difusión pública',
  cerrado: 'Cerrado',
};

export const TONO_ETAPA: Record<Etapa, 'piedra' | 'tinta' | 'alerta' | 'bosque'> = {
  disconformidad: 'piedra',
  legales: 'tinta',
  difusion: 'alerta',
  cerrado: 'bosque',
};

export const ROTULO_SEMAFORO: Record<Semaforo, string> = { verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo' };

/** Resultado de la compuerta legal del protocolo para cada color. */
export const AYUDA_SEMAFORO: Record<Semaforo, string> = {
  verde: 'Vía de gestión. Se sigue el recorrido por etapas.',
  ambar: 'Plazo formal en curso. Se responde dentro del plazo, sin regla de enfriamiento.',
  rojo: 'Posible arrepentimiento legal. Ese derecho no se negocia ni se condiciona.',
};

export const ROTULO_CAUSA: Record<Causa, string> = {
  promesa: 'Promesa del vendedor',
  demora: 'Demora',
  expectativa: 'Expectativa no contratada',
  encaje: 'Encaje con el programa',
  arrepentimiento: 'Arrepentimiento legal',
  cobro: 'Cobro o facturación',
  otra: 'Otra',
};

export const ROTULO_DECISION: Record<Decision, string> = {
  retenido: 'Cliente retenido',
  alternativa: 'Alternativa aceptada',
  concesion: 'Concesión económica',
  rechazo: 'Rechazo documentado',
  devolucion_legal: 'Devolución legal',
};

export const ROTULO_RESULTADO: Record<ResultadoContracargo, string> = { pendiente: 'Pendiente', ganado: 'Ganado', perdido: 'Perdido' };

export const ETAPAS = Object.keys(ROTULO_ETAPA) as Etapa[];
export const SEMAFOROS = Object.keys(ROTULO_SEMAFORO) as Semaforo[];
export const CAUSAS = Object.keys(ROTULO_CAUSA) as Causa[];
export const DECISIONES = Object.keys(ROTULO_DECISION) as Decision[];
export const RESULTADOS = Object.keys(ROTULO_RESULTADO) as ResultadoContracargo[];

export const CANALES_SUGERIDOS = ['WhatsApp', 'Correo', 'Llamada', 'Redes sociales', 'Carta documento', 'Botón de arrepentimiento o de baja', 'Tarjeta o banco', 'Defensa del consumidor'];

/** Para el historial de la ficha. */
export const CAMPOS_CASO: Record<string, string> = {
  abierto_en: 'Apertura',
  cerrado_en: 'Cierre',
  etapa: 'Etapa',
  semaforo: 'Semáforo',
  causa: 'Causa',
  canal: 'Canal',
  monto_reclamado: 'Monto reclamado',
  contracargo: 'Contracargo',
  contracargo_resultado: 'Resultado del contracargo',
  derivado_legales: 'Derivado a legales',
  decision: 'Decisión',
  monto_concedido: 'Monto concedido',
};

export const VALORES_CASO: Record<string, Record<string, string>> = {
  etapa: ROTULO_ETAPA,
  semaforo: ROTULO_SEMAFORO,
  causa: ROTULO_CAUSA,
  decision: ROTULO_DECISION,
  contracargo_resultado: ROTULO_RESULTADO,
};

// ---------------------------------------------------------------------
// Fechas y meses
// ---------------------------------------------------------------------

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dos = (n: number) => String(n).padStart(2, '0');

export interface Mes {
  clave: string;
  /** Primer día del mes, AAAA-MM-DD. */
  inicio: string;
  /** Primer día del mes siguiente, AAAA-MM-DD. */
  fin: string;
  /** octubre de 2026 */
  nombre: string;
  /** Octubre de 2026 */
  titulo: string;
}

export function mesDe(anio: number, mes: number): Mes {
  const anioSig = mes === 12 ? anio + 1 : anio;
  const mesSig = mes === 12 ? 1 : mes + 1;
  const nombre = `${NOMBRES_MES[mes - 1]} de ${anio}`;
  return {
    clave: `${anio}-${dos(mes)}`,
    inicio: `${anio}-${dos(mes)}-01`,
    fin: `${anioSig}-${dos(mesSig)}-01`,
    nombre,
    titulo: nombre.charAt(0).toUpperCase() + nombre.slice(1),
  };
}

/** Todo el historial, para los indicadores sin corte por mes. */
export const HISTORICO: Mes = { clave: 'historico', inicio: '0001-01-01', fin: '9999-12-31', nombre: 'todo el historial', titulo: 'Histórico' };

/** El mes de hoy y los anteriores, del más reciente al más viejo. */
export function ultimosMeses(hoy: string, cantidad = 12): Mes[] {
  const [anio, mes] = hoy.split('-').map(Number);
  return Array.from({ length: cantidad }, (_, i) => {
    const total = anio * 12 + (mes - 1) - i;
    return mesDe(Math.floor(total / 12), (total % 12) + 1);
  });
}

/** Límites del mes en hora local, para filtrar campos con hora como el alta del cliente. */
export function limitesLocales(mes: Mes): { desde: string; hasta: string } {
  const [a1, m1] = mes.inicio.split('-').map(Number);
  const [a2, m2] = mes.fin.split('-').map(Number);
  return { desde: new Date(a1, m1 - 1, 1).toISOString(), hasta: new Date(a2, m2 - 1, 1).toISOString() };
}

function utc(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((utc(hasta) - utc(desde)) / 86400000);
}

/** Días desde la apertura hasta el cierre, o hasta hoy si sigue abierto. */
export function diasAbierto(c: Pick<Caso, 'abierto_en' | 'cerrado_en'>, hoy: string): number {
  return Math.max(0, diasEntre(c.abierto_en, c.cerrado_en ?? hoy));
}

const enMes = (f: string | null | undefined, mes: Mes): boolean => Boolean(f) && (f as string) >= mes.inicio && (f as string) < mes.fin;

// ---------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------

/** La base devuelve los numeric como número o texto según el cliente. */
export function normalizarCaso(c: Caso): Caso {
  return {
    ...c,
    monto_reclamado: c.monto_reclamado === null || c.monto_reclamado === undefined ? null : Number(c.monto_reclamado),
    monto_concedido: Number(c.monto_concedido ?? 0),
    cliente: c.cliente ?? null,
  };
}

const PESO_SEMAFORO: Record<Semaforo, number> = { rojo: 0, ambar: 1, verde: 2 };

/** Abiertos primero, del más urgente al más viejo. Después los cerrados, del más reciente. */
export function ordenarCasos(lista: Caso[]): Caso[] {
  return lista.slice().sort((a, b) => {
    const ca = a.etapa === 'cerrado' ? 1 : 0;
    const cb = b.etapa === 'cerrado' ? 1 : 0;
    if (ca !== cb) return ca - cb;
    if (!ca) return PESO_SEMAFORO[a.semaforo] - PESO_SEMAFORO[b.semaforo] || a.abierto_en.localeCompare(b.abierto_en);
    return (b.cerrado_en ?? '').localeCompare(a.cerrado_en ?? '') || b.abierto_en.localeCompare(a.abierto_en);
  });
}

/** Mensajes de la base en castellano, para las restricciones de la migración 0007. */
export function mensajeError(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return '';
  const m = e.message ?? '';
  if (m.includes('crm_casos_fechas')) return 'La fecha de cierre no puede ser anterior a la apertura.';
  if (m.includes('crm_casos_cierre')) return 'Un caso cerrado necesita decisión y fecha de cierre, y uno abierto no lleva fecha de cierre.';
  if (m.includes('crm_casos_contracargo')) return 'El resultado del contracargo solo se carga si hubo contracargo.';
  if (m.includes('row-level security') || e.code === '42501') return 'No tenés permiso para registrar casos de ese cliente.';
  if (e.code === '42P01' || e.code === 'PGRST205' || (m.includes('crm_casos') && /does not exist|schema cache/.test(m))) {
    return 'Todavía no está creado el registro de casos. Hay que correr la migración 0007_crm_casos.sql en Supabase.';
  }
  return m || 'No se pudo completar la operación.';
}

// ---------------------------------------------------------------------
// Formulario
// ---------------------------------------------------------------------

export interface Borrador {
  id?: string;
  /** Solo para enlazar al asunto. No se guarda desde el formulario. */
  asunto_id?: string | null;
  cliente_id: string;
  abierto_en: string;
  cerrado_en: string;
  etapa: Etapa;
  semaforo: Semaforo;
  causa: Causa | '';
  canal: string;
  monto_reclamado: string;
  contracargo: boolean;
  contracargo_resultado: ResultadoContracargo;
  derivado_legales: boolean;
  decision: Decision | '';
  monto_concedido: string;
  responsable: string;
  notas: string;
}

export function borradorNuevo(hoy: string, clienteId = ''): Borrador {
  return {
    cliente_id: clienteId,
    abierto_en: hoy,
    cerrado_en: '',
    etapa: 'disconformidad',
    semaforo: 'verde',
    causa: '',
    canal: '',
    monto_reclamado: '',
    contracargo: false,
    contracargo_resultado: 'pendiente',
    derivado_legales: false,
    decision: '',
    monto_concedido: '',
    responsable: '',
    notas: '',
  };
}

export function borradorDe(c: Caso): Borrador {
  return {
    id: c.id,
    asunto_id: c.asunto_id ?? null,
    cliente_id: c.cliente_id,
    abierto_en: c.abierto_en,
    cerrado_en: c.cerrado_en ?? '',
    etapa: c.etapa,
    semaforo: c.semaforo,
    causa: c.causa,
    canal: c.canal ?? '',
    monto_reclamado: c.monto_reclamado === null ? '' : String(c.monto_reclamado),
    contracargo: c.contracargo,
    contracargo_resultado: c.contracargo_resultado ?? 'pendiente',
    derivado_legales: c.derivado_legales,
    decision: c.decision ?? '',
    monto_concedido: c.monto_concedido ? String(c.monto_concedido) : '',
    responsable: c.responsable ?? '',
    notas: c.notas ?? '',
  };
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const aNumero = (s: string): number | null => (s.trim() === '' ? null : Number(s.trim().replace(',', '.')));
const montoValido = (s: string) => {
  const n = aNumero(s);
  return n === null || (Number.isFinite(n) && n >= 0);
};

export const enLegales = (e: Etapa) => e === 'legales' || e === 'difusion';

export function validarBorrador(b: Borrador, hoy: string): string | null {
  if (!b.cliente_id) return 'Elegí el cliente.';
  if (!b.causa) return 'Elegí la causa del reclamo.';
  if (!FECHA.test(b.abierto_en)) return 'Cargá la fecha de apertura.';
  if (b.abierto_en > hoy) return 'La fecha de apertura no puede ser posterior a hoy.';
  if (!montoValido(b.monto_reclamado) || !montoValido(b.monto_concedido)) return 'Los montos tienen que ser números mayores o iguales a cero.';
  if (b.etapa === 'cerrado') {
    if (!b.decision) return 'Para cerrar el caso elegí la decisión.';
    if (!FECHA.test(b.cerrado_en)) return 'Para cerrar el caso cargá la fecha de cierre.';
    if (b.cerrado_en < b.abierto_en) return 'La fecha de cierre no puede ser anterior a la apertura.';
    if (b.cerrado_en > hoy) return 'La fecha de cierre no puede ser posterior a hoy.';
  }
  return null;
}

/** Fila para la base. La organización la pone el trigger con la del cliente. */
export function datosDe(b: Borrador) {
  const cerrado = b.etapa === 'cerrado';
  return {
    cliente_id: b.cliente_id,
    abierto_en: b.abierto_en,
    cerrado_en: cerrado ? b.cerrado_en : null,
    etapa: b.etapa,
    semaforo: b.semaforo,
    causa: b.causa as Causa,
    canal: b.canal.trim() || null,
    monto_reclamado: aNumero(b.monto_reclamado),
    contracargo: b.contracargo,
    contracargo_resultado: b.contracargo ? b.contracargo_resultado : null,
    derivado_legales: b.derivado_legales || enLegales(b.etapa),
    decision: b.decision || null,
    monto_concedido: aNumero(b.monto_concedido) ?? 0,
    responsable: b.responsable.trim() || null,
    notas: b.notas.trim() || null,
  };
}

// ---------------------------------------------------------------------
// Indicadores del período
// ---------------------------------------------------------------------

export interface ConcesionMoneda {
  moneda: string;
  concedido: number;
  altas: number;
  /** null si no hubo altas en esa moneda. */
  pct: number | null;
}

export interface Indicadores {
  abiertosHoy: number;
  enRojo: number;
  enLegales: number;
  reclamosMes: number;
  ventasMes: number;
  /** Reclamos cada 100 ventas. */
  tasaReclamos: number | null;
  cerradosMes: number;
  sinDerivacion: number;
  /** Porcentaje de cerrados sin derivación a legales. */
  resueltosAntes: number | null;
  /** Días promedio entre apertura y cierre. */
  tiempoMedio: number | null;
  /** Por moneda, sin convertir. */
  concesiones: ConcesionMoneda[];
  contracargos: number;
  contracargosGanados: number;
  contracargosPerdidos: number;
  contracargosPendientes: number;
  /** Ganados sobre recibidos, como en la calculadora del protocolo. */
  pctGanados: number | null;
  causas: { causa: Causa; cantidad: number }[];
}

/**
 * Definiciones del tablero del protocolo de conflictos aplicadas al CRM.
 * casos son los casos con actividad en el mes, abiertos los casos en curso hoy
 * y altas los clientes dados de alta en el mes.
 */
export function calcularIndicadores(casos: Caso[], abiertos: CasoAbierto[], altas: Alta[], mes: Mes): Indicadores {
  const delMes = casos.filter((c) => enMes(c.abierto_en, mes));
  const cerrados = casos.filter((c) => c.etapa === 'cerrado' && enMes(c.cerrado_en, mes));
  const sinDerivacion = cerrados.filter((c) => !c.derivado_legales).length;
  const ventas = altas.length;

  const porMoneda = new Map<string, ConcesionMoneda>();
  const fila = (moneda: string) => {
    const clave = moneda || 'USD';
    let f = porMoneda.get(clave);
    if (!f) {
      f = { moneda: clave, concedido: 0, altas: 0, pct: null };
      porMoneda.set(clave, f);
    }
    return f;
  };
  for (const a of altas) fila(a.moneda).altas += Number(a.monto_total ?? 0);
  for (const c of cerrados) if (c.monto_concedido > 0) fila(c.cliente?.moneda ?? 'USD').concedido += c.monto_concedido;
  const concesiones = [...porMoneda.values()]
    .filter((f) => f.altas > 0 || f.concedido > 0)
    .map((f) => ({ ...f, pct: f.altas > 0 ? (f.concedido / f.altas) * 100 : null }))
    .sort((a, b) => b.altas - a.altas || b.concedido - a.concedido);

  const conContracargo = delMes.filter((c) => c.contracargo);
  const ganados = conContracargo.filter((c) => c.contracargo_resultado === 'ganado').length;
  const perdidos = conContracargo.filter((c) => c.contracargo_resultado === 'perdido').length;

  const cuenta = new Map<Causa, number>();
  for (const c of delMes) cuenta.set(c.causa, (cuenta.get(c.causa) ?? 0) + 1);
  // El orden del protocolo desempata entre causas con la misma cantidad.
  const causas = CAUSAS.filter((k) => cuenta.has(k))
    .map((k) => ({ causa: k, cantidad: cuenta.get(k) ?? 0 }))
    .sort((a, b) => b.cantidad - a.cantidad);

  return {
    abiertosHoy: abiertos.length,
    enRojo: abiertos.filter((c) => c.semaforo === 'rojo').length,
    enLegales: abiertos.filter((c) => enLegales(c.etapa)).length,
    reclamosMes: delMes.length,
    ventasMes: ventas,
    tasaReclamos: ventas ? (delMes.length / ventas) * 100 : null,
    cerradosMes: cerrados.length,
    sinDerivacion,
    resueltosAntes: cerrados.length ? (sinDerivacion / cerrados.length) * 100 : null,
    tiempoMedio: cerrados.length ? cerrados.reduce((s, c) => s + diasEntre(c.abierto_en, c.cerrado_en as string), 0) / cerrados.length : null,
    concesiones,
    contracargos: conContracargo.length,
    contracargosGanados: ganados,
    contracargosPerdidos: perdidos,
    contracargosPendientes: conContracargo.length - ganados - perdidos,
    pctGanados: conContracargo.length ? (ganados / conContracargo.length) * 100 : null,
    causas,
  };
}

export const numero = (n: number, decimales = 1) => n.toLocaleString('es-AR', { maximumFractionDigits: decimales });
export const porcentaje = (n: number) => `${numero(n)}%`;
export const cantidad = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

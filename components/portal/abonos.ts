import { supabase } from './supabase';

/**
 * Abonos con tarjeta, mensuales o trimestrales, cobrados con dLocal Go. Tipos, rótulos,
 * formatos y llamadas a /api/pagos. La tarjeta se carga siempre en la
 * página segura de dLocal Go, este portal nunca la ve.
 * Desde noviembre de 2026 los abonos de la oferta llevan un esquema (0061):
 * tres cuotas y después la cuota posterior, o un pago completo que cubre
 * cuatro meses y después la cuota posterior congelada. En pesos se cobran al
 * dólar MEP.
 */

export type EstadoAbono = 'borrador' | 'pendiente' | 'activo' | 'pausado' | 'cancelado' | 'con_error';
export type EstadoPagoAbono = 'aprobado' | 'rechazado' | 'reintegrado' | 'pendiente';
export type MonedaAbono = 'ARS' | 'USD';
export type Modalidad = 'cuotas' | 'pago_completo';
export type PlanServicio = 'starter' | 'eminent';

export interface Abono {
  id: string;
  organizacion_id: string;
  concepto: string;
  monto: number | string;
  moneda: MonedaAbono;
  /** País del plan en dLocal Go. Vacío en dólares: el checkout se lo pregunta al cliente. */
  pais: string | null;
  /** Cada cuántos meses se cobra: 1 o 3. */
  periodo_meses: number;
  estado: EstadoAbono;
  email_pagador: string;
  plan_id: string | null;
  plan_token: string | null;
  suscripcion_id: string | null;
  proximo_cobro: string | null;
  /** Fecha hasta la que rige el abono (AAAA-MM-DD). Informativa: no frena los débitos. */
  vigente_hasta?: string | null;
  /* Esquema de la oferta (0061). Vacío en los abonos de antes. */
  plan_servicio?: PlanServicio | null;
  modalidad?: Modalidad | null;
  /** Qué monto se cobra ahora: el inicial o el posterior. */
  etapa?: 'inicial' | 'posterior' | null;
  cuotas_iniciales?: number | null;
  monto_inicial?: number | string | null;
  monto_posterior?: number | string | null;
  meses_cubiertos?: number | null;
  congela_meses?: number | null;
  /** AAAA-MM-DD hasta la que la cuota posterior no cambia. */
  congelado_hasta?: string | null;
  precio_fundador?: boolean;
  /** En pesos al dólar MEP: monto es pesos y monto_usd la referencia en dólares. */
  al_mep?: boolean;
  monto_usd?: number | string | null;
  cotizacion_mep?: number | string | null;
  cotizado_en?: string | null;
  aceptado_en: string | null;
  aceptado_por: string | null;
  cancelado_en: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface PagoAbono {
  id: string;
  abono_id: string;
  organizacion_id: string;
  cobro_id: string;
  monto_pagado: number | string | null;
  monto_recibido: number | string | null;
  moneda: string;
  moneda_cobro: string | null;
  estado: EstadoPagoAbono;
  fecha: string;
  detalle: { suscripcion_id?: string | null; moneda_saldo?: string | null; estado_dlocal?: string | null; [k: string]: unknown } | null;
}

export interface Disponibilidad {
  dlocalgo: boolean;
  entorno: 'sandbox' | 'produccion';
}

type Tono = 'bosque' | 'piedra' | 'alerta' | 'tinta';

export const PROCESADOR = 'dLocal Go';

export type PeriodoAbono = 1 | 3;

/** "por mes" o "cada 3 meses", para acompañar un monto. */
export const periodoTexto = (meses: number): string => (meses === 3 ? 'cada 3 meses' : 'por mes');

/** Una opción de la oferta de /planes, para armar el abono después de la reunión. Montos en dólares. */
export interface Oferta {
  id: string;
  titulo: string;
  plan: PlanServicio;
  modalidad: Modalidad;
  concepto: string;
  /** Cuota inicial por mes, o el pago completo. */
  inicial: number;
  /** Cuota por mes después de la etapa inicial. */
  posterior: number;
  /** Cuotas al monto inicial. Solo en cuotas. */
  cuotas?: number;
  /** Meses que cubre el pago completo: los tres pagos más el cuarto sin cargo. */
  meses?: number;
  /** Meses que la cuota posterior queda congelada. Solo en pago completo. */
  congela?: number;
  fundador?: boolean;
}

export const OFERTAS: Oferta[] = [
  { id: 'eminent-cuotas', titulo: 'Eminent en tres cuotas de USD 750, después USD 500', plan: 'eminent', modalidad: 'cuotas', concepto: 'Plan Eminent de FIRMA', inicial: 750, posterior: 500, cuotas: 3 },
  { id: 'eminent-completo', titulo: 'Eminent con pago completo de USD 1.800, después USD 500', plan: 'eminent', modalidad: 'pago_completo', concepto: 'Plan Eminent de FIRMA', inicial: 1800, posterior: 500, meses: 4, congela: 12 },
  { id: 'eminent-fundador', titulo: 'Eminent precio fundador, pago completo de USD 1.500, después USD 500', plan: 'eminent', modalidad: 'pago_completo', concepto: 'Plan Eminent de FIRMA, precio fundador', inicial: 1500, posterior: 500, meses: 4, congela: 12, fundador: true },
  { id: 'starter-cuotas', titulo: 'Starter en tres cuotas de USD 400, después USD 250', plan: 'starter', modalidad: 'cuotas', concepto: 'Plan Starter de FIRMA', inicial: 400, posterior: 250, cuotas: 3 },
  { id: 'starter-completo', titulo: 'Starter con pago completo de USD 1.000, después USD 250', plan: 'starter', modalidad: 'pago_completo', concepto: 'Plan Starter de FIRMA', inicial: 1000, posterior: 250, meses: 4, congela: 12 },
  { id: 'starter-fundador', titulo: 'Starter precio fundador, pago completo de USD 800, después USD 250', plan: 'starter', modalidad: 'pago_completo', concepto: 'Plan Starter de FIRMA, precio fundador', inicial: 800, posterior: 250, meses: 4, congela: 12, fundador: true },
];

/** Precio fundador: las primeras 5 empresas o hasta el 31/12/2026. La base también lo controla. */
export const FUNDADOR_CUPO = 5;
export const FUNDADOR_HASTA = '2026-12-31';

/** Moneda de los montos del esquema: dólares si se cobra en pesos al MEP. */
export const monedaReferencia = (a: Pick<Abono, 'al_mep' | 'moneda'>): string => (a.al_mep ? 'USD' : a.moneda);

/** Lo que se cobra ahora, en la moneda de referencia. Es lo que acepta el titular. */
export const montoReferencia = (a: Pick<Abono, 'al_mep' | 'monto_usd' | 'monto'>): number => (a.al_mep ? Number(a.monto_usd) : Number(a.monto));

/** Pago completo todavía sin pagar. */
export const enPagoUnico = (a: Abono): boolean => a.modalidad === 'pago_completo' && a.etapa === 'inicial';

/** Pago completo ya acreditado y sin débito todavía para la cuota posterior. */
export const cuotaPorAutorizar = (a: Abono): boolean => a.modalidad === 'pago_completo' && a.etapa === 'posterior' && !a.plan_id && a.estado !== 'cancelado';

/** La cuota posterior del pago completo se autoriza desde una semana antes de que venza lo pagado. */
export const VENTANA_DIAS = 7;
export const desdeAutoriza = (a: Abono): string | null =>
  a.proximo_cobro ? new Date(Date.parse(a.proximo_cobro) - VENTANA_DIAS * 86_400_000).toISOString() : null;

/** Pagos aprobados del abono, para contar las cuotas. */
export const pagosAprobados = (a: Abono, pagos: PagoAbono[]): number => pagos.filter((p) => p.abono_id === a.id && p.estado === 'aprobado').length;

/** El esquema en una línea. Vacío en los abonos de antes. */
export function resumenEsquema(a: Abono): string {
  const m = (n: number | string | null | undefined) => montoTexto(Number(n), monedaReferencia(a));
  if (a.modalidad === 'cuotas') return `${a.cuotas_iniciales} cuotas de ${m(a.monto_inicial)} y después ${m(a.monto_posterior)} por mes`;
  if (a.modalidad === 'pago_completo') {
    const congela = a.congela_meses ? `, congelados ${a.congela_meses} meses` : '';
    return `Pago completo de ${m(a.monto_inicial)} por ${a.meses_cubiertos} meses y después ${m(a.monto_posterior)} por mes${congela}`;
  }
  return '';
}

/** Pago único del pago completo, en dLocal Go. */
export const esPagoUnico = (p: PagoAbono): boolean => p.detalle?.procesador === 'dlocalgo_unico';

/** Dólar MEP del día, para mostrar los pesos. null si no se pudo consultar. */
export async function consultarMep(): Promise<{ valor: number; fuente: string; fecha: string } | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch('/api/pagos/activar?mep=1', { headers: { authorization: `Bearer ${t}` } });
    if (!r.ok) return null;
    const j = (await r.json().catch(() => null)) as { valor?: unknown; fuente?: unknown; fecha?: unknown } | null;
    const v = Number(j?.valor);
    return Number.isFinite(v) && v > 0 ? { valor: v, fuente: String(j?.fuente ?? ''), fecha: String(j?.fecha ?? '') } : null;
  } catch {
    return null;
  }
}

/** Dólares a pesos con el MEP, sin centavos. Igual que en el servidor. */
export const pesosAlMep = (usd: number, mep: number): number => Math.round(usd * mep);

/** Países que dLocal Go habilita por defecto y la moneda en la que paga cada uno. */
export const PAISES_DLOCALGO: Record<string, { nombre: string; moneda: string }> = {
  AR: { nombre: 'Argentina', moneda: 'pesos argentinos' },
  BO: { nombre: 'Bolivia', moneda: 'bolivianos' },
  BR: { nombre: 'Brasil', moneda: 'reales' },
  CL: { nombre: 'Chile', moneda: 'pesos chilenos' },
  CO: { nombre: 'Colombia', moneda: 'pesos colombianos' },
  CR: { nombre: 'Costa Rica', moneda: 'colones' },
  EC: { nombre: 'Ecuador', moneda: 'dólares' },
  GT: { nombre: 'Guatemala', moneda: 'quetzales' },
  ID: { nombre: 'Indonesia', moneda: 'rupias' },
  MX: { nombre: 'México', moneda: 'pesos mexicanos' },
  MY: { nombre: 'Malasia', moneda: 'ringgits' },
  PE: { nombre: 'Perú', moneda: 'soles' },
  PY: { nombre: 'Paraguay', moneda: 'guaraníes' },
  UY: { nombre: 'Uruguay', moneda: 'pesos uruguayos' },
};


export const ESTADO_ABONO: Record<EstadoAbono, { titulo: string; tono: Tono }> = {
  borrador: { titulo: 'Por activar', tono: 'piedra' },
  pendiente: { titulo: 'Confirmando pago', tono: 'piedra' },
  activo: { titulo: 'Activo', tono: 'bosque' },
  pausado: { titulo: 'En pausa', tono: 'tinta' },
  cancelado: { titulo: 'De baja', tono: 'piedra' },
  con_error: { titulo: 'Problema de cobro', tono: 'alerta' },
};

export const ESTADO_PAGO: Record<EstadoPagoAbono, { titulo: string; tono: Tono }> = {
  aprobado: { titulo: 'Aprobado', tono: 'bosque' },
  rechazado: { titulo: 'Rechazado', tono: 'alerta' },
  reintegrado: { titulo: 'Reintegrado', tono: 'tinta' },
  pendiente: { titulo: 'En proceso', tono: 'piedra' },
};

const ZONA = 'America/Argentina/Buenos_Aires';

export function montoTexto(n: number | string, moneda: string): string {
  const v = Number(n);
  const decimales = Math.round(v * 100) % 100 !== 0;
  return `${moneda} ${v.toLocaleString('es-AR', { minimumFractionDigits: decimales ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Monto del cobro. Lo que pagó el cliente, en la moneda de su país, o sin monto informado (por ejemplo un rechazo) el del abono. */
export function montoPagado(p: PagoAbono, abono?: Pick<Abono, 'monto' | 'moneda'>): string {
  if (p.monto_pagado !== null && p.monto_pagado !== '' && Number(p.monto_pagado) > 0) return montoTexto(p.monto_pagado, p.moneda_cobro || p.moneda);
  return abono ? montoTexto(abono.monto, abono.moneda) : '·';
}

/** 15 de octubre de 2026 */
export function fechaLarga(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA });
}

/** 15/10/2026 */
export function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONA });
}

/** vigente_hasta es una fecha sin hora: se muestra tal cual, sin pasar por la zona horaria. */
export function fechaDia(d: string | null | undefined, larga = false): string {
  if (!d) return '';
  const [a, m, dia] = d.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dia, 12)).toLocaleDateString(
    'es-AR',
    larga ? { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' } : { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' },
  );
}

/** La vigencia pactada ya pasó. */
export const vigenciaVencida = (a: Pick<Abono, 'vigente_hasta'>): boolean =>
  Boolean(a.vigente_hasta) && (a.vigente_hasta as string) < new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());

/** 14.30 h, sin dos puntos, como el resto de los textos de FIRMA. */
export function hora(iso: string | null): string {
  if (!iso) return '';
  const partes = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA }).formatToParts(new Date(iso));
  const h = partes.find((p) => p.type === 'hour')?.value ?? '00';
  const m = partes.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h}.${m} h`;
}

/** Suscripción vigente en dLocal Go, con o sin problemas de cobro. */
export const vigente = (a: Abono): boolean => (a.estado === 'activo' || a.estado === 'pausado' || a.estado === 'con_error') && Boolean(a.suscripcion_id);

/** Se puede ir a suscribirse. Con un problema de cobro, solo si ya no hay suscripción vigente. */
/** Medios de los pagos que FIRMA registra a mano. */
export const MEDIO_MANUAL: Record<string, string> = {
  transferencia_ars: 'Transferencia en pesos',
  transferencia_usd: 'Transferencia en dólares',
  usdt: 'USDT',
  otro: 'Otro medio',
};

/** Pago cargado a mano por FIRMA, no por dLocal Go. */
export const esPagoManual = (p: PagoAbono): boolean => p.detalle?.procesador === 'manual';

/** Abono sin débito con tarjeta: activo por los pagos que registra FIRMA. */
export const abonoManual = (a: Abono): boolean => !a.plan_id && a.estado === 'activo';

export const activable = (a: Abono): boolean => a.estado === 'borrador' || a.estado === 'pendiente' || (a.estado === 'con_error' && !a.suscripcion_id);

/** Pendiente después de dar de baja la suscripción para cambiar el medio de pago. */
export const cambiandoMedio = (a: Abono, pagos: PagoAbono[]): boolean => a.estado === 'pendiente' && pagos.some((p) => p.abono_id === a.id && p.estado === 'aprobado');

async function token(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** POST a /api/pagos/activar o /api/pagos/gestionar con la sesión actual. Ante un error, datos trae el cuerpo de la respuesta. */
export async function llamarPagos<T>(ruta: 'activar' | 'gestionar', cuerpo: Record<string, unknown>): Promise<{ ok: boolean; datos?: T & { actualizar?: boolean }; error?: string }> {
  const t = await token();
  if (!t) return { ok: false, error: 'Tu sesión venció. Volvé a ingresar.' };
  try {
    const r = await fetch(`/api/pagos/${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
      body: JSON.stringify(cuerpo),
    });
    const j = (await r.json().catch(() => ({}))) as T & { error?: string; actualizar?: boolean };
    if (!r.ok) return { ok: false, datos: j, error: j.error || `Error ${r.status}` };
    return { ok: true, datos: j };
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor.' };
  }
}

/** Trae de dLocal Go el estado, el próximo cobro y los cobros del abono. */
export function sincronizarAbono(abonoId: string) {
  return llamarPagos<{ estado?: EstadoAbono; nuevos?: number; cambio?: boolean }>('gestionar', { abono_id: abonoId, accion: 'sincronizar' });
}

/** dLocal Go listo para cobrar. null si no se pudo consultar (por ejemplo en desarrollo local). */
export interface Diagnostico {
  entorno: string;
  api: string;
  pasos: { paso: string; ok: boolean; status: number; respuesta: string }[];
}

/** Prueba la conexión con dLocal Go paso por paso. Solo FIRMA. */
export async function diagnosticarDlocal(): Promise<{ ok: boolean; datos?: Diagnostico; error?: string }> {
  const t = await token();
  if (!t) return { ok: false, error: 'Tu sesión venció. Volvé a ingresar.' };
  try {
    const r = await fetch('/api/pagos/activar?diagnostico=1', { headers: { authorization: `Bearer ${t}` } });
    const j = (await r.json().catch(() => ({}))) as Diagnostico & { error?: string };
    if (!r.ok) return { ok: false, error: j.error || `Error ${r.status}` };
    return { ok: true, datos: j };
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor.' };
  }
}

export async function consultarDisponibilidad(): Promise<Disponibilidad | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch('/api/pagos/activar', { headers: { authorization: `Bearer ${t}` } });
    if (!r.ok) return null;
    const j = (await r.json().catch(() => null)) as Partial<Disponibilidad> | null;
    if (!j || typeof j.dlocalgo !== 'boolean') return null;
    return { dlocalgo: j.dlocalgo, entorno: j.entorno === 'produccion' ? 'produccion' : 'sandbox' };
  } catch {
    return null;
  }
}

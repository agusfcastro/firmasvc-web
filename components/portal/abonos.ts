import { supabase } from './supabase';

/**
 * Abonos con tarjeta, mensuales o trimestrales, cobrados con dLocal Go. Tipos, rótulos,
 * formatos y llamadas a /api/pagos. La tarjeta se carga siempre en la
 * página segura de dLocal Go, este portal nunca la ve.
 */

export type EstadoAbono = 'borrador' | 'pendiente' | 'activo' | 'pausado' | 'cancelado' | 'con_error';
export type EstadoPagoAbono = 'aprobado' | 'rechazado' | 'reintegrado' | 'pendiente';
export type MonedaAbono = 'ARS' | 'USD';

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

/** Los planes de /planes, para armar el abono después de la reunión. */
export const PLANES_ABONO: { id: string; titulo: string; concepto: string; monto: number; moneda: MonedaAbono; periodo: PeriodoAbono }[] = [
  { id: 'gold', titulo: 'Gold, USD 150 por mes', concepto: 'Plan Gold de FIRMA', monto: 150, moneda: 'USD', periodo: 1 },
  { id: 'black', titulo: 'Black, USD 300 por mes', concepto: 'Plan Black de FIRMA', monto: 300, moneda: 'USD', periodo: 1 },
  { id: 'eminent', titulo: 'Eminent, USD 1.000 por mes', concepto: 'Plan Eminent de FIRMA', monto: 1000, moneda: 'USD', periodo: 1 },
  { id: 'eminent-trimestral', titulo: 'Eminent trimestral, USD 1.500 cada 3 meses', concepto: 'Plan Eminent de FIRMA, trimestral', monto: 1500, moneda: 'USD', periodo: 3 },
];

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

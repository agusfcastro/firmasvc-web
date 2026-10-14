export type EstadoFirma = 'Pendiente' | 'Firmado' | 'Baja';

export interface ClienteCrm {
  id: string;
  organizacion_id: string;
  codigo: string;
  nombre: string;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  servicio: string | null;
  monto_total: number | null;
  moneda: string;
  modalidad: 'PIF' | 'Cuotas';
  fecha_onboarding: string | null;
  estado_firma: EstadoFirma;
  link_contrato_servicio: string | null;
  responsable: string | null;
  notas: string | null;
  plan_pagos_original: string | null;
  revisar_pagos: boolean;
  firma_url: string | null;
  zapsign_doc: string | null;
  contrato_estado: 'listo' | 'error' | 'sin_cuenta' | 'sin_modelo' | null;
  contrato_error: string | null;
  contrato_generado_en: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface ClienteResumen extends ClienteCrm {
  cobrado: number;
  pendiente: number;
  proximo_vencimiento: string | null;
  cuotas_vencidas: number;
  cuotas_pactadas: number;
  proxima_cuota_monto: number | null;
  por_cobrar_30_dias: number;
}

export interface Pago {
  id: string;
  cliente_id: string;
  monto: number;
  vencimiento: string | null;
  estado: 'pendiente' | 'pagado';
  fecha_pago: string | null;
  nota: string | null;
  creado_en: string;
}

export interface ContratoReservado {
  cliente_id: string;
  link_contrato_cliente: string | null;
  link_documento: string | null;
}

export interface Servicio {
  id: string;
  organizacion_id?: string;
  clave: string;
  nombre: string | null;
  precio: number | null;
  activo?: boolean;
  zapsign_modelo?: string | null;
}

export interface CambioHistorial {
  id: number;
  tabla: string;
  operacion: string;
  usuario_id: string | null;
  cambios: Record<string, { antes: unknown; despues: unknown }>;
  creado_en: string;
}

export function dinero(n: number | null | undefined, moneda = 'USD'): string {
  if (n === null || n === undefined) return '·';
  const v = Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${moneda} ${v}`;
}

export function fecha(d: string | null | undefined): string {
  if (!d) return 'Sin fecha';
  const [y, m, dd] = d.slice(0, 10).split('-');
  return `${dd}/${m}/${y}`;
}

export function hoyISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export const TONO_FIRMA: Record<EstadoFirma, 'bosque' | 'piedra' | 'alerta'> = {
  Firmado: 'bosque',
  Pendiente: 'piedra',
  Baja: 'alerta',
};

import { simboloMoneda } from '../../../api/_lib/variables';

export type EstadoFirma = 'Pendiente' | 'En firma' | 'Firmado' | 'Baja';
export type TipoCliente = 'persona' | 'empresa';

export interface ClienteCrm {
  id: string;
  organizacion_id: string;
  codigo: string;
  /** Persona o empresa. En una empresa, nombre es la razón social y dni, email y telefono son del representante. */
  tipo?: TipoCliente;
  nombre: string;
  id_fiscal?: string | null;
  representante?: string | null;
  cargo?: string | null;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  domicilio?: string | null;
  servicio: string | null;
  monto_total: number | null;
  moneda: string;
  modalidad: 'PIF' | 'Cuotas';
  fecha_onboarding: string | null;
  estado_firma: EstadoFirma;
  link_contrato_servicio: string | null;
  responsable: string | null;
  notas: string | null;
  condiciones?: string | null;
  plan_pagos_original: string | null;
  revisar_pagos: boolean;
  /** Integrantes de equipo_miembros. */
  closer_id?: string | null;
  setter_id?: string | null;
  responsable_id?: string | null;
  /** Valores de las variables propias del negocio de ámbito cliente. */
  datos_extra?: Record<string, unknown>;
  creado_en: string;
  actualizado_en: string;
}

export type RolComercial = 'closer' | 'setter' | 'account_manager' | 'csm' | 'otro';

export const ROL_COMERCIAL: Record<RolComercial, string> = {
  closer: 'Closer',
  setter: 'Setter',
  account_manager: 'Account Manager',
  // CSM y Account Manager son lo mismo (migración 0078): la base guarda account_manager.
  csm: 'Account Manager',
  otro: 'Otro',
};

/** Los roles que se eligen en los menús. CSM ya no se ofrece porque es Account Manager. */
export const ROLES_ELEGIBLES: RolComercial[] = ['closer', 'setter', 'account_manager', 'otro'];

/** Cargos con un solo nombre. Se sugieren al escribir el rol de alguien con rol «otro». */
export const CARGOS_ESTANDAR = ['CEO', 'COO', 'CFO', 'CCO', 'CMO', 'CTO', 'Head of Sales', 'Head of Customer Success', 'Operaciones', 'Administración', 'Legales', 'Contenido', 'Soporte'];

const plano = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** El cargo como se guarda: si coincide con uno estándar, con su nombre exacto. */
export function cargoNormal(texto: string): string {
  const t = texto.trim().replace(/\s+/g, ' ');
  return CARGOS_ESTANDAR.find((c) => plano(c) === plano(t)) ?? t;
}

export interface IntegranteEquipo {
  id: string;
  organizacion_id: string;
  nombre: string;
  rol_comercial: RolComercial;
  /** Rol escrito a mano cuando rol_comercial es «otro» (0069): Nutricionista, Médico, Editor. */
  cargo?: string | null;
  email: string | null;
  usuario_id: string | null;
  activo: boolean;
}

/** El rol de alguien del equipo como se muestra: el escrito a mano si es «otro» y lo tiene. */
export const rolDe = (m: Pick<IntegranteEquipo, 'rol_comercial' | 'cargo'>): string =>
  (m.rol_comercial === 'otro' && m.cargo?.trim()) || ROL_COMERCIAL[m.rol_comercial] || m.rol_comercial;

export type TipoVariable = 'texto' | 'numero' | 'monto' | 'fecha' | 'opcion' | 'booleano';
export type AmbitoVariable = 'negocio' | 'cliente' | 'contrato';

export interface VariablePropia {
  id: string;
  organizacion_id: string;
  ambito: AmbitoVariable;
  clave: string;
  etiqueta: string;
  ayuda: string | null;
  tipo: TipoVariable;
  opciones: string[] | null;
  obligatoria: boolean;
  activa: boolean;
  orden: number;
}

export const TIPO_VARIABLE: Record<TipoVariable, string> = {
  texto: 'Texto',
  numero: 'Número',
  monto: 'Monto',
  fecha: 'Fecha',
  opcion: 'Opción de una lista',
  booleano: 'Sí o no',
};

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
  /** Moneda del ticket (migración 0072). */
  moneda?: string;
  activo?: boolean;
  /** Duración en meses (0079). Con el onboarding da el fin del contrato. */
  duracion_meses?: number | null;
}

/** Monedas que FIRMA le puede habilitar a una empresa en Administración › Clientes (migración 0072). */
export const MONEDAS_CRM: [string, string][] = [
  ['USD', 'Dólares estadounidenses'],
  ['PEN', 'Soles peruanos'],
];

export function nombreMonedaCrm(m: string): string {
  return MONEDAS_CRM.find(([k]) => k === m)?.[1] ?? m;
}

/** Las monedas habilitadas, más la que ya tiene el dato si quedó afuera, para no perderla al editar. */
export function opcionesMoneda(habilitadas: string[], actual?: string | null): string[] {
  return actual && !habilitadas.includes(actual) ? [...habilitadas, actual] : habilitadas;
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
  return `${simboloMoneda(moneda)} ${v}`;
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

export const TONO_FIRMA: Record<EstadoFirma, 'bosque' | 'piedra' | 'alerta' | 'tinta'> = {
  Firmado: 'bosque',
  Pendiente: 'piedra',
  'En firma': 'tinta',
  Baja: 'alerta',
};

/**
 * Reuniones del equipo con clientes y prospectos (migración 0078).
 * El tipo lo marca una persona: Fathom no distingue un seguimiento de un
 * cierre. De acá salen la asistencia y el cierre de cada persona.
 */

export type TipoReunion = 'venta' | 'onboarding' | 'seguimiento' | 'renovacion' | 'reclamo' | 'otra';
export type EstadoReunion = 'agendada' | 'realizada' | 'no_asistio' | 'cancelada' | 'reprogramada';
export type ResultadoVenta = 'cerro' | 'no_cerro' | 'seguimiento';

export interface Reunion {
  id: string;
  organizacion_id: string;
  cliente_id: string | null;
  prospecto: string | null;
  /** El título de la llamada en Fathom o uno escrito a mano. */
  titulo: string | null;
  /** Sin tipo: llegó de Fathom y falta que alguien la clasifique. */
  tipo: TipoReunion | null;
  inicio: string;
  duracion_min: number | null;
  miembro_id: string | null;
  agendada_por: string | null;
  estado: EstadoReunion;
  resultado: ResultadoVenta | null;
  enlace: string | null;
  interaccion_id: string | null;
  notas: string | null;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
}

export const TIPO_REUNION: Record<TipoReunion, string> = {
  venta: 'Venta',
  onboarding: 'Onboarding',
  seguimiento: 'Seguimiento',
  renovacion: 'Renovación',
  reclamo: 'Reclamo',
  otra: 'Otra',
};

export const ESTADO_REUNION: Record<EstadoReunion, { titulo: string; tono: 'bosque' | 'piedra' | 'alerta' | 'tinta' }> = {
  agendada: { titulo: 'Agendada', tono: 'tinta' },
  realizada: { titulo: 'Hecha', tono: 'bosque' },
  no_asistio: { titulo: 'No asistió', tono: 'alerta' },
  cancelada: { titulo: 'Cancelada', tono: 'piedra' },
  reprogramada: { titulo: 'Reprogramada', tono: 'piedra' },
};

export const RESULTADO_VENTA: Record<ResultadoVenta, string> = {
  cerro: 'Cerró',
  no_cerro: 'No cerró',
  seguimiento: 'Queda en seguimiento',
};

export const COLUMNAS_REUNION =
  'id, organizacion_id, cliente_id, prospecto, titulo, tipo, inicio, duracion_min, miembro_id, agendada_por, estado, resultado, enlace, interaccion_id, notas, creado_por, creado_en, actualizado_en';

export const yaPaso = (r: Pick<Reunion, 'inicio'>) => Date.parse(r.inicio) <= Date.now();

/** Falta completarla: no tiene tipo, o estaba agendada y ya pasó sin que nadie diga si se hizo. */
export const porCompletar = (r: Pick<Reunion, 'tipo' | 'estado' | 'inicio'>) => !r.tipo || (r.estado === 'agendada' && yaPaso(r));

/** Asistencia: de las que ya tenían que pasar, cuántas se hicieron. Las canceladas y reprogramadas no cuentan. */
export function asistencia(lista: Pick<Reunion, 'estado'>[]): { hechas: number; faltazos: number; tasa: number | null } {
  const hechas = lista.filter((r) => r.estado === 'realizada').length;
  const faltazos = lista.filter((r) => r.estado === 'no_asistio').length;
  return { hechas, faltazos, tasa: hechas + faltazos ? hechas / (hechas + faltazos) : null };
}

/** Cierre: de las ventas hechas con resultado, cuántas cerraron. */
export function cierre(lista: Pick<Reunion, 'tipo' | 'estado' | 'resultado'>[]): { cerradas: number; ventas: number; tasa: number | null } {
  const ventas = lista.filter((r) => r.tipo === 'venta' && r.estado === 'realizada' && r.resultado).length;
  const cerradas = lista.filter((r) => r.tipo === 'venta' && r.resultado === 'cerro').length;
  return { cerradas, ventas, tasa: ventas ? cerradas / ventas : null };
}

export const porcentaje = (x: number | null) => (x === null ? '·' : `${Math.round(x * 100)}%`);

const dos = (n: number) => String(n).padStart(2, '0');

/** Para un input datetime-local, en la hora de quien usa el portal. */
export function aInputLocal(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export const desdeInputLocal = (v: string) => new Date(v).toISOString();

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

export const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** El día como título de un grupo: Hoy, Mañana, Ayer o la fecha. */
export function dia(iso: string): string {
  const d = new Date(iso);
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const otro = new Date(d);
  otro.setHours(0, 0, 0, 0);
  const diferencia = Math.round((otro.getTime() - base.getTime()) / 86400000);
  if (diferencia === 0) return 'Hoy';
  if (diferencia === 1) return 'Mañana';
  if (diferencia === -1) return 'Ayer';
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== base.getFullYear() ? { year: 'numeric' } : {}) });
}

export const claveDia = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

import type { Perfil } from '../tipos';
import type { IntegranteEquipo, RolComercial } from '../crm/tipos';

/**
 * Objetivos, hitos, victorias y reportes del equipo (migración 0076).
 * Los permisos los aplica la base. Acá solo se decide qué se muestra.
 */

export const BUCKET_EQUIPO = 'equipo';
/** Lo mismo que admite el bucket «equipo». */
export const TIPOS_EVIDENCIA = 'image/jpeg,image/png,image/webp,image/heic,application/pdf,audio/*,.opus,.ogg,.m4a';
export const MAX_EVIDENCIA = 10 * 1024 * 1024;

/** El tipo del archivo. Algunos audios de WhatsApp llegan sin tipo: se deduce de la extensión. */
export function tipoEvidencia(archivo: File): string | undefined {
  if (archivo.type) return archivo.type;
  const ext = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  const porExtension: Record<string, string> = {
    opus: 'audio/ogg',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    pdf: 'application/pdf',
  };
  return porExtension[ext];
}

export type EstadoVictoria = 'pendiente' | 'validada' | 'rechazada';
export type Alcance = 'negocio' | 'rol' | 'persona';
export type Medida = 'victorias' | 'valor' | 'reporte';
export type Frecuencia = 'diaria' | 'semanal';
export type TipoCampo = 'numero' | 'monto' | 'texto' | 'largo' | 'sino';

export interface Victoria {
  id: string;
  organizacion_id: string;
  miembro_id: string;
  titulo: string;
  detalle: string | null;
  fecha: string;
  valor: number | null;
  moneda: string | null;
  objetivo_id: string | null;
  hito_id: string | null;
  evidencia_url: string | null;
  evidencia_ruta: string | null;
  evidencia_nombre: string | null;
  estado: EstadoVictoria;
  nota: string | null;
  validada_en: string | null;
  creado_en: string;
}

export interface Hito {
  id: string;
  organizacion_id: string | null;
  rol_comercial: RolComercial;
  titulo: string;
  descripcion: string | null;
  plazo_dias: number | null;
  orden: number;
  activo: boolean;
}

export interface CampoReporte {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  ayuda?: string;
  obligatoria?: boolean;
}

export interface Reporte {
  id: string;
  organizacion_id: string | null;
  rol_comercial: RolComercial;
  titulo: string;
  frecuencia: Frecuencia;
  campos: CampoReporte[];
  activo: boolean;
}

export type ValorRespuesta = number | string | boolean;

export interface Respuesta {
  id: string;
  organizacion_id: string;
  reporte_id: string;
  miembro_id: string;
  periodo: string;
  respuestas: Record<string, ValorRespuesta>;
  enviado_en: string;
  actualizado_en: string;
}

export interface Objetivo {
  id: string;
  organizacion_id: string;
  titulo: string;
  alcance: Alcance;
  rol_comercial: RolComercial | null;
  miembro_id: string | null;
  medida: Medida;
  reporte_id: string | null;
  campo: string | null;
  meta: number;
  desde: string;
  hasta: string;
  activo: boolean;
}

export interface Avance {
  objetivo_id: string;
  miembro_id: string | null;
  avance: number;
}

export const ROTULO_ESTADO: Record<EstadoVictoria, string> = { pendiente: 'Para validar', validada: 'Validada', rechazada: 'No validada' };

export const ROTULO_MEDIDA: Record<Medida, string> = {
  victorias: 'Victorias validadas',
  valor: 'Valor de las victorias',
  reporte: 'Un número del reporte',
};

export const ROTULO_TIPO_CAMPO: Record<TipoCampo, string> = {
  numero: 'Número',
  monto: 'Monto',
  texto: 'Texto corto',
  largo: 'Texto largo',
  sino: 'Sí o no',
};

export const esNumerico = (t: TipoCampo) => t === 'numero' || t === 'monto';

/** Lidera el equipo: FIRMA, el titular y quien tiene el área Operaciones. Lo mismo que lidera_equipo() en la base. */
export const lideraEquipo = (perfil: Pick<Perfil, 'rol' | 'areas'>): boolean => perfil.rol === 'admin' || perfil.rol === 'titular' || (perfil.areas ?? []).includes('operaciones');

/* ------------------------------------------------------------------ */
/* Fechas. Todo en AAAA-MM-DD con la fecha local de quien usa el portal */
/* ------------------------------------------------------------------ */
const dos = (n: number) => String(n).padStart(2, '0');
export const isoLocal = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export const hoy = () => isoLocal(new Date());
export const desdeIso = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
};

/** El lunes de la semana de esa fecha, como guarda la base los reportes semanales. */
export function lunesDe(iso: string): string {
  const d = desdeIso(iso);
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  return isoLocal(d);
}

export const periodoDe = (frecuencia: Frecuencia, iso: string) => (frecuencia === 'semanal' ? lunesDe(iso) : iso);

export function mesDe(iso: string): { desde: string; hasta: string } {
  const d = desdeIso(iso);
  return { desde: isoLocal(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}

export const fechaLarga = (iso: string) => desdeIso(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
export const fechaCortaDia = (iso: string) => desdeIso(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export const nombreMes = (iso: string) => {
  const t = desdeIso(iso).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function textoPeriodo(frecuencia: Frecuencia, iso: string): string {
  if (frecuencia === 'diaria') return iso === hoy() ? 'hoy' : `el ${fechaLarga(iso)}`;
  const lunes = lunesDe(iso);
  return lunes === lunesDe(hoy()) ? 'esta semana' : `la semana del ${fechaLarga(lunes)}`;
}

/** Entregado a tiempo: el diario hasta el día siguiente y el semanal hasta el lunes que sigue. */
export function aTiempo(r: Pick<Respuesta, 'periodo' | 'enviado_en'>, frecuencia: Frecuencia): boolean {
  const limite = desdeIso(r.periodo);
  limite.setDate(limite.getDate() + (frecuencia === 'semanal' ? 8 : 2));
  return new Date(r.enviado_en) < limite;
}

/* ------------------------------------------------------------------ */
/* Textos                                                               */
/* ------------------------------------------------------------------ */
export const numero = (n: number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

/** Un número escrito a mano, con coma decimal o punto de miles («2.000,50»). Vacío es null; lo que no es número, NaN. */
export function aNumero(texto: string): number | null {
  const x = texto.trim().replace(/\s/g, '');
  if (!x) return null;
  const limpio = x.includes(',') ? x.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(x) ? x.replace(/\./g, '') : x;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : NaN;
}

export function textoAlcance(o: Pick<Objetivo, 'alcance' | 'rol_comercial' | 'miembro_id'>, equipo: IntegranteEquipo[], rotuloRol: (r: RolComercial) => string): string {
  if (o.alcance === 'negocio') return 'Todo el equipo';
  if (o.alcance === 'rol' && o.rol_comercial) return `Cada ${rotuloRol(o.rol_comercial).toLowerCase()}`;
  return equipo.find((m) => m.id === o.miembro_id)?.nombre ?? 'Una persona';
}

/** Las secciones que la base acepta, sin lo que rompa la pantalla. */
export function camposSeguros(crudo: unknown): CampoReporte[] {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null && typeof c.clave === 'string' && typeof c.etiqueta === 'string')
    .map((c) => ({
      clave: c.clave as string,
      etiqueta: c.etiqueta as string,
      tipo: (['numero', 'monto', 'texto', 'largo', 'sino'].includes(c.tipo as string) ? c.tipo : 'texto') as TipoCampo,
      ...(typeof c.ayuda === 'string' && c.ayuda ? { ayuda: c.ayuda } : {}),
      ...(c.obligatoria === true ? { obligatoria: true } : {}),
    }));
}

export const reporteSeguro = (r: Reporte): Reporte => ({ ...r, campos: camposSeguros(r.campos) });

/** La clave de un campo nuevo, a partir de su texto. */
export function claveCampo(etiqueta: string, usadas: string[]): string {
  const base =
    etiqueta
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'campo';
  let clave = base;
  for (let i = 2; usadas.includes(clave); i++) clave = `${base}_${i}`;
  return clave;
}

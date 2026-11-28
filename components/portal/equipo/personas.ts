/**
 * Equipo como CRM: lo que tiene entre manos cada persona, sus números según
 * el rol, su rendimiento y el riesgo legal del vínculo. Todo sale de lo que
 * ya está en el portal (clientes, reuniones, objetivos, victorias, reportes y
 * contratos del equipo). No usa la IA.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { IntegranteEquipo } from '../crm/tipos';
import { COLUMNAS_REUNION, TIPO_REUNION, asistencia, cierre, yaPaso, type Reunion } from '../crm/reuniones';
import { finDelContrato } from '../crm/LineaTiempo';
import type { Avance, Objetivo, Reporte } from './tipos';

const DIA = 86400000;

export type EstadoItem = 'riesgo' | 'pendiente' | 'agendada' | 'curso' | 'hecha';

export interface Item {
  estado: EstadoItem;
  titulo: string;
  detalle: string;
  /** Adónde lleva al tocarlo. */
  a?: string;
  /** Para ordenar dentro del mismo estado: lo más próximo primero. */
  cuando?: number;
}

export const ROTULO_ESTADO_ITEM: Record<EstadoItem, string> = {
  riesgo: 'Necesita atención',
  pendiente: 'Falta completar',
  agendada: 'Agendada',
  curso: 'En curso',
  hecha: 'Hecha',
};

const ORDEN_ESTADO: Record<EstadoItem, number> = { riesgo: 0, pendiente: 1, agendada: 2, curso: 3, hecha: 4 };

export interface ClientePersona {
  id: string;
  nombre: string;
  codigo: string | null;
  servicio: string | null;
  estado_firma: string;
  fecha_onboarding: string | null;
  responsable_id: string | null;
  closer_id: string | null;
  setter_id: string | null;
  cuotas_vencidas: number | null;
}

export interface VictoriaCorta {
  id: string;
  miembro_id: string;
  titulo: string;
  fecha: string;
  valor: number | null;
  moneda: string | null;
  estado: string;
}

export interface SobreEquipo {
  id: string;
  equipo_miembro_id: string;
  estado: string;
  contrato_vence_el: string | null;
}

export interface DocEquipo {
  id: string;
  equipo_miembro_id: string;
  contrato_vence_el: string | null;
}

export interface DatosPersonas {
  clientes: ClientePersona[];
  reuniones: Reunion[];
  duraciones: Record<string, number>;
  avances: Avance[];
  victorias: VictoriaCorta[];
  sobres: SobreEquipo[];
  docs: DocEquipo[];
  cargado: boolean;
}

/** Lo que necesitan las tarjetas, el calendario y la ficha de cada persona. */
export function useDatosPersonas(orgId: string, verContratos: boolean): DatosPersonas & { recargar: () => Promise<void>; reemplazar: (r: Reunion) => void } {
  const [datos, setDatos] = useState<DatosPersonas>({ clientes: [], reuniones: [], duraciones: {}, avances: [], victorias: [], sobres: [], docs: [], cargado: false });

  const recargar = useCallback(async () => {
    if (!supabase) return;
    const desde = new Date(Date.now() - 90 * DIA).toISOString();
    const inicioMes = new Date();
    inicioMes.setDate(1);
    const [c, r, s, a, v, so, d] = await Promise.all([
      supabase
        .from('crm_clientes_resumen')
        .select('id, nombre, codigo, servicio, estado_firma, fecha_onboarding, responsable_id, closer_id, setter_id, cuotas_vencidas')
        .eq('organizacion_id', orgId),
      supabase.from('crm_reuniones').select(COLUMNAS_REUNION).eq('organizacion_id', orgId).gte('inicio', desde).order('inicio').limit(3000),
      supabase.from('crm_servicios').select('*').eq('organizacion_id', orgId),
      supabase.rpc('equipo_objetivos_avance', { org: orgId }),
      supabase
        .from('equipo_victorias')
        .select('id, miembro_id, titulo, fecha, valor, moneda, estado')
        .eq('organizacion_id', orgId)
        .gte('fecha', new Date(Date.now() - 120 * DIA).toISOString().slice(0, 10))
        .order('fecha', { ascending: false })
        .limit(1000),
      verContratos
        ? supabase.from('firma_sobres').select('id, equipo_miembro_id, estado, contrato_vence_el').eq('organizacion_id', orgId).not('equipo_miembro_id', 'is', null).neq('estado', 'anulado')
        : Promise.resolve({ data: [] as SobreEquipo[] }),
      verContratos
        ? supabase.from('documentos').select('id, equipo_miembro_id, contrato_vence_el').eq('organizacion_id', orgId).not('equipo_miembro_id', 'is', null).eq('activo', true)
        : Promise.resolve({ data: [] as DocEquipo[] }),
    ]);
    const duraciones: Record<string, number> = {};
    for (const x of (s.data ?? []) as { clave: string; duracion_meses?: number | null }[]) if (x.duracion_meses) duraciones[x.clave] = x.duracion_meses;
    setDatos({
      clientes: ((c.data ?? []) as ClientePersona[]).map((x) => ({ ...x, cuotas_vencidas: Number(x.cuotas_vencidas ?? 0) })),
      // Sin la migración 0078 no hay reuniones: el resto funciona igual.
      reuniones: r.error ? [] : ((r.data ?? []) as Reunion[]),
      duraciones,
      avances: ((a.data ?? []) as Avance[]).map((x) => ({ ...x, avance: Number(x.avance) })),
      victorias: ((v.data ?? []) as VictoriaCorta[]).map((x) => ({ ...x, valor: x.valor === null ? null : Number(x.valor) })),
      sobres: ((so.data ?? []) as SobreEquipo[]) ?? [],
      docs: ((d.data ?? []) as DocEquipo[]) ?? [],
      cargado: true,
    });
  }, [orgId, verContratos]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const reemplazar = useCallback(
    (r: Reunion) => setDatos((x) => ({ ...x, reuniones: [...x.reuniones.filter((y) => y.id !== r.id), r].sort((a, b) => a.inicio.localeCompare(b.inicio)) })),
    [],
  );

  return { ...datos, recargar, reemplazar };
}

/* ------------------------------------------------------------------ */
/* Formatos                                                             */
/* ------------------------------------------------------------------ */
const PALETA = ['#5b4a8a', '#173a2f', '#8a5a2b', '#2b5f8a', '#8a2b4f', '#4f6b2b', '#6b4f2b', '#2b6b6b'];
/** Claro de cada color, para el fondo de los eventos del calendario. */
const PALETA_CLARA = ['#ece8f6', '#e3f0e8', '#f6ece0', '#e2edf7', '#f6e4ec', '#ecf2e2', '#f2ebe2', '#e0f0f0'];

/** El color de cada persona, siempre el mismo. */
export function colorDe(id: string): { fuerte: string; claro: string } {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const i = h % PALETA.length;
  return { fuerte: PALETA[i], claro: PALETA_CLARA[i] };
}

export const inicialesDe = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

const diaHora = (iso: string) => {
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date(hoy.getTime() + DIA);
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (d.toDateString() === hoy.toDateString()) return `hoy ${hora}`;
  if (d.toDateString() === manana.toDateString()) return `mañana ${hora}`;
  return `${d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }).replace('.', '')} ${hora}`;
};
const diaCorto = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');

const esAccount = (m: IntegranteEquipo) => m.rol_comercial === 'account_manager' || m.rol_comercial === 'csm';

/** Lunes a domingo de la semana de una fecha. */
export function semanaDe(base: Date): { desde: Date; hasta: Date } {
  const desde = new Date(base);
  desde.setHours(0, 0, 0, 0);
  desde.setDate(desde.getDate() - ((desde.getDay() + 6) % 7));
  const hasta = new Date(desde.getTime() + 7 * DIA);
  return { desde, hasta };
}

const conQuien = (r: Reunion, clientes: ClientePersona[]) =>
  (r.cliente_id && clientes.find((c) => c.id === r.cliente_id)?.nombre) || r.prospecto || r.titulo || 'Sin cliente';

/* ------------------------------------------------------------------ */
/* Lo que tiene entre manos                                            */
/* ------------------------------------------------------------------ */
function deReuniones(propias: Reunion[], clientes: ClientePersona[]): Item[] {
  const items: Item[] = [];
  const semana = Date.now() - 7 * DIA;
  for (const r of propias) {
    const quien = conQuien(r, clientes);
    const a = r.cliente_id ? `/portal/crm/${r.cliente_id}` : '/portal/crm/reuniones';
    const tipo = r.tipo ? TIPO_REUNION[r.tipo] : 'Reunión';
    if (!r.tipo) items.push({ estado: 'pendiente', titulo: quien, detalle: 'Sin tipo, llegó de Fathom', a: '/portal/crm/reuniones', cuando: Date.parse(r.inicio) });
    else if (r.estado === 'agendada' && !yaPaso(r)) items.push({ estado: 'agendada', titulo: quien, detalle: `${tipo} ${diaHora(r.inicio)}`, a, cuando: Date.parse(r.inicio) });
    else if (r.estado === 'agendada') items.push({ estado: 'pendiente', titulo: quien, detalle: 'Falta marcar si se hizo', a: '/portal/crm/reuniones', cuando: Date.parse(r.inicio) });
    else if (r.tipo === 'venta' && r.estado === 'realizada' && !r.resultado) items.push({ estado: 'pendiente', titulo: quien, detalle: 'Falta el resultado de la venta', a: '/portal/crm/reuniones', cuando: Date.parse(r.inicio) });
    else if (Date.parse(r.inicio) >= semana && r.estado === 'no_asistio') items.push({ estado: 'riesgo', titulo: quien, detalle: `No asistió el ${diaCorto(r.inicio)}`, a, cuando: Date.parse(r.inicio) });
    else if (Date.parse(r.inicio) >= semana && r.resultado === 'cerro') items.push({ estado: 'hecha', titulo: quien, detalle: `Cerró el ${diaCorto(r.inicio)}`, a, cuando: -Date.parse(r.inicio) });
  }
  return items;
}

function deClientes(m: IntegranteEquipo, d: DatosPersonas): Item[] {
  const items: Item[] = [];
  const ahora = Date.now();
  for (const c of d.clientes.filter((x) => x.responsable_id === m.id && x.estado_firma !== 'Baja')) {
    const a = `/portal/crm/${c.id}`;
    const fin = finDelContrato(c.fecha_onboarding, c.servicio ? d.duraciones[c.servicio] : null);
    const dias = fin ? Math.round((fin.getTime() - ahora) / DIA) : null;
    const prox = d.reuniones.filter((r) => r.cliente_id === c.id && r.estado === 'agendada' && !yaPaso(r)).sort((x, y) => x.inicio.localeCompare(y.inicio))[0];
    const diaOnb = c.fecha_onboarding ? Math.floor((ahora - Date.parse(c.fecha_onboarding)) / DIA) : null;
    if ((c.cuotas_vencidas ?? 0) > 0) items.push({ estado: 'riesgo', titulo: c.nombre, detalle: c.cuotas_vencidas === 1 ? 'Cuota vencida' : `${c.cuotas_vencidas} cuotas vencidas`, a });
    else if (dias !== null && dias >= 0 && dias <= 45) items.push({ estado: 'riesgo', titulo: c.nombre, detalle: dias === 0 ? 'Vence hoy' : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`, a, cuando: dias });
    else if (c.estado_firma === 'Pendiente' || c.estado_firma === 'En firma') items.push({ estado: 'pendiente', titulo: c.nombre, detalle: 'Firma pendiente', a });
    else if (diaOnb !== null && diaOnb >= 0 && diaOnb < 14) items.push({ estado: 'curso', titulo: c.nombre, detalle: `Onboarding, día ${diaOnb + 1} de 14`, a });
    else if (prox) items.push({ estado: 'agendada', titulo: c.nombre, detalle: `${prox.tipo ? TIPO_REUNION[prox.tipo] : 'Reunión'} ${diaHora(prox.inicio)}`, a, cuando: Date.parse(prox.inicio) });
    else items.push({ estado: 'riesgo', titulo: c.nombre, detalle: 'Sin reunión agendada', a, cuando: 999 });
  }
  return items;
}

/** Objetivos de la persona: los suyos y los de su rol, con su avance. */
export function objetivosDe(m: IntegranteEquipo, objetivos: Objetivo[], avances: Avance[]): { o: Objetivo; avance: number }[] {
  const hoy = new Date().toISOString().slice(0, 10);
  return objetivos
    .filter((o) => o.activo && o.desde <= hoy && o.hasta >= hoy && ((o.alcance === 'persona' && o.miembro_id === m.id) || (o.alcance === 'rol' && o.rol_comercial === m.rol_comercial)))
    .map((o) => {
      const propio = avances.find((x) => x.objetivo_id === o.id && x.miembro_id === m.id) ?? avances.find((x) => x.objetivo_id === o.id && !x.miembro_id);
      return { o, avance: propio?.avance ?? 0 };
    });
}

const numeroCorto = (n: number) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 });

export function entreManos(m: IntegranteEquipo, d: DatosPersonas, objetivos: Objetivo[]): Item[] {
  const propias = d.reuniones.filter((r) => r.miembro_id === m.id || (m.rol_comercial === 'setter' && r.agendada_por === m.id));
  const items: Item[] = [
    ...(esAccount(m) ? deClientes(m, d) : []),
    // Del Account Manager ya están sus clientes: de sus reuniones se suma solo lo que falta completar.
    ...deReuniones(propias, d.clientes).filter((x) => !esAccount(m) || x.estado === 'pendiente'),
    ...objetivosDe(m, objetivos, d.avances).map(({ o, avance }) => ({
      estado: (avance >= o.meta ? 'hecha' : 'curso') as EstadoItem,
      titulo: o.titulo,
      detalle: `${numeroCorto(avance)} de ${numeroCorto(o.meta)}`,
      a: '/portal/equipo/objetivos',
    })),
  ];
  return items.sort((x, y) => ORDEN_ESTADO[x.estado] - ORDEN_ESTADO[y.estado] || (x.cuando ?? 0) - (y.cuando ?? 0));
}

/* ------------------------------------------------------------------ */
/* Números según el rol y rendimiento                                  */
/* ------------------------------------------------------------------ */
export interface Numeros {
  cifras: [string, string][];
  /** De 0 a 1, o null si todavía no hay con qué medir. */
  rendimiento: number | null;
  semana: number;
}

const pct = (x: number | null) => (x === null ? '·' : `${Math.round(x * 100)}%`);

export function numerosDe(m: IntegranteEquipo, d: DatosPersonas, objetivos: Objetivo[]): Numeros {
  const propias = d.reuniones.filter((r) => r.miembro_id === m.id);
  const pasadas = propias.filter((r) => yaPaso(r));
  const { desde, hasta } = semanaDe(new Date());
  const semana = propias.filter((r) => r.estado !== 'cancelada' && Date.parse(r.inicio) >= desde.getTime() && Date.parse(r.inicio) < hasta.getTime()).length;
  const asis = asistencia(pasadas);
  const obs = objetivosDe(m, objetivos, d.avances);
  const textoSemana = `${semana} ${semana === 1 ? 'reunión' : 'reuniones'}`;
  let cifras: [string, string][];
  if (esAccount(m)) {
    const clientes = d.clientes.filter((c) => c.responsable_id === m.id && c.estado_firma !== 'Baja').length;
    cifras = [
      ['Clientes', String(clientes)],
      ['Asistencia a seguimientos', pct(asistencia(pasadas.filter((r) => r.tipo === 'seguimiento')).tasa)],
      ['Esta semana', textoSemana],
    ];
  } else if (m.rol_comercial === 'closer') {
    cifras = [
      ['Asistencia', pct(asis.tasa)],
      ['Cierre', pct(cierre(pasadas).tasa)],
      ['Esta semana', textoSemana],
    ];
  } else if (m.rol_comercial === 'setter') {
    const agendadas = d.reuniones.filter((r) => r.agendada_por === m.id && yaPaso(r));
    cifras = [
      ['Agendó', String(d.reuniones.filter((r) => r.agendada_por === m.id).length)],
      ['Asistencia de lo agendado', pct(asistencia(agendadas).tasa)],
      ['Esta semana', textoSemana],
    ];
  } else {
    const mes = new Date().toISOString().slice(0, 7);
    const victorias = d.victorias.filter((v) => v.miembro_id === m.id && v.estado === 'validada' && v.fecha.startsWith(mes)).length;
    cifras = [
      ['Victorias del mes', String(victorias)],
      ['Objetivos cumplidos', obs.length ? `${obs.filter((x) => x.avance >= x.o.meta).length} de ${obs.length}` : '·'],
      ['Esta semana', textoSemana],
    ];
  }
  // Rendimiento: promedio de la asistencia y del avance de cada objetivo (cada uno hasta 100%).
  const partes = [...(asis.tasa !== null ? [asis.tasa] : []), ...obs.map((x) => Math.min(1, x.o.meta ? x.avance / x.o.meta : 0))];
  const rendimiento = partes.length ? partes.reduce((s, x) => s + x, 0) / partes.length : null;
  return { cifras, rendimiento, semana };
}

export const tonoRendimiento = (x: number | null) => (x === null ? 'var(--color-borde)' : x >= 0.7 ? '#3f7a5f' : x >= 0.4 ? '#b7791f' : 'var(--color-peligro)');

/* ------------------------------------------------------------------ */
/* Riesgo legal del vínculo                                            */
/* ------------------------------------------------------------------ */
export interface RiesgoLegal {
  puntaje: number;
  nivel: 'bajo' | 'medio' | 'alto';
  motivos: string[];
}

/**
 * Puntaje orientativo de qué tanto puede leerse la relación como laboral o
 * quedar sin respaldo. Suma por señales que el portal ya conoce.
 */
export function riesgoLegalDe(m: IntegranteEquipo, d: DatosPersonas, reportes: Reporte[]): RiesgoLegal {
  const motivos: string[] = [];
  let puntaje = 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const sobres = d.sobres.filter((s) => s.equipo_miembro_id === m.id);
  const docs = d.docs.filter((x) => x.equipo_miembro_id === m.id);
  const firmado = sobres.some((s) => s.estado === 'completado') || docs.length > 0;
  const vencimientos = [...sobres.filter((s) => s.estado === 'completado').map((s) => s.contrato_vence_el), ...docs.map((x) => x.contrato_vence_el)].filter((x): x is string => Boolean(x)).sort();
  const vence = vencimientos[vencimientos.length - 1];
  if (!firmado && sobres.some((s) => s.estado === 'en_curso')) {
    puntaje += 30;
    motivos.push('El contrato se mandó a firmar y todavía no está firmado.');
  } else if (!firmado) {
    puntaje += 50;
    motivos.push('No tiene un contrato firmado en el portal.');
  }
  if (vence) {
    const dias = Math.round((Date.parse(`${vence}T00:00:00`) - hoy.getTime()) / DIA);
    if (dias < 0) {
      puntaje += 30;
      motivos.push(`El contrato venció hace ${-dias} ${-dias === 1 ? 'día' : 'días'} y sigue trabajando.`);
    } else if (dias <= 30) {
      puntaje += 10;
      motivos.push(`El contrato vence en ${dias} ${dias === 1 ? 'día' : 'días'}.`);
    }
  }
  if (reportes.some((r) => r.activo && r.frecuencia === 'diaria' && r.rol_comercial === m.rol_comercial)) {
    puntaje += 15;
    motivos.push('Su rol tiene un reporte diario. Si se exige como control de jornada, puede leerse como subordinación.');
  }
  puntaje = Math.min(100, puntaje);
  if (!motivos.length) motivos.push('Contrato firmado y vigente, sin señales de control de jornada.');
  return { puntaje, nivel: puntaje >= 60 ? 'alto' : puntaje >= 30 ? 'medio' : 'bajo', motivos };
}

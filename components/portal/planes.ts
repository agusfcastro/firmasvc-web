import { supabase } from './supabase';

/**
 * Plan de cada empresa y lo que incluye en el portal: tiempo de agenda y
 * documentos firmados. Las cuentas las hace la base (migración 0022) con
 * agenda_uso y firmas_uso, así la pantalla y las reglas dicen lo mismo.
 */

export type Plan = 'gold' | 'black' | 'eminent';

export const ROTULO_PLAN: Record<Plan, string> = { gold: 'Gold', black: 'Black', eminent: 'Eminent' };

/** Lo que incluye cada plan, para el panel de FIRMA. */
export const INCLUYE_PLAN: Record<Plan, string> = {
  gold: '60 minutos de agenda por mes y 20 documentos firmados por mes',
  black: '60 minutos de agenda por semana y 50 documentos firmados por mes',
  eminent: 'Agenda y firmas sin límite',
};

export const WHATSAPP_FIRMA = 'https://wa.me/5491124617035';
export const whatsapp = (texto: string) => `${WHATSAPP_FIRMA}?text=${encodeURIComponent(texto)}`;

export interface UsoAgenda {
  plan: Plan | null;
  /** null es sin límite. */
  incluido_min: number | null;
  usado_min: number;
  desde: string | null;
  hasta: string | null;
}

export interface UsoFirmas {
  plan: Plan | null;
  /** null es sin límite. */
  limite: number | null;
  /** Firmados en el mes. */
  usados: number;
  /** Envíos que siguen abiertos: reservan su lugar en el cupo. */
  en_curso?: number;
  desde: string;
  hasta: string;
}

/** null si no se pudo consultar, por ejemplo con la migración 0022 sin correr. */
export async function usoAgenda(orgId: string): Promise<UsoAgenda | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('agenda_uso', { org: orgId });
  if (error || !Array.isArray(data) || !data[0]) return null;
  return data[0] as UsoAgenda;
}

export async function usoFirmas(orgId: string): Promise<UsoFirmas | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('firmas_uso', { org: orgId });
  if (error || !Array.isArray(data) || !data[0]) return null;
  return data[0] as UsoFirmas;
}

export const agendaAgotada = (u: UsoAgenda | null): boolean => Boolean(u && u.incluido_min !== null && u.usado_min >= u.incluido_min);
/** Cupo ocupado: los firmados del mes más los envíos que siguen abiertos. */
export const firmasOcupadas = (u: UsoFirmas): number => u.usados + (u.en_curso ?? 0);
export const firmasAgotadas = (u: UsoFirmas | null): boolean => Boolean(u && u.limite !== null && firmasOcupadas(u) >= u.limite);

/** Fecha sin hora (AAAA-MM-DD) como 1 de noviembre. */
export function diaYMes(d: string | null): string {
  if (!d) return '';
  const [a, m, dia] = d.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dia, 12)).toLocaleDateString('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'long' });
}

/** «este mes» o «esta semana», según el plan. */
export const periodoAgenda = (plan: Plan | null): string => (plan === 'black' ? 'esta semana' : 'este mes');

/** 90 minutos como 1 h 30 min. */
export function duracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
}

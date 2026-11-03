/**
 * Acceso vigente de un usuario de un cliente a su negocio activo: perfil,
 * negocio y membresía activos. Lo resuelve la base con acceso_vigente(), la
 * misma regla que aplican las políticas. Las funciones lo llaman después de
 * validar el token y antes de operar. Los admin de FIRMA no tienen membresías
 * y no lo usan.
 * La carpeta empieza con guion bajo para que Vercel no la tome como función.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SIN_ACCESO = 'Tu empresa no tiene acceso activo.';
export const SIN_CLIENTE_USUARIO = 'El servidor no tiene configurada la clave pública de Supabase.';

/**
 * Cliente de Supabase con el token de quien hace el pedido. Lo que lee y
 * escribe pasa por las políticas, igual que en el portal: si no lo puede ver
 * en pantalla, tampoco por la API. Las funciones lo usan para traer lo que
 * pide el usuario (un asunto, un envío, un cliente, un abono) y dejan la
 * clave de servicio para lo que de verdad saltea permisos: mails de otras
 * personas, registros del sistema, archivos y servicios externos.
 * null si falta la URL o la clave pública, o si el pedido no trae token.
 */
export function clienteDelUsuario(request: Request): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!url || !clave || !token) return null;
  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { authorization: `Bearer ${token}` } },
  });
}

export async function accesoVigente(sb: SupabaseClient, usuario: string): Promise<boolean> {
  const { data, error } = await sb.rpc('acceso_vigente', { p_usuario: usuario });
  return !error && typeof data === 'string';
}

export interface Integrante {
  id: string;
  email: string;
  nombre: string | null;
  rol: string;
  organizacion_id: string;
  areas: string[];
}

/**
 * Personas de uno o más negocios con alguno de esos roles, por sus membresías
 * activas y con la cuenta activa. Una persona de dos negocios aparece en los
 * dos, aunque hoy esté trabajando en otro.
 */
export async function genteDe(sb: SupabaseClient, orgIds: string[], roles: string[]): Promise<Integrante[]> {
  if (!orgIds.length) return [];
  const { data: ms } = await sb.from('membresias').select('usuario_id, organizacion_id, rol, areas, creado_en').in('organizacion_id', orgIds).in('rol', roles).eq('activa', true).order('creado_en');
  const membresias = (ms ?? []) as { usuario_id: string; organizacion_id: string; rol: string; areas: string[] | null }[];
  const ids = [...new Set(membresias.map((m) => m.usuario_id))];
  if (!ids.length) return [];
  const { data: ps } = await sb.from('perfiles').select('id, email, nombre').in('id', ids).eq('activo', true);
  const porId = new Map(((ps ?? []) as { id: string; email: string; nombre: string | null }[]).map((p) => [p.id, p]));
  return membresias.flatMap((m) => {
    const p = porId.get(m.usuario_id);
    return p ? [{ id: p.id, email: p.email, nombre: p.nombre, rol: m.rol, organizacion_id: m.organizacion_id, areas: m.areas ?? [] }] : [];
  });
}

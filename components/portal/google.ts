/**
 * Google Calendar desde el portal (migración 0080 y /api/google/calendario).
 * Cada persona conecta su propio calendario en cada negocio. El portal solo
 * ve quién está conectado; los tokens los maneja el servidor.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface ConexionGoogle {
  id: string;
  organizacion_id: string;
  miembro_id: string;
  usuario_id: string;
  email: string;
  estado: 'activa' | 'revocada' | 'error';
  error: string | null;
}

export interface EventoGoogle {
  id: string;
  miembro_id: string;
  titulo: string;
  inicio: string | null;
  fin: string | null;
  todo_el_dia: boolean;
  libre: boolean;
  enlace: string | null;
}

export async function pedirGoogle<T>(accion: string, cuerpo: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('El portal no está configurado.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Tenés que ingresar al portal.');
  const r = await fetch('/api/google/calendario', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ accion, ...cuerpo }),
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || 'No se pudo hablar con Google.');
  return j;
}

/** Lleva a Google para que quien usa el portal conecte su calendario en este negocio. */
export async function conectarGoogle(orgId: string): Promise<void> {
  const { url } = await pedirGoogle<{ url: string }>('url', { org: orgId });
  window.location.assign(url);
}

export function useConexionesGoogle(orgId: string | null | undefined) {
  const [conexiones, setConexiones] = useState<ConexionGoogle[]>([]);
  const recargar = useCallback(async () => {
    if (!supabase || !orgId) return;
    const { data, error } = await supabase
      .from('google_conexiones')
      .select('id, organizacion_id, miembro_id, usuario_id, email, estado, error')
      .eq('organizacion_id', orgId);
    // Sin la migración 0080 la tabla no existe: nadie aparece conectado.
    setConexiones(error ? [] : ((data ?? []) as ConexionGoogle[]));
  }, [orgId]);
  useEffect(() => {
    void recargar();
  }, [recargar]);
  const activas = new Set(conexiones.filter((c) => c.estado === 'activa').map((c) => c.miembro_id));
  return { conexiones, activas, recargar };
}

/** Lo que dice la vuelta de Google en la dirección (?google=...), para avisar en pantalla. */
export function avisoDeGoogle(): { tipo: 'ok' | 'error'; texto: string } | null {
  const v = new URLSearchParams(window.location.search).get('google');
  if (!v) return null;
  const textos: Record<string, { tipo: 'ok' | 'error'; texto: string }> = {
    ok: { tipo: 'ok', texto: 'Listo, tu Google Calendar quedó conectado. El equipo ya ve tu agenda y te pueden agendar con link de Meet.' },
    cancelado: { tipo: 'error', texto: 'No se conectó el calendario porque se canceló en Google.' },
    'sin-permiso': { tipo: 'error', texto: 'Google no dio permiso para el calendario. Volvé a conectar y dejá tildada la opción del calendario.' },
    vencido: { tipo: 'error', texto: 'El pedido de conexión venció o se abrió en otro navegador. Probá de nuevo desde acá.' },
    'sin-configurar': { tipo: 'error', texto: 'Google todavía no está configurado en el portal.' },
    error: { tipo: 'error', texto: 'No se pudo conectar el calendario. Probá de nuevo en un rato.' },
  };
  return textos[v] ?? null;
}

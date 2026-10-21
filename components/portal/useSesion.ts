import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Organizacion, Perfil } from './tipos';

export interface EstadoSesion {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
  organizacion: Organizacion | null;
  /** true cuando entró desde un enlace de invitación o de recuperación */
  vieneDeEnlace: boolean;
  terminarEnlace: () => void;
  recargar: () => Promise<void>;
}

function hashDeEnlace(): boolean {
  const h = window.location.hash;
  return /type=(invite|recovery|signup|magiclink)/.test(h);
}

export function useSesion(): EstadoSesion {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [organizacion, setOrganizacion] = useState<Organizacion | null>(null);
  const [vieneDeEnlace, setVieneDeEnlace] = useState(hashDeEnlace);

  const cargarPerfil = useCallback(async (s: Session | null) => {
    if (!supabase || !s) {
      setPerfil(null);
      setOrganizacion(null);
      return;
    }
    const { data: p } = await supabase.from('perfiles').select('*').eq('id', s.user.id).maybeSingle();
    setPerfil((p as Perfil) ?? null);
    if (p?.organizacion_id) {
      const { data: o } = await supabase.from('organizaciones').select('*').eq('id', p.organizacion_id).maybeSingle();
      setOrganizacion((o as Organizacion) ?? null);
    } else {
      setOrganizacion(null);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setCargando(false);
      return;
    }
    let vivo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return;
      setSesion(data.session);
      await cargarPerfil(data.session);
      if (vivo) setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSesion(s);
      if (evento === 'PASSWORD_RECOVERY') setVieneDeEnlace(true);
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') {
        // Fuera del callback para no bloquear el cliente de Supabase.
        setTimeout(() => {
          void cargarPerfil(s);
        }, 0);
      }
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [cargarPerfil]);

  const recargar = useCallback(async () => {
    await cargarPerfil(sesion);
  }, [cargarPerfil, sesion]);

  const terminarEnlace = useCallback(() => setVieneDeEnlace(false), []);

  return { cargando, sesion, perfil, organizacion, vieneDeEnlace, terminarEnlace, recargar };
}

/** Llama a la API de administración con el token de la sesión actual. */
export interface RespuestaAdmin {
  ok: boolean;
  error?: string;
  /** Enlace de acceso para mandar a mano cuando no sale el mail */
  enlace?: string | null;
  motivo?: string | null;
}

export async function llamarApiAdmin(cuerpo: Record<string, unknown>): Promise<RespuestaAdmin> {
  if (!supabase) return { ok: false, error: 'Portal sin configurar.' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'Tu sesión venció. Volvé a ingresar.' };
  try {
    const r = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
    const j = (await r.json().catch(() => ({}))) as Omit<RespuestaAdmin, 'ok'>;
    if (!r.ok) return { ok: false, error: j.error || `Error ${r.status}` };
    return { ok: true, enlace: j.enlace ?? null, motivo: j.motivo ?? null };
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor.' };
  }
}

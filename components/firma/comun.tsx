import React, { useEffect } from 'react';
import { Logo } from '../Logo';

/**
 * Piezas de las páginas públicas de firma electrónica (/firmar y /verificar).
 * No usan la sesión del portal: quien firma no tiene cuenta.
 */

/** Sin datos cuando ok es false. El tsconfig no es estricto, así que no se usa una unión. */
export interface Respuesta<T> {
  ok: boolean;
  datos?: T;
  error?: string;
  status?: number;
}

export async function llamarFirma<T>(cuerpo: Record<string, unknown>): Promise<Respuesta<T>> {
  try {
    const r = await fetch('/api/firma/firmar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const j = (await r.json().catch(() => ({}))) as T & { error?: string };
    if (!r.ok) return { ok: false, error: j.error || `Error ${r.status}`, status: r.status };
    return { ok: true, datos: j, status: r.status };
  } catch {
    return { ok: false, error: 'No hay conexión. Revisá internet y probá de nuevo.', status: 0 };
  }
}

/** Título de la pestaña y sin indexar, como el portal. */
export function usePaginaPrivada(titulo: string) {
  useEffect(() => {
    const previo = document.title;
    document.title = titulo;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.title = previo;
      meta.remove();
    };
  }, [titulo]);
}

/** conBarra deja lugar abajo para una barra fija, así no tapa el pie. */
export const MarcoPublico: React.FC<{ children: React.ReactNode; eyebrow?: string; conBarra?: boolean }> = ({ children, eyebrow = 'Firma electrónica', conBarra = false }) => (
  <div className={`min-h-screen bg-marfil text-tinta flex flex-col ${conBarra ? 'pb-[76px] tab:pb-[84px]' : ''}`}>
    <header className="bg-marfil" style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}>
      <div className="wrap flex items-center justify-between gap-6 h-20">
        <a href="/" aria-label="Ir a firmasvc.com">
          <Logo className="h-[40px] desk:h-[48px] max-w-[52vw]" />
        </a>
        <span className="eyebrow text-piedra text-[11px] hidden tab:block">{eyebrow}</span>
      </div>
    </header>
    <main className="flex-1">{children}</main>
    <footer className="bg-carbon text-calido">
      <div className="wrap py-7 flex flex-wrap items-center justify-between gap-4 text-sm">
        <Logo variant="oscuro" className="h-8" />
        <span>Firma electrónica de FIRMA · Castro &amp; Partners</span>
        <a href="/verificar" className="hover:text-marfil transition-colors duration-150">
          Verificar un documento
        </a>
      </div>
    </footer>
  </div>
);

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' });
}

export const ESTADO_FIRMANTE: Record<string, { texto: string; tono: 'bosque' | 'piedra' | 'alerta' | 'tinta' }> = {
  pendiente: { texto: 'Esperando turno', tono: 'piedra' },
  notificado: { texto: 'Pendiente', tono: 'piedra' },
  visto: { texto: 'Lo abrió', tono: 'tinta' },
  firmado: { texto: 'Firmó', tono: 'bosque' },
  rechazado: { texto: 'Rechazó', tono: 'alerta' },
};

export const ESTADO_SOBRE: Record<string, { texto: string; tono: 'bosque' | 'piedra' | 'alerta' | 'tinta' }> = {
  en_curso: { texto: 'En curso', tono: 'tinta' },
  completado: { texto: 'Firmado por todos', tono: 'bosque' },
  rechazado: { texto: 'Rechazado', tono: 'alerta' },
  anulado: { texto: 'Anulado', tono: 'piedra' },
  vencido: { texto: 'Vencido', tono: 'piedra' },
};

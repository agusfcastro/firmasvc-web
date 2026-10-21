import React, { useEffect, useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { supabase } from '../supabase';

/**
 * Borrador del contrato en Drive. El servidor arma el .docx con Claude a
 * partir del modelo del servicio y lo deja en la carpeta de revisión de la
 * empresa (api/crm/borrador). Acá solo se pide y se muestra el estado.
 */

export type EstadoBorrador = 'generando' | 'listo' | 'revisar' | 'error' | 'sin_modelo' | 'sin_carpeta';

export interface Borrador {
  cliente_id: string;
  estado: EstadoBorrador;
  drive_url: string | null;
  avisos: string[];
  error: string | null;
  generado_en: string;
}

const MENSAJE: Record<EstadoBorrador, string> = {
  generando: 'Claude está armando el contrato. Tarda uno o dos minutos.',
  listo: 'Está en la carpeta de revisión de Drive.',
  revisar: 'Está en la carpeta de revisión de Drive, con puntos para revisar.',
  error: 'No se pudo armar el contrato.',
  sin_modelo: 'Este servicio todavía no tiene modelo de contrato. FIRMA lo carga en Servicios.',
  sin_carpeta: 'Falta la carpeta de revisión de Drive de la empresa. FIRMA la configura en Administración › Clientes.',
};

// Si quedó "generando" más de 6 minutos, la función se cortó y se puede reintentar.
const COLGADO_MS = 6 * 60 * 1000;

export async function generarBorrador(clienteId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Portal sin configurar.' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'Tu sesión venció. Volvé a ingresar.' };
  try {
    const r = await fetch('/api/crm/borrador', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ cliente_id: clienteId }),
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return { ok: false, error: j.error || `Error ${r.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor.' };
  }
}

/**
 * Bloque para el panel oscuro de la ficha. recienCreado indica que el alta ya pidió el borrador,
 * así que mientras no aparezca en la base se muestra como en curso.
 */
export const BorradorContrato: React.FC<{ clienteId: string; soloLectura: boolean; recienCreado?: boolean; etiqueta: (t: string) => React.ReactNode }> = ({
  clienteId,
  soloLectura,
  recienCreado = false,
  etiqueta,
}) => {
  const [b, setB] = useState<Borrador | null>(null);
  const [desde] = useState(() => Date.now());
  const [pidiendo, setPidiendo] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  async function cargar() {
    if (!supabase) return;
    const { data } = await supabase.from('crm_borradores').select('cliente_id, estado, drive_url, avisos, error, generado_en').eq('cliente_id', clienteId).maybeSingle();
    setB((data as Borrador) ?? null);
  }

  useEffect(() => {
    void cargar();
  }, [clienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const generandoAhora =
    (b?.estado === 'generando' && Date.now() - new Date(b.generado_en).getTime() < COLGADO_MS) || (!b && recienCreado && Date.now() - desde < COLGADO_MS);

  // Mientras se arma, se vuelve a mirar cada 5 segundos.
  useEffect(() => {
    if (!generandoAhora) return;
    const t = window.setInterval(() => void cargar(), 5000);
    return () => window.clearInterval(t);
  }, [generandoAhora]); // eslint-disable-line react-hooks/exhaustive-deps

  async function armar() {
    setPidiendo(true);
    setFalla(null);
    setB((x) => (x ? { ...x, estado: 'generando', generado_en: new Date().toISOString() } : x));
    const r = await generarBorrador(clienteId);
    setPidiendo(false);
    if (!r.ok) setFalla(r.error ?? 'Error');
    await cargar();
  }

  const ocupado = pidiendo || generandoAhora;
  const avisos = Array.isArray(b?.avisos) ? b!.avisos : [];

  return (
    <div>
      {etiqueta('Borrador del contrato')}
      {b?.drive_url && !ocupado && (
        <a href={b.drive_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium underline underline-offset-4 hover:no-underline">
          Abrir en Drive <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      <p className="text-sm text-calido mt-2">
        {ocupado ? MENSAJE.generando : b ? (b.estado === 'error' && b.error ? `${MENSAJE.error} ${b.error}` : b.estado === 'generando' ? 'El armado anterior se cortó. Volvé a pedirlo.' : MENSAJE[b.estado]) : 'Todavía no se armó.'}
      </p>
      {falla && !ocupado && b?.estado !== 'error' && <p className="text-sm text-[#f0b4a8] mt-2">{falla}</p>}
      {!ocupado && avisos.length > 0 && (b?.estado === 'listo' || b?.estado === 'revisar') && (
        <ul className="mt-3 flex flex-col gap-1.5 text-xs text-calido list-disc pl-4">
          {avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      {!soloLectura && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void armar()}
          className="mt-4 inline-flex items-center gap-2 h-11 px-5 bg-marfil text-tinta text-sm font-medium transition-colors duration-150 hover:bg-white disabled:opacity-60"
        >
          <RotateCcw size={15} aria-hidden="true" /> {ocupado ? 'Armando…' : b?.drive_url ? 'Volver a armar' : 'Armar contrato'}
        </button>
      )}
    </div>
  );
};

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bell, BellOff, BellRing, CheckCheck, X } from 'lucide-react';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { activarPush, desactivarPush, estadoPush, type EstadoPush } from '../push';

/**
 * Centro de avisos: la campana del portal, con el historial de lo que se le
 * avisó a la persona (tabla avisos, migración 0066). Cada aviso push que manda
 * el servidor queda también acá, así no se pierde si el push no llegó o si
 * nunca se activaron los avisos en el dispositivo.
 *
 * El estado vive fuera de los componentes: el marco del portal se vuelve a
 * montar en cada sección y hay más de una campana (barra lateral y celular).
 */
export interface AvisoPortal {
  id: number;
  titulo: string;
  cuerpo: string;
  url: string;
  creado_en: string;
  leido_en: string | null;
}

interface Estado {
  avisos: AvisoPortal[];
  /** null hasta la primera carga. */
  cargado: boolean;
  /** La tabla todavía no existe o no se pudo leer: la campana queda solo para los avisos del dispositivo. */
  disponible: boolean;
  abierto: boolean;
}

const MAXIMO = 40;
const FRESCO_MS = 30_000;

let estado: Estado = { avisos: [], cargado: false, disponible: true, abierto: false };
let ultimaCarga = 0;
let cargando: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function cambiar(parte: Partial<Estado>) {
  estado = { ...estado, ...parte };
  oyentes.forEach((f) => f());
}

const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
};

/** Trae los últimos avisos. Con forzar, aunque se hayan pedido hace poco. */
export function refrescarAvisos(forzar = false): Promise<void> {
  if (!supabase) return Promise.resolve();
  if (cargando) return cargando;
  if (!forzar && estado.cargado && Date.now() - ultimaCarga < FRESCO_MS) return Promise.resolve();
  const sb = supabase;
  cargando = (async () => {
    const { data, error } = await sb.from('avisos').select('id, titulo, cuerpo, url, creado_en, leido_en').order('creado_en', { ascending: false }).limit(MAXIMO);
    ultimaCarga = Date.now();
    // Sin la tabla (migración sin correr) no se muestra un error: la campana queda sin historial.
    if (error) cambiar({ cargado: true, disponible: /fetch|network/i.test(error.message) ? estado.disponible : false });
    else cambiar({ avisos: (data ?? []) as AvisoPortal[], cargado: true, disponible: true });
  })().finally(() => {
    cargando = null;
  });
  return cargando;
}

async function marcarLeidos(ids: number[]) {
  if (!supabase || !ids.length) return;
  const ahora = new Date().toISOString();
  // Primero en pantalla; si la base no lo guarda, la próxima carga lo corrige.
  cambiar({ avisos: estado.avisos.map((a) => (ids.includes(a.id) ? { ...a, leido_en: ahora } : a)) });
  await supabase.from('avisos').update({ leido_en: ahora }).in('id', ids);
}

/** Al cambiar de cuenta en este navegador, no queda nada de la anterior. */
export function vaciarAvisos(): void {
  ultimaCarga = 0;
  cambiar({ avisos: [], cargado: false, abierto: false });
}

function hace(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 60) return min <= 1 ? 'recién' : `hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return horas === 1 ? 'hace 1 hora' : `hace ${horas} horas`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' });
}

/* ------------------------------------------------------------------ */
/* Campana                                                              */
/* ------------------------------------------------------------------ */
/** Botón con el número de avisos sin leer. Va sobre fondo oscuro: la barra lateral y la barra del celular. */
export const CampanaAvisos: React.FC<{ className?: string; alAbrir?: () => void }> = ({ className = '', alAbrir }) => {
  const e = useSyncExternalStore(suscribir, () => estado);
  const sinLeer = e.avisos.filter((a) => !a.leido_en).length;

  useEffect(() => {
    void refrescarAvisos();
    const alVolver = () => document.visibilityState === 'visible' && void refrescarAvisos();
    // El service worker avisa cuando llega un push con el portal abierto.
    const alMensaje = (ev: MessageEvent) => (ev.data as { tipo?: string } | null)?.tipo === 'aviso' && void refrescarAvisos(true);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    navigator.serviceWorker?.addEventListener('message', alMensaje);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      navigator.serviceWorker?.removeEventListener('message', alMensaje);
    };
  }, []);

  const rotulo = sinLeer ? `Avisos, ${sinLeer} sin leer` : 'Avisos';
  return (
    <button
      type="button"
      onClick={() => {
        alAbrir?.();
        cambiar({ abierto: true });
        void refrescarAvisos(true);
      }}
      aria-label={rotulo}
      aria-haspopup="dialog"
      aria-expanded={e.abierto}
      title={rotulo}
      className={`relative w-10 h-10 grid place-items-center shrink-0 rounded-[10px] hover:bg-marfil/[0.06] ${sinLeer ? 'text-marfil' : 'text-lateral-tenue hover:text-marfil'} ${className}`}
    >
      <Bell size={18} aria-hidden="true" />
      {sinLeer > 0 && (
        <span aria-hidden="true" className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-pastilla bg-marfil text-tinta text-[10.5px] font-bold tabular-nums">
          {sinLeer > 9 ? '9+' : sinLeer}
        </span>
      )}
    </button>
  );
};

/* ------------------------------------------------------------------ */
/* Avisos en este dispositivo                                           */
/* ------------------------------------------------------------------ */
const Dispositivo: React.FC = () => {
  const [push, setPush] = useState<EstadoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void estadoPush().then((p) => vivo && setPush(p));
    return () => {
      vivo = false;
    };
  }, []);

  if (!push || push === 'no_soportado') return null;
  const activos = push === 'activos';

  const alternar = async () => {
    setOcupado(true);
    setError(null);
    if (activos) {
      await desactivarPush();
      setPush('apagados');
    } else {
      const r = await activarPush();
      setPush(r.estado);
      if (r.error) setError(r.error);
    }
    setOcupado(false);
  };

  const texto =
    push === 'instalar'
      ? 'En iPhone, instalá la app (Compartir › Agregar a inicio) para recibir avisos en el celular.'
      : push === 'bloqueados'
        ? 'Los avisos están bloqueados para el portal en la configuración del navegador o del celular.'
        : activos
          ? 'Este dispositivo recibe los avisos al momento.'
          : 'Este dispositivo no recibe avisos. Los ves acá cuando abrís el portal.';

  return (
    <div className="shrink-0 border-t border-borde-suave bg-marfil px-4 py-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] desk:pb-3.5">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`w-9 h-9 shrink-0 grid place-items-center rounded-full ${activos ? 'bg-tinta text-marfil' : 'bg-niebla text-tinta'}`}>
          {activos ? <BellRing size={16} /> : <BellOff size={16} />}
        </span>
        <p className="flex-1 min-w-0 text-[13px] leading-[1.4] text-piedra">{texto}</p>
        {(push === 'apagados' || activos) && (
          <button
            type="button"
            onClick={() => void alternar()}
            disabled={ocupado}
            className={`shrink-0 h-9 px-3.5 rounded-[10px] text-[13.5px] font-semibold disabled:opacity-50 ${activos ? 'border border-borde-suave bg-papel hover:border-tinta' : 'bg-tinta text-marfil hover:bg-grafito'}`}
          >
            {ocupado ? '…' : activos ? 'Apagar' : 'Activar'}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-peligro-fuerte">
          {error}
        </p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Panel                                                                */
/* ------------------------------------------------------------------ */
/** Se monta una sola vez, en el marco. En la computadora sale al lado de la barra lateral; en el celular ocupa la pantalla. */
export const PanelAvisos: React.FC = () => {
  const e = useSyncExternalStore(suscribir, () => estado);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const cerrar = () => cambiar({ abierto: false });

  useEffect(() => {
    if (!e.abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    cerrarRef.current?.focus();
    const tecla = (ev: KeyboardEvent) => ev.key === 'Escape' && cerrar();
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      previo?.focus?.();
    };
  }, [e.abierto]);

  if (!e.abierto) return null;
  const sinLeer = e.avisos.filter((a) => !a.leido_en);

  const abrir = (a: AvisoPortal) => {
    if (!a.leido_en) void marcarLeidos([a.id]);
    cerrar();
    navegar(a.url);
  };

  return (
    <div className="fixed inset-0 z-[55]" role="dialog" aria-modal="true" aria-label="Avisos">
      <button type="button" aria-label="Cerrar los avisos" tabIndex={-1} onClick={cerrar} className="absolute inset-0 bg-tinta/40 desk:bg-tinta/20" />
      <div className="absolute inset-0 desk:inset-auto desk:left-[276px] desk:bottom-4 desk:w-[400px] desk:max-h-[min(640px,calc(100vh-32px))] flex flex-col bg-papel text-tinta desk:rounded-[20px] desk:border desk:border-borde-suave desk:shadow-flotante overflow-hidden">
        <div className="shrink-0 flex items-center gap-2 pl-5 pr-3 h-[60px] border-b border-separador pt-[env(safe-area-inset-top)] box-content desk:pt-0">
          <h2 className="flex-1 font-bold text-[17px] tracking-[-0.02em]">Avisos</h2>
          {sinLeer.length > 0 && (
            <button type="button" onClick={() => void marcarLeidos(sinLeer.map((a) => a.id))} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-[10px] text-[13px] font-medium text-piedra hover:text-tinta hover:bg-niebla">
              <CheckCheck size={15} aria-hidden="true" /> Marcar todo leído
            </button>
          )}
          <button ref={cerrarRef} type="button" onClick={cerrar} aria-label="Cerrar los avisos" className="w-10 h-10 grid place-items-center rounded-[10px] text-piedra hover:text-tinta hover:bg-niebla">
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {!e.cargado ? (
            <p className="px-5 py-8 text-[14px] text-piedra" role="status">
              Cargando los avisos…
            </p>
          ) : e.avisos.length === 0 ? (
            <div className="px-5 py-10 flex flex-col items-center text-center gap-3">
              <span aria-hidden="true" className="w-11 h-11 grid place-items-center rounded-full bg-niebla text-tinta">
                <Bell size={19} />
              </span>
              <p className="font-medium">No tenés avisos</p>
              <p className="text-[14px] text-piedra max-w-[30ch]">Las novedades de tus asuntos, firmas y onboardings quedan guardadas acá por 90 días.</p>
            </div>
          ) : (
            <ul>
              {e.avisos.map((a) => (
                <li key={a.id} className="border-b border-separador last:border-b-0">
                  <a
                    href={a.url}
                    onClick={(ev) => {
                      if (ev.metaKey || ev.ctrlKey) return;
                      ev.preventDefault();
                      abrir(a);
                    }}
                    className={`flex items-start gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-marfil ${a.leido_en ? '' : 'bg-marfil/60'}`}
                  >
                    <span aria-hidden="true" className={`mt-[7px] w-2 h-2 shrink-0 rounded-full ${a.leido_en ? 'bg-transparent' : 'bg-tinta'}`} />
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className={`text-[14.5px] leading-snug ${a.leido_en ? 'font-medium' : 'font-bold'}`}>
                        {!a.leido_en && <span className="sr-only">Sin leer: </span>}
                        {a.titulo}
                      </span>
                      {a.cuerpo && <span className="text-[13.5px] leading-snug text-piedra">{a.cuerpo}</span>}
                      <span className="text-[12.5px] text-piedra mt-0.5">{hace(a.creado_en)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Dispositivo />
      </div>
    </div>
  );
};

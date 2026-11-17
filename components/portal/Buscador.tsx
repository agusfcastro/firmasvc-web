import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BookOpen, BriefcaseBusiness, CornerDownLeft, FileSignature, FileText, Search, UserRound, X, type LucideIcon } from 'lucide-react';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { SECCIONES, visibleEnPantalla } from './descargas';
import { permisosDe, veAsuntos, type Documento, type Perfil } from './tipos';

/**
 * Buscador global del portal (Cmd o Ctrl + K). Encuentra secciones, clientes
 * del CRM, asuntos, documentos y envíos a firma desde un solo lugar.
 *
 * Las consultas van con la sesión de la persona, así que la base devuelve
 * solo lo que su rol puede ver (RLS). Acá además se respeta lo que cada rol
 * ve en pantalla, igual que en cada sección.
 */

/* ------------------------------------------------------------------ */
/* Abierto o cerrado, fuera de los componentes                          */
/* ------------------------------------------------------------------ */
let abierto = false;
const oyentes = new Set<() => void>();
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
};
function poner(v: boolean) {
  if (abierto === v) return;
  abierto = v;
  oyentes.forEach((f) => f());
}
export const abrirBuscador = () => poner(true);

/** ⌘K en Mac, Ctrl K en el resto. */
export const atajoBuscador = (): string => (typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K');

/* ------------------------------------------------------------------ */
/* Resultados                                                           */
/* ------------------------------------------------------------------ */
export interface AccesoSeccion {
  a: string;
  titulo: string;
  icono: LucideIcon;
}

interface Resultado {
  clave: string;
  grupo: 'Secciones' | 'Clientes' | 'Asuntos' | 'Documentos' | 'Firmas';
  titulo: string;
  detalle?: string;
  a: string;
  icono: LucideIcon;
}

const ORDEN: Resultado['grupo'][] = ['Secciones', 'Clientes', 'Asuntos', 'Firmas', 'Documentos'];
const POR_GRUPO = 5;

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Los comodines y separadores de los filtros de la base no forman parte de lo que se busca. */
const limpiar = (t: string) => t.replace(/[%_,()\\*"']/g, ' ').replace(/\s+/g, ' ').trim();

const ESTADO_ASUNTO: Record<string, string> = { en_curso: 'En curso', espera_cliente: 'Espera respuesta del cliente', espera_tercero: 'Espera a un tercero', finalizado: 'Finalizado' };
const ESTADO_SOBRE: Record<string, string> = { en_curso: 'En curso', completado: 'Firmado', vencido: 'Vencido', anulado: 'Anulado', rechazado: 'Rechazado' };

async function buscar(q: string, perfil: Perfil, orgId: string | null): Promise<Resultado[]> {
  if (!supabase) return [];
  const sb = supabase;
  const permisos = permisosDe(perfil.rol);
  const patron = `%${q}%`;
  /** Título o código que contenga el texto. Con negocio (Ver como), solo los de ese negocio. */
  const enTabla = (tabla: string, columnas: string, campo: string, orden: string, ascendente: boolean) => {
    let consulta = sb.from(tabla).select(columnas).or(`${campo}.ilike.${patron},codigo.ilike.${patron}`);
    if (orgId) consulta = consulta.eq('organizacion_id', orgId);
    return consulta.order(orden, { ascending: ascendente }).limit(POR_GRUPO);
  };

  const [clientes, asuntos, firmas, documentos] = await Promise.all([
    permisos.crm ? enTabla('crm_clientes', 'id, nombre, codigo', 'nombre', 'nombre', true) : null,
    veAsuntos(perfil) ? enTabla('asuntos', 'id, titulo, codigo, estado', 'titulo', 'actualizado_en', false) : null,
    permisos.documentosLegales ? enTabla('firma_sobres', 'id, titulo, codigo, estado', 'titulo', 'creado_en', false) : null,
    sb.from('documentos').select('*').eq('activo', true).ilike('titulo', patron).order('titulo').limit(20),
  ]);
  // Supabase devuelve el error en vez de lanzarlo.
  if (clientes?.error || asuntos?.error || firmas?.error || documentos.error) throw new Error('busqueda');

  const lista: Resultado[] = [];
  for (const c of (clientes?.data ?? []) as unknown as { id: string; nombre: string; codigo: string | null }[]) {
    lista.push({ clave: `c-${c.id}`, grupo: 'Clientes', titulo: c.nombre, detalle: c.codigo ?? undefined, a: `/portal/crm/${c.id}`, icono: UserRound });
  }
  for (const a of (asuntos?.data ?? []) as unknown as { id: string; titulo: string; codigo: string | null; estado: string }[]) {
    lista.push({ clave: `a-${a.id}`, grupo: 'Asuntos', titulo: a.titulo, detalle: [a.codigo, ESTADO_ASUNTO[a.estado]].filter(Boolean).join(' · '), a: `/portal/asuntos/${a.id}`, icono: BriefcaseBusiness });
  }
  for (const s of (firmas?.data ?? []) as unknown as { id: string; titulo: string; codigo: string | null; estado: string }[]) {
    lista.push({ clave: `f-${s.id}`, grupo: 'Firmas', titulo: s.titulo, detalle: [s.codigo, ESTADO_SOBRE[s.estado]].filter(Boolean).join(' · '), a: `/portal/firmas/${s.id}`, icono: FileSignature });
  }
  // FIRMA, sin Ver como, ve la biblioteca común. El resto, lo mismo que en Documentos y Protocolos.
  const orgDocs = perfil.rol === 'admin' ? null : orgId;
  const docs = ((documentos.data ?? []) as Documento[]).filter((d) => visibleEnPantalla(d, perfil.rol, perfil.areas ?? [], orgDocs)).slice(0, POR_GRUPO);
  for (const d of docs) {
    const seccion = SECCIONES.find((s) => s.clave === d.seccion);
    lista.push({
      clave: `d-${d.id}`,
      grupo: 'Documentos',
      titulo: d.titulo,
      detalle: d.es_protocolo ? 'Protocolo' : seccion?.titulo,
      a: d.es_protocolo ? '/portal/protocolos' : seccion?.ruta ?? '/portal/documentos',
      icono: d.es_protocolo ? BookOpen : FileText,
    });
  }
  return lista;
}

/* ------------------------------------------------------------------ */
/* Cuadro                                                               */
/* ------------------------------------------------------------------ */
const Cuadro: React.FC<{ perfil: Perfil; orgId: string | null; secciones: AccesoSeccion[] }> = ({ perfil, orgId, secciones }) => {
  const [texto, setTexto] = useState('');
  const [encontrados, setEncontrados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [activo, setActivo] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const q = limpiar(texto);

  // Foco en el campo, Escape cierra y el fondo no se desplaza. Al cerrar, el foco vuelve a donde estaba.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    campo.current?.focus();
    const desborde = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = desborde;
      previo?.focus?.();
    };
  }, []);

  // Busca un instante después de la última tecla, y descarta las respuestas viejas.
  useEffect(() => {
    if (q.length < 2) {
      setEncontrados([]);
      setBuscando(false);
      setFallo(false);
      return;
    }
    let vigente = true;
    setBuscando(true);
    const t = window.setTimeout(() => {
      buscar(q, perfil, orgId)
        .then((r) => {
          if (!vigente) return;
          setEncontrados(r);
          setFallo(false);
        })
        .catch(() => vigente && setFallo(true))
        .finally(() => vigente && setBuscando(false));
    }, 220);
    return () => {
      vigente = false;
      window.clearTimeout(t);
    };
  }, [q, perfil, orgId]);

  const resultados = useMemo(() => {
    const n = sinTildes(q);
    const deSecciones: Resultado[] = secciones
      .filter((s) => !n || sinTildes(s.titulo).includes(n))
      .map((s) => ({ clave: `s-${s.a}`, grupo: 'Secciones', titulo: s.titulo, a: s.a, icono: s.icono }));
    return [...deSecciones, ...(q.length >= 2 ? encontrados : [])].sort((x, y) => ORDEN.indexOf(x.grupo) - ORDEN.indexOf(y.grupo));
  }, [q, secciones, encontrados]);

  useEffect(() => setActivo(0), [q, encontrados.length]);
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-indice="${activo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activo]);

  const ir = (r: Resultado) => {
    poner(false);
    navegar(r.a);
  };

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      poner(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((i) => (resultados.length ? (i + 1) % resultados.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => (resultados.length ? (i - 1 + resultados.length) % resultados.length : 0));
    } else if (e.key === 'Enter' && resultados[activo]) {
      e.preventDefault();
      ir(resultados[activo]);
    }
  };

  let indice = -1;
  return (
    <div className="portal fixed inset-0 z-[60] flex items-start justify-center desk:pt-[12vh] desk:px-6" role="dialog" aria-modal="true" aria-label="Buscar en el portal" onKeyDown={alTeclear}>
      <button type="button" aria-label="Cerrar el buscador" tabIndex={-1} onClick={() => poner(false)} className="absolute inset-0 bg-tinta/50" />
      <div className="relative w-full h-full desk:h-auto desk:max-w-[600px] desk:max-h-[70vh] flex flex-col bg-papel text-tinta desk:rounded-[20px] desk:border desk:border-borde-suave desk:shadow-flotante overflow-hidden">
        <div className="shrink-0 flex items-center gap-3 pl-5 pr-3 h-[60px] border-b border-separador pt-[env(safe-area-inset-top)] box-content desk:pt-0">
          <Search size={19} aria-hidden="true" className="shrink-0 text-piedra" />
          <input
            ref={campo}
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls="buscador-resultados"
            aria-activedescendant={resultados[activo] ? `buscador-${activo}` : undefined}
            aria-label="Buscar clientes, asuntos, documentos y firmas"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Buscar en el portal"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="flex-1 min-w-0 h-full bg-transparent text-[16px] placeholder:text-piedra/80 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <button type="button" onClick={() => poner(false)} aria-label="Cerrar el buscador" className="w-10 h-10 grid place-items-center shrink-0 rounded-[10px] text-piedra hover:text-tinta hover:bg-niebla">
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div ref={lista} id="buscador-resultados" role="listbox" aria-label="Resultados" className="flex-1 min-h-0 overflow-y-auto py-2">
          {ORDEN.map((grupo) => {
            const items = resultados.filter((r) => r.grupo === grupo);
            if (!items.length) return null;
            return (
              <div key={grupo} role="group" aria-label={grupo}>
                <p aria-hidden="true" className="px-5 pt-3 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-piedra">
                  {grupo}
                </p>
                {items.map((r) => {
                  indice += 1;
                  const i = indice;
                  const Icono = r.icono;
                  const elegido = i === activo;
                  return (
                    <a
                      key={r.clave}
                      id={`buscador-${i}`}
                      data-indice={i}
                      role="option"
                      aria-selected={elegido}
                      href={r.a}
                      tabIndex={-1}
                      onMouseMove={() => setActivo(i)}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey) return;
                        e.preventDefault();
                        ir(r);
                      }}
                      className={`mx-2 flex items-center gap-3 min-h-[48px] px-3 py-2 rounded-[12px] ${elegido ? 'bg-niebla' : ''}`}
                    >
                      <span aria-hidden="true" className={`w-8 h-8 shrink-0 grid place-items-center rounded-[10px] ${elegido ? 'bg-tinta text-marfil' : 'bg-niebla text-tinta'}`}>
                        <Icono size={16} strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col leading-snug">
                        <span className="text-[14.5px] font-medium truncate">{r.titulo}</span>
                        {r.detalle && <span className="text-[12.5px] text-piedra truncate">{r.detalle}</span>}
                      </span>
                      {elegido && <CornerDownLeft size={15} aria-hidden="true" className="hidden desk:block shrink-0 text-piedra" />}
                    </a>
                  );
                })}
              </div>
            );
          })}

          <p role="status" className="px-5 py-3 text-[13.5px] text-piedra">
            {fallo
              ? 'No pudimos buscar. Revisá tu conexión y probá de nuevo.'
              : buscando
                ? 'Buscando…'
                : q.length >= 2 && resultados.length === 0
                  ? `No encontramos nada con «${q}».`
                  : q.length < 2
                    ? 'Escribí al menos dos letras para buscar clientes, asuntos, documentos y firmas.'
                    : ''}
          </p>
        </div>

        <div className="hidden desk:flex shrink-0 items-center gap-4 px-5 h-10 border-t border-separador bg-marfil text-[12px] text-piedra">
          <span>↑ ↓ para moverte</span>
          <span>Enter para abrir</span>
          <span>Esc para cerrar</span>
        </div>
      </div>
    </div>
  );
};

/** Se monta una sola vez, en el marco. Escucha Cmd o Ctrl + K y muestra el cuadro. */
export const Buscador: React.FC<{ perfil: Perfil; orgId: string | null; secciones: AccesoSeccion[] }> = (props) => {
  const visible = useSyncExternalStore(suscribir, () => abierto);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        poner(!abierto);
      }
    };
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      // El marco se vuelve a montar al cambiar de sección: el cuadro no queda abierto de una a otra.
      poner(false);
    };
  }, []);

  return visible ? <Cuadro {...props} /> : null;
};

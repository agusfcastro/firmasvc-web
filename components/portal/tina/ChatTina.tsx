import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ExternalLink, Plus, X } from 'lucide-react';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { CaraTina } from './CaraTina';

/**
 * Panel de chat de Tina. Encima del contenido en la computadora y a pantalla
 * completa en el celular. Habla con POST /api/tina/chat, que responde líneas
 * JSON a medida que Tina escribe.
 */

type Autor = 'usuario' | 'tina';

interface Ficha {
  tipo: 'ficha';
  estado: 'borrador' | 'cargada';
  codigo?: string;
  enlace?: string;
  resumen?: {
    nombre?: string;
    email?: string | null;
    telefono?: string | null;
    servicio?: string | null;
    monto_total?: number | null;
    moneda?: string;
    modalidad?: string | null;
    cuotas?: { monto: number; vencimiento: string }[];
    fecha_onboarding?: string | null;
    faltan?: string[];
    avisos?: string[];
  };
}

interface Mensaje {
  id: string;
  autor: Autor;
  texto: string;
  /** Cada ficha con la posición del texto donde llegó, para mostrarla en orden. */
  fichas: { ficha: Ficha; en: number }[];
  error?: boolean;
}

const SUGERENCIAS = ['Cerré una venta, ¿me ayudás a cargarla?', 'Un alumno se atrasó con una cuota, ¿qué le mando?', '¿Dónde veo los contratos firmados?'];

const HERRAMIENTA: Record<string, string> = {
  buscar_recurso: 'Buscando material',
  consultar_contrato: 'Leyendo tus contratos',
  crear_ficha_cierre: 'Preparando la ficha',
  registrar_evento: 'Registrando la novedad',
  crear_ticket: 'Avisando a FIRMA',
};

const CLAVE_CONVERSACION = 'tina.conversacion';

function leerGuardada(): string | null {
  try {
    return localStorage.getItem(CLAVE_CONVERSACION);
  } catch {
    return null;
  }
}

function guardar(id: string | null) {
  try {
    if (id) localStorage.setItem(CLAVE_CONVERSACION, id);
    else localStorage.removeItem(CLAVE_CONVERSACION);
  } catch {
    // Sin almacenamiento: la conversación sigue, solo no se recuerda.
  }
}

let contador = 0;
const nuevoId = () => `m${Date.now()}-${contador++}`;

/* ------------------------------------------------------------------ */
/* Texto de Tina: párrafos, listas, negritas y enlaces, sin HTML crudo. */
/* ------------------------------------------------------------------ */
const ENLACE = /(https?:\/\/[^\s)]+[^\s).,;:!?»"'])/g;

function abrirEnlace(e: React.MouseEvent<HTMLAnchorElement>, url: string, alNavegar: () => void) {
  try {
    const u = new URL(url);
    const mismoSitio = u.origin === window.location.origin || /(^|\.)firmasvc\.com$/.test(u.hostname);
    if (mismoSitio && u.pathname.startsWith('/portal')) {
      e.preventDefault();
      alNavegar();
      navegar(u.pathname + u.search);
    }
  } catch {
    // Enlace raro: que el navegador lo resuelva.
  }
}

function enLinea(texto: string, alNavegar: () => void): React.ReactNode[] {
  const partes: React.ReactNode[] = [];
  texto.split(/(\*\*[^*]+\*\*)/g).forEach((trozo, i) => {
    if (/^\*\*[^*]+\*\*$/.test(trozo)) {
      partes.push(<strong key={`b${i}`}>{trozo.slice(2, -2)}</strong>);
      return;
    }
    trozo.split(ENLACE).forEach((t, j) => {
      if (/^https?:\/\//.test(t)) {
        const interno = /firmasvc\.com\/portal/.test(t) || t.startsWith(`${window.location.origin}/portal`);
        partes.push(
          <a
            key={`a${i}-${j}`}
            href={t}
            onClick={(e) => abrirEnlace(e, t, alNavegar)}
            {...(interno ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            className="underline underline-offset-2 break-words hover:no-underline"
          >
            {interno ? t.replace(/^https?:\/\/(www\.)?firmasvc\.com/, '').replace(window.location.origin, '') || t : t}
          </a>,
        );
      } else if (t) partes.push(<React.Fragment key={`t${i}-${j}`}>{t}</React.Fragment>);
    });
  });
  return partes;
}

const TextoTina: React.FC<{ texto: string; alNavegar: () => void }> = ({ texto, alNavegar }) => (
  <>
    {texto
      .trim()
      .split(/\n\s*\n/)
      .map((bloque, i) => {
        const lineas = bloque.split('\n');
        if (lineas.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          const ordenada = /^\s*\d/.test(lineas[0]);
          const Lista = ordenada ? 'ol' : 'ul';
          return (
            <Lista key={i} className={`${ordenada ? 'list-decimal' : 'list-disc'} pl-5 flex flex-col gap-1`}>
              {lineas.map((l, j) => (
                <li key={j}>{enLinea(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''), alNavegar)}</li>
              ))}
            </Lista>
          );
        }
        return (
          <p key={i}>
            {lineas.map((l, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {enLinea(l.replace(/^#+\s*/, ''), alNavegar)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
  </>
);

/* ------------------------------------------------------------------ */
/* Tarjeta de la ficha de cierre                                        */
/* ------------------------------------------------------------------ */
const monto = (n: number | null | undefined, moneda = 'USD') =>
  n === null || n === undefined ? null : `${moneda} ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

const TarjetaFicha: React.FC<{ ficha: Ficha; ocupado: boolean; ultima: boolean; alConfirmar: () => void; alNavegar: () => void }> = ({ ficha, ocupado, ultima, alConfirmar, alNavegar }) => {
  const r = ficha.resumen ?? {};
  const filas: [string, string | null | undefined][] = [
    ['Cliente', r.nombre],
    ['Mail', r.email],
    ['Teléfono', r.telefono],
    ['Servicio', r.servicio],
    ['Monto', monto(r.monto_total, r.moneda)],
    ['Modalidad', r.modalidad === 'PIF' ? 'Pago completo' : r.modalidad],
    ['Cuotas', r.cuotas?.length ? r.cuotas.map((c) => `${monto(c.monto, r.moneda)} el ${c.vencimiento.split('-').reverse().join('/')}`).join(' · ') : null],
    ['Onboarding', r.fecha_onboarding ? new Date(r.fecha_onboarding).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : null],
  ];
  const cargada = ficha.estado === 'cargada';
  return (
    <div className="mt-3 rounded-[16px] border border-borde-suave bg-marfil p-4 text-[14px] text-tinta">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-piedra mb-3">{cargada ? `Cliente cargado${ficha.codigo ? ` · ${ficha.codigo}` : ''}` : 'Ficha para confirmar'}</p>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1.5">
        {filas
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-piedra">{k}</dt>
              <dd className="break-words">{v}</dd>
            </React.Fragment>
          ))}
      </dl>
      {!cargada && r.faltan && r.faltan.length > 0 && <p className="mt-3 text-piedra">Faltan {r.faltan.join(', ')}.</p>}
      {!cargada && r.avisos?.map((a) => (
        <p key={a} className="mt-2 text-peligro-fuerte">
          {a}
        </p>
      ))}
      {!cargada && ultima && (
        <button
          type="button"
          onClick={alConfirmar}
          disabled={ocupado}
          className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-[12px] bg-tinta text-marfil text-[14px] font-semibold disabled:opacity-50 hover:bg-grafito"
        >
          <Check size={16} aria-hidden="true" />
          Confirmar y cargar
        </button>
      )}
      {cargada && ficha.enlace && (
        <a
          href={ficha.enlace}
          onClick={(e) => abrirEnlace(e, ficha.enlace as string, alNavegar)}
          className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-[12px] border border-borde bg-papel text-[14px] font-semibold hover:bg-niebla"
        >
          <ExternalLink size={16} aria-hidden="true" />
          Abrir la ficha
        </a>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Panel                                                                */
/* ------------------------------------------------------------------ */
const ChatTina: React.FC<{ abierto: boolean; alCerrar: () => void; nombre: string | null }> = ({ abierto, alCerrar, nombre }) => {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [conversacion, setConversacion] = useState<string | null>(leerGuardada);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [actividad, setActividad] = useState<string | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const campo = useRef<HTMLTextAreaElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Historial de la conversación guardada, o de la última si no hay ninguna guardada.
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!supabase) return setCargandoHistorial(false);
      let id = conversacion;
      if (!id) {
        const { data } = await supabase.from('tina_conversaciones').select('id').order('actualizado_en', { ascending: false }).limit(1).maybeSingle();
        id = (data?.id as string | undefined) ?? null;
      }
      if (!id) return vivo && setCargandoHistorial(false);
      const { data: filas } = await supabase.from('tina_mensajes').select('id, autor, contenido').eq('conversacion_id', id).order('id').limit(100);
      if (!vivo) return;
      if (filas && filas.length) {
        setConversacion(id);
        setMensajes((filas as { id: number; autor: Autor; contenido: string }[]).filter((f) => f.contenido.trim()).map((f) => ({ id: `h${f.id}`, autor: f.autor, texto: f.contenido, fichas: [] })));
      } else if (id === conversacion) {
        guardar(null);
        setConversacion(null);
      }
      setCargandoHistorial(false);
    })();
    return () => {
      vivo = false;
    };
    // Solo al montar: después la conversación la maneja el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al abrir, foco en el campo. Escape cierra.
  useEffect(() => {
    if (!abierto) return;
    requestAnimationFrame(() => campo.current?.focus());
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto, alCerrar]);

  // En el celular el panel ocupa la pantalla: el fondo no se desplaza.
  useEffect(() => {
    if (!abierto || window.matchMedia('(min-width: 900px)').matches) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  // Siempre al final de la conversación.
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight });
  }, [mensajes, actividad, abierto]);

  const alNavegar = useCallback(() => {
    if (!window.matchMedia('(min-width: 900px)').matches) alCerrar();
  }, [alCerrar]);

  const nueva = () => {
    if (ocupado) return;
    guardar(null);
    setConversacion(null);
    setMensajes([]);
    campo.current?.focus();
  };

  const enviar = async (contenido: string) => {
    const limpio = contenido.trim();
    if (!limpio || ocupado || !supabase) return;
    setTexto('');
    setOcupado(true);
    setActividad('Tina está escribiendo');
    const idTina = nuevoId();
    setMensajes((m) => [...m, { id: nuevoId(), autor: 'usuario', texto: limpio, fichas: [] }, { id: idTina, autor: 'tina', texto: '', fichas: [] }]);
    const cambiar = (f: (m: Mensaje) => Mensaje) => setMensajes((ms) => ms.map((m) => (m.id === idTina ? f(m) : m)));

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Tu sesión venció. Volvé a ingresar al portal.');
      const r = await fetch('/api/tina/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ mensaje: limpio, conversacion_id: conversacion }),
      });
      if (!r.ok || !r.body) {
        const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(cuerpo?.error || 'Tina no pudo responder. Probá de nuevo.');
      }
      const lector = r.body.getReader();
      const dec = new TextDecoder();
      let resto = '';
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        const lineas = resto.split('\n');
        resto = lineas.pop() ?? '';
        for (const linea of lineas) {
          if (!linea.trim()) continue;
          let ev: { tipo: string; [k: string]: unknown };
          try {
            ev = JSON.parse(linea);
          } catch {
            continue;
          }
          if (ev.tipo === 'inicio' && typeof ev.conversacion_id === 'string') {
            setConversacion(ev.conversacion_id);
            guardar(ev.conversacion_id);
          } else if (ev.tipo === 'texto' && typeof ev.delta === 'string') {
            const delta = ev.delta;
            setActividad(null);
            cambiar((m) => ({ ...m, texto: m.texto + delta }));
          } else if (ev.tipo === 'herramienta' && typeof ev.nombre === 'string') {
            setActividad(HERRAMIENTA[ev.nombre] ?? 'Trabajando');
            cambiar((m) => (m.texto && !m.texto.endsWith('\n') ? { ...m, texto: `${m.texto}\n\n` } : m));
          } else if (ev.tipo === 'tarjeta' && ev.datos && typeof ev.datos === 'object') {
            const ficha = ev.datos as Ficha;
            if (ficha.tipo === 'ficha') cambiar((m) => ({ ...m, fichas: [...m.fichas, { ficha, en: m.texto.length }] }));
          } else if (ev.tipo === 'error' && typeof ev.mensaje === 'string') {
            const msj = ev.mensaje;
            cambiar((m) => ({ ...m, texto: m.texto ? `${m.texto}\n\n${msj}` : msj, error: true }));
          }
        }
      }
    } catch (err) {
      const msj = (err as Error).message || 'Tina no pudo responder. Probá de nuevo.';
      cambiar((m) => ({ ...m, texto: m.texto ? `${m.texto}\n\n${msj}` : msj, error: true }));
    } finally {
      setOcupado(false);
      setActividad(null);
      requestAnimationFrame(() => campo.current?.focus());
    }
  };

  const ultimaFicha = (() => {
    for (let i = mensajes.length - 1; i >= 0; i--) if (mensajes[i].fichas.length) return mensajes[i].id;
    return null;
  })();

  const saludo = nombre ? `Hola, ${nombre.split(' ')[0]}.` : 'Hola.';

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-label="Chat con Tina"
      hidden={!abierto}
      className="fixed z-50 inset-0 flex flex-col bg-papel text-tinta desk:inset-auto desk:right-6 desk:bottom-6 desk:w-[420px] desk:h-[min(680px,calc(100vh-48px))] desk:rounded-[20px] desk:border desk:border-borde-suave desk:shadow-flotante overflow-hidden"
    >
      {/* Encabezado */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0 bg-tinta text-marfil pt-[env(safe-area-inset-top)] box-content">
        <CaraTina tamano={40} estado={ocupado ? 'pensando' : 'quieta'} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[16px] leading-tight">Tina</p>
          <p className="text-[12.5px] text-lateral-texto leading-tight">Asistente con IA de FIRMA</p>
        </div>
        <button type="button" onClick={nueva} disabled={ocupado} className="h-10 px-3 inline-flex items-center gap-1.5 rounded-[10px] text-[13px] hover:bg-marfil/[0.08] disabled:opacity-50">
          <Plus size={16} aria-hidden="true" />
          Nueva
        </button>
        <button type="button" onClick={alCerrar} aria-label="Cerrar el chat" className="w-10 h-10 grid place-items-center rounded-[10px] hover:bg-marfil/[0.08]">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Conversación */}
      <div ref={lista} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4 bg-marfil" aria-live="polite" aria-busy={ocupado} aria-relevant="additions text">
        {!cargandoHistorial && mensajes.length === 0 && (
          <div className="flex flex-col gap-4">
            <div className="max-w-[88%] rounded-[16px] rounded-tl-[4px] bg-papel border border-borde-suave px-4 py-3 text-[15px] leading-[1.55]">
              <p>{saludo} Soy Tina, la asistente de FIRMA. Te ayudo a cargar ventas, encontrar el material que necesitás y avisarle a tu responsable cuando hace falta un abogado.</p>
            </div>
            <div className="flex flex-col items-start gap-2">
              {SUGERENCIAS.map((s) => (
                <button key={s} type="button" onClick={() => void enviar(s)} className="text-left text-[14px] px-3.5 py-2 rounded-[12px] border border-borde bg-papel hover:bg-niebla">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensajes.map((m) =>
          m.autor === 'usuario' ? (
            <div key={m.id} className="self-end max-w-[85%] rounded-[16px] rounded-tr-[4px] bg-tinta text-marfil px-4 py-2.5 text-[15px] leading-[1.5] whitespace-pre-wrap break-words">
              <span className="sr-only">Vos: </span>
              {m.texto}
            </div>
          ) : m.texto || m.fichas.length ? (
            <div
              key={m.id}
              className={`max-w-[92%] rounded-[16px] rounded-tl-[4px] border px-4 py-3 text-[15px] leading-[1.55] flex flex-col gap-2.5 break-words ${m.error ? 'bg-peligro-suave border-peligro-borde' : 'bg-papel border-borde-suave'}`}
            >
              <span className="sr-only">Tina: </span>
              {m.fichas.map((f, i) => {
                const desde = i === 0 ? 0 : m.fichas[i - 1].en;
                const antes = m.texto.slice(desde, f.en);
                return (
                  <React.Fragment key={i}>
                    {antes.trim() && <TextoTina texto={antes} alNavegar={alNavegar} />}
                    <TarjetaFicha
                      ficha={f.ficha}
                      ocupado={ocupado}
                      ultima={m.id === ultimaFicha && i === m.fichas.length - 1}
                      alConfirmar={() => void enviar('Confirmo, cargalo.')}
                      alNavegar={alNavegar}
                    />
                  </React.Fragment>
                );
              })}
              {m.texto.slice(m.fichas.length ? m.fichas[m.fichas.length - 1].en : 0).trim() && (
                <TextoTina texto={m.texto.slice(m.fichas.length ? m.fichas[m.fichas.length - 1].en : 0)} alNavegar={alNavegar} />
              )}
            </div>
          ) : null,
        )}

        {actividad && (
          <div className="flex items-center gap-2 text-[13.5px] text-piedra" role="status">
            <CaraTina tamano={28} estado="pensando" borde />
            {actividad}…
          </div>
        )}
      </div>

      {/* Campo */}
      <form
        className="shrink-0 border-t border-borde-suave bg-papel px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(texto);
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="tina-mensaje" className="sr-only">
            Mensaje para Tina
          </label>
          <textarea
            id="tina-mensaje"
            ref={campo}
            rows={1}
            value={texto}
            maxLength={4000}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void enviar(texto);
              }
            }}
            placeholder="Escribile a Tina"
            className="flex-1 resize-none max-h-40 min-h-[44px] rounded-[12px] border border-borde bg-papel px-3.5 py-2.5 text-[16px] leading-[1.4] focus:outline-none focus:ring-2 focus:ring-tinta"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            type="submit"
            disabled={ocupado || !texto.trim()}
            aria-label="Enviar"
            className="w-11 h-11 shrink-0 grid place-items-center rounded-[12px] bg-tinta text-marfil disabled:opacity-40 hover:bg-grafito"
          >
            <ArrowUp size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-[11.5px] leading-[1.4] text-piedra">Tina es una asistente con IA. Sus respuestas son orientativas y no son asesoramiento legal.</p>
      </form>
    </div>
  );
};

export default ChatTina;

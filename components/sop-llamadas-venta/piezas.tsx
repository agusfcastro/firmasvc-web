import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import s from './sop.module.css';
import { ROTULOS } from './config';

// Contexto con los valores de la ficha para resaltar variables en cualquier texto.

export interface ContextoTexto {
  valores: Record<string, string | null>;
  macros: Record<string, string>;
}

export const TextoCtx = createContext<ContextoTexto>({ valores: {}, macros: {} });

export function expandir(texto: string, macros: Record<string, string>): string {
  let salida = texto;
  for (let i = 0; i < 3; i += 1) {
    const siguiente = salida.replace(/\{(\w+)\}/g, (m, k: string) => (k in macros ? macros[k] : m));
    if (siguiente === salida) break;
    salida = siguiente;
  }
  return salida;
}

const TOKEN = /(\{\w+\}|\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/g;

/** Renderiza un texto con variables resaltadas, datos en vivo y énfasis. */
export function Tx({ t }: { t: string }) {
  const { valores, macros } = useContext(TextoCtx);
  const partes = expandir(t, macros).split(TOKEN);
  return (
    <>
      {partes.map((p, i) => {
        if (!p) return null;
        if (p.startsWith('{') && p.endsWith('}')) {
          const clave = p.slice(1, -1);
          const valor = valores[clave];
          if (valor === undefined) return <span key={i}>{p}</span>;
          if (valor === null) {
            return (
              <span key={i} className={`${s.var} ${s.varVacia}`} title="Falta completar en la ficha del cliente">
                {ROTULOS[clave] ?? clave}
              </span>
            );
          }
          return (
            <span key={i} className={s.var} title="Dato de la ficha del cliente">
              {valor}
            </span>
          );
        }
        if (p.startsWith('[[')) {
          return (
            <span key={i} className={s.vivo} title="Se completa en vivo durante la llamada">
              {p.slice(2, -2)}
            </span>
          );
        }
        if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/** Versión en texto plano, para copiar al portapapeles. */
export function textoPlano(t: string, ctx: ContextoTexto): string {
  return expandir(t, ctx.macros)
    .replace(/\{(\w+)\}/g, (m, k: string) => {
      const v = ctx.valores[k];
      if (v === undefined) return m;
      return v ?? `[${ROTULOS[k] ?? k}]`;
    })
    .replace(/\[\[([^\]]+)\]\]/g, '[$1]')
    .replace(/\*\*([^*]+)\*\*/g, '$1');
}

export function usePlano() {
  const ctx = useContext(TextoCtx);
  return (t: string) => textoPlano(t, ctx);
}

async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Se intenta el método alternativo.
  }
  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function BotonCopiar({ texto, etiqueta = 'Copiar', variante = 'icono' }: { texto: () => string; etiqueta?: string; variante?: 'icono' | 'texto' }) {
  const [estado, setEstado] = useState<'listo' | 'ok' | 'error'>('listo');
  const accion = async () => {
    const ok = await copiarAlPortapapeles(texto());
    setEstado(ok ? 'ok' : 'error');
    window.setTimeout(() => setEstado('listo'), 1600);
  };
  const rotulo = estado === 'ok' ? 'Copiado' : estado === 'error' ? 'No se pudo copiar' : etiqueta;
  return (
    <button type="button" className={variante === 'icono' ? s.copiar : s.boton} onClick={accion} aria-label={rotulo} title={rotulo} data-estado={estado}>
      {estado === 'ok' ? <IconoCheck /> : <IconoCopiar />}
      {variante === 'texto' ? <span>{rotulo}</span> : <span className={s.soloLector}>{rotulo}</span>}
    </button>
  );
}

export function Acordeon({
  titulo,
  subtitulo,
  insignia,
  abiertoInicial = false,
  destacado = false,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  insignia?: ReactNode;
  abiertoInicial?: boolean;
  destacado?: boolean;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const id = useId();
  return (
    <div className={s.acordeon} data-abierto={abierto} data-destacado={destacado}>
      <button type="button" className={s.acordeonBoton} aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto((v) => !v)}>
        <span className={s.acordeonTitulos}>
          <span className={s.acordeonTitulo}>
            {titulo}
            {insignia}
          </span>
          {subtitulo && <span className={s.acordeonSub}>{subtitulo}</span>}
        </span>
        <IconoChevron />
      </button>
      <div id={id} className={s.acordeonPanel} hidden={!abierto}>
        {children}
      </div>
    </div>
  );
}

// Íconos mínimos en línea.

export function IconoCopiar() {
  return (
    <svg className={s.icono} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="7" y="7" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 4.5V4a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 3 4v7a1.5 1.5 0 0 0 1.5 1.5H5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconoCheck() {
  return (
    <svg className={s.icono} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoChevron() {
  return (
    <svg className={`${s.icono} ${s.chevron}`} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5.5 8l4.5 4.5L14.5 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoImprimir() {
  return (
    <svg className={s.icono} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6 7V3h8v4M6 14H4.5A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7h11A1.5 1.5 0 0 1 17 8.5v4a1.5 1.5 0 0 1-1.5 1.5H14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="6" y="11" width="8" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconoEnlace() {
  return (
    <svg className={s.icono} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconoAlerta() {
  return (
    <svg className={s.icono} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 3.5l7 12.5H3L10 3.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 8.5v3.5M10 14.2v.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

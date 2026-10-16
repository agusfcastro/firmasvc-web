// Persistencia y utilidades de la ficha. Hash de la URL para compartir,
// almacenamiento local como comodidad. Nada viaja a un servidor.

import type { DefFicha, Ficha } from './tipos';

const PREFIJO_HASH = '#ficha=';

function aBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  bytes.forEach((b) => {
    binario += String.fromCharCode(b);
  });
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(codigo: string): string {
  const base = codigo.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = base + '==='.slice((base.length + 3) % 4);
  const binario = atob(relleno);
  const bytes = Uint8Array.from(binario, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Opciones válidas por clave, tomadas de los campos de tipo opciones. */
function opcionesValidas(def: DefFicha): Record<string, string[]> {
  const mapa: Record<string, string[]> = {};
  def.grupos.forEach((g) =>
    g.campos.forEach((c) => {
      if (c.tipo === 'opciones') mapa[c.clave] = c.opciones.map((o) => o.valor);
    }),
  );
  return mapa;
}

export function normalizar(def: DefFicha, parcial: unknown): Ficha | null {
  if (!parcial || typeof parcial !== 'object') return null;
  const base: Ficha = { ...def.vacia };
  const p = parcial as Record<string, unknown>;
  const validas = opcionesValidas(def);
  Object.keys(base).forEach((k) => {
    const actual = base[k];
    const nuevo = p[k];
    if (typeof actual === 'boolean' && typeof nuevo === 'boolean') base[k] = nuevo;
    else if (typeof actual === 'string' && typeof nuevo === 'string') {
      const recortado = nuevo.slice(0, 300);
      if (validas[k] && !validas[k].includes(recortado)) return;
      base[k] = recortado;
    }
  });
  return base;
}

export function leerFichaInicial(def: DefFicha, clave: string, preset?: Partial<Ficha>): Ficha {
  const conPreset: Ficha = { ...def.vacia, ...(preset ?? {}) } as Ficha;
  if (typeof window === 'undefined') return conPreset;
  try {
    const hash = window.location.hash;
    if (hash.startsWith(PREFIJO_HASH)) {
      const desdeHash = normalizar(def, JSON.parse(deBase64Url(hash.slice(PREFIJO_HASH.length))));
      if (desdeHash) return desdeHash;
    }
  } catch {
    // Enlace dañado, se ignora.
  }
  try {
    const guardado = window.localStorage.getItem(clave);
    if (guardado) {
      const desdeLocal = normalizar(def, JSON.parse(guardado));
      if (desdeLocal) return desdeLocal;
    }
  } catch {
    // Almacenamiento bloqueado, se ignora.
  }
  return conPreset;
}

export function guardarLocal(clave: string, f: Ficha): boolean {
  try {
    window.localStorage.setItem(clave, JSON.stringify(f));
    return true;
  } catch {
    return false;
  }
}

export function enlaceConfigurado(f: Ficha): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${PREFIJO_HASH}${aBase64Url(JSON.stringify(f))}`;
}

export function limpiarHash() {
  try {
    if (window.location.hash.startsWith(PREFIJO_HASH)) {
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, '', `${pathname}${search}`);
    }
  } catch {
    // Sin acceso al historial, no pasa nada.
  }
}

// Lectura cómoda de valores

export function txt(f: Ficha, clave: string): string {
  const v = f[clave];
  return typeof v === 'string' ? v.trim() : '';
}

export function bool(f: Ficha, clave: string): boolean {
  return f[clave] === true;
}

export function opcion(f: Ficha, clave: string): string {
  const v = f[clave];
  return typeof v === 'string' ? v : '';
}

export function textoONull(f: Ficha, clave: string): string | null {
  return txt(f, clave) || null;
}

export function soloDigitos(v: string): number | null {
  const limpio = v.replace(/[^\d]/g, '');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

export type Moneda = 'USD' | 'ARS' | 'EUR';

export function monedaDe(f: Ficha): Moneda {
  const m = opcion(f, 'moneda');
  return m === 'ARS' || m === 'EUR' ? m : 'USD';
}

export function formatearMonto(moneda: Moneda, valor: number | string | null): string | null {
  const n = typeof valor === 'number' ? valor : valor === null ? null : soloDigitos(valor);
  if (n === null || !Number.isFinite(n)) return null;
  const cifra = Math.round(n).toLocaleString('es-AR');
  if (moneda === 'EUR') return `${cifra} €`;
  return `${moneda} ${cifra}`;
}

/** Plazo legal de arrepentimiento del consumidor según el mercado. */
export function diasLegales(f: Ficha): string | null {
  const m = opcion(f, 'mercado');
  if (m === 'AR') return '10 días corridos';
  if (m === 'ES') return '14 días naturales';
  return null;
}

export function diasLegalesNumero(f: Ficha): number | null {
  const m = opcion(f, 'mercado');
  if (m === 'AR') return 10;
  if (m === 'ES') return 14;
  return null;
}

export const OPCIONES_MERCADO = [
  { valor: 'AR', rotulo: 'Argentina' },
  { valor: 'ES', rotulo: 'España' },
  { valor: 'OTRO', rotulo: 'Otro' },
];

export const OPCIONES_MONEDA = [
  { valor: 'USD', rotulo: 'USD' },
  { valor: 'ARS', rotulo: 'ARS' },
  { valor: 'EUR', rotulo: 'EUR' },
];

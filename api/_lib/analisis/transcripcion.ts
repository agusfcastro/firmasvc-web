/**
 * La transcripción que ve el modelo (regla 8 de CLAUDE.md: a la API de
 * Claude va solo lo necesario).
 *   · Una línea por intervención, con su minuto y un rol en lugar del
 *     nombre: Vendedor, Prospecto o Hablante. Los nombres que aparecen
 *     dentro de lo que se dice también se reemplazan.
 *   · Sin mails ni teléfonos. Los montos quedan, porque hacen falta para
 *     algunos códigos.
 *   · Después ubica cada cita que devuelve el modelo: si no aparece textual
 *     en lo que dijo quien corresponde, la cita no cuenta. La que aparece
 *     toma el minuto de la intervención, no el que diga el modelo.
 * Los roles salen del contenido: los que marcó a mano quien cargó la
 * llamada (el resto queda como Hablante), y si no hay marcas, el mail o el
 * nombre del equipo del negocio.
 */

export interface Segmento {
  hablante: string | null;
  email: string | null;
  segundo: number | null;
  texto: string;
}

export interface ContenidoLlamada {
  invitados?: { nombre: string | null; email: string | null; externo: boolean | null }[];
  grabado_por?: { nombre: string | null; email: string | null } | null;
  transcripcion?: Segmento[];
  roles?: Record<string, 'prospecto' | 'vendedor'>;
}

export type Rol = 'prospecto' | 'vendedor' | 'hablante';

export interface Linea {
  etiqueta: string;
  rol: Rol;
  segundo: number | null;
  texto: string;
}

export interface Hablante {
  etiqueta: string;
  rol: Rol;
  intervenciones: number;
  palabras: number;
}

export interface Transcripcion {
  lineas: Linea[];
  /** Lo que se le manda al modelo. */
  texto: string;
  hablantes: Hablante[];
  palabrasProspecto: number;
  /** Hay al menos un vendedor y un prospecto identificados. */
  rolesClaros: boolean;
  /** Se cortó por largo. */
  recortada: boolean;
  /** Aplica los mismos reemplazos a otro texto, como el título. */
  seudonimizar: (s: string) => string;
}

const MAXIMO_CARACTERES = 500_000;

const bajo = (s: string) => s.normalize('NFC').trim().toLowerCase();
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const contarPalabras = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;

/** 75 → "01:15"; 3700 → "1:01:40". */
export function minuto(segundo: number | null): string {
  if (segundo == null || !Number.isFinite(segundo)) return '';
  const total = Math.max(0, Math.round(segundo));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

const MAIL = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi;
const POSIBLE_TELEFONO = /\+?\d[\d\s().-]{6,}\d/g;

/** Saca mails y teléfonos. Un monto como 5.000.000 no es un teléfono. */
export function sinContacto(texto: string): string {
  return texto.replace(MAIL, '[mail]').replace(POSIBLE_TELEFONO, (t) => {
    if (/[.,]/.test(t) && !/[\s-]/.test(t)) return t;
    const digitos = t.replace(/\D/g, '').length;
    return digitos >= 8 && (t.startsWith('+') || digitos >= 10 || /[\s-]/.test(t)) ? '[teléfono]' : t;
  });
}

export function armarTranscripcion(contenido: ContenidoLlamada, equipo: { nombre: string | null; email: string | null }[]): Transcripcion {
  const segmentos = (Array.isArray(contenido.transcripcion) ? contenido.transcripcion : []).filter(
    (s) => s && typeof s.texto === 'string' && s.texto.trim(),
  );

  const mailsEquipo = new Set(equipo.flatMap((e) => (e.email ? [bajo(e.email)] : [])));
  const nombresEquipo = new Set(equipo.flatMap((e) => (e.nombre ? [bajo(e.nombre)] : [])));
  const primerosEquipo = new Set([...nombresEquipo].map((n) => n.split(/\s+/)[0]).filter((n) => n.length >= 3));
  const grabo = contenido.grabado_por ?? null;
  if (grabo?.email) mailsEquipo.add(bajo(grabo.email));
  if (grabo?.nombre) nombresEquipo.add(bajo(grabo.nombre));
  for (const i of contenido.invitados ?? []) if (i?.externo === false && i.email) mailsEquipo.add(bajo(i.email));
  const marcados = new Map(Object.entries(contenido.roles ?? {}).map(([k, v]) => [bajo(k), v]));

  // Cada persona, en el orden en que habla por primera vez.
  interface Persona extends Hablante {
    nombre: string | null;
  }
  const personas = new Map<string, Persona>();
  const claveDe = (s: Segmento) => (s.email ? `m:${bajo(s.email)}` : s.hablante ? `n:${bajo(s.hablante)}` : 'sin_nombre');
  for (const s of segmentos) {
    const clave = claveDe(s);
    if (personas.has(clave)) continue;
    const nombre = s.hablante ? bajo(s.hablante) : '';
    const mail = s.email ? bajo(s.email) : '';
    let rol: Rol;
    const marcado = nombre ? marcados.get(nombre) : undefined;
    if (marcado) rol = marcado;
    // Si quien cargó la llamada marcó los roles, el que no marcó no es ni vendedor ni prospecto.
    else if (marcados.size || (!nombre && !mail)) rol = 'hablante';
    else if ((mail && mailsEquipo.has(mail)) || (nombre && (nombresEquipo.has(nombre) || primerosEquipo.has(nombre.split(/\s+/)[0])))) rol = 'vendedor';
    else rol = 'prospecto';
    personas.set(clave, { nombre: s.hablante?.trim() || null, rol, etiqueta: '', intervenciones: 0, palabras: 0 });
  }

  // Sin ningún vendedor identificado no se puede saber quién es quién.
  let rolesClaros = [...personas.values()].some((p) => p.rol === 'vendedor') && [...personas.values()].some((p) => p.rol === 'prospecto');
  if (!rolesClaros) for (const p of personas.values()) if (p.rol !== 'vendedor' || personas.size === 1) p.rol = 'hablante';
  rolesClaros = [...personas.values()].some((p) => p.rol === 'vendedor') && [...personas.values()].some((p) => p.rol === 'prospecto');

  const cuantos: Record<Rol, number> = { vendedor: 0, prospecto: 0, hablante: 0 };
  for (const p of personas.values()) cuantos[p.rol]++;
  const numero: Record<Rol, number> = { vendedor: 0, prospecto: 0, hablante: 0 };
  const nombreRol: Record<Rol, string> = { vendedor: 'Vendedor', prospecto: 'Prospecto', hablante: 'Hablante' };
  for (const p of personas.values()) {
    numero[p.rol]++;
    p.etiqueta = cuantos[p.rol] > 1 || p.rol === 'hablante' ? `${nombreRol[p.rol]} ${numero[p.rol]}` : nombreRol[p.rol];
  }

  // Nombres a reemplazar dentro del texto. Gana la primera etiqueta que se
  // asigna a un nombre: primero los que hablan, después el resto.
  const etiquetaDe = new Map<string, string>();
  const agregar = (n: string | null | undefined, etiqueta: string) => {
    const t = (n ?? '').trim();
    if (t.length < 3) return;
    if (!etiquetaDe.has(bajo(t))) etiquetaDe.set(bajo(t), etiqueta);
    const primero = t.split(/\s+/)[0];
    if (primero.length >= 3 && primero !== t && !etiquetaDe.has(bajo(primero))) etiquetaDe.set(bajo(primero), etiqueta);
  };
  for (const p of personas.values()) agregar(p.nombre, p.etiqueta);
  for (const e of equipo) agregar(e.nombre, '[equipo]');
  agregar(grabo?.nombre, '[equipo]');
  for (const i of contenido.invitados ?? []) agregar(i?.nombre, '[invitado]');
  const patrones = [...etiquetaDe.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([n, e]) => [new RegExp(`(?<![\\p{L}\\p{N}])${escapar(n)}(?![\\p{L}\\p{N}])`, 'giu'), e] as const);
  const seudonimizar = (s: string) => patrones.reduce((t, [re, e]) => t.replace(re, e), sinContacto(s));

  const lineas: Linea[] = segmentos.map((s) => {
    const p = personas.get(claveDe(s))!;
    const texto = seudonimizar(s.texto.trim().replace(/\s+/g, ' '));
    p.intervenciones++;
    p.palabras += contarPalabras(texto);
    return { etiqueta: p.etiqueta, rol: p.rol, segundo: typeof s.segundo === 'number' ? s.segundo : null, texto };
  });

  let texto = '';
  let recortada = false;
  for (const l of lineas) {
    const fila = `[${minuto(l.segundo) || '--:--'}] ${l.etiqueta}: ${l.texto}\n`;
    if (texto.length + fila.length > MAXIMO_CARACTERES) {
      recortada = true;
      break;
    }
    texto += fila;
  }

  const hablantes = [...personas.values()].map(({ etiqueta, rol, intervenciones, palabras }) => ({ etiqueta, rol, intervenciones, palabras }));
  const palabrasProspecto = hablantes
    .filter((h) => h.rol === 'prospecto' || (!rolesClaros && h.rol === 'hablante'))
    .reduce((s, h) => s + h.palabras, 0);

  return { lineas, texto: texto.trimEnd(), hablantes, palabrasProspecto, rolesClaros, recortada, seudonimizar };
}

/** Minúsculas, sin puntuación ni la etiqueta o la marca de tiempo que a veces copia el modelo. */
function limpiar(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .replace(/^\s*(prospecto|vendedor|hablante)(\s*\d+)?\s*:\s*/, '')
    .replace(/[^\p{L}\p{N}\[\]]+/gu, ' ')
    .trim();
}

/**
 * La intervención donde está la cita, entre las de los roles indicados, o
 * null. La cita puede saltear partes con «...» y puede seguir en las
 * intervenciones inmediatas del mismo hablante.
 */
export function ubicarCita(t: Transcripcion, cita: string, roles: Rol[]): Linea | null {
  const partes = String(cita ?? '')
    .split(/\.\.\.|…/)
    .map(limpiar)
    .filter(Boolean);
  if (!partes.length || contarPalabras(partes.join(' ')) < 2) return null;

  const contiene = (texto: string) => {
    const t2 = ` ${texto} `;
    let desde = 0;
    for (const p of partes) {
      const i = t2.indexOf(` ${p} `, desde);
      if (i < 0) return false;
      desde = i + p.length + 1;
    }
    return true;
  };

  const lineas = t.lineas;
  for (const l of lineas) if (roles.includes(l.rol) && contiene(limpiar(l.texto))) return l;
  const unir = (desde: number, hasta: number) => lineas.slice(desde, hasta + 1).map((l) => limpiar(l.texto)).join(' ');
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!roles.includes(l.rol)) continue;
    for (let j = i + 1; j < lineas.length && j <= i + 5 && lineas[j].etiqueta === l.etiqueta; j++) {
      if (!contiene(unir(i, j))) continue;
      // La cita empieza en la última intervención desde la que todavía entra.
      let inicio = i;
      while (inicio < j && contiene(unir(inicio + 1, j))) inicio++;
      return lineas[inicio];
    }
  }
  return null;
}

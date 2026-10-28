/**
 * Contratos modelo en Word. Completa las variables {{...}} con los datos del
 * cliente, quita los tramos {{#...}}…{{/...}} que quedan sin dato y pasa el
 * resultado a PDF con Google Drive, la misma cuenta de servicio que ya usa el
 * portal. Solo corre en el servidor.
 */
import { createSign } from 'node:crypto';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/* ------------------------------------------------------------------ */
/* Variables dentro del Word                                           */
/* ------------------------------------------------------------------ */
// Word suele partir {{NOMBRE}} en varios tramos (<w:r>) por la corrección
// ortográfica o un cambio de formato. Por eso se trabaja párrafo por
// párrafo sobre el texto unido de todos sus <w:t>.
const PARRAFO = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const TEXTO = /(<w:t(?:\s[^>]*[^/>])?>)([\s\S]*?)(<\/w:t>)|<w:t(?:\s[^>]*)?\/>/g;
// {{NOMBRE}} es una variable. {{#DNI}}…{{/DNI}} es un tramo que solo queda
// si el DNI tiene valor, y {{^DNI}}…{{/DNI}} uno que solo queda si está vacío.
// El tramo abre y cierra dentro del mismo párrafo.
const MARCA = /\{\{\s*([#^/]?)\s*([A-Za-z_ÁÉÍÓÚÑáéíóúñ0-9]+)\s*\}\}/g;

function desescapar(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Normaliza el nombre de la variable: sin espacios ni tildes y en mayúsculas. */
export function claveDe(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

/** Texto de un <w:t> ya escapado. Los saltos de línea pasan a <w:br/> dentro del mismo tramo. */
function textoXml(s: string): string {
  return s
    .split(/\r?\n/)
    .map(escapar)
    .join('</w:t><w:br/><w:t xml:space="preserve">');
}

interface Nodo {
  inicio: number;
  fin: number;
  abre: string;
  texto: string;
}

interface Marca {
  inicio: number;
  fin: number;
  clave: string;
}

type Pieza = ({ tipo: 'variable' } & Marca) | { tipo: 'tramo'; inverso: boolean; abre: Marca; cierra: Marca; hijos: Pieza[] };

/** Un cambio sobre el texto unido del párrafo: lo que va de inicio a fin pasa a valor. */
interface Cambio {
  inicio: number;
  fin: number;
  valor: string;
}

interface Registro {
  usadas: Set<string>;
  condicionales: Set<string>;
  desconocidas: Set<string>;
  sinCerrar: Set<string>;
}

/** Arma el árbol de variables y tramos del párrafo. Las marcas que no cierran quedan como texto. */
function piezasDe(unido: string, reg: Registro): Pieza[] {
  const raiz: Pieza[] = [];
  const pila: { abre: Marca; inverso: boolean; hijos: Pieza[] }[] = [];
  const actual = () => (pila.length ? pila[pila.length - 1].hijos : raiz);
  for (const m of unido.matchAll(MARCA)) {
    const marca = { inicio: m.index ?? 0, fin: (m.index ?? 0) + m[0].length, clave: claveDe(m[2]) };
    if (m[1] === '#' || m[1] === '^') pila.push({ abre: marca, inverso: m[1] === '^', hijos: [] });
    else if (m[1] === '/') {
      const tope = pila[pila.length - 1];
      if (tope?.abre.clave !== marca.clave) {
        reg.sinCerrar.add(marca.clave);
        continue;
      }
      pila.pop();
      actual().push({ tipo: 'tramo', inverso: tope.inverso, abre: tope.abre, cierra: marca, hijos: tope.hijos });
    } else actual().push({ tipo: 'variable', ...marca });
  }
  // Un tramo sin cierre: su marca queda tal cual y lo de adentro se completa igual.
  while (pila.length) {
    const t = pila.pop()!;
    reg.sinCerrar.add(t.abre.clave);
    actual().push(...t.hijos);
  }
  return raiz;
}

function cambiosDe(piezas: Pieza[], valores: Record<string, string>, reg: Registro, cambios: Cambio[]): void {
  for (const p of piezas) {
    if (p.tipo === 'variable') {
      if (!(p.clave in valores)) {
        reg.desconocidas.add(p.clave);
        continue;
      }
      reg.usadas.add(p.clave);
      cambios.push({ inicio: p.inicio, fin: p.fin, valor: valores[p.clave] });
      continue;
    }
    if (!(p.abre.clave in valores)) {
      reg.desconocidas.add(p.abre.clave);
      cambiosDe(p.hijos, valores, reg, cambios);
      continue;
    }
    reg.condicionales.add(p.abre.clave);
    const vacia = !valores[p.abre.clave]?.trim();
    if (p.inverso ? !vacia : vacia) {
      // El tramo entero se va, con lo que tenga adentro.
      cambios.push({ inicio: p.abre.inicio, fin: p.cierra.fin, valor: '' });
      continue;
    }
    cambios.push({ inicio: p.abre.inicio, fin: p.abre.fin, valor: '' });
    cambiosDe(p.hijos, valores, reg, cambios);
    cambios.push({ inicio: p.cierra.inicio, fin: p.cierra.fin, valor: '' });
  }
}

function completarParrafo(p: string, valores: Record<string, string>, reg: Registro): string {
  const nodos: Nodo[] = [];
  for (const m of p.matchAll(TEXTO)) {
    if (m[1] === undefined) continue;
    nodos.push({ inicio: m.index ?? 0, fin: (m.index ?? 0) + m[0].length, abre: m[1], texto: desescapar(m[2]) });
  }
  const unido = nodos.map((n) => n.texto).join('');
  if (!unido.includes('{{')) return p;

  const cambios: Cambio[] = [];
  cambiosDe(piezasDe(unido, reg), valores, reg, cambios);
  if (cambios.length === 0) return p;

  // Posición de cada caracter del texto unido: en qué nodo y en qué lugar.
  const mapa: { nodo: number; pos: number }[] = [];
  nodos.forEach((n, i) => {
    for (let k = 0; k < n.texto.length; k++) mapa.push({ nodo: i, pos: k });
  });

  const textos = nodos.map((n) => n.texto);
  // Se reemplaza de atrás para adelante para no correr las posiciones.
  for (const c of cambios.sort((x, y) => y.inicio - x.inicio)) {
    const desde = mapa[c.inicio];
    const hasta = mapa[c.fin - 1];
    if (desde.nodo === hasta.nodo) {
      const t = textos[desde.nodo];
      textos[desde.nodo] = t.slice(0, desde.pos) + c.valor + t.slice(hasta.pos + 1);
    } else {
      textos[desde.nodo] = textos[desde.nodo].slice(0, desde.pos) + c.valor;
      for (let i = desde.nodo + 1; i < hasta.nodo; i++) textos[i] = '';
      textos[hasta.nodo] = textos[hasta.nodo].slice(hasta.pos + 1);
    }
  }

  let salida = '';
  let cursor = 0;
  nodos.forEach((n, i) => {
    salida += p.slice(cursor, n.inicio);
    const abre = /xml:space=/.test(n.abre) ? n.abre : n.abre.replace('<w:t', '<w:t xml:space="preserve"');
    salida += `${abre}${textoXml(textos[i])}</w:t>`;
    cursor = n.fin;
  });
  return salida + p.slice(cursor);
}

export interface WordCompletado {
  bytes: Uint8Array;
  /** Variables que quedaron escritas en el contrato. Las de un tramo que se quitó no cuentan. */
  usadas: string[];
  /** Variables que abren un tramo {{#...}} o {{^...}}. */
  condicionales: string[];
  /** Tramos que no cierran en el mismo párrafo. Quedan como están. */
  sinCerrar: string[];
  /** Variables escritas en el modelo que el sistema no conoce. Quedan como están. */
  desconocidas: string[];
}

/** Completa las variables en el cuerpo, encabezados, pies y notas del Word. */
export function completarWord(docx: Uint8Array, valores: Record<string, string>): WordCompletado {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(docx);
  } catch {
    throw new Error('El modelo no es un Word válido (.docx).');
  }
  if (!zip['word/document.xml']) throw new Error('El modelo no es un Word válido (.docx).');
  const reg: Registro = { usadas: new Set(), condicionales: new Set(), desconocidas: new Set(), sinCerrar: new Set() };
  for (const nombre of Object.keys(zip)) {
    if (!/^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(nombre)) continue;
    const xml = strFromU8(zip[nombre]);
    // Las llaves pueden estar partidas entre tramos, así que alcanza con que haya una.
    if (!xml.includes('{')) continue;
    zip[nombre] = strToU8(xml.replace(PARRAFO, (p) => completarParrafo(p, valores, reg)));
  }
  return {
    bytes: zipSync(zip, { level: 6 }),
    usadas: [...reg.usadas],
    condicionales: [...reg.condicionales],
    desconocidas: [...reg.desconocidas],
    sinCerrar: [...reg.sinCerrar],
  };
}

/* ------------------------------------------------------------------ */
/* Word a PDF con Google Drive                                         */
/* ------------------------------------------------------------------ */
interface CredencialesGoogle {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export async function tokenDrive(): Promise<string> {
  const crudo = process.env.GOOGLE_CREDS_JSON;
  if (!crudo) throw new Error('Falta GOOGLE_CREDS_JSON en el servidor.');
  const cred = JSON.parse(crudo) as CredencialesGoogle;
  const aud = cred.token_uri || 'https://oauth2.googleapis.com/token';
  const ahora = Math.floor(Date.now() / 1000);
  const reclamos: Record<string, unknown> = { iss: cred.client_email, scope: 'https://www.googleapis.com/auth/drive', aud, iat: ahora, exp: ahora + 3600 };
  if (process.env.GOOGLE_SUBJECT) reclamos.sub = process.env.GOOGLE_SUBJECT;
  const base = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(reclamos))}`;
  const firma = createSign('RSA-SHA256').update(base).sign(cred.private_key);
  const r = await fetch(aud, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${base}.${b64url(firma)}` }),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!r.ok || !j.access_token) throw new Error(`Google no dio acceso a Drive. ${j.error_description || j.error || r.status}`);
  return j.access_token;
}

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Sube el Word como documento de Google, lo exporta a PDF y lo borra.
 * Drive respeta márgenes, tipografías comunes, tablas, encabezados y pies.
 */
export async function wordAPdf(docx: Uint8Array, nombre: string): Promise<Uint8Array> {
  const token = await tokenDrive();
  const limite = `firma${Date.now()}`;
  const metadatos = { name: `tmp-${nombre}`.slice(0, 150), mimeType: 'application/vnd.google-apps.document' };
  const cuerpo = Buffer.concat([
    Buffer.from(`--${limite}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadatos)}\r\n--${limite}\r\ncontent-type: ${MIME_DOCX}\r\n\r\n`),
    Buffer.from(docx),
    Buffer.from(`\r\n--${limite}--`),
  ]);
  const subida = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
  const j = (await subida.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!subida.ok || !j.id) throw new Error(`Drive no pudo convertir el Word. ${j.error?.message ?? subida.status}`);
  try {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${j.id}/export?mimeType=application/pdf`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`Drive no pudo pasar el contrato a PDF. ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  } finally {
    // El documento temporal no queda en Drive.
    await fetch(`https://www.googleapis.com/drive/v3/files/${j.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }).catch(() => undefined);
  }
}

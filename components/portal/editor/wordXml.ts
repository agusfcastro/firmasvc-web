/**
 * Cambia el texto de un Word sin tocar su formato. Trabaja sobre
 * word/document.xml como texto: ubica cada párrafo, y al editar uno
 * modifica solo las letras que cambiaron dentro de sus tramos, así la
 * negrita, la numeración, las tablas y los estilos quedan como estaban.
 *
 * No usa el DOM, para poder probarlo fuera del navegador
 * (scripts/pruebas/wordXml.mjs).
 */

/** Una tabulación se ve en pantalla como este espacio ancho (así la dibuja docx-preview). */
export const TAB = ' ';

export interface Parrafo {
  xml: string;
  /** El texto como se ve en pantalla. */
  texto: string;
  /** Falso si tiene algo que este editor no sabe conservar: campos, notas, cambios con control, dibujos. */
  editable: boolean;
}

/** partes[i] es lo que hay antes del párrafo i; la última parte es lo que queda después del último. */
export interface Documento {
  partes: string[];
  parrafos: Parrafo[];
}

interface Tramo {
  tipo: 't' | 'tab';
  /** Dónde está el elemento entero dentro del XML del párrafo. */
  ini: number;
  fin: number;
  texto: string;
}

const NO_EDITABLE =
  /<w:(ins|del|moveFrom|moveTo|fldChar|fldSimple|instrText|sym|footnoteReference|endnoteReference|drawing|pict|object|ruby|sdt|pPrChange|rPrChange|noBreakHyphen|softHyphen|ptab|cr|delText)[\s>/]|<mc:AlternateContent|<m:oMath/;
/** Lo que no se puede perder aunque el párrafo se borre. */
const ANCLADO = /<w:(sectPr|bookmarkStart|bookmarkEnd|commentRangeStart|commentRangeEnd|permStart|permEnd)[\s>/]/;

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodificar(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (todo, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : todo;
    }
    return ENTIDADES[e] ?? todo;
  });
}

const codificar = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Saca lo que un Word no acepta y deja el texto en una sola línea. */
export function limpiar(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\r\n\t\v\f]+/g, ' ').replace(/[\u0000-\u0008\u000e-\u001f￾￿]/g, '');
}

/** Separa el documento en párrafos. Un párrafo dentro de otro (un cuadro de texto) queda como parte del de afuera. */
export function leerDocumento(xml: string): Documento {
  const partes: string[] = [];
  const parrafos: Parrafo[] = [];
  const marca = /<w:p(?=[\s>/])[^>]*>|<\/w:p>/g;
  let nivel = 0;
  let inicio = 0;
  let previo = 0;
  let anidado = false;
  for (let m = marca.exec(xml); m; m = marca.exec(xml)) {
    const cierra = m[0] === '</w:p>';
    const solo = !cierra && m[0].endsWith('/>');
    if (cierra) {
      nivel--;
      if (nivel === 0) {
        agregar(xml.slice(inicio, marca.lastIndex), anidado);
        previo = marca.lastIndex;
      }
      continue;
    }
    if (nivel === 0) {
      partes.push(xml.slice(previo, m.index));
      inicio = m.index;
      anidado = false;
      if (solo) {
        agregar(m[0], false);
        previo = marca.lastIndex;
        continue;
      }
    } else {
      anidado = true;
    }
    if (!solo) nivel++;
  }
  partes.push(xml.slice(previo));
  return { partes, parrafos };

  function agregar(p: string, conAnidado: boolean) {
    const editable = !conAnidado && !NO_EDITABLE.test(p);
    parrafos.push({ xml: p, editable, texto: editable ? tramosDe(p).map((t) => t.texto).join('') : '' });
  }
}

/** Dónde termina la etiqueta que abre el párrafo y dónde terminan sus propiedades. */
function cabecera(p: string): { abre: number; cuerpo: number; pPr: string } {
  const abre = p.indexOf('>') + 1;
  if (p.startsWith('<w:pPr/>', abre)) return { abre, cuerpo: abre + 8, pPr: '' };
  if (p.startsWith('<w:pPr>', abre)) {
    const fin = p.indexOf('</w:pPr>', abre);
    if (fin !== -1) return { abre, cuerpo: fin + 8, pPr: p.slice(abre, fin + 8) };
  }
  return { abre, cuerpo: abre, pPr: '' };
}

/** Los pedazos de texto del párrafo, en orden. Las tabulaciones de las propiedades no cuentan. */
function tramosDe(p: string): Tramo[] {
  const tramos: Tramo[] = [];
  if (p.endsWith('/>') && !p.includes('</w:p>')) return tramos;
  const { cuerpo } = cabecera(p);
  const marca = /<w:t(?=[\s>])[^>]*>([^<]*)<\/w:t>|<w:tab(?=[\s/>])[^>]*\/>/g;
  marca.lastIndex = cuerpo;
  for (let m = marca.exec(p); m; m = marca.exec(p)) {
    if (m[0].startsWith('<w:tab')) tramos.push({ tipo: 'tab', ini: m.index, fin: marca.lastIndex, texto: TAB });
    else tramos.push({ tipo: 't', ini: m.index, fin: marca.lastIndex, texto: decodificar(m[1]) });
  }
  return tramos;
}

const T_ABRE = '<w:t xml:space="preserve">';
/** El texto como contenido de un tramo; cada tabulación corta el tramo y sigue en otro. */
const comoContenido = (s: string): string => s.split(TAB).map(codificar).join(`</w:t><w:tab/>${T_ABRE}`);
const comoTramo = (s: string): string => `${T_ABRE}${comoContenido(s)}</w:t>`;

/** El formato de letra del último tramo con texto, o el de la marca de párrafo. */
function formatoDeLetra(p: string): string {
  const { cuerpo, pPr } = cabecera(p);
  const marca = /<w:r(?=[\s>])[^>]*>(<w:rPr>.*?<\/w:rPr>|<w:rPr\/>)?/gs;
  marca.lastIndex = cuerpo;
  let ultimo: string | null = null;
  for (let m = marca.exec(p); m; m = marca.exec(p)) ultimo = m[1] ?? '';
  if (ultimo !== null) return ultimo;
  return /<w:rPr>.*?<\/w:rPr>/s.exec(pPr)?.[0] ?? '';
}

/**
 * El párrafo con su texto nuevo. Se cambia solo lo que quedó distinto
 * entre el comienzo y el final que siguen iguales: lo demás no se toca.
 */
export function editarParrafo(p: string, textoNuevo: string): string {
  const tramos = tramosDe(p);
  const viejo = tramos.map((t) => t.texto).join('');
  const nuevo = limpiar(textoNuevo);
  if (nuevo === viejo) return p;

  let a = 0;
  const tope = Math.min(viejo.length, nuevo.length);
  while (a < tope && viejo[a] === nuevo[a]) a++;
  let z = 0;
  while (z < tope - a && viejo[viejo.length - 1 - z] === nuevo[nuevo.length - 1 - z]) z++;
  // Sin partir una letra de dos unidades (emojis, letras raras).
  const alta = (c: number) => c >= 0xd800 && c <= 0xdbff;
  if (a > 0 && alta(viejo.charCodeAt(a - 1))) a--;
  if (z > 0 && alta(viejo.charCodeAt(viejo.length - z - 1))) z--;
  const hasta = viejo.length - z;
  const entra = nuevo.slice(a, nuevo.length - z);

  if (!tramos.length) return conTramoAlFinal(p, entra);

  // Dónde entra lo nuevo: si reemplaza algo, toma el formato de lo reemplazado; si no, sigue al de la letra anterior.
  let pos = 0;
  let destino = -1;
  const rangos = tramos.map((t) => {
    const r = { desde: pos, hasta: pos + t.texto.length };
    pos = r.hasta;
    return r;
  });
  if (entra) {
    if (hasta > a) destino = rangos.findIndex((r) => a >= r.desde && a < r.hasta);
    if (destino === -1 && a > 0) destino = rangos.findIndex((r) => a > r.desde && a <= r.hasta);
    if (destino === -1) destino = 0;
  }

  let salida = p;
  for (let i = tramos.length - 1; i >= 0; i--) {
    const t = tramos[i];
    const r = rangos[i];
    const corteA = Math.max(a, r.desde) - r.desde;
    const corteZ = Math.min(hasta, r.hasta) - r.desde;
    const pierde = corteZ > corteA;
    if (!pierde && i !== destino) continue;
    let reemplazo: string;
    if (t.tipo === 'tab') {
      const propio = pierde ? '' : p.slice(t.ini, t.fin);
      if (i !== destino) reemplazo = propio;
      else reemplazo = a > r.desde ? propio + comoTramo(entra) : comoTramo(entra) + propio;
    } else {
      const antes = pierde ? t.texto.slice(0, corteA) : t.texto.slice(0, Math.min(Math.max(a - r.desde, 0), t.texto.length));
      const despues = pierde ? t.texto.slice(corteZ) : t.texto.slice(antes.length);
      reemplazo = `${T_ABRE}${codificar(antes)}${i === destino ? comoContenido(entra) : ''}${codificar(despues)}</w:t>`;
    }
    salida = salida.slice(0, t.ini) + reemplazo + salida.slice(t.fin);
  }
  return salida;
}

/** Un párrafo sin texto recibe el suyo en un tramo nuevo, con el formato de la marca de párrafo. */
function conTramoAlFinal(p: string, texto: string): string {
  if (!texto) return p;
  const tramo = `<w:r>${formatoDeLetra(p)}${comoTramo(texto)}</w:r>`;
  if (!p.includes('</w:p>')) return `${p.slice(0, -2)}>${tramo}</w:p>`;
  const fin = p.lastIndexOf('</w:p>');
  return p.slice(0, fin) + tramo + p.slice(fin);
}

/** Un párrafo nuevo con el formato de otro, como cuando en Word se aprieta Enter. */
export function parrafoNuevo(fuente: string, texto: string): string {
  const pPr = cabecera(fuente).pPr.replace(/<w:sectPr(?=[\s>/])[^>]*\/>|<w:sectPr(?=[\s>])[^>]*>.*?<\/w:sectPr>/gs, '');
  const limpio = limpiar(texto);
  return `<w:p>${pPr}${limpio ? `<w:r>${formatoDeLetra(fuente)}${comoTramo(limpio)}</w:r>` : ''}</w:p>`;
}

/** Lo que queda de un párrafo borrado: nada, o el párrafo vacío si sostiene una sección o un marcador. */
export function parrafoBorrado(p: string): string {
  return ANCLADO.test(p) ? editarParrafo(p, '') : '';
}

/**
 * Vuelve a armar document.xml. salida[i] es lo que va en el lugar del
 * párrafo i: él mismo, su versión editada, nada, o varios párrafos.
 * Una celda de tabla no puede quedar sin párrafo: si pasa, se deja uno vacío.
 */
export function armarDocumento(doc: Documento, salida: string[]): string {
  let xml = '';
  doc.parrafos.forEach((original, i) => {
    xml += doc.partes[i];
    let s = salida[i] ?? original.xml;
    if (!s && /^\s*<\/w:tc>/.test(doc.partes[i + 1]) && /(<w:tc>|<\/w:tcPr>|<w:tcPr\/>|<\/w:tbl>)\s*$/.test(xml)) s = '<w:p/>';
    xml += s;
  });
  return xml + doc.partes[doc.parrafos.length];
}

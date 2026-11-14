/**
 * Dónde está cada comentario dentro del documento. Una "superficie" es el
 * bloque de texto que se puede seleccionar: la capa de texto de una hoja
 * del PDF o el documento Word entero. La ubicación se guarda como letras
 * desde el comienzo de la superficie (inicio y fin), más la cita, que sirve
 * para volver a encontrarla si el documento se dibuja distinto.
 */
export interface Ancla {
  pagina: number | null;
  inicio: number;
  fin: number;
}

const MAX_CITA = 1000;

/** Los textos visibles de la superficie, en orden. Los estilos no cuentan. */
function textosDe(raiz: Node): Text[] {
  const textos: Text[] = [];
  const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('style, script') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) textos.push(n as Text);
  return textos;
}

export function textoDe(raiz: Node): string {
  return textosDe(raiz)
    .map((t) => t.data)
    .join('');
}

/** Cuántas letras hay desde el comienzo de la superficie hasta un punto de una selección. */
function posicionDe(raiz: Node, textos: Text[], nodo: Node, desplazamiento: number): number {
  let total = 0;
  if (nodo.nodeType === Node.TEXT_NODE) {
    for (const t of textos) {
      if (t === nodo) return total + Math.min(desplazamiento, t.length);
      total += t.length;
    }
    return total;
  }
  // El punto está entre dos hijos de un elemento: cuenta todo lo que queda antes de ese hijo.
  const hijo = nodo.childNodes[desplazamiento] ?? null;
  for (const t of textos) {
    const despues = hijo
      ? hijo === t || hijo.contains(t) || Boolean(hijo.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)
      : !nodo.contains(t) && Boolean(nodo.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (despues) return total;
    total += t.length;
  }
  return raiz.contains(nodo) ? total : 0;
}

/** El rango del documento que corresponde a inicio y fin, o null si ya no existe. */
export function rangoDe(raiz: Node, inicio: number, fin: number): Range | null {
  const textos = textosDe(raiz);
  let total = 0;
  let desde: [Text, number] | null = null;
  let hasta: [Text, number] | null = null;
  for (const t of textos) {
    if (!desde && inicio < total + t.length) desde = [t, inicio - total];
    if (desde && fin <= total + t.length) {
      hasta = [t, fin - total];
      break;
    }
    total += t.length;
  }
  if (!desde || !hasta) return null;
  const r = document.createRange();
  r.setStart(desde[0], desde[1]);
  r.setEnd(hasta[0], hasta[1]);
  return r;
}

/**
 * Busca dónde está hoy la cita. Primero en la ubicación guardada; si el
 * documento cambió, la primera aparición de la frase. Null si no está.
 */
export function ubicar(raiz: Node, ancla: Ancla, cita: string): { inicio: number; fin: number } | null {
  const texto = textoDe(raiz);
  if (texto.slice(ancla.inicio, ancla.fin) === cita) return { inicio: ancla.inicio, fin: ancla.fin };
  const i = texto.indexOf(cita);
  return i >= 0 ? { inicio: i, fin: i + cita.length } : null;
}

export interface Seleccion {
  ancla: Ancla;
  cita: string;
  /** Para ubicar el botón de comentar junto a lo seleccionado. */
  caja: DOMRect;
}

/**
 * Lo que la persona tiene seleccionado dentro del visor, o null. Si la
 * selección cruza de una hoja a otra, se corta al final de la primera.
 */
export function seleccionActual(contenedor: HTMLElement): Seleccion | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const rango = sel.getRangeAt(0);
  const elementoDe = (n: Node) => (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement);
  const superficie = elementoDe(rango.startContainer)?.closest<HTMLElement>('[data-superficie]');
  if (!superficie || !contenedor.contains(superficie)) return null;

  const textos = textosDe(superficie);
  const inicio = posicionDe(superficie, textos, rango.startContainer, rango.startOffset);
  const fin = superficie.contains(rango.endContainer)
    ? posicionDe(superficie, textos, rango.endContainer, rango.endOffset)
    : textos.reduce((s, t) => s + t.length, 0);
  const texto = textos.map((t) => t.data).join('');

  // Sin espacios de más en las puntas, y con un largo razonable.
  let a = inicio;
  let b = Math.min(fin, inicio + MAX_CITA);
  while (a < b && /\s/.test(texto[a])) a++;
  while (b > a && /\s/.test(texto[b - 1])) b--;
  if (b <= a) return null;

  const pagina = superficie.dataset.pagina ? Number(superficie.dataset.pagina) : null;
  const r = rangoDe(superficie, a, b);
  return { ancla: { pagina, inicio: a, fin: b }, cita: texto.slice(a, b), caja: (r ?? rango).getBoundingClientRect() };
}

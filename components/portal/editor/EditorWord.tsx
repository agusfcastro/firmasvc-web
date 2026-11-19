import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { FORMATOS_ASUNTO } from '../asuntos';
import { armarDocumento, editarParrafo, leerDocumento, limpiar, parrafoBorrado, parrafoNuevo, type Documento } from './wordXml';

/**
 * Editor de un Word del asunto, solo FIRMA. El documento se dibuja igual
 * que en el visor (docx-preview) y cada párrafo se vuelve editable. Al
 * guardar no se convierte nada: se toma el Word original y se le cambia
 * solo el texto de los párrafos tocados (wordXml.ts), así el formato
 * queda intacto. Enter parte un párrafo, y Borrar al comienzo lo une
 * con el anterior. Los párrafos con campos, notas o imágenes quedan
 * fijos: se ven pero no se editan.
 */
export interface EditorWordRef {
  /** El Word con los cambios que hay en pantalla. */
  armar: () => Blob;
}

interface Estado {
  zip: Record<string, Uint8Array>;
  doc: Documento;
  quitados: Set<number>;
}

const EDITABLE = 'parrafo-editable';

/** El último tramo con letra de un párrafo dibujado, para que lo nuevo se vea igual. */
function molde(p: HTMLElement): HTMLElement {
  const tramos = p.querySelectorAll<HTMLElement>('span');
  const ultimo = tramos.length ? (tramos[tramos.length - 1].cloneNode(false) as HTMLElement) : document.createElement('span');
  ultimo.removeAttribute('id');
  return ultimo;
}

function hacerEditable(p: HTMLElement) {
  p.classList.add(EDITABLE);
  p.spellcheck = true;
  p.lang = 'es';
  try {
    p.contentEditable = 'plaintext-only';
  } catch {
    /* Navegador sin texto plano: se cae a editable común, con el pegado y el formato frenados abajo. */
  }
  if (p.contentEditable !== 'plaintext-only') p.contentEditable = 'true';
}

/** Cuántas letras hay antes del cursor dentro del párrafo, o null si el cursor no está ahí. */
function letrasAntes(p: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!p.contains(r.startContainer)) return null;
  const antes = document.createRange();
  antes.selectNodeContents(p);
  antes.setEnd(r.startContainer, r.startOffset);
  return antes.toString().length;
}

function ponerCursor(p: HTMLElement, letras: number) {
  p.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  const recorrido = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let falta = letras;
  let puesto = false;
  for (let n = recorrido.nextNode() as Text | null; n; n = recorrido.nextNode() as Text | null) {
    if (falta <= n.length) {
      r.setStart(n, falta);
      puesto = true;
      break;
    }
    falta -= n.length;
  }
  if (!puesto) {
    r.selectNodeContents(p);
    r.collapse(letras === 0);
  } else r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

const parrafoDe = (n: EventTarget | Node | null): HTMLElement | null => {
  const el = n instanceof Element ? n : n instanceof Node ? n.parentElement : null;
  return el?.closest<HTMLElement>(`p.${EDITABLE}`) ?? null;
};

export const EditorWord = forwardRef<
  EditorWordRef,
  {
    blob: Blob;
    alEditar: () => void;
    /** Cuántos párrafos quedaron editables y cuántos fijos. */
    alListo: (editables: number, fijos: number) => void;
    alError: () => void;
  }
>(({ blob, alEditar, alListo, alError }, ref) => {
  const [cuerpo, setCuerpo] = useState<HTMLDivElement | null>(null);
  const estilos = useRef<HTMLDivElement>(null);
  const estado = useRef<Estado | null>(null);
  const avisos = useRef({ alEditar, alListo, alError });
  avisos.current = { alEditar, alListo, alError };

  useImperativeHandle(
    ref,
    () => ({
      armar: () => {
        const e = estado.current;
        if (!e || !cuerpo) throw new Error('El documento todavía no terminó de abrir.');
        const salida: string[] = [];
        const nuevos = new Map<number, string[]>();
        for (const p of cuerpo.querySelectorAll<HTMLElement>(`p.${EDITABLE}`)) {
          const texto = (p.textContent ?? '').replace(/\n$/, '');
          if (p.dataset.idx) {
            const i = Number(p.dataset.idx);
            salida[i] = editarParrafo(e.doc.parrafos[i].xml, texto);
          } else if (p.dataset.tras && p.dataset.fuente) {
            const tras = Number(p.dataset.tras);
            nuevos.set(tras, [...(nuevos.get(tras) ?? []), parrafoNuevo(e.doc.parrafos[Number(p.dataset.fuente)].xml, texto)]);
          }
        }
        for (const i of e.quitados) salida[i] = parrafoBorrado(e.doc.parrafos[i].xml);
        for (const [i, lista] of nuevos) salida[i] = (salida[i] ?? e.doc.parrafos[i].xml) + lista.join('');
        const zip = { ...e.zip, 'word/document.xml': strToU8(armarDocumento(e.doc, salida)) };
        return new Blob([zipSync(zip)], { type: FORMATOS_ASUNTO.docx });
      },
    }),
    [cuerpo],
  );

  // Abre el Word, lo dibuja y empareja cada párrafo dibujado con el suyo dentro del archivo.
  useEffect(() => {
    if (!cuerpo || !estilos.current) return;
    let vivo = true;
    const est = estilos.current;
    void (async () => {
      const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()));
      const xml = zip['word/document.xml'];
      if (!xml) throw new Error('Sin documento');
      const doc = leerDocumento(strFromU8(xml));
      const { renderAsync } = await import('docx-preview');
      // Sin cortar en páginas: así cada párrafo del archivo se dibuja una sola vez.
      await renderAsync(blob, cuerpo, est, {
        className: 'docx',
        inWrapper: true,
        breakPages: false,
        ignoreLastRenderedPageBreak: true,
        renderComments: false,
        renderChanges: false,
        experimental: false,
      });
      if (!vivo) return;

      const dibujados = [...cuerpo.querySelectorAll<HTMLElement>('article p')].filter((p) => !p.parentElement?.closest('p'));
      const parejo = dibujados.length === doc.parrafos.length;
      let j = 0;
      let editables = 0;
      for (const p of dibujados) {
        const texto = p.textContent ?? '';
        let k = -1;
        if (parejo) k = j++;
        else {
          // Si la cuenta no coincide, se empareja solo lo que tiene el mismo texto, un poco más adelante.
          for (let n = j; n < Math.min(j + 8, doc.parrafos.length); n++) {
            if (doc.parrafos[n].editable && doc.parrafos[n].texto === texto && (texto !== '' || n === j)) {
              k = n;
              break;
            }
          }
          if (k !== -1) j = k + 1;
        }
        const par = k === -1 ? null : doc.parrafos[k];
        // Solo se edita si lo que se ve es exactamente lo que el motor leyó del archivo.
        if (par && par.editable && par.texto === texto) {
          p.dataset.idx = String(k);
          hacerEditable(p);
          editables++;
        } else {
          p.classList.add('parrafo-fijo');
          p.title = 'Este párrafo no se puede editar acá. Para cambiarlo, subí el Word de nuevo.';
        }
      }
      estado.current = { zip, doc, quitados: new Set() };
      avisos.current.alListo(editables, dibujados.length - editables);
    })().catch(() => vivo && avisos.current.alError());
    return () => {
      vivo = false;
      estado.current = null;
      cuerpo.replaceChildren();
      est.replaceChildren();
    };
  }, [blob, cuerpo]);

  // Teclado y pegado. Cada párrafo es un campo aparte, así no se rompe la estructura del documento.
  useEffect(() => {
    if (!cuerpo) return;
    const editado = () => avisos.current.alEditar();

    const quitar = (p: HTMLElement) => {
      if (p.dataset.idx) estado.current?.quitados.add(Number(p.dataset.idx));
      p.remove();
      editado();
    };

    const partir = (p: HTMLElement) => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      if (!p.contains(r.startContainer)) return;
      if (!sel.isCollapsed) r.deleteContents();
      const tramo = molde(p);
      const cola = document.createRange();
      cola.selectNodeContents(p);
      cola.setStart(r.startContainer, r.startOffset);
      tramo.textContent = cola.toString();
      cola.deleteContents();
      const nuevo = p.cloneNode(false) as HTMLElement;
      nuevo.removeAttribute('id');
      delete nuevo.dataset.idx;
      // Va después del párrafo original que tiene delante y copia su formato.
      nuevo.dataset.tras = p.dataset.idx ?? p.dataset.tras;
      nuevo.dataset.fuente = p.dataset.idx ?? p.dataset.fuente;
      nuevo.append(tramo);
      p.after(nuevo);
      ponerCursor(nuevo, 0);
      editado();
    };

    const tecla = (e: KeyboardEvent) => {
      const p = parrafoDe(e.target);
      if (!p || e.isComposing) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!e.shiftKey) partir(p);
        return;
      }
      if (e.key !== 'Backspace' || letrasAntes(p) !== 0) return;
      const anterior = p.previousElementSibling as HTMLElement | null;
      const texto = p.textContent ?? '';
      if (anterior?.matches(`p.${EDITABLE}`)) {
        // Al comienzo del párrafo: se une con el anterior.
        e.preventDefault();
        const largo = (anterior.textContent ?? '').length;
        if (texto) {
          const tramo = molde(anterior);
          tramo.textContent = texto;
          anterior.append(tramo);
        }
        quitar(p);
        ponerCursor(anterior, largo);
      } else if (!texto && (p.parentElement?.querySelectorAll(':scope > p').length ?? 0) > 1) {
        // Vacío y sin uno editable arriba: se borra, salvo que sea el único de su celda o de la hoja.
        e.preventDefault();
        const vecino = (p.nextElementSibling as HTMLElement | null)?.matches(`p.${EDITABLE}`) ? (p.nextElementSibling as HTMLElement) : null;
        quitar(p);
        if (vecino) ponerCursor(vecino, 0);
      }
    };

    const antes = (e: InputEvent) => {
      const p = parrafoDe(e.target);
      if (!p) return;
      if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
        // En el celular el Enter llega por acá.
        e.preventDefault();
        partir(p);
      } else if (e.inputType.startsWith('format') || e.inputType === 'insertFromDrop') {
        e.preventDefault();
      }
    };

    const pegar = (e: ClipboardEvent) => {
      if (!parrafoDe(e.target)) return;
      e.preventDefault();
      const texto = limpiar(e.clipboardData?.getData('text/plain') ?? '');
      if (texto) document.execCommand('insertText', false, texto);
    };

    const soltar = (e: DragEvent) => e.preventDefault();

    cuerpo.addEventListener('input', editado);
    cuerpo.addEventListener('keydown', tecla);
    cuerpo.addEventListener('beforeinput', antes);
    cuerpo.addEventListener('paste', pegar);
    cuerpo.addEventListener('drop', soltar);
    return () => {
      cuerpo.removeEventListener('input', editado);
      cuerpo.removeEventListener('keydown', tecla);
      cuerpo.removeEventListener('beforeinput', antes);
      cuerpo.removeEventListener('paste', pegar);
      cuerpo.removeEventListener('drop', soltar);
    };
  }, [cuerpo]);

  return (
    <div className="vista-word editor-word py-4 tab:py-6 px-3 tab:px-6">
      <div ref={estilos} hidden />
      <div className="relative w-fit min-w-full">
        <div ref={setCuerpo} />
      </div>
    </div>
  );
});
EditorWord.displayName = 'EditorWord';

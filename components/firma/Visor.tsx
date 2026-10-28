import React, { useEffect, useRef, useState } from 'react';
// Build legacy: también corre en celulares con navegadores de hace algunos años.
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import trabajador from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = trabajador;

/**
 * Muestra el PDF hoja por hoja dentro de la página, como imágenes. Así quien
 * firma lo lee en la web sin que el navegador lo abra ni lo descargue.
 * Cada hoja se dibuja recién cuando se acerca a la pantalla.
 */
export const Visor: React.FC<{ url: string; titulo: string }> = ({ url, titulo }) => {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [actual, setActual] = useState(1);

  useEffect(() => {
    let vivo = true;
    const tarea = getDocument({ url, isEvalSupported: false });
    tarea.promise.then(
      (d) => vivo && setDoc(d),
      () => vivo && setError(true),
    );
    return () => {
      vivo = false;
      void tarea.destroy();
    };
  }, [url]);

  if (error) {
    return <div className="bg-marfil-oscuro p-8 text-sm text-piedra">No pudimos mostrar el documento. Recargá la página para intentar de nuevo.</div>;
  }

  return (
    <div className="relative bg-[#E7E5DD] px-3 py-4 tab:px-6 tab:py-6 flex flex-col items-center gap-4 tab:gap-6" aria-label={`Documento ${titulo}`}>
      {!doc ? (
        <div className="w-full max-w-[820px] bg-white shadow-[0_1px_4px_rgba(27,31,27,0.15)] flex items-center justify-center" style={{ aspectRatio: '1 / 1.414' }}>
          <span className="eyebrow text-piedra animate-pulse">Cargando el documento</span>
        </div>
      ) : (
        <>
          <span className="sticky top-3 z-10 self-end -mb-10 tab:-mb-12 px-2.5 py-1 bg-tinta/80 text-marfil text-xs tabular-nums">
            {actual} / {doc.numPages}
          </span>
          {Array.from({ length: doc.numPages }, (_, i) => (
            <Hoja key={i} doc={doc} numero={i + 1} alVer={setActual} />
          ))}
        </>
      )}
    </div>
  );
};

const Hoja: React.FC<{ doc: PDFDocumentProxy; numero: number; alVer: (n: number) => void }> = ({ doc, numero, alVer }) => {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [proporcion, setProporcion] = useState(1.414);
  const [cerca, setCerca] = useState(numero <= 2);
  const [lista, setLista] = useState(false);

  // Proporción real de la hoja, para reservar el lugar antes de dibujarla.
  useEffect(() => {
    let vivo = true;
    void doc.getPage(numero).then((p) => {
      const v = p.getViewport({ scale: 1 });
      if (vivo) setProporcion(v.height / v.width);
    });
    return () => {
      vivo = false;
    };
  }, [doc, numero]);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const cargar = new IntersectionObserver(([e]) => e.isIntersecting && setCerca(true), { rootMargin: '800px 0px' });
    // La hoja actual es la que cruza la mitad de la pantalla.
    const visible = new IntersectionObserver(([e]) => e.isIntersecting && alVer(numero), { rootMargin: '-50% 0px -50% 0px' });
    cargar.observe(el);
    visible.observe(el);
    return () => {
      cargar.disconnect();
      visible.disconnect();
    };
  }, [numero, alVer]);

  useEffect(() => {
    if (!cerca) return;
    let vivo = true;
    let tarea: { cancel: () => void } | null = null;
    void doc.getPage(numero).then((p) => {
      const c = lienzo.current;
      const el = caja.current;
      if (!vivo || !c || !el) return;
      // Nitidez según la pantalla, con tope para no gastar memoria en celulares.
      const escala = (el.clientWidth / p.getViewport({ scale: 1 }).width) * Math.min(window.devicePixelRatio || 1, 2);
      const v = p.getViewport({ scale: escala });
      c.width = Math.floor(v.width);
      c.height = Math.floor(v.height);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const r = p.render({ canvasContext: ctx, viewport: v });
      tarea = r;
      r.promise.then(
        () => vivo && setLista(true),
        () => undefined,
      );
    });
    return () => {
      vivo = false;
      tarea?.cancel();
    };
  }, [cerca, doc, numero]);

  return (
    <div ref={caja} className="relative w-full max-w-[820px] bg-white shadow-[0_1px_4px_rgba(27,31,27,0.15)]" style={{ aspectRatio: `1 / ${proporcion}` }}>
      <canvas ref={lienzo} className={`block w-full h-full select-none transition-opacity duration-200 ${lista ? 'opacity-100' : 'opacity-0'}`} onContextMenu={(e) => e.preventDefault()} aria-label={`Hoja ${numero}`} />
    </div>
  );
};

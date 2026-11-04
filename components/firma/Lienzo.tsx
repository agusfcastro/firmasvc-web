import React, { useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';
import { COLOR } from '../../api/_lib/marca';

/**
 * Lienzo para dibujar la firma y firma escrita como imagen. Lo usan quien
 * firma por enlace (FirmarApp) y el titular que firma un recibo en el portal.
 */
/* ------------------------------------------------------------------ */
/* Lienzo para dibujar la firma                                        */
/* ------------------------------------------------------------------ */
const ANCHO_LIENZO = 640;
const ALTO_LIENZO = 220;

export const Lienzo: React.FC<{ alCambiar: (png: string | null) => void }> = ({ alCambiar }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const trazos = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const escala = 2;
    c.width = ANCHO_LIENZO * escala;
    c.height = ALTO_LIENZO * escala;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(escala, escala);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLOR.tinta;
    ctx.lineWidth = 2.4;
  }, []);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ANCHO_LIENZO, y: ((e.clientY - r.top) / r.height) * ALTO_LIENZO };
  };

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* algunos lápices no lo admiten y se dibuja igual */
    }
    dibujando.current = true;
    ultimo.current = punto(e);
    const ctx = ref.current?.getContext('2d');
    if (ctx && ultimo.current) {
      ctx.beginPath();
      ctx.arc(ultimo.current.x, ultimo.current.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.tinta;
      ctx.fill();
    }
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current || !ultimo.current) return;
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
  };

  const terminar = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    trazos.current++;
    alCambiar(ref.current ? recortar(ref.current) : null);
  };

  const borrar = () => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, ANCHO_LIENZO, ALTO_LIENZO);
    trazos.current = 0;
    alCambiar(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative bg-white border border-tinta/22">
        <canvas
          ref={ref}
          aria-label="Espacio para dibujar tu firma"
          className="block w-full touch-none cursor-crosshair"
          style={{ aspectRatio: `${ANCHO_LIENZO} / ${ALTO_LIENZO}` }}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          onPointerCancel={terminar}
        />
        <span aria-hidden="true" className="absolute left-6 right-6 bottom-[22%] border-b border-dashed border-tinta/25 pointer-events-none" />
      </div>
      <div className="flex items-center justify-between text-xs text-piedra">
        <span>Dibujá con el dedo o el mouse.</span>
        <button type="button" onClick={borrar} className="inline-flex items-center gap-1.5 font-medium text-tinta hover:text-bosque">
          <Eraser size={14} aria-hidden="true" /> Borrar
        </button>
      </div>
    </div>
  );
};

/** PNG recortado a lo dibujado, con un margen. Vacío devuelve null. */
function recortar(c: HTMLCanvasElement): string | null {
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const { width, height } = c;
  const datos = ctx.getImageData(0, 0, width, height).data;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (datos[(y * width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  // Un punto suelto no es una firma.
  if (x1 < 0 || x1 - x0 < 40 || (x1 - x0) * (y1 - y0) < 2000) return null;
  const m = 16;
  x0 = Math.max(0, x0 - m);
  y0 = Math.max(0, y0 - m);
  x1 = Math.min(width, x1 + m);
  y1 = Math.min(height, y1 + m);
  const salida = document.createElement('canvas');
  salida.width = x1 - x0;
  salida.height = y1 - y0;
  salida.getContext('2d')?.drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  return salida.toDataURL('image/png');
}

/** El nombre escrito se pasa a imagen para que la constancia lo muestre igual que se vio. */
export function nombreComoImagen(nombre: string): string | null {
  const limpio = nombre.trim();
  if (limpio.length < 2) return null;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const fuente = 'italic 400 88px "Snell Roundhand", "Segoe Script", "Brush Script MT", "Apple Chancery", Georgia, serif';
  ctx.font = fuente;
  const ancho = Math.ceil(ctx.measureText(limpio).width);
  c.width = Math.min(2400, ancho + 64);
  c.height = 150;
  ctx.font = fuente;
  ctx.fillStyle = COLOR.tinta;
  ctx.textBaseline = 'middle';
  ctx.fillText(limpio, 32, 78, c.width - 64);
  return c.toDataURL('image/png');
}


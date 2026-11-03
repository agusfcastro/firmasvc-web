import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, FileText, Play, X } from 'lucide-react';
import retrato from '../../assets/brand/retrato.jpg';
import { Enlace } from './ui';
import { fechaLarga, formatoDe } from './descargas';
import type { Documento } from './tipos';

/**
 * Tarjeta de un protocolo con el diseño de los posteos de @agustin.legales: fondo tinta, volanta en
 * pastilla, título en Archivo pesada, firma de Agustín y un círculo grande que dice qué pasa al tocarla
 * (play para los videos, flecha para los documentos).
 */

/** Dirección para incrustar un video de YouTube, Vimeo o Loom, o el mp4 tal cual. null si el enlace no es un video. */
export function videoDe(url: string | null | undefined): { tipo: 'iframe' | 'mp4'; src: string } | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url, window.location.origin);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (/\.mp4$/i.test(u.pathname)) return { tipo: 'mp4', src: u.href };
  if (host === 'youtu.be') return { tipo: 'iframe', src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0` };
  if (host.endsWith('youtube.com')) {
    const id = u.searchParams.get('v') ?? u.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/)?.[1];
    return id ? { tipo: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const partes = u.pathname.split('/').filter(Boolean).filter((p) => p !== 'video');
    const [id, h] = partes;
    if (!id || !/^\d+$/.test(id)) return null;
    return { tipo: 'iframe', src: `https://player.vimeo.com/video/${id}?autoplay=1${h ? `&h=${h}` : ''}` };
  }
  if (host.endsWith('loom.com')) {
    const id = u.pathname.match(/\/(?:share|embed)\/([\w-]+)/)?.[1];
    return id ? { tipo: 'iframe', src: `https://www.loom.com/embed/${id}?autoplay=1` } : null;
  }
  return null;
}

const VisorVideo: React.FC<{ titulo: string; video: { tipo: 'iframe' | 'mp4'; src: string }; alCerrar: () => void }> = ({ titulo, video, alCerrar }) => {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cerrarRef.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    const desborde = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = desborde;
    };
  }, [alCerrar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/80 p-3 tab:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}
    >
      <div className="w-full max-w-[1100px] overflow-hidden rounded-[20px] bg-tinta text-marfil">
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-marfil/10">
          <span className="font-bold tracking-[-0.01em] truncate">{titulo}</span>
          <button ref={cerrarRef} type="button" onClick={alCerrar} aria-label="Cerrar el video" className="h-10 w-10 shrink-0 grid place-items-center rounded-[10px] hover:bg-marfil/10">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="aspect-video bg-black">
          {video.tipo === 'mp4' ? (
            <video className="block w-full h-full" src={video.src} controls autoPlay playsInline preload="metadata" />
          ) : (
            <iframe className="block w-full h-full" src={video.src} title={titulo} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          )}
        </div>
      </div>
    </div>
  );
};

export const TarjetaProtocolo: React.FC<{
  doc: Documento;
  areas: Record<string, string>;
  /** Descarga el archivo. Devuelve cuando terminó. */
  alDescargar: (d: Documento) => void;
  /** Se llama al abrir un video o un enlace, para la bitácora. */
  alAbrir: (d: Documento) => void;
  bajando: boolean;
}> = ({ doc, areas, alDescargar, alAbrir, bajando }) => {
  const [viendo, setViendo] = useState(false);
  const video = videoDe(doc.url);
  const enSitio = Boolean(doc.url?.startsWith('/'));
  const volanta = video ? 'Video' : doc.url ? formatoDe(doc) : 'Protocolo escrito';
  const accion = video ? `Ver el video ${doc.titulo}` : doc.archivo_ruta ? `Descargar ${doc.titulo}` : `Abrir ${doc.titulo}`;
  const nombresAreas = doc.areas.map((a) => areas[a] ?? a);

  const contenido = (
    <>
      {/* Franja diagonal más clara detrás del círculo, como en la tarjeta del posteo */}
      <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[34%] bg-grafito/70 [clip-path:polygon(28%_0,100%_0,100%_100%,0_100%)]" />
      <span className="relative flex flex-col gap-4 min-w-0 flex-1 p-6 desk:p-7">
        <span className="self-start inline-flex items-center h-7 px-3 rounded-pastilla bg-marfil text-tinta text-[11px] font-semibold uppercase tracking-[0.16em] [font-stretch:125%]">{volanta}</span>
        <span className="text-[22px] desk:text-[26px] leading-[1.08] font-extrabold tracking-[-0.035em] text-marfil text-left">{doc.titulo}</span>
        {doc.descripcion && <span className="text-[14px] leading-[1.5] text-calido text-left line-clamp-2">{doc.descripcion}</span>}
        <span className="mt-auto pt-2 flex items-center gap-3">
          <img src={retrato} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
          <span className="flex flex-col leading-tight text-left">
            <span className="text-[14px] font-bold text-marfil">Agustín Castro</span>
            <span className="text-[13px] text-calido">Abogado · firma</span>
          </span>
        </span>
      </span>
      <span className="relative shrink-0 self-center mr-6 desk:mr-8 w-[72px] h-[72px] desk:w-[96px] desk:h-[96px] rounded-full bg-marfil text-tinta grid place-items-center transition-transform duration-200 group-hover:scale-105">
        {video ? (
          <Play size={30} fill="currentColor" strokeWidth={0} aria-hidden="true" className="ml-1" />
        ) : doc.archivo_ruta ? (
          <ArrowDown size={30} strokeWidth={2} aria-hidden="true" />
        ) : doc.url ? (
          <ArrowUpRight size={30} strokeWidth={2} aria-hidden="true" />
        ) : (
          <FileText size={28} strokeWidth={1.75} aria-hidden="true" />
        )}
      </span>
    </>
  );

  const clase = 'group relative w-full flex-1 min-h-[240px] flex items-stretch overflow-hidden rounded-[24px] bg-tinta text-marfil shadow-relieve transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-70';

  return (
    <article className="flex flex-col gap-3 h-full">
      {video ? (
        <button
          type="button"
          className={clase}
          aria-label={accion}
          onClick={() => {
            setViendo(true);
            alAbrir(doc);
          }}
        >
          {contenido}
        </button>
      ) : doc.archivo_ruta ? (
        <button type="button" className={clase} aria-label={accion} onClick={() => alDescargar(doc)} disabled={bajando}>
          {contenido}
        </button>
      ) : doc.url && enSitio ? (
        <Enlace a={doc.url} className={clase} aria-label={accion} onClick={() => alAbrir(doc)}>
          {contenido}
        </Enlace>
      ) : doc.url ? (
        <a href={doc.url} target="_blank" rel="noopener noreferrer" className={clase} aria-label={accion} onClick={() => alAbrir(doc)}>
          {contenido}
        </a>
      ) : (
        <div className={clase}>{contenido}</div>
      )}
      <p className="px-1 text-[13px] text-piedra">
        {bajando ? 'Preparando la descarga…' : [nombresAreas.length ? `Para ${nombresAreas.join(' y ')}` : 'Para todo el equipo', `actualizado el ${fechaLarga(doc.actualizado_en)}`].join(' · ')}
      </p>
      {viendo && video && <VisorVideo titulo={doc.titulo} video={video} alCerrar={() => setViendo(false)} />}
    </article>
  );
};

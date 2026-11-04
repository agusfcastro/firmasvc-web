import React, { useEffect, useRef, useState } from 'react';
import { Play, X } from 'lucide-react';
import retrato from '../../assets/brand/retrato.jpg';

/**
 * Videos de los protocolos. El visor se abre sobre la página y la tarjeta tiene el diseño de los
 * posteos de @agustin.legales: fondo tinta, volanta en pastilla, título en Archivo pesada, firma de
 * Agustín y el círculo de play. Lo usan el motor, el protocolo de llamadas y el portal.
 */

/** Dirección para incrustar un video de YouTube, Vimeo o Loom, o el mp4 tal cual. null si el enlace no es un video. */
export function videoDe(url: string | null | undefined): { tipo: 'iframe' | 'mp4'; src: string } | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url, typeof window === 'undefined' ? 'https://www.firmasvc.com' : window.location.origin);
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

export const VisorVideo: React.FC<{ titulo: string; video: { tipo: 'iframe' | 'mp4'; src: string }; alCerrar: () => void }> = ({ titulo, video, alCerrar }) => {
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

/** Tarjeta de video. «grande» va en la portada del protocolo y «compacta» arriba de una sección. */
export const TarjetaVideo: React.FC<{ url: string; titulo: string; volanta?: string; tamano?: 'grande' | 'compacta' }> = ({
  url,
  titulo,
  volanta = 'Video',
  tamano = 'compacta',
}) => {
  const [viendo, setViendo] = useState(false);
  const video = videoDe(url);
  if (!video) return null;
  const grande = tamano === 'grande';

  return (
    <>
      <button
        type="button"
        onClick={() => setViendo(true)}
        aria-label={`Ver el video ${titulo}`}
        className={`group relative w-full flex items-stretch overflow-hidden rounded-[24px] bg-tinta text-marfil text-left shadow-relieve ring-1 ring-marfil/10 transition-transform duration-200 hover:-translate-y-0.5 ${grande ? 'min-h-[220px]' : 'min-h-[132px]'}`}
      >
        <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[34%] bg-grafito/70 [clip-path:polygon(28%_0,100%_0,100%_100%,0_100%)]" />
        <span className={`relative flex flex-col min-w-0 flex-1 ${grande ? 'gap-4 p-6 desk:p-7' : 'gap-2.5 p-5'}`}>
          <span className="self-start inline-flex items-center h-7 px-3 rounded-pastilla bg-marfil text-tinta text-[11px] font-semibold uppercase tracking-[0.16em] [font-stretch:125%]">{volanta}</span>
          <span className={`font-extrabold tracking-[-0.035em] text-marfil ${grande ? 'text-[22px] desk:text-[26px] leading-[1.08]' : 'text-[18px] leading-[1.15]'}`}>{titulo}</span>
          <span className="mt-auto pt-1 flex items-center gap-3">
            <img src={retrato} alt="" className={`${grande ? 'w-11 h-11' : 'w-8 h-8'} rounded-full object-cover shrink-0`} />
            <span className="flex flex-col leading-tight">
              <span className={`${grande ? 'text-[14px]' : 'text-[13px]'} font-bold text-marfil`}>Agustín Castro</span>
              <span className={`${grande ? 'text-[13px]' : 'text-[12px]'} text-calido`}>Abogado · firma</span>
            </span>
          </span>
        </span>
        <span
          className={`relative shrink-0 self-center rounded-full bg-marfil text-tinta grid place-items-center transition-transform duration-200 group-hover:scale-105 ${grande ? 'mr-6 desk:mr-8 w-[72px] h-[72px] desk:w-[96px] desk:h-[96px]' : 'mr-5 w-14 h-14'}`}
        >
          <Play size={grande ? 30 : 22} fill="currentColor" strokeWidth={0} aria-hidden="true" className="ml-1" />
        </span>
      </button>
      {viendo && <VisorVideo titulo={titulo} video={video} alCerrar={() => setViendo(false)} />}
    </>
  );
};

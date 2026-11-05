import React, { useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import retrato from '../assets/brand/retrato.jpg';

const VIDEO_ID = '1236858475';

// autoplay=1 + muted=1 es la única combinación que respetan los navegadores.
// Vimeo acepta comandos vía postMessage, así que al click le pedimos que quite
// el mute y suba el volumen sin reiniciar el video.
// title/byline/portrait=0 ocultan la info de Vimeo y dnt=1 evita cookies de seguimiento.
const EMBED_URL = `https://player.vimeo.com/video/${VIDEO_ID}?autoplay=1&muted=1&playsinline=1&title=0&byline=0&portrait=0&dnt=1`;

/** VSL del hero: va debajo del titular, a la vista sin scroll, así que carga de entrada. */
export const VideoVSL: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);

  const handleUnmute = () => {
    const player = iframeRef.current?.contentWindow;
    const send = (method: string, value?: unknown) =>
      player?.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), 'https://player.vimeo.com');
    send('setMuted', false);
    send('setVolume', 1);
    // Algunos navegadores requieren play tras un gesto para asegurar sonido
    send('play');
    setMuted(false);
  };

  return (
    // El ancho sale del alto de la pantalla: titular, video y botón de agendar tienen que entrar sin scroll.
    // El video manda: ocupa el alto que dejan header, banner, volanta, titular y bajada, más la firma y el botón de agendar (560px), entre 560 y 1000px de ancho.
    <div className="w-full mx-auto" style={{ maxWidth: 'min(1000px, max(560px, calc((100svh - 560px) * 16 / 9)))' }}>
      <div className="relative aspect-video bg-carbon overflow-hidden rounded-[24px] shadow-relieve">
        {/* En el HTML del prerender va solo el recuadro: el reproductor carga una vez, en el navegador. */}
        {typeof window !== 'undefined' && (
          <iframe
            ref={iframeRef}
            src={EMBED_URL}
            title="Conocé a Agustín, fundador de firma"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        )}

        {/* Overlay de unmute — se desvanece al click */}
        <button
          type="button"
          onClick={handleUnmute}
          aria-label="Activar sonido"
          aria-hidden={!muted}
          className={`absolute inset-0 flex flex-col items-center justify-center gap-5 text-marfil transition-opacity duration-500 group focus:outline-none ${
            muted ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ background: 'color-mix(in srgb, var(--color-tinta) 45%, transparent)', backdropFilter: 'blur(2px)' }}
        >
          <span
            className="flex items-center justify-center rounded-full bg-marfil text-tinta shadow-xl transition-transform duration-200 group-hover:scale-105 group-focus-visible:scale-105"
            style={{ width: 'clamp(72px, 8vw, 104px)', height: 'clamp(72px, 8vw, 104px)' }}
          >
            <Volume2 size={36} aria-hidden="true" />
          </span>
          <span
            className="font-heading font-extrabold tracking-[-0.02em] text-center px-6"
            style={{ fontSize: 'clamp(18px, 2.4vw, 24px)', textShadow: '0 1px 10px color-mix(in srgb, var(--color-tinta) 40%, transparent)' }}
          >
            Hacé click para activar el sonido
          </span>
        </button>
      </div>

      {/* Firma como en los posteos, con foto, nombre y cargo. */}
      <div className="flex items-center pt-4 text-left">
        <span className="flex items-center gap-3">
          <img src={retrato} alt="" width={44} height={44} className="w-11 h-11 rounded-full object-cover shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold text-tinta">Agustín Castro</span>
            <span className="text-[13px] text-piedra">Abogado (UBA) · fundador de firma</span>
          </span>
        </span>
      </div>
    </div>
  );
};

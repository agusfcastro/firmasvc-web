import React, { useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import retrato from '../assets/brand/retrato.jpg';
import { Logo } from './Logo';

const VIDEO_ID = '1236858475';

// autoplay=1 + muted=1 es la única combinación que respetan los navegadores.
// Vimeo acepta comandos vía postMessage, así que al click le pedimos que quite
// el mute y suba el volumen sin reiniciar el video.
// title/byline/portrait=0 ocultan la info de Vimeo, controls=0 saca la barra del reproductor
// y dnt=1 evita cookies de seguimiento.
const EMBED_URL = `https://player.vimeo.com/video/${VIDEO_ID}?autoplay=1&muted=1&playsinline=1&title=0&byline=0&portrait=0&dnt=1&controls=0`;

/**
 * VSL del hero: va debajo del titular, a la vista sin scroll, así que carga de entrada.
 *
 * Va sin la barra del reproductor de Vimeo y sin forma de pausarlo, en el home y en
 * /landing: una vez que se activa el sonido, corre hasta el final.
 *
 * conLogo es para /landing, que no tiene encabezado: el logo va a la derecha de la
 * firma de Agustín y lleva al home.
 */
export const VideoVSL: React.FC<{ conLogo?: boolean }> = ({ conLogo = false }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);

  const send = (method: string, value?: unknown) =>
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify(value === undefined ? { method } : { method, value }),
      'https://player.vimeo.com',
    );

  const handleUnmute = () => {
    send('setMuted', false);
    send('setVolume', 1);
    // Algunos navegadores requieren play tras un gesto para asegurar sonido
    send('play');
    setMuted(false);
  };

  return (
    // Ocupa el ancho de su columna: en desktop va al costado de la promesa y en celular debajo.
    <div className="w-full mx-auto">
      <div className="relative aspect-video bg-carbon overflow-hidden rounded-[24px] shadow-relieve">
        {/* En el HTML del prerender va solo el recuadro: el reproductor carga una vez, en el navegador. */}
        {typeof window !== 'undefined' && (
          <iframe
            ref={iframeRef}
            src={EMBED_URL}
            title="Conocé a Agustín, fundador de firma"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            // No recibe clicks ni foco, así no se pausa con el mouse ni con el teclado.
            tabIndex={-1}
            className="absolute inset-0 w-full h-full pointer-events-none"
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
      <div className="flex items-center justify-between gap-4 pt-4 text-left">
        <span className="flex items-center gap-3 min-w-0">
          <img src={retrato} alt="" width={44} height={44} className="w-11 h-11 rounded-full object-cover shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold text-tinta">Agustín Castro</span>
            <span className="text-[13px] text-piedra">Abogado especialista en negocios digitales</span>
          </span>
        </span>
        {conLogo && (
          <a href="/" aria-label="Ir al inicio de firma" className="shrink-0">
            <Logo className="h-9 desk:h-11 max-w-[32vw]" />
          </a>
        )}
      </div>
    </div>
  );
};

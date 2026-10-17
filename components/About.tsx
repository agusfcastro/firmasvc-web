import React, { useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { Reveal } from './Reveal';

const VIDEO_ID = '1236858475';

// autoplay=1 + muted=1 es la única combinación que respetan los navegadores.
// Vimeo acepta comandos vía postMessage, así que al click le pedimos que quite
// el mute y suba el volumen sin reiniciar el video.
// title/byline/portrait=0 ocultan la info de Vimeo y dnt=1 evita cookies de seguimiento.
const EMBED_URL = `https://player.vimeo.com/video/${VIDEO_ID}?autoplay=1&muted=1&playsinline=1&title=0&byline=0&portrait=0&dnt=1`;

export const About: React.FC = () => {
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
    <section id="about" className="pb-[88px]">
      <div className="wrap">
        <Reveal className="max-w-[960px] mx-auto">
          <div className="relative aspect-video bg-carbon overflow-hidden">
            <iframe
              ref={iframeRef}
              src={EMBED_URL}
              title="Conocé a Agustín, fundador de firma"
              loading="lazy"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />

            {/* Overlay de unmute — se desvanece al click */}
            <button
              type="button"
              onClick={handleUnmute}
              aria-label="Activar sonido"
              aria-hidden={!muted}
              className={`absolute inset-0 flex flex-col items-center justify-center gap-5 text-marfil transition-opacity duration-500 group focus:outline-none ${
                muted ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              style={{ background: 'rgba(27,31,27,0.45)', backdropFilter: 'blur(2px)' }}
            >
              <span
                className="flex items-center justify-center rounded-full bg-bosque text-marfil shadow-xl transition-transform duration-200 group-hover:scale-110 group-focus-visible:scale-110"
                style={{ width: 76, height: 76 }}
              >
                <Volume2 size={34} />
              </span>
              <span
                className="font-heading font-bold text-center px-6"
                style={{ fontSize: 'clamp(18px, 2.4vw, 24px)', textShadow: '0 1px 10px rgba(0,0,0,0.4)' }}
              >
                Hacé click para activar el sonido
              </span>
            </button>
          </div>

          <div className="flex flex-wrap justify-between gap-4 pt-3.5 text-[13px] text-piedra">
            <span>Conocé a Agustín, fundador de firma</span>
            <span className="eyebrow text-[11px]">Resultados reales. Más allá de la formalidad.</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

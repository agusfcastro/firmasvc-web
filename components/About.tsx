import React, { useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { Reveal } from './Reveal';

const VIDEO_ID = 'qGvMQqbjQJs';

// autoplay=1 + mute=1 es la única combinación que respetan los navegadores.
// enablejsapi=1 nos permite dispararle unMute() vía postMessage cuando el usuario
// hace click, sin reiniciar el video.
const EMBED_URL = `https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;

export const About: React.FC = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);

  const handleUnmute = () => {
    iframeRef.current?.contentWindow?.postMessage(
      '{"event":"command","func":"unMute","args":""}',
      '*',
    );
    // Doble-tap: algunos navegadores requieren playVideo tras un gesto para asegurar sonido
    iframeRef.current?.contentWindow?.postMessage(
      '{"event":"command","func":"playVideo","args":""}',
      '*',
    );
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
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
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

import React from 'react';
import { Reveal } from './Reveal';

import ogPoster from '../assets/brand/og.png';

// El MP4 vive en public/video/ (no pasa por el bundler) para poder reemplazarlo sin rebuild.
const VIDEO_SRC = '/video/presentacion.mp4';

export const About: React.FC = () => {
  return (
    <section id="about" className="pb-[88px]">
      <div className="wrap">
        <Reveal className="max-w-[960px] mx-auto">
          <div className="relative aspect-video bg-carbon overflow-hidden">
            <video
              src={VIDEO_SRC}
              poster={ogPoster}
              controls
              preload="metadata"
              playsInline
              className="absolute inset-0 w-full h-full object-cover bg-carbon"
            />
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

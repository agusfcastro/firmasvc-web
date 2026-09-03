import React from 'react';
import { Reveal } from './Reveal';

import brauniLogo from '../assets/clients/mono/brauni.png';
import f14Logo from '../assets/clients/mono/f14.png';
import exportingExpertsLogo from '../assets/clients/mono/exportingexperts.png';
import realPlusLogo from '../assets/clients/mono/realplus.png';
import aumentaTuValorLogo from '../assets/clients/mono/aumentatuvalor.png';
import nexusLogo from '../assets/clients/mono/nexus.png';
import cocinaEmprendedoraLogo from '../assets/clients/mono/cocinaempre.png';
import ecomProjectLogo from '../assets/clients/mono/ecom-project.png';
import momentumLogo from '../assets/clients/mono/momentum.png';
import circulosLogo from '../assets/clients/mono/circulos.png';
import testoBoostLogo from '../assets/clients/mono/testoboost.png';

interface Client {
  name: string;
  logo: string;
  /** Sin url el logo se muestra igual, pero como tile no clickeable */
  url?: string;
}

const clients: Client[] = [
  { name: 'Brauni', logo: brauniLogo, url: 'https://brauni.io' },
  { name: 'f14 studio', logo: f14Logo, url: 'https://www.instagram.com/f14.studio/' },
  { name: 'Exporting Experts', logo: exportingExpertsLogo, url: 'https://www.instagram.com/nicolasbartoli.experts/' },
  { name: 'Real+', logo: realPlusLogo, url: 'https://www.instagram.com/alejo.growth/' },
  { name: 'Aumenta Tu Valor', logo: aumentaTuValorLogo, url: 'https://www.instagram.com/juanxcarrizo/' },
  { name: 'Nexus', logo: nexusLogo, url: 'https://www.instagram.com/facundoledesma.ok/' },
  { name: 'Cocina Emprendedora', logo: cocinaEmprendedoraLogo, url: 'https://www.instagram.com/cocinaemprendedora.arg/' },
  { name: 'E-com Project', logo: ecomProjectLogo, url: 'https://ecom-project.com' },
  { name: 'Momentum Tank', logo: momentumLogo, url: 'https://momentumtank.com' },
  { name: 'Círculos', logo: circulosLogo },
  { name: 'Testo Boost', logo: testoBoostLogo, url: 'https://testoboostoficial.com/' },
];

// Tripled so the seam never appears even on very wide screens
const track = [...clients, ...clients, ...clients];

export const Testimonials: React.FC = () => {
  return (
    <section id="testimonials" className="section rule">
      <Reveal>
        <div className="wrap flex flex-col items-center gap-3 text-center mb-12">
          <p className="eyebrow text-piedra">Negocios que confían en nosotros</p>
          <h2 className="h2">Clientes de la firma</h2>
        </div>
      </Reveal>

      {/* Marquee: los logos monocromo se leen como un friso, sin marcos ni fondos */}
      <div
        className="marquee-container relative overflow-hidden"
        style={{
          maskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
        }}
      >
        <div className="marquee-track flex gap-6 w-max">
          {track.map((client, i) => {
            const tileClass = 'flex-none w-48 h-22 flex items-center justify-center px-6 py-[18px] group';
            const logo = (
              <img
                src={client.logo}
                alt={`Logo ${client.name}`}
                loading="lazy"
                decoding="async"
                className="max-w-full max-h-full object-contain opacity-85 transition-opacity duration-150 group-hover:opacity-100"
              />
            );

            return client.url ? (
              <a
                key={i}
                href={client.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={client.name}
                className={tileClass}
              >
                {logo}
              </a>
            ) : (
              <div key={i} aria-label={client.name} className={tileClass}>
                {logo}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

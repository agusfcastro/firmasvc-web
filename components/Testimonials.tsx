import React from 'react';
import { Reveal } from './Reveal';

import brauniLogo from '../assets/clients/brauni.png';
import f14Logo from '../assets/clients/f14.jpg';
import exportingExpertsLogo from '../assets/clients/exportingexperts.png';
import realPlusLogo from '../assets/clients/realplus.png';

interface Client {
  name: string;
  logo: string;
  bg: string;
  url: string;
}

const clients: Client[] = [
  {
    name: 'Brauni',
    logo: brauniLogo,
    bg: '#000000',
    url: 'https://brauni.io',
  },
  {
    name: 'f14 studio',
    logo: f14Logo,
    bg: '#000000',
    url: 'https://www.instagram.com/f14.studio/',
  },
  {
    name: 'Exporting Experts',
    logo: exportingExpertsLogo,
    bg: '#FFFFFF',
    url: 'https://www.instagram.com/nicolasbartoli.experts/',
  },
  {
    name: 'Real+',
    logo: realPlusLogo,
    bg: '#7B1535',
    url: 'https://www.instagram.com/alejo.growth/',
  },
];

// Tripled so the seam never appears even on very wide screens
const track = [...clients, ...clients, ...clients];

export const Testimonials: React.FC = () => {
  return (
    <section id="testimonials" className="py-20 bg-gray-50">
      {/* Heading */}
      <Reveal>
        <div className="container mx-auto px-4 md:px-6 mb-14 text-center">
          <p className="text-sm font-bold text-firma uppercase tracking-widest mb-3">
            Negocios que confían en nosotros
          </p>
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900">Clientes de la firma</h3>
        </div>
      </Reveal>

      {/* Marquee */}
      <div className="marquee-container relative overflow-hidden">
        {/* Fade masks on both edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-28 z-10 bg-gradient-to-r from-gray-50 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-28 z-10 bg-gradient-to-l from-gray-50 to-transparent" />

        <div className="marquee-track flex">
          {track.map((client, i) => (
            <a
              key={i}
              href={client.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={client.name}
              className="mx-4 flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg shadow-sm overflow-hidden p-4"
              style={{
                width: '192px',
                height: '88px',
                background: client.bg,
                border: client.bg === '#FFFFFF' ? '1px solid #e5e7eb' : 'none',
              }}
            >
              <img
                src={client.logo}
                alt={`Logo ${client.name}`}
                loading="lazy"
                decoding="async"
                className="max-w-full max-h-full object-contain"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

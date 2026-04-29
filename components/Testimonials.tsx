import React from 'react';

interface Client {
  name: string;
  bg: string;
  color: string;
  url: string;
  /** Optional secondary line for long names */
  sub?: string;
}

const clients: Client[] = [
  {
    name: 'Brauni',
    bg: '#000000',
    color: '#FFFFFF',
    url: 'https://brauni.io',
  },
  {
    name: 'f14',
    sub: 'studio',
    bg: '#0A0A0A',
    color: '#FFFFFF',
    url: 'https://www.instagram.com/f14.studio/',
  },
  {
    name: 'Exporting',
    sub: 'Experts',
    bg: '#FFFFFF',
    color: '#111111',
    url: 'https://www.instagram.com/nicolasbartoli.experts/',
  },
  {
    name: 'Real+',
    bg: '#7B1535',
    color: '#FFFFFF',
    url: 'https://www.instagram.com/alejo.growth/',
  },
];

// Tripled so the seam never appears even on very wide screens
const track = [...clients, ...clients, ...clients];

export const Testimonials: React.FC = () => {
  return (
    <section id="testimonials" className="py-20 bg-gray-900 text-white">
      {/* Heading */}
      <div className="container mx-auto px-4 md:px-6 mb-14 text-center">
        <p className="text-sm font-bold text-firma-light uppercase tracking-widest mb-3">
          Negocios que confían en nosotros
        </p>
        <h3 className="text-3xl md:text-4xl font-bold">Clientes de la firma</h3>
      </div>

      {/* Marquee */}
      <div className="marquee-container relative overflow-hidden">
        {/* Fade masks on both edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-28 z-10 bg-gradient-to-r from-gray-900 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-28 z-10 bg-gradient-to-l from-gray-900 to-transparent" />

        <div className="marquee-track flex">
          {track.map((client, i) => (
            <a
              key={i}
              href={client.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${client.name}${client.sub ? ' ' + client.sub : ''}`}
              className="mx-4 flex-shrink-0 flex flex-col items-center justify-center rounded-xl transition-transform duration-300 hover:scale-105 hover:ring-2 hover:ring-white/20"
              style={{
                width: '192px',
                height: '88px',
                background: client.bg,
                color: client.color,
                border: client.bg === '#FFFFFF' ? '1px solid #d1d5db' : 'none',
              }}
            >
              <span className="font-bold text-xl tracking-tight leading-none">
                {client.name}
              </span>
              {client.sub && (
                <span className="font-medium text-sm tracking-widest uppercase mt-1 opacity-80">
                  {client.sub}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

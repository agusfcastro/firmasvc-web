import React from 'react';
import { Reveal } from './Reveal';

import retrato from '../assets/brand/retrato.png';

const links = [
  { name: '@agustin.legales', href: 'https://instagram.com/agustin.legales' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/agusfcastro/' },
  { name: 'YouTube', href: 'https://www.youtube.com/@agusfcastro' },
];

const body = [
  'Antes de ser abogado tuve una agencia.',
  'Vendí, cobré, perseguí pagos, armé equipos con amigos y desconocidos. Entregué trabajos y me quedé mirando el teléfono esperando esa transferencia que nunca llegó. Tuve clientes que desaparecieron después de recibir todo lo que pidieron, socios que se bajaron del barco y me apretaron con amenazas más de una vez. El problema nunca fue el dinero, sino la impotencia.',
  'También aprendí algo menos obvio. Pensar en lo que puede salir mal es tan importante como pensar en lo que puede salir bien. Quebré.',
  'En ese momento no entendí nada de esto. Los puntos no se conectan hacia adelante. Se conectan mirando para atrás, dándosela contra la pared.',
  'Hoy, del otro lado del mostrador, lo veo todo más claro. Algunos dicen que lo que separa a los que llegan de los que quedan en el camino es la perseverancia. Aguantar el mes malo, el cliente que se va, la idea que no funcionó.',
  'Pero los dos sabemos que no alcanza. Y por eso estás acá.',
];

export const Letter: React.FC = () => {
  return (
    <section id="quien" className="section rule">
      <div className="wrap grid grid-cols-1 desk:grid-cols-[5fr_7fr] gap-8 desk:gap-16 items-stretch">
        <Reveal className="h-full">
          {/* La carta es larga: el retrato queda sticky para acompañarla sin
              forzar un recorte vertical raro y que las columnas cierren parejas. */}
          <div className="h-full">
            <div className="desk:sticky desk:top-[132px] aspect-[4/5] max-w-[420px] bg-carbon overflow-hidden">
              <img
                src={retrato}
                alt="Agustín Castro"
                className="w-full h-full object-cover object-top block"
                style={{ filter: 'grayscale(1) contrast(1.05)' }}
              />
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="flex flex-col gap-6">
            <p className="eyebrow text-piedra">Carta a dueños de negocio</p>
            <h2 className="h2">Querido dueño de negocio,</h2>

            {body.map((paragraph, i) => (
              <p
                key={i}
                className={`text-base leading-[1.65] max-w-[58ch] ${i === 0 ? '' : 'text-piedra'}`}
              >
                {paragraph}
              </p>
            ))}

            <p
              className="font-heading font-bold leading-[1.3] max-w-[34ch]"
              style={{ fontSize: 'clamp(20px,2.2vw,26px)' }}
            >
              Lo que construiste te costó demasiado como para dejarlo apoyado en la confianza.
            </p>
            <p
              className="font-heading font-bold leading-[1.3]"
              style={{ fontSize: 'clamp(20px,2.2vw,26px)' }}
            >
              Estás a una firma de distancia.
            </p>

            <div className="flex flex-col gap-1 text-sm text-piedra">
              <span className="text-tinta font-medium">Agustín Castro</span>
              <span>Founder &amp; Partner</span>
            </div>

            <div className="flex flex-wrap gap-6">
              {links.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium underline underline-offset-4 transition-colors duration-150 hover:text-bosque"
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

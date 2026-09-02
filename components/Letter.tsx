import React from 'react';
import { Reveal } from './Reveal';

import retrato from '../assets/brand/retrato.png';

const links = [
  { name: '@agustin.legales', href: 'https://instagram.com/agustin.legales' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/agusfcastro/' },
  { name: 'YouTube', href: 'https://www.youtube.com/@agusfcastro' },
];

export const Letter: React.FC = () => {
  return (
    <section id="quien" className="section rule">
      <div className="wrap grid grid-cols-1 desk:grid-cols-[5fr_7fr] gap-8 desk:gap-16 items-start">
        <Reveal>
          <div className="relative aspect-[4/5] max-w-[420px] bg-carbon overflow-hidden">
            <img
              src={retrato}
              alt="Agustín Castro"
              className="w-full h-full object-cover object-top block"
              style={{ filter: 'grayscale(1) contrast(1.05)' }}
            />
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="flex flex-col gap-6">
            <p className="eyebrow text-piedra">Carta a dueños de negocio</p>
            <h2 className="h2">Hola, soy Agustín Castro.</h2>
            <p className="text-[17px] leading-[1.6] max-w-[52ch]">
              Abogado (UBA) y docente universitario. Antes de ejercer construí una agencia de marketing y otros
              proyectos propios. Sé lo que es cobrar tarde, perder un cliente por un malentendido y armar un equipo
              sin saber qué papel firmarle a cada uno.
            </p>
            <p className="text-[17px] leading-[1.6] max-w-[52ch] text-piedra">
              Por eso Firma piensa como los negocios que asesora: primero la operación, después el derecho. Lo que
              enseño en el aula lo aplico en tu contrato, y lo que aprendí emprendiendo lo uso para que no repitas
              mis errores.
            </p>
            <p
              className="font-heading font-bold leading-[1.3] max-w-[30ch]"
              style={{ fontSize: 'clamp(20px,2.2vw,26px)' }}
            >
              Construiste algo que vale la pena defender. Hagamos que crezca sin que nadie te lo pueda discutir.
            </p>
            <p className="text-sm text-piedra">— Agustín</p>
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

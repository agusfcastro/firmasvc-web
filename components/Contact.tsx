import React from 'react';
import { Button } from './Button';
import { Reveal } from './Reveal';
import { openCalendly } from '../lib/calendly';

import simboloOscuro from '../assets/brand/simbolo-oscuro.png';

const WHATSAPP_URL =
  'https://wa.me/5491124617035?text=Hola%20Agust%C3%ADn,%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios.';

export const Contact: React.FC = () => {
  return (
    <section id="contact" className="section rule">
      <div className="wrap grid grid-cols-1 desk:grid-cols-[7fr_5fr] gap-10 desk:gap-16 desk:items-center">
        <Reveal>
          <div className="flex flex-col gap-6">
            <h2 className="h2 contact-heading">
              Poner orden en tu negocio
              <br />
              está a una <span className="text-bosque">firma</span> de distancia.
            </h2>
            <p className="text-[17px] leading-[1.55] text-piedra max-w-[46ch]">
              Una llamada de 30 minutos puede cambiar el rumbo legal de tu negocio. Es momento de tomarte en serio.
            </p>
            <div className="flex flex-col gap-2.5 text-[15px] font-medium">
              <a
                href="mailto:agustin@firmasvc.com"
                className="underline underline-offset-4 w-fit transition-colors duration-150 hover:text-bosque"
              >
                agustin@firmasvc.com
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 w-fit transition-colors duration-150 hover:text-bosque"
              >
                +54 9 11 2461-7035 · WhatsApp
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="bg-carbon text-marfil px-8 py-10 flex flex-col items-start gap-5">
            <img src={simboloOscuro} alt="" aria-hidden="true" className="h-[22px] w-auto" />
            <h3 className="h3">Agendá tu llamada</h3>
            <p className="text-[15px] leading-[1.5] text-calido">
              Seleccioná un horario disponible. Te enviamos un enlace de Google Meet.
            </p>
            <Button fullWidth onClick={openCalendly}>
              Ver disponibilidad
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

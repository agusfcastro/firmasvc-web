import React from 'react';
import { ArrowRight, Briefcase, CalendarDays, FileSignature, Users } from 'lucide-react';
import { Reveal } from './Reveal';

/**
 * Qué es el portal de clientes y para qué usa Google Calendar. Lo pide la verificación de Google:
 * la página principal tiene que explicar qué hace la app y enlazar la política de privacidad.
 */
const funciones = [
  {
    titulo: 'Contratos y firma electrónica',
    texto: 'Generá el contrato de cada venta y mandalo a firmar, con registro de auditoría de cada firma.',
    icono: FileSignature,
  },
  {
    titulo: 'Clientes y ventas',
    texto: 'Cargá cada cierre, seguí los pagos y mirá en qué etapa está cada cliente.',
    icono: Users,
  },
  {
    titulo: 'Equipo y agenda',
    texto:
      'Cada persona puede conectar su Google Calendar para ver su agenda junto a las reuniones del portal y crear las reuniones con link de Google Meet.',
    icono: CalendarDays,
  },
  {
    titulo: 'Asuntos con FIRMA',
    texto: 'Seguí los temas legales que llevamos con vos, con sus documentos y novedades.',
    icono: Briefcase,
  },
];

export const PortalClientes: React.FC = () => (
  <section id="portal" className="section rule">
    <div className="wrap grid grid-cols-1 desk:grid-cols-[5fr_7fr] gap-10 desk:gap-16 items-start">
      <Reveal>
        <div className="flex flex-col gap-5">
          <p className="eyebrow text-piedra">Portal de clientes</p>
          <h2 className="h2">
            Tu negocio, ordenado en <span className="resalte">un solo lugar.</span>
          </h2>
          <p className="text-[17px] leading-[1.55] text-piedra max-w-[46ch]">
            Cada cliente de FIRMA trabaja con nosotros desde su portal. Ahí ordena sus clientes, su
            equipo y sus contratos, y sigue cada asunto legal con un abogado detrás.
          </p>
          <a
            href="/portal"
            className="inline-flex items-center justify-center gap-2.5 self-start h-[52px] px-6 text-[15px] font-medium rounded-control border border-tinta text-tinta hover:bg-tinta hover:text-marfil transition-[background-color,color] duration-150"
          >
            Entrar al portal <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </Reveal>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 tab:grid-cols-2 gap-px bg-tinta/15 border border-tinta/15">
          {funciones.map((f, i) => (
            <Reveal key={f.titulo} delay={i * 100} className="h-full">
              <article className="h-full bg-marfil p-7 flex flex-col gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-tinta text-marfil">
                  <f.icono size={24} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold leading-tight">{f.titulo}</h3>
                <p className="text-[15px] leading-[1.6] text-piedra">{f.texto}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="text-sm leading-[1.6] text-piedra">
          Conectar Google Calendar es opcional y lo decide cada persona. Qué datos usamos y cómo los
          cuidamos está en la{' '}
          <a href="/privacidad#google" className="underline underline-offset-2 hover:text-tinta">
            Política de Privacidad
          </a>
          .
        </p>
      </div>
    </div>
  </section>
);

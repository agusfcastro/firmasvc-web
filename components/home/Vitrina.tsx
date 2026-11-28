import React, { useEffect, useRef, useState } from 'react';
import { Bell, Folder, Phone, PenLine, Trophy, Users } from 'lucide-react';
import { Reveal } from '../Reveal';
import {
  MaquetaAsuntos,
  MaquetaAvisos,
  MaquetaCrm,
  MaquetaEquipo,
  MaquetaFirma,
  MaquetaLlamadas,
} from './Maquetas';

// Vitrina del portal: una pestaña por módulo, con su maqueta. Cambia sola cada pocos
// segundos hasta que alguien toca una pestaña; ahí se queda en la que eligió.
// Tina queda afuera mientras esté apagada (TINA_ACTIVA).

interface Modulo {
  id: string;
  pestana: string;
  icono: React.ElementType;
  titulo: string;
  texto: string;
  Maqueta: React.FC;
}

const modulos: Modulo[] = [
  {
    id: 'crm',
    pestana: 'CRM y contratos',
    icono: Users,
    titulo: 'Ninguna venta sin contrato.',
    texto:
      'El closer carga el cierre y en minutos el cliente tiene su contrato para firmar, mientras todavía está caliente. Si después deja de pagar, tenés con qué reclamar.',
    Maqueta: MaquetaCrm,
  },
  {
    id: 'firma',
    pestana: 'Firma electrónica',
    icono: PenLine,
    titulo: 'Si mañana dice que nunca firmó, tenés la prueba.',
    texto:
      'Cada firma queda registrada con fecha, hora, IP y la huella del documento. Ese registro es lo que vale cuando un cliente niega el acuerdo o pide un contracargo.',
    Maqueta: MaquetaFirma,
  },
  {
    id: 'asuntos',
    pestana: 'Asuntos y documentos',
    icono: Folder,
    titulo: 'Tu abogado ya sabe en qué está tu tema.',
    texto:
      'Cada cuenta tiene un abogado asignado que lleva los asuntos de punta a punta. Nos convertimos en tu departamento de legales.',
    Maqueta: MaquetaAsuntos,
  },
  {
    id: 'llamadas',
    pestana: 'Análisis de llamadas',
    icono: Phone,
    titulo: 'Detectá al cliente problema antes de cerrarlo.',
    texto:
      'El que pide el reembolso a los 30 días ya dio señales en la llamada de venta. Las marcamos por vos, para que decidas con quién cerrar y cómo protegerte.',
    Maqueta: MaquetaLlamadas,
  },
  {
    id: 'equipo',
    pestana: 'Equipo',
    icono: Trophy,
    titulo: 'El cliente correcto, con la persona correcta.',
    texto:
      'Conocés en qué es bueno cada uno de tu equipo y le asignás los clientes que mejor sabe atender. Seguís cada cuenta de cerca y frenás el conflicto antes de que el cliente pida la plata de vuelta.',
    Maqueta: MaquetaEquipo,
  },
  {
    id: 'avisos',
    pestana: 'Avisos',
    icono: Bell,
    titulo: 'Lo que pasa en tu negocio, en tiempo real.',
    texto:
      'Firmas, vencimientos, onboardings y novedades de tus asuntos te llegan al celular apenas pasan. Nada queda esperando a que alguien se acuerde de avisarte.',
    Maqueta: MaquetaAvisos,
  },
];

const CADA_MS = 7000;

export const Vitrina: React.FC = () => {
  const [actual, setActual] = useState(0);
  const [elegido, setElegido] = useState(false);
  const [encima, setEncima] = useState(false);
  const [aLaVista, setALaVista] = useState(false);
  const seccion = useRef<HTMLElement>(null);
  const pestanas = useRef<(HTMLButtonElement | null)[]>([]);

  // Rota solo mientras la vitrina está en pantalla: así no cambia de alto (y no mueve
  // la página) cuando la persona está leyendo otra sección.
  useEffect(() => {
    const el = seccion.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setALaVista(e.isIntersecting), { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (elegido || encima || !aLaVista) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setTimeout(() => setActual((i) => (i + 1) % modulos.length), CADA_MS);
    return () => window.clearTimeout(t);
  }, [actual, elegido, encima, aLaVista]);

  // En el celular la fila de pestañas se desliza: la activa queda siempre a la vista.
  useEffect(() => {
    if (!aLaVista) return;
    const el = pestanas.current[actual];
    const fila = el?.parentElement;
    if (!el || !fila) return;
    fila.scrollTo({ left: el.offsetLeft - fila.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [actual, aLaVista]);

  const elegir = (i: number) => {
    setElegido(true);
    setActual(i);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const sig = (actual + (e.key === 'ArrowRight' ? 1 : modulos.length - 1)) % modulos.length;
    elegir(sig);
    pestanas.current[sig]?.focus();
  };

  const m = modulos[actual];

  return (
    <section id="portal" ref={seccion} className="vitrina rule">
      <div className="wrap flex flex-col gap-10 desk:gap-12">
        <Reveal>
          <div className="flex flex-col items-center gap-4 max-w-[62ch] mx-auto text-center">
            <h2 className="h2">
              Vos vendés, <span className="resalte">nosotros hacemos el resto.</span>
            </h2>
            <p className="text-[19px] leading-[1.5] text-piedra">
              El <strong className="font-semibold text-tinta">90%</strong> de los conflictos son evitables.
            </p>
          </div>
        </Reveal>

        <div
          className="flex flex-col gap-8"
          onMouseEnter={() => setEncima(true)}
          onMouseLeave={() => setEncima(false)}
        >
          <div
            role="tablist"
            aria-label="Módulos del portal"
            className="vitrina-pestanas scrollbar-hide"
            onKeyDown={teclas}
          >
            {modulos.map((mod, i) => (
              <button
                key={mod.id}
                ref={(el) => {
                  pestanas.current[i] = el;
                }}
                role="tab"
                id={`pestana-${mod.id}`}
                aria-selected={i === actual}
                aria-controls="vitrina-panel"
                tabIndex={i === actual ? 0 : -1}
                onClick={() => elegir(i)}
                className={`vitrina-pestana ${i === actual ? 'activa' : ''}`}
              >
                <mod.icono size={16} strokeWidth={1.8} />
                {mod.pestana}
                {i === actual && !elegido && !encima && aLaVista && (
                  <span key={actual} className="vitrina-progreso" style={{ animationDuration: `${CADA_MS}ms` }} />
                )}
              </button>
            ))}
          </div>

          <div
            id="vitrina-panel"
            role="tabpanel"
            aria-labelledby={`pestana-${m.id}`}
            className="grid grid-cols-1 min-[1100px]:grid-cols-[4fr_8fr] gap-8 min-[1100px]:gap-12 items-center"
          >
            <div key={m.id} className="vitrina-texto flex flex-col gap-5 max-w-[60ch]">
              <h3 className="h3">{m.titulo}</h3>
              <p className="text-[17px] leading-[1.6] text-piedra">{m.texto}</p>
            </div>
            {/* Si tocan la maqueta (en el celular no hay cursor encima), deja de rotar. */}
            <div
              key={`${m.id}-maqueta`}
              className="vitrina-maqueta"
              onPointerDown={() => setElegido(true)}
              onFocus={() => setElegido(true)}
            >
              <m.Maqueta />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

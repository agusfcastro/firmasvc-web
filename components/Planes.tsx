import React, { useEffect } from 'react';
import { Check, Minus } from 'lucide-react';
import { Logo } from './Logo';
import { agendarPlan } from '../lib/calendly';

/**
 * Planes de abono de FIRMA. Ruta /planes, sin indexar y sin enlace desde la home.
 * Se comparte solo durante las llamadas de venta.
 * Cada botón abre Calendly con el plan elegido: primero hay una reunión y después
 * FIRMA arma el abono, que el cliente paga desde el portal con dLocal Go.
 */

type Plan = {
  id: 'gold' | 'black' | 'eminent';
  nombre: string;
  precio: string;
  extra?: string;
  titular: string;
  bajada: string;
  incluye: string[];
  ideal: string;
  badge?: string;
};

const BASE = [
  'CRM de FIRMA para gestionar tus clientes',
  'Sistema de firma electrónica con certificado de integridad',
  'Material grabado de formación legal',
  'SOPs de reembolsos, reclamos y equipo',
];

const PLANES: Plan[] = [
  {
    id: 'gold',
    nombre: 'Gold',
    precio: 'USD 150',
    titular: 'El orden legal que tu negocio necesita para crecer sin improvisar',
    bajada:
      'Tu negocio ya vende y ahora necesita procesos. Con Gold tenés las herramientas de FIRMA para gestionar clientes y firmar contratos con validez, los protocolos que usan los negocios que facturan en serio y una hora mensual conmigo para resolver tus dudas antes de que se conviertan en problemas.',
    incluye: [
      'CRM de FIRMA para gestionar tus clientes',
      'Sistema de firma electrónica con certificado de integridad',
      'Material grabado de formación legal para emprendedores',
      'SOPs listos para aplicar en reembolsos, reclamos de clientes y manejo del equipo',
      'Una hora de consultoría por mes',
    ],
    ideal: 'negocios que están ordenando su operación y quieren prevenir antes que salir a apagar incendios.',
  },
  {
    id: 'black',
    nombre: 'Black',
    precio: 'USD 300',
    badge: 'Más elegido',
    titular: 'Tu negocio blindado, con un abogado del lado tuyo cada semana',
    bajada:
      'Black es para el que ya no puede darse el lujo de perder un cliente, un reembolso o un integrante del equipo por un conflicto mal manejado. Nos encargamos de los problemas cuando aparecen, mejoramos tus documentos y te acompañamos todas las semanas.',
    incluye: [
      ...BASE,
      'Gestión de conflictos con clientes, socios y equipo',
      'Una hora de consultoría por semana',
      'WhatsApp directo con respuesta dentro de las 24 h',
      'Optimización de tus contratos y documentos actuales',
      'Un documento nuevo redactado a medida por mes',
    ],
    ideal: 'infoproductores, agencias y consultoras que ya facturan y necesitan proteger cada venta.',
  },
  {
    id: 'eminent',
    nombre: 'Eminent',
    precio: 'USD 1.000',
    extra: 'O USD 1.500 pagando 3 meses por adelantado. Te ahorrás USD 1.500.',
    titular: 'Tu departamento legal, sin límites',
    bajada:
      'Eminent es tener a FIRMA adentro de tu negocio. Sin cupos de horas ni de documentos, con soporte a toda hora y con tu equipo formado para operar sin riesgos legales. Vos te enfocás en escalar y nosotros cubrimos todo lo demás.',
    incluye: [
      ...BASE,
      'Gestión de conflictos con clientes, socios y equipo',
      'Soporte por WhatsApp las 24 horas',
      'Agenda ilimitada para reuniones y consultas',
      'Documentación ilimitada, con todos los contratos y documentos que tu negocio necesite',
      'Formación legal para tu equipo de ventas, soporte y operaciones',
    ],
    ideal: 'negocios que facturan fuerte, tienen equipo propio o socios y quieren cero fricción legal mientras crecen.',
  },
];

type Valor = boolean | string;
const COMPARATIVA: { item: string; gold: Valor; black: Valor; eminent: Valor }[] = [
  { item: 'CRM de FIRMA', gold: true, black: true, eminent: true },
  { item: 'Firma electrónica con certificado de integridad', gold: true, black: true, eminent: true },
  { item: 'Material grabado de formación', gold: true, black: true, eminent: true },
  { item: 'SOPs de reembolsos, reclamos y equipo', gold: true, black: true, eminent: true },
  { item: 'Consultoría', gold: '1 h por mes', black: '1 h por semana', eminent: 'Ilimitada' },
  { item: 'WhatsApp', gold: false, black: 'Respuesta en 24 h', eminent: 'Soporte las 24 horas' },
  { item: 'Gestión de conflictos', gold: false, black: true, eminent: true },
  { item: 'Optimización documental', gold: false, black: true, eminent: true },
  { item: 'Documentos nuevos a medida', gold: false, black: '1 por mes', eminent: 'Ilimitados' },
  { item: 'Formación para tu equipo', gold: false, black: false, eminent: true },
];

const Celda: React.FC<{ v: Valor }> = ({ v }) => {
  if (v === true) return <Check size={18} className="inline text-bosque" aria-label="Incluido" />;
  if (v === false) return <Minus size={16} className="inline text-calido" aria-label="No incluido" />;
  return <span className="text-sm">{v}</span>;
};

const Tarjeta: React.FC<{ plan: Plan }> = ({ plan }) => {
  const oscura = plan.id === 'black';
  const premium = plan.id === 'eminent';
  const texto = oscura ? 'text-marfil' : 'text-tinta';
  const suave = oscura ? 'text-marfil/70' : 'text-piedra';
  const linea = oscura ? 'border-marfil/15' : 'border-tinta/15';

  return (
    <article
      className={`relative flex flex-col p-8 border ${
        oscura ? 'bg-tinta border-tinta' : premium ? 'bg-[#FBFAF6] border-bosque border-2' : 'bg-[#FBFAF6] border-tinta/15'
      } ${texto}`}
    >
      {plan.badge && (
        <span
          className={`eyebrow absolute -top-3 left-8 px-3 py-1 ${
            oscura ? 'bg-marfil text-tinta' : 'bg-bosque text-marfil'
          }`}
        >
          {plan.badge}
        </span>
      )}

      <p className={`eyebrow ${oscura ? 'text-marfil/80' : 'text-bosque'}`}>{plan.nombre}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-heading text-5xl font-black tracking-tight">{plan.precio}</span>
        <span className={`text-sm ${suave}`}>por mes</span>
      </div>
      {plan.extra && (
        <p className="mt-3 text-sm font-medium text-bosque bg-[#E4E9E3] px-3 py-2">{plan.extra}</p>
      )}

      <h3 className="h3 mt-6">{plan.titular}</h3>
      <p className={`mt-3 text-[15px] leading-relaxed ${suave}`}>{plan.bajada}</p>

      <ul className="mt-6 grid gap-3 flex-1">
        {plan.incluye.map((i) => (
          <li key={i} className="flex gap-3 text-[15px]">
            <Check size={18} className={`shrink-0 mt-0.5 ${oscura ? 'text-marfil' : 'text-bosque'}`} />
            <span>{i}</span>
          </li>
        ))}
      </ul>

      <p className={`mt-6 pt-5 border-t ${linea} text-sm ${suave}`}>
        <b className={oscura ? 'text-marfil' : 'text-tinta'}>Ideal para</b> {plan.ideal}
      </p>

      <button
        type="button"
        onClick={() => agendarPlan(plan.id)}
        className={`mt-6 block w-full text-center font-semibold py-4 transition-colors ${
          oscura
            ? 'bg-marfil text-tinta hover:bg-marfil-oscuro'
            : premium
              ? 'bg-bosque text-marfil hover:bg-bosque-dark'
              : 'border border-tinta text-tinta hover:bg-tinta hover:text-marfil'
        }`}
      >
        Quiero {plan.nombre}
      </button>
    </article>
  );
};

export const Planes: React.FC = () => {
  useEffect(() => {
    const tituloPrevio = document.title;
    document.title = 'Planes | Firma';

    // Página de venta privada, no para buscadores.
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(robots);

    const html = document.documentElement;
    const paddingPrevio = html.style.scrollPaddingTop;
    html.style.scrollPaddingTop = '0px';

    return () => {
      document.title = tituloPrevio;
      robots.remove();
      html.style.scrollPaddingTop = paddingPrevio;
    };
  }, []);

  return (
    <div className="min-h-screen bg-marfil flex flex-col">
      <header className="border-b border-tinta/15">
        <div className="wrap h-28 flex items-center">
          <a href="/" className="flex items-center min-w-0 select-none">
            <Logo className="h-12 max-w-[55vw]" />
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="wrap pt-16 pb-12 desk:pt-24 text-center">
          <p className="eyebrow text-bosque">Abonos legales</p>
          <h1 className="h2 mt-4 max-w-3xl mx-auto">Elegí cómo querés blindar tu negocio</h1>
          <p className="mt-5 text-lg text-piedra max-w-2xl mx-auto">
            Tres niveles de acompañamiento legal para infoproductores, agencias y negocios que ya
            facturan y no quieren perder ventas por conflictos evitables.
          </p>
        </section>

        <section className="wrap">
          <div className="grid gap-8 wide:grid-cols-3 items-stretch">
            {PLANES.map((p) => (
              <Tarjeta key={p.id} plan={p} />
            ))}
          </div>
        </section>

        <section className="wrap section">
          <h2 className="h3 text-center mb-8">Comparativa</h2>
          <div className="overflow-x-auto border border-tinta/15 bg-[#FBFAF6]">
            <table className="w-full min-w-[640px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-tinta/15">
                  <th className="p-4" />
                  <th className="eyebrow p-4 text-bosque">Gold</th>
                  <th className="eyebrow p-4 bg-tinta text-marfil">Black</th>
                  <th className="eyebrow p-4 text-bosque">Eminent</th>
                </tr>
              </thead>
              <tbody>
                {COMPARATIVA.map((r) => (
                  <tr key={r.item} className="border-b border-tinta/10">
                    <td className="p-4 text-piedra">{r.item}</td>
                    <td className="p-4 text-center"><Celda v={r.gold} /></td>
                    <td className="p-4 text-center bg-tinta/[0.04]"><Celda v={r.black} /></td>
                    <td className="p-4 text-center"><Celda v={r.eminent} /></td>
                  </tr>
                ))}
                <tr className="font-heading font-bold">
                  <td className="p-4">Inversión mensual</td>
                  <td className="p-4 text-center">USD 150</td>
                  <td className="p-4 text-center bg-tinta/[0.04]">USD 300</td>
                  <td className="p-4 text-center">USD 1.000</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-10 text-sm text-piedra text-center max-w-2xl mx-auto">
            Los abonos no incluyen juicios ni constitución de sociedades en el extranjero, que se
            cotizan por separado con descuento para clientes activos.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Planes;

import React, { useEffect } from 'react';
import { Check, Minus } from 'lucide-react';
import { Logo } from './Logo';
import { agendarPlan } from '../lib/calendly';

/**
 * Planes de abono de FIRMA. Ruta /planes, sin indexar y sin enlace desde la home.
 * Se comparte solo durante las llamadas de venta.
 * Cada botón abre Calendly con el plan elegido: primero hay una reunión y después
 * FIRMA arma el abono, que el cliente paga desde el portal con dLocal Go.
 * La oferta es la de noviembre de 2026 (CLAUDE.md, Planes): tres cuotas o pago
 * completo, y después la cuota posterior. Los montos del portal están en
 * components/portal/abonos.ts (OFERTAS). Si cambian, se cambian en los dos.
 */

export type Plan = {
  id: 'starter' | 'eminent';
  nombre: string;
  /** Cuota de los tres primeros meses. */
  precio: string;
  periodo: string;
  /** Pago completo. */
  extra: string;
  /** Cuota desde el cuarto mes. */
  despues: string;
  titular: string;
  bajada: string;
  incluye: string[];
  noIncluye?: string;
  ideal: string;
  badge?: string;
};

export const PLANES: Plan[] = [
  {
    id: 'starter',
    nombre: 'Starter',
    precio: 'USD 400',
    periodo: 'por mes, tres cuotas',
    extra: 'O USD 1.000 en un pago, con el cuarto mes sin cargo y la cuota congelada por 12 meses.',
    despues: 'Desde el cuarto mes, USD 250 por mes.',
    titular: 'Las herramientas de FIRMA para operar con orden',
    bajada:
      'Starter es para el negocio que quiere operar por su cuenta con las herramientas de FIRMA. Tenés el CRM legal con perfilado de clientes, a Tina para resolver lo del día a día, la firma electrónica y una hora por semana de consultoría general.',
    incluye: [
      'CRM legal de FIRMA con perfilado de clientes',
      'Tina, la asistente con IA del portal, con accionables y recursos',
      'Hasta 20 documentos firmados por mes con firma electrónica',
      'Una hora por semana de consultoría general',
    ],
    noIncluye: 'No incluye asesoramiento sobre casos ni redacción de documentos. La hora adicional cuesta USD 100.',
    ideal: 'negocios que ya tienen sus documentos y quieren ordenar la operación por su cuenta.',
  },
  {
    id: 'eminent',
    nombre: 'Eminent',
    precio: 'USD 750',
    periodo: 'por mes, tres cuotas',
    extra: 'O USD 1.800 en un pago, con el cuarto mes sin cargo y la cuota congelada por 12 meses.',
    despues: 'Desde el cuarto mes, USD 500 por mes.',
    badge: 'Más elegido',
    titular: 'Tu departamento legal, con un abogado detrás de cada respuesta',
    bajada:
      'Eminent es tener a FIRMA adentro de tu negocio. Acceso directo conmigo, Tina con derivación al equipo, todos los documentos que necesites y la gestión de los conflictos con clientes, socios y equipo.',
    incluye: [
      'Todo lo de Starter, con agenda y firmas sin límite',
      'Acceso directo a Agustín Castro',
      'Tina completa, con derivación de tus casos al equipo de FIRMA',
      'Redacción y optimización de tus contratos y documentos',
      'Gestión de conflictos con clientes, socios y equipo',
      'Contacto telefónico en urgencias',
    ],
    ideal: 'negocios que facturan fuerte, tienen equipo propio o socios y quieren cero fricción legal mientras crecen.',
  },
];

type Valor = boolean | string;
const COMPARATIVA: { item: string; starter: Valor; eminent: Valor }[] = [
  { item: 'CRM legal con perfilado de clientes', starter: true, eminent: true },
  { item: 'Tina, asistente con IA', starter: 'Accionables y recursos', eminent: 'Con derivación al equipo' },
  { item: 'Firma electrónica', starter: 'Hasta 20 por mes', eminent: 'Sin límite' },
  { item: 'Consultoría', starter: '1 h general por semana', eminent: 'Sin límite' },
  { item: 'Asesoramiento sobre tus casos', starter: false, eminent: true },
  { item: 'Redacción de documentos', starter: false, eminent: true },
  { item: 'Gestión de conflictos', starter: false, eminent: true },
  { item: 'Contacto telefónico en urgencias', starter: false, eminent: true },
];

const PRECIOS: { item: string; starter: string; eminent: string }[] = [
  { item: 'Tres cuotas, por mes', starter: 'USD 400', eminent: 'USD 750' },
  { item: 'Pago completo, cuatro meses', starter: 'USD 1.000', eminent: 'USD 1.800' },
  { item: 'Desde el cuarto mes, por mes', starter: 'USD 250', eminent: 'USD 500' },
];

const Celda: React.FC<{ v: Valor }> = ({ v }) => {
  if (v === true) return <Check size={18} className="inline text-bosque" aria-label="Incluido" />;
  if (v === false) return <Minus size={16} className="inline text-calido" aria-label="No incluido" />;
  return <span className="text-sm">{v}</span>;
};

/**
 * Tarjeta de un plan. La usan /planes y la sección Pagos del portal.
 * compacta deja afuera la bajada y el «Ideal para». actual la marca como el plan del cliente.
 */
export const Tarjeta: React.FC<{ plan: Plan; compacta?: boolean; actual?: boolean; textoBoton?: string }> = ({ plan, compacta, actual, textoBoton }) => {
  const oscura = plan.id === 'eminent';
  const texto = oscura ? 'text-marfil' : 'text-tinta';
  const suave = oscura ? 'text-marfil/70' : 'text-piedra';
  const linea = oscura ? 'border-marfil/15' : 'border-tinta/15';

  return (
    <article
      className={`relative flex flex-col p-8 border ${
        oscura ? 'bg-tinta border-tinta' : 'bg-marfil-claro border-tinta/15'
      } ${texto}`}
    >
      {(actual || plan.badge) && (
        <span
          className={`eyebrow absolute -top-3 left-8 px-3 py-1 ${
            oscura ? 'bg-marfil text-tinta' : 'bg-bosque text-marfil'
          }`}
        >
          {actual ? 'Tu plan' : plan.badge}
        </span>
      )}

      <p className={`eyebrow ${oscura ? 'text-marfil/80' : 'text-bosque'}`}>{plan.nombre}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={`font-heading font-black tracking-tight whitespace-nowrap ${compacta ? 'text-4xl' : 'text-5xl'}`}>{plan.precio}</span>
        <span className={`text-sm ${suave}`}>{plan.periodo}</span>
      </div>
      <p className={`mt-2 text-sm ${suave}`}>{plan.despues}</p>
      <p className={`mt-3 text-sm font-medium px-3 py-2 ${oscura ? 'text-marfil bg-marfil/10' : 'text-bosque bg-bosque-suave'}`}>{plan.extra}</p>

      <h3 className="h3 mt-6">{plan.titular}</h3>
      {!compacta && <p className={`mt-3 text-[15px] leading-relaxed ${suave}`}>{plan.bajada}</p>}

      <ul className="mt-6 grid gap-3 content-start flex-1">
        {plan.incluye.map((i) => (
          <li key={i} className="flex gap-3 text-[15px]">
            <Check size={18} className={`shrink-0 mt-0.5 ${oscura ? 'text-marfil' : 'text-bosque'}`} />
            <span>{i}</span>
          </li>
        ))}
      </ul>

      {plan.noIncluye && <p className={`mt-5 text-sm ${suave}`}>{plan.noIncluye}</p>}

      {!compacta && (
        <p className={`mt-6 pt-5 border-t ${linea} text-sm ${suave}`}>
          <b className={oscura ? 'text-marfil' : 'text-tinta'}>Ideal para</b> {plan.ideal}
        </p>
      )}

      <button
        type="button"
        onClick={() => agendarPlan(plan.id)}
        disabled={actual}
        className={`mt-6 block w-full text-center font-semibold py-4 transition-colors disabled:opacity-60 disabled:cursor-default ${
          oscura ? 'bg-marfil text-tinta hover:bg-marfil-oscuro' : 'border border-tinta text-tinta hover:bg-tinta hover:text-marfil'
        }`}
      >
        {actual ? 'Es tu plan actual' : (textoBoton ?? `Quiero ${plan.nombre}`)}
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
            Dos niveles de acompañamiento legal para infoproductores, agencias y negocios que ya
            facturan y no quieren perder ventas por conflictos evitables.
          </p>
        </section>

        <section className="wrap">
          <p className="max-w-3xl mx-auto mb-10 text-center text-[15px] font-medium text-bosque bg-bosque-suave px-5 py-4">
            Precio fundador para las primeras 5 empresas o hasta el 31 de diciembre de 2026. Eminent a USD 1.500 y Starter a USD 800, con pago completo.
          </p>
          <div className="grid gap-8 wide:grid-cols-2 items-stretch max-w-5xl mx-auto">
            {PLANES.map((p) => (
              <Tarjeta key={p.id} plan={p} />
            ))}
          </div>
        </section>

        <section className="wrap section">
          <h2 className="h3 text-center mb-8">Comparativa</h2>
          <div className="overflow-x-auto border border-tinta/15 bg-marfil-claro">
            <table className="w-full min-w-[640px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-tinta/15">
                  <th className="p-4" />
                  <th className="eyebrow p-4 text-bosque">Starter</th>
                  <th className="eyebrow p-4 bg-tinta text-marfil">Eminent</th>
                </tr>
              </thead>
              <tbody>
                {COMPARATIVA.map((r) => (
                  <tr key={r.item} className="border-b border-tinta/10">
                    <td className="p-4 text-piedra">{r.item}</td>
                    <td className="p-4 text-center"><Celda v={r.starter} /></td>
                    <td className="p-4 text-center bg-tinta/[0.04]"><Celda v={r.eminent} /></td>
                  </tr>
                ))}
                {PRECIOS.map((r) => (
                  <tr key={r.item} className="border-b border-tinta/10 font-heading font-bold">
                    <td className="p-4">{r.item}</td>
                    <td className="p-4 text-center">{r.starter}</td>
                    <td className="p-4 text-center bg-tinta/[0.04]">{r.eminent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-10 text-sm text-piedra text-center max-w-2xl mx-auto">
            Si pagás en pesos, se cobra al equivalente del dólar MEP. Los abonos no incluyen juicios
            ni constitución de sociedades en el extranjero, que se cotizan por separado con descuento
            para clientes activos.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Planes;

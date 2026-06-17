import React from 'react';
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react';
import { Logo } from './Logo';
import { Footer } from './Footer';

const LAST_UPDATED = '17 de junio de 2026';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-10">
    <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">{title}</h2>
    <div className="space-y-4 text-gray-600 leading-relaxed text-[15px] md:text-base">
      {children}
    </div>
  </section>
);

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Simple header */}
      <header className="border-b border-gray-100">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <a href="/" className="text-3xl select-none">
            <Logo />
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-firma transition-colors"
          >
            <ArrowLeft size={16} />
            Volver al inicio
          </a>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl py-16 md:py-20">
          <p className="text-sm font-semibold text-firma uppercase tracking-widest mb-3">
            Legal
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Política de Privacidad
          </h1>
          <p className="text-sm text-gray-500 mb-12">
            Última actualización: {LAST_UPDATED}
          </p>

          <Section title="1. Quiénes somos">
            <p>
              Firma es una consultoría legal para negocios digitales con sede en Buenos Aires,
              Argentina. Esta Política de Privacidad describe cómo recopilamos, usamos y protegemos
              la información personal que nos proporcionás al interactuar con nuestro sitio web, con
              nuestros anuncios en Meta (Facebook e Instagram) y con nuestros canales de contacto.
            </p>
            <p>
              El responsable del tratamiento de los datos es Firma. Para cualquier consulta sobre
              esta política o sobre tus datos personales, podés escribirnos a{' '}
              <a href="mailto:agustin@firmasvc.com" className="text-firma hover:underline">
                agustin@firmasvc.com
              </a>
              .
            </p>
          </Section>

          <Section title="2. Qué información recopilamos">
            <p>Recopilamos información que nos brindás de forma voluntaria, incluyendo:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Datos de contacto:</strong> nombre, dirección de correo electrónico, número
                de teléfono y cualquier información que ingreses en nuestros formularios, en el chat
                de WhatsApp o al agendar una reunión.
              </li>
              <li>
                <strong>Datos de tu consulta:</strong> el contenido de los mensajes y la información
                sobre tu negocio que compartas con nosotros.
              </li>
              <li>
                <strong>Datos de navegación:</strong> información técnica como dirección IP, tipo de
                dispositivo, navegador y páginas visitadas, recopilada mediante cookies y tecnologías
                similares.
              </li>
              <li>
                <strong>Datos provenientes de anuncios en Meta:</strong> cuando interactuás con
                nuestros anuncios en Facebook o Instagram, Meta puede compartir con nosotros datos
                agregados o de contacto que nos permiten dar seguimiento a tu consulta.
              </li>
            </ul>
          </Section>

          <Section title="3. Cómo usamos tu información">
            <p>Utilizamos la información recopilada para:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Responder a tus consultas y brindarte nuestros servicios de consultoría legal.</li>
              <li>Coordinar y agendar reuniones.</li>
              <li>Enviarte información relevante sobre nuestros servicios, si lo solicitaste.</li>
              <li>
                Medir la efectividad de nuestras campañas publicitarias y mejorar nuestro sitio web
                y comunicaciones.
              </li>
              <li>Cumplir con obligaciones legales y regulatorias aplicables.</li>
            </ul>
          </Section>

          <Section title="4. Publicidad en Meta y herramientas de terceros">
            <p>
              Realizamos campañas publicitarias a través de Meta Platforms, Inc. (Facebook e
              Instagram). Es posible que utilicemos herramientas como el Píxel de Meta y Conversions
              API para medir el rendimiento de nuestros anuncios, comprender cómo interactúan los
              usuarios con nuestro sitio y mostrar publicidad relevante.
            </p>
            <p>
              Estos servicios pueden recopilar información sobre tu actividad de acuerdo con sus
              propias políticas. Te recomendamos revisar la{' '}
              <a
                href="https://www.facebook.com/privacy/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-firma hover:underline"
              >
                Política de Privacidad de Meta
              </a>
              . También usamos otras herramientas de terceros como Calendly (para agendar reuniones)
              y WhatsApp (para comunicación), cada una con sus propias políticas de privacidad.
            </p>
          </Section>

          <Section title="5. Cookies">
            <p>
              Nuestro sitio utiliza cookies y tecnologías similares para su correcto funcionamiento,
              para analizar el tráfico y para fines publicitarios. Podés configurar tu navegador para
              rechazar las cookies, aunque esto podría afectar algunas funcionalidades del sitio.
            </p>
          </Section>

          <Section title="6. Con quién compartimos tu información">
            <p>
              No vendemos tu información personal. Podemos compartirla únicamente con proveedores de
              servicios que nos ayudan a operar (por ejemplo, plataformas de mensajería, agenda y
              publicidad), siempre bajo obligaciones de confidencialidad, o cuando sea requerido por
              ley o autoridad competente.
            </p>
          </Section>

          <Section title="7. Conservación de los datos">
            <p>
              Conservamos tu información personal durante el tiempo necesario para cumplir con las
              finalidades descriptas en esta política, o mientras exista una relación con vos, salvo
              que la ley exija o permita un plazo distinto.
            </p>
          </Section>

          <Section title="8. Tus derechos">
            <p>
              De acuerdo con la Ley N.º 25.326 de Protección de los Datos Personales de la República
              Argentina, tenés derecho a acceder, rectificar, actualizar y solicitar la supresión de
              tus datos personales de forma gratuita. Para ejercer estos derechos, escribinos a{' '}
              <a href="mailto:agustin@firmasvc.com" className="text-firma hover:underline">
                agustin@firmasvc.com
              </a>
              .
            </p>
            <p>
              La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la
              Ley N.º 25.326, tiene la atribución de atender las denuncias y reclamos que se
              interpongan en relación con el incumplimiento de las normas sobre protección de datos
              personales.
            </p>
          </Section>

          <Section title="9. Seguridad">
            <p>
              Adoptamos medidas técnicas y organizativas razonables para proteger tu información
              personal contra el acceso no autorizado, la pérdida o la alteración. Sin embargo,
              ningún sistema es completamente seguro, por lo que no podemos garantizar la seguridad
              absoluta de la información transmitida a través de internet.
            </p>
          </Section>

          <Section title="10. Cambios en esta política">
            <p>
              Podemos actualizar esta Política de Privacidad periódicamente. Publicaremos cualquier
              cambio en esta página e indicaremos la fecha de la última actualización. Te
              recomendamos revisarla con regularidad.
            </p>
          </Section>

          <Section title="11. Contacto">
            <p>
              Si tenés preguntas sobre esta Política de Privacidad o sobre el tratamiento de tus
              datos personales, podés contactarnos:
            </p>
            <ul className="space-y-3 pt-2">
              <li>
                <a
                  href="mailto:agustin@firmasvc.com"
                  className="inline-flex items-center gap-3 text-firma hover:underline"
                >
                  <Mail size={16} />
                  agustin@firmasvc.com
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/5491124617035"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 text-firma hover:underline"
                >
                  <MessageCircle size={16} />
                  +54 9 11 2461-7035
                </a>
              </li>
            </ul>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

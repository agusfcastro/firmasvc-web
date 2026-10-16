import React from 'react';
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react';
import { Logo } from './Logo';
import { Footer } from './Footer';

const LAST_UPDATED = '16 de octubre de 2026';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-10">
    <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">{title}</h2>
    <div className="space-y-4 text-gray-600 leading-relaxed text-[15px] md:text-base">
      {children}
    </div>
  </section>
);

export const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-marfil flex flex-col">
      {/* Simple header */}
      <header className="border-b border-tinta/15">
        <div className="container mx-auto px-4 md:px-6 h-28 flex items-center justify-between">
          <a href="/" className="flex items-center select-none">
            <Logo className="h-12 max-w-[62vw]" />
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
            Términos y Condiciones del Servicio
          </h1>
          <p className="text-sm text-gray-500 mb-12">
            Última actualización: {LAST_UPDATED}
          </p>

          <Section title="1. Titular">
            <p>
              Los servicios son prestados por Agustín Castro, abogado (UBA), CUIT 20-43172864-9, bajo
              la marca Firma, con domicilio en la Ciudad Autónoma de Buenos Aires, República
              Argentina (en adelante, “Firma”).
            </p>
          </Section>

          <Section title="2. Objeto">
            <p>
              Firma presta servicios profesionales de asesoramiento y consultoría legal para
              empresas y negocios digitales, incluyendo, entre otros, estructuración societaria,
              redacción de contratos, diseño de protocolos internos y registro de marcas.
            </p>
            <p>
              Los servicios <strong>no se contratan a través de este sitio web</strong>. Este sitio
              es meramente informativo y no constituye una oferta dirigida al público. Los medios de
              pago que Firma pone a disposición, incluidas las suscripciones, se utilizan únicamente
              para gestionar el cobro de los servicios contratados por clientes activos con quienes
              existe un acuerdo previo.
            </p>
          </Section>

          <Section title="3. Condiciones particulares">
            <p>
              El alcance, los entregables, los plazos, el precio, la periodicidad de los pagos y
              las demás condiciones de cada servicio se acuerdan en forma previa y por escrito entre
              Firma y el cliente, mediante propuesta aceptada, contrato de servicio u otro
              instrumento equivalente (las “Condiciones Particulares”).
            </p>
            <p>
              Estos Términos y Condiciones se aplican en forma complementaria. En caso de
              discrepancia, prevalecen las Condiciones Particulares.
            </p>
          </Section>

          <Section title="4. Pagos y suscripciones">
            <p>
              Los pagos online se procesan a través de <strong>dLocal Go</strong>, una plataforma de
              pagos de terceros. Firma no recibe ni almacena los datos de las tarjetas u otros
              medios de pago, que son tratados directamente por dLocal Go conforme a sus propios
              términos y políticas.
            </p>
            <p>
              Cuando el servicio se abona mediante suscripción, el cliente autoriza los cobros
              periódicos por el monto y con la frecuencia previstos en las Condiciones Particulares.
              La falta de pago faculta a Firma a suspender la prestación del servicio hasta su
              regularización.
            </p>
          </Section>

          <Section title="5. Política de no reembolso">
            <p>
              Atento a la naturaleza profesional de los servicios, los montos abonados{' '}
              <strong>no son reembolsables</strong>, total ni parcialmente, salvo que las
              Condiciones Particulares dispongan expresamente lo contrario.
            </p>
          </Section>

          <Section title="6. Baja de la suscripción">
            <p>
              El cliente puede solicitar la baja de su suscripción en cualquier momento,
              comunicándola por escrito a{' '}
              <a href="mailto:agustin@firmasvc.com" className="text-firma hover:underline">
                agustin@firmasvc.com
              </a>
              . La baja surte efecto respecto de los cobros posteriores a la comunicación y no da
              derecho al reintegro de los períodos ya abonados. Lo anterior es sin perjuicio de los
              plazos de preaviso u otras condiciones que se hayan pactado en las Condiciones
              Particulares.
            </p>
          </Section>

          <Section title="7. Confidencialidad">
            <p>
              La información que el cliente comparta con Firma está amparada por el secreto
              profesional y es tratada conforme a nuestra{' '}
              <a href="/privacidad" className="text-firma hover:underline">
                Política de Privacidad
              </a>
              .
            </p>
          </Section>

          <Section title="8. Responsabilidad">
            <p>
              Firma presta sus servicios con la diligencia profesional exigible, asumiendo
              obligaciones de medios y no de resultado. El resultado de trámites que dependen de
              terceros o de organismos públicos no puede garantizarse.
            </p>
          </Section>

          <Section title="9. Modificaciones">
            <p>
              Firma puede modificar estos Términos y Condiciones en cualquier momento. Las
              modificaciones se publican en esta página y no alteran las Condiciones Particulares
              vigentes.
            </p>
          </Section>

          <Section title="10. Ley aplicable y jurisdicción">
            <p>
              Estos Términos y Condiciones se rigen por las leyes de la República Argentina.
              Cualquier controversia se someterá a los tribunales ordinarios de la Ciudad Autónoma
              de Buenos Aires, salvo pacto en contrario en las Condiciones Particulares.
            </p>
          </Section>

          <Section title="11. Contacto">
            <ul className="space-y-3">
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

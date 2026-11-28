import React from 'react';
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react';
import { Logo } from './Logo';
import { Footer } from './Footer';

const LAST_UPDATED = '26 de noviembre de 2026';
const MAIL = 'agustin@firmasvc.com';

const Section: React.FC<{ id?: string; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
  <section id={id} className="mb-10 scroll-mt-8">
    <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">{title}</h2>
    <div className="space-y-4 text-gray-600 leading-relaxed text-[15px] md:text-base">
      {children}
    </div>
  </section>
);

const Sub: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3 pt-2">
    <h3 className="text-base md:text-lg font-semibold text-gray-900">{title}</h3>
    {children}
  </div>
);

const Enlace: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-firma hover:underline">
    {children}
  </a>
);

const Correo: React.FC = () => (
  <a href={`mailto:${MAIL}`} className="text-firma hover:underline">
    {MAIL}
  </a>
);

export const PrivacyPolicy: React.FC = () => {
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
            Política de Privacidad
          </h1>
          <p className="text-sm text-gray-500 mb-12">
            Última actualización {LAST_UPDATED}
          </p>

          <Section title="1. Quiénes somos">
            <p>
              FIRMA es la marca con la que Agustín Castro, abogado (UBA), CUIT 20-43172864-9, con
              domicilio en la Ciudad Autónoma de Buenos Aires, República Argentina, presta servicios
              de consultoría legal para negocios digitales. Agustín Castro es el responsable del
              tratamiento de los datos personales que se describen en esta política.
            </p>
            <p>
              Esta Política de Privacidad explica cómo tratamos la información personal en nuestro
              sitio web (firmasvc.com), en el portal de clientes (firmasvc.com/portal), en la app de
              FIRMA que se instala desde el portal, en nuestros anuncios en Meta (Facebook e
              Instagram) y en nuestros canales de contacto.
            </p>
            <p>
              Para cualquier consulta sobre esta política o sobre tus datos personales, escribinos a{' '}
              <Correo />.
            </p>
          </Section>

          <Section title="2. Qué información recopilamos">
            <Sub title="En el sitio web y en los canales de contacto">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Tu nombre, tu correo electrónico, tu teléfono y lo que escribas en nuestros
                  formularios, en el chat de WhatsApp o al agendar una reunión.
                </li>
                <li>El contenido de tu consulta y la información sobre tu negocio que compartas.</li>
                <li>
                  Datos técnicos de navegación, como dirección IP, tipo de dispositivo, navegador y
                  páginas visitadas, que se recopilan con cookies y tecnologías similares.
                </li>
                <li>
                  Datos que Meta nos comparte cuando interactuás con nuestros anuncios en Facebook o
                  Instagram, agregados o de contacto, para dar seguimiento a tu consulta.
                </li>
              </ul>
            </Sub>
            <Sub title="En el portal de clientes">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Los datos de tu cuenta, como tu nombre, tu correo electrónico, la empresa a la que
                  pertenecés y tu rol. La contraseña no se guarda en forma legible.
                </li>
                <li>
                  Lo que vos o tu empresa cargan en el portal, como clientes, ventas, pagos,
                  documentos, contratos, reuniones, objetivos, reportes y transcripciones de llamadas.
                </li>
                <li>
                  Cuando firmás un documento, la imagen de tu firma y su código de verificación
                  (hash), tu dirección IP, tu dispositivo y la hora, que forman el registro de
                  auditoría de la firma electrónica.
                </li>
                <li>
                  Si activás las notificaciones, la suscripción de tu navegador para recibirlas.
                </li>
                <li>
                  Si conectás tu cuenta de Google, los datos que se explican en la sección 4.
                </li>
              </ul>
            </Sub>
          </Section>

          <Section title="3. Cómo usamos tu información">
            <ul className="list-disc pl-5 space-y-2">
              <li>Para responder tus consultas y prestarte nuestros servicios de consultoría legal.</li>
              <li>
                Para que el portal funcione, por ejemplo para mostrar y ordenar tu información,
                generar contratos, gestionar firmas electrónicas y enviarte avisos y el resumen
                diario por correo.
              </li>
              <li>Para coordinar y agendar reuniones.</li>
              <li>Para enviarte información sobre nuestros servicios, si la pediste.</li>
              <li>
                Para medir la efectividad de nuestras campañas publicitarias en el sitio web público.
                Esto nunca incluye datos del portal ni datos recibidos de Google.
              </li>
              <li>Para proteger la seguridad del sitio y del portal.</li>
              <li>Para cumplir con las obligaciones legales y regulatorias aplicables.</li>
            </ul>
            <p>
              Algunas funciones del portal usan inteligencia artificial, como el análisis de llamadas
              de venta. Lo que produce la inteligencia artificial lo revisa una persona de FIRMA antes
              de que lo vea tu empresa.
            </p>
          </Section>

          <Section id="google" title="4. Datos que recibimos de Google">
            <p>
              El portal permite que cada persona del equipo de una empresa cliente conecte su cuenta
              de Google para usar su Google Calendar dentro del portal. La conexión es opcional, la
              decide cada persona y se hace una vez por cada empresa. Nadie puede conectar la cuenta
              de Google de otra persona.
            </p>

            <Sub title="Qué datos recibimos">
              <p>Al conectar tu cuenta nos das acceso a tres permisos de Google.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>openid</strong>, para identificar tu cuenta de Google.
                </li>
                <li>
                  <strong>userinfo.email</strong>, para ver la dirección de correo de esa cuenta.
                </li>
                <li>
                  <strong>calendar.events.owned</strong>, para ver, crear, modificar y borrar eventos
                  en los calendarios de Google que te pertenecen.
                </li>
              </ul>
            </Sub>

            <Sub title="Para qué los usamos">
              <p>
                Usamos estos datos solo para dos funciones que ves en el portal. La primera es mostrar
                tu agenda de Google en el calendario del equipo de tu empresa, junto a las reuniones
                cargadas en el portal. La segunda es crear en tu calendario las reuniones que se
                agendan para vos desde el portal, con su link de Google Meet y, si se pide, la
                invitación por correo a la persona con quien es la reunión.
              </p>
              <p>
                Solo creamos eventos cuando se agenda una reunión desde el portal. No modificamos ni
                borramos los eventos de tu calendario que no se crearon desde el portal.
              </p>
            </Sub>

            <Sub title="Quién ve tu agenda">
              <p>
                Tu agenda la ven vos y quienes lideran el equipo de tu empresa en el portal, que son
                el titular de la cuenta, quien tiene a cargo el área de Operaciones y el equipo de
                FIRMA que acompaña a tu empresa en la gestión de su equipo. Los eventos que en Google
                marcaste como privados los ven los demás solo como Ocupado.
              </p>
              <p>
                Fuera de eso, nadie de FIRMA lee tus eventos, salvo que nos lo pidas para darte
                soporte, por razones de seguridad o porque lo exija la ley.
              </p>
            </Sub>

            <Sub title="Qué guardamos">
              <p>
                No guardamos los eventos de tu calendario. Se leen de Google cada vez que se abre el
                calendario del equipo. Guardamos el correo de tu cuenta de Google, los permisos que
                diste y un token de actualización cifrado, que solo usa nuestro servidor para pedirle
                acceso a Google en cada uso. De las reuniones creadas desde el portal guardamos además
                el identificador del evento en Google y su link de Google Meet. Todo eso queda en
                Supabase, nuestro proveedor de base de datos.
              </p>
            </Sub>

            <Sub title="Con quién los compartimos">
              <p>
                No vendemos los datos que recibimos de Google. No los compartimos con anunciantes,
                redes de publicidad, Meta ni intermediarios de datos. No los usamos para publicidad ni
                para medir campañas, no los enviamos a servicios de inteligencia artificial y no los
                usamos para entrenar modelos de inteligencia artificial. El Píxel de Meta no se carga
                en el portal.
              </p>
              <p>
                Solo los tratan, por cuenta nuestra, los proveedores que hacen funcionar el portal,
                que son Supabase y Vercel. Fuera de eso los compartimos solo si la ley lo exige o si
                nos das tu consentimiento.
              </p>
            </Sub>

            <Sub title="Cómo desconectar tu cuenta y borrar los datos">
              <p>
                Podés desconectar tu cuenta de Google cuando quieras desde el portal, en Equipo. En ese
                momento le pedimos a Google que revoque el permiso y borramos el token. También podés
                quitar el acceso desde{' '}
                <Enlace href="https://myaccount.google.com/permissions">
                  la configuración de tu cuenta de Google
                </Enlace>
                . Si se elimina tu cuenta del portal, se borra también la conexión con Google.
              </p>
              <p>
                Si además querés que borremos el correo de tu cuenta de Google y los datos de las
                reuniones creadas en tu calendario, escribinos a <Correo /> y lo hacemos dentro de los
                cinco días hábiles.
              </p>
            </Sub>

            <Sub title="Uso limitado">
              <p>
                El uso que FIRMA hace de la información recibida de las API de Google, y su
                transferencia a cualquier otra aplicación, se ajusta a la{' '}
                <Enlace href="https://developers.google.com/terms/api-services-user-data-policy">
                  Política de Datos del Usuario de los Servicios de API de Google
                </Enlace>
                , incluidos los requisitos de Uso Limitado.
              </p>
            </Sub>
          </Section>

          <Section title="5. Publicidad en Meta y herramientas de terceros">
            <p>
              En el sitio web público hacemos campañas publicitarias con Meta Platforms, Inc.
              (Facebook e Instagram). Es posible que usemos herramientas como el Píxel de Meta y
              Conversions API para medir el rendimiento de nuestros anuncios, entender cómo se usa el
              sitio y mostrar publicidad relevante. Estas herramientas no se usan en el portal de
              clientes.
            </p>
            <p>
              Estos servicios pueden recopilar información sobre tu actividad de acuerdo con sus
              propias políticas. Te recomendamos revisar la{' '}
              <Enlace href="https://www.facebook.com/privacy/policy/">Política de Privacidad de Meta</Enlace>
              . También usamos Calendly para agendar reuniones y WhatsApp para comunicarnos, cada uno
              con su propia política de privacidad.
            </p>
          </Section>

          <Section title="6. Cookies y almacenamiento en el navegador">
            <p>
              El sitio web usa cookies y tecnologías similares para funcionar, para analizar el
              tráfico y con fines publicitarios. Podés configurar tu navegador para rechazarlas,
              aunque algunas funciones podrían dejar de andar.
            </p>
            <p>
              El portal solo usa el almacenamiento del navegador necesario para mantener tu sesión,
              recordar tus preferencias y completar la conexión con Google, que deja una cookie
              temporal mientras dura. No usa cookies de publicidad.
            </p>
          </Section>

          <Section title="7. Datos de terceros que tu empresa carga en el portal">
            <p>
              Cuando tu empresa carga en el portal datos de sus clientes, de sus prospectos o de su
              equipo, FIRMA los trata por cuenta de tu empresa y solo para prestarle el servicio. Tu
              empresa es responsable de contar con una base legal para cargarlos y de informar a esas
              personas, por ejemplo avisando que una llamada se graba.
            </p>
            <p>Cada empresa ve solo sus propios datos y nunca los de otra empresa cliente.</p>
          </Section>

          <Section title="8. Con quién compartimos tu información">
            <p>
              No vendemos tu información personal. La compartimos solo con los proveedores que
              necesitamos para operar, siempre bajo obligaciones de confidencialidad, o cuando lo exija
              la ley o una autoridad competente.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Supabase, para la base de datos, el ingreso al portal y los archivos.</li>
              <li>Vercel, para alojar el sitio y el portal.</li>
              <li>Resend, para enviar los correos del portal.</li>
              <li>dLocal Go, para procesar los pagos.</li>
              <li>Anthropic, para las funciones de inteligencia artificial del portal.</li>
              <li>Fathom, si tu empresa conecta sus llamadas.</li>
              <li>
                Google, para Google Calendar si lo conectás y para Google Drive, que usamos un
                instante para pasar documentos a PDF y después borramos la copia.
              </li>
              <li>Calendly, WhatsApp y Meta, para agendar, comunicarnos y publicar anuncios.</li>
            </ul>
            <p>Algunos de estos proveedores alojan los datos fuera de la República Argentina.</p>
          </Section>

          <Section title="9. Conservación de los datos">
            <p>
              Conservamos tu información personal durante el tiempo necesario para cumplir con las
              finalidades de esta política, o mientras exista una relación con vos o con tu empresa,
              salvo que la ley exija o permita un plazo distinto. Las transcripciones de llamadas se
              guardan cifradas por 90 días. Los registros de auditoría de las firmas electrónicas se
              conservan mientras puedan servir como prueba del documento firmado. Los datos que
              recibimos de Google se conservan como se explica en la sección 4.
            </p>
          </Section>

          <Section title="10. Tus derechos">
            <p>
              De acuerdo con la Ley N.º 25.326 de Protección de los Datos Personales, tenés derecho a
              acceder, rectificar, actualizar y pedir la supresión de tus datos personales. Para
              ejercer estos derechos, escribinos a <Correo />. Respondemos los pedidos de
              rectificación, actualización o supresión dentro de los cinco días hábiles.
            </p>
            <p>
              El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a
              ellos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un
              interés legítimo al efecto, conforme lo establecido en el artículo 14, inciso 3, de la
              Ley N.º 25.326.
            </p>
            <p>
              La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la
              Ley N.º 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan
              quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en
              materia de protección de datos personales.
            </p>
          </Section>

          <Section title="11. Seguridad">
            <p>
              Usamos conexiones cifradas, cada empresa ve solo sus propios datos, las claves de los
              servicios que usamos viven solo en nuestro servidor y las cuentas del equipo de FIRMA
              piden un segundo factor para entrar. Aun así, ningún sistema es completamente seguro, por
              lo que no podemos garantizar la seguridad absoluta de la información que se transmite
              por internet.
            </p>
          </Section>

          <Section title="12. Cambios en esta política">
            <p>
              Podemos actualizar esta Política de Privacidad. Publicamos cada cambio en esta página con
              la fecha de la última actualización y, si cambia la forma en que usamos los datos de
              Google, lo avisamos en el portal antes de aplicarlo.
            </p>
          </Section>

          <Section title="13. Contacto">
            <p>
              Si tenés preguntas sobre esta Política de Privacidad o sobre el tratamiento de tus datos
              personales, podés contactarnos por estos medios.
            </p>
            <ul className="space-y-3 pt-2">
              <li>
                <a
                  href={`mailto:${MAIL}`}
                  className="inline-flex items-center gap-3 text-firma hover:underline"
                >
                  <Mail size={16} />
                  {MAIL}
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

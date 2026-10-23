// Ficha del protocolo de onboarding. Todo lo que cambia de un negocio a otro vive acá.

import { OPCIONES_MERCADO, diasLegales, opcion, soloDigitos, textoONull, txt } from '../motor/ficha';
import type { Aviso, DefFicha, Ficha } from '../motor/tipos';

const VACIA: Ficha = {
  empresa: '',
  programa: '',
  duracion: '',
  contenidos: '',
  formulario: '',
  firma: '',
  pasarela: '',
  canal: '',
  correoLegales: '',
  mercado: 'AR',
  perfil: 'B2B',
  respOnboarding: '',
  diasInicio: '5',
  primerHito: '',
  diasResultado: '30',
};

const EJEMPLO: Ficha = {
  empresa: 'Impulso Consultores LLC',
  programa: 'Programa Impulso',
  duracion: '6',
  contenidos: 'la comunidad del programa en Skool',
  formulario: 'el formulario de ingreso',
  firma: 'la firma electrónica de FIRMA',
  pasarela: 'Stripe',
  canal: 'el grupo de WhatsApp del programa',
  correoLegales: 'legales@impulso.com',
  mercado: 'AR',
  perfil: 'B2B',
  respOnboarding: 'Equipo de onboarding',
  diasInicio: '5',
  primerHito: 'el plan de acción del negocio',
  diasResultado: '30',
};

export function numeroDe(f: Ficha, clave: string, porDefecto: number): number {
  const n = soloDigitos(txt(f, clave));
  return n === null ? porDefecto : n;
}

export function plural(n: number | null, uno: string, varios: string): string | null {
  if (n === null) return null;
  return `${n} ${n === 1 ? uno : varios}`;
}

export const FICHA: DefFicha = {
  intro:
    'Se completa una sola vez por negocio. Los mensajes, el checklist de ingreso, los plazos y el índice de salud se actualizan solos, y el enlace configurado permite compartir esta misma versión con el equipo.',
  grupos: [
    {
      titulo: 'Empresa y programa',
      campos: [
        { tipo: 'texto', clave: 'empresa', etiqueta: 'Empresa', ayuda: 'Nombre que firma las comunicaciones formales.', ejemplo: 'Por ejemplo, Impulso Consultores LLC' },
        { tipo: 'texto', clave: 'programa', etiqueta: 'Programa o servicio', ejemplo: 'Por ejemplo, Programa Impulso' },
        { tipo: 'texto', clave: 'duracion', etiqueta: 'Duración del programa', ayuda: 'En meses. Ordena la revisión de mitad de programa y el cierre.', ejemplo: 'Por ejemplo, 6', numerico: true },
        { tipo: 'texto', clave: 'contenidos', etiqueta: 'Plataforma de contenidos', ayuda: 'Donde el cliente accede al material y a la comunidad.', ejemplo: 'Por ejemplo, Skool o Notion' },
        { tipo: 'texto', clave: 'formulario', etiqueta: 'Formulario de ingreso', ayuda: 'Nombre o enlace del formulario que completa el cliente al entrar.', ejemplo: 'Por ejemplo, el formulario de ingreso' },
      ],
    },
    {
      titulo: 'Firma, cobro y canales',
      campos: [
        { tipo: 'texto', clave: 'firma', etiqueta: 'Plataforma de firma', ayuda: 'Los contratos que salen del CRM del portal de FIRMA se firman con la firma electrónica de FIRMA.', ejemplo: 'Por ejemplo, la firma electrónica de FIRMA' },
        { tipo: 'texto', clave: 'pasarela', etiqueta: 'Plataforma de cobro', ayuda: 'Donde se confirma que el pago está acreditado.', ejemplo: 'Por ejemplo, Stripe' },
        { tipo: 'texto', clave: 'canal', etiqueta: 'Canal oficial del servicio', ayuda: 'Donde se confirma todo por escrito.', ejemplo: 'Por ejemplo, el grupo de WhatsApp del programa' },
        { tipo: 'texto', clave: 'correoLegales', etiqueta: 'Correo de legales', ayuda: 'Para pedidos de baja, arrepentimiento y reclamos.', ejemplo: 'Por ejemplo, legales@empresa.com' },
      ],
    },
    {
      titulo: 'Mercado y cliente',
      campos: [
        { tipo: 'opciones', clave: 'mercado', etiqueta: 'Mercado principal', ayuda: 'Define el plazo legal de arrepentimiento y el anexo que aplica.', opciones: OPCIONES_MERCADO },
        {
          tipo: 'opciones',
          clave: 'perfil',
          etiqueta: 'Perfil del cliente',
          ayuda: 'Si compra para uso personal, es consumidor.',
          opciones: [
            { valor: 'B2B', rotulo: 'Profesional o empresa' },
            { valor: 'MIXTO', rotulo: 'Mixto' },
            { valor: 'B2C', rotulo: 'Consumidor' },
          ],
        },
      ],
    },
    {
      titulo: 'Responsable y tiempos',
      campos: [
        { tipo: 'texto', clave: 'respOnboarding', etiqueta: 'Responsable del onboarding', ayuda: 'Rol o persona que acompaña el ingreso.', ejemplo: 'Por ejemplo, Equipo de onboarding' },
        { tipo: 'texto', clave: 'diasInicio', etiqueta: 'Días hábiles hasta la reunión de inicio', ayuda: 'Desde el alta, que es contrato firmado y pago acreditado.', numerico: true },
        { tipo: 'texto', clave: 'primerHito', etiqueta: 'Primer hito', ayuda: 'Un entregable concreto y verificable. Nunca una cifra de facturación.', ejemplo: 'Por ejemplo, el plan de acción del negocio' },
        { tipo: 'texto', clave: 'diasResultado', etiqueta: 'Días objetivo hasta el primer resultado', ayuda: 'Días corridos desde el alta hasta cerrar el primer hito.', numerico: true },
      ],
    },
  ],
  vacia: VACIA,
  ejemplo: EJEMPLO,
  rotulos: {
    empresa: 'empresa',
    programa: 'programa',
    duracion: 'duración del programa',
    contenidos: 'plataforma de contenidos',
    formulario: 'formulario de ingreso',
    firma: 'plataforma de firma',
    pasarela: 'plataforma de cobro',
    canal: 'canal oficial',
    correoLegales: 'correo de legales',
    respOnboarding: 'responsable del onboarding',
    diasInicio: 'plazo de la reunión de inicio',
    primerHito: 'primer hito',
    diasResultado: 'plazo del primer resultado',
    dias: 'plazo legal del país',
    mercadoTexto: 'mercado',
    perfilTexto: 'perfil del cliente',
    plazoLegal: 'plazo legal de arrepentimiento',
    derecho: 'derecho de arrepentimiento',
    avisoArrep: 'recordatorio del derecho de arrepentimiento',
  },
  valores: (f) => ({
    empresa: textoONull(f, 'empresa'),
    programa: textoONull(f, 'programa'),
    duracion: plural(soloDigitos(txt(f, 'duracion')), 'mes', 'meses'),
    contenidos: textoONull(f, 'contenidos'),
    formulario: textoONull(f, 'formulario'),
    firma: textoONull(f, 'firma'),
    pasarela: textoONull(f, 'pasarela'),
    canal: textoONull(f, 'canal'),
    correoLegales: textoONull(f, 'correoLegales'),
    respOnboarding: textoONull(f, 'respOnboarding'),
    diasInicio: plural(soloDigitos(txt(f, 'diasInicio')), 'día hábil', 'días hábiles'),
    primerHito: textoONull(f, 'primerHito'),
    diasResultado: plural(soloDigitos(txt(f, 'diasResultado')), 'día', 'días'),
    dias: diasLegales(f),
    mercadoTexto: opcion(f, 'mercado') === 'AR' ? 'Argentina' : opcion(f, 'mercado') === 'ES' ? 'España' : 'otro país',
    perfilTexto: opcion(f, 'perfil') === 'B2C' ? 'consumidores' : opcion(f, 'perfil') === 'MIXTO' ? 'mixto, empresas y consumidores' : 'profesionales y empresas',
  }),
  macros: (f) => {
    const m = opcion(f, 'mercado');
    return {
      plazoLegal: m === 'AR' ? '10 días corridos desde la celebración del contrato' : m === 'ES' ? '14 días naturales desde la celebración del contrato' : 'el plazo legal del país del cliente',
      derecho: m === 'ES' ? 'derecho de desistimiento' : 'derecho de arrepentimiento',
      avisoArrep:
        m === 'AR'
          ? 'Te recordamos que, como figura destacado en tu contrato, podés arrepentirte dentro de los 10 días corridos desde la celebración del contrato, sin dar motivos, escribiendo a {correoLegales} o por el mismo medio por el que contrataste.'
          : m === 'ES'
            ? 'Te recordamos que, como figura en tu contrato, podés desistir dentro de los 14 días naturales desde la celebración del contrato, sin indicar motivos, escribiendo a {correoLegales}. Si nos pediste que el servicio empiece dentro de ese plazo y después desistís, se abona solo la parte ya prestada.'
            : 'Te recordamos que tenés el derecho de arrepentimiento que te reconoce la ley de tu país, en las condiciones que figuran en tu contrato. Para ejercerlo, escribinos a {correoLegales}.',
    };
  },
  avisos: (f) => {
    const avisos: Aviso[] = [];
    const perfil = opcion(f, 'perfil');
    const mercado = opcion(f, 'mercado');
    if (perfil === 'B2C' || perfil === 'MIXTO') {
      avisos.push({
        nivel: 'info',
        texto: 'Con clientes consumidores, el aviso de arrepentimiento va en caracteres destacados inmediatamente antes de la firma y la bienvenida lo recuerda. Revisá que el modelo de contrato lo tenga antes de enviarlo.',
      });
      if (mercado === 'ES') {
        avisos.push({
          nivel: 'alerta',
          texto: 'En España, si el cliente quiere empezar antes de que venza el plazo de desistimiento, hace falta su solicitud expresa antes del primer acceso, guardada en un soporte duradero. Sin ella, no paga lo prestado durante el plazo si desiste.',
        });
      }
    }
    if (perfil === 'B2B') {
      avisos.push({
        nivel: 'info',
        texto: 'Con clientes empresa, registrá en el CRM a qué se dedica el cliente y para qué contrata. Declararlo en el contrato no alcanza si en los hechos compra para uso personal.',
      });
    }
    if (mercado === 'OTRO') {
      avisos.push({ nivel: 'alerta', texto: 'Para otros países cambian el plazo de arrepentimiento y las reglas de firma electrónica. Definilos con legales antes de usar las plantillas.' });
    }
    const inicio = soloDigitos(txt(f, 'diasInicio'));
    if (inicio !== null && inicio > 7) {
      avisos.push({ nivel: 'alerta', texto: 'Más de siete días hábiles hasta la reunión de inicio dejan al cliente mucho tiempo sin una primera experiencia del servicio. Revisá si se puede acortar.' });
    }
    const resultado = soloDigitos(txt(f, 'diasResultado'));
    if (resultado !== null && resultado > 30) {
      avisos.push({ nivel: 'info', texto: 'El primer resultado queda después del seguimiento de los 30 días. Sumá un hito intermedio para que ese seguimiento tenga algo concreto que medir.' });
    }
    if (!txt(f, 'firma')) {
      avisos.push({ nivel: 'info', texto: 'Cargá la plataforma de firma. Si los contratos salen del CRM del portal de FIRMA, es la firma electrónica de FIRMA.' });
    }
    if (!txt(f, 'duracion')) {
      avisos.push({ nivel: 'info', texto: 'Cargá la duración del programa para que la calculadora de plazos marque la revisión de mitad de programa y el cierre.' });
    }
    return avisos;
  },
  resumen: [
    { rotulo: 'Empresa', texto: '{empresa}, {programa}, {duracion}' },
    { rotulo: 'Firma y cobro', texto: '{firma} y {pasarela}' },
    { rotulo: 'Canales', texto: '{canal}, {contenidos} y {correoLegales}' },
    { rotulo: 'Mercado y cliente', texto: '{mercadoTexto}, {perfilTexto}' },
    { rotulo: 'Responsable', texto: '{respOnboarding}, con {formulario}' },
    { rotulo: 'Tiempos', texto: 'Reunión de inicio dentro de {diasInicio}. Primer resultado, {primerHito}, dentro de {diasResultado}' },
  ],
};

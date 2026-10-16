// Ficha del protocolo de datos personales. Todo lo que cambia de un negocio a otro vive acá.

import { OPCIONES_MERCADO, bool, opcion, soloDigitos, textoONull, txt } from '../motor/ficha';
import type { Aviso, DefFicha, Ficha } from '../motor/tipos';

const VACIA: Ficha = {
  empresa: '',
  domicilio: '',
  mercado: 'AR',
  contacto: '',
  canalDerechos: '',
  politica: '',
  crm: '',
  registro: '',
  correoMasivo: '',
  firma: '',
  pasarela: '',
  mesesLlamadas: '12',
  mesesInteresados: '12',
  aniosClientes: '5',
  exterior: false,
  sensibles: false,
  delegado: false,
  contactoDelegado: '',
};

const EJEMPLO: Ficha = {
  empresa: 'Impulso Consultores LLC',
  domicilio: 'Av. Corrientes 1000, Ciudad de Buenos Aires',
  mercado: 'AR',
  contacto: 'Equipo de legales',
  canalDerechos: 'privacidad@impulso.com',
  politica: 'impulso.com/privacidad',
  crm: 'HubSpot',
  registro: 'Fathom',
  correoMasivo: 'Mailchimp',
  firma: 'ZapSign',
  pasarela: 'Stripe',
  mesesLlamadas: '12',
  mesesInteresados: '12',
  aniosClientes: '5',
  exterior: true,
  sensibles: false,
  delegado: false,
  contactoDelegado: '',
};

export function numeroDe(f: Ficha, clave: string, porDefecto: number): number {
  const n = soloDigitos(txt(f, clave));
  return n === null ? porDefecto : n;
}

function plural(n: number | null, uno: string, varios: string): string | null {
  if (n === null) return null;
  return `${n} ${n === 1 ? uno : varios}`;
}

function situaciones(f: Ficha): string {
  const lista: string[] = [];
  if (bool(f, 'exterior')) lista.push('proveedores en el exterior');
  if (bool(f, 'sensibles')) lista.push('datos sensibles');
  if (bool(f, 'delegado') && opcion(f, 'mercado') === 'ES') lista.push('delegado de protección de datos designado');
  if (!lista.length) return 'Sin proveedores en el exterior, datos sensibles ni delegado';
  const texto = lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const FICHA: DefFicha = {
  intro:
    'Se completa una sola vez por negocio. Los avisos, las plantillas, el mapa de datos y la calculadora de plazos se actualizan solos, y el enlace configurado permite compartir esta misma versión con el equipo.',
  grupos: [
    {
      titulo: 'Responsable y contacto',
      campos: [
        { tipo: 'texto', clave: 'empresa', etiqueta: 'Empresa', ayuda: 'Responsable de los datos, como figura en la política de privacidad.', ejemplo: 'Por ejemplo, Impulso Consultores LLC' },
        { tipo: 'texto', clave: 'domicilio', etiqueta: 'Domicilio del responsable', ayuda: 'En Argentina se informa en cada aviso de privacidad.', ejemplo: 'Por ejemplo, Av. Corrientes 1000, Ciudad de Buenos Aires' },
        { tipo: 'opciones', clave: 'mercado', etiqueta: 'Mercado principal', ayuda: 'Define plazos, autoridad de control y textos legales.', opciones: OPCIONES_MERCADO },
        { tipo: 'texto', clave: 'contacto', etiqueta: 'Contacto de privacidad', ayuda: 'Persona o área que coordina la privacidad y responde los pedidos.', ejemplo: 'Por ejemplo, Equipo de legales' },
        { tipo: 'texto', clave: 'canalDerechos', etiqueta: 'Canal para ejercer derechos', ayuda: 'Correo o formulario donde los titulares hacen sus pedidos.', ejemplo: 'Por ejemplo, privacidad@empresa.com' },
        { tipo: 'texto', clave: 'politica', etiqueta: 'Enlace a la política de privacidad', ayuda: 'Los avisos cortos remiten a la información completa.', ejemplo: 'Por ejemplo, empresa.com/privacidad' },
      ],
    },
    {
      titulo: 'Herramientas',
      campos: [
        { tipo: 'texto', clave: 'crm', etiqueta: 'CRM', ayuda: 'Donde viven interesados y clientes.', ejemplo: 'Por ejemplo, HubSpot' },
        { tipo: 'texto', clave: 'registro', etiqueta: 'Herramienta de registro de llamadas', ejemplo: 'Por ejemplo, Fathom' },
        { tipo: 'texto', clave: 'correoMasivo', etiqueta: 'Herramienta de correo masivo', ayuda: 'Newsletters y campañas.', ejemplo: 'Por ejemplo, Mailchimp' },
        { tipo: 'texto', clave: 'firma', etiqueta: 'Plataforma de firma', ejemplo: 'Por ejemplo, ZapSign' },
        { tipo: 'texto', clave: 'pasarela', etiqueta: 'Plataforma de cobro', ayuda: 'Guarda los datos de tarjeta, la empresa no.', ejemplo: 'Por ejemplo, Stripe' },
      ],
    },
    {
      titulo: 'Plazos de conservación',
      campos: [
        {
          tipo: 'texto',
          clave: 'mesesLlamadas',
          etiqueta: 'Meses de conservación de los registros de llamadas',
          ayuda: 'Para llamadas sin venta. Las que terminan en venta siguen el plazo de clientes.',
          numerico: true,
        },
        { tipo: 'texto', clave: 'mesesInteresados', etiqueta: 'Meses de conservación de interesados que no compraron', ayuda: 'Se cuentan desde el último contacto.', numerico: true },
        { tipo: 'texto', clave: 'aniosClientes', etiqueta: 'Años de conservación de clientes', ayuda: 'Se cuentan desde que termina el contrato.', numerico: true },
      ],
    },
    {
      titulo: 'Situaciones especiales',
      campos: [
        { tipo: 'interruptor', clave: 'exterior', etiqueta: 'Usa proveedores con servidores en el exterior', ayuda: 'Por ejemplo CRM, registro de llamadas o correo masivo alojados en Estados Unidos.' },
        { tipo: 'interruptor', clave: 'sensibles', etiqueta: 'Trata datos sensibles, por ejemplo de salud', ayuda: 'Los programas de bienestar, nutrición, entrenamiento o salud mental suelen pedirlos.' },
        {
          tipo: 'interruptor',
          clave: 'delegado',
          etiqueta: 'Tiene delegado de protección de datos',
          ayuda: 'Solo para el RGPD. Es obligatorio en los casos del art. 37 RGPD y del art. 34 LOPDGDD.',
          cuando: (f) => opcion(f, 'mercado') === 'ES',
        },
        {
          tipo: 'texto',
          clave: 'contactoDelegado',
          etiqueta: 'Contacto del delegado',
          ejemplo: 'Por ejemplo, dpo@empresa.com',
          cuando: (f) => opcion(f, 'mercado') === 'ES' && bool(f, 'delegado'),
        },
      ],
    },
  ],
  vacia: VACIA,
  ejemplo: EJEMPLO,
  rotulos: {
    empresa: 'empresa',
    domicilio: 'domicilio del responsable',
    contacto: 'contacto de privacidad',
    canalDerechos: 'canal para ejercer derechos',
    politica: 'enlace a la política de privacidad',
    crm: 'CRM',
    registro: 'herramienta de registro de llamadas',
    correoMasivo: 'herramienta de correo masivo',
    firma: 'plataforma de firma',
    pasarela: 'plataforma de cobro',
    mesesLlamadas: 'plazo de las llamadas sin venta',
    mesesInteresados: 'plazo de los interesados',
    aniosClientes: 'plazo de los clientes',
    contactoDelegado: 'contacto del delegado',
  },
  valores: (f) => ({
    empresa: textoONull(f, 'empresa'),
    domicilio: textoONull(f, 'domicilio'),
    contacto: textoONull(f, 'contacto'),
    canalDerechos: textoONull(f, 'canalDerechos'),
    politica: textoONull(f, 'politica'),
    crm: textoONull(f, 'crm'),
    registro: textoONull(f, 'registro'),
    correoMasivo: textoONull(f, 'correoMasivo'),
    firma: textoONull(f, 'firma'),
    pasarela: textoONull(f, 'pasarela'),
    mesesLlamadas: plural(soloDigitos(txt(f, 'mesesLlamadas')), 'mes', 'meses'),
    mesesInteresados: plural(soloDigitos(txt(f, 'mesesInteresados')), 'mes', 'meses'),
    aniosClientes: plural(soloDigitos(txt(f, 'aniosClientes')), 'año', 'años'),
    contactoDelegado: textoONull(f, 'contactoDelegado'),
    mercadoTexto: opcion(f, 'mercado') === 'AR' ? 'Argentina' : opcion(f, 'mercado') === 'ES' ? 'España' : 'otro país',
    situaciones: situaciones(f),
  }),
  macros: (f) => {
    const m = opcion(f, 'mercado');
    const ar = m === 'AR';
    const es = m === 'ES';
    return {
      normaDatos: ar ? 'la Ley 25.326 de Protección de los Datos Personales' : es ? 'el RGPD y la LOPDGDD' : 'la ley de protección de datos aplicable',
      autoridad: ar
        ? 'la Agencia de Acceso a la Información Pública (AAIP)'
        : es
          ? 'la Agencia Española de Protección de Datos (AEPD)'
          : 'la autoridad de protección de datos que corresponda',
      autoridadCorta: ar ? 'la AAIP' : es ? 'la AEPD' : 'la autoridad de control',
      plazoAcceso: ar ? '10 días corridos' : es ? 'un mes' : 'los plazos de la ley aplicable',
      plazoRectificacion: ar ? '5 días hábiles' : es ? 'un mes' : 'los plazos de la ley aplicable',
      plazosPedidos: ar
        ? '10 días corridos para el acceso y 5 días hábiles para rectificar, actualizar o suprimir'
        : es
          ? 'un mes, prorrogable dos meses más si el pedido es complejo'
          : 'los plazos de la ley aplicable',
      derechos: ar
        ? 'acceso, rectificación, actualización y supresión'
        : es
          ? 'acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad'
          : 'acceso, rectificación y supresión',
      viaReclamo: ar ? 'la denuncia ante la AAIP o la acción de hábeas data' : es ? 'la reclamación ante la AEPD' : 'el reclamo ante la autoridad que corresponda',
      plazoBrecha: ar ? 'Según la evaluación de legales' : es ? 'Dentro de las 72 horas desde que se tuvo constancia' : 'Según la ley aplicable',
      mecanismoTransferencia: ar
        ? 'cláusulas modelo de transferencia o consentimiento expreso del titular'
        : es
          ? 'decisión de adecuación, Marco de Privacidad de Datos UE y EE.UU. o cláusulas contractuales tipo'
          : 'la garantía que exija la ley aplicable',
      mecanismoProveedor: ar
        ? 'las cláusulas modelo de transferencia aprobadas por la autoridad argentina'
        : es
          ? 'las cláusulas contractuales tipo de la Comisión Europea o la adhesión al Marco de Privacidad de Datos UE y EE.UU.'
          : 'las cláusulas que exija la ley aplicable',
      confidencialidadLegal: ar ? 'conforme al art. 10 de la Ley 25.326' : es ? 'conforme al art. 5 de la LOPDGDD' : 'conforme a la ley aplicable',
      bloqueoTexto: ar
        ? 'separado y sin uso, solo para cumplir esa obligación'
        : es
          ? 'bloqueado y sin uso hasta que prescriban las responsabilidades'
          : 'separado y sin uso',
    };
  },
  avisos: (f) => {
    const avisos: Aviso[] = [];
    const m = opcion(f, 'mercado');
    if (m === 'OTRO') {
      avisos.push({ nivel: 'alerta', texto: 'Para otros países cambian los plazos, las bases legales y la autoridad de control. Definilos con legales antes de usar las plantillas.' });
    }
    if (!txt(f, 'canalDerechos')) {
      avisos.push({ nivel: 'alerta', texto: 'Sin un canal para ejercer derechos, el aviso de privacidad y las respuestas a los titulares quedan incompletos.' });
    }
    if (m === 'AR' && !txt(f, 'domicilio')) {
      avisos.push({ nivel: 'info', texto: 'En Argentina el aviso de privacidad tiene que informar el domicilio del responsable (art. 6 de la Ley 25.326).' });
    }
    if (bool(f, 'exterior')) {
      avisos.push({
        nivel: 'alerta',
        texto:
          m === 'ES'
            ? 'Con proveedores fuera del Espacio Económico Europeo, verificá que cada uno esté adherido al Marco de Privacidad de Datos UE y EE.UU. o firme cláusulas contractuales tipo.'
            : m === 'AR'
              ? 'Con proveedores en el exterior, verificá que cada uno firme cláusulas modelo de transferencia o que su país figure entre los adecuados para la AAIP. Estados Unidos no figura en esa lista.'
              : 'Con proveedores en el exterior, definí con legales qué garantía de transferencia exige la ley aplicable antes de cargar datos.',
      });
    }
    if (bool(f, 'sensibles')) {
      avisos.push({
        nivel: 'riesgo',
        texto: 'Con datos de salud u otros sensibles, el consentimiento tiene que ser expreso y separado, y el acceso todavía más restringido. Revisá con legales qué datos se piden y para qué.',
      });
      if (m === 'ES' && !bool(f, 'delegado')) {
        avisos.push({ nivel: 'alerta', texto: 'En España, tratar datos de salud a gran escala puede exigir un delegado de protección de datos y una evaluación de impacto. Revisalo con legales.' });
      }
    }
    if (m === 'ES' && bool(f, 'delegado')) {
      avisos.push({ nivel: 'info', texto: 'La designación del delegado se comunica a la AEPD dentro de los diez días y su contacto se publica en la política de privacidad.' });
    }
    const llamadas = soloDigitos(txt(f, 'mesesLlamadas'));
    const interesados = soloDigitos(txt(f, 'mesesInteresados'));
    const clientes = soloDigitos(txt(f, 'aniosClientes'));
    if (llamadas !== null && llamadas > 12) {
      avisos.push({ nivel: 'info', texto: 'El protocolo de llamadas de venta sugiere conservar las llamadas sin venta entre seis y doce meses. Si el plazo es mayor, dejá anotado el motivo.' });
    }
    if (llamadas !== null && interesados !== null && llamadas > interesados) {
      avisos.push({ nivel: 'info', texto: 'Las llamadas sin venta se conservan más que los datos del interesado. Conviene alinear los dos plazos.' });
    }
    if (clientes !== null && clientes > 5) {
      avisos.push({
        nivel: 'info',
        texto: 'Más de cinco años para clientes supera la pauta del protocolo de llamadas. La documentación contable tiene su propio plazo y no hace falta estirar el de todo el legajo.',
      });
    }
    if (!txt(f, 'politica')) {
      avisos.push({ nivel: 'info', texto: 'Cargá el enlace a la política de privacidad para que los avisos cortos remitan a la información completa.' });
    }
    return avisos;
  },
  resumen: [
    { rotulo: 'Responsable', texto: '{empresa}, {domicilio}' },
    { rotulo: 'Privacidad', texto: '{contacto}, pedidos a {canalDerechos}, política en {politica}' },
    { rotulo: 'Mercado', texto: '{mercadoTexto}, {normaDatos}' },
    { rotulo: 'Herramientas', texto: '{crm}, {registro}, {correoMasivo}, {firma} y {pasarela}' },
    { rotulo: 'Conservación', texto: 'Llamadas sin venta {mesesLlamadas}, interesados {mesesInteresados}, clientes {aniosClientes}' },
    { rotulo: 'Situaciones especiales', texto: '{situaciones}' },
  ],
};

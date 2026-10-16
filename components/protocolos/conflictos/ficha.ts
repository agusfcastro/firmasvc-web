// Ficha del protocolo de conflictos. Todo lo que cambia de un negocio a otro vive acá.

import { OPCIONES_MERCADO, OPCIONES_MONEDA, diasLegales, formatearMonto, monedaDe, opcion, soloDigitos, textoONull, txt } from '../motor/ficha';
import type { Aviso, DefFicha, Ficha } from '../motor/tipos';

const VACIA: Ficha = {
  empresa: '',
  programa: '',
  canal: '',
  correoLegales: '',
  firma: '',
  pasarela: '',
  mercado: 'AR',
  perfil: 'B2B',
  moneda: 'USD',
  precio: '',
  respAcomp: '',
  respLegales: '',
  horas: '2',
  diasRespuesta: '3',
  vigencia: '5',
  topeLider: '',
  topeLegales: '',
};

const EJEMPLO: Ficha = {
  empresa: 'Impulso Consultores LLC',
  programa: 'Programa Impulso',
  canal: 'el grupo de WhatsApp del programa',
  correoLegales: 'legales@impulso.com',
  firma: 'ZapSign',
  pasarela: 'Stripe',
  mercado: 'AR',
  perfil: 'B2B',
  moneda: 'USD',
  precio: '3000',
  respAcomp: 'Equipo de acompañamiento',
  respLegales: 'Equipo de legales',
  horas: '2',
  diasRespuesta: '3',
  vigencia: '5',
  topeLider: '10',
  topeLegales: '30',
};

export function numeroDe(f: Ficha, clave: string, porDefecto: number): number {
  const n = soloDigitos(txt(f, clave));
  return n === null ? porDefecto : n;
}

function porcentaje(f: Ficha, clave: string): string | null {
  const n = soloDigitos(txt(f, clave));
  if (n === null) return null;
  const precio = soloDigitos(txt(f, 'precio'));
  const monto = precio !== null ? formatearMonto(monedaDe(f), (precio * n) / 100) : null;
  return monto ? `${n}% del precio, ${monto}` : `${n}% del precio`;
}

function plural(n: number | null, uno: string, varios: string): string | null {
  if (n === null) return null;
  return `${n} ${n === 1 ? uno : varios}`;
}

export const FICHA: DefFicha = {
  intro:
    'Se completa una sola vez por negocio. Las plantillas, la matriz de autorizaciones y la calculadora se actualizan solas, y el enlace configurado permite compartir esta misma versión con el equipo.',
  grupos: [
    {
      titulo: 'Empresa y servicio',
      campos: [
        { tipo: 'texto', clave: 'empresa', etiqueta: 'Empresa', ayuda: 'Nombre que firma las comunicaciones formales.', ejemplo: 'Por ejemplo, Impulso Consultores LLC' },
        { tipo: 'texto', clave: 'programa', etiqueta: 'Programa o servicio', ejemplo: 'Por ejemplo, Programa Impulso' },
        { tipo: 'texto', clave: 'canal', etiqueta: 'Canal oficial del servicio', ayuda: 'Donde se confirma todo por escrito.', ejemplo: 'Por ejemplo, el grupo de WhatsApp del programa' },
        { tipo: 'texto', clave: 'correoLegales', etiqueta: 'Correo de legales', ayuda: 'Único canal una vez derivado el caso.', ejemplo: 'Por ejemplo, legales@empresa.com' },
        { tipo: 'texto', clave: 'firma', etiqueta: 'Plataforma de firma', ejemplo: 'Por ejemplo, ZapSign' },
        { tipo: 'texto', clave: 'pasarela', etiqueta: 'Plataforma de cobro', ayuda: 'Define el plazo para responder contracargos.', ejemplo: 'Por ejemplo, Stripe' },
      ],
    },
    {
      titulo: 'Mercado y cliente',
      campos: [
        { tipo: 'opciones', clave: 'mercado', etiqueta: 'Mercado principal', ayuda: 'Define el plazo legal de arrepentimiento.', opciones: OPCIONES_MERCADO },
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
        { tipo: 'opciones', clave: 'moneda', etiqueta: 'Moneda', opciones: OPCIONES_MONEDA },
        { tipo: 'texto', clave: 'precio', etiqueta: 'Precio de referencia', ayuda: 'Solo números. Base de los topes de concesión.', ejemplo: 'Por ejemplo, 3000', numerico: true },
      ],
    },
    {
      titulo: 'Responsables y tiempos',
      campos: [
        { tipo: 'texto', clave: 'respAcomp', etiqueta: 'Responsable de acompañamiento', ayuda: 'Rol o persona que contiene y ofrece alternativas.', ejemplo: 'Por ejemplo, Equipo de acompañamiento' },
        { tipo: 'texto', clave: 'respLegales', etiqueta: 'Responsable de legales', ejemplo: 'Por ejemplo, Equipo de legales' },
        { tipo: 'texto', clave: 'horas', etiqueta: 'Horas mínimas antes de responder', ayuda: 'Regla de enfriamiento. Se recomiendan al menos dos.', numerico: true },
        { tipo: 'texto', clave: 'diasRespuesta', etiqueta: 'Días hábiles para la respuesta legal', numerico: true },
        { tipo: 'texto', clave: 'vigencia', etiqueta: 'Días hábiles de vigencia de una oferta', numerico: true },
      ],
    },
    {
      titulo: 'Topes de concesión',
      campos: [
        { tipo: 'texto', clave: 'topeLider', etiqueta: 'Tope del líder del área', ayuda: 'Porcentaje del precio que puede autorizar.', ejemplo: 'Por ejemplo, 10', numerico: true },
        { tipo: 'texto', clave: 'topeLegales', etiqueta: 'Tope de legales', ayuda: 'Por encima de este tope decide la dirección.', ejemplo: 'Por ejemplo, 30', numerico: true },
      ],
    },
  ],
  vacia: VACIA,
  ejemplo: EJEMPLO,
  rotulos: {
    empresa: 'empresa',
    programa: 'programa',
    canal: 'canal oficial',
    correoLegales: 'correo de legales',
    firma: 'plataforma de firma',
    pasarela: 'plataforma de cobro',
    precio: 'precio de referencia',
    respAcomp: 'responsable de acompañamiento',
    respLegales: 'responsable de legales',
    horas: 'horas de enfriamiento',
    diasRespuesta: 'plazo de respuesta legal',
    vigencia: 'vigencia de la oferta',
    topeLider: 'tope del líder',
    topeLegales: 'tope de legales',
    dias: 'plazo legal del país',
  },
  valores: (f) => ({
    empresa: textoONull(f, 'empresa'),
    programa: textoONull(f, 'programa'),
    canal: textoONull(f, 'canal'),
    correoLegales: textoONull(f, 'correoLegales'),
    firma: textoONull(f, 'firma'),
    pasarela: textoONull(f, 'pasarela'),
    precio: formatearMonto(monedaDe(f), txt(f, 'precio')),
    respAcomp: textoONull(f, 'respAcomp'),
    respLegales: textoONull(f, 'respLegales'),
    horas: plural(soloDigitos(txt(f, 'horas')), 'hora', 'horas'),
    diasRespuesta: plural(soloDigitos(txt(f, 'diasRespuesta')), 'día hábil', 'días hábiles'),
    vigencia: plural(soloDigitos(txt(f, 'vigencia')), 'día hábil', 'días hábiles'),
    topeLider: porcentaje(f, 'topeLider'),
    topeLegales: porcentaje(f, 'topeLegales'),
    dias: diasLegales(f),
    mercadoTexto: opcion(f, 'mercado') === 'AR' ? 'Argentina' : opcion(f, 'mercado') === 'ES' ? 'España' : 'otro país',
    perfilTexto: opcion(f, 'perfil') === 'B2C' ? 'consumidores' : opcion(f, 'perfil') === 'MIXTO' ? 'mixto, empresas y consumidores' : 'profesionales y empresas',
  }),
  macros: (f) => {
    const m = opcion(f, 'mercado');
    return {
      plazoLegal: m === 'AR' ? '10 días corridos desde la contratación' : m === 'ES' ? '14 días naturales desde la contratación' : 'el plazo legal del país del cliente',
      normaRevocacion:
        m === 'AR'
          ? 'art. 1110 del Código Civil y Comercial y art. 34 de la Ley 24.240'
          : m === 'ES'
            ? 'arts. 102 y siguientes del TRLGDCU'
            : 'la ley de consumo del país del cliente',
      organismo: m === 'AR' ? 'Defensa del Consumidor' : 'un organismo de consumo',
    };
  },
  avisos: (f) => {
    const avisos: Aviso[] = [];
    const perfil = opcion(f, 'perfil');
    if (perfil === 'B2C' || perfil === 'MIXTO') {
      avisos.push({
        nivel: 'info',
        texto: 'Con clientes consumidores la compuerta legal se aplica siempre. Revisá que el contrato informe el derecho de arrepentimiento en forma destacada antes de la firma.',
      });
    }
    if (opcion(f, 'mercado') === 'OTRO') {
      avisos.push({ nivel: 'alerta', texto: 'Para otros países el plazo de arrepentimiento y los organismos cambian. Definilos con legales antes de usar las plantillas de devolución.' });
    }
    const lider = soloDigitos(txt(f, 'topeLider'));
    const legales = soloDigitos(txt(f, 'topeLegales'));
    if (lider !== null && legales !== null && lider > legales) {
      avisos.push({ nivel: 'alerta', texto: 'El tope del líder supera al de legales. Revisá la matriz de autorizaciones.' });
    }
    const horas = soloDigitos(txt(f, 'horas'));
    if (horas !== null && horas < 2) {
      avisos.push({ nivel: 'alerta', texto: 'Menos de dos horas de enfriamiento deja poco margen para la segunda lectura.' });
    }
    if (!txt(f, 'precio')) {
      avisos.push({ nivel: 'info', texto: 'Cargá el precio de referencia para que la matriz y la calculadora muestren montos.' });
    }
    return avisos;
  },
  resumen: [
    { rotulo: 'Empresa', texto: '{empresa}, {programa}' },
    { rotulo: 'Canales', texto: '{canal} y {correoLegales}' },
    { rotulo: 'Mercado y cliente', texto: '{mercadoTexto}, {perfilTexto}' },
    { rotulo: 'Tiempos', texto: '{horas} de enfriamiento, respuesta legal en {diasRespuesta}, ofertas por {vigencia}' },
    { rotulo: 'Topes', texto: 'Líder {topeLider}. Legales {topeLegales}' },
  ],
};

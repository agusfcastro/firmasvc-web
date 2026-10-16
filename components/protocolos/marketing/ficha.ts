// Ficha del protocolo de marketing y publicidad. Todo lo que cambia de un negocio a otro vive acá.

import { OPCIONES_MERCADO, OPCIONES_MONEDA, bool, opcion, soloDigitos, textoONull, txt } from '../motor/ficha';
import type { Aviso, DefFicha, Ficha } from '../motor/tipos';

export const OPCIONES_NICHO = [
  { valor: 'general', rotulo: 'General o negocios' },
  { valor: 'salud', rotulo: 'Salud y bienestar' },
  { valor: 'finanzas', rotulo: 'Finanzas e inversiones' },
  { valor: 'inmobiliario', rotulo: 'Inmobiliario' },
];

const VACIA: Ficha = {
  empresa: '',
  programa: '',
  canales: '',
  politica: '',
  correoLegales: '',
  correoPrivacidad: '',
  mercado: 'AR',
  nicho: 'general',
  moneda: 'USD',
  testimonios: true,
  influencers: true,
  promociones: true,
  comunicaciones: true,
  llamadas: false,
  respMarketing: '',
  respAprobacion: '',
  diasRevision: '2',
};

const EJEMPLO: Ficha = {
  empresa: 'Impulso Consultores LLC',
  programa: 'Programa Impulso',
  canales: 'Instagram, YouTube, anuncios pagos y correo',
  politica: 'impulso.com/privacidad',
  correoLegales: 'legales@impulso.com',
  correoPrivacidad: 'privacidad@impulso.com',
  mercado: 'AR',
  nicho: 'general',
  moneda: 'USD',
  testimonios: true,
  influencers: true,
  promociones: true,
  comunicaciones: true,
  llamadas: true,
  respMarketing: 'Equipo de marketing',
  respAprobacion: 'Dirección comercial',
  diasRevision: '2',
};

function plural(n: number | null, uno: string, varios: string): string | null {
  if (n === null) return null;
  return `${n} ${n === 1 ? uno : varios}`;
}

const NICHO_TEXTO: Record<string, string> = {
  general: 'nicho general',
  salud: 'nicho de salud y bienestar',
  finanzas: 'nicho de finanzas e inversiones',
  inmobiliario: 'nicho inmobiliario',
};

function practicas(f: Ficha): string {
  const lista: string[] = [];
  if (bool(f, 'testimonios')) lista.push('testimonios');
  if (bool(f, 'influencers')) lista.push('influencers o afiliados');
  if (bool(f, 'promociones')) lista.push('promociones con plazo o cupos');
  if (bool(f, 'comunicaciones')) lista.push('comunicaciones por correo o mensajería');
  if (bool(f, 'llamadas')) lista.push('llamadas comerciales');
  if (!lista.length) return 'sin testimonios, influencers, promociones ni comunicaciones';
  if (lista.length === 1) return lista[0];
  const ultimo = lista[lista.length - 1];
  const nexo = /^h?i/i.test(ultimo) ? 'e' : 'y';
  return `${lista.slice(0, -1).join(', ')} ${nexo} ${ultimo}`;
}

export const FICHA: DefFicha = {
  intro:
    'Se completa una sola vez por negocio. Las plantillas, el revisor de piezas, las reglas del nicho y la calculadora se actualizan solas, y el enlace configurado permite compartir esta misma versión con el equipo.',
  grupos: [
    {
      titulo: 'Empresa y programa',
      campos: [
        { tipo: 'texto', clave: 'empresa', etiqueta: 'Empresa', ayuda: 'Nombre que firma las piezas y las comunicaciones formales.', ejemplo: 'Por ejemplo, Impulso Consultores LLC' },
        { tipo: 'texto', clave: 'programa', etiqueta: 'Programa o servicio', ejemplo: 'Por ejemplo, Programa Impulso' },
        {
          tipo: 'texto',
          clave: 'canales',
          etiqueta: 'Canales que usa',
          ayuda: 'Redes, anuncios, página de venta, correo o mensajería.',
          ejemplo: 'Por ejemplo, Instagram, YouTube, anuncios pagos y correo',
          ancho: true,
        },
        { tipo: 'texto', clave: 'politica', etiqueta: 'Política de privacidad', ayuda: 'Dirección donde está publicada.', ejemplo: 'Por ejemplo, impulso.com/privacidad' },
        { tipo: 'texto', clave: 'correoLegales', etiqueta: 'Correo de legales', ayuda: 'Autorizaciones, revocaciones y consultas formales.', ejemplo: 'Por ejemplo, legales@empresa.com' },
        {
          tipo: 'texto',
          clave: 'correoPrivacidad',
          etiqueta: 'Correo de privacidad y bajas',
          ayuda: 'Donde se piden las bajas y se ejercen los derechos sobre los datos.',
          ejemplo: 'Por ejemplo, privacidad@empresa.com',
        },
      ],
    },
    {
      titulo: 'Mercado y nicho',
      campos: [
        { tipo: 'opciones', clave: 'mercado', etiqueta: 'Mercado principal', ayuda: 'Define las normas de publicidad, imagen y comunicaciones.', opciones: OPCIONES_MERCADO },
        { tipo: 'opciones', clave: 'nicho', etiqueta: 'Nicho', ayuda: 'Salud y finanzas tienen reglas más estrictas.', opciones: OPCIONES_NICHO },
        { tipo: 'opciones', clave: 'moneda', etiqueta: 'Moneda', ayuda: 'Se usa en la calculadora de métricas.', opciones: OPCIONES_MONEDA },
      ],
    },
    {
      titulo: 'Prácticas de marketing',
      campos: [
        { tipo: 'interruptor', clave: 'testimonios', etiqueta: 'Usa testimonios o casos de éxito', ayuda: 'Reseñas, capturas, videos o historias de clientes.' },
        { tipo: 'interruptor', clave: 'influencers', etiqueta: 'Trabaja con influencers o afiliados', ayuda: 'Colaboraciones pagadas, canjes o comisiones por venta.' },
        { tipo: 'interruptor', clave: 'promociones', etiqueta: 'Hace promociones con plazo o cupos', ayuda: 'Lanzamientos, descuentos, bonos o lugares limitados.' },
        { tipo: 'interruptor', clave: 'comunicaciones', etiqueta: 'Envía comunicaciones por correo o mensajería', ayuda: 'Newsletters, secuencias, difusiones o mensajes de WhatsApp.' },
        { tipo: 'interruptor', clave: 'llamadas', etiqueta: 'Hace llamadas comerciales a leads', ayuda: 'Por ejemplo, setters que llaman a quien dejó sus datos.' },
      ],
    },
    {
      titulo: 'Responsables y tiempos',
      campos: [
        { tipo: 'texto', clave: 'respMarketing', etiqueta: 'Responsable de marketing', ayuda: 'Arma, publica y archiva las piezas.', ejemplo: 'Por ejemplo, Equipo de marketing' },
        {
          tipo: 'texto',
          clave: 'respAprobacion',
          etiqueta: 'Responsable de aprobar piezas',
          ayuda: 'Una sola persona o rol, que aprueba por escrito la versión final.',
          ejemplo: 'Por ejemplo, Dirección comercial',
        },
        { tipo: 'texto', clave: 'diasRevision', etiqueta: 'Días hábiles para revisar una pieza', numerico: true },
      ],
    },
  ],
  vacia: VACIA,
  ejemplo: EJEMPLO,
  rotulos: {
    empresa: 'empresa',
    programa: 'programa',
    canales: 'canales',
    politica: 'política de privacidad',
    correoLegales: 'correo de legales',
    correoPrivacidad: 'correo de privacidad',
    respMarketing: 'responsable de marketing',
    respAprobacion: 'responsable de aprobación',
    diasRevision: 'plazo de revisión',
    mercadoTexto: 'mercado',
    nichoTexto: 'nicho',
    practicasTexto: 'prácticas',
    normaOferta: 'norma de la oferta',
    normaImagen: 'norma de imagen',
    normaDatos: 'norma de datos',
    organismo: 'organismo de consumo',
  },
  valores: (f) => ({
    empresa: textoONull(f, 'empresa'),
    programa: textoONull(f, 'programa'),
    canales: textoONull(f, 'canales'),
    politica: textoONull(f, 'politica'),
    correoLegales: textoONull(f, 'correoLegales'),
    correoPrivacidad: textoONull(f, 'correoPrivacidad'),
    respMarketing: textoONull(f, 'respMarketing'),
    respAprobacion: textoONull(f, 'respAprobacion'),
    diasRevision: plural(soloDigitos(txt(f, 'diasRevision')), 'día hábil', 'días hábiles'),
    mercadoTexto: opcion(f, 'mercado') === 'AR' ? 'Argentina' : opcion(f, 'mercado') === 'ES' ? 'España' : 'otro país',
    nichoTexto: NICHO_TEXTO[opcion(f, 'nicho')] ?? 'nicho general',
    practicasTexto: practicas(f),
  }),
  macros: (f) => {
    const m = opcion(f, 'mercado');
    return {
      normaOferta:
        m === 'AR' ? 'art. 1103 del Código Civil y Comercial y art. 8 de la Ley 24.240' : m === 'ES' ? 'TRLGDCU' : 'según la ley de consumo del país del público',
      normaImagen: m === 'AR' ? 'art. 53 del Código Civil y Comercial' : m === 'ES' ? 'Ley Orgánica 1/1982' : 'según la ley del país de la persona',
      normaDatos: m === 'AR' ? 'Ley 25.326' : m === 'ES' ? 'RGPD y LOPDGDD' : 'según la ley de datos aplicable',
      organismo: m === 'AR' ? 'Defensa del Consumidor' : m === 'ES' ? 'la autoridad de consumo' : 'un organismo de consumo',
    };
  },
  avisos: (f) => {
    const avisos: Aviso[] = [];
    const m = opcion(f, 'mercado');
    const n = opcion(f, 'nicho');
    if (n === 'salud') {
      avisos.push({
        nivel: 'riesgo',
        texto:
          m === 'ES'
            ? 'Con programas de salud y bienestar, toda pieza con antes y después, cambios físicos o testimonios sobre síntomas pasa por legales. En España la publicidad con pretendida finalidad sanitaria no puede apoyarse en testimonios de pacientes.'
            : 'Con programas de salud y bienestar, toda pieza con antes y después, cambios físicos o testimonios sobre síntomas pasa por legales antes de publicarse.',
      });
    }
    if (n === 'finanzas') {
      avisos.push({
        nivel: 'riesgo',
        texto: 'Con programas de finanzas, ninguna pieza proyecta rentabilidades ni recomienda activos. Las piezas presentan el programa como formación y legales revisa las que mencionan inversiones concretas.',
      });
    }
    if (n === 'inmobiliario') {
      avisos.push({ nivel: 'info', texto: 'En el nicho inmobiliario los casos de éxito se muestran con zona, equipo y años de experiencia, y nunca prometen operaciones ni comisiones.' });
    }
    if (m === 'OTRO') {
      avisos.push({ nivel: 'alerta', texto: 'Para otros países cambian las normas de publicidad, imagen y comunicaciones. Definilas con legales antes de usar las plantillas.' });
    }
    if (bool(f, 'influencers') && m === 'ES') {
      avisos.push({
        nivel: 'info',
        texto: 'Si algún creador con el que se trabaja supera los umbrales del Real Decreto 444/2024, tiene que estar inscripto en el registro estatal de prestadores audiovisuales. Pedile que lo confirme por escrito.',
      });
    }
    if (bool(f, 'llamadas') && m === 'AR') {
      avisos.push({ nivel: 'alerta', texto: 'Antes de cada campaña de llamadas, cruzá la base de contactos con el Registro Nacional No Llame.' });
    }
    if (bool(f, 'llamadas') && m === 'ES') {
      avisos.push({
        nivel: 'alerta',
        texto: 'En España las llamadas comerciales necesitan consentimiento previo u otra base legal. Desde el 17 de octubre de 2026 las empresas alcanzadas por la Ley 10/2025 llaman desde el prefijo 400.',
      });
    }
    if ((bool(f, 'comunicaciones') || bool(f, 'llamadas')) && !txt(f, 'politica')) {
      avisos.push({ nivel: 'info', texto: 'Cargá la dirección de la política de privacidad para que los avisos de los formularios la muestren.' });
    }
    if (!txt(f, 'respAprobacion')) {
      avisos.push({ nivel: 'info', texto: 'Definí quién aprueba las piezas. Sin una persona responsable de la aprobación, el recorrido no se puede cumplir.' });
    }
    return avisos;
  },
  resumen: [
    { rotulo: 'Empresa', texto: '{empresa}, {programa}' },
    { rotulo: 'Mercado y nicho', texto: '{mercadoTexto}, {nichoTexto}' },
    { rotulo: 'Canales', texto: '{canales}' },
    { rotulo: 'Prácticas', texto: '{practicasTexto}' },
    { rotulo: 'Responsables', texto: 'Marketing {respMarketing}. Aprobación {respAprobacion}, dentro de {diasRevision}' },
    { rotulo: 'Contacto', texto: 'Legales {correoLegales}. Privacidad y bajas {correoPrivacidad}' },
  ],
};

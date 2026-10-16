// Ficha del protocolo de cobranza y contracargos. Todo lo que cambia de un negocio a otro vive acá.

import { OPCIONES_MERCADO, OPCIONES_MONEDA, bool, diasLegales, opcion, soloDigitos, textoONull, txt } from '../motor/ficha';
import type { Aviso, DefFicha, Ficha } from '../motor/tipos';

const VACIA: Ficha = {
  empresa: '',
  programa: '',
  pasarela: '',
  canal: '',
  correoLegales: '',
  mercado: 'AR',
  perfil: 'B2B',
  moneda: 'USD',
  respCobranza: '',
  respLegales: '',
  gracia: '3',
  interes: '',
  diasIntimacion: '15',
  suspension: false,
  diasSuspension: '15',
  planes: true,
  cuotasMax: '3',
};

const EJEMPLO: Ficha = {
  empresa: 'Impulso Consultores LLC',
  programa: 'Programa Impulso',
  pasarela: 'Stripe',
  canal: 'el WhatsApp de administración',
  correoLegales: 'legales@impulso.com',
  mercado: 'AR',
  perfil: 'B2B',
  moneda: 'USD',
  respCobranza: 'Equipo de administración',
  respLegales: 'Equipo de legales',
  gracia: '3',
  interes: '12',
  diasIntimacion: '15',
  suspension: true,
  diasSuspension: '15',
  planes: true,
  cuotasMax: '3',
};

/** Número entero de la ficha, con un valor por defecto si falta. */
export function numeroDe(f: Ficha, clave: string, porDefecto: number): number {
  const n = soloDigitos(txt(f, clave));
  return n === null ? porDefecto : n;
}

/** Número con decimales, para tasas escritas como 12, 12,5 o 12.5. */
export function decimalDe(f: Ficha, clave: string): number | null {
  const limpio = txt(f, clave).replace(/[^\d.,]/g, '').replace(',', '.');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function plural(n: number | null, uno: string, varios: string): string | null {
  if (n === null) return null;
  return `${n} ${n === 1 ? uno : varios}`;
}

function tasa(f: Ficha): string | null {
  const n = decimalDe(f, 'interes');
  if (n === null) return null;
  return `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}% anual`;
}

export const FICHA: DefFicha = {
  intro:
    'Se completa una sola vez por negocio. Los mensajes, la secuencia de cobro y las calculadoras se actualizan solos, y el enlace configurado permite compartir esta misma versión con el equipo.',
  grupos: [
    {
      titulo: 'Empresa y cobro',
      campos: [
        { tipo: 'texto', clave: 'empresa', etiqueta: 'Empresa', ayuda: 'Nombre que firma las comunicaciones formales.', ejemplo: 'Por ejemplo, Impulso Consultores LLC' },
        { tipo: 'texto', clave: 'programa', etiqueta: 'Programa o servicio', ejemplo: 'Por ejemplo, Programa Impulso' },
        { tipo: 'texto', clave: 'pasarela', etiqueta: 'Plataforma de cobro', ayuda: 'Donde se procesan los pagos y llegan las disputas.', ejemplo: 'Por ejemplo, Stripe' },
        { tipo: 'texto', clave: 'canal', etiqueta: 'Canal de cobranza', ayuda: 'Por donde salen los recordatorios y se confirma todo por escrito.', ejemplo: 'Por ejemplo, el WhatsApp de administración' },
        { tipo: 'texto', clave: 'correoLegales', etiqueta: 'Correo de legales', ayuda: 'Desde donde salen las intimaciones y los acuerdos.', ejemplo: 'Por ejemplo, legales@empresa.com' },
      ],
    },
    {
      titulo: 'Mercado y cliente',
      campos: [
        { tipo: 'opciones', clave: 'mercado', etiqueta: 'Mercado principal', ayuda: 'Define la mora, los intereses y las vías de cobro.', opciones: OPCIONES_MERCADO },
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
        { tipo: 'opciones', clave: 'moneda', etiqueta: 'Moneda', ayuda: 'La que usan las calculadoras.', opciones: OPCIONES_MONEDA },
      ],
    },
    {
      titulo: 'Responsables',
      campos: [
        { tipo: 'texto', clave: 'respCobranza', etiqueta: 'Responsable de cobranza', ayuda: 'Rol o persona que recuerda, acuerda y registra.', ejemplo: 'Por ejemplo, Equipo de administración' },
        { tipo: 'texto', clave: 'respLegales', etiqueta: 'Responsable de legales', ayuda: 'Intimaciones, acuerdos formales y disputas.', ejemplo: 'Por ejemplo, Equipo de legales' },
      ],
    },
    {
      titulo: 'Reglas de cobro',
      campos: [
        { tipo: 'texto', clave: 'gracia', etiqueta: 'Días de gracia', ayuda: 'Días corridos después del vencimiento en los que solo se recuerda.', numerico: true },
        { tipo: 'texto', clave: 'interes', etiqueta: 'Interés moratorio pactado anual', ayuda: 'Porcentaje anual que fija el contrato. Solo el número.', ejemplo: 'Por ejemplo, 12' },
        {
          tipo: 'texto',
          clave: 'diasIntimacion',
          etiqueta: 'Días para pagar después de la intimación',
          ayuda: 'Días corridos. En Argentina, no menos de quince si se anuncia la resolución del contrato.',
          numerico: true,
        },
      ],
    },
    {
      titulo: 'Suspensión y planes de pago',
      campos: [
        { tipo: 'interruptor', clave: 'suspension', etiqueta: 'El contrato prevé suspender el servicio por mora', ayuda: 'Activalo solo si la cláusula existe en el contrato firmado.' },
        { tipo: 'texto', clave: 'diasSuspension', etiqueta: 'Días de mora para suspender', ayuda: 'Días corridos desde el vencimiento.', numerico: true, cuando: (f) => bool(f, 'suspension') },
        { tipo: 'interruptor', clave: 'planes', etiqueta: 'Se ofrecen planes de pago', ayuda: 'Siempre por escrito y dentro del máximo de cuotas.' },
        { tipo: 'texto', clave: 'cuotasMax', etiqueta: 'Cantidad máxima de cuotas', ayuda: 'Un plan más largo lo autoriza la dirección.', numerico: true, cuando: (f) => bool(f, 'planes') },
      ],
    },
  ],
  vacia: VACIA,
  ejemplo: EJEMPLO,
  rotulos: {
    empresa: 'empresa',
    programa: 'programa',
    pasarela: 'plataforma de cobro',
    canal: 'canal de cobranza',
    correoLegales: 'correo de legales',
    respCobranza: 'responsable de cobranza',
    respLegales: 'responsable de legales',
    gracia: 'días de gracia',
    interes: 'interés pactado',
    diasIntimacion: 'plazo de la intimación',
    diasSuspension: 'días para suspender',
    cuotasMax: 'máximo de cuotas',
    dias: 'plazo legal de arrepentimiento',
    mercadoTexto: 'mercado',
    perfilTexto: 'perfil del cliente',
    organismo: 'organismo de consumo',
    fundamentoMora: 'fundamento de la mora',
    textoInteres: 'intereses',
    cartaFormal: 'medio fehaciente',
    resumenSuspension: 'suspensión',
    resumenPlanes: 'planes de pago',
  },
  valores: (f) => ({
    empresa: textoONull(f, 'empresa'),
    programa: textoONull(f, 'programa'),
    pasarela: textoONull(f, 'pasarela'),
    canal: textoONull(f, 'canal'),
    correoLegales: textoONull(f, 'correoLegales'),
    respCobranza: textoONull(f, 'respCobranza'),
    respLegales: textoONull(f, 'respLegales'),
    gracia: plural(soloDigitos(txt(f, 'gracia')), 'día corrido', 'días corridos'),
    interes: tasa(f),
    diasIntimacion: plural(soloDigitos(txt(f, 'diasIntimacion')), 'día corrido', 'días corridos'),
    diasSuspension: plural(soloDigitos(txt(f, 'diasSuspension')), 'día corrido', 'días corridos'),
    cuotasMax: plural(soloDigitos(txt(f, 'cuotasMax')), 'cuota', 'cuotas'),
    dias: diasLegales(f),
    mercadoTexto: opcion(f, 'mercado') === 'AR' ? 'Argentina' : opcion(f, 'mercado') === 'ES' ? 'España' : 'otro país',
    perfilTexto: opcion(f, 'perfil') === 'B2C' ? 'consumidores' : opcion(f, 'perfil') === 'MIXTO' ? 'mixto, empresas y consumidores' : 'profesionales y empresas',
  }),
  macros: (f) => {
    const m = opcion(f, 'mercado');
    const p = opcion(f, 'perfil');
    let fundamentoMora = 'La deuda se encuentra vencida y es exigible.';
    if (m === 'AR') {
      fundamentoMora = 'La mora se produjo de pleno derecho por el solo vencimiento del plazo, conforme al art. 886 del Código Civil y Comercial de la Nación.';
    } else if (m === 'ES') {
      fundamentoMora =
        p === 'B2B'
          ? 'Al tratarse de una operación comercial, el interés de demora se devenga en forma automática desde el vencimiento, conforme a la Ley 3/2004.'
          : 'La deuda se encuentra vencida, es líquida y exigible, y la presente constituye requerimiento de pago a los efectos del art. 1100 del Código Civil.';
    }
    return {
      fundamentoMora,
      textoInteres: decimalDe(f, 'interes') !== null ? 'el interés moratorio pactado del {interes}' : 'los intereses moratorios que correspondan',
      cartaFormal: m === 'AR' ? 'carta documento' : m === 'ES' ? 'burofax con certificación de contenido' : 'un medio fehaciente',
      organismo: m === 'AR' ? 'Defensa del Consumidor' : m === 'ES' ? 'una oficina de consumo' : 'un organismo de consumo',
      resumenSuspension: bool(f, 'suspension') ? 'Suspensión a los {diasSuspension} de mora' : 'Sin suspensión por mora',
      resumenPlanes: bool(f, 'planes') ? 'planes de hasta {cuotasMax}' : 'sin planes de pago',
    };
  },
  avisos: (f) => {
    const avisos: Aviso[] = [];
    const mercado = opcion(f, 'mercado');
    const perfil = opcion(f, 'perfil');
    if (perfil === 'B2C' || perfil === 'MIXTO') {
      avisos.push({
        nivel: 'info',
        texto:
          mercado === 'ES'
            ? 'Con consumidores, la mora depende de lo pactado o de un requerimiento de pago, y los intereses y gastos desproporcionados pueden ser abusivos. Revisá el contrato antes de usar las plantillas formales.'
            : 'Con consumidores rigen el trato digno y la prohibición de dar a los reclamos extrajudiciales apariencia de reclamo judicial. Si un plan de pagos suma intereses, revisá los requisitos de información del art. 36 LDC.',
      });
    }
    if (mercado === 'OTRO') {
      avisos.push({ nivel: 'alerta', texto: 'Para otros países cambian la mora, los intereses admitidos y las vías de cobro. Definilos con legales antes de usar las plantillas formales.' });
    }
    if (mercado === 'ES' && perfil === 'B2B') {
      avisos.push({ nivel: 'info', texto: 'Entre empresas en España rige la Ley 3/2004, con interés de demora automático e indemnización mínima por costes de cobro.' });
    }
    const gracia = soloDigitos(txt(f, 'gracia'));
    if (gracia === 0) {
      avisos.push({ nivel: 'info', texto: 'Sin días de gracia, el recordatorio de mora sale al día siguiente del vencimiento.' });
    }
    if (bool(f, 'suspension')) {
      const susp = soloDigitos(txt(f, 'diasSuspension'));
      if (susp === null) {
        avisos.push({ nivel: 'alerta', texto: 'Cargá a los cuántos días de mora se suspende el servicio.' });
      } else if (gracia !== null && susp <= gracia) {
        avisos.push({ nivel: 'alerta', texto: 'La suspensión llega antes de que terminen los días de gracia. Revisá ambos plazos.' });
      }
      avisos.push({ nivel: 'info', texto: 'La suspensión solo se aplica si el contrato firmado la prevé y siempre con aviso previo al cliente.' });
    }
    if (bool(f, 'planes') && soloDigitos(txt(f, 'cuotasMax')) === null) {
      avisos.push({ nivel: 'alerta', texto: 'Cargá la cantidad máxima de cuotas de un plan de pagos.' });
    }
    if (decimalDe(f, 'interes') === null) {
      avisos.push({ nivel: 'info', texto: 'Cargá el interés moratorio que fija el contrato. Si no fija ninguno, legales define la tasa aplicable antes de reclamar intereses.' });
    }
    const intimacion = soloDigitos(txt(f, 'diasIntimacion'));
    if (mercado === 'AR' && intimacion !== null && intimacion < 15) {
      avisos.push({
        nivel: 'alerta',
        texto: 'Si la intimación anuncia la resolución del contrato y no hay cláusula resolutoria expresa, el plazo no puede ser menor de quince días, salvo usos o índole de la prestación (art. 1088 CCyC).',
      });
    }
    return avisos;
  },
  resumen: [
    { rotulo: 'Empresa', texto: '{empresa}, {programa}' },
    { rotulo: 'Mercado y cliente', texto: '{mercadoTexto}, {perfilTexto}' },
    { rotulo: 'Cobro', texto: '{pasarela}, recordatorios por {canal}' },
    { rotulo: 'Responsables', texto: '{respCobranza} y {respLegales}, {correoLegales}' },
    { rotulo: 'Reglas', texto: '{gracia} de gracia, interés del {interes}, intimación con {diasIntimacion} para pagar' },
    { rotulo: 'Suspensión y planes', texto: '{resumenSuspension}, {resumenPlanes}' },
  ],
};

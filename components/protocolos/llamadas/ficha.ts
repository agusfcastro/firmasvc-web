// Ficha del protocolo de llamadas. Usa las mismas claves que la versión anterior,
// así las fichas guardadas y los enlaces configurados que ya circulan siguen andando.

import { OPCIONES_MERCADO, OPCIONES_MONEDA } from '../motor/ficha';
import type { DefFicha, Ficha } from '../motor/tipos';
import { CONFIG_EJEMPLO, CONFIG_VACIA, ROTULOS, avisosDeFicha, macrosDeFicha, valoresDeFicha, varianteEfectiva, type ConfigSop } from './config';

/** La ficha del motor tiene las mismas claves y tipos que ConfigSop (normalizar descarta lo demás). */
export function configDe(f: Ficha): ConfigSop {
  return { ...CONFIG_VACIA, ...f } as ConfigSop;
}

export const FICHA: DefFicha = {
  intro:
    'Se completa una sola vez por cliente. Los guiones de todo el protocolo se actualizan solos, y el enlace configurado permite compartir esta misma versión con el equipo comercial.',
  grupos: [
    {
      titulo: 'Empresa y programa',
      campos: [
        { tipo: 'texto', clave: 'empresa', etiqueta: 'Empresa', ayuda: 'Razón social que firma el contrato.', ejemplo: 'Por ejemplo, Impulso Consultores LLC' },
        { tipo: 'texto', clave: 'programa', etiqueta: 'Programa', ejemplo: 'Por ejemplo, Programa Impulso' },
        { tipo: 'texto', clave: 'duracion', etiqueta: 'Duración', ejemplo: 'Por ejemplo, 3 meses' },
        { tipo: 'texto', clave: 'inicio', etiqueta: 'Inicio o próxima cohorte', ayuda: 'Se lee después de «arranca».', ejemplo: 'Por ejemplo, el lunes 2 de noviembre' },
        { tipo: 'texto', clave: 'cupos', etiqueta: 'Cupos reales', ayuda: 'Solo si existe un límite real.', ejemplo: 'Por ejemplo, 20 lugares por cohorte', ancho: true },
      ],
    },
    {
      titulo: 'Comprador y devoluciones',
      campos: [
        {
          tipo: 'opciones',
          clave: 'perfil',
          etiqueta: 'Perfil del comprador',
          ayuda: 'Si compra para uso personal, es consumidor. Con consumidores se aplica siempre la ventana legal del país.',
          opciones: [
            { valor: 'B2B', rotulo: 'Profesional o empresa' },
            { valor: 'B2C', rotulo: 'Consumidor' },
          ],
        },
        { tipo: 'opciones', clave: 'mercado', etiqueta: 'Mercado principal', ayuda: 'Define la ventana legal del consumidor.', opciones: OPCIONES_MERCADO },
        {
          tipo: 'opciones',
          clave: 'variante',
          etiqueta: 'Devoluciones',
          ayuda: 'La ventana contractual da un plazo corto para arrepentirse, por ejemplo 72 horas, y después el compromiso es por el total. Sin devoluciones solo con caracterización B2B sólida en el contrato, es la variante de mayor exposición.',
          opciones: [
            { valor: 'A', rotulo: 'Ventana contractual' },
            { valor: 'C', rotulo: 'Sin devoluciones' },
          ],
          ancho: true,
          cuando: (f) => f.perfil !== 'B2C',
        },
        {
          tipo: 'texto',
          clave: 'ventana',
          etiqueta: 'Ventana contractual',
          ayuda: 'Plazo para arrepentirse que da el contrato.',
          ejemplo: 'Por ejemplo, 72 horas',
          cuando: (f) => varianteEfectiva(configDe(f)) === 'A',
        },
      ],
    },
    {
      titulo: 'Precio y pagos',
      campos: [
        { tipo: 'opciones', clave: 'moneda', etiqueta: 'Moneda', opciones: OPCIONES_MONEDA },
        { tipo: 'texto', clave: 'precio', etiqueta: 'Precio total', ayuda: 'Solo números.', ejemplo: 'Por ejemplo, 3000', numerico: true },
        { tipo: 'interruptor', clave: 'usaCuotas', etiqueta: 'Ofrece pago en cuotas' },
        { tipo: 'texto', clave: 'cuotasN', etiqueta: 'Cantidad de cuotas', ejemplo: 'Por ejemplo, 3', numerico: true, cuando: (f) => f.usaCuotas === true },
        { tipo: 'texto', clave: 'cuotaMonto', etiqueta: 'Monto por cuota', ayuda: 'Solo números.', ejemplo: 'Por ejemplo, 1000', numerico: true, cuando: (f) => f.usaCuotas === true },
        { tipo: 'interruptor', clave: 'usaReserva', etiqueta: 'Usa reserva de cupo' },
        {
          tipo: 'texto',
          clave: 'reservaMonto',
          etiqueta: 'Monto de la reserva',
          ayuda: 'Se descuenta del precio total.',
          ejemplo: 'Por ejemplo, 300',
          numerico: true,
          cuando: (f) => f.usaReserva === true,
        },
        { tipo: 'texto', clave: 'saldoDias', etiqueta: 'Días para completar el pago', ejemplo: 'Por ejemplo, 7', numerico: true, cuando: (f) => f.usaReserva === true },
      ],
    },
    {
      titulo: 'Herramientas y canales',
      campos: [
        { tipo: 'texto', clave: 'pasarela', etiqueta: 'Plataforma de cobro', ejemplo: 'Por ejemplo, Stripe' },
        { tipo: 'texto', clave: 'firma', etiqueta: 'Plataforma de firma', ejemplo: 'Por ejemplo, la firma electrónica de FIRMA' },
        { tipo: 'texto', clave: 'herramienta', etiqueta: 'Registro de llamadas', ejemplo: 'Por ejemplo, Fathom' },
        { tipo: 'texto', clave: 'canal', etiqueta: 'Canal oficial de legales', ayuda: 'Donde se derivan reclamos y pedidos formales.', ejemplo: 'Por ejemplo, legales@empresa.com' },
      ],
    },
    {
      titulo: 'Nicho',
      campos: [
        {
          tipo: 'opciones',
          clave: 'nicho',
          etiqueta: 'Nicho del programa',
          ayuda: 'Suma las reglas propias del nicho en Alertas y escalamiento.',
          opciones: [
            { valor: 'ninguno', rotulo: 'General' },
            { valor: 'salud', rotulo: 'Salud y bienestar' },
            { valor: 'finanzas', rotulo: 'Finanzas' },
            { valor: 'inmobiliario', rotulo: 'Inmobiliario' },
          ],
          ancho: true,
        },
      ],
    },
  ],
  vacia: { ...CONFIG_VACIA } as unknown as Ficha,
  ejemplo: { ...CONFIG_EJEMPLO } as unknown as Ficha,
  rotulos: ROTULOS,
  valores: (f) => valoresDeFicha(configDe(f)),
  opcionales: (f) => {
    const c = configDe(f);
    const v = varianteEfectiva(c);
    return [
      ...(c.usaCuotas ? [] : ['cuotasN', 'cuota']),
      ...(c.usaReserva ? [] : ['reserva', 'saldoPlazo']),
      ...(v === 'A' ? [] : ['ventana']),
      ...(v === 'B' ? [] : ['dias']),
      // Los cupos solo se cargan si existe un límite real.
      'cupos',
    ];
  },
  macros: (f) => {
    const c = configDe(f);
    return {
      ...macrosDeFicha(c),
      varianteLetra: varianteEfectiva(c),
      reservaResumen: c.usaReserva ? '{reserva}, saldo en {saldoPlazo}' : 'Sin reserva',
    };
  },
  avisos: (f) => avisosDeFicha(configDe(f)),
  resumen: [
    { rotulo: 'Empresa', texto: '{empresa}' },
    { rotulo: 'Programa', texto: '{programa}, {duracion}' },
    { rotulo: 'Precio', texto: '{precio}, {opcionesPago}' },
    { rotulo: 'Devoluciones', texto: 'Variante {varianteLetra}. {politicaCorta}' },
    { rotulo: 'Reserva', texto: '{reservaResumen}' },
    { rotulo: 'Herramientas', texto: '{pasarela}, {firma}, {herramienta}' },
  ],
};

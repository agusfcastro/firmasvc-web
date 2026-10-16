// Ficha del protocolo de reclutamiento y selección. Todo lo que cambia de una búsqueda a otra vive acá.

import { OPCIONES_MERCADO, OPCIONES_MONEDA, bool, formatearMonto, monedaDe, opcion, soloDigitos, textoONull, txt } from '../motor/ficha';
import type { Aviso, DefFicha, Ficha } from '../motor/tipos';

const VACIA: Ficha = {
  empresa: '',
  puesto: '',
  area: '',
  decisor: '',
  reclutador: '',
  mercado: 'AR',
  modalidad: 'DEFINIR',
  formato: 'REMOTO',
  lugar: '',
  moneda: 'USD',
  salarioMin: '',
  salarioMax: '',
  periodo: 'MES',
  variable: false,
  variableDesc: '',
  canal: '',
  herramienta: '',
  diasRespuesta: '5',
  diasObjetivo: '',
  pruebaPaga: false,
  horasPrueba: '2',
  pagoPrueba: '',
  correoPrivacidad: '',
  meses: '',
};

const EJEMPLO: Ficha = {
  empresa: 'Impulso Consultores SRL',
  puesto: 'Closer de ventas',
  area: 'Equipo comercial',
  decisor: 'Dirección comercial',
  reclutador: 'Coordinación de talento',
  mercado: 'AR',
  modalidad: 'DEPENDENCIA',
  formato: 'REMOTO',
  lugar: '',
  moneda: 'ARS',
  salarioMin: '1800000',
  salarioMax: '2400000',
  periodo: 'MES',
  variable: true,
  variableDesc: 'comisión del 5% sobre ventas cobradas, liquidada por mes',
  canal: 'el formulario de empleos de la web',
  herramienta: 'el tablero de selección en Notion',
  diasRespuesta: '5',
  diasObjetivo: '45',
  pruebaPaga: true,
  horasPrueba: '3',
  pagoPrueba: '60000',
  correoPrivacidad: 'privacidad@impulso.com',
  meses: '12',
};

const PERIODOS: Record<string, string> = { MES: 'mensuales', ANIO: 'anuales', HORA: 'por hora' };

function plural(n: number | null, uno: string, varios: string): string | null {
  if (n === null) return null;
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Rango salarial en una frase que sigue bien a «ofrecemos». */
function rango(f: Ficha): string | null {
  const moneda = monedaDe(f);
  const min = formatearMonto(moneda, txt(f, 'salarioMin'));
  const max = formatearMonto(moneda, txt(f, 'salarioMax'));
  const periodo = PERIODOS[opcion(f, 'periodo')] ?? 'mensuales';
  const bruto = opcion(f, 'modalidad') === 'DEPENDENCIA' ? (periodo === 'por hora' ? ', en bruto' : ' brutos') : '';
  const cola = `${periodo}${bruto}`;
  if (min && max) return `entre ${min} y ${max} ${cola}`;
  if (min) return `desde ${min} ${cola}`;
  if (max) return `hasta ${max} ${cola}`;
  return null;
}

function modalidadTexto(f: Ficha): string {
  const m = opcion(f, 'modalidad');
  if (m === 'DEPENDENCIA') return 'relación de dependencia';
  if (m === 'INDEPENDIENTE') return 'independiente con factura';
  if (m === 'EXTERIOR') return 'contractor del exterior';
  return 'modalidad a definir';
}

function formatoTexto(f: Ficha): string {
  const m = opcion(f, 'formato');
  if (m === 'HIBRIDO') return 'híbrido';
  if (m === 'PRESENCIAL') return 'presencial';
  return 'remoto';
}

export const FICHA: DefFicha = {
  intro:
    'Se completa una vez por búsqueda. El aviso, las plantillas, la rúbrica, el embudo y el tablero se actualizan solos, y el enlace configurado permite compartir esta misma versión con quienes entrevistan.',
  grupos: [
    {
      titulo: 'Empresa y puesto',
      campos: [
        { tipo: 'texto', clave: 'empresa', etiqueta: 'Empresa', ayuda: 'Nombre que firma el aviso, la oferta y el aviso de privacidad.', ejemplo: 'Por ejemplo, Impulso Consultores SRL' },
        { tipo: 'texto', clave: 'puesto', etiqueta: 'Puesto', ayuda: 'Con nombre neutro o en ambos géneros.', ejemplo: 'Por ejemplo, Closer de ventas' },
        { tipo: 'texto', clave: 'area', etiqueta: 'Área', ejemplo: 'Por ejemplo, Equipo comercial' },
        { tipo: 'texto', clave: 'decisor', etiqueta: 'Quién decide la contratación', ayuda: 'Rol o persona que aprueba el perfil y firma la decisión.', ejemplo: 'Por ejemplo, Dirección comercial' },
        { tipo: 'texto', clave: 'reclutador', etiqueta: 'Quién lleva la búsqueda', ayuda: 'Rol o persona que coordina las etapas y responde a los candidatos.', ejemplo: 'Por ejemplo, Coordinación de talento' },
      ],
    },
    {
      titulo: 'Mercado y contratación',
      campos: [
        { tipo: 'opciones', clave: 'mercado', etiqueta: 'Mercado principal', ayuda: 'Define el marco de no discriminación, datos y período de prueba.', opciones: OPCIONES_MERCADO },
        {
          tipo: 'opciones',
          clave: 'modalidad',
          etiqueta: 'Modalidad de contratación',
          ayuda: 'Tiene que coincidir con cómo se va a trabajar de verdad.',
          ancho: true,
          opciones: [
            { valor: 'DEPENDENCIA', rotulo: 'Relación de dependencia' },
            { valor: 'INDEPENDIENTE', rotulo: 'Independiente con factura' },
            { valor: 'EXTERIOR', rotulo: 'Contractor del exterior' },
            { valor: 'DEFINIR', rotulo: 'A definir' },
          ],
        },
        {
          tipo: 'opciones',
          clave: 'formato',
          etiqueta: 'Formato',
          opciones: [
            { valor: 'REMOTO', rotulo: 'Remoto' },
            { valor: 'HIBRIDO', rotulo: 'Híbrido' },
            { valor: 'PRESENCIAL', rotulo: 'Presencial' },
          ],
        },
        { tipo: 'texto', clave: 'lugar', etiqueta: 'Lugar de trabajo', ejemplo: 'Por ejemplo, la oficina de Palermo', cuando: (f) => opcion(f, 'formato') !== 'REMOTO' },
      ],
    },
    {
      titulo: 'Remuneración',
      campos: [
        { tipo: 'opciones', clave: 'moneda', etiqueta: 'Moneda', opciones: OPCIONES_MONEDA },
        {
          tipo: 'opciones',
          clave: 'periodo',
          etiqueta: 'Período del rango',
          opciones: [
            { valor: 'MES', rotulo: 'Mensual' },
            { valor: 'ANIO', rotulo: 'Anual' },
            { valor: 'HORA', rotulo: 'Por hora' },
          ],
        },
        { tipo: 'texto', clave: 'salarioMin', etiqueta: 'Rango mínimo', ayuda: 'Solo números.', ejemplo: 'Por ejemplo, 1800000', numerico: true },
        { tipo: 'texto', clave: 'salarioMax', etiqueta: 'Rango máximo', ayuda: 'Solo números.', ejemplo: 'Por ejemplo, 2400000', numerico: true },
        { tipo: 'interruptor', clave: 'variable', etiqueta: 'Hay remuneración variable', ayuda: 'Comisiones, bonos o premios por objetivos.' },
        {
          tipo: 'texto',
          clave: 'variableDesc',
          etiqueta: 'Cómo se calcula la variable',
          ayuda: 'En una frase, con base, porcentaje o monto y momento de pago.',
          ejemplo: 'Por ejemplo, comisión del 5% sobre ventas cobradas, liquidada por mes',
          ancho: true,
          cuando: (f) => bool(f, 'variable'),
        },
      ],
    },
    {
      titulo: 'Proceso',
      campos: [
        { tipo: 'texto', clave: 'canal', etiqueta: 'Canal de postulación', ejemplo: 'Por ejemplo, el formulario de empleos de la web' },
        { tipo: 'texto', clave: 'herramienta', etiqueta: 'Herramienta de seguimiento', ayuda: 'Donde vive cada postulación con su estado, sus fechas y su fuente.', ejemplo: 'Por ejemplo, el tablero de selección en Notion' },
        { tipo: 'texto', clave: 'diasRespuesta', etiqueta: 'Días hábiles para responder a cada candidato', ayuda: 'Plazo máximo sin novedades después de cada etapa.', numerico: true },
        { tipo: 'texto', clave: 'diasObjetivo', etiqueta: 'Días objetivo de cobertura', ayuda: 'Los fija el negocio. La calculadora y el tablero los usan como meta.', ejemplo: 'Por ejemplo, 45', numerico: true },
      ],
    },
    {
      titulo: 'Prueba práctica',
      campos: [
        { tipo: 'interruptor', clave: 'pruebaPaga', etiqueta: 'La prueba práctica se paga', ayuda: 'Como criterio del protocolo, toda prueba de más de dos horas se paga.' },
        { tipo: 'texto', clave: 'horasPrueba', etiqueta: 'Horas estimadas de la prueba', numerico: true },
        { tipo: 'texto', clave: 'pagoPrueba', etiqueta: 'Pago por la prueba', ayuda: 'Solo números, en la moneda de la ficha.', ejemplo: 'Por ejemplo, 60000', numerico: true, cuando: (f) => bool(f, 'pruebaPaga') },
      ],
    },
    {
      titulo: 'Datos de candidatos',
      campos: [
        { tipo: 'texto', clave: 'correoPrivacidad', etiqueta: 'Correo de privacidad', ayuda: 'Para pedidos de acceso, rectificación o supresión de datos.', ejemplo: 'Por ejemplo, privacidad@empresa.com' },
        { tipo: 'texto', clave: 'meses', etiqueta: 'Meses de conservación con consentimiento', ayuda: 'Solo para quien autoriza conservar su postulación.', ejemplo: 'Por ejemplo, 12', numerico: true },
      ],
    },
  ],
  vacia: VACIA,
  ejemplo: EJEMPLO,
  rotulos: {
    empresa: 'empresa',
    puesto: 'puesto',
    area: 'área',
    decisor: 'quien decide',
    reclutador: 'quien recluta',
    lugar: 'lugar de trabajo',
    rango: 'rango salarial',
    variableDesc: 'cálculo de la variable',
    canal: 'canal de postulación',
    herramienta: 'herramienta de seguimiento',
    diasRespuesta: 'plazo de respuesta',
    diasObjetivo: 'objetivo de cobertura',
    horasPrueba: 'horas de la prueba',
    pagoPrueba: 'pago de la prueba',
    correoPrivacidad: 'correo de privacidad',
    meses: 'meses de conservación',
    mercadoTexto: 'mercado',
    modalidadTexto: 'modalidad',
    formatoTexto: 'formato',
    modalidadOferta: 'modalidad de contratación',
    formatoDetalle: 'formato de trabajo',
    remuneracion: 'remuneración',
    variableOferta: 'variable de la oferta',
    pagoConsigna: 'pago de la prueba',
    usoMaterial: 'uso del material',
    pruebaResumen: 'pago de la prueba',
    normaDiscriminacion: 'normativa antidiscriminación',
    normaDatos: 'normativa de datos',
    derechosDatos: 'derechos sobre los datos',
    autoridadDatos: 'autoridad de datos',
    periodoPruebaOferta: 'período de prueba',
    altaOferta: 'alta o facturación',
    notaOferta: 'nota de la oferta',
  },
  valores: (f) => ({
    empresa: textoONull(f, 'empresa'),
    puesto: textoONull(f, 'puesto'),
    area: textoONull(f, 'area'),
    decisor: textoONull(f, 'decisor'),
    reclutador: textoONull(f, 'reclutador'),
    lugar: textoONull(f, 'lugar'),
    rango: rango(f),
    variableDesc: textoONull(f, 'variableDesc'),
    canal: textoONull(f, 'canal'),
    herramienta: textoONull(f, 'herramienta'),
    diasRespuesta: plural(soloDigitos(txt(f, 'diasRespuesta')), 'día hábil', 'días hábiles'),
    diasObjetivo: plural(soloDigitos(txt(f, 'diasObjetivo')), 'día', 'días'),
    horasPrueba: plural(soloDigitos(txt(f, 'horasPrueba')), 'hora', 'horas'),
    pagoPrueba: formatearMonto(monedaDe(f), txt(f, 'pagoPrueba')),
    correoPrivacidad: textoONull(f, 'correoPrivacidad'),
    meses: plural(soloDigitos(txt(f, 'meses')), 'mes', 'meses'),
    mercadoTexto: opcion(f, 'mercado') === 'AR' ? 'Argentina' : opcion(f, 'mercado') === 'ES' ? 'España' : 'otro país',
    modalidadTexto: modalidadTexto(f),
    formatoTexto: formatoTexto(f),
  }),
  macros: (f) => {
    const mercado = opcion(f, 'mercado');
    const modalidad = opcion(f, 'modalidad');
    const formato = opcion(f, 'formato');
    const paga = bool(f, 'pruebaPaga');
    const dependencia = modalidad === 'DEPENDENCIA';
    const independiente = modalidad === 'INDEPENDIENTE' || modalidad === 'EXTERIOR';

    const modalidadOferta =
      modalidad === 'DEPENDENCIA'
        ? 'relación de dependencia'
        : modalidad === 'INDEPENDIENTE'
          ? 'contratación independiente con factura, con autonomía para organizar el trabajo'
          : modalidad === 'EXTERIOR'
            ? 'contratación como proveedor independiente desde el país de residencia'
            : '[[modalidad de contratación]]';

    const formatoDetalle = formato === 'HIBRIDO' ? 'híbrido, con días presenciales en {lugar}' : formato === 'PRESENCIAL' ? 'presencial, en {lugar}' : 'remoto';

    let periodoPruebaOferta = '[[Período de prueba o condiciones de rescisión, según la modalidad]].';
    if (dependencia && mercado === 'AR') {
      periodoPruebaOferta = 'La relación tendrá un período de prueba de [[duración]], dentro del límite del art. 92 bis de la Ley de Contrato de Trabajo y del convenio aplicable.';
    } else if (dependencia && mercado === 'ES') {
      periodoPruebaOferta = 'El contrato incluirá un período de prueba de [[duración]], dentro de los límites del art. 14 del Estatuto de los Trabajadores y del convenio aplicable.';
    } else if (dependencia) {
      periodoPruebaOferta = 'El contrato incluirá un período de prueba de [[duración]], según la ley aplicable.';
    } else if (independiente) {
      periodoPruebaOferta = 'Al tratarse de una contratación independiente, no hay período de prueba laboral. El contrato preverá [[plazo de preaviso y condiciones de rescisión]].';
    }

    let altaOferta = '[[Alta o facturación, según la modalidad]].';
    let notaOferta = 'Definí la modalidad en la ficha antes de enviar la oferta.';
    if (dependencia && mercado === 'AR') {
      altaOferta = 'El alta ante ARCA se realizará antes de su primer día de trabajo.';
      notaOferta = 'En Argentina el alta ante ARCA se hace antes del primer día. Sin registro desde el inicio, el empleador pierde el período de prueba.';
    } else if (dependencia && mercado === 'ES') {
      altaOferta = 'El alta en la Seguridad Social se tramitará antes de su primer día de trabajo.';
      notaOferta = 'En España la información esencial del contrato, incluido el período de prueba, se entrega por escrito según el Real Decreto 723/2026, y el alta se pide antes del inicio.';
    } else if (dependencia) {
      altaOferta = 'La registración se realizará antes de su primer día de trabajo, según la ley aplicable.';
      notaOferta = 'Para otros países, el contenido mínimo de la oferta y la registración se definen con legales.';
    } else if (modalidad === 'INDEPENDIENTE') {
      altaOferta = 'Usted facturará sus servicios como profesional independiente, con la periodicidad que fije el contrato.';
      notaOferta = 'Con modalidad independiente, la oferta no fija horario ni exclusividad. Si el puesto los necesita, el encuadre se revisa con el abogado antes de enviarla.';
    } else if (modalidad === 'EXTERIOR') {
      altaOferta = 'Usted facturará sus servicios desde su país de residencia, como proveedor independiente.';
      notaOferta = 'Con alguien que vive en otro país, la ley aplicable y la facturación se definen con el abogado y el contador antes de enviar la oferta.';
    }

    return {
      modalidadOferta,
      formatoDetalle,
      remuneracion: bool(f, 'variable') ? '{rango}, más un componente variable, {variableDesc}' : '{rango}',
      variableOferta: bool(f, 'variable') ? ' Componente variable, {variableDesc}, según las reglas que constarán en el contrato.' : '',
      pagoConsigna: paga
        ? 'La prueba se paga. Te abonamos {pagoPrueba} al entregarla, contra [[factura o recibo]], con independencia del resultado.'
        : 'La prueba no se paga porque es un ejercicio breve, pensado para ver cómo trabajás y no para resolver un trabajo del negocio.',
      usoMaterial: paga
        ? 'El pago cubre tu tiempo. Si en algún momento quisiéramos usar lo que hagas, lo acordamos por escrito y aparte.'
        : 'No vamos a usar tu material en el negocio. Lo evaluamos y queda solo como parte de tu postulación.',
      pruebaResumen: paga ? 'paga, {pagoPrueba}' : 'sin pago',
      normaDiscriminacion:
        mercado === 'AR'
          ? 'la Ley 23.592 y los arts. 17 y 81 de la LCT'
          : mercado === 'ES'
            ? 'los arts. 4.2.c y 17 del Estatuto de los Trabajadores y la Ley 15/2022'
            : 'la normativa contra la discriminación del país',
      normaDatos: mercado === 'AR' ? 'la Ley 25.326 de Protección de los Datos Personales' : mercado === 'ES' ? 'el RGPD y la LOPDGDD' : 'la ley de datos personales aplicable',
      derechosDatos:
        mercado === 'AR'
          ? 'acceder a tus datos, rectificarlos o pedir que los suprimamos'
          : mercado === 'ES'
            ? 'acceder a tus datos, rectificarlos, suprimirlos, oponerte, limitar su uso y pedir su portabilidad'
            : 'ejercer los derechos que te reconozca la ley aplicable',
      autoridadDatos:
        mercado === 'AR' ? 'la Agencia de Acceso a la Información Pública' : mercado === 'ES' ? 'la Agencia Española de Protección de Datos' : 'la autoridad de datos personales de tu país',
      periodoPruebaOferta,
      altaOferta,
      notaOferta,
    };
  },
  avisos: (f) => {
    const avisos: Aviso[] = [];
    const mercado = opcion(f, 'mercado');
    const modalidad = opcion(f, 'modalidad');
    if (modalidad === 'INDEPENDIENTE') {
      avisos.push({
        nivel: 'riesgo',
        texto:
          mercado === 'ES'
            ? 'Modalidad independiente. Si el puesto tiene horario, órdenes, medios de la empresa y retribución fija, la ley presume contrato de trabajo (art. 8.1 ET). Revisá el encuadre con el abogado antes de publicar.'
            : 'Modalidad independiente. Si el puesto tiene horario fijo, órdenes, exclusividad o integración plena al equipo, hay riesgo de encuadre como relación de dependencia (arts. 14 y 23 LCT). Revisá el encuadre con el abogado antes de publicar.',
      });
    }
    if (modalidad === 'EXTERIOR') {
      avisos.push({
        nivel: 'alerta',
        texto: 'Contratar a alguien que vive en otro país puede activar la ley laboral y fiscal de ese país. Definí ley aplicable, habilitación y facturación con el abogado y el contador antes de la oferta.',
      });
    }
    if (modalidad === 'DEFINIR') {
      avisos.push({ nivel: 'info', texto: 'Definí la modalidad antes de publicar. El aviso, la oferta y el período de prueba cambian según sea relación de dependencia o contratación independiente.' });
    }
    const horas = soloDigitos(txt(f, 'horasPrueba'));
    if (!bool(f, 'pruebaPaga') && horas !== null && horas > 2) {
      avisos.push({ nivel: 'alerta', texto: `Una prueba no paga de ${horas} horas se parece a trabajo gratis. Como criterio del protocolo, las pruebas de más de dos horas se pagan o se acortan.` });
    }
    if (bool(f, 'pruebaPaga') && !txt(f, 'pagoPrueba')) {
      avisos.push({ nivel: 'info', texto: 'Cargá el monto que se paga por la prueba para que la consigna lo informe.' });
    }
    const min = soloDigitos(txt(f, 'salarioMin'));
    const max = soloDigitos(txt(f, 'salarioMax'));
    if (mercado === 'ES' && (min === null || max === null)) {
      avisos.push({
        nivel: 'alerta',
        texto:
          'En España la Directiva (UE) 2023/970 da a quien se postula derecho a conocer la retribución inicial o su banda. Aunque a octubre de 2026 seguía sin transponer, cargá el rango completo para que el aviso y la invitación lo informen.',
      });
    } else if (min === null && max === null) {
      avisos.push({ nivel: 'info', texto: 'Cargá el rango salarial. Publicarlo filtra mejor y evita negociar sobre el salario anterior.' });
    }
    if (min !== null && max !== null && min > max) {
      avisos.push({ nivel: 'alerta', texto: 'El mínimo del rango supera al máximo. Revisá los dos valores.' });
    }
    if (bool(f, 'variable') && !txt(f, 'variableDesc')) {
      avisos.push({ nivel: 'alerta', texto: 'Hay variable pero falta describir cómo se calcula. Una variable prometida sin regla escrita puede terminar en reclamo.' });
    }
    if (mercado === 'OTRO') {
      avisos.push({ nivel: 'alerta', texto: 'Para otros países cambian las reglas de no discriminación, datos, período de prueba y registración. Revisá el anexo con legales antes de usar las plantillas.' });
    }
    if (mercado === 'AR' && modalidad === 'DEPENDENCIA' && opcion(f, 'formato') !== 'PRESENCIAL') {
      avisos.push({ nivel: 'info', texto: 'Con trabajo remoto o híbrido en relación de dependencia rige la Ley 27.555 de teletrabajo. Revisá sus reglas con legales antes de la oferta.' });
    }
    if (opcion(f, 'formato') !== 'REMOTO' && !txt(f, 'lugar')) {
      avisos.push({ nivel: 'info', texto: 'Cargá el lugar de trabajo para el formato híbrido o presencial.' });
    }
    if (!txt(f, 'correoPrivacidad')) {
      avisos.push({ nivel: 'info', texto: 'Cargá el correo de privacidad. El acuse y el aviso lo necesitan para informar cómo se ejercen los derechos sobre los datos.' });
    }
    if (!txt(f, 'meses')) {
      avisos.push({ nivel: 'info', texto: 'Definí cuántos meses se conservan las postulaciones con consentimiento. Sin consentimiento se eliminan al cerrar la búsqueda.' });
    }
    return avisos;
  },
  resumen: [
    { rotulo: 'Empresa y puesto', texto: '{empresa}, {puesto} en {area}' },
    { rotulo: 'Responsables', texto: 'Decide {decisor}. Lleva la búsqueda {reclutador}' },
    { rotulo: 'Contratación', texto: '{modalidadTexto}, formato {formatoTexto}, mercado {mercadoTexto}' },
    { rotulo: 'Remuneración', texto: '{remuneracion}' },
    { rotulo: 'Proceso', texto: 'Postulación por {canal}, seguimiento en {herramienta}, respuesta en {diasRespuesta}, cobertura objetivo de {diasObjetivo}' },
    { rotulo: 'Prueba práctica', texto: '{horasPrueba}, {pruebaResumen}' },
    { rotulo: 'Datos', texto: 'Privacidad en {correoPrivacidad}, conservación por {meses} con consentimiento' },
  ],
};

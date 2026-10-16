// Ficha del protocolo de gestión del equipo. Todo lo que cambia de un negocio a otro vive acá.

import { OPCIONES_MERCADO, OPCIONES_MONEDA, bool, opcion, soloDigitos, textoONull, txt } from '../motor/ficha';
import type { Aviso, DefFicha, Ficha } from '../motor/tipos';

export type Modalidad = 'IND' | 'DEP' | 'MIX';

/** Modalidad predominante del equipo. Independientes por defecto. */
export function modalidadDe(f: Ficha): Modalidad {
  const m = opcion(f, 'modalidad');
  return m === 'DEP' || m === 'MIX' ? m : 'IND';
}

export function numeroDe(f: Ficha, clave: string, porDefecto: number): number {
  const n = soloDigitos(txt(f, clave));
  return n === null ? porDefecto : n;
}

/** Lee números con decimales, como 7,5 o 7.5. */
export function decimalDe(f: Ficha, clave: string): number | null {
  const limpio = txt(f, clave).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function plural(n: number | null, uno: string, varios: string): string | null {
  if (n === null) return null;
  return `${n} ${n === 1 ? uno : varios}`;
}

const DIAS: Record<string, string> = {
  LUN: 'los lunes',
  MAR: 'los martes',
  MIE: 'los miércoles',
  JUE: 'los jueves',
  VIE: 'los viernes',
};

const FRECUENCIAS: Record<string, { adjetivo: string; cada: string }> = {
  SEMANAL: { adjetivo: 'semanal', cada: 'cada semana' },
  QUINCENAL: { adjetivo: 'quincenal', cada: 'cada quince días' },
  MENSUAL: { adjetivo: 'mensual', cada: 'una vez por mes' },
};

function reunionDia(f: Ficha): string | null {
  const dia = DIAS[opcion(f, 'diaReunion')];
  if (!dia) return null;
  const hora = soloDigitos(txt(f, 'horaReunion'));
  if (hora === null || hora > 23) return dia;
  return `${dia} ${hora === 1 ? 'a la 1' : `a las ${hora}`}`;
}

// Vocabulario que cambia según la modalidad. Todos los términos de una misma clave
// comparten género para que las frases funcionen en las tres variantes.
const TERMINOS: Record<Modalidad, Record<string, string>> = {
  IND: {
    reunion: 'reunión de coordinación',
    Reunion: 'Reunión de coordinación',
    unoauno: 'revisión individual de objetivos',
    UnoAUno: 'Revisión individual de objetivos',
    revision: 'una revisión de objetivos del contrato',
    Revision: 'Revisión de objetivos del contrato',
    vinculo: 'contrato de prestación de servicios',
    pago: 'honorarios',
    comprobante: 'factura',
    salida: 'finalización del contrato',
    asistencia: 'La asistencia se ofrece, no se exige, y quien no puede estar recibe el resumen escrito.',
  },
  DEP: {
    reunion: 'reunión de equipo',
    Reunion: 'Reunión de equipo',
    unoauno: 'reunión uno a uno',
    UnoAUno: 'Reunión uno a uno',
    revision: 'un plan de mejora',
    Revision: 'Plan de mejora',
    vinculo: 'contrato de trabajo',
    pago: 'remuneración',
    comprobante: 'recibo de sueldo',
    salida: 'desvinculación',
    asistencia: 'La reunión es parte de la jornada y se hace dentro del horario de trabajo.',
  },
  MIX: {
    reunion: 'reunión semanal',
    Reunion: 'Reunión semanal',
    unoauno: 'reunión individual',
    UnoAUno: 'Reunión individual',
    revision: 'una revisión de objetivos o un plan de mejora, según la modalidad de cada persona',
    Revision: 'Revisión de objetivos o plan de mejora',
    vinculo: 'contrato de cada persona',
    pago: 'honorarios o remuneración',
    comprobante: 'factura o recibo de sueldo',
    salida: 'finalización del vínculo',
    asistencia: 'Con independientes la asistencia se ofrece y quien no puede estar recibe el resumen escrito. Con empleados la reunión es parte de la jornada.',
  },
};

const VACIA: Ficha = {
  empresa: '',
  mercado: 'AR',
  modalidad: 'IND',
  roles: '',
  canal: '',
  gestor: '',
  crm: '',
  correoAdmin: '',
  diaReunion: '',
  horaReunion: '',
  frecuencia: 'QUINCENAL',
  moneda: 'USD',
  comision: '',
  recupero: false,
  diasVentana: '',
  diaLiquidacion: '',
};

const EJEMPLO: Ficha = {
  empresa: 'Impulso Consultores LLC',
  mercado: 'AR',
  modalidad: 'IND',
  roles: 'setters, closers y acompañamiento',
  canal: 'el espacio de Slack del equipo',
  gestor: 'Notion',
  crm: 'HubSpot',
  correoAdmin: 'administracion@impulso.com',
  diaReunion: 'MAR',
  horaReunion: '16',
  frecuencia: 'QUINCENAL',
  moneda: 'USD',
  comision: '10',
  recupero: true,
  diasVentana: '30',
  diaLiquidacion: '5',
};

export const FICHA: DefFicha = {
  intro:
    'Se completa una sola vez por negocio. Los rituales, los mensajes, el simulador de comisiones y las listas de control se actualizan solos, y el enlace configurado permite compartir esta misma versión con el equipo.',
  grupos: [
    {
      titulo: 'Empresa y equipo',
      campos: [
        { tipo: 'texto', clave: 'empresa', etiqueta: 'Empresa', ayuda: 'Nombre que firma los contratos y las comunicaciones formales.', ejemplo: 'Por ejemplo, Impulso Consultores LLC' },
        { tipo: 'opciones', clave: 'mercado', etiqueta: 'Mercado principal', ayuda: 'Define la ley laboral de referencia del anexo jurídico.', opciones: OPCIONES_MERCADO },
        {
          tipo: 'opciones',
          clave: 'modalidad',
          etiqueta: 'Modalidad predominante',
          ayuda: 'Cambia el vocabulario de los rituales, los mensajes y las liquidaciones.',
          opciones: [
            { valor: 'IND', rotulo: 'Independientes que facturan' },
            { valor: 'DEP', rotulo: 'Relación de dependencia' },
            { valor: 'MIX', rotulo: 'Mixto' },
          ],
        },
        { tipo: 'texto', clave: 'roles', etiqueta: 'Roles del equipo', ayuda: 'Cómo se llama cada rol en este negocio.', ejemplo: 'Por ejemplo, setters, closers y acompañamiento' },
      ],
    },
    {
      titulo: 'Canales y herramientas',
      campos: [
        { tipo: 'texto', clave: 'canal', etiqueta: 'Canal del equipo', ayuda: 'Donde se coordina y se confirma todo por escrito.', ejemplo: 'Por ejemplo, el espacio de Slack del equipo' },
        { tipo: 'texto', clave: 'gestor', etiqueta: 'Gestor de tareas', ejemplo: 'Por ejemplo, Notion' },
        { tipo: 'texto', clave: 'crm', etiqueta: 'CRM', ayuda: 'Único lugar donde viven los datos de clientes.', ejemplo: 'Por ejemplo, HubSpot' },
        { tipo: 'texto', clave: 'correoAdmin', etiqueta: 'Correo de administración', ayuda: 'Desde donde salen las liquidaciones y los avisos formales.', ejemplo: 'Por ejemplo, administracion@empresa.com' },
      ],
    },
    {
      titulo: 'Rituales',
      campos: [
        {
          tipo: 'opciones',
          clave: 'diaReunion',
          etiqueta: 'Día de la reunión semanal',
          opciones: [
            { valor: 'LUN', rotulo: 'Lunes' },
            { valor: 'MAR', rotulo: 'Martes' },
            { valor: 'MIE', rotulo: 'Miércoles' },
            { valor: 'JUE', rotulo: 'Jueves' },
            { valor: 'VIE', rotulo: 'Viernes' },
          ],
          ancho: true,
        },
        { tipo: 'texto', clave: 'horaReunion', etiqueta: 'Hora de la reunión semanal', ayuda: 'Solo la hora, de 0 a 23.', ejemplo: 'Por ejemplo, 16', numerico: true },
        {
          tipo: 'opciones',
          clave: 'frecuencia',
          etiqueta: 'Frecuencia de las reuniones individuales',
          ayuda: 'Con independientes, una frecuencia menor reduce la apariencia de supervisión.',
          opciones: [
            { valor: 'SEMANAL', rotulo: 'Semanal' },
            { valor: 'QUINCENAL', rotulo: 'Quincenal' },
            { valor: 'MENSUAL', rotulo: 'Mensual' },
          ],
        },
      ],
    },
    {
      titulo: 'Comisiones',
      campos: [
        { tipo: 'opciones', clave: 'moneda', etiqueta: 'Moneda', opciones: OPCIONES_MONEDA },
        { tipo: 'texto', clave: 'comision', etiqueta: 'Porcentaje de comisión', ayuda: 'Solo el número. Se aplica sobre lo cobrado.', ejemplo: 'Por ejemplo, 10', numerico: true },
        { tipo: 'texto', clave: 'diaLiquidacion', etiqueta: 'Día de liquidación', ayuda: 'Día del mes, de 1 a 28.', ejemplo: 'Por ejemplo, 5', numerico: true },
        {
          tipo: 'interruptor',
          clave: 'recupero',
          etiqueta: 'Recupero de comisiones por reembolsos y contracargos',
          ayuda: 'Activalo solo si el contrato lo prevé de forma expresa.',
        },
        {
          tipo: 'texto',
          clave: 'diasVentana',
          etiqueta: 'Días de ventana del recupero',
          ayuda: 'Días corridos desde el cobro en los que un reembolso o un contracargo habilita el recupero.',
          ejemplo: 'Por ejemplo, 30',
          numerico: true,
          cuando: (f) => bool(f, 'recupero'),
        },
      ],
    },
  ],
  vacia: VACIA,
  ejemplo: EJEMPLO,
  rotulos: {
    empresa: 'empresa',
    roles: 'roles del equipo',
    canal: 'canal del equipo',
    gestor: 'gestor de tareas',
    crm: 'CRM',
    correoAdmin: 'correo de administración',
    reunionDia: 'día y hora de la reunión',
    frecuenciaTexto: 'frecuencia individual',
    cadaUnoAUno: 'frecuencia individual',
    comision: 'porcentaje de comisión',
    ventana: 'ventana de recupero',
    liquidacion: 'día de liquidación',
    mercadoTexto: 'mercado',
    modalidadTexto: 'modalidad del equipo',
  },
  valores: (f) => {
    const frecuencia = FRECUENCIAS[opcion(f, 'frecuencia')] ?? FRECUENCIAS.QUINCENAL;
    const comision = decimalDe(f, 'comision');
    const dia = soloDigitos(txt(f, 'diaLiquidacion'));
    const m = opcion(f, 'mercado');
    const mod = modalidadDe(f);
    return {
      empresa: textoONull(f, 'empresa'),
      roles: textoONull(f, 'roles'),
      canal: textoONull(f, 'canal'),
      gestor: textoONull(f, 'gestor'),
      crm: textoONull(f, 'crm'),
      correoAdmin: textoONull(f, 'correoAdmin'),
      reunionDia: reunionDia(f),
      frecuenciaTexto: frecuencia.adjetivo,
      cadaUnoAUno: frecuencia.cada,
      comision: comision !== null ? `${comision.toLocaleString('es-AR')}%` : null,
      ventana: plural(soloDigitos(txt(f, 'diasVentana')), 'día corrido', 'días corridos'),
      liquidacion: dia !== null && dia >= 1 && dia <= 31 ? `el día ${dia} de cada mes` : null,
      mercadoTexto: m === 'AR' ? 'Argentina' : m === 'ES' ? 'España' : 'otro país',
      modalidadTexto: mod === 'DEP' ? 'relación de dependencia' : mod === 'MIX' ? 'equipo mixto' : 'independientes que facturan',
    };
  },
  macros: (f) => {
    const m = opcion(f, 'mercado');
    const mod = modalidadDe(f);
    const conRecupero = bool(f, 'recupero') && mod !== 'DEP';
    const recuperoTexto = conRecupero ? 'con recupero dentro de los {ventana} siguientes al cobro' : 'sin recupero';
    return {
      ...TERMINOS[mod],
      recuperoTexto,
      comisionResumen:
        mod === 'DEP'
          ? 'Comisiones según la política escrita, con el recibo de sueldo y liquidación {liquidacion}'
          : '{comision} sobre lo cobrado, liquidación {liquidacion}, {recuperoTexto}',
      normaLaboral: m === 'AR' ? 'la Ley de Contrato de Trabajo' : m === 'ES' ? 'el Estatuto de los Trabajadores' : 'la ley laboral del país',
      normaComision: m === 'AR' ? 'arts. 108 y 131 a 133 LCT' : m === 'ES' ? 'art. 29.2 ET' : 'la ley laboral del país',
      aguinaldo: m === 'AR' ? 'aguinaldo' : m === 'ES' ? 'pagas extra' : 'pagas extraordinarias',
      inscripcion:
        m === 'AR'
          ? 'inscripción en ARCA, como monotributista o en el régimen general'
          : m === 'ES'
            ? 'alta como autónomo en la Seguridad Social y en Hacienda'
            : 'inscripción fiscal vigente en su país',
      altaLaboral:
        m === 'AR'
          ? 'Alta del trabajador en ARCA antes del primer día de trabajo'
          : m === 'ES'
            ? 'Alta en la Seguridad Social antes del inicio de la prestación'
            : 'Alta laboral que exija el país, antes del primer día',
    };
  },
  avisos: (f) => {
    const avisos: Aviso[] = [];
    const mod = modalidadDe(f);
    const m = opcion(f, 'mercado');
    const recupero = bool(f, 'recupero');
    if (m === 'OTRO') {
      avisos.push({
        nivel: 'alerta',
        texto: 'El anexo jurídico cubre Argentina y España. Para otro país, el encuadre laboral y las reglas de comisiones se definen con un abogado local antes de usar el protocolo.',
      });
    }
    if (recupero && mod === 'DEP') {
      avisos.push({
        nivel: 'riesgo',
        texto: 'Con personal en relación de dependencia la comisión es remuneración y no se descuenta por reembolsos sin revisión legal. El simulador no aplica el recupero en esta modalidad.',
      });
    }
    if (recupero && mod === 'MIX') {
      avisos.push({
        nivel: 'alerta',
        texto: 'El recupero se aplica solo a quienes facturan como independientes y tienen la cláusula en su contrato. Al personal en relación de dependencia no se le descuenta sin revisión legal.',
      });
    }
    const ventana = soloDigitos(txt(f, 'diasVentana'));
    if (recupero && mod !== 'DEP' && (ventana === null || ventana === 0)) {
      avisos.push({ nivel: 'alerta', texto: 'Definí los días de ventana del recupero. Sin una ventana fija el recupero queda abierto y se vuelve discutible.' });
    }
    if (recupero && ventana !== null && ventana > 180) {
      avisos.push({ nivel: 'alerta', texto: 'Una ventana de más de seis meses deja la comisión en suspenso demasiado tiempo. Revisala con el abogado.' });
    }
    if (mod !== 'DEP' && opcion(f, 'frecuencia') === 'SEMANAL') {
      avisos.push({
        nivel: 'info',
        texto: 'Con independientes, una revisión individual semanal puede leerse como supervisión. Si la mantenés, que sea sobre resultados y con una agenda que también proponga el colaborador.',
      });
    }
    if (mod !== 'DEP' && m === 'ES') {
      avisos.push({
        nivel: 'info',
        texto: 'En España, quien factura a la empresa al menos el 75 % de sus ingresos puede ser trabajador autónomo económicamente dependiente, con contrato escrito y registrado.',
      });
    }
    if (mod === 'DEP') {
      avisos.push({
        nivel: 'info',
        texto: 'En relación de dependencia rigen además la registración, la jornada, las licencias y el régimen disciplinario de la ley laboral. Este protocolo ordena la gestión, pero no reemplaza el asesoramiento laboral.',
      });
    }
    const comision = decimalDe(f, 'comision');
    if (comision === null) {
      avisos.push({ nivel: 'info', texto: 'Cargá el porcentaje de comisión para que el simulador y los mensajes de liquidación lo usen.' });
    } else if (comision > 100) {
      avisos.push({ nivel: 'alerta', texto: 'El porcentaje de comisión no puede superar 100. Revisá el dato.' });
    }
    const dia = soloDigitos(txt(f, 'diaLiquidacion'));
    if (dia !== null && (dia < 1 || dia > 28)) {
      avisos.push({ nivel: 'alerta', texto: 'Elegí un día de liquidación entre 1 y 28 para que exista en todos los meses.' });
    }
    const hora = soloDigitos(txt(f, 'horaReunion'));
    if (hora !== null && hora > 23) {
      avisos.push({ nivel: 'alerta', texto: 'La hora de la reunión va de 0 a 23.' });
    }
    return avisos;
  },
  resumen: [
    { rotulo: 'Empresa', texto: '{empresa}, {mercadoTexto}' },
    { rotulo: 'Equipo', texto: '{roles}, {modalidadTexto}' },
    { rotulo: 'Herramientas', texto: '{canal}, {gestor} y {crm}' },
    { rotulo: 'Rituales', texto: '{Reunion} {reunionDia}. {UnoAUno} {cadaUnoAUno}' },
    { rotulo: 'Comisiones', texto: '{comisionResumen}' },
    { rotulo: 'Administración', texto: '{correoAdmin}' },
  ],
};

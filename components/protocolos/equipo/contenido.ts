// Contenido del protocolo de gestión del equipo.
// Regla de estilo de FIRMA para estos textos, sin rayas ni dos puntos.

import { bool, opcion, txt } from '../motor/ficha';
import type { BloqueGuion, Ficha, Guion, Seccion } from '../motor/tipos';
import { modalidadDe, numeroDe, type Modalidad } from './ficha';

// Bloques que cambian según la modalidad. En un equipo mixto se muestran las dos
// versiones, cada una con su condición a la vista.

function etiquetar(bloques: BloqueGuion[], condicion: string): BloqueGuion[] {
  return bloques.map((b) => (b.tipo === 'decir' ? { ...b, condicion } : b));
}

function porModalidad(mod: Modalidad, ind: BloqueGuion[], dep: BloqueGuion[]): BloqueGuion[] {
  if (mod === 'IND') return ind;
  if (mod === 'DEP') return dep;
  return [...etiquetar(ind, 'Independientes'), ...etiquetar(dep, 'Relación de dependencia')];
}

// Simulador de comisiones

type Valores = Record<string, number | null>;

function n0(v: number | null): number {
  return v ?? 0;
}

function aplicaRecupero(f: Ficha): boolean {
  return bool(f, 'recupero') && modalidadDe(f) !== 'DEP';
}

function comisionBruta(v: Valores): number | null {
  if (v.cobradas === null || v.porcentaje === null) return null;
  return (v.cobradas * v.porcentaje) / 100;
}

function recuperoDe(v: Valores, f: Ficha): number | null {
  if (!aplicaRecupero(f)) return 0;
  if (v.porcentaje === null) return null;
  return (n0(v.reembolsos) * v.porcentaje) / 100;
}

function netoDe(v: Valores, f: Ficha): number | null {
  const bruta = comisionBruta(v);
  if (bruta === null) return null;
  return bruta - n0(recuperoDe(v, f)) - n0(v.adelantos);
}

function porCien(parte: number | null, total: number | null): number | null {
  if (!total) return null;
  return (n0(parte) / total) * 100;
}

// Secciones

export function secciones(f: Ficha): Seccion[] {
  const mod = modalidadDe(f);
  const ind = mod !== 'DEP';
  const dep = mod !== 'IND';
  const mixto = mod === 'MIX';
  const conRecupero = aplicaRecupero(f);
  const recuperoActivo = bool(f, 'recupero');
  const mercado = opcion(f, 'mercado');
  const ventana = numeroDe(f, 'diasVentana', 0);

  const tituloCoordinacion = mod === 'IND' ? 'Convocatoria a coordinación' : mod === 'DEP' ? 'Convocatoria a reunión de equipo' : 'Convocatoria a la reunión semanal';
  const tituloObjetivos = mod === 'IND' ? 'Revisión de objetivos' : mod === 'DEP' ? 'Plan de mejora' : 'Objetivos o plan de mejora';
  const tramoRecupero = conRecupero ? ', recupero de reembolsos y contracargos dentro de {ventana} desde el cobro' : '';

  const queComisiones =
    mod === 'IND'
      ? `Liquidación por escrito sobre las ventas cobradas, con el {comision} de comisión, detalle por venta${tramoRecupero} y adelantos ya pagados. El colaborador revisa el detalle y factura por el neto.`
      : mod === 'DEP'
        ? 'Detalle de comisiones por escrito según la política, que se liquida con el recibo de sueldo. Las operaciones anuladas no se descuentan sin revisión legal previa.'
        : `Con independientes, liquidación por escrito sobre lo cobrado, con el {comision} de comisión, detalle por venta${tramoRecupero} y factura por el neto. Con empleados, detalle con el recibo de sueldo y ningún descuento sin revisión legal.`;

  const comoReunion =
    mod === 'IND'
      ? 'Agenda previa por {canal}, foco en prioridades y bloqueos del servicio y resumen escrito con acuerdos. La ausencia no tiene consecuencias.'
      : mod === 'DEP'
        ? 'Dentro del horario de trabajo, con agenda previa y resumen escrito con acuerdos, responsables y fechas.'
        : 'Agenda previa y resumen escrito. Para independientes es coordinación sin asistencia obligatoria y para empleados es parte de la jornada.';
  const comoIndividual =
    mod === 'IND'
      ? 'Resultados contra lo pactado, con una agenda que también propone el colaborador. Sin evaluar horarios ni presencia.'
      : mod === 'DEP'
        ? 'Desempeño, desarrollo y bienestar, con los acuerdos por escrito al final.'
        : 'Con independientes, resultados contra lo pactado. Con empleados, desempeño, desarrollo y bienestar.';
  const comoLiquidacion =
    mod === 'IND'
      ? 'Detalle por venta desde {correoAdmin}, revisión del colaborador y pago contra factura.'
      : mod === 'DEP'
        ? 'Detalle por escrito que se integra al recibo de sueldo.'
        : 'Detalle por venta desde {correoAdmin}. Pago contra factura o con el recibo de sueldo, según la modalidad.';
  const comoLlamadas =
    mod === 'DEP'
      ? 'Calibración con llamadas registradas, con foco en mejorar y no en sancionar.'
      : 'Se revisa el cumplimiento de las reglas legales de comunicación y de lo pactado, no el estilo personal de cada closer.';

  const ayudaReembolsos = !conRecupero
    ? 'El recupero no aplica con la ficha actual. El dato se usa solo para el indicador.'
    : ventana > 0
      ? `Montos devueltos dentro de los ${ventana} días corridos siguientes al cobro.`
      : 'Montos devueltos dentro de la ventana pactada.';
  const ayudaRecupero = conRecupero
    ? 'Comisión de las ventas revertidas dentro de la ventana.'
    : mod === 'DEP'
      ? 'En relación de dependencia no se descuenta sin revisión legal.'
      : 'Desactivado en la ficha.';

  return [
    {
      id: 'uso',
      titulo: 'Cómo usar este protocolo',
      corto: 'Cómo usarlo',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Este protocolo ordena cómo {empresa} incorpora, coordina, mide, paga y cierra la relación con su equipo de {roles}. Los datos del negocio se completan una vez en la ficha y se actualizan solos en todos los textos, mensajes y herramientas.',
        },
        {
          tipo: 'parrafo',
          texto:
            'El punto central es que la gestión de todos los días no contradiga el encuadre del contrato. Muchos negocios trabajan con closers, setters y acompañantes independientes que facturan, y la forma de coordinar, de dar feedback y de pagar puede generar, sin que nadie lo busque, indicios de una relación laboral. Por eso los textos se adaptan a la modalidad cargada en la ficha, que hoy es {modalidadTexto}.',
        },
        { tipo: 'leyenda' },
        {
          tipo: 'roles',
          items: [
            { rol: 'Dirección', foco: 'Encuadre de cada persona, semáforo de independencia, rituales, feedback y decisiones de salida.' },
            { rol: 'Administración', foco: 'Contratos, altas y bajas de accesos, liquidación de comisiones y recupero.' },
            { rol: 'Closers y setters', foco: 'Reglas de trabajo, frases prohibidas, sus propios indicadores y la revisión de cada liquidación.' },
            { rol: 'Acompañamiento', foco: 'Rituales, hitos con constancia y traspaso ordenado de clientes cuando alguien sale.' },
            { rol: 'Legales', foco: 'Anexo jurídico, modelos de contrato y todo caso que el semáforo marque en ámbar o en rojo.' },
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            'El encuadre laboral de cada persona depende de los hechos de su caso y se analiza con el abogado. Este protocolo evita generar indicios de dependencia por descuido, pero no vuelve independiente una relación que en los hechos no lo es. Lo laboral o impositivo complejo se consulta con el abogado o con el contador antes de actuar.',
        },
      ],
    },
    {
      id: 'ficha',
      titulo: 'Ficha del negocio',
      corto: 'Ficha del negocio',
      intro: 'Se completa una sola vez. La modalidad del equipo cambia el vocabulario de los rituales, de los mensajes y del simulador de comisiones.',
      bloques: [{ tipo: 'ficha' }],
    },
    {
      id: 'principios',
      titulo: 'Cinco principios',
      corto: 'Principios',
      intro: 'Valen en cada etapa del ciclo. Si el equipo recuerda solo esto, la práctica ya acompaña al contrato.',
      bloques: [
        {
          tipo: 'reglas',
          items: [
            {
              titulo: 'Se gestiona por resultados, no por horas.',
              texto:
                'Con independientes se acuerdan entregables, estándares y plazos, nunca horarios ni presencia. Con empleados la jornada existe, pero el desempeño tampoco se mide por horas conectadas. Lo que se mira está en el tablero.',
            },
            {
              titulo: 'Cada tarea tiene un solo responsable.',
              texto:
                'La matriz de responsables define quién hace, quién decide, a quién se consulta y a quién se informa. Si dos personas son dueñas de lo mismo, en la práctica no es de nadie.',
            },
            {
              titulo: 'Lo que se acuerda se escribe.',
              texto:
                'Objetivos, cambios de comisión, devoluciones de feedback y avisos de salida quedan por escrito en {canal} o por correo. Lo que se habla en una llamada se confirma por escrito el mismo día.',
            },
            {
              titulo: 'El acceso es prestado y temporal.',
              texto:
                'Cada persona entra con usuario propio y solo a lo que necesita. Los datos de clientes viven en {crm}, no en planillas ni en teléfonos personales. Cuando alguien sale, la baja es ese mismo día.',
            },
            {
              titulo: 'La práctica tiene que coincidir con el contrato.',
              texto:
                'Si el contrato dice independiente, la gestión diaria no puede tratar a la persona como empleada. Horarios, permisos, sanciones y cargos de jefatura pesan más que cualquier cláusula, porque los tribunales miran los hechos.',
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Cómo se ve en la práctica' },
        {
          tipo: 'tarjetas',
          items: [
            ind
              ? {
                  titulo: 'Resultados, no horas',
                  texto: 'Un closer independiente no aparece conectado a la mañana. No se le pregunta dónde estaba. Se mira si cumplió lo acordado y se coordina lo que viene.',
                  cita: '[[Nombre]], para esta semana hay [[cantidad]] agendas disponibles. Contame qué franjas vas a abrir y el setter las carga en {crm}.',
                }
              : {
                  titulo: 'Resultados, no horas',
                  texto: 'Una integrante cumple su jornada pero sus llamadas no convierten. La conversación no es sobre horas sino sobre resultados.',
                  cita: '[[Nombre]], tu jornada está bien organizada. Quiero que miremos juntos tus resultados del mes y veamos qué ajustar en las llamadas.',
                },
            {
              titulo: 'Lo que se acuerda se escribe',
              texto: 'En una llamada se acordó un cambio en el porcentaje de comisión. Antes de terminar el día sale este mensaje.',
              cita: 'Como hablamos recién, te confirmo que desde el [[fecha]] tu comisión pasa a ser del [[porcentaje]] sobre las ventas cobradas desde esa fecha. Si estás de acuerdo, respondé este mensaje y lo dejamos firmado como adenda.',
            },
            {
              titulo: 'El acceso es prestado',
              texto: 'Un setter pide exportar la base de prospectos para trabajar desde su teléfono.',
              cita: 'Por seguridad, los datos de clientes no salen de {crm}. Decime qué necesitás y lo resolvemos dentro del sistema.',
            },
            ind
              ? {
                  titulo: 'Práctica y contrato',
                  texto:
                    'Un líder quiere descontarle a un colaborador independiente la reunión a la que faltó. La respuesta correcta frena la práctica y la reemplaza por lo que sí prevé el contrato.',
                  cita: 'Con independientes no hay descuentos por ausencias. Pasale el resumen escrito y, si el resultado del mes no llega, lo vemos en la revisión de objetivos.',
                }
              : {
                  titulo: 'Práctica y contrato',
                  texto: 'Un líder quiere descontarle a un empleado una llegada tarde. La ley laboral no permite multas y las sanciones siguen sus propias reglas.',
                  cita: 'No se descuenta. Si la demora se repite, hablalo con dirección y se evalúa con el abogado qué corresponde.',
                },
          ],
        },
      ],
    },
    {
      id: 'ciclo',
      titulo: 'El ciclo del colaborador en seis etapas',
      corto: 'Seis etapas',
      intro: 'Cada etapa tiene responsable, plazo y objetivo. Lo que pasa en cada una queda registrado en el legajo de la persona.',
      bloques: [
        {
          tipo: 'etapas',
          items: [
            {
              titulo: 'Incorporación',
              cuando: 'Responsables dirección y administración · Antes del primer día',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que la persona empiece con contrato firmado, accesos mínimos y reglas claras.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto: `Contrato firmado antes de empezar, ${
                    mod === 'IND' ? 'constancia fiscal del colaborador' : mod === 'DEP' ? 'alta laboral antes del inicio' : 'constancia fiscal o alta laboral según la modalidad'
                  }, usuarios personales en {crm}, {gestor} y {canal}, mensaje de bienvenida con las reglas de trabajo y una primera {unoauno} con los objetivos del período por escrito.${
                    ind ? ' Con independientes se completa además el semáforo de independencia inicial.' : ''
                  }`,
                },
                {
                  rotulo: 'Frase ancla',
                  texto:
                    mod === 'IND'
                      ? 'Te sumás como colaborador independiente. Acá tenés tu contrato y las reglas de trabajo del equipo.'
                      : mod === 'DEP'
                        ? 'Te sumás al equipo de {empresa}. Acá tenés tu contrato, el reglamento y tu horario.'
                        : 'Te sumás al equipo. Acá tenés tu contrato y las reglas de trabajo que corresponden a tu modalidad.',
                  estilo: 'frase',
                },
                { rotulo: 'Error típico', texto: 'Empezar a trabajar con la promesa de firmar después, o compartir usuarios genéricos entre varias personas.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Coordinación y rituales',
              cuando: 'Responsable dirección · {Reunion} {reunionDia}',
              datos: [
                {
                  rotulo: 'Objetivo',
                  texto:
                    mod === 'IND'
                      ? 'Coordinar prioridades sin convertir la coordinación en control.'
                      : mod === 'DEP'
                        ? 'Ordenar prioridades y sostener el ritmo del equipo dentro de la jornada.'
                        : 'Coordinar a todo el equipo respetando la modalidad de cada persona.',
                },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto: '{Reunion} con agenda previa y resumen escrito con acuerdos, responsables y fechas, más una {unoauno} {cadaUnoAUno}. {asistencia}',
                },
                { rotulo: 'Frase ancla', texto: 'Resumen de la {reunion}. Acuerdos [[acuerdos]], responsables [[nombres]] y fechas [[fechas]].', estilo: 'frase' },
                {
                  rotulo: 'Error típico',
                  texto:
                    mod === 'IND'
                      ? 'Pasar lista, exigir cámara encendida o reprochar ausencias a un independiente.'
                      : mod === 'DEP'
                        ? 'Convocar fuera del horario o usar la reunión para exponer a alguien.'
                        : 'Aplicar a los independientes las reglas de asistencia de los empleados.',
                  estilo: 'error',
                },
              ],
            },
            {
              titulo: 'Medición',
              cuando: 'Responsable dirección · Primera semana de cada mes',
              datos: [
                { rotulo: 'Objetivo', texto: 'Mirar resultados con los mismos indicadores para todos los que cumplen el mismo rol.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Tablero por rol con datos de {crm} y de administración. Cada resultado se compara con lo acordado y con la propia evolución, nunca con horas conectadas. Cada persona ve sus números antes de la revisión.',
                },
                { rotulo: 'Frase ancla', texto: 'Estos son tus números del mes según {crm}. Revisalos y marcame cualquier dato que no te cierre.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Medir actividad, como mensajes enviados u horas en línea, en lugar de resultados.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Feedback y desarrollo',
              cuando: 'Responsable dirección · {UnoAUno} {cadaUnoAUno}',
              datos: [
                { rotulo: 'Objetivo', texto: 'Mejorar conductas concretas con devoluciones oportunas y por escrito.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Feedback con el modelo situación, conducta e impacto, primero en privado y después por escrito. Si el resultado no llega, se abre {revision}, por escrito, con plazo y apoyo concreto.',
                },
                { rotulo: 'Frase ancla', texto: 'En la llamada del [[día]] pasó [[conducta]] y eso generó [[impacto]]. ¿Cómo lo encaramos la próxima vez?', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Hablar de la persona y no de la conducta, o dar el feedback en público en {canal}.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Comisiones',
              cuando: 'Responsable administración · Liquidación {liquidacion}',
              datos: [
                { rotulo: 'Objetivo', texto: 'Pagar lo que corresponde, a tiempo y con detalle.' },
                { rotulo: 'Qué tiene que pasar', texto: queComisiones },
                { rotulo: 'Frase ancla', texto: 'Te enviamos la liquidación de [[período]] con el detalle por venta. Si ves una diferencia, avisanos antes del [[fecha]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Descontar por fuera del contrato, retener un pago como presión o liquidar sin detalle.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Salida ordenada',
              cuando: 'Responsables dirección y administración · Del aviso al último día',
              datos: [
                { rotulo: 'Objetivo', texto: 'Terminar según lo pactado, sin dejar clientes ni accesos sueltos.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto: `Aviso escrito según el contrato y su preaviso, traspaso de clientes y pendientes, liquidación final, devolución de materiales y de datos, y baja de accesos el último día.${
                    dep ? ' La desvinculación de un empleado se define antes con el abogado.' : ''
                  }`,
                },
                { rotulo: 'Frase ancla', texto: 'Coordinemos el traspaso para que ningún cliente quede sin respuesta. Te confirmo todo por escrito.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Cortar accesos sin aviso, retener pagos hasta que devuelva materiales o comentar la salida en el grupo del equipo.', estilo: 'error' },
              ],
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Lo que cambia según la modalidad' },
        {
          tipo: 'tabla',
          aria: 'Diferencias de gestión según la modalidad',
          columnas: [
            { rotulo: 'Tema', ancho: '0.8fr', estilo: 'fuerte' },
            { rotulo: 'Con independientes', ancho: '1.2fr' },
            { rotulo: 'En relación de dependencia', ancho: '1.2fr' },
          ],
          filas: [
            ['Reunión semanal', 'Reunión de coordinación. Se ofrece, se resume por escrito y la ausencia no tiene consecuencias.', 'Reunión de equipo dentro de la jornada. La asistencia forma parte del trabajo.'],
            ['Seguimiento individual', 'Revisión de objetivos del contrato, con resultados y no con horas.', 'Reunión uno a uno sobre desempeño, desarrollo y bienestar.'],
            ['Bajo rendimiento', 'Revisión de objetivos y, si sigue, lo que prevé el contrato.', 'Plan de mejora con apoyo y plazos. Las sanciones siguen la ley laboral.'],
            ['Ausencias', 'Aviso de disponibilidad para reasignar agendas.', 'Licencias y permisos según la ley y el reglamento.'],
            ['Pago', 'Honorarios contra factura, con detalle por venta.', 'Remuneración con recibo de sueldo, comisiones incluidas.'],
            ['Herramientas', 'Usuario personal para prestar el servicio y medios propios del colaborador.', 'Herramientas provistas por el empleador.'],
            ['Salida', 'Finalización según el contrato y su preaviso.', 'Desvinculación definida antes con el abogado.'],
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'En un equipo mixto cada persona se gestiona según su propio contrato. Mezclar prácticas entre modalidades genera indicios de dependencia que después cuesta explicar.',
        },
      ],
    },
    {
      id: 'independencia',
      titulo: 'Semáforo de independencia',
      corto: 'Independencia',
      intro: ind
        ? 'Doce señales que la jurisprudencia suele mirar para decidir si una relación es laboral. Se marca lo que pasa en los hechos, no lo que dice el contrato, al incorporar a cada colaborador independiente y una vez por trimestre.'
        : 'Con un equipo en relación de dependencia este semáforo se usa cuando se evalúa contratar a alguien como independiente o se suma un proveedor externo que trabaja codo a codo con el equipo.',
      bloques: [
        {
          tipo: 'evaluacion',
          id: 'independencia',
          titulo: 'Semáforo de independencia',
          intro: 'Marcá solo lo que hoy pasa con [[nombre del colaborador]]. El resultado se copia al legajo con la fecha de la evaluación.',
          items: [
            { id: 'horario', texto: 'Se le fija un horario o una disponibilidad mínima obligatoria.', peso: 3 },
            { id: 'sanciones', texto: 'Recibe sanciones, multas o descuentos por ausencias, demoras o errores.', peso: 3 },
            { id: 'factura', texto: 'Cobra sin emitir factura o sin un comprobante a su nombre.', peso: 3 },
            { id: 'permisos', texto: 'Pide permiso para ausentarse o para tomarse vacaciones, en lugar de avisar.', peso: 2 },
            { id: 'exclusividad', texto: 'Tiene prohibido trabajar para otros clientes, aunque no compitan con la empresa.', peso: 2 },
            { id: 'medios', texto: 'Trabaja solo con herramientas, equipos y cuentas de la empresa, sin medios propios.', peso: 2 },
            { id: 'fijo', texto: 'Cobra un monto fijo y periódico que no depende de resultados ni de entregables.', peso: 2 },
            { id: 'jefe', texto: 'Tiene un jefe directo que le indica cómo hacer su trabajo y figura en el organigrama.', peso: 2 },
            { id: 'obligatorio', texto: 'Tiene que asistir a reuniones o capacitaciones bajo apercibimiento.', peso: 2 },
            { id: 'beneficios', texto: 'Recibe vacaciones pagas, {aguinaldo} u otros beneficios propios de un empleado.', peso: 2 },
            { id: 'antiguedad', texto: 'Lleva más de un año trabajando solo para la empresa, sin otros clientes.', peso: 1 },
            { id: 'imagen', texto: 'Usa correo, firma o cargo de empleado, o se lo presenta como parte del staff.', peso: 1 },
          ],
          niveles: [
            {
              desde: 0,
              nivel: 'verde',
              titulo: 'Verde. La práctica acompaña el contrato',
              texto:
                'Con lo marcado no aparecen señales relevantes de dependencia. Mantené las prácticas, copiá el resultado al legajo y repetí la evaluación en tres meses, o antes si cambia la forma de trabajo.',
            },
            {
              desde: 3,
              nivel: 'ambar',
              titulo: 'Ámbar. Hay prácticas que contradicen el contrato',
              texto:
                'Corregí este mes cada práctica marcada, por ejemplo cambiando un horario por franjas que ofrece el colaborador o una sanción por una revisión de objetivos. Dejá constancia escrita del cambio y, si la misma señal aparece en varias personas, revisalo con el abogado.',
            },
            {
              desde: 6,
              nivel: 'rojo',
              titulo: 'Rojo. Riesgo alto de relación laboral encubierta',
              texto:
                'Antes de cambiar contratos, pagos o prácticas, consultá al abogado. Un cambio apurado puede dejar más prueba en contra. Con el abogado se define si se corrige la práctica, si se pasa a relación de dependencia o si se cierra la relación según el contrato.',
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Qué hacer con cada señal' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Cómo corregir las señales más comunes',
              leads: [
                { lead: 'Horario.', texto: 'Reemplazalo por franjas que ofrece el colaborador y por objetivos de resultado.' },
                { lead: 'Sanciones y descuentos.', texto: 'Eliminalos. Si hay incumplimiento, se aplica lo que prevé el contrato.' },
                { lead: 'Permisos.', texto: 'Pasá a avisos de disponibilidad con una anticipación razonable.' },
                { lead: 'Factura.', texto: 'Sin factura no se paga. Se pide antes de cada pago.' },
                { lead: 'Jefatura.', texto: 'Un referente de coordinación en lugar de un jefe, fuera del organigrama de empleados.' },
                { lead: 'Exclusividad.', texto: 'Limitala a lo necesario, como confidencialidad y no captación de clientes.' },
              ],
            },
            {
              titulo: 'Lo que no es señal de dependencia',
              check: true,
              lista: [
                'Pedir resultados medibles y estándares de calidad.',
                'Exigir las reglas legales de comunicación con clientes.',
                'Coordinar agendas y prioridades del servicio.',
                'Dar acceso a {crm} para cargar las ventas del servicio.',
                'Pactar confidencialidad, cuidado de datos y no captación.',
              ],
            },
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'El semáforo ordena la conversación con el abogado, no la reemplaza. Un verde no garantiza el encuadre y un rojo no lo define, porque cada caso depende de sus hechos.',
        },
      ],
    },
    {
      id: 'comisiones',
      titulo: 'Simulador de comisiones',
      corto: 'Comisiones',
      intro:
        mod === 'DEP'
          ? 'Con personal en relación de dependencia la comisión es remuneración y tiene reglas propias. El simulador sirve para ordenar el detalle, pero el recupero por descuento no se aplica sin revisión legal.'
          : 'La comisión se calcula sobre lo cobrado, se liquida por escrito con detalle por venta y, si el contrato lo prevé, se ajusta por reembolsos y contracargos dentro de la ventana pactada.',
      bloques: [
        {
          tipo: 'calculadora',
          id: 'comisiones',
          titulo: 'Simulador de comisiones con recupero',
          intro: 'Cargá los datos del período de una persona. Los montos se expresan en la moneda de la ficha.',
          entradas: [
            { id: 'cobradas', rotulo: 'Ventas cobradas del período', unidad: 'moneda', ayuda: 'Lo efectivamente cobrado de sus ventas, sin impuestos.' },
            { id: 'porcentaje', rotulo: 'Porcentaje de comisión', unidad: '%', inicial: txt(f, 'comision') || undefined, ayuda: 'Toma el de la ficha. Se puede cambiar para simular.' },
            { id: 'reembolsos', rotulo: 'Reembolsos y contracargos en la ventana', unidad: 'moneda', ayuda: ayudaReembolsos },
            { id: 'adelantos', rotulo: 'Adelantos ya pagados', unidad: 'moneda', ayuda: 'Montos adelantados a cuenta de estas comisiones.' },
          ],
          salidas: [
            { id: 'bruta', rotulo: 'Comisión bruta', formato: 'monto', ayuda: 'Ventas cobradas por el porcentaje.', calcular: (v) => comisionBruta(v) },
            { id: 'recupero', rotulo: 'Recupero', formato: 'monto', ayuda: ayudaRecupero, calcular: (v, fi) => recuperoDe(v, fi) },
            { id: 'neto', rotulo: 'Neto a liquidar', formato: 'monto', destacada: true, ayuda: 'Comisión bruta menos recupero y adelantos.', calcular: (v, fi) => netoDe(v, fi) },
            { id: 'tasa', rotulo: 'Reembolsos sobre lo cobrado', formato: 'pct', ayuda: 'Indicador de calidad de la venta.', calcular: (v) => porCien(v.reembolsos, v.cobradas) },
          ],
          conclusion: (v, r, fi) => {
            if (v.cobradas === null) return null;
            if (v.porcentaje === null) return { nivel: 'info', texto: 'Cargá el porcentaje de comisión, o completalo en la ficha, para ver la liquidación.' };
            const m = modalidadDe(fi);
            if (m === 'DEP') {
              return {
                nivel: 'ambar',
                texto:
                  'En relación de dependencia la comisión es remuneración y se liquida con el recibo de sueldo. Los reembolsos y contracargos no se descuentan sin revisión legal previa ({normaComision}). Este cálculo sirve solo para ordenar el detalle.',
              };
            }
            const sufijo = m === 'MIX' ? ' Aplicalo solo a quienes facturan como independientes.' : '';
            const reembolsos = n0(v.reembolsos);
            if (!bool(fi, 'recupero') && reembolsos > 0) {
              return {
                nivel: 'info',
                texto: `El recupero está desactivado en la ficha, así que los reembolsos no se descuentan. El neto es la comisión bruta menos los adelantos.${sufijo}`,
              };
            }
            if (r.neto !== null && r.neto < 0) {
              return {
                nivel: 'ambar',
                texto: `El recupero y los adelantos superan la comisión del período. El saldo no se descuenta de otros pagos ni se retiene la factura. Se compensa con las próximas comisiones, como prevé el contrato, y si la relación terminó se pide por escrito.${sufijo}`,
              };
            }
            return {
              nivel: 'verde',
              texto: `Liquidación coherente con el contrato. Enviala con el detalle por venta desde {correoAdmin} y pedí la factura por el neto.${
                reembolsos > 0 && bool(fi, 'recupero') ? ' Adjuntá el comprobante de cada reembolso o contracargo.' : ''
              }${sufijo}`,
            };
          },
          nota: 'Simulación orientativa. Lo que manda es el contrato de cada persona. El tratamiento impositivo del recupero, por ejemplo si corresponde una nota de crédito, lo define el contador.',
        },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Reglas de la liquidación',
              check: true,
              lista: [
                ind ? 'La base es lo cobrado, no lo vendido.' : 'La base sigue la política de comisiones y la ley laboral.',
                'Cada liquidación lleva detalle por venta, con fecha, cliente y monto.',
                'Se envía por escrito desde {correoAdmin}, {liquidacion}.',
                'La persona revisa el detalle antes de facturar o de cobrar y puede objetarlo por escrito.',
                'Ningún pago se retiene como forma de presión.',
                'Los cambios de porcentaje van por adenda firmada y rigen hacia adelante.',
              ],
            },
            ...(conRecupero
              ? [
                  {
                    titulo: 'Cómo funciona el recupero pactado',
                    numerada: true,
                    lista: [
                      'Solo alcanza ventas propias con reembolso o contracargo dentro de los {ventana} siguientes al cobro.',
                      'Se recupera la comisión de esa venta y nunca más que eso.',
                      'Se avisa por escrito, con el comprobante, antes de compensar.',
                      'Se compensa contra comisiones futuras y no contra otros pagos.',
                      'Si la relación termina con saldo pendiente, se pide por escrito y, si no se paga, decide legales.',
                    ],
                  },
                ]
              : ind
                ? [
                    {
                      titulo: 'Antes de activar el recupero',
                      numerada: true,
                      lista: [
                        'Tiene que estar en el contrato de forma expresa, con ventana fija y base de cálculo.',
                        'Rige solo para ventas posteriores a la firma de la cláusula.',
                        'Se revisa con el abogado y con el contador antes de aplicarlo.',
                      ],
                    },
                  ]
                : []),
            ...(dep
              ? [
                  {
                    titulo: 'Con personal en relación de dependencia',
                    lista: [
                      'La comisión es remuneración y se liquida con el recibo de sueldo.',
                      'Se rige por la política escrita de comisiones y por {normaLaboral}.',
                      'No se descuentan reembolsos ni contracargos sin revisión legal previa ({normaComision}).',
                    ],
                  },
                ]
              : []),
          ],
        },
        {
          tipo: 'aclaracion',
          texto: recuperoActivo || ind ? 'El recupero entre independientes es un pacto comercial. Si la relación se recalificara como laboral, ese mismo descuento podría leerse como una retención de salario.' : 'Cualquier cambio en la política de comisiones se revisa con el abogado antes de comunicarlo.',
        },
      ],
    },
    {
      id: 'responsables',
      titulo: 'Responsables y rituales',
      corto: 'Responsables',
      intro: 'Quién hace cada tarea y con qué ritmo se encuentra el equipo. Cada fila tiene una sola A, que es quien decide y responde.',
      bloques: [
        {
          tipo: 'tips',
          items: [
            { titulo: 'R · Responsable', texto: 'Hace la tarea. Puede haber más de una persona.' },
            { titulo: 'A · Aprueba', texto: 'Decide y responde por el resultado. Hay una sola por tarea.' },
            { titulo: 'C · Consultado', texto: 'Aporta antes de decidir. Su opinión se pide, no se supone.' },
            { titulo: 'I · Informado', texto: 'Se entera del resultado, por escrito y a tiempo.' },
          ],
        },
        {
          tipo: 'tabla',
          aria: 'Matriz de responsables',
          columnas: [
            { rotulo: 'Tarea', ancho: '1.5fr', estilo: 'fuerte' },
            { rotulo: 'Setter', ancho: '0.65fr' },
            { rotulo: 'Closer', ancho: '0.65fr' },
            { rotulo: 'Acompañamiento', ancho: '0.85fr' },
            { rotulo: 'Administración', ancho: '0.85fr' },
            { rotulo: 'Dirección', ancho: '0.75fr' },
          ],
          filas: [
            ['Agenda y calificación del prospecto', 'R y A', 'I', '·', '·', '·'],
            ['Llamada de venta', 'I', 'R y A', '·', '·', '·'],
            ['Repaso de cierre y confirmación escrita', '·', 'R y A', 'I', '·', '·'],
            ['Contrato y firma del cliente', '·', 'R', 'I', 'A', 'C'],
            ['Cobro y conciliación', '·', 'I', '·', 'R y A', 'I'],
            ['Onboarding del cliente', '·', 'C', 'R y A', 'C', '·'],
            ['Reclamos y pedidos de reembolso', '·', 'C', 'R', 'I', 'A'],
            ['Liquidación de comisiones', 'C', 'C', '·', 'R', 'A'],
            ['Altas y bajas de accesos', 'I', 'I', 'I', 'R', 'A'],
            ['Incorporación de una persona al equipo', '·', '·', '·', 'R', 'A'],
            ['Feedback y revisión de objetivos', 'C', 'C', 'C', '·', 'R y A'],
            ['Semáforo de independencia', '·', '·', '·', 'C', 'R y A'],
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            'Los reclamos siguen el protocolo de conflictos y reembolsos. Las tareas del equipo comercial se coordinan con lo que fija el protocolo de llamadas de venta.',
        },
        { tipo: 'subtitulo', texto: 'Rituales' },
        {
          tipo: 'tabla',
          aria: 'Rituales del equipo',
          columnas: [
            { rotulo: 'Ritual', ancho: '1fr', estilo: 'fuerte' },
            { rotulo: 'Frecuencia', ancho: '0.85fr' },
            { rotulo: 'Participan', ancho: '0.9fr' },
            { rotulo: 'Cómo se hace', ancho: '1.5fr', estilo: 'porque' },
          ],
          filas: [
            ['{Reunion}', 'Semanal, {reunionDia}', 'Todo el equipo', comoReunion],
            ['{UnoAUno}', '{cadaUnoAUno}', 'Dirección y cada persona', comoIndividual],
            ['Revisión del tablero', 'Mensual', 'Dirección y administración', 'Resultados por rol y por equipo con datos de {crm}. Cada persona recibe antes sus propios números.'],
            ['Liquidación de comisiones', '{liquidacion}', 'Administración y cada persona', comoLiquidacion],
            ['Revisión de llamadas', 'Mensual', 'Dirección y closers', comoLlamadas],
            ...(ind
              ? [['Semáforo de independencia', 'Trimestral', 'Dirección y legales', 'Se pasa por cada independiente y el resultado va al legajo. Un ámbar o un rojo tiene un plan con fecha.']]
              : []),
            ['Auditoría de accesos', 'Mensual', 'Administración', 'Se compara la lista de accesos activos con el equipo real y se da de baja lo que sobra.'],
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            mod === 'IND'
              ? 'Con independientes los rituales son de coordinación del servicio. Se agendan con anticipación, se informan por {canal} y la ausencia no tiene consecuencias fuera de lo que prevé el contrato.'
              : mod === 'DEP'
                ? 'Con empleados los rituales son parte de la jornada y se hacen dentro del horario de trabajo, respetando los descansos.'
                : 'Con independientes los rituales son de coordinación y la ausencia no tiene consecuencias fuera del contrato. Con empleados son parte de la jornada y se hacen dentro del horario.',
        },
      ],
    },
    {
      id: 'mensajes',
      titulo: 'Biblioteca de mensajes',
      corto: 'Mensajes',
      intro:
        'Modelos para cada momento del ciclo. Los mensajes de chat van con vos y las comunicaciones formales con usted. Se adaptan al tono de cada empresa siempre que no cambie el contenido.',
      bloques: [
        {
          tipo: 'guiones',
          aria: 'Mensajes del ciclo del colaborador',
          items: guiones(mod, ind, conRecupero, recuperoActivo, tituloCoordinacion, tituloObjetivos),
        },
      ],
    },
    {
      id: 'frases',
      titulo: 'Frases prohibidas y su reemplazo',
      corto: 'Frases prohibidas',
      intro: ind
        ? 'Las palabras también construyen el encuadre. Estas frases tratan a un independiente como empleado o faltan el respeto, y cada una tiene su reemplazo.'
        : 'Las palabras también construyen el clima y la prueba. Estas frases faltan el respeto o comprometen a la empresa, y cada una tiene su reemplazo.',
      bloques: [
        {
          tipo: 'tabla',
          aria: 'Frases prohibidas y su reemplazo',
          columnas: [
            { rotulo: 'No digas', ancho: '1fr', estilo: 'no' },
            { rotulo: 'Decí', ancho: '1.25fr', estilo: 'si' },
            { rotulo: 'Por qué', ancho: '0.9fr', estilo: 'porque' },
          ],
          filas: [
            ...(ind
              ? [
                  ['Tu jefe es [[nombre]].', 'Tu referente para coordinar es [[nombre]].', 'Con independientes no hay jefatura sino coordinación de un servicio.'],
                  ['Tenés que estar conectado de 9 a 18.', 'Contame qué franjas vas a abrir esta semana para las agendas.', 'El horario impuesto es un indicio clásico de dependencia.'],
                  ['Pedime permiso para tomarte vacaciones.', 'Avisame qué días no vas a estar para reasignar las agendas.', 'El independiente avisa y organiza su servicio, no pide permiso.'],
                  ['Bienvenido al staff.', 'Te sumás como colaborador independiente de {empresa}.', 'Staff, plantilla y empleado describen otra relación y quedan escritos.'],
                  ['Este mes cobrás tu sueldo y el {aguinaldo}.', 'Te enviamos la liquidación de tus honorarios del período.', 'Sueldo y {aguinaldo} son conceptos laborales.'],
                  [
                    'No podés trabajar para nadie más.',
                    'El contrato protege la confidencialidad y la no captación de clientes.',
                    'La exclusividad total suma dependencia. Si hace falta, se pacta por escrito y con alcance limitado.',
                  ],
                  [
                    'Te bajo la comisión por este reembolso.',
                    'Según la cláusula [[número]], el reembolso dentro de la ventana se compensa en la próxima liquidación.',
                    'El recupero existe solo si está pactado y se aplica como dice el contrato.',
                  ],
                ]
              : []),
            ['Si faltás a la reunión, te descuento.', 'Si no podés venir, te paso el resumen escrito.', 'El descuento es poder disciplinario. Con empleados, además, la ley prohíbe las multas.'],
            ['Si no cerrás tres ventas esta semana, estás afuera.', 'El objetivo del período es [[objetivo]]. Revisemos juntos qué ajustar.', 'La amenaza informal suma prueba de presión. La salida sigue lo pactado.'],
            ['Esto queda entre nosotros, no lo pongas por escrito.', 'Te lo confirmo por escrito para que tengamos lo mismo.', 'Lo que no se escribe es lo que después se discute.'],
            [
              'Sos un desastre, así no vas a durar.',
              'En la llamada del [[día]] pasó [[conducta]] y eso generó [[impacto]]. ¿Cómo lo encaramos?',
              'El feedback describe conductas, no personas. El insulto queda como prueba de maltrato.',
            ],
            ['Comentarios sobre el aspecto, la edad, el género o la vida personal.', 'Nada. Los comentarios se limitan al trabajo.', 'Pueden configurar discriminación o acoso, con responsabilidad para la empresa.'],
            ['Pasame los datos del cliente a mi WhatsApp personal.', 'Cargalo en {crm} y lo vemos ahí.', 'Los datos de clientes no salen de los sistemas de la empresa.'],
          ],
        },
      ],
    },
    {
      id: 'alertas',
      titulo: 'Alertas y escalamiento',
      corto: 'Alertas',
      intro: 'Ante cualquiera de estas señales se actúa en el día y se escala. Nadie del equipo resuelve solo un tema de encuadre, de pagos o de datos.',
      bloques: [
        {
          tipo: 'tabla',
          aria: 'Alertas y escalamiento',
          columnas: [
            { rotulo: 'Señal', ancho: '1.2fr', estilo: 'senal' },
            { rotulo: 'Qué hacer', ancho: '1.3fr' },
            { rotulo: 'Escalar a', ancho: '0.65fr', estilo: 'pastilla' },
          ],
          filas: [
            ...(ind
              ? [
                  [
                    'Un independiente pide vacaciones pagas, {aguinaldo}, licencias o una indemnización.',
                    'No respondas en el momento ni lo discutas por chat. Registrá el pedido y derivalo.',
                    'Dirección y legales',
                  ],
                ]
              : []),
            ['Llega una carta documento, un telegrama o una citación laboral.', 'Registrá la fecha de recepción, no respondas y derivá hoy. Corren plazos breves.', 'Legales hoy'],
            [
              'Se propone pasar a un empleado a facturar, o contratar como independiente a alguien para la misma tarea que hacía un empleado.',
              'No se hace sin análisis previo. Cambiar la figura sin cambiar la relación es el caso típico de fraude laboral.',
              'Legales',
            ],
            ...(ind
              ? [
                  ['El semáforo de independencia da rojo, o ámbar dos veces seguidas.', 'Frená los cambios por tu cuenta y llevá la evaluación al abogado.', 'Dirección y legales'],
                  ['Un líder impone horarios, pide permisos o aplica descuentos a un independiente.', 'Cortá la práctica, corregila por escrito y dejá constancia.', 'Dirección'],
                  ['Un independiente pasa a trabajar en los hechos con horario fijo y exclusividad.', 'Pasá el semáforo y decidí con el abogado si cambia la práctica o el encuadre.', 'Dirección y legales'],
                ]
              : []),
            ['Alguien reclama diferencias en su liquidación.', 'Respondé por escrito con el detalle por venta. No lo discutas en el grupo.', 'Administración'],
            ['Se denuncia acoso, discriminación o maltrato.', 'Tomá la denuncia por escrito, protegé a quien denuncia y no investigues por chat.', 'Dirección y legales hoy'],
            ['Sale alguien con acceso a datos de clientes.', 'Baja de accesos el último día y pedido escrito de devolución.', 'Administración'],
            ['Aparecen datos de clientes en planillas o teléfonos personales.', 'Pedí por escrito que se carguen en {crm} y que se borren las copias.', 'Administración'],
            ['Una persona que ya salió contacta clientes o usa materiales de la empresa.', 'Preservá la evidencia con fecha y no respondas en caliente.', 'Legales'],
            ['Alguien pide un certificado de trabajo o una constancia de servicios.', 'No firmes textos que describan una relación distinta de la del contrato.', 'Administración y legales'],
            ...(ind && mercado === 'ES'
              ? [['Un independiente factura a la empresa casi todos sus ingresos.', 'Revisá si es trabajador autónomo económicamente dependiente y adaptá su contrato.', 'Legales']]
              : []),
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'Escalar no es exagerar. Un tema laboral derivado a tiempo cuesta menos que una respuesta improvisada que después se lee como reconocimiento.',
        },
      ],
    },
    {
      id: 'control',
      titulo: 'Control de incorporación y salida',
      corto: 'Control',
      intro: 'Dos listas para los momentos de mayor riesgo. Los ítems críticos se cumplen siempre, sin excepciones.',
      bloques: [
        {
          tipo: 'checklist',
          id: 'incorporacion',
          titulo: 'Incorporación',
          textoConforme: 'Incorporación completa',
          textoNoConforme: 'Incompleta · falta al menos un ítem crítico',
          items: [
            { id: 'i1', texto: 'Contrato firmado antes del primer día de trabajo, con copia entregada a la persona.', critico: true },
            ...(ind
              ? [{ id: 'i2', texto: mixto ? 'Para independientes, constancia fiscal vigente con su {inscripcion}.' : 'Constancia fiscal vigente del colaborador, con su {inscripcion}.', critico: true }]
              : []),
            ...(dep ? [{ id: 'i3', texto: mixto ? 'Para empleados, alta laboral registrada antes del primer día.' : '{altaLaboral}.', critico: true }] : []),
            { id: 'i4', texto: 'Confidencialidad, datos y propiedad intelectual cubiertos en el contrato o en un acuerdo aparte.', critico: true },
            { id: 'i5', texto: 'Usuarios personales en {crm}, {gestor} y {canal}, con el mínimo acceso necesario.', critico: true },
            { id: 'i6', texto: 'Reglas de trabajo entregadas por escrito y confirmadas por la persona.', critico: true },
            {
              id: 'i7',
              texto: conRecupero
                ? 'Cláusula de comisiones aceptada, con porcentaje, base de cálculo, ventana de recupero de {ventana} y día de liquidación.'
                : 'Cláusula o política de comisiones aceptada, con porcentaje, base de cálculo y día de liquidación.',
              critico: true,
            },
            {
              id: 'i8',
              texto: ind ? 'Presentación al equipo con el rol correcto, sin cargos de jefatura ni de staff para independientes.' : 'Presentación al equipo con el rol y el referente correctos.',
              critico: false,
            },
            { id: 'i9', texto: 'Primera {unoauno} con los objetivos del período por escrito.', critico: false },
            ...(ind ? [{ id: 'i10', texto: 'Semáforo de independencia inicial guardado en el legajo.', critico: false }] : []),
            { id: 'i11', texto: 'Materiales de capacitación entregados con su carácter confidencial.', critico: false },
            { id: 'i12', texto: 'Datos de facturación o de pago cargados en administración.', critico: false },
            { id: 'i13', texto: 'Matriz de responsables actualizada con la nueva persona.', critico: false },
          ],
        },
        {
          tipo: 'checklist',
          id: 'salida',
          titulo: 'Salida ordenada',
          textoConforme: 'Salida completa',
          textoNoConforme: 'Incompleta · falta al menos un ítem crítico',
          items: [
            {
              id: 's1',
              texto:
                mod === 'IND'
                  ? 'Aviso escrito según el contrato, con el preaviso pactado.'
                  : mod === 'DEP'
                    ? 'Desvinculación definida con el abogado antes de comunicarla.'
                    : 'Aviso según el contrato de cada persona, con la desvinculación de empleados definida antes con el abogado.',
              critico: true,
            },
            { id: 's2', texto: 'Baja de todos los accesos el último día, o el mismo día si la salida es inmediata.', critico: true },
            { id: 's3', texto: 'Traspaso escrito de clientes y pendientes a un responsable.', critico: true },
            {
              id: 's4',
              texto: conRecupero ? 'Liquidación final por escrito, con comisiones devengadas y recupero pendiente dentro de la ventana.' : 'Liquidación final por escrito, con todas las comisiones devengadas.',
              critico: true,
            },
            { id: 's5', texto: 'Devolución de materiales y eliminación de copias de datos, con constancia escrita.', critico: true },
            ...(dep
              ? [
                  {
                    id: 's6',
                    texto:
                      mercado === 'AR'
                        ? 'Certificados de trabajo a disposición dentro de los 45 días hábiles desde la extinción (art. 80 LCT).'
                        : mercado === 'ES'
                          ? 'Finiquito y documentación de fin de contrato según indique el abogado o la gestoría.'
                          : 'Documentación de fin de contrato que exija el país.',
                    critico: true,
                  },
                ]
              : []),
            { id: 's7', texto: 'Conversación de salida con un resumen escrito de sus aprendizajes.', critico: false },
            { id: 's8', texto: 'Comunicación interna breve y respetuosa, sin motivos ni opiniones.', critico: false },
            { id: 's9', texto: 'Recordatorio escrito de la confidencialidad que sigue vigente.', critico: false },
            { id: 's10', texto: 'Matriz de responsables y rituales actualizados.', critico: false },
            { id: 's11', texto: 'Legajo cerrado con contrato, evaluaciones, liquidaciones y avisos.', critico: false },
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            'El legajo de cada persona guarda el contrato, las evaluaciones del semáforo, las liquidaciones y los avisos. Se conserva mientras pueda existir un reclamo y se trata como información confidencial.',
        },
      ],
    },
    {
      id: 'tablero',
      titulo: 'Tablero de indicadores',
      corto: 'Tablero',
      intro: 'Se mide por rol y por equipo, una vez por mes, con datos de {crm} y de administración. Cada persona ve sus números antes de la revisión.',
      bloques: [
        { tipo: 'subtitulo', texto: 'Por rol' },
        {
          tipo: 'kpis',
          items: [
            {
              nombre: 'Agendas calificadas · setter',
              formula: 'Agendas que cumplen los criterios de calificación, dividido agendas generadas, por cien.',
              lectura: 'Mide la calidad del trabajo del setter. Las agendas sin calificar consumen tiempo de los closers.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: '{crm}',
            },
            {
              nombre: 'Asistencia a llamadas · setter',
              formula: 'Llamadas realizadas, dividido llamadas agendadas, por cien.',
              lectura: 'Si baja, revisá la calificación y la confirmación previa de cada agenda.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: '{crm}',
            },
            {
              nombre: 'Tasa de cierre · closer',
              formula: 'Ventas, dividido llamadas realizadas, por cien.',
              lectura: 'Se lee junto con los reembolsos. Un cierre alto con reembolsos altos indica promesas de más.',
              meta: 'Estable o en alza, con reembolsos en baja',
              frecuencia: 'Mensual',
              fuente: '{crm}',
            },
            {
              nombre: 'Cobro efectivo · closer',
              formula: 'Monto cobrado, dividido monto vendido, por cien.',
              lectura: 'La venta que no se cobra no existe y es la base de la comisión.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Administración',
            },
            {
              nombre: 'Reembolsos de sus ventas · closer',
              formula: 'Monto reembolsado o en contracargo, dividido monto cobrado, por cien.',
              lectura: 'Mide la calidad de la venta. Se cruza con el protocolo de llamadas y con el de conflictos.',
              meta: 'Bajar mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Administración',
            },
            {
              nombre: 'Hitos cumplidos · acompañamiento',
              formula: 'Hitos confirmados por escrito en plazo, dividido hitos previstos, por cien.',
              lectura: 'Mide la prestación real y construye la prueba frente a reclamos.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: '{gestor}',
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Del equipo' },
        {
          tipo: 'kpis',
          items: [
            {
              nombre: 'Rotación',
              formula: 'Salidas del período, dividido promedio de integrantes, por cien.',
              lectura: 'Separá las salidas por decisión propia de las decididas por la empresa. Cada salida tiene su causa registrada.',
              meta: 'Bajar o mantener',
              frecuencia: 'Trimestral',
              fuente: 'Legajos',
            },
            {
              nombre: 'Tiempo hasta la productividad',
              formula: 'Días entre el ingreso y [[el primer hito acordado, por ejemplo la primera venta cobrada]].',
              lectura: 'Mide la calidad de la incorporación y de los materiales.',
              meta: 'Bajar trimestre a trimestre',
              frecuencia: 'Por ingreso',
              fuente: '{crm}',
            },
            {
              nombre: 'Liquidaciones sin diferencias',
              formula: 'Liquidaciones sin reclamo, dividido liquidaciones enviadas, por cien.',
              lectura: 'Mide la claridad de las reglas de comisión.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Administración',
            },
            ...(ind
              ? [
                  {
                    nombre: 'Encuadre en verde',
                    formula: 'Independientes con el semáforo en verde, dividido total de independientes, por cien.',
                    lectura: 'Es el indicador legal del tablero. Cada ámbar o rojo tiene un plan con fecha.',
                    meta: 'Todos en verde',
                    frecuencia: 'Trimestral',
                    fuente: 'Semáforo de independencia',
                  },
                ]
              : []),
          ],
        },
        {
          tipo: 'calculadora',
          id: 'tableroPersona',
          titulo: 'Tablero rápido por persona',
          intro: 'Cargá los números del mes de una persona y obtené sus indicadores principales.',
          entradas: [
            { id: 'agendadas', rotulo: 'Llamadas agendadas', unidad: 'llamadas' },
            { id: 'realizadas', rotulo: 'Llamadas realizadas', unidad: 'llamadas' },
            { id: 'ventas', rotulo: 'Ventas cerradas', unidad: 'ventas' },
            { id: 'vendido', rotulo: 'Monto vendido', unidad: 'moneda' },
            { id: 'cobrado', rotulo: 'Monto cobrado', unidad: 'moneda' },
            { id: 'reembolsado', rotulo: 'Monto reembolsado o en contracargo', unidad: 'moneda' },
          ],
          salidas: [
            { id: 'asistencia', rotulo: 'Asistencia a llamadas', formato: 'pct', calcular: (v) => porCien(v.realizadas, v.agendadas) },
            { id: 'cierre', rotulo: 'Tasa de cierre', formato: 'pct', destacada: true, calcular: (v) => porCien(v.ventas, v.realizadas) },
            { id: 'cobro', rotulo: 'Cobro efectivo', formato: 'pct', calcular: (v) => porCien(v.cobrado, v.vendido) },
            { id: 'reembolsos', rotulo: 'Reembolsos sobre lo cobrado', formato: 'pct', calcular: (v) => porCien(v.reembolsado, v.cobrado) },
          ],
          nota: 'Los datos salen de {crm} y de administración. Cada resultado se compara con lo acordado con la persona y con su propia evolución.',
        },
        {
          tipo: 'aclaracion',
          texto: ind
            ? 'Con independientes se miden los resultados pactados en el contrato. El tablero nunca se usa para controlar horarios ni tiempo de conexión.'
            : 'El tablero mide resultados. La jornada de los empleados se registra por las vías que fija la ley, no con estos indicadores.',
        },
      ],
    },
    {
      id: 'juridico',
      titulo: 'Anexo jurídico',
      corto: 'Anexo jurídico',
      intro:
        'Para la dirección y el equipo legal. Cada regla del protocolo se apoya en lo que sigue. Normativa revisada a octubre de 2026. No reemplaza el análisis del caso concreto, y lo laboral o impositivo complejo se define con el abogado o con el contador.',
      bloques: [
        {
          tipo: 'juridico',
          items: [
            {
              id: 'ar',
              titulo: 'Argentina',
              bajada: 'Ley de Contrato de Trabajo con las reformas de las Leyes 27.742 y 27.802, Código Civil y Comercial y Ley 25.326.',
              abierto: true,
              items: [
                {
                  lead: 'Presunción de contrato de trabajo.',
                  nivel: 'ALTO',
                  texto:
                    'Según el art. 23 LCT, en el texto que le dio el art. 13 de la Ley 27.802 (BO 6 de marzo de 2026), la prestación de servicios **en situación de dependencia** hace presumir el contrato de trabajo, salvo prueba en contrario. La presunción no se aplica cuando median contrataciones de obra, de servicios profesionales o de oficios, o cualquier otra modalidad de servicios sin relación de dependencia, y se emiten los recibos o facturas correspondientes o el pago se hace por los sistemas bancarios u otros que fije la reglamentación. Esa ausencia de presunción rige a todos los efectos, incluida la seguridad social. La Ley 27.742 ya había incorporado la excepción por factura o pago bancario, y la 27.802 sumó la referencia a la dependencia y amplió la excepción. La factura ayuda, pero no vuelve autónoma una relación que en los hechos es dependiente.',
                },
                {
                  lead: 'Primacía de la realidad y fraude laboral.',
                  nivel: 'ALTO',
                  texto:
                    'Es nulo el contrato en el que las partes simulan o defraudan la ley laboral aparentando figuras no laborales, interponiendo personas o por cualquier otro medio, y la relación pasa a regirse por la LCT (art. 14, que la Ley 27.802 no modificó). Los arts. 21 y 22 LCT, reformulados por esa ley, siguen definiendo el contrato y la relación de trabajo por la prestación de servicios bajo dependencia, y el art. 21 aclara que vale cualquiera sea su forma o denominación. El art. 2 LCT excluye las contrataciones de obra, servicios, agencia, transporte y flete reguladas en el CCyC, a los trabajadores independientes con colaboradores y a los prestadores independientes de plataformas tecnológicas, pero esas exclusiones operan cuando la figura es real.',
                },
                {
                  lead: 'Indicios que miran los tribunales.',
                  nivel: 'MEDIO',
                  texto:
                    'Para decidir si hay dependencia, la jurisprudencia mira los hechos. Horario y lugar impuestos, órdenes sobre el modo de trabajar, poder disciplinario, inserción en una organización ajena, exclusividad, pago fijo y periódico sin relación con resultados, uso exclusivo de medios de la empresa y facturación correlativa a un único cliente durante años. Ninguno decide por sí solo. La CSJN, por ejemplo en Cairone (2015) y en Rica (2018), revocó sentencias que habían calificado como laborales servicios médicos por no valorar adecuadamente las circunstancias del caso, y recordó que no toda prestación de servicios para una empresa es laboral.',
                },
                {
                  lead: 'Independientes con colaboradores.',
                  nivel: 'MEDIO',
                  texto:
                    'El art. 97 de la Ley 27.742 permite que un trabajador independiente cuente con hasta tres colaboradores también independientes, en una relación autónoma sin dependencia entre ellos ni con quienes contratan sus servicios, con aportes propios reglamentados por el Decreto 847/2024 y la Resolución General ARCA 5599/2024, que creó un padrón específico. La Ley 27.802 lo incorporó como exclusión expresa del art. 2 LCT sin cambiar el régimen. Sirve, por ejemplo, para un closer que trabaja con su propio setter, siempre que la autonomía sea real.',
                },
                {
                  lead: 'Comisiones en relación de dependencia.',
                  nivel: 'MEDIO',
                  texto:
                    'Cuando el trabajador cobra a comisión, esta se liquida sobre las operaciones concertadas (art. 108 LCT), y las comisiones colectivas se distribuyen entre todo el personal según el criterio fijado para medir su contribución al resultado (art. 109 LCT). La Ley 27.802 no modificó estos artículos e incorporó el art. 104 bis, que admite componentes retributivos dinámicos, fijos o variables, que no se consolidan por continuidad tácita, ultraactividad ni costumbre.',
                },
                {
                  lead: 'Deducciones prohibidas.',
                  nivel: 'ALTO',
                  texto:
                    'La LCT prohíbe deducir, retener o compensar sumas que rebajen la remuneración y prohíbe imponer multas al trabajador (art. 131). Las excepciones están enumeradas, como los adelantos, los aportes y ciertas cuotas (art. 132, cuyo inciso f sustituyó la Ley 27.802), y en conjunto no pueden superar el 20 % de la remuneración en dinero, con los requisitos de conformidad y autorización que fija el art. 133, que la Ley 27.802 reescribió manteniendo ese tope. Por eso el recupero de comisiones por descuento no se aplica a empleados sin revisión legal previa.',
                },
                {
                  lead: 'Recupero contractual entre independientes.',
                  nivel: 'MEDIO',
                  texto:
                    'Entre partes independientes rige la libertad de contratar (art. 958 CCyC), y el recupero es un pacto comercial válido si está expresamente previsto, es claro y se aplica tal como se pactó. Si el vínculo es de agencia, la comisión nace con la conclusión del contrato con el cliente y el pago del precio, y se liquida dentro de los veinte días hábiles (arts. 1487 y 1488 CCyC). La cláusula que subordina la comisión a la ejecución del contrato vale si se pacta en forma expresa (art. 1489), y el agente no puede garantizar la cobranza más allá de su comisión (art. 1482). Por eso el recupero se limita a la comisión de la venta revertida, dentro de una ventana y con detalle escrito.',
                },
                {
                  lead: 'El closer independiente como agente.',
                  nivel: 'MEDIO',
                  texto:
                    'Quien promueve negocios por cuenta de otro de manera estable, continuada e independiente, sin relación laboral y a cambio de una retribución, es agente (art. 1479 CCyC). Si no hay plazo, el contrato es por tiempo indeterminado (art. 1491), se termina con un preaviso de un mes por cada año de vigencia (art. 1492) y su omisión da derecho a una indemnización por las ganancias dejadas de percibir (art. 1493). Al terminar puede corresponder una compensación por clientela de hasta un año de remuneraciones netas de gastos (art. 1497), y la no competencia posterior se admite hasta un año (art. 1499).',
                },
                {
                  lead: 'Fidelidad y confidencialidad.',
                  nivel: 'MEDIO',
                  texto:
                    'El empleado debe cumplir los deberes de fidelidad propios de su tarea y guardar reserva sobre la información a la que accede (art. 85 LCT), y abstenerse de negociaciones propias o ajenas que afecten al empleador, salvo autorización (art. 88 LCT). Con independientes, esos deberes surgen de la buena fe contractual (art. 961 CCyC) y de lo que se pacte, y la información confidencial de la empresa tiene protección propia (Ley 24.766). Conviene pactar confidencialidad con vigencia posterior a la relación.',
                },
                {
                  lead: 'Invenciones y propiedad intelectual.',
                  nivel: 'MEDIO',
                  texto:
                    'Las invenciones personales del empleado le pertenecen aunque use instrumentos ajenos, y son del empleador las que derivan de sus procedimientos, métodos o instalaciones o las que obtiene quien fue contratado con ese objeto (art. 82 LCT), con preferencia del empleador y deber de secreto (art. 83 LCT). Para guiones, materiales y contenidos rige la Ley 11.723, que reconoce los derechos al autor y admite su cesión (art. 51), con una regla especial para el software creado por empleados en sus funciones (art. 4). Con independientes, la cesión se pacta por escrito en el contrato.',
                },
                {
                  lead: 'No competencia.',
                  nivel: 'MEDIO',
                  texto:
                    'Durante la relación laboral rige el deber de no concurrencia (art. 88 LCT). La no competencia posterior no tiene regulación en la LCT y su validez depende de que sea limitada en tiempo, lugar y actividad y, según buena parte de la doctrina, compensada. Entre independientes, si hay agencia, el límite es de un año (art. 1499 CCyC). En la práctica, un pacto de no captación de clientes y de personal es más defendible que una prohibición amplia.',
                },
                {
                  lead: 'Seguridad de los datos.',
                  nivel: 'MEDIO',
                  texto:
                    'Quien trata datos personales debe adoptar medidas técnicas y organizativas de seguridad (art. 9 Ley 25.326), y quienes intervienen en el tratamiento quedan obligados al secreto aun después de terminada su relación (art. 10). Si un tercero trata datos por cuenta de la empresa, no puede usarlos para otro fin y debe destruirlos al terminar el servicio, salvo autorización (art. 25). Por eso los accesos son personales y mínimos, y se dan de baja el mismo día de la salida.',
                },
                {
                  lead: 'Salida del personal en relación de dependencia.',
                  nivel: 'MEDIO',
                  texto:
                    'La Ley 27.802 cambió el preaviso, que no se exige durante el período de prueba (art. 231 LCT), la base y el alcance de la indemnización por despido (art. 245 LCT) y el plazo para entregar los certificados de trabajo, que es de 45 días hábiles desde la extinción (art. 80 LCT). Cualquier desvinculación se define antes con el abogado.',
                },
              ],
            },
            {
              id: 'es',
              titulo: 'España',
              bajada: 'Estatuto de los Trabajadores, Ley 20/2007 del Estatuto del trabajo autónomo, Ley 12/1992 de contrato de agencia, RGPD y LOPDGDD.',
              items: [
                {
                  lead: 'Presunción de laboralidad.',
                  nivel: 'ALTO',
                  texto:
                    'El ET se aplica a quien presta servicios retribuidos por cuenta ajena y dentro del ámbito de organización y dirección de otra persona (art. 1.1 ET), y presume el contrato de trabajo entre quien presta un servicio en esas condiciones y quien lo recibe a cambio de una retribución (art. 8.1 ET). El nombre que las partes den al contrato no decide la calificación.',
                },
                {
                  lead: 'Indicios de la STS 805/2020.',
                  nivel: 'ALTO',
                  texto:
                    'En la sentencia del Pleno de la Sala de lo Social del Tribunal Supremo del 25 de septiembre de 2020, sobre los repartidores de Glovo, la relación se declaró laboral aunque el repartidor figuraba como autónomo. Pesaron la sujeción a instrucciones y al control de la empresa por geolocalización, un sistema de puntuación que condicionaba la elección de franjas, la fijación de precios y condiciones por la empresa, la falta de una organización empresarial propia y que el medio esencial era la plataforma de la empresa, mientras que la moto y el teléfono del repartidor eran accesorios. Aplicado a un closer, si la empresa pone los leads, el CRM, el guion, el precio y la agenda, el riesgo crece.',
                },
                {
                  lead: 'Trabajador autónomo económicamente dependiente.',
                  nivel: 'MEDIO',
                  texto:
                    'Es TRADE el autónomo que percibe de un mismo cliente al menos el 75 % de sus ingresos y cumple requisitos como no tener asalariados ni subcontratar, no trabajar de forma indiferenciada con los empleados del cliente, contar con medios propios, seguir criterios organizativos propios y cobrar según el resultado (art. 11 de la Ley 20/2007). El contrato se hace por escrito y se registra (art. 12), incluye una interrupción anual de 18 días hábiles (art. 14), la extinción sin causa por el cliente da derecho a una indemnización (art. 15) y los conflictos van a la jurisdicción social (art. 17).',
                },
                {
                  lead: 'Registro de jornada y desconexión digital.',
                  nivel: 'MEDIO',
                  texto:
                    'Son obligaciones respecto de los asalariados. El registro diario de jornada surge del art. 34.9 ET y el derecho a la desconexión digital, del art. 88 LOPDGDD y del art. 20 bis ET. Con independientes no corresponden, y aplicarles control horario suma indicios de dependencia.',
                },
                {
                  lead: 'Comisiones de asalariados.',
                  nivel: 'MEDIO',
                  texto:
                    'El derecho al salario a comisión nace al realizarse y pagarse el negocio en que intervino el trabajador, y se liquida al finalizar el año salvo pacto en contrario (art. 29.2 ET). Los closers asalariados pueden quedar alcanzados por la relación laboral especial de quienes intervienen en operaciones mercantiles por cuenta de empresarios sin asumir su riesgo (Real Decreto 1438/1985). Descontar comisiones por reembolsos requiere revisión legal previa.',
                },
                {
                  lead: 'Contrato de agencia.',
                  nivel: 'MEDIO',
                  texto:
                    'El agente promueve, o promueve y concluye, operaciones por cuenta ajena de forma continuada o estable, como intermediario independiente (art. 1 de la Ley 12/1992). Se presume que hay dependencia cuando no puede organizar su actividad profesional ni el tiempo dedicado a ella según sus propios criterios (art. 2). En contratos por tiempo indefinido el preaviso es de un mes por año de vigencia, con un máximo de seis meses (art. 25), y al terminar puede corresponder una indemnización por clientela (art. 28).',
                },
                {
                  lead: 'Pacto de no competencia del asalariado.',
                  nivel: 'MEDIO',
                  texto:
                    'Después de extinguido el contrato de trabajo, la no competencia no puede superar dos años para los técnicos y seis meses para los demás trabajadores, y solo vale si el empresario tiene un efectivo interés industrial o comercial y paga una compensación económica adecuada (art. 21.2 ET).',
                },
                {
                  lead: 'Datos y confidencialidad.',
                  nivel: 'MEDIO',
                  texto:
                    'Si un colaborador externo trata datos de clientes por cuenta de la empresa, actúa como encargado del tratamiento y hace falta un contrato con el contenido del art. 28 RGPD. La seguridad del tratamiento se rige por el art. 32 RGPD, y el deber de confidencialidad de quienes intervienen se mantiene aun después de terminada la relación (art. 5 LOPDGDD).',
                },
              ],
            },
            {
              id: 'ajustes',
              titulo: 'Ajustes sugeridos a los contratos',
              bajada: 'Lo que conviene revisar en los modelos para que la gestión diaria tenga respaldo.',
              items: [
                {
                  lead: 'Contrato que describa la realidad.',
                  nivel: 'ALTO',
                  texto:
                    'Objeto por resultados y estándares de servicio, autonomía para organizar tiempos y medios, posibilidad de trabajar para otros clientes salvo conflicto de interés, facturación como condición de pago y ausencia de horarios, permisos y sanciones.',
                },
                {
                  lead: 'Cláusula de comisiones y recupero.',
                  nivel: 'ALTO',
                  texto:
                    'Base de cálculo sobre lo cobrado, porcentaje, día de liquidación, detalle por venta, recupero solo de ventas propias revertidas dentro de una ventana fija, compensación contra comisiones futuras y destino del saldo al terminar. El tratamiento impositivo lo define el contador.',
                },
                {
                  lead: 'Preaviso y finalización.',
                  nivel: 'MEDIO',
                  texto:
                    'Preaviso que respete el mínimo legal si la relación puede encuadrarse como agencia, causales de terminación inmediata, liquidación final, devolución de materiales y de datos y baja de accesos.',
                },
                {
                  lead: 'Confidencialidad, datos y propiedad intelectual.',
                  nivel: 'MEDIO',
                  texto:
                    'Confidencialidad con vigencia posterior, rol de encargado del tratamiento cuando corresponda, devolución o destrucción de datos al terminar y cesión de derechos sobre guiones, materiales y contenidos.',
                },
                {
                  lead: 'No captación antes que no competencia.',
                  nivel: 'MEDIO',
                  texto: 'Un pacto de no captación de clientes y de personal, por un plazo razonable, es más fácil de sostener que una no competencia amplia.',
                },
                {
                  lead: 'Política de comisiones para empleados.',
                  nivel: 'MEDIO',
                  texto:
                    'Si hay personal en relación de dependencia, una política escrita de comisiones revisada por el abogado, con base de cálculo, plazos de pago y tratamiento de las operaciones anuladas.',
                },
                {
                  lead: 'Reglas de trabajo como estándares del servicio.',
                  nivel: 'BAJO',
                  texto:
                    'Un anexo con canales, reuniones de coordinación y reglas legales de comunicación con clientes, redactado como estándares del servicio y no como reglamento interno.',
                },
              ],
            },
            {
              id: 'dudas',
              titulo: 'Zonas de duda',
              bajada: 'Puntos de interpretación no pacífica. Se deciden caso por caso con el abogado.',
              items: [
                {
                  lead: 'Alcance del nuevo art. 23 LCT.',
                  texto:
                    'Todavía no hay criterio judicial consolidado sobre cómo se combinan la exigencia de una prestación en situación de dependencia y la excepción por factura con el principio de primacía de la realidad del art. 14 LCT. Parte de la doctrina cuestiona su constitucionalidad.',
                },
                {
                  lead: 'Comisión sobre operaciones concertadas.',
                  texto:
                    'El texto original de la LCT decía que la comisión se liquidaba con prescindencia del resultado de la operación, y esa frase no figura en el texto ordenado vigente. Se discute si una política puede condicionar la comisión del empleado al cobro o a que no haya reembolso.',
                },
                {
                  lead: 'Recupero si el vínculo se recalifica.',
                  texto: 'Si un independiente es considerado empleado, se discute si las comisiones recuperadas deben devolverse como descuentos prohibidos (arts. 108 y 131 LCT).',
                },
                {
                  lead: 'Componentes dinámicos y comisiones.',
                  texto: 'Todavía no está claro cómo se aplica el nuevo art. 104 bis LCT a las comisiones del art. 108.',
                },
                {
                  lead: 'Closers y agencia.',
                  texto:
                    'No hay criterio consolidado sobre si un closer independiente que vende servicios por videollamada es agente, con preaviso legal y posible compensación por clientela, o un prestador de servicios sin esos derechos.',
                },
                {
                  lead: 'No competencia posterior en Argentina.',
                  texto: 'Su validez sin compensación y su alcance razonable se discuten caso por caso.',
                },
                {
                  lead: 'Independientes con colaboradores.',
                  texto: 'Parte de la doctrina discute la constitucionalidad del régimen del art. 97 de la Ley 27.742 y advierte sobre su uso para encubrir relaciones laborales.',
                },
                {
                  lead: 'TRADE y laboralidad.',
                  texto: 'Cumplir los requisitos formales del TRADE no impide que un tribunal declare la relación laboral si hay dependencia y ajenidad.',
                },
                {
                  lead: 'Registro de jornada en España.',
                  texto:
                    'Se impulsó una reforma reglamentaria para un registro de jornada digital. Antes de aplicar este punto con asalariados, verificá con el abogado si está vigente y qué exige.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'tarjeta',
      titulo: 'Tarjeta de bolsillo',
      corto: 'Tarjeta de bolsillo',
      intro: 'Una página para tener a mano. El botón la imprime sola.',
      tarjeta: true,
      bloques: [
        {
          tipo: 'bolsillo',
          filas: [
            {
              rotulo: 'Cinco reglas',
              numerada: true,
              lista: ['Resultados, no horas.', 'Un solo responsable por tarea.', 'Lo que se acuerda se escribe.', 'El acceso es prestado y temporal.', 'La práctica coincide con el contrato.'],
            },
            ind
              ? {
                  rotulo: 'Antes de pedirle algo a un independiente',
                  numerada: true,
                  lista: ['¿Pido un resultado o una forma de trabajar?', '¿Está en el contrato?', '¿Se lo pediría a un proveedor?', '¿Queda por escrito?'],
                }
              : {
                  rotulo: 'Antes de una conversación difícil',
                  numerada: true,
                  lista: ['¿Tengo los datos del tablero?', '¿Describo conductas y no personas?', '¿Lo que propongo está en el contrato o en la política?', '¿Queda por escrito?'],
                },
            {
              rotulo: 'Tres nunca',
              tono: 'nunca',
              lista: [
                'Nunca sanciones ni descuentes por fuera del contrato o de la ley.',
                ind ? 'Nunca impongas horarios ni pidas permisos a un independiente.' : 'Nunca des feedback en público.',
                'Nunca dejes un acceso abierto después de una salida.',
              ],
            },
            [
              { rotulo: 'Rituales', texto: '{Reunion} {reunionDia}. {UnoAUno} {cadaUnoAUno}. Tablero mensual.' },
              {
                rotulo: 'Comisiones',
                texto: mod === 'DEP' ? 'Según la política escrita, con el recibo de sueldo. Ningún descuento sin revisión legal.' : '{comision} sobre lo cobrado, liquidación {liquidacion}, {recuperoTexto}.',
              },
            ],
            [
              { rotulo: 'Si dudás', texto: 'Pasá el semáforo y consultá al abogado antes de cambiar contratos o pagos.' },
              { rotulo: 'Siempre', texto: 'Todo acuerdo por escrito en {canal} o por correo, el mismo día.' },
            ],
          ],
        },
      ],
    },
  ];
}

// Biblioteca de mensajes

function guiones(mod: Modalidad, ind: boolean, conRecupero: boolean, recuperoActivo: boolean, tituloCoordinacion: string, tituloObjetivos: string): Guion[] {
  const bloquesRecupero: BloqueGuion[] =
    mod === 'DEP'
      ? [
          {
            tipo: 'nota',
            etiqueta: 'En relación de dependencia',
            texto: 'Este aviso no se usa. La comisión es remuneración y descontarla por reembolsos requiere revisión legal previa ({normaComision}).',
          },
        ]
      : !conRecupero
        ? [
            {
              tipo: 'nota',
              etiqueta: recuperoActivo ? 'Recupero no aplicable' : 'Recupero desactivado',
              texto: 'La ficha indica que no hay recupero pactado. Sin una cláusula expresa, un reembolso no habilita a descontar comisiones ya liquidadas.',
            },
            {
              tipo: 'nota',
              etiqueta: 'Si se quiere pactar',
              texto: 'Se incorpora por adenda firmada, con ventana fija, solo para ventas propias y para ventas posteriores a la firma. Lo revisan el abogado y el contador.',
            },
          ]
        : [
            {
              tipo: 'decir',
              etiqueta: 'Aviso de recupero',
              condicion: mod === 'MIX' ? 'Independientes' : undefined,
              texto:
                '[[Nombre]], te avisamos que la venta a [[cliente]] del [[fecha de la venta]] tuvo [[un reembolso o un contracargo]] el [[fecha]], dentro de la ventana de {ventana} que prevé tu contrato. Según la cláusula [[número]], la comisión de esa venta, [[monto]], se compensa en la liquidación de [[período]]. Te adjuntamos el comprobante. Si tenés alguna objeción, respondé este mensaje antes del [[fecha]].',
            },
            {
              tipo: 'nota',
              etiqueta: 'Antes de enviarlo',
              texto: 'Verificá que la venta sea propia, que el reembolso o el contracargo esté dentro de la ventana y que el monto no supere la comisión cobrada por esa venta.',
            },
            {
              tipo: 'nunca',
              textos: ['Recuperar comisiones de ventas de otra persona.', 'Descontar fuera de la ventana pactada.', 'Compensar contra pagos que no sean comisiones.'],
            },
            {
              tipo: 'porque',
              texto:
                'El recupero es válido entre independientes si está pactado y se aplica tal como dice el contrato. Cualquier desvío lo vuelve discutible y, si la relación se recalifica, puede leerse como un descuento salarial.',
            },
          ];

  return [
    {
      id: 'bienvenida',
      titulo: 'Bienvenida',
      bajada: 'El primer día, con el contrato firmado y las reglas de trabajo. La envía dirección.',
      bloques: [
        ...porModalidad(
          mod,
          [
            {
              tipo: 'decir',
              etiqueta: 'Mensaje de bienvenida',
              texto:
                '[[Nombre]], te damos la bienvenida a {empresa}. Te adjuntamos tu copia firmada del contrato de prestación de servicios y las reglas de trabajo del equipo. Vos organizás tu agenda y tu forma de trabajar. Lo que acordamos son los resultados del contrato, las reglas legales para hablar con clientes y estos canales. La coordinación pasa por {canal}, las tareas por {gestor} y los datos de clientes viven solo en {crm}, con tu usuario personal. La reunión de coordinación es {reunionDia} y, si no podés estar, te llega el resumen escrito. Liquidamos tus honorarios {liquidacion} contra tu factura. Cualquier duda, escribime por acá.',
            },
          ],
          [
            {
              tipo: 'decir',
              etiqueta: 'Mensaje de bienvenida',
              texto:
                '[[Nombre]], te damos la bienvenida a {empresa}. Te adjuntamos tu copia del contrato de trabajo, el reglamento interno y la política de comisiones. Tu horario es [[horario]] y tu referente es [[nombre]]. La comunicación del equipo pasa por {canal}, las tareas por {gestor} y los datos de clientes viven solo en {crm}, con tu usuario personal. La reunión de equipo es {reunionDia}, dentro de tu horario. Cualquier duda, escribime por acá.',
            },
          ],
        ),
        {
          tipo: 'nota',
          etiqueta: 'Reglas de trabajo',
          texto:
            'Van por escrito y en una sola página. Canales, herramientas, reglas legales de comunicación con clientes, confidencialidad y datos, liquidación y salida. Con independientes se redactan como estándares del servicio, no como reglamento interno.',
        },
        {
          tipo: 'porque',
          texto: 'Empezar con el contrato firmado y las reglas por escrito evita la discusión más cara, la de qué se había acordado. Y el vocabulario del primer mensaje ya es prueba del encuadre.',
        },
      ],
    },
    {
      id: 'coordinacion',
      titulo: tituloCoordinacion,
      bajada: 'Agenda previa y resumen escrito. La envía dirección por {canal}.',
      bloques: [
        ...porModalidad(
          mod,
          [
            {
              tipo: 'decir',
              etiqueta: 'Convocatoria',
              texto:
                'Hola equipo. Nos vemos {reunionDia} en [[enlace]] para la reunión de coordinación de la semana. Temas [[temas]]. Traigan sus prioridades y los bloqueos en los que necesiten ayuda. Si alguien no puede, que avise por acá y le pasamos el resumen.',
            },
          ],
          [
            {
              tipo: 'decir',
              etiqueta: 'Convocatoria',
              texto: 'Hola equipo. Les recuerdo la reunión de equipo de {reunionDia} en [[enlace]]. Temas [[temas]]. Si alguien no puede asistir por un motivo justificado, que avise antes por acá.',
            },
          ],
        ),
        {
          tipo: 'decir',
          etiqueta: 'Resumen posterior',
          texto: 'Resumen de la {reunion} del [[fecha]]. Acuerdos [[acuerdos]]. Responsables [[nombres]]. Fechas [[fechas]]. Si algo no refleja lo que hablamos, avisen hoy por acá.',
        },
        {
          tipo: 'nunca',
          textos: ind
            ? [
                'Pasar lista o exigir cámara encendida a un independiente.',
                'Reprochar una ausencia en público.',
                'Dar instrucciones sobre cómo trabajar que excedan el resultado y las reglas legales de comunicación.',
              ]
            : ['Convocar fuera del horario de trabajo sin acuerdo.', 'Reprochar una ausencia en público.', 'Usar la reunión para sancionar o exponer a alguien.'],
        },
        {
          tipo: 'porque',
          texto:
            'La agenda previa y el resumen escrito convierten la reunión en coordinación y dejan constancia de lo acordado. Con independientes, además, muestran que la reunión sirve al servicio y no controla la presencia.',
        },
      ],
    },
    {
      id: 'feedback',
      titulo: 'Feedback escrito',
      bajada: 'Situación, conducta e impacto. Primero en privado, después por escrito.',
      bloques: [
        {
          tipo: 'decir',
          etiqueta: 'Feedback de mejora',
          texto:
            '[[Nombre]], te dejo por escrito lo que hablamos. En [[situación concreta, por ejemplo la llamada del martes con un prospecto]], [[conducta observable, por ejemplo prometiste un resultado que el programa no incluye]]. El impacto es que [[impacto, por ejemplo el cliente compra con una expectativa falsa y la venta queda expuesta a un reclamo]]. Para las próximas llamadas te propongo [[pedido concreto]]. Si querés, lo repasamos en la próxima {unoauno}.',
        },
        {
          tipo: 'decir',
          etiqueta: 'Feedback de reconocimiento',
          texto:
            '[[Nombre]], quiero destacar [[situación]]. [[Conducta, por ejemplo hiciste el repaso de cierre completo y confirmaste todo por escrito]]. Eso [[impacto, por ejemplo le dio claridad al cliente y deja la venta bien documentada]]. Gracias, es exactamente el estándar que buscamos.',
        },
        {
          tipo: 'nota',
          etiqueta: 'Modelo situación, conducta e impacto',
          texto:
            'La situación ubica el cuándo y el dónde. La conducta describe lo que se vio o se escuchó, sin adjetivos. El impacto explica la consecuencia para el cliente, el equipo o el negocio. Nada de juicios sobre la persona.',
        },
        {
          tipo: 'nunca',
          textos: ['Dar feedback en el grupo del equipo.', 'Calificar a la persona en lugar de la conducta.', 'Mezclar el feedback con amenazas sobre la continuidad.'],
        },
        {
          tipo: 'porque',
          texto: 'El feedback escrito y concreto se puede cumplir y se puede probar. Un comentario vago o hiriente no mejora nada y queda como evidencia de maltrato.',
        },
      ],
    },
    {
      id: 'objetivos',
      titulo: tituloObjetivos,
      bajada:
        mod === 'IND'
          ? 'Cuando el resultado no llega, se revisa contra lo pactado en el contrato.'
          : mod === 'DEP'
            ? 'Cuando el desempeño no llega, se acuerda un plan con apoyo y plazos.'
            : 'Revisión de objetivos para independientes y plan de mejora para empleados.',
      bloques: [
        ...porModalidad(
          mod,
          [
            {
              tipo: 'decir',
              etiqueta: 'Revisión de objetivos del contrato',
              texto:
                '[[Nombre]], te escribo para revisar los objetivos del contrato. Para [[período]] acordamos [[objetivo, por ejemplo una cantidad de agendas calificadas o una tasa de cierre]] y el resultado fue [[resultado]], según los datos de {crm}. Te propongo que lo veamos juntos el [[día]] para entender qué pasó y ajustar lo que haga falta. Como figura en el contrato, si el objetivo no se alcanza en [[plazo]] corresponde [[consecuencia pactada, por ejemplo revisar la asignación de agendas]]. Preferimos llegar a esa fecha con un plan.',
            },
            {
              tipo: 'nota',
              etiqueta: 'Sin sanciones',
              texto:
                'Con independientes no hay apercibimientos ni sanciones. Si el resultado no llega, se aplica lo que dice el contrato, desde una revisión de condiciones hasta la finalización con su preaviso.',
            },
          ],
          [
            {
              tipo: 'decir',
              etiqueta: 'Plan de mejora',
              texto:
                '[[Nombre]], te comparto el plan de mejora que conversamos el [[fecha]]. Objetivo [[objetivo medible]]. Plazo [[fecha de cierre]]. Apoyo de la empresa [[capacitación, acompañamiento en llamadas o materiales]]. Revisiones [[fechas]]. Queremos que te vaya bien y por eso dejamos todo por escrito. Si algo no te parece realista, decímelo antes del [[fecha]].',
            },
            {
              tipo: 'nota',
              etiqueta: 'Plan no es sanción',
              texto: 'Un plan de mejora no es una sanción. Si corresponde una medida disciplinaria, se define con el abogado según {normaLaboral}.',
            },
          ],
        ),
        {
          tipo: 'porque',
          texto: 'Medir contra lo pactado mantiene la conversación en el terreno del contrato. Un plan con apoyo y fechas es justo para la persona y ordena cualquier decisión posterior.',
        },
      ],
    },
    {
      id: 'liquidacion',
      titulo: 'Liquidación de comisiones',
      bajada: 'Por escrito y con detalle por venta, {liquidacion}. La envía administración desde {correoAdmin}.',
      bloques: [
        ...porModalidad(
          mod,
          [
            {
              tipo: 'decir',
              etiqueta: 'Liquidación del período',
              texto: `[[Nombre]], te enviamos la liquidación de [[período]]. Ventas cobradas [[monto]]. Comisión del {comision}, [[monto]].${
                conRecupero ? ' Recupero por reembolsos y contracargos dentro de la ventana, [[monto]], con el detalle adjunto.' : ''
              } Adelantos ya pagados [[monto]]. Neto a liquidar [[monto]]. Si estás de acuerdo, enviá tu factura por el neto a {correoAdmin} y el pago se acredita el [[fecha]]. Si ves una diferencia, avisanos por escrito antes del [[fecha]].`,
            },
          ],
          [
            {
              tipo: 'decir',
              etiqueta: 'Detalle de comisiones',
              texto:
                '[[Nombre]], te compartimos el detalle de comisiones de [[período]], que se liquida con tu recibo de sueldo. Ventas del período [[cantidad]], comisión [[monto]]. Si ves alguna diferencia, avisá por escrito a {correoAdmin} antes del [[fecha]] y lo revisamos.',
            },
          ],
        ),
        {
          tipo: 'nunca',
          textos: ['Liquidar sin detalle por venta.', 'Retener un pago como forma de presión.', 'Cambiar el porcentaje sin una adenda firmada.'],
        },
        {
          tipo: 'porque',
          texto: 'La liquidación detallada evita discusiones sobre cuánto se cobró y por qué, y es la prueba de que se pagó lo pactado.',
        },
      ],
    },
    {
      id: 'recupero',
      titulo: 'Aviso de recupero',
      bajada: 'Solo si el contrato lo prevé y dentro de la ventana pactada. Lo envía administración.',
      bloques: bloquesRecupero,
    },
    {
      id: 'finalizacion',
      titulo: 'Aviso de finalización',
      bajada: 'Según el contrato y con su preaviso. Comunicación formal desde {correoAdmin} o por el medio que fije el contrato.',
      bloques: [
        ...porModalidad(
          mod,
          [
            {
              tipo: 'decir',
              etiqueta: 'Carta de finalización',
              texto:
                'Estimado [[nombre]]. Por la presente le comunicamos que {empresa} da por finalizado el contrato de prestación de servicios celebrado el [[fecha]], conforme a su cláusula [[número]], con un preaviso de [[plazo]]. En consecuencia, la relación concluirá el [[fecha de cierre]]. Hasta esa fecha se liquidarán los honorarios devengados según el contrato, y le haremos llegar la liquidación final junto con el detalle para la devolución de materiales y la baja de accesos. Agradecemos su colaboración y quedamos a disposición por este medio.',
            },
            {
              tipo: 'nota',
              etiqueta: 'Antes de enviarla',
              texto:
                'Revisá el preaviso del contrato. Si el colaborador promueve ventas de forma estable, la ley puede exigir un preaviso mínimo según la antigüedad del vínculo. Lo confirma el abogado.',
            },
          ],
          [
            {
              tipo: 'nota',
              etiqueta: 'En relación de dependencia',
              texto:
                'La desvinculación no se comunica con un modelo. Antes de cualquier aviso, el abogado define la causa, el preaviso, la forma de notificación, la liquidación final y la entrega de certificados según {normaLaboral}.',
            },
          ],
        ),
        {
          tipo: 'nunca',
          textos: [
            'Anunciar la salida en el grupo antes de hablar con la persona.',
            'Cortar accesos sin aviso, salvo un riesgo concreto para los datos.',
            'Condicionar el pago de lo devengado a la devolución de materiales.',
          ],
        },
        {
          tipo: 'porque',
          texto: 'Una salida según el contrato, con preaviso y por escrito, cierra la relación sin abrir un reclamo. El tono formal protege a las dos partes.',
        },
      ],
    },
    {
      id: 'devolucion',
      titulo: 'Devolución y accesos',
      bajada: 'El último día. Lo coordina administración con dirección.',
      bloques: [
        {
          tipo: 'decir',
          etiqueta: 'Pedido de devolución',
          texto:
            '[[Nombre]], para cerrar en orden te pedimos que antes del [[fecha]] devuelvas [[materiales, por ejemplo equipos, guiones y materiales de capacitación]] y elimines cualquier copia de datos de clientes que tengas fuera de {crm}. Si tenés pendientes con clientes, pasalos por escrito a [[responsable]] para que nadie quede sin respuesta. Gracias por el trabajo compartido.',
        },
        {
          tipo: 'decir',
          etiqueta: 'Aviso de baja de accesos',
          texto:
            '[[Nombre]], te confirmamos que hoy dimos de baja tus accesos a {crm}, {gestor} y {canal}. Si quedó algo personal tuyo en alguna de esas herramientas, avisanos y te lo enviamos. Te recordamos que la confidencialidad sobre clientes y datos sigue vigente después de la relación.',
        },
        {
          tipo: 'nunca',
          textos: ['Pedir la devolución por el grupo del equipo.', 'Dejar accesos abiertos hasta que devuelva los materiales.'],
        },
        {
          tipo: 'porque',
          texto: 'La baja el mismo día protege los datos de los clientes, que la ley obliga a cuidar. El pedido escrito deja constancia de qué se devolvió y cuándo.',
        },
      ],
    },
  ];
}

// Contenido del protocolo de cobranza y contracargos.
// Regla de estilo de FIRMA para estos textos, sin rayas ni dos puntos.

import { bool, diasLegalesNumero, opcion } from '../motor/ficha';
import type { BloqueGuion, Ficha, Nivel, OpcionPlazo, Seccion } from '../motor/tipos';
import { numeroDe } from './ficha';

// Remisión al protocolo de conflictos, que decide los arrepentimientos y las devoluciones.
const COMPUERTA = 'la compuerta legal del protocolo de conflictos y reembolsos, en /protocolo-conflictos';

function n0(v: number | null): number {
  return v ?? 0;
}

// Antigüedad de saldos

function vencidoTotal(v: Record<string, number | null>): number {
  return n0(v.v30) + n0(v.v60) + n0(v.v90) + n0(v.v90m);
}

function hayVencido(v: Record<string, number | null>): boolean {
  return [v.v30, v.v60, v.v90, v.v90m].some((x) => x !== null);
}

function conclusionSaldos(v: Record<string, number | null>): { nivel: Nivel; texto: string } | null {
  if (v.saldo === null) return null;
  const total = vencidoTotal(v);
  if (total > v.saldo) {
    return {
      nivel: 'ambar',
      texto: 'El vencido cargado supera el saldo total por cobrar. Revisá los datos, porque el saldo total incluye lo vencido y lo que todavía no venció.',
    };
  }
  if (total === 0) {
    return { nivel: 'verde', texto: 'No hay saldos vencidos cargados. Mantené la secuencia preventiva y compará el DSO con el de los meses anteriores.' };
  }
  const tramos = [
    { monto: n0(v.v30), texto: 'el de 1 a 30 días, que corresponde a la mora temprana y media' },
    { monto: n0(v.v60), texto: 'el de 31 a 60 días, que corresponde a la mora avanzada' },
    { monto: n0(v.v90), texto: 'el de 61 a 90 días, que ya está en la etapa de cierre' },
    { monto: n0(v.v90m), texto: 'el de más de 90 días, que ya está en la etapa de cierre' },
  ];
  const mayor = tramos.reduce((a, b) => (b.monto > a.monto ? b : a));
  const viejo = n0(v.v90) + n0(v.v90m) > 0;
  const nivel: Nivel = viejo ? 'ambar' : 'info';
  const cierre = viejo
    ? ' Las cuentas con más de 60 días necesitan una decisión de cierre, sea acuerdo, gestión legal o incobrable.'
    : ' No hay saldos de más de 60 días. El foco está en que lo vencido no pase al tramo siguiente.';
  return { nivel, texto: `El tramo con más saldo vencido es ${mayor.texto}.${cierre}` };
}

// Intereses de mora, simples y sobre 365 días

function interesMora(v: Record<string, number | null>): number | null {
  if (v.monto === null || v.tasa === null || v.dias === null) return null;
  return (v.monto * (v.tasa / 100) * v.dias) / 365;
}

// Secciones

export function secciones(f: Ficha): Seccion[] {
  const mercado = opcion(f, 'mercado');
  const gracia = numeroDe(f, 'gracia', 3);
  const diasSuspension = numeroDe(f, 'diasSuspension', 15);
  const diasIntimacion = numeroDe(f, 'diasIntimacion', 15);
  const arrepentimiento = diasLegalesNumero(f);
  const corridos = (n: number) => `${n} ${n === 1 ? 'día corrido' : 'días corridos'}`;
  const conSuspension = bool(f, 'suspension');
  const conPlanes = bool(f, 'planes');

  const opcionesPlazo: OpcionPlazo[] = [
    {
      id: 'gracia',
      rotulo: `Fin de los días de gracia, ${corridos(gracia)}`,
      cantidad: gracia,
      unidad: 'corridos',
      nota: 'Se cuenta desde el vencimiento de la cuota. Hasta esa fecha el contacto es un recordatorio, sin consecuencias.',
    },
    { id: 'media', rotulo: 'Inicio de la mora media, día 16', cantidad: 16, unidad: 'corridos', nota: 'Se cuenta desde el vencimiento. Es el momento de proponer un plan o una nueva fecha.' },
    { id: 'avanzada', rotulo: 'Inicio de la mora avanzada, día 31', cantidad: 31, unidad: 'corridos', nota: 'Se cuenta desde el vencimiento. El caso pasa a legales para la intimación formal.' },
    { id: 'cierre', rotulo: 'Decisión de cierre, día 61', cantidad: 61, unidad: 'corridos', nota: 'Se cuenta desde el vencimiento. Acuerdo, gestión legal o incobrable, con la decisión registrada.' },
    ...(conSuspension
      ? [
          {
            id: 'suspension',
            rotulo: `Suspensión del servicio, ${corridos(diasSuspension)} de mora`,
            cantidad: diasSuspension,
            unidad: 'corridos' as const,
            nota: 'Se cuenta desde el vencimiento. Solo si el contrato la prevé y después del aviso previo al cliente.',
          },
        ]
      : []),
    {
      id: 'intimacion',
      rotulo: `Plazo de la intimación formal, ${corridos(diasIntimacion)}`,
      cantidad: diasIntimacion,
      unidad: 'corridos',
      nota: 'Se cuenta desde que el cliente recibe la intimación. Si anuncia la resolución del contrato sin cláusula resolutoria expresa, en Argentina no puede ser menor de quince días (art. 1088 CCyC).',
    },
    ...(arrepentimiento !== null
      ? [
          {
            id: 'arrepentimiento',
            rotulo: `Plazo legal de arrepentimiento, ${arrepentimiento} días`,
            cantidad: arrepentimiento,
            unidad: 'corridos' as const,
            nota: 'Si un consumidor pide la baja dentro de este plazo, la cobranza se detiene y el caso pasa por la compuerta legal del protocolo de conflictos.',
          },
        ]
      : []),
    ...(mercado === 'ES'
      ? [
          {
            id: 'adeudo',
            rotulo: 'Devolución de un adeudo domiciliado en España, 8 semanas',
            cantidad: 56,
            unidad: 'corridos' as const,
            nota: 'El pagador puede pedir la devolución de un adeudo domiciliado dentro de las ocho semanas siguientes al cargo (Real Decreto-ley 19/2018). Se cuenta desde la fecha del cargo.',
          },
        ]
      : []),
    {
      id: 'impugnacion',
      rotulo: 'Impugnación del resumen de tarjeta en Argentina, 30 días',
      cantidad: 30,
      unidad: 'corridos',
      nota: 'Plazo del titular para cuestionar la liquidación ante el emisor, desde que recibe el resumen (art. 26 de la Ley 25.065). Las disputas por las reglas de las redes de tarjetas tienen sus propios plazos.',
    },
    {
      id: 'interpelacion',
      rotulo: 'Suspensión de la prescripción por interpelación en Argentina, 6 meses',
      cantidad: 6,
      unidad: 'meses',
      nota: 'La interpelación fehaciente suspende el curso de la prescripción por una sola vez y durante seis meses (art. 2541 CCyC). Se cuenta desde la interpelación.',
    },
    {
      id: 'prescripcion2',
      rotulo: 'Prescripción de lo que se devenga por períodos en Argentina, 2 años',
      cantidad: 24,
      unidad: 'meses',
      nota: 'Art. 2562 inc. c) CCyC. Se cuenta desde que cada cuota es exigible. Si aplica este plazo o el genérico de cinco años lo define legales.',
    },
    {
      id: 'prescripcion5',
      rotulo: 'Prescripción genérica, 5 años',
      cantidad: 60,
      unidad: 'meses',
      nota: 'En Argentina, art. 2560 CCyC. En España, acciones personales sin plazo especial, art. 1964 del Código Civil. Se cuenta desde que la obligación es exigible.',
    },
  ];

  const bloquesPlanes: BloqueGuion[] = conPlanes
    ? [
        {
          tipo: 'decir',
          etiqueta: 'Propuesta de plan de pagos',
          texto:
            'Hola [[nombre]]. Para que puedas regularizar el saldo de [[monto]], te proponemos pagarlo en [[cantidad]] cuotas de [[monto de cada cuota]], la primera el [[fecha]] y las siguientes el [[día]] de cada mes. Si te sirve, te mandamos el acuerdo para que lo confirmes por escrito y queda todo ordenado. La propuesta queda abierta hasta el [[fecha]].',
        },
        {
          tipo: 'nota',
          etiqueta: 'Regla de la ficha',
          texto: 'Hasta {cuotasMax}, con la primera cuota al aceptar. Un plan más largo o sin pago inicial lo autoriza la dirección.',
        },
      ]
    : [
        {
          tipo: 'nota',
          etiqueta: 'Sin planes de pago',
          texto: 'La ficha indica que no se ofrecen planes de pago. Ante un pedido se propone una nueva fecha única, y cualquier excepción la autoriza la dirección.',
        },
        {
          tipo: 'decir',
          etiqueta: 'Propuesta de nueva fecha',
          texto:
            'Hola [[nombre]]. Para regularizar el saldo de [[monto]], podemos tomar como nueva fecha de pago el [[fecha]]. Si te sirve, confirmanos por acá y lo dejamos registrado.',
        },
      ];

  const bloquesSuspension: BloqueGuion[] = conSuspension
    ? [
        {
          tipo: 'decir',
          etiqueta: 'Aviso de suspensión según contrato',
          texto:
            'Hola [[nombre]]. Te escribimos porque la cuota [[número]] de {programa}, vencida el [[fecha]], sigue pendiente. Como prevé el contrato que firmaste, si el pago no se regulariza antes del [[fecha]], el acceso a [[componentes]] queda suspendido desde esa fecha y hasta que se regularice. No queremos llegar a eso, así que te dejamos el enlace para pagar, [[enlace]], y si necesitás una propuesta respondé este mensaje.',
        },
        {
          tipo: 'nota',
          etiqueta: 'Cuándo se usa',
          texto: 'Solo porque el contrato lo prevé, a los {diasSuspension} de mora y siempre con este aviso previo. La suspensión alcanza lo que diga el contrato y se levanta apenas se regulariza el pago.',
        },
      ]
    : [
        {
          tipo: 'nota',
          etiqueta: 'Suspensión',
          texto: 'La ficha indica que el contrato no prevé suspender el servicio por mora. No se menciona ni se aplica. Si se quiere usar, primero se ajusta el contrato.',
        },
      ];

  return [
    {
      id: 'uso',
      titulo: 'Cómo usar este protocolo',
      corto: 'Cómo usarlo',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Este protocolo ordena cómo {empresa} cobra lo que factura, desde el recordatorio previo al vencimiento hasta el cierre de cada cuenta, y cómo responde cuando un cliente desconoce un pago ante su tarjeta o su banco. Los datos del negocio se completan una vez en la ficha y se actualizan solos en todas las plantillas.',
        },
        {
          tipo: 'parrafo',
          texto:
            'El objetivo es triple. Cobrar en término sin desgastar la relación, recuperar lo vencido con acuerdos realistas y documentados, y ganar las disputas que se pueden ganar porque la prueba se armó antes de necesitarla.',
        },
        {
          tipo: 'parrafo',
          texto: `Convive con el protocolo de conflictos y reembolsos. Si el cliente se arrepiente dentro del plazo legal o pide que le devuelvan lo pagado, la cobranza se detiene y el caso pasa por ${COMPUERTA}.`,
        },
        { tipo: 'leyenda' },
        {
          tipo: 'roles',
          items: [
            { rol: 'Cobranza', foco: 'Recordatorios, seguimiento de promesas, planes dentro de la regla de la ficha y registro de cada contacto. Responsable {respCobranza}.' },
            { rol: 'Administración', foco: 'Facturación, conciliación de pagos, antigüedad de saldos y avisos de {pasarela}.' },
            { rol: 'Acompañamiento', foco: 'Constancias de la prestación, que son la prueba de cualquier disputa, y aviso temprano de clientes en riesgo.' },
            { rol: 'Legales', foco: 'Intimaciones, acuerdos con reconocimiento de deuda, respuesta a disputas y gestión judicial. Responsable {respLegales}.' },
            { rol: 'Dirección', foco: 'Planes fuera de la regla, pase a incobrable y tablero de indicadores.' },
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'Cobrar no es perseguir. Cada contacto sale por {canal}, en días y horarios hábiles, con el monto exacto y una forma concreta de pagar.',
        },
      ],
    },
    {
      id: 'ficha',
      titulo: 'Ficha del negocio',
      corto: 'Ficha del negocio',
      intro: 'Se completa una sola vez por negocio. Los mensajes, la secuencia y las calculadoras se actualizan solos.',
      bloques: [{ tipo: 'ficha' }],
    },
    {
      id: 'principios',
      titulo: 'Cinco principios',
      corto: 'Principios',
      intro: 'Valen en cualquier etapa de la cobranza. Si el equipo recuerda solo esto, ya evita la mayoría de los errores.',
      bloques: [
        {
          tipo: 'reglas',
          items: [
            {
              titulo: 'Cobrar es parte del servicio.',
              texto:
                'El cliente contrató un programa con un precio y un calendario de pagos. Recordarlos es tan profesional como recordar una sesión. Quien cobra con vergüenza transmite que la deuda es negociable.',
            },
            {
              titulo: 'Recordar antes de reclamar.',
              texto:
                'El primer contacto llega antes del vencimiento, no después. Un atraso puede ser un olvido, una tarjeta vencida o un límite agotado, y el aviso previo resuelve esos casos sin que nadie se sienta reclamado.',
            },
            {
              titulo: 'Firmes en el fondo, amables en la forma.',
              texto:
                'El monto, la fecha y las consecuencias pactadas no se negocian por chat. El tono se cuida siempre. Se puede ser exacto y cordial en el mismo mensaje.',
            },
            {
              titulo: 'Nunca con apariencia de juicio.',
              texto:
                'Ningún mensaje simula una demanda, un embargo, una cédula o un sello oficial, ni anuncia algo que no se va a hacer. Con consumidores la ley lo prohíbe expresamente y, con cualquier cliente, debilita la posición de la empresa si el caso llega a un tercero.',
            },
            {
              titulo: 'Todo contracargo se contesta con prueba.',
              texto:
                'Una disputa no se gana con razones ni con enojo, se gana con documentos. Se contesta siempre, dentro del plazo que informa {pasarela}, con un paquete de prueba completo y ordenado que se empezó a construir el día de la venta.',
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Cómo se ve en la práctica' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Recordar antes de reclamar',
              texto: 'Tres días antes del vencimiento sale un mensaje breve con monto, fecha y enlace de pago. No menciona atrasos ni consecuencias.',
              cita: 'Hola [[nombre]], te recordamos que el [[fecha]] vence la cuota [[número]] de {programa}, por [[monto]]. Podés pagarla desde [[enlace]]. Cualquier duda, escribinos por acá.',
            },
            {
              titulo: 'Firmes y amables',
              texto:
                'El cliente pide pagar la mitad este mes y el resto más adelante. No se acepta ni se rechaza en el momento. Se agradece el aviso y se responde con una propuesta concreta dentro de la regla de la ficha.',
              cita: 'Gracias por avisarnos con tiempo, [[nombre]]. Lo revisamos y mañana te escribimos con una propuesta concreta para regularizarlo.',
            },
            {
              titulo: 'Sin apariencia de juicio',
              texto: 'En lugar de un mensaje que imita una notificación judicial, se informa el hecho y la consecuencia pactada, sin adornos.',
              cita: 'Te recordamos que la cuota del [[fecha]] sigue pendiente. Según el contrato, si no se regulariza antes del [[fecha]], [[consecuencia pactada]].',
            },
            {
              titulo: 'Prueba desde la venta',
              texto:
                'Cada vez que el cliente acepta las condiciones, accede a la plataforma, asiste a una sesión o recibe un entregable, queda una constancia con fecha. Esa constancia es la que después gana una disputa.',
            },
          ],
        },
      ],
    },
    {
      id: 'secuencia',
      titulo: 'Secuencia de cobro en seis etapas',
      corto: 'Secuencia de cobro',
      intro: 'Cada etapa tiene responsable, plazo y objetivo. Los días se cuentan desde el vencimiento de cada pago y el paso de una etapa a otra queda registrado.',
      bloques: [
        {
          tipo: 'etapas',
          items: [
            {
              titulo: 'Antes del vencimiento',
              cuando: 'Responsable {respCobranza} · Entre cinco y tres días antes',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que el cliente sepa cuánto paga, cuándo y cómo, sin sorpresas.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Recordatorio preventivo por {canal} con monto, fecha y enlace o datos de pago. Si el cargo es automático, aviso de la fecha del cargo y de cómo actualizar la tarjeta. Revisión de tarjetas próximas a vencer.',
                },
                { rotulo: 'Frase ancla', texto: 'Te recordamos que el [[fecha]] vence tu cuota de {programa}. Te dejamos el enlace para que lo tengas a mano.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Mandar el primer mensaje cuando el pago ya está atrasado, o un recordatorio sin monto ni forma de pago.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Día del vencimiento',
              cuando: 'Responsable {respCobranza} · El mismo día',
              datos: [
                { rotulo: 'Objetivo', texto: 'Cobrar en término o detectar el rechazo el mismo día.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Conciliación de los pagos del día contra lo facturado. Si un cargo automático fue rechazado, aviso inmediato con un enlace para pagar con otro medio. Si se pagó, confirmación breve.',
                },
                { rotulo: 'Frase ancla', texto: 'Hoy vence tu cuota y el cargo no pudo procesarse. Te dejamos un enlace para completarlo con otro medio de pago.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Revisar los rechazos días después o suponer que el cliente ya se enteró por su banco.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Mora temprana',
              cuando: 'Responsable {respCobranza} · Del día 1 al 15, con {gracia} de gracia',
              datos: [
                { rotulo: 'Objetivo', texto: 'Recuperar el pago con contacto personal y entender la causa del atraso.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Durante los días de gracia, recordatorio amable y sin consecuencias. Después, mensaje personal y, si no hay respuesta, una llamada en horario hábil. Se pregunta qué pasó, se registra la causa y toda promesa de pago queda por escrito con monto y fecha.',
                },
                { rotulo: 'Frase ancla', texto: 'Queremos ayudarte a regularizarlo. ¿Qué fecha te queda cómoda para hacer el pago?', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Repetir el mismo mensaje automático varias veces o insistir por varios canales el mismo día.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Mora media',
              cuando: 'Responsable {respCobranza} · Del día 16 al 30',
              datos: [
                { rotulo: 'Objetivo', texto: 'Acordar una solución concreta antes de que la deuda se enfríe.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto: `${conPlanes ? 'Propuesta de plan de pagos dentro de la regla de la ficha, hasta {cuotasMax}, con la primera cuota al aceptar.' : 'Propuesta de una nueva fecha única de pago. Un plan en cuotas solo con autorización de la dirección.'} ${conSuspension ? 'Si no hay acuerdo, aviso de suspensión según el contrato, que se aplica a los {diasSuspension} de mora.' : 'El contrato no prevé suspensión, así que no se menciona.'} Aviso interno a legales de las cuentas que no responden.`,
                },
                {
                  rotulo: 'Frase ancla',
                  texto: 'Te proponemos regularizarlo en [[cantidad]] pagos, el primero el [[fecha]]. Si te sirve, te mandamos el acuerdo para que lo confirmes por escrito.',
                  estilo: 'frase',
                },
                { rotulo: 'Error típico', texto: 'Aceptar promesas vagas, como la semana que viene te pago, sin fecha ni monto, o armar un plan de palabra.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Mora avanzada',
              cuando: 'Responsable {respLegales} · Del día 31 al 60',
              datos: [
                { rotulo: 'Objetivo', texto: 'Formalizar el reclamo y preservar el crédito.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Revisión del expediente y de las alertas antes de enviar nada. Intimación formal de pago desde {correoLegales} o por {cartaFormal}, con {diasIntimacion} para pagar. Desde ese momento la cobranza habla con una sola voz, la de legales.',
                },
                { rotulo: 'Frase ancla', texto: 'Por la presente lo intimamos a abonar la suma de [[monto]] dentro de {diasIntimacion} de recibida esta comunicación.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Intimar con tono de amenaza, anunciar un juicio que no se va a iniciar o seguir escribiendo por chat en paralelo.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Cierre',
              cuando: 'Responsables {respLegales} y la dirección · Desde el día 61',
              datos: [
                { rotulo: 'Objetivo', texto: 'Cerrar cada cuenta por una de tres vías, con la decisión registrada.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Acuerdo de pago con reconocimiento de deuda, que además interrumpe la prescripción. Gestión legal, con mediación o la vía judicial que corresponda según monto y costo. O pase a incobrable, decidido por la dirección y consultado con el contador para su tratamiento contable y fiscal.',
                },
                { rotulo: 'Frase ancla', texto: 'Registramos el acuerdo firmado el [[fecha]] y su calendario de pagos.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Dejar cuentas abiertas durante meses sin decisión, hasta que la deuda prescribe o el cliente deja de responder.', estilo: 'error' },
              ],
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Cuatro reglas de la secuencia' },
        {
          tipo: 'tips',
          items: [
            { titulo: 'Un canal, un horario', texto: 'Los contactos salen por {canal}, en días y horarios hábiles. Nada de mensajes de madrugada ni varios contactos el mismo día.' },
            { titulo: 'Una promesa, una fecha', texto: 'Toda promesa de pago se registra con monto y fecha. Si se incumple, la cuenta pasa a la etapa siguiente sin nuevas prórrogas de palabra.' },
            { titulo: 'Lo pactado, nada más', texto: 'Intereses, suspensiones y gastos se aplican solo si están en el contrato y como están en el contrato.' },
            { titulo: 'Freno ante una alerta', texto: 'Si aparece una señal de la tabla de alertas, la secuencia se detiene hasta que decide legales.' },
          ],
        },
      ],
    },
    {
      id: 'contracargos',
      titulo: 'Contracargos y disputas',
      corto: 'Contracargos',
      intro:
        'Un contracargo es la reversión de un pago que el titular pide a su tarjeta o a su banco. El plazo para responder depende de la red de la tarjeta y de {pasarela}, y figura en el aviso de cada disputa. Se contesta siempre, con prueba.',
      bloques: [
        {
          tipo: 'etapas',
          items: [
            {
              titulo: 'Aviso de disputa',
              cuando: 'Responsable {respCobranza} · El mismo día del aviso',
              datos: [
                { rotulo: 'Objetivo', texto: 'Registrar la disputa y no perder el plazo.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Se registran la fecha límite que informa {pasarela}, el motivo y el monto. Se avisa a legales en el día, se evalúa pausar los cargos automáticos pendientes de ese cliente y se revisa si antes pidió una baja, un arrepentimiento o una devolución.',
                },
                { rotulo: 'Frase ancla', texto: 'Disputa registrada el [[fecha]], motivo [[motivo]], vence el [[fecha límite]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Ver el aviso y dejarlo para después, o aceptar la disputa sin revisar qué prueba hay.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Armado del paquete de prueba',
              cuando: 'Responsables {respCobranza} y {respLegales} · Con margen antes de la fecha límite',
              datos: [
                { rotulo: 'Objetivo', texto: 'Reunir la prueba que contesta el motivo concreto de la disputa.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Se arma el paquete con la lista de control de este protocolo. Condiciones aceptadas, constancia del pago, prueba de la prestación, comunicaciones y política de cancelación. Cada pieza se elige según el motivo, porque un pago no reconocido se contesta distinto que un servicio no recibido.',
                },
                { rotulo: 'Frase ancla', texto: 'Cada documento responde una pregunta del banco. Quién pagó, qué compró, qué aceptó y qué recibió.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Mandar todo lo que hay sin orden, o una carta enojada contra el cliente en lugar de documentos.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Respuesta en plazo',
              cuando: 'Responsable {respLegales} · Antes de la fecha límite que informa {pasarela}',
              datos: [
                { rotulo: 'Objetivo', texto: 'Presentar una respuesta completa, clara y en término.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Carta de presentación con la estructura de la biblioteca de mensajes, prueba ordenada y legible, y segunda lectura de otra persona. Se presenta completa en un solo envío. Revisá en la documentación de {pasarela} si admite agregar prueba después.',
                },
                {
                  rotulo: 'Frase ancla',
                  texto: 'El titular contrató, aceptó las condiciones el [[fecha]] y recibió el servicio, como surge de la prueba adjunta.',
                  estilo: 'frase',
                },
                { rotulo: 'Error típico', texto: 'Responder el último día, sin segunda lectura o con capturas ilegibles.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Resultado',
              cuando: 'Responsable {respLegales} · Cuando {pasarela} informa la decisión',
              datos: [
                { rotulo: 'Objetivo', texto: 'Cerrar el caso y decidir el paso siguiente.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Si se gana, se registra y el trato con el cliente sigue normal. Si se pierde, legales evalúa si reclamar la deuda en forma directa es viable y conveniente, con las reglas de la secuencia de cobro. Motivo y resultado van al tablero.',
                },
                { rotulo: 'Frase ancla', texto: 'Disputa cerrada el [[fecha]] con resultado [[resultado]]. Próximo paso [[paso]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Volver a cobrar el mismo importe con la misma tarjeta después de perder, o reclamarle al cliente en tono de revancha.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Prevención',
              cuando: 'Responsables administración y legales · Todos los meses',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que lleguen menos disputas y que las que lleguen se ganen.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Nombre de cobro reconocible en el resumen de la tarjeta, aceptación expresa de las condiciones al pagar, aviso previo de cada cargo automático, respuesta rápida a los pedidos de baja y constancias de la prestación. Las causas del mes se revisan en el tablero.',
                },
                { rotulo: 'Frase ancla', texto: 'El cargo figura en tu resumen como [[nombre del cargo]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Un nombre de cobro que el cliente no reconoce, que convierte a un cliente conforme en una disputa por cargo desconocido.', estilo: 'error' },
              ],
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Qué prueba contesta cada motivo' },
        {
          tipo: 'tabla',
          aria: 'Motivos de disputa y prueba que los contesta',
          columnas: [
            { rotulo: 'Motivo', ancho: '0.9fr', estilo: 'fuerte' },
            { rotulo: 'Qué alega el titular', ancho: '1fr' },
            { rotulo: 'Prueba que lo contesta', ancho: '1.5fr', estilo: 'porque' },
          ],
          filas: [
            [
              'Pago no reconocido o fraude',
              'Que no hizo ni autorizó el pago.',
              'Datos del pago y del titular, validación de identidad de la tarjeta si la hubo, coincidencia de nombre y correo con la cuenta, accesos a la plataforma y comunicaciones con el cliente.',
            ],
            ['Servicio no recibido', 'Que pagó y no recibió nada.', 'Accesos, asistencia a sesiones, entregables con fecha y mensajes de bienvenida y seguimiento.'],
            ['Servicio no conforme', 'Que lo recibido no coincide con lo ofrecido.', 'Contrato y descripción del programa aceptados, constancias de la prestación y respuestas a sus planteos dentro del contrato.'],
            [
              'Baja o suscripción cancelada',
              'Que canceló y le siguieron cobrando.',
              'Condiciones de cancelación aceptadas, fecha del pedido de baja si existió y prueba de que el cargo es anterior a la baja o corresponde a cuotas ya devengadas según el contrato.',
            ],
            ['Cargo duplicado o monto incorrecto', 'Que se le cobró dos veces o de más.', 'Detalle de cada cargo con su concepto, o constancia de la devolución si el error existió.'],
            ['Devolución no procesada', 'Que se le prometió una devolución que no llegó.', 'Comunicaciones sobre el pedido y constancia de la devolución, o prueba de que no se prometió.'],
          ],
        },
        {
          tipo: 'tips',
          items: [
            { titulo: 'Primero la compuerta', texto: `Si el cliente pidió una baja, un arrepentimiento o una devolución antes de la disputa, el caso pasa por ${COMPUERTA} antes de responder.` },
            { titulo: 'Una sola respuesta', texto: 'Completa, ordenada por preguntas y con segunda lectura. Lo que no se presentó no lo evalúa nadie.' },
            { titulo: 'Sin represalias', texto: 'Mientras la disputa está abierta el trato con el cliente sigue siendo normal. Nada de reproches ni de bloqueos que el contrato no prevé.' },
            { titulo: 'Causa registrada', texto: 'Cada disputa deja su motivo y su resultado en el tablero para corregir la causa, no solo el caso.' },
          ],
        },
      ],
    },
    {
      id: 'herramientas',
      titulo: 'Herramientas de gestión',
      corto: 'Herramientas',
      intro: 'Tres herramientas para decidir con números. Funcionan en el navegador y no guardan datos. Los montos se expresan en la moneda de la ficha.',
      bloques: [
        {
          tipo: 'calculadora',
          id: 'saldos',
          titulo: 'Antigüedad de saldos y días de cobro',
          intro: 'Cargá los datos de un período, por ejemplo el último mes, y obtené los indicadores de la cartera. Cada tramo de antigüedad corresponde a una etapa de la secuencia de cobro.',
          entradas: [
            { id: 'facturacion', rotulo: 'Facturación del período', unidad: 'moneda', ayuda: 'Todo lo facturado en el período, cobrado o no.' },
            { id: 'dias', rotulo: 'Días del período', unidad: 'días', inicial: '30' },
            { id: 'saldo', rotulo: 'Saldo total por cobrar', unidad: 'moneda', ayuda: 'Lo pendiente al cierre, vencido y por vencer.' },
            { id: 'v30', rotulo: 'Vencido de 1 a 30 días', unidad: 'moneda' },
            { id: 'v60', rotulo: 'Vencido de 31 a 60 días', unidad: 'moneda' },
            { id: 'v90', rotulo: 'Vencido de 61 a 90 días', unidad: 'moneda' },
            { id: 'v90m', rotulo: 'Vencido hace más de 90 días', unidad: 'moneda' },
            { id: 'transacciones', rotulo: 'Transacciones con tarjeta', unidad: 'pagos', ayuda: 'Del mismo período.' },
            { id: 'contracargos', rotulo: 'Contracargos recibidos', unidad: 'casos', ayuda: 'Del mismo período.' },
          ],
          salidas: [
            {
              id: 'dso',
              rotulo: 'Días de cobro, DSO',
              formato: 'dias',
              destacada: true,
              ayuda: 'Saldo por cobrar dividido facturación, por los días del período.',
              calcular: (v) => (v.facturacion && v.saldo !== null && v.dias ? (v.saldo / v.facturacion) * v.dias : null),
            },
            { id: 'vencido', rotulo: 'Total vencido', formato: 'monto', calcular: (v) => (hayVencido(v) ? vencidoTotal(v) : null) },
            { id: 'pctVencido', rotulo: 'Porcentaje vencido', formato: 'pct', ayuda: 'Sobre el saldo total por cobrar.', calcular: (v) => (v.saldo ? (vencidoTotal(v) / v.saldo) * 100 : null) },
            {
              id: 'pct60',
              rotulo: 'Vencido con más de 60 días',
              formato: 'pct',
              ayuda: 'Sobre el saldo total por cobrar.',
              calcular: (v) => (v.saldo ? ((n0(v.v90) + n0(v.v90m)) / v.saldo) * 100 : null),
            },
            {
              id: 'tasaCc',
              rotulo: 'Tasa de contracargos',
              formato: 'pct',
              ayuda: 'Contracargos dividido transacciones con tarjeta.',
              calcular: (v) => (v.transacciones ? (n0(v.contracargos) / v.transacciones) * 100 : null),
            },
          ],
          conclusion: (v) => conclusionSaldos(v),
          nota: 'Herramienta orientativa. El DSO se compara con el del propio negocio mes a mes, no con cifras de otros sectores. Si los contracargos llegan en un mes distinto del cobro, la tasa es aproximada.',
        },
        {
          tipo: 'calculadora',
          id: 'intereses',
          titulo: 'Intereses de mora',
          intro: 'Calcula el interés simple por los días de atraso con la tasa anual pactada. Sin capitalización, porque los intereses de los intereses solo se deben en los casos que admite la ley.',
          entradas: [
            { id: 'monto', rotulo: 'Monto adeudado', unidad: 'moneda' },
            { id: 'tasa', rotulo: 'Tasa anual pactada', unidad: '%', inicial: typeof f.interes === 'string' ? f.interes.trim() : '' },
            { id: 'dias', rotulo: 'Días de atraso', unidad: 'días', ayuda: 'Desde el vencimiento hasta la fecha del cálculo.' },
          ],
          salidas: [
            { id: 'interes', rotulo: 'Interés de mora', formato: 'monto', calcular: (v) => interesMora(v) },
            {
              id: 'total',
              rotulo: 'Total con intereses',
              formato: 'monto',
              destacada: true,
              calcular: (v) => {
                const i = interesMora(v);
                return i === null || v.monto === null ? null : v.monto + i;
              },
            },
            { id: 'tasaPeriodo', rotulo: 'Tasa aplicada al período', formato: 'pct', calcular: (v) => (v.tasa === null || v.dias === null ? null : (v.tasa * v.dias) / 365) },
          ],
          conclusion: (v, _r, fi) => {
            if (v.monto === null) return null;
            if (v.tasa === null) {
              return { nivel: 'info', texto: 'Cargá la tasa anual que fija el contrato. Si no fija ninguna, legales define la tasa aplicable antes de reclamar intereses.' };
            }
            if (v.dias === null) return null;
            const m = opcion(fi, 'mercado');
            const limite =
              m === 'AR'
                ? ' En Argentina un juez puede reducir intereses desproporcionados (art. 771 CCyC).'
                : m === 'ES'
                  ? ' En España, con consumidores, una indemnización desproporcionada por el incumplimiento puede ser abusiva (art. 85.6 TRLGDCU).'
                  : '';
            return { nivel: 'info', texto: `Interés simple sobre una base de 365 días. Antes de reclamar este importe, verificá que la tasa y el cálculo coincidan con el contrato.${limite}` };
          },
          nota: 'Herramienta orientativa. No reemplaza la liquidación de legales ni contempla pagos parciales.',
        },
        {
          tipo: 'plazos',
          id: 'plazos',
          titulo: 'Plazos de la secuencia',
          intro: 'Elegí el plazo y la fecha desde la que corre, por ejemplo el vencimiento de la cuota o la recepción de la intimación.',
          opciones: opcionesPlazo,
        },
        {
          tipo: 'aclaracion',
          texto: 'Las calculadoras ordenan la decisión, no la reemplazan. Los montos que se reclaman por escrito los confirma legales con el contrato en la mano.',
        },
      ],
    },
    {
      id: 'mensajes',
      titulo: 'Biblioteca de mensajes',
      corto: 'Mensajes',
      intro:
        'Once modelos ordenados por etapa. Se completan con la ficha y se adaptan al tono de cada empresa, siempre que no cambie el contenido. Los mensajes de chat van con vos y las comunicaciones formales de legales, con usted.',
      bloques: [
        {
          tipo: 'guiones',
          aria: 'Mensajes por etapa',
          items: [
            {
              id: 'previo',
              titulo: 'Antes y al vencer',
              bajada: 'Avisos sin tono de reclamo. Los envía {respCobranza} por {canal}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Recordatorio preventivo',
                  texto:
                    'Hola [[nombre]], ¿cómo estás? Te escribimos para recordarte que el [[fecha]] vence la cuota [[número]] de {programa}, por [[monto]]. Podés pagarla desde [[enlace o datos de pago]]. Si ya la tenés programada, no hace falta que hagas nada. Cualquier duda, escribinos por acá.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Aviso de vencimiento',
                  condicion: 'Pago manual',
                  texto:
                    'Hola [[nombre]]. Hoy vence la cuota [[número]] de {programa}, por [[monto]]. Te dejamos de nuevo el enlace para que lo tengas a mano, [[enlace]]. Cuando la pagues, si querés, mandanos el comprobante por acá y la acreditamos.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Aviso de vencimiento',
                  condicion: 'Cargo automático rechazado',
                  texto:
                    'Hola [[nombre]]. Hoy intentamos procesar la cuota [[número]] de {programa} y el cargo no pudo completarse. Puede pasar por una tarjeta vencida o un límite alcanzado. Podés completarlo con otra tarjeta o medio de pago desde [[enlace]]. Si necesitás ayuda, te acompañamos por acá.',
                },
                {
                  tipo: 'porque',
                  texto: 'El aviso previo resuelve los olvidos antes de que sean atrasos y deja constancia de que el cliente conocía el monto, la fecha y la forma de pago.',
                },
              ],
            },
            {
              id: 'temprana',
              titulo: 'Mora temprana',
              bajada: 'Contacto personal y todavía sin consecuencias. Responsable {respCobranza}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Recordatorio en mora temprana',
                  texto:
                    'Hola [[nombre]]. Vemos que la cuota [[número]] de {programa}, que vencía el [[fecha]], todavía figura pendiente. Puede ser un olvido, así que te dejamos el enlace para regularizarla, [[enlace]]. Si pasó algo, contanos y lo vemos juntos.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Respuesta a no puedo pagar',
                  texto:
                    'Gracias por contarnos, [[nombre]], valoramos que nos avises. Queremos ayudarte a encontrar una forma de regularizarlo. Contanos qué monto podrías pagar ahora y qué fecha te queda cómoda para el resto, y mañana te escribimos con una propuesta concreta.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Promesa de pago',
                  texto: 'Toda promesa se confirma por escrito con monto y fecha. Por ejemplo, Perfecto [[nombre]], quedamos en que el [[fecha]] abonás [[monto]]. Gracias.',
                },
                {
                  tipo: 'nunca',
                  textos: ['Mandar varios mensajes el mismo día o fuera del horario hábil.', 'Preguntar por la vida personal del cliente o juzgar sus motivos.', 'Mencionar consecuencias que el contrato no prevé.'],
                },
              ],
            },
            {
              id: 'planes',
              titulo: 'Planes y acuerdos',
              bajada: 'Propuestas dentro de la regla de la ficha y acuerdos firmados. El acuerdo lo revisa legales.',
              bloques: [
                ...bloquesPlanes,
                {
                  tipo: 'decir',
                  etiqueta: 'Acuerdo de pago con reconocimiento de deuda',
                  texto:
                    'ACUERDO DE PAGO entre {empresa} y [[nombre completo y documento del cliente]]. Primero. El cliente reconoce adeudar a {empresa} la suma de [[monto]] en concepto de [[cuotas impagas del contrato del día]], con más [[intereses pactados, si corresponden]]. Segundo. Las partes acuerdan cancelar esa suma en [[cantidad]] cuotas de [[monto]], con vencimiento el [[día]] de cada mes, la primera el [[fecha]], mediante [[medio de pago]]. Tercero. La falta de pago de cualquier cuota a su vencimiento producirá la caducidad de los plazos acordados y hará exigible el saldo total, con los intereses pactados en el contrato. Cuarto. Este acuerdo no importa novación de las obligaciones del contrato original, que mantiene su vigencia en todo lo que no se modifica aquí. Quinto. [[Si corresponde, alcance del servicio durante el plan, por ejemplo reactivación del acceso con el primer pago]]. Se firma en [[lugar]], el [[fecha]], mediante [[plataforma de firma o aceptación desde el correo del cliente]].',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Antes de firmar',
                  texto:
                    'Lo revisa legales y se firma por una plataforma de firma o se acepta desde el correo del cliente. Tanto en Argentina (art. 2545 CCyC) como en España (art. 1973 del Código Civil), el reconocimiento de la deuda interrumpe la prescripción.',
                },
                {
                  tipo: 'porque',
                  texto: 'Un acuerdo escrito con reconocimiento de la deuda vale más que diez promesas por chat. Ordena el pago, interrumpe la prescripción y, si se incumple, deja el saldo listo para reclamar.',
                },
              ],
            },
            {
              id: 'avanzada',
              titulo: 'Mora avanzada',
              bajada: 'Consecuencias pactadas e intimación formal. Desde la intimación, una sola voz.',
              bloques: [
                ...bloquesSuspension,
                {
                  tipo: 'decir',
                  etiqueta: 'Intimación formal de pago',
                  texto:
                    '[[Nombre completo del cliente]]. De nuestra consideración. Nos dirigimos a usted en representación de {empresa} en relación con el contrato de [[servicio]] celebrado el [[fecha]]. A la fecha registra un saldo impago de [[monto]], correspondiente a [[detalle de cuotas y vencimientos]]. {fundamentoMora} Por la presente lo intimamos a abonar dicha suma, con {textoInteres}, dentro de {diasIntimacion} de recibida esta comunicación, mediante [[medio de pago]], bajo apercibimiento de [[consecuencia que efectivamente se aplicará, por ejemplo resolver el contrato e iniciar las acciones que correspondan]]. Si ya realizó el pago, le pedimos que remita el comprobante a {correoLegales} y desestime esta comunicación. Saludamos a usted atentamente. [[Nombre y cargo]], {empresa}.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Antes de enviarla',
                  texto:
                    'La envía legales desde {correoLegales} o por {cartaFormal}. Lleva solo consecuencias que la empresa está dispuesta a aplicar y que el contrato o la ley permiten. Sin sellos, escudos ni fórmulas que imiten una notificación judicial.',
                },
                {
                  tipo: 'nunca',
                  textos: ['Simular una cédula, un oficio o una demanda.', 'Anunciar embargos, inhibiciones o denuncias penales para presionar.', 'Copiar a familiares, socios o empleadores del cliente.'],
                },
              ],
            },
            {
              id: 'baja',
              titulo: 'Baja y arrepentimiento',
              bajada: 'Cuando el cliente quiere irse. Primero se revisa si corresponde la compuerta legal.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Respuesta a quiero darme de baja y dejar de pagar',
                  texto:
                    'Hola [[nombre]], gracias por avisarnos. Registramos tu pedido de baja del [[fecha]]. Para responderte bien, el equipo revisa tu contrato y el estado de tus pagos, y te escribimos el [[día]] con el detalle de cómo queda todo. Mientras lo revisamos no se procesan nuevos cargos.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Antes de responder el fondo',
                  texto: `Si el cliente puede ser consumidor y el pedido llegó dentro de {dias}, o si pide que le devuelvan lo pagado, la cobranza se detiene y el caso pasa por ${COMPUERTA}. Si no, legales responde con lo que dice el contrato sobre la baja, las cuotas devengadas y las pendientes.`,
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Baja por el mismo medio',
                  texto:
                    'En Argentina, si el servicio se contrató por teléfono o por medios electrónicos, el consumidor puede rescindirlo por el mismo medio y la empresa debe enviarle una constancia dentro de las 72 horas (art. 10 ter LDC). El pedido vale aunque llegue por {canal}.',
                },
                {
                  tipo: 'porque',
                  texto: 'Pedir la baja y dejar de pagar son cosas distintas. La baja se registra siempre y se responde por escrito. Lo que pasa con las cuotas lo define el contrato y, con consumidores, también la ley.',
                },
              ],
            },
            {
              id: 'contracargo',
              titulo: 'Contracargos',
              bajada: 'Un único mensaje al cliente y una respuesta ordenada ante {pasarela}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Mensaje al cliente que inició un contracargo',
                  texto:
                    'Hola [[nombre]]. Recibimos un aviso de {pasarela} de que se desconoció el pago del [[fecha]] por [[monto]], correspondiente a {programa}. Queremos asegurarnos de que no haya un error. Si no reconocés el cargo, contanos y lo revisamos con vos. Si hay algo del servicio que no te conformó, escribinos y lo vemos dentro del contrato. Si fue un error, tu banco te puede indicar cómo retirar el reclamo.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Una sola vez',
                  texto: 'Se manda un único mensaje, sin reproches. Si el cliente no responde, no se insiste. La respuesta de fondo va por {pasarela} y, si hace falta, desde {correoLegales}.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Estructura de la respuesta a la disputa',
                  texto:
                    'Respuesta a la disputa [[identificador]] por [[monto]]. Uno, resumen. [[Nombre del titular]] contrató {programa} de {empresa} el [[fecha]] y aceptó las condiciones de contratación y de cancelación antes de pagar, como surge del documento 1. Dos, autorización del pago. El pago se realizó con [[medio de pago]] a nombre del titular, con [[validaciones disponibles]], y coincide con los datos de su cuenta, documento 2. Tres, prestación del servicio. El cliente accedió al programa y lo utilizó entre el [[fecha]] y el [[fecha]], con [[accesos, sesiones o entregables]], documentos 3 y 4. Cuatro, comunicaciones. [[Intercambios relevantes, incluido cualquier pedido de baja o devolución y su respuesta]], documento 5. Cinco, conclusión. El cargo corresponde a un servicio contratado, autorizado y prestado conforme a las condiciones aceptadas, por lo que solicitamos que la disputa se resuelva a favor de {empresa}.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Cómo se presenta',
                  texto: 'Cada documento se nombra y se numera como en la carta, con fechas visibles y sin datos de otros clientes. Se presenta completo en un solo envío y dentro del plazo que informa {pasarela}.',
                },
                {
                  tipo: 'nunca',
                  textos: [
                    'Presionar al cliente para que retire la disputa, con amenazas o con un beneficio condicionado.',
                    'Volver a cobrar el mismo importe mientras la disputa está abierta.',
                    'Responder con opiniones sobre el cliente en lugar de documentos.',
                  ],
                },
                {
                  tipo: 'porque',
                  texto: 'El banco decide con lo que recibe. Una respuesta ordenada por preguntas se lee rápido y muestra que el servicio se contrató, se autorizó y se prestó.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'frases',
      titulo: 'Frases prohibidas y su reemplazo',
      corto: 'Frases prohibidas',
      intro: 'Cobrar con firmeza no necesita amenazas. Estas son las frases que no se usan nunca y cómo reemplazarlas.',
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
            [
              'Si no pagás hoy te iniciamos juicio.',
              'Según el contrato, si el pago no se regulariza antes del [[fecha]], [[consecuencia pactada]].',
              'Anuncia algo que no está decidido y suena a intimidación. La consecuencia pactada es más creíble.',
            ],
            ['Te vamos a embargar el sueldo.', 'Si no llegamos a un acuerdo, el caso pasa a legales para la gestión formal.', 'Un embargo solo lo ordena un juez. Anunciarlo por chat da apariencia judicial al reclamo.'],
            ['Tu caso ya está en el juzgado.', 'Tu caso está en manos de nuestro equipo de legales.', 'Simula un proceso que no existe. Con consumidores está prohibido.'],
            ['Vamos a hablar con tu familia o con tu jefe.', 'Seguimos en contacto con vos por {canal}.', 'La deuda es un dato personal del cliente. Contarla a terceros lo expone y viola su privacidad.'],
            ['Te vamos a escrachar en redes por moroso.', 'Silencio en redes. La gestión sigue por los canales formales.', 'Exponer al deudor es trato indigno y genera responsabilidad.'],
            [
              'Mañana te mandamos a un registro de morosos.',
              'Sin reemplazo en el chat. Si corresponde informar la deuda, lo decide legales y se avisa por escrito.',
              'Usar el informe crediticio como amenaza es presión indebida. Solo se informan deudas ciertas y exigibles.',
            ],
            ['Sos un moroso.', 'La cuota del [[fecha]] figura pendiente.', 'Califica a la persona en lugar de describir el hecho.'],
            ['No te preocupes, pagá cuando puedas.', '¿Qué fecha concreta te queda cómoda para hacer el pago?', 'Sin fecha no hay compromiso. La amabilidad no reemplaza la precisión.'],
            ['Esta es la última vez que te escribimos.', 'Te escribimos para encontrar una solución. Esta es nuestra propuesta.', 'El ultimátum cierra la conversación sin cobrar.'],
            [
              'Si retirás el contracargo te hacemos un descuento.',
              'Recibimos el aviso de la disputa. Si hay algo que revisar, contanos.',
              'Cualquier acuerdo durante una disputa lo arma legales por escrito, para no terminar devolviendo dos veces.',
            ],
            [
              'Ya te pasé a legales, arreglate con ellos.',
              'Tu caso pasa a nuestro equipo de legales, que te va a escribir desde {correoLegales}.',
              'El traspaso es un cambio de canal, no un castigo.',
            ],
          ],
        },
      ],
    },
    {
      id: 'alertas',
      titulo: 'Alertas y escalamiento',
      corto: 'Alertas',
      intro: 'Ante cualquiera de estas señales la secuencia se detiene y el caso escala en el día. Nadie del equipo decide quedárselo.',
      bloques: [
        {
          tipo: 'tabla',
          aria: 'Alertas y escalamiento',
          columnas: [
            { rotulo: 'Señal', ancho: '1.2fr', estilo: 'senal' },
            { rotulo: 'Qué hacer', ancho: '1.3fr' },
            { rotulo: 'Escalar a', ancho: '0.6fr', estilo: 'pastilla' },
          ],
          filas: [
            [
              'Pide la baja o se arrepiente dentro de {dias}, por cualquier canal.',
              'Frenar la cobranza y los cargos automáticos, registrar fecha y canal, y aplicar la compuerta legal del protocolo de conflictos.',
              'Legales hoy',
            ],
            ['Reclama una devolución o dice que el servicio no se prestó.', 'No discutir el fondo por chat. Derivar con el expediente al protocolo de conflictos.', 'Legales'],
            [
              'Aparece que contrató para uso personal, o es una persona mayor o en situación de vulnerabilidad.',
              'Tratarlo como consumidor, con trato digno reforzado, mensajes simples y sin presión. Legales revisa antes de cualquier intimación.',
              'Legales',
            ],
            [
              'Informa un concurso, una quiebra o una situación de insolvencia.',
              'Suspender todo reclamo directo y no aceptar pagos parciales sin consultar. Pedir los datos del proceso.',
              'Legales hoy',
            ],
            [
              'Se informa el fallecimiento del cliente.',
              'Frenar la secuencia y los cargos automáticos. Un mensaje de condolencias, sin mencionar la deuda. Legales define cómo se reclama en la sucesión.',
              'Legales',
            ],
            [
              'El pago llega de un tercero o con una tarjeta a nombre de otra persona.',
              'Registrar quién pagó y pedir que el titular del medio de pago confirme por escrito la autorización. Es un riesgo conocido de contracargo por pago no reconocido.',
              'Administración y legales',
            ],
            ['Menciona a su abogado, una denuncia o un reclamo ante {organismo}.', 'Un único mensaje de traspaso. Desde ahí la comunicación sigue con legales o con su abogado.', 'Legales'],
            ['Llega un aviso de contracargo o disputa.', 'Registrar la fecha límite, avisar a legales y armar el paquete de prueba.', 'Legales hoy'],
            ['Pide que no lo contacten por un canal o en un horario.', 'Respetar el pedido y registrar el canal que prefiere, sin perder la vía formal.', 'Cobranza'],
            ['Incumplió dos promesas de pago seguidas.', 'Pasar a la etapa siguiente sin nuevas prórrogas de palabra.', 'Cobranza'],
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'Una alerta no significa que el cliente tenga razón. Significa que el próximo mensaje lo decide alguien con más contexto.',
        },
      ],
    },
    {
      id: 'paquete',
      titulo: 'Paquete de prueba para disputas',
      corto: 'Paquete de prueba',
      intro:
        'Lo que se presenta ante una disputa. Se arma con lo que se registró durante la venta y la prestación, por eso conviene revisarlo antes de que llegue la primera.',
      bloques: [
        {
          tipo: 'checklist',
          id: 'paquete',
          titulo: 'Contenido del paquete de prueba',
          textoConforme: 'Paquete completo',
          textoNoConforme: 'Incompleto · falta al menos una pieza crítica',
          items: [
            { id: 'p1', texto: 'Contrato o condiciones aceptadas antes del pago, con fecha, hora y medio de aceptación.', critico: true },
            { id: 'p2', texto: 'Constancia del pago con importe, fecha y datos del medio de pago que informa {pasarela}.', critico: true },
            { id: 'p3', texto: 'Prueba de la prestación, con accesos, asistencia a sesiones o entregables con fecha.', critico: true },
            { id: 'p4', texto: 'Política de cancelación y de devoluciones vigente al momento de la compra, y prueba de que el cliente la aceptó.', critico: true },
            { id: 'p5', texto: 'Comunicaciones relevantes para el motivo de la disputa, incluidos pedidos de baja o devolución y sus respuestas.', critico: true },
            { id: 'p6', texto: 'Carta de presentación con la estructura de la biblioteca de mensajes.', critico: true },
            { id: 'p7', texto: 'Datos que vinculan al titular con la cuenta, como nombre, correo y teléfono coincidentes.', critico: false },
            { id: 'p8', texto: 'Validaciones de identidad de la tarjeta, si las hubo.', critico: false },
            { id: 'p9', texto: 'Registro de la llamada de venta, si existe y fue informado al cliente, o el mensaje de confirmación posterior.', critico: false },
            { id: 'p10', texto: 'Uso posterior al pago, como ingresos a la plataforma después de la fecha del cargo.', critico: false },
            { id: 'p11', texto: 'Avisos previos de los cargos automáticos y recordatorios de vencimiento.', critico: false },
            { id: 'p12', texto: 'Constancia de cualquier devolución parcial ya realizada.', critico: false },
            { id: 'p13', texto: 'Resultado de la compuerta legal si hubo un pedido de baja o de arrepentimiento.', critico: false },
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'La prueba se presenta sin datos de otros clientes y solo con lo necesario para la disputa. El resto del expediente se conserva como información confidencial.',
        },
      ],
    },
    {
      id: 'tablero',
      titulo: 'Tablero de indicadores',
      corto: 'Tablero',
      intro: 'Lo que no se mide se repite. Se revisa una vez por mes y alimenta los ajustes a la secuencia, a la venta y a los contratos.',
      bloques: [
        {
          tipo: 'kpis',
          items: [
            {
              nombre: 'Días de cobro, DSO',
              formula: 'Saldo por cobrar al cierre, dividido facturación del período, por los días del período.',
              lectura: 'Cuántos días tarda en promedio en cobrarse lo facturado. Si sube, la cobranza se atrasa aunque las ventas crezcan.',
              meta: 'Bajar mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Administración',
            },
            {
              nombre: 'Cartera vencida por tramo',
              formula: 'Vencido de 1 a 30, de 31 a 60, de 61 a 90 y de más de 90 días, cada uno dividido el saldo total, por cien.',
              lectura: 'Muestra dónde se acumula la deuda. Lo que pasa de un tramo al siguiente sin acción es una cuenta que se está perdiendo.',
              meta: 'Que los tramos altos bajen mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Administración',
            },
            {
              nombre: 'Tasa de recupero',
              formula: 'Vencido cobrado en el mes, dividido vencido al inicio del mes, por cien.',
              lectura: 'Mide la eficacia de la secuencia sobre lo que ya estaba atrasado.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Administración',
            },
            {
              nombre: 'Tasa de contracargos',
              formula: 'Contracargos recibidos, dividido transacciones con tarjeta del mismo período, por cien.',
              lectura: 'Las redes de tarjetas siguen de cerca a los comercios con muchas disputas. Si sube, revisá el nombre de cobro, los avisos previos y la política de cancelación.',
              meta: 'Bajar mes a mes',
              frecuencia: 'Mensual',
              fuente: '{pasarela}',
            },
            {
              nombre: 'Contracargos ganados',
              formula: 'Disputas resueltas a favor, dividido disputas resueltas, por cien.',
              lectura: 'Mide la calidad del paquete de prueba. Si baja, mirá qué no se registró durante la venta o la prestación.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: '{pasarela}',
            },
            {
              nombre: 'Costo de cobranza',
              formula: 'Costo de la gestión de cobro del mes, con horas del equipo, honorarios, comisiones y gastos de disputas, dividido monto recuperado, por cien.',
              lectura: 'Cuánto cuesta recuperar lo vencido. Ayuda a decidir cuándo conviene un acuerdo y cuándo la gestión legal.',
              meta: 'Bajar mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Administración',
            },
            {
              nombre: 'Promesas de pago cumplidas',
              formula: 'Promesas cumplidas en fecha, dividido promesas registradas, por cien.',
              lectura: 'Si es baja, hay promesas sin fecha concreta o planes que el cliente no puede pagar.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Registro de cobranza',
            },
          ],
        },
        {
          tipo: 'calculadora',
          id: 'tableroMes',
          titulo: 'Tablero rápido del mes',
          intro: 'Cargá los números del mes y obtené los indicadores de recupero, costo, promesas y disputas.',
          entradas: [
            { id: 'vencidoInicio', rotulo: 'Vencido al inicio del mes', unidad: 'moneda' },
            { id: 'recuperado', rotulo: 'Vencido cobrado en el mes', unidad: 'moneda' },
            { id: 'costo', rotulo: 'Costo de la gestión de cobro', unidad: 'moneda', ayuda: 'Horas del equipo, honorarios, comisiones y gastos de disputas.' },
            { id: 'promesas', rotulo: 'Promesas de pago registradas', unidad: 'casos' },
            { id: 'cumplidas', rotulo: 'Promesas cumplidas en fecha', unidad: 'casos' },
            { id: 'resueltas', rotulo: 'Disputas resueltas', unidad: 'casos' },
            { id: 'ganadas', rotulo: 'Disputas ganadas', unidad: 'casos' },
          ],
          salidas: [
            { id: 'recupero', rotulo: 'Tasa de recupero', formato: 'pct', destacada: true, calcular: (v) => (v.vencidoInicio ? (n0(v.recuperado) / v.vencidoInicio) * 100 : null) },
            { id: 'costoPct', rotulo: 'Costo de cobranza sobre lo recuperado', formato: 'pct', calcular: (v) => (v.recuperado ? (n0(v.costo) / v.recuperado) * 100 : null) },
            { id: 'promesasPct', rotulo: 'Promesas cumplidas', formato: 'pct', calcular: (v) => (v.promesas ? (n0(v.cumplidas) / v.promesas) * 100 : null) },
            { id: 'ganadasPct', rotulo: 'Contracargos ganados', formato: 'pct', calcular: (v) => (v.resueltas ? (n0(v.ganadas) / v.resueltas) * 100 : null) },
          ],
          nota: 'El DSO, la cartera por tramo y la tasa de contracargos se calculan con la herramienta de antigüedad de saldos.',
        },
      ],
    },
    {
      id: 'juridico',
      titulo: 'Anexo jurídico',
      corto: 'Anexo jurídico',
      intro:
        'Para la dirección y el equipo legal. Cada regla del protocolo se apoya en lo que sigue. Normativa revisada a octubre de 2026. No reemplaza el análisis del caso concreto.',
      bloques: [
        {
          tipo: 'juridico',
          items: [
            {
              id: 'ar',
              titulo: 'Argentina',
              bajada: 'Código Civil y Comercial, Ley 24.240 de Defensa del Consumidor, Ley 25.065 de Tarjetas de Crédito y Ley 25.326 de Protección de Datos Personales.',
              abierto: true,
              items: [
                {
                  lead: 'Mora automática.',
                  nivel: 'MEDIO',
                  texto:
                    'La mora del deudor se produce por el solo transcurso del tiempo fijado para cumplir (art. 886 CCyC). No hace falta intimar para que corran los intereses moratorios, salvo que el plazo sea tácito o indeterminado (art. 887 CCyC). Por eso cada cuota necesita una fecha de vencimiento cierta en el contrato o en el plan.',
                },
                {
                  lead: 'Intereses.',
                  nivel: 'ALTO',
                  texto:
                    'La tasa moratoria es la que acuerdan las partes, la que fijan leyes especiales o, en subsidio, la que resulta de las reglamentaciones del Banco Central (art. 768 CCyC). Los punitorios convencionales se rigen por las normas de la cláusula penal (art. 769). No se deben intereses de los intereses, salvo cláusula expresa con acumulación no inferior a seis meses, demanda o liquidación judicial u otra disposición legal (art. 770). Los jueces pueden reducir los intereses cuando la tasa excede, sin justificación y desproporcionadamente, el costo medio del dinero para deudores y operaciones similares, y lo pagado en exceso se imputa al capital (art. 771).',
                },
                {
                  lead: 'Moneda de pago.',
                  nivel: 'BAJO',
                  texto:
                    'Con el texto que dio el DNU 70/2023 a los arts. 765 y 766 CCyC, si se pactó una moneda extranjera el deudor solo se libera entregando esa moneda y los jueces no pueden modificar la moneda pactada.',
                },
                {
                  lead: 'Trato digno y reclamos extrajudiciales.',
                  nivel: 'ALTO',
                  texto:
                    'Los proveedores deben garantizar trato digno y equitativo, evitar situaciones vergonzantes, vejatorias o intimidatorias y, en los reclamos extrajudiciales de deudas, abstenerse de usar cualquier medio que les dé apariencia de reclamo judicial (art. 8 bis LDC, arts. 1097 y 1098 CCyC). El incumplimiento puede dar lugar a la multa civil por daño punitivo (art. 52 bis LDC), y las sanciones alcanzan en forma solidaria a quien actúe en nombre del proveedor, como una agencia de cobranza.',
                },
                {
                  lead: 'Planes de pago con consumidores.',
                  nivel: 'MEDIO',
                  texto:
                    'Si un plan financia una deuda de consumo puede quedar alcanzado por el art. 36 LDC, que exige informar, bajo pena de nulidad, precio de contado, monto financiado, tasa efectiva anual, costo financiero total, cantidad y monto de los pagos y gastos. Las acciones que inicie el proveedor por esas operaciones tramitan ante el juez del domicilio real del consumidor y el pacto en contrario es nulo.',
                },
                {
                  lead: 'Suspensión y resolución.',
                  nivel: 'MEDIO',
                  texto:
                    'Cuando las prestaciones deben cumplirse en forma simultánea, una parte puede suspender la suya hasta que la otra cumpla u ofrezca cumplir (art. 1031 CCyC). Para resolver por falta de pago sin cláusula resolutoria expresa hay que emplazar al deudor en mora, bajo apercibimiento expreso de resolución, a cumplir en un plazo no menor de quince días, salvo que los usos o la índole de la prestación justifiquen uno menor (art. 1088 CCyC). Con cláusula resolutoria expresa, la resolución opera desde que se comunica en forma fehaciente (art. 1086 CCyC).',
                },
                {
                  lead: 'Prescripción.',
                  nivel: 'ALTO',
                  texto:
                    'El plazo genérico es de cinco años (art. 2560 CCyC), pero lo que se devenga por años o por plazos periódicos más cortos prescribe a los dos años, salvo el reintegro de un capital en cuotas (art. 2562 inc. c). El cómputo empieza cuando cada prestación es exigible (art. 2554). La interpelación fehaciente suspende el curso por una sola vez y durante seis meses (art. 2541), la mediación también lo suspende (art. 2542) y el reconocimiento del deudor y la petición judicial lo interrumpen (arts. 2545 y 2546).',
                },
                {
                  lead: 'Tarjetas de crédito.',
                  nivel: 'MEDIO',
                  texto:
                    'La Ley 25.065 sigue vigente con los cambios del DNU 70/2023, que derogó los arts. 5, 7, 8, 9, 17, 32, 35, 53 y 54 y los incisos c) y e) del art. 14, y sustituyó los arts. 1, 2 inc. a), 4, 15, 18, 22, 25 y 38. Se mantiene la impugnación del resumen. El titular puede cuestionar la liquidación dentro de los 30 días de recibida y el emisor debe acusar recibo en 7 días y corregir o explicar en 15, o en 60 si la operación se hizo en el exterior (arts. 26 a 29). El emisor es ajeno a las controversias entre el titular y el comercio, salvo excepciones (art. 43). Los contracargos que tramitan por las reglas de las redes y de la pasarela tienen sus propios plazos.',
                },
                {
                  lead: 'Informes crediticios.',
                  nivel: 'MEDIO',
                  texto:
                    'Pueden tratarse datos sobre el cumplimiento o incumplimiento de obligaciones patrimoniales facilitados por el acreedor, y solo se archivan o ceden los significativos de los últimos cinco años, plazo que se reduce a dos cuando el deudor cancela la obligación, lo que debe constar (art. 26 Ley 25.326). Informar una deuda inexistente, discutida o ya pagada expone a reclamos por daños, por eso lo decide legales y nunca se usa como amenaza.',
                },
                {
                  lead: 'Datos del deudor frente a terceros.',
                  nivel: 'ALTO',
                  texto:
                    'La deuda es un dato personal. Comunicarla a familiares, empleadores o en redes puede violar el deber de confidencialidad (art. 10 Ley 25.326) y la protección de la vida privada (art. 1770 CCyC), además del trato digno.',
                },
                {
                  lead: 'Mediación prejudicial.',
                  nivel: 'BAJO',
                  texto:
                    'Ante la justicia nacional de la Ciudad de Buenos Aires rige la mediación previa obligatoria de la Ley 26.589, que en los procesos de ejecución es optativa para quien reclama. Las provincias tienen sus propios regímenes, como la Ley 13.951 en la Provincia de Buenos Aires. Con consumidores, el juez competente es el del domicilio del consumidor.',
                },
                {
                  lead: 'Carta documento.',
                  nivel: 'BAJO',
                  texto:
                    'No hace falta para constituir en mora cuando el vencimiento es cierto, pero sirve como interpelación fehaciente que suspende la prescripción, como emplazamiento para resolver el contrato y como prueba de la fecha del reclamo. Se redacta sin apariencia judicial.',
                },
                {
                  lead: 'Insolvencia y fallecimiento.',
                  nivel: 'MEDIO',
                  texto:
                    'Si el cliente se presenta en concurso o quiebra, el crédito se reclama en ese proceso según la Ley 24.522 y los pagos directos de deudas anteriores pueden ser ineficaces. Si fallece, la deuda se reclama en la sucesión y el heredero responde solo hasta el valor de los bienes que recibe (art. 2317 CCyC).',
                },
              ],
            },
            {
              id: 'es',
              titulo: 'España',
              bajada: 'Ley 3/2004 de morosidad, Código Civil, Ley de Enjuiciamiento Civil, LOPDGDD, Real Decreto-ley 19/2018 de servicios de pago y Ley de Competencia Desleal.',
              items: [
                {
                  lead: 'Morosidad entre empresas.',
                  nivel: 'MEDIO',
                  texto:
                    'La Ley 3/2004 se aplica a las operaciones comerciales entre empresas o con la Administración y excluye a los consumidores (art. 3). Fija un plazo de pago de 30 días que por pacto puede llegar a 60 (art. 4), el devengo automático del interés de demora sin necesidad de intimación (art. 5), un tipo legal supletorio igual al del Banco Central Europeo más ocho puntos (art. 7) y una indemnización fija de 40 euros por costes de cobro, más los costes acreditados que la superen (art. 8). Las cláusulas abusivas en perjuicio del acreedor son nulas (art. 9).',
                },
                {
                  lead: 'Mora con consumidores.',
                  nivel: 'MEDIO',
                  texto:
                    'Fuera de la Ley 3/2004, el deudor incurre en mora desde que el acreedor le exige el cumplimiento, judicial o extrajudicialmente, salvo que el contrato o la ley la declaren automática (art. 1100 CC). Sin pacto se debe el interés legal del dinero (art. 1108 CC). La indemnización desproporcionadamente alta a cargo del consumidor que no cumple es abusiva (art. 85.6 TRLGDCU).',
                },
                {
                  lead: 'Proceso monitorio.',
                  nivel: 'BAJO',
                  texto:
                    'Sirve para reclamar deudas dinerarias vencidas, exigibles y de cantidad determinada (art. 812 LEC). La petición inicial no requiere abogado ni procurador (art. 814), el deudor es requerido para pagar u oponerse en veinte días (art. 815) y, si no comparece, se dicta una resolución que habilita la ejecución (art. 816). Si la deuda nace de un contrato con un consumidor, el tribunal controla las cláusulas abusivas antes de requerir el pago (art. 815.4).',
                },
                {
                  lead: 'Ficheros de morosos.',
                  nivel: 'ALTO',
                  texto:
                    'Incluir a un deudor en un sistema de información crediticia exige una deuda cierta, vencida y exigible cuya existencia o cuantía no esté discutida por el deudor ante una autoridad o un procedimiento vinculante, que el acreedor le haya informado esa posibilidad en el contrato o al requerir el pago, y que los datos se mantengan solo mientras dure el impago, con un máximo de cinco años (art. 20 LOPDGDD). La inclusión indebida expone a sanciones y a reclamos por intromisión en el honor.',
                },
                {
                  lead: 'Devoluciones de pagos.',
                  nivel: 'MEDIO',
                  texto:
                    'Según el Real Decreto-ley 19/2018, el usuario puede pedir la rectificación de operaciones no autorizadas o mal ejecutadas hasta trece meses después del cargo y, en los adeudos domiciliados, la devolución dentro de las ocho semanas siguientes. Los contracargos de tarjeta por desacuerdo con el servicio se rigen además por las reglas de la red y por el contrato con la pasarela.',
                },
                {
                  lead: 'Prácticas de cobro agresivas.',
                  nivel: 'ALTO',
                  texto:
                    'Es desleal el acoso, la coacción y la amenaza de acciones que legalmente no pueden ejercerse (art. 8 de la Ley 3/1991, de Competencia Desleal). Revelar la deuda a familiares, vecinos o empleadores es un tratamiento ilícito de datos personales (RGPD y LOPDGDD) y exponer públicamente al deudor puede lesionar su honor (Ley Orgánica 1/1982). El acoso reiterado puede tener relevancia penal (art. 172 ter CP).',
                },
                {
                  lead: 'Prescripción.',
                  nivel: 'MEDIO',
                  texto:
                    'Las acciones personales sin plazo especial prescriben a los cinco años desde que puede exigirse el cumplimiento (art. 1964.2 CC). La prescripción se interrumpe por la reclamación extrajudicial del acreedor, como un burofax, y por el reconocimiento de la deuda (art. 1973 CC). Algunos servicios y ventas tienen plazos especiales más cortos (art. 1967 CC).',
                },
              ],
            },
            {
              id: 'ajustes',
              titulo: 'Ajustes sugeridos a los contratos',
              bajada: 'Lo que conviene revisar en los modelos y en el proceso de cobro para que el protocolo tenga respaldo.',
              items: [
                {
                  lead: 'Cláusula de mora e intereses.',
                  nivel: 'ALTO',
                  texto:
                    'Fechas de vencimiento ciertas, mora automática expresa, tasa anual de interés moratorio clara y razonable, sin capitalización. Si se pactan punitorios, que no se superpongan con otras penalidades por el mismo atraso.',
                },
                {
                  lead: 'Suspensión del servicio.',
                  nivel: 'MEDIO',
                  texto: 'Prever la suspensión del acceso por mora, desde qué día, con qué aviso previo, qué alcanza y cómo se reactiva. Sin cláusula, la suspensión queda expuesta a discusión.',
                },
                {
                  lead: 'Gastos de cobranza razonables.',
                  nivel: 'MEDIO',
                  texto:
                    'Si se cobran gastos de gestión, que sean razonables, estén informados antes de contratar y respondan a costos reales. Con consumidores, un cargo automático o desproporcionado puede ser abusivo. Entre empresas en España, la Ley 3/2004 ya fija la indemnización mínima.',
                },
                {
                  lead: 'Aceptación de condiciones en el pago.',
                  nivel: 'ALTO',
                  texto:
                    'Que el pago no se pueda completar sin aceptar el contrato o las condiciones, la política de cancelación y la autorización de los cargos automáticos, y que quede constancia de fecha, hora y medio de aceptación. Es la pieza central de cualquier disputa.',
                },
                {
                  lead: 'Conservación de la evidencia.',
                  nivel: 'MEDIO',
                  texto:
                    'Definir qué se conserva, dónde y por cuánto tiempo, accesos, sesiones, entregables, comunicaciones y aceptaciones, con un plazo que cubra la prescripción y respete la normativa de datos personales.',
                },
                {
                  lead: 'Acuerdos de pago.',
                  nivel: 'MEDIO',
                  texto: 'Un modelo con reconocimiento de deuda, caducidad de plazos por falta de pago y aclaración de que no hay novación, para que el equipo no improvise.',
                },
                {
                  lead: 'Nombre de cobro y avisos.',
                  nivel: 'BAJO',
                  texto: 'Configurar en {pasarela} un nombre de cobro que el cliente reconozca e informar en el contrato cómo figura el cargo en su resumen.',
                },
                {
                  lead: 'Informes crediticios.',
                  nivel: 'BAJO',
                  texto: 'Si se va a informar a sistemas de deudores, prever esa posibilidad en el contrato y avisarla al requerir el pago. En España es una condición del art. 20 LOPDGDD.',
                },
              ],
            },
            {
              id: 'dudas',
              titulo: 'Zonas de duda',
              bajada: 'Puntos donde la interpretación no es pacífica. Se deciden caso por caso con legales.',
              items: [
                {
                  lead: 'Pagaré en relaciones de consumo.',
                  texto:
                    'Firmar un pagaré junto con un contrato de consumo es discutido. Hay fallos que exigen integrarlo con el contrato y con la información del art. 36 LDC antes de ejecutarlo y otros más flexibles, y la competencia es la del domicilio del consumidor. No se usa como herramienta de cobro sin análisis previo.',
                },
                {
                  lead: 'Plazo de prescripción de las cuotas.',
                  texto: 'Si las cuotas de un programa prescriben a los dos años por devengarse en forma periódica (art. 2562 inc. c CCyC) o a los cinco del plazo genérico es discutible. Por prudencia se gestiona con el más corto.',
                },
                {
                  lead: 'Deuda después de un contracargo perdido.',
                  texto:
                    'Perder la disputa no extingue por sí la obligación del cliente, pero reclamarla después, sobre todo a un consumidor, exige analizar el motivo de la disputa y el riesgo de un reclamo cruzado.',
                },
                {
                  lead: 'Suspensión sin cláusula expresa.',
                  texto: 'Fundar la suspensión del servicio por mora solo en el art. 1031 CCyC es discutible cuando el cliente ya pagó por adelantado parte del programa.',
                },
                {
                  lead: 'Moneda extranjera y consumo.',
                  texto: 'Se discute si la regla de los arts. 765 y 766 CCyC, con el texto del DNU 70/2023, se aplica plenamente a los contratos de consumo y a los celebrados antes del decreto.',
                },
                {
                  lead: 'Intereses y gastos razonables.',
                  texto: 'No hay un tope fijo. Lo razonable o lo desproporcionado depende del tribunal y del caso, tanto en Argentina (art. 771 CCyC) como en España (art. 85.6 TRLGDCU).',
                },
                {
                  lead: 'Medios adecuados de solución de controversias en España.',
                  texto:
                    'La Ley Orgánica 1/2025 exige, como regla, intentar un medio adecuado de solución de controversias antes de demandar. Su aplicación al monitorio y al juicio que sigue a la oposición se interpreta de forma dispar.',
                },
                {
                  lead: 'Reforma de datos personales en Argentina.',
                  texto: 'Hay un proyecto de reforma integral del régimen de datos personales en el Congreso. Si se aprueba, pueden cambiar las reglas sobre informes crediticios del art. 26 de la Ley 25.326.',
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
              rotulo: 'Cinco principios',
              numerada: true,
              lista: ['Cobrar es parte del servicio.', 'Recordar antes de reclamar.', 'Firmes en el fondo, amables en la forma.', 'Nunca con apariencia de juicio.', 'Todo contracargo se contesta con prueba.'],
            },
            {
              rotulo: 'La secuencia',
              numerada: true,
              lista: [
                'Antes del vencimiento, recordatorio.',
                'El día del vencimiento, aviso y conciliación.',
                'Del día 1 al 15, contacto personal.',
                'Del día 16 al 30, plan o nueva fecha.',
                'Del día 31 al 60, intimación de legales.',
                'Desde el día 61, acuerdo, gestión legal o incobrable.',
              ],
            },
            {
              rotulo: 'Tres nunca',
              tono: 'nunca',
              lista: ['Nunca simules un juicio ni anuncies lo que no se va a hacer.', 'Nunca cuentes la deuda a terceros ni la expongas.', 'Nunca dejes vencer el plazo de una disputa.'],
            },
            [
              { rotulo: 'Si pide la baja o una devolución', texto: 'Frená la cobranza y pasá por la compuerta legal del protocolo de conflictos.' },
              { rotulo: 'Siempre', texto: 'Monto exacto, fecha concreta y todo por escrito en {canal}.' },
            ],
          ],
        },
      ],
    },
  ];
}

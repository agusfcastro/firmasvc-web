// Contenido del protocolo de conflictos y pedidos de reembolso.
// Regla de estilo de FIRMA para estos textos, sin rayas ni dos puntos.

import { formatearMonto, monedaDe, opcion } from '../motor/ficha';
import type { Ficha, Nivel, ResultadoSemaforo, Seccion } from '../motor/tipos';
import { numeroDe } from './ficha';

// Compuerta legal

function evaluarCompuerta(r: Record<string, string>, f: Ficha): ResultadoSemaforo | null {
  if (!r.perfil || !r.plazo || !r.informado || !r.formal) return null;
  const consumidor = r.perfil !== 'empresa';
  const dentro = r.plazo !== 'fuera';
  const noInformado = r.informado !== 'si';
  const formal = r.formal !== 'no';
  const espana = opcion(f, 'mercado') === 'ES';
  const pasos: string[] = [];
  let nivel: Nivel = 'verde';
  let titulo = 'Vía de gestión. Seguí el recorrido por etapas.';

  if (consumidor && (dentro || noInformado)) {
    nivel = 'rojo';
    titulo = 'Posible arrepentimiento legal. Ese derecho no se negocia ni se condiciona.';
    pasos.push('Derivar el caso a legales en el día, con el contrato firmado, la fecha de contratación y el mensaje del cliente.');
    pasos.push('No ofrecer alternativas como condición ni pedir confidencialidad. Si el cliente quiere una alternativa, se ofrece después de confirmarle su derecho.');
    pasos.push('Legales confirma el encuadre y, si corresponde, tramita la devolución dentro del plazo legal y por el mismo medio de pago.');
    if (r.perfil === 'duda') pasos.push('El perfil es dudoso. Hasta que legales lo defina, se trata como consumidor.');
    if (noInformado) {
      pasos.push(
        'Si el derecho no se informó en forma destacada antes de la firma, en Argentina el plazo no vence (art. 1111 CCyC) y en España se extiende hasta doce meses (art. 105 TRLGDCU).',
      );
    }
    if (espana) {
      pasos.push('En España, si el servicio empezó durante el plazo a pedido expreso del cliente, puede corresponder un pago proporcional por lo ya prestado (art. 108 TRLGDCU). Lo calcula legales.');
    }
  }

  if (formal) {
    if (nivel === 'verde') {
      nivel = 'ambar';
      titulo = 'Plazo formal en curso. Se responde dentro del plazo, sin regla de enfriamiento.';
    }
    if (r.formal === 'contracargo') pasos.push('Avisar a legales y a administración hoy. Armar el expediente y responder la disputa con prueba dentro del plazo que fija {pasarela}.');
    if (r.formal === 'carta') pasos.push('Registrar la fecha de recepción, escanear la pieza y derivar a legales hoy. El silencio frente a un reclamo formal juega en contra.');
    if (r.formal === 'boton') pasos.push('En Argentina, informar al cliente el código de la solicitud dentro de las 24 horas por el mismo medio (Disposición 954/2025).');
  }

  if (nivel === 'verde') {
    pasos.push('Aplicar la secuencia de disconformidad, que es contener, diagnosticar y ofrecer alternativas dentro del contrato.');
    pasos.push('Confirmar todo por escrito en {canal}.');
    pasos.push('Si aparece cualquier disparador de derivación, el caso pasa a legales en el día.');
  }

  return { nivel, titulo, pasos };
}

// Calculadora de negociación

function n0(v: number | null): number {
  return v ?? 0;
}

function costoRechazo(v: Record<string, number | null>): number | null {
  if (v.reclamo === null) return null;
  return (n0(v.pPerder) / 100) * n0(v.reclamo) + n0(v.defensa) + n0(v.horas) * n0(v.valorHora) + (n0(v.pDifusion) / 100) * n0(v.dano);
}

function maximoConceder(v: Record<string, number | null>): number | null {
  const c = costoRechazo(v);
  if (c === null || v.reclamo === null) return null;
  return Math.min(c, v.reclamo);
}

// Secciones

export function secciones(f: Ficha): Seccion[] {
  const diasRespuesta = numeroDe(f, 'diasRespuesta', 3);
  const vigencia = numeroDe(f, 'vigencia', 5);
  const moneda = (n: number) => formatearMonto(monedaDe(f), n) ?? String(Math.round(n));

  return [
    {
      id: 'uso',
      titulo: 'Cómo usar este protocolo',
      corto: 'Cómo usarlo',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Este protocolo ordena cómo se previenen, se contienen y se gestionan los pedidos de reembolso de {empresa}, desde la primera señal de insatisfacción hasta una eventual difusión pública. Los datos del negocio se completan una vez en la ficha y se actualizan solos en todas las plantillas.',
        },
        {
          tipo: 'parrafo',
          texto:
            'El objetivo es triple. Que haya menos reclamos porque se previenen, que la mayoría se resuelva sin intervención legal y que, cuando legales intervenga, lo haga con una posición documental sólida y un solo canal.',
        },
        { tipo: 'leyenda' },
        {
          tipo: 'roles',
          items: [
            { rol: 'Comercial', foco: 'Prevención en la venta, confirmación por escrito y coherencia con el contrato.' },
            { rol: 'Acompañamiento', foco: 'Constancias durante la prestación, contención, diagnóstico y alternativas.' },
            { rol: 'Legales', foco: 'Compuerta legal, evaluación de riesgo, respuestas formales y difusión pública.' },
            { rol: 'Dirección', foco: 'Matriz de autorizaciones, decisiones por encima de los topes y tablero de indicadores.' },
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'No hay dos conflictos iguales. El protocolo mejora con cada caso cerrado, así que cada cierre deja su causa registrada en el tablero.',
        },
      ],
    },
    {
      id: 'ficha',
      titulo: 'Ficha del negocio',
      corto: 'Ficha del negocio',
      intro: 'Se completa una sola vez por negocio. Las plantillas, la matriz y la calculadora se actualizan solas.',
      bloques: [{ tipo: 'ficha' }],
    },
    {
      id: 'principios',
      titulo: 'Cinco principios',
      corto: 'Principios',
      intro: 'Valen en cualquier etapa del conflicto. Si el equipo recuerda solo esto, ya evita la mayoría de los errores.',
      bloques: [
        {
          tipo: 'reglas',
          items: [
            {
              titulo: 'Una sola voz.',
              texto:
                'En cada etapa hay un único responsable de responder. Nadie más contesta, ni siquiera para aclarar algo rápido. Dos respuestas de dos personas nunca dicen exactamente lo mismo, y esa diferencia es la grieta que el cliente usa después.',
            },
            {
              titulo: 'Por escrito o no existe.',
              texto:
                'Cada interacción relevante se confirma por escrito en {canal}. En el momento parece burocracia. Seis meses después es la única prueba disponible.',
            },
            {
              titulo: 'Nunca en caliente.',
              texto:
                'Ninguna respuesta a un cliente en conflicto sale antes de {horas} ni sin una segunda lectura. Quien controla el ritmo controla la negociación. La excepción son los plazos formales, que se respetan siempre.',
            },
            {
              titulo: 'Nada de reconocimientos implícitos.',
              texto:
                'No se piden disculpas por la prestación ni se admiten demoras o deficiencias. Se puede lamentar la experiencia del cliente sin validar el reclamo, corriendo el eje del hecho a la experiencia.',
            },
            {
              titulo: 'El reembolso es una decisión de riesgo, no un debate de razones.',
              texto:
                'Legales pondera costo de litigio, exposición reputacional y precedente. Tener razón contractual no siempre significa que rechazar sea lo mejor para el negocio. La única excepción es la devolución que impone la ley, que no se negocia.',
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Cómo se ve en la práctica' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Una sola voz',
              texto: 'El cliente ya derivado le escribe por privado al encargado de su cuenta. La respuesta correcta no explica, no opina y no consuela. Es una sola línea.',
              cita: 'Entiendo tu situación, pero este tema lo está manejando legales y todo pasa por el correo. Ahí te van a responder.',
            },
            {
              titulo: 'Por escrito o no existe',
              texto: 'Terminó una llamada en la que el cliente aceptó reprogramar. Antes de cerrar el día sale este mensaje por el canal oficial.',
              cita: 'Como hablamos recién por teléfono, te confirmo que reprogramamos las sesiones de [[fechas]] para [[fechas nuevas]]. Avisame si entendí algo mal.',
            },
            {
              titulo: 'Nunca en caliente',
              texto:
                'El cliente manda tres mensajes en doce minutos, cada uno con más tono y un plazo de 24 horas. No se responde ninguno todavía. Se deja terminar la ráfaga, se redacta una única respuesta que conteste todo, otra persona la revisa y sale al día siguiente. El silencio de unas horas no es debilidad, es control del ritmo.',
            },
            {
              titulo: 'Del hecho a la experiencia',
              texto: 'En lugar de una disculpa que admite una demora, se reconoce la vivencia del cliente y se deja constancia del dato.',
              cita: 'Lamentamos que hayas sentido que la respuesta tardó. Revisamos el canal y tu consulta fue respondida dentro de los plazos previstos.',
            },
          ],
        },
      ],
    },
    {
      id: 'compuerta',
      titulo: 'Compuerta legal',
      corto: 'Compuerta legal',
      intro:
        'Antes de responder cualquier pedido de devolución, cuatro preguntas definen la vía. Si la ley le da al cliente un derecho, ese derecho no se negocia ni se condiciona.',
      bloques: [
        {
          tipo: 'semaforo',
          id: 'compuerta',
          titulo: 'Las cuatro preguntas',
          preguntas: [
            {
              id: 'perfil',
              texto: '¿Quién contrató?',
              ayuda: 'Importa para qué contrató, no lo que diga el contrato.',
              opciones: [
                { valor: 'empresa', rotulo: 'Empresa o profesional para su actividad' },
                { valor: 'consumidor', rotulo: 'Persona para uso personal' },
                { valor: 'duda', rotulo: 'No está claro' },
              ],
            },
            {
              id: 'plazo',
              texto: '¿El pedido llegó dentro del plazo legal de arrepentimiento?',
              ayuda: 'En {mercadoTexto} el plazo es {dias}.',
              opciones: [
                { valor: 'dentro', rotulo: 'Sí, dentro del plazo' },
                { valor: 'fuera', rotulo: 'No, fuera del plazo' },
                { valor: 'nose', rotulo: 'No lo sé' },
              ],
            },
            {
              id: 'informado',
              texto: '¿El contrato informó ese derecho en forma destacada antes de la firma?',
              opciones: [
                { valor: 'si', rotulo: 'Sí' },
                { valor: 'no', rotulo: 'No' },
                { valor: 'nose', rotulo: 'No lo sé' },
              ],
            },
            {
              id: 'formal',
              texto: '¿Hay un plazo formal corriendo?',
              opciones: [
                { valor: 'no', rotulo: 'No' },
                { valor: 'contracargo', rotulo: 'Contracargo o disputa' },
                { valor: 'carta', rotulo: 'Carta documento, citación o reclamo ante un organismo' },
                { valor: 'boton', rotulo: 'Pedido por el botón de arrepentimiento o de baja' },
              ],
            },
          ],
          evaluar: evaluarCompuerta,
        },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Qué cambia con un consumidor',
              lista: [
                'Puede arrepentirse dentro de {plazoLegal} sin dar motivos ({normaRevocacion}).',
                'Si el contrato no informó ese derecho en forma destacada antes de la firma, en Argentina el plazo no vence y en España se extiende hasta doce meses.',
                'La devolución no se condiciona a confidencialidad, a no publicar opiniones ni a aceptar alternativas.',
                'Ser consumidor no depende de lo que diga el contrato sino de para qué contrató.',
              ],
            },
            {
              titulo: 'Plazos formales que no esperan',
              lista: [
                'Contracargo o disputa ante la tarjeta o el banco. Se responde con prueba dentro del plazo que fija {pasarela}.',
                'Carta documento, intimación formal o citación a una audiencia de conciliación.',
                'Reclamo ante {organismo}.',
                'Pedido por el botón de arrepentimiento o de baja. En Argentina, el código de la solicitud se informa dentro de las 24 horas.',
              ],
            },
          ],
        },
        { tipo: 'aclaracion', texto: 'Si alguna respuesta es dudosa, se trata como afirmativa hasta que legales diga lo contrario.' },
      ],
    },
    {
      id: 'etapas',
      titulo: 'El recorrido en seis etapas',
      corto: 'Seis etapas',
      intro: 'Cada etapa tiene responsable, plazo y objetivo. El paso de una a otra queda registrado en el expediente.',
      bloques: [
        {
          tipo: 'etapas',
          items: [
            {
              titulo: 'En la venta',
              cuando: 'Responsable equipo comercial · Antes del pago',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que lo prometido coincida con lo contratado y quede por escrito.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Contrato disponible antes de la firma, mensaje de confirmación posterior a la llamada con respuesta del cliente y registro de la finalidad profesional cuando la hay. Las llamadas se revisan para corregir a quien promete de más.',
                },
                { rotulo: 'Frase ancla', texto: 'Te confirmo por escrito lo conversado y te adjunto el contrato completo para que lo leas con tiempo.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Prometer algo que el contrato no incluye, o cobrar sin que el cliente haya podido leer las condiciones.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Durante la prestación',
              cuando: 'Responsable {respAcomp} · Todo el programa',
              datos: [
                { rotulo: 'Objetivo', texto: 'Construir la prueba mientras todo está bien.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Cada hito se confirma en {canal}, se pide feedback por escrito, las demoras se avisan antes de que el cliente las note y la inactividad se contacta de forma proactiva.',
                },
                { rotulo: 'Frase ancla', texto: 'Dejamos registrado que hoy completamos [[hito]]. Los próximos pasos acordados son [[pasos]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Dejar pasar semanas sin registro de lo entregado y enterarse de la insatisfacción por un reclamo.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Disconformidad',
              cuando: 'Responsable {respAcomp} · Primera respuesta dentro de las 24 horas',
              datos: [
                { rotulo: 'Objetivo', texto: 'Retener y resolver dentro del contrato.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Contener sin improvisar. Diagnosticar si el planteo está dentro o fuera del alcance y cuál es el interés detrás del pedido. Ofrecer alternativas por escrito y registrar la aceptación o el rechazo.',
                },
                { rotulo: 'Frase ancla', texto: 'Queremos revisarlo bien antes de responderte. Te escribimos el [[día]] con una propuesta concreta.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Resolver en caliente, prometer una solución sin consultar o discutir quién tiene razón.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Derivación a legales',
              cuando: 'Responsables {respAcomp} y {respLegales} · El mismo día del disparador',
              datos: [
                { rotulo: 'Objetivo', texto: 'Cambiar de canal y de voz sin perder información.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Resumen del caso con cronología, contrato, constancias e intercambios. Un único mensaje al cliente informando el traspaso al correo. Desde ahí nadie fuera de legales responde sobre el reclamo, por ningún canal.',
                },
                { rotulo: 'Frase ancla', texto: 'Tu solicitud fue derivada a nuestro equipo de legales, que te va a responder por correo.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Seguir respondiendo por chat después del traspaso, aunque sea para calmar.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Respuesta legal',
              cuando: 'Responsable {respLegales} · Acuse en 24 horas y respuesta en {diasRespuesta}',
              datos: [
                { rotulo: 'Objetivo', texto: 'Decidir con números y responder una sola vez, bien.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Compuerta legal, evaluación de riesgo por escrito con MAAN y ZOPA, decisión según la matriz de autorizaciones y una sola respuesta, sea un rechazo con su arquitectura completa o una propuesta transaccional única.',
                },
                {
                  rotulo: 'Frase ancla',
                  texto: 'Sin que ello importe reconocimiento de hecho ni de derecho alguno, y con el exclusivo propósito de concluir la relación de manera ordenada.',
                  estilo: 'frase',
                },
                { rotulo: 'Error típico', texto: 'Negociar por goteo, mandar varias respuestas parciales o regatear desde una oferta improvisada.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Difusión pública',
              cuando: 'Responsable {respLegales} · Desde el anuncio o la publicación',
              datos: [
                { rotulo: 'Objetivo', texto: 'Proteger la reputación por canales formales y sin escalar.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Constancia formal del anuncio, preservación de evidencia, clasificación de cada publicación como opinión o como imputación de hechos falsos, intimación solo por estas últimas y carta documento si persiste.',
                },
                { rotulo: 'Frase ancla', texto: 'Su mensaje fue registrado y conservado, con expresa reserva de las acciones que pudieran corresponder.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Responder en redes, contestar la amenaza con otra amenaza o cambiar la decisión de fondo por presión.', estilo: 'error' },
              ],
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Las cuatro reglas de la respuesta legal' },
        {
          tipo: 'tips',
          items: [
            { titulo: 'Segunda lectura', texto: 'Ninguna respuesta sale sin que otra persona la lea. Un error de tipeo en una comunicación legal queda como evidencia permanente.' },
            { titulo: 'Una por día hábil', texto: 'Máximo una respuesta por día hábil al mismo reclamante, salvo plazos formales. Los intercambios cada cinco minutos escalan el tono.' },
            {
              titulo: 'Suma o cierra',
              texto: 'Cada respuesta agrega algo o cierra la instancia. Si el cliente repite lo ya contestado, alcanza con una línea que remite a la comunicación anterior.',
            },
            { titulo: 'Tono sereno', texto: 'Cuanto más agresivo el cliente, más neutra la respuesta. Cada correo puede terminar leído por un tercero.' },
          ],
        },
        { tipo: 'subtitulo', texto: 'Arquitectura de la respuesta de rechazo' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Seis partes, en este orden',
              numerada: true,
              lista: [
                '**Identificación** del reclamo y anuncio de la decisión.',
                '**Encuadre contractual**, con fecha y modalidad de firma, validación electrónica y disponibilidad previa del texto.',
                '**Prestación efectiva**, con el detalle de lo puesto a disposición y remisión a las constancias.',
                '**Responsabilidades del cliente** según el contrato, cuando aplique.',
                '**Alternativas ofrecidas** de buena voluntad y su rechazo, aclarando que no importan reconocimiento de deficiencia.',
                '**Conclusión y reserva de derechos**, dejando constancia de que la respuesta no importa reconocimiento de hecho ni de derecho.',
              ],
            },
            {
              titulo: 'Antes de enviarla',
              check: true,
              lista: [
                'La compuerta legal está registrada y no dio rojo.',
                'La evaluación de riesgo está escrita y firmada por legales.',
                'Se adjunta de una vez la copia del contrato firmado con su constancia de integridad.',
                'La respuesta salió de {correoLegales} y quedó en el expediente.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'negociacion',
      titulo: 'Marco de negociación',
      corto: 'Negociación',
      intro:
        'Quien responde a un cliente en conflicto maneja cuatro ideas del Proyecto de Negociación de Harvard y de la práctica de mediación. Son la base racional de cada decisión de legales.',
      bloques: [
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Posiciones e intereses',
              texto:
                'La posición es lo que el cliente pide. El interés es lo que hay detrás. Recuperar dinero, sí, pero muchas veces también sentirse escuchado, no quedar mal frente a un socio o salir de un programa que le quedó grande. Negociar sobre posiciones lleva al empate de devolver o no devolver. Negociar sobre intereses abre alternativas.',
              lista: [
                'Reasignación del equipo de acompañamiento.',
                'Extensión del plazo del servicio.',
                'Pausa o congelamiento acordado.',
                'Conversión del saldo en otro producto.',
                'Plan de salida ordenada.',
              ],
            },
            {
              titulo: 'MAAN, la mejor alternativa a un acuerdo negociado',
              texto: 'Formulado por Roger Fisher y William Ury, responde una pregunta. Si esta negociación fracasa, qué es lo mejor que cada parte puede hacer por su cuenta.',
              leads: [
                {
                  lead: 'Es el piso.',
                  texto: 'Nunca se acepta un acuerdo peor que el propio MAAN. Si el conflicto público va a costar más que el reembolso, el reembolso deja de ser una derrota y pasa a ser la jugada racional.',
                },
                { lead: 'Es la fuente del poder.', texto: 'El poder en la mesa no depende de quién grita más, sino de quién puede irse con menos daño.' },
                {
                  lead: 'Se trabaja.',
                  texto:
                    'Cada cláusula bien redactada, cada constancia de prestación y cada feedback positivo archivado mejoran el MAAN propio. Cada intimación documentada deteriora el de quien presiona con difamación.',
                },
              ],
            },
            {
              titulo: 'ZOPA, la zona de posible acuerdo',
              texto:
                'Es el espacio entre lo mínimo que aceptaría el cliente y lo máximo que la empresa concedería según su MAAN. Si ese espacio no existe, no tiene sentido simular una negociación y la respuesta es un rechazo documentado. La escalada destruye la zona de acuerdo, por eso las reglas de tono y de ritmo la preservan.',
            },
            {
              titulo: 'Anclaje y diseño de la concesión',
              texto:
                'La primera cifra condiciona todo lo que sigue. Si la empresa ofrece algo, la oferta es deliberada, fundada y excepcional, nunca el punto de partida de un regateo.',
              leads: [
                { lead: 'Una sola vez.', texto: 'Por escrito y como gesto de buena voluntad, sin reconocimiento de hechos ni de derecho.' },
                { lead: 'Con contrapartida.', texto: 'Condicionada a un acuerdo con confidencialidad y abstención recíproca de manifestaciones públicas.' },
                { lead: 'Sin goteo.', texto: 'Una concesión sin contrapartida documentada no compra paz, compra la siguiente exigencia.' },
              ],
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Errores típicos con el MAAN' },
        {
          tipo: 'tips',
          items: [
            { titulo: 'Sobreestimar el propio', texto: 'Por optimismo o por orgullo. Se mide con la documentación en la mano, no con la convicción.' },
            { titulo: 'Confundirlo con la posición', texto: 'No devolver nunca no es un MAAN, es un dogma.' },
            {
              titulo: 'Medir el ajeno por lo que dice',
              texto: 'Se evalúa por lo que al cliente le conviene y puede hacer. Quien amenaza con todas las acciones en 24 horas casi nunca tiene un MAAN a la altura de su amenaza.',
            },
          ],
        },
        {
          tipo: 'calculadora',
          id: 'maan',
          titulo: 'Calculadora de MAAN y ZOPA',
          intro:
            'Compara el costo esperado de sostener el rechazo con lo que pide el cliente y marca si hay zona de acuerdo. Los montos se expresan en la moneda de la ficha.',
          entradas: [
            { id: 'reclamo', rotulo: 'Monto reclamado', unidad: 'moneda', ayuda: 'Lo que el cliente pide hoy.' },
            { id: 'minimo', rotulo: 'Mínimo que aceptaría el cliente', unidad: 'moneda', ayuda: 'Estimación de legales según su interés real.' },
            { id: 'pPerder', rotulo: 'Probabilidad de perder si escala', unidad: '%', ayuda: 'Contracargo, reclamo o juicio, mirando el expediente.' },
            { id: 'defensa', rotulo: 'Costo de defensa', unidad: 'moneda', ayuda: 'Honorarios, tasas y gestión.' },
            { id: 'horas', rotulo: 'Horas del equipo', unidad: 'horas', ayuda: 'Tiempo total si el conflicto sigue.' },
            { id: 'valorHora', rotulo: 'Valor de la hora', unidad: 'moneda' },
            { id: 'pDifusion', rotulo: 'Probabilidad de difusión pública', unidad: '%' },
            { id: 'dano', rotulo: 'Impacto si se difunde', unidad: 'moneda', ayuda: 'Por ejemplo, ventas que se perderían en los próximos meses.' },
          ],
          salidas: [
            { id: 'costo', rotulo: 'Costo esperado de sostener el rechazo', formato: 'monto', destacada: true, calcular: (v) => costoRechazo(v) },
            { id: 'maximo', rotulo: 'Máximo razonable a conceder', formato: 'monto', calcular: (v) => maximoConceder(v), ayuda: 'Conceder más que esto es peor que el MAAN propio.' },
            {
              id: 'zona',
              rotulo: 'Amplitud de la zona de acuerdo',
              formato: 'monto',
              ayuda: 'Cero significa que no hay zona de acuerdo.',
              calcular: (v) => {
                const max = maximoConceder(v);
                if (max === null || v.minimo === null) return null;
                return Math.max(0, max - v.minimo);
              },
            },
            {
              id: 'ancla',
              rotulo: 'Oferta única sugerida',
              formato: 'monto',
              ayuda: 'Orientativa. Se fija una sola vez.',
              calcular: (v) => {
                const max = maximoConceder(v);
                if (max === null || v.minimo === null || v.minimo > max) return null;
                return v.minimo + (max - v.minimo) * 0.25;
              },
            },
          ],
          barra: (v, r) => {
            if (v.reclamo === null || v.minimo === null || r.maximo === null) return null;
            const tope = Math.max(v.reclamo, r.costo ?? 0, v.minimo) * 1.08 || 1;
            const marcas = [{ valor: v.minimo, rotulo: 'Mínimo estimado del cliente' }];
            if (r.ancla !== null) marcas.push({ valor: r.ancla, rotulo: 'Oferta única sugerida' });
            marcas.push({ valor: r.maximo, rotulo: 'Máximo razonable a conceder' });
            marcas.push({ valor: v.reclamo, rotulo: 'Monto reclamado' });
            return {
              min: 0,
              max: tope,
              zona: v.minimo <= r.maximo ? [v.minimo, r.maximo] : undefined,
              marcas,
            };
          },
          conclusion: (v, r) => {
            if (v.reclamo === null) return null;
            const aviso = ' Si la compuerta legal dio rojo, esta calculadora no aplica.';
            if (v.minimo === null) return { nivel: 'info', texto: `Cargá el mínimo estimado del cliente para ver si hay zona de acuerdo.${aviso}` };
            if (r.maximo === null) return null;
            if (v.minimo > r.maximo) {
              return {
                nivel: 'info',
                texto: `No hay zona de acuerdo. Lo mínimo que aceptaría el cliente supera lo que le cuesta a la empresa sostener el rechazo. Corresponde un rechazo documentado y el cierre de la instancia, después de verificar que el MAAN propio esté bien medido.${aviso}`,
              };
            }
            if ((r.costo ?? 0) >= v.reclamo) {
              return {
                nivel: 'ambar',
                texto: `Sostener el rechazo cuesta más que lo reclamado. La jugada racional es acordar, con una oferta única de hasta ${moneda(r.maximo)}, condicionada al acuerdo transaccional.${aviso}`,
              };
            }
            return {
              nivel: 'verde',
              texto: `Hay zona de acuerdo entre ${moneda(v.minimo)} y ${moneda(r.maximo)}. Si legales decide conceder, la oferta es única, por escrito y condicionada al acuerdo con confidencialidad. Si no, el rechazo documentado sigue siendo una respuesta válida.${aviso}`,
            };
          },
          nota: 'Herramienta orientativa para ordenar la decisión. Los porcentajes son estimaciones de legales y la decisión final se toma según la matriz de autorizaciones.',
        },
      ],
    },
    {
      id: 'autorizaciones',
      titulo: 'Matriz de autorizaciones',
      corto: 'Autorizaciones',
      intro: 'Quién puede ofrecer qué y hasta dónde. Toda alternativa se ofrece por escrito y se registra la respuesta del cliente.',
      bloques: [
        {
          tipo: 'tabla',
          aria: 'Matriz de autorizaciones',
          columnas: [
            { rotulo: 'Alternativa', ancho: '1.15fr', estilo: 'fuerte' },
            { rotulo: 'Quién la ofrece', ancho: '0.9fr' },
            { rotulo: 'Tope', ancho: '0.9fr' },
            { rotulo: 'Condición', ancho: '1.2fr', estilo: 'porque' },
          ],
          filas: [
            ['Reprogramación de sesiones o entregas', '{respAcomp}', 'Dentro del plazo del programa', 'Confirmación escrita en el canal oficial.'],
            ['Reasignación del equipo de acompañamiento', '{respAcomp}', 'Sin costo adicional', 'Se ofrece como ajuste del servicio, no como reconocimiento.'],
            ['Sesión adicional de seguimiento', '{respAcomp}', 'Una por caso', 'Se registra como gesto de buena voluntad.'],
            ['Extensión del plazo del servicio', 'Líder del área', 'La que permita el contrato', 'Acuerdo escrito con la nueva fecha de cierre.'],
            ['Pausa o congelamiento', 'Líder del área', 'La que permita el contrato', 'Mensaje de pausa acordada con fecha de reactivación.'],
            ['Conversión del saldo en otro producto', 'Líder del área', 'Hasta el valor no utilizado', 'Aceptación expresa y por escrito del cliente.'],
            ['Concesión económica parcial', 'Líder del área', 'Hasta {topeLider}', 'Única, por escrito y condicionada al acuerdo transaccional.'],
            ['Concesión económica mayor', '{respLegales}', 'Hasta {topeLegales}', 'Evaluación de riesgo escrita y acuerdo transaccional.'],
            ['Concesión por encima de los topes', 'Dirección', 'Sin tope', 'Decisión registrada en el expediente con su fundamento.'],
            ['Devolución por arrepentimiento legal', '{respLegales}', 'Lo que fije la ley', 'No se condiciona a ningún acuerdo ni a confidencialidad.'],
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'Los topes se calculan sobre el precio de referencia, {precio}. Nadie del equipo ofrece montos fuera de esta tabla, ni siquiera como posibilidad.',
        },
      ],
    },
    {
      id: 'mensajes',
      titulo: 'Biblioteca de mensajes',
      corto: 'Mensajes',
      intro:
        'Veinte modelos ordenados por etapa. Se completan con la ficha y se adaptan al tono de cada empresa siempre que no cambie el contenido.',
      bloques: [
        {
          tipo: 'guiones',
          aria: 'Mensajes por etapa',
          items: [
            {
              id: 'venta',
              titulo: 'En la venta',
              bajada: 'Antes y después del pago. Los envía el equipo comercial.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Confirmación posterior a la llamada',
                  texto:
                    '[[Nombre]], un gusto la charla de hoy. Te confirmo por escrito lo conversado. Contratás {programa} por [[precio]], que incluye [[componentes principales]], para potenciar tu negocio de [[actividad del cliente]]. Te adjunto el contrato completo para que lo leas con tiempo. Cuando lo hayas revisado, respondé este mensaje confirmando y te enviamos el enlace de firma. Cualquier duda antes de firmar, la vemos juntos.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Entrega de la copia firmada',
                  texto:
                    '[[Nombre]], bienvenido al programa. Te adjuntamos tu copia del contrato firmado junto con la constancia de integridad de {firma}. Guardala en un lugar seguro. En {canal} vas a recibir todas las comunicaciones oficiales del servicio.',
                },
                {
                  tipo: 'porque',
                  texto:
                    'La confirmación escrita con respuesta del cliente neutraliza después los planteos de presión o de promesas verbales. Entregar la copia firmada desde el inicio le quita al cliente el argumento de no haberla tenido.',
                },
              ],
            },
            {
              id: 'prestacion',
              titulo: 'Durante la prestación',
              bajada: 'Constancias mientras todo está bien. Responsable {respAcomp}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Aviso proactivo de demora',
                  texto:
                    '[[Nombre]], te escribimos por tu consulta sobre [[tema]]. Queremos darte una respuesta bien trabajada, así que el equipo la está revisando y te contestamos a más tardar el [[día]]. Gracias por la paciencia.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Cierre de hito',
                  texto:
                    '[[Nombre]], dejamos registrado que hoy completamos [[hito, por ejemplo la tercera reunión de seguimiento]], donde trabajamos [[temas]]. Los próximos pasos acordados son [[pasos]]. Cualquier ajuste que quieras hacer, avisanos por acá.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Pedido de feedback',
                  texto:
                    '[[Nombre]], cerramos [[el primer mes]] del programa. Nos encantaría que nos cuentes en pocas líneas cómo lo estás viviendo, qué te está sirviendo más y qué ajustarías. Tu devolución nos ayuda a afinar el acompañamiento.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Pausa o inactividad',
                  texto:
                    '[[Nombre]], notamos que hace [[tiempo]] que no estás participando de [[componente]]. Queremos asegurarnos de que aproveches todo lo que contrataste. Contanos si estás con poco tiempo, si algo del programa no te está cerrando o si te sirve reprogramar. Estamos para ayudarte a retomar.',
                },
                { tipo: 'nota', etiqueta: 'Formulario', texto: 'También sirve un formulario de feedback. Lo importante es que la respuesta quede guardada con fecha.' },
              ],
            },
            {
              id: 'disconformidad',
              titulo: 'Disconformidad',
              bajada: 'Contener, diagnosticar y ofrecer alternativas. Única voz, {respAcomp}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Contención inicial',
                  texto:
                    'Hola [[nombre]]. Gracias por contarnos esto con franqueza. Queremos revisarlo bien antes de responderte, así que el equipo va a analizar tu situación y te escribimos el [[día]] con una propuesta concreta. Mientras tanto seguís teniendo acceso normal a todo el programa.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Tono agresivo',
                  texto:
                    '[[Nombre]], para poder ayudarte de verdad necesitamos entender bien qué pasó. Te propongo algo. Contanos puntualmente qué situaciones te generaron esta sensación y el equipo las va a revisar una por una. Te respondemos el [[día]] con lo que encontremos y una propuesta.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Promesas verbales del vendedor',
                  texto:
                    '[[Nombre]], el alcance del programa es el que figura en el contrato que firmaste y que tenés en tu correo, donde está detallado qué incluye el servicio y bajo qué modalidad. Dicho eso, queremos que el programa te funcione, así que contanos qué resultado estás buscando y vemos cómo trabajarlo dentro de lo contratado.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'No le sirve o no es para él',
                  texto:
                    '[[Nombre]], gracias por la honestidad. Antes de sacar conclusiones nos gustaría entender en qué punto el programa no está conectando con tu negocio. Muchas veces un ajuste de enfoque o un cambio en el equipo de acompañamiento cambia por completo la experiencia. Te proponemos una reunión de reencuadre esta semana para revisar tu caso y armar un plan a tu medida.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Oferta de alternativa',
                  texto:
                    '[[Nombre]], revisamos tu planteo. Entendemos que la dinámica con [[aspecto]] no viene funcionando como esperabas. Te proponemos [[alternativa concreta]] para encarar esta etapa de otra manera. Contanos si te sirve y lo activamos esta semana.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Registro del rechazo de la alternativa',
                  texto:
                    'Entendido [[nombre]], tomamos nota de que preferís no avanzar con [[alternativa ofrecida]]. Queda a tu disposición si cambiás de opinión. Cualquier otra cosa que necesites dentro del programa, escribinos por acá.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Pedido de pausa',
                  texto:
                    '[[Nombre]], recibimos tu pedido de pausa. Te confirmamos que el programa queda pausado desde el [[fecha]] y conservás [[detalle de lo que conserva]]. Para reactivarlo escribinos por este canal. Dejamos registrada esta pausa como acordada entre ambas partes.',
                },
                {
                  tipo: 'nunca',
                  textos: [
                    'Improvisar una solución en el momento.',
                    'Discutir quién tiene razón por chat.',
                    'Prometer una devolución o un monto sin pasar por la matriz de autorizaciones.',
                  ],
                },
              ],
            },
            {
              id: 'legales',
              titulo: 'Traspaso y legales',
              bajada: 'Un solo mensaje de traspaso y, desde ahí, solo legales por correo.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Traspaso a legales',
                  texto:
                    '[[Nombre]], tu solicitud fue derivada a nuestro equipo de legales, que va a analizarla en detalle y responderte por correo electrónico a [[casilla del cliente]]. A partir de ahora toda comunicación sobre este tema se canaliza por esa vía para que quede debidamente documentada.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Si insiste por chat',
                  texto:
                    '[[Nombre]], como te informamos, este tema está siendo tratado por el equipo de legales y toda la comunicación al respecto se canaliza por correo electrónico. Vas a recibir ahí la respuesta a tu planteo.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Acuse de recibo de legales',
                  texto:
                    'Estimado [[nombre]]. Nos comunicamos desde el área de legales de {empresa} en relación con su solicitud de reembolso. Su caso se encuentra en análisis junto con la documentación de la operación. Recibirá nuestra respuesta por este medio dentro de los próximos {diasRespuesta}. Toda comunicación sobre este asunto deberá canalizarse por esta vía, {correoLegales}.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Respuesta a un pedido de arrepentimiento en plazo',
                  texto:
                    'Estimado [[nombre]]. Recibimos su pedido de revocación del [[fecha]], identificado con el código [[código]]. Le confirmamos que fue presentado dentro del plazo legal y que el reintegro de [[monto]] se realizará por el mismo medio de pago dentro de [[plazo de reintegro]]. No necesita realizar ningún otro trámite.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Propuesta transaccional',
                  texto:
                    'Estimado [[nombre]]. Sin perjuicio de lo expresado en nuestras comunicaciones anteriores y sin que ello importe reconocimiento de hecho ni de derecho alguno, y con el exclusivo propósito de dar por concluida la relación de manera ordenada, {empresa} se encuentra dispuesta a ofrecerle [[concesión, por ejemplo la restitución de un porcentaje del precio abonado o el acceso sin cargo a otro servicio]]. Esta propuesta queda sujeta a la firma de un acuerdo que incluirá la renuncia recíproca a todo reclamo derivado de la relación contractual, un compromiso de confidencialidad sobre sus términos y la abstención de ambas partes de efectuar manifestaciones públicas sobre la otra. La presente oferta se formula por única vez y mantiene su vigencia por {vigencia}, vencidos los cuales quedará sin efecto.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Cuándo no se usa la propuesta',
                  texto: 'Nunca frente a un arrepentimiento legal en plazo. Lo que la ley ya le da al cliente no se condiciona a confidencialidad ni a abstenerse de opinar.',
                },
                {
                  tipo: 'porque',
                  texto: 'Un solo canal y una sola voz evitan contradicciones. Entregar el contrato firmado en la primera respuesta formal quita un argumento y ahorra un intercambio.',
                },
              ],
            },
            {
              id: 'difusion',
              titulo: 'Difusión pública',
              bajada: 'Por canales formales y documentados. Nunca en redes.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Párrafo de constancia',
                  texto:
                    'Dejamos constancia de que recibimos su mensaje del [[fecha]], en el que condiciona la difusión de manifestaciones sobre la empresa a que se acceda a su pedido económico. El mensaje fue registrado y conservado, con expresa reserva de las acciones que pudieran corresponder.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Intimación por publicación de hechos falsos',
                  texto:
                    'Estimado [[nombre]]. Se ha constatado que con fecha [[fecha]] usted publicó en [[plataforma]] manifestaciones en las que atribuye a [[persona o empresa]] [[hecho concreto]], según el detalle que sigue [[publicaciones]]. Dichas manifestaciones son falsas, como surge de [[constancia]], y lesionan la reputación de {empresa}. Por la presente lo intimamos a cesar en su difusión y a retirar, dentro de las 48 horas de recibida esta comunicación, todo contenido de esa naturaleza, bajo apercibimiento de iniciar las acciones civiles que correspondan por la reparación del daño causado y, en su caso, las acciones penales pertinentes. Las publicaciones referidas han sido preservadas como evidencia.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Antes de intimar',
                  texto:
                    'Legales clasifica cada publicación como opinión o como imputación de un hecho falso. Las opiniones, aunque sean duras, no se intiman. La mención de acciones penales se reserva para imputaciones concretas a personas identificadas. Las capturas se fechan y archivan antes de intimar, y si el contenido no se retira se envía carta documento.',
                },
                {
                  tipo: 'nunca',
                  textos: ['Responder en redes, en comentarios o en entrevistas.', 'Contestar la amenaza con otra amenaza inmediata.', 'Cambiar la decisión de fondo por la presión pública.'],
                },
                {
                  tipo: 'porque',
                  texto: 'Toda la disputa se lleva por canales formales y documentados. El contraste entre la agresión de una parte y la mesura de la otra vale más que cualquier argumento.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'derivacion',
      titulo: 'Disparadores de derivación',
      corto: 'Derivación',
      intro: 'Ante cualquiera de estas señales el caso pasa a legales en el día. Nadie del equipo decide quedárselo.',
      bloques: [
        {
          tipo: 'tabla',
          aria: 'Disparadores de derivación',
          columnas: [
            { rotulo: 'Señal', ancho: '1.2fr', estilo: 'senal' },
            { rotulo: 'Qué hacer', ancho: '1.3fr' },
            { rotulo: 'Pasa a', ancho: '0.6fr', estilo: 'pastilla' },
          ],
          filas: [
            ['Pide expresamente la devolución del dinero, total o parcial.', 'Contener con el modelo de contención, sin hablar de montos, y derivar.', 'Legales'],
            ['Menciona abogados, denuncias, {organismo} o acciones legales.', 'Un único mensaje de traspaso. No se responde el fondo.', 'Legales'],
            ['Habla de estafa, fraude o engaño y no responde a la contención.', 'Registrar el mensaje y derivar con la cronología.', 'Legales'],
            ['Amenaza con escraches, reseñas negativas o difusión en redes.', 'No responder la amenaza. Derivar para la constancia formal.', 'Legales'],
            ['Rechazó dos alternativas y mantiene el reclamo.', 'Registrar ambos rechazos y derivar.', 'Legales'],
            ['Anuncia o inicia un contracargo.', 'Avisar a legales y a administración. Corre un plazo para responder con prueba.', 'Legales y administración'],
            ['Pide la baja o se arrepiente dentro del plazo legal, por cualquier canal.', 'Registrar fecha y canal, no ofrecer alternativas como condición y derivar.', 'Legales hoy'],
            ['Llega una carta documento, una citación o un reclamo ante un organismo.', 'Escanear, registrar la fecha de recepción y derivar.', 'Legales hoy'],
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            'Una sola voz no es un solo canal. El traspaso al correo ordena la conversación, pero un pedido de baja o de arrepentimiento que llega por otro medio es válido y se procesa igual.',
        },
      ],
    },
    {
      id: 'frases',
      titulo: 'Frases prohibidas y su reemplazo',
      corto: 'Frases prohibidas',
      intro: 'En un reclamo, las fórmulas de cortesía de todos los días se convierten en admisiones. Estas son las más comunes y cómo reemplazarlas.',
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
              'Perdón por la demora.',
              'Lamentamos que hayas sentido que la respuesta tardó. Revisamos el canal y tu consulta fue respondida dentro de los plazos previstos.',
              'Admite un hecho. Lo reconocido no se puede desreconocer.',
            ],
            ['Tenés razón, eso estuvo mal.', 'Entendemos cómo lo viviste y lo vamos a revisar con el equipo.', 'Valida el reclamo antes de analizarlo.'],
            ['Quedate tranquilo que te devolvemos la plata.', 'Tu planteo pasa a legales, que te va a responder por correo.', 'Promete algo que todavía no se decidió.'],
            ['El vendedor se equivocó al decirte eso.', 'El alcance del programa es el que figura en el contrato que firmaste.', 'Reconoce una promesa verbal que puede integrar la oferta.'],
            [
              'Eso no está en el contrato, problema tuyo.',
              'Eso no forma parte de lo contratado. Contanos qué resultado buscás y vemos cómo trabajarlo dentro del programa.',
              'El fondo es correcto, el tono escala y suma prueba de mal trato.',
            ],
            ['Si publicás algo te hacemos juicio.', 'Silencio en el chat y derivación a legales para la constancia formal.', 'Una amenaza contra otra destruye la zona de acuerdo.'],
            ['Te hacemos un descuento si borrás la reseña.', 'Cualquier propuesta la formula legales, por escrito y por única vez.', 'Negocia por goteo y compra la siguiente exigencia.'],
            [
              'No hay devoluciones, nunca.',
              'Recibimos tu pedido. Lo revisa legales y te respondemos por correo dentro de las 24 horas.',
              'Frente a un consumidor en plazo niega un derecho irrenunciable.',
            ],
            ['Esto es lo último que te contesto.', 'Te respondimos en nuestra comunicación del [[fecha]], a la que nos remitimos.', 'La remisión cierra igual y queda prolija.'],
            [
              'A mí tampoco me gusta cómo lo maneja la empresa.',
              'Entiendo tu situación. Este tema lo está manejando legales y todo pasa por el correo.',
              'Rompe la voz única y regala una contradicción.',
            ],
          ],
        },
      ],
    },
    {
      id: 'expediente',
      titulo: 'Expediente del caso',
      corto: 'Expediente',
      intro: 'Por cada reclamo se arma un expediente interno. Es lo primero que se pide en una disputa y lo que decide un contracargo.',
      bloques: [
        {
          tipo: 'checklist',
          id: 'expediente',
          titulo: 'Contenido mínimo del expediente',
          textoConforme: 'Expediente completo',
          textoNoConforme: 'Incompleto · falta al menos una pieza crítica',
          items: [
            { id: 'e1', texto: 'Contrato firmado con la constancia de integridad de {firma}.', critico: true },
            { id: 'e2', texto: 'Resultado de la compuerta legal, con fecha.', critico: true },
            { id: 'e3', texto: 'Cronología de la prestación con sus constancias.', critico: true },
            { id: 'e4', texto: 'Todos los intercambios, incluidos los del chat previo al traspaso.', critico: true },
            { id: 'e5', texto: 'Evaluación de riesgo de legales con MAAN, ZOPA y decisión adoptada.', critico: true },
            { id: 'e6', texto: 'Mensaje de confirmación posterior a la llamada y respuesta del cliente.', critico: false },
            { id: 'e7', texto: 'Feedback escrito del cliente durante el programa.', critico: false },
            { id: 'e8', texto: 'Alternativas ofrecidas y su aceptación o rechazo.', critico: false },
            { id: 'e9', texto: 'Capturas fechadas de todo contenido público del cliente.', critico: false },
            { id: 'e10', texto: 'Copia de la respuesta final y constancia de su envío.', critico: false },
          ],
        },
        {
          tipo: 'plazos',
          id: 'plazos',
          titulo: 'Calculadora de plazos',
          intro: 'Para no dejar vencer nada. Elegí el plazo y la fecha desde la que corre.',
          opciones: [
            { id: 'arrepAR', rotulo: 'Arrepentimiento en Argentina, 10 días corridos', cantidad: 10, unidad: 'corridos', nota: 'Se cuenta desde la contratación del servicio. Si el derecho no se informó en forma destacada, no vence.' },
            { id: 'arrepES', rotulo: 'Desistimiento en España, 14 días naturales', cantidad: 14, unidad: 'corridos', nota: 'En servicios se cuenta desde la celebración del contrato. Si no se informó, se extiende hasta doce meses.' },
            { id: 'codigo', rotulo: 'Código de la solicitud por botón, 24 horas', cantidad: 24, unidad: 'horas', nota: 'En Argentina, ante pedidos por el botón de arrepentimiento o de baja.' },
            { id: 'acuse', rotulo: 'Acuse de recibo de legales, 1 día hábil', cantidad: 1, unidad: 'habiles' },
            { id: 'respuesta', rotulo: `Respuesta legal, ${diasRespuesta} ${diasRespuesta === 1 ? 'día hábil' : 'días hábiles'}`, cantidad: diasRespuesta, unidad: 'habiles' },
            { id: 'oferta', rotulo: `Vigencia de una oferta, ${vigencia} ${vigencia === 1 ? 'día hábil' : 'días hábiles'}`, cantidad: vigencia, unidad: 'habiles' },
            { id: 'intimacion', rotulo: 'Retiro de publicaciones intimado, 48 horas', cantidad: 48, unidad: 'horas' },
          ],
        },
        { tipo: 'aclaracion', texto: 'El expediente se conserva mientras pueda existir un reclamo y se trata como información confidencial.' },
      ],
    },
    {
      id: 'tablero',
      titulo: 'Tablero de indicadores',
      corto: 'Tablero',
      intro: 'Lo que no se mide se repite. Se revisa una vez por mes y alimenta los ajustes al protocolo de llamadas y a la gestión del equipo.',
      bloques: [
        {
          tipo: 'kpis',
          items: [
            {
              nombre: 'Tasa de reclamos',
              formula: 'Reclamos abiertos en el mes, dividido ventas del mes, por cien.',
              lectura: 'Mide la calidad de la venta y de la prestación. Si sube, el problema empezó antes del reclamo.',
              meta: 'Bajar mes a mes',
              frecuencia: 'Mensual',
              fuente: 'CRM',
            },
            {
              nombre: 'Resolución antes de legales',
              formula: 'Casos cerrados sin derivación, dividido casos cerrados, por cien.',
              lectura: 'Mide la contención y la calidad de las alternativas.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Expedientes',
            },
            {
              nombre: 'Tiempo a primera respuesta',
              formula: 'Horas entre el primer mensaje del reclamo y la primera respuesta registrada.',
              lectura: 'Ni en caliente ni tarde. Por debajo de la regla de enfriamiento hay apuro, por encima de un día hay abandono.',
              meta: 'Entre {horas} y 24 horas',
              frecuencia: 'Por caso',
              fuente: 'Canal oficial',
            },
            {
              nombre: 'Tiempo de resolución',
              formula: 'Días entre la apertura y el cierre de cada caso, en promedio.',
              lectura: 'Los casos largos consumen equipo y suben el riesgo de difusión.',
              frecuencia: 'Mensual',
              fuente: 'Expedientes',
            },
            {
              nombre: 'Costo de concesiones',
              formula: 'Monto concedido en el mes, dividido facturación del mes, por cien.',
              lectura: 'Es el precio real de los conflictos. Se compara con el costo esperado que evitó cada acuerdo.',
              frecuencia: 'Mensual',
              fuente: 'Administración',
            },
            {
              nombre: 'Contracargos',
              formula: 'Contracargos recibidos, dividido transacciones con tarjeta, por cien, y porcentaje ganado.',
              lectura: 'Las redes de tarjetas vigilan a los comercios con tasas altas. Ganar depende del expediente.',
              frecuencia: 'Mensual',
              fuente: '{pasarela}',
            },
            {
              nombre: 'Causas raíz',
              formula: 'Cantidad de casos por causa, ordenados de mayor a menor.',
              lectura:
                'Promesa del vendedor, demora, expectativa no contratada, encaje con el programa o arrepentimiento legal. Las dos primeras causas del mes definen dónde se trabaja.',
              frecuencia: 'Mensual',
              fuente: 'Expedientes',
            },
          ],
        },
        {
          tipo: 'calculadora',
          id: 'tableroMes',
          titulo: 'Tablero rápido del mes',
          intro: 'Cargá los números del mes y obtené los indicadores principales.',
          entradas: [
            { id: 'ventas', rotulo: 'Ventas del mes', unidad: 'ventas' },
            { id: 'reclamos', rotulo: 'Reclamos abiertos', unidad: 'casos' },
            { id: 'cerrados', rotulo: 'Casos cerrados', unidad: 'casos' },
            { id: 'sinLegales', rotulo: 'Cerrados sin derivación', unidad: 'casos' },
            { id: 'concedido', rotulo: 'Monto concedido', unidad: 'moneda' },
            { id: 'facturacion', rotulo: 'Facturación del mes', unidad: 'moneda' },
            { id: 'transacciones', rotulo: 'Transacciones con tarjeta', unidad: 'pagos' },
            { id: 'contracargos', rotulo: 'Contracargos recibidos', unidad: 'casos' },
            { id: 'ganados', rotulo: 'Contracargos ganados', unidad: 'casos' },
          ],
          salidas: [
            { id: 'tasa', rotulo: 'Reclamos cada 100 ventas', formato: 'num', destacada: true, calcular: (v) => (v.ventas ? (n0(v.reclamos) / v.ventas) * 100 : null) },
            { id: 'antes', rotulo: 'Resueltos antes de legales', formato: 'pct', calcular: (v) => (v.cerrados ? (n0(v.sinLegales) / v.cerrados) * 100 : null) },
            { id: 'costo', rotulo: 'Costo de concesiones', formato: 'pct', calcular: (v) => (v.facturacion ? (n0(v.concedido) / v.facturacion) * 100 : null) },
            { id: 'cc', rotulo: 'Tasa de contracargos', formato: 'pct', calcular: (v) => (v.transacciones ? (n0(v.contracargos) / v.transacciones) * 100 : null) },
            { id: 'ganadosPct', rotulo: 'Contracargos ganados', formato: 'pct', calcular: (v) => (v.contracargos ? (n0(v.ganados) / v.contracargos) * 100 : null) },
          ],
          nota: 'Si el negocio usa el CRM del portal de FIRMA, el registro de casos calcula estos números con los datos reales de cada cliente.',
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
              bajada: 'Código Civil y Comercial, Ley 24.240 de Defensa del Consumidor y Código Penal.',
              abierto: true,
              items: [
                {
                  lead: 'Arrepentimiento del consumidor.',
                  nivel: 'ALTO',
                  texto:
                    'En la contratación a distancia o fuera de los establecimientos comerciales, el consumidor puede revocar dentro de los 10 días corridos sin dar motivos y el derecho es irrenunciable (art. 1110 CCyC y art. 34 LDC). Debe informarse en caracteres destacados inmediatamente antes de la firma y, si no se informa, no se extingue (art. 1111 CCyC). La revocación se notifica por escrito, por medios electrónicos o similares (art. 1112 CCyC).',
                },
                {
                  lead: 'Botón de arrepentimiento y botón de baja.',
                  nivel: 'MEDIO',
                  texto:
                    'La Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y Lealtad Comercial unificó ambos regímenes y derogó las Resoluciones 316/2018 y 424/2020. Quien vende a consumidores por canales digitales debe tener los dos botones visibles desde el primer acceso, sin registro previo, e informar el código de la solicitud dentro de las 24 horas. La Disposición 3/2026 admite pasos razonables de verificación de identidad. Quedan excluidas las compras destinadas a reventa, a insumos productivos o a prestar servicios a terceros.',
                },
                {
                  lead: 'Encuadre de consumo.',
                  nivel: 'MEDIO',
                  texto:
                    'El régimen no alcanza a quien no es destinatario final (arts. 1092 y 1093 CCyC, art. 1 LDC). Declarar en el contrato que no hay relación de consumo no alcanza, y si esa cláusula importa renuncia de derechos se tiene por no convenida (art. 37 LDC, arts. 988 y 1119 CCyC). Lo que fortalece la posición es registrar los hechos, a qué se dedica el cliente y para qué usa el servicio.',
                },
                {
                  lead: 'Baja por el mismo medio.',
                  nivel: 'MEDIO',
                  texto:
                    'Si el servicio se contrató por teléfono, por medios electrónicos o similares, el consumidor puede rescindirlo por el mismo medio (art. 10 ter LDC). Por eso un pedido de baja que llega por chat es válido aunque la negociación haya pasado al correo.',
                },
                {
                  lead: 'Trato digno y daño punitivo.',
                  nivel: 'MEDIO',
                  texto:
                    'Están prohibidas las conductas que coloquen al consumidor en situaciones vergonzantes, vejatorias o intimidatorias (art. 8 bis LDC, arts. 1097 y 1098 CCyC). La falta de respuesta a reclamos formales y las respuestas agresivas suelen fundar condenas por daño punitivo (art. 52 bis LDC), con criterios que varían según el tribunal.',
                },
                {
                  lead: 'Lo dicho integra la oferta.',
                  nivel: 'MEDIO',
                  texto:
                    'Las precisiones de las comunicaciones comerciales obligan al oferente y se tienen por incluidas en el contrato (art. 8 LDC, art. 1103 CCyC). Por eso el protocolo nunca reconoce una promesa verbal y remite siempre al texto firmado.',
                },
                {
                  lead: 'Acuerdo transaccional.',
                  nivel: 'BAJO',
                  texto:
                    'La transacción extingue obligaciones litigiosas o dudosas mediante concesiones recíprocas (arts. 1641 y siguientes CCyC). La confidencialidad y la abstención de manifestaciones públicas son válidas entre partes, pero no pueden condicionar lo que la ley ya le reconoce al consumidor.',
                },
                {
                  lead: 'Silencio.',
                  nivel: 'BAJO',
                  texto:
                    'El silencio no es manifestación de voluntad salvo que exista un deber de expedirse (art. 263 CCyC). Remitirse a una comunicación anterior no genera aceptación tácita, siempre que se respeten los plazos formales.',
                },
                {
                  lead: 'Difamación.',
                  nivel: 'MEDIO',
                  texto:
                    'Calumnias e injurias protegen a una persona física determinada y excluyen las expresiones no asertivas o referidas a asuntos de interés público (arts. 109 y 110 CP). La empresa como tal no es víctima penal, y la vía principal frente a publicaciones falsas es la civil por el daño a la reputación comercial (arts. 1716 y 1737 CCyC).',
                },
              ],
            },
            {
              id: 'es',
              titulo: 'España',
              bajada: 'Texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios (TRLGDCU).',
              items: [
                {
                  lead: 'Desistimiento.',
                  nivel: 'ALTO',
                  texto:
                    'En contratos a distancia y fuera del establecimiento, el consumidor tiene 14 días naturales para desistir sin indicar motivo (arts. 71 y 102 TRLGDCU). Si no se le informó el derecho, el plazo se extiende doce meses (art. 105). En servicios, el derecho se pierde solo si el servicio se ejecutó por completo con consentimiento expreso y reconocimiento de esa pérdida (art. 103), y si se inició a pedido expreso durante el plazo corresponde pagar la parte prestada (art. 108).',
                },
                {
                  lead: 'Respuesta a reclamaciones.',
                  nivel: 'MEDIO',
                  texto:
                    'Las reclamaciones de consumidores se responden en el plazo más breve posible y como máximo en un mes (art. 21 TRLGDCU). La Ley 10/2025, de servicios de atención a la clientela, fija plazos más cortos para las empresas que alcanza, principalmente grandes empresas y prestadoras de servicios básicos. Conviene verificar si el cliente entra en su ámbito.',
                },
                {
                  lead: 'Cláusulas abusivas.',
                  nivel: 'BAJO',
                  texto:
                    'Son abusivas las cláusulas que limiten los derechos del consumidor (arts. 82 y 86 TRLGDCU). Una declaración de que el cliente no es consumidor no lo deja fuera de la ley si en los hechos actúa con un propósito ajeno a su actividad profesional (art. 3 TRLGDCU).',
                },
                {
                  lead: 'Honor y reputación.',
                  nivel: 'BAJO',
                  texto:
                    'La protección civil del honor se tramita por la Ley Orgánica 1/1982, que según la jurisprudencia constitucional también alcanza a las personas jurídicas. La libertad de expresión ampara las opiniones y críticas, no la imputación de hechos falsos.',
                },
              ],
            },
            {
              id: 'ajustes',
              titulo: 'Ajustes sugeridos a los contratos',
              bajada: 'Lo que conviene revisar en los modelos para que el protocolo tenga respaldo.',
              items: [
                {
                  lead: 'Arrepentimiento destacado.',
                  nivel: 'ALTO',
                  texto:
                    'Con consumidores, el aviso del plazo de arrepentimiento va en caracteres destacados inmediatamente antes de la firma. En España se suma el consentimiento expreso para iniciar el servicio dentro del plazo y el reconocimiento de sus efectos.',
                },
                {
                  lead: 'Canal oficial y domicilio electrónico.',
                  nivel: 'MEDIO',
                  texto:
                    'Definir el canal oficial del servicio y el correo de legales como medios para comunicaciones, sin impedir que el consumidor ejerza sus derechos por el medio con el que contrató.',
                },
                {
                  lead: 'Hitos y constancias.',
                  nivel: 'MEDIO',
                  texto: 'Describir los entregables por hito y prever que su confirmación escrita en el canal oficial vale como constancia de prestación.',
                },
                {
                  lead: 'Pausa y reprogramación.',
                  nivel: 'BAJO',
                  texto: 'Regular la pausa, sus límites y la reactivación, para que las alternativas que se ofrecen en un conflicto tengan base contractual.',
                },
              ],
            },
            {
              id: 'dudas',
              titulo: 'Zonas de duda',
              bajada: 'Puntos donde la jurisprudencia no es uniforme. Se deciden caso por caso con legales.',
              items: [
                {
                  lead: 'Contenido digital y arrepentimiento.',
                  texto: 'No está resuelto de forma pacífica si el acceso a contenidos digitales de un programa entra en las excepciones del art. 1116 CCyC.',
                },
                {
                  lead: 'Pequeño emprendedor.',
                  texto: 'Hay criterio que lo protege como consumidor cuando el servicio no se integra de modo directo a su actividad. Los tribunales están divididos.',
                },
                {
                  lead: 'Amenaza de escrache condicionada a un pago.',
                  texto:
                    'Que encuadre en coacción o extorsión (arts. 149 bis y 168 CP) es discutible, sobre todo si el cliente cree que la devolución le corresponde. Por eso el protocolo describe hechos y reserva acciones, sin calificar.',
                },
                {
                  lead: 'Servicios prestados dentro del plazo.',
                  texto: 'Argentina no tiene una regla de pago proporcional como la española, y el alcance de la restitución cuando se revoca un servicio ya prestado es discutible.',
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
            { rotulo: 'Tres reglas', numerada: true, lista: ['Una sola voz.', 'Por escrito o no existe.', 'Nunca en caliente, salvo plazos formales.'] },
            {
              rotulo: 'Antes de responder un pedido de devolución',
              numerada: true,
              lista: ['¿Puede ser consumidor?', '¿Llegó dentro de {dias}?', '¿Se informó ese derecho antes de la firma?', '¿Corre un plazo formal?'],
            },
            {
              rotulo: 'Tres nunca',
              tono: 'nunca',
              lista: ['Nunca reconozcas hechos para calmar.', 'Nunca respondas en redes.', 'Nunca condiciones una devolución que impone la ley.'],
            },
            [
              { rotulo: 'Si dudás', texto: 'Derivá. Un caso derivado de más cuesta menos que una frase de más.' },
              { rotulo: 'Siempre', texto: 'Todo al expediente, el mismo día.' },
            ],
          ],
        },
      ],
    },
  ];
}

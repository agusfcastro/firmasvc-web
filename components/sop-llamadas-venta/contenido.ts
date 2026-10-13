// Contenido del protocolo.
// Convenciones de los textos
//   {clave}      variable de la ficha del cliente (se resalta)
//   [[texto]]    dato que el closer completa en vivo durante la llamada
//   **texto**    énfasis
// Regla de estilo de FIRMA para estos textos, sin rayas ni dos puntos.

import type { ConfigSop, Nicho, Variante } from './config';
import { varianteEfectiva } from './config';

export type Bloque =
  | { tipo: 'decir'; etiqueta: string; texto: string; condicion?: string }
  | { tipo: 'nota'; etiqueta: string; texto: string }
  | { tipo: 'porque'; texto: string }
  | { tipo: 'nunca'; textos: string[] };

export interface Guion {
  id: string;
  titulo: string;
  bajada: string;
  bloques: Bloque[];
}

export interface Momento {
  titulo: string;
  cuando: string;
  objetivo: string;
  que: string;
  frase: string;
  error: string;
}

export interface ItemRepaso {
  id: string;
  titulo: string;
  texto: string;
}

export interface Objecion {
  pregunta: string;
  respuesta: string;
  nota?: string;
}

export interface FraseProhibida {
  no: string;
  si: string;
  porque: string;
}

export interface Alerta {
  senal: string;
  accion: string;
  escalar: string;
}

export interface ItemJuridico {
  lead: string;
  texto: string;
  nivel?: 'ALTO' | 'MEDIO' | 'BAJO';
}

export interface BloqueJuridico {
  id: string;
  titulo: string;
  bajada: string;
  items: ItemJuridico[];
}

export interface ItemControl {
  id: string;
  texto: string;
  critico: boolean;
  opcional?: boolean;
}

// Textos generales

export const META = {
  version: 'Versión 1.0 · Octubre de 2026',
  kicker: 'Protocolo comercial · Plantilla',
  titulo: 'Comunicación legal en llamadas de venta',
  bajada:
    'Qué decir, cómo decirlo y qué no decir nunca para que cada llamada registrada proteja la venta en lugar de ponerla en riesgo. Pensado para closers y setters que venden programas de alto valor por videollamada.',
};

export const IDEAS = [
  { titulo: 'Lo que se dice, se firma', texto: 'Toda promesa hecha en la llamada puede pasar a formar parte de la oferta.' },
  { titulo: 'Un sí legal antes del pago', texto: 'Repaso de cierre de 60 a 90 segundos, registrado.' },
  { titulo: 'Por escrito o no existe', texto: 'Las condiciones especiales van en el contrato o en el correo, nunca de palabra.' },
];

export const ROLES = [
  { rol: 'Closer', foco: 'Todo el protocolo, con prioridad en guiones, repaso de cierre y frases prohibidas.' },
  { rol: 'Setter', foco: 'Reglas para setters, frases prohibidas y alertas.' },
  { rol: 'Líder comercial', foco: 'Ficha del cliente, escalamientos y control de calidad.' },
  { rol: 'Dirección', foco: 'Anexo jurídico y ajustes sugeridos a los contratos.' },
];

export const REGLAS_SETTER = [
  'Lo que escribís por chat o mandás en audio también es prueba. Nada de promesas de resultados ni de ingresos.',
  'No anticipes precio, cuotas, reservas ni políticas de devolución fuera de lo aprobado. Si te preguntan, «Eso lo ves en la llamada con el especialista y te queda todo por escrito».',
  'Calificá con honestidad. Sin urgencias ni cupos inventados para conseguir la agenda.',
  'Si detectás una alerta (posible menor de edad, vulnerabilidad, pedido de garantías), marcala en el CRM antes de agendar.',
];

export const REGLAS_ORO = [
  {
    titulo: 'Lo que decís, se firma.',
    texto: 'Toda promesa que hacés en la llamada puede pasar a formar parte del contrato aunque no esté escrita. Si no está en el contrato, no se promete.',
  },
  {
    titulo: 'El registro juega a favor del que lo hace bien.',
    texto: 'Una llamada prolija gana un contracargo o un reclamo. Una frase de más lo pierde, porque queda registrada.',
  },
  {
    titulo: 'Vendés el proceso, no el resultado.',
    texto: 'Método, acompañamiento, sesiones y herramientas. El resultado depende de lo que haga el cliente, y así se dice.',
  },
  {
    titulo: 'Primero el sí comercial, después el sí legal, recién ahí el pago.',
    texto: 'El repaso de cierre es obligatorio y va antes del link de pago.',
  },
  {
    titulo: 'Ante la duda, escalá.',
    texto: 'Una venta que se posterga hoy cuesta menos que un reclamo mañana.',
  },
];

export const COMO_DECIRLO = [
  {
    titulo: 'Con la misma seguridad que el precio',
    texto: 'La política de devoluciones no se dice bajando la voz ni pidiendo perdón. Se dice como un dato más del programa.',
  },
  {
    titulo: 'En el momento justo',
    texto: 'Devoluciones y reserva van después del sí comercial y antes del pago. Nunca en el medio de la presentación, donde solo frenan.',
  },
  {
    titulo: 'Como filtro de compromiso',
    texto: '«Por eso te hice tantas preguntas» convierte la política en una señal de seriedad. El que se asusta con una regla clara es el que después reclama.',
  },
  {
    titulo: 'Preguntar y esperar',
    texto: 'Después de cada confirmación, silencio hasta que el prospecto diga que sí. Ese sí, registrado, es la prueba.',
  },
  {
    titulo: 'Una vez y bien',
    texto: 'No repetir la política en tono defensivo. Se dice una vez con claridad y se confirma en el repaso de cierre.',
  },
];

export const MOMENTOS: Momento[] = [
  {
    titulo: 'Apertura',
    cuando: 'Minuto 0 a 2',
    objetivo: 'Consentimiento para registrar la llamada.',
    que: 'Aviso de registro y respuesta afirmativa del prospecto antes de entrar en tema. Confirmar nombre completo.',
    frase: '«Antes de arrancar, te cuento que la llamada queda registrada así tenemos respaldo de todo lo que hablemos. ¿Estás de acuerdo?»',
    error: 'Avisar a mitad de la llamada o seguir sin esperar la respuesta.',
  },
  {
    titulo: 'Diagnóstico',
    cuando: 'Primera mitad',
    objetivo: 'Dejar registrada la finalidad real de la compra y detectar alertas.',
    que: 'Entender la situación y preguntar para qué va a usar el programa, en especial si lo aplicará en su actividad profesional o en su empresa.',
    frase: '«Contame de tu actividad. ¿Esto lo vas a aplicar en tu negocio o en tu trabajo profesional?»',
    error: 'Inducir la respuesta o inventar una finalidad profesional. Lo que queda registrado tiene que ser verdad.',
  },
  {
    titulo: 'Presentación',
    cuando: 'Segunda mitad',
    objetivo: 'Describir el servicio en términos verificables, sin promesas de resultado.',
    que: 'Qué incluye, cuánto dura y cómo es el acompañamiento. Los testimonios se presentan como casos individuales.',
    frase: '«Lo que te garantizo es el método, el acompañamiento y todo lo que figura en el contrato. El resultado depende de cómo lo implementes.»',
    error: 'Prometer ingresos, plazos de recupero o resultados concretos.',
  },
  {
    titulo: 'Oferta y precio',
    cuando: 'Al presentar la inversión',
    objetivo: 'Informar el precio total y las condiciones completas.',
    que: 'Precio total primero, después las modalidades. Las cuotas se presentan como financiación de un precio único y la reserva con todas sus condiciones.',
    frase: '«La inversión total es {precio} y la podés hacer {opcionesPago}. Es un solo compromiso por el total.»',
    error: 'Hablar solo del valor de la cuota o presentarlo como una suscripción mensual.',
  },
  {
    titulo: 'Repaso de cierre',
    cuando: 'Después del sí comercial',
    objetivo: 'Obtener el sí legal antes del pago.',
    que: 'Confirmaciones cortas, cada una con respuesta afirmativa. Si algo genera duda, se resuelve antes de cobrar.',
    frase: '«Buenísimo. Antes de pasarte el link te hago un repaso de un minuto para que arranques con todo claro.»',
    error: 'Saltearlo porque ya dijo que sí, o hacerlo después del pago.',
  },
  {
    titulo: 'Cobro y firma',
    cuando: 'Cierre',
    objetivo: 'Que el pago y la aceptación los haga el titular, por escrito.',
    que: 'Link de pago a nombre del prospecto en {pasarela}, contrato por {firma} y casilla de aceptación de términos. Nunca datos de tarjeta en voz alta.',
    frase: '«Te mando el link de pago y el contrato al correo. Completalo vos con tus datos, yo me quedo en línea por si surge algo.»',
    error: 'Pedir que dicte la tarjeta, cobrar con la tarjeta de otra persona sin el titular presente o cobrar antes de enviar el contrato.',
  },
  {
    titulo: 'Después de la llamada',
    cuando: 'Dentro de las 24 horas',
    objetivo: 'Dejar todo por escrito.',
    que: 'Correo de confirmación con el resumen, CRM completo, repaso de cierre marcado y enlace a la llamada en la ficha del cliente.',
    frase: '«Tu ingreso a {programa}, resumen de lo que acordamos», asunto del correo de confirmación.',
    error: 'Acuerdos de palabra que no quedan por escrito, como descuentos, bonos o prórrogas.',
  },
];

// Guiones. Dependen de la variante de devoluciones y de la ficha.

const DEVOLUCION_CORTA: Record<Variante, string> = {
  A: '«Una cosa importante antes de avanzar. Tenés {ventana} desde que firmás o hacés el primer pago, lo que pase primero, para arrepentirte con devolución de lo que hayas pagado. Pasado ese plazo no hay devoluciones, porque desde ahí ya tenés asignado tu lugar, tu equipo y tu acceso. Está en el contrato que te llega por correo. ¿Lo tenés claro?»',
  B: '«Te cuento cómo funciona la devolución. Tenés {dias} desde que contratás para arrepentirte y te devolvemos todo. Pasado ese plazo, el compromiso es por el total y no hay devoluciones. Está destacado en el contrato, antes de tu firma. ¿Lo tenés claro?»',
  C: '«Antes de avanzar, algo que le digo a todos. El programa no tiene devoluciones. Por eso te hice tantas preguntas, quiero que entres solo si estás seguro. Está en el contrato que vas a firmar. ¿Estás de acuerdo?»',
};

const RESERVA_CONDICIONES: Record<Variante, string> = {
  A: '«Te aclaro cómo funciona. Durante las primeras {ventana} podés arrepentirte y te devolvemos la reserva. Pasado ese plazo, si no completás el pago, el lugar se libera para otra persona y la reserva no se devuelve, porque ese cupo quedó bloqueado para vos.»',
  B: '«Te aclaro cómo funciona. Tenés {dias} desde hoy para arrepentirte con devolución total. Pasado ese plazo, si no completás el pago, el lugar se libera para otra persona y la reserva no se devuelve, porque ese cupo quedó bloqueado para vos.»',
  C: '«Te aclaro cómo funciona. La reserva no se devuelve. Si completás el pago dentro del plazo, se descuenta del total. Si no, el lugar se libera para otra persona.»',
};

export function devolucionCorta(c: ConfigSop): string {
  return DEVOLUCION_CORTA[varianteEfectiva(c)];
}

export function reservaCondiciones(c: ConfigSop): string {
  return RESERVA_CONDICIONES[varianteEfectiva(c)];
}

export function construirGuiones(c: ConfigSop): Guion[] {
  const v = varianteEfectiva(c);
  const guiones: Guion[] = [];

  guiones.push({
    id: 'registro',
    titulo: 'Aviso de registro',
    bajada: 'Primera frase de la llamada, antes de entrar en tema.',
    bloques: [
      {
        tipo: 'decir',
        etiqueta: 'Versión corta',
        texto: '«Antes de arrancar, te cuento que la llamada queda registrada así tenemos respaldo de todo lo que hablemos. ¿Estás de acuerdo?»',
      },
      {
        tipo: 'decir',
        etiqueta: 'Si pregunta para qué',
        texto: '«Es para los dos. Si después surge una duda sobre lo que hablamos, lo podemos revisar. La información se resguarda y solo la usa el equipo.»',
      },
      {
        tipo: 'decir',
        etiqueta: 'Si no acepta',
        texto: '«No hay problema, seguimos sin registrar. Al final te mando todo lo importante por escrito.»',
      },
      {
        tipo: 'nota',
        etiqueta: 'Procedimiento si no acepta',
        texto: 'Detener el registro en {herramienta}, dejar constancia en el CRM y hacer el repaso de cierre por escrito, con respuesta del prospecto, antes de enviar el link de pago.',
      },
      {
        tipo: 'porque',
        texto: 'Registrar sin aviso puede ser ilícito en algunas jurisdicciones y le quita valor a la prueba. Con aviso y un sí, el registro es la mejor defensa ante un contracargo o un reclamo.',
      },
      {
        tipo: 'nunca',
        textos: ['Arrancar la llamada sin avisar, o avisar a mitad de camino.', 'Dar una finalidad distinta de la real, como «es solo para capacitación interna».'],
      },
    ],
  });

  guiones.push({
    id: 'resultados',
    titulo: 'Resultados y testimonios',
    bajada: 'Durante la presentación y cada vez que aparezca la pregunta por resultados.',
    bloques: [
      {
        tipo: 'decir',
        etiqueta: 'Versión corta',
        texto: '«Lo que te garantizo es el proceso, el acompañamiento y todo lo que figura en el contrato. Los resultados dependen de cómo lo implementes, y para eso está el programa.»',
      },
      {
        tipo: 'decir',
        etiqueta: 'Al contar un caso',
        texto: '«Te cuento el caso de [[nombre del caso]], que logró [[resultado]]. Es su caso y su contexto, no te lo presento como una promesa. Lo que muestra es lo que puede pasar cuando alguien aplica el método.»',
      },
      {
        tipo: 'decir',
        etiqueta: 'Si pide garantía de resultado',
        texto: '«Nadie serio te puede garantizar un resultado que depende de tu trabajo y del mercado. Lo que sí está garantizado por contrato es todo lo que incluye el programa, y te lo mando por escrito.»',
      },
      {
        tipo: 'nota',
        etiqueta: 'Regla de testimonios',
        texto: 'Solo casos reales y con autorización escrita del cliente. Si el resultado no es el habitual, se dice.',
      },
      {
        tipo: 'porque',
        texto: 'Una promesa de resultado registrada puede convertir una obligación de medios en una de resultado. Es la vía más directa para perder un reclamo o un contracargo.',
      },
      {
        tipo: 'nunca',
        textos: ['«Todos los que entran facturan el doble.»', '«En tres meses recuperás la inversión.»'],
      },
    ],
  });

  const bloquesPrecio: Bloque[] = [
    {
      tipo: 'decir',
      etiqueta: 'Versión corta',
      texto: c.usaCuotas
        ? '«El programa tiene un precio total de {precio}. Lo podés pagar {opcionesPago}. Es un único compromiso por el total, las cuotas son solo la forma de pagarlo.»'
        : '«El programa tiene un precio total de {precio} y se abona en un solo pago.»',
    },
  ];
  if (c.usaCuotas) {
    bloquesPrecio.push({
      tipo: 'decir',
      etiqueta: 'Si pregunta si puede dejar de pagar',
      texto:
        v === 'B'
          ? '«No funciona como una suscripción que se da de baja. Cuando entrás, vos te comprometés por el total y nosotros por todo el programa. Eso sí, tenés {dias} para arrepentirte con devolución total, como dice el contrato.»'
          : '«No funciona como una suscripción que se da de baja. Cuando entrás, vos te comprometés por el total y nosotros por todo el programa.»',
    });
  }
  bloquesPrecio.push(
    {
      tipo: 'porque',
      texto: 'Las cuotas mal explicadas son el origen típico de los contracargos por suscripción cancelada. Un precio total financiado no es una suscripción y hay que decirlo con esas palabras.',
    },
    {
      tipo: 'nunca',
      textos: ['«Son {cuota} por mes y cancelás cuando quieras.»', 'Decir el valor de la cuota sin decir antes el precio total.'],
    },
  );
  guiones.push({
    id: 'precio',
    titulo: 'Precio total y cuotas',
    bajada: 'Al presentar la inversión. Primero el total, después las modalidades.',
    bloques: bloquesPrecio,
  });

  const bloquesReserva: Bloque[] = [
    {
      tipo: 'decir',
      etiqueta: 'Encuadre de cupos',
      texto: '«Trabajamos con {cupos} para poder acompañar a cada uno como corresponde. Esta cohorte arranca {inicio}.»',
      condicion: 'Solo si los cupos son reales',
    },
    {
      tipo: 'decir',
      etiqueta: 'El pago como reserva de lugar',
      texto: '«Tu pago asegura tu lugar en la cohorte. Desde ese momento el lugar deja de ofrecerse a otra persona y empezamos a armar tu acompañamiento.»',
    },
  ];
  if (c.usaReserva) {
    bloquesReserva.push(
      {
        tipo: 'decir',
        etiqueta: 'Ofrecer la reserva',
        texto: '«Si querés asegurar tu lugar hoy, podés hacerlo con una reserva de {reserva}. Se descuenta del precio total y tenés {saldoPlazo} para completar el pago.»',
      },
      {
        tipo: 'decir',
        etiqueta: 'Condiciones, siempre antes del pago',
        texto: RESERVA_CONDICIONES[v],
      },
    );
  }
  bloquesReserva.push(
    {
      tipo: 'porque',
      texto: 'La escasez tiene que ser real, y las condiciones de la reserva tienen que decirse antes del pago y figurar en los términos que se aceptan al pagar. Sin eso, la reserva es un pago sin causa clara y se termina devolviendo.',
    },
    {
      tipo: 'nunca',
      textos: ['«Quedan dos lugares», si no es cierto.', '«Es solo una reserva, después vemos.»'],
    },
  );
  guiones.push({
    id: 'reserva',
    titulo: c.usaReserva ? 'Cupos y reserva' : 'Cupos y lugar asegurado',
    bajada: 'Cuando el prospecto quiere asegurar su lugar o todavía no puede pagar el total.',
    bloques: bloquesReserva,
  });

  const bloquesDevolucion: Bloque[] = [
    {
      tipo: 'nota',
      etiqueta: 'Cómo se dice',
      texto: 'Una sola vez, con claridad, sin pedir disculpas y antes del pago. Después se confirma en el repaso de cierre.',
    },
    { tipo: 'decir', etiqueta: 'Versión corta', texto: DEVOLUCION_CORTA[v] },
  ];
  if (v === 'B' && c.mercado === 'ES') {
    bloquesDevolucion.push({
      tipo: 'decir',
      etiqueta: 'Agregado para España',
      texto: '«Si querés arrancar antes de que termine ese plazo, en el pago vas a ver una casilla para pedir el inicio inmediato. En ese caso, si después desistís dentro del plazo, se descuenta la parte proporcional de lo que ya recibiste.»',
    });
  }
  bloquesDevolucion.push(
    {
      tipo: 'decir',
      etiqueta: 'Si pregunta «¿y si me pasa algo?»',
      texto: '«Si te pasa algo grave que te impida seguir, lo hablás con el equipo por el canal oficial y se evalúa según lo que prevé el contrato. Lo que no hacemos es devolver por cambio de opinión.»',
    },
    {
      tipo: 'porque',
      texto:
        v === 'B'
          ? 'Frente a consumidores, informar la ventana legal es lo que hace que venza. Si no se informa, el plazo no empieza a correr. Además, dicho antes del pago y con un sí registrado, es lo que piden las redes de tarjetas para defender un contracargo.'
          : 'Informar la política antes del pago y obtener un sí registrado es lo que piden las redes de tarjetas para defender un contracargo y, en Estados Unidos, la regla federal de telemarketing. Dicha después del pago no sirve.',
    },
    {
      tipo: 'nunca',
      textos: ['«Por ley no tenés derecho a devolución.»', '«Si no te gusta, lo vemos.»', '«Si no te funciona, te devuelvo la plata.»'],
    },
  );
  guiones.push({
    id: 'devoluciones',
    titulo: 'Política de devoluciones',
    bajada: v === 'A' ? 'Variante A, ventana contractual y después sin devoluciones.' : v === 'B' ? 'Variante B, ventana legal del consumidor.' : 'Variante C, sin devoluciones.',
    bloques: bloquesDevolucion,
  });

  guiones.push({
    id: 'contrato',
    titulo: 'Contrato y términos',
    bajada: 'Al enviar el contrato y ante cualquier pedido de cambios.',
    bloques: [
      {
        tipo: 'decir',
        etiqueta: 'Versión corta',
        texto: '«Te llega el contrato por {firma} con todo lo que hablamos. Tomate unos minutos para leerlo y si algo no te cierra, preguntame ahora que estoy acá.»',
      },
      {
        tipo: 'decir',
        etiqueta: 'Si pide cambiar algo',
        texto: '«Eso no lo puedo modificar yo. Lo anoto, lo consulto con el equipo y te respondemos por escrito.»',
      },
      {
        tipo: 'decir',
        etiqueta: 'Si pregunta qué vale más',
        texto: '«Lo que manda es el contrato. Por eso todo lo que te dije está ahí, y si algo no coincide, avisame antes de firmar.»',
      },
      {
        tipo: 'porque',
        texto: 'El contrato prevalece sobre lo conversado solo si lo conversado es coherente con el contrato. Un closer que lo contradice debilita la cláusula de prevalencia.',
      },
      {
        tipo: 'nunca',
        textos: ['«Firmá tranquilo, es un formalismo.»', '«No hace falta que lo leas.»'],
      },
    ],
  });

  guiones.push({
    id: 'acceso',
    titulo: 'Inicio, acceso y asistencia',
    bajada: 'Para que no haya reclamos por servicio no prestado.',
    bloques: [
      {
        tipo: 'decir',
        etiqueta: 'Versión corta',
        texto: '«Una vez acreditado el pago y firmado el contrato, te llega el acceso al correo. El programa dura {duracion} y la cohorte arranca {inicio}.»',
      },
      {
        tipo: 'decir',
        etiqueta: 'Asistencia',
        texto: '«Las sesiones a las que no asistas sin aviso se consideran dadas, así que agendalas con tiempo.»',
        condicion: 'Solo si el contrato lo prevé',
      },
      {
        tipo: 'porque',
        texto: 'Los reclamos por servicio no prestado se ganan con fechas claras y accesos registrados.',
      },
      {
        tipo: 'nunca',
        textos: ['«Empezás cuando quieras, no hay apuro», si el plazo corre desde la firma o el pago.'],
      },
    ],
  });

  guiones.push({
    id: 'bonos',
    titulo: 'Bonos, descuentos y condiciones especiales',
    bajada: 'Todo lo que se sale del estándar.',
    bloques: [
      {
        tipo: 'decir',
        etiqueta: 'Si está aprobado',
        texto: '«Eso te lo puedo ofrecer, y te lo dejo por escrito en el correo de confirmación y en el contrato para que quede firme.»',
      },
      {
        tipo: 'decir',
        etiqueta: 'Si no está aprobado',
        texto: '«Dejame confirmarlo con el equipo y te lo respondo por escrito.»',
      },
      {
        tipo: 'nota',
        etiqueta: 'Regla',
        texto: 'Solo se ofrecen bonos y descuentos aprobados por el líder comercial. Todo lo especial va en el contrato o en un anexo firmado, nunca de palabra.',
      },
      {
        tipo: 'porque',
        texto: 'Un bono prometido y no escrito igual puede reclamarse si quedó registrado, y es la fuente clásica del «me prometieron otra cosa».',
      },
      {
        tipo: 'nunca',
        textos: ['«Esto no lo pongas en el chat, es un arreglo entre nosotros.»'],
      },
    ],
  });

  return guiones;
}

// Repaso de cierre

export function construirRepaso(c: ConfigSop): ItemRepaso[] {
  const v = varianteEfectiva(c);
  const items: ItemRepaso[] = [
    { id: 'precio', titulo: 'Precio y modalidad', texto: '«El precio total es {precio} y lo vas a pagar [[modalidad elegida]]. ¿Correcto?»' },
  ];
  if (c.usaCuotas) {
    items.push({
      id: 'compromiso',
      titulo: 'Compromiso por el total',
      texto: '«Las cuotas son la forma de pagar un precio total, no una suscripción mensual. ¿Lo tenés claro?»',
    });
  }
  const devolucion: Record<Variante, string> = {
    A: '«Tenés {ventana} para arrepentirte con devolución y después no hay devoluciones. ¿De acuerdo?»',
    B: '«Tenés {dias} para arrepentirte con devolución total y después el compromiso es por el total. ¿De acuerdo?»',
    C: '«El programa no tiene devoluciones. ¿De acuerdo?»',
  };
  items.push(
    { id: 'devoluciones', titulo: 'Devoluciones', texto: devolucion[v] },
    {
      id: 'resultados',
      titulo: 'Resultados',
      texto: '«Los resultados dependen de cómo apliques el programa. Nosotros te garantizamos el acompañamiento y todo lo que está en el contrato. ¿Estamos de acuerdo?»',
    },
  );
  if (c.usaReserva) {
    items.push({
      id: 'reserva',
      titulo: 'Reserva',
      texto:
        v === 'C'
          ? '«Tu reserva de {reserva} se descuenta del total y tenés {saldoPlazo} para completar el pago. Si no lo completás, el lugar se libera y la reserva no se devuelve. ¿Correcto?»'
          : '«Tu reserva de {reserva} se descuenta del total y tenés {saldoPlazo} para completar el pago. Si no lo completás, una vez vencido el plazo para arrepentirte el lugar se libera y la reserva no se devuelve. ¿Correcto?»',
    });
  }
  items.push({
    id: 'contrato',
    titulo: 'Contrato',
    texto: '«Todo esto está en el contrato y en los términos que te llegan ahora por correo. Leelos antes de pagar y cualquier duda me la decís. ¿Dale?»',
  });
  return items;
}

export const REPASO_APERTURA = '«Buenísimo. Antes de pasarte el link te hago un repaso de un minuto para que arranques con todo claro.»';
export const REPASO_CIERRE = '«Perfecto, te paso el link.»';

// Objeciones

export function construirObjeciones(c: ConfigSop): Objecion[] {
  const v = varianteEfectiva(c);
  const lista: Objecion[] = [
    {
      pregunta: '«¿Y si no me funciona?»',
      respuesta:
        '«Es la pregunta correcta. Lo que te puedo asegurar es el proceso, el acompañamiento y todo lo que está en el contrato. El resultado depende de tu trabajo y por eso te pregunté tanto en el diagnóstico. Si no estás dispuesto a implementarlo, prefiero que no entres.»',
      nota: 'Nunca responder con una garantía de devolución que el contrato no tiene.',
    },
    {
      pregunta: '«¿Me devuelven la plata si no me gusta?»',
      respuesta: DEVOLUCION_CORTA[v],
      nota: 'Responder exactamente la política vigente, sin adornos ni excepciones improvisadas.',
    },
  ];
  if (c.usaCuotas) {
    lista.push({
      pregunta: '«¿Puedo pausar o dejar de pagar las cuotas?»',
      respuesta:
        '«No funciona como una suscripción. Es un precio total que elegiste pagar en partes. Si te pasa algo grave que te impida seguir, el contrato prevé cómo se evalúa cada caso.»',
      nota: 'Mencionar la pausa o reprogramación solo si el contrato la prevé.',
    });
  }
  lista.push(
    {
      pregunta: '«¿Me lo garantizás por escrito?»',
      respuesta: '«Lo que está garantizado es lo que dice el contrato, y te lo mando ahora. Lo que no está ahí no te lo puedo prometer, ni por escrito ni de palabra.»',
    },
    {
      pregunta: '«¿Lo puede pagar mi pareja, un familiar o mi socio?»',
      respuesta: '«Sí, siempre que la persona titular de la tarjeta esté en la llamada y lo confirme, o que pague desde un link a su nombre.»',
      nota: 'Si el titular no está presente, no se cobra. Un contracargo por desconocimiento del titular es casi imposible de ganar.',
    },
    {
      pregunta: '«No tengo la plata ahora, ¿qué me recomendás?»',
      respuesta: '«Tenés las opciones de pago que te mostré. Lo que no te voy a recomendar es que te endeudes para entrar. Si hoy no es el momento, lo retomamos más adelante.»',
      nota: 'Prohibido sugerir préstamos, tarjetas nuevas o ampliar límites. La FTC demandó a un programa de formación inmobiliaria, entre otras cosas, por esa práctica.',
    },
    {
      pregunta: '«¿Me hacés factura? ¿Lo puedo deducir?»',
      respuesta: '«Te emitimos el comprobante del pago. Cómo lo tratás impositivamente lo tiene que ver tu contador, yo no te puedo asesorar en eso.»',
    },
    {
      pregunta: '«No quiero que me graben.»',
      respuesta: '«No hay problema, seguimos sin registrar y todo lo importante te lo mando por escrito.»',
      nota: 'Detener el registro y hacer el repaso de cierre por escrito antes del link de pago.',
    },
    {
      pregunta: '«Lo tengo que hablar con mi pareja o con mi socio.»',
      respuesta: '«Me parece perfecto. ¿Querés que agendemos una llamada con los dos? Así escuchan lo mismo y deciden con toda la información.»',
      nota: 'Si hay una fecha de cierre real, se puede mencionar. Inventarla es publicidad engañosa.',
    },
  );
  if (c.usaReserva) {
    lista.push({
      pregunta: '«¿Puedo pagar la reserva y después decido?»',
      respuesta: `«Sí, la reserva te asegura el lugar por {saldoPlazo}. Te cuento las condiciones para que decidas con todo claro.» ${RESERVA_CONDICIONES[v]}`,
      nota: 'La reserva nunca se presenta como «sin compromiso» si no lo es.',
    });
  }
  lista.push(
    {
      pregunta: '«Vi comentarios negativos, ¿esto es confiable?»',
      respuesta: '«Es lógico que lo preguntes. Tenés el contrato completo antes de pagar y todo lo que te digo queda por escrito. Decidí con esa información.»',
      nota: 'No hablar de ex clientes ni de casos puntuales. Si hay un conflicto público, se deriva a legales.',
    },
    {
      pregunta: '«¿Me hacés un descuento si pago hoy?»',
      respuesta: '«Lo que te puedo ofrecer es lo que está aprobado, y te lo dejo por escrito.»',
    },
  );
  return lista;
}

// Frases prohibidas

export const FRASES: FraseProhibida[] = [
  {
    no: '«Te garantizo que en tres meses recuperás la inversión.»',
    si: '«Te garantizo el acompañamiento y todo lo que está en el contrato. El resultado depende de tu implementación.»',
    porque: 'Promesa de resultado que se integra a la oferta.',
  },
  {
    no: '«Si no te funciona, te devuelvo la plata.»',
    si: '«Quiero que entres seguro, por eso te explico ahora la política de devoluciones.»',
    porque: 'Crea una garantía que el contrato no tiene.',
  },
  {
    no: '«Por ley no tenés derecho a devolución.»',
    si: '«Así funciona la política del programa y está en el contrato.»',
    porque: 'Es falso frente a consumidores y queda registrado.',
  },
  {
    no: '«Quedan dos lugares», si no es cierto.',
    si: '«Trabajamos con {cupos} y esta cohorte arranca {inicio}.»',
    porque: 'La escasez inventada es publicidad engañosa.',
  },
  {
    no: '«Es solo una reserva, después vemos.»',
    si: '«La reserva asegura tu lugar y estas son sus condiciones.»',
    porque: 'Sin condiciones claras, la reserva se termina devolviendo.',
  },
  {
    no: '«Son {cuota} por mes y cancelás cuando quieras.»',
    si: '«El precio total es {precio} y lo podés pagar en cuotas.»',
    porque: 'Convierte un precio cerrado en una suscripción.',
  },
  {
    no: '«Firmá tranquilo, es un formalismo.»',
    si: '«Leelo con calma, es lo que nos protege a los dos.»',
    porque: 'Debilita el contrato y sugiere mala fe.',
  },
  {
    no: '«Dictame la tarjeta y la cargo yo.»',
    si: '«Te mando el link para que lo completes vos.»',
    porque: 'Los datos de la tarjeta quedarían en el registro de la llamada.',
  },
  {
    no: '«Sacá un préstamo o subí el límite, después lo recuperás.»',
    si: '«Usá las opciones de pago que te mostré. No te recomiendo endeudarte.»',
    porque: 'Práctica perseguida por la FTC y señal de abuso.',
  },
  {
    no: '«Esto no lo pongas por escrito.»',
    si: '«Todo lo que acordemos te lo mando por escrito.»',
    porque: 'Lo acordado de palabra igual obliga y nadie puede probar sus límites.',
  },
  {
    no: '«Todos los que entran facturan tanto.»',
    si: '«Te muestro casos reales, cada uno con su contexto.»',
    porque: 'Afirmación de ingresos sin respaldo.',
  },
  {
    no: '«Si no entrás hoy, vas a seguir estancado toda la vida.»',
    si: '«Si es tu momento, avanzamos. Si no, lo retomamos más adelante.»',
    porque: 'Presión indebida y trato indigno.',
  },
  {
    no: '«Es deducible, no pagás impuestos.»',
    si: '«Para lo impositivo consultá con tu contador.»',
    porque: 'Asesoramiento que el closer no puede dar.',
  },
  {
    no: '«Los otros programas son una estafa.»',
    si: '«Te cuento lo que hacemos nosotros.»',
    porque: 'Denigrar a terceros expone a reclamos.',
  },
];

// Alertas

export const ALERTAS: Alerta[] = [
  {
    senal: 'Duda sobre si es mayor de edad.',
    accion: 'Preguntar la edad con naturalidad. Si es menor, no se avanza con la venta.',
    escalar: 'Líder comercial',
  },
  {
    senal: 'Vulnerabilidad. Usa ahorros de emergencia, está endeudado o sin trabajo, muestra confusión por edad avanzada, angustia o una situación de salud delicada.',
    accion: 'No presionar ni ofrecer reserva. Proponer retomar más adelante. Si igual quiere avanzar, repaso de cierre completo y nota en el CRM.',
    escalar: 'Líder comercial',
  },
  {
    senal: 'Quiere pagar con la tarjeta de otra persona.',
    accion: 'Solo con el titular presente en la llamada o con un link a nombre del titular.',
    escalar: 'Sin escalamiento',
  },
  {
    senal: 'Pide garantías, devoluciones especiales o cambios al contrato.',
    accion: 'No conceder nada en la llamada. Anotar el pedido y responder por escrito después de consultar.',
    escalar: 'Legales',
  },
  {
    senal: 'Pregunta impositiva o de facturación compleja.',
    accion: 'Derivar a su contador y a administración.',
    escalar: 'Administración',
  },
  {
    senal: 'Consulta de salud, síntomas o medicación.',
    accion: 'No opinar ni recomendar. Derivar al profesional del programa y no prometer resultados físicos.',
    escalar: 'Equipo profesional',
  },
  {
    senal: 'Menciona reclamos, denuncias, abogados o contracargos con otras empresas.',
    accion: 'Tono neutro, repaso de cierre completo y aviso al líder antes de cobrar.',
    escalar: 'Líder comercial',
  },
  {
    senal: 'Amenaza con denunciar o pide hablar con legales.',
    accion: 'No discutir. Derivar a {canal}. Desde ahí todo sigue por correo, como indica el protocolo de reembolsos.',
    escalar: 'Legales',
  },
  {
    senal: 'No está en condiciones de decidir (muy alterado, bajo efectos de alcohol o presionado por un tercero).',
    accion: 'Reprogramar la llamada.',
    escalar: 'Líder comercial',
  },
];

export const NICHOS: Record<Exclude<Nicho, 'ninguno'>, { titulo: string; reglas: string[] }> = {
  salud: {
    titulo: 'Programas de salud y bienestar',
    reglas: [
      'La evaluación clínica, las indicaciones y la medicación las define el profesional de salud, nunca el closer.',
      'Prohibido prometer cambios físicos, hormonales o de salud, o plazos para lograrlos.',
      'No presentar suplementos ni productos como curativos.',
      'Si el prospecto menciona una condición de salud, derivar al equipo profesional antes de cerrar.',
    ],
  },
  finanzas: {
    titulo: 'Programas de finanzas e inversiones',
    reglas: [
      'No recomendar activos, operaciones ni intermediarios.',
      'No proyectar rentabilidades ni mostrar resultados de inversión como esperables.',
      'Presentar el programa como formación, nunca como asesoramiento financiero.',
    ],
  },
  inmobiliario: {
    titulo: 'Programas para el sector inmobiliario',
    reglas: [
      'No prometer operaciones, captaciones ni comisiones.',
      'No opinar sobre requisitos de matrícula o habilitación de cada jurisdicción.',
      'Los casos de éxito se presentan con su contexto, como zona, equipo y años de experiencia.',
    ],
  },
};

// Después de la llamada

export const CAMPOS_CRM = [
  'Aviso de registro aceptado, sí o no',
  'Finalidad de la compra, en palabras del prospecto',
  'Modalidad de pago elegida',
  'Reserva, monto y fecha límite',
  'Repaso de cierre completo, sí o no',
  'Bonos o condiciones especiales aprobadas',
  'Alertas detectadas y a quién se escalaron',
  'Enlace a la llamada en {herramienta}',
];

export function construirCorreo(c: ConfigSop): { asunto: string; cuerpo: string[] } {
  const cuerpo: string[] = [
    'Hola [[nombre]],',
    'Gracias por la llamada de hoy. Te dejo por escrito lo que conversamos para que lo tengas a mano.',
    '· {programa}, con una duración de {duracion}. La cohorte arranca {inicio}.',
    '· Precio total {precio}, en la modalidad que elegiste, [[modalidad elegida]].',
  ];
  if (c.usaReserva) cuerpo.push('· Reserva de {reserva} a cuenta del precio. Plazo para completar el pago, {saldoPlazo}.');
  cuerpo.push(
    '· Política de devoluciones. {politicaCorta}',
    '· El programa es un acompañamiento. Los resultados dependen de tu implementación y el alcance es el que figura en el contrato.',
    '· El contrato y los términos están en el enlace que te enviamos por {firma}. Si algo de este resumen no coincide con el contrato, prevalece el contrato y te pedimos que nos avises.',
    '· Para cualquier consulta formal, el canal oficial es {canal}.',
    'Saludos,',
    '[[nombre del closer]], {empresa}',
  );
  return { asunto: 'Tu ingreso a {programa}, resumen de lo que acordamos', cuerpo };
}

export const CONSERVACION = [
  { lead: 'Llamadas con venta.', texto: 'Durante todo el programa y, como pauta conservadora, hasta cinco años desde que termina el contrato. Validar el plazo por jurisdicción.' },
  { lead: 'Llamadas sin venta.', texto: 'Plazo corto, entre seis y doce meses, salvo que haya un reclamo en curso.' },
  { lead: 'Acceso.', texto: 'Restringido al líder comercial y a legales. Prohibido descargar llamadas a dispositivos personales.' },
  { lead: 'Privacidad.', texto: 'La política de privacidad del cliente tiene que mencionar el registro de llamadas, su finalidad y el plazo de conservación.' },
];

// Control de calidad

export const MUESTRA = [
  'Al menos el 10% de las llamadas de cada closer por mes.',
  'Las primeras 10 llamadas de cada closer nuevo.',
  'El 100% de las ventas con pedido de devolución, contracargo o reclamo.',
];

export const CONTROL: ItemControl[] = [
  { id: 'c1', texto: 'Aviso de registro con respuesta afirmativa', critico: true },
  { id: 'c2', texto: 'Sin promesas de resultados ni de ingresos', critico: true },
  { id: 'c3', texto: 'Política de devoluciones informada antes del pago, con un sí', critico: true },
  { id: 'c4', texto: 'Repaso de cierre completo antes del link de pago', critico: true },
  { id: 'c5', texto: 'Cobro a nombre del titular, sin datos de tarjeta en voz alta', critico: true },
  { id: 'c6', texto: 'Sin condiciones especiales fuera de lo aprobado', critico: true },
  { id: 'e1', texto: 'Precio total informado antes que la cuota', critico: false },
  { id: 'e2', texto: 'Reserva explicada con todas sus condiciones', critico: false, opcional: true },
  { id: 'e3', texto: 'Finalidad de la compra registrada en el diagnóstico', critico: false },
  { id: 'e4', texto: 'Testimonios presentados como casos individuales', critico: false },
  { id: 'e5', texto: 'Sin presión indebida ni frases prohibidas', critico: false },
  { id: 'e6', texto: 'CRM y correo de confirmación dentro de las 24 horas', critico: false },
];

export const CONSECUENCIAS = [
  { lead: 'Primera observación.', texto: 'Devolución con el fragmento de la llamada y nueva escucha guiada.' },
  { lead: 'Segunda observación en el mes.', texto: 'Recapacitación y revisión del 100% de sus llamadas durante dos semanas.' },
  {
    lead: 'Falta crítica grave o reiterada.',
    texto: 'Promesa de resultado, cobro irregular o condiciones no autorizadas. Incumplimiento en los términos del contrato del closer, con los efectos allí previstos.',
  },
  {
    lead: 'Venta caída por incumplimiento del protocolo.',
    texto: 'No genera comisión. Para aplicarlo, el contrato del closer tiene que preverlo (ver ajustes sugeridos en el anexo jurídico).',
  },
];

export const NOTA_CONTROL =
  'Para no sumar indicios de relación de dependencia, el control se presenta como verificación de la calidad del servicio contratado y sus consecuencias como efectos contractuales, nunca como sanciones disciplinarias.';

// Anexo jurídico

export const JURIDICO: BloqueJuridico[] = [
  {
    id: 'ar',
    titulo: 'Argentina, base del protocolo',
    bajada: 'Derecho del consumidor, Código Civil y Comercial y protección de datos.',
    items: [
      {
        lead: 'Lo dicho integra la oferta.',
        texto:
          'Las precisiones de la publicidad y de las comunicaciones comerciales obligan al oferente y se tienen por incluidas en el contrato (art. 8 LDC y art. 1103 CCyC). Si se viola el deber de información o la buena fe, el consumidor puede pedir la nulidad del contrato o de cláusulas (arts. 4 y 37 LDC, art. 1100 CCyC). En B2B, una afirmación falsa registrada puede configurar dolo (arts. 271 y ss. CCyC) y orienta la interpretación (arts. 1061 y 1067 CCyC). La cláusula de prevalencia ayuda, pero no neutraliza una promesa registrada, menos frente a un consumidor.',
      },
      {
        lead: 'Revocación en ventas a distancia.',
        texto:
          'La videollamada es un medio de contratación a distancia (art. 1105 CCyC). El consumidor tiene 10 días para revocar y el derecho es irrenunciable (art. 1110 CCyC y art. 34 LDC). Las cláusulas que impidan ejercerlo en ese plazo se tienen por no escritas. Debe informarse en caracteres destacados inmediatamente antes de la firma y, si no se informa, el derecho no se extingue (art. 1111 CCyC). Las excepciones del art. 1116 (productos personalizados, contenido digital descargable para uso permanente, prensa) no cubren por sí solas un programa de acompañamiento.',
      },
      {
        lead: 'Botón de arrepentimiento y botón de baja.',
        texto:
          'La Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y Lealtad Comercial unificó ambos regímenes y derogó las Resoluciones 316/2018 y 424/2020. Si el cliente vende a consumidores por canales digitales, los dos botones deben estar visibles desde el primer acceso. La Disposición 3/2026 admite pasos razonables de verificación de identidad. La norma excluye las compras destinadas a reventa, a insumos productivos o a prestar servicios a terceros, lo que suma al argumento B2B.',
      },
      {
        lead: 'Caracterización B2B.',
        texto:
          'El régimen de consumo no se aplica a quien no es destinatario final (art. 1092 CCyC, art. 1 LDC). La finalidad profesional declarada en la llamada, coherente con la declaración del contrato, fortalece la caracterización. **Zona de duda jurisprudencial.** Hay criterio que protege como consumidor al pequeño empresario o profesional cuando el servicio no se integra de modo directo a su actividad. Un corredor que compra formación para su inmobiliaria está mejor posicionado que un particular que compra desarrollo personal.',
      },
      {
        lead: 'Reserva y seña.',
        texto:
          'La seña se presume confirmatoria y se imputa al precio. Si se pacta la facultad de arrepentirse, quien la entregó la pierde (arts. 1059 y 1060 CCyC). Debe pactarse por escrito y ser proporcional. Frente a consumidores, dentro del plazo de revocación se devuelve. Los cupos inexistentes configuran publicidad engañosa (art. 1101 CCyC).',
      },
      {
        lead: 'Compromiso por el total.',
        texto:
          'En los contratos de servicios el comitente puede desistir aun comenzada la ejecución, pero debe indemnizar gastos, trabajos y la utilidad esperada, que el juez puede reducir equitativamente (art. 1261 CCyC). Respalda la lógica del precio total financiado, sujeta al control de cláusulas abusivas en contratos por adhesión y de consumo (arts. 988 y 1119 CCyC, art. 37 LDC).',
      },
      {
        lead: 'Trato digno y vulnerabilidad.',
        texto:
          'Están prohibidas las conductas que coloquen al consumidor en situaciones vergonzantes, vejatorias o intimidatorias (art. 8 bis LDC, arts. 1097 y 1098 CCyC). La Disposición 137/2024 derogó la Resolución 139/2020 sobre hipervulnerables y creó un procedimiento especial para consumidores vulnerables o en situación de desventaja por edad, género, condiciones de salud u otras circunstancias sociales, económicas o culturales. Las conductas abusivas habilitan la multa civil por daño punitivo (art. 52 bis LDC).',
      },
      {
        lead: 'Menores de edad.',
        texto:
          'Declarada la nulidad del contrato celebrado con una persona incapaz, la parte capaz no puede exigir la restitución de lo que pagó o gastó, salvo en la medida en que el incapaz se haya enriquecido (art. 1000 CCyC).',
      },
      {
        lead: 'Registro de la llamada.',
        texto:
          'La voz es un dato personal. Su tratamiento requiere consentimiento libre, expreso e informado y el deber de informar finalidad y destinatarios (arts. 5 y 6 de la Ley 25.326). El aviso al inicio con respuesta afirmativa y la política de privacidad cubren ambos requisitos. El registro hecho por un participante, con aviso, es una prueba de alto valor.',
      },
      {
        lead: 'Firma electrónica.',
        texto:
          'Si se desconoce una firma electrónica, quien la invoca debe acreditar su validez (art. 5 de la Ley 25.506). El registro de la llamada, la aceptación en el checkout y el correo de confirmación se refuerzan entre sí como prueba.',
      },
    ],
  },
  {
    id: 'es',
    titulo: 'España, si se vende a consumidores residentes',
    bajada: 'Texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios (TRLGDCU) y RGPD.',
    items: [
      {
        lead: 'Desistimiento de 14 días naturales.',
        texto: 'Rige en los contratos a distancia (arts. 102 y 104 TRLGDCU). Si no se informa, el plazo se extiende doce meses (art. 105).',
      },
      {
        lead: 'Servicios.',
        texto:
          'El derecho se pierde cuando el servicio se ejecutó por completo con consentimiento expreso previo y reconocimiento del consumidor (art. 103 a). Si pidió el inicio durante el plazo y luego desiste, paga la parte proporcional de lo prestado (art. 108.3).',
      },
      {
        lead: 'Contenido digital sin soporte material.',
        texto:
          'Se pierde el derecho si la ejecución comenzó con consentimiento expreso, reconocimiento de la pérdida del derecho y confirmación posterior (art. 103 m). Para eso sirve la casilla de inicio inmediato en el pago.',
      },
      {
        lead: 'Prácticas comerciales.',
        texto:
          'Afirmar falsamente que una oferta solo está disponible por un tiempo muy limitado es una práctica engañosa prohibida en todo caso (Directiva 2005/29/CE, anexo I, punto 7, incorporada a la Ley 3/1991 de Competencia Desleal). La presión indebida es una práctica agresiva.',
      },
      {
        lead: 'Ley aplicable.',
        texto:
          'Aunque el contrato elija otra ley, el consumidor residente en España conserva la protección imperativa de su ley cuando la empresa dirige su actividad a ese mercado (art. 6 del Reglamento Roma I).',
      },
      {
        lead: 'Registro.',
        texto: 'El RGPD exige informar finalidad, base jurídica y plazo de conservación al momento de recoger los datos (art. 13 RGPD).',
      },
    ],
  },
  {
    id: 'us',
    titulo: 'Estados Unidos, si se vende a residentes',
    bajada: 'Regla federal de telemarketing, FTC y leyes estatales de registro.',
    items: [
      {
        lead: 'Consentimiento para registrar.',
        texto:
          'Varios estados exigen el consentimiento de todas las partes, entre ellos California, Florida, Illinois, Pensilvania y Washington. El aviso al inicio con respuesta afirmativa es el estándar seguro.',
      },
      {
        lead: 'Regla de telemarketing (TSR).',
        texto:
          'En las ventas telefónicas alcanzadas, antes de que el cliente acepte pagar hay que informar en forma clara que la empresa no hace devoluciones, si esa es su política, o todas las condiciones materiales de la política que se mencione (16 CFR 310.3(a)(1)(iii)). Tergiversarla está prohibido (310.3(a)(2)(iv)). Desde 2024 la prohibición de tergiversaciones alcanza también a las llamadas entre empresas. Algunas llamadas iniciadas por el cliente en respuesta a publicidad quedan exentas de parte de la regla, pero conviene cumplir el estándar igual.',
      },
      {
        lead: 'Promesas de ingresos y testimonios.',
        texto:
          'La FTC persigue las promesas de ingresos sin respaldo en programas de formación. En el caso Zurixx (2019), contra seminarios inmobiliarios con promesas de ganancias, la FTC también cuestionó que se indicara a los asistentes sacar tarjetas nuevas o ampliar límites para pagar la formación avanzada. Los testimonios deben reflejar experiencias reales y, si el resultado no es el habitual, aclararlo (Guías de la FTC sobre testimonios, 16 CFR Part 255).',
      },
    ],
  },
  {
    id: 'pagos',
    titulo: 'Contracargos y medios de pago',
    bajada: 'Lo que miran las redes de tarjetas y las pasarelas.',
    items: [
      {
        lead: 'Divulgación de la política.',
        texto:
          'Para que la política sirva en una disputa, Visa pide que se muestre antes del pago final con una aceptación activa, como una casilla o un botón, y no solo mediante un enlace aparte. El repaso de cierre registrado, la casilla del checkout y el correo de confirmación forman el paquete de prueba.',
      },
      {
        lead: 'Datos de tarjeta.',
        texto:
          'Las normas PCI DSS prohíben conservar datos sensibles de autenticación, como el código de seguridad, después de la autorización, y eso incluye el registro de las llamadas. Por eso el pago siempre va por link.',
      },
      {
        lead: 'Plataformas con garantía propia.',
        texto: 'Si la pasarela o el marketplace imponen su propia política de devoluciones, esa política se aplica igual y el guion tiene que reflejarla.',
      },
      {
        lead: 'Tarjeta de un tercero.',
        texto: 'El contracargo por desconocimiento del titular es de los más difíciles de defender.',
      },
    ],
  },
  {
    id: 'ajustes',
    titulo: 'Ajustes sugeridos fuera del protocolo',
    bajada: 'Puntos de los contratos y del checkout que el protocolo necesita para funcionar.',
    items: [
      {
        nivel: 'ALTO',
        lead: 'Contratos B2C sin cláusula de revocación.',
        texto: 'Incorporarla destacada inmediatamente antes de la firma (art. 1111 CCyC) y replicarla en el checkout. Mientras falte, el plazo no empieza a correr.',
      },
      {
        nivel: 'ALTO',
        lead: 'Ventana de 72 horas con compradores que puedan ser consumidores.',
        texto: 'Llevarla al piso legal (10 días en Argentina, 14 en España) o reforzar la caracterización B2B en el contrato y en la llamada.',
      },
      {
        nivel: 'MEDIO',
        lead: 'Contrato del closer.',
        texto: 'Remitir expresamente a este protocolo. Si el contrato solo prevé la pérdida de comisión por defectos en la prestación del servicio, sumar como supuesto la venta caída por incumplimiento del protocolo.',
      },
      {
        nivel: 'MEDIO',
        lead: 'Checkout.',
        texto: 'Casilla de aceptación de la política de devoluciones y, para España, casilla de solicitud de inicio inmediato.',
      },
      {
        nivel: 'BAJO',
        lead: 'Política de privacidad.',
        texto: 'Mencionar el registro de llamadas, su finalidad y el plazo de conservación.',
      },
      {
        nivel: 'BAJO',
        lead: 'Control de calidad y relación con el closer.',
        texto: 'Presentarlo como verificación de la calidad del servicio contratado para no sumar indicios de subordinación (arts. 21 a 23 LCT).',
      },
    ],
  },
  {
    id: 'grises',
    titulo: 'Zonas grises a decidir caso por caso',
    bajada: 'Donde no hay respuesta segura y conviene decidir con información del caso.',
    items: [
      { lead: 'Consumidor empresario.', texto: 'El criterio jurisprudencial está dividido.' },
      {
        lead: 'Servicios prestados dentro de los 10 días.',
        texto: 'Argentina no tiene una regla de pago proporcional como la española, y el alcance de la restitución cuando se revoca un servicio ya prestado es discutible.',
      },
      {
        lead: 'Retención de la reserva frente a consumidores.',
        texto: 'Después del plazo de revocación depende de su proporcionalidad y de que las condiciones se hayan informado antes del pago.',
      },
      {
        lead: 'Plazo de conservación del registro.',
        texto: 'Hay que equilibrar el valor probatorio con la minimización de datos personales.',
      },
    ],
  },
];

export const PIE =
  'Protocolo elaborado por FIRMA para uso del equipo comercial. No reemplaza el contrato ni el asesoramiento jurídico para casos concretos. Si algo de un guion no coincide con el contrato del cliente, prevalece el contrato y hay que avisar para ajustar la ficha.';

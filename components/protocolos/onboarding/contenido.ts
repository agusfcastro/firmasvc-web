// Contenido del protocolo de onboarding de clientes.
// Regla de estilo de FIRMA para estos textos, sin rayas ni dos puntos.

import { opcion, soloDigitos, txt } from '../motor/ficha';
import type { Ficha, Nivel, OpcionPlazo, Seccion } from '../motor/tipos';
import { numeroDe } from './ficha';

// Utilidades

function n0(v: number | null): number {
  return v ?? 0;
}

function cuenta(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function unir(lista: string[]): string {
  if (lista.length <= 1) return lista.join('');
  return `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`;
}

// Índice de salud de la cuenta

const PESOS = { asistencia: 25, hitos: 25, pagos: 20, satisfaccion: 20, contacto: 10 };

type Componente = keyof typeof PESOS;

const NOMBRES: Record<Componente, string> = {
  asistencia: 'la asistencia a las sesiones',
  hitos: 'el avance de los hitos',
  pagos: 'los pagos',
  satisfaccion: 'la satisfacción del cliente',
  contacto: 'el contacto con el cliente',
};

function acotar(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function proporcion(parte: number | null, total: number | null): number | null {
  if (total === null) return null;
  if (total <= 0) return 1;
  if (parte === null) return null;
  return acotar(parte / total, 0, 1);
}

function componentes(v: Record<string, number | null>): Record<Componente, number> | null {
  const asistencia = proporcion(v.asistidas, v.programadas);
  const hitos = proporcion(v.cumplidos, v.previstos);
  if (asistencia === null || hitos === null || v.atraso === null || v.satisfaccion === null || v.contacto === null) return null;
  return {
    asistencia: PESOS.asistencia * asistencia,
    hitos: PESOS.hitos * hitos,
    pagos: Math.max(0, PESOS.pagos - Math.max(0, v.atraso)),
    satisfaccion: ((acotar(v.satisfaccion, 1, 5) - 1) / 4) * PESOS.satisfaccion,
    contacto: Math.max(0, PESOS.contacto - 0.5 * Math.max(0, v.contacto - 7)),
  };
}

function sumar(c: Record<Componente, number>): number {
  return Math.round(c.asistencia + c.hitos + c.pagos + c.satisfaccion + c.contacto);
}

function indiceSalud(v: Record<string, number | null>): number | null {
  const c = componentes(v);
  return c ? sumar(c) : null;
}

function masDebil(c: Record<Componente, number>): Componente {
  const claves = Object.keys(PESOS) as Componente[];
  return claves.reduce((peor, k) => (c[k] / PESOS[k] < c[peor] / PESOS[peor] ? k : peor), claves[0]);
}

function banderas(v: Record<string, number | null>): string[] {
  const lista: string[] = [];
  if (v.satisfaccion !== null && v.satisfaccion <= 2) lista.push('una satisfacción de 1 o 2');
  if (v.atraso !== null && v.atraso > 15) lista.push('más de 15 días de atraso en el pago');
  if (v.contacto !== null && v.contacto > 21) lista.push('más de tres semanas sin interacción del cliente');
  return lista;
}

function conclusionSalud(v: Record<string, number | null>): { nivel: Nivel; texto: string } | null {
  const cargados = ['programadas', 'asistidas', 'previstos', 'cumplidos', 'satisfaccion', 'contacto'].some((k) => v[k] !== null);
  if (!cargados) return null;
  const c = componentes(v);
  if (!c) return { nivel: 'info', texto: 'Completá los siete datos de la cuenta para ver el índice y la acción que corresponde.' };
  const puntaje = sumar(c);
  const debil = NOMBRES[masDebil(c)];
  const alertas = banderas(v);
  const senal = alertas.length ? ` Señal de alerta, ${unir(alertas)}.` : '';
  const pago = v.atraso !== null && v.atraso > 0 ? ' Coordiná el atraso con administración antes de tocar los accesos.' : '';
  if (puntaje >= 75 && !alertas.length) {
    return {
      nivel: 'verde',
      texto: `Cuenta sana, ${puntaje} puntos. Seguí el calendario de hitos, cerrá cada uno por escrito en {canal} y volvé a medir en la próxima revisión.${pago}`,
    };
  }
  if (puntaje >= 50) {
    return {
      nivel: 'ambar',
      texto: `Cuenta en observación, ${puntaje} puntos.${senal} {respOnboarding} contacta al cliente dentro de las 48 horas con una propuesta concreta para mejorar ${debil}, deja constancia en {canal} y vuelve a medir en 14 días.${pago}`,
    };
  }
  return {
    nivel: 'rojo',
    texto: `Cuenta en riesgo, ${puntaje} puntos.${senal} El punto más débil es ${debil}. Reunión de reencuadre dentro de la semana, aviso al líder del área y revisión del expediente de ingreso. Si aparece un pedido de devolución, una mención de abogados o un contracargo, rige el protocolo de conflictos desde ese mismo día.${pago}`,
  };
}

// Plazos del onboarding

function opcionesPlazo(f: Ficha): OpcionPlazo[] {
  const diasInicio = numeroDe(f, 'diasInicio', 5);
  const diasResultado = numeroDe(f, 'diasResultado', 30);
  const duracion = soloDigitos(txt(f, 'duracion'));
  const lista: OpcionPlazo[] = [
    {
      id: 'recordatorio',
      rotulo: 'Recordatorio de firma, 24 horas desde el envío',
      cantidad: 24,
      unidad: 'horas',
      nota: 'Si a las 24 horas el contrato no está firmado, sale el recordatorio. A las 72 horas llama el closer.',
    },
    { id: 'bienvenida', rotulo: 'Bienvenida y accesos, 24 horas desde el alta', cantidad: 24, unidad: 'horas', nota: 'El alta es el momento en que el contrato está firmado y el pago acreditado.' },
    { id: 'inicio', rotulo: `Reunión de inicio, ${cuenta(diasInicio, 'día hábil', 'días hábiles')} desde el alta`, cantidad: diasInicio, unidad: 'habiles' },
    { id: 'resumen', rotulo: 'Resumen de la reunión de inicio, 24 horas', cantidad: 24, unidad: 'horas', nota: 'Desde que termina la reunión. El resumen pide la confirmación del cliente.' },
    {
      id: 'arrepAR',
      rotulo: 'Arrepentimiento en Argentina, 10 días corridos',
      cantidad: 10,
      unidad: 'corridos',
      nota: 'Desde la celebración del contrato. Si vence en día inhábil, se prorroga al primer día hábil siguiente (art. 1110 CCyC). Si no se informó en forma destacada antes de la firma, no se extingue (art. 1111 CCyC).',
    },
    {
      id: 'desistES',
      rotulo: 'Desistimiento en España, 14 días naturales',
      cantidad: 14,
      unidad: 'corridos',
      nota: 'En servicios, desde la celebración del contrato (art. 104 TRLGDCU). Si no se informó, se extiende doce meses (art. 105 TRLGDCU).',
    },
    { id: 'primer', rotulo: `Primer resultado, ${cuenta(diasResultado, 'día corrido', 'días corridos')} desde el alta`, cantidad: diasResultado, unidad: 'corridos', nota: 'Es la fecha objetivo para cerrar por escrito {primerHito}.' },
    { id: 'treinta', rotulo: 'Seguimiento de los 30 días', cantidad: 30, unidad: 'corridos', nota: 'Desde el alta. Incluye el índice de salud y el pedido de feedback.' },
    {
      id: 'inactividad',
      rotulo: 'Aviso de inactividad, 10 días sin interacción',
      cantidad: 10,
      unidad: 'corridos',
      nota: 'Desde la última interacción del cliente. A las tres semanas sin respuesta se escala al líder del área.',
    },
  ];
  if (duracion !== null && duracion > 0) {
    if (duracion % 2 === 0) {
      lista.push({ id: 'mitad', rotulo: `Revisión de mitad de programa, ${cuenta(duracion / 2, 'mes', 'meses')}`, cantidad: duracion / 2, unidad: 'meses', nota: 'Desde el inicio del programa.' });
    } else {
      const dias = Math.round((duracion * 365) / 24);
      lista.push({
        id: 'mitad',
        rotulo: `Revisión de mitad de programa, ${cuenta(dias, 'día corrido', 'días corridos')}`,
        cantidad: dias,
        unidad: 'corridos',
        nota: 'Desde el inicio del programa. Es una fecha aproximada, ajustala al calendario de sesiones.',
      });
    }
    lista.push({
      id: 'cierre',
      rotulo: `Cierre del programa, ${cuenta(duracion, 'mes', 'meses')}`,
      cantidad: duracion,
      unidad: 'meses',
      nota: 'Desde el inicio del programa. La propuesta de renovación sale 30 días antes de esta fecha.',
    });
  }
  return lista;
}

// Secciones

export function secciones(f: Ficha): Seccion[] {
  const perfil = opcion(f, 'perfil');
  const puedeSerConsumidor = perfil !== 'B2B';
  const espana = opcion(f, 'mercado') === 'ES';

  const itemsIngreso: { id: string; texto: string; critico: boolean }[] = [
    { id: 'i1', texto: 'Contrato firmado por ambas partes en {firma}, con la constancia de firma descargada, antes de habilitar cualquier acceso.', critico: true },
    { id: 'i2', texto: 'Pago acreditado en {pasarela}, no solo iniciado, a nombre del titular del contrato.', critico: true },
    { id: 'i3', texto: 'Copia del contrato firmado enviada al cliente por correo, con el PDF y la constancia, y el envío registrado.', critico: true },
  ];
  if (puedeSerConsumidor) {
    itemsIngreso.push({
      id: 'i4',
      texto: 'Aviso de arrepentimiento en caracteres destacados inmediatamente antes de la firma y vencimiento del plazo, {dias}, agendado.',
      critico: true,
    });
    if (espana) {
      itemsIngreso.push({
        id: 'i5',
        texto: 'Si el cliente quiere empezar dentro del plazo de desistimiento, solicitud expresa guardada en un soporte duradero y confirmación del contrato enviada antes del primer acceso.',
        critico: true,
      });
    }
  }
  if (perfil !== 'B2C') {
    itemsIngreso.push({ id: 'i6', texto: 'Finalidad profesional registrada en el CRM, a qué se dedica el cliente y para qué contrata.', critico: perfil === 'B2B' });
  }
  itemsIngreso.push(
    {
      id: 'i7',
      texto: 'Aviso de privacidad informado y consentimientos específicos registrados aparte del contrato, como uso de imagen, testimonios o comunicaciones comerciales.',
      critico: true,
    },
    { id: 'i8', texto: 'Canal oficial, {canal}, informado por escrito en la bienvenida, con la regla de que todo lo relevante se confirma ahí.', critico: true },
    { id: 'e1', texto: 'Correo de confirmación de la venta y respuesta del cliente archivados en la ficha del CRM.', critico: false },
    { id: 'e2', texto: 'Ficha del cliente completa en el CRM, con perfil, programa, fechas de firma y de pago y closer.', critico: false },
    { id: 'e3', texto: 'Accesos a {contenidos} habilitados a nombre del titular, recién con los críticos cumplidos.', critico: false },
    { id: 'e4', texto: 'Bienvenida enviada dentro de las 24 horas del alta, con pedido de confirmación.', critico: false },
    { id: 'e5', texto: 'El cliente completó {formulario}.', critico: false },
    { id: 'e6', texto: 'Reunión de inicio agendada dentro de {diasInicio} desde el alta.', critico: false },
    { id: 'e7', texto: 'Responsable de la cuenta asignado y presentado al cliente.', critico: false },
    { id: 'e8', texto: 'Seguimiento de los 30 días, revisión de mitad de programa y cierre cargados en la agenda.', critico: false },
    { id: 'e9', texto: 'Comprobante del pago emitido por administración, según los requisitos que defina el contador.', critico: false },
  );

  const itemsControl: { id: string; texto: string; critico: boolean }[] = [
    { id: 'c1', texto: 'La fecha de firma en {firma} es anterior al primer acceso a {contenidos}.', critico: true },
    { id: 'c2', texto: 'El pago está a nombre del titular o la diferencia está aclarada por escrito.', critico: true },
    { id: 'c3', texto: 'La copia firmada se envió con su constancia y el envío figura en el expediente.', critico: true },
  ];
  if (puedeSerConsumidor) {
    itemsControl.push({ id: 'c4', texto: 'El contrato muestra el aviso de arrepentimiento destacado inmediatamente antes de la firma.', critico: true });
  }
  itemsControl.push(
    { id: 'c5', texto: 'El resumen de la reunión de inicio salió dentro de las 24 horas y está archivado.', critico: true },
    { id: 'c6', texto: 'La bienvenida tiene respuesta del cliente o un reenvío registrado.', critico: false },
    { id: 'c7', texto: 'Cada hito cumplido tiene su mensaje de cierre en {canal}.', critico: false },
    { id: 'c8', texto: 'El índice de salud de los 30 días está medido y guardado.', critico: false },
    { id: 'c9', texto: 'El feedback escrito del cliente está guardado con su fecha.', critico: false },
    { id: 'c10', texto: 'Los consentimientos específicos están registrados aparte del contrato.', critico: false },
    { id: 'c11', texto: 'Cada alerta detectada tiene su acción, su responsable y su fecha en el CRM.', critico: false },
  );

  return [
    {
      id: 'uso',
      titulo: 'Cómo usar este protocolo',
      corto: 'Cómo usarlo',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Este protocolo ordena el ingreso de cada cliente de {empresa} a {programa}, desde el cierre comercial hasta el primer resultado y la renovación. Los datos del negocio se completan una vez en la ficha y se actualizan solos en todos los mensajes y herramientas.',
        },
        {
          tipo: 'parrafo',
          texto:
            'El onboarding es la etapa que más reclamos previene. Lo que no se aclara en las primeras semanas vuelve después como pedido de devolución, y lo que se registra en ellas es la mejor prueba si el reclamo llega. Empieza donde termina el protocolo de llamadas de venta y le pasa la posta al protocolo de conflictos apenas aparece una señal de reclamo.',
        },
        {
          tipo: 'parrafo',
          texto:
            'Un concepto ordena los plazos. El **alta** es el momento en que el contrato está firmado en {firma} y el pago acreditado en {pasarela}. Desde ahí corren la bienvenida, la reunión de inicio y el primer resultado.',
        },
        { tipo: 'leyenda' },
        {
          tipo: 'roles',
          items: [
            { rol: 'Comercial', foco: 'Cierre sin promesas fuera del contrato, envío del contrato, recordatorio de firma y traspaso con la ficha completa.' },
            { rol: 'Onboarding', foco: 'A cargo de {respOnboarding}. Bienvenida, accesos, reunión de inicio, hitos e índice de salud de cada cuenta.' },
            { rol: 'Administración', foco: 'Confirmación del pago, comprobantes y atrasos, siempre coordinados con onboarding.' },
            { rol: 'Legales', foco: 'Modelo de contrato, aviso de arrepentimiento, privacidad y casos derivados a {correoLegales}.' },
            { rol: 'Dirección', foco: 'Tablero de indicadores, renovaciones y ajustes al protocolo.' },
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            'El protocolo de llamadas termina con el correo de confirmación de la venta y este empieza ahí. Si en cualquier momento aparece un pedido de devolución, una mención de abogados o un contracargo, rige el protocolo de conflictos.',
        },
      ],
    },
    {
      id: 'ficha',
      titulo: 'Ficha del negocio',
      corto: 'Ficha del negocio',
      intro: 'Se completa una sola vez por negocio. Los mensajes, el checklist, los plazos y el índice de salud se actualizan solos.',
      bloques: [{ tipo: 'ficha' }],
    },
    {
      id: 'principios',
      titulo: 'Cinco principios',
      corto: 'Principios',
      intro: 'Valen en todo el recorrido, del cierre a la renovación. Si el equipo recuerda solo esto, ya evita la mayoría de los errores del ingreso.',
      bloques: [
        {
          tipo: 'reglas',
          items: [
            {
              titulo: 'Nadie entra sin contrato firmado y pago confirmado.',
              texto:
                'Los accesos a {contenidos}, al canal y a las sesiones se habilitan recién con el contrato firmado en {firma} y el pago acreditado en {pasarela}. Un acceso dado antes de la firma es un servicio prestado sin contrato, y esa grieta aparece en el primer reclamo.',
            },
            {
              titulo: 'La bienvenida también es prueba.',
              texto:
                'El mensaje de bienvenida entrega la copia firmada, fija el canal oficial y repite las reglas del servicio. Si el cliente lo responde, queda constancia de que recibió el contrato, conoce el canal y empezó a usar el servicio.',
            },
            {
              titulo: 'Expectativas por escrito desde el día uno.',
              texto:
                'Lo que el cliente quiere lograr, lo que incluye el programa y lo que depende de él se acuerda en la reunión de inicio y se resume por escrito ese mismo día. Lo que no quedó escrito, cada uno lo recuerda a su manera.',
            },
            {
              titulo: 'Cada hito se cierra por escrito.',
              texto:
                'Cuando se cumple un hito, sale un mensaje en {canal} con lo entregado, la fecha y los próximos pasos, y se le pide al cliente que lo confirme. Es la prueba de prestación que después se usa en cualquier reclamo.',
            },
            {
              titulo: 'Señal temprana, acción temprana.',
              texto:
                'Una sesión perdida, un pago atrasado o un silencio largo son señales, no anécdotas. Se miden con el índice de salud y se actúan dentro de las 48 horas, antes de que se conviertan en un pedido de devolución.',
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Cómo se ve en la práctica' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Sin firma no hay acceso',
              texto: 'El cliente pagó, todavía no firmó y pide el acceso para empezar el fin de semana. La respuesta es amable y no tiene excepciones.',
              cita: '[[Nombre]], qué bueno que quieras arrancar ya. Para habilitarte el acceso necesitamos tu firma en el contrato que te llegó por {firma}. Apenas lo firmes, te damos acceso en el día.',
            },
            {
              titulo: 'La bienvenida pide respuesta',
              texto: 'La bienvenida no termina con el mensaje enviado. Cierra con un pedido corto que deja constancia de la recepción.',
              cita: 'Cuando puedas, respondé este mensaje con un ok para confirmar que recibiste tu copia del contrato y que este es el canal oficial del programa.',
            },
            {
              titulo: 'Expectativas en una línea',
              texto: 'Al terminar la reunión de inicio, el resumen sale el mismo día y con las palabras del cliente.',
              cita: 'Te resumo lo que acordamos hoy. Tu objetivo para los próximos [[plazo]] es [[objetivo]]. Para eso, nosotros [[compromisos del equipo]] y vos [[compromisos del cliente]]. Si algo no refleja lo que hablamos, avisame por acá.',
            },
            {
              titulo: 'Señal temprana',
              texto:
                'El cliente faltó a dos sesiones seguidas y no respondió el último mensaje. No se espera a la tercera. {respOnboarding} escribe ese mismo día con una propuesta concreta para retomar y lo registra en el CRM.',
              cita: '[[Nombre]], te extrañamos en las últimas sesiones. ¿Te sirve que busquemos otro horario esta semana para ponerte al día?',
            },
          ],
        },
      ],
    },
    {
      id: 'etapas',
      titulo: 'El recorrido en ocho etapas',
      corto: 'Ocho etapas',
      intro: 'Cada etapa tiene responsable, plazo y objetivo. El paso de una a otra queda registrado en la ficha del cliente en el CRM.',
      bloques: [
        {
          tipo: 'etapas',
          items: [
            {
              titulo: 'Cierre comercial',
              cuando: 'Responsable equipo comercial · En la llamada y dentro de las 24 horas',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que el cliente llegue al onboarding con lo prometido igual a lo contratado.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Repaso de cierre del protocolo de llamadas, correo de confirmación con respuesta del cliente, finalidad de la compra registrada en el CRM y traspaso a {respOnboarding} con la ficha completa.',
                },
                { rotulo: 'Frase ancla', texto: 'Te confirmo por escrito lo que acordamos y te llega el contrato por {firma} para que lo leas con tiempo.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Prometer en la llamada un plazo, un bono o un resultado que el contrato no menciona, y que onboarding lo descubra después.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Firma y pago',
              cuando: 'Responsable equipo comercial · Recordatorio a las 24 horas si no firmó',
              datos: [
                { rotulo: 'Objetivo', texto: 'Contrato firmado y pago acreditado antes de cualquier acceso.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Contrato enviado por {firma} antes del enlace de pago o junto con él, con el aviso de arrepentimiento destacado antes de la firma si el cliente puede ser consumidor. Cobro en {pasarela} a nombre del titular. Descarga de la constancia de firma y registro de ambas fechas. El alta se produce cuando las dos cosas están completas.',
                },
                { rotulo: 'Frase ancla', texto: 'Apenas esté firmado el contrato y acreditado el pago, te llega la bienvenida con tus accesos.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Habilitar accesos con el pago hecho y la firma pendiente, o aceptar que firme otra persona por el cliente.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Bienvenida y accesos',
              cuando: 'Responsable {respOnboarding} · Dentro de las 24 horas del alta',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que el cliente tenga su copia, sus accesos y las reglas del servicio por escrito.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Checklist de ingreso con los críticos cumplidos. Mensaje de bienvenida con la copia firmada y su constancia, el canal oficial, las reglas del servicio y el pedido de completar {formulario}. Alta en {contenidos} a nombre del titular. Pedido de confirmación de recepción.',
                },
                { rotulo: 'Frase ancla', texto: 'Respondé este mensaje con un ok para confirmar que recibiste tu copia del contrato y tus accesos.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Mandar los accesos por un canal y el contrato por otro, sin pedir confirmación de ninguno.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Reunión de inicio',
              cuando: 'Responsable {respOnboarding} · Dentro de {diasInicio} desde el alta',
              datos: [
                { rotulo: 'Objetivo', texto: 'Acordar objetivos, compromisos de cada parte y el primer hito, y dejarlo por escrito.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Invitación con agenda, aviso y conformidad si la reunión se registra, repaso del alcance contratado, objetivo del cliente en sus palabras, compromisos de cada parte, calendario de hitos y canal oficial. Resumen por escrito dentro de las 24 horas, con pedido de confirmación.',
                },
                { rotulo: 'Frase ancla', texto: 'Te resumo lo que acordamos hoy para que lo tengamos los dos por escrito.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Convertir la reunión en una clase y terminarla sin objetivos acordados ni resumen escrito.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Primer hito',
              cuando: 'Responsable {respOnboarding} · Dentro de {diasResultado} desde el alta',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que el cliente vea un primer resultado concreto y que quede constancia.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Seguimiento del avance hacia {primerHito}, aviso con anticipación si cambia la fecha y mensaje de cierre en {canal} con lo entregado, la fecha y los próximos pasos. La respuesta del cliente se guarda en su ficha.',
                },
                { rotulo: 'Frase ancla', texto: 'Dejamos registrado que hoy completamos el primer hito, {primerHito}. Los próximos pasos acordados son [[pasos]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Cumplir el hito sin decirlo por escrito, o presentarlo como un resultado económico garantizado.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Seguimiento de los 30 días',
              cuando: 'Responsable {respOnboarding} · A los 30 días del alta',
              datos: [
                { rotulo: 'Objetivo', texto: 'Medir la salud de la cuenta y corregir antes de que aparezca un reclamo.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Índice de salud de la cuenta, pedido de feedback por escrito con una calificación de 1 a 5 y revisión de asistencia, hitos y pagos. Si la cuenta da ámbar o rojo, plan de acción con responsable y fecha.',
                },
                { rotulo: 'Frase ancla', texto: 'Cerramos tu primer mes. Contanos en pocas líneas qué te está sirviendo y qué ajustarías.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Leer el silencio del cliente como conformidad y enterarse de la insatisfacción por un pedido de devolución.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Revisión de mitad de programa',
              cuando: 'Responsable {respOnboarding} · A la mitad del programa',
              datos: [
                { rotulo: 'Objetivo', texto: 'Comparar lo acordado al inicio con lo logrado y ajustar la segunda mitad.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Reunión breve con el resumen de inicio a la vista, hitos cumplidos y pendientes, índice de salud y feedback. Acta escrita con los ajustes, siempre dentro de lo que permite el contrato.',
                },
                { rotulo: 'Frase ancla', texto: 'Repasemos lo que nos propusimos al inicio, lo que ya logramos y qué ajustamos para la segunda mitad.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Prometer extras fuera del contrato para compensar un avance lento, sin autorización ni registro.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Cierre o renovación',
              cuando: 'Responsables {respOnboarding} y dirección · 30 días antes del cierre',
              datos: [
                { rotulo: 'Objetivo', texto: 'Cerrar con constancia de lo prestado y, si corresponde, proponer la continuidad por escrito.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Resumen final con los hitos cumplidos y sus constancias, pedido de feedback final y propuesta de renovación con sus condiciones. La nueva etapa empieza con un contrato o una adenda firmada. Si no renueva, baja de accesos en la fecha prevista y mensaje de cierre.',
                },
                { rotulo: 'Frase ancla', texto: 'Te compartimos el resumen de todo lo que trabajamos y, si querés seguir, la propuesta para la próxima etapa.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Renovar de palabra o seguir prestando después del cierre sin contrato vigente.', estilo: 'error' },
              ],
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Hitos con constancia' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'El mensaje de cierre, en cinco partes',
              numerada: true,
              lista: [
                '**Qué se completó**, con el nombre del hito acordado en la reunión de inicio.',
                '**Cuándo y cómo**, con la fecha y la modalidad, sea sesión, entrega o revisión.',
                '**Dónde está**, con la ubicación en {contenidos} o el documento entregado.',
                '**Qué sigue**, con los próximos pasos, quién hace qué y para cuándo.',
                '**Pedido de comentarios**, con un plazo para responder.',
              ],
            },
            {
              titulo: 'Qué vale como constancia',
              check: true,
              lista: [
                'El mensaje de cierre en {canal} con la respuesta del cliente.',
                'El documento o la entrega con su fecha.',
                'La asistencia registrada de cada sesión.',
                'La actividad del cliente en {contenidos}.',
                'El feedback escrito con su calificación y su fecha.',
              ],
            },
          ],
        },
        {
          tipo: 'tips',
          items: [
            { titulo: 'Hitos verificables', texto: 'Cada hito se define como algo que se puede mostrar, un documento, una sesión o una entrega. Nunca como una cifra de ventas del cliente.' },
            { titulo: 'Uno por mensaje', texto: 'Cada hito se cierra con su propio mensaje. Juntar varios en uno diluye la prueba.' },
            { titulo: 'Respuesta pedida', texto: 'El cierre pide comentarios en un plazo. Si no llegan, se reitera una sola vez y se registra.' },
            { titulo: 'Copia en el CRM', texto: 'El mensaje de cierre y la respuesta del cliente se copian en su ficha el mismo día.' },
          ],
        },
      ],
    },
    {
      id: 'ingreso',
      titulo: 'Checklist de ingreso y plazos',
      corto: 'Checklist de ingreso',
      intro: 'Antes de habilitar cualquier acceso, los ítems críticos tienen que estar cumplidos. Si falta uno, el acceso espera.',
      bloques: [
        {
          tipo: 'checklist',
          id: 'ingreso',
          titulo: 'Checklist de ingreso',
          textoConforme: 'Listo para habilitar accesos',
          textoNoConforme: 'No habilitar accesos · falta al menos un ítem crítico',
          items: itemsIngreso,
        },
        {
          tipo: 'aclaracion',
          texto: 'Una excepción a esta lista la autoriza legales por escrito y queda en el expediente. Nadie del equipo la decide solo, ni siquiera por un día.',
        },
        {
          tipo: 'plazos',
          id: 'plazos',
          titulo: 'Plazos del onboarding',
          intro: 'Para que nada quede librado a la memoria. Elegí el plazo y la fecha desde la que corre.',
          opciones: opcionesPlazo(f),
        },
      ],
    },
    {
      id: 'salud',
      titulo: 'Índice de salud de la cuenta',
      corto: 'Índice de salud',
      intro: 'Una cifra de 0 a 100 que resume cómo viene cada cuenta. Sirve para actuar antes de que el cliente se queje, no para calificarlo.',
      bloques: [
        {
          tipo: 'calculadora',
          id: 'salud',
          titulo: 'Índice de salud de la cuenta',
          intro: 'Se mide en el seguimiento de los 30 días, en la revisión de mitad de programa y cada vez que aparece una señal. Cargá los siete datos de la cuenta.',
          entradas: [
            { id: 'programadas', rotulo: 'Sesiones programadas hasta hoy', unidad: 'sesiones' },
            { id: 'asistidas', rotulo: 'Sesiones a las que asistió', unidad: 'sesiones', ayuda: 'Las que reprogramó el equipo no cuentan como ausencia.' },
            { id: 'previstos', rotulo: 'Hitos previstos a la fecha', unidad: 'hitos', ayuda: 'Según el calendario acordado en la reunión de inicio.' },
            { id: 'cumplidos', rotulo: 'Hitos cumplidos y confirmados', unidad: 'hitos', ayuda: 'Solo los que tienen su mensaje de cierre.' },
            { id: 'atraso', rotulo: 'Días de atraso en pagos', unidad: 'días', inicial: '0', ayuda: 'Cero si está al día.' },
            { id: 'satisfaccion', rotulo: 'Satisfacción del cliente', unidad: 'de 1 a 5', ayuda: 'La última calificación escrita del cliente.' },
            { id: 'contacto', rotulo: 'Días desde la última interacción', unidad: 'días', ayuda: 'Desde el último mensaje, respuesta o sesión del cliente.' },
          ],
          salidas: [
            {
              id: 'indice',
              rotulo: 'Índice de salud',
              formato: 'puntos',
              destacada: true,
              meta: { valor: 75, sentido: 'min' },
              calcular: (v) => indiceSalud(v),
              ayuda: 'De 0 a 100. Asistencia 25, hitos 25, pagos 20, satisfacción 20 y contacto 10.',
            },
            {
              id: 'asistencia',
              rotulo: 'Asistencia a sesiones',
              formato: 'pct',
              calcular: (v) => {
                const p = proporcion(v.asistidas, v.programadas);
                return p === null ? null : p * 100;
              },
            },
            {
              id: 'hitos',
              rotulo: 'Hitos cumplidos a la fecha',
              formato: 'pct',
              calcular: (v) => {
                const p = proporcion(v.cumplidos, v.previstos);
                return p === null ? null : p * 100;
              },
            },
          ],
          conclusion: (v) => conclusionSalud(v),
          nota: 'Verde desde 75 puntos, ámbar de 50 a 74 y rojo por debajo de 50. Una satisfacción de 1 o 2, más de 15 días de atraso o más de tres semanas sin interacción llevan la cuenta a observación aunque el puntaje sea alto. Los umbrales son criterios de este protocolo y se ajustan con la historia de cada negocio.',
        },
        { tipo: 'subtitulo', texto: 'Cómo se calcula' },
        {
          tipo: 'tabla',
          aria: 'Componentes del índice de salud',
          columnas: [
            { rotulo: 'Componente', ancho: '0.9fr', estilo: 'fuerte' },
            { rotulo: 'Peso', ancho: '0.55fr' },
            { rotulo: 'Cómo suma', ancho: '1.4fr' },
            { rotulo: 'Por qué pesa', ancho: '1.1fr', estilo: 'porque' },
          ],
          filas: [
            ['Asistencia a sesiones', '25 puntos', 'En proporción a las sesiones asistidas sobre las programadas.', 'Es la señal más temprana de desconexión.'],
            ['Hitos cumplidos', '25 puntos', 'En proporción a los hitos confirmados por escrito sobre los previstos a la fecha.', 'Mide el avance real y, a la vez, la prueba de prestación.'],
            ['Pagos', '20 puntos', 'Resta un punto por cada día de atraso, hasta llegar a cero a los 20 días.', 'Un atraso sin explicación puede anticipar un pedido de baja o un contracargo.'],
            ['Satisfacción', '20 puntos', 'Cinco puntos por cada escalón por encima de 1, en la escala de 1 a 5.', 'Es lo que el cliente dice por escrito, con fecha.'],
            ['Contacto', '10 puntos', 'Completo hasta siete días sin interacción. Desde el octavo día resta medio punto por día.', 'El silencio largo no es conformidad.'],
          ],
        },
        { tipo: 'subtitulo', texto: 'Qué hacer según el color' },
        {
          tipo: 'tips',
          items: [
            { titulo: 'Verde, desde 75 puntos', texto: 'Seguir el calendario de hitos, cerrar cada uno por escrito y volver a medir en la próxima revisión.' },
            {
              titulo: 'Ámbar, de 50 a 74',
              texto: '{respOnboarding} contacta al cliente dentro de las 48 horas con una propuesta para el componente más débil y vuelve a medir en 14 días.',
            },
            {
              titulo: 'Rojo, por debajo de 50',
              texto: 'Reunión de reencuadre dentro de la semana, aviso al líder del área y revisión del expediente de ingreso con el checklist.',
            },
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'El índice ordena la atención del equipo. No se comparte con el cliente ni se usa como argumento en un reclamo.',
        },
      ],
    },
    {
      id: 'mensajes',
      titulo: 'Biblioteca de mensajes',
      corto: 'Mensajes',
      intro: 'Dieciocho modelos ordenados por etapa. Se completan con la ficha y se adaptan al tono de cada negocio siempre que no cambie el contenido.',
      bloques: [
        {
          tipo: 'guiones',
          aria: 'Mensajes por etapa',
          items: [
            {
              id: 'firma',
              titulo: 'Firma',
              bajada: 'Antes de cualquier acceso. Los envía el equipo comercial.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Envío del contrato para firma',
                  texto:
                    '[[Nombre]], como hablamos, te envío por {firma} el contrato de {programa} con todo lo que acordamos. Leelo con tiempo y, si algo no coincide con lo que conversamos, avisame antes de firmar. El pago se hace por {pasarela}, con el enlace que te llega al correo. Apenas esté firmado el contrato y acreditado el pago, te escribe {respOnboarding} con la bienvenida y tus accesos.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Aviso del derecho antes de la firma',
                  condicion: 'Si puede ser consumidor',
                  texto: 'Antes de firmar vas a ver destacado tu {derecho}, que podés ejercer dentro de {plazoLegal} sin dar motivos. Leelo con atención, forma parte de tu contrato.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Recordatorio de firma',
                  texto:
                    '[[Nombre]], te escribo porque el contrato de {programa} sigue pendiente de firma en {firma}. Si tenés alguna duda sobre el texto, decime y la vemos antes de que firmes. Tus accesos se habilitan apenas esté firmado y acreditado el pago.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Si pide el acceso antes de firmar',
                  texto:
                    '[[Nombre]], qué bueno que quieras arrancar ya. Para habilitarte el acceso necesitamos tu firma en el contrato que te llegó por {firma}. Es la regla para todos y protege a las dos partes. Apenas lo firmes, te damos acceso en el día.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Si pagó y no firmó',
                  texto:
                    'No se habilita ningún acceso. Se recuerda la firma y, si a los siete días sigue sin firmar, legales define con administración si se reitera el envío o se devuelve el pago. El pago solo no aclara qué condiciones aceptó el cliente.',
                },
                {
                  tipo: 'nunca',
                  textos: [
                    'Habilitar accesos antes de la firma, aunque el pago esté acreditado.',
                    'Apurar la firma con cupos o plazos que no existen.',
                    'Decir que no hace falta leer el contrato porque es el de siempre.',
                  ],
                },
                {
                  tipo: 'porque',
                  texto:
                    'El contrato firmado antes del primer acceso ordena todo lo que sigue. Si el servicio empieza sin firma, en un reclamo se discute qué se acordó, y la palabra del cliente pesa tanto como el modelo de contrato.',
                },
              ],
            },
            {
              id: 'bienvenida',
              titulo: 'Bienvenida',
              bajada: 'Dentro de las 24 horas del alta. Responsable {respOnboarding}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Bienvenida con copia firmada y reglas del servicio',
                  texto:
                    '[[Nombre]], te damos la bienvenida a {programa}. Te adjuntamos tu copia del contrato firmado con la constancia de {firma}. Guardala, es tu respaldo y el nuestro. Para arrancar ordenados, cuatro reglas del servicio. El canal oficial es {canal} y todo lo importante se confirma por ahí. Tus accesos a {contenidos} son personales y no se comparten. Las sesiones se reprograman con la anticipación que prevé el contrato. Y el alcance del programa es el del contrato, así que si algo no coincide con lo que hablaste en la llamada, avisanos ahora. Para empezar, completá {formulario} y elegí el horario de tu reunión de inicio en [[enlace de agenda]]. Cuando puedas, respondé este mensaje con un ok para confirmar que recibiste todo.',
                },
                { tipo: 'decir', etiqueta: 'Recordatorio del derecho', condicion: 'Con consumidores', texto: '{avisoArrep}' },
                {
                  tipo: 'decir',
                  etiqueta: 'Si no confirma en 48 horas',
                  texto:
                    '[[Nombre]], te escribimos para confirmar que te llegó la bienvenida con tu copia del contrato y tus accesos a {contenidos}. Si no la encontrás, avisanos y te la reenviamos por acá y por correo.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Dónde va la copia',
                  texto:
                    'La copia firmada va siempre por correo, con el PDF y la constancia, aunque el canal oficial sea un chat. El correo es un soporte que el cliente puede conservar y deja la fecha de envío.',
                },
                {
                  tipo: 'porque',
                  texto:
                    'La bienvenida respondida prueba tres cosas a la vez. Que el cliente recibió el contrato, que conoce el canal oficial y que el servicio empezó. Es la primera constancia de prestación.',
                },
              ],
            },
            {
              id: 'inicio',
              titulo: 'Reunión de inicio',
              bajada: 'Invitación, aviso de registro y resumen. Responsable {respOnboarding}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Invitación a la reunión de inicio',
                  texto:
                    '[[Nombre]], te esperamos el [[día]] a las [[hora]] en [[enlace]] para la reunión de inicio de {programa}. Dura [[duración]] y vamos a definir juntos tus objetivos, el calendario de hitos y la forma de trabajo. Para aprovecharla, traé completo {formulario} y pensá qué te gustaría haber logrado al terminar el programa. Si necesitás cambiar el horario, avisanos por {canal}.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Aviso de registro al empezar',
                  condicion: 'Si la reunión se registra',
                  texto: 'Antes de empezar te aviso que vamos a registrar la reunión, para que tengas el material y para el seguimiento del programa. ¿Estás de acuerdo?',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Resumen de la reunión de inicio',
                  texto:
                    '[[Nombre]], gracias por la reunión de hoy. Te dejamos por escrito lo que acordamos. Tu objetivo principal para el programa es [[objetivo, con las palabras del cliente]]. El primer hito es {primerHito} y la meta es cerrarlo dentro de {diasResultado} desde tu ingreso. De nuestra parte nos comprometemos a [[compromisos del equipo]]. De tu parte, a [[compromisos del cliente, por ejemplo asistir a las sesiones y completar las tareas]]. Los resultados dependen de cómo implementes el programa, y nosotros te acompañamos en todo lo que figura en el contrato. Si algo de este resumen no refleja lo que hablamos, avisanos por acá. Si está todo bien, respondé con un ok.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Objetivos verificables',
                  texto:
                    'El objetivo del cliente se escribe con sus palabras y con algo que se pueda verificar, como publicar la primera campaña o tener el embudo armado. Nunca una cifra de facturación como compromiso del equipo.',
                },
                {
                  tipo: 'nunca',
                  textos: ['Prometer un resultado económico como meta del programa.', 'Cerrar la reunión sin el primer hito y su fecha.', 'Dejar el resumen para otro día.'],
                },
                {
                  tipo: 'porque',
                  texto:
                    'Lo que el cliente espera se acuerda una vez y por escrito. Si después aparece una expectativa distinta, el resumen respondido es la referencia, junto con el contrato.',
                },
              ],
            },
            {
              id: 'hitos',
              titulo: 'Hitos',
              bajada: 'Cada hito se cierra por escrito en {canal}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Cierre de hito',
                  texto:
                    '[[Nombre]], dejamos registrado que hoy completamos [[hito]], que incluyó [[qué se entregó o se trabajó]]. Lo tenés disponible en {contenidos}, en [[sección]]. Los próximos pasos acordados son [[pasos]], para el [[fecha]]. Si tenés algún comentario sobre esta etapa, contanos por acá dentro de los próximos [[días]].',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Aviso de nueva fecha',
                  texto:
                    '[[Nombre]], te avisamos que la entrega de [[hito]] queda para el [[nueva fecha]]. Queremos que llegue bien trabajada. Mientras tanto seguimos con [[tarea]] según lo previsto. Cualquier duda, escribinos por acá.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Reiteración sin respuesta',
                  texto: '[[Nombre]], te reenviamos el cierre de [[hito]] del [[fecha]]. Si tenés comentarios, contanos por acá. Si no, seguimos con los próximos pasos acordados.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Constancia',
                  texto:
                    'El mensaje de cierre y la respuesta del cliente se copian en su ficha del CRM el mismo día. Si no responde, se reitera una sola vez y se registra. El silencio no vale como conformidad, salvo que el contrato lo prevea.',
                },
                {
                  tipo: 'porque',
                  texto: 'En un reclamo, lo prestado se prueba con lo que se registró cuando todo estaba bien. Un hito cerrado por escrito vale más que cualquier explicación posterior.',
                },
              ],
            },
            {
              id: 'seguimiento',
              titulo: 'Seguimiento',
              bajada: 'Feedback, inactividad y mitad de programa. Responsable {respOnboarding}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Pedido de feedback',
                  texto:
                    '[[Nombre]], cerramos [[el primer mes]] de {programa}. Nos gustaría que nos cuentes en pocas líneas cómo lo estás viviendo, qué te está sirviendo más y qué ajustarías. Del 1 al 5, ¿cómo calificarías el acompañamiento hasta ahora? Tu respuesta nos ayuda a afinar el trabajo.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Aviso de inactividad',
                  texto:
                    '[[Nombre]], notamos que hace [[tiempo]] que no participás de [[sesiones o actividades]]. Queremos asegurarnos de que aproveches todo lo que contrataste. Contanos si estás con poco tiempo, si algo del programa no te está cerrando o si te sirve reprogramar. Te proponemos una llamada corta el [[día]] para retomar.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Revisión de mitad de programa',
                  texto:
                    '[[Nombre]], llegamos a la mitad de {programa}. Te proponemos una reunión de [[duración]] para repasar lo que acordamos al inicio, lo que ya logramos y qué ajustamos para la segunda mitad. ¿Te queda bien el [[día]] a las [[hora]]?',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Si el feedback es negativo',
                  texto:
                    'Se agradece, no se discute y la cuenta pasa a observación en el índice de salud. Si el cliente pide una devolución, menciona abogados o habla de estafa, rige el protocolo de conflictos desde ese mismo día.',
                },
                {
                  tipo: 'nunca',
                  textos: [
                    'Responder un feedback negativo con justificaciones.',
                    'Leer el silencio como conformidad.',
                    'Ofrecer descuentos o extras para calmar, sin autorización ni registro.',
                  ],
                },
              ],
            },
            {
              id: 'renovacion',
              titulo: 'Cierre y renovación',
              bajada: 'Treinta días antes del cierre. Responsables {respOnboarding} y dirección.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Propuesta de renovación',
                  texto:
                    '[[Nombre]], se acerca el cierre de {programa}, previsto para el [[fecha de cierre]]. Te compartimos el resumen de lo que trabajamos y de los hitos que cumplimos, [[hitos]]. Si querés seguir, te proponemos [[nueva etapa]], que incluye [[componentes]], por [[precio y condiciones]]. Te mandamos el detalle por escrito y, si te interesa, el contrato de la nueva etapa por {firma}. La nueva etapa empieza cuando esté firmada.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Cierre sin renovación',
                  texto:
                    '[[Nombre]], hoy cerramos {programa}. Gracias por el trabajo de estos meses. Te dejamos el resumen final con los hitos cumplidos y el material disponible en {contenidos} hasta el [[fecha]]. Si más adelante querés retomar, escribinos por acá.',
                },
                {
                  tipo: 'nunca',
                  textos: ['Renovar de palabra o con un mensaje de chat.', 'Cobrar la nueva etapa antes de que el cliente firme.', 'Presionar con plazos o cupos que no existen.'],
                },
                {
                  tipo: 'porque',
                  texto: 'La renovación firmada evita seguir prestando sin contrato vigente, y el resumen final es la última constancia de prestación del programa.',
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
      intro: 'En el entusiasmo del ingreso es fácil prometer de más o saltear un paso. Estas son las frases más comunes y cómo reemplazarlas.',
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
              'Te habilito el acceso ya y el contrato lo firmás después.',
              'Apenas firmes el contrato y se acredite el pago, te damos el acceso en el día.',
              'Un servicio que empieza sin firma deja el acuerdo librado a la palabra de cada uno.',
            ],
            ['Firmalo tranquilo, es el contrato de siempre.', 'Leelo con tiempo y, si algo no coincide con lo que hablamos, avisame antes de firmar.', 'Debilita la prueba de que el cliente conoció las condiciones.'],
            [
              'En 30 días vas a estar facturando el doble.',
              'La meta para los primeros {diasResultado} es {primerHito}. Los resultados dependen de cómo implementes el programa.',
              'Convierte una meta en una promesa de resultado que puede integrar la oferta.',
            ],
            [
              'Ya entraste, así que no hay devolución.',
              'Si querés revisar tu decisión, contanos y te respondemos por escrito con lo que corresponde según el contrato y la ley.',
              'Frente a un consumidor en plazo niega un derecho irrenunciable.',
            ],
            [
              'Eso es letra chica, no hace falta que lo leas.',
              'Todo lo importante está en el contrato. Si alguna cláusula no te queda clara, la vemos juntos.',
              'Contradice el deber de información y le da al cliente el argumento de no haber entendido.',
            ],
            ['Te paso el material por mi WhatsApp personal.', 'Todo el material está en {contenidos} y las comunicaciones van por {canal}.', 'Dispersa la prueba y rompe la regla del canal oficial.'],
            [
              'Si no venís a las sesiones, es problema tuyo.',
              'Vimos que no pudiste venir a las últimas sesiones. ¿Te sirve que busquemos otro horario?',
              'El fondo puede ser correcto, pero el tono suma prueba de mal trato.',
            ],
            ['No hace falta resumen, ya lo hablamos.', 'Te dejo por escrito lo que acordamos hoy.', 'Lo que no quedó escrito, cada uno lo recuerda a su manera.'],
            [
              'Te regalo un mes más si no te quejás.',
              'Cualquier ajuste del programa lo confirmamos por escrito y dentro de lo que prevé el contrato.',
              'Compra silencio sin contrapartida documentada y abre la puerta a la siguiente exigencia.',
            ],
            [
              'Te renovamos automáticamente y después vemos.',
              'Te mandamos la propuesta de la nueva etapa por escrito, y empieza cuando la firmes.',
              'Seguir prestando sin contrato vigente deja la relación sin reglas claras.',
            ],
          ],
        },
      ],
    },
    {
      id: 'alertas',
      titulo: 'Alertas y escalamiento',
      corto: 'Alertas',
      intro: 'Ante cualquiera de estas señales se actúa el mismo día y se escala a quien corresponde. Nadie se queda con una alerta sin registrarla.',
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
            [
              'Pagó pero no firmó dentro de las 48 horas.',
              'No habilitar accesos. Recordatorio de firma y llamada del closer. Si a los siete días sigue sin firmar, legales define cómo seguir.',
              'Comercial y legales',
            ],
            ['Pide el acceso antes de firmar o insiste en empezar sin contrato.', 'Explicar la regla con el mensaje modelo. Ninguna excepción sin autorización escrita de legales.', 'Líder del área'],
            [
              'No coinciden el firmante, el titular del pago o el usuario de los accesos.',
              'Frenar el alta y pedir aclaración por escrito. Registrar quién es el cliente y por qué paga otra persona.',
              'Legales y administración',
            ],
            ['No confirma la recepción de la bienvenida en 48 horas.', 'Reenviar por correo y por {canal}, y registrar ambos envíos.', '{respOnboarding}'],
            ['No agenda la reunión de inicio dentro de {diasInicio}.', 'Llamada corta y dos horarios propuestos por escrito.', 'Líder del área'],
            ['Falta a la reunión de inicio o a dos sesiones seguidas.', 'Aviso de inactividad el mismo día, con una propuesta concreta para retomar.', '{respOnboarding}'],
            ['Diez días sin interacción del cliente.', 'Aviso de inactividad y medición del índice de salud.', '{respOnboarding}'],
            ['Índice de salud en ámbar o con una señal de alerta.', 'Contacto dentro de las 48 horas con una propuesta para el componente más débil y nueva medición en 14 días.', '{respOnboarding}'],
            ['Índice de salud en rojo o tres semanas sin interacción.', 'Reunión de reencuadre dentro de la semana y revisión del expediente de ingreso.', 'Líder del área'],
            ['Pago atrasado.', 'Recordatorio amable y coordinación con administración. No se suspenden accesos sin revisar lo que prevé el contrato.', 'Administración'],
            [
              'Dice que lo prometido en la llamada no coincide con el contrato.',
              'Registrar el planteo, revisar la llamada y el correo de confirmación, y no reconocer nada por chat.',
              'Comercial y legales',
            ],
            ['Muestra señales de vulnerabilidad o puede ser menor de edad.', 'Frenar el avance y consultar antes de seguir. Puede corresponder un trato reforzado.', 'Legales'],
            ['Pide la baja o se arrepiente, por cualquier canal.', 'Registrar fecha y canal, no ofrecer alternativas como condición y aplicar el protocolo de conflictos.', 'Legales hoy'],
            ['Menciona abogados, denuncias, estafa, contracargos o difusión en redes.', 'Un único mensaje de traspaso y protocolo de conflictos.', 'Legales hoy'],
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'Escalar no es perder la cuenta, es pedir ayuda a tiempo. Toda alerta queda en la ficha del cliente con su acción, su responsable y su fecha.',
        },
      ],
    },
    {
      id: 'control',
      titulo: 'Control del onboarding',
      corto: 'Control',
      intro: 'Una vez por mes se revisa una muestra de expedientes de ingreso. El objetivo es corregir el proceso, no buscar culpables.',
      bloques: [
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Qué se revisa cada mes',
              lista: [
                'Todas las cuentas con reclamo, baja o contracargo en los primeros 30 días.',
                'Las primeras cuentas de cada responsable nuevo de onboarding.',
                'Una muestra al azar de las altas del mes.',
              ],
            },
            {
              titulo: 'Qué se hace con lo que aparece',
              leads: [
                { lead: 'Falta crítica.', texto: 'Se corrige en el día y su causa se anota en el tablero.' },
                { lead: 'Problema de la venta.', texto: 'Vuelve al protocolo de llamadas con el caso concreto.' },
                { lead: 'Reclamo en curso.', texto: 'Se trabaja con el protocolo de conflictos y el expediente de ingreso pasa a legales.' },
              ],
            },
          ],
        },
        {
          tipo: 'checklist',
          id: 'control',
          titulo: 'Revisión del expediente de onboarding',
          textoConforme: 'Expediente conforme',
          textoNoConforme: 'No conforme · falta al menos una pieza crítica',
          items: itemsControl,
        },
        {
          tipo: 'aclaracion',
          texto:
            'El control verifica la calidad del servicio, no a las personas. Si quienes hacen el onboarding son prestadores independientes, el encuadre de esa relación es una cuestión laboral que se define con el abogado, más después de la Ley 27.802, que volvió a modificar el art. 23 LCT.',
        },
      ],
    },
    {
      id: 'tablero',
      titulo: 'Tablero de indicadores',
      corto: 'Tablero',
      intro: 'Lo que no se mide se repite. Se revisa una vez por mes y alimenta los ajustes a este protocolo y al de llamadas de venta.',
      bloques: [
        {
          tipo: 'kpis',
          items: [
            {
              nombre: 'Tiempo hasta la firma',
              formula: 'Horas entre el envío del contrato y la firma del cliente, en mediana del mes.',
              lectura: 'Si sube, el contrato llega a destiempo o la llamada dejó dudas sin resolver. Se mira junto con el protocolo de llamadas.',
              meta: 'Bajar mes a mes',
              frecuencia: 'Mensual',
              fuente: '{firma}',
            },
            {
              nombre: 'Accesos con contrato firmado',
              formula: 'Cuentas cuyo contrato estaba firmado antes del primer acceso, dividido cuentas con acceso habilitado, por cien.',
              lectura: 'Mide el cumplimiento del primer principio. Cada excepción es un servicio prestado sin contrato.',
              meta: 'Todas las cuentas',
              frecuencia: 'Mensual',
              fuente: '{firma} y {contenidos}',
            },
            {
              nombre: 'Bienvenida en plazo',
              formula: 'Bienvenidas enviadas dentro de las 24 horas del alta, dividido altas del mes, por cien.',
              lectura: 'La copia firmada y el canal oficial tienen que llegar antes de que el cliente empiece a usar el servicio.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: 'CRM',
            },
            {
              nombre: 'Asistencia a la reunión de inicio',
              formula: 'Reuniones de inicio realizadas dentro de {diasInicio} desde el alta, dividido altas del mes, por cien.',
              lectura: 'Un cliente que no llega a la reunión de inicio entra al programa sin objetivos acordados por escrito.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Agenda y CRM',
            },
            {
              nombre: 'Tiempo al primer resultado',
              formula: 'Días entre el alta y el cierre por escrito del primer hito, en promedio.',
              lectura: 'Mide si el programa entrega pronto algo concreto. Si se alarga, se revisa el diseño del primer hito antes que al cliente.',
              meta: 'Dentro de {diasResultado}',
              frecuencia: 'Mensual',
              fuente: 'Canal oficial y CRM',
            },
            {
              nombre: 'Índice de salud promedio',
              formula: 'Promedio del índice de salud de las cuentas activas al cierre del mes, junto con la cantidad de cuentas en rojo.',
              lectura: 'El promedio esconde los casos críticos. Las cuentas en rojo se revisan una por una.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Calculadora del índice',
            },
            {
              nombre: 'Reclamos en los primeros 30 días',
              formula: 'Cuentas con pedido de devolución, baja o contracargo dentro de los 30 días del alta, dividido altas del período, por cien.',
              lectura: 'Es el indicador que más dice del onboarding. Cada caso se trabaja con el protocolo de conflictos y su causa vuelve a este protocolo como ajuste.',
              meta: 'Bajar mes a mes',
              frecuencia: 'Mensual',
              fuente: 'CRM y expedientes',
            },
          ],
        },
        {
          tipo: 'calculadora',
          id: 'tableroMes',
          titulo: 'Tablero rápido del mes',
          intro: 'Cargá los números del mes y obtené los indicadores principales.',
          entradas: [
            { id: 'nuevas', rotulo: 'Altas del mes', unidad: 'cuentas' },
            { id: 'accesos', rotulo: 'Cuentas con acceso habilitado', unidad: 'cuentas' },
            { id: 'firmados', rotulo: 'De esas, con contrato firmado antes del acceso', unidad: 'cuentas' },
            { id: 'inicios', rotulo: 'Reuniones de inicio realizadas en plazo', unidad: 'reuniones' },
            { id: 'venceHito', rotulo: 'Cuentas con el plazo del primer resultado vencido en el mes', unidad: 'cuentas' },
            { id: 'hitoEnPlazo', rotulo: 'De esas, con el primer hito cerrado en plazo', unidad: 'cuentas' },
            { id: 'reclamos', rotulo: 'Reclamos en los primeros 30 días', unidad: 'casos', ayuda: 'Pedidos de devolución, bajas o contracargos.' },
            { id: 'activas', rotulo: 'Cuentas activas', unidad: 'cuentas' },
            { id: 'rojas', rotulo: 'Cuentas en rojo', unidad: 'cuentas' },
          ],
          salidas: [
            {
              id: 'conFirma',
              rotulo: 'Accesos con contrato firmado',
              formato: 'pct',
              destacada: true,
              meta: { valor: 100, sentido: 'min' },
              calcular: (v) => (v.accesos ? (n0(v.firmados) / v.accesos) * 100 : null),
            },
            { id: 'asistenciaInicio', rotulo: 'Asistencia a la reunión de inicio', formato: 'pct', calcular: (v) => (v.nuevas ? (n0(v.inicios) / v.nuevas) * 100 : null) },
            { id: 'primerEnPlazo', rotulo: 'Primer resultado en plazo', formato: 'pct', calcular: (v) => (v.venceHito ? (n0(v.hitoEnPlazo) / v.venceHito) * 100 : null) },
            { id: 'tempranos', rotulo: 'Reclamos tempranos cada 100 altas', formato: 'num', calcular: (v) => (v.nuevas ? (n0(v.reclamos) / v.nuevas) * 100 : null) },
            { id: 'enRojo', rotulo: 'Cuentas en rojo', formato: 'pct', calcular: (v) => (v.activas ? (n0(v.rojas) / v.activas) * 100 : null) },
          ],
          nota: 'Si el negocio usa el CRM del portal de FIRMA, los contratos se envían a firmar con la firma electrónica de FIRMA desde la ficha de cada cliente, que es la fuente natural de estos números.',
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
              bajada: 'Ley 25.506 de firma digital, Código Civil y Comercial, Ley 24.240 de Defensa del Consumidor y Ley 25.326 de datos personales.',
              abierto: true,
              items: [
                {
                  lead: 'Firma electrónica y firma digital.',
                  nivel: 'ALTO',
                  texto:
                    'La Ley 25.506 reconoce la firma electrónica y la firma digital (art. 1). La firma digital requiere un certificado emitido o reconocido por un certificador licenciado y hace presumir, salvo prueba en contrario, la autoría y la integridad del documento (arts. 2, 7, 8 y 9). La firma electrónica es la que carece de alguno de esos requisitos y, si se la desconoce, quien la invoca debe acreditar su validez (art. 5). Las plataformas de firma por enlace, como {firma}, generan en general firma electrónica. El texto de la ley no fue modificado por el DNU 70/2023 ni por la Ley 27.742. Sus últimas reformas son de 2018 (Ley 27.446) y los cambios posteriores fueron reglamentarios, como el Decreto 743/2024, que permite tramitar el certificado de firma digital sin presencia física.',
                },
                {
                  lead: 'Firma y prueba en el CCyC.',
                  nivel: 'MEDIO',
                  texto:
                    'En los instrumentos generados por medios electrónicos, el requisito de la firma queda satisfecho con una firma digital que asegure la autoría y la integridad (art. 288 CCyC). El valor probatorio de los instrumentos particulares lo aprecia el juez según, entre otras pautas, la confiabilidad de los soportes y de los procedimientos técnicos (art. 319 CCyC). Por eso el contrato nunca viaja solo. Lo acompañan la constancia de firma, el pago a nombre del titular, la bienvenida respondida y el uso del servicio.',
                },
                {
                  lead: 'Contrato a distancia.',
                  nivel: 'MEDIO',
                  texto:
                    'Con consumidores, la venta por videollamada, correo y enlace de firma es un contrato a distancia (art. 1105 CCyC) y la forma escrita se cumple con soporte electrónico (art. 1106). Si se usan medios electrónicos, el proveedor debe informar, además del contenido mínimo del contrato y la facultad de revocar, lo necesario para usar el medio elegido, comprender sus riesgos y saber quién los asume (art. 1107), y debe confirmar por vía electrónica y sin demora la llegada de la aceptación (art. 1108). Conviene que esa confirmación salga apenas se firma, y la bienvenida la reitera con la copia firmada.',
                },
                {
                  lead: 'Deber de información.',
                  nivel: 'ALTO',
                  texto:
                    'El proveedor debe informar en forma cierta, clara y detallada las características esenciales del servicio y las condiciones de su comercialización, de manera gratuita y comprensible (art. 4 LDC y art. 1100 CCyC). El art. 4 LDC pide además soporte físico, salvo que el consumidor opte en forma expresa por otro medio que el proveedor ponga a disposición. Por eso conviene que la opción por el correo y los formatos digitales figure aceptada en el contrato.',
                },
                {
                  lead: 'Ejemplar del contrato.',
                  nivel: 'MEDIO',
                  texto:
                    'El documento se redacta en forma completa, clara y fácilmente legible, sin reenvíos a textos que no se entreguen previa o simultáneamente, y un ejemplar original se entrega al consumidor (art. 10 LDC). En los contratos por adhesión, las cláusulas que reenvían a textos no facilitados antes o al momento de contratar se tienen por no convenidas, también en la contratación electrónica (art. 985 CCyC). La copia firmada con su constancia, enviada por correo, es la forma práctica de cumplirlo y deja prueba de la entrega.',
                },
                {
                  lead: 'Arrepentimiento y su aviso antes de la firma.',
                  nivel: 'ALTO',
                  texto:
                    'En los contratos a distancia, el consumidor puede revocar la aceptación dentro de los 10 días desde la celebración del contrato y el derecho es irrenunciable (art. 1110 CCyC y art. 34 LDC). Si el plazo vence en día inhábil, se prorroga al primer día hábil siguiente. El proveedor debe informarlo en caracteres destacados, como disposición inmediatamente anterior a la firma del consumidor, y si no lo informa el derecho no se extingue (art. 1111 CCyC). La revocación se notifica por escrito o por medios electrónicos o similares (art. 1112) y libera a ambas partes, que se restituyen lo recibido (art. 1113).',
                },
                {
                  lead: 'Botón de arrepentimiento y botón de baja.',
                  nivel: 'MEDIO',
                  texto:
                    'La Disposición 954/2025 de la Subsecretaría de Defensa del Consumidor y Lealtad Comercial unificó ambos regímenes y derogó las Resoluciones 316/2018 y 424/2020. Si el negocio vende a consumidores por canales digitales, los botones tienen que estar disponibles en su sitio o aplicación. La Disposición 3/2026 admite pasos razonables de verificación de identidad.',
                },
                {
                  lead: 'Encuadre de consumo.',
                  nivel: 'MEDIO',
                  texto:
                    'El régimen no alcanza a quien no es destinatario final (arts. 1092 y 1093 CCyC, art. 1 LDC). Declarar en el contrato que no hay relación de consumo no alcanza. Lo que fortalece la posición es registrar en el ingreso a qué se dedica el cliente y para qué usa el servicio.',
                },
                {
                  lead: 'Datos personales e imagen.',
                  nivel: 'MEDIO',
                  texto:
                    'El tratamiento de datos requiere consentimiento libre, expreso e informado, por escrito o por un medio equiparable (art. 5 de la Ley 25.326). No hace falta para los datos que derivan de la relación contractual y son necesarios para cumplirla (art. 5, inc. 2), pero sí para usos que exceden el servicio, como testimonios o comunicaciones comerciales. Al recoger los datos hay que informar la finalidad, los destinatarios, el responsable y los derechos de acceso, rectificación y supresión (art. 6). Captar o reproducir la imagen o la voz de una persona requiere su consentimiento (art. 53 CCyC).',
                },
                {
                  lead: 'Lo dicho integra la oferta.',
                  nivel: 'MEDIO',
                  texto:
                    'Las precisiones de la publicidad y de las comunicaciones comerciales obligan al oferente y se tienen por incluidas en el contrato (art. 8 LDC y art. 1103 CCyC). Por eso el resumen de la reunión de inicio habla de metas y no de promesas de resultado, y nunca agrega lo que el contrato no incluye.',
                },
                {
                  lead: 'Aceptación y silencio.',
                  nivel: 'BAJO',
                  texto:
                    'Toda declaración o acto del destinatario que revela conformidad con la oferta constituye aceptación (art. 979 CCyC), y el silencio solo vale como manifestación de voluntad si existe un deber de expedirse, que puede surgir de la ley, de lo pactado, de los usos o de declaraciones anteriores (art. 263 CCyC). Un cierre de hito sin respuesta prueba lo que se informó, pero no equivale a conformidad salvo que el contrato lo prevea.',
                },
                {
                  lead: 'Consumidores vulnerables.',
                  nivel: 'BAJO',
                  texto:
                    'La Disposición 137/2024 creó un procedimiento especial para consumidores vulnerables o en situación de desventaja por edad, género, condiciones de salud u otras circunstancias. Si en el ingreso aparece una señal de vulnerabilidad, se consulta con legales antes de seguir.',
                },
              ],
            },
            {
              id: 'es',
              titulo: 'España',
              bajada: 'TRLGDCU, Reglamento eIDAS, Ley 6/2020, RGPD y LOPDGDD.',
              items: [
                {
                  lead: 'Información precontractual.',
                  nivel: 'ALTO',
                  texto:
                    'Antes de que el consumidor quede vinculado por un contrato a distancia, el empresario debe facilitarle de forma clara y comprensible la información del art. 97 TRLGDCU, entre ella las características del servicio, su identidad, el precio total y las condiciones, el plazo y el procedimiento del derecho de desistimiento. Esa información forma parte del contrato.',
                },
                {
                  lead: 'Confirmación en soporte duradero.',
                  nivel: 'ALTO',
                  texto:
                    'El empresario debe entregar la confirmación del contrato en un soporte duradero en un plazo razonable y, en los servicios, a más tardar antes de que empiece su ejecución, con la información del art. 97 salvo que ya la haya dado en ese soporte (art. 98.7 TRLGDCU). Por eso la bienvenida con la copia firmada sale antes del primer acceso.',
                },
                {
                  lead: 'Inicio del servicio dentro del plazo.',
                  nivel: 'ALTO',
                  texto:
                    'Si el consumidor quiere que el servicio empiece durante el plazo de desistimiento, el empresario debe exigirle una solicitud expresa (art. 98.8 TRLGDCU), que conviene dejar guardada en un soporte duradero. Si después desiste, abona la parte proporcional ya prestada (art. 108.3), y sin esa solicitud no paga lo prestado durante el plazo (art. 108.4). El derecho se pierde recién cuando el servicio se ejecutó por completo con su consentimiento expreso previo y el reconocimiento de que lo perdería (art. 103 a).',
                },
                {
                  lead: 'Plazo de desistimiento.',
                  nivel: 'MEDIO',
                  texto:
                    'Son 14 días naturales sin indicar motivos (arts. 71 y 102 TRLGDCU). En los servicios corre desde la celebración del contrato (art. 104). Si no se informó el derecho, el plazo termina doce meses después del plazo inicial (art. 105).',
                },
                {
                  lead: 'Firma electrónica.',
                  nivel: 'MEDIO',
                  texto:
                    'El Reglamento (UE) 910/2014, eIDAS, modificado por el Reglamento (UE) 2024/1183, establece que no se pueden negar efectos jurídicos ni admisibilidad como prueba a una firma electrónica por el solo hecho de ser electrónica o de no ser cualificada, y que la cualificada equivale a la manuscrita (art. 25). La Ley 6/2020 remite la prueba de los documentos privados con servicios de confianza no cualificados al art. 326.3 de la Ley de Enjuiciamiento Civil, y para los cualificados al art. 326.4, que presume su corrección (art. 3 de la Ley 6/2020).',
                },
                {
                  lead: 'Datos personales e imagen.',
                  nivel: 'MEDIO',
                  texto:
                    'Al recoger los datos hay que informar la identidad del responsable, la finalidad, la base jurídica, los destinatarios, el plazo de conservación y los derechos (art. 13 RGPD). Los datos necesarios para cumplir el contrato se tratan sobre esa base (art. 6.1.b RGPD) y el consentimiento se reserva para usos adicionales, como testimonios o comunicaciones comerciales (arts. 6.1.a y 7). La LOPDGDD admite informar por capas (art. 11). El uso de la imagen requiere consentimiento expreso (art. 2.2 de la Ley Orgánica 1/1982).',
                },
                {
                  lead: 'Ley aplicable.',
                  nivel: 'BAJO',
                  texto:
                    'Aunque el contrato elija otra ley, el consumidor residente en España conserva la protección imperativa de su ley cuando la empresa dirige su actividad a ese mercado (art. 6 del Reglamento Roma I).',
                },
              ],
            },
            {
              id: 'ajustes',
              titulo: 'Ajustes sugeridos a los contratos',
              bajada: 'Lo que conviene revisar en los modelos para que el protocolo tenga respaldo.',
              items: [
                {
                  lead: 'Acceso después de la firma.',
                  nivel: 'ALTO',
                  texto:
                    'Prever que la prestación empieza con la firma del contrato y la acreditación del pago, y que los accesos se habilitan recién entonces. Evita discutir qué condiciones rigen un servicio que empezó sin firma.',
                },
                {
                  lead: 'Arrepentimiento y desistimiento.',
                  nivel: 'ALTO',
                  texto:
                    'En Argentina, aviso destacado inmediatamente antes de la firma del consumidor. En España, información del art. 97 antes de contratar, casilla de solicitud expresa de inicio dentro del plazo y confirmación en soporte duradero antes del primer acceso.',
                },
                {
                  lead: 'Evidencia de la firma.',
                  nivel: 'MEDIO',
                  texto:
                    'Activar en {firma} las validaciones de identidad que ofrezca la plataforma, como código por correo o por mensaje, foto del documento o selfie, y archivar la constancia de firma con sus marcas de tiempo junto al PDF. Para operaciones de mayor riesgo, evaluar firma digital con certificado.',
                },
                {
                  lead: 'Canal oficial y formato digital.',
                  nivel: 'MEDIO',
                  texto:
                    'Definir en el contrato el canal oficial, el correo para notificaciones y la opción expresa del cliente por recibir la información y su ejemplar en formato digital, sin impedir que el consumidor ejerza sus derechos por el medio con que contrató.',
                },
                {
                  lead: 'Hitos y conformidad.',
                  nivel: 'MEDIO',
                  texto:
                    'Describir los hitos y prever que su cierre por escrito en el canal oficial vale como constancia de prestación, con un plazo para observarlo. Si se pacta que el silencio vale como conformidad, la cláusula se apoya en el art. 263 CCyC, con la reserva que figura en zonas de duda.',
                },
                {
                  lead: 'Consentimientos separados.',
                  nivel: 'MEDIO',
                  texto:
                    'Separar del contrato los consentimientos para uso de imagen, testimonios, registro de sesiones y comunicaciones comerciales, con casillas propias y la posibilidad de revocarlos.',
                },
                {
                  lead: 'Renovación.',
                  nivel: 'BAJO',
                  texto: 'Regular la renovación como un nuevo contrato o una adenda firmada, y prever la baja de accesos al cierre si no se renueva.',
                },
                {
                  lead: 'Atrasos en el pago.',
                  nivel: 'BAJO',
                  texto:
                    'Prever si el atraso habilita a suspender accesos, con qué aviso y por cuánto tiempo, para que la medida tenga base contractual (art. 1031 CCyC). Frente a consumidores, la cláusula se revisa contra el art. 37 LDC.',
                },
              ],
            },
            {
              id: 'dudas',
              titulo: 'Zonas de duda',
              bajada: 'Puntos donde la interpretación no es pacífica. Se deciden caso por caso con legales.',
              items: [
                {
                  lead: 'Valor probatorio de la firma electrónica simple.',
                  texto:
                    'En Argentina no está resuelto si el documento con firma electrónica es un instrumento firmado o un instrumento particular no firmado (arts. 287 y 288 CCyC). Hay fallos que exigen firma digital y otros que admiten la electrónica cuando la plataforma acredita identidad e integridad y la conducta posterior es coherente, como los pagos y el uso del servicio. En España la firma no cualificada tiene efectos, pero su peso depende de la prueba (art. 326.3 de la Ley de Enjuiciamiento Civil).',
                },
                {
                  lead: 'Accesos habilitados antes de la firma.',
                  texto:
                    'Si el cliente pagó y usó el servicio sin firmar, puede haber contrato por aceptación mediante actos (art. 979 CCyC), pero es discutible qué condiciones aceptó. En los contratos por adhesión, lo que no se le facilitó se tiene por no convenido (art. 985 CCyC) y, con consumidores, la duda se interpreta a su favor (art. 1095 CCyC y art. 37 LDC).',
                },
                {
                  lead: 'Ejemplar e información en soporte digital.',
                  texto:
                    'El art. 10 LDC está escrito para el documento de venta de cosas y pide entregar un ejemplar original, y el art. 4 LDC pide soporte físico salvo opción expresa del consumidor. No hay criterio uniforme sobre si alcanza con enviar el PDF firmado ni sobre cómo se acredita esa opción en una venta íntegramente digital.',
                },
                {
                  lead: 'Conformidad tácita de hitos.',
                  texto:
                    'Pactar que el silencio vale como aprobación es defendible entre empresas (art. 263 CCyC), pero frente a consumidores puede cuestionarse como cláusula abusiva (art. 37 LDC, arts. 988 y 1119 CCyC).',
                },
                {
                  lead: 'Servicio iniciado dentro del plazo de arrepentimiento.',
                  texto: 'Argentina no tiene una regla de pago proporcional como la española, y el alcance de la restitución cuando se revoca un servicio ya prestado es discutible.',
                },
                {
                  lead: 'Plataforma de contenidos y excepciones.',
                  texto:
                    'No es pacífico si el acceso a una plataforma como {contenidos} entra en las excepciones del art. 1116 CCyC o, en España, en la del contenido digital sin soporte material (art. 103 m TRLGDCU), cuando el programa combina contenidos con acompañamiento.',
                },
                {
                  lead: 'Pequeño emprendedor.',
                  texto: 'Hay criterio que lo protege como consumidor cuando el servicio no se integra de modo directo a su actividad. Los tribunales están divididos.',
                },
                {
                  lead: 'Función de desistimiento en la Unión Europea.',
                  texto:
                    'La Directiva (UE) 2023/2673 exige, desde el 19 de junio de 2026, una función de desistimiento en los contratos celebrados mediante interfaces en línea. Antes de diseñar el proceso de baja para España conviene confirmar con legales cómo quedó incorporada al TRLGDCU.',
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
            { rotulo: 'Tres reglas', numerada: true, lista: ['Nadie entra sin contrato firmado y pago acreditado.', 'La bienvenida también es prueba.', 'Cada hito se cierra por escrito.'] },
            {
              rotulo: 'Antes de habilitar accesos',
              numerada: true,
              lista: ['¿Está firmado en {firma}?', '¿Está acreditado el pago a nombre del titular?', '¿Recibió su copia firmada?', '¿Sabe cuál es el canal oficial?'],
            },
            {
              rotulo: 'Tres nunca',
              tono: 'nunca',
              lista: ['Nunca habilites accesos sin firma.', 'Nunca prometas un resultado como meta del programa.', 'Nunca leas el silencio como conformidad.'],
            },
            [
              { rotulo: 'Plazos clave', texto: 'Bienvenida en 24 horas. Reunión de inicio dentro de {diasInicio}. Primer resultado dentro de {diasResultado}.' },
              puedeSerConsumidor
                ? { rotulo: 'Con consumidores', texto: 'Arrepentimiento destacado antes de la firma y vencimiento agendado, {dias}.' }
                : { rotulo: 'Con empresas', texto: 'Registrá a qué se dedica el cliente y para qué contrata.' },
            ],
            [
              { rotulo: 'Si dudás', texto: 'Esperá la firma. Un acceso que llega un día tarde cuesta menos que un servicio sin contrato.' },
              { rotulo: 'Siempre', texto: 'Todo por escrito en {canal}, el mismo día.' },
            ],
          ],
        },
      ],
    },
  ];
}

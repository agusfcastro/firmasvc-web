// Contenido del protocolo de marketing y publicidad.
// Regla de estilo de FIRMA para estos textos, sin rayas ni dos puntos.

import { bool, opcion } from '../motor/ficha';
import type { BloqueGuion, Ficha, Guion, Nivel, ResultadoSemaforo, Seccion } from '../motor/tipos';

// Semáforo de testimonios

const ORDEN: Record<Nivel, number> = { info: 0, verde: 1, ambar: 2, rojo: 3 };

function peor(a: Nivel, b: Nivel): Nivel {
  return ORDEN[b] > ORDEN[a] ? b : a;
}

function evaluarTestimonio(r: Record<string, string>, f: Ficha): ResultadoSemaforo | null {
  if (!r.autorizacion || !r.representativo || !r.beneficio || !r.tema || !r.terceros) return null;
  const espana = opcion(f, 'mercado') === 'ES';
  const pasos: string[] = [];
  let nivel: Nivel = 'verde';

  if (r.autorizacion === 'no') {
    nivel = peor(nivel, 'rojo');
    pasos.push('Sin autorización escrita no se publica. Pedila con la plantilla de autorización y esperá la firma antes de usar el material.');
  }
  if (r.autorizacion === 'otra') {
    nivel = peor(nivel, 'rojo');
    pasos.push('La autorización no cubre este uso o ya venció. Pedí una nueva que incluya esta pieza, estos canales y el plazo de circulación.');
  }
  if (r.terceros === 'si') {
    nivel = peor(nivel, 'rojo');
    pasos.push(
      'Aparecen menores o datos de otras personas. Se recortan o se pixelan. Si se quiere mostrar a un menor, firman quienes ejercen la responsabilidad parental y revisa legales.',
    );
  }
  if (r.beneficio === 'oculto') {
    nivel = peor(nivel, 'rojo');
    pasos.push('La persona recibió algo a cambio y la pieza no lo dice. Agregalo de forma visible, por ejemplo Recibió el programa sin costo a cambio de contar su experiencia.');
  }
  if (r.beneficio === 'aclarado') {
    pasos.push('El beneficio está aclarado. Verificá que se vea sin abrir el texto completo ni tocar ver más.');
  }
  if (r.representativo === 'excepcional') {
    nivel = peor(nivel, 'ambar');
    pasos.push('Es un caso destacado. Se publica con su contexto, como punto de partida, tiempo y dedicación, y con el aviso de resultados, sin presentarlo como lo habitual.');
  }
  if (r.representativo === 'nose') {
    nivel = peor(nivel, 'ambar');
    pasos.push('No se sabe si el resultado es habitual. Se publica como caso individual, con su contexto y el aviso de resultados, o no se publica.');
  }
  if (r.tema === 'dinero') {
    nivel = peor(nivel, 'ambar');
    pasos.push('Habla de ingresos o inversiones. Las cifras tienen respaldo, se aclara si son ingresos brutos y nunca se presentan rentabilidades como esperables.');
  }
  if (r.tema === 'salud') {
    nivel = peor(nivel, espana ? 'rojo' : 'ambar');
    pasos.push(
      espana
        ? 'Habla de salud. En España la publicidad con pretendida finalidad sanitaria no puede apoyarse en testimonios de pacientes (Real Decreto 1907/1996). Lo decide legales antes de publicar.'
        : 'Habla de salud. No se muestran cambios físicos ni mejoras de una condición como resultado del programa, y la pieza la revisa legales antes de publicarse.',
    );
  }

  let titulo = 'Se puede publicar.';
  if (nivel === 'rojo') titulo = 'No se publica así. Corregí lo indicado y volvé a evaluar.';
  else if (nivel === 'ambar') titulo = 'Se publica solo con los ajustes indicados.';

  if (nivel === 'verde') pasos.push('Pasá la pieza por el revisor, archivá la autorización junto con la versión publicada y anotá el uso en el registro de testimonios.');
  else pasos.push('Con los ajustes hechos, la pieza vuelve al revisor de piezas antes de la aprobación.');

  return { nivel, titulo, pasos };
}

// Métricas de adquisición

function div(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

function pct(a: number | null, b: number | null): number | null {
  const d = div(a, b);
  return d === null ? null : d * 100;
}

function valorVida(v: Record<string, number | null>): number | null {
  if (v.ticket === null || v.margen === null || v.meses === null) return null;
  return v.ticket * (v.margen / 100) * v.meses;
}

function roas(v: Record<string, number | null>): number | null {
  if (v.ventas === null || v.ticket === null) return null;
  return div(v.ventas * v.ticket, v.inversion);
}

// Revisor de piezas

const SENALES = [
  { id: 'resultados', texto: 'Promete ingresos, ventas o resultados concretos, con cifras o plazos.', peso: 3 },
  { id: 'garantia', texto: 'Usa garantizado, sin riesgo, asegurado, 100% o fórmulas equivalentes.', peso: 3 },
  { id: 'respaldo', texto: 'Afirma datos sin respaldo archivado, como cantidad de alumnos, facturación, premios, avales o ser el número uno.', peso: 2 },
  { id: 'urgencia', texto: 'Anuncia plazos, cupos o precios de lanzamiento que no están en bases escritas.', peso: 3 },
  { id: 'testimonio', texto: 'Usa un testimonio, una reseña o la imagen de una persona sin autorización escrita archivada.', peso: 3 },
  { id: 'antesDespues', texto: 'Muestra un antes y después o cambios físicos, de peso o de salud.', peso: 3 },
  { id: 'regulado', texto: 'Habla de curar, tratar o prevenir, o de rentabilidades, inversiones o asesoramiento financiero.', peso: 2 },
  { id: 'comparacion', texto: 'Compara con competidores identificables o los menciona.', peso: 2 },
  { id: 'terceros', texto: 'Usa marcas, logos, imágenes, música o contenidos de terceros sin licencia.', peso: 2 },
  { id: 'tachado', texto: 'Muestra un precio tachado o un descuento sin un precio anterior real y documentado.', peso: 2 },
  { id: 'encubierta', texto: 'Es una colaboración con influencer, afiliado o creador y no se identifica como publicidad desde el inicio.', peso: 3 },
  { id: 'menores', texto: 'Aparecen menores de edad o sus datos.', peso: 3 },
];

// Reglas por nicho, coherentes con el protocolo de llamadas de venta

type ClaveNicho = 'general' | 'salud' | 'finanzas' | 'inmobiliario';

const NICHOS: { clave: ClaveNicho; titulo: string; subtitulo: string; reglas: string; nunca: string[]; segura: string }[] = [
  {
    clave: 'general',
    titulo: 'Negocios, ventas y formación',
    subtitulo: 'Programas para emprendedores, consultoras y equipos comerciales.',
    reglas:
      'Los resultados se muestran como casos individuales y con contexto. El programa se presenta como formación y acompañamiento, nunca como garantía de ingresos o de ventas. Las cifras de facturación de alumnos se respaldan con documentos y se publican con su autorización.',
    nunca: [
      'Prometer facturación, clientes o ventas en un plazo.',
      'Mostrar capturas de pagos o de cuentas sin contexto ni autorización.',
      'Presentar ingresos brutos como si fueran ganancia.',
    ],
    segura: 'Un programa para ordenar tu proceso comercial, con acompañamiento semanal. Los resultados dependen de tu punto de partida y de tu implementación.',
  },
  {
    clave: 'salud',
    titulo: 'Salud y bienestar',
    subtitulo: 'Hábitos, entrenamiento, nutrición y bienestar emocional.',
    reglas:
      'La evaluación, las indicaciones y cualquier tratamiento los define un profesional de la salud habilitado, nunca una pieza. No se prometen cambios físicos, hormonales o de salud ni plazos para lograrlos. Los suplementos y productos no se presentan como curativos. Las piezas de este nicho pasan siempre por legales.',
    nunca: [
      'Mostrar un antes y después como resultado esperable.',
      'Usar curar, tratar, revertir o eliminar referidos a una enfermedad o condición.',
      'Publicar testimonios sobre síntomas, diagnósticos o medicación.',
    ],
    segura: 'Un programa para construir hábitos de [[área]] con acompañamiento. No reemplaza la consulta con un profesional de la salud.',
  },
  {
    clave: 'finanzas',
    titulo: 'Finanzas e inversiones',
    subtitulo: 'Educación financiera, trading, criptoactivos e inversiones.',
    reglas:
      'El programa se presenta como formación, nunca como asesoramiento financiero. No se recomiendan activos, operaciones ni intermediarios, no se proyectan rentabilidades y no se muestran resultados de inversión como esperables. Toda pieza que mencione activos concretos o rendimientos pasa por legales.',
    nunca: [
      'Mostrar rentabilidades, operaciones o saldos como resultado esperable.',
      'Usar seguro, sin riesgo o ingreso pasivo garantizado.',
      'Invitar a invertir en un producto propio o de un tercero desde una pieza del programa.',
    ],
    segura: 'Aprendé a analizar inversiones con criterio propio. El programa es formación y no constituye asesoramiento financiero. Invertir implica riesgo de pérdida.',
  },
  {
    clave: 'inmobiliario',
    titulo: 'Sector inmobiliario',
    subtitulo: 'Corredores, desarrolladores e inversores inmobiliarios.',
    reglas:
      'No se prometen operaciones, captaciones ni comisiones. No se opina sobre requisitos de matrícula o habilitación de cada jurisdicción. Los casos de éxito se presentan con su contexto, como zona, equipo y años de experiencia, y no se muestran propiedades de terceros sin autorización.',
    nunca: [
      'Prometer una cantidad de operaciones o de comisiones por mes.',
      'Presentar como propia una operación ajena o de la agencia.',
      'Sugerir que el programa habilita para ejercer el corretaje.',
    ],
    segura: '[[Nombre]], corredor en [[zona]] con [[años]] de experiencia y un equipo de [[cantidad]] personas, cerró [[operación]] durante el programa. Es su caso y no un resultado típico.',
  },
];

// Secciones

export function secciones(f: Ficha): Seccion[] {
  const mercado = opcion(f, 'mercado');
  const espana = mercado === 'ES';
  const argentina = mercado === 'AR';
  const nicho = opcion(f, 'nicho');
  const salud = nicho === 'salud';
  const finanzas = nicho === 'finanzas';
  const testimonios = bool(f, 'testimonios');
  const influencers = bool(f, 'influencers');
  const promociones = bool(f, 'promociones');
  const comunicaciones = bool(f, 'comunicaciones');
  const llamadas = bool(f, 'llamadas');

  // Plantillas

  const guionResultados: Guion = {
    id: 'resultados',
    titulo: 'Aviso de resultados',
    bajada: 'Va en toda pieza que muestre resultados, cifras o casos. Lo incluye {respMarketing}.',
    bloques: [
      {
        tipo: 'decir',
        etiqueta: 'Versión corta para redes y anuncios',
        texto: 'Resultados individuales. Dependen del punto de partida, la dedicación y la implementación de cada persona. No son una promesa ni un resultado típico.',
      },
      {
        tipo: 'decir',
        etiqueta: 'Versión completa para la página de venta',
        texto:
          'Los casos que mostramos son reales y están documentados, pero no son típicos ni representan lo que obtiene cada participante. Los resultados dependen del punto de partida, la experiencia, el tiempo dedicado, el mercado y la implementación de cada persona. {programa} es un programa de [[formación y acompañamiento]] y no garantiza ingresos, ventas ni resultados de ningún tipo. El alcance del servicio es el que figura en el contrato, que se entrega antes del pago.',
      },
      {
        tipo: 'decir',
        etiqueta: 'Dicho en un video o en un vivo',
        texto: 'Lo que vas a ver son casos reales, pero son casos individuales. Tus resultados dependen de dónde arrancás y de lo que hagas con lo que aprendas.',
      },
      {
        tipo: 'decir',
        etiqueta: 'Contexto de un caso de éxito',
        texto: '[[Nombre]] llegó con [[situación inicial]]. En [[plazo]] y dedicando [[horas]] por semana logró [[resultado verificable]]. Es su caso y no un resultado típico.',
      },
      {
        tipo: 'nota',
        etiqueta: 'Dónde va',
        texto: 'Cerca del resultado, legible y sin abrir el texto completo. En los videos se dice en voz y se muestra en pantalla mientras aparece la cifra.',
      },
      {
        tipo: 'porque',
        texto: 'El aviso no vuelve lícita una pieza engañosa. Sirve cuando el resultado es real y está documentado, y le da contexto para que no se lea como promesa.',
      },
      {
        tipo: 'nunca',
        textos: [
          'Usar el aviso para publicar resultados que no se pueden respaldar.',
          'Esconderlo en letra chica, al pie o detrás de un ver más.',
          'Decir que un resultado es típico sin datos de todos los participantes.',
        ],
      },
    ],
  };

  const guionTestimonios: Guion = {
    id: 'testimonios',
    titulo: 'Testimonios',
    bajada: 'Pedido por chat y autorización por escrito. Nada se publica sin la autorización archivada.',
    bloques: [
      {
        tipo: 'decir',
        etiqueta: 'Pedido de testimonio',
        texto:
          '¡Hola [[nombre]]! Nos alegra mucho cómo te está yendo con {programa}. ¿Te gustaría contar tu experiencia para que otras personas la conozcan? Si te interesa, te mandamos un formulario corto donde elegís qué se puede usar, en qué canales y por cuánto tiempo. No hay ningún compromiso y tu respuesta no cambia en nada tu acompañamiento.',
      },
      {
        tipo: 'decir',
        etiqueta: 'Si se ofrece algo a cambio',
        texto:
          'Como agradecimiento te ofrecemos [[beneficio]]. Si aceptás, lo vamos a aclarar en cada publicación, porque corresponde y porque cuida tu credibilidad y la nuestra.',
      },
      {
        tipo: 'decir',
        etiqueta: 'Autorización de uso de testimonio e imagen',
        texto:
          'Yo, [[nombre completo]], [[documento]], autorizo a {empresa} a usar mi testimonio sobre {programa}, junto con mi nombre, mi imagen y mi voz, tal como figuran en [[detalle del material, por ejemplo el video del día y la captura del mensaje]]. Usos autorizados, [[publicaciones, anuncios pagos, página de venta, correos]]. Canales, [[canales]]. Plazo, [[plazo]] desde la firma. {empresa} puede editar el material para adaptarlo al formato, sin alterar su sentido ni agregar afirmaciones que no hice. Declaro que lo que cuento es verdadero y refleja mi experiencia personal. [[No recibí nada a cambio, o recibí tal beneficio, que se informará en cada publicación]]. Puedo revocar esta autorización en cualquier momento escribiendo a {correoLegales}, y {empresa} retirará el material de sus canales y anuncios activos dentro de [[plazo de retiro]]. Firmo en [[lugar]], el [[fecha]].',
      },
      {
        tipo: 'nota',
        etiqueta: 'Cómo se firma',
        texto: 'Con la misma plataforma de firma del contrato o con un formulario que registre la aceptación, la fecha y el material autorizado. Se archiva junto con la pieza.',
      },
      {
        tipo: 'nota',
        etiqueta: 'Menores y terceros',
        texto: 'Si aparece un menor, firman quienes ejercen la responsabilidad parental y revisa legales. Si aparecen otras personas, cada una firma su autorización o se las recorta.',
      },
      {
        tipo: 'porque',
        texto:
          'La imagen y la voz solo se usan con consentimiento ({normaImagen}). La autorización escrita lo prueba, fija el alcance del uso y evita que una revocación sorprenda a la campaña.',
      },
      {
        tipo: 'nunca',
        textos: [
          'Publicar un mensaje privado o una captura sin autorización, aunque sea un elogio.',
          'Editar un testimonio para que diga algo que la persona no dijo.',
          'Ocultar que la persona recibió algo a cambio.',
        ],
      },
    ],
  };

  const bloquesInfluencers: BloqueGuion[] = [
    {
      tipo: 'decir',
      etiqueta: 'Instrucción para el brief del creador',
      texto:
        'Cada pieza sobre {programa} se identifica como publicidad desde el inicio, en el texto y con la etiqueta de colaboración pagada de la plataforma. No se prometen ingresos ni resultados, no se usan expresiones como garantizado o sin riesgo y no se anuncian plazos, cupos o descuentos distintos de los vigentes. El texto final se envía a {empresa} para su aprobación antes de publicar.',
    },
    { tipo: 'decir', etiqueta: 'Identificación en una colaboración pagada', texto: 'Publicidad. Colaboración pagada con {empresa}.' },
    { tipo: 'decir', etiqueta: 'Identificación de un afiliado', texto: 'Publicidad. Si comprás con mi enlace, {empresa} me paga una comisión.' },
    { tipo: 'decir', etiqueta: 'Acceso o producto sin costo', texto: 'Publicidad. {empresa} me dio acceso sin costo a {programa}.' },
    {
      tipo: 'decir',
      etiqueta: 'Pedido de corrección',
      texto:
        '[[Nombre]], vimos tu publicación del [[fecha]] sobre {programa}. Para que cumpla con lo acordado necesitamos que agregues Publicidad. Colaboración pagada con {empresa} al inicio del texto, que actives la etiqueta de colaboración pagada y que quites [[afirmación a corregir]]. ¿Lo podés ajustar hoy? Si no es posible, te pedimos que la archives hasta corregirla.',
    },
  ];
  if (espana) {
    bloquesInfluencers.push({
      tipo: 'nota',
      etiqueta: 'Usuarios de especial relevancia',
      texto:
        'Si el creador supera los umbrales del Real Decreto 444/2024, tiene que estar inscripto en el registro estatal de prestadores de servicios de comunicación audiovisual. Pedile que lo confirme por escrito antes de firmar.',
    });
  }
  bloquesInfluencers.push(
    {
      tipo: 'porque',
      texto:
        'La relación comercial entre la marca y el creador cambia cómo se lee el mensaje. Si no se identifica, la pieza es publicidad encubierta, y la marca responde por lo que se publica en su nombre.',
    },
    {
      tipo: 'nunca',
      textos: [
        'Pedirle al creador que no aclare la colaboración.',
        'Esconder la identificación entre hashtags o al final del texto.',
        'Dejar que el creador improvise resultados, descuentos o cupos.',
      ],
    },
  );

  const guionInfluencers: Guion = {
    id: 'influencers',
    titulo: 'Influencers y afiliados',
    bajada: 'Identificación publicitaria visible desde el inicio. La controla {respAprobacion}.',
    bloques: bloquesInfluencers,
  };

  const bloquesPromocion: BloqueGuion[] = [
    {
      tipo: 'decir',
      etiqueta: 'Bases de la promoción',
      texto:
        'Bases de la promoción [[nombre de la promoción]] de {empresa} para {programa}. Vigencia, desde el [[fecha y hora de inicio]] hasta el [[fecha y hora de fin]], hora de [[país]]. Beneficio, [[descuento, bono o condición especial]], aplicable sobre el precio regular de [[precio]], que es el precio efectivamente cobrado durante [[período anterior]]. Cupos, [[cantidad]] lugares, asignados por orden de pago confirmado. Si los cupos se completan antes del fin de la vigencia, la promoción termina y se informa en los mismos canales en que se anunció. Condiciones, [[requisitos, medios de pago y si se acumula con otras promociones]]. Las demás condiciones del programa son las del contrato, que se entrega antes del pago. Consultas a {correoLegales}.',
    },
    {
      tipo: 'decir',
      etiqueta: 'Anuncio en la pieza',
      texto: 'Inscripción con [[beneficio]] hasta el [[fecha]] a las [[hora]] o hasta completar [[cantidad]] lugares, lo que ocurra primero. Bases en [[enlace]].',
    },
    {
      tipo: 'decir',
      etiqueta: 'Cierre real',
      texto: 'Se completaron los [[cantidad]] lugares de la promoción [[nombre]]. Gracias a quienes se sumaron. La próxima apertura se anuncia por este canal.',
    },
    { tipo: 'decir', etiqueta: 'Extensión', texto: 'Extendemos la promoción hasta el [[fecha]] porque [[motivo real]]. No va a haber nuevas prórrogas.' },
  ];
  if (argentina) {
    bloquesPromocion.push({
      tipo: 'nota',
      etiqueta: 'Sorteos en Argentina',
      texto: 'Un sorteo o concurso no puede exigir una compra para participar. Si hay sorteo, la participación es gratuita y tiene sus propias bases, que revisa legales.',
    });
  }
  if (espana) {
    bloquesPromocion.push({
      tipo: 'nota',
      etiqueta: 'Promociones en España',
      texto: 'Las promociones y concursos que se comunican por medios electrónicos se identifican como tales y sus condiciones de acceso y participación tienen que ser claras e inequívocas.',
    });
  }
  bloquesPromocion.push(
    {
      tipo: 'porque',
      texto:
        'La oferta pública obliga durante su vigencia y tiene que decir cuándo empieza y cuándo termina. Un cupo inventado o una prórroga encubierta convierten la urgencia en engaño.',
    },
    {
      tipo: 'nunca',
      textos: ['Anunciar cupos sin un número real detrás.', 'Reabrir la misma promoción con otro nombre al día siguiente del cierre.', 'Tachar un precio que nunca se cobró.'],
    },
  );

  const guionPromocion: Guion = {
    id: 'promocion',
    titulo: 'Promociones',
    bajada: 'Bases escritas antes de anunciar. El plazo y los cupos tienen que ser reales.',
    bloques: bloquesPromocion,
  };

  const avisoPrivacidad = espana
    ? 'Responsable, {empresa}. Finalidad, atender tu solicitud, [[finalidad concreta, por ejemplo coordinar la llamada que pediste]] y, si lo aceptás en la casilla, enviarte comunicaciones comerciales. Legitimación, tu solicitud y, para las comunicaciones, tu consentimiento. Derechos, acceso, rectificación, supresión, oposición y los demás que reconoce el RGPD, escribiendo a {correoPrivacidad}. Más información en {politica}.'
    : argentina
      ? 'Los datos que completás los usa {empresa} para responder tu consulta y [[finalidad concreta, por ejemplo coordinar la llamada que pediste]]. No los vendemos ni los cedemos con fines publicitarios. Podés acceder a ellos, rectificarlos, pedir su supresión y pedir su retiro o bloqueo de nuestras bases de publicidad escribiendo a {correoPrivacidad}. Más información en la política de privacidad, {politica}.'
      : 'Los datos que completás los usa {empresa} para responder tu consulta y [[finalidad concreta]]. No los vendemos ni los cedemos con fines publicitarios. Podés ejercer tus derechos sobre ellos escribiendo a {correoPrivacidad}. Más información en la política de privacidad, {politica}.';

  const bloquesFormularios: BloqueGuion[] = [
    { tipo: 'decir', etiqueta: 'Aviso de privacidad debajo del formulario', texto: avisoPrivacidad },
    {
      tipo: 'decir',
      etiqueta: 'Casilla de comunicaciones',
      texto: 'Quiero recibir novedades, contenidos y ofertas de {empresa} por correo y por WhatsApp. Puedo darme de baja cuando quiera.',
    },
  ];
  if (llamadas) {
    bloquesFormularios.push({
      tipo: 'decir',
      etiqueta: 'Casilla de llamadas',
      texto: 'Acepto que {empresa} me llame para [[motivo, por ejemplo coordinar una llamada de diagnóstico]]. Puedo pedir que no me llamen más en cualquier momento.',
    });
  }
  bloquesFormularios.push(
    {
      tipo: 'nota',
      etiqueta: 'Cómo van las casillas',
      texto:
        'Separadas del botón de envío, sin marcar de antemano y sin condicionar la consulta. La herramienta registra la fecha, el texto aceptado y el formulario de origen.',
    },
    { tipo: 'nota', etiqueta: 'Versión completa', texto: 'La política completa y los plazos de conservación están en el protocolo de datos personales.' },
    {
      tipo: 'porque',
      texto:
        'El consentimiento para comunicaciones comerciales tiene que ser libre, informado y separado ({normaDatos}). Una casilla premarcada o atada al envío del formulario no prueba nada.',
    },
    {
      tipo: 'nunca',
      textos: ['Premarcar la casilla de comunicaciones.', 'Pedir datos que no se van a usar.', 'Usar los datos de un formulario para otra marca o venderlos.'],
    },
  );

  const guionFormularios: Guion = {
    id: 'formularios',
    titulo: 'Formularios',
    bajada: 'Aviso corto debajo de cada formulario y casillas separadas para comunicaciones. Lo publica {respMarketing}.',
    bloques: bloquesFormularios,
  };

  const bloquesComunicaciones: BloqueGuion[] = [
    {
      tipo: 'decir',
      etiqueta: 'Primer mensaje por WhatsApp a quien aceptó',
      texto:
        '¡Hola [[nombre]]! Te escribimos de {empresa} porque dejaste tus datos en [[formulario o evento]] y aceptaste recibir novedades por acá. Si preferís no recibir más mensajes, respondé BAJA y no te escribimos más.',
    },
    {
      tipo: 'decir',
      etiqueta: 'Pie de correo comercial',
      texto:
        'Recibís este correo porque te suscribiste en [[origen]]. Si no querés recibir más comunicaciones comerciales de {empresa}, tocá darte de baja o escribí a {correoPrivacidad}. La baja es gratuita y se aplica en todas nuestras listas.',
    },
  ];
  if (espana) {
    bloquesComunicaciones.push(
      { tipo: 'decir', etiqueta: 'Asunto de un correo comercial', texto: 'Publicidad. [[asunto]]' },
      {
        tipo: 'nota',
        etiqueta: 'Por qué publicidad en el asunto',
        texto: 'En España los correos comerciales llevan al comienzo la palabra publicidad o la abreviatura publi, y van solo a quien los pidió o autorizó, salvo clientes sobre servicios similares.',
      },
    );
  }
  bloquesComunicaciones.push({
    tipo: 'decir',
    etiqueta: 'Confirmación de la baja',
    texto:
      'Listo [[nombre]], procesamos tu baja. No vas a recibir más comunicaciones comerciales de {empresa}. Si tenés una consulta sobre un servicio contratado, te seguimos respondiendo por el canal habitual.',
  });
  if (argentina) {
    bloquesComunicaciones.push({
      tipo: 'nota',
      etiqueta: 'Retiro o bloqueo',
      texto: 'En Argentina cada comunicación publicitaria indica en forma destacada cómo pedir el retiro o bloqueo de los datos y, a pedido, de dónde se obtuvieron.',
    });
  }
  bloquesComunicaciones.push(
    {
      tipo: 'nota',
      etiqueta: 'Plazo de la baja',
      texto: 'La baja se procesa en el día en todas las herramientas, incluidas las audiencias de anuncios armadas con listas de contactos.',
    },
    {
      tipo: 'porque',
      texto:
        'Quien pide la baja y sigue recibiendo mensajes pasa de prospecto a denunciante. La baja simple cuida la reputación del remitente y la llegada de los próximos envíos.',
    },
    {
      tipo: 'nunca',
      textos: ['Pedir motivos para dar de baja.', 'Pasar a la persona a otra lista o escribirle desde otro número.', 'Exigir un trámite distinto del que se usó para suscribirse.'],
    },
  );

  const guionComunicaciones: Guion = {
    id: 'comunicaciones',
    titulo: 'Comunicaciones y bajas',
    bajada: 'Solo a quien aceptó, identificadas como comerciales y con baja simple en cada envío.',
    bloques: bloquesComunicaciones,
  };

  const guiones: Guion[] = [guionResultados];
  if (testimonios) guiones.push(guionTestimonios);
  if (influencers) guiones.push(guionInfluencers);
  if (promociones) guiones.push(guionPromocion);
  guiones.push(guionFormularios);
  if (comunicaciones) guiones.push(guionComunicaciones);

  // Control antes de publicar

  const itemsControl: { id: string; texto: string; critico: boolean }[] = [
    { id: 'c1', texto: 'Pasó por el revisor de piezas y quedó en verde, o en ámbar con todas las correcciones hechas.', critico: true },
    { id: 'c2', texto: 'Cada cifra, dato o afirmación objetiva tiene su respaldo archivado.', critico: true },
    { id: 'c3', texto: 'Los resultados que se muestran llevan contexto y el aviso de resultados.', critico: true },
    { id: 'c4', texto: 'Lo que dice la pieza coincide con el contrato y con lo que se ofrece en la llamada de venta.', critico: true },
  ];
  if (testimonios) itemsControl.push({ id: 'c5', texto: 'Cada testimonio, reseña o imagen de una persona tiene autorización escrita vigente para este uso.', critico: true });
  if (promociones) itemsControl.push({ id: 'c6', texto: 'El plazo, los cupos y el precio de referencia son reales y están en las bases escritas.', critico: true });
  if (influencers) itemsControl.push({ id: 'c7', texto: 'Si es una colaboración, se identifica como publicidad desde el inicio y con la etiqueta de la plataforma.', critico: true });
  if (comunicaciones) itemsControl.push({ id: 'c8', texto: 'Si es un envío por correo o mensajería, va solo a quien dio su consentimiento e incluye la forma de darse de baja.', critico: true });
  if (salud || finanzas) itemsControl.push({ id: 'c9', texto: 'Por ser del {nichoTexto}, la revisó legales.', critico: true });
  itemsControl.push(
    { id: 'c10', texto: 'La aprobó {respAprobacion} por escrito, sobre esta versión final.', critico: true },
    { id: 'e1', texto: 'El precio total y las condiciones relevantes se ven, no solo la cuota.', critico: false },
    { id: 'e2', texto: 'No usa marcas, imágenes, música ni contenidos de terceros sin licencia.', critico: false },
    { id: 'e3', texto: 'No aparecen menores ni datos de terceros, o legales revisó su autorización.', critico: false },
    { id: 'e4', texto: 'Si menciona a competidores, la comparación es objetiva y verificable, y la revisó legales.', critico: false },
    { id: 'e5', texto: 'La versión final queda archivada con fecha, canales y respaldo el mismo día en que se publica.', critico: false },
    { id: 'e6', texto: 'Hay una persona asignada para monitorear comentarios mientras la pieza circula.', critico: false },
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
            'Este protocolo ordena cómo {empresa} crea, revisa, aprueba, publica y archiva sus piezas de marketing en {canales}. Vale para anuncios, páginas de venta, publicaciones, historias, videos, vivos, correos, mensajes y todo lo que influencers o afiliados publiquen en su nombre. Los datos del negocio se completan una vez en la ficha y se actualizan solos en todas las plantillas.',
        },
        {
          tipo: 'parrafo',
          texto:
            'El objetivo es vender sin prometer de más. Que cada afirmación tenga respaldo, que cada testimonio esté autorizado, que la urgencia sea real y que la publicidad se identifique como tal. Lo que se publica integra la oferta, así que un error en una pieza se paga después en reclamos, devoluciones y sanciones.',
        },
        { tipo: 'leyenda' },
        {
          tipo: 'roles',
          items: [
            { rol: 'Marketing', foco: 'Brief, redacción, respaldo de cada afirmación, publicación y archivo de la versión publicada.' },
            { rol: 'Aprobación', foco: 'Revisor de piezas, cotejo del respaldo y aprobación escrita de la versión final.' },
            { rol: 'Comercial', foco: 'Coherencia entre lo que promete la pieza y lo que se dice en la llamada de venta.' },
            { rol: 'Legales', foco: 'Piezas en rojo, nichos regulados, promociones, testimonios sensibles, influencers y reclamos.' },
            { rol: 'Dirección', foco: 'Presupuesto, tablero de métricas y decisiones sobre piezas que legales no recomienda publicar.' },
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            'Este protocolo trabaja junto con otros tres. El de llamadas de venta, porque lo que promete una pieza y lo que se dice en la llamada tienen que coincidir. El de conflictos, para los reclamos que citan una pieza. Y el de datos personales, para formularios y bases de contactos.',
        },
      ],
    },
    {
      id: 'ficha',
      titulo: 'Ficha del negocio',
      corto: 'Ficha del negocio',
      intro: 'Se completa una sola vez por negocio. Las plantillas, el revisor y las reglas del nicho se actualizan solos.',
      bloques: [{ tipo: 'ficha' }],
    },
    {
      id: 'principios',
      titulo: 'Cinco principios',
      corto: 'Principios',
      intro: 'Valen para cualquier pieza, en cualquier canal. Si el equipo recuerda solo esto, ya evita la mayoría de los errores.',
      bloques: [
        {
          tipo: 'reglas',
          items: [
            {
              titulo: 'Toda pieza es una oferta.',
              texto:
                'Lo que se publica integra la oferta y se puede exigir aunque el contrato no lo diga ({normaOferta}). Antes de publicar, la pregunta es si se puede cumplir y probar. Si la respuesta es no, la pieza se reescribe.',
            },
            {
              titulo: 'Resultados con contexto o no se publican.',
              texto:
                'Cada resultado que se muestra es real, está documentado y lleva su contexto, como punto de partida, tiempo y dedicación, junto con el aviso de resultados. Un caso excepcional presentado como normal es publicidad engañosa.',
            },
            {
              titulo: 'La urgencia tiene que ser real.',
              texto:
                'Plazos, cupos y precios de lanzamiento existen en bases escritas antes de anunciarse y se cumplen. Si una promoción se extiende, se anuncia como extensión, nunca como un cupo que se liberó por casualidad.',
            },
            {
              titulo: 'Testimonios reales y autorizados.',
              texto:
                'Ningún testimonio, reseña o imagen de una persona se publica sin autorización escrita para ese uso. No se editan para que digan otra cosa, no se inventan y, si la persona recibió algo a cambio, se aclara.',
            },
            {
              titulo: 'La publicidad se identifica como publicidad.',
              texto:
                'Toda colaboración con influencers, afiliados o creadores lleva la identificación visible desde el inicio. Si el público no puede darse cuenta de que es publicidad, la pieza es engañosa aunque todo lo demás sea cierto.',
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Cómo se ve en la práctica' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Toda pieza es una oferta',
              texto:
                'Un anuncio dice acceso de por vida a la comunidad y el contrato dice doce meses. Frente a un consumidor puede valer lo que dice el anuncio, así que la pieza se corrige antes de publicarse.',
              cita: 'Acceso a la comunidad durante doce meses desde tu inscripción.',
            },
            {
              titulo: 'Resultados con contexto',
              texto: 'En lugar de una cifra suelta, el caso se cuenta con su punto de partida y su esfuerzo.',
              cita: '[[Nombre]] facturó [[monto]] en su tercer mes, con un negocio que ya vendía y dedicando [[horas]] por semana. Es su caso. Tus resultados dependen de tu punto de partida y de tu implementación.',
            },
            {
              titulo: 'La urgencia tiene que ser real',
              texto: 'La promoción cerraba el viernes y hace falta más tiempo. No se inventa un cupo liberado. Se anuncia la extensión, con su motivo y una sola vez.',
              cita: 'Extendimos la inscripción hasta el [[fecha]] porque [[motivo real]]. Después de esa fecha no hay prórroga.',
            },
            {
              titulo: 'La publicidad se identifica',
              texto: 'La identificación va al principio del texto y con la etiqueta de la plataforma, no perdida al final de los hashtags.',
              cita: 'Publicidad. Colaboración pagada con {empresa}.',
            },
          ],
        },
      ],
    },
    {
      id: 'recorrido',
      titulo: 'El recorrido de una pieza',
      corto: 'Recorrido',
      intro:
        'Cada pieza pasa por siete etapas, con responsable y plazo. Las piezas chicas, como una historia o un mensaje de difusión, recorren las mismas etapas en menos tiempo, pero no se saltean ninguna.',
      bloques: [
        {
          tipo: 'etapas',
          items: [
            {
              titulo: 'Brief',
              cuando: 'Responsable {respMarketing} · Antes de producir',
              datos: [
                { rotulo: 'Objetivo', texto: 'Definir qué se quiere decir, a quién y con qué respaldo, antes de escribir una línea.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Objetivo de la pieza, público, canal, oferta vigente y sus bases, afirmaciones que se van a usar y dónde está su respaldo, testimonios disponibles con autorización y reglas del nicho. Si una afirmación no tiene respaldo, se cambia la afirmación, no se busca el respaldo después.',
                },
                { rotulo: 'Frase ancla', texto: 'Cada afirmación de esta pieza tiene que poder mostrarse con un documento.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Arrancar por el gancho y buscar el respaldo cuando la pieza ya está hecha.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Redacción',
              cuando: 'Responsable {respMarketing} · Según el calendario de contenidos',
              datos: [
                { rotulo: 'Objetivo', texto: 'Escribir para vender sin prometer de más.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Se usan las frases de reemplazo, el aviso de resultados donde corresponde y la identificación publicitaria en las colaboraciones. Los guiones de video, los vivos y los textos de anuncios siguen las mismas reglas que una página de venta.',
                },
                { rotulo: 'Frase ancla', texto: 'Mostramos lo que hicieron otros, con su contexto, y explicamos qué depende de cada uno.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Improvisar en una historia o en un vivo porque dura poco. Lo dicho ahí también integra la oferta.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Revisión de afirmaciones y respaldo',
              cuando: 'Responsable {respAprobacion} · Dentro de {diasRevision}',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que cada afirmación tenga su prueba y cada señal de riesgo se corrija.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'La pieza pasa por el revisor, se marca cada afirmación objetiva y se coteja con su respaldo, como contratos, facturación, capturas fechadas o autorizaciones. Lo que no tiene respaldo se reescribe o se quita.',
                },
                { rotulo: 'Frase ancla', texto: 'Si no lo podemos mostrar, no lo afirmamos.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Aprobar porque una pieza parecida ya se publicó antes y no pasó nada.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Aprobación',
              cuando: 'Responsable {respAprobacion} · Antes de publicar',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que una sola persona apruebe por escrito la versión final.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'La aprobación se da sobre la versión final, no sobre un borrador. Si el revisor dio rojo, si la pieza es de salud o de finanzas, o si incluye menores o un sorteo, pasa antes por legales. Cualquier cambio posterior vuelve a revisión.',
                },
                { rotulo: 'Frase ancla', texto: 'Aprobado en esta versión, para estos canales y hasta esta fecha.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Aprobar con un audio o un pulgar en el chat, sin dejar constancia de qué versión se aprobó.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Publicación',
              cuando: 'Responsable {respMarketing} · En la fecha y los canales aprobados',
              datos: [
                { rotulo: 'Objetivo', texto: 'Publicar exactamente lo aprobado.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Se publica la versión aprobada en los canales aprobados, con la etiqueta de colaboración pagada cuando corresponde, y se programa su baja si la oferta tiene vencimiento.',
                },
                { rotulo: 'Frase ancla', texto: 'Publicamos la versión aprobada el [[fecha]] en [[canal]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Retocar el texto al publicar, o dejar activo un anuncio cuya promoción ya venció.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Archivo',
              cuando: 'Responsable {respMarketing} · El mismo día de la publicación',
              datos: [
                { rotulo: 'Objetivo', texto: 'Poder mostrar qué se publicó, cuándo y con qué respaldo.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Se guarda la versión publicada con captura fechada, enlace, canales, período de circulación, respaldo de cada afirmación, autorizaciones y bases de la promoción. Se conserva mientras pueda existir un reclamo.',
                },
                { rotulo: 'Frase ancla', texto: 'La pieza del [[fecha]] quedó archivada con su respaldo.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Confiar en que la plataforma guarda el historial. Los anuncios se editan y las historias desaparecen.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Monitoreo de comentarios',
              cuando: 'Responsable {respMarketing} · Mientras la pieza circula',
              datos: [
                { rotulo: 'Objetivo', texto: 'Detectar a tiempo confusiones, reclamos y usos indebidos.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Se revisan comentarios y mensajes, se responde por privado lo que es un caso individual, se registran las preguntas que muestran que la pieza se entiende mal y los reclamos se derivan según el protocolo de conflictos.',
                },
                { rotulo: 'Frase ancla', texto: 'Gracias por escribir. Te respondemos por mensaje privado para ver tu caso en detalle.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Discutir en los comentarios, borrar críticas legítimas o prometer en público una solución.', estilo: 'error' },
              ],
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Las cuatro reglas del respaldo' },
        {
          tipo: 'tips',
          items: [
            {
              titulo: 'Documento, no memoria',
              texto: 'El respaldo es un archivo que se puede mostrar, como un contrato, una factura, una captura fechada o una autorización. Lo que alguien recuerda no cuenta.',
            },
            {
              titulo: 'Del mismo alcance',
              texto: 'Si la pieza dice más de cien alumnos, el respaldo muestra más de cien alumnos. Un respaldo parcial no sostiene una afirmación general.',
            },
            { titulo: 'Vigente', texto: 'Los datos envejecen. Una cifra del año pasado se publica con su fecha o no se publica.' },
            { titulo: 'Junto a la pieza', texto: 'El respaldo se archiva con la versión publicada. Buscarlo cuando llega un reclamo suele ser tarde.' },
          ],
        },
        { tipo: 'subtitulo', texto: 'Qué se archiva de cada pieza' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Archivo de la pieza',
              check: true,
              lista: [
                'Versión publicada, con captura fechada y enlace.',
                'Canales, fechas de circulación y segmentación de los anuncios.',
                'Aprobación escrita, con nombre y fecha.',
                'Bases de la promoción, si la hubo.',
              ],
            },
            {
              titulo: 'Respaldo de las afirmaciones',
              check: true,
              lista: [
                'Documento que prueba cada cifra o dato.',
                'Autorizaciones de testimonios, imágenes y voces.',
                'Licencias de música, imágenes y contenidos de terceros.',
                'Contexto de cada caso de éxito que se muestra.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'revisor',
      titulo: 'Revisor de piezas',
      corto: 'Revisor de piezas',
      intro:
        'Antes de aprobar, cada pieza pasa por este revisor. Incluye anuncios, guiones de video, páginas de venta, correos y piezas de influencers. El resultado dice si se aprueba, se corrige o se frena.',
      bloques: [
        {
          tipo: 'evaluacion',
          id: 'revisor',
          titulo: 'Señales de riesgo',
          intro: 'Marcá las señales que aparecen en la pieza. Cada una suma según su peso y el resultado dice qué hacer.',
          items: SENALES,
          niveles: [
            {
              desde: 0,
              nivel: 'verde',
              titulo: 'Verde. Se puede aprobar',
              texto:
                'No aparecen señales de riesgo. {respAprobacion} coteja el respaldo, aprueba por escrito la versión final y la pieza se archiva el mismo día en que se publica.',
            },
            {
              desde: 2,
              nivel: 'ambar',
              titulo: 'Ámbar. Se corrige antes de publicar',
              texto:
                'Corregí cada señal marcada con la tabla que sigue y volvé a pasar la pieza por el revisor. Si la señal es de salud, inversiones, antes y después, comparación, marcas ajenas o menores, la corrección la revisa legales aunque el puntaje sea bajo.',
            },
            {
              desde: 5,
              nivel: 'rojo',
              titulo: 'Rojo. No se publica',
              texto:
                'La pieza vuelve al brief. Se reescribe desde cero o pasa a legales con su respaldo antes de cualquier publicación. Si ya está publicada, se pausa mientras se revisa.',
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Qué hacer con cada señal' },
        {
          tipo: 'tabla',
          aria: 'Qué hacer con cada señal del revisor',
          columnas: [
            { rotulo: 'Señal', ancho: '1fr', estilo: 'senal' },
            { rotulo: 'Cómo se corrige', ancho: '1.5fr' },
            { rotulo: 'Decide', ancho: '0.6fr', estilo: 'pastilla' },
          ],
          filas: [
            ['Promete ingresos o resultados concretos.', 'Reemplazar la promesa por un caso individual con contexto y el aviso de resultados, o quitar la cifra.', 'Aprobación'],
            ['Usa garantizado, sin riesgo o equivalentes.', 'Quitar la expresión. Si hay política de devoluciones, se remite a ella con sus condiciones.', 'Aprobación'],
            ['Datos sin respaldo.', 'Archivar el respaldo antes de publicar o quitar el dato.', 'Aprobación'],
            ['Plazos o cupos sin bases.', 'Escribir las bases con fechas y cupos reales, o quitar la urgencia.', 'Aprobación'],
            ['Testimonio sin autorización.', 'Pedir la autorización con la plantilla y esperar la firma antes de publicar.', 'Aprobación'],
            ['Antes y después o cambios físicos.', 'Quitar la comparación o reemplazarla por un testimonio de experiencia, sin promesa de resultado.', 'Legales'],
            ['Salud o inversiones.', 'Reformular como bienestar general o como formación, según las reglas del nicho.', 'Legales'],
            ['Comparación con competidores.', 'Comparar solo datos objetivos, verificables y equivalentes, sin denigrar, o quitar la comparación.', 'Legales'],
            ['Marcas o contenidos de terceros.', 'Usar material propio o con licencia. Las marcas ajenas, solo en una mención descriptiva y leal.', 'Legales'],
            ['Precio tachado sin referencia.', 'Tachar solo un precio realmente aplicado y documentado, o anunciar el precio actual sin tachado.', 'Aprobación'],
            ['Publicidad no identificada.', 'Agregar Publicidad al inicio del texto y activar la etiqueta de colaboración pagada.', 'Aprobación'],
            ['Menores o sus datos.', 'Quitar o pixelar, o conseguir la autorización de quienes ejercen la responsabilidad parental.', 'Legales'],
          ],
        },
        { tipo: 'subtitulo', texto: 'Reglas por nicho' },
        {
          tipo: 'acordeones',
          items: NICHOS.map((n) => ({
            titulo: n.titulo,
            subtitulo: n.subtitulo,
            ...(n.clave === nicho ? { insignia: 'Tu nicho', abierto: true, destacado: true } : {}),
            bloques: [
              { tipo: 'nota', etiqueta: 'Reglas', texto: n.reglas },
              { tipo: 'nunca', textos: n.nunca },
              { tipo: 'decir', etiqueta: 'Formulación segura', texto: n.segura },
            ] as BloqueGuion[],
          })),
        },
        {
          tipo: 'aclaracion',
          texto: 'Si el nicho del negocio no está en la lista, aplican las reglas generales y legales define si hace falta alguna regla adicional antes de la primera campaña.',
        },
      ],
    },
    {
      id: 'testimonios',
      titulo: 'Testimonios autorizados',
      corto: 'Testimonios',
      intro: 'Un testimonio es la pieza más persuasiva y la más riesgosa. Antes de publicarlo, cinco preguntas definen si se puede usar y cómo.',
      bloques: [
        ...(testimonios
          ? []
          : [
              {
                tipo: 'aclaracion' as const,
                texto: 'Según la ficha, hoy {empresa} no usa testimonios. Si empieza a usarlos, estas reglas rigen desde la primera pieza y las plantillas aparecen al activar la práctica en la ficha.',
              },
            ]),
        {
          tipo: 'semaforo',
          id: 'testimonio',
          titulo: 'Las cinco preguntas',
          preguntas: [
            {
              id: 'autorizacion',
              texto: '¿Hay autorización escrita para este uso?',
              ayuda: 'Tiene que cubrir esta pieza, estos canales y este momento.',
              opciones: [
                { valor: 'si', rotulo: 'Sí, firmada y vigente' },
                { valor: 'otra', rotulo: 'Hay una, pero para otro uso o ya venció' },
                { valor: 'no', rotulo: 'No hay autorización escrita' },
              ],
            },
            {
              id: 'representativo',
              texto: '¿El resultado que cuenta es lo habitual entre los clientes?',
              opciones: [
                { valor: 'tipico', rotulo: 'Sí, es representativo y se puede mostrar' },
                { valor: 'excepcional', rotulo: 'No, es un caso destacado' },
                { valor: 'nose', rotulo: 'No lo sabemos' },
              ],
            },
            {
              id: 'beneficio',
              texto: '¿La persona recibió algo a cambio?',
              ayuda: 'Dinero, descuento, acceso sin costo, comisión o un regalo.',
              opciones: [
                { valor: 'no', rotulo: 'No' },
                { valor: 'aclarado', rotulo: 'Sí, y la pieza lo aclara' },
                { valor: 'oculto', rotulo: 'Sí, y la pieza no lo aclara' },
              ],
            },
            {
              id: 'tema',
              texto: '¿De qué habla el testimonio?',
              opciones: [
                { valor: 'general', rotulo: 'De la experiencia o de resultados de negocio' },
                { valor: 'dinero', rotulo: 'De ingresos, rentabilidades o inversiones' },
                { valor: 'salud', rotulo: 'De salud, cuerpo o bienestar' },
              ],
            },
            {
              id: 'terceros',
              texto: '¿Aparecen menores o datos de otras personas?',
              ayuda: 'Por ejemplo, hijos en un video, nombres de clientes en una captura o datos de salud.',
              opciones: [
                { valor: 'no', rotulo: 'No' },
                { valor: 'si', rotulo: 'Sí' },
              ],
            },
          ],
          evaluar: evaluarTestimonio,
        },
        { tipo: 'subtitulo', texto: 'Reglas de los testimonios' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Qué cuenta como testimonio',
              lista: [
                'Reseñas, comentarios, mensajes y capturas de chat.',
                'Videos, audios y fotos de clientes.',
                'Casos de éxito contados por el equipo con nombre, cifras o imagen.',
                'Lo que dicen influencers o afiliados sobre el programa.',
              ],
            },
            {
              titulo: 'La autorización',
              texto: 'La imagen y la voz de una persona solo se usan con su consentimiento ({normaImagen}).',
              check: true,
              lista: [
                'Por escrito y antes de publicar.',
                'Con el material exacto, los usos, los canales y el plazo.',
                'Con el beneficio recibido, si lo hubo.',
                'Con la forma y el plazo para retirar el material si se revoca.',
              ],
            },
            {
              titulo: 'Edición',
              texto:
                'Se puede recortar, subtitular o adaptar al formato sin cambiar el sentido. No se suman cifras, no se mezclan testimonios de distintas personas ni se atribuyen frases que la persona no dijo. Una captura se publica completa o indicando que se recortó.',
            },
            {
              titulo: 'Revocación',
              texto:
                'La persona puede retirar su autorización en cualquier momento. El material se baja de todos los canales y anuncios activos dentro del plazo que fija la autorización y se le confirma por escrito. Si terceros lo siguen difundiendo, se informa a legales.',
            },
            {
              titulo: 'Reseñas',
              texto:
                'Las reseñas no se compran, no se inventan ni se filtran para mostrar solo las favorables como si fueran todas. Si la página muestra reseñas, informa cómo se verifica que provienen de clientes reales.',
            },
            {
              titulo: 'Registro de testimonios',
              check: true,
              lista: [
                'Nombre y contacto de la persona.',
                'Fecha y alcance de la autorización.',
                'Piezas y canales donde se usó.',
                'Respaldo del resultado que menciona.',
                'Fecha de baja, si la pidió.',
              ],
            },
          ],
        },
        ...(testimonios
          ? [
              {
                tipo: 'aclaracion' as const,
                texto: 'El pedido de testimonio y la autorización de uso de testimonio e imagen están en la biblioteca de plantillas, en la pestaña Testimonios.',
              },
            ]
          : []),
      ],
    },
    {
      id: 'plantillas',
      titulo: 'Biblioteca de plantillas',
      corto: 'Plantillas',
      intro:
        'Modelos ordenados por uso. Se completan con la ficha y se adaptan al tono de cada marca siempre que no cambie el contenido. Los mensajes de chat van con vos y los documentos se firman en primera persona. Las pestañas dependen de las prácticas marcadas en la ficha.',
      bloques: [{ tipo: 'guiones', aria: 'Plantillas por uso', items: guiones }],
    },
    {
      id: 'frases',
      titulo: 'Frases prohibidas y su reemplazo',
      corto: 'Frases prohibidas',
      intro: 'En marketing, las fórmulas que más venden suelen ser las que más exponen. Estas son las más comunes y cómo reemplazarlas sin perder fuerza.',
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
              'Resultados garantizados.',
              'Un método paso a paso, con acompañamiento semanal. Los resultados dependen de tu punto de partida y de tu implementación.',
              'Una promesa de resultado se vuelve exigible y, si no se cumple, es publicidad engañosa.',
            ],
            [
              'Facturá USD 10.000 en 30 días.',
              '[[Nombre]] pasó de [[situación inicial]] a [[resultado]] en [[plazo]]. Es su caso y no un resultado típico.',
              'Una cifra sin contexto se lee como promesa.',
            ],
            [
              'Sin riesgo. Si no funciona, te devolvemos todo.',
              'Conocé la política de devoluciones antes de inscribirte. Está en [[enlace]].',
              'Una garantía anunciada obliga tal como se lee, sin la letra chica del contrato.',
            ],
            [
              'Últimos 3 cupos, cuando no es cierto.',
              'Cerramos la inscripción el [[fecha]] a las [[hora]]. Hay [[cantidad]] lugares por grupo de acompañamiento.',
              'La escasez inventada es engañosa en todo caso frente a consumidores.',
            ],
            [
              'Solo por hoy, repetido cada semana.',
              'Precio de lanzamiento hasta el [[fecha]]. Después vuelve a [[precio]].',
              'Una urgencia que se repite deja de ser real y queda probada en las piezas anteriores.',
            ],
            [
              'Antes USD 5.000, hoy USD 997, si nunca se cobró el primero.',
              'Precio regular [[precio efectivamente cobrado]]. Precio de la promoción [[precio]] hasta el [[fecha]].',
              'El precio tachado tiene que ser un precio que de verdad se aplicó.',
            ],
            ['El mejor programa de Latinoamérica.', 'Más de [[cantidad verificable]] alumnos desde [[año]].', 'Un dato comprobable convence más y se puede defender.'],
            [
              'No como [[competidor]], que es una estafa.',
              'Nuestro programa incluye [[característica concreta y comprobable]].',
              'Denigrar a un competidor es competencia desleal y abre una acción en contra.',
            ],
            [
              'Este programa cura la ansiedad.',
              'Un espacio para trabajar hábitos y herramientas de bienestar. No reemplaza la atención de un profesional de la salud.',
              'Atribuir efectos curativos está prohibido y en salud es de las faltas más graves.',
            ],
            [
              'Invertí con nosotros y ganá un 5% mensual.',
              'Aprendé a analizar inversiones. El programa es formación y no constituye asesoramiento financiero.',
              'Proyectar rentabilidades se lee como asesoramiento y como promesa.',
            ],
            [
              'Todos nuestros alumnos ya cerraron su primera operación.',
              '[[Nombre]], corredor en [[zona]] con [[años]] de experiencia, cerró [[operación]] durante el programa.',
              'Una generalización no se puede respaldar y los casos tienen que mostrar su contexto.',
            ],
            [
              'Avalado por [[institución]], sin acuerdo con ella.',
              'Solo se menciona una institución con su autorización escrita y en los términos acordados.',
              'Un aval falso es engaño y aprovechamiento de la reputación ajena.',
            ],
            [
              '#colaboración perdido al final de veinte hashtags.',
              'Publicidad. Colaboración pagada con {empresa}, al inicio del texto y con la etiqueta de la plataforma.',
              'La identificación tiene que verse sin abrir el texto completo.',
            ],
          ],
        },
      ],
    },
    {
      id: 'alertas',
      titulo: 'Alertas y escalamiento',
      corto: 'Alertas',
      intro: 'Ante cualquiera de estas señales, la pieza se frena y el caso pasa a quien corresponde en el día. Nadie del equipo decide quedárselo.',
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
            ['El revisor dio rojo o hay dudas sobre si una afirmación se puede respaldar.', 'No publicar. Reescribir desde el brief o conseguir el respaldo.', 'Legales'],
            [
              'Un cliente reclama citando una pieza, un anuncio o un testimonio.',
              'Guardar la pieza tal como se publicó, con fecha, y derivar según el protocolo de conflictos.',
              'Legales hoy',
            ],
            [
              'Una persona pide retirar su testimonio, su imagen o su voz.',
              'Retirar el material de todos los canales y anuncios activos, confirmarle por escrito y registrar la fecha.',
              'Aprobación',
            ],
            [
              'Llega una intimación de un competidor o del titular de una marca.',
              'No responder ni retirar nada sin legales. Preservar la pieza y la fecha de publicación.',
              'Legales hoy',
            ],
            ['Llega una denuncia o un pedido de información de {organismo} o de otra autoridad.', 'Registrar la fecha de recepción y derivar con la pieza y su respaldo.', 'Legales hoy'],
            [
              'Una plataforma rechaza o retira un anuncio, o restringe la cuenta.',
              'No volver a subirlo con cambios cosméticos. Revisar el motivo contra este protocolo y la política de la plataforma.',
              'Aprobación',
            ],
            [
              'Un influencer o afiliado publicó sin identificar la publicidad o prometiendo resultados.',
              'Pedir la corrección en el día con el mensaje modelo y, si no corrige, el retiro.',
              'Aprobación',
            ],
            [
              'Comentarios que preguntan si es una estafa o cuentan resultados muy distintos de los anunciados.',
              'No discutir en público. Responder por privado y revisar si la pieza promete de más.',
              'Aprobación',
            ],
            ['Aparece un menor, un paciente o datos de salud de una persona en una pieza.', 'No publicar o pausar hasta revisar la autorización.', 'Legales'],
            [
              'Alguien se queja por mensajes no solicitados o sigue recibiendo envíos después de pedir la baja.',
              'Procesar la baja en el día en todas las herramientas y revisar el origen del dato.',
              'Legales',
            ],
            [
              'Se ofrece comprar, alquilar o importar una base de contactos.',
              'No usarla hasta revisar su origen y el consentimiento y, en Argentina, cruzarla con el Registro Nacional No Llame.',
              'Legales',
            ],
            ['Se planea un sorteo o un concurso en redes.', 'Armar bases con participación gratuita, sin compra obligatoria, y revisarlas antes de anunciar.', 'Legales'],
            [
              'Un creador con el que se trabaja en España podría superar los umbrales de usuario de especial relevancia.',
              'Pedirle que confirme por escrito su situación y su inscripción en el registro estatal.',
              'Legales',
            ],
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'Frenar una pieza no es un fracaso del equipo. Una pieza pausada cuesta menos que una pieza retirada después de un reclamo.',
        },
      ],
    },
    {
      id: 'control',
      titulo: 'Control antes de publicar',
      corto: 'Control',
      intro: 'Antes de publicar, quien aprueba recorre esta lista. Un solo punto crítico sin marcar significa que la pieza no sale.',
      bloques: [
        {
          tipo: 'checklist',
          id: 'control',
          titulo: 'Lista de control de la pieza',
          textoConforme: 'Lista para publicar',
          textoNoConforme: 'No se publica · falta al menos un punto crítico',
          items: itemsControl,
        },
        {
          tipo: 'aclaracion',
          texto: 'El resultado de la lista se archiva con la pieza. Si después llega un reclamo, muestra que la empresa revisó antes de publicar.',
        },
      ],
    },
    {
      id: 'tablero',
      titulo: 'Tablero y métricas de adquisición',
      corto: 'Tablero',
      intro:
        'Lo que no se mide se repite. Se revisa una vez por mes junto con el tablero comercial, y cada reclamo vinculado a una pieza vuelve al principio del recorrido.',
      bloques: [
        {
          tipo: 'kpis',
          items: [
            {
              nombre: 'Costo por lead',
              formula: 'Inversión del período dividido leads obtenidos.',
              lectura: 'Mide la eficiencia de los anuncios. Si baja a costa de piezas que prometen de más, después sube el costo de los reclamos.',
              meta: 'Estable o en baja, sin bajar el estándar de las piezas',
              frecuencia: 'Semanal',
              fuente: 'Plataformas de anuncios y CRM',
            },
            {
              nombre: 'Conversión por etapa',
              formula: 'Llamadas agendadas sobre leads, llamadas realizadas sobre agendadas y ventas sobre llamadas realizadas, cada una por cien.',
              lectura:
                'Muestra dónde se corta el recorrido. Una caída en la asistencia suele indicar una pieza que atrajo a quien no correspondía o prometió algo distinto de lo que se ofrece en la llamada.',
              meta: 'Subir mes a mes',
              frecuencia: 'Semanal',
              fuente: 'CRM',
            },
            {
              nombre: 'CAC',
              formula: 'Inversión en adquisición del período, con o sin las comisiones del equipo comercial, dividido ventas nuevas.',
              lectura: 'Cuánto cuesta conseguir un cliente. Se mira siempre junto con el valor de vida, nunca solo.',
              meta: 'Bajar mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Administración y CRM',
            },
            {
              nombre: 'ROAS',
              formula: 'Ingresos de las ventas atribuidas a la publicidad dividido inversión en publicidad.',
              lectura: 'Cuántas veces vuelve lo invertido. Si es menor que cien dividido el margen bruto en porcentaje, el margen de esas ventas no cubre la inversión.',
              meta: 'Por encima del ROAS de equilibrio',
              frecuencia: 'Mensual',
              fuente: 'Plataformas de anuncios y administración',
            },
            {
              nombre: 'Relación entre valor de vida y CAC',
              formula: 'Ticket promedio por margen bruto por meses de permanencia, dividido CAC.',
              lectura: 'Si es menor que uno, cada cliente nuevo cuesta más de lo que deja. Cuanto más alta, más margen para invertir, siempre con las mismas reglas de piezas.',
              meta: 'Mayor que uno y en alza',
              frecuencia: 'Trimestral',
              fuente: 'Administración',
            },
            {
              nombre: 'Piezas aprobadas sin cambios',
              formula: 'Piezas aprobadas en la primera revisión dividido piezas revisadas, por cien.',
              lectura: 'Mide si el equipo incorporó el protocolo. Si baja, hace falta capacitación o un mejor brief.',
              meta: 'Subir mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Archivo de piezas',
            },
            {
              nombre: 'Reclamos vinculados a publicidad',
              formula: 'Reclamos, pedidos de devolución o denuncias que citan una pieza, cada cien ventas.',
              lectura: 'Es el costo oculto de prometer de más. Cada caso se vincula con la pieza que lo originó para corregirla o retirarla.',
              meta: 'Bajar mes a mes',
              frecuencia: 'Mensual',
              fuente: 'Expedientes de reclamos',
            },
          ],
        },
        {
          tipo: 'calculadora',
          id: 'metricas',
          titulo: 'Métricas de adquisición',
          intro:
            'Cargá los números de un mismo período y obtené costo por lead, costo por llamada, CAC, ROAS y la relación entre valor de vida y CAC. Los montos se expresan en la moneda de la ficha.',
          entradas: [
            {
              id: 'inversion',
              rotulo: 'Inversión del período',
              unidad: 'moneda',
              ayuda: 'Anuncios, influencers y herramientas. Para el CAC completo, sumá las comisiones del equipo comercial.',
            },
            { id: 'leads', rotulo: 'Leads obtenidos', unidad: 'leads' },
            { id: 'agendadas', rotulo: 'Llamadas agendadas', unidad: 'llamadas' },
            { id: 'realizadas', rotulo: 'Llamadas realizadas', unidad: 'llamadas' },
            { id: 'ventas', rotulo: 'Ventas cerradas', unidad: 'ventas' },
            { id: 'ticket', rotulo: 'Ticket promedio', unidad: 'moneda', ayuda: 'Lo que cobra cada venta. Si el cobro es mensual, el ingreso promedio por mes.' },
            { id: 'margen', rotulo: 'Margen bruto', unidad: '%', ayuda: 'Lo que queda de cada venta después de los costos directos de prestar el servicio.' },
            { id: 'meses', rotulo: 'Meses promedio de permanencia', unidad: 'meses', ayuda: 'Si se cobra una sola vez, cargá 1.' },
          ],
          salidas: [
            { id: 'cpl', rotulo: 'Costo por lead', formato: 'monto', calcular: (v) => div(v.inversion, v.leads) },
            { id: 'agenda', rotulo: 'De lead a llamada agendada', formato: 'pct', calcular: (v) => pct(v.agendadas, v.leads) },
            { id: 'asistencia', rotulo: 'Asistencia a las llamadas', formato: 'pct', calcular: (v) => pct(v.realizadas, v.agendadas) },
            { id: 'cierre', rotulo: 'Cierre sobre llamadas realizadas', formato: 'pct', calcular: (v) => pct(v.ventas, v.realizadas) },
            { id: 'cpll', rotulo: 'Costo por llamada realizada', formato: 'monto', calcular: (v) => div(v.inversion, v.realizadas) },
            { id: 'cac', rotulo: 'CAC, costo de adquirir un cliente', formato: 'monto', destacada: true, calcular: (v) => div(v.inversion, v.ventas) },
            {
              id: 'roas',
              rotulo: 'ROAS del período',
              formato: 'veces',
              calcular: (v) => roas(v),
              ayuda: 'Ingresos de las ventas sobre la inversión. Con cobro mensual, mide solo el primer mes.',
            },
            {
              id: 'equilibrio',
              rotulo: 'ROAS de equilibrio',
              formato: 'veces',
              calcular: (v) => div(100, v.margen),
              ayuda: 'Por debajo de este número, el margen de las ventas no cubre lo invertido.',
            },
            { id: 'ltv', rotulo: 'Valor de vida aproximado', formato: 'monto', calcular: (v) => valorVida(v), ayuda: 'Ticket por margen bruto por meses de permanencia.' },
            {
              id: 'ratio',
              rotulo: 'Relación entre valor de vida y CAC',
              formato: 'veces',
              destacada: true,
              calcular: (v) => div(valorVida(v), div(v.inversion, v.ventas)),
            },
          ],
          barra: (v, r) => {
            if (r.cac === null || r.ltv === null) return null;
            const primer = v.ticket !== null && v.margen !== null ? v.ticket * (v.margen / 100) : null;
            const tope = Math.max(r.cac, r.ltv, primer ?? 0) * 1.1 || 1;
            const marcas = [{ valor: r.cac, rotulo: 'CAC' }];
            if (primer !== null) marcas.push({ valor: primer, rotulo: 'Margen del primer cobro' });
            marcas.push({ valor: r.ltv, rotulo: 'Valor de vida aproximado' });
            return {
              min: 0,
              max: tope,
              zona: r.ltv > r.cac ? [r.cac, r.ltv] : undefined,
              zonaRotulo: r.ltv > r.cac ? 'Margen que deja cada cliente después de pagar su adquisición' : undefined,
              marcas,
            };
          },
          conclusion: (v, r) => {
            if (v.inversion === null || v.ventas === null) return null;
            if (v.ventas === 0) {
              return {
                nivel: 'rojo',
                texto: 'Sin ventas en el período no hay CAC. Antes de sumar inversión, mirá en qué etapa se corta el recorrido, desde el lead hasta el cierre.',
              };
            }
            if (r.ratio === null) return { nivel: 'info', texto: 'Cargá ticket, margen bruto y meses de permanencia para comparar el valor de vida con el CAC.' };
            if (r.ratio < 1) {
              return {
                nivel: 'rojo',
                texto:
                  'Cada cliente nuevo cuesta más de lo que deja en margen durante su permanencia. Revisá conversión, precio y permanencia antes de subir la inversión. La presión por los números no justifica publicar una pieza en rojo.',
              };
            }
            if (r.roas !== null && r.equilibrio !== null && r.roas < r.equilibrio) {
              return {
                nivel: 'ambar',
                texto:
                  'El valor de vida cubre el CAC, pero el primer cobro no recupera lo invertido. El negocio financia la adquisición hasta que el cliente permanece, así que cuidá la caja y la retención antes de escalar.',
              };
            }
            return {
              nivel: 'verde',
              texto:
                'El primer cobro ya recupera lo invertido en margen y el valor de vida supera el CAC. Si se escala la inversión, se escala con las mismas reglas de piezas, testimonios y promociones.',
            };
          },
          nota: 'Herramienta orientativa. Usá el mismo período para todos los datos y una sola regla para atribuir ventas a la publicidad. Ninguna mejora de estos números justifica publicar una pieza en rojo.',
        },
        {
          tipo: 'calculadora',
          id: 'piezasMes',
          titulo: 'Control de piezas del mes',
          intro: 'Cargá los números del mes y obtené los indicadores de cumplimiento del recorrido.',
          entradas: [
            { id: 'revisadas', rotulo: 'Piezas revisadas', unidad: 'piezas' },
            { id: 'sinCambios', rotulo: 'Aprobadas sin cambios', unidad: 'piezas' },
            { id: 'rojo', rotulo: 'Piezas en rojo en el revisor', unidad: 'piezas' },
            { id: 'ventas', rotulo: 'Ventas del mes', unidad: 'ventas' },
            { id: 'reclamos', rotulo: 'Reclamos vinculados a publicidad', unidad: 'casos' },
          ],
          salidas: [
            { id: 'sinCambiosPct', rotulo: 'Aprobadas sin cambios', formato: 'pct', destacada: true, calcular: (v) => pct(v.sinCambios, v.revisadas) },
            { id: 'rojoPct', rotulo: 'Piezas en rojo', formato: 'pct', calcular: (v) => pct(v.rojo, v.revisadas) },
            { id: 'reclamos100', rotulo: 'Reclamos vinculados a publicidad cada 100 ventas', formato: 'num', calcular: (v) => pct(v.reclamos, v.ventas) },
          ],
          nota: 'Cada reclamo vinculado a una pieza se registra con el enlace a esa pieza en el archivo, para corregirla o retirarla.',
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
              bajada: 'Código Civil y Comercial, Ley 24.240 de Defensa del Consumidor, DNU 274/2019 de Lealtad Comercial, imagen, datos personales y marcas.',
              abierto: true,
              items: [
                {
                  lead: 'Publicidad prohibida.',
                  nivel: 'ALTO',
                  texto:
                    'Está prohibida la publicidad que contenga indicaciones falsas o que induzcan o puedan inducir a error al consumidor sobre elementos esenciales del servicio, la que haga comparaciones que conduzcan a error y la abusiva, discriminatoria o que induzca a comportarse en forma perjudicial o peligrosa para la salud o la seguridad (art. 1101 CCyC). Los afectados pueden pedir al juez la cesación de la publicidad ilícita y la publicación de anuncios rectificatorios y, en su caso, de la sentencia (art. 1102 CCyC). La protección alcanza a todas las personas expuestas a las prácticas comerciales, sean o no clientes.',
                },
                {
                  lead: 'Lo publicado integra el contrato.',
                  nivel: 'ALTO',
                  texto:
                    'Las precisiones de la publicidad y de los anuncios se tienen por incluidas en el contrato con el consumidor y obligan al oferente (art. 1103 CCyC y art. 8 LDC). Una cifra de resultados, un bono o una condición que aparece en una pieza se puede exigir aunque el contrato no la mencione, y la cláusula de prevalencia del contrato no alcanza para neutralizarla.',
                },
                {
                  lead: 'Ofertas con plazo y cupos.',
                  nivel: 'MEDIO',
                  texto:
                    'La oferta dirigida a consumidores potenciales indeterminados obliga a quien la emite durante el tiempo en que se realice y debe indicar la fecha precisa de comienzo y de finalización, con sus modalidades, condiciones o limitaciones. Su revocación es eficaz una vez difundida por medios similares a los usados para darla a conocer, y no cumplirla se considera negativa injustificada de venta (art. 7 LDC). Un cupo que no existe es una indicación falsa en los términos del art. 1101 CCyC.',
                },
                {
                  lead: 'Lealtad comercial.',
                  nivel: 'MEDIO',
                  texto:
                    'El DNU 274/2019, vigente desde 2019, prohíbe toda presentación, publicidad o propaganda que mediante inexactitudes u ocultamientos pueda inducir a error, engaño o confusión sobre las características, el precio o las condiciones de comercialización (art. 11). La autoridad no puede exigir autorización previa, pero fiscaliza la publicidad ya difundida (art. 12) y puede aplicar multas de hasta diez millones de Unidades Móviles (art. 57). La norma alcanza también las relaciones entre empresas, y los competidores afectados pueden reclamar judicialmente.',
                },
                {
                  lead: 'Publicidad comparativa y reputación ajena.',
                  nivel: 'MEDIO',
                  texto:
                    'La publicidad comparativa es lícita solo si cumple los requisitos del art. 15 del DNU 274/2019, entre ellos no inducir a confusión, comparar en forma objetiva y comprobable servicios con la misma finalidad, no denigrar al competidor y no aprovechar indebidamente su reputación. Si no los cumple es un acto de competencia desleal (art. 10 inc. m), igual que aprovechar indebidamente la imagen, el crédito o el prestigio ajenos (art. 10 inc. g).',
                },
                {
                  lead: 'Sorteos y concursos.',
                  nivel: 'MEDIO',
                  texto:
                    'Está prohibido promover u organizar concursos, certámenes o sorteos cuya participación dependa de comprar un producto o contratar un servicio (art. 14 inc. b del DNU 274/2019). Un sorteo en redes se arma con participación gratuita y bases publicadas.',
                },
                {
                  lead: 'Imagen y voz.',
                  nivel: 'ALTO',
                  texto:
                    'Para captar o reproducir la imagen o la voz de una persona hace falta su consentimiento, salvo excepciones acotadas, como los actos públicos o el ejercicio del derecho de informar, que no cubren el uso publicitario (art. 53 CCyC). El Código agrega que ese consentimiento no se presume, se interpreta en forma restrictiva y es libremente revocable. Por eso la autorización se da por escrito, para usos, canales y plazo determinados.',
                },
                {
                  lead: 'Menores de edad.',
                  nivel: 'ALTO',
                  texto:
                    'Las imágenes y los datos de niñas, niños y adolescentes tienen protección reforzada. La Ley 26.061 prohíbe exponer o difundir datos o imágenes que permitan identificarlos en contra de su voluntad y la de sus padres o representantes, cuando se lesione su dignidad o reputación o se afecte su intimidad. En publicidad solo se usan con autorización escrita de quienes ejercen la responsabilidad parental y con revisión de legales.',
                },
                {
                  lead: 'Datos para publicidad.',
                  nivel: 'MEDIO',
                  texto:
                    'Pueden usarse con fines publicitarios los datos que figuren en documentos accesibles al público, que hayan sido facilitados por sus titulares o que se hayan obtenido con su consentimiento, y el titular puede pedir en cualquier momento el retiro o bloqueo de su nombre de esas bases (art. 27 de la Ley 25.326). La reglamentación exige indicar en forma expresa y destacada esa posibilidad en cada comunicación publicitaria.',
                },
                {
                  lead: 'Registro Nacional No Llame.',
                  nivel: 'MEDIO',
                  texto:
                    'Quien publicita, ofrece o vende por teléfono no puede contactar a los números inscriptos en el registro, salvo las excepciones de la propia ley (Ley 26.951, vigente). La autoridad de aplicación es la AAIP, que por la Resolución 126/2024 unificó los procedimientos de consulta y de denuncia y la graduación de sanciones, que se aplican según el régimen de la Ley 25.326. Antes de cada campaña de llamadas se cruza la base con el registro.',
                },
                {
                  lead: 'Marcas ajenas.',
                  nivel: 'MEDIO',
                  texto:
                    'La propiedad de una marca y su uso exclusivo se obtienen con el registro (Ley 22.362). Usar marcas, logos o nombres comerciales ajenos en una pieza, fuera de una mención descriptiva y leal, expone a acciones civiles y penales del titular y a reclamos por aprovechamiento de la reputación ajena.',
                },
                {
                  lead: 'Salud.',
                  nivel: salud ? 'ALTO' : 'MEDIO',
                  texto:
                    'La publicidad de medicamentos, suplementos dietarios, productos médicos y cosméticos tiene reglas propias de la ANMAT, y el ejercicio de la medicina tiene prohibiciones como anunciar o prometer curaciones en plazos determinados (Ley 17.132 y normas provinciales). Un programa de bienestar no presenta productos ni métodos como curativos y no muestra cambios físicos como resultado esperable.',
                },
                {
                  lead: 'Finanzas.',
                  nivel: finanzas ? 'ALTO' : 'MEDIO',
                  texto:
                    'La oferta pública de valores negociables y la intermediación y el asesoramiento en el mercado de capitales son actividades sujetas a registro y control de la CNV (Ley 26.831). Un programa de formación financiera no recomienda activos ni operaciones concretas, no proyecta rentabilidades y no se presenta como asesoramiento.',
                },
              ],
            },
            {
              id: 'es',
              titulo: 'España',
              bajada: 'Ley General de Publicidad, Ley de Competencia Desleal, TRLGDCU, LSSI, comunicación audiovisual y telecomunicaciones.',
              items: [
                {
                  lead: 'Publicidad ilícita y engañosa.',
                  nivel: 'ALTO',
                  texto:
                    'La Ley 34/1988 General de Publicidad considera ilícitas, entre otras, la publicidad engañosa, la desleal y la agresiva, que se juzgan como actos de competencia desleal según la Ley 3/1991. Esa ley sanciona los actos de engaño, las omisiones engañosas y las prácticas agresivas, y frente a consumidores declara engañosas en todo caso conductas como afirmar falsamente que una oferta solo estará disponible por un tiempo muy limitado o proclamar falsamente que un producto puede curar enfermedades. La publicidad comparativa solo es lícita si cumple los requisitos de esa misma ley.',
                },
                {
                  lead: 'Lo publicado es exigible.',
                  nivel: 'ALTO',
                  texto:
                    'El contenido de la oferta, promoción o publicidad y las condiciones y garantías ofrecidas son exigibles por el consumidor aunque no figuren en el contrato (TRLGDCU). Rige el mismo principio que en Argentina, lo que se publica se puede reclamar.',
                },
                {
                  lead: 'Reseñas y testimonios.',
                  nivel: 'ALTO',
                  texto:
                    'Desde el Real Decreto ley 24/2021, quien da acceso a reseñas de consumidores tiene que informar si garantiza que provienen de personas que realmente usaron o compraron el servicio y cómo lo hace (art. 20.4 TRLGDCU). Es práctica engañosa afirmar que las reseñas son de usuarios reales sin tomar medidas razonables y proporcionadas para comprobarlo, y añadir o encargar reseñas o recomendaciones falsas o distorsionarlas (art. 27, apartados 7 y 8, de la Ley 3/1991).',
                },
                {
                  lead: 'Publicidad encubierta e influencers.',
                  nivel: 'ALTO',
                  texto:
                    'Es desleal por engañoso incluir en medios, servicios de la sociedad de la información o redes sociales contenidos pagados para promocionar un servicio sin que quede claro que son publicidad (art. 26 de la Ley 3/1991, ampliado a las redes por el Real Decreto ley 24/2021). La Ley General de Publicidad exige además que los anunciantes desvelen de forma inequívoca el carácter publicitario de sus anuncios, y el sector aplica un código de conducta de Autocontrol sobre influencers, de adhesión voluntaria.',
                },
                {
                  lead: 'Usuarios de especial relevancia.',
                  nivel: 'MEDIO',
                  texto:
                    'El Real Decreto 444/2024, vigente desde el 2 de mayo de 2024, desarrolla el art. 94 de la Ley 13/2022 General de Comunicación Audiovisual. Es usuario de especial relevancia quien en el año anterior reunió a la vez ingresos brutos de al menos 300.000 euros por su actividad en plataformas de vídeo, una audiencia de al menos un millón de seguidores en un servicio o dos millones sumando servicios, y al menos 24 vídeos publicados. Tiene que inscribirse en el Registro estatal de prestadores de servicios de comunicación audiovisual y cumplir las obligaciones de esa ley, que incluyen reglas sobre comunicaciones comerciales y protección de menores. Por debajo de esos umbrales rigen igual las reglas generales de publicidad.',
                },
                {
                  lead: 'Precio tachado.',
                  nivel: 'MEDIO',
                  texto:
                    'En los anuncios de reducción de precio tiene que figurar el precio anterior, que es el más bajo aplicado durante al menos los treinta días previos (art. 20 de la Ley 7/1996 de Ordenación del Comercio Minorista, reformado por el Real Decreto ley 24/2021). Un precio de referencia que nunca se cobró es, además, un engaño sobre el precio según la Ley 3/1991.',
                },
                {
                  lead: 'Comunicaciones comerciales electrónicas.',
                  nivel: 'ALTO',
                  texto:
                    'Las comunicaciones comerciales por vía electrónica tienen que ser claramente identificables como tales e indicar en nombre de quién se hacen, y en el correo electrónico o medio equivalente llevan al comienzo la palabra publicidad o la abreviatura publi. Las ofertas promocionales y los concursos se identifican como tales, con condiciones claras e inequívocas (art. 20 LSSI). Está prohibido enviarlas por correo electrónico u otro medio equivalente sin solicitud o autorización expresa previa, salvo a clientes sobre productos o servicios similares a los contratados, y siempre con una forma sencilla y gratuita de oponerse en cada envío (art. 21 LSSI).',
                },
                {
                  lead: 'Llamadas comerciales.',
                  nivel: 'ALTO',
                  texto:
                    'El usuario tiene derecho a no recibir llamadas no deseadas con fines comerciales, salvo que haya dado su consentimiento previo o que la llamada pueda ampararse en otra base de legitimación del RGPD (art. 66.1.b de la Ley 11/2022 General de Telecomunicaciones). La Ley 10/2025 de servicios de atención a la clientela exige además una numeración específica para las llamadas comerciales, distinta de la de atención (art. 16.3), y una resolución de la Secretaría de Estado de Telecomunicaciones e Infraestructuras Digitales de abril de 2026 reservó el prefijo 400, que las empresas alcanzadas por esa ley usan desde el 17 de octubre de 2026. Antes de llamar a quien no dio su consentimiento se consultan los sistemas de exclusión publicitaria, como la Lista Robinson.',
                },
                {
                  lead: 'Píxeles y cookies de publicidad.',
                  nivel: 'MEDIO',
                  texto:
                    'Instalar píxeles de anuncios o cookies que no son estrictamente necesarias exige informar y obtener el consentimiento previo del usuario (LSSI). Las audiencias personalizadas armadas con listas de clientes necesitan una base legal y se informan en la política de privacidad.',
                },
                {
                  lead: 'Imagen.',
                  nivel: 'MEDIO',
                  texto:
                    'Usar el nombre, la voz o la imagen de una persona con fines publicitarios sin su consentimiento expreso es una intromisión ilegítima, y el consentimiento es revocable en cualquier momento, con indemnización de los daños y perjuicios causados, incluidas las expectativas justificadas (Ley Orgánica 1/1982). Con menores rige un régimen reforzado, con intervención del Ministerio Fiscal en ciertos casos, por eso su uso en publicidad pasa siempre por legales.',
                },
                {
                  lead: 'Salud.',
                  nivel: salud ? 'ALTO' : 'MEDIO',
                  texto:
                    'La publicidad de productos, materiales, sustancias, energías o métodos con pretendida finalidad sanitaria tiene prohibiciones específicas, entre ellas apoyarse en testimonios de pacientes, de profesionales sanitarios o de personas conocidas (Real Decreto 1907/1996). Las declaraciones nutricionales y de propiedades saludables de alimentos y suplementos solo pueden usarse si están autorizadas por la normativa europea (Reglamento CE 1924/2006).',
                },
                {
                  lead: 'Finanzas.',
                  nivel: finanzas ? 'ALTO' : 'MEDIO',
                  texto:
                    'El asesoramiento en materia de inversión es un servicio reservado a entidades autorizadas (Ley 6/2023 de los Mercados de Valores y de los Servicios de Inversión), y la publicidad de criptoactivos tiene reglas propias de la CNMV y del Reglamento europeo MiCA. Un programa de formación no recomienda productos concretos ni proyecta rentabilidades.',
                },
                {
                  lead: 'Ley aplicable.',
                  nivel: 'BAJO',
                  texto:
                    'Si la publicidad se dirige a consumidores residentes en España, rige su protección imperativa aunque la empresa esté en otro país o el contrato elija otra ley. Para las prácticas desleales, el Reglamento Roma II remite en principio a la ley del país donde se afectan los intereses colectivos de los consumidores.',
                },
              ],
            },
            {
              id: 'ajustes',
              titulo: 'Ajustes sugeridos',
              bajada: 'Lo que conviene revisar en contratos, bases y políticas para que el protocolo tenga respaldo.',
              items: [
                {
                  lead: 'Contrato con influencers y afiliados.',
                  nivel: 'ALTO',
                  texto:
                    'Obligación de identificar cada pieza como publicidad desde el inicio, aprobación previa de los textos, prohibición de prometer resultados o de anunciar condiciones distintas de las vigentes, deber de corregir o retirar a pedido, archivo de lo publicado y responsabilidad por incumplimiento. En España, declaración sobre si alcanza los umbrales de usuario de especial relevancia y su inscripción.',
                },
                {
                  lead: 'Autorización de testimonios.',
                  nivel: 'ALTO',
                  texto: 'Un formulario único, firmado antes de publicar, con el material autorizado, los usos, los canales, el plazo, el alcance de la edición, el beneficio recibido y la forma y el plazo de retiro si se revoca.',
                },
                {
                  lead: 'Bases de promociones.',
                  nivel: 'MEDIO',
                  texto:
                    'Un modelo de bases con fechas de inicio y fin, cupos reales, precio de referencia efectivamente aplicado, condiciones, qué pasa si los cupos se agotan y cómo se comunica el cierre. Si hay sorteo, la participación es gratuita.',
                },
                {
                  lead: 'Página de venta y botones.',
                  nivel: 'MEDIO',
                  texto:
                    'En Argentina, si la página permite contratar en línea con consumidores, tiene que mostrar los botones de arrepentimiento y de baja que exige la Disposición 954/2025, visibles desde el primer acceso.',
                },
                {
                  lead: 'Política de privacidad y formularios.',
                  nivel: 'MEDIO',
                  texto:
                    'Que mencione la finalidad comercial, el uso de herramientas de anuncios y de medición, las audiencias personalizadas y la forma de darse de baja, con casillas separadas y sin marcar para comunicaciones y llamadas.',
                },
                {
                  lead: 'Contrato con la agencia o el equipo de marketing.',
                  nivel: 'MEDIO',
                  texto: 'Obligación de seguir este protocolo, de no publicar sin aprobación escrita y de conservar el respaldo de cada pieza, con responsabilidad por lo publicado sin aprobación.',
                },
                {
                  lead: 'Coherencia con el contrato del cliente.',
                  nivel: 'BAJO',
                  texto:
                    'Revisar que bonos, accesos, plazos y garantías que anuncian las piezas coincidan con el contrato, y actualizar uno u otro antes de publicar. La cláusula de prevalencia ayuda, pero no neutraliza lo que la pieza afirma frente a un consumidor.',
                },
              ],
            },
            {
              id: 'dudas',
              titulo: 'Zonas de duda',
              bajada: 'Puntos donde la interpretación no es pacífica. Se deciden caso por caso con legales.',
              items: [
                {
                  lead: 'Influencers en Argentina.',
                  texto:
                    'No hay una norma específica sobre publicidad de influencers. El deber de identificarla se apoya en las reglas generales de publicidad engañosa, buena fe y lealtad comercial, y su alcance concreto no tiene criterios uniformes.',
                },
                {
                  lead: 'Avisos de resultados no típicos.',
                  texto:
                    'Si un aviso de que los resultados no son típicos alcanza para neutralizar el efecto de un testimonio excepcional es discutido. El criterio prudente es mostrar el contexto del caso y no apoyarse solo en el aviso.',
                },
                {
                  lead: 'Precio tachado en servicios.',
                  texto:
                    'La regla de los treinta días de la Ley 7/1996 está pensada para la venta de artículos y su aplicación a servicios como un programa de formación o de acompañamiento no es pacífica. El precio tachado tiene que ser real igual, porque un precio de referencia ficticio es engañoso.',
                },
                {
                  lead: 'Mensajería y Registro No Llame.',
                  texto:
                    'No está resuelto de forma pacífica si los mensajes por WhatsApp u otras aplicaciones quedan alcanzados por la Ley 26.951 como contactos telefónicos, ni el alcance exacto de sus excepciones para prospectos que dejaron sus datos.',
                },
                {
                  lead: 'Prefijo 400 y empresas chicas.',
                  texto:
                    'La obligación de llamar desde el prefijo 400 se vincula con las empresas alcanzadas por la Ley 10/2025. Su alcance para negocios más chicos y su aplicación práctica, que empieza el 17 de octubre de 2026, todavía no tienen criterios consolidados.',
                },
                {
                  lead: 'Campañas transfronterizas.',
                  texto:
                    'Una campaña hecha desde Argentina o desde una LLC y dirigida a residentes en España puede quedar sujeta a la ley española de publicidad y consumo. Qué ley rige depende de a quién se dirige la pieza y dónde produce efectos, y se analiza caso por caso.',
                },
                {
                  lead: 'Bienestar y finalidad sanitaria.',
                  texto:
                    'Si un programa de hábitos o de bienestar es un método con pretendida finalidad sanitaria depende de cómo se presenta. Cuanto más habla de síntomas, enfermedades o tratamientos, más cerca queda de esas reglas.',
                },
                {
                  lead: 'Formación o asesoramiento financiero.',
                  texto: 'La línea entre enseñar a invertir y recomendar inversiones no siempre es nítida, sobre todo en sesiones en vivo o grupos donde se comentan activos concretos.',
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
              lista: [
                'Toda pieza es una oferta.',
                'Resultados con contexto o no se publican.',
                'La urgencia tiene que ser real.',
                'Testimonios reales y autorizados.',
                'La publicidad se identifica como publicidad.',
              ],
            },
            {
              rotulo: 'Antes de publicar',
              numerada: true,
              lista: [
                '¿Cada afirmación tiene respaldo archivado?',
                '¿El revisor dio verde?',
                '¿Los testimonios tienen autorización escrita?',
                '¿El plazo y los cupos son reales?',
                '¿La aprobó {respAprobacion} por escrito?',
              ],
            },
            {
              rotulo: 'Tres nunca',
              tono: 'nunca',
              lista: ['Nunca prometas ingresos ni resultados.', 'Nunca inventes urgencia ni cupos.', 'Nunca publiques un testimonio sin autorización.'],
            },
            [
              { rotulo: 'Si dudás', texto: 'No se publica hasta que lo vea {respAprobacion}. Una pieza demorada cuesta menos que una pieza retirada.' },
              { rotulo: 'Siempre', texto: 'Versión publicada y respaldo al archivo, el mismo día.' },
            ],
          ],
        },
      ],
    },
  ];
}

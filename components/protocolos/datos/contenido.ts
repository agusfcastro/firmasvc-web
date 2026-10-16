// Contenido del protocolo de datos personales.
// Regla de estilo de FIRMA para estos textos, sin rayas ni dos puntos.

import { bool, opcion } from '../motor/ficha';
import type { BloqueGuion, Ficha, Nivel, NivelEvaluacion, OpcionPlazo, ResultadoSemaforo, Seccion } from '../motor/tipos';
import { numeroDe } from './ficha';

// Evaluación de un incidente

function evaluarIncidente(r: Record<string, string>, f: Ficha): ResultadoSemaforo | null {
  if (!r.datos || !r.quien || !r.legible || !r.contenido) return null;
  const mercado = opcion(f, 'mercado');
  const ilegible = r.legible === 'no';
  const graves = r.datos !== 'contacto';
  const expuesto = r.quien === 'desconocido' || r.quien === 'nose';
  const contenido = r.contenido === 'si';
  const pasos: string[] = [];
  let nivel: Nivel;
  let titulo: string;

  if (!contenido) {
    pasos.push('Antes que nada, contener. Guardar la evidencia y después cambiar claves, revocar accesos, cerrar enlaces públicos y pedir el borrado a quien recibió datos por error.');
  }

  if (ilegible || (r.datos === 'contacto' && (r.quien === 'interno' || r.quien === 'confiable') && contenido)) {
    nivel = 'verde';
    titulo = 'Riesgo improbable para las personas. Se registra y se cierra con su causa.';
    pasos.push('Registrar el incidente con hechos, datos afectados, efectos y medidas, y cerrarlo con su causa raíz.');
    if (ilegible) pasos.push('Confirmar que la clave de cifrado no quedó comprometida. Si quedó, se vuelve a evaluar.');
    if (mercado === 'ES') pasos.push('En España el registro es obligatorio aunque no se notifique a la AEPD (art. 33.5 RGPD).');
    return { nivel, titulo, pasos };
  }

  if ((graves && expuesto) || (r.datos === 'sensibles' && !contenido)) {
    nivel = 'rojo';
    titulo = 'Probable alto riesgo para las personas. Notificación y aviso a los afectados.';
    pasos.push('Avisar hoy a la dirección y a legales, con la evidencia preservada.');
    if (mercado === 'ES') {
      pasos.push('Notificar a la AEPD dentro de las 72 horas desde que se tuvo constancia, aunque falten datos, y completar la información después (art. 33 RGPD).');
      pasos.push('Comunicar a los afectados sin dilación indebida con la plantilla de notificación (art. 34 RGPD).');
    } else if (mercado === 'AR') {
      pasos.push('Comunicar a los afectados con la plantilla de notificación para que puedan protegerse, como medida de prevención del daño (art. 1710 CCyC).');
      pasos.push('Legales evalúa además la comunicación a la AAIP y deja registrada la decisión.');
    } else {
      pasos.push('Revisar hoy con legales el plazo y la autoridad del país que corresponda, y preparar la comunicación a los afectados.');
    }
    if (r.datos === 'identidad') pasos.push('Si hay datos de cobro, avisar a {pasarela} y recomendar a los afectados que vigilen sus movimientos.');
  } else {
    nivel = 'ambar';
    titulo = 'Hay riesgo para las personas. Legales decide hoy la notificación.';
    pasos.push('Legales evalúa el riesgo con los hechos disponibles y decide por escrito.');
    if (mercado === 'ES') {
      pasos.push('Si no se puede descartar el riesgo, notificar a la AEPD dentro de las 72 horas desde que se tuvo constancia (art. 33 RGPD). A los afectados se les comunica si el riesgo es alto (art. 34 RGPD).');
    } else if (mercado === 'AR') {
      pasos.push('En Argentina la ley no fija un plazo general de notificación. Legales decide si comunica a la AAIP y a los afectados, y deja registrada la decisión.');
    } else {
      pasos.push('Revisar con legales el plazo y la autoridad del país que corresponda.');
    }
  }
  pasos.push('Si el incidente lo sufrió un proveedor, pedirle su informe por escrito y revisar su acuerdo de tratamiento.');
  pasos.push('Comunicar solo hechos verificados, sin especular sobre causas ni responsables.');
  return { nivel, titulo, pasos };
}

// Tablero

function proporcion(parte: number | null, total: number | null): number | null {
  if (!total) return null;
  return ((parte ?? 0) / total) * 100;
}

// Secciones

export function secciones(f: Ficha): Seccion[] {
  const mercado = opcion(f, 'mercado');
  const esAR = mercado === 'AR';
  const esES = mercado === 'ES';
  const exterior = bool(f, 'exterior');
  const sensibles = bool(f, 'sensibles');
  const delegado = esES && bool(f, 'delegado');
  const mLlamadas = numeroDe(f, 'mesesLlamadas', 12);
  const mInteresados = numeroDe(f, 'mesesInteresados', 12);
  const aClientes = numeroDe(f, 'aniosClientes', 5);
  const meses = (n: number) => `${n} ${n === 1 ? 'mes' : 'meses'}`;
  const anios = (n: number) => `${n} ${n === 1 ? 'año' : 'años'}`;

  // Bases legales del mapa de datos

  const base = esES
    ? {
        leads: 'Medidas precontractuales pedidas por el interesado (art. 6.1.b RGPD). Comunicaciones comerciales solo con consentimiento (art. 6.1.a RGPD y art. 21 LSSI).',
        llamadas: 'Consentimiento con aviso al inicio y opción de seguir sin registrar (art. 6.1.a RGPD).',
        clientes: 'Ejecución del contrato (art. 6.1.b RGPD).',
        cobros: 'Ejecución del contrato y obligaciones contables y tributarias (art. 6.1.b y c RGPD).',
        firma: 'Ejecución del contrato (art. 6.1.b RGPD) e interés legítimo en conservar la prueba (art. 6.1.f RGPD).',
        equipo: 'Ejecución del contrato y obligaciones legales (art. 6.1.b y c RGPD).',
        registro: 'Obligación legal de responder y de documentar las brechas (arts. 12 y 33.5 RGPD, art. 12.4 LOPDGDD).',
      }
    : esAR
      ? {
          leads: 'Consentimiento informado al completar el formulario (arts. 5 y 6 de la Ley 25.326). Publicidad con datos facilitados por el titular y baja en cualquier momento (art. 27).',
          llamadas: 'Consentimiento expreso con aviso al inicio (art. 5 de la Ley 25.326).',
          clientes: 'Relación contractual, sin necesidad de consentimiento (art. 5.2.d de la Ley 25.326).',
          cobros: 'Relación contractual y obligación legal (art. 5.2.b y d de la Ley 25.326).',
          firma: 'Relación contractual (art. 5.2.d de la Ley 25.326).',
          equipo: 'Relación contractual y obligación legal (art. 5.2.b y d de la Ley 25.326).',
          registro: 'Obligación legal de responder los pedidos y deber de seguridad (arts. 9, 14 y 16 de la Ley 25.326).',
        }
      : {
          leads: 'Consentimiento o pedido del interesado, según la ley aplicable.',
          llamadas: 'Consentimiento con aviso al inicio.',
          clientes: 'Ejecución del contrato.',
          cobros: 'Contrato y obligaciones contables.',
          firma: 'Ejecución del contrato.',
          equipo: 'Contrato y obligaciones legales.',
          registro: 'Obligación legal de responder y documentar.',
        };

  // Derechos de los titulares

  const filasDerechos: string[][] = esES
    ? [
        ['Acceso', 'Saber si se tratan sus datos y obtener copia, con finalidad, destinatarios, plazo, origen y derechos.', 'Un mes', 'La primera copia es gratuita. Más de un pedido en seis meses puede considerarse repetitivo.'],
        ['Rectificación', 'Corregir datos inexactos o completar los incompletos.', 'Un mes', 'Se avisa a cada proveedor o destinatario que tenga el dato.'],
        ['Supresión', 'Eliminar los datos cuando ya no son necesarios, se retira el consentimiento o prospera la oposición.', 'Un mes', 'Cede ante una obligación legal o la defensa de reclamaciones. Lo que se conserva queda bloqueado.'],
        ['Oposición', 'Que se deje de tratar sus datos, en especial para mercadotecnia.', 'En el día para la baja publicitaria', 'Frente a la mercadotecnia directa no admite discusión.'],
        ['Limitación', 'Que los datos se conserven sin usarse mientras se resuelve una disputa.', 'Un mes', 'Se marca en las herramientas para que nadie los use.'],
        ['Portabilidad', 'Recibir sus datos en un formato estructurado o que se transmitan a otro responsable.', 'Un mes', 'Solo los datos que él facilitó, tratados por consentimiento o contrato y en forma automatizada.'],
      ]
    : esAR
      ? [
          ['Acceso', 'Saber qué datos hay, de dónde salieron, para qué se usan y con quién se comparten.', '10 días corridos', 'Gratuito cada seis meses. Se entrega completo y sin datos de terceros.'],
          ['Rectificación y actualización', 'Corregir o completar un dato inexacto o desactualizado.', '5 días hábiles', 'Mientras se verifica, el dato se bloquea o se marca en revisión.'],
          ['Supresión', 'Eliminar los datos.', '5 días hábiles', 'No procede si hay obligación legal de conservar o perjuicio a terceros.'],
          ['Retiro o bloqueo publicitario', 'Dejar de recibir comunicaciones comerciales y salir de la base de publicidad.', 'En el día, por regla interna', 'Sin pedir motivos y sin costo.'],
          ['Revocación del consentimiento', 'Retirar un consentimiento dado, por ejemplo para el registro de las llamadas.', 'En el día, por regla interna', 'No tiene efecto retroactivo sobre lo ya hecho.'],
        ]
      : [
          ['Acceso', 'Saber qué datos hay y para qué se usan.', 'Según la ley aplicable', 'Se entrega completo y sin datos de terceros.'],
          ['Rectificación', 'Corregir un dato inexacto.', 'Según la ley aplicable', 'Se avisa a los proveedores que tengan el dato.'],
          ['Supresión', 'Eliminar los datos.', 'Según la ley aplicable', 'Puede ceder ante una obligación legal de conservar.'],
          ['Baja publicitaria', 'Dejar de recibir comunicaciones comerciales.', 'En el día, por regla interna', 'Sin pedir motivos y sin costo.'],
        ];

  // Plazos

  const opcionesAR: OpcionPlazo[] = [
    {
      id: 'accesoAR',
      rotulo: 'Acceso en Argentina, 10 días corridos',
      cantidad: 10,
      unidad: 'corridos',
      nota: 'Desde el pedido fehaciente del titular (art. 14 de la Ley 25.326). Vencido sin respuesta completa, queda abierta la acción de hábeas data.',
    },
    {
      id: 'rectificacionAR',
      rotulo: 'Rectificación, actualización o supresión en Argentina, 5 días hábiles',
      cantidad: 5,
      unidad: 'habiles',
      nota: 'Desde que se recibe el reclamo o se advierte el error (art. 16 de la Ley 25.326). Si el dato se había cedido, se avisa al cesionario dentro del quinto día hábil.',
    },
  ];
  const opcionesES: OpcionPlazo[] = [
    {
      id: 'pedidoES',
      rotulo: 'Respuesta a un pedido en España, 1 mes',
      cantidad: 1,
      unidad: 'meses',
      nota: 'Vale para acceso, rectificación, supresión, oposición, limitación y portabilidad (art. 12.3 RGPD). Si el pedido no se atiende, el motivo y la vía de reclamo ante la AEPD se informan dentro del mismo mes.',
    },
    {
      id: 'prorrogaES',
      rotulo: 'Respuesta en España con prórroga, 3 meses en total',
      cantidad: 3,
      unidad: 'meses',
      nota: 'La prórroga de dos meses procede por complejidad o número de pedidos y se comunica al titular dentro del primer mes, con sus motivos (art. 12.3 RGPD).',
    },
    {
      id: 'brechaES',
      rotulo: 'Notificación de una brecha a la AEPD, 72 horas',
      cantidad: 72,
      unidad: 'horas',
      nota: 'Desde que se tuvo constancia del incidente, salvo que sea improbable un riesgo para las personas (art. 33 RGPD). Si se notifica después, se explican los motivos de la demora.',
    },
    {
      id: 'delegadoES',
      rotulo: 'Respuesta del delegado a una reclamación en España, 2 meses',
      cantidad: 2,
      unidad: 'meses',
      nota: 'Cuando el titular se dirige al delegado de protección de datos antes de reclamar ante la AEPD (art. 37 LOPDGDD).',
    },
  ];
  const opcionesInternas: OpcionPlazo[] = [
    {
      id: 'llamadas',
      rotulo: `Supresión de una llamada sin venta, ${meses(mLlamadas)}`,
      cantidad: mLlamadas,
      unidad: 'meses',
      nota: 'Desde la fecha de la llamada, según la ficha. Si hay un reclamo en curso, legales decide antes de borrar.',
    },
    {
      id: 'interesados',
      rotulo: `Supresión de un interesado que no compró, ${meses(mInteresados)}`,
      cantidad: mInteresados,
      unidad: 'meses',
      nota: 'Desde el último contacto. Si aceptó comunicaciones, sigue en {correoMasivo} hasta que pida la baja, y la lista se depura una vez al año.',
    },
    {
      id: 'clientes',
      rotulo: `Fin de la conservación de un cliente, ${anios(aClientes)}`,
      cantidad: aClientes * 12,
      unidad: 'meses',
      nota: 'Desde que termina el contrato. La documentación contable y tributaria sigue el plazo que fije el contador.',
    },
  ];
  const opcionesPlazos: OpcionPlazo[] = esES ? [...opcionesES, ...opcionesAR, ...opcionesInternas] : [...opcionesAR, ...opcionesES, ...opcionesInternas];

  // Autoevaluación

  const senales: { id: string; texto: string; peso: number }[] = [
    { id: 's1', texto: 'Hay formularios sin aviso de privacidad o con la casilla de comunicaciones premarcada.', peso: 4 },
    { id: 's2', texto: 'Alguna llamada se registra sin aviso previo o sin esperar la respuesta.', peso: 4 },
    { id: 's3', texto: 'Hay proveedores que alojan datos sin acuerdo de tratamiento guardado.', peso: 4 },
    { id: 's4', texto: 'Personas que ya no están en el equipo conservan accesos a alguna herramienta.', peso: 4 },
    { id: 's5', texto: 'Se usan bases compradas, heredadas o de otro negocio sin origen documentado.', peso: 4 },
  ];
  if (sensibles) senales.push({ id: 's6', texto: 'Se tratan datos de salud u otros sensibles sin consentimiento expreso y separado.', peso: 4 });
  if (exterior) {
    senales.push({
      id: 's7',
      texto: esES
        ? 'Hay proveedores fuera del Espacio Económico Europeo sin garantía de transferencia identificada.'
        : 'Hay proveedores en países sin protección adecuada y sin cláusulas modelo de transferencia.',
      peso: 4,
    });
  }
  senales.push(
    { id: 's8', texto: 'No hay plazos de conservación aplicados o nunca se hizo una supresión.', peso: 2 },
    { id: 's9', texto: 'Los pedidos de los titulares no quedan registrados con fecha de entrada y de respuesta.', peso: 2 },
    { id: 's10', texto: 'Hay datos de clientes en planillas sueltas, descargas o correos personales.', peso: 2 },
    { id: 's11', texto: 'Hay colaboradores con acceso a datos sin compromiso de confidencialidad firmado.', peso: 2 },
    { id: 's12', texto: 'Las comunicaciones masivas no tienen enlace de baja o la baja tarda en aplicarse.', peso: 2 },
    { id: 's13', texto: 'Alguna herramienta no tiene doble factor de autenticación activado.', peso: 2 },
  );
  if (esAR) senales.push({ id: 's14', texto: 'La base de datos no está inscripta ante la AAIP o la inscripción no refleja las finalidades actuales.', peso: 2 });
  if (esES) senales.push({ id: 's15', texto: 'No hay registro de actividades de tratamiento.', peso: 2 });
  senales.push(
    { id: 's16', texto: 'La política de privacidad no menciona el registro de llamadas ni los plazos de conservación.', peso: 1 },
    { id: 's17', texto: 'No hay un registro de incidentes, aunque nunca haya pasado nada.', peso: 1 },
    { id: 's18', texto: 'El mapa de datos no se revisó en el último año.', peso: 1 },
  );
  const nivelesEvaluacion: NivelEvaluacion[] = [
    { desde: 0, nivel: 'info', titulo: 'Sin señales marcadas', texto: 'Marcá las señales que hoy se dan en el negocio. Si no hay ninguna, el control trimestral confirma que siga así.' },
    { desde: 1, nivel: 'verde', titulo: 'Ajustes menores', texto: 'Hay puntos para ordenar, sin un riesgo inmediato. Se corrigen dentro del trimestre y se verifican en el control.' },
    {
      desde: 4,
      nivel: 'ambar',
      titulo: 'Brechas para corregir este mes',
      texto: 'Hay al menos una señal crítica o varias intermedias. {contacto} arma un plan con responsables y fechas, y legales revisa primero las señales críticas.',
    },
    {
      desde: 8,
      nivel: 'rojo',
      titulo: 'Riesgo alto',
      texto: 'Varias señales críticas juntas. Se corrige antes de sumar herramientas, campañas o bases nuevas, y la dirección revisa el plan con legales esta semana.',
    },
  ];

  // Control

  const itemsControl: { id: string; texto: string; critico: boolean }[] = [
    { id: 'c1', texto: 'Cada formulario muestra el aviso de privacidad y la casilla de comunicaciones separada y desmarcada.', critico: true },
    { id: 'c2', texto: 'Cada llamada registrada empieza con el aviso y la respuesta afirmativa.', critico: true },
    { id: 'c3', texto: 'Cada proveedor del mapa de datos tiene su acuerdo de tratamiento guardado.', critico: true },
    { id: 'c4', texto: 'Cada colaborador con acceso firmó el compromiso de confidencialidad antes de su primer acceso.', critico: true },
    { id: 'c5', texto: 'Los accesos de quienes dejaron el equipo se revocaron el mismo día.', critico: true },
    { id: 'c6', texto: 'Todos los pedidos del trimestre se respondieron dentro del plazo legal y quedaron registrados.', critico: true },
  ];
  if (sensibles) itemsControl.push({ id: 'c7', texto: 'Los datos sensibles tienen consentimiento expreso y separado, y acceso restringido.', critico: true });
  itemsControl.push(
    { id: 'e1', texto: 'El mapa de datos refleja las herramientas y los plazos actuales.', critico: false },
    { id: 'e2', texto: 'Se suprimieron los registros con plazo vencido en {crm}, {registro} y {correoMasivo}.', critico: false },
    { id: 'e3', texto: 'Todas las herramientas tienen doble factor de autenticación activado.', critico: false },
    { id: 'e4', texto: 'Cada comunicación masiva incluye el enlace de baja.', critico: false },
    { id: 'e5', texto: 'La política de privacidad publicada coincide con este protocolo.', critico: false },
    { id: 'e6', texto: 'El registro de incidentes está al día, aunque no haya habido ninguno.', critico: false },
  );
  if (esAR) {
    itemsControl.push(
      { id: 'e7', texto: 'La base de datos está inscripta ante la AAIP y la inscripción refleja las finalidades actuales.', critico: false },
      { id: 'e8', texto: 'Las bases usadas para llamadas comerciales se cruzaron con el Registro Nacional No Llame.', critico: false },
    );
  }
  if (esES) {
    itemsControl.push(
      { id: 'e9', texto: 'El registro de actividades de tratamiento está actualizado.', critico: false },
      { id: 'e10', texto: 'Antes de cada campaña se consultaron los sistemas de exclusión publicitaria.', critico: false },
    );
  }
  if (delegado) itemsControl.push({ id: 'e11', texto: 'El contacto del delegado figura en la política y su designación se comunicó a la AEPD.', critico: false });
  itemsControl.push({ id: 'e12', texto: 'El equipo hizo la capacitación anual sobre este protocolo.', critico: false });

  // Plantillas que cambian según el mercado

  const avisoFormulario = esES
    ? `{empresa} es responsable del tratamiento de los datos de este formulario. Los usamos para atender su solicitud y coordinar la llamada que pidió, como medida previa a una posible contratación, y para enviarle comunicaciones comerciales solo si marca la casilla, con base en su consentimiento, que puede retirar cuando quiera. Los datos se alojan en proveedores que actúan por nuestra cuenta${
        exterior ? ', algunos fuera del Espacio Económico Europeo con las garantías que exige el RGPD' : ''
      }, y no se ceden a terceros salvo obligación legal. Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad en {canalDerechos} y reclamar ante la Agencia Española de Protección de Datos.${
        delegado ? ' Contacto del delegado de protección de datos, {contactoDelegado}.' : ''
      } Más información en {politica}.`
    : esAR
      ? `{empresa}, con domicilio en {domicilio}, es responsable de la base de datos de interesados a la que se incorporan los datos de este formulario. Los usamos para responder su consulta y coordinar la llamada que pidió y, solo si marca la casilla, para enviarle novedades. Los campos marcados son obligatorios, porque sin ellos no podemos contactarlo. Los datos se alojan en proveedores que los tratan por nuestra cuenta${
          exterior ? ', algunos con servidores fuera del país' : ''
        }, y no se ceden a terceros para sus propios fines. Puede ejercer sus derechos de acceso, rectificación, actualización y supresión en {canalDerechos}. Más información en {politica}.`
      : '{empresa} es responsable de los datos de este formulario. Los usamos para responder su consulta y coordinar la llamada que pidió y, solo si marca la casilla, para enviarle novedades. Puede ejercer sus derechos en {canalDerechos}. Más información en {politica}.';

  const bloquesFormulario: BloqueGuion[] = [
    { tipo: 'decir', etiqueta: 'Aviso de privacidad corto', condicion: esES ? 'España' : esAR ? 'Argentina' : 'Otro país', texto: avisoFormulario },
  ];
  if (esAR) {
    bloquesFormulario.push({
      tipo: 'decir',
      etiqueta: 'Leyenda de la Disposición DNPDP 10/2008',
      condicion: 'Argentina',
      texto:
        'El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley 25.326. La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',
    });
  }
  if (!esAR && !esES) {
    bloquesFormulario.push({ tipo: 'nota', etiqueta: 'Otro país', texto: 'El contenido mínimo del aviso cambia según la ley aplicable. Legales lo completa antes de publicarlo.' });
  }
  bloquesFormulario.push(
    { tipo: 'decir', etiqueta: 'Casilla de comunicaciones', texto: 'Quiero recibir novedades, contenidos y promociones de {empresa} por correo. Puedo darme de baja cuando quiera.' },
    {
      tipo: 'nota',
      etiqueta: 'Cómo se publica',
      texto:
        'La casilla va separada del envío del formulario y desmarcada. El aviso queda visible antes del botón, no escondido detrás de un enlace. Si el formulario es de una plataforma de agenda, el aviso se carga igual en su descripción.',
    },
    {
      tipo: 'porque',
      texto: esES
        ? 'El aviso cumple el deber de informar al recoger los datos con la primera capa que admite la LOPDGDD (art. 13 RGPD y art. 11 LOPDGDD). La casilla separada deja prueba del consentimiento para comunicaciones, que no se presume por haber pedido una llamada.'
        : 'El aviso cumple el deber de informar antes de recolectar (art. 6 de la Ley 25.326). La casilla separada deja prueba del consentimiento para comunicaciones, que no se presume por haber pedido una llamada.',
    },
    {
      tipo: 'nunca',
      textos: [
        'Casillas premarcadas o un único botón que acepta todo junto.',
        'Pedir documento, ingresos o datos de salud en el formulario de agenda.',
        'Decir que los datos no se comparten con nadie cuando se alojan en proveedores.',
      ],
    },
  );

  const respuestaAcceso = esES
    ? `Estimado [[nombre]]. En respuesta a su solicitud de acceso del [[fecha]], y conforme al art. 15 del RGPD, le confirmamos que {empresa} trata datos personales suyos y le adjuntamos su copia. Categorías de datos. [[categorías, por ejemplo contacto, registro de la llamada, contrato y facturación]]. Finalidades. [[finalidad de cada categoría]]. Destinatarios. Proveedores que los tratan por nuestra cuenta, como {crm} y {registro}${
        exterior ? ', algunos fuera del Espacio Económico Europeo con [[garantía aplicada, por ejemplo cláusulas contractuales tipo]]' : ''
      }. Plazo de conservación. [[plazo o criterio de cada categoría]]. Origen. Los facilitó usted al [[completar el formulario, en la llamada o al contratar]]. Decisiones automatizadas. [[No se toman, o se describe su lógica y sus consecuencias]]. Puede solicitar la rectificación, supresión, limitación u oposición al tratamiento y la portabilidad de sus datos en {canalDerechos}, y presentar una reclamación ante la AEPD.`
    : esAR
      ? 'Estimado [[nombre]]. En respuesta a su pedido de acceso del [[fecha]], y dentro del plazo del art. 14 de la Ley 25.326, le informamos la totalidad de los datos personales que {empresa} registra sobre usted. Datos. [[detalle por categoría, por ejemplo contacto, registro de la llamada, contrato y facturación]]. Finalidad. [[para qué se usa cada categoría]]. Origen. Los facilitó usted al [[completar el formulario, en la llamada o al contratar]]. Destinatarios. Se alojan en proveedores que los tratan por nuestra cuenta, como {crm} y {registro}, y no se ceden a terceros para sus propios fines. Conservación. [[plazo de cada categoría]]. Si quiere rectificar, actualizar o suprimir algún dato, puede pedirlo en {canalDerechos}.'
      : 'Estimado [[nombre]]. En respuesta a su pedido de acceso del [[fecha]], le informamos los datos personales que {empresa} registra sobre usted. Datos. [[detalle por categoría]]. Finalidad. [[para qué se usa cada categoría]]. Origen. [[cómo se obtuvieron]]. Destinatarios. Proveedores que los tratan por nuestra cuenta, como {crm} y {registro}. Conservación. [[plazo de cada categoría]]. Puede pedir la rectificación o supresión en {canalDerechos}.';

  const conservaTexto = esES
    ? 'Conservamos bloqueados únicamente [[datos, por ejemplo la documentación de facturación]], a disposición de jueces, tribunales y autoridades para atender posibles responsabilidades durante su plazo de prescripción, sin usarlos para ningún otro fin.'
    : 'Conservamos únicamente [[datos, por ejemplo la documentación de facturación]], porque existe una obligación legal de conservarlos, y solo para ese fin.';

  const pieEnvio = esES
    ? 'Recibe este correo porque se suscribió en [[origen]]. Puede darse de baja en cualquier momento y sin costo en [[enlace de baja]] o escribiendo a {canalDerechos}.'
    : 'Recibís este correo porque nos dejaste tus datos en [[origen]]. Podés pedir en cualquier momento el retiro o bloqueo, total o parcial, de tus datos de nuestra base, con un clic en [[enlace de baja]] o escribiendo a {canalDerechos}.';

  const notificacionAfectados = `Estimado [[nombre]]. Le escribimos para informarle un incidente de seguridad que afectó datos personales suyos. Qué pasó. El [[fecha]] detectamos [[descripción breve y verificada, por ejemplo un acceso no autorizado a una herramienta de gestión]]. Qué datos. [[categorías afectadas]]. No se vieron afectados [[datos no afectados, por ejemplo datos de tarjeta, que no guardamos]]. Qué hicimos. [[medidas de contención y de mejora]]. Qué le recomendamos. Desconfiar de mensajes que le pidan pagos, claves o datos en nombre de {empresa}, y [[otra recomendación según el caso]]. Para cualquier consulta puede escribirnos a {canalDerechos}, donde lo atiende {contacto}.${
    delegado ? ' También puede contactar a nuestro delegado de protección de datos en {contactoDelegado}.' : ''
  } Lamentamos esta situación y seguimos trabajando para reforzar la protección de sus datos.`;

  const pasoNotificacion = esES
    ? 'Notificación a la AEPD por su sede electrónica dentro de las 72 horas si no se descarta el riesgo, aunque falten datos, y comunicación a los afectados sin dilación si el riesgo es alto.'
    : esAR
      ? 'En Argentina la ley no fija un plazo general. Legales decide si comunica a la AAIP y a los afectados, y lo hace cuando la información les sirve para protegerse.'
      : 'Legales define la autoridad y el plazo según la ley aplicable, y prepara la comunicación a los afectados si el riesgo lo justifica.';

  const bolsilloBrecha = esES
    ? 'En España, notificación a la AEPD dentro de las 72 horas si hay riesgo.'
    : esAR
      ? 'En Argentina no hay un plazo legal general. Decide legales.'
      : 'Plazo y autoridad según la ley aplicable.';

  return [
    {
      id: 'uso',
      titulo: 'Cómo usar este protocolo',
      corto: 'Cómo usarlo',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Este protocolo ordena cómo {empresa} pide, usa, guarda y elimina los datos personales de interesados, clientes y colaboradores, y cómo responde cuando un titular pide algo o cuando algo sale mal. Los datos del negocio se completan una vez en la ficha y se actualizan solos en todas las plantillas.',
        },
        {
          tipo: 'parrafo',
          texto:
            'El objetivo es triple. Que cada dato tenga una finalidad, un lugar y un plazo conocidos, que cada pedido de un titular se responda completo y en plazo, y que un incidente se contenga en horas y no en semanas.',
        },
        { tipo: 'leyenda' },
        {
          tipo: 'roles',
          items: [
            { rol: 'Comercial y setters', foco: 'Avisos en formularios y llamadas, uso del CRM según el rol y derivación de pedidos en el día.' },
            { rol: 'Acompañamiento y operaciones', foco: 'Datos de clientes durante el programa, accesos del equipo y supresión al vencer los plazos.' },
            { rol: 'Privacidad y legales', foco: '{contacto}. Pedidos de titulares, proveedores, incidentes y anexo jurídico.' },
            { rol: 'Dirección', foco: 'Plazos de conservación, aprobación de herramientas nuevas y tablero de indicadores.' },
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            'Este protocolo no reemplaza la política de privacidad publicada. La complementa y tiene que coincidir con ella, así que cuando cambia una herramienta o un plazo se actualizan las dos.',
        },
      ],
    },
    {
      id: 'ficha',
      titulo: 'Ficha del negocio',
      corto: 'Ficha del negocio',
      intro: 'Se completa una sola vez por negocio. Los avisos, las plantillas, el mapa de datos y la calculadora de plazos se actualizan solos.',
      bloques: [{ tipo: 'ficha' }],
    },
    {
      id: 'principios',
      titulo: 'Cinco principios',
      corto: 'Principios',
      intro: 'Valen para cada dato y cada herramienta. Si el equipo recuerda solo esto, ya evita la mayoría de los errores.',
      bloques: [
        {
          tipo: 'reglas',
          items: [
            {
              titulo: 'Solo lo necesario.',
              texto:
                'Cada dato que se pide tiene un uso concreto y conocido por el titular. Lo que no se usa no se pide, y lo que se pide para una cosa no se usa para otra. Menos datos es menos riesgo, menos trabajo y menos para responder cuando alguien pregunta qué tenemos de él.',
            },
            {
              titulo: 'Avisar antes de registrar.',
              texto:
                'Ninguna llamada se registra sin aviso previo y un sí del interesado, y ningún formulario recolecta datos sin su aviso de privacidad. Avisar después no sirve. Si la persona no acepta, se sigue sin registrar y todo se confirma por escrito.',
            },
            {
              titulo: 'Cada dato tiene un plazo.',
              texto:
                'Nada se guarda para siempre. Llamadas sin venta, {mesesLlamadas}. Interesados que no compraron, {mesesInteresados}. Clientes, {aniosClientes} desde que termina el contrato. Vencido el plazo, se suprime en todas las herramientas, salvo lo que la ley obliga a conservar.',
            },
            {
              titulo: 'Acceso mínimo y temporal.',
              texto:
                'Cada persona ve solo lo que su tarea necesita y mientras la tenga. Los accesos se dan por rol, con usuario propio y doble factor, y se revocan el mismo día en que alguien deja el equipo o cambia de función.',
            },
            {
              titulo: 'Un incidente se informa en el día.',
              texto:
                'Un correo a la persona equivocada, un teléfono perdido o un acceso raro se avisan a {contacto} el mismo día, aunque parezcan menores. Quien avisa no tiene problemas por avisar. El problema es el incidente que nadie contó.',
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Cómo se ve en la práctica' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Solo lo necesario',
              texto:
                'El formulario de agenda pide nombre, correo, teléfono y una pregunta de calificación. El domicilio y los datos fiscales se piden recién al contratar, porque recién ahí hacen falta para facturar. Las comunicaciones van en una casilla aparte.',
              cita: 'Quiero recibir novedades, contenidos y promociones de {empresa} por correo. Puedo darme de baja cuando quiera.',
            },
            {
              titulo: 'Avisar antes de registrar',
              texto: 'Es la primera frase de cada llamada, antes de entrar en tema, igual que en el protocolo de llamadas de venta.',
              cita: 'Antes de arrancar, te cuento que la llamada queda registrada así tenemos respaldo de todo lo que hablemos. ¿Estás de acuerdo?',
            },
            {
              titulo: 'Cada dato tiene un plazo',
              texto: 'Una vez por trimestre se suprime lo vencido en cada herramienta y se deja constancia en el registro.',
              cita: 'Supresión trimestral hecha el [[fecha]]. Se eliminaron [[cantidad]] registros vencidos en {crm}, {registro} y {correoMasivo}.',
            },
            {
              titulo: 'Acceso mínimo y temporal',
              texto: 'El día que un setter termina su colaboración se revocan sus accesos y sale este mensaje.',
              cita: 'Hola [[nombre]]. Hoy termina tu colaboración con {empresa}. Ya revocamos tus accesos a {crm} y {registro}. Te pedimos que elimines cualquier dato de interesados o clientes que tengas en tus dispositivos y nos confirmes por este medio que lo hiciste.',
            },
            {
              titulo: 'Un incidente se informa en el día',
              texto: 'Un closer manda por error a un interesado el resumen de la llamada de otra persona. No espera ni intenta arreglarlo solo. Avisa enseguida.',
              cita: 'Posible incidente de datos. Hoy a las [[hora]] mandé por error [[qué]] a [[destinatario]]. Ya le pedí que lo borre. Te lo paso para que lo evalúes.',
            },
          ],
        },
      ],
    },
    {
      id: 'ciclo',
      titulo: 'El ciclo de vida del dato',
      corto: 'Ciclo de vida',
      intro: 'Cada dato pasa por cinco etapas. En cada una hay un responsable, un momento y un error que se repite.',
      bloques: [
        {
          tipo: 'etapas',
          items: [
            {
              titulo: 'Captación',
              cuando: 'Responsables marketing y comercial · Antes de recolectar',
              datos: [
                { rotulo: 'Objetivo', texto: 'Pedir solo lo necesario e informar antes de recolectar.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Formularios con aviso corto, enlace a la política y casilla separada y desmarcada para comunicaciones. En las llamadas, aviso de registro con respuesta afirmativa. Si una base viene de un tercero, origen y consentimiento documentados antes de usarla.',
                },
                { rotulo: 'Frase ancla', texto: 'Antes de arrancar, te cuento que la llamada queda registrada así tenemos respaldo de todo lo que hablemos. ¿Estás de acuerdo?', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Pedir documento, ingresos o datos de salud por las dudas, o premarcar la casilla de comunicaciones.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Uso',
              cuando: 'Responsable cada área · Durante toda la relación',
              datos: [
                { rotulo: 'Objetivo', texto: 'Usar cada dato solo para lo que se informó.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Acceso por rol en {crm}, sin planillas paralelas ni reenvíos a cuentas personales. Comunicaciones comerciales solo a quien las aceptó, con enlace de baja. Nada se comparte con socios o terceros sin consentimiento del titular.',
                },
                { rotulo: 'Frase ancla', texto: 'Este dato lo pedimos para [[finalidad]] y solo lo usamos para eso.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Sumar a la lista de promociones a quien solo pidió una llamada, o usar la base para otro negocio.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Proveedores y transferencias',
              cuando: 'Responsable {contacto} · Antes de cargar datos en una herramienta',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que cada herramienta trate los datos por cuenta de la empresa, con contrato y en un país habilitado.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Acuerdo de tratamiento guardado, país de alojamiento identificado, garantía de transferencia si está fuera, como {mecanismoTransferencia}, y doble factor activado antes de cargar datos reales.',
                },
                { rotulo: 'Frase ancla', texto: 'Antes de cargar datos necesitamos su acuerdo de tratamiento y saber dónde se alojan.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Probar una herramienta nueva subiendo la base real de clientes.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Conservación',
              cuando: 'Responsable {contacto} · Revisión trimestral',
              datos: [
                { rotulo: 'Objetivo', texto: 'Guardar cada dato solo el tiempo fijado.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Llamadas sin venta, {mesesLlamadas}. Interesados que no compraron, {mesesInteresados} desde el último contacto. Clientes, {aniosClientes} desde que termina el contrato. La documentación contable y tributaria, el plazo que fije el contador. Una vez por trimestre se revisan los vencidos.',
                },
                { rotulo: 'Frase ancla', texto: '¿Para qué lo seguimos guardando y hasta cuándo?', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Guardar todo por las dudas, con copias en descargas, correos y planillas viejas.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Supresión',
              cuando: 'Responsable {contacto} · Al vencer el plazo o dentro del plazo de un pedido',
              datos: [
                { rotulo: 'Objetivo', texto: 'Eliminar de verdad, en todas las copias, y dejar constancia.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Borrado en {crm}, {registro}, {correoMasivo}, planillas y descargas, pedido de borrado a los proveedores y registro de qué se eliminó y cuándo. Lo que la ley obliga a conservar queda {bloqueoTexto}.',
                },
                { rotulo: 'Frase ancla', texto: 'Suprimido en todas las herramientas el [[fecha]]. Queda conservado solo [[dato]] por [[obligación legal]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Borrar del CRM y olvidar la herramienta de correo o el registro de llamadas.', estilo: 'error' },
              ],
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Cuatro reglas para las herramientas' },
        {
          tipo: 'tips',
          items: [
            { titulo: 'Usuario propio', texto: 'Nada de cuentas compartidas. Cada acceso tiene nombre y apellido, y así se sabe quién hizo qué.' },
            { titulo: 'Doble factor', texto: 'Activado en {crm}, {registro}, {correoMasivo}, {firma} y {pasarela}, sin excepciones.' },
            { titulo: 'Rol mínimo', texto: 'Cada uno ve lo que su tarea necesita. Un setter no ve contratos ni cobros.' },
            { titulo: 'Sin copias sueltas', texto: 'Ni descargas, ni planillas paralelas, ni reenvíos a cuentas personales. Lo que sale del circuito no se puede borrar después.' },
          ],
        },
      ],
    },
    {
      id: 'pedidos',
      titulo: 'Pedidos de los titulares e incidentes',
      corto: 'Pedidos e incidentes',
      intro: 'Dos flujos con responsable y plazo. Un pedido de un titular y un incidente de seguridad se registran el mismo día en que se conocen.',
      bloques: [
        { tipo: 'subtitulo', texto: 'Pedidos de los titulares' },
        {
          tipo: 'etapas',
          items: [
            {
              titulo: 'Recepción',
              cuando: 'Responsable quien lo recibe · En el día',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que ningún pedido se pierda ni se demore por el canal en que llegó.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Un pedido de acceso, rectificación, supresión, oposición o baja vale por cualquier canal, sea correo, chat, llamada o redes. Se registran la fecha y el canal y se deriva a {contacto} el mismo día.',
                },
                { rotulo: 'Frase ancla', texto: 'Recibimos tu pedido. Lo pasamos al área de privacidad, que te responde por escrito.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Ignorarlo porque llegó por WhatsApp, o pedir que lo repita por otra vía para empezar a contar el plazo.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Verificación de identidad',
              cuando: 'Responsable {contacto} · Al día hábil siguiente',
              datos: [
                { rotulo: 'Objetivo', texto: 'Confirmar que pide el titular, sin pedir más datos de los necesarios.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Si escribe desde el correo o el teléfono registrados, alcanza. Si no, se le pide responder desde ese canal o un dato que solo el titular conoce. Copia de documento solo si es imprescindible, y se borra al cerrar el pedido.',
                },
                { rotulo: 'Frase ancla', texto: 'Para proteger tus datos, confirmanos el pedido respondiendo desde el correo con el que te registraste.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Pedir foto del documento de entrada, o entregar datos a un tercero que dice ser el titular.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Búsqueda y decisión',
              cuando: 'Responsables {contacto} y legales · Dentro del plazo',
              datos: [
                { rotulo: 'Objetivo', texto: 'Encontrar todos los datos y decidir qué procede.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Búsqueda en cada herramienta del mapa de datos, {crm}, {registro}, {correoMasivo}, {firma}, {pasarela}, planillas y correo. Legales define si algo debe conservarse por una obligación legal o por un reclamo en curso.',
                },
                { rotulo: 'Frase ancla', texto: 'Revisamos todas las herramientas del mapa, no solo el CRM.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Responder mirando una sola herramienta y olvidar el registro de llamadas o la lista de correo.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Respuesta',
              cuando: 'Responsable {contacto} · Respuesta en {plazosPedidos}',
              datos: [
                { rotulo: 'Objetivo', texto: 'Responder una sola vez, completo y en plazo.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Respuesta escrita desde {canalDerechos} con la plantilla que corresponda, en lenguaje claro. Si el pedido no procede, total o parcialmente, se explica el motivo y la vía de reclamo ante {autoridad}.',
                },
                { rotulo: 'Frase ancla', texto: 'En respuesta a su pedido del [[fecha]], le confirmamos [[resultado]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Contestar fuera de plazo, o en partes que obligan a nuevos intercambios.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Cierre y registro',
              cuando: 'Responsable {contacto} · El mismo día de la respuesta',
              datos: [
                { rotulo: 'Objetivo', texto: 'Poder probar que se respondió bien y a tiempo.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'El registro de pedidos guarda fecha de entrada, canal, tipo, verificación, respuesta, fecha de salida y constancia de envío. Si hubo rectificación o supresión, se avisa a los proveedores y a quienes hayan recibido el dato.',
                },
                { rotulo: 'Frase ancla', texto: 'Pedido [[número]] cerrado el [[fecha]], respondido en [[días]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'No dejar constancia y no poder probar el plazo cuando llega un reclamo.', estilo: 'error' },
              ],
            },
          ],
        },
        {
          tipo: 'tabla',
          aria: 'Qué puede pedir cada titular',
          columnas: [
            { rotulo: 'Derecho', ancho: '0.8fr', estilo: 'fuerte' },
            { rotulo: 'Qué pide', ancho: '1.3fr' },
            { rotulo: 'Plazo', ancho: '0.8fr', estilo: 'pastilla' },
            { rotulo: 'Cuidado', ancho: '1.2fr', estilo: 'porque' },
          ],
          filas: filasDerechos,
        },
        {
          tipo: 'aclaracion',
          texto: esES
            ? 'El plazo de un mes se puede prorrogar dos meses más por complejidad o número de pedidos, avisando al titular dentro del primer mes. El pedido no se rechaza porque llegó por un canal distinto de {canalDerechos}.'
            : esAR
              ? 'El acceso se cuenta en días corridos y el resto en días hábiles. Si el plazo vence sin respuesta completa, el titular puede ir directamente a la acción de hábeas data.'
              : 'Los plazos dependen de la ley aplicable. Hasta que legales los defina, el pedido se responde lo antes posible y siempre por escrito.',
        },
        { tipo: 'subtitulo', texto: 'Incidentes de seguridad' },
        {
          tipo: 'semaforo',
          id: 'incidente',
          titulo: 'Evaluación del incidente',
          preguntas: [
            {
              id: 'datos',
              texto: '¿Qué datos se vieron afectados?',
              ayuda: 'Si hay varios tipos, elegí el más delicado.',
              opciones: [
                { valor: 'contacto', rotulo: 'Solo datos de contacto' },
                { valor: 'identidad', rotulo: 'Documento, cobros, contratos o llamadas registradas' },
                { valor: 'sensibles', rotulo: 'Datos de salud u otros sensibles' },
                { valor: 'nose', rotulo: 'Todavía no se sabe' },
              ],
            },
            {
              id: 'quien',
              texto: '¿Quién pudo acceder a los datos?',
              opciones: [
                { valor: 'interno', rotulo: 'Alguien del equipo sin permiso' },
                { valor: 'confiable', rotulo: 'Un tercero identificado que confirmó el borrado' },
                { valor: 'desconocido', rotulo: 'Un tercero desconocido, o quedaron públicos' },
                { valor: 'nadie', rotulo: 'Nadie, se perdieron o se borraron sin copia' },
                { valor: 'nose', rotulo: 'No se sabe' },
              ],
            },
            {
              id: 'legible',
              texto: '¿Los datos eran legibles para quien accedió?',
              ayuda: 'Por ejemplo, un archivo cifrado sin la clave no es legible.',
              opciones: [
                { valor: 'si', rotulo: 'Sí' },
                { valor: 'no', rotulo: 'No, estaban cifrados' },
                { valor: 'nose', rotulo: 'No se sabe' },
              ],
            },
            {
              id: 'contenido',
              texto: '¿El incidente ya está contenido?',
              opciones: [
                { valor: 'si', rotulo: 'Sí, accesos cerrados y copias eliminadas' },
                { valor: 'no', rotulo: 'No, o no se sabe' },
              ],
            },
          ],
          evaluar: evaluarIncidente,
        },
        {
          tipo: 'etapas',
          items: [
            {
              titulo: 'Detección y aviso interno',
              cuando: 'Responsable quien lo detecta · En el día',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que {contacto} lo sepa el mismo día.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Quien detecta un acceso, una pérdida, un envío o un borrado indebido de datos lo avisa con el modelo de aviso interno, aunque falte información y aunque parezca menor. También cuenta lo que le pasa a un proveedor.',
                },
                { rotulo: 'Frase ancla', texto: 'Posible incidente de datos. Te paso lo que sé hasta ahora.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Esperar a tener todo claro, o intentar arreglarlo solo para que no se note.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Contención',
              cuando: 'Responsable {contacto} · De inmediato',
              datos: [
                { rotulo: 'Objetivo', texto: 'Cortar el daño sin borrar la evidencia.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Se guardan capturas y registros de acceso. Después se cambian claves, se revocan accesos, se cierran enlaces públicos, se pide el borrado a quien recibió datos por error y se pide su informe al proveedor.',
                },
                { rotulo: 'Frase ancla', texto: 'Te pedimos que elimines el correo recibido por error y nos confirmes que lo hiciste.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Restaurar o borrar todo apurado y perder el rastro de qué pasó y a quién afectó.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Evaluación',
              cuando: 'Responsables {contacto} y legales · Dentro de las 24 horas del aviso',
              datos: [
                { rotulo: 'Objetivo', texto: 'Medir el riesgo para las personas, no para la empresa.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto: 'Qué datos, de cuántas personas, si eran legibles, quién pudo verlos y si ya está contenido. Se completa la evaluación de esta sección y legales decide por escrito.',
                },
                { rotulo: 'Frase ancla', texto: '¿Qué le puede pasar a una persona cuyos datos quedaron expuestos?', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Decidir por el impacto en la imagen y no por el riesgo para los titulares.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Notificación',
              cuando: 'Responsable legales · {plazoBrecha}',
              datos: [
                { rotulo: 'Objetivo', texto: 'Avisar a quien corresponda, en plazo y solo con hechos verificados.' },
                { rotulo: 'Qué tiene que pasar', texto: pasoNotificacion },
                { rotulo: 'Frase ancla', texto: 'Le escribimos para informarle un incidente de seguridad que afectó datos personales suyos.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Prometer que no pasó nada antes de terminar la evaluación, o comunicar suposiciones.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Cierre y aprendizaje',
              cuando: 'Responsable {contacto} · Al cerrar el incidente',
              datos: [
                { rotulo: 'Objetivo', texto: 'Que no se repita.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Registro del incidente con hechos, efectos, medidas y decisiones, causa raíz identificada y ajuste del protocolo, de un permiso o de un proveedor. En España el registro es obligatorio para toda brecha, también las que no se notifican.',
                },
                { rotulo: 'Frase ancla', texto: 'Incidente [[número]] cerrado. Causa [[causa]]. Ajuste [[medida]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Cerrar sin registrar porque al final no fue grave.', estilo: 'error' },
              ],
            },
          ],
        },
        {
          tipo: 'correo',
          titulo: 'Aviso interno de incidente',
          asunto: 'Posible incidente de datos, [[fecha]]',
          cuerpo: [
            'Hola {contacto}.',
            'Te aviso de un posible incidente con datos personales.',
            'Qué pasó. [[descripción en pocas líneas]].',
            'Cuándo. Lo detecté hoy a las [[hora]]. Pudo haber empezado [[fecha estimada, si se sabe]].',
            'Qué datos y de quiénes. [[tipo de datos y cantidad aproximada de personas]].',
            'Qué hice hasta ahora. [[medidas tomadas, por ejemplo cambio de clave o pedido de borrado]].',
            'Quedo atento a lo que necesites.',
            '[[Nombre y rol]]',
          ],
          nota: 'Se manda aunque falte información. Lo importante es que {contacto} lo sepa en el día, y en España el plazo de 72 horas corre desde que la empresa tuvo constancia.',
        },
        {
          tipo: 'aclaracion',
          texto:
            'Un incidente no es solo un ataque. También lo es un correo con datos enviado a quien no correspondía, una planilla compartida con un enlace público, un teléfono perdido sin bloqueo o un borrado sin copia.',
        },
      ],
    },
    {
      id: 'herramientas',
      titulo: 'Mapa de datos y plazos',
      corto: 'Mapa y plazos',
      intro:
        'Tres herramientas. El mapa de datos dice qué hay, para qué y dónde, la calculadora dice cuándo vence cada plazo y la autoevaluación marca por dónde empezar.',
      bloques: [
        { tipo: 'subtitulo', texto: 'Mapa de datos' },
        {
          tipo: 'tabla',
          aria: 'Mapa de datos',
          columnas: [
            { rotulo: 'Dato', ancho: '0.75fr', estilo: 'fuerte' },
            { rotulo: 'Finalidad', ancho: '1.1fr' },
            { rotulo: 'Base legal', ancho: '1.2fr', estilo: 'porque' },
            { rotulo: 'Herramienta', ancho: '0.85fr' },
            { rotulo: 'Conservación', ancho: '1fr' },
            { rotulo: 'Quién accede', ancho: '0.85fr' },
          ],
          filas: [
            [
              'Interesados',
              'Responder la consulta, agendar y hacer la llamada de venta. Enviar novedades solo si las aceptó.',
              base.leads,
              '{crm} y {correoMasivo}',
              '{mesesInteresados} desde el último contacto. La lista de novedades, hasta la baja.',
              'Comercial y setters asignados',
            ],
            ['Llamadas de venta', 'Respaldo de lo conversado y acordado, y control de calidad.', base.llamadas, '{registro}, con enlace en {crm}', 'Sin venta, {mesesLlamadas}. Con venta, el plazo de clientes.', 'Líder comercial y legales'],
            [
              'Clientes',
              'Prestar el servicio, comunicarse durante el programa y atender reclamos.',
              base.clientes,
              '{crm} y el canal del programa',
              '{aniosClientes} desde que termina el contrato.',
              'Acompañamiento asignado, legales y dirección',
            ],
            [
              'Cobros',
              'Cobrar, facturar, gestionar contracargos y cumplir obligaciones contables.',
              base.cobros,
              '{pasarela}. Los datos de tarjeta quedan en la pasarela.',
              'El que fijen las normas contables y tributarias, según el contador.',
              'Administración',
            ],
            ['Firma de contratos', 'Celebrar el contrato y conservar la prueba de la firma.', base.firma, '{firma}', 'El plazo de clientes.', 'Legales y administración'],
            [
              'Equipo',
              'Contratar, pagar y dar o quitar accesos a closers, setters y acompañamiento.',
              base.equipo,
              'Legajo del equipo y herramienta de pagos',
              'Durante la relación y lo que exijan las normas laborales y tributarias, según el abogado laboral y el contador.',
              'Dirección y administración',
            ],
            [
              'Pedidos e incidentes',
              'Probar que cada pedido se respondió en plazo y documentar cada incidente.',
              base.registro,
              'Registro de pedidos e incidentes',
              'Mientras pueda haber un reclamo o una inspección, según legales.',
              '{contacto} y legales',
            ],
          ],
        },
        {
          tipo: 'aclaracion',
          texto: exterior
            ? esES
              ? 'Las herramientas alojadas fuera del Espacio Económico Europeo necesitan {mecanismoTransferencia}. El mapa es la base del registro de actividades que exige el RGPD y se actualiza el mismo día en que se suma o cambia una herramienta.'
              : 'Las herramientas alojadas en el exterior necesitan {mecanismoTransferencia}. El mapa es la base de la inscripción de la base de datos y de la política de privacidad, y se actualiza el mismo día en que se suma o cambia una herramienta.'
            : 'El mapa es la base de la política de privacidad, de la inscripción de la base en Argentina y del registro de actividades en España. Se actualiza el mismo día en que se suma o cambia una herramienta.',
        },
        {
          tipo: 'plazos',
          id: 'plazos',
          titulo: 'Calculadora de plazos',
          intro: 'Para no dejar vencer nada. Elegí el plazo y la fecha desde la que corre.',
          opciones: opcionesPlazos,
        },
        {
          tipo: 'evaluacion',
          id: 'autoevaluacion',
          titulo: 'Autoevaluación de cumplimiento',
          intro: 'Marcá las señales que hoy se dan en el negocio. Cada una suma según su peso y el resultado dice por dónde empezar.',
          items: senales,
          niveles: nivelesEvaluacion,
        },
      ],
    },
    {
      id: 'plantillas',
      titulo: 'Plantillas',
      corto: 'Plantillas',
      intro:
        'Modelos ordenados por situación. Se completan con la ficha y se adaptan al tono de cada empresa siempre que no cambie el contenido. Los mensajes de chat van con vos y las comunicaciones formales con usted.',
      bloques: [
        {
          tipo: 'guiones',
          aria: 'Plantillas por situación',
          items: [
            {
              id: 'formularios',
              titulo: 'Formularios',
              bajada: 'Aviso corto debajo de cada formulario y casilla separada para comunicaciones. Lo publica marketing.',
              bloques: bloquesFormulario,
            },
            {
              id: 'llamadas',
              titulo: 'Llamadas',
              bajada: 'Aviso de registro, igual que en el protocolo de llamadas de venta. Primera frase de la llamada, antes de entrar en tema.',
              bloques: [
                { tipo: 'decir', etiqueta: 'Versión corta', texto: 'Antes de arrancar, te cuento que la llamada queda registrada así tenemos respaldo de todo lo que hablemos. ¿Estás de acuerdo?' },
                {
                  tipo: 'decir',
                  etiqueta: 'Si pregunta para qué o qué pasa con el registro',
                  texto:
                    'Es para los dos. Si después surge una duda sobre lo que hablamos, lo podemos revisar. El registro lo guarda {empresa}, solo lo ve el equipo que lo necesita y, si no avanzamos, se elimina a los {mesesLlamadas}. Los detalles están en la política de privacidad, en {politica}.',
                },
                { tipo: 'decir', etiqueta: 'Si no acepta', texto: 'No hay problema, seguimos sin registrar. Al final te mando todo lo importante por escrito.' },
                {
                  tipo: 'nota',
                  etiqueta: 'Procedimiento si no acepta',
                  texto: 'Detener el registro en {registro}, dejar constancia en {crm} y hacer el repaso de cierre por escrito, con respuesta del prospecto, antes de enviar el link de pago.',
                },
                { tipo: 'decir', etiqueta: 'Si después pide que se borre', texto: 'Recibido. Paso tu pedido a {contacto}, que te responde por escrito dentro de {plazoRectificacion}.' },
                {
                  tipo: 'nota',
                  etiqueta: 'Antes de borrar',
                  texto: 'Si la llamada terminó en venta o hay un reclamo, legales decide qué se conserva. La llamada es prueba del contrato y su supresión puede no proceder mientras exista una obligación o un reclamo.',
                },
                { tipo: 'porque', texto: 'El aviso con un sí cumple el deber de informar y deja constancia del consentimiento. Ofrecer seguir sin registrar es lo que mantiene ese consentimiento libre.' },
                {
                  tipo: 'nunca',
                  textos: [
                    'Arrancar la llamada sin avisar, o avisar a mitad de camino.',
                    'Dar una finalidad distinta de la real, como decir que es solo para capacitación interna.',
                    'Seguir registrando después de que la persona dijo que no.',
                    'Descargar llamadas a dispositivos o cuentas personales.',
                  ],
                },
              ],
            },
            {
              id: 'acceso',
              titulo: 'Pedido de acceso',
              bajada: 'Lo responde {contacto} desde {canalDerechos}. Comunicación formal, con usted.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Acuse de recibo',
                  texto:
                    'Estimado [[nombre]]. Recibimos el [[fecha]] su pedido de acceso a sus datos personales. Lo estamos procesando y le responderemos por este medio dentro de {plazoAcceso}. Si necesitamos confirmar su identidad, se lo pediremos por esta misma vía.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Verificación de identidad',
                  texto:
                    'Estimado [[nombre]]. Para proteger sus datos necesitamos confirmar que el pedido proviene de su titular. Le pedimos que responda este correo desde la dirección con la que se registró en {empresa}, o que nos indique [[dato que solo el titular conoce, por ejemplo la fecha de su llamada o el programa contratado]]. Por ahora no necesitamos copia de su documento.',
                },
                { tipo: 'decir', etiqueta: 'Respuesta', condicion: esES ? 'España' : esAR ? 'Argentina' : 'Otro país', texto: respuestaAcceso },
                {
                  tipo: 'nota',
                  etiqueta: 'Qué no se entrega',
                  texto: 'Datos de terceros, como notas internas que identifican a otras personas o fragmentos de otras llamadas. Si el registro incluye a otras personas, se entrega la parte del titular o se consulta a legales.',
                },
                { tipo: 'porque', texto: 'Una respuesta completa y en plazo cierra el pedido. Una incompleta lo reabre y habilita {viaReclamo}.' },
              ],
            },
            {
              id: 'rectificacion',
              titulo: 'Rectificación y supresión',
              bajada: 'Respuestas formales. Antes de enviarlas, el dato se corrigió o se borró en todas las herramientas del mapa.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Rectificación hecha',
                  texto:
                    'Estimado [[nombre]]. En respuesta a su pedido del [[fecha]], le confirmamos que corregimos [[dato]] en nuestros registros y en los de los proveedores que lo tratan por nuestra cuenta. Si encuentra otro dato inexacto, puede indicarlo en {canalDerechos}.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Supresión hecha',
                  texto: `Estimado [[nombre]]. En respuesta a su pedido del [[fecha]], le confirmamos que suprimimos sus datos personales de {crm}, {registro}, {correoMasivo} y del resto de las herramientas de {empresa}. ${conservaTexto}`,
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Supresión que no procede o procede en parte',
                  texto:
                    'Estimado [[nombre]]. Recibimos su pedido de supresión del [[fecha]]. Suprimimos [[datos suprimidos]]. No podemos suprimir por ahora [[datos conservados]] porque [[motivo concreto, por ejemplo la obligación legal de conservar la documentación contable o un reclamo en curso]]. Los conservamos solo para ese fin y los eliminaremos cuando venza [[plazo]]. Si no está de acuerdo, puede reclamar ante {autoridad} o acudir a la vía judicial.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Antes de responder',
                  texto:
                    'Pedir el borrado a los proveedores que trataron el dato y avisar a quienes lo hayan recibido. En Argentina, al cesionario dentro del quinto día hábil (art. 16 de la Ley 25.326). En España, a cada destinatario (art. 19 RGPD).',
                },
                {
                  tipo: 'nunca',
                  textos: [
                    'Confirmar una supresión sin revisar el registro de llamadas, la herramienta de correo y las planillas.',
                    'Borrar lo que hay que conservar por un reclamo en curso sin consultar a legales.',
                  ],
                },
              ],
            },
            {
              id: 'bajas',
              titulo: 'Baja de comunicaciones',
              bajada: 'Se aplica en el día y sin pedir motivos. La gestiona marketing.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Confirmación de la baja',
                  texto:
                    'Listo [[nombre]], te dimos de baja de las comunicaciones de {empresa}. No vas a recibir más novedades ni promociones. Si sos cliente, vas a seguir recibiendo solo los mensajes del servicio que contrataste.',
                },
                { tipo: 'decir', etiqueta: 'Pie de cada envío', condicion: esES ? 'España' : 'Argentina', texto: pieEnvio },
                {
                  tipo: 'decir',
                  etiqueta: 'Si pregunta de dónde sacamos sus datos',
                  texto: 'Tus datos los dejaste vos el [[fecha]] al [[completar el formulario o agendar la llamada]]. Si querés, te damos de baja ahora mismo.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Si los datos vinieron de un tercero',
                  texto: 'Se informa quién los proveyó, como exige en Argentina el art. 27 del Decreto 1558/2001, y el caso pasa a legales antes de seguir usando esa base.',
                },
                {
                  tipo: 'porque',
                  texto:
                    'En Argentina cada comunicación publicitaria tiene que indicar en forma destacada cómo pedir el retiro o bloqueo de los datos. En España la baja tiene que ser sencilla y gratuita en cada envío (art. 21 LSSI).',
                },
                {
                  tipo: 'nunca',
                  textos: [
                    'Pedir el motivo como condición para dar la baja.',
                    'Mandar un último correo de despedida con promociones.',
                    'Dar de baja de una lista y seguir escribiendo desde otra herramienta.',
                  ],
                },
              ],
            },
            {
              id: 'incidentes',
              titulo: 'Incidentes',
              bajada: 'Comunicaciones después de la evaluación de legales. Solo hechos verificados.',
              bloques: [
                { tipo: 'decir', etiqueta: 'Notificación a los afectados', texto: notificacionAfectados },
                {
                  tipo: 'nota',
                  etiqueta: 'Antes de enviarla',
                  texto:
                    'La revisa legales. Se describen hechos verificados, sin especular sobre causas ni responsables, y si hay dudas sobre la seguridad del canal habitual se usa otro.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Pedido de borrado a quien recibió datos por error',
                  texto:
                    'Hola [[nombre]]. Hoy te llegó por error un correo de {empresa} con información de otra persona. Te pedimos que lo elimines sin reenviarlo y nos confirmes por este medio que lo hiciste. Gracias por la ayuda.',
                },
                {
                  tipo: 'porque',
                  texto:
                    'En España la comunicación a los afectados describe en lenguaje claro la naturaleza de la brecha, sus consecuencias probables, las medidas adoptadas y un punto de contacto (art. 34 RGPD). En Argentina no es obligatoria por ley, pero permite que las personas se protejan.',
                },
                { tipo: 'nunca', textos: ['Decir que no pasó nada grave antes de terminar la evaluación.', 'Culpar a un proveedor o a un integrante del equipo en la comunicación.'] },
              ],
            },
            {
              id: 'proveedores',
              titulo: 'Proveedores',
              bajada: 'Pedido del acuerdo de tratamiento antes de cargar datos. Lo envía {contacto}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Pedido de acuerdo de tratamiento',
                  texto:
                    'Estimados. {empresa} va a utilizar [[servicio]] para [[finalidad]], lo que implica que ustedes traten por nuestra cuenta datos personales de [[categorías de personas, por ejemplo interesados y clientes]]. Para cumplir con {normaDatos}, les pedimos que nos envíen su acuerdo de tratamiento de datos firmado, o el enlace a la versión vigente que forma parte de sus términos, y que nos confirmen el país donde se alojan los datos, las medidas de seguridad que aplican, la lista de subencargados y el mecanismo que usan para las transferencias internacionales, como {mecanismoProveedor}. Quedamos a la espera para avanzar con la contratación.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Si el proveedor no firma acuerdos a medida',
                  texto:
                    'Los proveedores grandes suelen tener un acuerdo estándar incorporado a sus términos. Se descarga con fecha, se guarda en la carpeta de proveedores y se anota en el mapa de datos. Si no existe ninguno, la herramienta no se usa con datos reales.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Qué revisar',
                  texto:
                    'Que actúe solo según instrucciones, confidencialidad de su personal, medidas de seguridad, aviso de incidentes sin demora, autorización para subencargados, ayuda para responder pedidos de titulares y borrado o devolución al terminar.',
                },
                { tipo: 'porque', texto: 'Quien trata datos por cuenta de la empresa tiene que estar obligado por contrato a seguir sus instrucciones y a cuidar la seguridad (art. 25 de la Ley 25.326 y su decreto, art. 28 RGPD).' },
              ],
            },
            {
              id: 'equipo',
              titulo: 'Equipo',
              bajada: 'Compromiso de confidencialidad al alta y cierre de accesos a la salida.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Compromiso de confidencialidad',
                  texto:
                    '[[Nombre del colaborador]] se compromete a mantener en estricta reserva los datos personales de interesados, clientes y colaboradores de {empresa} a los que acceda con motivo de su servicio, a usarlos solo para las tareas encomendadas y según las instrucciones recibidas, a no copiarlos a dispositivos, cuentas o herramientas personales, a no cederlos ni comunicarlos a terceros y a informar a {contacto}, en el mismo día, cualquier incidente que conozca. Al terminar la relación devolverá o eliminará los datos que tenga en su poder y confirmará por escrito que lo hizo. Esta obligación subsiste después de terminada la relación, {confidencialidadLegal}.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Mensaje de salida',
                  texto:
                    'Hola [[nombre]]. Hoy termina tu colaboración con {empresa}. Ya revocamos tus accesos a {crm} y {registro}. Te pedimos que elimines cualquier dato de interesados o clientes que tengas en tus dispositivos o cuentas y nos confirmes por este medio que lo hiciste. Gracias por el trabajo.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Si el colaborador es empleado',
                  texto:
                    'El compromiso se integra al contrato de trabajo o a un reglamento interno, y el tratamiento de los datos del propio trabajador sigue reglas laborales que se revisan con el abogado laboral.',
                },
                {
                  tipo: 'porque',
                  texto:
                    'El deber de secreto alcanza a todos los que intervienen en el tratamiento, aun después de terminada la relación. Firmado antes del primer acceso, convierte una obligación legal en un compromiso concreto y probado.',
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
      intro: 'Con datos personales, una frase cómoda puede ser una promesa falsa o una confesión. Estas son las más comunes y cómo reemplazarlas.',
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
              'Quedate tranquilo, la llamada no se registra.',
              'Antes de arrancar, te cuento que la llamada queda registrada así tenemos respaldo de todo lo que hablemos. ¿Estás de acuerdo?',
              'Si se registra, es falso y vicia el consentimiento. Le quita además todo valor a la prueba.',
            ],
            ['Es solo para capacitación interna.', 'Es para los dos, por si después surge una duda sobre lo que hablamos.', 'La finalidad informada tiene que ser la real. Usar el registro como prueba sería otra finalidad.'],
            [
              'Tus datos están cien por ciento seguros.',
              'Cuidamos tus datos con accesos restringidos y proveedores con obligaciones de seguridad.',
              'Nadie puede garantizar seguridad absoluta. Ante un incidente, la frase se vuelve en contra.',
            ],
            [
              'No compartimos tus datos con nadie.',
              'No vendemos ni cedemos tus datos. Se alojan en proveedores que trabajan por nuestra cuenta.',
              'Es falso si hay CRM, registro de llamadas o pasarela de pago, y contradice la política de privacidad.',
            ],
            ['No se puede borrar, el sistema no lo permite.', 'Recibimos tu pedido. Te respondemos por escrito dentro de {plazoRectificacion}.', 'Una limitación técnica no es causa legal para negar la supresión.'],
            [
              'Mandame foto del documento de los dos lados por WhatsApp.',
              'Para confirmar que sos vos, respondé desde el correo con el que te registraste.',
              'Pide más datos de los necesarios y los deja en un canal sin control.',
            ],
            ['Pasame la planilla de clientes a mi correo personal.', 'Lo vemos en {crm}, con el acceso de tu rol.', 'Saca los datos del circuito controlado. Lo que sale ya no se puede borrar.'],
            [
              'Te sumo a la lista de novedades, total después te das de baja.',
              '¿Querés recibir novedades por correo? Te podés dar de baja cuando quieras.',
              'Sin aceptación previa no hay consentimiento, y en España el envío sin autorización está prohibido.',
            ],
            [
              'Le paso tus datos a un colega que te puede ayudar.',
              '¿Querés que te ponga en contacto con [[nombre]]? Si me decís que sí, le paso tu correo.',
              'Darle los datos a otro para sus propios fines es una cesión y necesita el consentimiento del titular.',
            ],
            ['No pasó nada grave, no hace falta avisar.', 'Lo informo ahora a {contacto} con lo que sé hasta el momento.', 'La gravedad la evalúa legales. En España las 72 horas corren desde que la empresa tuvo constancia.'],
            [
              'Ya borramos todo.',
              'Suprimimos tus datos de nuestras herramientas. Conservamos solo [[dato]] por la obligación legal de [[motivo]].',
              'Una afirmación falsa sobre la supresión es peor que una conservación justificada.',
            ],
          ],
        },
      ],
    },
    {
      id: 'alertas',
      titulo: 'Alertas y escalamiento',
      corto: 'Alertas',
      intro: 'Ante cualquiera de estas señales, el caso sale del día a día y pasa a quien corresponde. Nadie del equipo decide quedárselo.',
      bloques: [
        {
          tipo: 'tabla',
          aria: 'Alertas y escalamiento',
          columnas: [
            { rotulo: 'Señal', ancho: '1.2fr', estilo: 'senal' },
            { rotulo: 'Qué hacer', ancho: '1.3fr' },
            { rotulo: 'Escalar a', ancho: '0.7fr', estilo: 'pastilla' },
          ],
          filas: [
            ['Un titular pide acceso, corrección, supresión o baja, por cualquier canal.', 'Registrar fecha y canal, acusar recibo y derivar. El plazo corre desde que llegó.', '{contacto} hoy'],
            ['Llega un requerimiento de {autoridadCorta}, una intimación o una demanda sobre datos.', 'Escanear, registrar la fecha de recepción y derivar. No se responde nada sin legales.', 'Legales hoy'],
            ['Un correo con datos llegó a quien no correspondía, se perdió un dispositivo o hay un acceso sospechoso.', 'Aviso interno en el día con lo que se sabe y contención inmediata.', '{contacto} y dirección'],
            ['Un proveedor informa un incidente, o cambia de subencargados o de país de alojamiento.', 'Pedir su informe por escrito y medir el impacto con el mapa de datos.', 'Legales hoy'],
            ['Un colaborador deja el equipo o cambia de función.', 'Revocar o ajustar accesos el mismo día y enviar el mensaje de salida.', 'Dirección'],
            ['Alguien quiere sumar una herramienta nueva que guarda datos.', 'No cargar datos reales hasta tener el acuerdo de tratamiento y el país de alojamiento.', '{contacto}'],
            ['Se ofrece comprar, recibir o importar una base de datos.', 'No usarla hasta revisar su origen, el consentimiento y, en Argentina, el Registro Nacional No Llame.', 'Legales'],
            ['Aparecen datos de salud u otros sensibles que el programa no necesita.', 'No registrarlos, borrar lo que se haya anotado y consultar.', 'Legales'],
            ['Un posible menor de edad deja sus datos o participa de una llamada.', 'No avanzar con la venta ni con comunicaciones, y marcarlo en {crm}.', 'Legales'],
            ['La policía, un abogado o un tercero pide datos de un cliente.', 'No entregar nada por teléfono ni por chat. Pedir el requerimiento por escrito.', 'Legales hoy'],
            ['Un cliente pide copia del registro de su llamada.', 'Es un pedido de acceso. Se registra y se responde con la plantilla.', '{contacto}'],
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'Escalar no es desentenderse. Quien detecta la señal deja el caso registrado y sigue disponible para lo que necesite quien lo toma.',
        },
      ],
    },
    {
      id: 'control',
      titulo: 'Control de cumplimiento',
      corto: 'Control',
      intro: 'Lo hace {contacto} una vez por trimestre, con las herramientas abiertas. El resultado se informa a la dirección y alimenta el tablero.',
      bloques: [
        {
          tipo: 'checklist',
          id: 'cumplimiento',
          titulo: 'Control trimestral',
          textoConforme: 'Conforme',
          textoNoConforme: 'No conforme · falta al menos un ítem crítico',
          items: itemsControl,
        },
        {
          tipo: 'aclaracion',
          texto: 'Un ítem crítico sin cumplir se corrige antes del próximo control mensual de pedidos, no al trimestre siguiente.',
        },
      ],
    },
    {
      id: 'tablero',
      titulo: 'Tablero de indicadores',
      corto: 'Tablero',
      intro: 'Pedidos e incidentes se miran todos los meses y el resto una vez por trimestre. Lo que no se mide se acumula, y con datos lo que se acumula es riesgo.',
      bloques: [
        {
          tipo: 'kpis',
          items: [
            {
              nombre: 'Pedidos respondidos en plazo',
              formula: 'Pedidos respondidos dentro del plazo legal, dividido pedidos con vencimiento en el mes, por cien.',
              lectura: 'Es una obligación legal, no una meta comercial. Un pedido fuera de plazo habilita {viaReclamo}.',
              meta: 'Todos dentro del plazo',
              frecuencia: 'Mensual',
              fuente: 'Registro de pedidos',
            },
            {
              nombre: 'Tiempo de respuesta',
              formula: 'Días entre la entrada y la respuesta de cada pedido, en promedio y el máximo del mes.',
              lectura: 'El promedio muestra la rutina y el máximo muestra el riesgo. Un máximo cerca del vencimiento avisa que el circuito depende de una sola persona.',
              frecuencia: 'Mensual',
              fuente: 'Registro de pedidos',
            },
            {
              nombre: 'Incidentes',
              formula: 'Incidentes registrados en el mes por tipo, y horas entre la detección y el aviso a {contacto}.',
              lectura: 'Que aparezcan incidentes menores registrados es buena señal, porque muestra que el equipo avisa. Lo preocupante es el aviso tardío.',
              meta: 'Aviso en el día',
              frecuencia: 'Mensual',
              fuente: 'Registro de incidentes',
            },
            {
              nombre: 'Proveedores con acuerdo de tratamiento',
              formula: 'Proveedores con acuerdo guardado, dividido proveedores que alojan o acceden a datos, por cien.',
              lectura: 'Cada proveedor sin acuerdo es un tratamiento sin instrucciones ni deber de confidencialidad documentados.',
              meta: 'Todos',
              frecuencia: 'Trimestral',
              fuente: 'Mapa de datos',
            },
            {
              nombre: 'Colaboradores con confidencialidad firmada',
              formula: 'Colaboradores con compromiso firmado, dividido colaboradores con acceso a datos, por cien.',
              lectura: 'Se controla en cada alta. El compromiso se firma antes del primer acceso, no después.',
              meta: 'Todos',
              frecuencia: 'Mensual',
              fuente: 'Legajos del equipo',
            },
            {
              nombre: 'Registros eliminados según el plazo',
              formula: 'Registros suprimidos, dividido registros con plazo vencido en el período, por cien.',
              lectura: 'Mide si los plazos de la ficha se aplican en la práctica. Si baja, los datos se acumulan y cada pedido o incidente alcanza a más personas.',
              meta: 'Todos los vencidos',
              frecuencia: 'Trimestral',
              fuente: '{crm}, {registro} y {correoMasivo}',
            },
            {
              nombre: 'Accesos revocados a tiempo',
              formula: 'Salidas del equipo con accesos revocados el mismo día, dividido salidas del período, por cien.',
              lectura: 'Un acceso vivo de alguien que ya no está es una de las puertas de incidente más fáciles de cerrar.',
              meta: 'Todas en el día',
              frecuencia: 'Mensual',
              fuente: 'Registro de accesos',
            },
          ],
        },
        {
          tipo: 'calculadora',
          id: 'tableroDatos',
          titulo: 'Tablero rápido del período',
          intro: 'Cargá los números del mes o del trimestre y obtené los indicadores principales.',
          entradas: [
            { id: 'pedidos', rotulo: 'Pedidos con vencimiento', unidad: 'casos' },
            { id: 'enPlazo', rotulo: 'Respondidos en plazo', unidad: 'casos' },
            { id: 'incidentes', rotulo: 'Incidentes registrados', unidad: 'casos' },
            { id: 'avisoDia', rotulo: 'Incidentes avisados en el día', unidad: 'casos' },
            { id: 'proveedores', rotulo: 'Proveedores con datos', unidad: 'proveedores' },
            { id: 'conAcuerdo', rotulo: 'Proveedores con acuerdo', unidad: 'proveedores' },
            { id: 'colaboradores', rotulo: 'Colaboradores con acceso', unidad: 'personas' },
            { id: 'conConfidencialidad', rotulo: 'Con confidencialidad firmada', unidad: 'personas' },
            { id: 'vencidos', rotulo: 'Registros con plazo vencido', unidad: 'registros' },
            { id: 'eliminados', rotulo: 'Registros eliminados', unidad: 'registros' },
          ],
          salidas: [
            { id: 'pctPlazo', rotulo: 'Pedidos en plazo', formato: 'pct', destacada: true, calcular: (v) => proporcion(v.enPlazo, v.pedidos) },
            { id: 'pctAviso', rotulo: 'Incidentes avisados en el día', formato: 'pct', calcular: (v) => proporcion(v.avisoDia, v.incidentes) },
            { id: 'pctAcuerdo', rotulo: 'Proveedores con acuerdo', formato: 'pct', calcular: (v) => proporcion(v.conAcuerdo, v.proveedores) },
            { id: 'pctConfidencialidad', rotulo: 'Colaboradores con confidencialidad', formato: 'pct', calcular: (v) => proporcion(v.conConfidencialidad, v.colaboradores) },
            { id: 'pctEliminados', rotulo: 'Registros eliminados según el plazo', formato: 'pct', calcular: (v) => proporcion(v.eliminados, v.vencidos) },
          ],
          conclusion: (_v, r) => {
            const medidos = [
              { valor: r.pctPlazo, nombre: 'pedidos en plazo' },
              { valor: r.pctAviso, nombre: 'avisos de incidentes' },
              { valor: r.pctAcuerdo, nombre: 'acuerdos con proveedores' },
              { valor: r.pctConfidencialidad, nombre: 'compromisos de confidencialidad' },
              { valor: r.pctEliminados, nombre: 'supresión de vencidos' },
            ].filter((x) => x.valor !== null);
            if (!medidos.length) return null;
            if (r.pctPlazo !== null && r.pctPlazo < 100) {
              return {
                nivel: 'rojo',
                texto: 'Hubo pedidos respondidos fuera del plazo legal. Legales revisa cada caso y el circuito de recepción antes del próximo mes.',
              };
            }
            const brechas = medidos.filter((x) => (x.valor ?? 0) < 100).map((x) => x.nombre);
            if (brechas.length) {
              return { nivel: 'ambar', texto: `Hay brechas en ${brechas.join(', ')}. Cada una necesita un responsable y una fecha en el plan del período.` };
            }
            return { nivel: 'verde', texto: 'Todo en regla en lo que se midió. Se mantiene el control trimestral.' };
          },
          nota: 'Herramienta orientativa. Los porcentajes salen de los registros del negocio y no reemplazan la revisión de cada caso por legales.',
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
              bajada: 'Ley 25.326 de Protección de los Datos Personales, Decreto 1558/2001 y normas de la AAIP.',
              abierto: true,
              items: [
                {
                  lead: 'Qué es un dato personal.',
                  nivel: 'BAJO',
                  texto:
                    'Es información de cualquier tipo referida a personas físicas o de existencia ideal determinadas o determinables, y son sensibles los datos que revelan origen racial y étnico, opiniones políticas, convicciones religiosas, filosóficas o morales, afiliación sindical e información referente a la salud o a la vida sexual (art. 2). El correo de un interesado, la voz de una llamada registrada y los datos de cobro son datos personales. Para el decreto, las bases privadas que exceden el uso exclusivamente personal quedan alcanzadas (art. 1 del Decreto 1558/2001).',
                },
                {
                  lead: 'Calidad y plazo.',
                  nivel: 'MEDIO',
                  texto:
                    'Los datos tienen que ser ciertos, adecuados, pertinentes y no excesivos para la finalidad con que se obtuvieron, no pueden usarse para finalidades distintas o incompatibles y deben destruirse cuando dejan de ser necesarios para esa finalidad (art. 4). Es la base de los principios Solo lo necesario y Cada dato tiene un plazo.',
                },
                {
                  lead: 'Consentimiento.',
                  nivel: 'ALTO',
                  texto:
                    'El tratamiento es ilícito sin consentimiento libre, expreso e informado, por escrito o por un medio equiparable, y si se presta junto con otras declaraciones tiene que figurar en forma expresa y destacada (art. 5.1). No hace falta cuando los datos derivan de una relación contractual y son necesarios para su desarrollo o cumplimiento, ni cuando se recaban por una obligación legal (art. 5.2). Por eso los clientes no consienten el uso de sus datos para prestarles el servicio, pero los interesados sí, y el registro de la llamada se apoya en el aviso con respuesta afirmativa. El consentimiento es revocable y la revocación no tiene efecto retroactivo (art. 5 del Decreto 1558/2001).',
                },
                {
                  lead: 'Deber de informar.',
                  nivel: 'ALTO',
                  texto:
                    'Antes de recolectar se informa la finalidad y los destinatarios, la existencia de la base y la identidad y el domicilio del responsable, si las respuestas son obligatorias o facultativas, las consecuencias de darlas, negarlas o darlas inexactas, y los derechos de acceso, rectificación y supresión (art. 6). La Disposición DNPDP 10/2008 exige además, en formularios y sitios, la leyenda sobre el acceso gratuito cada seis meses y la competencia del órgano de control, hoy la AAIP.',
                },
                {
                  lead: 'Datos sensibles.',
                  nivel: 'ALTO',
                  texto:
                    'Nadie puede ser obligado a proporcionarlos, solo pueden tratarse por razones de interés general autorizadas por ley o con fines estadísticos o científicos sin identificar a sus titulares, y está prohibido formar bases que los revelen (art. 7). La práctica admite su tratamiento con consentimiento expreso, pero el texto es restrictivo (ver zonas de duda). Por eso el protocolo pide solo los datos de salud indispensables, con consentimiento separado y acceso restringido.',
                },
                {
                  lead: 'Seguridad y confidencialidad.',
                  nivel: 'MEDIO',
                  texto:
                    'El responsable adopta las medidas técnicas y organizativas necesarias para evitar la adulteración, pérdida, consulta o tratamiento no autorizado de los datos (art. 9), y todos los que intervienen en el tratamiento guardan secreto, aun después de terminada su relación (art. 10). Las medidas de seguridad recomendadas por la AAIP para medios informatizados y no informatizados (Resolución AAIP 47/2018) son la referencia para los accesos por rol, el doble factor, los respaldos y la gestión de incidentes.',
                },
                {
                  lead: 'Proveedores que tratan datos por cuenta de la empresa.',
                  nivel: 'ALTO',
                  texto:
                    'Quien presta servicios de tratamiento por cuenta de otro no puede usar los datos con un fin distinto del contratado ni cederlos, y al terminar debe destruirlos, salvo autorización para conservarlos hasta dos años ante posibles nuevos encargos (art. 25). El contrato tiene que prever que el encargado actúa solo según las instrucciones del responsable y que también le alcanzan las obligaciones de seguridad (art. 25 del Decreto 1558/2001). Ese es el contenido mínimo del acuerdo de tratamiento.',
                },
                {
                  lead: 'Cesión.',
                  nivel: 'MEDIO',
                  texto:
                    'Ceder datos a otro para sus propios fines exige un interés legítimo de ambos y el consentimiento previo del titular, informado de la finalidad y de la identidad del cesionario, salvo las excepciones de la ley, como la relación contractual (art. 11). El cesionario queda sujeto a las mismas obligaciones y responde en forma solidaria con el cedente. Compartir la base con un socio, un afiliado o un programa amigo es una cesión.',
                },
                {
                  lead: 'Transferencia internacional.',
                  nivel: 'ALTO',
                  texto:
                    'Está prohibida hacia países u organismos sin protección adecuada (art. 12), salvo que el titular la consienta expresamente o que cláusulas contractuales aseguren la protección (art. 12 del Decreto 1558/2001). La Disposición DNPDP 60/2016 fijó la lista de países adecuados, entre ellos los de la Unión Europea, y aprobó modelos de cláusulas para transferir a otro responsable o a un prestador de servicios. Estados Unidos no figura en esa lista, así que para alojar datos en proveedores de ese país se usan las cláusulas modelo o el consentimiento expreso.',
                },
                {
                  lead: 'Derecho de acceso.',
                  nivel: 'ALTO',
                  texto:
                    'El titular, acreditando su identidad, puede pedir sus datos, y el responsable debe responder dentro de los 10 días corridos de haber sido intimado en forma fehaciente. Si no responde o la respuesta es insuficiente, queda abierta la acción de hábeas data (art. 14). El acceso es gratuito a intervalos no menores de seis meses, salvo interés legítimo. La información se da en forma clara, completa y sin revelar datos de terceros, por escrito, por medios electrónicos u otro medio idóneo, a opción del titular (art. 15).',
                },
                {
                  lead: 'Rectificación, actualización y supresión.',
                  nivel: 'ALTO',
                  texto:
                    'Se resuelven en un máximo de 5 días hábiles desde el reclamo, sin cargo para el titular, y si el dato se había cedido se avisa al cesionario dentro del quinto día hábil (arts. 16 y 19). Mientras se verifica un error, el dato se bloquea o se informa que está en revisión. La supresión no procede si perjudica derechos o intereses legítimos de terceros o si hay una obligación legal de conservar, y los datos se conservan por los plazos legales o contractuales (art. 16, incs. 5 y 7).',
                },
                {
                  lead: 'Publicidad.',
                  nivel: 'MEDIO',
                  texto:
                    'Pueden usarse con fines publicitarios los datos facilitados por los propios titulares u obtenidos con su consentimiento, y el titular puede pedir en cualquier momento el retiro o bloqueo de su nombre de la base (art. 27). Cada comunicación publicitaria debe indicar en forma expresa y destacada esa posibilidad y, a pedido, informar quién proveyó los datos (art. 27 del Decreto 1558/2001).',
                },
                {
                  lead: 'Registro Nacional No Llame.',
                  nivel: 'MEDIO',
                  texto:
                    'Quien contacta por teléfono para publicitar, ofrecer o vender debe respetar a los inscriptos en el Registro Nacional No Llame, que controla la AAIP (Ley 26.951). Antes de usar bases compradas, heredadas o viejas, se cruzan con el registro.',
                },
                {
                  lead: 'Información crediticia.',
                  nivel: 'BAJO',
                  texto:
                    'Si se informan deudores a una empresa de informes crediticios, solo se registran datos patrimoniales significativos de los últimos cinco años, plazo que baja a dos si la deuda se canceló (art. 26). Se decide con legales y se coordina con el protocolo de cobranza.',
                },
                {
                  lead: 'Inscripción de la base.',
                  nivel: 'MEDIO',
                  texto:
                    'Las bases privadas destinadas a dar informes, categoría en la que el decreto incluye las que exceden el uso exclusivamente personal, se inscriben en el registro que lleva la AAIP con su responsable, finalidad, datos, destinatarios, medidas de seguridad y plazo de conservación (arts. 3 y 21, art. 1 del Decreto 1558/2001). La inscripción se actualiza cuando cambian las finalidades o las herramientas.',
                },
                {
                  lead: 'Incidentes.',
                  nivel: 'MEDIO',
                  texto:
                    'La Ley 25.326 no prevé un deber general de notificar incidentes a la autoridad ni a los afectados. El deber de seguridad (art. 9), las medidas recomendadas por la AAIP y el deber de prevenir el daño (art. 1710 CCyC) llevan igual a gestionarlos, registrarlos y avisar a los afectados cuando pueden protegerse.',
                },
                {
                  lead: 'Convenio 108 modernizado.',
                  nivel: 'BAJO',
                  texto:
                    'Argentina aprobó el Convenio 108 del Consejo de Europa (Ley 27.483) y el Protocolo que lo moderniza (Ley 27.699), que suma, entre otras reglas, la notificación de violaciones de seguridad graves a la autoridad de control. La entrada en vigor del Protocolo depende de un número mínimo de ratificaciones de los Estados parte, por eso se verifica su estado antes de invocarlo.',
                },
                {
                  lead: 'Control y hábeas data.',
                  nivel: 'MEDIO',
                  texto:
                    'La AAIP es la autoridad de control y puede aplicar apercibimiento, suspensión, multa, clausura o cancelación de la base (art. 31). El titular tiene además la acción de hábeas data (art. 43 de la Constitución Nacional y arts. 33 y siguientes de la ley).',
                },
                {
                  lead: 'Proyecto de nueva ley.',
                  nivel: 'BAJO',
                  texto:
                    'A la fecha de revisión no hay una ley sancionada que reemplace a la Ley 25.326. El proyecto de reforma integral que el Poder Ejecutivo envió al Congreso en 2023, inspirado en el RGPD, no llegó a sancionarse. Antes de cada actualización se verifica el estado parlamentario, porque una ley nueva obligaría a revisar este protocolo completo.',
                },
              ],
            },
            {
              id: 'es',
              titulo: 'España',
              bajada: 'RGPD, LOPDGDD y Ley 34/2002 de servicios de la sociedad de la información (LSSI).',
              items: [
                {
                  lead: 'Empresas de fuera de la Unión.',
                  nivel: 'ALTO',
                  texto:
                    'El RGPD se aplica a quien, sin estar establecido en la Unión, ofrece bienes o servicios a personas que se encuentran en ella (art. 3.2). En ese caso tiene que designar por escrito un representante en la Unión, salvo que el tratamiento sea ocasional, no incluya a gran escala categorías especiales y sea improbable que entrañe un riesgo (art. 27). Una LLC o una sociedad argentina que vende programas a residentes en España queda en principio alcanzada.',
                },
                {
                  lead: 'Principios y bases.',
                  nivel: 'MEDIO',
                  texto:
                    'Licitud, lealtad y transparencia, limitación de la finalidad, minimización, exactitud, limitación del plazo de conservación, integridad y confidencialidad, y responsabilidad proactiva, que obliga a poder demostrar el cumplimiento (art. 5). Cada tratamiento necesita una base del art. 6.1. Este protocolo usa el consentimiento (letra a), la ejecución del contrato o las medidas precontractuales pedidas por el interesado (letra b), la obligación legal (letra c) y el interés legítimo (letra f).',
                },
                {
                  lead: 'Categorías especiales.',
                  nivel: 'ALTO',
                  texto:
                    'Los datos de salud solo se tratan dentro de las excepciones del art. 9.2, y en un programa privado la habitual es el consentimiento explícito para fines determinados (art. 9.2.a). Si se tratan a gran escala puede ser obligatoria una evaluación de impacto (art. 35) y la designación de un delegado (art. 37).',
                },
                {
                  lead: 'Plazos y forma de responder.',
                  nivel: 'ALTO',
                  texto:
                    'La información se da en forma concisa, transparente, inteligible y de fácil acceso (art. 12.1). Los pedidos se responden sin dilación indebida y a más tardar en un mes, prorrogable dos meses más por complejidad o número de solicitudes, informando la prórroga y sus motivos dentro del primer mes (art. 12.3). Si no se atiende el pedido, se informa en ese mes el motivo y la posibilidad de reclamar ante la AEPD y de acudir a la justicia (art. 12.4). Es gratuito, salvo pedidos manifiestamente infundados o excesivos (art. 12.5), y ante dudas razonables sobre la identidad se puede pedir información adicional (art. 12.6). Los medios para ejercer los derechos tienen que ser accesibles y el pedido no puede rechazarse porque llegó por otro medio (art. 12.2 LOPDGDD).',
                },
                {
                  lead: 'Información por capas.',
                  nivel: 'MEDIO',
                  texto:
                    'Al recoger los datos se informa lo previsto en el art. 13 RGPD, y en el art. 14 si no se obtuvieron del titular. La LOPDGDD admite una primera capa con la identidad del responsable, la finalidad y la posibilidad de ejercer los derechos, más un enlace a la información completa (art. 11). Si los datos no vienen del titular, la primera capa suma las categorías de datos y su fuente.',
                },
                {
                  lead: 'Derechos.',
                  nivel: 'ALTO',
                  texto:
                    'Acceso con copia (art. 15), rectificación (art. 16), supresión (art. 17), limitación (art. 18), portabilidad (art. 20), oposición (art. 21) y no ser objeto de decisiones basadas solo en tratamientos automatizados con efectos significativos (art. 22). La rectificación, la supresión y la limitación se comunican a cada destinatario (art. 19). La oposición a la mercadotecnia directa obliga a dejar de tratar los datos para ese fin (art. 21.3). La supresión cede, entre otros casos, ante una obligación legal o la defensa de reclamaciones (art. 17.3). El acceso más de una vez en seis meses puede considerarse repetitivo (art. 13.3 LOPDGDD) y la prueba de haber respondido recae sobre el responsable (art. 12.4 LOPDGDD).',
                },
                {
                  lead: 'Bloqueo.',
                  nivel: 'MEDIO',
                  texto:
                    'Al rectificar o suprimir, los datos se bloquean y solo quedan a disposición de jueces y tribunales, del Ministerio Fiscal y de las administraciones competentes para exigir posibles responsabilidades, durante su plazo de prescripción, y después se destruyen (art. 32 LOPDGDD).',
                },
                {
                  lead: 'Encargados del tratamiento.',
                  nivel: 'ALTO',
                  texto:
                    'Cada proveedor que trata datos por cuenta de la empresa necesita un contrato con el contenido del art. 28.3 RGPD, entre otros instrucciones documentadas, confidencialidad de su personal, medidas de seguridad, régimen de subencargados, ayuda con los derechos y las brechas, y devolución o supresión de los datos al terminar. Los grandes proveedores suelen incorporarlo a sus términos como anexo de tratamiento.',
                },
                {
                  lead: 'Registro de actividades.',
                  nivel: 'MEDIO',
                  texto:
                    'Responsables y encargados llevan un registro de actividades de tratamiento (art. 30). La excepción para organizaciones de menos de 250 personas no rige si el tratamiento puede entrañar un riesgo, no es ocasional o incluye categorías especiales (art. 30.5), así que un negocio que trata interesados y clientes en forma habitual lo necesita. El mapa de datos de este protocolo es su base.',
                },
                {
                  lead: 'Seguridad y brechas.',
                  nivel: 'ALTO',
                  texto:
                    'Las medidas se ajustan al riesgo (art. 32). Una brecha se notifica a la AEPD sin dilación indebida y a más tardar dentro de las 72 horas desde que se tuvo constancia, salvo que sea improbable que constituya un riesgo para las personas, y si se notifica después se explican los motivos (art. 33.1). El encargado avisa al responsable sin dilación (art. 33.2). Si el riesgo es alto, se comunica a los afectados sin dilación, salvo cifrado u otras excepciones (art. 34). Toda brecha se documenta, también las que no se notifican (art. 33.5).',
                },
                {
                  lead: 'Delegado de protección de datos.',
                  nivel: 'MEDIO',
                  texto:
                    'Es obligatorio si la actividad principal consiste en una observación habitual y sistemática a gran escala o en tratar a gran escala categorías especiales (art. 37 RGPD), y en las entidades que enumera el art. 34.1 LOPDGDD, entre ellas las de publicidad y prospección comercial que traten datos según las preferencias de los afectados o elaboren perfiles. La designación se comunica a la AEPD en diez días (art. 34.3 LOPDGDD). Si hay delegado, el titular puede dirigirse a él antes de reclamar ante la AEPD y recibir respuesta en dos meses (art. 37 LOPDGDD).',
                },
                {
                  lead: 'Confidencialidad.',
                  nivel: 'MEDIO',
                  texto:
                    'Responsables, encargados y todas las personas que intervienen en cualquier fase del tratamiento están sujetos al deber de confidencialidad, que se mantiene después de terminada su relación (art. 5 LOPDGDD y art. 5.1.f RGPD).',
                },
                {
                  lead: 'Transferencias internacionales.',
                  nivel: 'ALTO',
                  texto:
                    'Fuera del Espacio Económico Europeo solo con una decisión de adecuación (art. 45), con garantías adecuadas como las cláusulas contractuales tipo de la Decisión de Ejecución (UE) 2021/914 o normas corporativas vinculantes (arts. 46 y 47) o, en forma excepcional, con las del art. 49. Argentina cuenta con decisión de adecuación desde 2003 (Decisión 2003/490/CE), confirmada por la Comisión en su revisión de enero de 2024, lo que facilita trabajar con equipos argentinos sobre datos de residentes en España.',
                },
                {
                  lead: 'Marco de Privacidad de Datos UE y EE.UU.',
                  nivel: 'ALTO',
                  texto:
                    'Las empresas estadounidenses adheridas al Marco pueden recibir datos sin otras garantías (Decisión de Ejecución (UE) 2023/1795). El Tribunal General desestimó el recurso de anulación del caso Latombe (asunto T-553/23, sentencia del 3 de septiembre de 2025) y el demandante recurrió en casación ante el Tribunal de Justicia. Mientras no haya sentencia, el Marco sigue vigente. Conviene que los proveedores de Estados Unidos ofrezcan además cláusulas contractuales tipo, para no depender solo del Marco.',
                },
                {
                  lead: 'Comunicaciones comerciales.',
                  nivel: 'ALTO',
                  texto:
                    'Por correo electrónico hace falta solicitud o autorización expresa previa, salvo relación contractual previa y productos o servicios similares de la propia empresa, ofreciendo siempre una baja sencilla y gratuita al recoger los datos y en cada envío (art. 21 LSSI). El consentimiento se puede revocar en cualquier momento (art. 22.1 LSSI). Las llamadas comerciales no deseadas requieren consentimiento previo u otra base del art. 6.1 RGPD (art. 66.1.b de la Ley 11/2022 General de Telecomunicaciones), y antes de una campaña se consultan los sistemas de exclusión publicitaria, como la Lista Robinson, salvo que el destinatario haya consentido recibirla (art. 23 LOPDGDD).',
                },
                {
                  lead: 'Registro de llamadas.',
                  nivel: 'MEDIO',
                  texto:
                    'Al iniciar la llamada se informa el registro, su finalidad y dónde consultar el resto de la información (art. 13 RGPD y art. 11 LOPDGDD). Si la base es el consentimiento, tiene que ser libre, y no lo es si negarse impide ser atendido (art. 7.4 RGPD). Seguir sin registrar con confirmación por escrito, como prevé el protocolo de llamadas, respeta esa regla. Los criterios de la AEPD se revisan antes de cambiar el guion (ver zonas de duda).',
                },
                {
                  lead: 'Información crediticia.',
                  nivel: 'BAJO',
                  texto:
                    'Informar deudas a sistemas de información crediticia exige, entre otros requisitos, deuda cierta, vencida y exigible, aviso previo al deudor en el contrato o al requerir el pago, y un máximo de cinco años desde el vencimiento (art. 20 LOPDGDD). Se decide con legales.',
                },
                {
                  lead: 'Equipo.',
                  nivel: 'BAJO',
                  texto:
                    'Con trabajadores en España rige el derecho a la desconexión digital, con una política interna previa audiencia de sus representantes (art. 88 LOPDGDD). Su alcance frente a colaboradores autónomos y el resto de los derechos digitales en el trabajo se revisan con el abogado laboral.',
                },
              ],
            },
            {
              id: 'ajustes',
              titulo: 'Ajustes sugeridos',
              bajada: 'Lo que conviene revisar en la política, los contratos y las herramientas para que el protocolo tenga respaldo.',
              items: [
                {
                  lead: 'Política de privacidad.',
                  nivel: 'ALTO',
                  texto:
                    'Publicarla y alinearla con el mapa de datos, con responsable y domicilio, finalidades, bases, destinatarios, transferencias, plazos por categoría, registro de llamadas y canal para ejercer derechos. Para residentes en España, con la información de los arts. 13 y 14 RGPD y, si corresponde, los datos del representante en la Unión y del delegado.',
                },
                {
                  lead: 'Formularios.',
                  nivel: 'ALTO',
                  texto: 'Aviso corto visible antes del botón, campos mínimos y casilla separada y desmarcada para comunicaciones. En Argentina, con la leyenda de la Disposición DNPDP 10/2008.',
                },
                {
                  lead: 'Acuerdos de tratamiento.',
                  nivel: 'ALTO',
                  texto: 'Guardar el acuerdo de cada proveedor del mapa, con fecha y versión, y verificar país de alojamiento, subencargados y garantía de transferencia.',
                },
                {
                  lead: 'Contratos del equipo.',
                  nivel: 'MEDIO',
                  texto:
                    'Sumar el compromiso de confidencialidad, el uso exclusivo de herramientas autorizadas, la prohibición de copiar datos a cuentas personales y la devolución o eliminación al terminar. En los contratos de closers y setters, remitir a este protocolo y al de llamadas.',
                },
                {
                  lead: 'Contratos con clientes.',
                  nivel: 'MEDIO',
                  texto:
                    'Una cláusula de datos personales que remita a la política, informe el registro de las sesiones del programa si existe y, si hay datos de salud, recoja el consentimiento expreso y separado.',
                },
                {
                  lead: 'Representante en la Unión.',
                  nivel: 'MEDIO',
                  texto: 'Si la empresa no está establecida en la Unión y vende a residentes en España, evaluar la designación del representante del art. 27 RGPD.',
                },
                {
                  lead: 'Registro de actividades y evaluación de impacto.',
                  nivel: 'MEDIO',
                  texto:
                    'En España, convertir el mapa de datos en registro de actividades (art. 30 RGPD) y, si hay datos sensibles a gran escala, evaluar si hace falta una evaluación de impacto (art. 35 RGPD).',
                },
                {
                  lead: 'Inscripción ante la AAIP.',
                  nivel: 'MEDIO',
                  texto: 'En Argentina, inscribir la base y actualizar la inscripción cuando cambian finalidades, herramientas o transferencias.',
                },
              ],
            },
            {
              id: 'dudas',
              titulo: 'Zonas de duda',
              bajada: 'Puntos de interpretación no pacífica. Se deciden caso por caso con legales.',
              items: [
                {
                  lead: 'Datos sensibles con consentimiento en Argentina.',
                  texto:
                    'El art. 7 de la Ley 25.326 solo menciona razones de interés general autorizadas por ley y fines estadísticos o científicos. La práctica y buena parte de la doctrina admiten el consentimiento expreso como base, pero el texto no lo dice y no hay una regla pacífica.',
                },
                {
                  lead: 'Alcance de la inscripción.',
                  texto:
                    'La ley obliga a inscribir las bases destinadas a dar informes y el decreto incluye las que exceden el uso exclusivamente personal. Se discute si esa ampliación excede la ley, aunque en la práctica se inscriben las bases comerciales.',
                },
                {
                  lead: 'Ley argentina y empresas del exterior.',
                  texto:
                    'La Ley 25.326 no define con precisión su ámbito territorial. Si una LLC u otra sociedad extranjera trata datos de personas en Argentina con equipo o herramientas en el país, su aplicación es probable, pero se analiza caso por caso.',
                },
                {
                  lead: 'Mensajería y Registro No Llame.',
                  texto: 'No está resuelto de forma pacífica si los mensajes por WhatsApp u otras aplicaciones quedan alcanzados por la Ley 26.951 como contactos telefónicos.',
                },
                {
                  lead: 'Base del registro de llamadas en España.',
                  texto:
                    'Puede apoyarse en el consentimiento o en el interés legítimo de conservar la prueba de la contratación. El consentimiento es más seguro en llamadas de venta, pero obliga a ofrecer seguir sin registrar. La AEPD resuelve estos casos uno por uno, así que conviene revisar sus resoluciones más recientes antes de cambiar el guion.',
                },
                {
                  lead: 'Plazos de conservación.',
                  texto:
                    'Ninguna norma fija un plazo exacto para interesados o llamadas. Se equilibran la minimización y la prescripción de las acciones, en general cinco años para las acciones personales en Argentina (art. 2560 CCyC) y en España (art. 1964.2 del Código Civil). La documentación contable sigue sus propias reglas, diez años en Argentina para quienes llevan contabilidad (art. 328 CCyC) y seis en España (art. 30 del Código de Comercio), y su alcance lo define el contador.',
                },
                {
                  lead: 'Notificación de incidentes en Argentina.',
                  texto:
                    'Sin un deber legal general, cuándo comunicar a la AAIP y a los afectados es una decisión de criterio. La entrada en vigor del Convenio 108 modernizado o una ley nueva pueden cambiarlo.',
                },
                {
                  lead: 'Futuro del Marco de Privacidad de Datos.',
                  texto:
                    'Mientras siga pendiente la casación del caso Latombe, un fallo adverso del Tribunal de Justicia dejaría sin base las transferencias apoyadas solo en el Marco, como pasó en 2020 con el Escudo de la Privacidad en el caso Schrems II.',
                },
                {
                  lead: 'Reformas europeas en trámite.',
                  texto:
                    'La Comisión Europea propuso en 2025 simplificaciones del RGPD que tocan, entre otros puntos, el registro de actividades y la notificación de brechas. Mientras no se aprueben y publiquen, rigen las reglas actuales.',
                },
                {
                  lead: 'Verificación de identidad.',
                  texto:
                    'Cuánta información se puede pedir para verificar la identidad sin violar la minimización no tiene una regla fija. El criterio del protocolo es pedir lo mínimo y nunca una copia de documento como primer paso.',
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
              lista: ['Solo lo necesario.', 'Avisar antes de registrar.', 'Cada dato tiene un plazo.', 'Acceso mínimo y temporal.', 'Un incidente se informa en el día.'],
            },
            {
              rotulo: 'Si llega un pedido de un titular',
              numerada: true,
              lista: ['Registrá fecha y canal, venga por donde venga.', 'Derivalo a {contacto} en el día.', 'Verificá la identidad sin pedir de más.', 'Respondé desde {canalDerechos} dentro de {plazosPedidos}.'],
            },
            {
              rotulo: 'Si pasa un incidente',
              numerada: true,
              lista: ['Avisá a {contacto} en el día, aunque falte información.', 'Contené sin borrar evidencia.', 'Legales evalúa el riesgo y decide la notificación.', bolsilloBrecha],
            },
            {
              rotulo: 'Tres nunca',
              tono: 'nunca',
              lista: ['Nunca registres una llamada sin avisar.', 'Nunca copies datos a cuentas o dispositivos personales.', 'Nunca confirmes una supresión sin revisar todas las herramientas.'],
            },
            [
              { rotulo: 'Si dudás', texto: 'Preguntá antes de cargar, compartir o borrar un dato.' },
              { rotulo: 'Siempre', texto: 'Cada pedido y cada incidente, al registro el mismo día.' },
            ],
          ],
        },
      ],
    },
  ];
}

import { es, lista, texto, type Modelo, type Opcion, type Respuestas } from './formulario';

/**
 * Formulario del contrato de setter (appointment setting). Los valores por
 * defecto son los del modelo de 15 cláusulas y dos anexos que usa FIRMA.
 * Lo que más cambia de un negocio a otro es cómo se le paga, así que los
 * honorarios se arman por componentes.
 */

const sino = (si: string) => (r: Respuestas) => es(r, si, 'si');
const op = (...pares: [string, string][]): Opcion[] => pares.map(([valor, t]) => ({ valor, texto: t }));
const cobra = (componente: string) => (r: Respuestas) => lista(r, 'pagos').includes(componente);

export const SETTER: Modelo = {
  clave: 'setter',
  persona: 'setter',
  titulo: 'Contrato de setter',
  bajada: 'Contanos cómo trabaja el setter y cómo le pagan, y redactamos el contrato. Lo que ya viene marcado es lo habitual: cambiá solo lo que en tu caso sea distinto.',
  descripcion: 'Respondé cómo trabaja el setter: qué agenda, cuándo una agenda cuenta, cómo se le paga, objetivos y plazo. Con eso FIRMA redacta el contrato y lo seguís en Asuntos.',
  claveTitulo: 'setter_nombre',
  claveNotas: 'extra',
  seccionesHonorarios: ['honorarios'],
  // El mismo texto arma la migración 0062 cuando el cliente completa el nombre después de enviar.
  tituloAsunto: (r) => `Contrato de setter · ${texto(r, 'setter_nombre').trim() || 'datos del setter pendientes'}`,
  secciones: [
    {
      clave: 'setter',
      titulo: 'El setter',
      bajada: 'Si todavía no sabés quién va a ser, dejá todo vacío. Lo completás después desde el asunto, cuando se sume.',
      // Las claves empiezan con setter_: así las reconoce la migración 0062.
      porContrato: true,
      preguntas: [
        { clave: 'setter_nombre', tipo: 'texto', etiqueta: 'Nombre completo' },
        { clave: 'setter_documento', tipo: 'texto', etiqueta: 'Tipo y número de documento', ejemplo: 'DNI 30.031.806' },
        { clave: 'setter_cuit', tipo: 'texto', etiqueta: 'CUIT, CUIL o número fiscal', ayuda: 'Si vive fuera de la Argentina, el número fiscal de su país, si lo tiene.' },
        {
          clave: 'setter_pais',
          tipo: 'opcion',
          etiqueta: 'País donde vive',
          opciones: op(['AR', 'Argentina'], ['ES', 'España'], ['US', 'Estados Unidos'], ['MX', 'México'], ['CO', 'Colombia'], ['VE', 'Venezuela'], ['UY', 'Uruguay']),
          otra: true,
          alerta: (r) =>
            es(r, 'setter_pais', 'AR') || es(r, 'setter_pais', 'ES')
              ? 'En este país los jueces revisan con más rigor si la relación es en realidad un empleo. Ajustamos el contrato y te marcamos qué prácticas cuidar.'
              : null,
        },
        { clave: 'setter_domicilio', tipo: 'texto', etiqueta: 'Domicilio' },
        { clave: 'setter_mail', tipo: 'texto', etiqueta: 'Mail', ayuda: 'Es el que vale para las notificaciones del contrato.' },
        {
          clave: 'setter_fiscal',
          tipo: 'opcion',
          etiqueta: '¿Cómo factura?',
          opciones: op(['empresa', 'Con una sociedad propia'], ['persona', 'Como persona, con alta fiscal'], ['sin_alta', 'No tiene alta fiscal'], ['no_se', 'No sé']),
        },
      ],
    },
    {
      clave: 'puesto',
      titulo: 'El puesto',
      bajada: 'Qué hace el setter y con qué reglas. Esto define el objeto del contrato y lo que va al anexo operativo.',
      preguntas: [
        { clave: 'producto', tipo: 'largo', etiqueta: '¿Qué vende la empresa?', ayuda: 'Producto o servicio, a quién y el precio aproximado.', ejemplo: 'Consultoría para ordenar el área comercial de pymes, USD 5.000', obligatoria: true },
        {
          clave: 'tareas',
          tipo: 'varias',
          etiqueta: '¿Qué tareas hace?',
          opciones: op(
            ['outbound', 'Contacta prospectos en frío'],
            ['inbound', 'Responde a los leads que llegan'],
            ['califica', 'Califica y agenda reuniones'],
            ['seguimiento', 'Sigue al prospecto hasta que asiste'],
            ['crm', 'Carga en el CRM'],
          ),
          otra: true,
          porDefecto: ['outbound', 'califica', 'seguimiento', 'crm'],
        },
        {
          clave: 'canales',
          tipo: 'varias',
          etiqueta: '¿Por dónde contacta?',
          opciones: op(['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['mail', 'Mail'], ['llamadas', 'Llamadas']),
          otra: true,
        },
        { clave: 'herramientas', tipo: 'texto', etiqueta: 'CRM y herramienta de agenda que le dan', ejemplo: 'GoHighLevel y Calendly' },
        {
          clave: 'calificacion',
          tipo: 'largo',
          etiqueta: '¿Cuándo una agenda cuenta como calificada?',
          ayuda: 'Es lo que define qué se le paga. Duplicados, prospectos de otra persona del equipo y reprogramaciones no cuentan.',
          ejemplo: 'Es dueño o gerente, tiene un equipo comercial de 5 o más personas, factura más de USD 500.000 por año y acepta una videollamada de 45 minutos',
          obligatoria: true,
        },
        { clave: 'objecion_agenda', tipo: 'texto', etiqueta: '¿Cuánto tiempo tiene la empresa para objetar una agenda?', porDefecto: '5 días hábiles desde que queda registrada' },
        {
          clave: 'horarios_sn',
          tipo: 'sino',
          etiqueta: '¿Tiene algún horario obligatorio?',
          porDefecto: 'si',
          alerta: (r) => (es(r, 'horarios_sn', 'si') ? 'Cada horario fijo es un indicio de empleo. Dejá solo los que hacen falta para coordinar, como una reunión de equipo.' : null),
        },
        { clave: 'horarios', tipo: 'largo', etiqueta: '¿Cuáles?', porDefecto: 'Las reuniones de coordinación que convoque la empresa, avisando una ausencia con 12 horas de anticipación', si: sino('horarios_sn') },
        {
          clave: 'exclusividad',
          tipo: 'opcion',
          etiqueta: '¿Puede trabajar para otras empresas?',
          opciones: op(['libre', 'Sí'], ['competencia', 'Sí, salvo para la competencia'], ['exclusivo', 'No, trabaja solo para nosotros']),
          porDefecto: 'competencia',
          alerta: (r) => (es(r, 'exclusividad', 'exclusivo') ? 'Prohibirle todo otro trabajo es uno de los indicios de empleo que más pesan. Limitarlo a la competencia suele alcanzar.' : null),
        },
        { clave: 'crm_plazo', tipo: 'texto', etiqueta: '¿Hasta cuándo tiene que cargar el CRM?', porDefecto: 'Todos los días, antes de las 22 h de Argentina' },
        { clave: 'prueba', tipo: 'opcion', etiqueta: 'Período de prueba', ayuda: 'En ese plazo cualquiera lo termina sin preaviso.', opciones: op(['no', 'Sin período de prueba'], ['15', '15 días'], ['30', '30 días']), otra: true, porDefecto: '30' },
        { clave: 'capacitacion', tipo: 'texto', etiqueta: 'Capacitación inicial', porDefecto: '10 días, con material grabado, sesiones en vivo y una evaluación final' },
        {
          clave: 'prohibido',
          tipo: 'varias',
          etiqueta: 'Con los prospectos no puede',
          opciones: op(
            ['resultados', 'Prometer resultados'],
            ['precios', 'Dar precios o descuentos sin autorización'],
            ['representante', 'Presentarse como empleado, socio o representante'],
            ['no_calificados', 'Agendar a quien sabe que no califica'],
          ),
          otra: true,
          porDefecto: ['resultados', 'precios', 'representante', 'no_calificados'],
        },
        {
          clave: 'manual',
          tipo: 'opcion',
          etiqueta: '¿Tienen guiones o playbook?',
          ayuda: 'Va como anexo. Así el contrato no cambia cada vez que cambia el proceso.',
          opciones: op(['adjunto', 'Sí, lo subo al asunto'], ['despues', 'Sí, lo mando más adelante'], ['no', 'No tenemos']),
        },
      ],
    },
    {
      clave: 'honorarios',
      titulo: 'Honorarios',
      bajada: 'Cómo se le paga. Marcá todo lo que cobra y completá los montos.',
      preguntas: [
        {
          clave: 'pagos',
          tipo: 'varias',
          etiqueta: '¿Qué cobra?',
          opciones: op(
            ['fijo', 'Un fijo mensual'],
            ['fijo_objetivo', 'Un fijo más alto el mes que llega a un objetivo de agendas'],
            ['por_agenda', 'Un monto por cada agenda calificada'],
            ['por_show', 'Un monto por cada reunión a la que el prospecto asiste'],
            ['comision', 'Comisión sobre las ventas que origina'],
            ['bono_show', 'Bono por tasa de asistencia (show up)'],
          ),
          otra: true,
          porDefecto: ['fijo', 'fijo_objetivo', 'comision', 'bono_show'],
          obligatoria: true,
        },
        {
          clave: 'fijo_monto',
          tipo: 'texto',
          etiqueta: 'Fijo mensual',
          ayuda: 'Si empieza o termina a mitad de mes, se paga en proporción.',
          porDefecto: 'USD 300 por mes',
          si: cobra('fijo'),
          alerta: (r) => (cobra('fijo')(r) && es(r, 'horarios_sn', 'si') && es(r, 'exclusividad', 'exclusivo') ? 'Fijo, horarios y exclusividad juntos suman indicios de empleo. Conviene aflojar alguno.' : null),
        },
        { clave: 'fijo_objetivo', tipo: 'texto', etiqueta: 'Fijo con objetivo: cuánto y con cuántas agendas', porDefecto: 'USD 500 en lugar del fijo mensual, con 30 o más agendas calificadas en el mes', si: cobra('fijo_objetivo') },
        { clave: 'por_agenda', tipo: 'texto', etiqueta: 'Monto por agenda calificada', ejemplo: 'USD 15 por agenda', si: cobra('por_agenda') },
        { clave: 'por_show', tipo: 'texto', etiqueta: 'Monto por reunión con asistencia', ejemplo: 'USD 30 por reunión', si: cobra('por_show') },
        { clave: 'comision', tipo: 'texto', etiqueta: 'Porcentaje de comisión', ejemplo: '4 %', si: cobra('comision'), obligatoria: true },
        {
          clave: 'comision_base',
          tipo: 'opcion',
          etiqueta: '¿Sobre qué se calcula?',
          opciones: op(['cobrado', 'Lo que efectivamente se cobra, neto de impuestos, devoluciones y costos de cobro'], ['total', 'El valor total de la venta, aunque se cobre en cuotas']),
          porDefecto: 'cobrado',
          si: cobra('comision'),
        },
        {
          clave: 'comision_excluye',
          tipo: 'largo',
          etiqueta: '¿Qué cobros no generan comisión?',
          porDefecto: 'Abonos mensuales o recurrentes, licencias de software, renovaciones, ventas adicionales a un mismo cliente y gastos reintegrables',
          si: cobra('comision'),
        },
        { clave: 'venta_plazo', tipo: 'texto', etiqueta: '¿Hasta cuándo una venta cuenta como suya?', ayuda: 'Desde la reunión que agendó.', porDefecto: '90 días desde la reunión', si: cobra('comision') },
        {
          clave: 'cuotas',
          tipo: 'opcion',
          etiqueta: 'Ventas en cuotas',
          opciones: op(['por_cuota', 'Cobra comisión sobre cada cuota, el mes en que se cobra'], ['al_cierre', 'Cobra toda la comisión con la primera cuota'], ['no_aplica', 'No vendemos en cuotas']),
          porDefecto: 'por_cuota',
          si: cobra('comision'),
        },
        {
          clave: 'bono_show',
          tipo: 'texto',
          etiqueta: 'Bono por show up: monto y condiciones',
          ejemplo: 'USD 200 si la tasa de show up supera el 70 %, con un mínimo de 15 agendas calificadas en el mes',
          si: cobra('bono_show'),
          obligatoria: true,
        },
        { clave: 'pagos_otros', tipo: 'largo', etiqueta: '¿Algún otro pago o bono?', ayuda: 'Opcional.' },
        {
          clave: 'pagos_cambio',
          tipo: 'opcion',
          etiqueta: '¿La empresa puede cambiar montos y porcentajes?',
          opciones: op(['acuerdo', 'No, solo de común acuerdo'], ['aviso_30', 'Sí, con 30 días de aviso, para los meses siguientes, y el setter puede irse sin preaviso'], ['libre', 'Sí, cuando quiera']),
          porDefecto: 'aviso_30',
          alerta: (r) => (es(r, 'pagos_cambio', 'libre') ? 'Cambiar la retribución sin aviso es una cláusula que un juez puede dejar sin efecto. Te sugerimos el aviso de 30 días.' : null),
        },
      ],
    },
    {
      clave: 'objetivos',
      titulo: 'Objetivos',
      bajada: 'Las métricas mínimas van al anexo operativo. Acá nos interesa qué se mide y qué pasa si no se llega.',
      preguntas: [
        {
          clave: 'kpis_minimos',
          tipo: 'tabla',
          etiqueta: 'Mínimos',
          columnas: [
            { clave: 'metrica', titulo: 'Métrica', ejemplo: 'Agendas calificadas' },
            { clave: 'minimo', titulo: 'Mínimo', ejemplo: '20' },
            { clave: 'periodo', titulo: 'Período', ejemplo: 'Mensual' },
          ],
          porDefecto: [
            { metrica: 'Agendas calificadas', minimo: '20', periodo: 'Mensual' },
            { metrica: 'Tasa de show up', minimo: '60 %', periodo: 'Mensual' },
            { metrica: 'Carga del CRM', minimo: 'Todos los días hábiles', periodo: 'Diario' },
            { metrica: 'Asistencia a reuniones de coordinación', minimo: '90 %', periodo: 'Mensual' },
          ],
        },
        {
          clave: 'kpis_consecuencia',
          tipo: 'opcion',
          etiqueta: 'Si no llega a los mínimos',
          opciones: op(
            ['orientativo', 'Nada, son orientativos'],
            ['plan', 'Plan de mejora con plazo'],
            ['rescision_2', 'Puede terminarse si no llega dos meses seguidos'],
            ['rescision', 'Puede terminarse el contrato'],
            ['descuento', 'Se le descuenta de lo que cobra'],
          ),
          porDefecto: 'rescision_2',
          alerta: (r) =>
            es(r, 'kpis_consecuencia', 'descuento')
              ? 'Descontarle por no llegar a un objetivo es una sanción, y las sanciones son de un empleo. Lo reemplazamos por un plan de mejora o por la rescisión.'
              : null,
        },
        { clave: 'kpis_revision', tipo: 'texto', etiqueta: '¿Cada cuánto se revisan?', porDefecto: 'Una vez por mes' },
      ],
    },
    {
      clave: 'reembolsos',
      titulo: 'Devoluciones',
      bajada: 'Qué pasa con lo que cobró cuando la empresa le devuelve el dinero a un cliente.',
      preguntas: [
        {
          clave: 'reembolso',
          tipo: 'opcion',
          etiqueta: 'Si se devuelve una venta que originó',
          opciones: op(
            ['descuenta', 'Se le descuenta la comisión de lo devuelto, de las liquidaciones siguientes'],
            ['plazo', 'Se le descuenta solo si la devolución llega dentro de un plazo'],
            ['mantiene', 'Conserva lo que cobró'],
          ),
          porDefecto: 'descuenta',
        },
        { clave: 'reembolso_plazo', tipo: 'texto', etiqueta: '¿Qué plazo?', ejemplo: '60 días desde la venta', si: (r) => es(r, 'reembolso', 'plazo') },
      ],
    },
    {
      clave: 'pago',
      titulo: 'Liquidación y pago',
      bajada: 'Cuándo y cómo se le paga.',
      preguntas: [
        { clave: 'periodicidad', tipo: 'opcion', etiqueta: '¿Cada cuánto se liquida?', opciones: op(['mensual', 'Por mes'], ['quincenal', 'Por quincena'], ['semanal', 'Por semana']), porDefecto: 'mensual', obligatoria: true },
        { clave: 'fecha_pago', tipo: 'texto', etiqueta: '¿Cuándo se paga?', porDefecto: 'Del 1 al 10 del mes siguiente' },
        { clave: 'moneda', tipo: 'opcion', etiqueta: 'Moneda', opciones: op(['USD', 'Dólares estadounidenses'], ['local', 'Moneda del país del setter']), otra: true, porDefecto: 'USD' },
        {
          clave: 'medios',
          tipo: 'varias',
          etiqueta: 'Medios de pago',
          opciones: op(['swift', 'Transferencia en dólares'], ['cripto', 'USDT o USDC'], ['mep', 'Pesos al dólar MEP del día anterior'], ['local', 'Transferencia local']),
          otra: true,
          porDefecto: ['swift', 'cripto', 'mep'],
        },
        { clave: 'costos', tipo: 'opcion', etiqueta: '¿Quién paga los costos del medio de pago?', opciones: op(['setter', 'El setter'], ['empresa', 'La empresa'], ['mitad', 'Mitad cada uno']), porDefecto: 'setter' },
        { clave: 'datos_pago', tipo: 'texto', etiqueta: '¿Hasta cuándo informa sus datos de pago?', ayuda: 'Mientras no los informe, el pago se corre.', porDefecto: '3 días desde el cierre del mes' },
        { clave: 'factura', tipo: 'opcion', etiqueta: '¿Tiene que mandar algo por cada pago?', opciones: op(['factura', 'Factura o comprobante equivalente, dentro de los 10 días'], ['recibo', 'Recibo'], ['nada', 'Nada']), porDefecto: 'factura' },
        { clave: 'objecion', tipo: 'texto', etiqueta: '¿Cuánto tiempo tiene para objetar una liquidación?', porDefecto: '10 días desde que la recibe' },
      ],
    },
    {
      clave: 'plazo',
      titulo: 'Plazo y salida',
      bajada: 'Cuánto dura, cómo se termina y qué cobra después.',
      preguntas: [
        { clave: 'duracion', tipo: 'opcion', etiqueta: 'Duración', opciones: op(['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses'], ['indefinida', 'Sin plazo']), otra: true, porDefecto: '6', obligatoria: true },
        {
          clave: 'renovacion',
          tipo: 'opcion',
          etiqueta: 'Al vencer',
          opciones: op(['mensual', 'Si siguen trabajando, se prorroga mes a mes'], ['automatica', 'Se renueva sola por el mismo plazo, salvo aviso'], ['acuerdo', 'Termina, salvo que firmen una renovación']),
          porDefecto: 'mensual',
          si: (r) => !es(r, 'duracion', 'indefinida'),
        },
        { clave: 'preaviso', tipo: 'texto', etiqueta: 'Preaviso para terminarlo sin causa', ayuda: 'Vale para las dos partes.', porDefecto: '15 días' },
        {
          clave: 'intimacion',
          tipo: 'texto',
          etiqueta: 'Plazo para corregir un incumplimiento',
          porDefecto: '5 días hábiles. Con dos intimaciones en 3 meses se puede terminar sin dar un nuevo plazo',
        },
        {
          clave: 'causales',
          tipo: 'varias',
          etiqueta: '¿Qué permite terminarlo en el acto?',
          opciones: op(
            ['datos', 'Alterar u ocultar datos del CRM o de sus métricas'],
            ['confidencialidad', 'Filtrar información, captar clientes o competir'],
            ['promesas', 'Prometer resultados o dar información falsa'],
            ['trato', 'Maltrato a prospectos, clientes o al equipo'],
            ['metricas', 'No llegar a los mínimos dos meses seguidos'],
          ),
          otra: true,
          porDefecto: ['datos', 'confidencialidad', 'promesas', 'trato', 'metricas'],
        },
        { clave: 'cola', tipo: 'texto', etiqueta: 'Después de la salida, ¿hasta cuándo cobra comisión por lo que se siga cobrando?', porDefecto: '60 días', si: cobra('comision') },
        { clave: 'traspaso', tipo: 'texto', etiqueta: 'Plazo para entregar conversaciones, prospectos y accesos', porDefecto: '5 días hábiles' },
      ],
    },
    {
      clave: 'proteccion',
      titulo: 'Protección del negocio',
      bajada: 'Información, clientes y equipo.',
      preguntas: [
        { clave: 'confidencialidad', tipo: 'opcion', etiqueta: 'Confidencialidad después de terminar', opciones: op(['2', '2 años'], ['3', '3 años'], ['5', '5 años'], ['sin_limite', 'Sin límite']), porDefecto: '5' },
        {
          clave: 'no_clientes',
          tipo: 'opcion',
          etiqueta: '¿Le prohibimos contactar a prospectos y clientes de la empresa después de irse?',
          opciones: op(['no', 'No'], ['6', 'Sí, por 6 meses'], ['12', 'Sí, por 12 meses']),
          porDefecto: '12',
        },
        { clave: 'no_equipo', tipo: 'opcion', etiqueta: '¿Y llevarse a gente del equipo?', opciones: op(['no', 'No'], ['6', 'Sí, por 6 meses'], ['12', 'Sí, por 12 meses']), porDefecto: '12' },
        {
          clave: 'no_competencia',
          tipo: 'sino',
          etiqueta: '¿No puede trabajar para la competencia después de irse?',
          porDefecto: 'si',
          alerta: (r) =>
            es(r, 'no_competencia', 'si')
              ? 'Sin un pago a cambio, la no competencia posterior puede anularse, sobre todo en Argentina y España. Cuanto más corta y más acotada a competidores directos, mejor se sostiene.'
              : null,
        },
        {
          clave: 'competencia',
          tipo: 'largo',
          etiqueta: '¿Por cuánto tiempo y quién es competencia?',
          ayuda: 'Cuanto más concreto, mejor. Fuera de ese rubro queda libre.',
          ejemplo: '6 meses. Quienes ofrecen a empresas consultoría o capacitación en gestión comercial',
          si: (r) => es(r, 'no_competencia', 'si') || es(r, 'exclusividad', 'competencia'),
        },
        { clave: 'penalidad', tipo: 'opcion', etiqueta: 'Multa por violar la confidencialidad, la no captación o el uso de las herramientas', opciones: op(['3000', 'USD 3.000 por cada hecho'], ['5000', 'USD 5.000 por cada hecho'], ['sin', 'Sin multa, solo daños']), otra: true, porDefecto: '3000' },
      ],
    },
    {
      clave: 'cierre',
      titulo: 'Cierre',
      bajada: 'Lo último. Después de enviar vas a poder subir los guiones y cualquier otro archivo al asunto.',
      preguntas: [
        {
          clave: 'jurisdiccion',
          tipo: 'opcion',
          etiqueta: 'Si hay un conflicto, ¿dónde se resuelve?',
          opciones: op(['caba', 'Tribunales de la Ciudad de Buenos Aires'], ['empresa', 'Donde está constituida la empresa'], ['arbitraje', 'Arbitraje'], ['firma', 'Que lo defina FIRMA']),
          porDefecto: 'firma',
        },
        { clave: 'plataforma', tipo: 'opcion', etiqueta: '¿Con qué se firma?', opciones: op(['firma', 'Firma electrónica del portal'], ['docusign', 'DocuSign'], ['zapsign', 'ZapSign']), otra: true, porDefecto: 'firma' },
        { clave: 'extra', tipo: 'largo', etiqueta: '¿Algo más que tengamos que saber?', ayuda: 'Acuerdos de palabra, conflictos anteriores con setters, lo que no entró en las preguntas.' },
      ],
    },
  ],
};

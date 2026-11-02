import { es, texto, type Modelo, type Opcion, type Respuestas } from './formulario';

/**
 * Formulario del contrato de closer. Los valores por defecto son los del
 * modelo de 12 cláusulas que usa FIRMA, así el cliente cambia solo lo que
 * en su caso es distinto.
 */

const sino = (si: string) => (r: Respuestas) => es(r, si, 'si');
const op = (...pares: [string, string][]): Opcion[] => pares.map(([valor, t]) => ({ valor, texto: t }));

/** Un bono configurado habilita la pregunta de si la empresa puede cambiarlos. */
const hayBonos = (r: Respuestas) => es(r, 'bono_pif_sn', 'si') || es(r, 'bono_hitos_sn', 'si') || es(r, 'bono_referidos_sn', 'si') || texto(r, 'bono_otros').trim() !== '';
const seDescuenta = (r: Respuestas) => !!texto(r, 'reembolso_despues') && !es(r, 'reembolso_despues', 'mantiene');

export const CLOSER: Modelo = {
  clave: 'closer',
  titulo: 'Contrato de closer',
  bajada: 'Contanos cómo trabajan con el closer y redactamos el contrato. Lo que ya viene marcado es lo habitual: cambiá solo lo que en tu caso sea distinto.',
  claveTitulo: 'closer_nombre',
  // El mismo texto arma la migración 0035 cuando el cliente completa el nombre después de enviar.
  tituloAsunto: (r) => `Contrato de closer · ${texto(r, 'closer_nombre').trim() || 'datos del closer pendientes'}`,
  secciones: [
    {
      clave: 'closer',
      titulo: 'El closer',
      bajada: 'Si todavía no sabés quién va a ser, dejá todo vacío. Lo completás después desde el asunto, cuando se sume.',
      // Las claves empiezan con closer_: así las reconoce la migración 0035.
      porContrato: true,
      preguntas: [
        { clave: 'closer_nombre', tipo: 'texto', etiqueta: 'Nombre completo' },
        { clave: 'closer_documento', tipo: 'texto', etiqueta: 'Tipo y número de documento', ejemplo: 'Cédula de identidad 30.031.806' },
        {
          clave: 'closer_pais',
          tipo: 'opcion',
          etiqueta: 'País donde vive',
          opciones: op(['AR', 'Argentina'], ['ES', 'España'], ['US', 'Estados Unidos'], ['MX', 'México'], ['CO', 'Colombia'], ['VE', 'Venezuela'], ['UY', 'Uruguay']),
          otra: true,
          alerta: (r) =>
            es(r, 'closer_pais', 'AR') || es(r, 'closer_pais', 'ES')
              ? 'En este país los jueces revisan con más rigor si la relación es en realidad un empleo. Ajustamos el contrato y te marcamos qué prácticas cuidar.'
              : null,
        },
        { clave: 'closer_domicilio', tipo: 'texto', etiqueta: 'Domicilio' },
        { clave: 'closer_mail', tipo: 'texto', etiqueta: 'Mail' },
        {
          clave: 'closer_fiscal',
          tipo: 'opcion',
          etiqueta: '¿Cómo factura?',
          opciones: op(['empresa', 'Con una sociedad propia'], ['persona', 'Como persona, con alta fiscal'], ['sin_alta', 'No tiene alta fiscal'], ['no_se', 'No sé']),
        },
      ],
    },
    {
      clave: 'puesto',
      titulo: 'El puesto',
      bajada: 'Qué hace el closer y con qué reglas. Esto define el objeto del contrato y lo que va al anexo operativo.',
      preguntas: [
        { clave: 'producto', tipo: 'largo', etiqueta: '¿Qué vende?', ayuda: 'Producto o servicio, a quién y el precio aproximado.', ejemplo: 'Mentoría de 3 meses para inmobiliarias, USD 3.000', obligatoria: true },
        {
          clave: 'tareas',
          tipo: 'varias',
          etiqueta: '¿Qué tareas hace?',
          opciones: op(['cierre', 'Llamadas de cierre'], ['seguimiento_previo', 'Seguimiento antes de la llamada'], ['seguimiento_posterior', 'Seguimiento después de la llamada'], ['setting', 'Agenda sus propias llamadas'], ['crm', 'Carga en el CRM']),
          otra: true,
          porDefecto: ['cierre', 'seguimiento_previo', 'seguimiento_posterior', 'crm'],
        },
        {
          clave: 'leads',
          tipo: 'opcion',
          etiqueta: '¿De dónde salen los leads?',
          opciones: op(['empresa', 'Los asigna la empresa'], ['closer', 'Los consigue el closer'], ['ambos', 'Las dos cosas']),
          porDefecto: 'empresa',
        },
        {
          clave: 'horarios_sn',
          tipo: 'sino',
          etiqueta: '¿Tiene algún horario obligatorio?',
          ayuda: 'Además de las llamadas que tiene agendadas.',
          porDefecto: 'si',
          alerta: (r) => (es(r, 'horarios_sn', 'si') ? 'Cada horario fijo es un indicio de empleo. Dejá solo los que hacen falta para coordinar, como una reunión de equipo.' : null),
        },
        { clave: 'horarios', tipo: 'largo', etiqueta: '¿Cuáles?', ejemplo: 'Reunión diaria a las 13 h de Argentina', porDefecto: 'Reunión diaria de coordinación a las 13 h de Argentina', si: sino('horarios_sn') },
        {
          clave: 'exclusividad',
          tipo: 'opcion',
          etiqueta: '¿Puede trabajar para otras empresas?',
          opciones: op(['libre', 'Sí'], ['competencia', 'Sí, salvo para la competencia'], ['exclusivo', 'No, trabaja solo para nosotros']),
          porDefecto: 'competencia',
          alerta: (r) => (es(r, 'exclusividad', 'exclusivo') ? 'Prohibirle todo otro trabajo es uno de los indicios de empleo que más pesan. Limitarlo a la competencia suele alcanzar.' : null),
        },
        { clave: 'herramientas', tipo: 'texto', etiqueta: 'CRM y herramientas que le dan', ejemplo: 'GoHighLevel, Fathom y Slack' },
        { clave: 'graba_sn', tipo: 'sino', etiqueta: '¿Graba todas las llamadas?', porDefecto: 'si' },
        { clave: 'crm_plazo', tipo: 'texto', etiqueta: '¿Hasta cuándo tiene que cargar el CRM?', porDefecto: 'El mismo día, antes de las 22 h de Argentina' },
        { clave: 'capacitacion', tipo: 'texto', etiqueta: 'Capacitación inicial', porDefecto: '10 días, con material grabado, sesiones en vivo y una evaluación final' },
        {
          clave: 'manual',
          tipo: 'opcion',
          etiqueta: '¿Tienen manual, guiones o playbook?',
          ayuda: 'Va como anexo. Así el contrato no cambia cada vez que cambia el proceso.',
          opciones: op(['adjunto', 'Sí, lo subo al asunto'], ['despues', 'Sí, lo mando más adelante'], ['no', 'No tenemos']),
        },
      ],
    },
    {
      clave: 'honorarios',
      titulo: 'Honorarios',
      bajada: 'Cuánto cobra el closer y sobre qué.',
      preguntas: [
        {
          clave: 'fijo_sn',
          tipo: 'sino',
          etiqueta: '¿Cobra un fijo mensual además de la comisión?',
          porDefecto: 'no',
          alerta: (r) => (es(r, 'fijo_sn', 'si') ? 'Un fijo no impide el encuadre independiente, pero junto con horarios y exclusividad suma indicios de empleo.' : null),
        },
        { clave: 'fijo_monto', tipo: 'texto', etiqueta: 'Monto del fijo', ejemplo: 'USD 500 por mes', si: sino('fijo_sn') },
        {
          clave: 'comision_base',
          tipo: 'opcion',
          etiqueta: '¿Sobre qué se calcula la comisión?',
          opciones: op(['cobrado', 'Lo que efectivamente se cobra (cash collected)'], ['neto', 'Lo cobrado, menos las comisiones del procesador de pagos'], ['total', 'El valor total de la venta, aunque se cobre en cuotas']),
          porDefecto: 'cobrado',
          obligatoria: true,
        },
        { clave: 'segmentos_sn', tipo: 'sino', etiqueta: '¿El porcentaje cambia según el tipo de cliente o de producto?', porDefecto: 'no' },
        { clave: 'comision', tipo: 'texto', etiqueta: 'Porcentaje de comisión', ejemplo: '10 %', si: (r) => !es(r, 'segmentos_sn', 'si'), obligatoria: true },
        {
          clave: 'comision_tabla',
          tipo: 'tabla',
          etiqueta: 'Porcentaje por tipo',
          columnas: [
            { clave: 'tipo', titulo: 'Tipo de cliente o producto', ejemplo: 'Inmobiliaria con equipo' },
            { clave: 'criterio', titulo: 'Cómo se reconoce', ejemplo: 'Tiene 2 o más asesores' },
            { clave: 'porcentaje', titulo: 'Comisión', ejemplo: '12 %' },
          ],
          si: sino('segmentos_sn'),
          obligatoria: true,
        },
        {
          clave: 'cuotas',
          tipo: 'opcion',
          etiqueta: 'Ventas en cuotas',
          opciones: op(['por_cuota', 'Cobra comisión sobre cada cuota, a medida que se paga'], ['al_cierre', 'Cobra toda la comisión con la primera cuota'], ['no_aplica', 'No vendemos en cuotas']),
          porDefecto: 'por_cuota',
        },
        { clave: 'senas', tipo: 'opcion', etiqueta: '¿Las señas o depósitos generan comisión?', opciones: op(['si', 'Sí'], ['no', 'No, recién cuando se paga el resto'], ['no_aplica', 'No tomamos señas']) },
        {
          clave: 'compartidas',
          tipo: 'texto',
          etiqueta: 'Si dos closers participan en una venta, ¿cómo se reparte?',
          ejemplo: 'Todo para quien cierra / mitad cada uno / no pasa',
          porDefecto: 'Toda la comisión es de quien hace la llamada de cierre',
        },
      ],
    },
    {
      clave: 'bonos',
      titulo: 'Bonos',
      bajada: 'Lo que se paga además de la comisión. Si no hay bonos, dejá todo en No.',
      preguntas: [
        { clave: 'bono_pif_sn', tipo: 'sino', etiqueta: '¿Hay bono por venta pagada en un solo pago (PIF)?', porDefecto: 'no' },
        { clave: 'bono_pif', tipo: 'texto', etiqueta: 'Monto y condiciones', ejemplo: 'USD 100 por venta PIF a inmobiliarias con equipo', si: sino('bono_pif_sn') },
        { clave: 'bono_hitos_sn', tipo: 'sino', etiqueta: '¿Hay bonos por facturación del mes?', porDefecto: 'no' },
        {
          clave: 'bono_hitos',
          tipo: 'tabla',
          etiqueta: 'Escala',
          columnas: [
            { clave: 'desde', titulo: 'Cobrado en el mes, desde', ejemplo: 'USD 10.000' },
            { clave: 'bono', titulo: 'Bono', ejemplo: 'USD 200' },
          ],
          si: sino('bono_hitos_sn'),
        },
        {
          clave: 'bono_hitos_suma',
          tipo: 'opcion',
          etiqueta: 'Si alcanza varios escalones',
          opciones: op(['mayor', 'Cobra solo el más alto'], ['suma', 'Se suman']),
          porDefecto: 'mayor',
          si: sino('bono_hitos_sn'),
        },
        { clave: 'bono_referidos_sn', tipo: 'sino', etiqueta: '¿Hay bono por referidos?', porDefecto: 'no' },
        {
          clave: 'bono_referidos',
          tipo: 'largo',
          etiqueta: '¿Cuánto es y cómo se prueba que el referido lo trajo él?',
          ejemplo: '5 puntos más de comisión. Se prueba con el registro en el CRM y la confirmación del cliente.',
          si: sino('bono_referidos_sn'),
        },
        { clave: 'bono_otros', tipo: 'largo', etiqueta: '¿Algún otro bono?', ayuda: 'Por show rate, trimestral, de equipo. Opcional.' },
        {
          clave: 'bonos_cambio',
          tipo: 'opcion',
          etiqueta: '¿La empresa puede cambiar los bonos?',
          opciones: op(['acuerdo', 'No, solo de común acuerdo'], ['aviso_30', 'Sí, con 30 días de aviso y sin tocar lo ya ganado'], ['libre', 'Sí, cuando quiera']),
          porDefecto: 'aviso_30',
          si: hayBonos,
          alerta: (r) => (es(r, 'bonos_cambio', 'libre') ? 'Cambiar la retribución sin aviso es una cláusula que un juez puede dejar sin efecto. Te sugerimos el aviso de 30 días.' : null),
        },
      ],
    },
    {
      clave: 'objetivos',
      titulo: 'Objetivos',
      bajada: 'Las métricas con números van al anexo. Acá nos interesa qué se mide y qué pasa si no se llega.',
      preguntas: [
        {
          clave: 'kpis',
          tipo: 'varias',
          etiqueta: '¿Qué se mide?',
          opciones: op(['show', 'Show rate'], ['cierre', 'Tasa de cierre'], ['cash', 'Cash collected'], ['llamadas', 'Cantidad de llamadas'], ['crm', 'CRM al día']),
          otra: true,
        },
        {
          clave: 'kpis_minimos',
          tipo: 'tabla',
          etiqueta: 'Mínimos, si los hay',
          columnas: [
            { clave: 'metrica', titulo: 'Métrica', ejemplo: 'Tasa de cierre' },
            { clave: 'minimo', titulo: 'Mínimo', ejemplo: '20 %' },
            { clave: 'periodo', titulo: 'Período', ejemplo: 'Mensual' },
          ],
        },
        {
          clave: 'kpis_consecuencia',
          tipo: 'opcion',
          etiqueta: 'Si no llega a los mínimos',
          opciones: op(['orientativo', 'Nada, son orientativos'], ['plan', 'Plan de mejora con plazo'], ['rescision', 'Puede terminarse el contrato'], ['descuento', 'Se le descuenta de la comisión']),
          porDefecto: 'plan',
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
      titulo: 'Reembolsos',
      bajada: 'Qué pasa con la comisión cuando el cliente pide que le devuelvan el dinero o desconoce el pago.',
      preguntas: [
        {
          clave: 'confirmacion',
          tipo: 'texto',
          etiqueta: '¿Cuánto tiempo sin reembolso hace falta para confirmar la venta?',
          ayuda: 'Si el cliente pide el reembolso dentro de ese plazo, la venta no genera comisión.',
          porDefecto: '72 horas desde que se acredita el pago',
        },
        {
          clave: 'reembolso_despues',
          tipo: 'opcion',
          etiqueta: 'Si el reembolso llega después de ese plazo',
          opciones: op(
            ['mantiene', 'El closer conserva la comisión'],
            ['siempre', 'Se le descuenta siempre'],
            ['culpa', 'Se le descuenta solo si fue por algo que hizo el closer'],
            ['proporcional', 'Se le descuenta en proporción a lo devuelto'],
          ),
          obligatoria: true,
        },
        {
          clave: 'reembolso_culpa',
          tipo: 'largo',
          etiqueta: '¿Cuándo es por algo que hizo el closer?',
          ayuda: 'Hoy el modelo lo deja a criterio de la empresa, sin revisión. Conviene fijar casos concretos.',
          ejemplo: 'Prometió algo que no está en la oferta, o no grabó la llamada de cierre',
          si: (r) => es(r, 'reembolso_despues', 'culpa'),
        },
        { clave: 'recupero_limite', tipo: 'opcion', etiqueta: '¿Hasta cuándo se puede descontar?', opciones: op(['30', '30 días desde la venta'], ['60', '60 días'], ['90', '90 días'], ['sin_limite', 'Sin límite']), porDefecto: '90', si: seDescuenta },
        {
          clave: 'recupero_forma',
          tipo: 'opcion',
          etiqueta: '¿Cómo se descuenta?',
          opciones: op(['liquidacion', 'De la próxima liquidación'], ['devuelve', 'El closer lo devuelve'], ['ambas', 'De la liquidación y, si no alcanza, lo devuelve']),
          porDefecto: 'ambas',
          si: seDescuenta,
        },
        { clave: 'contracargos', tipo: 'opcion', etiqueta: 'Contracargos', opciones: op(['igual', 'Igual que un reembolso'], ['distinto', 'Distinto']), porDefecto: 'igual' },
        { clave: 'contracargos_detalle', tipo: 'largo', etiqueta: '¿Cómo se tratan?', si: (r) => es(r, 'contracargos', 'distinto') },
      ],
    },
    {
      clave: 'pago',
      titulo: 'Liquidación y pago',
      bajada: 'Cuándo y cómo se le paga.',
      preguntas: [
        { clave: 'periodicidad', tipo: 'opcion', etiqueta: '¿Cada cuánto se liquida?', opciones: op(['mensual', 'Por mes'], ['quincenal', 'Por quincena'], ['semanal', 'Por semana']), porDefecto: 'mensual', obligatoria: true },
        { clave: 'fecha_pago', tipo: 'texto', etiqueta: '¿Cuándo se paga?', porDefecto: 'Del 1 al 10 del mes siguiente' },
        { clave: 'moneda', tipo: 'opcion', etiqueta: 'Moneda', opciones: op(['USD', 'Dólares estadounidenses'], ['local', 'Moneda del país del closer']), otra: true, porDefecto: 'USD' },
        {
          clave: 'medios',
          tipo: 'varias',
          etiqueta: 'Medios de pago',
          opciones: op(['swift', 'Transferencia internacional'], ['wise', 'Wise o Payoneer'], ['cripto', 'USDT o USDC'], ['paypal', 'PayPal'], ['local', 'Transferencia local']),
          otra: true,
          porDefecto: ['swift', 'cripto'],
        },
        { clave: 'costos', tipo: 'opcion', etiqueta: '¿Quién paga las comisiones bancarias o de red?', opciones: op(['closer', 'El closer'], ['empresa', 'La empresa'], ['mitad', 'Mitad cada uno']), porDefecto: 'closer' },
        { clave: 'factura', tipo: 'opcion', etiqueta: '¿Tiene que mandar algo para cobrar?', opciones: op(['factura', 'Factura'], ['recibo', 'Recibo'], ['nada', 'Nada']) },
        { clave: 'objecion', tipo: 'texto', etiqueta: '¿Cuánto tiempo tiene para objetar una liquidación?', porDefecto: '15 días desde que la recibe' },
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
          opciones: op(['automatica', 'Se renueva sola por el mismo plazo, salvo aviso'], ['acuerdo', 'Termina, salvo que firmen una renovación']),
          porDefecto: 'automatica',
          si: (r) => !es(r, 'duracion', 'indefinida'),
        },
        { clave: 'preaviso', tipo: 'texto', etiqueta: 'Preaviso para terminarlo sin causa', ayuda: 'Vale para las dos partes.', porDefecto: '15 días' },
        {
          clave: 'causales',
          tipo: 'varias',
          etiqueta: '¿Qué permite terminarlo en el acto?',
          opciones: op(['datos', 'Falsear datos, ventas o métricas'], ['confidencialidad', 'Filtrar información o clientes'], ['trato', 'Maltrato a clientes o al equipo'], ['grabacion', 'No grabar las llamadas'], ['captacion', 'Desviar clientes a otro negocio']),
          otra: true,
          porDefecto: ['datos', 'confidencialidad', 'trato', 'captacion'],
        },
        { clave: 'cola', tipo: 'texto', etiqueta: 'Después de la salida, ¿hasta cuándo cobra comisión por sus ventas?', ayuda: 'Por ejemplo, las cuotas que se siguen pagando.', porDefecto: '60 días' },
        {
          clave: 'bono_salida',
          tipo: 'opcion',
          etiqueta: 'Bono del mes en que se va',
          opciones: op(['no', 'No lo cobra'], ['si_llega', 'Lo cobra si llegó al escalón'], ['proporcional', 'Cobra la parte proporcional']),
          porDefecto: 'no',
          si: (r) => es(r, 'bono_hitos_sn', 'si'),
        },
        { clave: 'traspaso', tipo: 'texto', etiqueta: 'Plazo para entregar los leads en curso y los accesos', porDefecto: '7 días hábiles' },
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
          etiqueta: '¿Le prohibimos contactar a clientes y leads de la empresa después de irse?',
          opciones: op(['no', 'No'], ['6', 'Sí, por 6 meses'], ['12', 'Sí, por 12 meses']),
          porDefecto: '12',
        },
        { clave: 'no_equipo', tipo: 'opcion', etiqueta: '¿Y llevarse a gente del equipo?', opciones: op(['no', 'No'], ['6', 'Sí, por 6 meses'], ['12', 'Sí, por 12 meses']), porDefecto: '12' },
        {
          clave: 'no_competencia',
          tipo: 'sino',
          etiqueta: '¿No puede trabajar para la competencia después de irse?',
          porDefecto: 'no',
          alerta: (r) =>
            es(r, 'no_competencia', 'si')
              ? 'Sin un pago a cambio, la no competencia posterior suele anularse, y en Argentina y España casi siempre. La prohibición de contactar clientes protege lo mismo con menos riesgo.'
              : null,
        },
        { clave: 'no_competencia_detalle', tipo: 'largo', etiqueta: '¿Por cuánto tiempo y qué se considera competencia?', si: sino('no_competencia') },
        { clave: 'penalidad', tipo: 'opcion', etiqueta: 'Multa por violar la confidencialidad', opciones: op(['5000', 'USD 5.000 por cada violación'], ['sin', 'Sin multa, solo daños']), otra: true, porDefecto: '5000' },
      ],
    },
    {
      clave: 'cierre',
      titulo: 'Cierre',
      bajada: 'Lo último. Después de enviar vas a poder subir el manual y cualquier otro archivo al asunto.',
      preguntas: [
        {
          clave: 'jurisdiccion',
          tipo: 'opcion',
          etiqueta: 'Si hay un conflicto, ¿dónde se resuelve?',
          opciones: op(['caba', 'Tribunales de la Ciudad de Buenos Aires'], ['empresa', 'Donde está constituida la empresa'], ['arbitraje', 'Arbitraje'], ['firma', 'Que lo defina FIRMA']),
          porDefecto: 'firma',
        },
        { clave: 'plataforma', tipo: 'opcion', etiqueta: '¿Con qué se firma?', opciones: op(['firma', 'Firma electrónica del portal'], ['docusign', 'DocuSign'], ['zapsign', 'ZapSign']), otra: true, porDefecto: 'firma' },
        { clave: 'extra', tipo: 'largo', etiqueta: '¿Algo más que tengamos que saber?', ayuda: 'Acuerdos de palabra, conflictos anteriores con closers, lo que no entró en las preguntas.' },
      ],
    },
  ],
};

export const MODELOS = { closer: CLOSER } as const;


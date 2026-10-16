// Contenido del protocolo de reclutamiento y selección.
// Regla de estilo de FIRMA para estos textos, sin rayas ni dos puntos.

import { soloDigitos, txt } from '../motor/ficha';
import type { Ficha, Nivel, SalidaCalculo, Seccion } from '../motor/tipos';

// Utilidades de cálculo

function tasa(parte: number | null, total: number | null): number | null {
  if (parte === null || total === null || total === 0) return null;
  return (parte / total) * 100;
}

// Secciones

export function secciones(f: Ficha): Seccion[] {
  const objetivo = soloDigitos(txt(f, 'diasObjetivo'));

  const cobertura: SalidaCalculo = {
    id: 'cobertura',
    rotulo: 'Tiempo de cobertura',
    formato: 'dias',
    calcular: (v) => v.dias,
    ayuda: objetivo !== null ? 'Comparado con el objetivo de la ficha.' : 'Cargá en la ficha los días objetivo de cobertura para ver la meta.',
    ...(objetivo !== null ? { meta: { valor: objetivo, sentido: 'max' as const } } : {}),
  };

  return [
    {
      id: 'uso',
      titulo: 'Cómo usar este protocolo',
      corto: 'Cómo usarlo',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Este protocolo ordena cómo {empresa} busca, evalúa y contrata personas, desde el perfil del puesto hasta la oferta firmada y el cierre con quienes no quedaron. Los datos de la búsqueda se completan una vez en la ficha y se actualizan solos en el aviso, las plantillas y las herramientas.',
        },
        {
          tipo: 'parrafo',
          texto:
            'El objetivo es triple. Contratar mejor porque se decide con evidencia, evitar reclamos por discriminación o por un encuadre mal hecho, y cuidar los datos de cada candidato como lo que son, datos prestados para una búsqueda concreta.',
        },
        { tipo: 'leyenda' },
        {
          tipo: 'roles',
          items: [
            { rol: 'Dirección o quien contrata', foco: '{decisor}. Define el perfil por resultados, aprueba el rango y decide con la rúbrica a la vista.' },
            { rol: 'Quien recluta', foco: '{reclutador}. Publica el aviso, filtra, coordina las etapas, responde a cada candidato y mantiene {herramienta} al día.' },
            { rol: 'Entrevistadores', foco: 'Hacen las mismas preguntas, puntúan solos con la rúbrica y anotan evidencia, no impresiones.' },
            { rol: 'Administración y legales', foco: 'Revisan modalidad, oferta y alta, responden los pedidos sobre datos y reciben las alertas.' },
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            'La materia laboral cambia según el país y el caso. Ante una duda de encuadre, de período de prueba o de contratación en otro país, el protocolo deriva al análisis con el abogado, y con el contador si hay temas impositivos.',
        },
      ],
    },
    {
      id: 'ficha',
      titulo: 'Ficha de la búsqueda',
      corto: 'Ficha de la búsqueda',
      intro: 'Se completa una vez por búsqueda. Los avisos de la ficha marcan incoherencias antes de publicar.',
      bloques: [{ tipo: 'ficha' }],
    },
    {
      id: 'principios',
      titulo: 'Cinco principios',
      corto: 'Principios',
      intro: 'Valen en cada etapa de la búsqueda. Si el equipo recuerda solo esto, ya evita los errores más caros.',
      bloques: [
        {
          tipo: 'reglas',
          items: [
            {
              titulo: 'Se contrata por resultados, no por intuición.',
              texto:
                'El puesto se define por lo que tiene que lograr en los primeros 90 días y cada etapa busca evidencia de eso. La química de una charla no es un criterio. Lo que no se puede explicar con evidencia no entra en la decisión.',
            },
            {
              titulo: 'Mismas preguntas, misma vara.',
              texto:
                'Todas las personas de una búsqueda responden las mismas preguntas y se puntúan con la misma rúbrica. Es más justo, compara mejor y deja prueba de que la decisión fue objetiva si alguien la cuestiona.',
            },
            {
              titulo: 'Nada de trabajo gratis.',
              texto:
                'La prueba práctica mide una habilidad, no resuelve un pendiente del negocio. Es breve, tiene consigna escrita y, si dura más de dos horas o su resultado se va a usar, se paga.',
            },
            {
              titulo: 'Todo por escrito, incluida la oferta.',
              texto:
                'El rango, la modalidad, la variable y el período de prueba se informan por escrito. Lo que se dice en una entrevista y no figura en la oferta termina en una discusión que nadie puede probar.',
            },
            {
              titulo: 'Los datos del candidato son prestados.',
              texto:
                'Se piden solo los datos que sirven para el puesto, se usan solo para esta búsqueda y se eliminan al cerrarla, salvo que la persona autorice conservarlos por {meses}.',
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Cómo se ve en la práctica' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Por resultados',
              texto: 'El perfil no pide años de experiencia. Dice qué tiene que haber pasado a los 90 días.',
              cita: 'A los 90 días, la persona en el puesto [[resultado medible, por ejemplo cierra un número de ventas por mes con el guion aprobado]] y [[segundo resultado]].',
            },
            {
              titulo: 'Misma vara',
              texto: 'Antes de la puesta en común, cada entrevistador carga su puntaje y su evidencia. Recién después se discute.',
              cita: 'Antes de hablar del candidato, cada uno carga su rúbrica en {herramienta}. Después comparamos y decidimos con la evidencia a la vista.',
            },
            {
              titulo: 'Nada de trabajo gratis',
              texto: 'Alguien del equipo propone que la prueba resuelva un caso real del negocio. La respuesta es una sola línea.',
              cita: 'La prueba mide una habilidad, no resuelve un pendiente. Si queremos ese trabajo, lo contratamos y lo pagamos aparte.',
            },
            {
              titulo: 'Datos prestados',
              texto: 'Al cerrar la búsqueda, quien no quedó recibe el pedido de consentimiento. Sin respuesta, su postulación se elimina.',
              cita: 'Si querés que tengamos en cuenta tu postulación para futuras búsquedas, respondé que sí y la conservamos por {meses}. Si no, la eliminamos.',
            },
          ],
        },
      ],
    },
    {
      id: 'etapas',
      titulo: 'El recorrido en ocho etapas',
      corto: 'Ocho etapas',
      intro: 'Cada etapa tiene responsable, plazo y objetivo. El paso de una a otra queda registrado en {herramienta}.',
      bloques: [
        {
          tipo: 'etapas',
          items: [
            {
              titulo: 'Perfil del puesto por resultados',
              cuando: 'Responsable {decisor} · Antes de publicar',
              datos: [
                { rotulo: 'Objetivo', texto: 'Saber qué se busca antes de buscar.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Resultados esperados a 90 días, tareas principales, requisitos imprescindibles y deseables, modalidad {modalidadTexto}, formato {formatoTexto}, rango y criterios de la rúbrica. Cada requisito se justifica por una tarea del puesto.',
                },
                { rotulo: 'Frase ancla', texto: '¿Qué tiene que haber logrado esta persona a los 90 días para que digamos que fue una buena contratación?', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Copiar el aviso de otra empresa o pedir años de experiencia y títulos que el puesto no necesita.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Aviso y difusión',
              cuando: 'Responsable {reclutador} · Antes de abrir la búsqueda',
              datos: [
                { rotulo: 'Objetivo', texto: 'Atraer a quien puede hacer el trabajo, sin excluir por motivos que no importan.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Aviso con resultados, modalidad real, formato, rango y aviso de privacidad, revisado contra la tabla de preguntas prohibidas. Difusión en más de una fuente y registro de la fuente de cada postulación.',
                },
                { rotulo: 'Frase ancla', texto: 'Buscamos una persona para {puesto} que logre [[resultado principal]]. Ofrecemos {remuneracion}.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Pedir edad, sexo, foto o buena presencia, o publicar como independiente un puesto con horario fijo y jefe.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Filtro de postulaciones',
              cuando: 'Responsable {reclutador} · Dentro de {diasRespuesta} desde cada postulación',
              datos: [
                { rotulo: 'Objetivo', texto: 'Separar a quienes cumplen los requisitos imprescindibles, con el mismo criterio para todos.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Acuse a cada postulación, filtro solo con los requisitos del perfil y registro del motivo de cada descarte. Si se usa una herramienta automática, una persona revisa los descartes.',
                },
                { rotulo: 'Frase ancla', texto: 'Revisamos todas las postulaciones con los mismos criterios y te escribimos antes del [[fecha]].', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Descartar por la universidad, el barrio, la edad que surge del currículum o la foto.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Entrevista estructurada',
              cuando: 'Responsables entrevistadores · Dentro de {diasRespuesta} desde el filtro',
              datos: [
                { rotulo: 'Objetivo', texto: 'Obtener evidencia comparable sobre cada criterio de la rúbrica.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Mismas preguntas en el mismo orden, pedido de ejemplos concretos y puntaje individual con evidencia antes de cualquier conversación entre entrevistadores. Si el rango no se informó antes, se informa acá.',
                },
                { rotulo: 'Frase ancla', texto: 'Contame una situación concreta en la que [[logro del perfil]]. ¿Qué hiciste vos y cuál fue el resultado?', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Charlar sin guion, preguntar por la vida personal o decidir en los primeros minutos.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Prueba práctica',
              cuando: 'Responsable {reclutador} · Solo con finalistas',
              datos: [
                { rotulo: 'Objetivo', texto: 'Ver la habilidad clave en acción, sin aprovechar trabajo ajeno.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Consigna escrita con alcance, tiempo estimado de {horasPrueba}, criterios de evaluación, pago si corresponde y uso del material. Se evalúa con la rúbrica, no con la sensación.',
                },
                { rotulo: 'Frase ancla', texto: 'La prueba lleva {horasPrueba} como máximo y se evalúa con estos criterios. {pagoConsigna}', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Pedir un trabajo real del negocio, sin límite de tiempo ni pago, y usarlo después.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Referencias',
              cuando: 'Responsable {reclutador} · Con autorización del finalista',
              datos: [
                { rotulo: 'Objetivo', texto: 'Confirmar evidencia, no buscar rumores.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Pedido de autorización al candidato, contacto solo con las personas que indicó y preguntas sobre desempeño y resultados. Lo que no se relaciona con el trabajo no se registra.',
                },
                { rotulo: 'Frase ancla', texto: '¿En qué resultados concretos trabajó [[nombre]] con vos y cómo los logró?', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Llamar al empleador actual sin permiso o preguntar por salud, embarazo o vida privada.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Decisión y oferta',
              cuando: 'Responsable {decisor} · Dentro de {diasRespuesta} desde la última etapa',
              datos: [
                { rotulo: 'Objetivo', texto: 'Decidir con la rúbrica y ofrecer por escrito lo mismo que se conversó.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Puesta en común con los puntajes ya cargados, decisión registrada con su fundamento, oferta escrita con modalidad, retribución, variable, fecha de inicio y período de prueba, y alta o contrato firmado antes del primer día.',
                },
                { rotulo: 'Frase ancla', texto: 'Te enviamos la oferta por escrito. Revisala con tiempo y cualquier duda la vemos antes de que respondas.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'Ofrecer por teléfono condiciones que después no figuran en el contrato, o dejar que la persona empiece sin alta.', estilo: 'error' },
              ],
            },
            {
              titulo: 'Cierre con no seleccionados y datos',
              cuando: 'Responsable {reclutador} · Dentro de {diasRespuesta} desde la decisión',
              datos: [
                { rotulo: 'Objetivo', texto: 'Cerrar con respeto y dejar los datos en orden.' },
                {
                  rotulo: 'Qué tiene que pasar',
                  texto:
                    'Respuesta a cada persona que participó, pedido de consentimiento para conservar postulaciones, eliminación del resto y archivo de rúbricas según la política de conservación. Se registra la fuente de la contratación para el tablero.',
                },
                { rotulo: 'Frase ancla', texto: 'Gracias por tu tiempo en el proceso. En esta oportunidad avanzamos con otra persona.', estilo: 'frase' },
                { rotulo: 'Error típico', texto: 'No responder nunca, explicar el descarte con rasgos personales o guardar los currículums sin plazo.', estilo: 'error' },
              ],
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'El perfil del puesto en una página' },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Qué lleva',
              check: true,
              lista: [
                'Resultados esperados a 90 días, medibles.',
                'Tres a cinco tareas principales.',
                'Requisitos imprescindibles, cada uno justificado por una tarea.',
                'Requisitos deseables, que suman pero no descartan.',
                'Modalidad {modalidadTexto} y formato {formatoTexto}.',
                'Rango y, si hay variable, su regla de cálculo por escrito.',
                'Criterios y pesos de la rúbrica.',
              ],
            },
            {
              titulo: 'Qué no lleva',
              lista: [
                'Edad, sexo, estado civil, nacionalidad o religión.',
                'Foto o buena presencia.',
                'Títulos o años de experiencia que el puesto no necesita.',
                'Residencia en una zona determinada si el puesto es remoto.',
                'Disponibilidad total si el puesto no la requiere.',
              ],
            },
          ],
        },
        { tipo: 'subtitulo', texto: 'Lo que se registra en cada etapa' },
        {
          tipo: 'tips',
          items: [
            { titulo: 'Una sola fuente', texto: 'Cada postulación vive en {herramienta}, con su estado, sus fechas y su fuente. Nada en chats sueltos.' },
            { titulo: 'Motivo de cada descarte', texto: 'Se anota con los criterios del perfil. Si el motivo no está en el perfil, no es un motivo válido.' },
            { titulo: 'Notas sin datos personales', texto: 'Las notas describen lo que la persona dijo o hizo. Nada sobre su vida privada, su aspecto o su salud.' },
            { titulo: 'Plazos visibles', texto: 'Cada etapa tiene fecha de respuesta. Nadie queda más de {diasRespuesta} sin novedades.' },
          ],
        },
      ],
    },
    {
      id: 'entrevista',
      titulo: 'Entrevista estructurada y rúbrica',
      corto: 'Rúbrica de entrevista',
      intro:
        'La entrevista estructurada compara a todos con la misma vara. Mismas preguntas, mismo orden, puntaje individual con evidencia y recién después la puesta en común.',
      bloques: [
        {
          tipo: 'tips',
          items: [
            { titulo: 'Puntaje individual', texto: 'Cada entrevistador puntúa solo y carga su evaluación antes de hablar con el resto.' },
            { titulo: 'Evidencia, no impresión', texto: 'Cada puntaje se apoya en algo que la persona dijo o hizo. Sin ejemplo concreto, el puntaje no pasa de 2.' },
            { titulo: 'Un criterio que frena', texto: 'Un 1 en Ética y cuidado del cliente frena el avance aunque el promedio dé verde.' },
            { titulo: 'Calibración', texto: 'Al cerrar cada búsqueda se compara el puntaje de ingreso con la calidad a 90 días y se ajustan preguntas y anclas.' },
          ],
        },
        { tipo: 'subtitulo', texto: 'Banco de preguntas por criterio' },
        {
          tipo: 'acordeones',
          items: [
            {
              titulo: 'Resultados comparables',
              subtitulo: 'Peso 3',
              abierto: true,
              bloques: [
                { tipo: 'decir', etiqueta: 'Pregunta base', texto: 'Contame un resultado de tu último trabajo del que estés orgulloso. ¿Cuál era el objetivo, qué hiciste vos y cómo se midió?' },
                { tipo: 'decir', etiqueta: 'Repregunta', texto: '¿Qué parte de ese resultado dependió de vos y qué parte del equipo o del contexto?' },
                { tipo: 'nota', etiqueta: 'Evidencia', texto: 'Números, plazos y aporte personal. Si solo habla en plural o en general, el puntaje no pasa de 2.' },
              ],
            },
            {
              titulo: 'Habilidad clave del puesto',
              subtitulo: 'Peso 3',
              bloques: [
                { tipo: 'decir', etiqueta: 'Pregunta base', texto: 'Mostrame cómo encararías [[situación típica del puesto]]. Pensá en voz alta.' },
                { tipo: 'decir', etiqueta: 'Repregunta', texto: 'Si [[variante más difícil de la misma situación]], ¿qué cambiarías?' },
                { tipo: 'nota', etiqueta: 'Evidencia', texto: 'Se complementa con la prueba práctica. El puntaje final de este criterio se carga después de la prueba.' },
              ],
            },
            {
              titulo: 'Comunicación y escucha',
              subtitulo: 'Peso 2',
              bloques: [
                { tipo: 'decir', etiqueta: 'Pregunta base', texto: 'Explicame [[tema del puesto]] como si yo fuera un cliente que no sabe nada del tema.' },
                { tipo: 'decir', etiqueta: 'Repregunta', texto: 'Contame una vez en la que un malentendido complicó un trabajo. ¿Qué hiciste?' },
                { tipo: 'nota', etiqueta: 'Evidencia', texto: 'Si responde lo que se preguntó, si ordena la respuesta y si chequea que se entendió.' },
              ],
            },
            {
              titulo: 'Criterio y resolución de problemas',
              subtitulo: 'Peso 2',
              bloques: [
                { tipo: 'decir', etiqueta: 'Pregunta base', texto: 'Contame un problema que no tenía una solución obvia. ¿Qué opciones evaluaste y por qué elegiste la que elegiste?' },
                { tipo: 'decir', etiqueta: 'Repregunta', texto: 'Mirando para atrás, ¿qué harías distinto?' },
                { tipo: 'nota', etiqueta: 'Evidencia', texto: 'Opciones comparadas, fundamentos y aprendizaje. Una sola salida sin evaluar es un 2.' },
              ],
            },
            {
              titulo: 'Responsabilidad y seguimiento',
              subtitulo: 'Peso 2',
              bloques: [
                { tipo: 'decir', etiqueta: 'Pregunta base', texto: 'Contame una vez en la que no llegaste a un plazo o a un objetivo. ¿Cuándo lo avisaste y qué hiciste después?' },
                { tipo: 'decir', etiqueta: 'Repregunta', texto: '¿Cómo organizás tu semana para no perder seguimientos?' },
                { tipo: 'nota', etiqueta: 'Evidencia', texto: 'También cuenta el proceso mismo. Puntualidad, respuestas en plazo y entrega de la prueba.' },
              ],
            },
            {
              titulo: 'Ética y cuidado del cliente',
              subtitulo: 'Peso 2 · Frena el avance con un 1',
              destacado: true,
              bloques: [
                { tipo: 'decir', etiqueta: 'Pregunta base', texto: 'Imaginá que para cerrar una venta tendrías que prometer algo que el servicio no incluye. ¿Qué hacés?' },
                { tipo: 'decir', etiqueta: 'Repregunta', texto: 'Contame una situación real en la que elegiste perder un resultado para hacer lo correcto.' },
                { tipo: 'nota', etiqueta: 'Evidencia', texto: 'Un 1 en este criterio frena el avance aunque el promedio dé verde.' },
              ],
            },
          ],
        },
        {
          tipo: 'rubrica',
          id: 'rubrica',
          titulo: 'Rúbrica de entrevista',
          intro:
            'Cada entrevistador la completa solo, con la evidencia anotada en {herramienta}. El resultado es un promedio ponderado de 1 a 4. Un 1 en Ética y cuidado del cliente frena el avance aunque el promedio dé verde.',
          criterios: [
            {
              id: 'resultados',
              nombre: 'Resultados comparables',
              peso: 3,
              anclas: [
                'No da ejemplos concretos o habla solo en general.',
                'Da ejemplos, pero sin resultados verificables o sin aclarar su aporte.',
                'Da ejemplos con resultados y explica qué hizo personalmente.',
                'Da ejemplos con resultados medibles, contexto y aprendizajes, comparables con los del puesto.',
              ],
            },
            {
              id: 'habilidad',
              nombre: 'Habilidad clave del puesto',
              peso: 3,
              anclas: [
                'No la muestra en la prueba ni en los ejemplos.',
                'La muestra a medias o con errores importantes.',
                'La muestra con solvencia y errores menores.',
                'La muestra con solvencia y mejora la consigna con criterio propio.',
              ],
            },
            {
              id: 'comunicacion',
              nombre: 'Comunicación y escucha',
              peso: 2,
              anclas: [
                'Responde otra cosa o no escucha las preguntas.',
                'Se entiende, pero con desorden o rodeos.',
                'Es clara, ordenada y escucha antes de responder.',
                'Es clara, adapta el mensaje a quien escucha y repregunta para entender.',
              ],
            },
            {
              id: 'criterio',
              nombre: 'Criterio y resolución de problemas',
              peso: 2,
              anclas: [
                'No identifica el problema o propone soluciones sin fundamento.',
                'Identifica el problema, pero propone una sola salida sin evaluarla.',
                'Identifica el problema, compara opciones y elige con fundamento.',
                'Anticipa riesgos, compara opciones y propone cómo medir el resultado.',
              ],
            },
            {
              id: 'responsabilidad',
              nombre: 'Responsabilidad y seguimiento',
              peso: 2,
              anclas: [
                'Atribuye los resultados a otros o no cumple lo pactado en el proceso.',
                'Cumple, pero necesita recordatorios.',
                'Cumple plazos y compromisos del proceso sin recordatorios.',
                'Cumple, avisa antes de un desvío y muestra ejemplos de seguimiento propio.',
              ],
            },
            {
              id: 'etica',
              nombre: 'Ética y cuidado del cliente',
              peso: 2,
              anclas: [
                'Justifica prometer de más o presionar al cliente. Frena el avance.',
                'Duda frente a dilemas éticos simples.',
                'Elige lo correcto aunque cueste una venta o un resultado.',
                'Elige lo correcto y explica cómo lo sostuvo en situaciones reales.',
              ],
            },
          ],
          niveles: [
            {
              desde: 3.2,
              nivel: 'verde',
              titulo: 'Avanzar',
              texto: 'Supera la vara en los criterios que más pesan. Pasa a la etapa siguiente con la evidencia cargada en {herramienta}, salvo que Ética y cuidado del cliente haya quedado en 1.',
            },
            {
              desde: 2.5,
              nivel: 'ambar',
              titulo: 'Avanzar con dudas',
              texto:
                'Hay evidencia a favor y huecos concretos. Avanza solo si las dudas se pueden despejar en la etapa siguiente con una pregunta o una prueba definida de antemano, y se registra cuáles son.',
            },
            {
              desde: 1,
              nivel: 'rojo',
              titulo: 'No avanzar',
              texto: 'La evidencia no alcanza para el puesto. Se cierra con la respuesta a no seleccionados dentro de {diasRespuesta}.',
            },
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            'Los umbrales de la rúbrica son criterios internos del protocolo, no estándares externos. Conviene revisarlos después de algunas búsquedas, comparando los puntajes de ingreso con la calidad a 90 días.',
        },
      ],
    },
    {
      id: 'embudo',
      titulo: 'Embudo de selección',
      corto: 'Embudo de selección',
      intro: 'Mide cada búsqueda de punta a punta. Muestra dónde se pierde gente, cuánto cuesta cada contratación y cuánto tardó.',
      bloques: [
        {
          tipo: 'calculadora',
          id: 'embudo',
          titulo: 'Calculadora del embudo',
          intro: 'Cargá los números de la búsqueda al cerrarla. El costo se expresa en la moneda de la ficha.',
          entradas: [
            { id: 'postulaciones', rotulo: 'Postulaciones recibidas', unidad: 'personas' },
            { id: 'preseleccionados', rotulo: 'Preseleccionados', unidad: 'personas', ayuda: 'Pasaron el filtro de requisitos.' },
            { id: 'entrevistados', rotulo: 'Entrevistados', unidad: 'personas' },
            { id: 'pruebas', rotulo: 'Hicieron la prueba práctica', unidad: 'personas', ayuda: 'Cero si no hubo prueba.' },
            { id: 'ofertas', rotulo: 'Ofertas emitidas', unidad: 'ofertas' },
            { id: 'aceptadas', rotulo: 'Ofertas aceptadas', unidad: 'ofertas' },
            { id: 'dias', rotulo: 'Días de cobertura', unidad: 'días', ayuda: 'Corridos, de la apertura a la aceptación. Con varias contrataciones, el promedio.' },
            { id: 'costo', rotulo: 'Costo total del proceso', unidad: 'moneda', ayuda: 'Avisos, herramientas, pruebas pagas y horas del equipo valorizadas.' },
          ],
          salidas: [
            { id: 'c1', rotulo: 'Preselección sobre postulaciones', formato: 'pct', calcular: (v) => tasa(v.preseleccionados, v.postulaciones) },
            { id: 'c2', rotulo: 'Entrevistas sobre preselección', formato: 'pct', calcular: (v) => tasa(v.entrevistados, v.preseleccionados) },
            { id: 'c3', rotulo: 'Pruebas sobre entrevistas', formato: 'pct', calcular: (v) => tasa(v.pruebas, v.entrevistados), ayuda: 'Sin datos si no hubo prueba.' },
            {
              id: 'c4',
              rotulo: 'Ofertas sobre la etapa anterior',
              formato: 'pct',
              ayuda: 'Sobre pruebas, o sobre entrevistas si no hubo prueba.',
              calcular: (v) => (v.pruebas ? tasa(v.ofertas, v.pruebas) : tasa(v.ofertas, v.entrevistados)),
            },
            { id: 'aceptacion', rotulo: 'Tasa de aceptación de ofertas', formato: 'pct', destacada: true, calcular: (v) => tasa(v.aceptadas, v.ofertas) },
            {
              id: 'porContratacion',
              rotulo: 'Postulaciones por contratación',
              formato: 'num',
              calcular: (v) => (v.postulaciones !== null && v.aceptadas ? v.postulaciones / v.aceptadas : null),
            },
            {
              id: 'costoContratacion',
              rotulo: 'Costo por contratación',
              formato: 'monto',
              destacada: true,
              calcular: (v) => (v.costo !== null && v.aceptadas ? v.costo / v.aceptadas : null),
            },
            cobertura,
          ],
          conclusion: (v) => {
            if (v.postulaciones === null || v.ofertas === null) return null;
            const partes: string[] = [];
            let nivel: Nivel = 'verde';
            if (!v.aceptadas) {
              nivel = 'ambar';
              partes.push('Todavía no hay ofertas aceptadas, así que no hay costo por contratación.');
            }
            const rechazadas = v.aceptadas !== null ? v.ofertas - v.aceptadas : null;
            if (rechazadas !== null && rechazadas > 0) {
              nivel = 'ambar';
              partes.push(`Se ${rechazadas === 1 ? 'rechazó 1 oferta' : `rechazaron ${rechazadas} ofertas`}. Registrá el motivo de cada rechazo antes de tocar el rango o la oferta.`);
            }
            if (objetivo !== null && v.dias !== null && v.dias > objetivo) {
              nivel = 'ambar';
              partes.push('La cobertura superó el objetivo de {diasObjetivo}. Mirá en {herramienta} qué etapa concentró la demora.');
            }
            if (objetivo === null && v.dias !== null) partes.push('Cargá en la ficha los días objetivo de cobertura para comparar el plazo.');
            if (nivel === 'verde') partes.unshift('Embudo cerrado sin ofertas rechazadas y dentro del plazo previsto.');
            partes.push('Guardá estos números para comparar la próxima búsqueda del mismo puesto.');
            return { nivel, texto: partes.join(' ') };
          },
          nota: 'Herramienta orientativa. Las conversiones se comparan con búsquedas anteriores del mismo puesto, no con promedios de otros negocios.',
        },
        {
          tipo: 'tarjetas',
          items: [
            {
              titulo: 'Cómo leer el embudo',
              lista: [
                'Si entran muchas postulaciones y pocas pasan el filtro, revisá si el aviso explica bien requisitos, modalidad y rango.',
                'Si muchos preseleccionados no llegan a la entrevista, revisá los tiempos de respuesta y la invitación.',
                'Si muchas personas abandonan en la prueba, revisá su duración, la claridad de la consigna y si se paga.',
                'Si se rechazan ofertas, preguntá el motivo a cada persona y registralo antes de cambiar el rango.',
              ],
            },
            {
              titulo: 'Antes de cargar los números',
              check: true,
              lista: [
                'Cada postulación tiene su estado actualizado en {herramienta}.',
                'Las horas del equipo están valorizadas con un mismo criterio en todas las búsquedas.',
                'Los días se cuentan desde la apertura del aviso, no desde la primera entrevista.',
                'Las ofertas rechazadas tienen su motivo registrado.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'plantillas',
      titulo: 'Plantillas para cada etapa',
      corto: 'Plantillas',
      intro:
        'Once modelos ordenados por etapa. Se completan con la ficha y se adaptan al tono de cada empresa siempre que no cambie el contenido. La oferta va con usted porque es una comunicación formal.',
      bloques: [
        {
          tipo: 'guiones',
          aria: 'Plantillas por etapa',
          items: [
            {
              id: 'aviso',
              titulo: 'Aviso de búsqueda',
              bajada: 'Para publicar en cada fuente. Lo arma {reclutador} y lo aprueba {decisor}.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Aviso modelo',
                  texto:
                    'En {empresa} buscamos una persona para el puesto de {puesto}, en {area}. Su objetivo principal será [[resultado esperado a 90 días]]. Las tareas centrales son [[tres o cuatro tareas]]. Pedimos [[requisitos imprescindibles, solo los que el puesto necesita]] y valoramos [[requisitos deseables]]. La modalidad es {modalidadOferta} y el formato es {formatoDetalle}. Ofrecemos {remuneracion}. El proceso incluye una entrevista estructurada, una prueba práctica de {horasPrueba} y referencias, y respondemos a cada persona dentro de {diasRespuesta} en cada etapa. Para postularte, ingresá en {canal}. Usamos tus datos solo para esta búsqueda, según {normaDatos}, y podés consultar por ellos en {correoPrivacidad}. Evaluamos a todas las personas con los mismos criterios.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Versión corta para redes',
                  texto: 'Buscamos {puesto} para {empresa}. Objetivo del puesto, [[resultado principal]]. Modalidad {modalidadTexto}, formato {formatoDetalle}. Ofrecemos {remuneracion}. Postulate en {canal}.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Antes de publicar',
                  texto:
                    'Revisalo contra la tabla de preguntas prohibidas. Puesto con nombre neutro o en ambos géneros, sin edad, foto, estado civil ni buena presencia, y con la modalidad real de contratación.',
                },
                {
                  tipo: 'nunca',
                  textos: [
                    'Pedir edad, sexo, estado civil, nacionalidad, foto o buena presencia.',
                    'Nombrar el puesto solo en masculino o solo en femenino.',
                    'Publicar como independiente un puesto con horario fijo, jefe y exclusividad.',
                    'Ocultar el rango para negociar después sobre el salario anterior.',
                  ],
                },
                {
                  tipo: 'porque',
                  texto:
                    'Un aviso con resultados y rango filtra mejor que uno con requisitos genéricos. Y un aviso sin sesgos es la primera prueba de que el proceso fue igual para todos.',
                },
              ],
            },
            {
              id: 'acuse',
              titulo: 'Postulación',
              bajada: 'Sale apenas llega cada postulación, por el mismo canal.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Acuse con aviso de privacidad',
                  texto:
                    'Hola [[nombre]]. Recibimos tu postulación para {puesto} en {empresa}. Revisamos todas las postulaciones con los mismos criterios y te escribimos dentro de {diasRespuesta} con novedades. Sobre tus datos. {empresa} es responsable de su tratamiento y los usa solo para evaluar tu postulación en esta búsqueda, que vos mismo pediste integrar, según {normaDatos}. Los guardamos en {herramienta} con acceso restringido y no los compartimos con terceros, salvo con el proveedor de esa herramienta, que los aloja por nuestra cuenta. Los eliminamos al cerrar la búsqueda, salvo que nos autorices a conservarlos por {meses} para futuras búsquedas. Podés {derechosDatos} escribiendo a {correoPrivacidad}, y si no quedás conforme podés reclamar ante {autoridadDatos}. Más detalle en [[enlace a la política de privacidad]].',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Formulario',
                  texto:
                    'Si la postulación entra por formulario, el mismo aviso va al pie, con una casilla separada y no marcada de antemano para conservar la postulación. El formulario pide solo datos del puesto, sin fecha de nacimiento, estado civil, foto ni datos de salud.',
                },
                {
                  tipo: 'porque',
                  texto:
                    'Informar al recolectar los datos es una obligación en Argentina y en España. El acuse, además, fija el plazo de respuesta que el equipo se compromete a cumplir.',
                },
              ],
            },
            {
              id: 'entrevista',
              titulo: 'Entrevista',
              bajada: 'Invitación con todo lo que el candidato necesita saber y apertura igual para todos.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Invitación a entrevista',
                  texto:
                    'Hola [[nombre]]. Queremos avanzar con tu postulación para {puesto}. Te proponemos una entrevista de [[duración]] el [[día]] a las [[hora]], [[por videollamada o en la dirección]], con [[nombres y roles de quienes entrevistan]]. Todas las personas que llegan a esta etapa responden las mismas preguntas, sobre experiencias concretas de trabajo. Para que lo tengas desde el inicio, el puesto es {formatoDetalle}, en {modalidadOferta}, y ofrecemos {remuneracion}. Si necesitás algún ajuste para la entrevista, avisanos y lo resolvemos. Confirmanos si el horario te sirve o proponenos otro.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Apertura de la entrevista',
                  texto:
                    'Gracias por tu tiempo, [[nombre]]. Te cuento cómo va a ser. Son [[duración]] y te vamos a hacer las mismas preguntas que a todas las personas de esta etapa, sobre experiencias concretas de trabajo. Vamos a tomar notas para no perder nada. Al final tenés tiempo para tus preguntas, y te escribimos dentro de {diasRespuesta} con novedades.',
                },
                {
                  tipo: 'nunca',
                  textos: [
                    'Preguntar por la vida personal para romper el hielo.',
                    'Decidir en los primeros minutos y usar el resto para confirmarlo.',
                    'Comentar entre entrevistadores antes de cargar cada puntaje.',
                  ],
                },
              ],
            },
            {
              id: 'prueba',
              titulo: 'Prueba práctica',
              bajada: 'Consigna escrita con alcance, tiempo, pago y uso del material.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Consigna de la prueba',
                  texto:
                    'Hola [[nombre]]. Gracias por llegar a esta etapa. La prueba práctica consiste en [[consigna concreta y acotada]]. Vamos a evaluar [[criterios, por ejemplo claridad, criterio y resultado]]. No le dediques más de {horasPrueba}. Si en ese tiempo no llegás a todo, entregá lo que tengas con una nota de cómo seguirías. {pagoConsigna} {usoMaterial} El plazo de entrega es el [[fecha]] y la enviás a [[medio de entrega]]. Si tenés dudas sobre la consigna, preguntanos antes de empezar.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Diseño de la prueba',
                  texto:
                    'Que se resuelva en {horasPrueba} como máximo, que mida la habilidad clave del perfil y que no sea un trabajo pendiente del negocio. Se evalúa con el criterio Habilidad clave del puesto de la rúbrica.',
                },
                {
                  tipo: 'porque',
                  texto:
                    'El trabajo no se presume gratuito. Una prueba acotada, con consigna escrita y sin uso del material, mide la habilidad sin convertirse en una prestación de servicios encubierta.',
                },
              ],
            },
            {
              id: 'referencias',
              titulo: 'Referencias',
              bajada: 'Siempre con autorización del candidato y solo sobre desempeño.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Pedido de autorización al candidato',
                  texto:
                    'Hola [[nombre]]. Estás entre las personas finalistas para {puesto}. Como parte del proceso pedimos dos referencias laborales. ¿Nos indicás dos personas con las que hayas trabajado, con su nombre, su rol y un contacto? Solo vamos a contactar a quienes nos indiques y no vamos a escribir a tu empleador actual sin tu autorización expresa. Les vamos a preguntar por tu trabajo y tus resultados, nada personal. Respondé este mensaje confirmando que nos autorizás a contactarlas.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Contacto con la referencia',
                  texto:
                    'Hola [[nombre de la referencia]]. Te escribo de {empresa}. [[Nombre del candidato]] participa de nuestro proceso de selección para {puesto} y nos dio tu contacto con su autorización. ¿Tendrías quince minutos para contarnos cómo fue trabajar con [[nombre]]? Te vamos a preguntar por sus responsabilidades, sus resultados y su forma de trabajar en equipo. Lo que nos cuentes se usa solo para esta búsqueda.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Qué se pregunta',
                  texto:
                    '¿En qué trabajaron juntos y durante cuánto tiempo? ¿Qué resultados logró? ¿Cómo manejaba los plazos y los desacuerdos? ¿Volverías a trabajar con esa persona? Nada sobre salud, vida privada ni motivos personales de su salida.',
                },
                {
                  tipo: 'porque',
                  texto:
                    'La autorización protege al candidato y a la empresa. Una referencia sin consentimiento puede exponer una búsqueda laboral que la persona todavía no contó en su trabajo actual.',
                },
              ],
            },
            {
              id: 'oferta',
              titulo: 'Oferta',
              bajada: 'Formal y por escrito. Lo que no figura acá no se prometió.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Oferta por escrito',
                  texto:
                    'Estimado [[nombre]]. Nos complace ofrecerle el puesto de {puesto} en {area} de {empresa}, en las condiciones que se detallan. Modalidad de contratación, {modalidadOferta}. Formato de trabajo, {formatoDetalle}. Retribución, [[monto acordado y período]].{variableOferta} Fecha de inicio, el [[fecha]]. {periodoPruebaOferta} {altaOferta} Las condiciones completas constarán en el contrato, que le enviaremos para su revisión antes de la firma. Esta oferta se mantiene vigente hasta el [[fecha]] y se acepta respondiendo este correo. Quedamos a su disposición para cualquier consulta.',
                },
                { tipo: 'nota', etiqueta: 'Según la modalidad y el mercado', texto: '{notaOferta}' },
                {
                  tipo: 'nunca',
                  textos: [
                    'Ofrecer por teléfono condiciones que no figuran en la oferta escrita.',
                    'Prometer una variable sin su regla de cálculo.',
                    'Permitir que la persona empiece antes del alta o de la firma del contrato.',
                  ],
                },
                {
                  tipo: 'porque',
                  texto:
                    'La oferta escrita es la primera prueba de lo que se pactó. Si después el contrato o la práctica dicen otra cosa, esa diferencia la usa la otra parte.',
                },
              ],
            },
            {
              id: 'cierre',
              titulo: 'Cierre y datos',
              bajada: 'Respuesta a quienes no quedaron y orden de los datos al cerrar la búsqueda.',
              bloques: [
                {
                  tipo: 'decir',
                  etiqueta: 'Respuesta a no seleccionados',
                  texto:
                    'Hola [[nombre]]. Gracias por el tiempo y la dedicación que pusiste en el proceso para {puesto}. En esta oportunidad decidimos avanzar con otra persona. Valoramos mucho tu interés en {empresa} y te deseamos lo mejor en tu búsqueda.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Pedido de consentimiento para conservar la postulación',
                  texto:
                    'Hola [[nombre]]. Cerramos la búsqueda de {puesto}. Nos gustaría conservar tu postulación para tenerte en cuenta en futuras búsquedas de {empresa}. Si estás de acuerdo, respondé SÍ a este mensaje y la guardamos por {meses}, con acceso restringido. Si no respondés o respondés que no, la eliminamos. Podés retirar tu autorización cuando quieras escribiendo a {correoPrivacidad}.',
                },
                {
                  tipo: 'decir',
                  etiqueta: 'Si pide el motivo',
                  texto:
                    'Hola [[nombre]]. Gracias por escribirnos. La decisión se tomó comparando a todas las personas finalistas con los mismos criterios del puesto, que eran [[criterios principales del perfil]]. En tu caso, [[aspecto concreto de la rúbrica, sin rasgos personales]]. Te agradecemos de nuevo el tiempo dedicado.',
                },
                {
                  tipo: 'nota',
                  etiqueta: 'Antes de responder un pedido de motivo',
                  texto: 'Se responde por escrito, breve y solo con criterios de la rúbrica. Si el candidato alega discriminación, no se responde el fondo y el caso pasa a legales en el día.',
                },
                {
                  tipo: 'nunca',
                  textos: [
                    'Dar como motivo la edad, la maternidad, el origen o cualquier rasgo personal.',
                    'Prometer futuras búsquedas que no existen.',
                    'Conservar postulaciones sin consentimiento después de cerrar la búsqueda.',
                  ],
                },
                {
                  tipo: 'porque',
                  texto:
                    'Cerrar bien cuida la reputación del negocio como empleador y deja constancia de un trato igual para todos. Borrar a tiempo cumple con la idea de que los datos son prestados.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'preguntas',
      titulo: 'Preguntas prohibidas y su reemplazo',
      corto: 'Preguntas prohibidas',
      intro:
        'Una pregunta sobre la vida privada no ayuda a elegir y puede ser la prueba de una discriminación. En {mercadoTexto} el marco principal es {normaDiscriminacion}. Estas son las más comunes y cómo reemplazarlas.',
      bloques: [
        {
          tipo: 'tabla',
          aria: 'Preguntas prohibidas y su reemplazo',
          columnas: [
            { rotulo: 'No preguntes', ancho: '1fr', estilo: 'no' },
            { rotulo: 'Preguntá', ancho: '1.15fr', estilo: 'si' },
            { rotulo: 'Por qué', ancho: '1.1fr', estilo: 'porque' },
          ],
          filas: [
            [
              '¿Cuántos años tenés?',
              'Si el puesto exige una edad mínima por ley, ¿la cumplís?',
              'La edad es un motivo protegido (art. 17 LCT, arts. 4.2.c y 17 ET). La experiencia se evalúa por resultados, no por años.',
            ],
            [
              '¿Estás casado o en pareja?',
              'El puesto requiere [[disponibilidad concreta]]. ¿Es compatible con tu organización?',
              'El estado civil es un motivo protegido (art. 172 LCT, art. 4.2.c ET) y exigirlo a una mujer es violencia laboral en Argentina (art. 6 inc. c Ley 26.485).',
            ],
            [
              '¿Tenés hijos o pensás tenerlos?',
              'Te contamos el horario y la disponibilidad del puesto. ¿Te resulta posible?',
              'Discrimina por maternidad, paternidad o conciliación (Ley 26.485, art. 4.2.c ET). La disponibilidad se pregunta igual a todos.',
            ],
            [
              '¿Estás embarazada?',
              'No tiene reemplazo. Si la persona lo cuenta, no se registra ni se evalúa.',
              'Es discriminación por sexo (art. 17 LCT, arts. 4.2.c y 17 ET). En Argentina exigir un test de embarazo es violencia laboral (Ley 26.485).',
            ],
            [
              '¿Qué religión practicás?',
              'El puesto requiere trabajar [[días y horarios]]. ¿Te resulta posible?',
              'Es un motivo protegido y un dato sensible (art. 7 Ley 25.326, art. 9 RGPD, art. 4.2.c ET).',
            ],
            [
              '¿De dónde sos? ¿Cuál es tu nacionalidad?',
              '¿Contás con habilitación para trabajar en [[país]] o necesitarías un permiso?',
              'El origen y la nacionalidad son motivos protegidos. Lo que importa es si la persona puede trabajar legalmente (Ley 25.871, art. 36 LO 4/2000).',
            ],
            [
              '¿Tenés alguna enfermedad? ¿Tomás medicación?',
              'El puesto requiere [[tarea concreta]]. ¿Podés hacerla, con o sin algún ajuste?',
              'En España no se puede preguntar por la salud del aspirante (art. 9.5 Ley 15/2022). En Argentina es un dato sensible (art. 7 Ley 25.326) y la aptitud se evalúa en el examen preocupacional, no en la entrevista.',
            ],
            [
              '¿Estás afiliado a un sindicato? ¿A quién votaste?',
              'No tiene reemplazo. No es información del puesto.',
              'Motivo protegido y dato sensible (art. 17 LCT, Ley 23.592, art. 4.2.c ET, art. 9 RGPD).',
            ],
            [
              '¿Tuviste problemas con la justicia? Traé tu certificado de antecedentes.',
              'Solo si una norma lo exige para el puesto, por ejemplo en España la certificación negativa de delitos sexuales para tareas con menores.',
              'En Argentina esos datos están reservados a las autoridades (art. 7 inc. 4 Ley 25.326). En España requieren una norma que los ampare (art. 10 LOPDGDD).',
            ],
            [
              '¿Cuánto ganabas en tu trabajo anterior?',
              'Para este puesto ofrecemos {rango}. ¿Está dentro de lo que buscás?',
              'La Directiva (UE) 2023/970 lo prohíbe (art. 5.2), con transposición pendiente en España. En Argentina no hay prohibición expresa, pero arrastra brechas previas y no hace falta para decidir.',
            ],
            [
              '¿Me pasás tus redes o me aceptás como contacto en tu cuenta personal?',
              '¿Hay algún perfil profesional o trabajo publicado que quieras que veamos?',
              'Nadie está obligado a abrir sus redes personales. La AEPD admite revisar solo perfiles profesionales públicos, avisando a la persona. En Argentina rige el principio de datos no excesivos (art. 4 Ley 25.326).',
            ],
            [
              'Preguntas sobre orientación sexual, identidad de género o con quién convive la persona.',
              '¿Cómo preferís que te llamemos durante el proceso?',
              'Son motivos protegidos (arts. 4.2.c y 17 ET, art. 2.1 Ley 15/2022). En Argentina se usa el nombre adoptado si la persona lo pide (art. 12 Ley 26.743).',
            ],
            [
              '¿Me mandás una foto? Buscamos buena presencia.',
              '¿Me compartís tu perfil profesional o ejemplos de tu trabajo?',
              'La apariencia no mide el desempeño. Los caracteres físicos son un motivo de discriminación (Ley 23.592) y exigir apariencia a una mujer es violencia laboral (Ley 26.485).',
            ],
          ],
        },
        {
          tipo: 'aclaracion',
          texto:
            'Si el candidato cuenta por su cuenta un dato sensible, no se registra, no se comenta y no se evalúa. Si alguien del equipo hizo una pregunta de esta tabla, se registra qué se preguntó, no se usa la respuesta y se avisa a legales.',
        },
      ],
    },
    {
      id: 'alertas',
      titulo: 'Alertas y escalamiento',
      corto: 'Alertas',
      intro: 'Ante cualquiera de estas señales se frena y se consulta. Nadie del equipo decide quedárselo.',
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
              'Un candidato cuenta un dato sensible, como embarazo, salud o religión, sin que se le pregunte.',
              'No registrarlo ni comentarlo. Volver a las preguntas del puesto. Si pide un ajuste para la entrevista, darlo sin indagar.',
              'Quien recluta',
            ],
            [
              'Alguien del equipo hizo una pregunta prohibida o anotó un rasgo personal en la evaluación.',
              'Registrar qué se preguntó, no usar esa respuesta y revisar el puntaje con otra persona.',
              'Legales',
            ],
            ['Un candidato descartado alega discriminación o pide explicaciones en tono de reclamo.', 'No responder el fondo. Preservar rúbricas, notas y mensajes de esa búsqueda.', 'Legales hoy'],
            ['Un candidato pide acceder a sus datos, corregirlos o borrarlos.', 'Registrar fecha y canal y derivar a {correoPrivacidad}. Los plazos legales corren desde la recepción.', 'Legales'],
            [
              'El puesto se publicó como independiente, pero se piden horario fijo, exclusividad o reporte diario.',
              'Frenar la oferta y revisar el encuadre antes de seguir.',
              'Legales',
            ],
            ['Se quiere contratar a alguien que vive en otro país.', 'Revisar ley aplicable, habilitación para trabajar y facturación antes de la oferta.', 'Legales y contador'],
            ['Quien contrata quiere sumar a alguien sin proceso, por recomendación o urgencia.', 'Aplicar al menos la entrevista estructurada y la rúbrica antes de ofrecer.', 'Dirección'],
            ['Una referencia aporta datos de salud, vida privada o rumores.', 'No registrarlos ni usarlos. Volver a preguntas sobre desempeño.', 'Quien recluta'],
            ['El equipo quiere usar el material de una prueba práctica.', 'No usarlo sin acuerdo escrito y pago. Si hace falta, se contrata el trabajo aparte.', 'Dirección y legales'],
            ['Se quiere retirar una oferta ya aceptada.', 'No comunicarlo por chat. Evaluar primero el riesgo, porque una oferta aceptada puede generar obligaciones.', 'Legales hoy'],
            [
              'Una herramienta con inteligencia artificial descarta o puntúa candidatos sola.',
              'Asegurar revisión humana de cada descarte y revisar el encuadre de datos antes de seguir usándola.',
              'Legales',
            ],
            ['Una persona empezaría a trabajar antes del alta o de la firma del contrato.', 'Postergar el inicio hasta completar la registración o la firma.', 'Administración'],
          ],
        },
        {
          tipo: 'aclaracion',
          texto: 'Escalar no es perder el control de la búsqueda. Es dejar la decisión riesgosa en manos de quien puede tomarla con el contrato y la ley a la vista.',
        },
      ],
    },
    {
      id: 'control',
      titulo: 'Control del proceso',
      corto: 'Checklist',
      intro: 'Se completa al cerrar cada búsqueda. Los ítems críticos son los que sostienen la decisión si alguien la cuestiona.',
      bloques: [
        {
          tipo: 'checklist',
          id: 'proceso',
          titulo: 'Checklist de la búsqueda',
          textoConforme: 'Proceso conforme',
          textoNoConforme: 'No conforme · falta al menos un ítem crítico',
          items: [
            { id: 'c1', texto: 'Perfil del puesto con resultados a 90 días aprobado por {decisor}.', critico: true },
            { id: 'c2', texto: 'Aviso revisado sin sesgos y con la modalidad de contratación real.', critico: true },
            { id: 'c3', texto: 'Aviso de privacidad en el canal de postulación y en el acuse.', critico: true },
            { id: 'c4', texto: 'Mismas preguntas y misma rúbrica para todos, con puntajes individuales cargados antes de la puesta en común.', critico: true },
            { id: 'c5', texto: 'Prueba práctica con consigna escrita, tiempo acotado y pago o uso del material definidos.', critico: true },
            { id: 'c6', texto: 'Referencias pedidas con autorización del candidato.', critico: true },
            { id: 'c7', texto: 'Oferta por escrito con modalidad, retribución, variable, fecha de inicio y período de prueba.', critico: true },
            { id: 'c8', texto: 'Alta o contrato firmado antes del primer día de trabajo.', critico: true },
            { id: 'e1', texto: 'Rango informado en el aviso o antes de la primera entrevista.', critico: false },
            { id: 'e2', texto: 'Respuesta a cada candidato dentro de {diasRespuesta} en cada etapa.', critico: false },
            { id: 'e3', texto: 'Motivo de cada descarte registrado con criterios del perfil.', critico: false },
            { id: 'e4', texto: 'Motivo de cada oferta rechazada registrado.', critico: false },
            { id: 'e5', texto: 'Fuente de cada postulación registrada en {herramienta}.', critico: false },
            { id: 'e6', texto: 'Postulaciones de no seleccionados eliminadas o con consentimiento para conservarlas por {meses}.', critico: false },
            { id: 'e7', texto: 'Rúbricas y notas guardadas con acceso restringido, según la política de conservación.', critico: false },
            { id: 'e8', texto: 'Revisión de calidad a los 90 días agendada.', critico: false },
          ],
        },
      ],
    },
    {
      id: 'tablero',
      titulo: 'Tablero de indicadores',
      corto: 'Tablero',
      intro: 'Lo que no se mide se repite. Se revisa al cerrar cada búsqueda y una vez por trimestre, y alimenta los ajustes al perfil, al aviso y a la rúbrica.',
      bloques: [
        {
          tipo: 'kpis',
          items: [
            {
              nombre: 'Tiempo de cobertura',
              formula: 'Días corridos entre la apertura de la búsqueda y la aceptación de la oferta.',
              lectura: 'Una búsqueda larga consume horas del equipo y deja más tiempo para que los mejores candidatos acepten otra propuesta.',
              meta: 'Hasta {diasObjetivo}',
              frecuencia: 'Por búsqueda',
              fuente: '{herramienta}',
            },
            {
              nombre: 'Costo por contratación',
              formula: 'Costo total del proceso, con avisos, herramientas, pruebas pagas y horas del equipo valorizadas, dividido contrataciones aceptadas.',
              lectura: 'Se mira junto con la calidad a 90 días. Bajarlo a costa de contratar peor sale más caro.',
              meta: 'Bajar búsqueda a búsqueda sin perder calidad',
              frecuencia: 'Por búsqueda',
              fuente: 'Administración',
            },
            {
              nombre: 'Aceptación de ofertas',
              formula: 'Ofertas aceptadas, dividido ofertas emitidas, por cien.',
              lectura: 'Si baja, revisá la oferta, los tiempos y si lo conversado en las entrevistas coincidió con lo ofrecido por escrito.',
              meta: 'Subir búsqueda a búsqueda',
              frecuencia: 'Por búsqueda',
              fuente: 'Ofertas enviadas',
            },
            {
              nombre: 'Conversión por etapa',
              formula: 'Personas que pasan a la etapa siguiente, dividido personas que entraron a la etapa, por cien, en cada etapa.',
              lectura: 'Muestra dónde se pierde gente. Se compara con búsquedas anteriores del mismo puesto.',
              frecuencia: 'Por búsqueda',
              fuente: '{herramienta}',
            },
            {
              nombre: 'Calidad a 90 días',
              formula: 'Ingresos que a los 90 días alcanzan los resultados del perfil, dividido ingresos del período, por cien.',
              lectura: 'Valida todo el proceso. Se mide contra los resultados escritos en el perfil, no contra impresiones.',
              meta: 'Subir trimestre a trimestre',
              frecuencia: 'Trimestral',
              fuente: 'Revisión de 90 días',
            },
            {
              nombre: 'Rotación temprana',
              formula: 'Bajas, voluntarias o no, dentro de los primeros 90 días, dividido ingresos del período, por cien.',
              lectura:
                'Cada baja temprana se analiza con su causa. Revisá primero si el perfil estaba bien definido y si lo prometido en la selección coincidió con el trabajo real.',
              meta: 'Bajar trimestre a trimestre',
              frecuencia: 'Trimestral',
              fuente: 'Administración',
            },
            {
              nombre: 'Fuente de los mejores candidatos',
              formula: 'Contrataciones que superaron la revisión de 90 días, agrupadas por la fuente de su postulación.',
              lectura: 'Indica dónde invertir en la próxima búsqueda. Una fuente con muchas postulaciones y ninguna buena contratación es un gasto, no un canal.',
              frecuencia: 'Semestral',
              fuente: '{herramienta}',
            },
            {
              nombre: 'Respuesta en plazo',
              formula: 'Candidatos que recibieron respuesta dentro de {diasRespuesta}, dividido candidatos que la esperaban, por cien.',
              lectura: 'Cuida la reputación del negocio como empleador y deja constancia de un trato igual para todos.',
              meta: 'Todos los candidatos',
              frecuencia: 'Mensual',
              fuente: '{herramienta}',
            },
          ],
        },
        {
          tipo: 'calculadora',
          id: 'calidad',
          titulo: 'Calidad de las contrataciones',
          intro: 'Cargá los números del trimestre y obtené los indicadores que validan el proceso.',
          entradas: [
            { id: 'ingresos', rotulo: 'Ingresos del período', unidad: 'personas' },
            { id: 'cumplen', rotulo: 'Cumplen los resultados a 90 días', unidad: 'personas', ayuda: 'Según la revisión de 90 días contra el perfil.' },
            { id: 'bajas', rotulo: 'Bajas en los primeros 90 días', unidad: 'personas', ayuda: 'Voluntarias o no.' },
            { id: 'candidatos', rotulo: 'Candidatos que esperaban respuesta', unidad: 'personas', ayuda: 'Personas con una etapa cerrada en el período.' },
            { id: 'respondidos', rotulo: 'Respondidos en plazo', unidad: 'personas', ayuda: 'Dentro de los días de la ficha.' },
          ],
          salidas: [
            { id: 'calidad', rotulo: 'Calidad a 90 días', formato: 'pct', destacada: true, calcular: (v) => tasa(v.cumplen, v.ingresos) },
            { id: 'rotacion', rotulo: 'Rotación temprana', formato: 'pct', calcular: (v) => tasa(v.bajas, v.ingresos) },
            { id: 'respuesta', rotulo: 'Respuesta en plazo', formato: 'pct', meta: { valor: 100, sentido: 'min' }, calcular: (v) => tasa(v.respondidos, v.candidatos) },
          ],
          nota: 'Los datos salen de {herramienta} y de la revisión de 90 días. La meta de respuesta en plazo es el compromiso del propio protocolo, no un promedio externo.',
        },
      ],
    },
    {
      id: 'juridico',
      titulo: 'Anexo jurídico',
      corto: 'Anexo jurídico',
      intro:
        'Para la dirección y el equipo legal. Cada regla del protocolo se apoya en lo que sigue. Normativa revisada a octubre de 2026. No reemplaza el análisis del caso concreto, y la materia laboral compleja se define con el abogado.',
      bloques: [
        {
          tipo: 'juridico',
          items: [
            {
              id: 'ar',
              titulo: 'Argentina',
              bajada: 'Ley 23.592, Ley de Contrato de Trabajo, Ley 25.326, Ley 26.485 y Código Civil y Comercial.',
              abierto: true,
              items: [
                {
                  lead: 'No discriminación en el acceso.',
                  nivel: 'ALTO',
                  texto:
                    'Quien impide o menoscaba en forma arbitraria el ejercicio igualitario de derechos debe dejar sin efecto el acto y reparar el daño moral y material, y la ley menciona en particular raza, religión, nacionalidad, ideología, opinión política o gremial, sexo, posición económica, condición social y caracteres físicos (art. 1 Ley 23.592). La LCT prohíbe discriminar por sexo, raza, nacionalidad, religión, motivos políticos, gremiales o de edad (art. 17) e impone igual trato en identidad de situaciones (art. 81). La Corte Suprema admite que quien alega discriminación acredite hechos que la hagan verosímil y traslada al empleador la prueba de un motivo objetivo (Pellicori, 2011). Por eso la rúbrica y las notas con evidencia son la mejor defensa.',
                },
                {
                  lead: 'Requisitos que son violencia laboral.',
                  nivel: 'MEDIO',
                  texto:
                    'La Ley 26.485 considera violencia laboral contra las mujeres obstaculizar su acceso al empleo exigiendo requisitos sobre estado civil, maternidad, edad, apariencia física o la realización de un test de embarazo (art. 6 inc. c). Esos requisitos no pueden aparecer en el aviso, en el formulario ni en la entrevista.',
                },
                {
                  lead: 'Datos de los postulantes.',
                  nivel: 'ALTO',
                  texto:
                    'Los datos tienen que ser ciertos, adecuados, pertinentes y no excesivos para la finalidad, y se destruyen cuando dejan de ser necesarios (art. 4 Ley 25.326). Al recolectarlos se informa la finalidad, los destinatarios, el responsable, el carácter obligatorio o facultativo de cada dato y los derechos del titular (art. 6). Nadie está obligado a dar datos sensibles, como origen, opiniones políticas, religión, afiliación sindical o salud (arts. 2 y 7). El acceso se responde en 10 días corridos (art. 14) y la rectificación o supresión en 5 días hábiles (art. 16). El organismo de control es la Agencia de Acceso a la Información Pública.',
                },
                {
                  lead: 'Consentimiento y proveedores.',
                  nivel: 'MEDIO',
                  texto:
                    'El tratamiento requiere consentimiento libre, expreso e informado, salvo las excepciones legales (art. 5 Ley 25.326). El formulario lo recaba para la búsqueda y, en una casilla separada, para conservar la postulación por {meses}. Quien presta el servicio de {herramienta} no puede usar los datos para otro fin (art. 25), y si los aloja fuera del país se revisa el régimen de transferencias internacionales (art. 12).',
                },
                {
                  lead: 'Antecedentes penales.',
                  nivel: 'MEDIO',
                  texto:
                    'Los datos sobre antecedentes penales o contravencionales solo pueden ser tratados por las autoridades públicas competentes (art. 7 inc. 4 Ley 25.326). Pedir el certificado como requisito general es discutible y se reserva, con criterio de legales, para puestos donde una norma lo exija o la relación con la tarea sea directa.',
                },
                {
                  lead: 'Presunción de contrato de trabajo.',
                  nivel: 'ALTO',
                  texto:
                    'Desde la Ley 27.802 (BO 6 de marzo de 2026), la prestación de servicios en situación de dependencia hace presumir un contrato de trabajo. La presunción no se aplica a contrataciones de obras, servicios profesionales u oficios, u otras modalidades sin relación de dependencia, cuando se emiten recibos o facturas o el pago se hace por los sistemas bancarios que fije la reglamentación, y esa ausencia de presunción se extiende a todos los efectos, incluida la seguridad social (art. 23 LCT). El contrato que simula una figura no laboral sigue siendo nulo (art. 14 LCT). Si el puesto tiene horario fijo, órdenes, exclusividad o integración plena al equipo, el encuadre se define con el abogado antes de publicar.',
                },
                {
                  lead: 'Independientes con colaboradores y plataformas.',
                  nivel: 'BAJO',
                  texto:
                    'La LCT excluye de su ámbito a los trabajadores independientes y sus colaboradores en los términos del art. 97 de la Ley 27.742, y a los prestadores independientes de plataformas tecnológicas (art. 2 LCT, según la Ley 27.802). Son regímenes con requisitos propios y no cubren un puesto que en los hechos es dependiente.',
                },
                {
                  lead: 'Prueba práctica.',
                  nivel: 'MEDIO',
                  texto:
                    'El trabajo no se presume gratuito (art. 115 LCT). Una prueba que produce algo que el negocio usa se acerca a una prestación de servicios. Por eso el protocolo la acota, paga las de más de dos horas o las que se usan y no aprovecha el material sin acuerdo escrito.',
                },
                {
                  lead: 'Período de prueba.',
                  nivel: 'MEDIO',
                  texto:
                    'El contrato por tiempo indeterminado se entiende celebrado a prueba durante los primeros seis meses, y los convenios colectivos pueden extenderlo hasta ocho meses en empresas de seis a cien trabajadores y hasta un año en empresas de hasta cinco (art. 92 bis LCT, según la Ley 27.742). Exige registrar a la persona desde el inicio, porque sin registro se entiende que el empleador renunció al período, y no puede usarse más de una vez con la misma persona. Durante ese lapso cualquiera de las partes puede extinguir la relación sin causa y sin indemnización, y desde la Ley 27.802 sin obligación de preaviso (art. 231 LCT).',
                },
                {
                  lead: 'Registración.',
                  nivel: 'ALTO',
                  texto:
                    'Los empleadores registran a sus trabajadores ante ARCA según la normativa de ese organismo, y esa registración alcanza a todos los efectos (art. 52 LCT, según la Ley 27.802). El alta se hace antes del primer día de trabajo. Quien empieza a trabajar sin alta, aunque sea a prueba, trabaja sin registro.',
                },
                {
                  lead: 'Habilitación para trabajar.',
                  nivel: 'MEDIO',
                  texto: 'No se puede dar trabajo a personas extranjeras que residan en forma irregular (Ley 25.871 de Migraciones). Se pregunta por la habilitación, nunca por el origen.',
                },
                {
                  lead: 'Teletrabajo.',
                  nivel: 'BAJO',
                  texto:
                    'Si el puesto es remoto o híbrido y en relación de dependencia, rige la Ley 27.555, con reglas propias sobre jornada, desconexión, elementos de trabajo y gastos. Se revisa antes de la oferta.',
                },
                {
                  lead: 'Tratativas y oferta.',
                  nivel: 'MEDIO',
                  texto:
                    'Durante las tratativas las partes deben obrar de buena fe y no frustrarlas sin motivo, y quien lo hace responde por el daño de quien confió en la celebración del contrato (art. 991 CCyC). Retirar una oferta ya aceptada se consulta con legales antes de comunicarlo.',
                },
              ],
            },
            {
              id: 'es',
              titulo: 'España',
              bajada: 'Estatuto de los Trabajadores, Ley 15/2022, LISOS, RGPD, LOPDGDD y Directiva (UE) 2023/970.',
              items: [
                {
                  lead: 'No discriminación en el acceso.',
                  nivel: 'ALTO',
                  texto:
                    'Las personas tienen derecho a no ser discriminadas para el empleo por estado civil, edad, origen racial o étnico, condición social, religión o convicciones, ideas políticas, orientación e identidad sexual, expresión de género, características sexuales, afiliación sindical, lengua, discapacidad o sexo (art. 4.2.c ET), y son nulas las decisiones del empresario que discriminen (art. 17.1 ET). La Ley 15/2022 suma la enfermedad o condición de salud entre los motivos (art. 2.1), prohíbe limitaciones en el acceso al empleo, incluidos los criterios de selección (art. 9.1), presume el daño moral una vez acreditada la discriminación (art. 27.1) e invierte la carga de la prueba cuando hay indicios fundados (art. 30.1).',
                },
                {
                  lead: 'Salud del aspirante.',
                  nivel: 'ALTO',
                  texto:
                    'El empleador no puede preguntar sobre las condiciones de salud de quien aspira al puesto (art. 9.5 Ley 15/2022). Según la guía de la AEPD, el reconocimiento médico es voluntario salvo que una ley lo haga obligatorio.',
                },
                {
                  lead: 'Anuncios y datos en la selección.',
                  nivel: 'ALTO',
                  texto:
                    'Es infracción muy grave solicitar datos personales en procesos de intermediación o colocación, o establecer condiciones por publicidad o cualquier otro medio que discriminen en el acceso al empleo por edad, sexo, discapacidad, salud, orientación sexual, identidad o expresión de género, características sexuales, nacionalidad, origen, religión, opinión política, afiliación sindical, lengua u otra circunstancia personal o social (art. 16.1.c LISOS).',
                },
                {
                  lead: 'Datos de candidatos.',
                  nivel: 'ALTO',
                  texto:
                    'Durante el proceso los datos se tratan sin necesidad de consentimiento, porque responden a medidas precontractuales pedidas por la persona (art. 6.1.b RGPD). Se informa al recogerlos, idealmente en el propio anuncio (art. 13 RGPD), y se puede informar por capas (art. 11 LOPDGDD). Solo se piden datos relevantes para el puesto (art. 5.1.c RGPD). Si los datos vienen de terceros, como referencias o perfiles profesionales, se informa en los plazos del art. 14 RGPD. Al cerrar la búsqueda desaparece la base para conservarlos, así que guardar el currículum para futuras búsquedas exige consentimiento específico o un interés legítimo acreditado, y si no lo hay se suprimen y se bloquean (guía de la AEPD sobre relaciones laborales, arts. 6.2 y 32 LOPDGDD).',
                },
                {
                  lead: 'Redes sociales.',
                  nivel: 'MEDIO',
                  texto:
                    'Los candidatos no están obligados a permitir que el empleador indague en sus redes. Solo se revisan perfiles públicos con fines profesionales, informando a la persona, y nunca se pide amistad o acceso (guía de la AEPD, con cita del Dictamen 2/2017 del Grupo de Trabajo del Artículo 29).',
                },
                {
                  lead: 'Antecedentes penales.',
                  nivel: 'MEDIO',
                  texto:
                    'Los datos penales solo se tratan cuando una norma con rango de ley lo ampara (art. 10 RGPD y art. 10 LOPDGDD), y la AEPD considera que no se puede exigir con carácter general el certificado de antecedentes. La excepción típica es la certificación negativa del Registro Central de Delincuentes Sexuales para tareas con contacto habitual con menores (art. 13.5 LO 1/1996).',
                },
                {
                  lead: 'Decisiones automatizadas e inteligencia artificial.',
                  nivel: 'MEDIO',
                  texto:
                    'Nadie puede quedar sujeto a una decisión basada únicamente en un tratamiento automatizado con efectos significativos (art. 22 RGPD). La AEPD admite una primera criba automática en procesos con muchos candidatos, interpretada en forma restrictiva, con intervención humana a pedido y, en su caso, evaluación de impacto (art. 35 RGPD). El Reglamento (UE) 2024/1689 de inteligencia artificial clasifica como de alto riesgo los sistemas para seleccionar o filtrar candidatos y prohíbe inferir emociones de las personas en el lugar de trabajo (art. 5.1.f).',
                },
                {
                  lead: 'Período de prueba.',
                  nivel: 'MEDIO',
                  texto:
                    'Se pacta por escrito, dentro de los límites del convenio, y en su defecto no puede exceder de seis meses para técnicos titulados ni de dos meses para el resto, o tres meses en empresas de menos de veinticinco trabajadores. En contratos temporales de hasta seis meses el límite es un mes, salvo convenio. Es nulo si la persona ya hizo las mismas funciones en la empresa, y la resolución por embarazo es nula salvo motivos ajenos a él (art. 14 ET).',
                },
                {
                  lead: 'Falsos autónomos.',
                  nivel: 'ALTO',
                  texto:
                    'Se presume contrato de trabajo entre quien presta un servicio por cuenta y dentro del ámbito de organización y dirección de otro y quien lo recibe a cambio de una retribución (art. 8.1 ET). El nombre del contrato no decide. Si el puesto se describe como autónomo pero tiene horario, órdenes, medios de la empresa y retribución fija, el encuadre se revisa con el abogado antes de la oferta.',
                },
                {
                  lead: 'Información escrita de las condiciones.',
                  nivel: 'MEDIO',
                  texto:
                    'El Real Decreto 723/2026, vigente desde el 5 de octubre de 2026, reemplazó al Real Decreto 1659/1998 y desarrolla el deber de informar por escrito los elementos esenciales del contrato, entre ellos la duración y las condiciones del período de prueba (art. 8.5 ET). La oferta escrita del protocolo se alinea con esa información.',
                },
                {
                  lead: 'Transparencia retributiva.',
                  nivel: 'MEDIO',
                  texto:
                    'La Directiva (UE) 2023/970 da a quien se postula derecho a conocer la retribución inicial o su banda, con criterios objetivos y neutros, y las disposiciones del convenio aplicables, por ejemplo en el anuncio (art. 5.1). También prohíbe preguntar el historial retributivo (art. 5.2) y exige anuncios y denominaciones neutros y procesos no discriminatorios (art. 5.3). El plazo de transposición venció el 7 de junio de 2026 y, a octubre de 2026, España no la había transpuesto. El proyecto de real decreto que modifica el Real Decreto 902/2020 seguía en diálogo social y, en su versión de julio de 2026, no regulaba la transparencia previa al empleo. Mientras tanto rigen la igualdad retributiva y el registro retributivo (art. 28 ET y Real Decreto 902/2020), y el protocolo ya aplica el rango en el aviso y no pregunta el salario anterior.',
                },
                {
                  lead: 'Autorización para trabajar.',
                  nivel: 'MEDIO',
                  texto: 'Las personas extranjeras necesitan autorización administrativa previa para residir y trabajar (art. 36 LO 4/2000). Se pregunta por la habilitación, nunca por el origen.',
                },
              ],
            },
            {
              id: 'ajustes',
              titulo: 'Ajustes sugeridos',
              bajada: 'Lo que conviene revisar en formularios, contratos y herramientas para que el protocolo tenga respaldo.',
              items: [
                {
                  lead: 'Formulario de postulación.',
                  nivel: 'ALTO',
                  texto:
                    'Pedir solo datos del puesto, sin fecha de nacimiento, estado civil, foto ni datos de salud, con el aviso de privacidad por capas y una casilla separada y no marcada de antemano para conservar la postulación por {meses}.',
                },
                {
                  lead: 'Contrato coherente con la modalidad.',
                  nivel: 'ALTO',
                  texto:
                    'Si la contratación es independiente, el contrato describe resultados, autonomía para organizar medios y horarios, facturación y ausencia de exclusividad, y la práctica diaria tiene que coincidir. Si es en relación de dependencia, prevé período de prueba, convenio aplicable y, si es remoto, las reglas de teletrabajo.',
                },
                {
                  lead: 'Consigna de la prueba práctica.',
                  nivel: 'MEDIO',
                  texto: 'Un modelo fijo con alcance, tiempo estimado, criterios, pago y uso del material. Si el material se va a usar, se firma una cesión o se contrata el trabajo aparte.',
                },
                {
                  lead: 'Contrato con la herramienta de seguimiento.',
                  nivel: 'MEDIO',
                  texto:
                    'El proveedor de {herramienta} trata datos por cuenta de la empresa. Conviene un contrato de encargo de tratamiento (art. 28 RGPD) o una cláusula equivalente (art. 25 Ley 25.326), y saber dónde aloja los datos.',
                },
                {
                  lead: 'Política de conservación.',
                  nivel: 'MEDIO',
                  texto:
                    'Plazos por tipo de documento. Postulaciones con consentimiento por {meses}, rúbricas y notas mientras pueda existir un reclamo y con acceso restringido, y el resto se elimina al cerrar la búsqueda.',
                },
                {
                  lead: 'Bandas retributivas.',
                  nivel: 'MEDIO',
                  texto:
                    'Rangos por puesto con criterios objetivos y neutros, escritos antes de abrir la búsqueda. En España anticipan la transposición de la Directiva (UE) 2023/970 y en Argentina ayudan a demostrar igual trato (art. 81 LCT).',
                },
              ],
            },
            {
              id: 'dudas',
              titulo: 'Zonas de duda',
              bajada: 'Puntos donde la interpretación no es pacífica o la normativa está en movimiento. Se deciden caso por caso con el abogado.',
              items: [
                {
                  lead: 'Reforma laboral argentina.',
                  texto:
                    'La Ley 27.802 cambió la presunción del art. 23 LCT y fue cuestionada judicialmente, incluso con medidas cautelares. Antes de apoyarse en su texto para un encuadre independiente, se verifica con el abogado su vigencia y su aplicación al caso.',
                },
                {
                  lead: 'Alcance de la nueva presunción.',
                  texto:
                    'No está claro cómo valorarán los tribunales una prestación facturada que en los hechos muestra dependencia. La factura quita la presunción, pero no impide probar la relación laboral por otros medios.',
                },
                {
                  lead: 'Antecedentes penales en Argentina.',
                  texto: 'Es habitual pedir el certificado, pero el art. 7 inc. 4 de la Ley 25.326 reserva esos datos a las autoridades. Los criterios para puestos sin exigencia legal no son uniformes.',
                },
                {
                  lead: 'Conservación para defensa.',
                  texto:
                    'Cuánto tiempo guardar rúbricas y notas para defender la decisión frente a un reclamo por discriminación, frente al principio de minimización. España lo resuelve con el bloqueo (art. 32 LOPDGDD). Argentina no tiene una regla expresa equivalente.',
                },
                {
                  lead: 'Prueba práctica no paga.',
                  texto: 'No hay una norma específica. Que un ejercicio breve sea o no una prestación de servicios depende de los hechos, sobre todo de si el negocio usa el resultado.',
                },
                {
                  lead: 'Trabajo a distancia entre países.',
                  texto:
                    'La ley aplicable a quien trabaja desde otro país no es pacífica. En Argentina rige la ley del lugar de ejecución (art. 3 LCT) y, en el teletrabajo transnacional, la del lugar de ejecución o la del domicilio del empleador, la más favorable para quien trabaja (art. 17 Ley 27.555). En la Unión Europea, la elección de ley no puede privar al trabajador de la protección de la ley del país donde trabaja habitualmente (art. 8 Reglamento Roma I). Se define con el abogado y con el contador.',
                },
                {
                  lead: 'Transparencia retributiva sin transposición.',
                  texto:
                    'Según la doctrina del TJUE, una directiva no transpuesta no genera por sí sola obligaciones entre particulares, aunque los jueces deben interpretar el derecho interno conforme a ella. Tampoco está cerrado si la banda debe informarse antes de la primera entrevista, como sugiere el considerando 32, o alcanza con hacerlo antes del contrato.',
                },
                {
                  lead: 'Doble redacción del art. 16.1.c LISOS.',
                  texto:
                    'Las Leyes 3/2023 y 4/2023 dieron redacciones distintas a la misma letra, una referida a procesos de intermediación o colocación y otra a procesos de selección. La doctrina discute cuál prevalece y si alcanza a la selección directa de la empresa.',
                },
                {
                  lead: 'Inteligencia artificial en la selección.',
                  texto:
                    'El calendario de las obligaciones para sistemas de alto riesgo del Reglamento (UE) 2024/1689 fue objeto de propuestas de postergación. Se verifica su estado, y el alcance de la prohibición de inferir emociones, antes de usar herramientas que analicen entrevistas.',
                },
                {
                  lead: 'Oferta aceptada y retirada.',
                  texto: 'Si una oferta aceptada ya es un contrato o solo genera responsabilidad precontractual depende de su contenido y de los criterios de cada tribunal.',
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
      intro: 'Una página para tener a mano en cada entrevista. El botón la imprime sola.',
      tarjeta: true,
      bloques: [
        {
          tipo: 'bolsillo',
          filas: [
            { rotulo: 'Tres reglas', numerada: true, lista: ['Contratá por resultados, no por intuición.', 'Mismas preguntas, misma vara.', 'Todo por escrito, también la oferta.'] },
            {
              rotulo: 'Antes de cada entrevista',
              numerada: true,
              lista: [
                '¿Tengo a mano el perfil con los resultados a 90 días?',
                '¿Tengo la rúbrica y las preguntas de esta búsqueda?',
                '¿El candidato conoce el rango, la modalidad y el formato?',
                '¿Repasé las preguntas que no se hacen?',
              ],
            },
            {
              rotulo: 'Tres nunca',
              tono: 'nunca',
              lista: [
                'Nunca preguntes edad, hijos, salud, religión ni salario anterior.',
                'Nunca pidas trabajo gratis que el negocio vaya a usar.',
                'Nunca dejes a un candidato sin respuesta.',
              ],
            },
            [
              { rotulo: 'Si dudás', texto: 'Preguntá por el puesto, no por la persona.' },
              { rotulo: 'Siempre', texto: 'Notas y puntajes en {herramienta}, el mismo día.' },
            ],
          ],
        },
      ],
    },
  ];
}

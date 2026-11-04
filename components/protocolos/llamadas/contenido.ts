// Secciones del protocolo de llamadas, armadas con los bloques del motor.
// Los textos y los guiones viven en datos.ts. Regla de estilo de FIRMA, sin rayas ni dos puntos.

import type { Ficha, Seccion } from '../motor/tipos';
import {
  ALERTAS,
  CAMPOS_CRM,
  COMO_DECIRLO,
  CONSECUENCIAS,
  CONSERVACION,
  CONTROL,
  FRASES,
  JURIDICO,
  MOMENTOS,
  MUESTRA,
  NICHOS,
  NOTA_CONTROL,
  REGLAS_ORO,
  REGLAS_SETTER,
  REPASO_APERTURA,
  REPASO_CIERRE,
  ROLES,
  construirCorreo,
  construirGuiones,
  construirObjeciones,
  construirRepaso,
} from './datos';
import { configDe } from './ficha';

export function secciones(f: Ficha): Seccion[] {
  const c = configDe(f);
  const repaso = construirRepaso(c);
  const correo = construirCorreo(c);

  return [
    {
      id: 'uso',
      titulo: 'Cómo usar este protocolo',
      corto: 'Cómo usarlo',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Este documento es el procedimiento y guion comercial al que remiten los contratos de closers y setters. Aplicarlo forma parte del servicio contratado. Los datos de cada cliente se completan una sola vez en la ficha y se actualizan solos en todos los guiones.',
        },
        { tipo: 'leyenda', vivo: 'Se completa en la llamada' },
        { tipo: 'roles', items: ROLES },
        { tipo: 'tarjetas', items: [{ titulo: 'Reglas para setters', lista: REGLAS_SETTER, numerada: true }] },
        { tipo: 'aclaracion', texto: 'Si algo de un guion no coincide con el contrato del cliente, prevalece el contrato y hay que avisar para ajustar la ficha.' },
      ],
    },
    {
      id: 'ficha',
      titulo: 'Ficha del cliente',
      corto: 'Ficha del cliente',
      intro: 'Se completa una sola vez por cliente. Los guiones de todo el protocolo se actualizan solos.',
      bloques: [{ tipo: 'ficha' }],
    },
    {
      id: 'reglas',
      titulo: 'Cinco reglas de oro',
      corto: 'Reglas de oro',
      intro: 'La versión de un minuto. Si el equipo recuerda solo esto, ya evita la mayoría de los problemas.',
      bloques: [
        { tipo: 'reglas', items: REGLAS_ORO },
        { tipo: 'subtitulo', texto: 'Cómo decirlo sin enfriar la venta' },
        { tipo: 'tips', items: COMO_DECIRLO },
      ],
    },
    {
      id: 'mapa',
      titulo: 'La llamada en siete momentos',
      corto: 'Siete momentos',
      intro: 'Cada momento comercial tiene un objetivo legal. Ninguno agrega más de un par de minutos a la llamada.',
      bloques: [
        {
          tipo: 'etapas',
          items: MOMENTOS.map((m) => ({
            titulo: m.titulo,
            cuando: m.cuando,
            datos: [
              { rotulo: 'Objetivo legal', texto: m.objetivo },
              { rotulo: 'Qué tiene que pasar', texto: m.que },
              { rotulo: 'Frase ancla', texto: m.frase, estilo: 'frase' as const },
              { rotulo: 'Error típico', texto: m.error, estilo: 'error' as const },
            ],
          })),
        },
      ],
    },
    {
      id: 'despues',
      titulo: 'Después de la llamada',
      corto: 'Después de la llamada',
      intro: 'Lo que no queda por escrito dentro de las 24 horas, en la práctica, no existe para la defensa de la empresa.',
      bloques: [
        {
          tipo: 'tarjetas',
          items: [
            { titulo: 'Campos mínimos en el CRM', lista: CAMPOS_CRM, check: true },
            { titulo: 'Conservación del registro', leads: CONSERVACION },
          ],
        },
        {
          tipo: 'correo',
          titulo: 'Correo de confirmación',
          asunto: correo.asunto,
          cuerpo: correo.cuerpo,
          nota: 'El correo resume, no agrega. Si el closer quiere sumar algo que no está en el contrato, primero lo aprueba el líder comercial.',
        },
      ],
    },
    {
      id: 'guiones',
      titulo: 'Guiones por tema',
      corto: 'Guiones',
      intro:
        'Cada guion tiene una versión corta para el flujo normal y respuestas para cuando el prospecto pregunta más. Se pueden adaptar al estilo de cada closer siempre que no cambie el contenido.',
      bloques: [{ tipo: 'guiones', aria: 'Guiones por tema', items: construirGuiones(c) }],
    },
    {
      id: 'repaso',
      titulo: 'Repaso de cierre',
      corto: 'Repaso de cierre',
      intro:
        'Va después del sí comercial y antes de enviar el link de pago. Dura entre 60 y 90 segundos y en cada punto el closer espera un sí claro. Si aparece una duda, se resuelve antes de cobrar. Es la pieza de prueba más valiosa de toda la llamada.',
      bloques: [
        {
          tipo: 'repaso',
          apertura: REPASO_APERTURA,
          cierre: REPASO_CIERRE,
          items: repaso,
          listo: 'Repaso completo. Ahora sí, link de pago.',
          nota: 'Si el prospecto no aceptó el registro, este repaso se hace por escrito y se espera su respuesta antes de enviar el link.',
        },
      ],
    },
    {
      id: 'objeciones',
      titulo: 'Objeciones con contenido legal',
      corto: 'Objeciones',
      intro:
        'Las objeciones comerciales se trabajan con el guion de ventas de cada empresa. Estas son las que tocan temas legales y tienen una sola respuesta correcta.',
      bloques: [
        {
          tipo: 'acordeones',
          items: construirObjeciones(c).map((o) => ({
            titulo: o.pregunta,
            bloques: [
              { tipo: 'decir' as const, etiqueta: 'Respuesta modelo', texto: o.respuesta },
              ...(o.nota ? [{ tipo: 'nota' as const, etiqueta: 'Ojo', texto: o.nota }] : []),
            ],
          })),
        },
      ],
    },
    {
      id: 'frases',
      titulo: 'Frases prohibidas y su reemplazo',
      corto: 'Frases prohibidas',
      intro: 'No se trata de hablar como abogado. Se trata de no regalar promesas que después alguien tiene que pagar.',
      bloques: [
        {
          tipo: 'tabla',
          aria: 'Frases prohibidas y su reemplazo',
          columnas: [
            { rotulo: 'No digas', estilo: 'no' },
            { rotulo: 'Decí', estilo: 'si' },
            { rotulo: 'Por qué', estilo: 'porque' },
          ],
          filas: FRASES.map((x) => [x.no, x.si, x.porque]),
        },
      ],
    },
    {
      id: 'alertas',
      titulo: 'Alertas y escalamiento',
      corto: 'Alertas',
      intro: 'Ante estas señales el closer no improvisa. Aplica la acción indicada y avisa a quien corresponde antes de cobrar.',
      bloques: [
        {
          tipo: 'tabla',
          aria: 'Alertas y escalamiento',
          columnas: [
            { rotulo: 'Señal', estilo: 'senal' },
            { rotulo: 'Qué hacer' },
            { rotulo: 'Escalar a', ancho: '0.6fr', estilo: 'pastilla' },
          ],
          filas: ALERTAS.map((a) => [a.senal, a.accion, a.escalar]),
        },
        { tipo: 'subtitulo', texto: 'Reglas por nicho' },
        {
          tipo: 'acordeones',
          items: (Object.keys(NICHOS) as (keyof typeof NICHOS)[]).map((k) => ({
            titulo: NICHOS[k].titulo,
            abierto: c.nicho === k,
            destacado: c.nicho === k,
            insignia: c.nicho === k ? 'Nicho de este cliente' : undefined,
            bloques: [{ tipo: 'lista' as const, textos: NICHOS[k].reglas }],
          })),
        },
      ],
    },
    {
      id: 'calidad',
      titulo: 'Control de calidad',
      corto: 'Control de calidad',
      intro: 'El control se hace sobre el registro de la llamada y mide el servicio contratado. Los ítems críticos no admiten excepciones.',
      bloques: [
        {
          tipo: 'tarjetas',
          items: [
            { titulo: 'Muestra mínima', lista: MUESTRA },
            { titulo: 'Consecuencias', leads: CONSECUENCIAS },
          ],
        },
        {
          tipo: 'checklist',
          id: 'scorecard',
          titulo: 'Scorecard de la llamada',
          items: CONTROL.filter((it) => !(it.opcional && !c.usaReserva)).map(({ id, texto, critico }) => ({ id, texto, critico })),
        },
        { tipo: 'aclaracion', texto: NOTA_CONTROL },
      ],
    },
    {
      id: 'juridico',
      titulo: 'Anexo jurídico',
      corto: 'Anexo jurídico',
      intro:
        'Para la dirección de la empresa y el equipo legal. El equipo comercial no necesita leerlo, pero cada regla del protocolo se apoya en lo que sigue. Normativa revisada a octubre de 2026.',
      bloques: [{ tipo: 'juridico', items: JURIDICO.map((b) => ({ ...b, abierto: b.id === 'ajustes' })) }],
    },
    {
      id: 'tarjeta',
      titulo: 'Tarjeta de bolsillo',
      corto: 'Tarjeta de bolsillo',
      intro: 'Una página para tener abierta durante la llamada. El botón la imprime sola.',
      tarjeta: true,
      bloques: [
        {
          tipo: 'bolsillo',
          filas: [
            { rotulo: 'Al empezar', texto: '«Te cuento que la llamada queda registrada así tenemos respaldo de todo lo que hablemos. ¿Estás de acuerdo?»', tono: 'cita' },
            {
              rotulo: 'Tres nunca',
              tono: 'nunca',
              lista: ['Nunca prometas resultados ni ingresos.', 'Nunca digas algo que el contrato no dice.', 'Nunca tomes datos de tarjeta en la llamada.'],
            },
            {
              rotulo: `Antes del link de pago, ${repaso.length} síes`,
              numerada: true,
              lista: [
                'Precio total {precio} y modalidad elegida.',
                ...(c.usaCuotas ? ['Las cuotas pagan un precio total, no son una suscripción.'] : []),
                'Devoluciones, {politicaMini}.',
                'Los resultados dependen de la implementación.',
                ...(c.usaReserva ? ['Reserva de {reserva}, saldo en {saldoPlazo}.'] : []),
                'Contrato y términos por correo, leerlos antes de pagar.',
              ],
            },
            [
              { rotulo: 'Si dudás', texto: 'Escalá. Una venta postergada cuesta menos que un reclamo.' },
              { rotulo: 'Después', texto: 'Correo de confirmación y CRM dentro de las 24 horas.' },
            ],
          ],
        },
      ],
    },
  ];
}

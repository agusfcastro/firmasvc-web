// Catálogo de protocolos FIRMA. Archivo liviano, se importa desde App.tsx
// para resolver las rutas sin cargar el contenido de cada protocolo.

export interface EntradaCatalogo {
  ruta: string;
  area: string;
  titulo: string;
  bajada: string;
  capas: string[];
}

export const CATALOGO: EntradaCatalogo[] = [
  {
    ruta: '/protocolo-llamadas',
    area: 'Ventas',
    titulo: 'Comunicación legal en llamadas de venta',
    bajada: 'Qué decir, cómo decirlo y qué no decir nunca para que cada llamada registrada proteja la venta.',
    capas: ['Guiones por tema', 'Repaso de cierre', 'Scorecard de llamadas'],
  },
  {
    ruta: '/protocolo-conflictos',
    area: 'Clientes',
    titulo: 'Conflictos y pedidos de reembolso',
    bajada: 'Prevención, contención y gestión de reclamos, con compuerta legal y negociación basada en MAAN y ZOPA.',
    capas: ['Compuerta legal', 'Calculadora de negociación', 'Tablero de reclamos'],
  },
  {
    ruta: '/protocolo-onboarding',
    area: 'Clientes',
    titulo: 'Onboarding de clientes',
    bajada: 'De la firma al primer resultado, con accesos, bienvenida, reunión de inicio e hitos confirmados por escrito.',
    capas: ['Checklist de ingreso', 'Índice de salud de la cuenta', 'Hitos con constancia'],
  },
  {
    ruta: '/protocolo-cobranza',
    area: 'Finanzas',
    titulo: 'Cobranza y contracargos',
    bajada: 'Secuencia de cobro firme y amable, planes de pago y respuesta a disputas con prueba.',
    capas: ['Secuencia de cobro', 'Antigüedad de saldos', 'Paquete de prueba'],
  },
  {
    ruta: '/protocolo-reclutamiento',
    area: 'Equipo',
    titulo: 'Reclutamiento y selección',
    bajada: 'Del perfil del puesto a la oferta firmada, con entrevistas estructuradas, avisos sin sesgos y datos de candidatos bien cuidados.',
    capas: ['Rúbrica de entrevista', 'Embudo de selección', 'Preguntas prohibidas'],
  },
  {
    ruta: '/protocolo-equipo',
    area: 'Equipo',
    titulo: 'Gestión del equipo',
    bajada: 'Incorporación, rituales, comisiones, desempeño y salida ordenada, cuidando que la práctica coincida con el contrato.',
    capas: ['Semáforo de independencia', 'Simulador de comisiones', 'Responsables y rituales'],
  },
  {
    ruta: '/protocolo-marketing',
    area: 'Marketing',
    titulo: 'Marketing y publicidad',
    bajada: 'Piezas, testimonios, promociones y comunicaciones que venden sin prometer de más.',
    capas: ['Revisor de piezas', 'Métricas de adquisición', 'Testimonios autorizados'],
  },
  {
    ruta: '/protocolo-datos',
    area: 'Operaciones',
    titulo: 'Datos personales',
    bajada: 'Qué datos se piden, dónde viven, cuánto se guardan y cómo se responden los pedidos de sus titulares.',
    capas: ['Mapa de datos', 'Plazos de respuesta', 'Incidentes'],
  },
];

/** Rutas que resuelve el motor de protocolos, incluido el índice. */
export const RUTAS_MOTOR: string[] = ['/protocolos', ...CATALOGO.filter((c) => c.ruta !== '/protocolo-llamadas').map((c) => c.ruta)];

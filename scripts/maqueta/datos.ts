/**
 * Datos de prueba de la maqueta: una empresa inventada con 34 clientes, su equipo,
 * reuniones, cuotas y casos. Las fechas se arman desde hoy, así la captura siempre
 * se ve al día. Ningún dato es de un cliente real.
 */
type Fila = Record<string, unknown>;

const DIA = 86_400_000;
const hoy = new Date(new Date().toDateString()).getTime();
const iso = (t: number) => new Date(t).toISOString();
const dia = (t: number) => new Date(t).toISOString().slice(0, 10);
const sumarMeses = (t: number, n: number) => {
  const d = new Date(t);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
};

export const ORG = 'org-demo';

export const PERFIL = {
  id: 'usuario-demo',
  email: 'paula@empresademo.com',
  nombre: 'Paula Demo',
  rol: 'titular' as const,
  organizacion_id: ORG,
  areas: [] as string[],
  activo: true,
  creado_en: iso(hoy - 200 * DIA),
  ultimo_ingreso: iso(hoy),
};

const equipo = [
  { id: 'am-1', nombre: 'Martina Rossi', rol_comercial: 'account_manager' },
  { id: 'am-2', nombre: 'Tomás Ibarra', rol_comercial: 'account_manager' },
  { id: 'cl-1', nombre: 'Lucas Ferreyra', rol_comercial: 'closer' },
  { id: 'cl-2', nombre: 'Julieta Paz', rol_comercial: 'closer' },
  { id: 'se-1', nombre: 'Bruno Sosa', rol_comercial: 'setter' },
].map((m) => ({ ...m, organizacion_id: ORG, activo: true, email: null, usuario_id: null, cargo: null, creado_en: iso(hoy - 300 * DIA) }));

const servicios = [
  { clave: '3M', nombre: 'Programa 3 meses', duracion_meses: 3, monto: 1500 },
  { clave: '6M', nombre: 'Programa 6 meses', duracion_meses: 6, monto: 3000 },
  { clave: 'MENTORIA', nombre: 'Mentoría anual', duracion_meses: 12, monto: 6000 },
];

const NOMBRES = [
  'Valentina Castro', 'Martín Gómez', 'Lucía Fernández', 'Joaquín Morales', 'Sofía Ramírez', 'Diego Herrera', 'Camila Ortiz', 'Mateo Navarro',
  'Florencia Ruiz', 'Santiago Medina', 'Agustina Rojas', 'Nicolás Vega', 'Paula Sánchez', 'Federico Luna', 'Micaela Torres', 'Ignacio Díaz',
  'Rocío Álvarez', 'Facundo Molina', 'Julieta Romero', 'Tomás Acosta', 'Carolina Silva', 'Gonzalo Peralta', 'Victoria Suárez', 'Ezequiel Ríos',
  'Antonella Benítez', 'Leandro Cabrera', 'Milagros Sosa', 'Franco Giménez', 'Abril Herrera', 'Matías Paz', 'Delfina Castro', 'Emiliano Vera',
  'Catalina Muñoz', 'Lautaro Ponce',
];

const clientes: Fila[] = [];
const resumen: Fila[] = [];
const pagos: Fila[] = [];
const reuniones: Fila[] = [];
const casos: Fila[] = [];

NOMBRES.forEach((nombre, i) => {
  const id = `cli-${String(i + 1).padStart(2, '0')}`;
  const s = servicios[i % 5 === 4 ? 2 : i % 2 === 0 ? 0 : 1];
  const onboarding = hoy - (6 + i * 8) * DIA + 15 * 3600_000;
  const estado = i % 11 === 5 ? 'Baja' : i % 9 === 3 && i < 20 ? 'Pendiente' : i === 1 ? 'En firma' : 'Firmado';
  const cuotas = i % 3 === 0 ? 1 : s.duracion_meses >= 6 ? 3 : 2;
  const monto = s.monto;
  let cobrado = 0;
  let vencidas = 0;
  let proximo: string | null = null;
  let proximoMonto: number | null = null;
  let en30 = 0;
  for (let k = 0; k < cuotas; k++) {
    const vence = sumarMeses(onboarding, k);
    const valor = Math.round(monto / cuotas);
    const pasada = vence < hoy;
    const impaga = pasada && k > 0 && i % 5 === 2;
    const pagada = pasada && !impaga && estado !== 'Pendiente';
    if (pagada) cobrado += valor;
    if (impaga) vencidas++;
    if (!pagada && !pasada) {
      if (!proximo) {
        proximo = dia(vence);
        proximoMonto = valor;
      }
      if (vence - hoy < 30 * DIA) en30 += valor;
    }
    pagos.push({ id: `${id}-p${k}`, cliente_id: id, organizacion_id: ORG, monto: valor, vencimiento: dia(vence), estado: pagada ? 'pagado' : 'pendiente', fecha_pago: pagada ? dia(vence + (k ? 2 : 0) * DIA) : null, nota: null });
  }
  const am = i % 4 === 3 ? null : equipo[i % 2].id;
  const base = {
    id,
    organizacion_id: ORG,
    codigo: `ED-${String(i + 1).padStart(3, '0')}`,
    tipo: 'persona',
    nombre,
    dni: String(30_000_000 + i * 137_911),
    email: `${nombre.split(' ')[0].toLowerCase()}@ejemplo.com`,
    telefono: null,
    servicio: s.clave,
    monto_total: monto,
    moneda: 'USD',
    modalidad: cuotas === 1 ? 'PIF' : 'Cuotas',
    fecha_onboarding: iso(onboarding),
    estado_firma: estado,
    link_contrato_servicio: null,
    responsable: am ? null : i % 8 === 7 ? 'Martina (CSM)' : null,
    responsable_id: am,
    closer_id: equipo[2 + (i % 2)].id,
    setter_id: i % 3 === 1 ? 'se-1' : null,
    notas: null,
    plan_pagos_original: null,
    revisar_pagos: i === 13,
    creado_en: iso(onboarding - 2 * DIA),
    actualizado_en: iso(hoy - (i % 6) * DIA),
  };
  clientes.push(base);
  resumen.push({
    ...base,
    cobrado,
    pendiente: monto - cobrado,
    proximo_vencimiento: proximo,
    cuotas_vencidas: vencidas,
    cuotas_pactadas: cuotas,
    proxima_cuota_monto: proximoMonto,
    por_cobrar_30_dias: en30,
  });

  // Reuniones: la de onboarding y un seguimiento por mes; la próxima queda agendada.
  if (estado !== 'Pendiente') {
    const fin = sumarMeses(onboarding, s.duracion_meses);
    for (let n = 0; n < 8; n++) {
      const cuando = onboarding + (n === 0 ? 1 : n * 30) * DIA - 4 * 3600_000;
      if (cuando > fin) break;
      const pasada = cuando < Date.now();
      if (!pasada && (estado === 'Baja' || n > 0 && cuando - Date.now() > 40 * DIA)) break;
      reuniones.push({
        id: `${id}-r${n}`,
        organizacion_id: ORG,
        cliente_id: id,
        prospecto: null,
        titulo: null,
        tipo: n === 0 ? 'onboarding' : 'seguimiento',
        inicio: iso(cuando),
        duracion_min: 45,
        miembro_id: am,
        agendada_por: null,
        estado: pasada ? (i % 7 === 4 && n === 1 ? 'no_asistio' : 'realizada') : 'agendada',
        resultado: null,
        enlace: null,
        interaccion_id: null,
        notas: null,
        creado_por: null,
        creado_en: iso(cuando - 7 * DIA),
        actualizado_en: iso(cuando),
      });
      if (!pasada) break;
    }
  }

  // Casos de conflicto en algunos clientes, abiertos o ya cerrados.
  if ([0, 6, 12, 19, 25].includes(i) && onboarding + 35 * DIA < hoy) {
    const abierto = onboarding + (i === 0 ? 49 : 35 + (i % 9) * 3) * DIA;
    const cerrado = i === 12 || i === 25 ? abierto + 12 * DIA : null;
    casos.push({
      id: `${id}-c`,
      organizacion_id: ORG,
      cliente_id: id,
      abierto_en: iso(abierto),
      cerrado_en: cerrado ? iso(cerrado) : null,
      etapa: cerrado ? 'cerrado' : i === 19 ? 'legales' : 'disconformidad',
      semaforo: cerrado ? 'verde' : i === 19 ? 'rojo' : 'ambar',
      causa: (['expectativa', 'demora', 'promesa', 'cobro', 'encaje'] as const)[i % 5],
      canal: 'WhatsApp',
      monto_reclamado: null,
      contracargo: false,
      contracargo_resultado: null,
      derivado_legales: i === 19,
      decision: null,
      monto_concedido: 0,
      responsable: null,
      notas: null,
      creado_por: null,
      creado_en: iso(abierto),
      actualizado_en: iso(cerrado ?? abierto),
    });
  }
});

export const DATOS: Record<string, Fila[]> = {
  organizaciones: [{ id: ORG, nombre: 'Empresa Demo', plan: 'eminent', logo_url: null, monedas: ['USD'] }],
  avisos: [{ id: 'av-1', usuario_id: PERFIL.id, titulo: 'Firmaron un documento', cuerpo: 'Contrato de Valentina Castro', url: '/portal/firmas', leido_en: null, creado_en: iso(hoy - 2 * 3600_000) }],
  asuntos: [{ id: 'as-1', organizacion_id: ORG, estado: 'espera_cliente' }],
  firma_sobres: [
    { id: 'fs-1', organizacion_id: ORG, estado: 'en_curso', crm_cliente_id: 'cli-02', creado_en: iso(hoy - DIA) },
    { id: 'fs-2', organizacion_id: ORG, estado: 'en_curso', crm_cliente_id: null, creado_en: iso(hoy - 3 * DIA) },
  ],
  documentos: [],
  equipo_miembros: equipo,
  crm_servicios: servicios.map((s, i) => ({ id: `sv-${i}`, organizacion_id: ORG, clave: s.clave, nombre: s.nombre, duracion_meses: s.duracion_meses, activo: true, moneda: 'USD' })),
  crm_clientes: clientes,
  crm_clientes_resumen: resumen,
  crm_pagos: pagos,
  crm_reuniones: reuniones,
  crm_casos: casos,
};

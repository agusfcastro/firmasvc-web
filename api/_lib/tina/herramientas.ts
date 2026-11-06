/**
 * Herramientas de Tina. Se ejecutan en el servidor y cada una verifica
 * permisos antes de actuar, aunque el modelo la haya llamado:
 *
 *   buscar_recurso       Material de la biblioteca marcado para Tina y los
 *                        protocolos del sitio. Lee con el token del usuario,
 *                        así solo ve lo que ve en el portal.
 *   consultar_contrato   Cláusulas de los contratos que el usuario ve.
 *   crear_ficha_cierre   Carga un cliente en el CRM, solo con confirmado.
 *   registrar_evento     Novedad para el resumen diario.
 *   crear_ticket         Derivación al responsable de FIRMA. Solo Eminent:
 *                        acá en el código y, además, en la base (0060).
 *
 * El modelo recibe texto (JSON). Lo que el portal muestra como tarjeta
 * va aparte, en `pantalla`.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { unzipSync, strFromU8 } from 'fflate';
import { CATALOGO } from '../../../components/protocolos/rutas.js';
import { enviarMail, plantillaMail } from '../mail.js';

export interface Sesion {
  usuarioId: string;
  rol: string;
  areas: string[];
  nombre: string;
  orgId: string;
  orgNombre: string;
  plan: 'starter' | 'eminent';
  conversacionId: string;
  /** Con el token del usuario: pasa por las políticas. */
  db: SupabaseClient;
  /** Clave de servicio: solo después de verificar permisos. */
  sb: SupabaseClient;
  responsable: { id: string; nombre: string; email: string; telefono: string | null } | null;
  base: string;
}

export interface Resultado {
  /** Lo que lee el modelo. */
  modelo: string;
  error?: boolean;
  /** Lo que el portal muestra como tarjeta, si corresponde. */
  pantalla?: Record<string, unknown>;
}

const ROLES_CRM = ['titular', 'csm', 'closer', 'miembro'];

// ---------------------------------------------------------------------
// Definiciones para la API
// ---------------------------------------------------------------------
const TIPOS_RECURSO = ['sop', 'mensaje_modelo', 'video', 'clausula', 'guia', 'contexto'];
const TIPOS_EVENTO = ['onboarding', 'reagendamiento', 'caso', 'conflicto', 'firma', 'cuota'];
const CATEGORIAS = ['reembolso_contracargo', 'cliente_enojado', 'documento_nuevo', 'interpretacion_clausula', 'societario', 'otra_jurisdiccion', 'facturacion', 'otro'];

export function definiciones(plan: 'starter' | 'eminent'): Anthropic.Beta.BetaTool[] {
  const tools: Anthropic.Beta.BetaTool[] = [
    {
      name: 'buscar_recurso',
      description:
        'Busca material precargado de FIRMA para el cliente: SOPs, mensajes modelo, videos, guías y protocolos. Devuelve hasta cinco resultados con su enlace y un extracto. Usala antes de responder con un recurso, y citá la fuente.',
      eager_input_streaming: true,
      input_schema: {
        type: 'object',
        properties: {
          consulta: { type: 'string', description: 'Qué se busca, en pocas palabras. Por ejemplo, «mensaje para cuota atrasada».' },
          tipo: { type: 'string', enum: TIPOS_RECURSO, description: 'Opcional. Limita la búsqueda a un tipo de material.' },
        },
        required: ['consulta'],
        additionalProperties: false,
      },
    },
    {
      name: 'consultar_contrato',
      description:
        'Lee los contratos del cliente (modelos de sus servicios, contratos firmados cargados y el contrato con FIRMA) y devuelve las cláusulas que mejor responden la consulta, con el nombre del documento. Usala para citar una cláusula; nunca inventes el texto de un contrato.',
      eager_input_streaming: true,
      input_schema: {
        type: 'object',
        properties: {
          consulta: { type: 'string', description: 'Tema de la cláusula. Por ejemplo, «plazo para pedir reembolso» o «intereses por mora».' },
          documento: { type: 'string', description: 'Opcional. Parte del nombre del contrato, si el usuario lo mencionó.' },
        },
        required: ['consulta'],
        additionalProperties: false,
      },
    },
    {
      name: 'crear_ficha_cierre',
      description:
        'Carga en el CRM al cliente de una venta cerrada. Primero llamala con confirmado en false: devuelve el resumen y lo que falta, sin guardar nada. Mostrale el resumen al usuario y, solo si confirma, llamala de nuevo con confirmado en true y los mismos datos. Devuelve el código y el enlace a la ficha.',
      eager_input_streaming: true,
      input_schema: {
        type: 'object',
        properties: {
          confirmado: { type: 'boolean', description: 'true solo después de que el usuario confirmó el resumen.' },
          nombre: { type: 'string', description: 'Nombre y apellido del cliente, o razón social.' },
          email: { type: 'string' },
          telefono: { type: 'string' },
          dni: { type: 'string', description: 'DNI o documento de identidad.' },
          domicilio: { type: 'string' },
          servicio: { type: 'string', description: 'Nombre o código del servicio que compró.' },
          monto_total: { type: 'number', description: 'Monto total acordado.' },
          moneda: { type: 'string', enum: ['USD', 'ARS', 'EUR', 'PEN', 'MXN', 'CLP', 'COP'] },
          modalidad: { type: 'string', enum: ['PIF', 'Cuotas'], description: 'PIF es pago completo.' },
          cuotas: {
            type: 'array',
            description: 'Plan de pagos, si es en cuotas. Cada cuota con su monto y su vencimiento (AAAA-MM-DD).',
            items: {
              type: 'object',
              properties: { monto: { type: 'number' }, vencimiento: { type: 'string' } },
              required: ['monto', 'vencimiento'],
              additionalProperties: false,
            },
          },
          fecha_onboarding: { type: 'string', description: 'Fecha y hora del onboarding, AAAA-MM-DD HH:MM, hora de Argentina.' },
          notas: { type: 'string' },
        },
        required: ['confirmado', 'nombre'],
        additionalProperties: false,
      },
    },
    {
      name: 'registrar_evento',
      description:
        'Registra en el portal una novedad del negocio para que aparezca en el resumen diario: un onboarding, un reagendamiento, un cambio en un caso o un conflicto, una firma o una cuota. Confirmá en una línea después de usarla.',
      eager_input_streaming: true,
      input_schema: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: TIPOS_EVENTO },
          fecha: { type: 'string', description: 'Cuándo es o fue, AAAA-MM-DD HH:MM o AAAA-MM-DD, hora de Argentina.' },
          titulo: { type: 'string', description: 'Una línea, por ejemplo «Auditoría pasa del jueves al lunes».' },
          detalle: { type: 'string' },
          cliente: { type: 'string', description: 'Opcional. Código o nombre del cliente del CRM.' },
          avisar_responsable: { type: 'boolean', description: 'true si el responsable de ese cliente tiene que enterarse.' },
        },
        required: ['tipo', 'fecha', 'titulo'],
        additionalProperties: false,
      },
    },
  ];
  if (plan === 'eminent') {
    tools.push({
      name: 'crear_ticket',
      description:
        'Deriva el tema al responsable de FIRMA. Usala en los casos que el prompt indica derivar. Antes juntá la información necesaria. Prioridad alta solo si es urgente (amenaza, escrache, plazo que vence hoy).',
      eager_input_streaming: true,
      input_schema: {
        type: 'object',
        properties: {
          prioridad: { type: 'string', enum: ['baja', 'media', 'alta'] },
          categoria: { type: 'string', enum: CATEGORIAS },
          resumen: { type: 'string', description: 'Qué pasó, qué pide el cliente y qué información ya hay. Sin datos personales que no hagan falta.' },
        },
        required: ['prioridad', 'categoria', 'resumen'],
        additionalProperties: false,
      },
    });
  }
  return tools;
}

// ---------------------------------------------------------------------
// Validación de lo que manda el modelo
// ---------------------------------------------------------------------
type Entrada = Record<string, unknown>;

const texto = (v: unknown, max = 2000): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const opcion = <T extends string>(v: unknown, opciones: readonly T[]): T | null => (typeof v === 'string' && (opciones as readonly string[]).includes(v) ? (v as T) : null);

function invalido(motivo: string): Resultado {
  return { modelo: JSON.stringify({ error: motivo }), error: true };
}

// ---------------------------------------------------------------------
// Búsqueda de texto
// ---------------------------------------------------------------------
const normalizar = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function palabrasDe(consulta: string): string[] {
  const vacias = new Set(['para', 'como', 'cual', 'cuales', 'cuando', 'donde', 'tiene', 'tengo', 'puedo', 'sobre', 'entre', 'desde', 'hasta', 'esta', 'este', 'esto', 'que']);
  return [...new Set(normalizar(consulta).split(/[^a-z0-9ñ]+/).filter((p) => p.length >= 4 && !vacias.has(p)))];
}

function puntaje(textoBuscado: string, palabras: string[]): number {
  const t = normalizar(textoBuscado);
  let p = 0;
  for (const w of palabras) {
    // Raíz de la palabra, así «reembolsos» encuentra «reembolso».
    const raiz = w.length > 6 ? w.slice(0, w.length - 2) : w;
    let i = t.indexOf(raiz);
    while (i >= 0) {
      p++;
      i = t.indexOf(raiz, i + raiz.length);
    }
  }
  return p;
}

function parrafos(t: string): string[] {
  return t
    .split(/\n\s*\n|\n(?=\s*(?:\d+[.)]|[A-ZÁÉÍÓÚ]{3,}|cl[aá]usula|art[ií]culo)\b)/i)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 20);
}

function mejoresParrafos(t: string, palabras: string[], cuantos: number, max = 1200): string[] {
  return parrafos(t)
    .map((p, i) => ({ p, i, s: puntaje(p, palabras) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, cuantos)
    .map((x) => (x.p.length > max ? `${x.p.slice(0, max)}…` : x.p));
}

/** Texto de un .docx: los párrafos de word/document.xml. */
function textoDeDocx(datos: Uint8Array): string {
  const archivos = unzipSync(datos, { filter: (f) => f.name === 'word/document.xml' });
  const xml = archivos['word/document.xml'];
  if (!xml) return '';
  return strFromU8(xml)
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<\/w:p>/g, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface FilaDocumento {
  id: string;
  titulo: string;
  descripcion: string | null;
  seccion: string;
  tina_tipo: string | null;
  tina_plan_minimo: string;
  tina_texto: string | null;
  url: string | null;
  archivo_ruta: string | null;
  archivo_nombre: string | null;
}

/**
 * Texto que Tina lee de un documento. Si falta y el archivo es Word, lo
 * extrae una vez y lo guarda en tina_texto. Los PDF necesitan que FIRMA
 * cargue el texto a mano por ahora.
 */
async function textoDelDocumento(s: Sesion, d: FilaDocumento): Promise<string | null> {
  if (d.tina_texto) return d.tina_texto;
  if (!d.archivo_ruta || !/\.docx$/i.test(d.archivo_ruta)) return null;
  const { data, error } = await s.sb.storage.from('documentos').download(d.archivo_ruta);
  if (error || !data) return null;
  try {
    const t = textoDeDocx(new Uint8Array(await data.arrayBuffer()));
    if (!t) return null;
    await s.sb.from('documentos').update({ tina_texto: t }).eq('id', d.id);
    return t;
  } catch {
    return null;
  }
}

const COLUMNAS_DOC = 'id, titulo, descripcion, seccion, tina_tipo, tina_plan_minimo, tina_texto, url, archivo_ruta, archivo_nombre';

function enlaceDocumento(s: Sesion, d: FilaDocumento): string {
  return d.url && /^https:\/\//.test(d.url) ? d.url : `${s.base}/portal/documentos`;
}

// ---------------------------------------------------------------------
// buscar_recurso
// ---------------------------------------------------------------------
async function buscarRecurso(s: Sesion, e: Entrada): Promise<Resultado> {
  const consulta = texto(e.consulta, 300);
  if (!consulta) return invalido('Falta la consulta.');
  const tipo = e.tipo === undefined ? null : opcion(e.tipo, TIPOS_RECURSO);
  if (e.tipo !== undefined && !tipo) return invalido('Tipo de recurso desconocido.');
  const palabras = palabrasDe(consulta);
  if (!palabras.length) return invalido('La consulta es muy corta. Usá palabras más específicas.');

  let q = s.db.from('documentos').select(COLUMNAS_DOC).eq('activo', true).eq('tina_usa', true);
  if (tipo) q = q.eq('tina_tipo', tipo);
  if (s.plan === 'starter') q = q.eq('tina_plan_minimo', 'starter');
  const { data } = await q.limit(200);
  const docs = (data ?? []) as FilaDocumento[];

  const candidatos: { titulo: string; tipo: string; enlace: string; extracto: string; s: number }[] = [];
  for (const d of docs) {
    const cuerpo = (await textoDelDocumento(s, d)) ?? '';
    const sc = puntaje(d.titulo, palabras) * 3 + puntaje(d.descripcion ?? '', palabras) * 2 + puntaje(cuerpo, palabras);
    if (sc > 0) {
      const extracto = mejoresParrafos(cuerpo, palabras, 2).join('\n\n') || d.descripcion || '';
      candidatos.push({ titulo: d.titulo, tipo: d.tina_tipo ?? 'documento', enlace: enlaceDocumento(s, d), extracto, s: sc });
    }
  }
  if (!tipo || tipo === 'guia' || tipo === 'sop') {
    for (const p of CATALOGO) {
      const sc = puntaje(`${p.titulo} ${p.titulo}`, palabras) + puntaje(`${p.bajada} ${p.area} ${p.capas.join(' ')}`, palabras);
      if (sc > 0) candidatos.push({ titulo: `Protocolo · ${p.titulo}`, tipo: 'protocolo', enlace: `${s.base}${p.ruta}`, extracto: p.bajada, s: sc });
    }
  }
  const resultados = candidatos.sort((a, b) => b.s - a.s).slice(0, 5).map(({ s: _s, ...r }) => r);
  return {
    modelo: JSON.stringify(resultados.length ? { resultados } : { resultados: [], nota: 'No hay material cargado sobre esto.' }),
  };
}

// ---------------------------------------------------------------------
// consultar_contrato
// ---------------------------------------------------------------------
async function consultarContrato(s: Sesion, e: Entrada): Promise<Resultado> {
  const consulta = texto(e.consulta, 300);
  if (!consulta) return invalido('Falta la consulta.');
  const documento = texto(e.documento, 120);
  const palabras = palabrasDe(consulta);
  if (!palabras.length) return invalido('La consulta es muy corta. Usá palabras más específicas.');

  // Contratos: la sección de contratos de servicio y lo marcado como cláusula, que el usuario ve.
  const { data } = await s.db.from('documentos').select(COLUMNAS_DOC).eq('activo', true).or('seccion.eq.servicio,tina_tipo.eq.clausula').limit(60);
  let docs = (data ?? []) as FilaDocumento[];
  if (documento) {
    const filtrados = docs.filter((d) => normalizar(d.titulo).includes(normalizar(documento)));
    if (filtrados.length) docs = filtrados;
  }
  if (!docs.length) return { modelo: JSON.stringify({ clausulas: [], nota: 'El usuario no tiene contratos cargados en el portal.' }) };

  const clausulas: { documento: string; texto: string; s: number }[] = [];
  const sinTexto: string[] = [];
  for (const d of docs.slice(0, 15)) {
    const cuerpo = await textoDelDocumento(s, d);
    if (!cuerpo) {
      sinTexto.push(d.titulo);
      continue;
    }
    for (const p of mejoresParrafos(cuerpo, palabras, 3, 1500)) clausulas.push({ documento: d.titulo, texto: p, s: puntaje(p, palabras) });
  }
  const mejores = clausulas.sort((a, b) => b.s - a.s).slice(0, 6).map(({ s: _s, ...c }) => c);
  return {
    modelo: JSON.stringify({
      clausulas: mejores,
      ...(mejores.length ? {} : { nota: 'No encontré una cláusula sobre esto en los contratos que tienen texto cargado.' }),
      ...(sinTexto.length ? { contratos_sin_texto: sinTexto } : {}),
    }),
  };
}

// ---------------------------------------------------------------------
// crear_ficha_cierre
// ---------------------------------------------------------------------
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?$/;

/** AAAA-MM-DD [HH:MM] en hora de Argentina, a ISO. */
function fechaArgentina(v: string): string | null {
  const m = FECHA_HORA.exec(v.trim());
  if (!m) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(`${m[1]}T${m[2] ?? '12'}:${m[3] ?? '00'}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const puedeMandarAFirmar = (s: Sesion): boolean => s.rol === 'titular' || s.areas.some((a) => a === 'legales' || a === 'operaciones');

async function crearFichaCierre(s: Sesion, e: Entrada): Promise<Resultado> {
  if (!ROLES_CRM.includes(s.rol)) return invalido('Tu rol no carga clientes en el CRM. Pedíselo al titular de tu empresa.');
  if (typeof e.confirmado !== 'boolean') return invalido('Falta confirmado.');
  const nombre = texto(e.nombre, 160);
  if (!nombre) return invalido('Falta el nombre del cliente.');
  const email = texto(e.email, 200);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return invalido('El mail no es válido.');
  const moneda = e.moneda === undefined ? 'USD' : opcion(e.moneda, ['USD', 'ARS', 'EUR', 'PEN', 'MXN', 'CLP', 'COP'] as const);
  if (!moneda) return invalido('Moneda desconocida.');
  const modalidad = e.modalidad === undefined ? null : opcion(e.modalidad, ['PIF', 'Cuotas'] as const);
  const montoTotal = numero(e.monto_total);
  const cuotas: { monto: number; vencimiento: string }[] = [];
  if (e.cuotas !== undefined) {
    if (!Array.isArray(e.cuotas) || e.cuotas.length > 36) return invalido('Las cuotas no tienen el formato esperado.');
    for (const c of e.cuotas as Entrada[]) {
      const monto = numero(c?.monto);
      const venc = texto(c?.vencimiento, 10);
      if (monto === null || !venc || !FECHA.test(venc)) return invalido('Cada cuota lleva monto y vencimiento AAAA-MM-DD.');
      cuotas.push({ monto, vencimiento: venc });
    }
  }
  const fechaOnb = texto(e.fecha_onboarding, 40);
  const onboarding = fechaOnb ? fechaArgentina(fechaOnb) : null;
  if (fechaOnb && !onboarding) return invalido('La fecha de onboarding no se entiende. Usá AAAA-MM-DD HH:MM.');

  // Servicio: tiene que ser uno de los que carga la empresa.
  const { data: servs } = await s.db.from('crm_servicios').select('clave, nombre, precio').eq('organizacion_id', s.orgId).eq('activo', true);
  const servicios = (servs ?? []) as { clave: string; nombre: string | null; precio: number | null }[];
  const pedido = texto(e.servicio, 120);
  const servicio = pedido ? servicios.find((x) => normalizar(x.clave) === normalizar(pedido) || normalizar(x.nombre ?? '') === normalizar(pedido)) ?? servicios.find((x) => normalizar(x.nombre ?? x.clave).includes(normalizar(pedido))) : undefined;

  const datos = {
    nombre,
    email,
    telefono: texto(e.telefono, 40),
    dni: texto(e.dni, 30),
    domicilio: texto(e.domicilio, 300),
    servicio: servicio?.clave ?? null,
    monto_total: montoTotal ?? servicio?.precio ?? null,
    moneda,
    modalidad: modalidad ?? (cuotas.length > 1 ? 'Cuotas' : cuotas.length === 1 ? 'PIF' : null),
    fecha_onboarding: onboarding,
    notas: texto(e.notas, 1000),
  };
  const faltan = (
    [
      ['email', 'mail'],
      ['telefono', 'teléfono'],
      ['dni', 'DNI'],
      ['domicilio', 'domicilio'],
      ['servicio', 'servicio'],
      ['monto_total', 'monto total'],
      ['modalidad', 'modalidad de pago'],
    ] as const
  )
    .filter(([k]) => datos[k] === null)
    .map(([, rotulo]) => rotulo);
  const sumaCuotas = cuotas.reduce((t, c) => t + c.monto, 0);
  const avisos: string[] = [];
  if (pedido && !servicio) avisos.push(`El servicio «${pedido}» no está en la lista de la empresa.`);
  if (cuotas.length && datos.monto_total !== null && Math.abs(sumaCuotas - datos.monto_total) > 0.01) avisos.push('La suma de las cuotas no coincide con el monto total.');

  const resumen = { ...datos, cuotas, servicios_disponibles: servicios.map((x) => x.nombre || x.clave), faltan, avisos };

  if (!e.confirmado) {
    return {
      modelo: JSON.stringify({ guardado: false, resumen, instruccion: 'Mostrale este resumen al usuario y preguntale si lo cargás. No lo cargues sin su confirmación.' }),
      pantalla: { tipo: 'ficha', estado: 'borrador', resumen },
    };
  }

  // Un cliente con el mismo mail en la empresa no se duplica.
  if (email) {
    const { data: existe } = await s.db.from('crm_clientes').select('id, codigo').eq('organizacion_id', s.orgId).ilike('email', email).limit(1).maybeSingle();
    if (existe) {
      return {
        modelo: JSON.stringify({ guardado: false, motivo: 'Ya hay un cliente con ese mail.', codigo: existe.codigo, enlace: `${s.base}/portal/crm/${existe.id}` }),
      };
    }
  }

  const { data: creado, error } = await s.db
    .from('crm_clientes')
    .insert({
      organizacion_id: s.orgId,
      nombre: datos.nombre,
      email: datos.email,
      telefono: datos.telefono,
      dni: datos.dni,
      domicilio: datos.domicilio,
      servicio: datos.servicio,
      monto_total: datos.monto_total,
      moneda: datos.moneda,
      modalidad: datos.modalidad ?? 'Cuotas',
      fecha_onboarding: datos.fecha_onboarding,
      notas: datos.notas,
      origen: 'tina',
    })
    .select('id, codigo')
    .single();
  if (error || !creado) return invalido(`No se pudo cargar el cliente. ${error?.message ?? ''}`.trim());

  let planCargado = true;
  if (cuotas.length) {
    const { error: e2 } = await s.db
      .from('crm_pagos')
      .insert(cuotas.map((c) => ({ cliente_id: creado.id, organizacion_id: s.orgId, monto: c.monto, vencimiento: c.vencimiento, estado: 'pendiente' })));
    planCargado = !e2;
  }
  const enlace = `${s.base}/portal/crm/${creado.id}`;
  const firma = puedeMandarAFirmar(s);
  return {
    modelo: JSON.stringify({
      guardado: true,
      codigo: creado.codigo,
      enlace,
      plan_de_pagos: cuotas.length ? (planCargado ? 'cargado' : 'no se pudo cargar, que lo carguen en la ficha') : 'sin cuotas',
      puede_mandar_a_firmar: firma,
      siguiente_paso: firma
        ? 'Desde la ficha genera el contrato y lo manda con «Mandar a firmar».'
        : 'El contrato lo manda a firmar el titular o el área de Legales u Operaciones de la empresa.',
    }),
    pantalla: { tipo: 'ficha', estado: 'cargada', codigo: creado.codigo, enlace, resumen },
  };
}

// ---------------------------------------------------------------------
// registrar_evento
// ---------------------------------------------------------------------
async function registrarEvento(s: Sesion, e: Entrada): Promise<Resultado> {
  const tipo = opcion(e.tipo, TIPOS_EVENTO);
  if (!tipo) return invalido('Tipo de evento desconocido.');
  const titulo = texto(e.titulo, 200);
  if (!titulo) return invalido('Falta el título.');
  const fechaTxt = texto(e.fecha, 40);
  const fecha = fechaTxt ? fechaArgentina(fechaTxt) : null;
  if (!fecha) return invalido('La fecha no se entiende. Usá AAAA-MM-DD HH:MM.');

  const { data: visible } = await s.db.rpc('evento_visible', { org: s.orgId, tipo });
  if (visible !== true) return invalido('Tu rol no registra este tipo de novedad.');

  let cliente: { id: string; responsable_id: string | null } | null = null;
  const buscado = texto(e.cliente, 160);
  if (buscado) {
    const { data: porCodigo } = await s.db.from('crm_clientes').select('id, responsable_id, nombre, codigo').eq('organizacion_id', s.orgId).ilike('codigo', buscado).limit(2);
    let filas = (porCodigo ?? []) as { id: string; responsable_id: string | null; nombre: string; codigo: string }[];
    if (!filas.length) {
      const { data: porNombre } = await s.db.from('crm_clientes').select('id, responsable_id, nombre, codigo').eq('organizacion_id', s.orgId).ilike('nombre', `%${buscado.replace(/[%_]/g, '')}%`).limit(5);
      filas = (porNombre ?? []) as typeof filas;
    }
    if (filas.length > 1) return invalido(`Hay más de un cliente que coincide: ${filas.map((f) => `${f.nombre} (${f.codigo})`).join(', ')}. Preguntá cuál es.`);
    if (!filas.length) return invalido('No encontré a ese cliente en el CRM.');
    cliente = filas[0];
  }

  const avisar = e.avisar_responsable === true;
  const { error } = await s.sb.from('eventos_cliente').insert({
    organizacion_id: s.orgId,
    tipo,
    fecha,
    titulo,
    detalle: texto(e.detalle, 1000),
    cliente_id: cliente?.id ?? null,
    responsable_id: avisar ? cliente?.responsable_id ?? null : null,
    avisar_responsable: avisar,
    origen: 'tina',
    creado_por: s.usuarioId,
  });
  if (error) return invalido(`No se pudo registrar. ${error.message}`);
  return { modelo: JSON.stringify({ registrado: true, aviso_al_responsable: avisar && Boolean(cliente?.responsable_id) }) };
}

// ---------------------------------------------------------------------
// crear_ticket
// ---------------------------------------------------------------------
/** Fin del siguiente día hábil, en hora de Argentina. */
function siguienteDiaHabil(ahora = new Date()): string {
  const ar = new Date(ahora.getTime() - 3 * 3600_000);
  const d = new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()));
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return new Date(d.getTime() + (23 * 60 + 59) * 60_000 + 3 * 3600_000).toISOString();
}

async function crearTicket(s: Sesion, e: Entrada): Promise<Resultado> {
  if (s.plan !== 'eminent') return invalido('Las derivaciones son solo para el plan Eminent. Ofrecé la hora semanal de consultoría o una consulta aparte.');
  const prioridad = opcion(e.prioridad, ['baja', 'media', 'alta'] as const);
  const categoria = opcion(e.categoria, CATEGORIAS);
  const resumen = texto(e.resumen, 3000);
  if (!prioridad || !categoria || !resumen) return invalido('Faltan la prioridad, la categoría o el resumen.');

  const vence = prioridad === 'alta' ? new Date(Date.now() + 4 * 3600_000).toISOString() : siguienteDiaHabil();
  const { data, error } = await s.sb
    .from('tina_tickets')
    .insert({ organizacion_id: s.orgId, conversacion_id: s.conversacionId, creado_por: s.usuarioId, prioridad, categoria, resumen, vence_en: vence })
    .select('id')
    .single();
  if (error || !data) return invalido(`No se pudo crear la derivación. ${error?.message ?? ''}`.trim());

  if (prioridad === 'alta') {
    const destino = s.responsable?.email || 'agustin@firmasvc.com';
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await enviarMail({
      nombreRemitente: 'Tina · FIRMA',
      para: [destino],
      asunto: `Derivación urgente de ${s.orgNombre}`,
      direccion: process.env.PORTAL_MAIL_DIRECCION || 'portal@firmasvc.com',
      html: plantillaMail({
        seccion: 'Tina',
        titulo: 'Derivación urgente.',
        resalte: 'urgente',
        parrafos: [`${esc(s.nombre)}, de ${esc(s.orgNombre)}, necesita una respuesta hoy. Tina abrió la derivación con este resumen.`],
        cita: esc(resumen).replace(/\n/g, '<br>'),
        datos: [
          { rotulo: 'Categoría', valor: esc(categoria.replace(/_/g, ' ')) },
          { rotulo: 'Vence', valor: esc(new Date(vence).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })) },
        ],
        boton: { texto: 'Abrir el portal', url: `${s.base}/portal` },
      }),
    }).catch(() => null);
  }

  return {
    modelo: JSON.stringify({
      creado: true,
      prioridad,
      plazo: prioridad === 'alta' ? 'en las próximas horas' : 'dentro del día hábil',
      ...(prioridad === 'alta' && s.responsable?.telefono ? { telefono_responsable: s.responsable.telefono } : {}),
    }),
  };
}

// ---------------------------------------------------------------------
export const CAMINO_DE: Record<string, 'recurso' | 'derivacion' | undefined> = {
  buscar_recurso: 'recurso',
  consultar_contrato: 'recurso',
  crear_ticket: 'derivacion',
};

export async function ejecutar(s: Sesion, nombre: string, entrada: unknown): Promise<Resultado> {
  const e = entrada && typeof entrada === 'object' && !Array.isArray(entrada) ? (entrada as Entrada) : null;
  if (!e) return { modelo: JSON.stringify({ INVALID_JSON: JSON.stringify(entrada) }), error: true };
  try {
    switch (nombre) {
      case 'buscar_recurso':
        return await buscarRecurso(s, e);
      case 'consultar_contrato':
        return await consultarContrato(s, e);
      case 'crear_ficha_cierre':
        return await crearFichaCierre(s, e);
      case 'registrar_evento':
        return await registrarEvento(s, e);
      case 'crear_ticket':
        return await crearTicket(s, e);
      default:
        return invalido(`La herramienta ${nombre} no existe.`);
    }
  } catch (err) {
    return invalido(`Falló la herramienta. ${(err as Error).message}`);
  }
}

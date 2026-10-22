/**
 * Activa el abono de una empresa con dLocal Go, mensual o trimestral (Vercel Function).
 * Corre en el servidor con la clave service role y las claves de dLocal Go,
 * que nunca llegan al navegador ni quedan en el registro.
 * La tarjeta se carga siempre en la página segura de dLocal Go.
 *
 * GET  /api/pagos/activar
 *   Responde { dlocalgo, entorno } con dLocal Go listo para cobrar o no y el
 *   entorno, sandbox o produccion. Requiere sesión. Nunca devuelve claves.
 *
 * GET  /api/pagos/activar?diagnostico=1   (solo FIRMA)
 *   Prueba la conexión con dLocal Go paso por paso: leer planes y crear un
 *   plan mínimo al que se le suma un dato por paso hasta llegar a la forma
 *   de los del portal, así el primer paso que falla señala el dato. Cada
 *   plan de prueba se desactiva enseguida. Responde el resultado de cada paso
 *   con lo que contestó dLocal Go, sin claves, y lo deja en el registro.
 *
 * POST /api/pagos/activar  { abono_id, acepto: true, monto? }
 *   Deja constancia de la aceptación del débito, crea el plan del
 *   abono en dLocal Go si todavía no existe y responde { url } con el enlace
 *   de suscripción del plan con el mail del pagador.
 *   Lo pide el titular de la empresa del abono o FIRMA. monto, si viene, es
 *   el que vio la persona y tiene que coincidir con el del abono.
 *   Si el plan ya tiene una suscripción vigente no da otro enlace, así nadie
 *   se suscribe dos veces. Actualiza el estado y responde 409 con actualizar.
 */
import { createHmac } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* ================================================================== */
/* Bloque común de pagos con dLocal Go                                  */
/* Es una copia idéntica en api/pagos/activar.ts, api/pagos/gestionar.ts */
/* y api/pagos/dlocalgo.ts, porque cada función de Vercel tiene que ser */
/* autocontenida. Si cambia en una, se cambia igual en las tres.        */
/* Lo marcado «verificar en sandbox» es un supuesto sobre la API de     */
/* dLocal Go que hay que confirmar con las credenciales de prueba.      */
/* ================================================================== */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA_MS = 86_400_000;

type EstadoPago = 'aprobado' | 'rechazado' | 'reintegrado' | 'pendiente';

interface Abono {
  id: string;
  organizacion_id: string;
  concepto: string;
  monto: number | string;
  moneda: 'ARS' | 'USD';
  /** Vacío en dólares: el checkout de dLocal Go le pregunta el país al cliente. */
  pais: string | null;
  /** Cada cuántos meses se cobra: 1 o 3. */
  periodo_meses?: number | null;
  estado: string;
  email_pagador: string;
  plan_id: string | null;
  plan_token: string | null;
  suscripcion_id: string | null;
  proximo_cobro: string | null;
  cancelado_en: string | null;
}

interface Resultado<T> {
  ok: boolean;
  status: number;
  datos: T | null;
  error: string;
}

/** Plan de dLocal Go. */
interface Plan {
  id?: number | string | null;
  plan_token?: string | null;
  active?: boolean | null;
  free_trial_days?: number | string | null;
}

/** Suscripción de un plan. */
interface Suscripcion {
  id?: number | string | null;
  status?: string | null;
  active?: boolean | null;
  scheduled_date?: string | null;
  created_at?: string | null;
}

/** Cobro (execution) de una suscripción. */
interface Cobro {
  id?: number | string | null;
  status?: string | null;
  order_id?: string | null;
  merchant_checkout_id?: string | null;
  currency?: string | null;
  amount_paid?: number | string | null;
  amount_received?: number | string | null;
  checkout_currency?: string | null;
  balance_currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface FilaPago {
  abono_id: string;
  organizacion_id: string;
  cobro_id: string;
  monto_pagado: number | null;
  monto_recibido: number | null;
  moneda: string;
  moneda_cobro: string | null;
  estado: EstadoPago;
  fecha: string;
  detalle: Record<string, unknown>;
}

interface Quien {
  id: string;
  rol: string;
  organizacion_id: string | null;
}

/** Resultado de una sincronización. ok en false si dLocal Go no respondió. plan en null si no existe. */
interface Sincronizado {
  ok: boolean;
  status: number;
  error: string;
  abono: Abono;
  plan: Plan | null;
  vigente: Suscripcion | null;
  nuevos: number;
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function error(mensaje: string, status = 400): Response {
  return json({ error: mensaje }, status);
}

function clienteServicio(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Sandbox salvo que DLOCALGO_ENTORNO diga produccion, así nadie cobra de verdad por error. */
function entorno(): 'sandbox' | 'produccion' {
  const v = (process.env.DLOCALGO_ENTORNO || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return v === 'produccion' || v === 'production' ? 'produccion' : 'sandbox';
}

function baseApi(): string {
  return entorno() === 'produccion' ? 'https://api.dlocalgo.com' : 'https://api-sbx.dlocalgo.com';
}

/** Enlace de suscripción al plan, con el mail del pagador. */
function enlace(planToken: string, email: string): string {
  const base = entorno() === 'produccion' ? 'https://checkout.dlocalgo.com' : 'https://checkout-sbx.dlocalgo.com';
  return `${base}/validate/subscription/${encodeURIComponent(planToken)}?email=${encodeURIComponent(email)}`;
}

/** Variables que faltan para cobrar. Se nombran, nunca se muestran sus valores. */
function faltantes(): string[] {
  return ['DLOCALGO_API_KEY', 'DLOCALGO_SECRET_KEY'].filter((n) => !process.env[n]);
}

/** Dirección del portal para las vueltas y los avisos. Va con www, el dominio sin www redirige. */
function baseDe(request: Request): string {
  return (process.env.PORTAL_URL || new URL(request.url).origin).replace(/\/$/, '');
}

/** Saca de un texto cualquier clave antes de devolverlo o registrarlo. */
function sinClaves(texto: string): string {
  let t = texto;
  for (const n of ['DLOCALGO_API_KEY', 'DLOCALGO_SECRET_KEY', 'DLOCALGO_CLAVE_AVISOS', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const v = process.env[n];
    if (v && v.length >= 8) t = t.split(v).join('[clave]');
  }
  return t.replace(/clave=[^&\s"']+/gi, 'clave=[clave]').replace(/\b[0-9a-f]{64}\b/gi, '[clave]');
}

/** Mensaje de un error de dLocal Go, sin claves. La forma del cuerpo de error es un supuesto, verificar en sandbox. */
function mensajeDlocal(j: unknown): string {
  if (!j || typeof j !== 'object') return '';
  const o = j as Record<string, unknown>;
  const anidado = o.error && typeof o.error === 'object' ? (o.error as Record<string, unknown>).message : o.error;
  const errores = Array.isArray(o.errors)
    ? o.errors
        .map((e) => (typeof e === 'string' ? e : ((e as Record<string, unknown>)?.message ?? (e as Record<string, unknown>)?.description)))
        .filter(Boolean)
        .join('. ')
    : '';
  const m = o.message || anidado || o.description || errores || '';
  const texto = typeof m === 'string' ? m : JSON.stringify(m);
  return sinClaves(texto).replace(/\s*:\s+/g, ', ').replace(/\s+[-–—]\s+/g, ', ').slice(0, 200);
}

/** Pedido a la API de dLocal Go. Las claves viajan solo en el header. */
async function dlocal<T>(metodo: 'GET' | 'POST' | 'PATCH', ruta: string, cuerpo?: unknown): Promise<Resultado<T>> {
  try {
    const r = await fetch(`${baseApi()}${ruta}`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${process.env.DLOCALGO_API_KEY}:${process.env.DLOCALGO_SECRET_KEY}`,
        'content-type': 'application/json',
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json().catch(() => null)) as unknown;
    if (!r.ok) return { ok: false, status: r.status, datos: null, error: mensajeDlocal(j) };
    return { ok: true, status: r.status, datos: j as T, error: '' };
  } catch {
    return { ok: false, status: 0, datos: null, error: '' };
  }
}

function falloDlocal(r: { status: number; error: string }, que: string): Response {
  if (!r.status) return error('dLocal Go no respondió. Probá de nuevo en unos minutos.', 502);
  return error(`dLocal Go no pudo ${que} (${r.status}). ${r.error}`.trim(), 502);
}

/** Las listas de dLocal Go pueden venir sueltas o dentro de data. Verificar en sandbox. */
function lista<T>(j: unknown): T[] {
  if (Array.isArray(j)) return j as T[];
  if (j && typeof j === 'object') {
    for (const k of ['data', 'content', 'results', 'items']) {
      const v = (j as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

function idDe(x: { id?: number | string | null } | null | undefined): string {
  return x && x.id !== undefined && x.id !== null ? String(x.id) : '';
}

function rutaPlan(planId: string): string {
  return `/v1/subscription/plan/${encodeURIComponent(planId)}`;
}

/** Suscripción vigente, ACTIVE o active true sin distinguir mayúsculas. Estados supuestos, verificar en sandbox. */
const SUSCRIPCION_TERMINADA = ['CANCELLED', 'CANCELED', 'INACTIVE', 'DEACTIVATED', 'EXPIRED', 'FINISHED', 'ENDED', 'REJECTED', 'DECLINED', 'FAILED'];
function suscripcionVigente(s: Suscripcion): boolean {
  const st = String(s?.status ?? '').trim().toUpperCase();
  if (SUSCRIPCION_TERMINADA.includes(st) || s?.active === false) return false;
  return st === 'ACTIVE' || s?.active === true;
}

/** Estado de un cobro, sin distinguir mayúsculas. Valores supuestos, verificar en sandbox. Los desconocidos no se guardan. */
function estadoCobro(s: unknown): EstadoPago | null {
  switch (String(s ?? '').trim().toUpperCase()) {
    case 'PAID':
    case 'APPROVED':
    case 'COMPLETED':
      return 'aprobado';
    case 'REJECTED':
    case 'DECLINED':
    case 'FAILED':
      return 'rechazado';
    case 'REFUNDED':
    case 'CHARGEBACK':
      return 'reintegrado';
    case 'PENDING':
      return 'pendiente';
    default:
      return null;
  }
}

/** Fecha de dLocal Go en ISO. Una fecha sin hora se toma al mediodía de Buenos Aires, así no cambia de día. */
function fechaIso(v: unknown): string | null {
  if (typeof v === 'number' || (typeof v === 'string' && /^\d{10,13}$/.test(v.trim()))) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? new Date(n > 1e12 ? n : n * 1000).toISOString() : null;
  }
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim();
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00-03:00` : s);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function importe(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function codigoMoneda(v: unknown): string | null {
  const s = String(v ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : null;
}

/** Clave del aviso de cada abono, HMAC SHA256 del id con DLOCALGO_CLAVE_AVISOS o, si no está, con la clave service role. */
function claveAviso(abonoId: string): string | null {
  const secreto = process.env.DLOCALGO_CLAVE_AVISOS || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secreto ? createHmac('sha256', secreto).update(abonoId).digest('hex') : null;
}

/** notification_url propia del abono. dLocal Go no firma sus avisos, por eso cada plan lleva su clave. */
/**
 * Dirección de aviso de un plan, sin parámetros: dLocal Go responde 500 si la
 * notification_url lleva ?abono=…&clave=…. vercel.json la lleva a
 * /api/pagos/dlocalgo con esos mismos parámetros.
 */
function urlAviso(base: string, abonoId: string): string {
  return `${base}/api/pagos/aviso/${encodeURIComponent(abonoId)}/${claveAviso(abonoId) ?? ''}`;
}

async function quienLlama(sb: SupabaseClient, request: Request): Promise<Quien | Response> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data, error: errUsuario } = await sb.auth.getUser(token);
  if (errUsuario || !data?.user) return error('Sesión inválida o vencida.', 401);
  const { data: perfil } = await sb.from('perfiles').select('rol, activo, organizacion_id').eq('id', data.user.id).maybeSingle();
  if (!perfil || !perfil.activo) return error('Tu cuenta no está habilitada.', 403);
  return { id: data.user.id, rol: perfil.rol, organizacion_id: perfil.organizacion_id };
}

/** Deja el movimiento en el registro de actividad que lee el panel. Nunca guarda claves. */
async function registrar(sb: SupabaseClient, accion: string, abono: Abono, extra: Record<string, unknown> = {}, actor: string | null = null) {
  const { data: org } = await sb.from('organizaciones').select('nombre').eq('id', abono.organizacion_id).maybeSingle();
  const empresa = (org?.nombre as string | undefined) ?? 'Empresa';
  await sb.from('registro_accesos').insert({
    usuario_id: null,
    actor_id: actor,
    accion,
    detalle: {
      abono_id: abono.id,
      organizacion_id: abono.organizacion_id,
      empresa,
      titulo: `${empresa} · ${abono.concepto} · ${abono.moneda} ${Number(abono.monto)}`,
      concepto: abono.concepto,
      monto: Number(abono.monto),
      moneda: abono.moneda,
      pais: abono.pais,
      procesador: 'dlocalgo',
      ...extra,
    },
  });
}

/**
 * Días que quedan del período ya pagado. Cuando el titular se vuelve a
 * suscribir, por ejemplo para cambiar el medio de pago, el plan los da sin
 * cobro, así el primer débito nuevo cae cuando vence lo pagado y nadie paga
 * dos veces el mismo período. Verificar en sandbox que free_trial_days corra el
 * primer cobro de las suscripciones nuevas.
 */
async function diasYaPagados(sb: SupabaseClient, abono: Abono): Promise<number> {
  const resto = (abono.proximo_cobro ? Date.parse(abono.proximo_cobro) : NaN) - Date.now();
  if (!(resto > 0)) return 0;
  const { data: ultimo } = await sb.from('abono_pagos').select('estado').eq('abono_id', abono.id).order('fecha', { ascending: false }).limit(1).maybeSingle();
  const tope = 31 * (abono.periodo_meses === 3 ? 3 : 1);
  return ultimo?.estado === 'aprobado' ? Math.min(tope, Math.ceil(resto / DIA_MS)) : 0;
}

/** Deja los días sin cobro del plan en el valor pedido. Verificar en sandbox que el PATCH del plan los acepte. */
async function ajustarDiasSinCobro(plan: Plan | null, planId: string, dias: number): Promise<Resultado<unknown>> {
  if (Number(plan?.free_trial_days ?? 0) === dias) return { ok: true, status: 200, datos: null, error: '' };
  return dlocal('PATCH', rutaPlan(planId), { free_trial_days: dias });
}

/** Desde qué estados puede pasar un pago a cada estado. Un pago aprobado nunca vuelve atrás. */
const DESDE: Record<EstadoPago, EstadoPago[]> = {
  pendiente: [],
  rechazado: ['pendiente'],
  aprobado: ['pendiente', 'rechazado'],
  reintegrado: ['pendiente', 'rechazado', 'aprobado'],
};

/** Alta o cambio de un pago. El movimiento se registra solo cuando el pago es nuevo o cambia de estado. */
async function guardarPago(sb: SupabaseClient, abono: Abono, fila: FilaPago): Promise<boolean> {
  const { data: alta, error: e1 } = await sb.from('abono_pagos').upsert(fila, { onConflict: 'cobro_id', ignoreDuplicates: true }).select('id');
  if (e1) throw new Error(e1.message);
  let cambio = (alta?.length ?? 0) > 0;
  if (!cambio && DESDE[fila.estado].length) {
    const { data: act, error: e2 } = await sb
      .from('abono_pagos')
      .update({ estado: fila.estado, monto_pagado: fila.monto_pagado, monto_recibido: fila.monto_recibido, moneda_cobro: fila.moneda_cobro, fecha: fila.fecha, detalle: fila.detalle })
      .eq('cobro_id', fila.cobro_id)
      .eq('abono_id', abono.id)
      .in('estado', DESDE[fila.estado])
      .select('id');
    if (e2) throw new Error(e2.message);
    cambio = (act?.length ?? 0) > 0;
  }
  if (cambio && fila.estado !== 'pendiente') {
    await registrar(sb, `abono_pago_${fila.estado}`, abono, { cobro: fila.cobro_id, fecha_pago: fila.fecha, monto_pagado: fila.monto_pagado, moneda_cobro: fila.moneda_cobro });
  }
  return cambio;
}

/** Fila de abono_pagos para un cobro. Montos y monedas según el cliente oficial, verificar en sandbox. */
function filaDeCobro(abono: Abono, sub: Suscripcion, c: Cobro): FilaPago | null {
  const estado = estadoCobro(c?.status);
  if (!estado || !idDe(c)) return null;
  return {
    abono_id: abono.id,
    organizacion_id: abono.organizacion_id,
    cobro_id: idDe(c),
    monto_pagado: importe(c.amount_paid),
    monto_recibido: importe(c.amount_received),
    moneda: codigoMoneda(c.currency) ?? abono.moneda,
    moneda_cobro: codigoMoneda(c.checkout_currency),
    estado,
    fecha: fechaIso(c.created_at) ?? fechaIso(c.updated_at) ?? new Date().toISOString(),
    detalle: {
      procesador: 'dlocalgo',
      suscripcion_id: idDe(sub),
      estado_dlocal: c.status ?? null,
      order_id: c.order_id ?? null,
      checkout_id: c.merchant_checkout_id ?? null,
      moneda_saldo: codigoMoneda(c.balance_currency),
    },
  };
}

const ACCION_ESTADO: Record<string, string> = {
  activo: 'abono_activado',
  con_error: 'abono_con_error',
  cancelado: 'abono_cancelado',
  pausado: 'abono_pausado',
};

/**
 * Aplica los cambios al abono y registra el movimiento solo si cambió el
 * estado. Un abono dado de baja no vuelve atrás, aunque una sincronización
 * que empezó antes de la baja termine después.
 */
async function actualizarAbono(sb: SupabaseClient, abono: Abono, cambios: Record<string, unknown> & { estado: string }, extra: Record<string, unknown> = {}): Promise<void> {
  const excluidos = cambios.estado === 'cancelado' ? '(cancelado)' : `(${cambios.estado},cancelado)`;
  const { data, error: e1 } = await sb.from('abonos').update(cambios).eq('id', abono.id).not('estado', 'in', excluidos).select('id');
  if (e1) throw new Error(e1.message);
  if ((data?.length ?? 0) > 0) {
    const accion = ACCION_ESTADO[cambios.estado];
    if (accion) await registrar(sb, accion, abono, { estado_anterior: abono.estado, ...extra });
    return;
  }
  // Mismo estado. Se escribe solo lo que cambió, así un aviso repetido no toca el abono.
  const { estado: _mismo, ...resto } = cambios;
  const igual = (a: unknown, b: unknown) => a === b || (typeof a === 'string' && typeof b === 'string' && /^\d{4}-/.test(a) && Date.parse(a) === Date.parse(b));
  const distintos = Object.fromEntries(Object.entries(resto).filter(([k, v]) => !igual((abono as unknown as Record<string, unknown>)[k], v)));
  if (Object.keys(distintos).length) {
    const { error: e2 } = await sb.from('abonos').update(distintos).eq('id', abono.id).eq('estado', cambios.estado);
    if (e2) throw new Error(e2.message);
  }
}

/**
 * Deja el abono como está en dLocal Go, la única fuente de verdad. Los avisos
 * solo la disparan. Consulta el plan, sus suscripciones y los cobros de cada
 * una, guarda los cobros sin duplicarlos y toma la suscripción vigente para
 * el estado y el próximo cobro. Si hay dos vigentes queda la más nueva y la
 * otra se da de baja, para no cobrar dos veces. Un abono dado de baja no se
 * reactiva y sus suscripciones vigentes se dan de baja.
 */
async function sincronizar(sb: SupabaseClient, abono: Abono): Promise<Sincronizado> {
  const res: Sincronizado = { ok: true, status: 200, error: '', abono, plan: null, vigente: null, nuevos: 0 };
  if (!abono.plan_id) return res;
  const fallo = (r: Resultado<unknown>): Sincronizado => ({ ...res, ok: false, status: r.status, error: r.error });
  const ruta = rutaPlan(abono.plan_id);

  const p = await dlocal<Plan>('GET', ruta);
  if (!p.ok && p.status !== 404) return fallo(p);
  res.plan = p.ok ? (p.datos ?? {}) : null;
  const s = await dlocal<unknown>('GET', `${ruta}/subscription/all`);
  if (!s.ok && s.status !== 404) return fallo(s);
  const fecha = (x: Suscripcion) => Date.parse(x.created_at ?? '') || 0;
  const subs = lista<Suscripcion>(s.datos)
    .filter((x) => idDe(x))
    .sort((a, b) => fecha(b) - fecha(a) || Number(idDe(b)) - Number(idDe(a)) || 0);

  // Cobros de cada suscripción, también de las que ya no están vigentes. La más nueva primero.
  const ultimo = new Map<string, EstadoPago>();
  for (const sub of subs.slice(0, 10)) {
    const c = await dlocal<unknown>('GET', `${ruta}/subscription/${encodeURIComponent(idDe(sub))}/execution/all`);
    if (!c.ok && c.status !== 404) return fallo(c);
    const filas = lista<Cobro>(c.datos)
      .map((x) => filaDeCobro(abono, sub, x))
      .filter((f): f is FilaPago => f !== null)
      .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
    if (filas[0]) ultimo.set(idDe(sub), filas[0].estado);
    for (const f of filas) if (await guardarPago(sb, abono, f)) res.nuevos++;
  }

  const cancelado = abono.estado === 'cancelado';
  const vigentes = subs.filter(suscripcionVigente);
  const actual = cancelado ? null : (vigentes[0] ?? null);
  // Dos suscripciones vigentes cobrarían dos veces, y un abono de baja no cobra más.
  for (const otra of vigentes.filter((v) => v !== actual)) {
    const r = await dlocal('PATCH', `${ruta}/subscription/${encodeURIComponent(idDe(otra))}/deactivate`);
    if (r.ok || r.status === 404) await registrar(sb, 'abono_duplicado', abono, { suscripcion: idDe(otra), queda: actual ? idDe(actual) : null });
  }
  if (cancelado) {
    // Si en la baja el plan quedó activo, se vuelve a intentar desactivarlo.
    if (res.plan?.active === true) await dlocal('PATCH', `${ruta}/deactivate`);
    return res;
  }

  let cambios: Record<string, unknown> & { estado: string };
  if (actual) {
    res.vigente = actual;
    // Rechazado el último cobro, problema de cobro. Con el primer cobro en proceso, sigue confirmando.
    const ult = ultimo.get(idDe(actual));
    cambios = {
      estado: ult === 'rechazado' ? 'con_error' : ult === 'pendiente' && abono.estado === 'pendiente' ? 'pendiente' : 'activo',
      suscripcion_id: idDe(actual),
      proximo_cobro: fechaIso(actual.scheduled_date),
    };
  } else if (res.plan?.active === false) {
    // Plan desactivado desde el panel de dLocal Go y sin suscripciones. Es una baja.
    cambios = { estado: 'cancelado', suscripcion_id: null, proximo_cobro: null, cancelado_en: new Date().toISOString() };
  } else if (abono.estado === 'activo' || abono.estado === 'con_error' || abono.estado === 'pausado') {
    // La suscripción terminó sin una baja del portal. El titular puede volver a suscribirse.
    cambios = { estado: 'con_error', suscripcion_id: null, proximo_cobro: null };
  } else {
    // Pendiente, sigue esperando que el titular se suscriba.
    return res;
  }
  await actualizarAbono(sb, abono, cambios, actual ? { suscripcion: idDe(actual), estado_dlocal: actual.status ?? null } : {});
  const { data: leido } = await sb.from('abonos').select('*').eq('id', abono.id).maybeSingle<Abono>();
  res.abono = leido ?? ({ ...abono, ...cambios } as Abono);
  return res;
}

/* ================================================================== */
/* Fin del bloque común                                                 */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/* Plan del abono                                                       */
/* ------------------------------------------------------------------ */

/**
 * Crea el plan del abono en dLocal Go, mensual o cada 3 meses, con la moneda
 * y el monto del abono, el aviso propio y las vueltas al portal. En pesos el
 * plan es de Argentina. En dólares va sin país y el checkout se lo pregunta al
 * cliente, como indica la documentación de dLocal Go. Se guarda solo si
 * las condiciones siguen iguales y nadie creó otro plan en el medio. Si no,
 * este plan se desactiva.
 */
/** Países que dLocal Go habilita por defecto. */
const PAISES_DLOCALGO = ['AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'EC', 'GT', 'ID', 'MX', 'MY', 'PE', 'PY', 'UY'];

/** País de la empresa si dLocal Go cobra ahí. Si no, Argentina. */
async function paisDeEmpresa(sb: SupabaseClient, organizacionId: string): Promise<string> {
  const { data } = await sb.from('organizaciones').select('pais').eq('id', organizacionId).maybeSingle();
  const pais = String(data?.pais ?? '').toUpperCase();
  return PAISES_DLOCALGO.includes(pais) ? pais : 'AR';
}

async function crearPlan(sb: SupabaseClient, abono: Abono, empresa: string, base: string, actor: string): Promise<Response> {
  const volver = `${base}/portal/pagos?abono=${abono.id}`;
  const cuerpoPlan = (pais: string | null) => ({
    name: `FIRMA · ${empresa} · ${abono.concepto}`.slice(0, 150),
    description: abono.concepto,
    ...(pais ? { country: pais } : {}),
    currency: abono.moneda,
    amount: Number(abono.monto),
    // Mensual o trimestral. Verificar en sandbox que MONTHLY con frequency_value 3 cobre cada 3 meses.
    frequency_type: 'MONTHLY',
    frequency_value: abono.periodo_meses === 3 ? 3 : 1,
    notification_url: urlAviso(base, abono.id),
    success_url: `${volver}&volver=dlocalgo`,
    error_url: `${volver}&volver=dlocalgo&error=1`,
    back_url: `${volver}&cancelado=1`,
  });
  let pais = abono.pais;
  let r = await dlocal<Plan>('POST', '/v1/subscription/plan', cuerpoPlan(pais));
  // Sin país dLocal Go puede responder 500, aunque su documentación lo permite en dólares.
  // Se reintenta una vez con el país de la empresa: el plan sale igual y el checkout no pregunta el país.
  if (!r.ok && r.status >= 500 && !pais) {
    await registrar(sb, 'abono_error', abono, { etapa: 'plan_sin_pais', status: r.status, mensaje: `${r.error} Se reintenta con el país de la empresa.` }, actor);
    pais = await paisDeEmpresa(sb, abono.organizacion_id);
    r = await dlocal<Plan>('POST', '/v1/subscription/plan', cuerpoPlan(pais));
  }
  const id = idDe(r.datos);
  const token = typeof r.datos?.plan_token === 'string' ? r.datos.plan_token : '';
  if (!r.ok || !id || !token) {
    const detalle = r.ok ? 'No devolvió el plan con su token.' : r.error;
    await registrar(sb, 'abono_error', abono, { etapa: 'plan', status: r.status, mensaje: detalle }, actor);
    if (id) await dlocal('PATCH', `${rutaPlan(id)}/deactivate`);
    return falloDlocal({ status: r.status, error: detalle }, 'crear el plan del abono');
  }

  const condiciones = sb
    .from('abonos')
    .update({ plan_id: id, plan_token: token, estado: 'pendiente', ...(pais !== abono.pais ? { pais } : {}) })
    .eq('id', abono.id)
    .is('plan_id', null)
    .eq('estado', abono.estado)
    .eq('monto', Number(abono.monto))
    .eq('moneda', abono.moneda)
    .eq('periodo_meses', abono.periodo_meses === 3 ? 3 : 1);
  const { data: guardado, error: errGuardar } = await (abono.pais ? condiciones.eq('pais', abono.pais) : condiciones.is('pais', null)).select('id');
  if (errGuardar || !guardado?.length) {
    await dlocal('PATCH', `${rutaPlan(id)}/deactivate`);
    if (errGuardar) return error('No se pudo guardar el plan. Probá de nuevo.', 500);
    return error('Las condiciones del abono cambiaron mientras se activaba. Recargá la página y volvé a intentar.', 409);
  }
  return json({ url: enlace(token, abono.email_pagador) });
}

/* ------------------------------------------------------------------ */
/* Rutas                                                                */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Diagnóstico de la conexión con dLocal Go                             */
/* ------------------------------------------------------------------ */
interface PasoDiagnostico {
  paso: string;
  ok: boolean;
  status: number;
  respuesta: string;
}

/** Un pedido a dLocal Go que devuelve el estado y el comienzo de la respuesta, sin claves. */
async function probar(metodo: 'GET' | 'POST' | 'PATCH', ruta: string, cuerpo?: unknown): Promise<{ status: number; texto: string; json: unknown }> {
  try {
    const r = await fetch(`${baseApi()}${ruta}`, {
      method: metodo,
      headers: {
        authorization: `Bearer ${process.env.DLOCALGO_API_KEY}:${process.env.DLOCALGO_SECRET_KEY}`,
        'content-type': 'application/json',
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15000),
    });
    const texto = await r.text().catch(() => '');
    let j: unknown = null;
    try {
      j = JSON.parse(texto);
    } catch {
      /* respuesta que no es JSON */
    }
    return { status: r.status, texto: sinClaves(texto).replace(/\s+/g, ' ').slice(0, 300), json: j };
  } catch (e) {
    return { status: 0, texto: `Sin conexión con dLocal Go. ${(e as Error).message}`.slice(0, 300), json: null };
  }
}

async function diagnostico(sb: SupabaseClient, actor: string, base: string): Promise<Response> {
  const faltan = faltantes();
  if (faltan.length) return json({ entorno: entorno(), api: baseApi(), pasos: [{ paso: 'Variables en Vercel', ok: false, status: 0, respuesta: `Faltan ${faltan.join(', ')}.` }] });
  const pasos: PasoDiagnostico[] = [];
  const anotar = (paso: string, r: { status: number; texto: string }) => {
    const ok = r.status >= 200 && r.status < 300;
    pasos.push({ paso, ok, status: r.status, respuesta: r.texto || (ok ? 'Sin cuerpo.' : 'dLocal Go no explicó el error.') });
    return ok;
  };
  const desactivar = async (r: { json: unknown }) => {
    const id = idDe(r.json as { id?: number | string | null } | null);
    if (id) await probar('PATCH', `${rutaPlan(id)}/deactivate`);
  };

  // 1. Las claves y el entorno coinciden: leer planes no crea nada.
  const lista = await probar('GET', '/v1/subscription/plan/all');
  const conectado = anotar('1. Leer planes (claves y entorno)', lista);

  // 2 a 6. Se parte de un plan mínimo y se agrega un dato por paso: el primero que falla es el culpable.
  const prueba = '00000000-0000-0000-0000-000000000000';
  const volver = `${base}/portal/pagos?abono=${prueba}`;
  const minimo = { name: 'FIRMA prueba de conexion', description: 'Prueba', country: 'AR', currency: 'USD', amount: 10, frequency_type: 'MONTHLY', frequency_value: 1 };
  const variantes: [string, Record<string, unknown>][] = [
    ['2. Plan mínimo (USD 10, Argentina, mensual)', minimo],
    ['3. Más el nombre con «·»', { ...minimo, name: 'FIRMA · Prueba · Plan del portal' }],
    ['4. Más las direcciones de vuelta', { ...minimo, success_url: `${volver}&volver=dlocalgo`, error_url: `${volver}&volver=dlocalgo&error=1`, back_url: `${volver}&cancelado=1` }],
    ['5. Más la dirección de aviso nueva, sin parámetros', { ...minimo, notification_url: urlAviso(base, prueba) }],
    ['5b. Dirección de aviso vieja, con ?abono=…&clave=…', { ...minimo, notification_url: `${base}/api/pagos/dlocalgo?abono=${prueba}&clave=${claveAviso(prueba) ?? ''}` }],
    ['5c. Dirección de aviso sin nada', { ...minimo, notification_url: `${base}/api/pagos/dlocalgo` }],
    ['6. Sin país', (({ country: _sinPais, ...resto }) => resto)(minimo)],
    ['7. Como los del portal, con todo', {
      name: 'FIRMA · Prueba · Plan del portal',
      description: 'Plan del portal',
      currency: 'USD',
      amount: 10,
      frequency_type: 'MONTHLY',
      frequency_value: 1,
      notification_url: urlAviso(base, prueba),
      success_url: `${volver}&volver=dlocalgo`,
      error_url: `${volver}&volver=dlocalgo&error=1`,
      back_url: `${volver}&cancelado=1`,
    }],
  ];
  for (const [paso, cuerpo] of variantes) {
    const r = await probar('POST', '/v1/subscription/plan', cuerpo);
    anotar(paso, r);
    await desactivar(r);
  }

  await sb.from('registro_accesos').insert({
    usuario_id: null,
    actor_id: actor,
    accion: 'dlocal_diagnostico',
    detalle: { entorno: entorno(), conectado, pasos: pasos.map((p) => ({ paso: p.paso, status: p.status, respuesta: p.respuesta.slice(0, 200) })) },
  });
  return json({ entorno: entorno(), api: baseApi(), pasos });
}

export async function GET(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);
  const quien = await quienLlama(sb, request);
  if (quien instanceof Response) return quien;
  if (new URL(request.url).searchParams.get('diagnostico') === '1') {
    if (quien.rol !== 'admin') return error('Solo FIRMA puede probar la conexión.', 403);
    return diagnostico(sb, quien.id, baseDe(request));
  }
  return json({ dlocalgo: faltantes().length === 0, entorno: entorno() });
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);

  // 1. Quién llama. Solo titulares y FIRMA.
  const quien = await quienLlama(sb, request);
  if (quien instanceof Response) return quien;
  const esAdmin = quien.rol === 'admin';
  if (!esAdmin && quien.rol !== 'titular') return error('Solo el titular de la empresa puede activar el abono.', 403);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error('Pedido mal formado.');
  }
  const abonoId = String(cuerpo?.abono_id || '');
  if (!UUID.test(abonoId)) return error('Falta el abono.');
  if (cuerpo.acepto !== true) return error('Para continuar tenés que aceptar el débito.');

  // 2. El abono tiene que ser de su empresa y estar sin activar.
  const { data: abono } = await sb.from('abonos').select('*').eq('id', abonoId).maybeSingle<Abono>();
  if (!abono) return error('No existe ese abono.', 404);
  if (!esAdmin && quien.organizacion_id !== abono.organizacion_id) return error('No tenés acceso a este abono.', 403);
  const { data: org } = await sb.from('organizaciones').select('id, nombre, activa').eq('id', abono.organizacion_id).maybeSingle();
  if (!org || (!esAdmin && !org.activa)) return error('La empresa no está activa.', 403);
  if (abono.estado === 'activo' || abono.estado === 'pausado') return error('El abono ya está activo.', 409);
  if (abono.estado === 'cancelado') return error('El abono está dado de baja. Si querés retomarlo, escribinos.', 409);
  if (cuerpo.monto !== undefined && Math.abs(Number(cuerpo.monto) - Number(abono.monto)) > 0.004) {
    return error('Las condiciones del abono cambiaron. Recargá la página para verlas antes de aceptar.', 409);
  }

  // 3. dLocal Go tiene que estar configurado.
  const faltan = faltantes();
  if (faltan.length) return json({ error: 'El pago con dLocal Go no está disponible por ahora.', ...(esAdmin ? { faltan } : {}) }, 503);

  // 4. Con el plan ya creado, primero el estado real. Con una suscripción vigente no se da otro enlace.
  let sinc: Sincronizado | null = null;
  if (abono.plan_id) {
    try {
      sinc = await sincronizar(sb, abono);
    } catch {
      return error('No se pudo consultar el estado del abono. Probá de nuevo.', 500);
    }
    if (!sinc.ok) return falloDlocal(sinc, 'informar el estado del abono');
    if (!sinc.plan) {
      return json({ error: `El plan de este abono no existe en dLocal Go. ${esAdmin ? 'Puede ser que hayan cambiado las credenciales o el entorno. Dalo de baja y armá uno nuevo.' : 'Escribinos y lo resolvemos.'}`, actualizar: true }, 409);
    }
    if (sinc.abono.estado === 'cancelado') return json({ error: 'El abono quedó dado de baja en dLocal Go. Si querés retomarlo, escribinos.', actualizar: true }, 409);
    if (sinc.vigente) return json({ error: 'Ya tenés una suscripción vigente en dLocal Go. Actualizamos el estado.', actualizar: true }, 409);
  }
  const actual = sinc?.abono ?? abono;

  // 5. Constancia de la aceptación, antes de ir a dLocal Go.
  const aceptadoEn = new Date().toISOString();
  const { error: errAceptar } = await sb.from('abonos').update({ aceptado_en: aceptadoEn, aceptado_por: quien.id }).eq('id', abono.id);
  if (errAceptar) return error('No se pudo registrar la aceptación. Probá de nuevo.', 500);
  await registrar(sb, 'abono_aceptado', actual, { aceptado_en: aceptadoEn, aceptado_por: quien.id, periodicidad: actual.periodo_meses === 3 ? 'trimestral' : 'mensual' }, quien.id);

  // 6. Plan del abono y enlace de suscripción con el mail del pagador.
  const base = baseDe(request);
  if (!abono.plan_id || !abono.plan_token) return crearPlan(sb, abono, String(org.nombre ?? 'Empresa'), base, quien.id);

  // Lo ya pagado no se vuelve a cobrar. El plan da esos días sin cobro a la suscripción nueva.
  const dias = await diasYaPagados(sb, actual);
  const ajuste = await ajustarDiasSinCobro(sinc?.plan ?? null, abono.plan_id, dias);
  if (!ajuste.ok) {
    await registrar(sb, 'abono_error', actual, { etapa: 'activacion', status: ajuste.status, mensaje: ajuste.error }, quien.id);
    return falloDlocal(ajuste, 'preparar el plan del abono');
  }
  if (actual.estado !== 'pendiente') await sb.from('abonos').update({ estado: 'pendiente' }).eq('id', abono.id).eq('estado', actual.estado);
  return json({ url: enlace(abono.plan_token, abono.email_pagador), existente: true, ...(dias ? { dias_sin_cobro: dias } : {}) });
}

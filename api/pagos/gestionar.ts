/**
 * Gestión de un abono con dLocal Go (Vercel Function).
 * Corre en el servidor con las claves de dLocal Go, que nunca llegan al
 * navegador ni quedan en el registro.
 *
 * POST /api/pagos/gestionar  { abono_id, accion }
 *   Lo pide el titular de la empresa del abono o FIRMA.
 *   sincronizar  Trae de dLocal Go el estado, el próximo cobro y los cobros.
 *   baja         Da de baja la suscripción vigente y desactiva el plan, así
 *                no hay más cobros. Es inmediata.
 *   tarjeta      Para cambiar el medio de pago. dLocal Go no lo permite sobre
 *                una suscripción, así que da de baja la vigente y responde
 *                { url } con el enlace del plan para suscribirse de nuevo.
 *                Lo ya pagado no se vuelve a cobrar, el plan da esos días
 *                sin cobro a la suscripción nueva.
 *   Un abono activo no cambia de monto. Para cambiarlo se da de baja y se
 *   arma otro.
 *
 * Pagos manuales, solo FIRMA. Transferencias y cripto que FIRMA concilia a mano.
 *   pago_manual        { monto, moneda, medio, fecha, nota? } Lo deja aprobado
 *                      en el historial. Si el abono no tiene plan en dLocal Go,
 *                      lo deja activo y al día: el próximo vencimiento sale de
 *                      sumar un período por cada pago manual.
 *   borrar_pago_manual { pago_id } Borra un pago manual cargado por error y
 *                      recalcula el vencimiento. Los cobros de dLocal Go no se borran.
 *
 * Vigencia, solo FIRMA. En cualquier estado del abono.
 *   vigencia           { vigente_hasta } Fecha AAAA-MM-DD hasta la que rige el
 *                      abono, o null para sacarla. Es informativa: no da de baja
 *                      ni cambia los débitos.
 *
 * Borrar, solo FIRMA. Para los abonos de prueba.
 *   borrar             Borra un abono dado de baja con su historial de pagos.
 *                      Un abono vigente primero se da de baja.
 */
import { createHmac, randomUUID } from 'node:crypto';
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
  vigente_hasta?: string | null;
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
/* Acciones                                                             */
/* ------------------------------------------------------------------ */
async function accionSincronizar(sb: SupabaseClient, abono: Abono): Promise<Response> {
  const r = await sincronizar(sb, abono);
  if (!r.ok) return falloDlocal(r, 'informar el estado del abono');
  return json({ ok: true, estado: r.abono.estado, proximo_cobro: r.abono.proximo_cobro, nuevos: r.nuevos, cambio: r.abono.estado !== abono.estado });
}

/* ------------------------------------------------------------------ */
/* Pagos manuales                                                       */
/* ------------------------------------------------------------------ */
const MEDIOS_MANUALES = ['transferencia_ars', 'transferencia_usd', 'usdt', 'otro'] as const;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Suma meses sin pasarse de mes: 31 de enero más un mes es 28 o 29 de febrero. */
function sumarMeses(iso: string, meses: number): string {
  const d = new Date(iso);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString();
}

/**
 * Abono sin plan en dLocal Go: el estado y el vencimiento salen de los pagos
 * manuales. Cada pago cubre un período desde su fecha o desde el vencimiento
 * anterior, el que sea más tarde. Sin pagos vuelve a borrador.
 */
async function recalcularManual(sb: SupabaseClient, abono: Abono): Promise<void> {
  if (abono.plan_id || abono.estado === 'cancelado') return;
  const { data } = await sb.from('abono_pagos').select('fecha, detalle').eq('abono_id', abono.id).eq('estado', 'aprobado').order('fecha', { ascending: true });
  const manuales = (data ?? []).filter((p) => (p.detalle as Record<string, unknown> | null)?.procesador === 'manual');
  const periodo = abono.periodo_meses === 3 ? 3 : 1;
  let vence: string | null = null;
  for (const p of manuales) {
    const desde: string = vence && Date.parse(vence) > Date.parse(p.fecha as string) ? vence : (p.fecha as string);
    vence = sumarMeses(desde, periodo);
  }
  const cambios = vence ? { estado: 'activo', proximo_cobro: vence } : { estado: 'borrador', proximo_cobro: null };
  const { error: e } = await sb.from('abonos').update(cambios).eq('id', abono.id).is('plan_id', null).neq('estado', 'cancelado');
  if (e) throw new Error(e.message);
  if (cambios.estado !== abono.estado) await registrar(sb, cambios.estado === 'activo' ? 'abono_activado' : 'abono_sin_pagos', abono, { estado_anterior: abono.estado, manual: true });
}

async function pagoManual(sb: SupabaseClient, abono: Abono, cuerpo: Record<string, unknown>, actor: string): Promise<Response> {
  if (abono.estado === 'cancelado') return error('El abono está dado de baja.', 409);
  const monto = Math.round(Number(cuerpo.monto) * 100) / 100;
  const moneda = String(cuerpo.moneda || '');
  const medio = String(cuerpo.medio || '');
  const fecha = String(cuerpo.fecha || '');
  const nota = String(cuerpo.nota ?? '').trim().slice(0, 300);
  if (!Number.isFinite(monto) || monto <= 0 || monto > 1e9) return error('El monto tiene que ser mayor a cero.');
  if (moneda !== 'ARS' && moneda !== 'USD') return error('La moneda tiene que ser ARS o USD.');
  if (!(MEDIOS_MANUALES as readonly string[]).includes(medio)) return error('Elegí el medio de pago.');
  // Mediodía de Buenos Aires, así la fecha no cambia de día al mostrarla.
  const iso = FECHA.test(fecha) ? new Date(`${fecha}T12:00:00-03:00`).toISOString() : '';
  if (!iso || Number.isNaN(Date.parse(iso))) return error('La fecha no es válida.');
  if (Date.parse(iso) > Date.now() + 86_400_000) return error('La fecha no puede ser futura.');

  const fila: FilaPago = {
    abono_id: abono.id,
    organizacion_id: abono.organizacion_id,
    cobro_id: `manual-${randomUUID()}`,
    monto_pagado: monto,
    monto_recibido: monto,
    moneda: abono.moneda,
    moneda_cobro: moneda,
    estado: 'aprobado',
    fecha: iso,
    detalle: { procesador: 'manual', medio, nota: nota || null, registrado_por: actor },
  };
  const { error: e } = await sb.from('abono_pagos').insert(fila);
  if (e) return error('No se pudo registrar el pago.', 500);
  await registrar(sb, 'abono_pago_manual', abono, { cobro: fila.cobro_id, fecha_pago: iso, monto_pagado: monto, moneda_cobro: moneda, medio }, actor);
  await recalcularManual(sb, abono);
  return json({ ok: true });
}

async function borrarPagoManual(sb: SupabaseClient, abono: Abono, pagoId: string, actor: string): Promise<Response> {
  if (!UUID.test(pagoId)) return error('Falta el pago.');
  const { data: pago } = await sb.from('abono_pagos').select('*').eq('id', pagoId).eq('abono_id', abono.id).maybeSingle();
  if (!pago) return error('No existe ese pago.', 404);
  if ((pago.detalle as Record<string, unknown> | null)?.procesador !== 'manual') return error('Solo se pueden borrar los pagos cargados a mano.', 409);
  const { error: e } = await sb.from('abono_pagos').delete().eq('id', pagoId);
  if (e) return error('No se pudo borrar el pago.', 500);
  await registrar(sb, 'abono_pago_manual_borrado', abono, { cobro: pago.cobro_id, fecha_pago: pago.fecha, monto_pagado: pago.monto_pagado, moneda_cobro: pago.moneda_cobro }, actor);
  await recalcularManual(sb, abono);
  return json({ ok: true });
}

async function vigencia(sb: SupabaseClient, abono: Abono, valor: unknown, actor: string): Promise<Response> {
  const hasta = valor === null || valor === '' ? null : String(valor);
  if (hasta !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(hasta) || Number.isNaN(Date.parse(`${hasta}T12:00:00Z`)))) return error('La fecha de vigencia no es válida.');
  const { error: e } = await sb.from('abonos').update({ vigente_hasta: hasta }).eq('id', abono.id);
  if (e) return error('No se pudo guardar la vigencia.', 500);
  await registrar(sb, 'abono_vigencia', abono, { vigente_hasta: hasta, anterior: abono.vigente_hasta ?? null }, actor);
  return json({ ok: true });
}

async function borrarAbono(sb: SupabaseClient, abono: Abono, actor: string): Promise<Response> {
  if (abono.estado !== 'cancelado') return error('Solo se borran abonos dados de baja. Dalo de baja primero.', 409);
  const { count } = await sb.from('abono_pagos').select('id', { count: 'exact', head: true }).eq('abono_id', abono.id);
  const { error: e } = await sb.from('abonos').delete().eq('id', abono.id);
  if (e) return error('No se pudo borrar el abono.', 500);
  await registrar(sb, 'abono_borrado', abono, { concepto: abono.concepto, monto: abono.monto, moneda: abono.moneda, pagos: count ?? 0 }, actor);
  return json({ ok: true });
}

async function baja(sb: SupabaseClient, abono: Abono, actor: string): Promise<Response> {
  if (abono.estado === 'cancelado') return json({ ok: true, sin_cambios: true, estado: 'cancelado' });
  if (abono.estado === 'borrador') return error('El abono todavía no está activo. FIRMA puede borrarlo desde Administración.', 409);

  const bajas: string[] = [];
  let planDesactivado = true;
  if (abono.plan_id) {
    const ruta = rutaPlan(abono.plan_id);
    const s = await dlocal<unknown>('GET', `${ruta}/subscription/all`);
    if (!s.ok && s.status !== 404) return falloDlocal(s, 'consultar las suscripciones');
    let fallidas = 0;
    for (const sub of lista<Suscripcion>(s.datos).filter(suscripcionVigente)) {
      const r = await dlocal('PATCH', `${ruta}/subscription/${encodeURIComponent(idDe(sub))}/deactivate`);
      if (r.ok || r.status === 404) bajas.push(idDe(sub));
      else fallidas++;
    }
    // Desactivar el plan frena los cobros de todos sus suscriptores.
    const p = await dlocal('PATCH', `${ruta}/deactivate`);
    planDesactivado = p.ok || p.status === 404;
    // Con el plan activo y una suscripción que no se pudo dar de baja, los cobros siguen. No se guarda nada.
    if (!planDesactivado && fallidas > 0) return falloDlocal(p, 'dar de baja la suscripción');
    if (!planDesactivado) {
      await registrar(sb, 'abono_error', abono, { etapa: 'baja', status: p.status, mensaje: `El plan quedó activo en dLocal Go. ${p.error}`.trim() }, actor);
    }
  }

  const { error: e } = await sb
    .from('abonos')
    .update({ estado: 'cancelado', cancelado_en: new Date().toISOString(), proximo_cobro: null, suscripcion_id: null })
    .eq('id', abono.id)
    .neq('estado', 'cancelado');
  if (e) return error('La baja se hizo en dLocal Go pero no se pudo guardar. Avisanos.', 500);
  await registrar(sb, 'abono_baja', abono, { suscripciones: bajas, plan_desactivado: planDesactivado }, actor);
  return json({ ok: true, estado: 'cancelado' });
}

async function tarjeta(sb: SupabaseClient, abono: Abono, actor: string): Promise<Response> {
  if (abono.estado === 'cancelado') return error('El abono está dado de baja.', 409);
  if (!abono.plan_id || !abono.plan_token) return error('Todavía no hay una suscripción para cambiar el medio de pago.', 409);

  // Primero el estado real, con los cobros al día.
  const r = await sincronizar(sb, abono);
  if (!r.ok) return falloDlocal(r, 'informar el estado del abono');
  const actual = r.abono;
  const sub = r.vigente;
  if (!sub || (actual.estado !== 'activo' && actual.estado !== 'con_error')) {
    return json({ error: 'No hay una suscripción vigente para cambiar el medio de pago. Si el abono está por activar, seguí con Continuar a dLocal Go.', actualizar: true }, 409);
  }

  // Lo ya pagado no se vuelve a cobrar. El plan da esos días sin cobro a la suscripción nueva.
  const dias = await diasYaPagados(sb, actual);
  const ajuste = await ajustarDiasSinCobro(r.plan, abono.plan_id, dias);
  if (!ajuste.ok) {
    await registrar(sb, 'abono_error', actual, { etapa: 'tarjeta', status: ajuste.status, mensaje: ajuste.error }, actor);
    return falloDlocal(ajuste, 'preparar el cambio de medio de pago');
  }
  const d = await dlocal('PATCH', `${rutaPlan(abono.plan_id)}/subscription/${encodeURIComponent(idDe(sub))}/deactivate`);
  if (!d.ok && d.status !== 404) return falloDlocal(d, 'dar de baja la suscripción actual');

  const primerCobro = dias ? actual.proximo_cobro : null;
  const { error: e } = await sb
    .from('abonos')
    .update({ estado: 'pendiente', suscripcion_id: null, proximo_cobro: primerCobro })
    .eq('id', abono.id)
    .neq('estado', 'cancelado');
  if (e) return error('La suscripción se dio de baja pero no se pudo guardar. Avisanos.', 500);
  await registrar(sb, 'abono_tarjeta', actual, { suscripcion_anterior: idDe(sub), dias_sin_cobro: dias }, actor);
  return json({ url: enlace(abono.plan_token, abono.email_pagador), dias_sin_cobro: dias, primer_cobro: primerCobro });
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);

  const quien = await quienLlama(sb, request);
  if (quien instanceof Response) return quien;
  const esAdmin = quien.rol === 'admin';
  if (!esAdmin && quien.rol !== 'titular') return error('Solo el titular de la empresa puede gestionar el abono.', 403);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error('Pedido mal formado.');
  }
  const abonoId = String(cuerpo?.abono_id || '');
  const accion = String(cuerpo?.accion || '');
  if (!UUID.test(abonoId)) return error('Falta el abono.');
  if (!['sincronizar', 'baja', 'tarjeta', 'pago_manual', 'borrar_pago_manual', 'vigencia', 'borrar'].includes(accion)) return error('Acción desconocida.');
  const manual = accion === 'pago_manual' || accion === 'borrar_pago_manual';
  if (manual && !esAdmin) return error('Solo FIRMA registra pagos manuales.', 403);
  if (accion === 'vigencia' && !esAdmin) return error('Solo FIRMA cambia la vigencia del abono.', 403);
  if (accion === 'borrar' && !esAdmin) return error('Solo FIRMA borra abonos.', 403);

  const { data: abono } = await sb.from('abonos').select('*').eq('id', abonoId).maybeSingle<Abono>();
  if (!abono) return error('No existe ese abono.', 404);
  if (!esAdmin) {
    if (quien.organizacion_id !== abono.organizacion_id) return error('No tenés acceso a este abono.', 403);
    const { data: org } = await sb.from('organizaciones').select('activa').eq('id', abono.organizacion_id).maybeSingle();
    if (!org?.activa) return error('La empresa no está activa.', 403);
  }

  // Un abono de baja ya no tiene nada en dLocal Go.
  if (accion === 'borrar') {
    try {
      return await borrarAbono(sb, abono, quien.id);
    } catch {
      return error('No se pudo borrar el abono. Probá de nuevo en unos minutos.', 500);
    }
  }

  // La vigencia es un dato de FIRMA, no pasa por dLocal Go.
  if (accion === 'vigencia') {
    try {
      return await vigencia(sb, abono, cuerpo.vigente_hasta ?? null, quien.id);
    } catch {
      return error('No se pudo guardar la vigencia. Probá de nuevo en unos minutos.', 500);
    }
  }

  // Los pagos manuales no pasan por dLocal Go.
  if (manual) {
    try {
      if (accion === 'pago_manual') return await pagoManual(sb, abono, cuerpo, quien.id);
      return await borrarPagoManual(sb, abono, String(cuerpo.pago_id || ''), quien.id);
    } catch {
      return error('No se pudo completar el registro. Probá de nuevo en unos minutos.', 500);
    }
  }

  const faltan = faltantes();
  if (abono.plan_id && faltan.length) {
    return json({ error: 'La gestión con dLocal Go no está disponible por ahora. Escribinos y la hacemos nosotros.', ...(esAdmin ? { faltan } : {}) }, 503);
  }

  try {
    if (accion === 'sincronizar') return await accionSincronizar(sb, abono);
    if (accion === 'baja') return await baja(sb, abono, quien.id);
    return await tarjeta(sb, abono, quien.id);
  } catch {
    return error('No se pudo completar la gestión. Probá de nuevo en unos minutos.', 500);
  }
}

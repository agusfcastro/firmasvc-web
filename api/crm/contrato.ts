/**
 * Genera el contrato de un cliente del CRM en ZapSign (Vercel Function).
 * Corre en el servidor con la clave service role y el token de ZapSign de la
 * empresa, que nunca llegan al navegador.
 *
 * POST /api/crm/contrato  { cliente_id, regenerar? }
 *   Responde { firma_url } o { error }.
 *   Lo pide cualquier usuario activo de la empresa del cliente. Regenerar un
 *   contrato que ya tiene link de firma, solo FIRMA.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZONA = 'America/Argentina/Buenos_Aires';

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

function baseZapsign(sandbox: boolean): string {
  // ZAPSIGN_API_URL solo se usa para pruebas.
  const propia = process.env.ZAPSIGN_API_URL;
  if (propia) return propia.replace(/\/$/, '');
  return sandbox ? 'https://sandbox.api.zapsign.com.br' : 'https://api.zapsign.com.br';
}

/* ------------------------------------------------------------------ */
/* Montos y fechas con el estilo de los contratos de FIRMA             */
/* ------------------------------------------------------------------ */
const UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO',
  'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function menorQueMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c) partes.push(CENTENAS[c]);
  if (r) {
    if (r < 30) partes.push(UNIDADES[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      partes.push(u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d]);
    }
  }
  return partes.join(' ');
}

/** «Uno» delante de mil o de millones se apocopa. VEINTIUNO MIL pasa a VEINTIÚN MIL. */
function apocopar(s: string): string {
  return s.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/(^|\s)UNO$/, '$1UN');
}

export function enLetras(numero: number): string {
  const n = Math.floor(Math.abs(numero));
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${apocopar(enLetras(millones))} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${apocopar(menorQueMil(miles))} MIL`);
  if (resto) partes.push(menorQueMil(resto));
  return partes.join(' ');
}

export function montoEnLetras(monto: number): string {
  const centavos = Math.round(Math.abs(monto) * 100);
  const entero = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return resto ? `${enLetras(entero)} CON ${String(resto).padStart(2, '0')}/100` : enLetras(entero);
}

export function numero(monto: number): string {
  const conDecimales = Math.round(monto * 100) % 100 !== 0;
  return monto.toLocaleString('es-AR', { minimumFractionDigits: conDecimales ? 2 : 0, maximumFractionDigits: 2 });
}

/** Cantidad de cuotas en femenino. 1 (UNA), 21 (VEINTIUNA). */
export function cantidadCuotas(n: number): string {
  return `${n} (${enLetras(n).replace(/UNO$/, 'UNA')})`;
}

function fechaLarga(d: Date): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA }).format(d);
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

interface Pago {
  monto: number | string;
  vencimiento: string | null;
  estado: string;
  creado_en?: string;
}

interface Cliente {
  id: string;
  organizacion_id: string;
  codigo: string | null;
  nombre: string;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  domicilio?: string | null;
  servicio: string | null;
  monto_total: number | string | null;
  moneda: string | null;
  fecha_onboarding: string | null;
  responsable: string | null;
  estado_firma: string;
  firma_url: string | null;
  zapsign_doc: string | null;
}

/** Variables que reemplaza ZapSign en el modelo DOCX. La pestaña ZapSign de Administración muestra la misma lista. */
export function variablesDelContrato(c: Cliente, pagos: Pago[], empresa: string, nombreServicio: string | null, hoy = new Date()): { de: string; para: string }[] {
  const moneda = c.moneda || 'USD';
  const total = Number(c.monto_total ?? 0);
  // El anticipo se carga pagado y sin vencimiento. Las cuotas tienen vencimiento, estén pagadas o no.
  const esAnticipo = (p: Pago) => p.estado === 'pagado' && !p.vencimiento;
  const anticipo = pagos.filter(esAnticipo).reduce((a, p) => a + Number(p.monto), 0);
  const cuotas = pagos
    .filter((p) => !esAnticipo(p))
    .sort((a, b) => (a.vencimiento ?? '9999').localeCompare(b.vencimiento ?? '9999') || (a.creado_en ?? '').localeCompare(b.creado_en ?? ''));
  const saldo = cuotas.reduce((a, p) => a + Number(p.monto), 0);
  const detalle = cuotas.length
    ? cuotas
        .map((p, i) => `${i === 0 ? 'Cuota' : 'cuota'} ${i + 1} de ${moneda} ${numero(Number(p.monto))}${p.vencimiento ? ` con vencimiento el ${fechaCorta(p.vencimiento)}` : ''}`)
        .join('; ') + '.'
    : 'Sin cuotas. El precio se cancela con el anticipo.';
  const valores: Record<string, string> = {
    NOMBRE: c.nombre,
    DNI: c.dni || '',
    EMAIL: c.email || '',
    TELEFONO: c.telefono || '',
    DOMICILIO: c.domicilio || '',
    CODIGO: c.codigo || '',
    SERVICIO: nombreServicio || c.servicio || '',
    EMPRESA: empresa,
    RESPONSABLE: c.responsable || '',
    MONEDA: moneda,
    MONTO_TOTAL: numero(total),
    MONTO_TOTAL_LETRAS: montoEnLetras(total),
    ANTICIPO: numero(anticipo),
    ANTICIPO_LETRAS: montoEnLetras(anticipo),
    SALDO: numero(saldo),
    SALDO_LETRAS: montoEnLetras(saldo),
    CANTIDAD_CUOTAS: cantidadCuotas(cuotas.length),
    DETALLE_CUOTAS: detalle,
    FECHA_ONBOARDING: c.fecha_onboarding ? fechaLarga(new Date(c.fecha_onboarding)) : 'a definir',
    FECHA: fechaLarga(hoy),
  };
  return Object.entries(valores).map(([k, v]) => ({ de: `{{${k}}}`, para: v }));
}

async function leerError(r: Response): Promise<string> {
  const texto = await r.text().catch(() => '');
  try {
    const j = JSON.parse(texto) as Record<string, unknown>;
    const m = j.detail ?? j.message ?? j.error ?? j.errors;
    if (m) return typeof m === 'string' ? m : JSON.stringify(m);
  } catch {
    /* no era JSON */
  }
  return texto.slice(0, 200);
}

export async function POST(request: Request): Promise<Response> {
  const sb = clienteServicio();
  if (!sb) return error('El servidor no tiene configuradas las variables de Supabase.', 500);

  // 1. Quién llama.
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida.', 401);
  const { data: quien, error: errUsuario } = await sb.auth.getUser(token);
  if (errUsuario || !quien?.user) return error('Sesión inválida o vencida.', 401);
  const { data: perfil } = await sb.from('perfiles').select('rol, activo, organizacion_id').eq('id', quien.user.id).maybeSingle();
  if (!perfil || !perfil.activo) return error('Tu cuenta no está habilitada.', 403);
  const esAdmin = perfil.rol === 'admin';

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error('Pedido mal formado.');
  }
  const clienteId = String(cuerpo.cliente_id || '');
  if (!UUID.test(clienteId)) return error('Falta el cliente.');
  const regenerar = cuerpo.regenerar === true;

  // 2. El cliente tiene que ser de su empresa.
  const { data: cliente } = await sb.from('crm_clientes').select('*').eq('id', clienteId).maybeSingle<Cliente>();
  if (!cliente) return error('No existe ese cliente.', 404);
  if (!esAdmin && perfil.organizacion_id !== cliente.organizacion_id) return error('No tenés acceso a este cliente.', 403);
  const { data: org } = await sb.from('organizaciones').select('id, nombre, razon_social, activa, zapsign_modelo').eq('id', cliente.organizacion_id).maybeSingle();
  if (!org || (!esAdmin && !org.activa)) return error('La empresa no está activa.', 403);
  if (cliente.estado_firma === 'Baja') return error('El cliente está dado de baja.', 409);
  if (cliente.estado_firma === 'Firmado' && !regenerar) return error('El contrato ya está firmado.', 409);

  // 3. Si ya tiene link, se devuelve el mismo. Generar otro es decisión de FIRMA.
  if (cliente.firma_url && !regenerar) return json({ firma_url: cliente.firma_url, existente: true });
  if (regenerar && !esAdmin) return error('Solo FIRMA puede generar otro contrato.', 403);

  const marcar = (cambios: Record<string, unknown>) => sb.from('crm_clientes').update(cambios).eq('id', cliente.id);

  // 4. Cuenta de ZapSign y modelo del servicio, o el de la empresa.
  const { data: cuenta } = await sb.from('zapsign_cuentas').select('api_token, sandbox').eq('organizacion_id', cliente.organizacion_id).maybeSingle();
  if (!cuenta) {
    await marcar({ contrato_estado: 'sin_cuenta', contrato_error: 'La empresa no tiene ZapSign conectado.' });
    return error('La empresa no tiene ZapSign conectado. FIRMA lo configura desde Administración.', 409);
  }
  const { data: servicio } = cliente.servicio
    ? await sb.from('crm_servicios').select('nombre, zapsign_modelo').eq('organizacion_id', cliente.organizacion_id).eq('clave', cliente.servicio).maybeSingle()
    : { data: null };
  const modelo = servicio?.zapsign_modelo || org.zapsign_modelo;
  if (!modelo) {
    await marcar({ contrato_estado: 'sin_modelo', contrato_error: 'No hay modelo de contrato para este servicio.' });
    return error('No hay modelo de contrato para este servicio. FIRMA lo elige en Administración › ZapSign.', 409);
  }

  // 5. Datos del plan de pagos.
  const { data: pagos } = await sb.from('crm_pagos').select('monto, vencimiento, estado, creado_en').eq('cliente_id', cliente.id);
  const data = variablesDelContrato(cliente, (pagos as Pago[]) ?? [], org.razon_social || org.nombre, servicio?.nombre ?? null);

  // 6. ZapSign genera el documento a partir del modelo.
  let r: Response;
  try {
    r = await fetch(`${baseZapsign(cuenta.sandbox)}/api/v1/models/create-doc/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cuenta.api_token}` },
      body: JSON.stringify({
        template_id: modelo,
        signer_name: cliente.nombre,
        signer_email: cliente.email || undefined,
        lang: 'es',
        send_automatic_email: false,
        send_automatic_whatsapp: false,
        external_id: cliente.id,
        data,
      }),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    await marcar({ contrato_estado: 'error', contrato_error: 'ZapSign no respondió.' });
    return error('ZapSign no respondió. Probá de nuevo en unos minutos.', 502);
  }
  if (!r.ok) {
    const detalle = (await leerError(r)).slice(0, 240);
    await marcar({ contrato_estado: 'error', contrato_error: `ZapSign respondió ${r.status}. ${detalle}`.trim() });
    return error(`ZapSign no pudo generar el contrato (${r.status}). ${detalle}`.trim(), 502);
  }
  const doc = (await r.json().catch(() => null)) as { token?: string; signers?: { sign_url?: string }[] } | null;
  const firmaUrl = doc?.signers?.[0]?.sign_url;
  if (!doc?.token || !firmaUrl) {
    await marcar({ contrato_estado: 'error', contrato_error: 'ZapSign no devolvió el link de firma.' });
    return error('ZapSign no devolvió el link de firma.', 502);
  }

  // 7. El link queda en el CRM.
  const { error: errGuardar } = await marcar({
    firma_url: firmaUrl,
    zapsign_doc: doc.token,
    contrato_estado: 'listo',
    contrato_error: null,
    contrato_generado_en: new Date().toISOString(),
    ...(regenerar ? { estado_firma: 'Pendiente' } : {}),
  });
  if (errGuardar) return error(`El contrato se generó pero no se pudo guardar el link. ${errGuardar.message}`, 500);
  return json({ firma_url: firmaUrl });
}

/**
 * Dólar para cobrar en pesos los abonos de FIRMA.
 *
 * Desde el 26/11/2026 es el dólar cripto de dolarhoy.com, promedio entre compra y
 * venta (antes era el MEP). dolarhoy lo publica como «Dólar Digital (USDC)» o
 * «Dólar Cripto». Si dolarhoy no responde o cambia la página, se usa el dólar
 * cripto de dolarapi.com y después el de argentinadatos.com, también promedio
 * entre compra y venta. Solo vale una cotización de la última semana.
 *
 * Rige para todos los abonos en pesos, también los de antes. Las columnas siguen
 * llamándose al_mep y cotizacion_mep (0061) y guardan esta cotización.
 */

export interface Cotizacion {
  valor: number;
  fuente: string;
  fecha: string;
}

const DIA_MS = 86_400_000;
const redondear = (v: number) => Math.round(v * 100) / 100;

/** «$1.751,48», «1.751» o «1751.48» a número. */
export function numeroArgentino(t: string): number {
  const s = t.replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  return Number(s);
}

/** Compra y venta que tienen sentido: positivas, venta no menor que compra y sin una brecha absurda. */
function puntasValidas(compra: number, venta: number): boolean {
  return Number.isFinite(compra) && Number.isFinite(venta) && compra > 0 && venta >= compra && venta / compra < 1.1;
}

/**
 * Lee compra y venta del dólar cripto en el HTML de dolarhoy.com. Busca el bloque
 * «Dólar Digital (USDC)» o «Dólar Cripto» y toma la compra y la venta que lo
 * siguen antes del próximo dólar. null si no lo encuentra.
 */
export function criptoDeDolarhoy(html: string): { compra: number; venta: number } | null {
  const texto = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&oacute;/g, 'ó')
    .replace(/\s+/g, ' ');
  const rotulo = /D[óo]lar (?:Cripto|Digital)/gi;
  for (let m = rotulo.exec(texto); m; m = rotulo.exec(texto)) {
    let tramo = texto.slice(m.index + m[0].length, m.index + m[0].length + 300);
    const otro = /D[óo]lar /i.exec(tramo);
    if (otro) tramo = tramo.slice(0, otro.index);
    const compra = /Compra\s*\$?\s*([\d.,]+)/i.exec(tramo);
    const venta = /Venta\s*\$?\s*([\d.,]+)/i.exec(tramo);
    if (!compra || !venta) continue;
    const c = numeroArgentino(compra[1]);
    const v = numeroArgentino(venta[1]);
    if (puntasValidas(c, v)) return { compra: c, venta: v };
  }
  return null;
}

async function deDolarhoy(): Promise<Cotizacion | null> {
  const r = await fetch('https://dolarhoy.com/', {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; FIRMA/1.0; +https://firmasvc.com)', accept: 'text/html' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  const p = criptoDeDolarhoy(await r.text());
  return p ? { valor: redondear((p.compra + p.venta) / 2), fuente: 'dolarhoy.com', fecha: new Date().toISOString() } : null;
}

async function deDolarapi(): Promise<Cotizacion | null> {
  const r = await fetch('https://dolarapi.com/v1/dolares/cripto', { signal: AbortSignal.timeout(8000) });
  const j = r.ok ? ((await r.json()) as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown } | null) : null;
  const c = Number(j?.compra);
  const v = Number(j?.venta);
  const f = typeof j?.fechaActualizacion === 'string' ? Date.parse(j.fechaActualizacion) : NaN;
  if (!puntasValidas(c, v) || !(f > Date.now() - 7 * DIA_MS)) return null;
  return { valor: redondear((c + v) / 2), fuente: 'dolarapi.com', fecha: new Date(f).toISOString() };
}

async function deArgentinadatos(): Promise<Cotizacion | null> {
  const r = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/cripto', { signal: AbortSignal.timeout(8000) });
  const j = r.ok ? ((await r.json()) as { compra?: unknown; venta?: unknown; fecha?: unknown }[] | null) : null;
  const u = Array.isArray(j) && j.length ? j[j.length - 1] : null;
  const c = Number(u?.compra);
  const v = Number(u?.venta);
  const f = typeof u?.fecha === 'string' ? Date.parse(`${u.fecha}T12:00:00-03:00`) : NaN;
  if (!puntasValidas(c, v) || !(f > Date.now() - 7 * DIA_MS)) return null;
  return { valor: redondear((c + v) / 2), fuente: 'argentinadatos.com', fecha: new Date(f).toISOString() };
}

/** Dólar cripto del día, promedio entre compra y venta. null si ninguna fuente responde. */
export async function cotizacionDolar(): Promise<Cotizacion | null> {
  for (const fuente of [deDolarhoy, deDolarapi, deArgentinadatos]) {
    try {
      const c = await fuente();
      if (c) return c;
    } catch {
      /* sigue con la próxima fuente */
    }
  }
  return null;
}

/** Dólares a pesos con la cotización, sin centavos. */
export const pesosAlDolar = (usd: number, cotizacion: number): number => Math.round(usd * cotizacion);

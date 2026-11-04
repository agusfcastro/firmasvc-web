import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { COLOR, rgb01 } from '../../api/_lib/marca';
import { TEXTOS, formatoFecha, formatoMonto, fraseRecibo, totales, type DatosComprobante, type Parte } from './modelo';

/**
 * Arma el PDF del invoice o del recibo en el navegador. A4, Helvetica (no
 * hace falta embeber fuentes) y los colores de la marca, sobrios para que
 * sirva a cualquier negocio.
 */
export interface Logo {
  bytes: Uint8Array;
  tipo: 'png' | 'jpg';
}

export interface OpcionesPdf {
  /** Ya con el formato visible, por ejemplo 0001. */
  numero: string;
  logo?: Logo | null;
  anulado?: boolean;
  /** Pie chico con firmasvc.com, solo en la herramienta pública. */
  marca?: boolean;
}

const c = (hex: string) => rgb(...rgb01(hex));
const TINTA = c(COLOR.tinta);
const PIEDRA = c(COLOR.piedra);
const CALIDO = c(COLOR.calido);
const LINEA = c(COLOR.linea);
const BANDA = c(COLOR.marfilOscuro);
const MARFIL = c(COLOR.marfil);
const BOSQUE = c(COLOR.bosque);
const ANULADO = rgb(0.7, 0.12, 0.1);

const ANCHO = 595.28;
const ALTO = 841.89;
const M = 50;
const PIE = 70;

/** Lugar de la firma sobre la línea del recibo, en puntos del PDF. La hoja cuenta desde 0. */
export interface LugarFirma {
  pagina: number;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export async function generarPdf(d: DatosComprobante, op: OpcionesPdf): Promise<Uint8Array> {
  return (await generarPdfConLugar(d, op)).bytes;
}

/** Como generarPdf, y en los recibos también dónde va la firma (api/firma/firmar, firmar_recibo). */
export async function generarPdfConLugar(d: DatosComprobante, op: OpcionesPdf): Promise<{ bytes: Uint8Array; lugar: LugarFirma | null }> {
  let lugar: LugarFirma | null = null;
  const doc = await PDFDocument.create();
  const t = TEXTOS[d.idioma];
  const titulo = d.tipo === 'invoice' ? t.invoice : t.recibo;
  doc.setTitle(`${titulo} ${op.numero}`);
  doc.setCreator('FIRMA · firmasvc.com');
  doc.setProducer('FIRMA');

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  // Helvetica solo dibuja WinAnsi: lo que no entra (emojis, otros alfabetos) sale como «?» en lugar de romper el PDF.
  const admitidos = new Set(regular.getCharacterSet());
  const limpio = (s: string) =>
    Array.from(s.normalize('NFC').replace(/\t/g, ' ').replace(/[  ]/g, ' '))
      .map((ch) => (ch === '\n' || admitidos.has(ch.codePointAt(0)!) ? ch : '?'))
      .join('');

  let logo: PDFImage | null = null;
  if (op.logo) {
    try {
      logo = op.logo.tipo === 'png' ? await doc.embedPng(op.logo.bytes) : await doc.embedJpg(op.logo.bytes);
    } catch {
      logo = null;
    }
  }

  let pagina = doc.addPage([ANCHO, ALTO]);
  let y = ALTO - M;

  const texto = (s: string, x: number, yy: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; derecha?: boolean } = {}) => {
    const size = o.size ?? 10;
    const font = o.font ?? regular;
    const s2 = limpio(s);
    const xx = o.derecha ? x - font.widthOfTextAtSize(s2, size) : x;
    pagina.drawText(s2, { x: xx, y: yy, size, font, color: o.color ?? TINTA });
  };

  const envolver = (s: string, font: PDFFont, size: number, ancho: number): string[] => {
    const lineas: string[] = [];
    for (const parrafo of limpio(s).split('\n')) {
      let actual = '';
      for (const palabra of parrafo.split(/ +/)) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (font.widthOfTextAtSize(prueba, size) <= ancho) {
          actual = prueba;
          continue;
        }
        if (actual) lineas.push(actual);
        // Una palabra más larga que el renglón se corta donde llegue.
        let resto = palabra;
        while (font.widthOfTextAtSize(resto, size) > ancho) {
          let n = resto.length - 1;
          while (n > 1 && font.widthOfTextAtSize(resto.slice(0, n), size) > ancho) n--;
          lineas.push(resto.slice(0, n));
          resto = resto.slice(n);
        }
        actual = resto;
      }
      lineas.push(actual);
    }
    return lineas;
  };

  const nuevaPagina = () => {
    pagina = doc.addPage([ANCHO, ALTO]);
    y = ALTO - M;
    texto(`${titulo} ${t.numero} ${op.numero}`, M, y - 9, { size: 9, font: negrita, color: PIEDRA });
    y -= 34;
  };
  const asegurar = (alto: number) => {
    if (y - alto < M + PIE) nuevaPagina();
  };

  /* Encabezado ------------------------------------------------------ */
  if (logo) {
    const escala = Math.min(150 / logo.width, 52 / logo.height, 1);
    const w = logo.width * escala;
    const h = logo.height * escala;
    pagina.drawImage(logo, { x: M, y: y - h, width: w, height: h });
  } else {
    envolver(d.emisor.nombre || ' ', negrita, 16, 280)
      .slice(0, 2)
      .forEach((l, i) => texto(l, M, y - 16 - i * 19, { size: 16, font: negrita }));
  }
  texto(titulo, ANCHO - M, y - 20, { size: 22, font: negrita, derecha: true });
  texto(`${t.numero} ${op.numero}`, ANCHO - M, y - 38, { size: 11, color: PIEDRA, derecha: true });
  let yDer = y - 58;
  const fila = (etiqueta: string, valor: string) => {
    texto(valor, ANCHO - M, yDer, { size: 9.5, derecha: true });
    texto(etiqueta, ANCHO - M - 150, yDer, { size: 9.5, color: PIEDRA });
    yDer -= 14;
  };
  fila(t.fecha, formatoFecha(d.fecha, d.idioma));
  if (d.tipo === 'invoice' && d.vencimiento) fila(t.vence, formatoFecha(d.vencimiento, d.idioma));
  y = Math.min(y - 70, yDer - 4);
  pagina.drawLine({ start: { x: M, y }, end: { x: ANCHO - M, y }, thickness: 0.75, color: LINEA });
  y -= 24;

  /* Partes ---------------------------------------------------------- */
  const columna = (etiqueta: string, p: Parte, x: number, ancho: number): number => {
    let yy = y;
    texto(etiqueta.toUpperCase(), x, yy, { size: 7.5, font: negrita, color: PIEDRA });
    yy -= 16;
    for (const l of envolver(p.nombre || ' ', negrita, 11, ancho)) {
      texto(l, x, yy, { size: 11, font: negrita });
      yy -= 14;
    }
    const extras = [p.idFiscal && `${t.idFiscal} ${p.idFiscal}`, p.domicilio, p.email, p.telefono].filter(Boolean) as string[];
    for (const e of extras) {
      for (const l of envolver(e, regular, 9.5, ancho)) {
        texto(l, x, yy, { size: 9.5, color: PIEDRA });
        yy -= 13;
      }
    }
    return yy;
  };
  const mitad = (ANCHO - 2 * M - 30) / 2;
  const finIzq = columna(t.de, d.emisor, M, mitad);
  const finDer = columna(d.tipo === 'invoice' ? t.facturarA : t.recibiDe, d.receptor, M + mitad + 30, mitad);
  y = Math.min(finIzq, finDer) - 22;

  const tot = totales(d);

  if (d.tipo === 'invoice') {
    /* Renglones ----------------------------------------------------- */
    const xCant = 370;
    const xPrecio = 460;
    const xImporte = ANCHO - M - 8;
    const anchoDesc = xCant - 60 - M - 8;
    const cabecera = () => {
      pagina.drawRectangle({ x: M, y: y - 8, width: ANCHO - 2 * M, height: 24, color: BANDA });
      texto(t.descripcion.toUpperCase(), M + 8, y, { size: 7.5, font: negrita, color: PIEDRA });
      texto(t.cantidad.toUpperCase(), xCant, y, { size: 7.5, font: negrita, color: PIEDRA, derecha: true });
      texto(t.precio.toUpperCase(), xPrecio, y, { size: 7.5, font: negrita, color: PIEDRA, derecha: true });
      texto(t.importe.toUpperCase(), xImporte, y, { size: 7.5, font: negrita, color: PIEDRA, derecha: true });
      y -= 30;
    };
    cabecera();
    const renglones = d.renglones.filter((r) => r.descripcion.trim() || r.precio);
    for (const r of renglones) {
      const lineas = envolver(r.descripcion || ' ', regular, 10, anchoDesc);
      const alto = lineas.length * 13 + 12;
      if (y - alto < M + PIE) {
        nuevaPagina();
        cabecera();
      }
      lineas.forEach((l, i) => texto(l, M + 8, y - i * 13, { size: 10 }));
      texto(String(r.cantidad).replace('.', d.idioma === 'en' ? '.' : ','), xCant, y, { size: 10, derecha: true });
      texto(formatoMonto(r.precio, d.moneda, d.idioma), xPrecio, y, { size: 10, color: PIEDRA, derecha: true });
      texto(formatoMonto(Math.round(r.cantidad * r.precio * 100) / 100, d.moneda, d.idioma), xImporte, y, { size: 10, derecha: true });
      y -= alto - 4;
      pagina.drawLine({ start: { x: M, y: y + 6 }, end: { x: ANCHO - M, y: y + 6 }, thickness: 0.5, color: LINEA });
      y -= 8;
    }

    /* Totales ------------------------------------------------------- */
    const filas: [string, number][] = [[t.subtotal, tot.subtotal]];
    if (tot.descuento) filas.push([t.descuento, -tot.descuento]);
    if (tot.impuesto) filas.push([`${d.impuestoNombre.trim() || 'Tax'} (${String(d.impuestoPorcentaje).replace('.', d.idioma === 'en' ? '.' : ',')}%)`, tot.impuesto]);
    asegurar(filas.length * 16 + 50);
    y -= 6;
    const xEtiq = ANCHO - M - 230;
    for (const [etiqueta, valor] of filas) {
      texto(etiqueta, xEtiq, y, { size: 10, color: PIEDRA });
      texto(formatoMonto(valor, d.moneda, d.idioma), xImporte, y, { size: 10, derecha: true });
      y -= 16;
    }
    y -= 14;
    pagina.drawRectangle({ x: xEtiq - 10, y: y - 11, width: ANCHO - M - xEtiq + 10, height: 30, color: TINTA });
    texto(t.total.toUpperCase(), xEtiq, y, { size: 10, font: negrita, color: MARFIL });
    texto(formatoMonto(tot.total, d.moneda, d.idioma), xImporte, y, { size: 12, font: negrita, color: MARFIL, derecha: true });
    y -= 46;
  } else {
    /* Recibo -------------------------------------------------------- */
    pagina.drawRectangle({ x: M, y: y - 44, width: ANCHO - 2 * M, height: 58, color: BANDA });
    texto(t.total.toUpperCase(), M + 16, y - 8, { size: 7.5, font: negrita, color: PIEDRA });
    texto(formatoMonto(tot.total, d.moneda, d.idioma), M + 16, y - 32, { size: 22, font: negrita, color: BOSQUE });
    y -= 76;
    for (const l of envolver(fraseRecibo(d), regular, 12, ANCHO - 2 * M)) {
      asegurar(18);
      texto(l, M, y, { size: 12 });
      y -= 18;
    }
    if (d.medioPago.trim()) {
      y -= 8;
      asegurar(16);
      texto(`${t.medioPago}:`, M, y, { size: 10, color: PIEDRA });
      texto(d.medioPago, M + regular.widthOfTextAtSize(`${t.medioPago}: `, 10) + 2, y, { size: 10 });
      y -= 16;
    }
    y -= 14;
  }

  /* Notas ----------------------------------------------------------- */
  if (d.notas.trim()) {
    asegurar(40);
    texto(t.notas.toUpperCase(), M, y, { size: 7.5, font: negrita, color: PIEDRA });
    y -= 15;
    for (const l of envolver(d.notas, regular, 9.5, ANCHO - 2 * M)) {
      asegurar(13);
      texto(l, M, y, { size: 9.5 });
      y -= 13;
    }
    y -= 12;
  }

  /* Firma del recibo ------------------------------------------------ */
  if (d.tipo === 'recibo') {
    asegurar(110);
    // Lugar arriba de la línea para la firma, dibujada a mano o electrónica.
    y = Math.min(y - 72, M + PIE + 120);
    const xF = ANCHO - M - 220;
    lugar = { pagina: doc.getPageCount() - 1, x: xF, y: y + 3, ancho: 220, alto: 52 };
    pagina.drawLine({ start: { x: xF, y }, end: { x: ANCHO - M, y }, thickness: 0.75, color: TINTA });
    texto(t.firma, xF, y - 13, { size: 8.5, color: PIEDRA });
    texto(d.emisor.nombre, xF, y - 26, { size: 9.5, font: negrita });
    y -= 40;
  }

  /* Pie: datos de pago o leyendas ----------------------------------- */
  if (d.pie.trim()) {
    const lineas = envolver(d.pie, regular, 8.5, ANCHO - 2 * M);
    if (y - lineas.length * 11.5 - 16 < M + 24) nuevaPagina();
    let yy = M + 24 + lineas.length * 11.5;
    pagina.drawLine({ start: { x: M, y: yy + 8 }, end: { x: ANCHO - M, y: yy + 8 }, thickness: 0.5, color: LINEA });
    for (const l of lineas) {
      texto(l, M, yy - 4, { size: 8.5, color: PIEDRA });
      yy -= 11.5;
    }
  }

  /* En todas las hojas ---------------------------------------------- */
  const hojas = doc.getPages();
  hojas.forEach((h: PDFPage, i) => {
    pagina = h;
    if (hojas.length > 1) texto(`${t.pagina} ${i + 1} / ${hojas.length}`, ANCHO - M, M - 18, { size: 7.5, color: CALIDO, derecha: true });
    if (op.marca) texto('Hecho con firmasvc.com', M, M - 18, { size: 7.5, color: CALIDO });
    if (op.anulado) {
      const s = t.anulado;
      const size = 96;
      const w = negrita.widthOfTextAtSize(s, size);
      h.drawText(s, { x: ANCHO / 2 - (w / 2) * Math.cos(Math.PI / 6), y: ALTO / 2 - (w / 2) * Math.sin(Math.PI / 6), size, font: negrita, color: ANULADO, opacity: 0.18, rotate: degrees(30) });
    }
  });

  return { bytes: await doc.save(), lugar };
}

/**
 * Pasa cualquier imagen (PNG, JPG, WEBP o SVG) a PNG para el PDF, achicada
 * a lo que se ve. Sin CORS o con un archivo roto devuelve null y el PDF
 * sale con el nombre en lugar del logo.
 */
export async function logoParaPdf(src: string): Promise<Logo | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    await img.decode();
    const escala = Math.min(1, 600 / (img.naturalWidth || 600), 208 / (img.naturalHeight || 208));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round((img.naturalWidth || 600) * escala));
    lienzo.height = Math.max(1, Math.round((img.naturalHeight || 208) * escala));
    lienzo.getContext('2d')!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/png'));
    if (!blob) return null;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), tipo: 'png' };
  } catch {
    return null;
  }
}

export function descargar(bytes: Uint8Array, nombre: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const nombreArchivo = (d: DatosComprobante, numero: string) =>
  `${d.tipo === 'invoice' ? 'Invoice' : 'Recibo'} ${numero} - ${d.receptor.nombre.trim() || 'sin nombre'}.pdf`.replace(/[\\/:*?"<>|]/g, '');

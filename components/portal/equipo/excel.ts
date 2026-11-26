import { strToU8, zipSync } from 'fflate';
import { ROL_COMERCIAL, rolDe, type IntegranteEquipo } from '../crm/tipos';
import { ROTULO_ESTADO, ROTULO_MEDIDA, aTiempo, esNumerico, nombreMes, textoAlcance, type Hito, type Objetivo, type Reporte, type Respuesta, type Victoria } from './tipos';

/**
 * Excel con la marca de FIRMA, armado en el navegador (no suma una función
 * en Vercel). Portada con el logo, la empresa y el período, y una hoja por
 * tema. Las cifras de la portada y el avance de cada objetivo son fórmulas
 * sobre las hojas de datos, así se pueden revisar y recalcular.
 * Archivo para títulos y Calibri para el resto: Excel no incrusta letras y
 * la mayoría no tiene Archivo, así que la marca la llevan el logo y los colores.
 */

export interface DatosExcel {
  empresa: string;
  /** Período del informe, AAAA-MM-DD. */
  desde: string;
  hasta: string;
  generado: Date;
  equipo: IntegranteEquipo[];
  objetivos: Objetivo[];
  reportes: Reporte[];
  victorias: Victoria[];
  respuestas: Respuesta[];
  hitos: Hito[];
  monedas: string[];
  /** PNG del logo de FIRMA en tinta. */
  logo?: Uint8Array | null;
}

/* ------------------------------------------------------------------ */
/* Celdas                                                               */
/* ------------------------------------------------------------------ */
type Celda =
  | { t: 's'; v: string; s?: number }
  | { t: 'n'; v: number; s?: number }
  | { t: 'd'; v: string; s?: number }
  | { t: 'dt'; v: string; s?: number }
  | { t: 'f'; v: string; s?: number }
  | { t: 'x'; s: number }
  | null;

/** Índices de cellXfs en estilos(). */
const E = {
  base: 0,
  titulo: 1,
  encabezado: 2,
  texto: 3,
  fecha: 4,
  monto: 5,
  porcentaje: 6,
  fechaHora: 7,
  secundario: 8,
  fondo: 9,
  subtitulo: 10,
  etiqueta: 11,
  dato: 12,
  datoFecha: 13,
  datoNumero: 14,
  datoPorcentaje: 15,
  entero: 16,
  textoLargo: 17,
  nota: 18,
  datoMonto: 19,
} as const;

const s = (v: string | null | undefined, estilo: number = E.texto): Celda => (v === null || v === undefined || v === '' ? { t: 'x', s: estilo } : { t: 's', v, s: estilo });
const n = (v: number | null | undefined, estilo: number = E.monto): Celda => (v === null || v === undefined || Number.isNaN(v) ? { t: 'x', s: estilo } : { t: 'n', v, s: estilo });
const d = (v: string | null | undefined, estilo: number = E.fecha): Celda => (v ? { t: 'd', v, s: estilo } : { t: 'x', s: estilo });
const dt = (v: string | null | undefined, estilo: number = E.fechaHora): Celda => (v ? { t: 'dt', v, s: estilo } : { t: 'x', s: estilo });
const f = (v: string, estilo: number = E.monto): Celda => ({ t: 'f', v, s: estilo });

const xml = (t: string) =>
  t
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function columna(i: number): string {
  let c = '';
  let x = i + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    c = String.fromCharCode(65 + r) + c;
    x = Math.floor((x - 1) / 26);
  }
  return c;
}

const DIA = 86400000;
const BASE = Date.UTC(1899, 11, 30);
/** Fecha AAAA-MM-DD como número de serie de Excel. */
export const serieFecha = (iso: string) => {
  const [a, m, dia] = iso.slice(0, 10).split('-').map(Number);
  return (Date.UTC(a, m - 1, dia) - BASE) / DIA;
};
/** Fecha y hora en la zona de quien descarga. */
const serieFechaHora = (iso: string) => {
  const x = new Date(iso);
  return (Date.UTC(x.getFullYear(), x.getMonth(), x.getDate(), x.getHours(), x.getMinutes(), x.getSeconds()) - BASE) / DIA;
};

function celdaXml(c: Celda, ref: string): string {
  if (!c) return '';
  const estilo = c.s ? ` s="${c.s}"` : '';
  switch (c.t) {
    case 'x':
      return `<c r="${ref}"${estilo}/>`;
    case 's':
      return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${xml(c.v)}</t></is></c>`;
    case 'n':
      return `<c r="${ref}"${estilo}><v>${c.v}</v></c>`;
    case 'd':
      return `<c r="${ref}"${estilo}><v>${serieFecha(c.v)}</v></c>`;
    case 'dt':
      return `<c r="${ref}"${estilo}><v>${serieFechaHora(c.v).toFixed(6)}</v></c>`;
    case 'f':
      return `<c r="${ref}"${estilo}><f>${xml(c.v)}</f></c>`;
  }
}

interface Hoja {
  nombre: string;
  filas: Celda[][];
  anchos: number[];
  /** Fila de encabezados congelada y con filtro. */
  tabla?: boolean;
  logo?: boolean;
  /** Alto de algunas filas, por número de fila desde 1. */
  altos?: Record<number, number>;
  /** Rangos de celdas combinadas, como B20:G20. */
  combinar?: string[];
}

function hojaXml(h: Hoja): string {
  const ultimaCol = Math.max(1, ...h.filas.map((f) => f.length));
  const ultimaFila = Math.max(1, h.filas.length);
  const rango = `A1:${columna(ultimaCol - 1)}${ultimaFila}`;
  const vista = h.tabla
    ? '<sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>'
    : '<sheetView workbookViewId="0" showGridLines="0"/>';
  const cols = h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const filas = h.filas
    .map((fila, i) => {
      const alto = h.altos?.[i + 1];
      const celdas = fila.map((c, j) => celdaXml(c, `${columna(j)}${i + 1}`)).join('');
      return `<row r="${i + 1}"${alto ? ` ht="${alto}" customHeight="1"` : ''}>${celdas}</row>`;
    })
    .join('');
  const filtro = h.tabla && h.filas.length > 1 ? `<autoFilter ref="${rango}"/>` : '';
  const combinadas = h.combinar?.length ? `<mergeCells count="${h.combinar.length}">${h.combinar.map((r) => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>` : '';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    // Al imprimir, cada hoja entra a lo ancho de la página; las tablas, apaisadas.
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="${rango}"/><sheetViews>${vista}</sheetViews><sheetFormatPr defaultRowHeight="18"/>` +
    `<cols>${cols}</cols><sheetData>${filas}</sheetData>${filtro}${combinadas}` +
    '<pageMargins left="0.6" right="0.6" top="0.7" bottom="0.7" header="0.3" footer="0.3"/>' +
    `<pageSetup paperSize="9" orientation="${h.tabla ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>` +
    (h.logo ? '<drawing r:id="rId1"/>' : '') +
    '</worksheet>'
  );
}

function estilos(): string {
  const tinta = 'FF1B1F1B';
  const marfil = 'FFF5F3EC';
  const piedra = 'FF6B6553';
  const bosque = 'FF173A2F';
  const fuente = (nombre: string, tam: number, color: string, negrita = false) =>
    `<font>${negrita ? '<b/>' : ''}<sz val="${tam}"/><color rgb="${color}"/><name val="${nombre}"/><family val="2"/></font>`;
  const fuentes = [
    fuente('Calibri', 11, tinta),
    fuente('Archivo', 22, tinta, true),
    fuente('Archivo', 11, marfil, true),
    fuente('Calibri', 11, piedra),
    fuente('Archivo', 13, bosque, true),
    fuente('Calibri', 12, tinta, true),
    fuente('Calibri', 10, piedra),
  ];
  const relleno = (c: string) => `<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`;
  const rellenos = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', relleno(marfil), relleno(tinta)];
  const bordes = [
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FFDAD6C8"/></bottom><diagonal/></border>',
  ];
  const xf = (numFmt: number, font: number, fill: number, border: number, extra = '') =>
    `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${numFmt ? ' applyNumberFormat="1"' : ''}${font ? ' applyFont="1"' : ''}${fill ? ' applyFill="1"' : ''}${border ? ' applyBorder="1"' : ''}${extra ? ` applyAlignment="1">${extra}</xf>` : '/>'}`;
  const arriba = '<alignment vertical="top"/>';
  const ajustar = '<alignment vertical="top" wrapText="1"/>';
  const centro = '<alignment vertical="center"/>';
  const dato = '<alignment horizontal="left" vertical="center"/>';
  const xfs = [
    xf(0, 0, 0, 0), // base
    xf(0, 1, 2, 0, centro), // titulo
    xf(0, 2, 3, 0, centro), // encabezado
    xf(0, 0, 0, 1, arriba), // texto
    xf(164, 0, 0, 1, arriba), // fecha
    xf(165, 0, 0, 1, arriba), // monto
    xf(9, 0, 0, 1, arriba), // porcentaje
    xf(166, 0, 0, 1, arriba), // fechaHora
    xf(0, 3, 0, 1, arriba), // secundario
    xf(0, 0, 2, 0), // fondo
    xf(0, 4, 2, 0, centro), // subtitulo
    xf(0, 3, 2, 0, centro), // etiqueta
    xf(0, 5, 2, 0, dato), // dato
    xf(164, 5, 2, 0, dato), // datoFecha
    xf(3, 5, 2, 0, dato), // datoNumero
    xf(9, 5, 2, 0, dato), // datoPorcentaje
    xf(3, 0, 0, 1, arriba), // entero
    xf(0, 0, 0, 1, ajustar), // textoLargo
    xf(0, 6, 2, 0, centro), // nota
    xf(165, 5, 2, 0, dato), // datoMonto
  ];
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy hh:mm"/></numFmts>' +
    `<fonts count="${fuentes.length}">${fuentes.join('')}</fonts>` +
    `<fills count="${rellenos.length}">${rellenos.join('')}</fills>` +
    `<borders count="${bordes.length}">${bordes.join('')}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
}

/** Ancho y alto de un PNG, para que el logo no se deforme. */
function medidasPng(png: Uint8Array): { ancho: number; alto: number } | null {
  if (png.length < 24 || png[0] !== 0x89 || png[1] !== 0x50) return null;
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { ancho: v.getUint32(16), alto: v.getUint32(20) };
}

function dibujoXml(png: Uint8Array): string {
  const m = medidasPng(png) ?? { ancho: 600, alto: 136 };
  const ancho = 200 * 9525;
  const alto = Math.round((200 * m.alto) / m.ancho) * 9525;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<xdr:oneCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>95250</xdr:rowOff></xdr:from><xdr:ext cx="${ancho}" cy="${alto}"/>` +
    '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="FIRMA" descr="FIRMA"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
    '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${ancho}" cy="${alto}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>` +
    '<xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>'
  );
}

/* ------------------------------------------------------------------ */
/* Las hojas                                                            */
/* ------------------------------------------------------------------ */
const rotuloRol = (r: keyof typeof ROL_COMERCIAL) => ROL_COMERCIAL[r] ?? r;

function encabezados(titulos: string[]): Celda[] {
  return titulos.map((t) => s(t, E.encabezado));
}

export function armarExcel(datos: DatosExcel): Uint8Array {
  const persona = new Map(datos.equipo.map((m) => [m.id, m]));
  const nombre = (id: string | null) => (id ? (persona.get(id)?.nombre ?? 'Sin nombre') : '');
  const reporte = new Map(datos.reportes.map((r) => [r.id, r]));
  const hito = new Map(datos.hitos.map((h) => [h.id, h]));
  const codigoObjetivo = new Map(datos.objetivos.map((o, i) => [o.id, `O${i + 1}`]));
  const codigoReporte = new Map(datos.reportes.map((r, i) => [r.id, `R${i + 1}`]));

  // Victorias. El estado va con el mismo rótulo que en el portal.
  const victorias = [...datos.victorias].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado_en.localeCompare(b.creado_en));
  const objetivoTitulo = new Map(datos.objetivos.map((o) => [o.id, o.titulo]));
  const hojaVictorias: Hoja = {
    nombre: 'Victorias',
    tabla: true,
    anchos: [12, 24, 16, 36, 44, 14, 10, 12, 28, 14, 28, 34],
    filas: [
      encabezados(['Fecha', 'Persona', 'Rol', 'Victoria', 'Detalle', 'Valor', 'Moneda', 'Código del objetivo', 'Objetivo', 'Estado', 'Hito', 'Evidencia']),
      ...victorias.map((v) => {
        const m = persona.get(v.miembro_id);
        return [
          d(v.fecha),
          s(nombre(v.miembro_id)),
          s(m ? rolDe(m) : ''),
          s(v.titulo),
          s(v.detalle, E.textoLargo),
          n(v.valor),
          s(v.moneda),
          s(v.objetivo_id ? (codigoObjetivo.get(v.objetivo_id) ?? '') : '', E.secundario),
          s(v.objetivo_id ? (objetivoTitulo.get(v.objetivo_id) ?? 'Otro período') : ''),
          s(ROTULO_ESTADO[v.estado]),
          s(v.hito_id ? (hito.get(v.hito_id)?.titulo ?? '') : ''),
          s(v.evidencia_url ?? (v.evidencia_ruta ? `Archivo en el portal (${v.evidencia_nombre ?? 'evidencia'})` : ''), E.secundario),
        ];
      }),
    ],
  };

  // Reportes, un renglón por respuesta, para poder sumar cada campo con fórmulas.
  const respuestas = [...datos.respuestas].sort((a, b) => a.periodo.localeCompare(b.periodo) || nombre(a.miembro_id).localeCompare(nombre(b.miembro_id)));
  const filasReportes: Celda[][] = [];
  for (const r of respuestas) {
    const def = reporte.get(r.reporte_id);
    if (!def) continue;
    const enTiempo = aTiempo(r, def.frecuencia) ? 'Sí' : 'No';
    for (const c of def.campos) {
      const v = r.respuestas[c.clave];
      if (v === undefined || v === null || v === '') continue;
      const numerico = esNumerico(c.tipo) && typeof v === 'number';
      filasReportes.push([
        d(r.periodo),
        s(nombre(r.miembro_id)),
        s(def.titulo),
        s(c.etiqueta),
        numerico ? n(v as number) : s(null, E.monto),
        numerico ? s(null) : s(typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v), E.textoLargo),
        dt(r.enviado_en),
        s(enTiempo),
        s(codigoReporte.get(def.id) ?? '', E.secundario),
        s(c.clave, E.secundario),
      ]);
    }
  }
  const hojaReportes: Hoja = {
    nombre: 'Reportes',
    tabla: true,
    anchos: [12, 24, 30, 34, 14, 44, 17, 10, 10, 16],
    filas: [encabezados(['Período', 'Persona', 'Reporte', 'Campo', 'Número', 'Respuesta', 'Enviado', 'A tiempo', 'Código del reporte', 'Clave del campo']), ...filasReportes],
  };

  // Entregas, un renglón por reporte enviado.
  const hojaEntregas: Hoja = {
    nombre: 'Entregas',
    tabla: true,
    anchos: [12, 24, 16, 32, 12, 17, 10],
    filas: [
      encabezados(['Período', 'Persona', 'Rol', 'Reporte', 'Frecuencia', 'Enviado', 'A tiempo']),
      ...respuestas
        .filter((r) => reporte.has(r.reporte_id))
        .map((r) => {
          const def = reporte.get(r.reporte_id)!;
          const m = persona.get(r.miembro_id);
          return [
            d(r.periodo),
            s(nombre(r.miembro_id)),
            s(m ? rolDe(m) : ''),
            s(def.titulo),
            s(def.frecuencia === 'semanal' ? 'Semanal' : 'Diaria'),
            dt(r.enviado_en),
            s(aTiempo(r, def.frecuencia) ? 'Sí' : 'No'),
          ];
        }),
    ],
  };

  // Objetivos: un renglón por objetivo y persona. El avance es una fórmula sobre Victorias o Reportes.
  const filasObjetivos: Celda[][] = [];
  for (const o of datos.objetivos) {
    const personas: (string | null)[] =
      o.alcance === 'negocio' ? [null] : o.alcance === 'persona' ? [o.miembro_id] : datos.equipo.filter((m) => m.activo && m.rol_comercial === o.rol_comercial).map((m) => m.id);
    for (const p of personas) {
      const fila = filasObjetivos.length + 2;
      const codigo = codigoObjetivo.get(o.id)!;
      const porPersona = (col: string) => (p ? `,${col},$C${fila}` : '');
      let formula: string;
      if (o.medida === 'reporte') {
        const def = o.reporte_id ? reporte.get(o.reporte_id) : undefined;
        const cr = def ? (codigoReporte.get(def.id) ?? '') : '';
        formula = `SUMIFS(Reportes!$E:$E,Reportes!$I:$I,"${cr}",Reportes!$J:$J,"${o.campo ?? ''}",Reportes!$A:$A,">="&$E${fila},Reportes!$A:$A,"<="&$F${fila}${porPersona('Reportes!$B:$B')})`;
      } else {
        const criterios = `Victorias!$H:$H,"${codigo}",Victorias!$J:$J,"${ROTULO_ESTADO.validada}",Victorias!$A:$A,">="&$E${fila},Victorias!$A:$A,"<="&$F${fila}${porPersona('Victorias!$B:$B')}`;
        formula = o.medida === 'valor' ? `SUMIFS(Victorias!$F:$F,${criterios})` : `COUNTIFS(${criterios})`;
      }
      const def = o.reporte_id ? reporte.get(o.reporte_id) : undefined;
      const medida = o.medida === 'reporte' ? `${def?.campos.find((c) => c.clave === o.campo)?.etiqueta ?? 'Reporte'} (${def?.titulo ?? 'reporte'})` : ROTULO_MEDIDA[o.medida];
      filasObjetivos.push([
        s(codigo, E.secundario),
        s(o.titulo),
        s(p ? nombre(p) : textoAlcance(o, datos.equipo, rotuloRol)),
        s(medida),
        d(o.desde),
        d(o.hasta),
        n(o.meta),
        f(formula),
        f(`IF($G${fila}>0,$H${fila}/$G${fila},0)`, E.porcentaje),
      ]);
    }
  }
  const hojaObjetivos: Hoja = {
    nombre: 'Objetivos',
    tabla: true,
    anchos: [9, 34, 24, 34, 12, 12, 12, 12, 12],
    filas: [encabezados(['Código', 'Objetivo', 'Para', 'Cómo se mide', 'Desde', 'Hasta', 'Meta', 'Avance', 'Cumplido']), ...filasObjetivos],
  };

  const hojaEquipo: Hoja = {
    nombre: 'Equipo',
    tabla: true,
    anchos: [28, 20, 12],
    filas: [
      encabezados(['Persona', 'Rol', 'Estado']),
      ...[...datos.equipo]
        .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre))
        .map((m) => [s(m.nombre), s(rolDe(m)), s(m.activo ? 'Activo' : 'Inactivo')]),
    ],
  };

  // Portada. Las fechas del período están en C8 y C9: si se cambian, las cifras se recalculan.
  const enPeriodo = (hoja: string, col: string) => `${hoja}!$${col}:$${col},">="&$C$8,${hoja}!$${col}:$${col},"<="&$C$9`;
  const filasCifras: [string, Celda][] = [
    ['Victorias validadas', f(`COUNTIFS(Victorias!$J:$J,"${ROTULO_ESTADO.validada}",${enPeriodo('Victorias', 'A')})`, E.datoNumero)],
    ...datos.monedas.map((m): [string, Celda] => [
      `Valor validado en ${m}`,
      f(`SUMIFS(Victorias!$F:$F,Victorias!$G:$G,"${m}",Victorias!$J:$J,"${ROTULO_ESTADO.validada}",${enPeriodo('Victorias', 'A')})`, E.datoMonto),
    ]),
    ['Victorias para validar', f(`COUNTIFS(Victorias!$J:$J,"${ROTULO_ESTADO.pendiente}")`, E.datoNumero)],
    ['Reportes entregados', f(`COUNTIFS(${enPeriodo('Entregas', 'A')})`, E.datoNumero)],
  ];
  const filaEntregados = 12 + filasCifras.length - 1;
  filasCifras.push(['Entregados a tiempo', f(`IFERROR(COUNTIFS(Entregas!$G:$G,"Sí",${enPeriodo('Entregas', 'A')})/$C$${filaEntregados},0)`, E.datoPorcentaje)]);
  filasCifras.push(['Objetivos cumplidos', f(`COUNTIF(Objetivos!$I:$I,">=1")`, E.datoNumero)]);
  filasCifras.push(['Objetivos en el informe', f(`MAX(COUNTA(Objetivos!$A:$A)-1,0)`, E.datoNumero)]);

  const ANCHO = 8;
  const vacia = (): Celda[] => Array.from({ length: ANCHO }, () => ({ t: 'x', s: E.fondo }) as Celda);
  const fila = (celdas: Record<number, Celda>): Celda[] => {
    const r = vacia();
    for (const [i, c] of Object.entries(celdas)) r[Number(i)] = c;
    return r;
  };
  const portada: Celda[][] = [
    vacia(),
    vacia(), // el logo
    vacia(),
    vacia(),
    fila({ 1: s('Métricas del equipo', E.titulo) }),
    fila({ 1: s(datos.empresa, E.subtitulo) }),
    vacia(),
    fila({ 1: s('Desde', E.etiqueta), 2: d(datos.desde, E.datoFecha) }),
    fila({ 1: s('Hasta', E.etiqueta), 2: d(datos.hasta, E.datoFecha) }),
    fila({ 1: s('Período', E.etiqueta), 2: s(nombreMes(datos.desde), E.dato) }),
    vacia(),
    ...filasCifras.map(([t, c]) => fila({ 1: s(t, E.etiqueta), 2: c })),
    vacia(),
    fila({ 1: s('Las cifras son fórmulas sobre las otras hojas y se recalculan si cambiás las fechas de arriba.', E.nota) }),
    fila({ 1: s('Solo suman las victorias validadas.', E.nota) }),
    fila({
      1: s(
        `Descargado del portal de FIRMA el ${datos.generado.toLocaleDateString('es-AR')} a las ${datos.generado.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}.`,
        E.nota,
      ),
    }),
    ...Array.from({ length: 8 }, vacia),
  ];
  // Las notas van en una sola línea, a lo ancho de la portada.
  const primeraNota = portada.findIndex((x) => x[1]?.t === 's' && x[1].s === E.nota) + 1;
  const hojaPortada: Hoja = {
    nombre: 'Portada',
    anchos: [4, 34, 22, 14, 14, 14, 14, 4],
    filas: portada,
    combinar: [0, 1, 2].map((i) => `B${primeraNota + i}:G${primeraNota + i}`),
    logo: Boolean(datos.logo),
    altos: { 2: 30, 3: 18, 5: 34, 6: 22 },
  };

  const hojas = [hojaPortada, hojaObjetivos, hojaVictorias, hojaReportes, hojaEntregas, hojaEquipo];
  const archivos: Record<string, Uint8Array> = {};
  const texto = (ruta: string, contenido: string) => (archivos[ruta] = strToU8(contenido));

  texto(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      hojas
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      (datos.logo ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '') +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>',
  );
  texto(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>',
  );
  texto(
    'docProps/core.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      `<dc:title>${xml(`Métricas del equipo · ${datos.empresa}`)}</dc:title><dc:creator>FIRMA</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${datos.generado.toISOString().slice(0, 19)}Z</dcterms:created>` +
      '</cp:coreProperties>',
  );
  texto(
    'docProps/app.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>FIRMA</Application></Properties>',
  );
  const filtros = hojas
    .map((h, i) =>
      h.tabla && h.filas.length > 1
        ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${h.nombre}'!$A$1:$${columna(Math.max(...h.filas.map((x) => x.length)) - 1)}$${h.filas.length}</definedName>`
        : '',
    )
    .join('');
  texto(
    'xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView activeTab="0"/></bookViews>' +
      `<sheets>${hojas.map((h, i) => `<sheet name="${xml(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
      (filtros ? `<definedNames>${filtros}</definedNames>` : '') +
      '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
      '</workbook>',
  );
  texto(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      hojas
        .map(
          (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('') +
      `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>',
  );
  texto('xl/styles.xml', estilos());
  hojas.forEach((h, i) => texto(`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h)));
  if (datos.logo) {
    texto(
      'xl/worksheets/_rels/sheet1.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>',
    );
    texto('xl/drawings/drawing1.xml', dibujoXml(datos.logo));
    texto(
      'xl/drawings/_rels/drawing1.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>',
    );
    archivos['xl/media/image1.png'] = datos.logo;
  }
  return zipSync(archivos, { level: 6 });
}

/** Nombre del archivo: «FIRMA · Equipo · Empresa · Diciembre de 2026.xlsx», sin caracteres que rompan. */
export function nombreArchivo(empresa: string, desde: string): string {
  const limpio = (t: string) =>
    t
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return `FIRMA · Equipo · ${limpio(empresa)} · ${limpio(nombreMes(desde))}.xlsx`;
}

export async function logoFirma(): Promise<Uint8Array | null> {
  try {
    const r = await fetch('/mail/firma-lockup.png');
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export function descargar(bytes: Uint8Array, nombre: string): void {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

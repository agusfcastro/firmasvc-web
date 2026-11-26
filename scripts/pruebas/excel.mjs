/**
 * Pruebas del Excel con marca del equipo (components/portal/equipo/excel.ts).
 * Arma un libro con datos de ejemplo y revisa que tenga sus partes, la
 * portada con el logo y las fórmulas de avance que replican
 * equipo_objetivos_avance() de la migración 0076.
 *
 *   node scripts/pruebas/excel.mjs [ruta.xlsx]
 *
 * Con una ruta, además guarda el libro para abrirlo o recalcularlo con
 * LibreOffice y comparar las cifras con las de la base.
 */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// El código del portal importa sin extensión, como lo resuelve Vite. Acá se prueba el .ts.
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (/^\.{1,2}\//.test(especificador) && !path.extname(especificador) && contexto.parentURL?.startsWith('file:')) {
      for (const ext of ['.ts', '.tsx']) {
        const alt = new URL(especificador + ext, contexto.parentURL);
        if (existsSync(fileURLToPath(alt))) return siguiente(alt.href, contexto);
      }
    }
    return siguiente(especificador, contexto);
  },
});

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { armarExcel, columna, serieFecha, nombreArchivo } = await import('../../components/portal/equipo/excel.ts');
const { unzipSync, strFromU8 } = await import('fflate');

let hechas = 0;
const prueba = (nombre, f) => {
  f();
  hechas++;
  console.log(`✓ ${nombre}`);
};

const org = 'aaaaaaaa-0000-0000-0000-000000000000';
const m = (id, nombre, rol) => ({ id, organizacion_id: org, nombre, rol_comercial: rol, cargo: null, email: null, usuario_id: null, activo: true });
const equipo = [m('m1', 'Ana Closer', 'closer'), m('m2', 'Beto Closer', 'closer'), m('m3', 'Caro Setter', 'setter')];
const reporteCloser = {
  id: 'r1',
  organizacion_id: org,
  rol_comercial: 'closer',
  titulo: 'Reporte del día del closer',
  frecuencia: 'diaria',
  activo: true,
  campos: [
    { clave: 'cierres', etiqueta: 'Cierres', tipo: 'numero', obligatoria: true },
    { clave: 'objecion', etiqueta: 'La objeción & más <común>', tipo: 'texto' },
  ],
};
const objetivos = [
  {
    id: 'o1',
    organizacion_id: org,
    titulo: '12 cierres en diciembre',
    alcance: 'rol',
    rol_comercial: 'closer',
    miembro_id: null,
    medida: 'reporte',
    reporte_id: 'r1',
    campo: 'cierres',
    meta: 12,
    desde: '2026-12-01',
    hasta: '2026-12-31',
    activo: true,
  },
  {
    id: 'o2',
    organizacion_id: org,
    titulo: 'USD 10.000 vendidos',
    alcance: 'negocio',
    rol_comercial: null,
    miembro_id: null,
    medida: 'valor',
    reporte_id: null,
    campo: null,
    meta: 10000,
    desde: '2026-12-01',
    hasta: '2026-12-31',
    activo: true,
  },
  {
    id: 'o3',
    organizacion_id: org,
    titulo: 'Tres testimonios',
    alcance: 'persona',
    rol_comercial: null,
    miembro_id: 'm3',
    medida: 'victorias',
    reporte_id: null,
    campo: null,
    meta: 3,
    desde: '2026-12-01',
    hasta: '2026-12-31',
    activo: true,
  },
];
const v = (id, miembro, fecha, estado, extra = {}) => ({
  id,
  organizacion_id: org,
  miembro_id: miembro,
  titulo: `Victoria ${id}`,
  detalle: null,
  fecha,
  valor: null,
  moneda: null,
  objetivo_id: null,
  hito_id: null,
  evidencia_url: null,
  evidencia_ruta: null,
  evidencia_nombre: null,
  estado,
  nota: null,
  validada_en: null,
  creado_en: `${fecha}T12:00:00Z`,
  ...extra,
});
const victorias = [
  v('v1', 'm1', '2026-12-03', 'validada', { valor: 2000, moneda: 'USD', objetivo_id: 'o2' }),
  v('v2', 'm2', '2026-12-04', 'validada', { valor: 3500, moneda: 'USD', objetivo_id: 'o2' }),
  v('v3', 'm2', '2026-12-05', 'pendiente', { valor: 9999, moneda: 'USD', objetivo_id: 'o2' }),
  v('v4', 'm3', '2026-12-06', 'validada', { objetivo_id: 'o3' }),
  v('v5', 'm3', '2026-12-07', 'rechazada', { objetivo_id: 'o3' }),
  v('v6', 'm1', '2026-11-28', 'validada', { valor: 700, moneda: 'USD', objetivo_id: 'o2' }),
];
const r = (id, miembro, periodo, cierres, enviado) => ({
  id,
  organizacion_id: org,
  reporte_id: 'r1',
  miembro_id: miembro,
  periodo,
  respuestas: { cierres, objecion: 'Precio' },
  enviado_en: enviado,
  actualizado_en: enviado,
});
const respuestas = [
  r('a1', 'm1', '2026-12-01', 2, '2026-12-01T21:00:00Z'),
  r('a2', 'm1', '2026-12-02', 3, '2026-12-05T21:00:00Z'),
  r('a3', 'm2', '2026-12-01', 1, '2026-12-01T22:00:00Z'),
  r('a4', 'm2', '2026-11-30', 5, '2026-11-30T22:00:00Z'),
];
const logo = readFileSync(path.join(raiz, 'public/mail/firma-lockup.png'));

const bytes = armarExcel({
  empresa: 'Negocio & Cía',
  desde: '2026-12-01',
  hasta: '2026-12-31',
  generado: new Date('2026-12-20T15:00:00Z'),
  equipo,
  objetivos,
  reportes: [reporteCloser],
  victorias,
  respuestas,
  hitos: [],
  monedas: ['USD', 'PEN'],
  logo: new Uint8Array(logo),
});
const partes = unzipSync(bytes);
const texto = (p) => strFromU8(partes[p]);
/** El XML sin las entidades, para leer las fórmulas como se escriben en Excel. */
const plano = (p) =>
  texto(p)
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

prueba('las columnas se nombran como en Excel', () => {
  assert.equal(columna(0), 'A');
  assert.equal(columna(25), 'Z');
  assert.equal(columna(26), 'AA');
  assert.equal(columna(51), 'AZ');
});

prueba('las fechas van como número de serie de Excel', () => {
  assert.equal(serieFecha('1899-12-31'), 1);
  assert.equal(serieFecha('2026-12-01'), 46357);
});

prueba('el libro trae sus partes, una hoja por tema y el logo', () => {
  for (const p of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/drawings/drawing1.xml', 'xl/media/image1.png']) assert.ok(partes[p], `falta ${p}`);
  const libro = texto('xl/workbook.xml');
  for (const h of ['Portada', 'Objetivos', 'Victorias', 'Reportes', 'Entregas', 'Equipo']) assert.match(libro, new RegExp(`name="${h}"`));
  assert.match(libro, /fullCalcOnLoad="1"/);
  assert.match(texto('xl/worksheets/sheet1.xml'), /<drawing r:id="rId1"\/>/);
  assert.deepEqual([...partes['xl/media/image1.png'].slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

prueba('la marca va en las letras y los colores', () => {
  const e = texto('xl/styles.xml');
  assert.match(e, /<name val="Archivo"\/>/);
  assert.match(e, /<name val="Calibri"\/>/);
  assert.match(e, /FF1B1F1B/);
  assert.match(e, /FFF5F3EC/);
});

prueba('los textos se escapan', () => {
  const portada = texto('xl/worksheets/sheet1.xml');
  assert.match(portada, /Negocio &amp; Cía/);
  assert.doesNotMatch(portada, /Negocio & Cía/);
  assert.match(texto('xl/worksheets/sheet4.xml'), /La objeción &amp; más &lt;común&gt;/);
});

prueba('cada objetivo por rol tiene un renglón por persona activa de ese rol', () => {
  const h = texto('xl/worksheets/sheet2.xml');
  assert.equal((h.match(/12 cierres en diciembre/g) ?? []).length, 2);
  assert.match(h, /Ana Closer/);
  assert.match(h, /Beto Closer/);
});

prueba('el avance es una fórmula sobre las hojas de datos', () => {
  const h = plano('xl/worksheets/sheet2.xml');
  assert.ok(h.includes('<f>SUMIFS(Reportes!$E:$E,Reportes!$I:$I,"R1",Reportes!$J:$J,"cierres",Reportes!$A:$A,">="&$E2,Reportes!$A:$A,"<="&$F2,Reportes!$B:$B,$C2)</f>'));
  assert.ok(h.includes('<f>SUMIFS(Victorias!$F:$F,Victorias!$H:$H,"O2",Victorias!$J:$J,"Validada",Victorias!$A:$A,">="&$E4,Victorias!$A:$A,"<="&$F4)</f>'));
  assert.ok(h.includes('<f>COUNTIFS(Victorias!$H:$H,"O3",Victorias!$J:$J,"Validada",Victorias!$A:$A,">="&$E5,Victorias!$A:$A,"<="&$F5,Victorias!$B:$B,$C5)</f>'));
  assert.ok(h.includes('<f>IF($G2>0,$H2/$G2,0)</f>'));
});

prueba('las cifras de la portada usan las fechas de la portada', () => {
  const p = plano('xl/worksheets/sheet1.xml');
  assert.ok(p.includes('COUNTIFS(Victorias!$J:$J,"Validada",Victorias!$A:$A,">="&$C$8,Victorias!$A:$A,"<="&$C$9)'));
  assert.ok(p.includes('Valor validado en PEN'));
  assert.ok(p.includes('<c r="C8" s="13"><v>46357</v></c>'));
});

prueba('el nombre del archivo no lleva caracteres que rompan', () => {
  assert.equal(nombreArchivo('Ecom/Project: "MOST"', '2026-12-01'), 'FIRMA · Equipo · Ecom Project MOST · Diciembre de 2026.xlsx');
});

if (process.argv[2]) {
  writeFileSync(process.argv[2], bytes);
  console.log(`  guardado en ${process.argv[2]}`);
}
console.log(`\n${hechas} pruebas del Excel pasaron.`);

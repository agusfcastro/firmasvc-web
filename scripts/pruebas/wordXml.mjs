/**
 * Pruebas del motor que edita el texto de un Word sin tocar su formato
 * (components/portal/editor/wordXml.ts).
 *
 *   node scripts/pruebas/wordXml.mjs
 */
import assert from 'node:assert/strict';
import { TAB, armarDocumento, editarParrafo, leerDocumento, parrafoBorrado, parrafoNuevo } from '../../components/portal/editor/wordXml.ts';

const NEGRITA = '<w:r><w:rPr><w:b/></w:rPr><w:t>EL LOCADOR</w:t></w:r>';
const P1 =
  '<w:p w:rsidR="00AA"><w:pPr><w:pStyle w:val="Clausula"/><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs><w:rPr><w:i/></w:rPr></w:pPr>' +
  `<w:r><w:t xml:space="preserve">PRIMERA: </w:t></w:r>${NEGRITA}<w:r><w:t xml:space="preserve"> se obliga a pagar en 30 días &amp; sin mora.</w:t></w:r></w:p>`;
const P2 = '<w:p><w:r><w:t>Firma:</w:t><w:tab/><w:t>Aclaración</w:t></w:r></w:p>';
const P3 = '<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/></w:rPr></w:pPr></w:p>';
const P4 = '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:t>3</w:t></w:r></w:p>';
const CELDA = '<w:tbl><w:tr><w:tc><w:tcPr><w:tcW w:w="100"/></w:tcPr><w:p><w:r><w:t>Celda</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
const FINAL = '<w:p><w:pPr><w:sectPr><w:pgSz w:w="1"/></w:sectPr></w:pPr><w:r><w:t>Último</w:t></w:r></w:p>';
const XML = `<w:document><w:body>${P1}${P2}${P3}${P4}${CELDA}<w:p/>${FINAL}<w:sectPr/></w:body></w:document>`;

const doc = leerDocumento(XML);
const textos = doc.parrafos.map((p) => p.texto);
let hechas = 0;
const prueba = (nombre, f) => {
  f();
  hechas++;
  console.log(`✓ ${nombre}`);
};

prueba('separa los párrafos y vuelve a armar el documento igual', () => {
  assert.equal(doc.parrafos.length, 7);
  assert.equal(armarDocumento(doc, []), XML);
  assert.equal(textos[0], 'PRIMERA: EL LOCADOR se obliga a pagar en 30 días & sin mora.');
  assert.equal(textos[1], `Firma:${TAB}Aclaración`);
  assert.equal(textos[2], '');
});

prueba('un párrafo con un campo no se edita', () => {
  assert.equal(doc.parrafos[3].editable, false);
  assert.equal(doc.parrafos[0].editable, true);
});

prueba('sin cambios, el párrafo queda idéntico', () => {
  assert.equal(editarParrafo(P1, textos[0]), P1);
});

prueba('cambiar una palabra toca solo su tramo y conserva la negrita', () => {
  const p = editarParrafo(P1, textos[0].replace('30 días', '15 días hábiles'));
  assert.ok(p.includes(NEGRITA));
  assert.ok(p.includes('<w:pStyle w:val="Clausula"/>'));
  assert.ok(p.includes('<w:tab w:val="left" w:pos="720"/>'));
  assert.equal(leerDocumento(p).parrafos[0].texto, 'PRIMERA: EL LOCADOR se obliga a pagar en 15 días hábiles & sin mora.');
});

prueba('lo que reemplaza a un texto en negrita queda en negrita', () => {
  const p = editarParrafo(P1, textos[0].replace('EL LOCADOR', 'LA LOCADORA'));
  assert.ok(p.includes('<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">LA LOCADORA</w:t></w:r>'));
});

prueba('lo que se escribe al final de la negrita sigue en negrita', () => {
  const p = editarParrafo(P1, textos[0].replace('EL LOCADOR', 'EL LOCADORES'));
  assert.ok(p.includes('<w:b/></w:rPr><w:t xml:space="preserve">EL LOCADORES</w:t>'));
});

prueba('escapa los signos y limpia saltos de línea', () => {
  const p = editarParrafo(P1, 'A < B & C >\nD');
  assert.equal(leerDocumento(p).parrafos[0].texto, 'A < B & C > D');
  assert.ok(p.includes('&lt;') && p.includes('&amp;') && !/<w:t[^>]*>[^<]*\n/.test(p));
});

prueba('las tabulaciones se conservan, se borran y no se confunden con las de las propiedades', () => {
  assert.equal(editarParrafo(P2, `Firma y sello:${TAB}Aclaración`), '<w:p><w:r><w:t xml:space="preserve">Firma y sello:</w:t><w:tab/><w:t>Aclaración</w:t></w:r></w:p>');
  assert.equal(leerDocumento(editarParrafo(P2, 'Firma: Aclaración')).parrafos[0].texto, 'Firma: Aclaración');
  assert.ok(!editarParrafo(P2, 'Firma: Aclaración').includes('<w:tab/>'));
  assert.equal(leerDocumento(editarParrafo(P2, `Firma:${TAB}DNI:${TAB}Aclaración`)).parrafos[0].texto, `Firma:${TAB}DNI:${TAB}Aclaración`);
});

prueba('un párrafo vacío recibe texto con el formato de su marca', () => {
  const p = editarParrafo(P3, 'ANEXO I');
  assert.equal(p, '<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/></w:rPr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">ANEXO I</w:t></w:r></w:p>');
  assert.equal(editarParrafo('<w:p/>', 'Hola'), '<w:p><w:r><w:t xml:space="preserve">Hola</w:t></w:r></w:p>');
});

prueba('vaciar un párrafo deja sus tramos sin texto', () => {
  assert.equal(leerDocumento(editarParrafo(P1, '')).parrafos[0].texto, '');
});

prueba('un párrafo nuevo copia el formato y no la sección', () => {
  const p = parrafoNuevo(FINAL, 'Otro');
  assert.equal(p, '<w:p><w:pPr></w:pPr><w:r><w:t xml:space="preserve">Otro</w:t></w:r></w:p>');
  const q = parrafoNuevo(P1, 'SEGUNDA: algo');
  assert.ok(q.startsWith('<w:p><w:pPr><w:pStyle w:val="Clausula"/>') && !q.includes('rsidR'));
  assert.equal(parrafoNuevo(P2, ''), '<w:p></w:p>');
});

prueba('al borrar, la sección no se pierde y la celda no queda vacía', () => {
  assert.equal(parrafoBorrado(P1), '');
  assert.ok(parrafoBorrado(FINAL).includes('<w:sectPr>') && !parrafoBorrado(FINAL).includes('Último'));
  const salida = [];
  salida[4] = '';
  salida[5] = '';
  const xml = armarDocumento(doc, salida);
  assert.ok(xml.includes('</w:tcPr><w:p/></w:tc>'));
  assert.equal(leerDocumento(xml).parrafos.length, 6);
});

prueba('un párrafo con otro adentro queda como uno solo y no se edita', () => {
  const d = leerDocumento('<w:body><w:p><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>adentro</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p><w:p><w:r><w:t>afuera</w:t></w:r></w:p></w:body>');
  assert.equal(d.parrafos.length, 2);
  assert.equal(d.parrafos[0].editable, false);
  assert.equal(d.parrafos[1].texto, 'afuera');
});

prueba('no parte un emoji al comparar', () => {
  const p = '<w:p><w:r><w:t>Hola 😀 chau</w:t></w:r></w:p>';
  assert.equal(leerDocumento(editarParrafo(p, 'Hola 😁 chau')).parrafos[0].texto, 'Hola 😁 chau');
});

console.log(`\n${hechas} pruebas pasaron.`);

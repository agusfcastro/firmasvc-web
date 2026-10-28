/**
 * Contrato modelo de la empresa demo. Se arma acá como Word (.docx) para no
 * guardar un binario en el repo: cada variable va entera en un solo tramo,
 * así completarWord la encuentra siempre. Es un texto de ejemplo, ficticio,
 * para mostrar cómo se genera un contrato desde la ficha del CRM.
 */
import { strToU8, zipSync } from 'fflate';

type Bloque = { titulo: string } | { texto: string; negrita?: boolean; centrado?: boolean };

const CONTENIDO: Bloque[] = [
  { titulo: 'CONTRATO DE PRESTACIÓN DE SERVICIOS' },
  { texto: 'Modelo de ejemplo de la empresa demo. No tiene validez legal.', centrado: true },
  {
    texto:
      'En la fecha {{FECHA}}, entre {{EMPRESA}}, en adelante «LA EMPRESA», y {{#RAZON_SOCIAL_CLIENTE}}{{RAZON_SOCIAL_CLIENTE}}{{#ID_FISCAL_CLIENTE}}, {{ID_FISCAL_CLIENTE}}{{/ID_FISCAL_CLIENTE}}{{#DOMICILIO}}, con domicilio en {{DOMICILIO}}{{/DOMICILIO}}, representada por {{NOMBRE}}{{#DNI}}, documento {{DNI}}{{/DNI}}{{#CARGO}}, en su carácter de {{CARGO}}{{/CARGO}},{{/RAZON_SOCIAL_CLIENTE}}{{^RAZON_SOCIAL_CLIENTE}}{{NOMBRE}}{{#DNI}}, DNI {{DNI}}{{/DNI}}{{#DOMICILIO}}, con domicilio en {{DOMICILIO}}{{/DOMICILIO}},{{/RAZON_SOCIAL_CLIENTE}} con mail {{EMAIL}}, en adelante «EL CLIENTE», acuerdan celebrar el presente contrato, que se rige por las siguientes cláusulas.',
  },
  { texto: 'PRIMERA. Objeto.', negrita: true },
  { texto: 'LA EMPRESA prestará a EL CLIENTE el servicio {{SERVICIO}}, con el alcance que se describe en la propuesta comercial aceptada, que forma parte de este contrato.' },
  { texto: 'SEGUNDA. Inicio y responsable.', negrita: true },
  { texto: 'El servicio comienza con el onboarding del {{FECHA_ONBOARDING}}.{{#RESPONSABLE}} La persona a cargo del seguimiento por parte de LA EMPRESA es {{RESPONSABLE}}.{{/RESPONSABLE}}' },
  { texto: 'TERCERA. Precio.', negrita: true },
  { texto: 'EL CLIENTE abonará la suma total de {{MONEDA_LETRAS}} {{MONTO_TOTAL_LETRAS}} ({{MONEDA}} {{MONTO_TOTAL}}), en la modalidad {{MODALIDAD}}, según el siguiente esquema:' },
  { texto: '{{ESQUEMA_PAGOS}}' },
  { texto: 'CUARTA. Condiciones particulares.', negrita: true },
  { texto: '{{CONDICIONES}}' },
  { texto: 'QUINTA. Falta de pago.', negrita: true },
  { texto: 'La falta de pago de cualquiera de las cuotas en su vencimiento permite a LA EMPRESA suspender el servicio hasta que se regularice, sin perjuicio de reclamar lo adeudado.' },
  { texto: 'SEXTA. Reembolsos.', negrita: true },
  { texto: 'EL CLIENTE puede arrepentirse dentro de los diez (10) días corridos desde la firma, con devolución de lo pagado. Pasado ese plazo, los montos abonados no son reembolsables.' },
  { texto: 'SÉPTIMA. Confidencialidad.', negrita: true },
  { texto: 'Las partes se obligan a mantener en reserva la información que conozcan con motivo de este contrato, durante su vigencia y por dos (2) años después de terminado.' },
  { texto: 'OCTAVA. Jurisdicción.', negrita: true },
  { texto: 'Para cualquier controversia, las partes se someten a los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires y constituyen domicilio en los indicados arriba.' },
  { texto: 'Contrato {{CODIGO}}. Se firma electrónicamente por ambas partes.' },
];

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parrafo(b: Bloque): string {
  if ('titulo' in b) {
    return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${escapar(b.titulo)}</w:t></w:r></w:p>`;
  }
  const pPr = `<w:pPr>${b.centrado ? '<w:jc w:val="center"/>' : '<w:jc w:val="both"/>'}<w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr>`;
  const rPr = b.negrita ? '<w:rPr><w:b/></w:rPr>' : b.centrado ? '<w:rPr><w:i/><w:sz w:val="18"/></w:rPr>' : '';
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapar(b.texto)}</w:t></w:r></w:p>`;
}

/** El Word del contrato modelo, listo para subir a la biblioteca de documentos. */
export function modeloDemoDocx(): Uint8Array {
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${CONTENIDO.map(parrafo).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:lang w:val="es-AR"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  return zipSync(
    {
      '[Content_Types].xml': strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
      ),
      '_rels/.rels': strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      ),
      'word/_rels/document.xml.rels': strToU8(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
      'word/document.xml': strToU8(documento),
      'word/styles.xml': strToU8(estilos),
    },
    { level: 6 },
  );
}

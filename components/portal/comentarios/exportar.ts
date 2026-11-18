/**
 * Exporta los comentarios de un documento para trabajarlos fuera del portal:
 * como texto, para copiar y pegar, y como Word. Lo usa solo FIRMA desde el
 * visor. Van en el orden del documento, primero los abiertos y después los
 * resueltos, cada uno con la frase resaltada, quién lo escribió y sus
 * respuestas. Todo se arma en el navegador.
 */
import { fechaHoraAsunto } from '../asuntos';

interface Mensaje {
  texto: string;
  autor_id: string | null;
  creado_en: string;
}

export interface HiloExportable extends Mensaje {
  cita: string | null;
  ancla: { pagina: number | null } | null;
  interna: boolean;
  resuelto_en: string | null;
  respuestas: Mensaje[];
}

type NombreDe = (autorId: string | null) => string;

const ordenados = (hilos: HiloExportable[]) => [...hilos.filter((h) => !h.resuelto_en), ...hilos.filter((h) => h.resuelto_en)];

function encabezado(h: HiloExportable, n: number): string {
  const donde = !h.cita ? 'Sobre el documento entero' : h.ancla?.pagina ? `Hoja ${h.ancla.pagina}` : 'Frase resaltada';
  const marcas = [h.interna ? 'interno' : '', h.resuelto_en ? 'resuelto' : ''].filter(Boolean).join(', ');
  return `${n}. ${donde}${marcas ? ` (${marcas})` : ''}`;
}

const firma = (m: Mensaje, nombreDe: NombreDe) => `${nombreDe(m.autor_id)}, ${fechaHoraAsunto(m.creado_en)}`;

function resumen(hilos: HiloExportable[]): string {
  const abiertos = hilos.filter((h) => !h.resuelto_en).length;
  const resueltos = hilos.length - abiertos;
  const partes = [`${abiertos} ${abiertos === 1 ? 'abierto' : 'abiertos'}`];
  if (resueltos) partes.push(`${resueltos} ${resueltos === 1 ? 'resuelto' : 'resueltos'}`);
  return partes.join(', ');
}

/** Los comentarios como texto plano, para pegar en cualquier lado. */
export function textoComentarios(nombreArchivo: string, hilos: HiloExportable[], nombreDe: NombreDe): string {
  const lineas = [`Comentarios en ${nombreArchivo}`, resumen(hilos), ''];
  ordenados(hilos).forEach((h, i) => {
    lineas.push(encabezado(h, i + 1));
    if (h.cita) lineas.push(`«${h.cita.replace(/\s+/g, ' ')}»`);
    lineas.push(`${firma(h, nombreDe)}: ${h.texto}`);
    for (const r of h.respuestas) lineas.push(`  Respuesta de ${firma(r, nombreDe)}: ${r.texto}`);
    lineas.push('');
  });
  return lineas.join('\n').trimEnd() + '\n';
}

const xml = (s: string) =>
  s
    // Lo que Word no acepta dentro de un XML.
    .replace(/[^\x09\x0A\x0D\x20-퟿-�]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

interface Tramo {
  texto: string;
  negrita?: boolean;
  cursiva?: boolean;
  gris?: boolean;
}

function parrafo(tramos: Tramo[], o: { tamano?: number; sangria?: number; despues?: number } = {}): string {
  const tamano = o.tamano ?? 22;
  const corridas = tramos
    .map((t) => {
      const props = `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${t.negrita ? '<w:b/>' : ''}${t.cursiva ? '<w:i/>' : ''}${
        t.gris ? '<w:color w:val="666666"/>' : ''
      }<w:sz w:val="${tamano}"/></w:rPr>`;
      // Los saltos de línea del comentario se conservan.
      const cuerpo = t.texto
        .split('\n')
        .map((l) => `<w:t xml:space="preserve">${xml(l)}</w:t>`)
        .join('<w:br/>');
      return `<w:r>${props}${cuerpo}</w:r>`;
    })
    .join('');
  return `<w:p><w:pPr><w:spacing w:after="${o.despues ?? 120}"/>${o.sangria ? `<w:ind w:left="${o.sangria}"/>` : ''}</w:pPr>${corridas}</w:p>`;
}

/** Los comentarios en un Word, para guardar o compartir. */
export async function wordComentarios(nombreArchivo: string, hilos: HiloExportable[], nombreDe: NombreDe): Promise<Blob> {
  const { strToU8, zipSync } = await import('fflate');
  const cuerpo: string[] = [
    parrafo([{ texto: 'Comentarios del documento', negrita: true }], { tamano: 32, despues: 60 }),
    parrafo([{ texto: nombreArchivo }], { despues: 60 }),
    parrafo([{ texto: resumen(hilos), gris: true }], { tamano: 20, despues: 360 }),
  ];
  ordenados(hilos).forEach((h, i) => {
    cuerpo.push(parrafo([{ texto: encabezado(h, i + 1), negrita: true }], { despues: 80 }));
    if (h.cita) cuerpo.push(parrafo([{ texto: `«${h.cita.replace(/\s+/g, ' ')}»`, cursiva: true, gris: true }], { sangria: 360 }));
    cuerpo.push(parrafo([{ texto: `${firma(h, nombreDe)}: `, negrita: true }, { texto: h.texto }], { sangria: 360 }));
    for (const r of h.respuestas) cuerpo.push(parrafo([{ texto: `${firma(r, nombreDe)}: `, negrita: true }, { texto: r.texto }], { sangria: 900 }));
    cuerpo.push(parrafo([{ texto: '' }], { despues: 120 }));
  });

  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo.join(
    '',
  )}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const tipos =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const relaciones =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';

  const zip = zipSync({ '[Content_Types].xml': strToU8(tipos), '_rels/.rels': strToU8(relaciones), 'word/document.xml': strToU8(documento) });
  return new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/** Nombre del Word: el del documento, sin extensión, con «Comentarios» adelante. */
export const nombreExportado = (nombreArchivo: string) => `Comentarios - ${nombreArchivo.replace(/\.[^.]+$/, '')}.docx`;

import { supabase } from './supabase';
import { permisosDe, type Documento, type Perfil, type SeccionDocumento } from './tipos';

/**
 * Documentos del portal. Secciones, formatos admitidos y descargas.
 * Los archivos viven en el bucket privado «documentos» de Supabase y se
 * bajan con enlaces firmados que vencen en un minuto.
 */

export const BUCKET_DOCUMENTOS = 'documentos';

export interface InfoSeccion {
  clave: SeccionDocumento;
  ruta: string;
  titulo: string;
  bajada: string;
  avisoTitulo: string;
  aviso: string;
}

export const SECCIONES: InfoSeccion[] = [
  {
    clave: 'servicio',
    ruta: '/portal/documentos',
    titulo: 'Contratos de servicio',
    bajada: 'Los modelos que usás con tus clientes para vender tus servicios.',
    avisoTitulo: 'Antes de usarlos',
    aviso:
      'Son una base de trabajo. Completá los campos marcados y revisá que precio, plazos y condiciones coincidan con lo que ofrecés. Si tu caso tiene algo distinto, pedinos la adaptación antes de firmar.',
  },
  {
    clave: 'equipo',
    ruta: '/portal/documentos/equipo',
    titulo: 'Contratos con tu equipo',
    bajada: 'Acuerdos con closers, setters, account managers y demás colaboradores.',
    avisoTitulo: 'Antes de usarlos',
    aviso:
      'Estos modelos regulan colaboraciones independientes. Si la persona cumple un horario fijo, recibe órdenes o trabaja solo para tu empresa, la relación puede considerarse laboral. Ante la duda, consultanos antes de firmar.',
  },
  {
    clave: 'otros',
    ruta: '/portal/documentos/otros',
    titulo: 'Otros documentos',
    bajada: 'Términos y condiciones, política de privacidad, protocolos y demás documentación de tu empresa.',
    avisoTitulo: 'Para tener en cuenta',
    aviso: 'Si cambiás tu oferta, tus precios o tus medios de pago, avisanos para mantener estos documentos al día.',
  },
];

/** /portal/documentos es la primera sección. Cualquier ruta desconocida cae ahí. */
export function seccionDeRuta(ruta: string): InfoSeccion {
  return SECCIONES.find((s) => s.clave !== 'servicio' && ruta === s.ruta) ?? SECCIONES[0];
}

/** Formatos que acepta el bucket. Tienen que coincidir con la migración 0005. */
export const FORMATOS: Record<string, { nombre: string; mime: string }> = {
  docx: { nombre: 'Word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  doc: { nombre: 'Word', mime: 'application/msword' },
  pdf: { nombre: 'PDF', mime: 'application/pdf' },
  xlsx: { nombre: 'Excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  xls: { nombre: 'Excel', mime: 'application/vnd.ms-excel' },
  pptx: { nombre: 'PowerPoint', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  odt: { nombre: 'OpenDocument', mime: 'application/vnd.oasis.opendocument.text' },
  rtf: { nombre: 'RTF', mime: 'application/rtf' },
};

export const EXTENSIONES_ACEPTADAS = Object.keys(FORMATOS)
  .map((e) => `.${e}`)
  .join(',');

export const TAMANO_MAXIMO = 25 * 1024 * 1024;

export function extension(nombre: string | null | undefined): string {
  const m = /\.([a-z0-9]+)$/i.exec(nombre ?? '');
  return m ? m[1].toLowerCase() : '';
}

export function formatoDe(d: Pick<Documento, 'archivo_nombre' | 'url'>): string {
  if (d.url) {
    if (d.url.startsWith('/')) return 'Página web';
    if (/docs\.google\.com\/document/.test(d.url)) return 'Google Docs';
    if (/docs\.google\.com\/spreadsheets/.test(d.url)) return 'Google Sheets';
    if (/drive\.google\.com/.test(d.url)) return 'Google Drive';
    if (/notion\.(so|site)/.test(d.url)) return 'Notion';
    return 'Enlace';
  }
  return FORMATOS[extension(d.archivo_nombre)]?.nombre ?? 'Archivo';
}

export function tamano(bytes: number | null | undefined): string | null {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
}

export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Replica en pantalla la regla de la base (documento_visible). Sirve para el
 * modo Ver como y para que el admin vea la biblioteca común. Para un cliente
 * real la base ya filtra y esto no cambia nada.
 */
export function visibleEnPantalla(d: Documento, rol: Perfil['rol'], areas: string[], orgId: string | null): boolean {
  if (!d.activo) return false;
  if (d.organizacion_id !== null && d.organizacion_id !== orgId) return false;
  if (!d.es_protocolo && !permisosDe(rol).documentosLegales) return false;
  const areasDoc = d.areas ?? [];
  if (rol === 'admin' || rol === 'titular' || areasDoc.length === 0) return true;
  return areasDoc.some((a) => areas.includes(a));
}

/** Nombre con el que baja el archivo. Sin tildes ni símbolos para que llegue igual en cualquier sistema. */
export function nombreDescarga(d: Documento): string {
  const ext = extension(d.archivo_nombre);
  const version = d.version ? ` v${d.version.trim().replace(/^v/i, '')}` : '';
  const base = `${d.titulo}${version}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w .()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${base || 'documento'}${ext ? `.${ext}` : ''}`;
}

/** Pide un enlace firmado de un minuto y descarga. Devuelve el error para mostrar, o null. */
export async function descargarArchivo(d: Documento): Promise<string | null> {
  if (!supabase || !d.archivo_ruta) return 'Este documento no tiene un archivo para descargar.';
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(d.archivo_ruta, 60, { download: nombreDescarga(d) });
  if (error || !data?.signedUrl) return 'No pudimos preparar la descarga. Probá de nuevo en un momento.';
  window.location.assign(data.signedUrl);
  return null;
}

/** Deja la descarga en el registro de accesos. Si falla, la descarga sigue igual. */
export function registrarDescarga(d: Documento) {
  if (!supabase) return;
  supabase.rpc('registrar_descarga', { doc: d.id }).then(
    () => undefined,
    () => undefined,
  );
}

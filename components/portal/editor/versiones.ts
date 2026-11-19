import { supabase } from '../supabase';
import { BUCKET_ASUNTOS, FORMATOS_ASUNTO, type Archivo } from '../asuntos';

/**
 * Versiones de un Word de un asunto (migración 0071). Solo FIRMA.
 * El borrador vive en borradores/, que el cliente no puede abrir; al
 * publicar, el Word nuevo se sube a la carpeta del asunto y pasa a ser
 * el documento que ve todo el mundo.
 */
export interface Version {
  id: string;
  archivo_id: string;
  estado: 'borrador' | 'publicada';
  numero: number | null;
  ruta: string;
  bytes: number | null;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
  publicado_en: string | null;
}

const MIME = FORMATOS_ASUNTO.docx;
const comoWord = (blob: Blob): Blob => (blob.type === MIME ? blob : new Blob([blob], { type: MIME }));

/** Sin la migración 0071 la tabla no existe: devuelve una lista vacía. */
export async function listarVersiones(archivoId: string): Promise<Version[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('asunto_archivo_versiones').select('*').eq('archivo_id', archivoId).order('numero', { ascending: false, nullsFirst: true });
  return (data as Version[]) ?? [];
}

export async function bajarArchivo(ruta: string): Promise<Blob> {
  if (!supabase) throw new Error('Portal sin configurar.');
  const { data, error } = await supabase.storage.from(BUCKET_ASUNTOS).download(ruta);
  if (error || !data) throw new Error('No se pudo abrir el archivo.');
  return data;
}

async function subir(ruta: string, blob: Blob): Promise<void> {
  if (!supabase) throw new Error('Portal sin configurar.');
  const { error } = await supabase.storage.from(BUCKET_ASUNTOS).upload(ruta, comoWord(blob), { contentType: MIME, upsert: false });
  if (error) throw new Error(`No se pudo subir el documento. ${error.message}`);
}

const quitar = async (rutas: (string | null | undefined)[]) => {
  const lista = rutas.filter((r): r is string => Boolean(r));
  if (supabase && lista.length) await supabase.storage.from(BUCKET_ASUNTOS).remove(lista);
};

export class BorradorCambiado extends Error {}

/**
 * Guarda el borrador. visto es el actualizado_en del borrador que se
 * abrió: si otra persona de FIRMA guardó después, tira BorradorCambiado
 * y no pisa nada, salvo que se llame con pisar.
 */
export async function guardarBorrador(archivo: Archivo, blob: Blob, visto: string | null, pisar = false): Promise<string> {
  if (!supabase) throw new Error('Portal sin configurar.');
  const ruta = `borradores/${archivo.organizacion_id}/${archivo.asunto_id}/${crypto.randomUUID()}.docx`;
  await subir(ruta, blob);
  const { data, error } = await supabase.rpc('version_borrador_guardar', { p_archivo: archivo.id, p_ruta: ruta, p_bytes: blob.size, p_visto: visto, p_pisar: pisar });
  if (error || !data) {
    await quitar([ruta]);
    if (error?.message.includes('BORRADOR_CAMBIADO')) throw new BorradorCambiado();
    throw new Error(error?.message ?? 'No se pudo guardar el borrador.');
  }
  const r = data as { actualizado_en: string; ruta_anterior: string | null };
  await quitar([r.ruta_anterior]);
  return r.actualizado_en;
}

/** Publica el Word como versión nueva del documento. Devuelve su número. */
export async function publicarVersion(archivo: Archivo, blob: Blob): Promise<number> {
  if (!supabase) throw new Error('Portal sin configurar.');
  const ruta = `${archivo.organizacion_id}/${archivo.asunto_id}/${crypto.randomUUID()}.docx`;
  await subir(ruta, blob);
  const { data, error } = await supabase.rpc('version_publicar', { p_archivo: archivo.id, p_ruta: ruta, p_bytes: blob.size });
  if (error || !data) {
    await quitar([ruta]);
    throw new Error(error?.message ?? 'No se pudo publicar la versión.');
  }
  const r = data as { numero: number; ruta_borrador: string | null };
  await quitar([r.ruta_borrador]);
  return r.numero;
}

export async function descartarBorrador(archivo: Archivo): Promise<void> {
  if (!supabase) throw new Error('Portal sin configurar.');
  const { data, error } = await supabase.rpc('version_borrador_descartar', { p_archivo: archivo.id });
  if (error) throw new Error(error.message);
  await quitar([data as string | null]);
}

/**
 * Los archivos de versiones y borradores de unos documentos o asuntos,
 * para borrarlos del bucket junto con ellos. Hay que pedirlos antes de
 * borrar, porque la base borra la lista. El archivo vigente de cada
 * documento ya está en asunto_archivos y no hace falta repetirlo.
 */
export async function rutasDeVersiones(campo: 'archivo_id' | 'asunto_id', ids: string[]): Promise<string[]> {
  if (!supabase || !ids.length) return [];
  const { data } = await supabase.from('asunto_archivo_versiones').select('ruta').in(campo, ids);
  return ((data as { ruta: string }[]) ?? []).map((v) => v.ruta);
}

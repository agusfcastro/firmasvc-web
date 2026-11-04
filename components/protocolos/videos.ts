// Videos de los protocolos FIRMA. Archivo liviano, lo leen el motor y las tarjetas
// del portal sin cargar el contenido de cada protocolo.
//
// Sirven enlaces de YouTube (también ocultos), Vimeo, Loom o un mp4. Un enlace vacío
// no muestra nada, así se carga cada video cuando está listo.
//   presentacion   va en la portada del protocolo y en su tarjeta del portal
//   secciones      va arriba de la sección con ese id (por ejemplo 'etapas')

export interface VideosProtocolo {
  presentacion?: string;
  secciones?: Record<string, string>;
}

/** Cómo se usan los protocolos. Va en el índice de /protocolos. */
export const VIDEO_GENERAL = '';

export const VIDEOS: Record<string, VideosProtocolo> = {
  '/protocolo-llamadas': {
    presentacion: '',
    secciones: { repaso: '', objeciones: '' },
  },
  '/protocolo-conflictos': {
    presentacion: '',
    secciones: { etapas: '', negociacion: '' },
  },
  '/protocolo-onboarding': {
    presentacion: '',
    secciones: { etapas: '' },
  },
  '/protocolo-cobranza': {
    presentacion: '',
    secciones: { secuencia: '' },
  },
  '/protocolo-reclutamiento': {
    presentacion: '',
    secciones: { entrevista: '' },
  },
  '/protocolo-equipo': {
    presentacion: '',
    secciones: { ciclo: '', independencia: '' },
  },
  '/protocolo-marketing': {
    presentacion: '',
    secciones: { revisor: '' },
  },
  '/protocolo-datos': {
    presentacion: '',
    secciones: { incidentes: '' },
  },
};

/** Video de presentación del protocolo de esa ruta, o null si todavía no se cargó. */
export function presentacionDe(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  return VIDEOS[ruta]?.presentacion || null;
}

/** Video de una sección, o null. */
export function videoDeSeccion(ruta: string, seccion: string): string | null {
  return VIDEOS[ruta]?.secciones?.[seccion] || null;
}

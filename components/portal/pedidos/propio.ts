import { texto, type Modelo, type Pregunta, type Respuestas, type Seccion, type TipoPregunta } from './formulario';

/**
 * Modelos de contrato propios de una empresa (migración 0068). FIRMA arma
 * las preguntas desde Administración › Formularios, sin tocar el código, y
 * el cliente los completa como el de closer o el de setter. No tienen
 * preguntas condicionales ni alertas: eso sigue siendo de los modelos
 * escritos en closer.ts y setter.ts.
 */

/** Lo que se guarda en modelos_contrato y, al enviar, como copia en pedidos_contrato.formulario. */
export interface DefinicionFormulario {
  titulo: string;
  /** Cómo se nombra a la otra parte: «los datos del prestador». */
  persona: string;
  descripcion: string | null;
  secciones: Seccion[];
}

export interface ModeloPropio extends DefinicionFormulario {
  id: string;
  organizacion_id: string;
  /** El contrato modelo que el cliente puede bajar desde la tarjeta. */
  documento_id: string | null;
  activo: boolean;
  orden: number;
  creado_en: string;
  actualizado_en: string;
}

/** Los datos de la persona llevan este prefijo: así la base deja completarlos después de enviar. */
export const PREFIJO_PERSONA = 'propio_';
const PREFIJO_COMUN = 'p_';

export const TIPOS_PREGUNTA: { clave: TipoPregunta; titulo: string }[] = [
  { clave: 'texto', titulo: 'Texto corto' },
  { clave: 'largo', titulo: 'Texto largo' },
  { clave: 'opcion', titulo: 'Una opción' },
  { clave: 'varias', titulo: 'Varias opciones' },
  { clave: 'sino', titulo: 'Sí o no' },
  { clave: 'tabla', titulo: 'Tabla' },
];

const corto = () => crypto.randomUUID().slice(0, 8);

/** La clave de una pregunta según su sección: propio_ para los datos de la persona. */
export function clavePregunta(porContrato: boolean, actual?: string): string {
  const base = (actual ?? '').replace(/^(propio_|p_)/, '') || corto();
  return `${porContrato ? PREFIJO_PERSONA : PREFIJO_COMUN}${base}`;
}

export const claveNueva = (prefijo: string) => `${prefijo}_${corto()}`;

/** Ruta del formulario nuevo de un modelo propio. */
export const rutaModeloPropio = (id: string) => `/portal/pedidos/modelo-${id}`;

/** El id del modelo propio si la ruta es la de su formulario nuevo. */
export function idModeloPropio(parte: string): string | null {
  const m = /^modelo-([0-9a-f-]{36})$/i.exec(parte);
  return m ? m[1] : null;
}

const esTipo = (t: unknown): t is TipoPregunta => TIPOS_PREGUNTA.some((x) => x.clave === t);

/** Las secciones como llegan de la base, sin nada que rompa el formulario. */
export function seccionesSeguras(crudo: unknown): Seccion[] {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
    .map((s, i) => ({
      clave: typeof s.clave === 'string' && s.clave ? s.clave : `s${i}`,
      titulo: typeof s.titulo === 'string' ? s.titulo : '',
      bajada: typeof s.bajada === 'string' ? s.bajada : '',
      porContrato: s.porContrato === true,
      preguntas: (Array.isArray(s.preguntas) ? s.preguntas : [])
        .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null && typeof p.clave === 'string' && esTipo(p.tipo))
        .map(
          (p): Pregunta => ({
            clave: p.clave as string,
            tipo: p.tipo as TipoPregunta,
            etiqueta: typeof p.etiqueta === 'string' ? p.etiqueta : '',
            ...(typeof p.ayuda === 'string' && p.ayuda ? { ayuda: p.ayuda } : {}),
            ...(typeof p.ejemplo === 'string' && p.ejemplo ? { ejemplo: p.ejemplo } : {}),
            ...(Array.isArray(p.opciones)
              ? { opciones: (p.opciones as { valor?: unknown; texto?: unknown }[]).filter((o) => typeof o?.valor === 'string' && typeof o?.texto === 'string') as Pregunta['opciones'] }
              : {}),
            ...(p.otra === true ? { otra: true } : {}),
            ...(Array.isArray(p.columnas)
              ? { columnas: (p.columnas as { clave?: unknown; titulo?: unknown }[]).filter((c) => typeof c?.clave === 'string' && typeof c?.titulo === 'string') as Pregunta['columnas'] }
              : {}),
            ...(p.obligatoria === true ? { obligatoria: true } : {}),
          }),
        ),
    }));
}

/** El formulario de un modelo propio, con la misma forma que los de closer y setter. */
export function modeloDesdePropio(d: DefinicionFormulario): Modelo {
  const secciones = seccionesSeguras(d.secciones);
  const titulo = d.titulo?.trim() || 'Contrato';
  const persona = d.persona?.trim() || 'prestador';
  // El pedido se nombra con la primera pregunta de texto de los datos de la persona.
  const claveTitulo = secciones.filter((s) => s.porContrato).flatMap((s) => s.preguntas).find((p) => p.tipo === 'texto')?.clave ?? '';
  return {
    clave: 'propio',
    persona,
    titulo,
    bajada: 'Respondé las preguntas y con eso redactamos el contrato. Lo que no aplique a tu caso, dejalo vacío.',
    descripcion: d.descripcion?.trim() || 'Respondé las preguntas del formulario. Con eso FIRMA redacta el contrato y lo seguís en Asuntos.',
    claveNotas: '',
    seccionesHonorarios: [],
    claveTitulo,
    // El mismo texto arma la migración 0068 cuando el cliente completa el nombre después de enviar.
    tituloAsunto: (r: Respuestas) => (claveTitulo ? `${titulo} · ${texto(r, claveTitulo).trim() || 'datos pendientes'}` : titulo),
    secciones,
  };
}

/** Los datos de la persona que se proponen al armar un modelo nuevo. */
export function seccionPersona(persona: string): Seccion {
  const p = (etiqueta: string, extra: Partial<Pregunta> = {}): Pregunta => ({ clave: clavePregunta(true), tipo: 'texto', etiqueta, ...extra });
  return {
    clave: claveNueva('s'),
    titulo: `Datos del ${persona || 'prestador'}`,
    bajada: 'Si todavía no sabés quién va a ser, dejá todo vacío. Lo completás después desde el asunto.',
    porContrato: true,
    preguntas: [
      p('Nombre completo'),
      p('Tipo y número de documento', { ejemplo: 'DNI 30.031.806' }),
      p('CUIT, CUIL o número fiscal'),
      p('País donde vive'),
      p('Domicilio'),
      p('Mail', { ayuda: 'Es el que vale para las notificaciones del contrato.' }),
    ],
  };
}

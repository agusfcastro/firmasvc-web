import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, FileDown, History, MessageSquarePlus, PencilLine, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
// Build legacy, como el visor de la firma: también corre en celulares con navegadores de hace algunos años.
import { GlobalWorkerOptions, TextLayer, getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import trabajador from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { supabase } from '../supabase';
import { Aviso, Etiqueta } from '../ui';
import { BUCKET_ASUNTOS, avisarPorMail, fechaHoraAsunto, type Archivo } from '../asuntos';
import { rangoDe, seleccionActual, ubicar, type Ancla, type Seleccion } from './anclas';
import { nombreExportado, textoComentarios, wordComentarios } from './exportar';
import { mensajeAmable } from '../errores';
import { EditorWord, type EditorWordRef } from '../editor/EditorWord';
import { cargarFuentesDocumentos } from '../editor/fuentes';
import { BorradorCambiado, bajarArchivo, descartarBorrador, guardarBorrador, listarVersiones, publicarVersion, type Version } from '../editor/versiones';

GlobalWorkerOptions.workerSrc = trabajador;

/**
 * Visor de un documento del asunto con comentarios, como en Google Docs.
 * El PDF se dibuja hoja por hoja con su capa de texto para poder
 * seleccionar; el Word se pasa a HTML en el navegador (docx-preview).
 * Quien ve el asunto resalta una frase y comenta, o comenta el documento
 * entero. Cada comentario abre un hilo con respuestas que se resuelve.
 * FIRMA puede dejar hilos internos. Tabla asunto_comentarios (0065).
 *
 * FIRMA además edita los Word acá mismo (components/portal/editor): lo
 * que guarda queda como borrador y el cliente lo ve recién cuando se
 * publica como versión nueva (migración 0071).
 */

export interface Comentario {
  id: string;
  archivo_id: string;
  asunto_id: string;
  padre_id: string | null;
  cita: string | null;
  ancla: Ancla | null;
  texto: string;
  interna: boolean;
  resuelto_en: string | null;
  resuelto_por: string | null;
  autor_id: string | null;
  creado_en: string;
}

interface Hilo extends Comentario {
  respuestas: Comentario[];
}

/** Borrador de respuesta que Tina deja para FIRMA (migración 0070). */
interface BorradorTina {
  comentario_id: string;
  hasta: string;
  pedido: string;
  respuesta: string;
  clausula: string | null;
  nota: string | null;
}

interface Marca {
  id: string;
  ancla: Ancla;
  cita: string;
}

type Borrador = { cita: string; ancla: Ancla } | { cita: null; ancla: null };

/** Formatos que se pueden ver y comentar en el portal. El .doc viejo y el resto se descargan. */
export const tipoVisor = (nombre: string): 'pdf' | 'word' | null => {
  const ext = (nombre.split('.').pop() || '').toLowerCase();
  return ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'word' : null;
};

const claseCampo =
  'w-full border border-borde rounded-control bg-papel px-3 py-2.5 text-[15px] leading-[1.5] text-tinta placeholder:text-piedra focus:outline-none focus:ring-2 focus:ring-bosque/40 resize-y';

export const VisorComentarios: React.FC<{
  archivo: Archivo;
  esFirma: boolean;
  soloLectura: boolean;
  miId: string;
  nombreDe: (autorId: string | null) => string;
  conocerAutores: (ids: (string | null)[]) => void;
  alCerrar: () => void;
  alCambiar: () => void;
  /** Se publicó una versión nueva del documento: hay que volver a leer los archivos del asunto. */
  alPublicar?: (mensaje: string) => void;
}> = ({ archivo, esFirma, soloLectura, miId, nombreDe, conocerAutores, alCerrar, alCambiar, alPublicar }) => {
  const tipo = tipoVisor(archivo.nombre);
  const [fuente, setFuente] = useState<{ url: string; blob?: Blob } | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [verResueltos, setVerResueltos] = useState(false);
  const [activo, setActivo] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [vistaMovil, setVistaMovil] = useState<'documento' | 'comentarios'>('documento');
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [borradores, setBorradores] = useState<BorradorTina[]>([]);
  const areaDoc = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Edición del Word, solo FIRMA.
  const puedeEditar = esFirma && !soloLectura && tipo === 'word';
  const [versiones, setVersiones] = useState<Version[]>([]);
  const [edicion, setEdicion] = useState<{ blob: Blob; clave: number; visto: string | null } | null>(null);
  const [sucio, setSucio] = useState(false);
  const [fijos, setFijos] = useState(0);
  const [ocupadoDoc, setOcupadoDoc] = useState<'' | 'abrir' | 'guardar' | 'publicar' | 'descartar' | 'restaurar'>('');
  const [errorDoc, setErrorDoc] = useState<string | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [perdidos, setPerdidos] = useState<string[]>([]);
  const editor = useRef<EditorWordRef>(null);
  const borradorDoc = versiones.find((v) => v.estado === 'borrador') ?? null;
  const publicadas = versiones.filter((v) => v.estado === 'publicada');

  const cargarVersiones = useCallback(async () => {
    const lista = await listarVersiones(archivo.id);
    setVersiones(lista);
    conocerAutores(lista.map((v) => v.creado_por));
  }, [archivo.id, conocerAutores]);

  useEffect(() => {
    if (esFirma && tipo === 'word') void cargarVersiones();
  }, [esFirma, tipo, cargarVersiones]);

  // Con cambios sin guardar, el navegador pregunta antes de cerrar la pestaña.
  useEffect(() => {
    if (!sucio) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [sucio]);

  const cerrar = useCallback(() => {
    if (sucio && !window.confirm('Tenés cambios sin guardar. Si salís, se pierden. ¿Salir igual?')) return;
    alCerrar();
  }, [sucio, alCerrar]);

  // El archivo se baja con un enlace firmado. El PDF lo lee pdf.js de la URL; el Word hace falta entero.
  useEffect(() => {
    const sb = supabase;
    if (!sb || !tipo) return;
    let vivo = true;
    void (async () => {
      const { data, error: e } = await sb.storage.from(BUCKET_ASUNTOS).createSignedUrl(archivo.ruta, 600);
      if (!vivo) return;
      if (e || !data) return setErrorCarga(true);
      if (tipo === 'pdf') return setFuente({ url: data.signedUrl });
      try {
        const r = await fetch(data.signedUrl);
        if (!r.ok) throw new Error();
        const blob = await r.blob();
        if (vivo) setFuente({ url: data.signedUrl, blob });
      } catch {
        if (vivo) setErrorCarga(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [archivo.ruta, tipo]);

  const cargar = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('asunto_comentarios').select('*').eq('archivo_id', archivo.id).order('creado_en', { ascending: true });
    const lista = (data as Comentario[]) ?? [];
    setComentarios(lista);
    conocerAutores([...lista.map((c) => c.autor_id), ...lista.map((c) => c.resuelto_por)]);
  }, [archivo.id, conocerAutores]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Borradores de Tina, solo FIRMA. Sin la migración 0070 la tabla no existe: no se muestra nada.
  useEffect(() => {
    if (!supabase || !esFirma) return;
    let vivo = true;
    void supabase
      .from('comentario_borradores')
      .select('comentario_id, hasta, pedido, respuesta, clausula, nota')
      .eq('archivo_id', archivo.id)
      .eq('estado', 'pendiente')
      .then(({ data }) => vivo && setBorradores((data as BorradorTina[]) ?? []));
    return () => {
      vivo = false;
    };
  }, [archivo.id, esFirma]);

  // Comentarios en vivo: lo que escribe la otra parte aparece sin recargar.
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    const canal = sb
      .channel(`comentarios-${archivo.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asunto_comentarios', filter: `archivo_id=eq.${archivo.id}` }, () => void cargar())
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [archivo.id, cargar]);

  // Escape cierra el visor, salvo que haya un comentario a medio escribir. La página de atrás no se mueve.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (borrador) setBorrador(null);
      else if (!edicion) alCerrar();
    };
    window.addEventListener('keydown', tecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener('keydown', tecla);
    };
  }, [alCerrar, borrador, edicion]);

  // Lo seleccionado en el documento, para mostrar el botón de comentar junto a la frase.
  useEffect(() => {
    if (soloLectura || edicion) return setSeleccion(null);
    let espera = 0;
    const revisar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => setSeleccion(areaDoc.current ? seleccionActual(areaDoc.current) : null), 120);
    };
    document.addEventListener('selectionchange', revisar);
    const area = areaDoc.current;
    area?.addEventListener('scroll', revisar, { passive: true });
    return () => {
      window.clearTimeout(espera);
      document.removeEventListener('selectionchange', revisar);
      area?.removeEventListener('scroll', revisar);
    };
  }, [soloLectura, fuente, edicion]);

  const hilos: Hilo[] = useMemo(() => {
    const visibles = comentarios.filter((c) => esFirma || !c.interna);
    const raiz = visibles.filter((c) => !c.padre_id);
    const orden = (h: Comentario) => (h.ancla ? [h.ancla.pagina ?? 0, h.ancla.inicio] : [-1, 0]);
    return raiz
      .map((h) => ({ ...h, respuestas: visibles.filter((r) => r.padre_id === h.id) }))
      .sort((a, b) => {
        const [pa, ia] = orden(a);
        const [pb, ib] = orden(b);
        return pa - pb || ia - ib || a.creado_en.localeCompare(b.creado_en);
      });
  }, [comentarios, esFirma]);

  // El borrador vale mientras nadie haya escrito en el hilo después de que Tina lo leyó.
  const borradorDe = (h: Hilo): BorradorTina | null => {
    if (h.resuelto_en) return null;
    const b = borradores.find((x) => x.comentario_id === h.id);
    if (!b) return null;
    const ultimo = h.respuestas.length ? h.respuestas[h.respuestas.length - 1].creado_en : h.creado_en;
    return Date.parse(ultimo) <= Date.parse(b.hasta) ? b : null;
  };

  async function cerrarBorrador(h: Hilo, estado: 'publicado' | 'descartado') {
    if (!supabase) return;
    const { error: e } = await supabase.rpc('borrador_cerrar', { p_comentario: h.id, p_estado: estado });
    if (e) return setError(mensajeAmable(e));
    setBorradores((l) => l.filter((b) => b.comentario_id !== h.id));
  }

  async function publicarBorrador(h: Hilo, texto: string): Promise<boolean> {
    if (!(await responder(h, texto))) return false;
    await cerrarBorrador(h, 'publicado');
    return true;
  }

  const abiertos = hilos.filter((h) => !h.resuelto_en);
  const resueltos = hilos.filter((h) => h.resuelto_en);
  const mostrados = verResueltos ? hilos : abiertos;
  const marcas: Marca[] = useMemo(
    () => (verResueltos ? hilos : hilos.filter((h) => !h.resuelto_en)).filter((h) => h.ancla && h.cita).map((h) => ({ id: h.id, ancla: h.ancla as Ancla, cita: h.cita as string })),
    [hilos, verResueltos],
  );
  const fallo = useCallback(() => setErrorCarga(true), []);
  const marcarSucio = useCallback(() => setSucio(true), []);
  const editorListo = useCallback((editables: number, sinEditar: number) => {
    setFijos(sinEditar);
    if (!editables) setErrorDoc('Este Word no se puede editar acá: sus párrafos tienen campos, notas o un formato que el editor no sabe conservar. Descargalo, corregilo en Word y subilo de nuevo.');
  }, []);
  const editorFallo = useCallback(() => {
    setEdicion(null);
    setSucio(false);
    setErrorDoc('No se pudo abrir el documento para editarlo. Descargalo, corregilo en Word y subilo de nuevo.');
  }, []);

  function irAlHilo(id: string) {
    setActivo(id);
    setVistaMovil('comentarios');
    window.setTimeout(() => panel.current?.querySelector(`[data-hilo="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
  }

  function irALaFrase(h: Hilo) {
    setActivo(h.id);
    if (!h.ancla) return;
    setVistaMovil('documento');
    window.setTimeout(() => {
      const area = areaDoc.current;
      const marca = area?.querySelector(`.resalte-comentario[data-id="${h.id}"]`);
      const hoja = h.ancla?.pagina ? area?.querySelector(`[data-hoja="${h.ancla.pagina}"]`) : null;
      (marca ?? hoja)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
  }

  // Un toque sobre una frase resaltada abre su hilo.
  function tocarDocumento(e: React.MouseEvent) {
    if (edicion) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const marcas = areaDoc.current?.querySelectorAll<HTMLElement>('.resalte-comentario') ?? [];
    for (const m of marcas) {
      const r = m.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return irAlHilo(m.dataset.id as string);
    }
    setActivo(null);
  }

  function comentarSeleccion() {
    if (!seleccion) return;
    setBorrador({ cita: seleccion.cita, ancla: seleccion.ancla });
    setSeleccion(null);
    window.getSelection()?.removeAllRanges();
    setVistaMovil('comentarios');
    setActivo(null);
    panel.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function publicar(texto: string, interna: boolean): Promise<boolean> {
    if (!supabase || !borrador) return false;
    setError(null);
    const { data, error: e } = await supabase
      .from('asunto_comentarios')
      .insert({ archivo_id: archivo.id, cita: borrador.cita, ancla: borrador.ancla, texto, interna: esFirma && interna })
      .select('*')
      .single();
    if (e || !data) {
      setError(`No se pudo guardar el comentario. ${e?.message ?? ''}`);
      return false;
    }
    setComentarios((l) => (l.some((c) => c.id === data.id) ? l : [...l, data as Comentario]));
    setBorrador(null);
    setActivo((data as Comentario).id);
    if (!(data as Comentario).interna) void avisarPorMail('comentario', (data as Comentario).id);
    alCambiar();
    return true;
  }

  async function responder(hilo: Hilo, texto: string): Promise<boolean> {
    if (!supabase) return false;
    setError(null);
    const { data, error: e } = await supabase.from('asunto_comentarios').insert({ archivo_id: archivo.id, padre_id: hilo.id, texto }).select('*').single();
    if (e || !data) {
      setError(`No se pudo guardar la respuesta. ${e?.message ?? ''}`);
      return false;
    }
    setComentarios((l) => (l.some((c) => c.id === data.id) ? l : [...l, data as Comentario]));
    if (!hilo.interna) void avisarPorMail('comentario', (data as Comentario).id);
    return true;
  }

  async function resolver(hilo: Hilo, resuelto: boolean) {
    if (!supabase) return;
    setError(null);
    const { error: e } = await supabase.rpc('resolver_comentario', { comentario: hilo.id, resuelto });
    if (e) return setError(mensajeAmable(e));
    if (resuelto && activo === hilo.id) setActivo(null);
    void cargar();
    alCambiar();
  }

  async function borrar(c: Comentario) {
    if (!supabase) return;
    const aviso = c.padre_id ? '¿Borrar esta respuesta?' : '¿Borrar este comentario y sus respuestas?';
    if (!window.confirm(`${aviso} No se puede deshacer.`)) return;
    setError(null);
    const { error: e } = await supabase.from('asunto_comentarios').delete().eq('id', c.id);
    if (e) return setError(mensajeAmable(e));
    setComentarios((l) => l.filter((x) => x.id !== c.id && x.padre_id !== c.id));
    alCambiar();
  }

  async function descargar() {
    if (!supabase) return;
    const { data } = await supabase.storage.from(BUCKET_ASUNTOS).createSignedUrl(archivo.ruta, 60, { download: archivo.nombre });
    if (data) window.location.assign(data.signedUrl);
    else setError('No se pudo descargar el archivo.');
  }

  // Exportar, solo FIRMA: todos los hilos del documento, también los resueltos y los internos.
  async function copiarComentarios() {
    setError(null);
    try {
      await navigator.clipboard.writeText(textoComentarios(archivo.nombre, hilos, nombreDe));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError('No se pudieron copiar los comentarios. Probá con Descargar.');
    }
  }

  async function descargarComentarios() {
    setError(null);
    try {
      const url = URL.createObjectURL(await wordComentarios(archivo.nombre, hilos, nombreDe));
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreExportado(archivo.nombre);
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError('No se pudo armar el Word con los comentarios.');
    }
  }

  const puedeBorrar = (c: Comentario) => !soloLectura && (esFirma || c.autor_id === miId);

  /* ---- Edición del Word ---- */
  const falloDoc = (e: unknown, respaldo: string) => setErrorDoc(e instanceof Error && e.message ? mensajeAmable(e.message, respaldo) : respaldo);

  async function editar() {
    if (!fuente?.blob) return;
    setErrorDoc(null);
    setOcupadoDoc('abrir');
    try {
      const blob = borradorDoc ? await bajarArchivo(borradorDoc.ruta) : fuente.blob;
      setFijos(0);
      setSucio(false);
      setVerHistorial(false);
      setEdicion({ blob, clave: Date.now(), visto: borradorDoc?.actualizado_en ?? null });
    } catch (e) {
      falloDoc(e, 'No se pudo abrir el borrador.');
    }
    setOcupadoDoc('');
  }

  function salirDeEditar() {
    if (sucio && !window.confirm('Tenés cambios sin guardar. Si salís, se pierden. ¿Salir igual?')) return;
    setEdicion(null);
    setSucio(false);
  }

  /** Guarda lo que hay en pantalla como borrador. Devuelve si quedó guardado. */
  async function guardar(): Promise<boolean> {
    if (!edicion || !editor.current) return false;
    setErrorDoc(null);
    setOcupadoDoc('guardar');
    let ok = false;
    try {
      const blob = editor.current.armar();
      let visto: string;
      try {
        visto = await guardarBorrador(archivo, blob, edicion.visto);
      } catch (e) {
        if (!(e instanceof BorradorCambiado)) throw e;
        if (!window.confirm('Otra persona de FIRMA guardó cambios en este documento mientras lo editabas. Si seguís, se pierden los suyos. ¿Guardar los tuyos igual?')) {
          setOcupadoDoc('');
          return false;
        }
        visto = await guardarBorrador(archivo, blob, null, true);
      }
      setEdicion((e) => e && { ...e, visto });
      setSucio(false);
      ok = true;
      void cargarVersiones();
    } catch (e) {
      falloDoc(e, 'No se pudo guardar el borrador.');
    }
    setOcupadoDoc('');
    return ok;
  }

  async function publicarDoc() {
    if (!edicion && !borradorDoc) return;
    if (!window.confirm(`¿Publicar esta versión de ${archivo.nombre}? Quienes ven el asunto van a ver este texto en lugar del anterior. La versión anterior queda en el historial.`)) return;
    setErrorDoc(null);
    setOcupadoDoc('publicar');
    try {
      // Editando, se publica lo que hay en pantalla. Si no, el borrador guardado.
      const blob = edicion && editor.current ? editor.current.armar() : await bajarArchivo((borradorDoc as Version).ruta);
      const numero = await publicarVersion(archivo, blob);
      setEdicion(null);
      setSucio(false);
      void cargarVersiones();
      alPublicar?.(`Versión ${numero} de ${archivo.nombre} publicada.`);
    } catch (e) {
      falloDoc(e, 'No se pudo publicar la versión.');
    }
    setOcupadoDoc('');
  }

  async function descartarDoc() {
    if (!borradorDoc || !window.confirm('¿Descartar la edición sin publicar? No se puede deshacer.')) return;
    setErrorDoc(null);
    setOcupadoDoc('descartar');
    try {
      await descartarBorrador(archivo);
      setEdicion(null);
      setSucio(false);
      await cargarVersiones();
    } catch (e) {
      falloDoc(e, 'No se pudo descartar el borrador.');
    }
    setOcupadoDoc('');
  }

  /** Una versión vieja vuelve como borrador: no se publica hasta que FIRMA lo decida. */
  async function restaurar(v: Version) {
    const aviso = borradorDoc ? ' Reemplaza la edición sin publicar que hay ahora.' : '';
    if (!window.confirm(`¿Traer la versión ${v.numero} como borrador?${aviso} El cliente no ve nada hasta que la publiques.`)) return;
    setErrorDoc(null);
    setOcupadoDoc('restaurar');
    try {
      await guardarBorrador(archivo, await bajarArchivo(v.ruta), null, true);
      setVerHistorial(false);
      await cargarVersiones();
    } catch (e) {
      falloDoc(e, 'No se pudo traer esa versión.');
    }
    setOcupadoDoc('');
  }

  async function descargarVersion(v: Version) {
    if (!supabase) return;
    const nombre = archivo.nombre.replace(/\.docx$/i, '') + ` (versión ${v.numero}).docx`;
    const { data } = await supabase.storage.from(BUCKET_ASUNTOS).createSignedUrl(v.ruta, 60, { download: nombre });
    if (data) window.location.assign(data.signedUrl);
    else setErrorDoc('No se pudo descargar esa versión.');
  }

  const botonBarra = 'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control text-sm font-medium disabled:opacity-50';

  return (
    <div className="portal fixed inset-0 z-50 flex flex-col bg-marfil" role="dialog" aria-modal="true" aria-label={`Comentarios en ${archivo.nombre}`}>
      <header className="flex items-center gap-3 px-4 tab:px-6 h-16 shrink-0 bg-papel border-b border-borde-suave">
        <button type="button" onClick={cerrar} className="inline-flex items-center gap-2 text-sm font-medium text-tinta hover:underline underline-offset-4">
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="hidden tab:inline">Volver al asunto</span>
        </button>
        <span className="flex-1 min-w-0 truncate font-semibold text-[15px] text-center tab:text-left tab:pl-4">{archivo.nombre}</span>
        {esFirma && publicadas.length > 1 && !edicion && (
          <button type="button" onClick={() => setVerHistorial((v) => !v)} aria-expanded={verHistorial} className="inline-flex items-center gap-2 text-sm font-medium text-tinta underline underline-offset-4">
            <History size={14} aria-hidden="true" />
            <span className="hidden tab:inline">Versiones</span>
          </button>
        )}
        {puedeEditar && !edicion && !borradorDoc && fuente?.blob && !errorCarga && (
          <button type="button" onClick={editar} disabled={ocupadoDoc !== ''} className="inline-flex items-center gap-2 text-sm font-medium text-tinta underline underline-offset-4 disabled:opacity-50">
            <PencilLine size={14} aria-hidden="true" />
            <span className="hidden tab:inline">Editar</span>
          </button>
        )}
        <button type="button" onClick={descargar} className="inline-flex items-center gap-2 text-sm font-medium text-tinta underline underline-offset-4">
          <Download size={14} aria-hidden="true" />
          <span className="hidden tab:inline">Descargar</span>
        </button>
      </header>

      {/* Edición del Word, solo FIRMA: el borrador y sus botones. */}
      {puedeEditar && (edicion || borradorDoc) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 tab:px-6 py-2.5 shrink-0 bg-marfil border-b border-borde-suave text-sm">
          {edicion ? (
            <>
              <p className="flex-1 min-w-[220px] leading-[1.45] text-tinta">
                <strong>Estás editando.</strong> {sucio ? 'Hay cambios sin guardar.' : edicion.visto ? 'Borrador guardado.' : 'Todavía no cambiaste nada.'} El cliente no ve nada hasta que publiques.
                {fijos > 0 && <span className="text-piedra"> {fijos === 1 ? 'Hay un párrafo' : `Hay ${fijos} párrafos`} en gris que no se {fijos === 1 ? 'puede' : 'pueden'} editar acá.</span>}
              </p>
              <button type="button" onClick={() => void guardar()} disabled={!sucio || ocupadoDoc !== ''} className={`${botonBarra} border border-tinta text-tinta`}>
                {ocupadoDoc === 'guardar' ? 'Guardando…' : 'Guardar borrador'}
              </button>
              <button type="button" onClick={() => void publicarDoc()} disabled={(!sucio && !edicion.visto) || ocupadoDoc !== ''} className={`${botonBarra} bg-tinta text-marfil`}>
                {ocupadoDoc === 'publicar' ? 'Publicando…' : 'Publicar'}
              </button>
              <button type="button" onClick={salirDeEditar} disabled={ocupadoDoc !== ''} className="text-sm text-piedra underline underline-offset-4 hover:text-tinta">
                Salir
              </button>
            </>
          ) : (
            borradorDoc && (
              <>
                <p className="flex-1 min-w-[220px] leading-[1.45] text-tinta">
                  <strong>Hay una edición sin publicar</strong>, guardada el {fechaHoraAsunto(borradorDoc.actualizado_en)} por {nombreDe(borradorDoc.creado_por)}. El cliente sigue viendo la versión de abajo.
                </p>
                <button type="button" onClick={editar} disabled={ocupadoDoc !== '' || !fuente?.blob} className={`${botonBarra} border border-tinta text-tinta`}>
                  {ocupadoDoc === 'abrir' ? 'Abriendo…' : 'Seguir editando'}
                </button>
                <button type="button" onClick={() => void publicarDoc()} disabled={ocupadoDoc !== ''} className={`${botonBarra} bg-tinta text-marfil`}>
                  {ocupadoDoc === 'publicar' ? 'Publicando…' : 'Publicar'}
                </button>
                <button type="button" onClick={() => void descartarDoc()} disabled={ocupadoDoc !== ''} className="text-sm text-piedra underline underline-offset-4 hover:text-tinta">
                  Descartar
                </button>
              </>
            )
          )}
        </div>
      )}
      {errorDoc && (
        <div className="px-4 tab:px-6 py-2.5 shrink-0 bg-papel border-b border-borde-suave">
          <Aviso tipo="error">{errorDoc}</Aviso>
        </div>
      )}
      {verHistorial && !edicion && (
        <div className="px-4 tab:px-6 py-3 shrink-0 max-h-[40vh] overflow-auto bg-papel border-b border-borde-suave">
          <ul className="flex flex-col divide-y divide-borde-suave max-w-[720px]">
            {publicadas.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                <span className="font-semibold text-tinta">Versión {v.numero}</span>
                <span className="flex-1 min-w-[180px] text-piedra">
                  {fechaHoraAsunto(v.publicado_en ?? v.creado_en)} · {nombreDe(v.creado_por)}
                </span>
                {v.ruta === archivo.ruta ? (
                  <Etiqueta tono="tinta">La que se ve hoy</Etiqueta>
                ) : (
                  <>
                    <button type="button" onClick={() => void descargarVersion(v)} className="font-medium text-tinta underline underline-offset-4">
                      Descargar
                    </button>
                    {puedeEditar && (
                      <button type="button" onClick={() => void restaurar(v)} disabled={ocupadoDoc !== ''} className="font-medium text-tinta underline underline-offset-4 disabled:opacity-50">
                        {ocupadoDoc === 'restaurar' ? 'Trayendo…' : 'Traer como borrador'}
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* En el celular, una cosa por vez. */}
      <div className="desk:hidden flex shrink-0 border-b border-borde-suave bg-papel" role="tablist">
        {(['documento', 'comentarios'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vistaMovil === v}
            onClick={() => setVistaMovil(v)}
            className={`flex-1 h-11 text-sm font-medium border-b-2 ${vistaMovil === v ? 'border-tinta text-tinta' : 'border-transparent text-piedra'}`}
          >
            {v === 'documento' ? 'Documento' : `Comentarios${abiertos.length ? ` (${abiertos.length})` : ''}`}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid desk:grid-cols-[minmax(0,1fr)_380px]">
        <div ref={areaDoc} onClick={tocarDocumento} className={`min-h-0 overflow-auto bg-linea-suave ${vistaMovil === 'documento' ? '' : 'hidden desk:block'}`}>
          {!tipo ? (
            <div className="p-8 text-sm text-piedra">Este formato no se puede ver en el portal. Descargalo para abrirlo.</div>
          ) : errorCarga ? (
            <div className="p-8 text-sm text-piedra">No pudimos abrir el documento. Cerrá y volvé a abrirlo, o descargalo.</div>
          ) : !fuente ? (
            <div className="p-8 eyebrow text-piedra animate-pulse">Cargando el documento</div>
          ) : tipo === 'pdf' ? (
            <VistaPdf url={fuente.url} marcas={marcas} activo={activo} alError={fallo} />
          ) : edicion ? (
            <EditorWord
              key={edicion.clave}
              ref={editor}
              blob={edicion.blob}
              alEditar={marcarSucio}
              alListo={editorListo}
              alError={editorFallo}
            />
          ) : (
            <VistaWord blob={fuente.blob as Blob} marcas={marcas} activo={activo} alError={fallo} alPerdidos={setPerdidos} />
          )}
        </div>

        <aside ref={panel} className={`min-h-0 overflow-auto bg-papel desk:border-l border-borde-suave ${vistaMovil === 'comentarios' ? '' : 'hidden desk:block'}`}>
          <div className="p-4 tab:p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-[17px]">Comentarios</h2>
              {!soloLectura && !borrador && (
                <button type="button" onClick={() => setBorrador({ cita: null, ancla: null })} className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4">
                  <MessageSquarePlus size={15} aria-hidden="true" /> Comentar el documento
                </button>
              )}
            </div>
            {esFirma && hilos.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                <button type="button" onClick={copiarComentarios} className="inline-flex items-center gap-1.5 font-medium text-tinta underline underline-offset-4">
                  {copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                  {copiado ? 'Copiados' : 'Copiar todos'}
                </button>
                <button type="button" onClick={descargarComentarios} className="inline-flex items-center gap-1.5 font-medium text-tinta underline underline-offset-4">
                  <FileDown size={13} aria-hidden="true" /> Descargar en Word
                </button>
              </div>
            )}
            {!soloLectura && hilos.length === 0 && !borrador && (
              <p className="text-sm leading-[1.5] text-piedra">
                Seleccioná una frase del documento y tocá <strong className="text-tinta">Comentar</strong>, o dejá un comentario sobre el documento entero.
              </p>
            )}
            {soloLectura && hilos.length === 0 && <p className="text-sm text-piedra">Todavía no hay comentarios.</p>}
            {error && <Aviso tipo="error">{error}</Aviso>}

            {borrador && <NuevoComentario borrador={borrador} esFirma={esFirma} alPublicar={publicar} alCancelar={() => setBorrador(null)} />}

            {mostrados.map((h) => (
              <TarjetaHilo
                key={h.id}
                hilo={h}
                activo={activo === h.id}
                sinTexto={!edicion && perdidos.includes(h.id)}
                soloLectura={soloLectura}
                nombreDe={nombreDe}
                puedeBorrar={puedeBorrar}
                borrador={soloLectura ? null : borradorDe(h)}
                alPublicarBorrador={(t) => publicarBorrador(h, t)}
                alDescartarBorrador={() => void cerrarBorrador(h, 'descartado')}
                alElegir={() => irALaFrase(h)}
                alResponder={(t) => responder(h, t)}
                alResolver={(r) => resolver(h, r)}
                alBorrar={borrar}
              />
            ))}

            {resueltos.length > 0 && (
              <button type="button" onClick={() => setVerResueltos((v) => !v)} className="self-start text-sm text-piedra underline underline-offset-4 hover:text-tinta">
                {verResueltos ? 'Ocultar los resueltos' : `Ver ${resueltos.length === 1 ? 'el resuelto' : `los ${resueltos.length} resueltos`}`}
              </button>
            )}
          </div>
        </aside>
      </div>

      {seleccion && !soloLectura && !edicion && (
        <button
          type="button"
          // Sin perder la selección al tocar el botón.
          onMouseDown={(e) => e.preventDefault()}
          onClick={comentarSeleccion}
          className="fixed z-[60] inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-tinta text-marfil text-sm font-medium shadow-lg"
          style={{
            left: Math.max(8, Math.min(window.innerWidth - 130, seleccion.caja.left + seleccion.caja.width / 2 - 60)),
            top: seleccion.caja.top > 120 ? seleccion.caja.top - 44 : seleccion.caja.bottom + 8,
          }}
        >
          <MessageSquarePlus size={15} aria-hidden="true" /> Comentar
        </button>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */
const Cita: React.FC<{ texto: string }> = ({ texto }) => (
  <blockquote className="border-l-[3px] border-[#E0A92E] bg-[#FBF3DD] px-3 py-1.5 text-[13px] leading-[1.45] text-tinta/80 italic line-clamp-3">{texto}</blockquote>
);

const NuevoComentario: React.FC<{
  borrador: Borrador;
  esFirma: boolean;
  alPublicar: (texto: string, interna: boolean) => Promise<boolean>;
  alCancelar: () => void;
}> = ({ borrador, esFirma, alPublicar, alCancelar }) => {
  const [texto, setTexto] = useState('');
  const [interna, setInterna] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setOcupado(true);
    const ok = await alPublicar(texto.trim(), interna);
    setOcupado(false);
    if (ok) setTexto('');
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 border border-tinta rounded-control p-3.5 bg-papel">
      {borrador.cita ? <Cita texto={borrador.cita} /> : <span className="text-[13px] font-medium text-piedra">Sobre el documento entero</span>}
      <textarea
        autoFocus
        rows={3}
        maxLength={4000}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void enviar(e);
        }}
        placeholder="Escribí tu comentario"
        className={claseCampo}
      />
      {esFirma && (
        <label className="inline-flex items-center gap-2 text-sm text-tinta">
          <input type="checkbox" checked={interna} onChange={(e) => setInterna(e.target.checked)} className="w-4 h-4 accent-tinta" />
          Interno, solo lo ve FIRMA
        </label>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={ocupado || !texto.trim()} className="h-10 px-4 rounded-control bg-tinta text-marfil text-sm font-medium disabled:opacity-50">
          {ocupado ? 'Guardando…' : 'Comentar'}
        </button>
        <button type="button" onClick={alCancelar} className="text-sm text-piedra underline underline-offset-4 hover:text-tinta">
          Cancelar
        </button>
      </div>
    </form>
  );
};

const TarjetaHilo: React.FC<{
  hilo: Hilo;
  activo: boolean;
  /** La frase comentada ya no está en el documento, porque se publicó una versión nueva. */
  sinTexto: boolean;
  soloLectura: boolean;
  nombreDe: (autorId: string | null) => string;
  puedeBorrar: (c: Comentario) => boolean;
  alElegir: () => void;
  alResponder: (texto: string) => Promise<boolean>;
  alResolver: (resuelto: boolean) => void;
  alBorrar: (c: Comentario) => void;
  borrador: BorradorTina | null;
  alPublicarBorrador: (texto: string) => Promise<boolean>;
  alDescartarBorrador: () => void;
}> = ({ hilo, activo, sinTexto, soloLectura, nombreDe, puedeBorrar, alElegir, alResponder, alResolver, alBorrar, borrador, alPublicarBorrador, alDescartarBorrador }) => {
  const [respuesta, setRespuesta] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!respuesta.trim()) return;
    setOcupado(true);
    const ok = await alResponder(respuesta.trim());
    setOcupado(false);
    if (ok) setRespuesta('');
  }

  const Mensaje = ({ c }: { c: Comentario }) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-semibold text-tinta">{nombreDe(c.autor_id)}</span>
        <span className="text-[12px] text-piedra">{fechaHoraAsunto(c.creado_en)}</span>
        {puedeBorrar(c) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              alBorrar(c);
            }}
            className="ml-auto text-piedra hover:text-peligro"
            aria-label="Borrar"
            title="Borrar"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-[14px] leading-[1.5] text-tinta whitespace-pre-wrap break-words">{c.texto}</p>
    </div>
  );

  return (
    <article
      data-hilo={hilo.id}
      onClick={alElegir}
      className={`flex flex-col gap-3 rounded-control p-3.5 border cursor-pointer transition-shadow ${
        activo ? 'border-tinta shadow-md bg-papel' : 'border-borde-suave bg-papel hover:border-borde'
      } ${hilo.resuelto_en ? 'opacity-70' : ''}`}
    >
      {(hilo.interna || hilo.resuelto_en) && (
        <div className="flex flex-wrap gap-2">
          {hilo.interna && <Etiqueta tono="tinta">Interno</Etiqueta>}
          {hilo.resuelto_en && <Etiqueta>Resuelto{hilo.resuelto_por ? ` por ${nombreDe(hilo.resuelto_por)}` : ''}</Etiqueta>}
        </div>
      )}
      {hilo.cita ? <Cita texto={hilo.cita} /> : <span className="text-[12px] font-medium text-piedra">Sobre el documento entero</span>}
      {sinTexto && <span className="text-[12px] leading-[1.4] text-piedra">Esta frase cambió o ya no está en la versión actual del documento.</span>}
      <Mensaje c={hilo} />
      {hilo.respuestas.map((r) => (
        <div key={r.id} className="pl-3 border-l border-borde-suave">
          <Mensaje c={r} />
        </div>
      ))}

      {borrador && <BorradorDeTina key={borrador.hasta} borrador={borrador} alPublicar={alPublicarBorrador} alDescartar={alDescartarBorrador} />}

      {!soloLectura && (
        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          {activo && !hilo.resuelto_en && !borrador && (
            <form onSubmit={enviar} className="flex flex-col gap-2">
              <textarea
                rows={2}
                maxLength={4000}
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void enviar(e);
                }}
                placeholder="Responder"
                className={claseCampo}
              />
              {respuesta.trim() && (
                <button type="submit" disabled={ocupado} className="self-start h-9 px-3.5 rounded-control bg-tinta text-marfil text-sm font-medium disabled:opacity-50">
                  {ocupado ? 'Guardando…' : 'Responder'}
                </button>
              )}
            </form>
          )}
          <button
            type="button"
            onClick={() => alResolver(!hilo.resuelto_en)}
            className="self-start inline-flex items-center gap-1.5 text-[13px] font-medium text-tinta underline underline-offset-4"
          >
            {hilo.resuelto_en ? <RotateCcw size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
            {hilo.resuelto_en ? 'Reabrir' : 'Marcar como resuelto'}
          </button>
        </div>
      )}
    </article>
  );
};

/** Lo que Tina preparó para un hilo. FIRMA lo corrige y lo publica como respuesta, o lo descarta. */
const BorradorDeTina: React.FC<{ borrador: BorradorTina; alPublicar: (texto: string) => Promise<boolean>; alDescartar: () => void }> = ({ borrador, alPublicar, alDescartar }) => {
  const [texto, setTexto] = useState(borrador.respuesta);
  const [ocupado, setOcupado] = useState(false);
  const [copiada, setCopiada] = useState(false);

  async function publicar() {
    if (!texto.trim()) return;
    setOcupado(true);
    await alPublicar(texto.trim());
    setOcupado(false);
  }

  async function copiarClausula() {
    try {
      await navigator.clipboard.writeText(borrador.clausula ?? '');
      setCopiada(true);
      window.setTimeout(() => setCopiada(false), 2500);
    } catch {
      /* Sin permiso para copiar: el texto queda a la vista para seleccionarlo. */
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-control border border-dashed border-borde bg-marfil p-3 cursor-default" onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-tinta">
        <Sparkles size={13} aria-hidden="true" /> Borrador de Tina, solo lo ves vos
      </span>
      <p className="text-[13px] leading-[1.45] text-tinta">
        <strong>Qué pide:</strong> {borrador.pedido}
      </p>
      {borrador.nota && (
        <p className="text-[13px] leading-[1.45] text-tinta">
          <strong>Para revisar:</strong> {borrador.nota}
        </p>
      )}
      <label className="flex flex-col gap-1 text-[12px] font-medium text-piedra">
        Respuesta para el cliente
        <textarea rows={5} maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)} className={claseCampo} />
      </label>
      {borrador.clausula && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-piedra">Texto sugerido para el documento</span>
            <button type="button" onClick={copiarClausula} className="inline-flex items-center gap-1 text-[12px] font-medium text-tinta underline underline-offset-4">
              {copiada ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              {copiada ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="max-h-48 overflow-auto rounded-control border border-borde-suave bg-papel px-3 py-2 text-[13px] leading-[1.5] text-tinta whitespace-pre-wrap break-words">{borrador.clausula}</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={publicar} disabled={ocupado || !texto.trim()} className="h-9 px-3.5 rounded-control bg-tinta text-marfil text-sm font-medium disabled:opacity-50">
          {ocupado ? 'Publicando…' : 'Publicar respuesta'}
        </button>
        <button type="button" onClick={alDescartar} disabled={ocupado} className="text-sm text-piedra underline underline-offset-4 hover:text-tinta">
          Descartar
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Resaltes                                                            */
/* ------------------------------------------------------------------ */
/** Pinta en amarillo las frases comentadas de una superficie. Se recalcula si cambia el tamaño. */
const Resaltes: React.FC<{ superficie: HTMLElement | null; marcas: Marca[]; activo: string | null; listo: number }> = ({ superficie, marcas, activo, listo }) => {
  const capa = useRef<HTMLDivElement>(null);
  const [cajas, setCajas] = useState<{ id: string; x: number; y: number; w: number; h: number }[]>([]);
  const [medida, setMedida] = useState(0);

  useEffect(() => {
    const el = capa.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setMedida((m) => m + 1));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = capa.current;
    if (!el || !superficie || !listo) return setCajas([]);
    const base = el.getBoundingClientRect();
    const nuevas: typeof cajas = [];
    for (const m of marcas) {
      const pos = ubicar(superficie, m.ancla, m.cita);
      const r = pos && rangoDe(superficie, pos.inicio, pos.fin);
      if (!r) continue;
      for (const c of r.getClientRects()) {
        if (c.width < 1 || c.height < 1) continue;
        nuevas.push({ id: m.id, x: c.left - base.left, y: c.top - base.top, w: c.width, h: c.height });
      }
    }
    setCajas(nuevas);
  }, [superficie, marcas, listo, medida]);

  return (
    <div ref={capa} className="absolute inset-0 pointer-events-none z-[1]" aria-hidden="true">
      {cajas.map((c, i) => (
        <div key={`${c.id}-${i}`} data-id={c.id} className={`resalte-comentario ${activo === c.id ? 'activo' : ''}`} style={{ left: c.x, top: c.y, width: c.w, height: c.h }} />
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */
const VistaPdf: React.FC<{ url: string; marcas: Marca[]; activo: string | null; alError: () => void }> = ({ url, marcas, activo, alError }) => {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ancho, setAncho] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    const tarea = getDocument({ url, isEvalSupported: false });
    tarea.promise.then(
      (d) => vivo && setDoc(d),
      () => vivo && alError(),
    );
    return () => {
      vivo = false;
      void tarea.destroy();
    };
  }, [url, alError]);

  // Las hojas ocupan el ancho disponible, hasta 860 px. Se vuelven a dibujar si cambia, con una pausa.
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    let espera = 0;
    const medir = () => {
      const w = Math.min(860, el.clientWidth - (el.clientWidth < 720 ? 24 : 48));
      if (w > 0) setAncho((a) => (a === 0 ? w : a));
      window.clearTimeout(espera);
      espera = window.setTimeout(() => w > 0 && setAncho(w), 200);
    };
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      window.clearTimeout(espera);
    };
  }, []);

  return (
    <div ref={caja} className="flex flex-col items-center gap-4 tab:gap-6 py-4 tab:py-6">
      {!doc || !ancho ? (
        <div className="eyebrow text-piedra animate-pulse py-10">Cargando el documento</div>
      ) : (
        Array.from({ length: doc.numPages }, (_, i) => (
          <HojaPdf key={i} doc={doc} numero={i + 1} ancho={ancho} marcas={marcas.filter((m) => m.ancla.pagina === i + 1)} activo={activo} />
        ))
      )}
    </div>
  );
};

const HojaPdf: React.FC<{ doc: PDFDocumentProxy; numero: number; ancho: number; marcas: Marca[]; activo: string | null }> = ({ doc, numero, ancho, marcas, activo }) => {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [capa, setCapa] = useState<HTMLDivElement | null>(null);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [cerca, setCerca] = useState(numero <= 2);
  const [listo, setListo] = useState(0);

  // Medida real de la hoja, para reservar el lugar antes de dibujarla.
  useEffect(() => {
    let vivo = true;
    void doc.getPage(numero).then((p) => {
      const v = p.getViewport({ scale: 1 });
      if (vivo) setBase({ w: v.width, h: v.height });
    });
    return () => {
      vivo = false;
    };
  }, [doc, numero]);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setCerca(true), { rootMargin: '1200px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!cerca || !capa) return;
    let vivo = true;
    let dibujo: { cancel: () => void } | null = null;
    let texto: TextLayer | null = null;
    void doc.getPage(numero).then(async (p) => {
      const c = lienzo.current;
      if (!vivo || !c) return;
      const escala = ancho / p.getViewport({ scale: 1 }).width;
      // Nitidez según la pantalla, con tope para no gastar memoria en celulares.
      const nitida = p.getViewport({ scale: escala * Math.min(window.devicePixelRatio || 1, 2) });
      c.width = Math.floor(nitida.width);
      c.height = Math.floor(nitida.height);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const r = p.render({ canvasContext: ctx, viewport: nitida });
      dibujo = r;
      try {
        await r.promise;
      } catch {
        return;
      }
      if (!vivo) return;
      capa.replaceChildren();
      texto = new TextLayer({ textContentSource: p.streamTextContent(), container: capa, viewport: p.getViewport({ scale: escala }) });
      try {
        await texto.render();
      } catch {
        return;
      }
      if (vivo) setListo((x) => x + 1);
    });
    return () => {
      vivo = false;
      dibujo?.cancel();
      texto?.cancel();
    };
  }, [cerca, capa, doc, numero, ancho]);

  const escala = base ? ancho / base.w : 1;
  const alto = base ? ancho * (base.h / base.w) : ancho * 1.414;

  return (
    <div
      ref={caja}
      data-hoja={numero}
      className="relative shrink-0 bg-white shadow-hoja"
      style={{ width: ancho, height: alto, ['--scale-factor' as string]: escala }}
    >
      <canvas ref={lienzo} className="absolute inset-0 w-full h-full select-none" aria-label={`Hoja ${numero}`} />
      <Resaltes superficie={capa} marcas={marcas} activo={activo} listo={listo} />
      <div ref={setCapa} className="capa-texto" data-superficie="" data-pagina={numero} />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Word                                                                */
/* ------------------------------------------------------------------ */
const VistaWord: React.FC<{ blob: Blob; marcas: Marca[]; activo: string | null; alError: () => void; alPerdidos: (ids: string[]) => void }> = ({
  blob,
  marcas,
  activo,
  alError,
  alPerdidos,
}) => {
  const [cuerpo, setCuerpo] = useState<HTMLDivElement | null>(null);
  const estilos = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(0);

  useEffect(() => {
    if (!cuerpo || !estilos.current) return;
    let vivo = true;
    const est = estilos.current;
    cargarFuentesDocumentos();
    void import('docx-preview')
      .then(({ renderAsync }) =>
        renderAsync(blob, cuerpo, est, {
          className: 'docx',
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
          renderComments: false,
          renderChanges: false,
          experimental: false,
        }),
      )
      .then(
        () => vivo && setListo((x) => x + 1),
        () => vivo && alError(),
      );
    return () => {
      vivo = false;
      cuerpo.replaceChildren();
      est.replaceChildren();
    };
  }, [blob, cuerpo, alError]);

  // Los comentarios cuya frase ya no está en el documento, para avisarlo en su hilo.
  useEffect(() => {
    if (!cuerpo || !listo) return;
    const ids = marcas.filter((m) => !ubicar(cuerpo, m.ancla, m.cita)).map((m) => m.id);
    alPerdidos(ids);
  }, [cuerpo, listo, marcas, alPerdidos]);

  return (
    <div className="vista-word py-4 tab:py-6 px-3 tab:px-6">
      <div ref={estilos} hidden />
      <div className="relative w-fit min-w-full">
        <div ref={setCuerpo} data-superficie="" />
        <Resaltes superficie={cuerpo} marcas={marcas} activo={activo} listo={listo} />
      </div>
    </div>
  );
};

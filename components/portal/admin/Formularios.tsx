import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Enlace, Etiqueta, Interruptor, claseInput } from '../ui';
import { fechaCorta, type Documento, type Organizacion } from '../tipos';
import type { Pregunta, Seccion, TipoPregunta } from '../pedidos/formulario';
import { TIPOS_PREGUNTA, claveNueva, clavePregunta, rutaModeloPropio, seccionPersona, seccionesSeguras, type ModeloPropio } from '../pedidos/propio';

/**
 * Administración › Formularios. FIRMA arma acá los modelos de contrato
 * propios de cada empresa (migración 0068): el nombre, el contrato modelo
 * y las preguntas del formulario. El cliente los ve en Documentos ›
 * Contratos con tu equipo, al lado de closer y setter, como «Pedir un …».
 * Lo ya enviado no cambia: cada pedido guarda la copia del formulario con
 * el que se respondió.
 */

/** Una pregunta mientras se edita. Las opciones y las columnas se escriben una por renglón. */
interface PreguntaEdit {
  clave: string;
  tipo: TipoPregunta;
  etiqueta: string;
  ayuda: string;
  obligatoria: boolean;
  otra: boolean;
  renglones: string;
  /** Las opciones o columnas guardadas, para no cambiarles la clave si el texto sigue igual. */
  previas: { clave: string; texto: string }[];
}

interface SeccionEdit {
  clave: string;
  titulo: string;
  bajada: string;
  porContrato: boolean;
  preguntas: PreguntaEdit[];
}

interface Borrador {
  id?: string;
  organizacion_id: string;
  titulo: string;
  persona: string;
  descripcion: string;
  documento_id: string;
  activo: boolean;
  orden: number;
  secciones: SeccionEdit[];
}

const conRenglones = (t: TipoPregunta) => t === 'opcion' || t === 'varias' || t === 'tabla';

function aEdicion(s: Seccion): SeccionEdit {
  return {
    clave: s.clave,
    titulo: s.titulo,
    bajada: s.bajada,
    porContrato: Boolean(s.porContrato),
    preguntas: s.preguntas.map((p) => {
      const previas = p.tipo === 'tabla' ? (p.columnas ?? []).map((c) => ({ clave: c.clave, texto: c.titulo })) : (p.opciones ?? []).map((o) => ({ clave: o.valor, texto: o.texto }));
      return {
        clave: p.clave,
        tipo: p.tipo,
        etiqueta: p.etiqueta,
        ayuda: p.ayuda ?? '',
        obligatoria: Boolean(p.obligatoria),
        otra: Boolean(p.otra),
        renglones: previas.map((x) => x.texto).join('\n'),
        previas,
      };
    }),
  };
}

const preguntaNueva = (porContrato: boolean): PreguntaEdit => ({
  clave: clavePregunta(porContrato),
  tipo: 'texto',
  etiqueta: '',
  ayuda: '',
  obligatoria: false,
  otra: false,
  renglones: '',
  previas: [],
});

const seccionNueva = (): SeccionEdit => ({ clave: claveNueva('s'), titulo: '', bajada: '', porContrato: false, preguntas: [preguntaNueva(false)] });

const lineas = (t: string) => [...new Set(t.split('\n').map((x) => x.trim()).filter(Boolean))];

/** Lo que se guarda, con el formato de formulario.ts. Devuelve el error para mostrar si falta algo. */
function aGuardar(secciones: SeccionEdit[]): Seccion[] | string {
  if (!secciones.length) return 'Sumá al menos una sección con una pregunta.';
  const out: Seccion[] = [];
  for (const [i, s] of secciones.entries()) {
    const nombre = s.titulo.trim() || `la sección ${i + 1}`;
    if (!s.titulo.trim()) return `Poné un título a ${nombre}.`;
    if (!s.preguntas.length) return `Sumá al menos una pregunta en «${nombre}».`;
    const preguntas: Pregunta[] = [];
    for (const p of s.preguntas) {
      if (!p.etiqueta.trim()) return `Hay una pregunta sin texto en «${nombre}».`;
      const renglones = lineas(p.renglones);
      const claveDe = (texto: string, prefijo: string) => p.previas.find((x) => x.texto === texto)?.clave ?? claveNueva(prefijo);
      if ((p.tipo === 'opcion' || p.tipo === 'varias') && renglones.length < 2) return `«${p.etiqueta.trim()}» necesita al menos dos opciones, una por renglón.`;
      if (p.tipo === 'tabla' && renglones.length < 1) return `«${p.etiqueta.trim()}» necesita al menos una columna.`;
      if (p.tipo === 'tabla' && renglones.length > 5) return `«${p.etiqueta.trim()}» admite hasta cinco columnas.`;
      preguntas.push({
        // Los datos de la persona llevan el prefijo propio_: es lo que la base deja completar después de enviar.
        clave: clavePregunta(s.porContrato, p.clave),
        tipo: p.tipo,
        etiqueta: p.etiqueta.trim(),
        ...(p.ayuda.trim() ? { ayuda: p.ayuda.trim() } : {}),
        ...(p.obligatoria && !s.porContrato ? { obligatoria: true } : {}),
        ...(p.tipo === 'opcion' || p.tipo === 'varias' ? { opciones: renglones.map((t) => ({ valor: claveDe(t, 'o'), texto: t })), ...(p.otra ? { otra: true } : {}) } : {}),
        ...(p.tipo === 'tabla' ? { columnas: renglones.map((t) => ({ clave: claveDe(t, 'c'), titulo: t })) } : {}),
      });
    }
    out.push({ clave: s.clave, titulo: s.titulo.trim(), bajada: s.bajada.trim(), ...(s.porContrato ? { porContrato: true } : {}), preguntas });
  }
  return out;
}

const claseEtiqueta = 'block text-[12.5px] font-medium text-piedra mb-2';
const claseLink = 'underline underline-offset-4 hover:text-bosque';
const claseIcono = 'h-10 w-10 inline-flex items-center justify-center text-piedra transition-colors duration-150 hover:text-tinta disabled:opacity-30';

export const Formularios: React.FC = () => {
  const [lista, setLista] = useState<ModeloPropio[]>([]);
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  async function cargar() {
    if (!supabase) return;
    const [m, o, d] = await Promise.all([
      supabase.from('modelos_contrato').select('*').order('orden').order('creado_en'),
      supabase.from('organizaciones').select('*').order('nombre'),
      supabase.from('documentos').select('*').eq('seccion', 'equipo').not('organizacion_id', 'is', null).order('titulo'),
    ]);
    if (m.error) setError(`${m.error.message}. Revisá que la migración 0068_contratos_equipo_y_modelos.sql esté corrida en Supabase.`);
    setLista((m.data as ModeloPropio[]) ?? []);
    setOrgs((o.data as Organizacion[]) ?? []);
    setDocs((d.data as Documento[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  function abrir(b: Borrador) {
    setBorrador(b);
    setError(null);
    setOk(null);
    requestAnimationFrame(() => formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function nuevo() {
    abrir({
      organizacion_id: '',
      titulo: '',
      persona: 'prestador',
      descripcion: '',
      documento_id: '',
      activo: true,
      orden: lista.length + 1,
      secciones: [aEdicion(seccionPersona('prestador')), { ...seccionNueva(), titulo: 'Condiciones' }],
    });
  }

  function editar(m: ModeloPropio) {
    abrir({
      id: m.id,
      organizacion_id: m.organizacion_id,
      titulo: m.titulo,
      persona: m.persona,
      descripcion: m.descripcion ?? '',
      documento_id: m.documento_id ?? '',
      activo: m.activo,
      orden: m.orden,
      secciones: seccionesSeguras(m.secciones).map(aEdicion),
    });
  }

  const cambiarSeccion = (i: number, cambio: Partial<SeccionEdit>) =>
    setBorrador((b) => (b ? { ...b, secciones: b.secciones.map((s, j) => (j === i ? { ...s, ...cambio } : s)) } : b));
  const cambiarPregunta = (i: number, k: number, cambio: Partial<PreguntaEdit>) =>
    setBorrador((b) => (b ? { ...b, secciones: b.secciones.map((s, j) => (j === i ? { ...s, preguntas: s.preguntas.map((p, n) => (n === k ? { ...p, ...cambio } : p)) } : s)) } : b));
  /** Mueve un elemento un lugar hacia arriba (-1) o hacia abajo (1). */
  function mover<T>(xs: T[], i: number, paso: number): T[] {
    const j = i + paso;
    if (j < 0 || j >= xs.length) return xs;
    const copia = xs.slice();
    [copia[i], copia[j]] = [copia[j], copia[i]];
    return copia;
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    setError(null);
    setOk(null);
    if (!borrador.organizacion_id) return setError('Elegí la empresa.');
    if (borrador.titulo.trim().length < 3) return setError('Poné el nombre del contrato, por ejemplo «Contrato de marketing».');
    if (borrador.persona.trim().length < 2) return setError('Decinos cómo se nombra a la otra parte, por ejemplo «prestador».');
    const secciones = aGuardar(borrador.secciones);
    if (typeof secciones === 'string') return setError(secciones);
    setGuardando(true);
    const datos = {
      titulo: borrador.titulo,
      persona: borrador.persona,
      descripcion: borrador.descripcion,
      documento_id: borrador.documento_id || null,
      activo: borrador.activo,
      orden: Number(borrador.orden) || 0,
      secciones,
    };
    const { error: err } = borrador.id
      ? await supabase.from('modelos_contrato').update(datos).eq('id', borrador.id)
      : await supabase.from('modelos_contrato').insert({ ...datos, organizacion_id: borrador.organizacion_id });
    setGuardando(false);
    if (err) return setError(err.message);
    setOk(borrador.id ? 'Formulario actualizado. Los pedidos ya enviados quedan como estaban.' : 'Formulario creado. El cliente ya lo ve en Documentos › Contratos con tu equipo.');
    setBorrador(null);
    void cargar();
  }

  async function alternar(m: ModeloPropio) {
    if (!supabase) return;
    setError(null);
    setOk(null);
    const { error: err } = await supabase.from('modelos_contrato').update({ activo: !m.activo }).eq('id', m.id);
    if (err) return setError(err.message);
    void cargar();
  }

  async function borrar(m: ModeloPropio) {
    if (!supabase || !window.confirm(`¿Eliminar el formulario «${m.titulo}»?`)) return;
    setError(null);
    setOk(null);
    const { error: err } = await supabase.from('modelos_contrato').delete().eq('id', m.id);
    // Con pedidos hechos no se borra: se oculta, para que esos pedidos conserven su formulario.
    if (err) return setError(err.code === '23503' ? 'Este formulario ya tiene pedidos, así que no se puede eliminar. Ocultalo y el cliente deja de verlo.' : err.message);
    if (borrador?.id === m.id) setBorrador(null);
    setOk('Formulario eliminado.');
    void cargar();
  }

  const nombreOrg = (id: string) => orgs.find((o) => o.id === id)?.nombre ?? 'Un cliente';
  // Documentos de la empresa que pueden ser el contrato modelo: los de la sección, sin persona.
  const docsDeOrg = borrador ? docs.filter((d) => d.organizacion_id === borrador.organizacion_id && !d.equipo_miembro_id) : [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-piedra max-w-[72ch]">
        Armá el formulario de un contrato para una empresa, sin pasar por programación. Le aparece en Documentos › Contratos con tu equipo como «Pedir un…», al lado de closer y setter, y al enviarlo se abre el asunto
        con las respuestas.
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {borrador ? (
        <form ref={formulario} onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-6 max-w-[860px]" style={{ scrollMarginTop: 120 }}>
          <h2 className="h3">{borrador.id ? 'Editar formulario' : 'Nuevo formulario'}</h2>

          <div className="grid gap-5 tab:grid-cols-2">
            <Campo etiqueta="Empresa" ayuda={borrador.id ? 'No se cambia después de creado.' : undefined}>
              <select
                required
                disabled={Boolean(borrador.id)}
                className={claseInput}
                value={borrador.organizacion_id}
                onChange={(e) => setBorrador({ ...borrador, organizacion_id: e.target.value, documento_id: '' })}
              >
                <option value="">Elegí la empresa</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Nombre del contrato" ayuda="Así se llama la tarjeta («Pedir un contrato de marketing») y el asunto.">
              <input required maxLength={80} className={claseInput} value={borrador.titulo} onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })} placeholder="Contrato de marketing" />
            </Campo>
            <Campo etiqueta="Cómo se nombra a la otra parte" ayuda="En singular y en minúscula. Se usa en textos como «los datos del prestador».">
              <input required maxLength={40} className={claseInput} value={borrador.persona} onChange={(e) => setBorrador({ ...borrador, persona: e.target.value })} placeholder="prestador" />
            </Campo>
            <Campo etiqueta="Contrato modelo (opcional)" ayuda="Un documento de la empresa en Contratos con tu equipo. El cliente lo baja desde la tarjeta. Cargalo antes en la pestaña Documentos.">
              <select className={claseInput} value={borrador.documento_id} onChange={(e) => setBorrador({ ...borrador, documento_id: e.target.value })} disabled={!borrador.organizacion_id}>
                <option value="">Sin contrato modelo</option>
                {docsDeOrg.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.titulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo etiqueta="Texto de la tarjeta (opcional)" ayuda="Una o dos frases sobre qué se pide y para qué. Si lo dejás vacío va un texto general.">
            <textarea
              rows={2}
              maxLength={400}
              className={`${claseInput} h-auto py-3`}
              value={borrador.descripcion}
              onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
              placeholder="Contanos qué va a hacer, cómo se le paga y por cuánto tiempo. Con eso redactamos el contrato."
            />
          </Campo>

          <div className="space-y-5">
            <span className={claseEtiqueta}>Secciones y preguntas</span>
            {borrador.secciones.map((s, i) => (
              <fieldset key={s.clave} className="bg-white border border-tinta/15 p-5 space-y-5">
                <legend className="sr-only">Sección {i + 1}</legend>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="grow min-w-[220px]">
                    <Campo etiqueta={`Sección ${i + 1}`}>
                      <input className={claseInput} maxLength={80} value={s.titulo} onChange={(e) => cambiarSeccion(i, { titulo: e.target.value })} placeholder="Honorarios" />
                    </Campo>
                  </div>
                  <div className="flex items-center pt-7">
                    <button type="button" className={claseIcono} aria-label={`Subir la sección ${i + 1}`} disabled={i === 0} onClick={() => setBorrador({ ...borrador, secciones: mover(borrador.secciones, i, -1) })}>
                      <ArrowUp size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={claseIcono}
                      aria-label={`Bajar la sección ${i + 1}`}
                      disabled={i === borrador.secciones.length - 1}
                      onClick={() => setBorrador({ ...borrador, secciones: mover(borrador.secciones, i, 1) })}
                    >
                      <ArrowDown size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`${claseIcono} hover:text-peligro`}
                      aria-label={`Quitar la sección ${i + 1}`}
                      onClick={() => {
                        if (s.preguntas.some((p) => p.etiqueta.trim()) && !window.confirm('¿Quitar la sección con sus preguntas?')) return;
                        setBorrador({ ...borrador, secciones: borrador.secciones.filter((_, j) => j !== i) });
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <Campo etiqueta="Explicación de la sección (opcional)">
                  <input className={claseInput} maxLength={300} value={s.bajada} onChange={(e) => cambiarSeccion(i, { bajada: e.target.value })} placeholder="Cómo y cuándo se le paga." />
                </Campo>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={s.porContrato} onChange={(e) => cambiarSeccion(i, { porContrato: e.target.checked })} />
                  <span>Son los datos de la persona. El cliente puede dejarlos vacíos y completarlos después de enviar, desde el asunto. La primera pregunta de texto le da el nombre al pedido.</span>
                </label>

                <ol className="space-y-4">
                  {s.preguntas.map((p, k) => (
                    <li key={p.clave} className="border-l-[3px] border-tinta/20 pl-4 space-y-3">
                      <div className="grid gap-3 tab:grid-cols-[minmax(0,1fr)_190px_auto] tab:items-end">
                        <Campo etiqueta={`Pregunta ${k + 1}`}>
                          <input className={claseInput} maxLength={200} value={p.etiqueta} onChange={(e) => cambiarPregunta(i, k, { etiqueta: e.target.value })} placeholder="¿Cuánto cobra por mes?" />
                        </Campo>
                        <Campo etiqueta="Tipo de respuesta">
                          <select className={claseInput} value={p.tipo} onChange={(e) => cambiarPregunta(i, k, { tipo: e.target.value as TipoPregunta })}>
                            {TIPOS_PREGUNTA.map((t) => (
                              <option key={t.clave} value={t.clave}>
                                {t.titulo}
                              </option>
                            ))}
                          </select>
                        </Campo>
                        <div className="flex items-center">
                          <button type="button" className={claseIcono} aria-label={`Subir la pregunta ${k + 1}`} disabled={k === 0} onClick={() => cambiarSeccion(i, { preguntas: mover(s.preguntas, k, -1) })}>
                            <ArrowUp size={16} aria-hidden="true" />
                          </button>
                          <button type="button" className={claseIcono} aria-label={`Bajar la pregunta ${k + 1}`} disabled={k === s.preguntas.length - 1} onClick={() => cambiarSeccion(i, { preguntas: mover(s.preguntas, k, 1) })}>
                            <ArrowDown size={16} aria-hidden="true" />
                          </button>
                          <button type="button" className={`${claseIcono} hover:text-peligro`} aria-label={`Quitar la pregunta ${k + 1}`} onClick={() => cambiarSeccion(i, { preguntas: s.preguntas.filter((_, n) => n !== k) })}>
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      {conRenglones(p.tipo) && (
                        <Campo
                          etiqueta={p.tipo === 'tabla' ? 'Columnas de la tabla, una por renglón' : 'Opciones, una por renglón'}
                          ayuda={p.tipo === 'tabla' ? 'El cliente suma las filas que necesite. Hasta cinco columnas.' : undefined}
                        >
                          <textarea
                            rows={Math.max(3, p.renglones.split('\n').length)}
                            className={`${claseInput} h-auto py-3`}
                            value={p.renglones}
                            onChange={(e) => cambiarPregunta(i, k, { renglones: e.target.value })}
                            placeholder={p.tipo === 'tabla' ? 'Concepto\nMonto\nCuándo se paga' : 'Fijo mensual\nComisión\nFijo más comisión'}
                          />
                        </Campo>
                      )}
                      <Campo etiqueta="Aclaración debajo de la pregunta (opcional)">
                        <input className={claseInput} maxLength={300} value={p.ayuda} onChange={(e) => cambiarPregunta(i, k, { ayuda: e.target.value })} />
                      </Campo>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        {!s.porContrato && (
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={p.obligatoria} onChange={(e) => cambiarPregunta(i, k, { obligatoria: e.target.checked })} />
                            Obligatoria
                          </label>
                        )}
                        {(p.tipo === 'opcion' || p.tipo === 'varias') && (
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={p.otra} onChange={(e) => cambiarPregunta(i, k, { otra: e.target.checked })} />
                            Sumar la opción «Otra», con un campo para detallar
                          </label>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-bosque underline underline-offset-4" onClick={() => cambiarSeccion(i, { preguntas: [...s.preguntas, preguntaNueva(s.porContrato)] })}>
                  <Plus size={15} aria-hidden="true" /> Agregar pregunta
                </button>
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-bosque underline underline-offset-4" onClick={() => setBorrador({ ...borrador, secciones: [...borrador.secciones, seccionNueva()] })}>
                <Plus size={15} aria-hidden="true" /> Agregar sección
              </button>
              {!borrador.secciones.some((s) => s.porContrato) && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-medium text-bosque underline underline-offset-4"
                  onClick={() => setBorrador({ ...borrador, secciones: [aEdicion(seccionPersona(borrador.persona.trim().toLowerCase())), ...borrador.secciones] })}
                >
                  <Plus size={15} aria-hidden="true" /> Agregar los datos de la persona
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-5 tab:grid-cols-2 tab:items-end">
            <Campo etiqueta="Orden" ayuda="Entre los formularios de la empresa. Closer y setter van siempre primero.">
              <input type="number" className={claseInput} value={borrador.orden} onChange={(e) => setBorrador({ ...borrador, orden: Number(e.target.value) })} />
            </Campo>
            <Interruptor activo={borrador.activo} alCambiar={(v) => setBorrador({ ...borrador, activo: v })} etiqueta="Visible para el cliente" ayuda="Oculto, el cliente no lo ve ni puede empezar pedidos nuevos." />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBorrador(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={nuevo}>
          <Plus size={16} /> Nuevo formulario
        </Button>
      )}

      <div className="overflow-x-auto">
        <table className="tabla min-w-[820px]">
          <thead>
            <tr>
              <th>Formulario</th>
              <th>Empresa</th>
              <th>Preguntas</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="text-piedra">
                  Todavía no armaste formularios. Closer y setter ya están para todos los clientes.
                </td>
              </tr>
            )}
            {lista.map((m) => {
              const secciones = seccionesSeguras(m.secciones);
              const doc = docs.find((d) => d.id === m.documento_id);
              return (
                <tr key={m.id}>
                  <td>
                    <div className="font-heading font-bold text-[16px] leading-tight">{m.titulo}</div>
                    <div className="text-xs text-piedra mt-1">
                      {doc ? `Modelo: ${doc.titulo}` : 'Sin contrato modelo'} · Actualizado el {fechaCorta(m.actualizado_en)}
                    </div>
                  </td>
                  <td>{nombreOrg(m.organizacion_id)}</td>
                  <td className="whitespace-nowrap">
                    {secciones.reduce((n, s) => n + s.preguntas.length, 0)}
                    <div className="text-xs text-piedra mt-1">
                      {secciones.length} {secciones.length === 1 ? 'sección' : 'secciones'}
                    </div>
                  </td>
                  <td>{m.activo ? <Etiqueta tono="bosque">Visible</Etiqueta> : <Etiqueta>Oculto</Etiqueta>}</td>
                  <td className="text-right whitespace-nowrap">
                    <Enlace a={rutaModeloPropio(m.id)} className={`${claseLink} mr-4`}>
                      Ver cómo queda
                    </Enlace>
                    <button type="button" className={`${claseLink} mr-4`} onClick={() => editar(m)}>
                      Editar
                    </button>
                    <button type="button" className={`${claseLink} mr-4`} onClick={() => void alternar(m)}>
                      {m.activo ? 'Ocultar' : 'Mostrar'}
                    </button>
                    <button type="button" className="underline underline-offset-4 text-peligro" onClick={() => void borrar(m)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

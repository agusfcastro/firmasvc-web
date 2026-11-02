import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardList, Copy, Plus, Send, Trash2, TriangleAlert } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { useVistaPrevia } from '../vistaPrevia';
import { avisarPorMail } from '../asuntos';
import { Aviso, Encabezado, Enlace, Interruptor, Marco, claseInput } from '../ui';
import { permisosDe, type Organizacion, type Perfil } from '../tipos';
import { MODELOS } from './closer';
import {
  avance,
  datosPendientes,
  esquemaDe,
  faltantes,
  filas,
  lista,
  resumen,
  resumenTexto,
  respuestasIniciales,
  texto,
  visible,
  type Fila,
  type Modelo,
  type Pregunta,
  type Respuestas,
  type Valor,
} from './formulario';

/**
 * Pedidos de contrato en /portal/pedidos/<modelo> (nuevo) y /portal/pedidos/<id>.
 * El titular o el CSM responden por pasos y el borrador se guarda solo.
 * Al enviarlo se abre un asunto de tipo Contrato con las respuestas en la
 * pestaña Formulario. Los datos del closer pueden quedar para después y
 * completarse desde el asunto. Las condiciones se guardan como esquema de
 * la empresa: el próximo pedido arranca con ellas y solo pide los datos
 * del closer. Las reglas de la base están en las migraciones 0034 y 0035.
 */

export interface PedidoContrato {
  id: string;
  organizacion_id: string;
  modelo: keyof typeof MODELOS;
  titulo: string | null;
  respuestas: Respuestas;
  asunto_id: string | null;
  enviado_en: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface EsquemaContrato {
  id: string;
  organizacion_id: string;
  modelo: keyof typeof MODELOS;
  respuestas: Respuestas;
  actualizado_en: string;
}

/** Marca en las respuestas de un pedido que arrancó de un esquema, con su fecha. */
const DESDE_ESQUEMA = '_esquema';

/** Guarda las condiciones como esquema de la empresa: reemplaza el que hubiera. */
async function guardarEsquemaDe(modelo: Modelo, orgId: string, r: Respuestas, existente: EsquemaContrato | null): Promise<string | null> {
  if (!supabase) return 'Portal sin configurar.';
  const { [DESDE_ESQUEMA]: _marca, ...resto } = esquemaDe(modelo, r);
  const { error: e } = existente
    ? await supabase.from('esquemas_contrato').update({ respuestas: resto }).eq('id', existente.id)
    : await supabase.from('esquemas_contrato').insert({ organizacion_id: orgId, modelo: modelo.clave, respuestas: resto });
  return e ? e.message : null;
}

const claseTextarea = `${claseInput.replace('h-12', 'min-h-[96px]')} py-3 leading-[1.5]`;
const ZONA = 'America/Argentina/Buenos_Aires';
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' });

export const Pedido: React.FC<{ perfil: Perfil; organizacion: Organizacion | null; ruta: string }> = ({ perfil, organizacion, ruta }) => {
  const vista = useVistaPrevia();
  const parte = ruta.replace(/^\/portal\/pedidos\/?/, '');
  const modeloNuevo = parte in MODELOS ? (parte as keyof typeof MODELOS) : null;
  const orgId = vista?.orgId ?? organizacion?.id ?? null;
  const puedeEditar = !vista && perfil.rol !== 'admin' && permisosDe(perfil.rol).casos && Boolean(orgId);

  const [pedido, setPedido] = useState<PedidoContrato | null | undefined>(undefined);
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [paso, setPaso] = useState(0);
  const [guardado, setGuardado] = useState<'' | 'guardando' | 'listo' | 'error'>('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sucio = useRef(false);
  const idRef = useRef<string | null>(null);
  const enCurso = useRef<Promise<void>>(Promise.resolve());
  const asuntoCreado = useRef<string | null>(null);
  const [esquema, setEsquema] = useState<EsquemaContrato | null>(null);
  const [conEsquema, setConEsquema] = useState(true);
  const [enviadoSinEsquema, setEnviadoSinEsquema] = useState<string | null>(null);
  // Pedido enviado: el cliente completa los datos del closer.
  const [editandoDatos, setEditandoDatos] = useState(() => new URLSearchParams(window.location.search).get('datos') === '1');
  const [nota, setNota] = useState<string | null>(null);

  const modelo: Modelo | null = pedido ? MODELOS[pedido.modelo] : modeloNuevo ? MODELOS[modeloNuevo] : null;

  useEffect(() => {
    if (!supabase) return;
    if (modeloNuevo) {
      const iniciales = respuestasIniciales(MODELOS[modeloNuevo]);
      if (!orgId) {
        setRespuestas(iniciales);
        setPedido(null);
        return;
      }
      // Sin la migración 0035 la consulta falla y se arranca de cero.
      void supabase
        .from('esquemas_contrato')
        .select('*')
        .eq('organizacion_id', orgId)
        .eq('modelo', modeloNuevo)
        .maybeSingle()
        .then(({ data }) => {
          const e = (data as EsquemaContrato | null) ?? null;
          setEsquema(e);
          setConEsquema(!e);
          setRespuestas(e ? { ...iniciales, ...e.respuestas, [DESDE_ESQUEMA]: e.actualizado_en } : iniciales);
          setPedido(null);
        });
      return;
    }
    void supabase
      .from('pedidos_contrato')
      .select('*')
      .eq('id', parte)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e || !data) {
          setError(e && perfil.rol === 'admin' ? `${e.message}. Revisá que la migración 0034_pedidos_contrato.sql esté corrida en Supabase.` : 'No existe ese formulario o no tenés acceso.');
          setPedido(null);
          return;
        }
        const p = data as PedidoContrato;
        idRef.current = p.id;
        setPedido(p);
        setRespuestas(p.respuestas ?? {});
        if (!p.enviado_en && orgId)
          void supabase!
            .from('esquemas_contrato')
            .select('*')
            .eq('organizacion_id', p.organizacion_id)
            .eq('modelo', p.modelo)
            .maybeSingle()
            .then(({ data: d }) => {
              setEsquema((d as EsquemaContrato | null) ?? null);
              setConEsquema(!d);
            });
      });
  }, [parte, modeloNuevo]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIRMA y Ver como abren el formulario nuevo para ver cómo es, sin guardar nada.
  const prueba = !puedeEditar && !pedido;
  const soloLectura = Boolean(pedido?.enviado_en) || (!puedeEditar && Boolean(pedido));

  /** Guarda en orden: el primer guardado crea el borrador y los siguientes lo actualizan. */
  const guardar = useCallback(
    (r: Respuestas): Promise<void> => {
      const m = modelo;
      if (!supabase || !m || !orgId || !puedeEditar || soloLectura) return Promise.resolve();
      const sb = supabase;
      const titulo = texto(r, m.claveTitulo).trim() || null;
      enCurso.current = enCurso.current.then(async () => {
        setGuardado('guardando');
        if (!idRef.current) {
          const { data, error: e } = await sb.from('pedidos_contrato').insert({ organizacion_id: orgId, modelo: m.clave, titulo, respuestas: r }).select('*').single();
          if (e || !data) return setGuardado('error');
          idRef.current = (data as PedidoContrato).id;
          setPedido(data as PedidoContrato);
          window.history.replaceState({}, '', `/portal/pedidos/${idRef.current}`);
        } else {
          const { error: e } = await sb.from('pedidos_contrato').update({ titulo, respuestas: r }).eq('id', idRef.current);
          if (e) return setGuardado('error');
        }
        sucio.current = false;
        setGuardado('listo');
      });
      return enCurso.current;
    },
    [modelo, orgId, puedeEditar, soloLectura],
  );

  // Guardado automático un segundo después del último cambio.
  useEffect(() => {
    if (!sucio.current) return;
    const t = window.setTimeout(() => void guardar(respuestas), 1000);
    return () => window.clearTimeout(t);
  }, [respuestas, guardar]);

  const cambiar = (clave: string, valor: Valor) => {
    sucio.current = true;
    setRespuestas((r) => ({ ...r, [clave]: valor }));
  };

  function irA(n: number) {
    if (sucio.current) void guardar(respuestas);
    setPaso(n);
    setError(null);
    window.scrollTo(0, 0);
  }

  async function descartar() {
    if (!supabase || !idRef.current) return navegar('/portal/documentos/equipo');
    if (!window.confirm('¿Descartar este borrador? Se borran las respuestas.')) return;
    await enCurso.current;
    const { error: e } = await supabase.from('pedidos_contrato').delete().eq('id', idRef.current);
    if (e) return setError(`No se pudo borrar. ${e.message}`);
    navegar('/portal/documentos/equipo');
  }

  async function enviar() {
    if (!supabase || !modelo || !orgId) return;
    const sb = supabase;
    const pendientes = faltantes(modelo, respuestas);
    if (pendientes.length) return setError('Faltan respuestas obligatorias. Están marcadas abajo.');
    setEnviando(true);
    setError(null);
    await guardar(respuestas);
    await enCurso.current;
    if (!idRef.current) {
      setEnviando(false);
      return setError('No pudimos guardar el formulario. Probá de nuevo.');
    }
    const titulo = modelo.tituloAsunto(respuestas).slice(0, 140);
    // Si el asunto ya se abrió en un intento anterior, se reutiliza.
    if (!asuntoCreado.current) {
      const { data, error: e1 } = await sb.from('asuntos').insert({ organizacion_id: orgId, titulo, tipo: 'contrato', estado: 'en_curso', creado_por: perfil.id }).select('id').single();
      if (e1 || !data) {
        setEnviando(false);
        return setError(e1?.message ?? 'No se pudo abrir el asunto.');
      }
      asuntoCreado.current = data.id as string;
      const nombre = texto(respuestas, modelo.claveTitulo).trim();
      await sb.from('asunto_mensajes').insert({
        asunto_id: data.id,
        texto: `Completé el formulario del ${modelo.titulo.toLowerCase()}${nombre ? ` de ${nombre}` : ''}. Las respuestas están en la pestaña Formulario.`,
      });
    }
    const asuntoId = asuntoCreado.current;
    const { error: e2 } = await sb.from('pedidos_contrato').update({ asunto_id: asuntoId, enviado_en: new Date().toISOString() }).eq('id', idRef.current);
    if (e2) {
      setEnviando(false);
      return setError(`El asunto se abrió, pero el formulario no quedó vinculado. Probá enviar de nuevo. ${e2.message}`);
    }
    await avisarPorMail('asunto', asuntoId);
    if (conEsquema) {
      const fallo = await guardarEsquemaDe(modelo, orgId, respuestas, esquema);
      if (fallo) {
        setEnviando(false);
        return setEnviadoSinEsquema(asuntoId);
      }
    }
    navegar(`/portal/asuntos/${asuntoId}?pestana=formulario&enviado=1`);
  }

  /** Después de enviar: guarda los datos del closer y le avisa a FIRMA por el chat. */
  async function guardarDatos() {
    if (!supabase || !modelo || !pedido?.asunto_id) return;
    const sb = supabase;
    setEnviando(true);
    setError(null);
    const titulo = texto(respuestas, modelo.claveTitulo).trim() || null;
    const { error: e } = await sb.from('pedidos_contrato').update({ titulo, respuestas }).eq('id', pedido.id);
    if (e) {
      setEnviando(false);
      return setError(`No se pudieron guardar los datos. ${e.message}`);
    }
    const { data: msj } = await sb
      .from('asunto_mensajes')
      .insert({ asunto_id: pedido.asunto_id, texto: `Completé los datos del closer${titulo ? `: ${titulo}` : ''}. Están en la pestaña Formulario.` })
      .select('id')
      .single();
    if (msj) await avisarPorMail('mensaje', msj.id as string);
    setPedido({ ...pedido, titulo, respuestas });
    setEnviando(false);
    setEditandoDatos(false);
    setNota('Guardamos los datos del closer y le avisamos a FIRMA por el chat del asunto.');
  }

  if (pedido === undefined) {
    return (
      <Marco perfil={perfil}>
        <p className="wrap py-14 eyebrow text-piedra">Cargando</p>
      </Marco>
    );
  }

  if (!modelo) {
    return (
      <Marco perfil={perfil}>
        <div className="wrap py-14 flex flex-col gap-6 items-start">
          <Aviso tipo="error">{error ?? 'No existe ese formulario o no tenés acceso.'}</Aviso>
          <Button variant="ghost" onClick={() => navegar('/portal/documentos/equipo')}>
            Volver a los contratos con tu equipo
          </Button>
        </div>
      </Marco>
    );
  }

  const secciones = modelo.secciones;
  const enRevision = paso >= secciones.length;
  const seccion = secciones[Math.min(paso, secciones.length - 1)];
  const { respondidas, total } = avance(modelo, respuestas);
  const pendientes = faltantes(modelo, respuestas);
  const nombre = texto(respuestas, modelo.claveTitulo).trim();
  const desdeEsquema = texto(respuestas, DESDE_ESQUEMA);
  const faltanDatos = datosPendientes(modelo, respuestas);
  const seccionDatos = secciones.find((x) => x.porContrato) ?? null;
  // Con esquema, de los datos del closer se pasa directo a revisar.
  const siguiente = desdeEsquema && seccion.porContrato ? secciones.length : paso + 1;

  const encabezado = (
    <Encabezado
      eyebrow={
        <Enlace a={pedido?.asunto_id ? `/portal/asuntos/${pedido.asunto_id}` : '/portal/documentos/equipo'} className="inline-flex items-center gap-2 hover:text-bosque">
          <ArrowLeft size={14} aria-hidden="true" /> {pedido?.asunto_id ? 'Volver al asunto' : 'Contratos con tu equipo'}
        </Enlace>
      }
      titulo={
        <>
          {modelo.titulo.replace(/ de closer$/, ' de ')}
          <span className="text-bosque">{nombre || 'closer'}</span>
        </>
      }
      bajada={
        soloLectura
          ? pedido?.enviado_en
            ? `Enviado a FIRMA el ${fecha(pedido.enviado_en)}.`
            : 'Solo lectura.'
          : prueba
            ? 'Vista previa: así lo completan el titular y el CSM. Podés recorrerlo, pero no se guarda ni se envía.'
            : modelo.bajada
      }
      acciones={
        soloLectura || prueba ? undefined : (
          <span className="text-sm text-piedra self-center" aria-live="polite">
            {guardado === 'guardando' ? 'Guardando…' : guardado === 'error' ? <span className="text-[#8a2b20]">No se pudo guardar</span> : guardado === 'listo' ? 'Borrador guardado' : ''}
          </span>
        )
      }
    />
  );

  if (soloLectura) {
    const completaDatos = Boolean(pedido?.enviado_en) && puedeEditar && seccionDatos;
    return (
      <Marco perfil={perfil}>
        {encabezado}
        <div className="wrap py-10 desk:py-14 max-w-[900px] flex flex-col gap-8">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {nota && <Aviso tipo="ok">{nota}</Aviso>}
          {completaDatos && editandoDatos ? (
            <section className="flex flex-col gap-6 bg-marfil-oscuro p-6 desk:p-8">
              <div className="flex flex-col gap-2">
                <h2 className="h3">{seccionDatos.titulo}</h2>
                <p className="text-piedra text-[15px] leading-[1.6]">Las condiciones ya están en manos de FIRMA. Acá solo se completan los datos del closer, y le avisamos por el chat del asunto.</p>
              </div>
              {seccionDatos.preguntas
                .filter((p) => visible(p, respuestas))
                .map((p) => (
                  <CampoPregunta key={p.clave} pregunta={p} respuestas={respuestas} alCambiar={(clave, valor) => setRespuestas((r) => ({ ...r, [clave]: valor }))} />
                ))}
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={() => void guardarDatos()} disabled={enviando}>
                  {enviando ? 'Guardando…' : 'Guardar datos del closer'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setRespuestas(pedido?.respuestas ?? {});
                    setEditandoDatos(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </section>
          ) : completaDatos ? (
            <div className="flex flex-wrap items-center justify-between gap-4 bg-marfil-oscuro px-6 py-5">
              <p className="text-[15px]">{faltanDatos ? 'Faltan datos del closer. Completalos cuando se sume.' : 'Si cambió algún dato del closer, lo podés corregir.'}</p>
              <Button type="button" size="sm" onClick={() => setEditandoDatos(true)}>
                {faltanDatos ? 'Completar datos del closer' : 'Editar datos del closer'}
              </Button>
            </div>
          ) : null}
          <ListaRespuestas modelo={modelo} respuestas={respuestas} />
        </div>
      </Marco>
    );
  }

  return (
    <Marco perfil={perfil}>
      {encabezado}
      <div className="wrap py-10 desk:py-14 grid gap-10 desk:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Pasos del formulario" className="flex flex-col gap-1 min-w-0 desk:sticky desk:top-28 desk:self-start">
          <p className="eyebrow text-piedra mb-3">
            {respondidas} de {total} respondidas
          </p>
          <div className="h-1 bg-marfil-oscuro mb-4" aria-hidden="true">
            <div className="h-full bg-bosque transition-[width] duration-300" style={{ width: `${total ? Math.round((respondidas / total) * 100) : 0}%` }} />
          </div>
          <ol className="flex desk:flex-col gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {[...secciones.map((s) => s.titulo), 'Revisar y enviar'].map((t, i) => {
              const activo = i === paso;
              const conFaltas = i < secciones.length && pendientes.some((f) => f.seccion.clave === secciones[i].clave);
              return (
                <li key={t} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => irA(i)}
                    aria-current={activo ? 'step' : undefined}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2 text-sm transition-colors duration-150 ${activo ? 'bg-tinta text-marfil' : 'hover:bg-marfil-oscuro'}`}
                  >
                    <span className={`tabular-nums text-xs ${activo ? 'text-calido' : 'text-piedra'}`}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="whitespace-nowrap">{t}</span>
                    {conFaltas && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#8a2b20]" aria-label="Falta una respuesta obligatoria" />}
                  </button>
                </li>
              );
            })}
          </ol>
          {pedido && puedeEditar && (
            <button type="button" onClick={() => void descartar()} className="mt-6 self-start inline-flex items-center gap-2 h-10 px-3 -ml-3 text-sm font-medium text-[#8a2b20] transition-colors duration-150 hover:bg-[#f6e7e4]">
              <Trash2 size={15} aria-hidden="true" /> Descartar borrador
            </button>
          )}
        </nav>

        <div className="flex flex-col gap-8 min-w-0 max-w-[760px]">
          {error && <Aviso tipo="error">{error}</Aviso>}

          {enRevision ? (
            <>
              <div className="flex flex-col gap-3">
                <h2 className="h3">Revisar y enviar</h2>
                <p className="text-piedra text-[15px] leading-[1.6]">
                  Así nos llegan tus respuestas. Al enviar se abre un asunto de contrato y nos ponemos en contacto en un plazo de hasta 7 días. Ahí podés subir el manual o los guiones en Documentos.
                </p>
              </div>
              {enviadoSinEsquema && (
                <Aviso tipo="info">
                  Le enviamos el formulario a FIRMA y nos ponemos en contacto en un plazo de hasta 7 días, pero el esquema no se pudo guardar.{' '}
                  <Enlace a={`/portal/asuntos/${enviadoSinEsquema}?pestana=formulario&enviado=1`} className="underline underline-offset-2">
                    Ir al asunto
                  </Enlace>
                </Aviso>
              )}
              {faltanDatos && seccionDatos && (
                <Aviso tipo="info">Los datos del closer quedan pendientes. Los completás desde el asunto cuando se sume.</Aviso>
              )}
              {pendientes.length > 0 && (
                <Aviso tipo="error">
                  Faltan respuestas obligatorias:{' '}
                  {pendientes.map((f, i) => (
                    <React.Fragment key={f.pregunta.clave}>
                      {i > 0 && ', '}
                      <button type="button" className="underline underline-offset-2" onClick={() => irA(secciones.indexOf(f.seccion))}>
                        {f.pregunta.etiqueta.toLowerCase()}
                      </button>
                    </React.Fragment>
                  ))}
                  .
                </Aviso>
              )}
              <ListaRespuestas modelo={modelo} respuestas={respuestas} alEditar={(clave) => irA(secciones.findIndex((s) => s.clave === clave))} />
              <div className="bg-marfil-oscuro p-5">
                <Interruptor
                  activo={conEsquema}
                  alCambiar={setConEsquema}
                  deshabilitado={prueba}
                  etiqueta={esquema ? 'Actualizar el esquema guardado con estas condiciones' : 'Guardar estas condiciones como esquema'}
                  ayuda={
                    esquema
                      ? `El esquema actual es del ${fecha(esquema.actualizado_en)}. Si lo actualizás, los próximos contratos arrancan con lo de este.`
                      : 'El próximo contrato de closer arranca con honorarios, bonos y demás condiciones cargados. Solo vas a completar los datos del closer.'
                  }
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="button" onClick={() => void enviar()} disabled={enviando || prueba || Boolean(enviadoSinEsquema) || pendientes.length > 0}>
                  <Send size={16} aria-hidden="true" /> {enviando ? 'Enviando…' : 'Enviar a FIRMA'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => irA(secciones.length - 1)}>
                  Anterior
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <p className="eyebrow text-piedra">
                  Paso {paso + 1} de {secciones.length + 1}
                </p>
                <h2 className="h3">{seccion.titulo}</h2>
                <p className="text-piedra text-[15px] leading-[1.6]">{seccion.bajada}</p>
              </div>
              {desdeEsquema && seccion.porContrato && (
                <Aviso tipo="info">
                  Arrancamos con el esquema que guardaste el {fecha(desdeEsquema)}: honorarios, bonos, reembolsos y demás condiciones ya están cargados. Completá los datos del closer, o dejalos para después, y revisá antes de enviar.
                </Aviso>
              )}
              <div className="flex flex-col gap-8">
                {seccion.preguntas
                  .filter((p) => visible(p, respuestas))
                  .map((p) => (
                    <CampoPregunta key={p.clave} pregunta={p} respuestas={respuestas} alCambiar={cambiar} />
                  ))}
              </div>
              <div className="flex flex-wrap gap-3 pt-4" style={{ borderTop: '1px solid rgba(27,31,27,0.12)' }}>
                <Button type="button" onClick={() => irA(siguiente)} className="mt-4">
                  {siguiente === secciones.length ? 'Revisar' : 'Siguiente'} <ArrowRight size={16} aria-hidden="true" />
                </Button>
                {paso > 0 && (
                  <Button type="button" variant="ghost" onClick={() => irA(paso - 1)} className="mt-4">
                    Anterior
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Marco>
  );
};

export default Pedido;

/* ------------------------------------------------------------------ */
/* Una pregunta                                                         */
/* ------------------------------------------------------------------ */
const Nota: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flex gap-2.5 border-l-[3px] border-[#8a2b20] bg-[#f6e7e4] px-4 py-3 text-sm leading-[1.5] text-[#5c1d15]">
    <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

const claseOpcion = (activa: boolean) =>
  `flex items-start gap-3 px-4 py-3 text-left text-[15px] border transition-colors duration-150 ${activa ? 'border-bosque bg-[#E4E9E3]' : 'border-[rgba(27,31,27,0.22)] bg-white hover:border-[rgba(27,31,27,0.45)]'}`;

const Marca: React.FC<{ activa: boolean; redonda?: boolean }> = ({ activa, redonda }) => (
  <span aria-hidden="true" className={`shrink-0 mt-0.5 w-[18px] h-[18px] border flex items-center justify-center ${redonda ? 'rounded-full' : ''} ${activa ? 'bg-bosque border-bosque text-marfil' : 'border-[rgba(27,31,27,0.45)] bg-white'}`}>
    {activa && (redonda ? <span className="w-1.5 h-1.5 rounded-full bg-marfil" /> : <Check size={12} strokeWidth={3} />)}
  </span>
);

const CampoPregunta: React.FC<{ pregunta: Pregunta; respuestas: Respuestas; alCambiar: (clave: string, valor: Valor) => void }> = ({ pregunta: p, respuestas: r, alCambiar }) => {
  const id = `p-${p.clave}`;
  const alerta = p.alerta?.(r) ?? null;
  const valor = texto(r, p.clave);
  const elegidas = lista(r, p.clave);
  const conOtra = p.otra && (valor === 'otra' || elegidas.includes('otra'));

  let control: React.ReactNode;
  switch (p.tipo) {
    case 'texto':
      control = <input id={id} className={claseInput} value={valor} placeholder={p.ejemplo} maxLength={300} onChange={(e) => alCambiar(p.clave, e.target.value)} />;
      break;
    case 'largo':
      control = <textarea id={id} className={claseTextarea} value={valor} placeholder={p.ejemplo} maxLength={3000} onChange={(e) => alCambiar(p.clave, e.target.value)} />;
      break;
    case 'sino':
      control = (
        <div role="radiogroup" aria-labelledby={`${id}-e`} className="flex gap-3">
          {[
            ['si', 'Sí'],
            ['no', 'No'],
          ].map(([v, t]) => (
            <button key={v} type="button" role="radio" aria-checked={valor === v} onClick={() => alCambiar(p.clave, v)} className={`${claseOpcion(valor === v)} min-w-[96px] justify-center`}>
              {t}
            </button>
          ))}
        </div>
      );
      break;
    case 'opcion':
    case 'varias': {
      const multiple = p.tipo === 'varias';
      const opciones = [...(p.opciones ?? []), ...(p.otra ? [{ valor: 'otra', texto: 'Otra' }] : [])];
      control = (
        <div role={multiple ? 'group' : 'radiogroup'} aria-labelledby={`${id}-e`} className="grid gap-2 tab:grid-cols-2">
          {opciones.map((o) => {
            const activa = multiple ? elegidas.includes(o.valor) : valor === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                role={multiple ? 'checkbox' : 'radio'}
                aria-checked={activa}
                onClick={() => (multiple ? alCambiar(p.clave, activa ? elegidas.filter((x) => x !== o.valor) : [...elegidas, o.valor]) : alCambiar(p.clave, activa ? '' : o.valor))}
                className={claseOpcion(activa)}
              >
                <Marca activa={activa} redonda={!multiple} />
                <span>{o.texto}</span>
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case 'tabla': {
      const columnas = p.columnas ?? [];
      const vacia = Object.fromEntries(columnas.map((c) => [c.clave, ''])) as Fila;
      const actuales = filas(r, p.clave);
      const lineas = actuales.length ? actuales : [vacia];
      const poner = (nuevas: Fila[]) => alCambiar(p.clave, nuevas);
      control = (
        <div className="flex flex-col gap-3">
          {lineas.map((f, i) => (
            <div key={i} className="grid gap-2 items-end" style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(0, 1fr)) 40px` }}>
              {columnas.map((c) => (
                <label key={c.clave} className="block min-w-0">
                  {i === 0 && <span className="block text-xs text-piedra mb-1.5">{c.titulo}</span>}
                  <input
                    className={claseInput}
                    value={f[c.clave] ?? ''}
                    placeholder={i === 0 ? c.ejemplo : undefined}
                    aria-label={`${c.titulo}, fila ${i + 1}`}
                    maxLength={200}
                    onChange={(e) => poner(lineas.map((x, j) => (j === i ? { ...x, [c.clave]: e.target.value } : x)))}
                  />
                </label>
              ))}
              <button
                type="button"
                aria-label={`Quitar la fila ${i + 1}`}
                disabled={lineas.length === 1}
                onClick={() => poner(lineas.filter((_, j) => j !== i))}
                className="h-12 flex items-center justify-center text-piedra transition-colors duration-150 hover:text-[#8a2b20] disabled:opacity-30"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => poner([...lineas, { ...vacia }])} className="self-start inline-flex items-center gap-2 text-sm font-medium text-bosque underline underline-offset-4">
            <Plus size={15} aria-hidden="true" /> Agregar fila
          </button>
        </div>
      );
      break;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label id={`${id}-e`} htmlFor={p.tipo === 'texto' || p.tipo === 'largo' ? id : undefined} className="flex flex-col gap-1">
        <span className="text-[16px] font-medium leading-[1.4]">
          {p.etiqueta}
          {p.obligatoria && <span className="text-[#8a2b20]"> *</span>}
        </span>
        {p.ayuda && <span className="text-sm text-piedra leading-[1.5]">{p.ayuda}</span>}
      </label>
      {control}
      {conOtra && (
        <input
          className={claseInput}
          value={texto(r, `${p.clave}_otra`)}
          placeholder="¿Cuál?"
          aria-label={`${p.etiqueta}: otra`}
          maxLength={300}
          onChange={(e) => alCambiar(`${p.clave}_otra`, e.target.value)}
        />
      )}
      {alerta && <Nota>{alerta}</Nota>}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Respuestas, como las lee FIRMA                                       */
/* ------------------------------------------------------------------ */
export const ListaRespuestas: React.FC<{ modelo: Modelo; respuestas: Respuestas; alEditar?: (seccion: string) => void }> = ({ modelo, respuestas, alEditar }) => (
  <div className="flex flex-col gap-8">
    {resumen(modelo, respuestas).map(({ seccion, lineas }, i) => (
      <section key={seccion.clave} className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4" style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}>
          <h3 className="text-[17px] font-medium pb-2">
            <span className="tabular-nums text-piedra text-sm mr-2">{String(i + 1).padStart(2, '0')}</span>
            {seccion.titulo}
          </h3>
          {alEditar && (
            <button type="button" onClick={() => alEditar(seccion.clave)} className="text-sm text-bosque underline underline-offset-4 pb-2">
              Editar
            </button>
          )}
        </div>
        <dl className="grid gap-x-8 gap-y-3 tab:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] text-[15px]">
          {lineas.map((l) => (
            <React.Fragment key={l.pregunta.clave}>
              <dt className="text-piedra">{l.pregunta.etiqueta}</dt>
              <dd className="flex flex-col gap-2 -mt-2 tab:mt-0 mb-2 tab:mb-0">
                <span className={`whitespace-pre-line ${l.valor ? '' : 'text-piedra italic'}`}>{l.valor || 'Sin responder'}</span>
                {l.alerta && <Nota>{l.alerta}</Nota>}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      </section>
    ))}
  </div>
);

/** Pestaña Formulario del asunto. */
export const FormularioDelAsunto: React.FC<{ pedido: PedidoContrato; empresa: string; puedeCompletar: boolean }> = ({ pedido, empresa, puedeCompletar }) => {
  const [copiado, setCopiado] = useState(false);
  // Recién enviado: la confirmación se muestra una vez y sale de la dirección.
  const [recienEnviado] = useState(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('enviado') !== '1') return false;
    url.searchParams.delete('enviado');
    window.history.replaceState({}, '', url);
    return true;
  });
  const modelo = MODELOS[pedido.modelo];
  async function copiar() {
    const encabezado = `${modelo.tituloAsunto(pedido.respuestas)}${empresa ? ` · ${empresa}` : ''}${pedido.enviado_en ? ` · enviado el ${fecha(pedido.enviado_en)}` : ''}`;
    try {
      await navigator.clipboard.writeText(resumenTexto(modelo, pedido.respuestas, encabezado));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-piedra">{pedido.enviado_en ? `Enviado el ${fecha(pedido.enviado_en)}.` : 'Borrador.'} Para cambiar las condiciones, escribilo en el chat.</p>
        <Button type="button" size="sm" variant="ghost" onClick={() => void copiar()}>
          {copiado ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {copiado ? 'Copiado' : 'Copiar respuestas'}
        </Button>
      </div>
      {recienEnviado && puedeCompletar && (
        <Aviso tipo="ok">
          <strong>Recibimos tu formulario.</strong> Nos ponemos en contacto en un plazo de hasta 7 días. Mientras tanto, si querés sumar algo, escribinos en el chat o subí archivos en Documentos.
        </Aviso>
      )}
      {datosPendientes(modelo, pedido.respuestas) && (
        <Aviso tipo="info">
          {puedeCompletar ? (
            <>
              Faltan datos del closer.{' '}
              <Enlace a={`/portal/pedidos/${pedido.id}?datos=1`} className="underline underline-offset-2 font-medium">
                Completalos acá
              </Enlace>{' '}
              cuando se sume.
            </>
          ) : (
            'Faltan datos del closer. El cliente los completa cuando se sume y te llega el aviso por el chat.'
          )}
        </Aviso>
      )}
      {puedeCompletar && !datosPendientes(modelo, pedido.respuestas) && (
        <Enlace a={`/portal/pedidos/${pedido.id}?datos=1`} className="self-start text-sm text-bosque underline underline-offset-4">
          Editar datos del closer
        </Enlace>
      )}
      <ListaRespuestas modelo={modelo} respuestas={pedido.respuestas} />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Acceso desde Documentos › Contratos con tu equipo                    */
/* ------------------------------------------------------------------ */
const claseAccion =
  'inline-flex items-center justify-center gap-2 h-11 px-5 bg-marfil text-tinta text-sm font-medium whitespace-nowrap transition-colors duration-150 hover:bg-white';

/** vistaPrevia: FIRMA o Ver como, que abren el formulario sin guardar. */
export const PedidosEquipo: React.FC<{ orgId: string | null; vistaPrevia: boolean }> = ({ orgId, vistaPrevia }) => {
  const [borradores, setBorradores] = useState<PedidoContrato[]>([]);
  const [esquema, setEsquema] = useState<EsquemaContrato | null>(null);

  useEffect(() => {
    if (!supabase || !orgId) return;
    let vivo = true;
    void supabase
      .from('pedidos_contrato')
      .select('*')
      .eq('organizacion_id', orgId)
      .is('enviado_en', null)
      .order('actualizado_en', { ascending: false })
      .then(({ data }) => {
        if (vivo) setBorradores((data as PedidoContrato[]) ?? []);
      });
    void supabase
      .from('esquemas_contrato')
      .select('*')
      .eq('organizacion_id', orgId)
      .eq('modelo', 'closer')
      .maybeSingle()
      .then(({ data }) => {
        if (vivo) setEsquema((data as EsquemaContrato | null) ?? null);
      });
    return () => {
      vivo = false;
    };
  }, [orgId]);

  const modelo = MODELOS.closer;

  async function borrarEsquema() {
    if (!supabase || !esquema) return;
    if (!window.confirm('¿Borrar el esquema? El próximo contrato arranca con las preguntas completas.')) return;
    const { error: e } = await supabase.from('esquemas_contrato').delete().eq('id', esquema.id);
    if (!e) setEsquema(null);
  }

  return (
    <article className="card">
      <div className="relative flex items-center gap-4">
        <div className="icon-box">
          <ClipboardList size={26} strokeWidth={1.8} />
        </div>
        <span className="eyebrow text-[11px] text-calido">Formulario · unos 10 minutos</span>
      </div>
      <h3 className="h3 relative">Pedir un {modelo.titulo.toLowerCase()}</h3>
      <p className="relative text-[15px] leading-[1.6] text-calido max-w-[60ch]">
        Respondé cómo trabajan con el closer: honorarios, bonos, objetivos, reembolsos, plazo y pago. Con eso FIRMA redacta el contrato y lo seguís en Asuntos.
      </p>
      {esquema && (
        <p className="relative text-[15px] leading-[1.6] text-marfil">
          Tenés un esquema guardado el {fecha(esquema.actualizado_en)}: el próximo contrato solo pide los datos del closer.
          {!vistaPrevia && (
            <>
              {' '}
              <button type="button" onClick={() => void borrarEsquema()} className="text-calido underline underline-offset-4 hover:text-marfil">
                Borrar esquema
              </button>
            </>
          )}
        </p>
      )}
      {borradores.length > 0 && (
        <ul className="relative flex flex-col gap-2 text-[15px]">
          {borradores.map((b) => {
            const { respondidas, total } = avance(MODELOS[b.modelo], b.respuestas ?? {});
            return (
              <li key={b.id} className="flex flex-wrap items-baseline gap-x-3">
                <Enlace a={`/portal/pedidos/${b.id}`} className="font-medium text-marfil underline underline-offset-4 decoration-[rgba(245,243,236,0.4)] hover:decoration-marfil">
                  {b.titulo || 'Borrador sin nombre'}
                </Enlace>
                <span className="text-[13px] text-calido">
                  {respondidas} de {total} respondidas · {fecha(b.actualizado_en)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="relative mt-auto pt-4">
        <Enlace a={`/portal/pedidos/${modelo.clave}`} className={claseAccion}>
          {vistaPrevia ? (
            <>
              <ArrowRight size={16} aria-hidden="true" /> Ver el formulario
            </>
          ) : (
            <>
              <Plus size={16} aria-hidden="true" /> {borradores.length ? 'Empezar otro' : 'Completar el formulario'}
            </>
          )}
        </Enlace>
      </div>
    </article>
  );
};

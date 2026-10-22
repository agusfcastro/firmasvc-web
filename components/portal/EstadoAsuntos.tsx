import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Mail, Plus } from 'lucide-react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { useVistaPrevia } from './vistaPrevia';
import { Aviso, Campo, Encabezado, Enlace, Etiqueta, Marco, claseInput } from './ui';
import type { Organizacion, Perfil } from './tipos';
import {
  ESTADOS,
  ESTADO_ASUNTO,
  TIPO_ASUNTO,
  avisarPorMail,
  fechaAsunto,
  fechaHoraAsunto,
  fechaVence,
  type Asunto,
  type EstadoAsunto,
  type Novedad,
  type TipoAsunto,
} from './asuntos';

/**
 * Estado de asuntos en /portal/asuntos y /portal/asuntos/:id.
 * El cliente (titular y CSM) ve sus trámites con FIRMA y puede escribir.
 * FIRMA los crea, cambia el estado y suma novedades. Cada novedad puede
 * salir por mail: las de FIRMA a la empresa, las del cliente a FIRMA.
 */

const claseTextarea = `${claseInput.replace('h-12', 'min-h-[110px]')} py-3 leading-[1.5]`;

const rotuloEstado = (e: EstadoAsunto, esFirma: boolean) => (esFirma ? ESTADO_ASUNTO[e].firma : ESTADO_ASUNTO[e].cliente);

export const Asuntos: React.FC<{ perfil: Perfil; organizacion: Organizacion | null; ruta: string }> = ({ perfil, organizacion, ruta }) => {
  const id = ruta.replace(/^\/portal\/asuntos\/?/, '');
  return id ? <Detalle id={id} perfil={perfil} /> : <Lista perfil={perfil} organizacion={organizacion} />;
};

export default Asuntos;

/* ------------------------------------------------------------------ */
/* Lista                                                                */
/* ------------------------------------------------------------------ */
interface Borrador {
  organizacion_id: string;
  titulo: string;
  tipo: TipoAsunto;
  estado: EstadoAsunto;
  proximo_paso: string;
  vence_en: string;
  novedad: string;
  avisar: boolean;
}

const Lista: React.FC<{ perfil: Perfil; organizacion: Organizacion | null }> = ({ perfil, organizacion }) => {
  const vista = useVistaPrevia();
  const esFirma = perfil.rol === 'admin' && !vista;
  const orgPropia = vista?.orgId ?? organizacion?.id ?? null;
  const [asuntos, setAsuntos] = useState<Asunto[] | null>(null);
  const [orgs, setOrgs] = useState<{ id: string; nombre: string }[]>([]);
  const [filtro, setFiltro] = useState('');
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!supabase) return;
    let q = supabase.from('asuntos').select('*').order('actualizado_en', { ascending: false });
    if (!esFirma && orgPropia) q = q.eq('organizacion_id', orgPropia);
    const { data, error: e } = await q;
    if (e) setError(esFirma ? `${e.message}. Revisá que la migración 0017_asuntos.sql esté corrida en Supabase.` : 'No pudimos cargar tus asuntos. Probá recargar la página.');
    setAsuntos((data as Asunto[]) ?? []);
  }, [esFirma, orgPropia]);

  useEffect(() => {
    void cargar();
    if (esFirma && supabase) {
      void supabase
        .from('organizaciones')
        .select('id, nombre')
        .order('nombre')
        .then(({ data }) => setOrgs((data as { id: string; nombre: string }[]) ?? []));
    }
  }, [cargar, esFirma]);

  const empresa = (orgId: string) => orgs.find((o) => o.id === orgId)?.nombre ?? '';
  const visibles = (asuntos ?? []).filter((a) => !filtro || a.organizacion_id === filtro);
  const abiertos = visibles.filter((a) => a.estado !== 'finalizado');
  const cerrados = visibles.filter((a) => a.estado === 'finalizado');

  function nuevo() {
    setOk(null);
    setError(null);
    setBorrador({ organizacion_id: filtro || orgs[0]?.id || '', titulo: '', tipo: 'contrato', estado: 'en_curso', proximo_paso: '', vence_en: '', novedad: '', avisar: true });
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const titulo = borrador.titulo.trim();
    if (!borrador.organizacion_id) return setError('Elegí la empresa.');
    if (titulo.length < 3) return setError('El título tiene que tener al menos 3 caracteres.');
    setGuardando(true);
    setError(null);
    const { data, error: e1 } = await supabase
      .from('asuntos')
      .insert({
        organizacion_id: borrador.organizacion_id,
        titulo,
        tipo: borrador.tipo,
        estado: borrador.estado,
        proximo_paso: borrador.proximo_paso.trim() || null,
        vence_en: borrador.vence_en || null,
        creado_por: perfil.id,
      })
      .select('id')
      .single();
    if (e1 || !data) {
      setGuardando(false);
      return setError(e1?.message ?? 'No se pudo crear el asunto.');
    }
    let nota = 'Asunto creado.';
    const texto = borrador.novedad.trim();
    if (texto) {
      const { data: nov, error: e2 } = await supabase.from('asunto_novedades').insert({ asunto_id: data.id, texto }).select('id').single();
      if (e2 || !nov) nota = 'Asunto creado, pero la primera novedad no se pudo guardar.';
      else if (borrador.avisar) {
        const r = await avisarPorMail('novedad', nov.id);
        nota = r.ok ? `Asunto creado. Avisamos por mail a ${r.avisados} ${r.avisados === 1 ? 'persona' : 'personas'}.` : `Asunto creado, pero el aviso por mail no salió. ${r.error ?? ''}`;
      }
    }
    setGuardando(false);
    setBorrador(null);
    setOk(nota);
    void cargar();
  }

  return (
    <Marco perfil={perfil}>
      <Encabezado
        eyebrow={esFirma ? 'Estado de asuntos · Todas las empresas' : 'Estado de asuntos'}
        titulo={
          esFirma ? (
            <>
              Asuntos de <span className="text-bosque">tus clientes</span>
            </>
          ) : (
            <>
              Tus asuntos con <span className="text-bosque">FIRMA</span>
            </>
          )
        }
        bajada={
          esFirma
            ? 'Cada trámite que llevás para una empresa. Las novedades que sumás le llegan por mail al titular y al CSM.'
            : 'Cada trámite que llevamos para tu empresa, con su estado, el próximo paso y las novedades. Cuando algo cambia, te avisamos por mail.'
        }
        acciones={
          esFirma && !borrador ? (
            <Button onClick={nuevo}>
              <Plus size={16} aria-hidden="true" /> Nuevo asunto
            </Button>
          ) : undefined
        }
      />

      <div className="wrap py-10 desk:py-14 flex flex-col gap-8">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}

        {borrador && (
          <form onSubmit={crear} className="bg-white border border-[rgba(27,31,27,0.15)] p-6 desk:p-8 flex flex-col gap-5 max-w-[820px]">
            <p className="h3">Nuevo asunto</p>
            <div className="grid gap-5 tab:grid-cols-2">
              <Campo etiqueta="Empresa">
                <select className={claseInput} value={borrador.organizacion_id} onChange={(e) => setBorrador({ ...borrador, organizacion_id: e.target.value })}>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Tipo">
                <select className={claseInput} value={borrador.tipo} onChange={(e) => setBorrador({ ...borrador, tipo: e.target.value as TipoAsunto })}>
                  {Object.entries(TIPO_ASUNTO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <Campo etiqueta="Título" ayuda="Lo ve el cliente. Por ejemplo, Registro de la marca ante el INPI.">
              <input required maxLength={140} className={claseInput} value={borrador.titulo} onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })} />
            </Campo>
            <div className="grid gap-5 tab:grid-cols-2">
              <Campo etiqueta="Estado">
                <select className={claseInput} value={borrador.estado} onChange={(e) => setBorrador({ ...borrador, estado: e.target.value as EstadoAsunto })}>
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_ASUNTO[e].firma}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Vence" ayuda="Opcional. Un plazo que el cliente tenga que tener presente.">
                <input type="date" className={claseInput} value={borrador.vence_en} onChange={(e) => setBorrador({ ...borrador, vence_en: e.target.value })} />
              </Campo>
            </div>
            <Campo etiqueta="Próximo paso" ayuda="Opcional. Qué sigue y quién lo hace.">
              <input maxLength={300} className={claseInput} value={borrador.proximo_paso} onChange={(e) => setBorrador({ ...borrador, proximo_paso: e.target.value })} />
            </Campo>
            <Campo etiqueta="Primera novedad" ayuda="Opcional. Queda en el historial del asunto.">
              <textarea maxLength={4000} className={claseTextarea} value={borrador.novedad} onChange={(e) => setBorrador({ ...borrador, novedad: e.target.value })} />
            </Campo>
            {borrador.novedad.trim() && (
              <label className="flex items-center gap-3 text-[15px] cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#173A2F]" checked={borrador.avisar} onChange={(e) => setBorrador({ ...borrador, avisar: e.target.checked })} />
                Avisar por mail al titular y al CSM de la empresa
              </label>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Creando…' : 'Crear asunto'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setBorrador(null)} disabled={guardando}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {esFirma && orgs.length > 1 && (
          <div className="max-w-[320px]">
            <Campo etiqueta="Empresa">
              <select className={claseInput} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                <option value="">Todas</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        )}

        {asuntos === null ? (
          <p className="eyebrow text-piedra">Cargando</p>
        ) : visibles.length === 0 ? (
          <div className="flex flex-col gap-4 p-8 desk:p-10 max-w-[680px] bg-marfil-oscuro">
            <p className="h3">{esFirma ? 'Todavía no hay asuntos' : 'Todavía no tenés asuntos abiertos'}</p>
            <p className="text-[15px] leading-[1.6] text-piedra">
              {esFirma
                ? 'Creá el primero con Nuevo asunto. El cliente lo ve en esta sección y recibe las novedades por mail.'
                : 'Cuando FIRMA esté llevando un trámite para tu empresa, lo vas a ver acá con su estado y sus novedades.'}
            </p>
          </div>
        ) : (
          <>
            <ListaGrupo titulo="En curso" asuntos={abiertos} esFirma={esFirma} empresa={esFirma ? empresa : undefined} />
            {cerrados.length > 0 && (
              <details className="group">
                <summary className="eyebrow text-piedra cursor-pointer select-none">Finalizados ({cerrados.length})</summary>
                <div className="pt-5">
                  <ListaGrupo asuntos={cerrados} esFirma={esFirma} empresa={esFirma ? empresa : undefined} />
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </Marco>
  );
};

const ListaGrupo: React.FC<{ titulo?: string; asuntos: Asunto[]; esFirma: boolean; empresa?: (id: string) => string }> = ({ titulo, asuntos, esFirma, empresa }) => (
  <section className="flex flex-col gap-4">
    {titulo && <h2 className="eyebrow text-piedra">{titulo} ({asuntos.length})</h2>}
    {asuntos.length === 0 ? (
      <p className="text-sm text-piedra">No hay asuntos en curso.</p>
    ) : (
      <ul className="grid gap-3">
        {asuntos.map((a) => (
          <li key={a.id}>
            <Enlace a={`/portal/asuntos/${a.id}`} className="group flex flex-col tab:flex-row tab:items-center gap-4 bg-white border border-[rgba(27,31,27,0.15)] p-5 desk:p-6 transition-colors duration-150 hover:border-bosque">
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="eyebrow text-[11px] text-piedra">
                    {TIPO_ASUNTO[a.tipo]}
                    {empresa ? ` · ${empresa(a.organizacion_id)}` : ''}
                  </span>
                  <Etiqueta tono={ESTADO_ASUNTO[a.estado].tono}>{rotuloEstado(a.estado, esFirma)}</Etiqueta>
                </div>
                <h3 className="font-heading font-bold text-[19px] leading-[1.3]">{a.titulo}</h3>
                {a.proximo_paso && a.estado !== 'finalizado' && (
                  <p className="text-[14px] leading-[1.5] text-piedra">
                    <span className="font-medium text-tinta">Próximo paso:</span> {a.proximo_paso}
                  </p>
                )}
              </div>
              <div className="flex tab:flex-col tab:items-end gap-x-4 gap-y-1 text-[13px] text-piedra shrink-0">
                {a.vence_en && a.estado !== 'finalizado' && <span>Vence el {fechaVence(a.vence_en)}</span>}
                <span>Actualizado el {fechaAsunto(a.actualizado_en)}</span>
                <span className="hidden tab:inline-flex items-center gap-1 text-bosque font-medium mt-1">
                  Ver <ArrowRight size={14} aria-hidden="true" />
                </span>
              </div>
            </Enlace>
          </li>
        ))}
      </ul>
    )}
  </section>
);

/* ------------------------------------------------------------------ */
/* Detalle                                                              */
/* ------------------------------------------------------------------ */
const Detalle: React.FC<{ id: string; perfil: Perfil }> = ({ id, perfil }) => {
  const vista = useVistaPrevia();
  const esFirma = perfil.rol === 'admin' && !vista;
  const soloLectura = Boolean(vista);
  const [asunto, setAsunto] = useState<Asunto | null | undefined>(undefined);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [autores, setAutores] = useState<Record<string, { nombre: string | null; email: string; rol: string }>>({});
  const [empresa, setEmpresa] = useState('');
  const [texto, setTexto] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<'' | EstadoAsunto>('');
  const [avisar, setAvisar] = useState(true);
  const [edicion, setEdicion] = useState<{ titulo: string; proximo_paso: string; vence_en: string } | null>(null);
  const [ocupado, setOcupado] = useState<'' | 'novedad' | 'datos'>('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!supabase) return;
    const [{ data: a }, { data: n }] = await Promise.all([
      supabase.from('asuntos').select('*').eq('id', id).maybeSingle(),
      supabase.from('asunto_novedades').select('*').eq('asunto_id', id).order('creado_en', { ascending: false }),
    ]);
    setAsunto((a as Asunto) ?? null);
    const lista = (n as Novedad[]) ?? [];
    setNovedades(lista);
    const ids = [...new Set(lista.map((x) => x.autor_id).filter(Boolean))] as string[];
    if (ids.length) {
      // Cada uno ve los perfiles que su permiso le deja ver. Los que no ve son de FIRMA.
      const { data: p } = await supabase.from('perfiles').select('id, nombre, email, rol').in('id', ids);
      setAutores(Object.fromEntries(((p as { id: string; nombre: string | null; email: string; rol: string }[]) ?? []).map((x) => [x.id, x])));
    }
    if (a) {
      const { data: o } = await supabase.from('organizaciones').select('nombre').eq('id', (a as Asunto).organizacion_id).maybeSingle();
      setEmpresa((o?.nombre as string | undefined) ?? '');
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const autor = (n: Novedad): string => {
    if (n.autor_id === perfil.id && !vista) return 'Vos';
    const a = n.autor_id ? autores[n.autor_id] : undefined;
    if (!a || a.rol === 'admin') return 'FIRMA';
    return a.nombre || a.email;
  };

  async function sumarNovedad(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !asunto) return;
    const t = texto.trim();
    if (t.length < 2) return setError('Escribí la novedad.');
    setOcupado('novedad');
    setError(null);
    setOk(null);
    const estado = esFirma && nuevoEstado && nuevoEstado !== asunto.estado ? nuevoEstado : null;
    const { data: nov, error: e1 } = await supabase.from('asunto_novedades').insert({ asunto_id: asunto.id, texto: t, estado }).select('id').single();
    if (e1 || !nov) {
      setOcupado('');
      return setError(e1?.message ?? 'No se pudo guardar la novedad.');
    }
    if (estado) await supabase.from('asuntos').update({ estado }).eq('id', asunto.id);
    // El cliente siempre le avisa a FIRMA. FIRMA elige si avisa a la empresa.
    let nota = esFirma ? 'Novedad guardada.' : 'Mensaje enviado. Le avisamos a FIRMA por mail.';
    if (!esFirma || avisar) {
      const r = await avisarPorMail('novedad', nov.id);
      if (!r.ok) nota = `${esFirma ? 'Novedad guardada' : 'Mensaje guardado'}, pero el aviso por mail no salió. ${r.error ?? ''}`;
      else if (esFirma) nota = `Novedad guardada. Avisamos por mail a ${r.avisados} ${r.avisados === 1 ? 'persona' : 'personas'}.`;
    }
    setOcupado('');
    setTexto('');
    setNuevoEstado('');
    setOk(nota);
    void cargar();
  }

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !asunto || !edicion) return;
    if (edicion.titulo.trim().length < 3) return setError('El título tiene que tener al menos 3 caracteres.');
    setOcupado('datos');
    setError(null);
    const { error: e1 } = await supabase
      .from('asuntos')
      .update({ titulo: edicion.titulo.trim(), proximo_paso: edicion.proximo_paso.trim() || null, vence_en: edicion.vence_en || null })
      .eq('id', asunto.id);
    setOcupado('');
    if (e1) return setError(e1.message);
    setEdicion(null);
    setOk('Datos del asunto guardados.');
    void cargar();
  }

  if (asunto === undefined) {
    return (
      <Marco perfil={perfil}>
        <p className="wrap py-14 eyebrow text-piedra">Cargando</p>
      </Marco>
    );
  }
  if (asunto === null) {
    return (
      <Marco perfil={perfil}>
        <div className="wrap py-14 flex flex-col gap-6 items-start">
          <Aviso tipo="error">No existe ese asunto o no tenés acceso.</Aviso>
          <Button variant="ghost" onClick={() => navegar('/portal/asuntos')}>
            Volver a los asuntos
          </Button>
        </div>
      </Marco>
    );
  }

  return (
    <Marco perfil={perfil}>
      <Encabezado
        eyebrow={
          <Enlace a="/portal/asuntos" className="inline-flex items-center gap-2 hover:text-bosque">
            <ArrowLeft size={14} aria-hidden="true" /> Estado de asuntos{esFirma && empresa ? ` · ${empresa}` : ''}
          </Enlace>
        }
        titulo={asunto.titulo}
        bajada={
          <span className="inline-flex flex-wrap items-center gap-3">
            <Etiqueta tono={ESTADO_ASUNTO[asunto.estado].tono}>{rotuloEstado(asunto.estado, esFirma)}</Etiqueta>
            <span className="text-[15px]">{TIPO_ASUNTO[asunto.tipo]}</span>
          </span>
        }
      />

      <div className="wrap py-10 desk:py-14 grid gap-10 desk:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-8 min-w-0 order-2 desk:order-1">
          {error && <Aviso tipo="error">{error}</Aviso>}
          {ok && <Aviso tipo="ok">{ok}</Aviso>}

          {!soloLectura && (
            <form onSubmit={sumarNovedad} className="bg-white border border-[rgba(27,31,27,0.15)] p-6 flex flex-col gap-4">
              <Campo etiqueta={esFirma ? 'Sumar una novedad' : 'Escribile a FIRMA'} ayuda={esFirma ? undefined : 'Le llega por mail a FIRMA y queda en el historial del asunto.'}>
                <textarea maxLength={4000} className={claseTextarea} value={texto} onChange={(e) => setTexto(e.target.value)} />
              </Campo>
              {esFirma && (
                <div className="grid gap-4 tab:grid-cols-2 items-end">
                  <Campo etiqueta="Cambiar el estado a">
                    <select className={claseInput} value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value as EstadoAsunto | '')}>
                      <option value="">Sin cambios</option>
                      {ESTADOS.filter((e) => e !== asunto.estado).map((e) => (
                        <option key={e} value={e}>
                          {ESTADO_ASUNTO[e].firma}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <label className="flex items-center gap-3 text-[15px] cursor-pointer h-12">
                    <input type="checkbox" className="w-4 h-4 accent-[#173A2F]" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
                    Avisar por mail a la empresa
                  </label>
                </div>
              )}
              <Button type="submit" className="self-start" disabled={ocupado !== ''}>
                {ocupado === 'novedad' ? 'Guardando…' : esFirma ? 'Guardar novedad' : 'Enviar'}
              </Button>
            </form>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="eyebrow text-piedra">Historial</h2>
            {novedades.length === 0 ? (
              <p className="text-sm text-piedra">Todavía no hay novedades.</p>
            ) : (
              <ol className="flex flex-col">
                {novedades.map((n) => {
                  const deFirma = autor(n) === 'FIRMA' || (esFirma && n.autor_id === perfil.id);
                  return (
                    <li key={n.id} className="relative pl-6 pb-7 last:pb-0 border-l border-[rgba(27,31,27,0.15)] last:border-transparent">
                      <span aria-hidden="true" className={`absolute -left-[5px] top-1.5 w-[9px] h-[9px] rounded-full ${deFirma ? 'bg-bosque' : 'bg-piedra'}`} />
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-piedra mb-2">
                        <span className="font-medium text-tinta">{autor(n)}</span>
                        <span>{fechaHoraAsunto(n.creado_en)}</span>
                        {n.estado && <Etiqueta tono={ESTADO_ASUNTO[n.estado].tono}>{rotuloEstado(n.estado, esFirma)}</Etiqueta>}
                        {esFirma && n.avisado_en && (
                          <span className="inline-flex items-center gap-1">
                            <Mail size={12} aria-hidden="true" /> Avisado a {n.avisados}
                          </span>
                        )}
                      </div>
                      <p className="text-[15px] leading-[1.6] whitespace-pre-line break-words">{n.texto}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="order-1 desk:order-2 flex flex-col gap-5 bg-marfil-oscuro p-6 self-start">
          {edicion ? (
            <form onSubmit={guardarDatos} className="flex flex-col gap-4">
              <Campo etiqueta="Título">
                <input maxLength={140} className={claseInput} value={edicion.titulo} onChange={(e) => setEdicion({ ...edicion, titulo: e.target.value })} />
              </Campo>
              <Campo etiqueta="Próximo paso">
                <input maxLength={300} className={claseInput} value={edicion.proximo_paso} onChange={(e) => setEdicion({ ...edicion, proximo_paso: e.target.value })} />
              </Campo>
              <Campo etiqueta="Vence">
                <input type="date" className={claseInput} value={edicion.vence_en} onChange={(e) => setEdicion({ ...edicion, vence_en: e.target.value })} />
              </Campo>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" size="sm" disabled={ocupado !== ''}>
                  {ocupado === 'datos' ? 'Guardando…' : 'Guardar'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEdicion(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <>
              <dl className="flex flex-col gap-4 text-[15px]">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-1">Próximo paso</dt>
                  <dd>{asunto.proximo_paso || (asunto.estado === 'finalizado' ? 'Ninguno, el asunto está cerrado.' : 'Lo definimos con la próxima novedad.')}</dd>
                </div>
                {asunto.vence_en && (
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-1">Vence</dt>
                    <dd>{fechaVence(asunto.vence_en)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-1">Abierto</dt>
                  <dd>{fechaAsunto(asunto.creado_en)}</dd>
                </div>
                {asunto.cerrado_en && (
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-1">Finalizado</dt>
                    <dd>{fechaAsunto(asunto.cerrado_en)}</dd>
                  </div>
                )}
              </dl>
              {esFirma && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() => setEdicion({ titulo: asunto.titulo, proximo_paso: asunto.proximo_paso ?? '', vence_en: asunto.vence_en ?? '' })}
                >
                  Editar datos
                </Button>
              )}
            </>
          )}
        </aside>
      </div>
    </Marco>
  );
};

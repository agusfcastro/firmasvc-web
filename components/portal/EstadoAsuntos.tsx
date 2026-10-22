import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, FileText, Mail, Paperclip, Plus, RefreshCw, Send, StickyNote, Upload } from 'lucide-react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { useVistaPrevia } from './vistaPrevia';
import { Aviso, Campo, Encabezado, Enlace, Etiqueta, Marco, Pestanas, claseInput } from './ui';
import type { Organizacion, Perfil } from './tipos';
import {
  BUCKET_ASUNTOS,
  ESTADOS,
  ESTADO_ASUNTO,
  FORMATOS_ASUNTO,
  MAX_BYTES_ASUNTO,
  TIPO_ASUNTO,
  avisarPorMail,
  fechaAsunto,
  fechaHoraAsunto,
  fechaVence,
  pesoArchivo,
  type Archivo,
  type Asunto,
  type EstadoAsunto,
  type Mensaje,
  type Novedad,
  type TipoAsunto,
} from './asuntos';

/**
 * Estado de asuntos en /portal/asuntos y /portal/asuntos/:id.
 * El cliente (titular y CSM) ve sus trámites con FIRMA. Cada asunto tiene
 * un chat en vivo, una bitácora con notas internas o visibles y los
 * documentos que suben las dos partes. Los avisos salen por mail.
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
/* Detalle: chat, bitácora y documentos                                 */
/* ------------------------------------------------------------------ */
type PestanaAsunto = 'chat' | 'bitacora' | 'documentos';
type Lado = 'firma' | 'cliente';
interface Autor {
  nombre: string | null;
  email: string;
  rol: string;
}

const extensionDe = (nombre: string) => (nombre.split('.').pop() || '').toLowerCase();

const Detalle: React.FC<{ id: string; perfil: Perfil }> = ({ id, perfil }) => {
  const vista = useVistaPrevia();
  const esFirma = perfil.rol === 'admin' && !vista;
  const soloLectura = Boolean(vista);
  const miLado: Lado = esFirma ? 'firma' : 'cliente';
  const [pestana, setPestana] = useState<PestanaAsunto>(() => {
    const p = new URLSearchParams(window.location.search).get('pestana');
    return p === 'bitacora' || p === 'documentos' ? p : 'chat';
  });
  const [asunto, setAsunto] = useState<Asunto | null | undefined>(undefined);
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [autores, setAutores] = useState<Record<string, Autor>>({});
  const [empresa, setEmpresa] = useState('');
  const [otroPresente, setOtroPresente] = useState(false);
  const [edicion, setEdicion] = useState<{ titulo: string; proximo_paso: string; vence_en: string } | null>(null);
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const conocerAutores = useCallback(async (ids: (string | null)[]) => {
    if (!supabase) return;
    const faltan = [...new Set(ids.filter(Boolean) as string[])];
    if (!faltan.length) return;
    // Cada uno ve los perfiles que su permiso le deja ver. Los que no ve son de FIRMA.
    const { data } = await supabase.from('perfiles').select('id, nombre, email, rol').in('id', faltan);
    setAutores((a) => ({ ...a, ...Object.fromEntries(((data as (Autor & { id: string })[]) ?? []).map((x) => [x.id, x])) }));
  }, []);

  const cargar = useCallback(async () => {
    if (!supabase) return;
    const [{ data: a }, { data: n }, { data: m }, { data: f }] = await Promise.all([
      supabase.from('asuntos').select('*').eq('id', id).maybeSingle(),
      supabase.from('asunto_novedades').select('*').eq('asunto_id', id).order('creado_en', { ascending: false }),
      supabase.from('asunto_mensajes').select('*').eq('asunto_id', id).order('creado_en', { ascending: true }).limit(500),
      supabase.from('asunto_archivos').select('*').eq('asunto_id', id).order('creado_en', { ascending: false }),
    ]);
    setAsunto((a as Asunto) ?? null);
    const nov = (n as Novedad[]) ?? [];
    const msj = (m as Mensaje[]) ?? [];
    const arc = (f as Archivo[]) ?? [];
    setNovedades(nov);
    setMensajes(msj);
    setArchivos(arc);
    void conocerAutores([...nov.map((x) => x.autor_id), ...msj.map((x) => x.autor_id), ...arc.map((x) => x.subido_por)]);
    if (a) {
      const { data: o } = await supabase.from('organizaciones').select('nombre').eq('id', (a as Asunto).organizacion_id).maybeSingle();
      setEmpresa((o?.nombre as string | undefined) ?? '');
    }
  }, [id, conocerAutores]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Chat en vivo y quién tiene el asunto abierto. En la vista previa se mira sin anunciarse.
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    const canal = sb.channel(`asunto-${id}`, { config: { presence: { key: `${perfil.id}-${Math.random().toString(36).slice(2, 8)}` } } });
    canal
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asunto_mensajes', filter: `asunto_id=eq.${id}` }, (cambio) => {
        const nuevo = cambio.new as Mensaje;
        setMensajes((lista) => (lista.some((x) => x.id === nuevo.id) ? lista : [...lista, nuevo]));
        void conocerAutores([nuevo.autor_id]);
      })
      .on('presence', { event: 'sync' }, () => {
        const estados = Object.values(canal.presenceState()).flat() as unknown as { lado?: Lado }[];
        setOtroPresente(estados.some((p) => p.lado && p.lado !== miLado));
      })
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED' && !soloLectura) void canal.track({ lado: miLado });
      });
    return () => {
      void sb.removeChannel(canal);
    };
  }, [id, perfil.id, miLado, soloLectura, conocerAutores]);

  const nombreDe = (autorId: string | null): string => {
    if (autorId && autorId === perfil.id && !vista) return 'Vos';
    const a = autorId ? autores[autorId] : undefined;
    if (!a || a.rol === 'admin') return 'FIRMA';
    return a.nombre || a.email;
  };
  const esDeFirma = (autorId: string | null) => {
    if (autorId && autorId === perfil.id) return esFirma;
    const a = autorId ? autores[autorId] : undefined;
    return !a || a.rol === 'admin';
  };

  function cambiarPestana(p: PestanaAsunto) {
    setPestana(p);
    setOk(null);
    setError(null);
    const url = new URL(window.location.href);
    if (p === 'chat') url.searchParams.delete('pestana');
    else url.searchParams.set('pestana', p);
    window.history.replaceState({}, '', url);
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

  const otro = esFirma ? 'el cliente' : 'FIRMA';

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

      <div className="wrap py-10 desk:py-14 grid gap-10 desk:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6 min-w-0 order-2 desk:order-1">
          <Pestanas<PestanaAsunto>
            items={[
              { clave: 'chat', titulo: 'Chat', cuenta: mensajes.length },
              { clave: 'bitacora', titulo: 'Bitácora', cuenta: novedades.length },
              { clave: 'documentos', titulo: 'Documentos', cuenta: archivos.length },
            ]}
            activa={pestana}
            alCambiar={cambiarPestana}
          />
          {error && <Aviso tipo="error">{error}</Aviso>}
          {ok && <Aviso tipo="ok">{ok}</Aviso>}

          {pestana === 'chat' && (
            <Chat
              asuntoId={asunto.id}
              mensajes={mensajes}
              soloLectura={soloLectura}
              otro={otro}
              otroPresente={otroPresente}
              nombreDe={nombreDe}
              propio={(m) => (vista ? !esDeFirma(m.autor_id) : m.autor_id === perfil.id)}
              alEnviar={(m) => setMensajes((lista) => (lista.some((x) => x.id === m.id) ? lista : [...lista, m]))}
              alError={setError}
            />
          )}
          {pestana === 'bitacora' && (
            <Bitacora asunto={asunto} novedades={novedades} esFirma={esFirma} soloLectura={soloLectura} nombreDe={nombreDe} alCambiar={(t) => { setOk(t); void cargar(); }} alError={setError} />
          )}
          {pestana === 'documentos' && (
            <Documentos asunto={asunto} archivos={archivos} esFirma={esFirma} soloLectura={soloLectura} nombreDe={nombreDe} alCambiar={(t) => { setOk(t); void cargar(); }} alError={setError} />
          )}
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

/* ------------------------------------------------------------------ */
/* Chat                                                                 */
/* ------------------------------------------------------------------ */
const Chat: React.FC<{
  asuntoId: string;
  mensajes: Mensaje[];
  soloLectura: boolean;
  otro: string;
  otroPresente: boolean;
  nombreDe: (autorId: string | null) => string;
  propio: (m: Mensaje) => boolean;
  alEnviar: (m: Mensaje) => void;
  alError: (t: string | null) => void;
}> = ({ asuntoId, mensajes, soloLectura, otro, otroPresente, nombreDe, propio, alEnviar, alError }) => {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const fondo = useRef<HTMLDivElement>(null);

  // Siempre abajo, en el último mensaje.
  useEffect(() => {
    const el = fondo.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes.length]);

  async function enviar() {
    const t = texto.trim();
    if (!supabase || !t || enviando) return;
    setEnviando(true);
    alError(null);
    const { data, error } = await supabase.from('asunto_mensajes').insert({ asunto_id: asuntoId, texto: t }).select('*').single();
    setEnviando(false);
    if (error || !data) return alError(error?.message ?? 'No se pudo mandar el mensaje.');
    setTexto('');
    alEnviar(data as Mensaje);
    // Si la otra parte tiene el asunto abierto, lo ve en el momento. Si no, le llega un mail, como mucho uno cada 15 minutos.
    if (otroPresente) return setNota(null);
    const r = await avisarPorMail('mensaje', (data as Mensaje).id);
    setNota(r.ok && r.avisados ? `Le avisamos a ${otro} por mail.` : null);
  }

  return (
    <section className="flex flex-col bg-white border border-[rgba(27,31,27,0.15)]" aria-label="Chat del asunto">
      <div className="flex items-center justify-between gap-3 px-5 py-3 text-[13px] text-piedra" style={{ borderBottom: '1px solid rgba(27,31,27,0.1)' }}>
        <span>Mensajes con {otro}</span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={`w-2 h-2 rounded-full ${otroPresente ? 'bg-bosque' : 'bg-calido'}`} />
          {otroPresente ? `${otro.charAt(0).toUpperCase()}${otro.slice(1)} tiene el asunto abierto` : `Si ${otro} no está conectado, le llega un mail`}
        </span>
      </div>
      <div ref={fondo} className="h-[440px] overflow-y-auto px-5 py-5 flex flex-col gap-4 bg-[#FBFAF6]">
        {mensajes.length === 0 ? (
          <p className="m-auto text-sm text-piedra text-center max-w-[36ch]">Todavía no hay mensajes. Escribí la primera consulta sobre este asunto.</p>
        ) : (
          mensajes.map((m) => {
            const mio = propio(m);
            return (
              <div key={m.id} className={`flex flex-col max-w-[80%] ${mio ? 'self-end items-end' : 'self-start items-start'}`}>
                <span className="text-[11px] text-piedra mb-1">
                  {nombreDe(m.autor_id)} · {fechaHoraAsunto(m.creado_en)}
                </span>
                <p className={`px-4 py-2.5 text-[15px] leading-[1.5] whitespace-pre-line break-words ${mio ? 'bg-bosque text-marfil' : 'bg-white border border-[rgba(27,31,27,0.15)]'}`}>{m.texto}</p>
              </div>
            );
          })
        )}
      </div>
      {!soloLectura && (
        <form
          className="flex items-end gap-3 p-4"
          style={{ borderTop: '1px solid rgba(27,31,27,0.1)' }}
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
        >
          <label className="sr-only" htmlFor={`chat-${asuntoId}`}>
            Mensaje
          </label>
          <textarea
            id={`chat-${asuntoId}`}
            rows={2}
            maxLength={4000}
            placeholder="Escribí un mensaje. Enter envía, Shift + Enter hace un salto de línea."
            className={`${claseInput.replace('h-12', 'min-h-[52px]')} py-3 leading-[1.4] resize-none`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void enviar();
              }
            }}
          />
          <Button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar mensaje">
            <Send size={16} aria-hidden="true" />
          </Button>
        </form>
      )}
      {nota && <p className="px-5 pb-4 -mt-1 text-[12px] text-piedra">{nota}</p>}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Bitácora                                                             */
/* ------------------------------------------------------------------ */
const ICONO_NOVEDAD = { nota: StickyNote, estado: RefreshCw, documento: Paperclip };

const Bitacora: React.FC<{
  asunto: Asunto;
  novedades: Novedad[];
  esFirma: boolean;
  soloLectura: boolean;
  nombreDe: (autorId: string | null) => string;
  alCambiar: (t: string) => void;
  alError: (t: string | null) => void;
}> = ({ asunto, novedades, esFirma, soloLectura, nombreDe, alCambiar, alError }) => {
  const [texto, setTexto] = useState('');
  const [interna, setInterna] = useState(false);
  const [estado, setEstado] = useState<'' | EstadoAsunto>('');
  const [avisar, setAvisar] = useState(true);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const t = texto.trim();
    if (!t && !estado) return alError('Escribí una nota o elegí un estado nuevo.');
    setGuardando(true);
    alError(null);
    // El cambio de estado se anota solo en la bitácora.
    if (estado && estado !== asunto.estado) {
      const { error } = await supabase.from('asuntos').update({ estado }).eq('id', asunto.id);
      if (error) {
        setGuardando(false);
        return alError(error.message);
      }
    }
    let nota = estado ? 'Estado actualizado.' : '';
    if (t) {
      const { data, error } = await supabase.from('asunto_novedades').insert({ asunto_id: asunto.id, texto: t, interna }).select('id').single();
      if (error || !data) {
        setGuardando(false);
        return alError(error?.message ?? 'No se pudo guardar la nota.');
      }
      nota = interna ? 'Nota interna guardada. Solo la ve FIRMA.' : 'Nota guardada.';
      if (!interna && avisar) {
        const r = await avisarPorMail('novedad', data.id);
        nota = r.ok ? `Nota guardada. Avisamos por mail a ${r.avisados} ${r.avisados === 1 ? 'persona' : 'personas'}.` : `Nota guardada, pero el aviso por mail no salió. ${r.error ?? ''}`;
      }
    }
    setGuardando(false);
    setTexto('');
    setEstado('');
    setInterna(false);
    alCambiar(nota);
  }

  return (
    <section className="flex flex-col gap-6">
      {esFirma && !soloLectura ? (
        <form onSubmit={guardar} className="bg-white border border-[rgba(27,31,27,0.15)] p-6 flex flex-col gap-4">
          <Campo etiqueta="Nota">
            <textarea maxLength={4000} className={claseTextarea} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </Campo>
          <div className="grid gap-4 tab:grid-cols-2">
            <Campo etiqueta="Cambiar el estado a">
              <select className={claseInput} value={estado} onChange={(e) => setEstado(e.target.value as EstadoAsunto | '')}>
                <option value="">Sin cambios</option>
                {ESTADOS.filter((x) => x !== asunto.estado).map((x) => (
                  <option key={x} value={x}>
                    {ESTADO_ASUNTO[x].firma}
                  </option>
                ))}
              </select>
            </Campo>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex items-center gap-3 text-[15px] cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#173A2F]" checked={interna} onChange={(e) => setInterna(e.target.checked)} />
                <span>
                  Nota interna <span className="text-piedra">(solo FIRMA)</span>
                </span>
              </label>
              <label className={`flex items-center gap-3 text-[15px] ${interna ? 'opacity-50' : 'cursor-pointer'}`}>
                <input type="checkbox" className="w-4 h-4 accent-[#173A2F]" disabled={interna} checked={avisar && !interna} onChange={(e) => setAvisar(e.target.checked)} />
                Avisar por mail a la empresa
              </label>
            </div>
          </div>
          <Button type="submit" className="self-start" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      ) : !soloLectura ? (
        <p className="text-sm text-piedra">La bitácora la lleva FIRMA. Para escribirnos, usá el chat.</p>
      ) : null}

      {novedades.length === 0 ? (
        <p className="text-sm text-piedra">Todavía no hay anotaciones.</p>
      ) : (
        <ol className="flex flex-col">
          {novedades.map((n) => {
            const Icono = ICONO_NOVEDAD[n.tipo] ?? StickyNote;
            return (
              <li key={n.id} className="relative pl-8 pb-7 last:pb-0 border-l border-[rgba(27,31,27,0.15)] last:border-transparent ml-2">
                <span aria-hidden="true" className={`absolute -left-[13px] top-0 w-[26px] h-[26px] flex items-center justify-center rounded-full ${n.interna ? 'bg-[#f6e7e4] text-[#8a2b20]' : 'bg-marfil-oscuro text-bosque'}`}>
                  <Icono size={13} />
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-piedra mb-1.5">
                  <span className="font-medium text-tinta">{nombreDe(n.autor_id)}</span>
                  <span>{fechaHoraAsunto(n.creado_en)}</span>
                  {n.interna && <Etiqueta tono="alerta">Interna</Etiqueta>}
                  {esFirma && n.avisado_en && (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} aria-hidden="true" /> Avisado a {n.avisados}
                    </span>
                  )}
                </div>
                <p className={`leading-[1.6] whitespace-pre-line break-words ${n.tipo === 'nota' ? 'text-[15px]' : 'text-[14px] text-piedra'}`}>{n.texto}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Documentos del asunto                                                */
/* ------------------------------------------------------------------ */
const Documentos: React.FC<{
  asunto: Asunto;
  archivos: Archivo[];
  esFirma: boolean;
  soloLectura: boolean;
  nombreDe: (autorId: string | null) => string;
  alCambiar: (t: string) => void;
  alError: (t: string | null) => void;
}> = ({ asunto, archivos, esFirma, soloLectura, nombreDe, alCambiar, alError }) => {
  const [ocupado, setOcupado] = useState('');
  const entrada = useRef<HTMLInputElement>(null);

  async function subir(archivo: File) {
    if (!supabase) return;
    alError(null);
    const ext = extensionDe(archivo.name);
    const mime = FORMATOS_ASUNTO[ext];
    if (!mime) return alError('Ese formato no se puede subir. Usá PDF, Word, Excel, JPG, PNG o TXT.');
    if (archivo.size > MAX_BYTES_ASUNTO) return alError('El archivo tiene que pesar menos de 20 MB.');
    setOcupado('subir');
    const ruta = `${asunto.organizacion_id}/${asunto.id}/${crypto.randomUUID()}.${ext}`;
    const cuerpo = archivo.type === mime ? archivo : new File([archivo], archivo.name, { type: mime });
    const { error: e1 } = await supabase.storage.from(BUCKET_ASUNTOS).upload(ruta, cuerpo, { contentType: mime, upsert: false });
    if (e1) {
      setOcupado('');
      return alError(`No se pudo subir el archivo. ${e1.message}`);
    }
    const { data, error: e2 } = await supabase.from('asunto_archivos').insert({ asunto_id: asunto.id, nombre: archivo.name.slice(0, 200), ruta, bytes: archivo.size }).select('id').single();
    if (e2 || !data) {
      await supabase.storage.from(BUCKET_ASUNTOS).remove([ruta]);
      setOcupado('');
      return alError(e2?.message ?? 'No se pudo guardar el archivo.');
    }
    const r = await avisarPorMail('archivo', data.id);
    setOcupado('');
    if (entrada.current) entrada.current.value = '';
    alCambiar(r.ok && r.avisados ? `Archivo subido. Le avisamos por mail a ${esFirma ? 'la empresa' : 'FIRMA'}.` : 'Archivo subido.');
  }

  async function descargar(a: Archivo) {
    if (!supabase) return;
    setOcupado(`bajar-${a.id}`);
    const { data, error } = await supabase.storage.from(BUCKET_ASUNTOS).createSignedUrl(a.ruta, 60, { download: a.nombre });
    setOcupado('');
    if (error || !data) return alError('No se pudo descargar el archivo.');
    window.location.assign(data.signedUrl);
  }

  async function borrar(a: Archivo) {
    if (!supabase || !window.confirm(`¿Borrar ${a.nombre}? No se puede deshacer.`)) return;
    setOcupado(`borrar-${a.id}`);
    const { error } = await supabase.from('asunto_archivos').delete().eq('id', a.id);
    if (!error) await supabase.storage.from(BUCKET_ASUNTOS).remove([a.ruta]);
    setOcupado('');
    if (error) return alError(error.message);
    alCambiar('Archivo borrado.');
  }

  return (
    <section className="flex flex-col gap-6">
      {!soloLectura && (
        <div className="bg-white border border-[rgba(27,31,27,0.15)] p-6 flex flex-col tab:flex-row tab:items-center gap-4 justify-between">
          <p className="text-[15px] leading-[1.5] text-piedra max-w-[46ch]">
            Subí documentos del asunto: PDF, Word, Excel o imágenes, hasta 20 MB. {esFirma ? 'La empresa' : 'FIRMA'} recibe un aviso por mail.
          </p>
          <label className={`inline-flex items-center justify-center gap-2 h-[52px] px-6 bg-bosque text-marfil text-[15px] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-bosque-dark ${ocupado ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
            <Upload size={16} aria-hidden="true" />
            {ocupado === 'subir' ? 'Subiendo…' : 'Subir documento'}
            <input
              ref={entrada}
              type="file"
              className="sr-only"
              accept={Object.keys(FORMATOS_ASUNTO).map((x) => `.${x}`).join(',')}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subir(f);
              }}
            />
          </label>
        </div>
      )}

      {archivos.length === 0 ? (
        <p className="text-sm text-piedra">Todavía no hay documentos en este asunto.</p>
      ) : (
        <ul className="flex flex-col bg-white border border-[rgba(27,31,27,0.15)]">
          {archivos.map((a) => (
            <li key={a.id} className="flex flex-col tab:flex-row tab:items-center gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(27,31,27,0.08)' }}>
              <FileText size={20} className="hidden tab:block shrink-0 text-bosque" aria-hidden="true" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium break-words">{a.nombre}</span>
                <span className="text-[13px] text-piedra">
                  {nombreDe(a.subido_por)} · {fechaHoraAsunto(a.creado_en)}
                  {a.bytes !== null ? ` · ${pesoArchivo(a.bytes)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <button type="button" onClick={() => descargar(a)} disabled={ocupado !== ''} className="inline-flex items-center gap-2 text-sm font-medium text-bosque underline underline-offset-4 disabled:opacity-50">
                  <Download size={14} aria-hidden="true" />
                  {ocupado === `bajar-${a.id}` ? 'Abriendo…' : 'Descargar'}
                </button>
                {esFirma && !soloLectura && (
                  <button type="button" onClick={() => borrar(a)} disabled={ocupado !== ''} className="text-sm text-piedra underline underline-offset-4 hover:text-tinta disabled:opacity-50">
                    {ocupado === `borrar-${a.id}` ? 'Borrando…' : 'Borrar'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

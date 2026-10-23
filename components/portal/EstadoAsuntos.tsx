import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, FileText, Mail, Paperclip, Plus, RefreshCw, Send, StickyNote, Upload } from 'lucide-react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { useVistaPrevia } from './vistaPrevia';
import { Aviso, Campo, Encabezado, Enlace, Etiqueta, Marco, Pestanas, claseInput } from './ui';
import { permisosDe, type Organizacion, type Perfil } from './tipos';
import {
  AYUDA_SEMAFORO,
  CANALES_SUGERIDOS,
  CAUSAS,
  ROTULO_CAUSA,
  ROTULO_ETAPA,
  ROTULO_RESULTADO,
  ROTULO_SEMAFORO,
  TONO_ETAPA,
  type Caso,
  type Causa,
} from './crm/reglasCasos';
import { dinero, hoyISO } from './crm/tipos';
import {
  BUCKET_ASUNTOS,
  ESTADOS,
  ESTADO_ASUNTO,
  FORMATOS_ASUNTO,
  MAX_BYTES_ASUNTO,
  MOTIVOS,
  MOTIVO_CONFLICTO,
  TIPO_ASUNTO,
  llevaCaso,
  avisarPorMail,
  fechaAsunto,
  fechaHoraAsunto,
  fechaVence,
  pesoArchivo,
  type Archivo,
  type Asunto,
  type EstadoAsunto,
  type Mensaje,
  type MotivoConflicto,
  type Novedad,
  type TipoAsunto,
} from './asuntos';

/**
 * Estado de asuntos en /portal/asuntos y /portal/asuntos/:id.
 * Una sola gestión para los trámites con FIRMA y los conflictos de la
 * empresa. Los crean FIRMA o el cliente (titular y CSM) y pueden vincularse
 * a un cliente del CRM. Un reclamo de reembolso o contracargo lleva además
 * su caso de conflicto, con los indicadores del protocolo (CRM › Casos de
 * conflicto). Cada asunto tiene un chat en vivo, una bitácora con notas
 * internas o visibles y los documentos que suben las dos partes. Los avisos
 * salen por mail.
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
  motivo: MotivoConflicto | '';
  cliente_id: string;
  estado: EstadoAsunto;
  proximo_paso: string;
  vence_en: string;
  /** FIRMA la deja como primera novedad. El cliente, como primer mensaje del chat. */
  novedad: string;
  avisar: boolean;
  // Caso de conflicto, para reembolso o contracargo.
  causa: Causa | '';
  canal: string;
  monto_reclamado: string;
  contracargo: boolean;
}

interface ClienteCrm {
  id: string;
  nombre: string;
  codigo: string | null;
}

const Lista: React.FC<{ perfil: Perfil; organizacion: Organizacion | null }> = ({ perfil, organizacion }) => {
  const vista = useVistaPrevia();
  const esFirma = perfil.rol === 'admin' && !vista;
  const orgPropia = vista?.orgId ?? organizacion?.id ?? null;
  const [asuntos, setAsuntos] = useState<Asunto[] | null>(null);
  const [orgs, setOrgs] = useState<{ id: string; nombre: string }[]>([]);
  const [filtro, setFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [clientesCrm, setClientesCrm] = useState<ClienteCrm[]>([]);
  const [nombresCliente, setNombresCliente] = useState<Record<string, string>>({});
  const puedeCrear = !vista;

  const cargar = useCallback(async () => {
    if (!supabase) return;
    let q = supabase.from('asuntos').select('*').order('actualizado_en', { ascending: false });
    if (!esFirma && orgPropia) q = q.eq('organizacion_id', orgPropia);
    const { data, error: e } = await q;
    if (e) setError(esFirma ? `${e.message}. Revisá que la migración 0017_asuntos.sql esté corrida en Supabase.` : 'No pudimos cargar tus asuntos. Probá recargar la página.');
    const lista = (data as Asunto[]) ?? [];
    setAsuntos(lista);
    const ids = [...new Set(lista.map((a) => a.cliente_id).filter(Boolean) as string[])];
    if (ids.length) {
      const { data: cl } = await supabase.from('crm_clientes').select('id, nombre').in('id', ids);
      setNombresCliente(Object.fromEntries(((cl as { id: string; nombre: string }[]) ?? []).map((c) => [c.id, c.nombre])));
    }
  }, [esFirma, orgPropia]);

  // Clientes del CRM de la empresa del formulario, para vincular el asunto.
  const orgDelBorrador = borrador ? (esFirma ? borrador.organizacion_id : orgPropia) : null;
  useEffect(() => {
    if (!supabase || !orgDelBorrador) return setClientesCrm([]);
    let vigente = true;
    void supabase
      .from('crm_clientes')
      .select('id, nombre, codigo')
      .eq('organizacion_id', orgDelBorrador)
      .order('nombre')
      .then(({ data }) => {
        if (vigente) setClientesCrm((data as ClienteCrm[]) ?? []);
      });
    return () => {
      vigente = false;
    };
  }, [orgDelBorrador]);

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
  const texto = busqueda.trim().toLowerCase();
  const visibles = (asuntos ?? []).filter(
    (a) => (!filtro || a.organizacion_id === filtro) && (!texto || a.titulo.toLowerCase().includes(texto) || (a.codigo ?? '').toLowerCase().includes(texto)),
  );
  const abiertos = visibles.filter((a) => a.estado !== 'finalizado');
  const cerrados = visibles.filter((a) => a.estado === 'finalizado');

  function nuevo() {
    setOk(null);
    setError(null);
    setBorrador({
      organizacion_id: esFirma ? filtro || orgs[0]?.id || '' : orgPropia ?? '',
      titulo: '',
      tipo: esFirma ? 'contrato' : 'conflicto',
      motivo: '',
      cliente_id: '',
      estado: 'en_curso',
      proximo_paso: '',
      vence_en: '',
      novedad: '',
      avisar: true,
      causa: '',
      canal: '',
      monto_reclamado: '',
      contracargo: false,
    });
  }

  const cambiar = (cambios: Partial<Borrador>) => setBorrador((b) => (b ? { ...b, ...cambios } : b));

  // Desde la ficha del CRM: /portal/asuntos?cliente=<id> abre un asunto nuevo con ese cliente vinculado.
  useEffect(() => {
    const clienteId = new URLSearchParams(window.location.search).get('cliente');
    if (!supabase || !clienteId || !puedeCrear) return;
    window.history.replaceState(window.history.state, '', '/portal/asuntos');
    void supabase
      .from('crm_clientes')
      .select('id, organizacion_id')
      .eq('id', clienteId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setError('No existe ese cliente o no tenés acceso.');
        nuevo();
        cambiar({ organizacion_id: data.organizacion_id as string, cliente_id: data.id as string });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const titulo = borrador.titulo.trim();
    const motivo = borrador.tipo === 'conflicto' ? borrador.motivo || null : null;
    const conCaso = llevaCaso(motivo);
    const monto = borrador.monto_reclamado.trim() ? Number(borrador.monto_reclamado.replace(',', '.')) : null;
    if (!borrador.organizacion_id) return setError('Elegí la empresa.');
    if (titulo.length < 3) return setError('El título tiene que tener al menos 3 caracteres.');
    if (borrador.tipo === 'conflicto' && !motivo) return setError('Elegí el motivo del conflicto.');
    if (conCaso && !borrador.cliente_id) return setError('Un reembolso o contracargo va vinculado al cliente que lo pide. Elegilo de la lista.');
    if (conCaso && !borrador.causa) return setError('Elegí la causa del reclamo.');
    if (monto !== null && (!Number.isFinite(monto) || monto < 0)) return setError('El monto reclamado no es válido.');
    if (!esFirma && borrador.novedad.trim().length < 2) return setError('Contanos qué pasó, así FIRMA tiene el contexto.');
    setGuardando(true);
    setError(null);
    const { data, error: e1 } = await supabase
      .from('asuntos')
      .insert({
        organizacion_id: borrador.organizacion_id,
        titulo,
        tipo: borrador.tipo,
        estado: esFirma ? borrador.estado : 'en_curso',
        proximo_paso: esFirma ? borrador.proximo_paso.trim() || null : null,
        vence_en: esFirma ? borrador.vence_en || null : null,
        creado_por: perfil.id,
        // Solo si hay algo: así crear un asunto común sigue andando sin la migración 0024.
        ...(motivo ? { motivo } : {}),
        ...(borrador.cliente_id ? { cliente_id: borrador.cliente_id } : {}),
      })
      .select('id')
      .single();
    if (e1 || !data) {
      setGuardando(false);
      return setError(e1?.message ?? 'No se pudo crear el asunto.');
    }
    const avisos: string[] = [];
    if (conCaso) {
      const { error: e3 } = await supabase.from('crm_casos').insert({
        asunto_id: data.id,
        cliente_id: borrador.cliente_id,
        abierto_en: hoyISO(),
        causa: borrador.causa,
        canal: borrador.canal.trim() || null,
        monto_reclamado: monto,
        contracargo: borrador.contracargo,
        contracargo_resultado: borrador.contracargo ? 'pendiente' : null,
      });
      if (e3) avisos.push(`El caso de conflicto no se pudo abrir (${e3.message}). Abrilo desde CRM › Casos de conflicto.`);
    }
    const texto = borrador.novedad.trim();
    let nota = 'Asunto creado.';
    if (texto && esFirma) {
      const { data: nov, error: e2 } = await supabase.from('asunto_novedades').insert({ asunto_id: data.id, texto }).select('id').single();
      if (e2 || !nov) nota = 'Asunto creado, pero la primera novedad no se pudo guardar.';
      else if (borrador.avisar) {
        const r = await avisarPorMail('novedad', nov.id);
        nota = r.ok ? `Asunto creado. Avisamos por mail a ${r.avisados} ${r.avisados === 1 ? 'persona' : 'personas'}.` : `Asunto creado, pero el aviso por mail no salió. ${r.error ?? ''}`;
      }
    } else if (texto) {
      // Lo que cuenta el cliente abre el chat del asunto y le llega a FIRMA por mail.
      const { data: msj, error: e2 } = await supabase.from('asunto_mensajes').insert({ asunto_id: data.id, texto }).select('id').single();
      if (e2 || !msj) nota = 'Asunto creado, pero tu mensaje no se pudo guardar. Escribilo en el chat del asunto.';
    }
    if (!esFirma) {
      // El mail a FIRMA anuncia el asunto nuevo, con lo que contó el cliente.
      const r = await avisarPorMail('asunto', data.id);
      if (nota === 'Asunto creado.') nota = r.ok ? 'Asunto creado. Le avisamos a FIRMA por mail.' : 'Asunto creado. FIRMA lo ve en el portal.';
    }
    setGuardando(false);
    setBorrador(null);
    setOk([nota, ...avisos].join(' '));
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
            ? 'Trámites y conflictos de cada empresa. Las novedades que sumás le llegan por mail al titular y al CSM.'
            : 'Trámites y conflictos de tu empresa, con su estado, el próximo paso y las novedades. Cuando algo cambia, te avisamos por mail.'
        }
        acciones={
          puedeCrear && !borrador ? (
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
              {esFirma && (
                <Campo etiqueta="Empresa">
                  <select className={claseInput} value={borrador.organizacion_id} onChange={(e) => cambiar({ organizacion_id: e.target.value, cliente_id: '' })}>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
              <Campo etiqueta="Tipo">
                <select className={claseInput} value={borrador.tipo} onChange={(e) => cambiar({ tipo: e.target.value as TipoAsunto, motivo: '' })}>
                  {Object.entries(TIPO_ASUNTO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Campo>
              {borrador.tipo === 'conflicto' && (
                <Campo etiqueta="Motivo" ayuda={borrador.motivo ? MOTIVO_CONFLICTO[borrador.motivo].ayuda : undefined}>
                  <select required className={claseInput} value={borrador.motivo} onChange={(e) => cambiar({ motivo: e.target.value as MotivoConflicto | '' })}>
                    <option value="">Elegí</option>
                    {MOTIVOS.map((m) => (
                      <option key={m} value={m}>
                        {MOTIVO_CONFLICTO[m].titulo}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
              <Campo
                etiqueta={llevaCaso(borrador.motivo || null) ? 'Cliente' : 'Cliente (opcional)'}
                ayuda={clientesCrm.length ? 'Si el asunto es sobre un cliente de la empresa, vinculalo: aparece en su ficha del CRM.' : 'La empresa no tiene clientes cargados en el CRM.'}
              >
                <select
                  required={llevaCaso(borrador.motivo || null)}
                  className={claseInput}
                  value={borrador.cliente_id}
                  onChange={(e) => cambiar({ cliente_id: e.target.value })}
                  disabled={!clientesCrm.length}
                >
                  <option value="">{llevaCaso(borrador.motivo || null) ? 'Elegí' : 'Sin cliente'}</option>
                  {clientesCrm.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.codigo ? ` · ${c.codigo}` : ''}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <Campo etiqueta="Título" ayuda={esFirma ? 'Lo ve el cliente. Por ejemplo, Registro de la marca ante el INPI.' : 'Una frase corta. Por ejemplo, Reclamo de Juan Pérez por el programa de 6 meses.'}>
              <input required maxLength={140} className={claseInput} value={borrador.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} />
            </Campo>

            {llevaCaso(borrador.motivo || null) && (
              <fieldset className="flex flex-col gap-5 p-5 bg-marfil-oscuro">
                <legend className="eyebrow text-piedra px-1">Caso de conflicto</legend>
                <p className="text-sm text-piedra -mt-2">Con esto se abre su caso y cuenta en los indicadores del protocolo. Etapa, semáforo y decisión se siguen desde el asunto.</p>
                <div className="grid gap-5 tab:grid-cols-2">
                  <Campo etiqueta="Causa">
                    <select required className={claseInput} value={borrador.causa} onChange={(e) => cambiar({ causa: e.target.value as Causa | '' })}>
                      <option value="">Elegí</option>
                      {CAUSAS.map((k) => (
                        <option key={k} value={k}>
                          {ROTULO_CAUSA[k]}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Canal" ayuda="Por dónde llegó el reclamo.">
                    <input list="canales-asunto" maxLength={80} className={claseInput} value={borrador.canal} onChange={(e) => cambiar({ canal: e.target.value })} />
                    <datalist id="canales-asunto">
                      {CANALES_SUGERIDOS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </Campo>
                  <Campo etiqueta="Monto reclamado" ayuda="Opcional. En la moneda del cliente.">
                    <input inputMode="decimal" className={claseInput} value={borrador.monto_reclamado} onChange={(e) => cambiar({ monto_reclamado: e.target.value })} />
                  </Campo>
                  <label className="flex items-center gap-3 text-[15px] cursor-pointer self-end h-12">
                    <input type="checkbox" className="w-4 h-4 accent-[#173A2F]" checked={borrador.contracargo} onChange={(e) => cambiar({ contracargo: e.target.checked })} />
                    Hubo contracargo con la tarjeta
                  </label>
                </div>
              </fieldset>
            )}

            {esFirma && (
              <>
                <div className="grid gap-5 tab:grid-cols-2">
                  <Campo etiqueta="Estado">
                    <select className={claseInput} value={borrador.estado} onChange={(e) => cambiar({ estado: e.target.value as EstadoAsunto })}>
                      {ESTADOS.map((e) => (
                        <option key={e} value={e}>
                          {ESTADO_ASUNTO[e].firma}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Vence" ayuda="Opcional. Un plazo que el cliente tenga que tener presente.">
                    <input type="date" className={claseInput} value={borrador.vence_en} onChange={(e) => cambiar({ vence_en: e.target.value })} />
                  </Campo>
                </div>
                <Campo etiqueta="Próximo paso" ayuda="Opcional. Qué sigue y quién lo hace.">
                  <input maxLength={300} className={claseInput} value={borrador.proximo_paso} onChange={(e) => cambiar({ proximo_paso: e.target.value })} />
                </Campo>
              </>
            )}
            <Campo
              etiqueta={esFirma ? 'Primera novedad' : 'Qué pasó'}
              ayuda={esFirma ? 'Opcional. Queda en el historial del asunto.' : 'Queda como primer mensaje del chat y le avisamos a FIRMA por mail.'}
            >
              <textarea required={!esFirma} maxLength={4000} className={claseTextarea} value={borrador.novedad} onChange={(e) => cambiar({ novedad: e.target.value })} />
            </Campo>
            {esFirma && borrador.novedad.trim() && (
              <label className="flex items-center gap-3 text-[15px] cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[#173A2F]" checked={borrador.avisar} onChange={(e) => cambiar({ avisar: e.target.checked })} />
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

        {(asuntos?.length ?? 0) > 0 && (
          <div className="grid gap-4 tab:grid-cols-2 max-w-[680px]">
            <Campo etiqueta="Buscar">
              <input className={claseInput} placeholder="Código o título, por ejemplo A-TB-001" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </Campo>
            {esFirma && orgs.length > 1 && (
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
            )}
          </div>
        )}

        {asuntos === null ? (
          <p className="eyebrow text-piedra">Cargando</p>
        ) : visibles.length === 0 && asuntos.length > 0 ? (
          <p className="text-sm text-piedra">No hay asuntos que coincidan con la búsqueda.</p>
        ) : visibles.length === 0 ? (
          <div className="flex flex-col gap-4 p-8 desk:p-10 max-w-[680px] bg-marfil-oscuro">
            <p className="h3">{esFirma ? 'Todavía no hay asuntos' : 'Todavía no tenés asuntos abiertos'}</p>
            <p className="text-[15px] leading-[1.6] text-piedra">
              {esFirma
                ? 'Creá el primero con Nuevo asunto. El cliente lo ve en esta sección y recibe las novedades por mail.'
                : 'Acá vas a ver los trámites que FIRMA lleva para tu empresa. Si tenés un conflicto con un cliente o con tu equipo, abrilo con Nuevo asunto.'}
            </p>
          </div>
        ) : (
          <>
            <ListaGrupo titulo="En curso" asuntos={abiertos} esFirma={esFirma} empresa={esFirma ? empresa : undefined} clientes={nombresCliente} />
            {cerrados.length > 0 && (
              <details className="group">
                <summary className="eyebrow text-piedra cursor-pointer select-none">Finalizados ({cerrados.length})</summary>
                <div className="pt-5">
                  <ListaGrupo asuntos={cerrados} esFirma={esFirma} empresa={esFirma ? empresa : undefined} clientes={nombresCliente} />
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </Marco>
  );
};

const ListaGrupo: React.FC<{ titulo?: string; asuntos: Asunto[]; esFirma: boolean; empresa?: (id: string) => string; clientes: Record<string, string> }> = ({
  titulo,
  asuntos,
  esFirma,
  empresa,
  clientes,
}) => (
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
                  {a.codigo && <span className="font-mono text-[12px] font-medium text-bosque bg-[#E4E9E3] px-2 py-0.5">{a.codigo}</span>}
                  <span className="eyebrow text-[11px] text-piedra">
                    {a.motivo ? MOTIVO_CONFLICTO[a.motivo].titulo : TIPO_ASUNTO[a.tipo]}
                    {empresa ? ` · ${empresa(a.organizacion_id)}` : ''}
                    {a.cliente_id && clientes[a.cliente_id] ? ` · ${clientes[a.cliente_id]}` : ''}
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
  const [cliente, setCliente] = useState<{ id: string; nombre: string; codigo: string | null; moneda: string } | null>(null);
  const [caso, setCaso] = useState<Caso | null>(null);
  const [otroPresente, setOtroPresente] = useState(false);
  const veCrm = permisosDe(perfil.rol).crm;
  const [edicion, setEdicion] = useState<{ titulo: string; proximo_paso: string; vence_en: string; tipo: TipoAsunto; motivo: MotivoConflicto | ''; cliente_id: string } | null>(null);
  const [clientesEmpresa, setClientesEmpresa] = useState<ClienteCrm[]>([]);
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
      const asu = a as Asunto;
      const [{ data: o }, { data: cl }, { data: k }] = await Promise.all([
        supabase.from('organizaciones').select('nombre').eq('id', asu.organizacion_id).maybeSingle(),
        asu.cliente_id ? supabase.from('crm_clientes').select('id, nombre, codigo, moneda').eq('id', asu.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
        // Sin la migración 0024 la columna no existe y la consulta falla: queda sin caso.
        supabase.from('crm_casos').select('*').eq('asunto_id', id).maybeSingle(),
      ]);
      setEmpresa((o?.nombre as string | undefined) ?? '');
      setCliente((cl as { id: string; nombre: string; codigo: string | null; moneda: string } | null) ?? null);
      setCaso((k as Caso | null) ?? null);
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

  async function editar() {
    if (!supabase || !asunto) return;
    setEdicion({
      titulo: asunto.titulo,
      proximo_paso: asunto.proximo_paso ?? '',
      vence_en: asunto.vence_en ?? '',
      tipo: asunto.tipo,
      motivo: asunto.motivo ?? '',
      cliente_id: asunto.cliente_id ?? '',
    });
    const { data } = await supabase.from('crm_clientes').select('id, nombre, codigo').eq('organizacion_id', asunto.organizacion_id).order('nombre');
    setClientesEmpresa((data as ClienteCrm[]) ?? []);
  }

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !asunto || !edicion) return;
    if (edicion.titulo.trim().length < 3) return setError('El título tiene que tener al menos 3 caracteres.');
    if (!caso && edicion.tipo === 'conflicto' && !edicion.motivo) return setError('Elegí el motivo del conflicto.');
    setOcupado('datos');
    setError(null);
    // Con caso de conflicto, tipo, motivo y cliente son los del caso y no se tocan.
    const clasificacion = caso
      ? {}
      : {
          tipo: edicion.tipo,
          motivo: edicion.tipo === 'conflicto' ? edicion.motivo || null : null,
          cliente_id: edicion.cliente_id || null,
        };
    const { error: e1 } = await supabase
      .from('asuntos')
      .update({ titulo: edicion.titulo.trim(), proximo_paso: edicion.proximo_paso.trim() || null, vence_en: edicion.vence_en || null, ...clasificacion })
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
            {asunto.codigo && <span className="font-mono text-[13px] font-medium text-bosque bg-[#E4E9E3] px-2 py-0.5">{asunto.codigo}</span>}
            <span className="text-[15px]">{asunto.motivo ? `${TIPO_ASUNTO[asunto.tipo]} · ${MOTIVO_CONFLICTO[asunto.motivo].titulo}` : TIPO_ASUNTO[asunto.tipo]}</span>
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
              {caso ? (
                <p className="text-xs text-piedra">Tipo, motivo y cliente son los del caso de conflicto y se mantienen.</p>
              ) : (
                <>
                  <Campo etiqueta="Tipo">
                    <select className={claseInput} value={edicion.tipo} onChange={(e) => setEdicion({ ...edicion, tipo: e.target.value as TipoAsunto, motivo: '' })}>
                      {Object.entries(TIPO_ASUNTO).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  {edicion.tipo === 'conflicto' && (
                    <Campo etiqueta="Motivo" ayuda="Un reembolso o contracargo se abre como caso desde CRM › Casos de conflicto, así cuenta en los indicadores.">
                      <select className={claseInput} value={edicion.motivo} onChange={(e) => setEdicion({ ...edicion, motivo: e.target.value as MotivoConflicto | '' })}>
                        <option value="">Elegí</option>
                        {MOTIVOS.filter((m) => !llevaCaso(m)).map((m) => (
                          <option key={m} value={m}>
                            {MOTIVO_CONFLICTO[m].titulo}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                  <Campo etiqueta="Cliente del CRM">
                    <select className={claseInput} value={edicion.cliente_id} onChange={(e) => setEdicion({ ...edicion, cliente_id: e.target.value })}>
                      <option value="">Sin cliente</option>
                      {clientesEmpresa.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                          {c.codigo ? ` · ${c.codigo}` : ''}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </>
              )}
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
                {cliente && (
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-1">Cliente</dt>
                    <dd>
                      {veCrm && !vista ? (
                        <Enlace a={`/portal/crm/${cliente.id}`} className="underline underline-offset-4 hover:text-bosque">
                          {cliente.nombre}
                        </Enlace>
                      ) : (
                        cliente.nombre
                      )}
                      {cliente.codigo ? <span className="text-piedra"> · {cliente.codigo}</span> : null}
                    </dd>
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
                  onClick={() => void editar()}
                >
                  Editar datos
                </Button>
              )}
            </>
          )}
          {caso && <BloqueCaso caso={caso} moneda={cliente?.moneda ?? 'USD'} puedeSeguir={veCrm} />}
        </aside>
      </div>
    </Marco>
  );
};

/* ------------------------------------------------------------------ */
/* Caso de conflicto del asunto                                         */
/* ------------------------------------------------------------------ */
const BloqueCaso: React.FC<{ caso: Caso; moneda: string; puedeSeguir: boolean }> = ({ caso, moneda, puedeSeguir }) => (
  <section className="flex flex-col gap-4 pt-5" style={{ borderTop: '1px solid rgba(27,31,27,0.15)' }}>
    <p className="eyebrow text-piedra">Caso de conflicto</p>
    <div className="flex flex-wrap gap-2">
      <Etiqueta tono={TONO_ETAPA[caso.etapa]}>{ROTULO_ETAPA[caso.etapa]}</Etiqueta>
      <Etiqueta tono={caso.semaforo === 'rojo' ? 'alerta' : caso.semaforo === 'ambar' ? 'tinta' : 'bosque'}>Semáforo {ROTULO_SEMAFORO[caso.semaforo].toLowerCase()}</Etiqueta>
    </div>
    {/* Lo que indica el protocolo de conflictos para el color del semáforo. */}
    <p className="text-[14px] leading-[1.5]">{AYUDA_SEMAFORO[caso.semaforo]}</p>
    <dl className="flex flex-col gap-3 text-[14px]">
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-1">Causa</dt>
        <dd>{ROTULO_CAUSA[caso.causa]}</dd>
      </div>
      {caso.monto_reclamado !== null && (
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-1">Monto reclamado</dt>
          <dd>{dinero(Number(caso.monto_reclamado), moneda)}</dd>
        </div>
      )}
      {caso.contracargo && (
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-1">Contracargo</dt>
          <dd>{ROTULO_RESULTADO[caso.contracargo_resultado ?? 'pendiente']}</dd>
        </div>
      )}
    </dl>
    <div className="flex flex-col gap-2 text-sm font-medium">
      {puedeSeguir && (
        <Enlace a={`/portal/crm/casos?caso=${caso.id}`} className="underline underline-offset-4 hover:text-bosque">
          Actualizar etapa, semáforo y decisión
        </Enlace>
      )}
      <a href="/protocolo-conflictos" target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-bosque">
        Qué indica el protocolo de conflictos
      </a>
    </div>
  </section>
);

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

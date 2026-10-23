import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, FileUp, Plus, RefreshCw, Send, ShieldCheck, Trash2, X } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Campo, Cifras, Encabezado, Enlace, Etiqueta, Interruptor, Marco, Pestanas, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { BotonCopiar } from '../crm/firma';
import { ESTADO_FIRMANTE, ESTADO_SOBRE, fechaHora } from '../../firma/comun';
import type { Organizacion, Perfil } from '../tipos';
import { BarraUso } from '../BarraUso';
import { diaYMes, firmasAgotadas, usoFirmas, whatsapp, type UsoFirmas } from '../planes';
import {
  COLUMNAS_FIRMANTE,
  ROTULO_EVENTO,
  descargarSobre,
  llamarSobres,
  peso,
  subirBorrador,
  type EventoFirma,
  type Firmante,
  type Sobre,
} from './api';

/**
 * Firma electrónica propia de FIRMA, dentro del portal.
 *   /portal/firmas         envíos
 *   /portal/firmas/nuevo   mandar un PDF a firmar
 *   /portal/firmas/<id>    seguimiento, registro y descargas
 */
export const Firmas: React.FC<{ perfil: Perfil; organizacion: Organizacion | null; ruta: string }> = ({ perfil, organizacion, ruta }) => {
  const resto = ruta.replace(/^\/portal\/firmas\/?/, '');
  return (
    <Marco perfil={perfil}>
      {resto === 'nuevo' ? <Nuevo perfil={perfil} organizacion={organizacion} /> : resto ? <Detalle id={resto} perfil={perfil} /> : <Listado perfil={perfil} organizacion={organizacion} />}
    </Marco>
  );
};

export default Firmas;

/** Cupo de documentos firmados del mes para la empresa. Sin plan con tope, null. */
function useCupoFirmas(orgId: string | null | undefined): UsoFirmas | null {
  const [uso, setUso] = useState<UsoFirmas | null>(null);
  useEffect(() => {
    if (orgId) void usoFirmas(orgId).then(setUso);
  }, [orgId]);
  return uso;
}

const AvisoCupo: React.FC<{ uso: UsoFirmas }> = ({ uso }) => (
  <div className="flex flex-col gap-4 max-w-[640px] bg-marfil-oscuro p-6 desk:p-8">
    <p className="h3">Usaste los {uso.limite} documentos firmados de este mes</p>
    <p className="text-[15px] leading-[1.6] text-piedra">
      Tu plan incluye {uso.limite} por mes. Vas a poder mandar nuevos envíos desde el {diaYMes(uso.hasta)}. Si necesitás uno antes, escribinos por WhatsApp. Los envíos en curso siguen
      su camino.
    </p>
    <a
      href={whatsapp('Hola Agustín, llegué al límite de documentos firmados de mi plan y necesito mandar otro.')}
      target="_blank"
      rel="noopener noreferrer"
      className="self-start inline-flex items-center gap-2 h-12 px-6 bg-bosque text-marfil font-medium text-[15px] hover:bg-bosque-dark transition-colors duration-150"
    >
      Escribir por WhatsApp
    </a>
  </div>
);

const claseBotonPrincipal = 'inline-flex items-center gap-2 h-[52px] px-6 text-[15px] font-medium bg-bosque text-marfil transition-colors duration-150 hover:bg-bosque-dark';

/* ==================================================================== */
/* Listado                                                                */
/* ==================================================================== */
type Filtro = 'en_curso' | 'completado' | 'cerrados' | 'todos';

const Listado: React.FC<{ perfil: Perfil; organizacion: Organizacion | null }> = ({ perfil, organizacion }) => {
  const vista = useVistaPrevia();
  const esAdmin = perfil.rol === 'admin' && !vista;
  const [sobres, setSobres] = useState<Sobre[] | null>(null);
  const [firmantes, setFirmantes] = useState<Firmante[]>([]);
  const [orgs, setOrgs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('en_curso');
  const cupo = useCupoFirmas(esAdmin ? null : vista?.orgId ?? organizacion?.id);
  const sinCupo = firmasAgotadas(cupo);

  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    (async () => {
      let consulta = supabase!.from('firma_sobres').select('*').order('creado_en', { ascending: false }).limit(300);
      if (vista) consulta = consulta.eq('organizacion_id', vista.orgId);
      const { data, error: e } = await consulta;
      if (!vivo) return;
      if (e) {
        setError(perfil.rol === 'admin' ? `${e.message}. Revisá que la migración 0010_firma_electronica.sql esté corrida en Supabase.` : 'No pudimos cargar los envíos. Probá recargar la página.');
        setSobres([]);
        return;
      }
      const lista = (data ?? []) as Sobre[];
      setSobres(lista);
      if (lista.length) {
        const { data: f } = await supabase!.from('firma_firmantes').select(COLUMNAS_FIRMANTE).in('sobre_id', lista.map((s) => s.id));
        if (vivo) setFirmantes((f ?? []) as unknown as Firmante[]);
      }
      if (esAdmin) {
        const { data: o } = await supabase!.from('organizaciones').select('id, nombre');
        if (vivo) setOrgs(Object.fromEntries((o ?? []).map((x) => [x.id as string, x.nombre as string])));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [esAdmin, perfil.rol, vista]);

  const porSobre = useMemo(() => {
    const m = new Map<string, Firmante[]>();
    for (const f of firmantes) m.set(f.sobre_id, [...(m.get(f.sobre_id) ?? []), f]);
    return m;
  }, [firmantes]);

  const todos = sobres ?? [];
  const cuenta = {
    en_curso: todos.filter((s) => s.estado === 'en_curso').length,
    completado: todos.filter((s) => s.estado === 'completado').length,
    cerrados: todos.filter((s) => ['rechazado', 'anulado', 'vencido'].includes(s.estado)).length,
  };
  const lista = todos.filter((s) =>
    filtro === 'todos' ? true : filtro === 'cerrados' ? ['rechazado', 'anulado', 'vencido'].includes(s.estado) : s.estado === filtro,
  );
  const vencenPronto = todos.filter((s) => s.estado === 'en_curso' && new Date(s.vence_en).getTime() - Date.now() < 3 * 86400000).length;

  return (
    <>
      <Encabezado
        eyebrow={esAdmin ? 'Firma electrónica · FIRMA' : `Firma electrónica · ${vista?.orgNombre ?? organizacion?.nombre ?? ''}`}
        titulo={
          <>
            Documentos <span className="text-bosque">a firma</span>
          </>
        }
        bajada="Mandá un PDF, cada persona lo firma desde su mail y recibís el documento firmado con su constancia."
        acciones={
          !vista && !sinCupo ? (
            <Enlace a="/portal/firmas/nuevo" className={claseBotonPrincipal}>
              <Plus size={18} aria-hidden="true" /> Nuevo envío
            </Enlace>
          ) : undefined
        }
      />

      <section className="wrap py-10 desk:py-14 flex flex-col gap-10">
        {cupo && cupo.limite !== null && (
          <BarraUso
            titulo="Documentos firmados este mes"
            usado={cupo.usados}
            incluido={cupo.limite}
            nota={`Cuentan los envíos que terminaron firmados. El cupo se renueva el ${diaYMes(cupo.hasta)}.`}
          />
        )}
        {sinCupo && cupo && <AvisoCupo uso={cupo} />}
        <Cifras
          cargando={sobres === null}
          items={[
            { titulo: 'En curso', valor: cuenta.en_curso },
            { titulo: 'Firmados', valor: cuenta.completado },
            { titulo: 'Vencen en 3 días', valor: vencenPronto, alerta: vencenPronto > 0 },
          ]}
        />

        {error && <Aviso tipo="error">{error}</Aviso>}

        <div className="flex flex-col gap-6">
          <Pestanas<Filtro>
            activa={filtro}
            alCambiar={setFiltro}
            items={[
              { clave: 'en_curso', titulo: 'En curso', cuenta: cuenta.en_curso },
              { clave: 'completado', titulo: 'Firmados', cuenta: cuenta.completado },
              { clave: 'cerrados', titulo: 'Cerrados', cuenta: cuenta.cerrados },
              { clave: 'todos', titulo: 'Todos', cuenta: todos.length },
            ]}
          />

          {sobres === null ? (
            <p className="eyebrow text-piedra">Cargando</p>
          ) : lista.length === 0 ? (
            <div className="bg-marfil-oscuro p-8 flex flex-col gap-3 max-w-[640px]">
              <p className="h3">{todos.length === 0 ? 'Todavía no mandaste nada a firmar' : 'No hay envíos en esta pestaña'}</p>
              {todos.length === 0 && !vista && !sinCupo && (
                <Enlace a="/portal/firmas/nuevo" className="text-sm font-medium underline underline-offset-4 self-start">
                  Mandar el primero
                </Enlace>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla tabla-media">
                <thead>
                  <tr>
                    <th>Documento</th>
                    {esAdmin && <th>Cliente</th>}
                    <th>Firmas</th>
                    <th>Estado</th>
                    <th>Enviado</th>
                    <th>Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((s) => {
                    const fs = porSobre.get(s.id) ?? [];
                    const firmaron = fs.filter((f) => f.estado === 'firmado').length;
                    const e = ESTADO_SOBRE[s.estado];
                    return (
                      <tr key={s.id} className="fila-link" onClick={() => navegar(`/portal/firmas/${s.id}`)}>
                        <td>
                          <Enlace a={`/portal/firmas/${s.id}`} className="font-medium hover:text-bosque">
                            {s.titulo}
                          </Enlace>
                          <div className="text-xs text-piedra mt-0.5 truncate max-w-[360px]">{fs.map((f) => f.nombre).join(', ')}</div>
                        </td>
                        {esAdmin && <td className="text-sm">{s.organizacion_id ? orgs[s.organizacion_id] ?? '·' : 'Propio de FIRMA'}</td>}
                        <td className="num">
                          {firmaron}/{fs.length}
                        </td>
                        <td>
                          <Etiqueta tono={s.error_sellado ? 'alerta' : e.tono}>{s.error_sellado && s.estado === 'en_curso' ? 'Armando PDF' : e.texto}</Etiqueta>
                        </td>
                        <td className="text-sm whitespace-nowrap">{new Date(s.creado_en).toLocaleDateString('es-AR')}</td>
                        <td className="text-sm whitespace-nowrap">{s.estado === 'en_curso' ? new Date(s.vence_en).toLocaleDateString('es-AR') : '·'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

/* ==================================================================== */
/* Nuevo envío                                                            */
/* ==================================================================== */
interface FilaFirmante {
  clave: string;
  nombre: string;
  email: string;
  pedir_documento: boolean;
}

const MAX_BYTES = 15 * 1024 * 1024;
const filaVacia = (): FilaFirmante => ({ clave: crypto.randomUUID(), nombre: '', email: '', pedir_documento: true });

const Nuevo: React.FC<{ perfil: Perfil; organizacion: Organizacion | null }> = ({ perfil, organizacion }) => {
  const vista = useVistaPrevia();
  const esAdmin = perfil.rol === 'admin';
  const [archivo, setArchivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [dias, setDias] = useState(15);
  const [secuencial, setSecuencial] = useState(false);
  const [filas, setFilas] = useState<FilaFirmante[]>([filaVacia()]);
  const [orgId, setOrgId] = useState('');
  const [orgs, setOrgs] = useState<{ id: string; nombre: string }[]>([]);
  const [mail, setMail] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cupo = useCupoFirmas(esAdmin ? null : organizacion?.id);

  useEffect(() => {
    void llamarSobres<{ mail: boolean }>({ accion: 'config' }).then((r) => setMail(r.ok ? r.datos.mail : null));
    if (esAdmin && supabase) {
      void supabase
        .from('organizaciones')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre')
        .then(({ data }) => setOrgs((data ?? []) as { id: string; nombre: string }[]));
    }
  }, [esAdmin]);

  if (vista) {
    return (
      <section className="wrap py-14">
        <Aviso>En Ver como no se pueden mandar documentos a firmar.</Aviso>
      </section>
    );
  }

  function elegir(a: File | undefined | null) {
    if (!a) return;
    setError(null);
    if (!/\.pdf$/i.test(a.name) && a.type !== 'application/pdf') return setError('Por ahora solo se firman PDF. Exportá el documento a PDF y subilo.');
    if (a.size > MAX_BYTES) return setError('El PDF tiene que pesar menos de 15 MB.');
    setArchivo(a);
    if (!titulo) setTitulo(a.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 200));
  }

  const cambiar = (clave: string, cambios: Partial<FilaFirmante>) => setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  const mover = (i: number, d: -1 | 1) =>
    setFilas((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const copia = [...fs];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!archivo) return setError('Subí el PDF que hay que firmar.');
    if (!titulo.trim()) return setError('Poné un título al envío.');
    const lista = filas.filter((f) => f.nombre.trim() || f.email.trim());
    if (lista.length === 0) return setError('Sumá al menos un firmante.');
    setEnviando(true);
    const subida = await subirBorrador(archivo, perfil.id);
    if ('error' in subida) {
      setEnviando(false);
      return setError(subida.error);
    }
    const r = await llamarSobres<{ id: string; avisos: string[] }>({
      accion: 'crear',
      borrador_ruta: subida.ruta,
      original_nombre: archivo.name,
      titulo,
      mensaje,
      secuencial,
      vence_dias: dias,
      organizacion_id: esAdmin ? orgId || null : undefined,
      firmantes: lista.map((f) => ({ nombre: f.nombre, email: f.email, pedir_documento: f.pedir_documento })),
    });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    try {
      if (r.datos.avisos?.length) window.sessionStorage.setItem(`firma-avisos-${r.datos.id}`, JSON.stringify(r.datos.avisos));
    } catch {
      /* sin almacenamiento, el detalle igual muestra los enlaces */
    }
    navegar(`/portal/firmas/${r.datos.id}`);
  }

  return (
    <>
      <Encabezado
        eyebrow={
          <Enlace a="/portal/firmas" className="inline-flex items-center gap-1.5 hover:text-tinta">
            <ArrowLeft size={14} aria-hidden="true" /> Firma electrónica
          </Enlace>
        }
        titulo={
          <>
            Nuevo envío <span className="text-bosque">a firma</span>
          </>
        }
        bajada="Cada firmante recibe un mail con su enlace personal y confirma su identidad con un código antes de firmar."
      />

      {firmasAgotadas(cupo) && cupo ? (
        <div className="wrap py-10 desk:py-14">
          <AvisoCupo uso={cupo} />
        </div>
      ) : (
        <form onSubmit={enviar} className="wrap py-10 desk:py-14 grid gap-12 desk:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] desk:items-start">
          <div className="flex flex-col gap-7">
            <p className="eyebrow text-piedra">1 · Documento</p>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                elegir(e.dataTransfer.files?.[0]);
              }}
              className="flex flex-col items-center justify-center gap-3 p-10 text-center border-2 border-dashed border-[rgba(27,31,27,0.25)] bg-white cursor-pointer hover:border-tinta transition-colors duration-150"
            >
              <FileUp size={28} aria-hidden="true" className="text-bosque" />
              <span className="font-medium break-all">{archivo ? archivo.name : 'Arrastrá el PDF o tocá para elegirlo'}</span>
              <span className="text-xs text-piedra">{archivo ? peso(archivo.size) : 'Hasta 15 MB, sin contraseña'}</span>
              <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => elegir(e.target.files?.[0])} />
            </label>

            <Campo etiqueta="Título">
              <input value={titulo} onChange={(e) => setTitulo(e.target.value.slice(0, 200))} className={claseInput} placeholder="Contrato de servicios con Juan Pérez" />
            </Campo>
            <Campo etiqueta="Mensaje para los firmantes" ayuda="Opcional. Va en el mail y arriba del documento.">
              <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value.slice(0, 2000))} rows={3} className={`${claseInput} h-auto py-3`} />
            </Campo>
            <div className="grid grid-cols-1 tab:grid-cols-2 gap-5">
              <Campo etiqueta="Plazo para firmar">
                <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={claseInput}>
                  {[3, 7, 15, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d} días
                    </option>
                  ))}
                </select>
              </Campo>
              {esAdmin && (
                <Campo etiqueta="En nombre de">
                  <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={claseInput}>
                    <option value="">FIRMA (envío propio)</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
            </div>
            {!esAdmin && organizacion && <p className="text-sm text-piedra">Los mails salen a nombre de {organizacion.nombre} vía FIRMA.</p>}
          </div>

          <div className="flex flex-col gap-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="eyebrow text-piedra">2 · Firmantes</p>
              <Interruptor activo={secuencial} alCambiar={setSecuencial} etiqueta="Firman en orden" ayuda="Cada uno recibe el mail cuando firmó el anterior." />
            </div>

            <ol className="flex flex-col gap-4">
              {filas.map((f, i) => (
                <li key={f.clave} className="bg-white border border-[rgba(27,31,27,0.14)] p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="eyebrow text-[11px] text-piedra">Firmante {i + 1}</span>
                    <div className="flex items-center gap-1">
                      {secuencial && (
                        <>
                          <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="w-8 h-8 inline-flex items-center justify-center hover:bg-marfil-oscuro disabled:opacity-30">
                            <ArrowUp size={15} aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => mover(i, 1)} disabled={i === filas.length - 1} aria-label="Bajar" className="w-8 h-8 inline-flex items-center justify-center hover:bg-marfil-oscuro disabled:opacity-30">
                            <ArrowDown size={15} aria-hidden="true" />
                          </button>
                        </>
                      )}
                      {filas.length > 1 && (
                        <button type="button" onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))} aria-label={`Quitar firmante ${i + 1}`} className="w-8 h-8 inline-flex items-center justify-center hover:bg-marfil-oscuro">
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 tab:grid-cols-2 gap-4">
                    <Campo etiqueta="Nombre y apellido">
                      <input value={f.nombre} onChange={(e) => cambiar(f.clave, { nombre: e.target.value.slice(0, 160) })} className={claseInput} autoComplete="off" />
                    </Campo>
                    <Campo etiqueta="Mail">
                      <input type="email" value={f.email} onChange={(e) => cambiar(f.clave, { email: e.target.value.trim() })} className={claseInput} autoComplete="off" />
                    </Campo>
                  </div>
                  <Interruptor activo={f.pedir_documento} alCambiar={(v) => cambiar(f.clave, { pedir_documento: v })} etiqueta="Pedir número de documento" />
                </li>
              ))}
            </ol>
            {filas.length < 20 && (
              <button type="button" onClick={() => setFilas((fs) => [...fs, filaVacia()])} className="inline-flex items-center gap-2 text-sm font-medium self-start hover:text-bosque">
                <Plus size={16} aria-hidden="true" /> Sumar firmante
              </button>
            )}

            {mail === false && (
              <Aviso>
                El envío de mails no está configurado. El envío se crea igual y copiás el enlace de cada firmante para mandarlo por otro medio, pero nadie va a poder pedir el código para firmar hasta que se configure.
              </Aviso>
            )}
            {error && <Aviso tipo="error">{error}</Aviso>}
            <Button type="submit" disabled={enviando} size="lg">
              <Send size={18} aria-hidden="true" /> {enviando ? 'Enviando' : 'Enviar a firmar'}
            </Button>
          </div>
        </form>
      )}
    </>
  );
};

/* ==================================================================== */
/* Detalle                                                                */
/* ==================================================================== */
const Detalle: React.FC<{ id: string; perfil: Perfil }> = ({ id, perfil }) => {
  const vista = useVistaPrevia();
  const soloLectura = Boolean(vista);
  const [sobre, setSobre] = useState<Sobre | null | undefined>(undefined);
  const [firmantes, setFirmantes] = useState<Firmante[]>([]);
  const [eventos, setEventos] = useState<EventoFirma[]>([]);
  const [cadena, setCadena] = useState<boolean | null>(null);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [avisos] = useState<string[]>(() => {
    try {
      const v = window.sessionStorage.getItem(`firma-avisos-${id}`);
      if (v) window.sessionStorage.removeItem(`firma-avisos-${id}`);
      return v ? (JSON.parse(v) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    (async () => {
      const { data: s } = await supabase!.from('firma_sobres').select('*').eq('id', id).maybeSingle();
      if (!vivo) return;
      setSobre((s as Sobre) ?? null);
      if (!s) return;
      const [{ data: f }, { data: ev }, { data: c }] = await Promise.all([
        supabase!.from('firma_firmantes').select(COLUMNAS_FIRMANTE).eq('sobre_id', id).order('orden').order('nombre'),
        supabase!.from('firma_eventos').select('*').eq('sobre_id', id).order('id', { ascending: false }),
        supabase!.rpc('firma_verificar_cadena', { p_sobre: id }),
      ]);
      if (!vivo) return;
      setFirmantes((f ?? []) as unknown as Firmante[]);
      setEventos((ev ?? []) as EventoFirma[]);
      setCadena(typeof c === 'boolean' ? c : null);
      if (s.estado === 'en_curso' && !vista) {
        const r = await llamarSobres<{ enlaces: { firmante_id: string; url: string }[] }>({ accion: 'enlaces', sobre_id: id });
        if (vivo && r.ok) setEnlaces(Object.fromEntries(r.datos.enlaces.map((x) => [x.firmante_id, x.url])));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, version, vista]);

  const nombres = useMemo(() => new Map(firmantes.map((f) => [f.id, f.nombre])), [firmantes]);

  async function accion(clave: string, cuerpo: Record<string, unknown>, exito: string, ruta?: string) {
    setOcupado(clave);
    setError(null);
    setOk(null);
    const r = await llamarSobres(cuerpo, ruta);
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    setOk(exito);
    setVersion((v) => v + 1);
  }

  async function bajar(cual: 'original' | 'final') {
    setOcupado(cual);
    setError(null);
    const fallo = await descargarSobre(id, cual);
    setOcupado(null);
    if (fallo) setError(fallo);
  }

  if (sobre === undefined) {
    return (
      <section className="wrap py-14">
        <p className="eyebrow text-piedra">Cargando</p>
      </section>
    );
  }
  if (sobre === null) {
    return (
      <section className="wrap py-14 flex flex-col gap-4">
        <Aviso tipo="error">No existe ese envío o no tenés acceso.</Aviso>
        <Enlace a="/portal/firmas" className="text-sm font-medium underline underline-offset-4 self-start">
          Volver a los envíos
        </Enlace>
      </section>
    );
  }

  const estado = ESTADO_SOBRE[sobre.estado];
  const enCurso = sobre.estado === 'en_curso';

  return (
    <>
      <Encabezado
        eyebrow={
          <Enlace a="/portal/firmas" className="inline-flex items-center gap-1.5 hover:text-tinta">
            <ArrowLeft size={14} aria-hidden="true" /> Firma electrónica · Código {sobre.codigo}
          </Enlace>
        }
        titulo={sobre.titulo}
        bajada={
          <span className="flex flex-wrap items-center gap-3">
            <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
            <span className="text-[15px]">
              {enCurso ? `Vence el ${fechaHora(sobre.vence_en)}` : sobre.completado_en ? `Firmado por todos el ${fechaHora(sobre.completado_en)}` : sobre.motivo_cierre ?? ''}
            </span>
          </span>
        }
        acciones={
          <>
            {sobre.estado === 'completado' && (
              <Button onClick={() => bajar('final')} disabled={ocupado === 'final'}>
                <ArrowDown size={17} aria-hidden="true" /> {ocupado === 'final' ? 'Preparando' : 'PDF firmado'}
              </Button>
            )}
            <Button variant="ghost" onClick={() => bajar('original')} disabled={ocupado === 'original'}>
              {ocupado === 'original' ? 'Preparando' : 'Original'}
            </Button>
          </>
        }
      />

      <section className="wrap py-10 desk:py-14 grid gap-12 desk:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)] desk:items-start">
        <div className="flex flex-col gap-8 min-w-0">
          {avisos.map((a) => (
            <Aviso key={a}>{a}</Aviso>
          ))}
          {sobre.error_sellado && enCurso && (
            <Aviso tipo="error">
              Firmaron todos, pero falta armar el PDF firmado. {sobre.error_sellado}.{' '}
              {perfil.rol === 'admin' && !soloLectura ? (
                <button
                  type="button"
                  className="font-medium underline underline-offset-4"
                  disabled={ocupado === 'resellar'}
                  onClick={() => accion('resellar', { accion: 'resellar', sobre_id: sobre.id }, 'Listo, se armó el PDF firmado.', '/api/firma/firmar')}
                >
                  {ocupado === 'resellar' ? 'Reintentando' : 'Reintentar ahora'}
                </button>
              ) : (
                'Se reintenta solo una vez por día.'
              )}
            </Aviso>
          )}
          {error && <Aviso tipo="error">{error}</Aviso>}
          {ok && <Aviso tipo="ok">{ok}</Aviso>}

          <div className="flex flex-col gap-4">
            <h2 className="h3">{sobre.secuencial ? 'Firmantes, en orden' : 'Firmantes'}</h2>
            <ul className="flex flex-col">
              {firmantes.map((f) => {
                const e = ESTADO_FIRMANTE[f.estado];
                const pendiente = enCurso && f.estado !== 'firmado' && f.estado !== 'rechazado';
                return (
                  <li key={f.id} className="py-4 flex flex-wrap items-start justify-between gap-4" style={{ borderTop: '1px solid rgba(27,31,27,0.12)' }}>
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-medium">
                        {sobre.secuencial && <span className="tabular-nums text-piedra mr-2">{f.orden}.</span>}
                        {f.nombre}
                      </span>
                      <span className="text-sm text-piedra break-all">{f.email}</span>
                      <span className="text-xs text-piedra">
                        {f.firmado_en
                          ? `Firmó el ${fechaHora(f.firmado_en)}${f.documento ? ` · Doc. ${f.documento}` : ''}${f.ip ? ` · IP ${f.ip}` : ''}`
                          : f.rechazado_en
                            ? `Rechazó el ${fechaHora(f.rechazado_en)}. ${f.motivo_rechazo ?? ''}`
                            : f.visto_en
                              ? `Lo abrió el ${fechaHora(f.visto_en)}`
                              : f.notificado_en
                                ? `Mail enviado el ${fechaHora(f.ultimo_recordatorio ?? f.notificado_en)}`
                                : 'Todavía no le llegó el mail'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
                      {pendiente && !soloLectura && enlaces[f.id] && <BotonCopiar texto={enlaces[f.id]} descripcion={`Copiar el enlace de ${f.nombre}`} />}
                      {pendiente && !soloLectura && (
                        <button
                          type="button"
                          title="Reenviar el mail"
                          aria-label={`Reenviar el mail a ${f.nombre}`}
                          disabled={ocupado === f.id}
                          onClick={() => accion(f.id, { accion: 'recordar', firmante_id: f.id }, `Le reenviamos el mail a ${f.nombre}.`)}
                          className="inline-flex items-center justify-center w-9 h-9 border border-[rgba(27,31,27,0.22)] bg-white hover:border-tinta disabled:opacity-50"
                        >
                          <RefreshCw size={15} aria-hidden="true" className={ocupado === f.id ? 'animate-spin' : ''} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="h3">Registro</h2>
              {cadena !== null && (
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${cadena ? 'text-bosque' : 'text-[#8a2b20]'}`}>
                  {cadena ? <ShieldCheck size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                  {cadena ? 'Cadena íntegra' : 'La cadena no cierra'}
                </span>
              )}
            </div>
            <ol className="flex flex-col text-sm">
              {eventos.map((ev) => (
                <li key={ev.id} className="py-2.5 grid grid-cols-[minmax(130px,auto)_1fr] gap-x-4" style={{ borderTop: '1px solid rgba(27,31,27,0.08)' }}>
                  <span className="text-piedra tabular-nums text-xs pt-0.5">{new Date(ev.creado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' })}</span>
                  <span>
                    {ROTULO_EVENTO[ev.tipo] ?? ev.tipo}
                    {ev.firmante_id && nombres.get(ev.firmante_id) ? ` · ${nombres.get(ev.firmante_id)}` : ''}
                    {ev.ip ? <span className="text-piedra"> · IP {ev.ip}</span> : null}
                    {ev.tipo === 'error_mail' && typeof ev.detalle.motivo === 'string' ? <span className="block text-xs text-[#8a2b20]">{ev.detalle.motivo}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="flex flex-col gap-6 desk:sticky desk:top-28">
          <div className="bg-white border border-[rgba(27,31,27,0.14)] p-6 flex flex-col gap-3 text-sm">
            <span className="eyebrow text-[11px] text-piedra">Documento</span>
            <span className="font-medium break-all">{sobre.original_nombre}</span>
            <span className="text-piedra">
              {sobre.original_paginas} {sobre.original_paginas === 1 ? 'hoja' : 'hojas'} · {peso(sobre.original_bytes)}
            </span>
            <span className="text-xs text-piedra break-all">SHA-256 original {sobre.original_sha256}</span>
            {sobre.final_sha256 && <span className="text-xs text-piedra break-all">SHA-256 firmado {sobre.final_sha256}</span>}
            <a href={`/verificar/${sobre.codigo}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium mt-1 hover:text-bosque">
              <ArrowUpRight size={15} aria-hidden="true" /> Página de verificación
            </a>
          </div>

          {sobre.mensaje && (
            <div className="flex flex-col gap-2 text-sm">
              <span className="eyebrow text-[11px] text-piedra">Mensaje</span>
              <p className="whitespace-pre-line leading-[1.6]">{sobre.mensaje}</p>
            </div>
          )}

          {enCurso && !soloLectura && (
            <div className="flex flex-col gap-3">
              {!anulando ? (
                <button type="button" onClick={() => setAnulando(true)} className="text-sm text-piedra underline underline-offset-4 self-start hover:text-tinta">
                  Anular el envío
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void accion('anular', { accion: 'anular', sobre_id: sobre.id, motivo }, 'El envío quedó anulado y avisamos a quienes ya lo habían recibido.').then(() => setAnulando(false));
                  }}
                  className="bg-marfil-oscuro p-5 flex flex-col gap-3"
                >
                  <Campo etiqueta="Motivo" ayuda="Queda en el registro. Los enlaces dejan de funcionar.">
                    <input value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 500))} className={claseInput} />
                  </Campo>
                  <div className="flex gap-3">
                    <Button type="submit" variant="dark" size="sm" disabled={ocupado === 'anular' || motivo.trim().length < 3}>
                      Anular
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAnulando(false)}>
                      Volver
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </aside>
      </section>
    </>
  );
};

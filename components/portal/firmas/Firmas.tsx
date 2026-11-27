import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, FileUp, Pencil, Plus, RefreshCw, Send, ShieldCheck, Trash2, X } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Campo, Cifras, Encabezado, Enlace, Etiqueta, Interruptor, Marco, Pestanas, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { BotonCopiar } from '../crm/firma';
import { ESTADO_FIRMANTE, ESTADO_SOBRE, fechaHora } from '../../firma/comun';
import { generaContratos, type Organizacion, type Perfil } from '../tipos';
import { CARGOS_ESTANDAR, ROLES_ELEGIBLES, ROL_COMERCIAL, cargoNormal, rolDe, type IntegranteEquipo, type RolComercial } from '../crm/tipos';
import { BarraUso } from '../BarraUso';
import { diaYMes, firmasAgotadas, firmasOcupadas, usoFirmas, whatsapp, type UsoFirmas } from '../planes';
import { registrarLectura } from '../lecturas';
import { mensajeAmable } from '../errores';
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
import { claseBotonHero } from '../../Button';

/**
 * Firma electrónica propia de FIRMA, dentro del portal.
 *   /portal/firmas         envíos
 *   /portal/firmas/nuevo   mandar un PDF a firmar
 *   /portal/firmas/<id>    seguimiento, registro y descargas
 */
/** Valor del desplegable para escribir a mano a alguien que no está en el equipo. */
const OTRA_PERSONA = 'otra';

/** Filtro de FIRMA por cliente: todos, los envíos propios de FIRMA o los de una empresa. */
const PROPIOS = 'propios';
/** La empresa con la que se abre la lista, cuando se llega desde Administración › Clientes (?empresa=). */
const empresaInicial = (): string => new URLSearchParams(window.location.search).get('empresa') || 'todas';

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
    <p className="h3">Llegaste a los {uso.limite} documentos de este mes</p>
    <p className="text-[15px] leading-[1.6] text-piedra">
      Tu plan incluye {uso.limite} documentos firmados por mes y los envíos en curso reservan su lugar. Vas a poder mandar nuevos desde el {diaYMes(uso.hasta)}, o antes si se anula o vence
      alguno de los que están en curso. Si necesitás uno ya, escribinos por WhatsApp.
    </p>
    <a
      href={whatsapp('Hola Agustín, llegué al límite de documentos firmados de mi plan y necesito mandar otro.')}
      target="_blank"
      rel="noopener noreferrer"
      className={`${claseBotonHero('primary', 'lg')} self-start`}
    >
      Escribir por WhatsApp
    </a>
  </div>
);

const claseBotonPrincipal = claseBotonHero('primary', 'lg');

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
  const [filtroOrg, setFiltroOrg] = useState(empresaInicial);
  const [busqueda, setBusqueda] = useState('');
  // Orden por fecha de envío: primero los más recientes, o primero los más antiguos.
  const [recientesPrimero, setRecientesPrimero] = useState(true);
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

  // La empresa y la búsqueda se aplican primero, así las cifras y las pestañas cuentan lo que se está viendo.
  const q = busqueda.trim().toLowerCase();
  const todos = (sobres ?? []).filter((s) => {
    if (esAdmin && filtroOrg !== 'todas' && (filtroOrg === PROPIOS ? s.organizacion_id !== null : s.organizacion_id !== filtroOrg)) return false;
    return !q || s.titulo.toLowerCase().includes(q) || (porSobre.get(s.id) ?? []).some((f) => f.nombre.toLowerCase().includes(q));
  });
  const hayFiltros = q !== '' || (esAdmin && filtroOrg !== 'todas');
  const cuenta = {
    en_curso: todos.filter((s) => s.estado === 'en_curso').length,
    completado: todos.filter((s) => s.estado === 'completado').length,
    cerrados: todos.filter((s) => ['rechazado', 'anulado', 'vencido'].includes(s.estado)).length,
  };
  const lista = todos
    .filter((s) => (filtro === 'todos' ? true : filtro === 'cerrados' ? ['rechazado', 'anulado', 'vencido'].includes(s.estado) : s.estado === filtro))
    .sort((a, b) => (new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime()) * (recientesPrimero ? -1 : 1));
  const vencenPronto = todos.filter((s) => s.estado === 'en_curso' && new Date(s.vence_en).getTime() - Date.now() < 3 * 86400000).length;

  return (
    <>
      <Encabezado
        eyebrow={esAdmin ? 'Firmas · FIRMA' : `Firmas · ${vista?.orgNombre ?? organizacion?.nombre ?? ''}`}
        titulo={
          <>
            Mandá a firmar <span className="text-bosque whitespace-nowrap">en un minuto.</span>
          </>
        }
        bajada="Subí el PDF, sumá a quién firma y listo. Cada persona firma desde su mail y vos recibís el documento sellado con su constancia."
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
            titulo="Documentos de este mes"
            usado={firmasOcupadas(cupo)}
            incluido={cupo.limite}
            nota={`${cupo.usados} ${cupo.usados === 1 ? 'firmado' : 'firmados'}${cupo.en_curso ? ` y ${cupo.en_curso} en curso, que reservan su lugar` : ''}. Un envío anulado o vencido libera el lugar. El cupo se renueva el ${diaYMes(cupo.hasta)}.`}
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
          <div className="flex flex-wrap items-end gap-3">
            {esAdmin && (
              <select className={`${claseInput} !w-auto min-w-[220px]`} value={filtroOrg} onChange={(e) => setFiltroOrg(e.target.value)} aria-label="Filtrar por cliente">
                <option value="todas">Todos los clientes</option>
                <option value={PROPIOS}>Propios de FIRMA</option>
                {Object.entries(orgs)
                  .sort((a, b) => a[1].localeCompare(b[1], 'es'))
                  .map(([id, nombre]) => (
                    <option key={id} value={id}>
                      {nombre}
                    </option>
                  ))}
              </select>
            )}
            <input className={`${claseInput} !w-full tab:!w-72`} placeholder="Buscar por documento o firmante" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar envíos" />
          </div>
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
              <p className="h3">{(sobres ?? []).length === 0 ? 'Todavía no mandaste nada a firmar' : hayFiltros ? 'No hay envíos con ese filtro' : 'No hay envíos en esta pestaña'}</p>
              {(sobres ?? []).length === 0 && !vista && !sinCupo && (
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
                    <th aria-sort={recientesPrimero ? 'descending' : 'ascending'}>
                      <button
                        type="button"
                        onClick={() => setRecientesPrimero((v) => !v)}
                        title={recientesPrimero ? 'Ordenar del más antiguo al más reciente' : 'Ordenar del más reciente al más antiguo'}
                        className="inline-flex items-center gap-1 font-medium hover:text-tinta transition-colors duration-150"
                      >
                        Enviado
                        {recientesPrimero ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" />}
                      </button>
                    </th>
                    <th>Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((s) => {
                    const fs = porSobre.get(s.id) ?? [];
                    const firmaron = fs.filter((f) => f.estado === 'firmado').length;
                    const e = ESTADO_SOBRE[s.estado];
                    return (
                      <tr key={s.id} className="fila-link" onClick={(e) => !(e.target as HTMLElement).closest('a, button') && navegar(`/portal/firmas/${s.id}`)}>
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
/** Cliente del CRM para vincular un envío. Si es una empresa, firma su representante. */
interface ClienteVinculable {
  id: string;
  nombre: string;
  representante: string | null;
  codigo: string | null;
  email: string | null;
}

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
  const [entrega, setEntrega] = useState<'mail' | 'enlace'>('mail');
  const [filas, setFilas] = useState<FilaFirmante[]>([filaVacia()]);
  const [orgId, setOrgId] = useState('');
  const [orgs, setOrgs] = useState<{ id: string; nombre: string }[]>([]);
  const [mail, setMail] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cupo = useCupoFirmas(esAdmin ? null : organizacion?.id);
  const [clientesCrm, setClientesCrm] = useState<ClienteVinculable[]>([]);
  const [clienteCrm, setClienteCrm] = useState('');
  const [equipo, setEquipo] = useState<IntegranteEquipo[]>([]);
  const [miembro, setMiembro] = useState('');
  // Fecha en que termina el contrato de esa persona. No es el plazo para firmar.
  const [venceContrato, setVenceContrato] = useState('');
  // Con OTRA_PERSONA: alguien que todavía no está en el equipo. Se suma al enviar, sin cuenta en el portal.
  const [personaNueva, setPersonaNueva] = useState('');
  const [rolNuevo, setRolNuevo] = useState<RolComercial>('otro');
  // Con el rol «otro»: el rol escrito a mano (Nutricionista, Editor).
  const [cargoNuevo, setCargoNuevo] = useState('');
  const orgEnvio = esAdmin ? orgId : organizacion?.id ?? '';
  const puedeEquipo = generaContratos(perfil);

  // Equipo activo de la empresa, para atar el contrato a una persona y que salga en Contratos con tu equipo.
  useEffect(() => {
    setMiembro('');
    if (!supabase || !orgEnvio || !puedeEquipo) return setEquipo([]);
    let vigente = true;
    void supabase
      .from('equipo_miembros')
      .select('*')
      .eq('organizacion_id', orgEnvio)
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        if (vigente) setEquipo((data ?? []) as IntegranteEquipo[]);
      });
    return () => {
      vigente = false;
    };
  }, [orgEnvio, puedeEquipo]);

  // Clientes del CRM de la empresa, para vincular el envío y que la ficha pase sola a Firmado.
  useEffect(() => {
    setClienteCrm('');
    if (!supabase || !orgEnvio) return setClientesCrm([]);
    let vigente = true;
    void supabase
      .from('crm_clientes')
      .select('id, nombre, representante, codigo, email')
      .eq('organizacion_id', orgEnvio)
      .neq('estado_firma', 'Baja')
      .order('nombre')
      .then(({ data }) => {
        if (vigente) setClientesCrm((data ?? []) as ClienteVinculable[]);
      });
    return () => {
      vigente = false;
    };
  }, [orgEnvio]);

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

  /** Con un solo firmante vacío, se propone a la persona elegida. */
  function proponer(nombre: string, email: string | null) {
    if (filas.length === 1 && !filas[0].nombre.trim() && !filas[0].email.trim()) cambiar(filas[0].clave, { nombre, email: email ?? '' });
  }

  function vincularEquipo(id: string) {
    setMiembro(id);
    if (!id) setVenceContrato('');
    // Un envío va atado al CRM o al equipo, no a los dos.
    if (id) setClienteCrm('');
    const m = equipo.find((x) => x.id === id);
    if (m) proponer(m.nombre, m.email);
  }

  function vincular(id: string) {
    setClienteCrm(id);
    if (id) {
      setMiembro('');
      setVenceContrato('');
    }
    // Con un solo firmante vacío, se propone el cliente elegido.
    const c = clientesCrm.find((x) => x.id === id);
    if (c) proponer(c.representante || c.nombre, c.email);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!archivo) return setError('Subí el PDF que hay que firmar.');
    if (!titulo.trim()) return setError('Poné un título al envío.');
    if (miembro === OTRA_PERSONA && personaNueva.trim().length < 2) return setError('Escribí el nombre completo de la persona del equipo.');
    const lista = filas.filter((f) => f.nombre.trim() || f.email.trim());
    if (lista.length === 0) return setError('Sumá al menos un firmante.');
    setEnviando(true);
    const subida = await subirBorrador(archivo, perfil.id);
    if ('error' in subida) {
      setEnviando(false);
      return setError(subida.error);
    }
    // Alguien que no está en el equipo se suma ahora. Si ya hay alguien con ese nombre, se usa ese.
    let miembroId = miembro;
    if (miembro === OTRA_PERSONA) {
      const { data: idNuevo, error: eq } = supabase ? await supabase.rpc('equipo_sumar', { org: orgEnvio, nombre: personaNueva.trim(), rol: rolNuevo, ...(rolNuevo === 'otro' && cargoNuevo.trim() ? { cargo: cargoNormal(cargoNuevo) } : {}) }) : { data: null, error: null };
      if (eq || !idNuevo) {
        setEnviando(false);
        return setError(mensajeAmable(eq, 'No se pudo sumar a la persona al equipo.'));
      }
      miembroId = idNuevo as string;
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
      crm_cliente_id: clienteCrm || undefined,
      equipo_miembro_id: miembroId || undefined,
      entrega,
      firmantes: lista.map((f) => ({ nombre: f.nombre, email: f.email, pedir_documento: f.pedir_documento })),
    });
    // El vencimiento del contrato se carga aparte (migración 0068): si falla, el envío ya salió y se carga desde Documentos.
    let sinVencimiento = false;
    if (r.ok && miembro && venceContrato && supabase) {
      const { error: e } = await supabase.rpc('firma_sobre_vencimiento', { p_sobre: r.datos.id, p_fecha: venceContrato });
      sinVencimiento = Boolean(e);
    }
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    try {
      if (sinVencimiento) r.datos.avisos = [...(r.datos.avisos ?? []), 'El vencimiento del contrato no se pudo guardar. Cargalo desde Documentos › Contratos con tu equipo.'];
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
            Enviá un documento <span className="text-bosque whitespace-nowrap">a firmar.</span>
          </>
        }
        bajada="Tres pasos. Subí el PDF, sumá a quién firma y elegí cómo le llega. Cada firmante confirma su identidad con un código antes de firmar."
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
              className="flex flex-col items-center justify-center gap-3 p-10 text-center border-2 border-dashed border-tinta/25 bg-white cursor-pointer hover:border-tinta transition-colors duration-150"
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
            {clientesCrm.length > 0 && (
              <Campo etiqueta="Cliente del CRM (opcional)" ayuda="Si es el contrato de un cliente del CRM, vinculalo. Cuando firman todos, el cliente pasa solo a Firmado y la ficha muestra el seguimiento.">
                <select value={clienteCrm} onChange={(e) => vincular(e.target.value)} className={claseInput}>
                  <option value="">Sin vincular</option>
                  {clientesCrm.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.codigo ? ` · ${c.codigo}` : ''}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            {puedeEquipo && Boolean(orgEnvio) && (
              <Campo etiqueta="Persona del equipo (opcional)" ayuda="Si es el contrato de alguien de tu equipo, vinculalo. Queda en Documentos › Contratos con tu equipo, con su estado y el PDF firmado.">
                <select value={miembro} onChange={(e) => vincularEquipo(e.target.value)} className={claseInput}>
                  <option value="">Sin vincular</option>
                  {equipo.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} · {rolDe(m)}
                    </option>
                  ))}
                  <option value={OTRA_PERSONA}>Otra persona (escribir el nombre)</option>
                </select>
              </Campo>
            )}
            {miembro === OTRA_PERSONA && (
              <div className="grid gap-5 tab:grid-cols-2">
                <Campo etiqueta="Nombre completo" ayuda="Queda en tu equipo, sin cuenta en el portal. Si ya hay alguien con ese nombre, se usa esa persona.">
                  <input value={personaNueva} onChange={(e) => setPersonaNueva(e.target.value)} maxLength={120} className={claseInput} placeholder="Santiago Ávalos" />
                </Campo>
                <Campo etiqueta="Rol">
                  <select value={rolNuevo} onChange={(e) => setRolNuevo(e.target.value as RolComercial)} className={claseInput}>
                    {ROLES_ELEGIBLES.map((r) => (
                      <option key={r} value={r}>
                        {ROL_COMERCIAL[r]}
                      </option>
                    ))}
                  </select>
                </Campo>
                {rolNuevo === 'otro' && (
                  <Campo etiqueta="¿Qué rol tiene?" ayuda="Sale al lado de su nombre en la tarjeta del contrato.">
                    <input value={cargoNuevo} onChange={(e) => setCargoNuevo(e.target.value)} maxLength={60} className={claseInput} list="cargos-estandar" placeholder="Nutricionista" />
                <datalist id="cargos-estandar">{CARGOS_ESTANDAR.map((c) => <option key={c} value={c} />)}</datalist>
                  </Campo>
                )}
              </div>
            )}
            {miembro && (
              <Campo etiqueta="Vencimiento del contrato (opcional)" ayuda="El día en que termina el contrato, no el plazo para firmar. Sale en la tarjeta de la persona y se puede cambiar después.">
                <input type="date" value={venceContrato} onChange={(e) => setVenceContrato(e.target.value)} className={claseInput} />
              </Campo>
            )}
            {!esAdmin && organizacion && <p className="text-sm text-piedra">Los mails salen a nombre de {organizacion.nombre} vía FIRMA.</p>}
          </div>

          <div className="flex flex-col gap-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="eyebrow text-piedra">2 · Firmantes</p>
              <Interruptor
                activo={secuencial}
                alCambiar={setSecuencial}
                etiqueta="Firman en orden"
                ayuda={entrega === 'enlace' ? 'Cada uno puede firmar cuando firmó el anterior.' : 'Cada uno recibe el mail cuando firmó el anterior.'}
              />
            </div>

            <ol className="flex flex-col gap-4">
              {filas.map((f, i) => (
                <li key={f.clave} className="bg-white border border-tinta/14 p-5 flex flex-col gap-4">
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

            <fieldset className="flex flex-col gap-3">
              <legend className="eyebrow text-piedra mb-3">3 · Cómo les llega</legend>
              {(
                [
                  ['mail', 'Por mail', 'Le mandamos el enlace a cada firmante y confirma con un código antes de firmar.'],
                  ['enlace', 'Compartir el enlace', 'No sale ningún mail. Copiás el enlace de cada firmante y se lo pasás vos, por ejemplo en el onboarding. Firma sin código.'],
                ] as const
              ).map(([clave, rotulo, ayuda]) => (
                <label
                  key={clave}
                  className={`flex items-start gap-3 p-4 border cursor-pointer ${entrega === clave ? 'border-tinta bg-white' : 'border-tinta/18 hover:border-tinta'}`}
                >
                  <input type="radio" name="entrega" checked={entrega === clave} onChange={() => setEntrega(clave)} className="mt-1 w-4 h-4 accent-bosque shrink-0" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{rotulo}</span>
                    <span className="text-xs text-piedra leading-[1.5]">{ayuda}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {mail === false && entrega === 'mail' && (
              <Aviso>
                El envío de mails no está configurado. El envío se crea igual y copiás el enlace de cada firmante para mandarlo por otro medio, pero nadie va a poder pedir el código para firmar hasta que se configure.
              </Aviso>
            )}
            {error && <Aviso tipo="error">{error}</Aviso>}
            <Button type="submit" disabled={enviando} size="lg">
              <Send size={18} aria-hidden="true" /> {enviando ? 'Creando' : entrega === 'enlace' ? 'Crear los enlaces' : 'Enviar a firmar'}
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
  const [extendiendo, setExtendiendo] = useState(false);
  const [diasExtra, setDiasExtra] = useState(15);
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevoEmail, setNuevoEmail] = useState('');
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
      registrarLectura('firma_sobre', id);
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

  // Plazo nuevo desde hoy. Uno vencido se reabre con las firmas que ya tenía.
  async function extender() {
    if (!sobre) return;
    setOcupado('extender');
    setError(null);
    setOk(null);
    const r = await llamarSobres<{ vence_en: string; avisados: number; aviso?: string }>({ accion: 'extender', sobre_id: sobre.id, dias: diasExtra });
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    const { vence_en, avisados, aviso } = r.datos;
    setOk(aviso ?? `Listo, ahora vence el ${fechaHora(vence_en)}.${avisados ? ` Le avisamos por mail a ${avisados === 1 ? 'quien falta firmar' : 'quienes faltan firmar'}.` : ''}`);
    setExtendiendo(false);
    setVersion((v) => v + 1);
  }

  // Pensado para los envíos de prueba: se va todo, también el registro de eventos y los PDF.
  async function eliminar() {
    if (!sobre) return;
    const firmado = sobre.estado === 'completado' ? ' Ya está firmado: se pierde el PDF firmado y su constancia, y el código de verificación deja de andar.' : '';
    if (!window.confirm(`¿Eliminar «${sobre.titulo}»? Se borran el documento, los firmantes y el registro de eventos.${firmado} Usalo solo para envíos de prueba. No se puede deshacer.`)) return;
    setOcupado('eliminar');
    setError(null);
    setOk(null);
    const r = await llamarSobres({ accion: 'eliminar', sobre_id: sobre.id });
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    navegar('/portal/firmas');
  }

  async function corregirEmail(f: Firmante) {
    setOcupado(`email-${f.id}`);
    setError(null);
    setOk(null);
    const r = await llamarSobres<{ invitado: boolean; aviso?: string }>({ accion: 'corregir_email', firmante_id: f.id, email: nuevoEmail });
    setOcupado(null);
    if (!r.ok) return setError(r.error);
    setEditando(null);
    if (r.datos.aviso) setError(r.datos.aviso);
    else
      setOk(
        r.datos.invitado
          ? `Corregimos el mail de ${f.nombre} y le mandamos la invitación. El enlace anterior ya no funciona.`
          : `Corregimos el mail de ${f.nombre}. El enlace anterior ya no funciona${sobre?.entrega === 'enlace' ? ', copiá el nuevo' : ''}.`,
      );
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
  const porEnlace = sobre.entrega === 'enlace';
  // Por enlace nadie pasa a notificado: a quien le toca firmar se lo muestra como pendiente, no esperando turno.
  const faltan = firmantes.filter((f) => f.estado !== 'firmado' && f.estado !== 'rechazado');
  const primero = Math.min(...faltan.map((f) => f.orden));
  const turno = new Set(faltan.filter((f) => !sobre.secuencial || f.orden === primero).map((f) => f.id));

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
            {porEnlace && enCurso && !soloLectura && (
              <p className="text-sm text-piedra leading-[1.6]">
                Va por enlace: no salió ningún mail. Copiá el enlace de cada firmante y pasáselo. Firma sin código, así que mandáselo solo a esa persona.
              </p>
            )}
            <ul className="flex flex-col">
              {firmantes.map((f) => {
                const e = ESTADO_FIRMANTE[f.estado];
                const pendiente = enCurso && f.estado !== 'firmado' && f.estado !== 'rechazado';
                return (
                  <li key={f.id} className="py-4 flex flex-wrap items-start justify-between gap-4 border-t border-tinta/12">
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
                                : porEnlace
                                  ? 'Todavía no abrió el enlace'
                                  : 'Todavía no le llegó el mail'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Etiqueta tono={e.tono}>{porEnlace && f.estado === 'pendiente' && turno.has(f.id) ? ESTADO_FIRMANTE.notificado.texto : e.texto}</Etiqueta>
                      {pendiente && !soloLectura && enlaces[f.id] && <BotonCopiar texto={enlaces[f.id]} descripcion={`Copiar el enlace de ${f.nombre}`} />}
                      {pendiente && !soloLectura && (
                        <button
                          type="button"
                          title="Corregir el mail"
                          aria-label={`Corregir el mail de ${f.nombre}`}
                          aria-expanded={editando === f.id}
                          onClick={() => {
                            setEditando(editando === f.id ? null : f.id);
                            setNuevoEmail(f.email);
                          }}
                          className="inline-flex items-center justify-center w-9 h-9 border border-tinta/22 bg-white hover:border-tinta"
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                      )}
                      {pendiente && !soloLectura && (
                        <button
                          type="button"
                          title={f.notificado_en ? 'Reenviar el mail' : 'Mandarle el enlace por mail'}
                          aria-label={`${f.notificado_en ? 'Reenviar el mail' : 'Mandarle el enlace por mail'} a ${f.nombre}`}
                          disabled={ocupado === f.id}
                          onClick={() => accion(f.id, { accion: 'recordar', firmante_id: f.id }, `Le mandamos el mail a ${f.nombre}.`)}
                          className="inline-flex items-center justify-center w-9 h-9 border border-tinta/22 bg-white hover:border-tinta disabled:opacity-50"
                        >
                          <RefreshCw size={15} aria-hidden="true" className={ocupado === f.id ? 'animate-spin' : ''} />
                        </button>
                      )}
                    </div>
                    {pendiente && !soloLectura && editando === f.id && (
                      <form
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          void corregirEmail(f);
                        }}
                        className="w-full bg-marfil-oscuro p-5 flex flex-col gap-3"
                      >
                        <Campo
                          etiqueta={`Mail de ${f.nombre}`}
                          ayuda={porEnlace ? 'El enlace anterior deja de funcionar. Copiá el nuevo y pasáselo.' : 'El enlace anterior deja de funcionar. Si ya le toca firmar, le mandamos la invitación al mail nuevo.'}
                        >
                          <input type="email" autoFocus value={nuevoEmail} onChange={(ev) => setNuevoEmail(ev.target.value.slice(0, 200))} className={claseInput} />
                        </Campo>
                        <div className="flex gap-3">
                          <Button type="submit" variant="dark" size="sm" disabled={ocupado === `email-${f.id}` || !nuevoEmail.trim() || nuevoEmail.trim().toLowerCase() === f.email.toLowerCase()}>
                            {ocupado === `email-${f.id}` ? 'Guardando' : 'Guardar'}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(null)}>
                            Volver
                          </Button>
                        </div>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="h3">Registro</h2>
              {cadena !== null && (
                <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${cadena ? 'text-bosque' : 'text-peligro'}`}>
                  {cadena ? <ShieldCheck size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                  {cadena ? 'Cadena íntegra' : 'La cadena no cierra'}
                </span>
              )}
            </div>
            <ol className="flex flex-col text-sm">
              {eventos.map((ev) => (
                <li key={ev.id} className="py-2.5 grid grid-cols-[minmax(130px,auto)_1fr] gap-x-4 border-t border-tinta/8">
                  <span className="text-piedra tabular-nums text-xs pt-0.5">{new Date(ev.creado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' })}</span>
                  <span>
                    {ROTULO_EVENTO[ev.tipo] ?? ev.tipo}
                    {ev.firmante_id && nombres.get(ev.firmante_id) ? ` · ${nombres.get(ev.firmante_id)}` : ''}
                    {ev.ip ? <span className="text-piedra"> · IP {ev.ip}</span> : null}
                    {ev.tipo === 'plazo_extendido' && typeof ev.detalle.ahora === 'string' ? <span className="text-piedra"> · hasta el {fechaHora(ev.detalle.ahora)}</span> : null}
                    {ev.tipo === 'error_mail' && typeof ev.detalle.motivo === 'string' ? <span className="block text-xs text-peligro">{ev.detalle.motivo}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="flex flex-col gap-6 desk:sticky desk:top-28">
          <div className="bg-white border border-tinta/14 p-6 flex flex-col gap-3 text-sm">
            <span className="eyebrow text-[11px] text-piedra">Documento</span>
            <span className="font-medium break-all">{sobre.original_nombre}</span>
            <span className="text-piedra">
              {sobre.original_paginas} {sobre.original_paginas === 1 ? 'hoja' : 'hojas'} · {peso(sobre.original_bytes)}
            </span>
            <span className="text-xs text-piedra break-all">SHA-256 original {sobre.original_sha256}</span>
            {sobre.final_sha256 && <span className="text-xs text-piedra break-all">SHA-256 firmado {sobre.final_sha256}</span>}
            {sobre.bfa_bloque ? (
              <span className="text-xs text-piedra">
                Blockchain Federal Argentina · bloque {sobre.bfa_bloque}
                {sobre.bfa_registrado_en ? ` · ${fechaHora(sobre.bfa_registrado_en)}` : ''}
              </span>
            ) : sobre.bfa_recibo ? (
              <span className="text-xs text-piedra">Blockchain Federal Argentina · esperando el bloque</span>
            ) : null}
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

          {(enCurso || sobre.estado === 'vencido') && !sobre.error_sellado && !soloLectura && (
            <div className="flex flex-col gap-3">
              {!extendiendo ? (
                enCurso ? (
                  <button type="button" onClick={() => setExtendiendo(true)} className="text-sm text-piedra underline underline-offset-4 self-start hover:text-tinta">
                    Extender el plazo
                  </button>
                ) : (
                  <Button variant="dark" size="sm" className="self-start" onClick={() => setExtendiendo(true)}>
                    <RefreshCw size={15} aria-hidden="true" /> Extender el plazo
                  </Button>
                )
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void extender();
                  }}
                  className="bg-marfil-oscuro p-5 flex flex-col gap-3"
                >
                  <Campo
                    etiqueta="Plazo nuevo"
                    ayuda={
                      enCurso
                        ? 'Se cuenta desde hoy y queda en el registro. Los enlaces siguen siendo los mismos.'
                        : 'Se cuenta desde hoy y queda en el registro. El envío se reabre con las firmas que ya tenía y los mismos enlaces.'
                    }
                  >
                    <select value={diasExtra} onChange={(e) => setDiasExtra(Number(e.target.value))} className={claseInput}>
                      {[3, 7, 15, 30, 60, 90].map((d) => (
                        <option key={d} value={d}>
                          {d} días
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <div className="flex gap-3">
                    <Button type="submit" variant="dark" size="sm" disabled={ocupado === 'extender'}>
                      {ocupado === 'extender' ? 'Extendiendo' : 'Extender'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setExtendiendo(false)}>
                      Volver
                    </Button>
                  </div>
                </form>
              )}
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

          {perfil.rol === 'admin' && !soloLectura && (
            <button
              type="button"
              onClick={() => void eliminar()}
              disabled={ocupado !== null}
              className="self-start inline-flex items-center gap-2 h-10 px-3 -ml-3 text-sm font-medium text-peligro transition-colors duration-150 hover:bg-peligro-suave disabled:opacity-40"
            >
              <Trash2 size={15} aria-hidden="true" /> {ocupado === 'eliminar' ? 'Eliminando…' : 'Eliminar el envío'}
            </button>
          )}
        </aside>
      </section>
    </>
  );
};

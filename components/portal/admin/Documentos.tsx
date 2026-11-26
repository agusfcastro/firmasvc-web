import React, { useEffect, useRef, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, Interruptor, Pestanas, claseInput } from '../ui';
import { avisarPorMail } from '../asuntos';
import { BUCKET_DOCUMENTOS, EXTENSIONES_ACEPTADAS, FORMATOS, SECCIONES, TAMANO_MAXIMO, descargarArchivo, extension, formatoDe, liberarModeloContrato, tamano, vencimientoContrato } from '../descargas';
import { MODELOS, type ClaveModelo } from '../pedidos/modelos';
import { seccionPersona, type ModeloPropio } from '../pedidos/propio';
import { CARGOS_ESTANDAR, ROLES_ELEGIBLES, ROL_COMERCIAL, cargoNormal, rolDe, type IntegranteEquipo, type RolComercial } from '../crm/tipos';
import { fechaCorta, type Area, type Documento, type Organizacion, type SeccionDocumento } from '../tipos';

type Filtro = 'todas' | SeccionDocumento;
type Contenido = 'archivo' | 'enlace';

interface Borrador {
  id?: string;
  seccion: SeccionDocumento;
  titulo: string;
  descripcion: string;
  version: string;
  organizacion_id: string | null;
  areas: string[];
  contenido: Contenido;
  url: string;
  activo: boolean;
  /** Protocolos y formación: los ven también closers y setters */
  es_protocolo: boolean;
  /** Contrato modelo de closer o setter de la empresa (0063). Solo en Contratos con tu equipo y para un cliente. */
  modelo_contrato: '' | ClaveModelo;
  /**
   * Contrato modelo de otro rol (0068): el id de un formulario propio de la empresa, o MODELO_NUEVO
   * para crearlo al guardar con el nombre de modelo_titulo. Vacío si no lo es.
   */
  modelo_propio: string;
  modelo_titulo: string;
  /** Persona del equipo a la que corresponde el contrato (0068). Solo en Contratos con tu equipo y para un cliente. */
  equipo_miembro_id: string;
  /** Fecha en que termina ese contrato, AAAA-MM-DD. */
  contrato_vence_el: string;
  /** Con OTRA_PERSONA: el nombre y el rol de alguien que todavía no está en el equipo. No necesita cuenta en el portal. */
  persona_nombre: string;
  persona_rol: RolComercial;
  /** Con el rol «otro»: el rol escrito a mano. */
  persona_cargo: string;
}

/** Valor del desplegable para escribir a mano a alguien que no está en el equipo. Se suma al guardar. */
const OTRA_PERSONA = 'otra';

/** Valor del desplegable para un contrato modelo que todavía no tiene formulario. Se crea al guardar. */
const MODELO_NUEVO = 'nuevo';

/** Los contratos con el equipo arrancan reservados al titular y a Dirección. */
const areasPorDefecto = (s: SeccionDocumento): string[] => (s === 'equipo' ? ['direccion'] : []);

/** Un documento se ata a una persona si es de un cliente, va en Contratos con tu equipo y no es el modelo ni un protocolo. */
const puedeAtar = (b: Borrador): boolean => b.seccion === 'equipo' && Boolean(b.organizacion_id) && !b.modelo_contrato && !b.modelo_propio && !b.es_protocolo;

/** Filtro por empresa: todas, las de un cliente, o los documentos que ven todos los clientes. */
const GENERALES = 'generales';

/** La empresa con la que se abre la pantalla, cuando se llega desde Administración › Clientes (?empresa=). */
const empresaInicial = (): string => new URLSearchParams(window.location.search).get('empresa') || 'todas';

const claseEtiqueta = 'block text-[12.5px] font-medium text-piedra mb-2';
const claseLink = 'underline underline-offset-4 hover:text-bosque';

export const Documentos: React.FC = () => {
  const [lista, setLista] = useState<Documento[]>([]);
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [filtroOrg, setFiltroOrg] = useState(empresaInicial);
  const [busqueda, setBusqueda] = useState('');
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [areasTocadas, setAreasTocadas] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Aviso por mail de un documento nuevo de una empresa. Se propone siempre y se puede destildar.
  const [avisar, setAvisar] = useState(true);
  const formulario = useRef<HTMLFormElement>(null);
  // Equipo de todas las empresas, para atar un contrato a su persona y nombrarla en la lista.
  const [equipo, setEquipo] = useState<IntegranteEquipo[]>([]);
  // Formularios propios de cada empresa (Administración › Formularios): un documento puede ser el contrato modelo de uno.
  const [propios, setPropios] = useState<ModeloPropio[]>([]);

  async function cargar() {
    if (!supabase) return;
    const [d, o, a, eq, mp] = await Promise.all([
      supabase.from('documentos').select('*').order('actualizado_en', { ascending: false }),
      supabase.from('organizaciones').select('*').order('nombre'),
      supabase.from('areas').select('*').order('orden'),
      supabase.from('equipo_miembros').select('*').order('nombre'),
      supabase.from('modelos_contrato').select('*').order('titulo'),
    ]);
    setPropios((mp.data as ModeloPropio[]) ?? []);
    setEquipo((eq.data as IntegranteEquipo[]) ?? []);
    if (d.error) setError(`${d.error.message}. Revisá que la migración 0005_documentos.sql esté corrida en Supabase.`);
    setLista((d.data as Documento[]) ?? []);
    setOrgs((o.data as Organizacion[]) ?? []);
    setAreas((a.data as Area[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  const personaDe = (id: string) => {
    const m = equipo.find((x) => x.id === id);
    return m ? `${m.nombre} · ${rolDe(m)}` : 'Persona del equipo';
  };

  const original = borrador?.id ? (lista.find((x) => x.id === borrador.id) ?? null) : null;
  // La empresa y la búsqueda se aplican primero, así las pestañas cuentan lo que se está viendo. Llegan con lo más nuevo arriba.
  const q = busqueda.trim().toLowerCase();
  const deLaEmpresa = lista.filter((d) => {
    if (filtroOrg === GENERALES ? d.organizacion_id !== null : filtroOrg !== 'todas' && d.organizacion_id !== filtroOrg) return false;
    return !q || d.titulo.toLowerCase().includes(q) || (d.archivo_nombre ?? '').toLowerCase().includes(q) || (d.equipo_miembro_id ? personaDe(d.equipo_miembro_id).toLowerCase().includes(q) : false);
  });
  const filtrados = filtro === 'todas' ? deLaEmpresa : deLaEmpresa.filter((d) => d.seccion === filtro);
  const cuenta = (s: SeccionDocumento) => deLaEmpresa.filter((d) => d.seccion === s).length;
  const hayFiltros = filtroOrg !== 'todas' || Boolean(q) || filtro !== 'todas';

  function abrir(b: Borrador) {
    setBorrador(b);
    setArchivo(null);
    setAreasTocadas(Boolean(b.id));
    setError(null);
    setOk(null);
    requestAnimationFrame(() => formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function nuevo() {
    const seccion: SeccionDocumento = filtro === 'todas' ? 'servicio' : filtro;
    abrir({
      seccion,
      titulo: '',
      descripcion: '',
      version: '',
      // Con una empresa filtrada, el documento nuevo arranca siendo de ella.
      organizacion_id: filtroOrg !== 'todas' && filtroOrg !== GENERALES ? filtroOrg : null,
      areas: areasPorDefecto(seccion),
      contenido: 'archivo',
      url: '',
      activo: true,
      es_protocolo: false,
      modelo_contrato: '',
      modelo_propio: '',
      modelo_titulo: '',
      equipo_miembro_id: '',
      contrato_vence_el: '',
      persona_nombre: '',
      persona_rol: 'otro',
      persona_cargo: '',
    });
  }

  function editar(d: Documento) {
    abrir({
      id: d.id,
      seccion: d.seccion,
      titulo: d.titulo,
      descripcion: d.descripcion ?? '',
      version: d.version ?? '',
      organizacion_id: d.organizacion_id,
      areas: d.areas ?? [],
      contenido: d.url ? 'enlace' : 'archivo',
      url: d.url ?? '',
      activo: d.activo,
      es_protocolo: Boolean(d.es_protocolo),
      modelo_contrato: d.modelo_contrato ?? '',
      modelo_propio: propios.find((m) => m.documento_id === d.id)?.id ?? '',
      modelo_titulo: '',
      equipo_miembro_id: d.equipo_miembro_id ?? '',
      contrato_vence_el: d.contrato_vence_el ?? '',
      persona_nombre: '',
      persona_rol: 'otro',
      persona_cargo: '',
    });
  }

  function cerrar() {
    setBorrador(null);
    setArchivo(null);
  }

  function cambiarSeccion(s: SeccionDocumento) {
    if (!borrador) return;
    setBorrador({ ...borrador, seccion: s, areas: areasTocadas ? borrador.areas : areasPorDefecto(s) });
  }

  function alternarArea(clave: string) {
    if (!borrador) return;
    setAreasTocadas(true);
    const marcada = borrador.areas.includes(clave);
    setBorrador({ ...borrador, areas: marcada ? borrador.areas.filter((a) => a !== clave) : [...borrador.areas, clave] });
  }

  /** Devuelve false si el archivo no sirve, para limpiar el selector. */
  function elegirArchivo(f: File | null): boolean {
    setError(null);
    setArchivo(null);
    if (!f) return true;
    if (!FORMATOS[extension(f.name)]) {
      setError('Ese formato no se admite. Subí Word, PDF, Excel, PowerPoint, ODT o RTF.');
      return false;
    }
    if (f.size > TAMANO_MAXIMO) {
      setError('El archivo supera los 25 MB.');
      return false;
    }
    setArchivo(f);
    return true;
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    setError(null);
    setOk(null);
    const conArchivo = borrador.contenido === 'archivo';
    const url = borrador.url.trim();
    if (!borrador.titulo.trim()) return setError('Poné un título.');
    if (!conArchivo && !/^(https:\/\/|\/[^/])/.test(url)) return setError('El enlace tiene que empezar con https:// o ser una ruta del sitio, como /protocolo-llamadas.');
    if (conArchivo && !archivo && !original?.archivo_ruta) return setError('Elegí el archivo que vas a subir.');
    // El contrato modelo es de un cliente y vive en Contratos con tu equipo.
    const modeloContrato = borrador.seccion === 'equipo' && borrador.organizacion_id && borrador.modelo_contrato ? borrador.modelo_contrato : null;
    // El contrato de una persona: de un cliente, en Contratos con tu equipo, y no es el modelo ni un protocolo.
    let persona = puedeAtar(borrador) ? borrador.equipo_miembro_id || null : null;
    // El contrato modelo de otro rol: va atado a un formulario propio de la empresa.
    const modeloPropio = borrador.seccion === 'equipo' && borrador.organizacion_id && !modeloContrato ? borrador.modelo_propio : '';
    if (modeloPropio === MODELO_NUEVO && borrador.modelo_titulo.trim().length < 3) return setError('Poné el nombre del contrato, por ejemplo «Contrato de nutricionista».');
    if (persona === OTRA_PERSONA && borrador.persona_nombre.trim().length < 2) return setError('Escribí el nombre completo de la persona.');
    setGuardando(true);

    // Alguien que no está en el equipo se suma ahora, sin cuenta en el portal. Si ya hay alguien con ese nombre, se usa ese.
    if (persona === OTRA_PERSONA) {
      const { data: idNuevo, error: eq } = await supabase.rpc('equipo_sumar', {
        org: borrador.organizacion_id,
        nombre: borrador.persona_nombre.trim(),
        rol: borrador.persona_rol,
        // Solo si lo escribió, así sin la migración 0069 el resto sigue andando.
        ...(borrador.persona_rol === 'otro' && borrador.persona_cargo.trim() ? { cargo: cargoNormal(borrador.persona_cargo) } : {}),
      });
      if (eq || !idNuevo) {
        setGuardando(false);
        return setError(eq && /equipo_sumar|cargo/.test(eq.message) ? `${eq.message}. Revisá que la migración 0069_equipo_cargo.sql esté corrida en Supabase.` : (eq?.message ?? 'No se pudo sumar a la persona al equipo.'));
      }
      persona = idNuevo as string;
    }

    // 0. Si pasa a ser el contrato modelo, el que lo era deja de serlo.
    if (modeloContrato && borrador.organizacion_id) {
      const fallo = await liberarModeloContrato(borrador.organizacion_id, modeloContrato, borrador.id);
      if (fallo) {
        setGuardando(false);
        return setError(`${fallo}. Revisá que la migración 0063_contrato_modelo.sql esté corrida en Supabase.`);
      }
    }

    // 1. Si hay archivo nuevo, se sube primero con un nombre único.
    let rutaNueva: string | null = null;
    if (conArchivo && archivo) {
      const ext = extension(archivo.name);
      const mime = FORMATOS[ext].mime;
      rutaNueva = `${borrador.seccion}/${crypto.randomUUID()}.${ext}`;
      // El tipo tiene que coincidir con los formatos del bucket aunque el sistema no lo detecte.
      const cuerpo = archivo.type === mime ? archivo : new File([archivo], archivo.name, { type: mime });
      const { error: errSubida } = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(rutaNueva, cuerpo, { contentType: mime, upsert: false });
      if (errSubida) {
        setGuardando(false);
        return setError(`No se pudo subir el archivo. ${errSubida.message}`);
      }
    }

    // 2. Se guarda la ficha.
    const datos = {
      seccion: borrador.seccion,
      titulo: borrador.titulo.trim(),
      descripcion: borrador.descripcion.trim() || null,
      version: borrador.version.trim() || null,
      organizacion_id: borrador.organizacion_id || null,
      areas: borrador.areas,
      activo: borrador.activo,
      es_protocolo: borrador.es_protocolo,
      modelo_contrato: modeloContrato,
      // Solo si hay o hubo una persona, así el resto no depende de la migración 0068.
      ...(persona || original?.equipo_miembro_id ? { equipo_miembro_id: persona, contrato_vence_el: persona ? borrador.contrato_vence_el || null : null } : {}),
      url: conArchivo ? null : url,
      archivo_ruta: conArchivo ? (rutaNueva ?? original?.archivo_ruta ?? null) : null,
      archivo_nombre: conArchivo ? (archivo?.name ?? original?.archivo_nombre ?? null) : null,
      archivo_bytes: conArchivo ? (archivo?.size ?? original?.archivo_bytes ?? null) : null,
    };
    const { data: guardado, error: err } = borrador.id
      ? await supabase.from('documentos').update(datos).eq('id', borrador.id).select('id').maybeSingle()
      : await supabase.from('documentos').insert(datos).select('id').single();
    if (err) {
      if (rutaNueva) await supabase.storage.from(BUCKET_DOCUMENTOS).remove([rutaNueva]);
      setGuardando(false);
      return setError(persona && /equipo_miembro_id|contrato_vence_el/.test(err.message) ? `${err.message}. Revisá que la migración 0068_contratos_equipo_y_modelos.sql esté corrida en Supabase.` : err.message);
    }

    // 3. El archivo anterior se borra si se reemplazó o si el documento pasó a ser un enlace.
    if (original?.archivo_ruta && original.archivo_ruta !== datos.archivo_ruta) {
      await supabase.storage.from(BUCKET_DOCUMENTOS).remove([original.archivo_ruta]);
    }

    // 4. Contrato modelo de otro rol: se ata a su formulario, que se crea si todavía no existe.
    let notaModelo = '';
    if (guardado?.id) {
      const anterior = propios.find((m) => m.documento_id === guardado.id);
      let fallo: string | null = null;
      if (anterior && anterior.id !== modeloPropio) {
        fallo = (await supabase.from('modelos_contrato').update({ documento_id: null }).eq('id', anterior.id)).error?.message ?? null;
      }
      if (!fallo && modeloPropio === MODELO_NUEVO) {
        const titulo = borrador.modelo_titulo.trim();
        fallo =
          (
            await supabase.from('modelos_contrato').insert({
              organizacion_id: borrador.organizacion_id,
              titulo,
              persona: 'prestador',
              documento_id: guardado.id,
              activo: true,
              orden: propios.filter((m) => m.organizacion_id === borrador.organizacion_id).length + 1,
              // Arranca pidiendo los datos de la persona. Las demás preguntas se suman en Administración › Formularios.
              secciones: [seccionPersona('prestador')],
            })
          ).error?.message ?? null;
        if (!fallo) notaModelo = ` Quedó como modelo de «${titulo}»: el cliente ya lo puede pedir desde Contratos con tu equipo. Las preguntas del formulario se ajustan en Formularios.`;
      } else if (!fallo && modeloPropio && modeloPropio !== anterior?.id) {
        fallo = (await supabase.from('modelos_contrato').update({ documento_id: guardado.id }).eq('id', modeloPropio)).error?.message ?? null;
      }
      if (fallo) {
        setGuardando(false);
        cerrar();
        void cargar();
        return setError(`El documento se guardó, pero no quedó como contrato modelo. ${fallo}`);
      }
    }

    let nota = borrador.id ? 'Documento actualizado.' : 'Documento cargado.';
    if (!borrador.id && avisar && datos.organizacion_id && datos.activo && guardado?.id) {
      const r = await avisarPorMail('documento', guardado.id);
      nota = r.ok ? `Documento cargado. Avisamos por mail a ${r.avisados} ${r.avisados === 1 ? 'persona' : 'personas'}.` : `Documento cargado, pero el aviso por mail no salió. ${r.error ?? ''}`;
    }
    setGuardando(false);
    setOk(nota + notaModelo);
    cerrar();
    void cargar();
  }

  async function borrar(d: Documento) {
    if (!supabase || !window.confirm(`¿Eliminar «${d.titulo}»? Deja de estar disponible en el portal.`)) return;
    setError(null);
    setOk(null);
    const { error: err } = await supabase.from('documentos').delete().eq('id', d.id);
    if (err) return setError(err.message);
    if (d.archivo_ruta) await supabase.storage.from(BUCKET_DOCUMENTOS).remove([d.archivo_ruta]);
    if (borrador?.id === d.id) cerrar();
    setOk('Documento eliminado.');
    void cargar();
  }

  async function descargar(d: Documento) {
    setError(null);
    const fallo = await descargarArchivo(d);
    if (fallo) setError(fallo);
  }

  // Activos de la empresa elegida, más la persona ya vinculada aunque esté desactivada.
  const personas = borrador?.organizacion_id
    ? equipo.filter((m) => m.organizacion_id === borrador.organizacion_id && (m.activo || m.id === borrador.equipo_miembro_id))
    : [];
  const propiosDeOrg = borrador?.organizacion_id ? propios.filter((m) => m.organizacion_id === borrador.organizacion_id) : [];
  const conPersona = Boolean(borrador && puedeAtar(borrador) && borrador.equipo_miembro_id);

  const nombreOrg = (id: string | null) => (id ? `Solo ${orgs.find((o) => o.id === id)?.nombre ?? 'un cliente'}` : 'Todos los clientes');
  const nombreAreas = (claves: string[]) =>
    claves.length === 0 ? 'Todo el equipo' : `Titular y ${claves.map((c) => areas.find((a) => a.clave === c)?.nombre ?? c).join(', ')}`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-piedra max-w-[72ch]">
        Los archivos quedan privados y se bajan con un enlace que vence en un minuto. Cada descarga de un cliente queda en el Registro de accesos.
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {borrador ? (
        <form ref={formulario} onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-6 max-w-[760px]" style={{ scrollMarginTop: 120 }}>
          <h2 className="h3">{borrador.id ? 'Editar documento' : 'Nuevo documento'}</h2>

          <div className="grid gap-5 tab:grid-cols-2">
            <Campo etiqueta="Sección">
              <select className={claseInput} value={borrador.seccion} onChange={(e) => cambiarSeccion(e.target.value as SeccionDocumento)}>
                {SECCIONES.map((s) => (
                  <option key={s.clave} value={s.clave}>
                    {s.titulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Visible para">
              <select className={claseInput} value={borrador.organizacion_id ?? ''} onChange={(e) => setBorrador({ ...borrador, organizacion_id: e.target.value || null, equipo_miembro_id: '', contrato_vence_el: '', persona_nombre: '', modelo_propio: '', modelo_titulo: '' })}>
                <option value="">Todos los clientes</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    Solo {o.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {borrador.seccion === 'equipo' && borrador.organizacion_id && (
            <div className="grid gap-5 tab:grid-cols-2">
              <Campo
                etiqueta="¿Es su contrato modelo?"
                ayuda="El cliente lo baja desde la tarjeta del contrato y cada persona nueva se suma con él. Hay uno por contrato: si ya tenía otro, deja de ser el modelo y sigue en la sección."
              >
                <select
                  className={claseInput}
                  value={borrador.modelo_contrato || (borrador.modelo_propio ? `propio:${borrador.modelo_propio}` : '')}
                  onChange={(e) => {
                    const v = e.target.value;
                    const propio = v.startsWith('propio:') ? v.slice(7) : '';
                    setBorrador({
                      ...borrador,
                      modelo_contrato: propio ? '' : (v as Borrador['modelo_contrato']),
                      modelo_propio: propio,
                      ...(v ? { equipo_miembro_id: '', contrato_vence_el: '', persona_nombre: '' } : {}),
                    });
                  }}
                >
                  <option value="">No</option>
                  {Object.values(MODELOS).map((m) => (
                    <option key={m.clave} value={m.clave}>
                      Sí, es su {m.titulo.toLowerCase()}
                    </option>
                  ))}
                  {propiosDeOrg.map((m) => (
                    <option key={m.id} value={`propio:${m.id}`}>
                      Sí, es su {m.titulo.toLowerCase()}
                      {m.activo ? '' : ' (oculto)'}
                    </option>
                  ))}
                  <option value={`propio:${MODELO_NUEVO}`}>Sí, de otro rol (escribir el nombre)</option>
                </select>
              </Campo>
              {borrador.modelo_propio === MODELO_NUEVO && (
                <Campo etiqueta="Nombre del contrato" ayuda="Así se llama la tarjeta que ve el cliente para pedirlo. Queda guardado para la próxima vez.">
                  <input className={claseInput} maxLength={80} value={borrador.modelo_titulo} onChange={(e) => setBorrador({ ...borrador, modelo_titulo: e.target.value })} placeholder="Contrato de nutricionista" />
                </Campo>
              )}
            </div>
          )}

          {puedeAtar(borrador) && (
            <div className="grid gap-5 tab:grid-cols-2">
              <Campo
                etiqueta="¿Es el contrato de alguien del equipo?"
                ayuda="Sale en Contratos de tu equipo con su nombre, su rol y el vencimiento. Trae honorarios, así que lo ven solo el titular y las áreas Legales y Operaciones."
              >
                <select className={claseInput} value={borrador.equipo_miembro_id} onChange={(e) => setBorrador({ ...borrador, equipo_miembro_id: e.target.value, contrato_vence_el: e.target.value ? borrador.contrato_vence_el : '' })}>
                  <option value="">No, es un documento de la sección</option>
                  {personas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} · {rolDe(m)}
                      {m.activo ? '' : ' (desactivado)'}
                    </option>
                  ))}
                  <option value={OTRA_PERSONA}>Otra persona (escribir el nombre)</option>
                </select>
              </Campo>
              {borrador.equipo_miembro_id === OTRA_PERSONA && (
                <>
                  <Campo etiqueta="Nombre completo" ayuda="Queda en el equipo de la empresa, sin cuenta en el portal. Si ya hay alguien con ese nombre, se usa esa persona.">
                    <input className={claseInput} maxLength={120} value={borrador.persona_nombre} onChange={(e) => setBorrador({ ...borrador, persona_nombre: e.target.value })} placeholder="Santiago Ávalos" />
                  </Campo>
                  <Campo etiqueta="Rol">
                    <select className={claseInput} value={borrador.persona_rol} onChange={(e) => setBorrador({ ...borrador, persona_rol: e.target.value as RolComercial })}>
                      {ROLES_ELEGIBLES.map((r) => (
                        <option key={r} value={r}>
                          {ROL_COMERCIAL[r]}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  {borrador.persona_rol === 'otro' && (
                    <Campo etiqueta="¿Qué rol tiene?" ayuda="Sale al lado de su nombre en la tarjeta del contrato.">
                      <input className={claseInput} maxLength={60} list="cargos-estandar" value={borrador.persona_cargo} onChange={(e) => setBorrador({ ...borrador, persona_cargo: e.target.value })} placeholder="Nutricionista" />
                <datalist id="cargos-estandar">{CARGOS_ESTANDAR.map((c) => <option key={c} value={c} />)}</datalist>
                    </Campo>
                  )}
                </>
              )}
              {conPersona && (
                <Campo etiqueta="Vencimiento del contrato (opcional)" ayuda="El día en que termina. Treinta días antes la tarjeta lo marca como «vence pronto».">
                  <input type="date" className={claseInput} value={borrador.contrato_vence_el} onChange={(e) => setBorrador({ ...borrador, contrato_vence_el: e.target.value })} />
                </Campo>
              )}
            </div>
          )}

          <Campo etiqueta="Título">
            <input required className={claseInput} value={borrador.titulo} onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })} placeholder="Contrato de consultoría con honorario fijo" />
          </Campo>

          <Campo etiqueta="Para qué sirve" ayuda="Se muestra debajo del título. Una o dos frases.">
            <textarea
              rows={3}
              className={`${claseInput} h-auto py-3`}
              value={borrador.descripcion}
              onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
              placeholder="Para vender una consultoría con precio cerrado y entregables definidos."
            />
          </Campo>

          <div>
            <span className={claseEtiqueta}>Contenido</span>
            <div className="inline-flex border border-tinta" role="group" aria-label="Tipo de contenido">
              {(['archivo', 'enlace'] as Contenido[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={borrador.contenido === c}
                  onClick={() => setBorrador({ ...borrador, contenido: c })}
                  className={`h-10 px-5 text-sm font-medium transition-colors duration-150 ${borrador.contenido === c ? 'bg-tinta text-marfil' : 'text-tinta hover:bg-white'}`}
                >
                  {c === 'archivo' ? 'Archivo' : 'Enlace'}
                </button>
              ))}
            </div>
            <div className="mt-4">
              {borrador.contenido === 'archivo' ? (
                <div className="space-y-2">
                  <label className="flex flex-wrap items-center gap-x-4 gap-y-2 cursor-pointer">
                    <input
                      type="file"
                      accept={EXTENSIONES_ACEPTADAS}
                      className="peer sr-only"
                      onChange={(e) => {
                        if (!elegirArchivo(e.target.files?.[0] ?? null)) e.target.value = '';
                      }}
                    />
                    <span className="inline-flex items-center gap-2 h-11 px-5 bg-tinta text-marfil text-sm font-medium transition-colors duration-150 hover:bg-carbon peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-bosque">
                      <Upload size={16} aria-hidden="true" />
                      {archivo || original?.archivo_nombre ? 'Elegir otro archivo' : 'Elegir archivo'}
                    </span>
                    <span className="text-sm break-all">{archivo?.name ?? original?.archivo_nombre ?? 'Ningún archivo elegido'}</span>
                  </label>
                  <span className="block text-xs text-piedra">
                    {archivo
                      ? `Se sube al guardar (${tamano(archivo.size)}).`
                      : original?.archivo_nombre
                        ? 'Es el archivo actual. Elegí otro solo si lo querés reemplazar.'
                        : 'Word, PDF, Excel, PowerPoint, ODT o RTF. Hasta 25 MB.'}
                  </span>
                </div>
              ) : (
                <Campo etiqueta="Enlace" ayuda="Un Google Doc, una carpeta de Drive o una página del sitio, como /protocolo-llamadas. Revisá que se pueda abrir con el link.">
                  <input className={claseInput} value={borrador.url} onChange={(e) => setBorrador({ ...borrador, url: e.target.value })} placeholder="https://docs.google.com/document/d/..." />
                </Campo>
              )}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={borrador.es_protocolo} onChange={(e) => setBorrador({ ...borrador, es_protocolo: e.target.checked })} />
            <span>Es un protocolo o material de formación. Lo ven también closers y setters, que no acceden a los documentos legales.</span>
          </label>

          <div className="tab:max-w-[50%]">
            <Campo etiqueta="Versión (opcional)" ayuda="Si la cambiás, o si reemplazás el archivo, se actualiza la fecha que ve el cliente y el documento sube al principio de la lista.">
              <input className={claseInput} value={borrador.version} onChange={(e) => setBorrador({ ...borrador, version: e.target.value })} placeholder="1.0" />
            </Campo>
          </div>

          {conPersona ? (
            <div>
              <span className={claseEtiqueta}>Quién lo ve dentro de la empresa</span>
              <p className="text-sm">El titular y quienes tienen el área Legales u Operaciones, como los contratos del equipo mandados a firmar.</p>
            </div>
          ) : (
          <div>
            <span className={claseEtiqueta}>Quién lo ve dentro de la empresa</span>
            <div className="flex flex-wrap gap-2">
              {areas.map((a) => {
                const marcada = borrador.areas.includes(a.clave);
                return (
                  <button
                    key={a.clave}
                    type="button"
                    aria-pressed={marcada}
                    onClick={() => alternarArea(a.clave)}
                    className={`h-10 px-4 text-sm border transition-colors duration-150 ${marcada ? 'bg-bosque border-bosque text-marfil' : 'bg-white border-tinta/22 hover:border-tinta/45'}`}
                  >
                    {a.nombre}
                  </button>
                );
              })}
            </div>
            <span className="block text-xs text-piedra mt-2">
              {borrador.areas.length === 0 ? 'Sin áreas marcadas lo ve todo el equipo. El titular ve todo siempre.' : 'Lo ven el titular y los miembros de las áreas marcadas.'}
            </span>
          </div>
          )}

          <Interruptor activo={borrador.activo} alCambiar={(v) => setBorrador({ ...borrador, activo: v })} etiqueta="Visible en el portal" />

          {!borrador.id && borrador.organizacion_id && borrador.activo && (
            <Interruptor
              activo={avisar}
              alCambiar={setAvisar}
              etiqueta="Avisar por mail a la empresa"
              ayuda="Les llega a quienes pueden ver este documento en el portal."
            />
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={guardando}>
              {guardando ? (archivo ? 'Subiendo…' : 'Guardando…') : 'Guardar'}
            </Button>
            <Button type="button" variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Button onClick={nuevo}>
            <Plus size={16} /> Nuevo documento
          </Button>
          <div className="flex-1" />
          <select className={`${claseInput} !w-auto min-w-[200px]`} value={filtroOrg} onChange={(e) => setFiltroOrg(e.target.value)} aria-label="Filtrar por empresa">
            <option value="todas">Todas las empresas</option>
            <option value={GENERALES}>Para todos los clientes</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
          <input className={`${claseInput} !w-full tab:!w-64`} placeholder="Buscar por título, archivo o persona" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar documentos" />
        </div>
      )}

      <Pestanas<Filtro>
        items={[{ clave: 'todas', titulo: 'Todas', cuenta: deLaEmpresa.length }, ...SECCIONES.map((s) => ({ clave: s.clave, titulo: s.titulo, cuenta: cuenta(s.clave) }))]}
        activa={filtro}
        alCambiar={setFiltro}
      />

      <div className="overflow-x-auto">
        <table className="tabla min-w-[920px]">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Sección</th>
              <th>Visible para</th>
              <th>Versión</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="text-piedra">
                  {hayFiltros ? 'No hay documentos con ese filtro.' : 'Todavía no hay documentos.'}
                </td>
              </tr>
            )}
            {filtrados.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="font-heading font-bold text-[16px] leading-tight">{d.titulo}</div>
                  {d.modelo_contrato && (
                    <div className="mt-1.5">
                      <Etiqueta tono="bosque">Modelo · {MODELOS[d.modelo_contrato].titulo.toLowerCase()}</Etiqueta>
                    </div>
                  )}
                  {propios
                    .filter((m) => m.documento_id === d.id)
                    .map((m) => (
                      <div key={m.id} className="mt-1.5">
                        <Etiqueta tono="bosque">Modelo · {m.titulo.toLowerCase()}</Etiqueta>
                      </div>
                    ))}
                  {d.equipo_miembro_id && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-piedra">
                      <Etiqueta tono="tinta">{personaDe(d.equipo_miembro_id)}</Etiqueta>
                      {vencimientoContrato(d.contrato_vence_el)?.texto ?? 'Sin vencimiento cargado'}
                    </div>
                  )}
                  <div className="text-xs text-piedra mt-1 break-all">
                    {formatoDe(d)}
                    {d.archivo_bytes ? ` · ${tamano(d.archivo_bytes)}` : ''} · {d.archivo_nombre ?? d.url}
                  </div>
                </td>
                <td className="whitespace-nowrap">{SECCIONES.find((s) => s.clave === d.seccion)?.titulo ?? d.seccion}</td>
                <td>
                  {nombreOrg(d.organizacion_id)}
                  <div className="text-xs text-piedra mt-1">{d.equipo_miembro_id ? 'Titular, Legales y Operaciones' : nombreAreas(d.areas ?? [])}</div>
                </td>
                <td className="whitespace-nowrap">
                  {d.version || '·'}
                  <div className="text-xs text-piedra mt-1">{fechaCorta(d.actualizado_en)}</div>
                </td>
                <td>{d.activo ? <Etiqueta tono="bosque">Visible</Etiqueta> : <Etiqueta>Oculto</Etiqueta>}</td>
                <td className="text-right whitespace-nowrap">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className={`${claseLink} mr-4`}>
                      Abrir
                    </a>
                  ) : (
                    <button type="button" className={`${claseLink} mr-4`} onClick={() => descargar(d)}>
                      Descargar
                    </button>
                  )}
                  <button type="button" className={`${claseLink} mr-4`} onClick={() => editar(d)}>
                    Editar
                  </button>
                  <button type="button" className="underline underline-offset-4 text-peligro" onClick={() => borrar(d)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

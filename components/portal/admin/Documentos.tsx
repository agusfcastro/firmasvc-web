import React, { useEffect, useRef, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, Interruptor, Pestanas, claseInput } from '../ui';
import { BUCKET_DOCUMENTOS, EXTENSIONES_ACEPTADAS, FORMATOS, SECCIONES, TAMANO_MAXIMO, descargarArchivo, extension, formatoDe, tamano } from '../descargas';
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
  orden: number;
  activo: boolean;
}

/** Los contratos con el equipo arrancan reservados al titular y a Dirección. */
const areasPorDefecto = (s: SeccionDocumento): string[] => (s === 'equipo' ? ['direccion'] : []);

const ORDEN_SECCION: Record<SeccionDocumento, number> = { servicio: 0, equipo: 1, otros: 2 };

const claseEtiqueta = 'block text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-2';
const claseLink = 'underline underline-offset-4 hover:text-bosque';

export const Documentos: React.FC = () => {
  const [lista, setLista] = useState<Documento[]>([]);
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [areasTocadas, setAreasTocadas] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);

  async function cargar() {
    if (!supabase) return;
    const [d, o, a] = await Promise.all([
      supabase.from('documentos').select('*').order('orden').order('titulo'),
      supabase.from('organizaciones').select('*').order('nombre'),
      supabase.from('areas').select('*').order('orden'),
    ]);
    if (d.error) setError(`${d.error.message}. Revisá que la migración 0005_documentos.sql esté corrida en Supabase.`);
    setLista((d.data as Documento[]) ?? []);
    setOrgs((o.data as Organizacion[]) ?? []);
    setAreas((a.data as Area[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  const original = borrador?.id ? (lista.find((x) => x.id === borrador.id) ?? null) : null;
  const filtrados = (filtro === 'todas' ? lista : lista.filter((d) => d.seccion === filtro))
    .slice()
    .sort((a, b) => ORDEN_SECCION[a.seccion] - ORDEN_SECCION[b.seccion] || a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es'));
  const cuenta = (s: SeccionDocumento) => lista.filter((d) => d.seccion === s).length;

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
      organizacion_id: null,
      areas: areasPorDefecto(seccion),
      contenido: 'archivo',
      url: '',
      orden: cuenta(seccion) + 1,
      activo: true,
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
      orden: d.orden,
      activo: d.activo,
    });
  }

  function cerrar() {
    setBorrador(null);
    setArchivo(null);
  }

  function cambiarSeccion(s: SeccionDocumento) {
    if (!borrador) return;
    setBorrador({ ...borrador, seccion: s, areas: areasTocadas ? borrador.areas : areasPorDefecto(s), orden: borrador.id ? borrador.orden : cuenta(s) + 1 });
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
    setGuardando(true);

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
      orden: Number(borrador.orden) || 0,
      activo: borrador.activo,
      url: conArchivo ? null : url,
      archivo_ruta: conArchivo ? (rutaNueva ?? original?.archivo_ruta ?? null) : null,
      archivo_nombre: conArchivo ? (archivo?.name ?? original?.archivo_nombre ?? null) : null,
      archivo_bytes: conArchivo ? (archivo?.size ?? original?.archivo_bytes ?? null) : null,
    };
    const { error: err } = borrador.id ? await supabase.from('documentos').update(datos).eq('id', borrador.id) : await supabase.from('documentos').insert(datos);
    if (err) {
      if (rutaNueva) await supabase.storage.from(BUCKET_DOCUMENTOS).remove([rutaNueva]);
      setGuardando(false);
      return setError(err.message);
    }

    // 3. El archivo anterior se borra si se reemplazó o si el documento pasó a ser un enlace.
    if (original?.archivo_ruta && original.archivo_ruta !== datos.archivo_ruta) {
      await supabase.storage.from(BUCKET_DOCUMENTOS).remove([original.archivo_ruta]);
    }

    setGuardando(false);
    setOk(borrador.id ? 'Documento actualizado.' : 'Documento cargado.');
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
              <select className={claseInput} value={borrador.organizacion_id ?? ''} onChange={(e) => setBorrador({ ...borrador, organizacion_id: e.target.value || null })}>
                <option value="">Todos los clientes</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    Solo {o.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

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

          <div className="grid gap-5 tab:grid-cols-2">
            <Campo etiqueta="Versión" ayuda="Si la cambiás, o si reemplazás el archivo, se actualiza la fecha que ve el cliente.">
              <input className={claseInput} value={borrador.version} onChange={(e) => setBorrador({ ...borrador, version: e.target.value })} placeholder="1.0" />
            </Campo>
            <Campo etiqueta="Orden">
              <input type="number" className={claseInput} value={borrador.orden} onChange={(e) => setBorrador({ ...borrador, orden: Number(e.target.value) })} />
            </Campo>
          </div>

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
                    className={`h-10 px-4 text-sm border transition-colors duration-150 ${marcada ? 'bg-bosque border-bosque text-marfil' : 'bg-white border-[rgba(27,31,27,0.22)] hover:border-[rgba(27,31,27,0.45)]'}`}
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

          <Interruptor activo={borrador.activo} alCambiar={(v) => setBorrador({ ...borrador, activo: v })} etiqueta="Visible en el portal" />

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
        <Button onClick={nuevo}>
          <Plus size={16} /> Nuevo documento
        </Button>
      )}

      <Pestanas<Filtro>
        items={[{ clave: 'todas', titulo: 'Todas', cuenta: lista.length }, ...SECCIONES.map((s) => ({ clave: s.clave, titulo: s.titulo, cuenta: cuenta(s.clave) }))]}
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
                  Todavía no hay documentos{filtro === 'todas' ? '' : ' en esta sección'}.
                </td>
              </tr>
            )}
            {filtrados.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="font-heading font-bold text-[16px] leading-tight">{d.titulo}</div>
                  <div className="text-xs text-piedra mt-1 break-all">
                    {formatoDe(d)}
                    {d.archivo_bytes ? ` · ${tamano(d.archivo_bytes)}` : ''} · {d.archivo_nombre ?? d.url}
                  </div>
                </td>
                <td className="whitespace-nowrap">{SECCIONES.find((s) => s.clave === d.seccion)?.titulo ?? d.seccion}</td>
                <td>
                  {nombreOrg(d.organizacion_id)}
                  <div className="text-xs text-piedra mt-1">{nombreAreas(d.areas ?? [])}</div>
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
                  <button type="button" className="underline underline-offset-4 text-[#8a2b20]" onClick={() => borrar(d)}>
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

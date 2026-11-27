import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, FileSpreadsheet, FileText, Globe, Link2, Presentation } from 'lucide-react';
import { Label, ListBox, SearchField, Select } from '@heroui/react';
import { supabase } from './supabase';
import { Aviso, Encabezado, Enlace, Marco, PestanasEnlace } from './ui';
import { useVistaPrevia } from './vistaPrevia';
import { PedidosEquipo } from './pedidos/Pedidos';
import { TarjetaProtocolo } from './TarjetaProtocolo';
import { ContratosEquipoFirmados } from './firmas/ContratosEquipo';
import { generaContratos, permisosDe } from './tipos';
import { SECCIONES, descargarArchivo, extension, fechaLarga, formatoDe, registrarDescarga, seccionDeRuta, tamano, visibleEnPantalla } from './descargas';
import type { Documento, Organizacion, Perfil } from './tipos';
import { claseBotonHero } from '../Button';

/**
 * Documentos del cliente en tres secciones, cada una con su ruta, y los
 * protocolos y la formación en una vista aparte.
 *   /portal/documentos          contratos de servicio
 *   /portal/documentos/equipo   contratos con el equipo
 *   /portal/documentos/otros    otros documentos
 *   /portal/protocolos          protocolos y formación (es_protocolo)
 * La base decide qué ve cada usuario. FIRMA, sin Ver como, ve los documentos de todos los
 * clientes y la biblioteca común, y los filtra por cliente y por título o archivo. El cliente
 * elegido va en ?empresa= (el mismo valor que Administración › Documentos, con «generales»
 * para la biblioteca común), así se mantiene al pasar de pestaña y al recargar.
 */

/** Filtro de FIRMA por cliente: todos, la biblioteca común o una empresa. */
const TODAS = 'todas';
const GENERALES = 'generales';
const empresaInicial = (): string => new URLSearchParams(window.location.search).get('empresa') || TODAS;

/** Minúsculas y sin tildes, para buscar «contratación» escribiendo «contratacion». */
const normalizar = (t: string | null | undefined) =>
  (t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function iconoDe(d: Documento): React.ElementType {
  if (d.url) {
    if (d.url.startsWith('/')) return Globe;
    return /docs\.google\.com\/spreadsheets/.test(d.url) ? FileSpreadsheet : Link2;
  }
  const ext = extension(d.archivo_nombre);
  if (ext === 'xlsx' || ext === 'xls') return FileSpreadsheet;
  if (ext === 'pptx') return Presentation;
  return FileText;
}

const claseAccion = claseBotonHero('primary', 'md');
const claseSecundaria =
  'inline-flex items-center min-h-[40px] text-[14px] font-medium text-bosque underline underline-offset-4 decoration-bosque/30 transition-colors duration-150 hover:decoration-bosque';
const claseAdministrar = claseBotonHero('primary', 'lg');

export const Documentos: React.FC<{ perfil: Perfil; organizacion: Organizacion | null; ruta: string }> = ({ perfil, organizacion, ruta }) => {
  const vista = useVistaPrevia();
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState<string | null>(null);
  const [nombresArea, setNombresArea] = useState<Record<string, string>>({});
  // En Ver como el perfil llega con el rol del cliente, así que esto es FIRMA mirando todos los clientes.
  const esAdmin = perfil.rol === 'admin';
  const enProtocolos = ruta === '/portal/protocolos';
  const seccion = seccionDeRuta(ruta);
  const orgId = esAdmin ? null : (organizacion?.id ?? null);
  const [filtroOrg, setFiltroOrg] = useState(empresaInicial);
  const [busqueda, setBusqueda] = useState('');
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([]);
  // La empresa elegida por FIRMA, cuando es una sola: con ella se ven los contratos de su equipo.
  const unaEmpresa = esAdmin && filtroOrg !== TODAS && filtroOrg !== GENERALES ? filtroOrg : null;
  const nombreEmpresa = (id: string | null) => (id ? (empresas.find((e) => e.id === id)?.nombre ?? 'Cliente') : 'Biblioteca común');
  const rotuloFiltro = filtroOrg === TODAS ? 'Todos los clientes' : filtroOrg === GENERALES ? 'Biblioteca común' : nombreEmpresa(filtroOrg);
  const consulta = esAdmin && filtroOrg !== TODAS ? `?empresa=${filtroOrg}` : '';

  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    supabase
      .from('documentos')
      .select('*')
      .eq('activo', true)
      .order('actualizado_en', { ascending: false })
      .then(({ data, error: e }) => {
        if (!vivo) return;
        if (e) setError(esAdmin ? `${e.message}. Revisá que la migración 0005_documentos.sql esté corrida en Supabase.` : 'No pudimos cargar los documentos. Probá recargar la página.');
        setDocs((data as Documento[]) ?? []);
      });
    if (esAdmin)
      void supabase
        .from('organizaciones')
        .select('id, nombre')
        .order('nombre')
        .then(({ data }) => {
          if (vivo && data) setEmpresas(data as { id: string; nombre: string }[]);
        });
    void supabase
      .from('areas')
      .select('clave, nombre')
      .then(({ data }) => {
        if (vivo && data) setNombresArea(Object.fromEntries((data as { clave: string; nombre: string }[]).map((a) => [a.clave, a.nombre])));
      });
    return () => {
      vivo = false;
    };
  }, [esAdmin]);

  // El cliente que elige FIRMA queda en la dirección, así se mantiene al recargar.
  useEffect(() => {
    if (!esAdmin) return;
    const destino = `${window.location.pathname}${consulta}`;
    if (window.location.pathname + window.location.search !== destino) window.history.replaceState(window.history.state, '', destino);
  }, [esAdmin, consulta, ruta]);

  // FIRMA ve lo de cada empresa con la misma regla que esa empresa, y lo filtra por cliente y por texto.
  const q = normalizar(busqueda.trim());
  const disponibles = (docs ?? []).filter((d) => {
    if (!visibleEnPantalla(d, perfil.rol, perfil.areas ?? [], esAdmin ? d.organizacion_id : orgId)) return false;
    if (esAdmin && filtroOrg === GENERALES && d.organizacion_id !== null) return false;
    if (unaEmpresa && d.organizacion_id !== unaEmpresa) return false;
    return !q || [d.titulo, d.descripcion, d.archivo_nombre].some((t) => normalizar(t).includes(q));
  });
  const protocolos = disponibles.filter((d) => d.es_protocolo);
  // Los protocolos tienen su propia vista y no se repiten en las secciones de documentos.
  const visibles = disponibles.filter((d) => !d.es_protocolo);
  // Los contratos atados a una persona del equipo (0068) salen arriba, en su bloque, con nombre, rol y vencimiento.
  // Ese bloque es de una empresa: FIRMA lo ve al elegir un cliente y, con todos, esos contratos van en la lista.
  const orgEquipo = esAdmin ? unaEmpresa : orgId;
  const deEquipo = visibles.filter((d) => d.seccion === 'equipo' && d.equipo_miembro_id);
  const lista = enProtocolos ? protocolos : visibles.filter((d) => d.seccion === seccion.clave && (!d.equipo_miembro_id || (esAdmin && !unaEmpresa)));
  const cuenta = (clave: string) => visibles.filter((d) => d.seccion === clave).length;
  // Quien no es titular ve solo las secciones donde tiene documentos y nunca el aviso laboral, que es para el titular.
  const esMiembro = perfil.rol !== 'admin' && perfil.rol !== 'titular';
  const pestanas = esMiembro && docs ? SECCIONES.filter((s) => s.clave === seccion.clave || cuenta(s.clave) > 0) : SECCIONES;
  const mostrarAviso = !(esMiembro && seccion.clave === 'equipo');

  async function descargar(d: Documento) {
    setBajando(d.id);
    setError(null);
    const fallo = await descargarArchivo(d);
    setBajando(null);
    if (fallo) return setError(fallo);
    if (!vista) registrarDescarga(d);
  }

  return (
    <Marco perfil={perfil}>
      {enProtocolos ? (
        <Encabezado
          grande
          eyebrow={esAdmin ? `Protocolos · ${rotuloFiltro}` : 'Protocolos de tu equipo'}
          titulo={
            <>
              Un contrato no es desconfianza. <span className="text-bosque whitespace-nowrap">Es claridad.</span>
            </>
          }
          bajada={
            esAdmin
              ? 'Así ven tus clientes los protocolos y la formación. Cada persona ve solo los de sus áreas.'
              : 'Cómo trabaja cada área de tu equipo, en video y por escrito. Miralo antes de una llamada, un cobro o un reclamo.'
          }
          acciones={
            esAdmin ? (
              <Enlace a={`/portal/admin/documentos${consulta}`} className={claseAdministrar}>
                Administrar protocolos
              </Enlace>
            ) : undefined
          }
        />
      ) : (
        <Encabezado
          eyebrow={esAdmin ? `Documentos · ${rotuloFiltro}` : 'Documentos'}
          titulo={
            esAdmin ? (
              <>
                Biblioteca de <span className="text-bosque">documentos</span>
              </>
            ) : (
              <>
                Tus contratos, <span className="text-bosque whitespace-nowrap">siempre a mano.</span>
              </>
            )
          }
          bajada={
            esAdmin
              ? 'Los documentos de cada cliente y la biblioteca común. Elegí un cliente para ver solo lo suyo.'
              : 'Los modelos que redactamos para tu negocio, siempre en su última versión. Cuando FIRMA actualiza uno, acá ya está el nuevo.'
          }
          acciones={
            esAdmin ? (
              <Enlace a={`/portal/admin/documentos${consulta}`} className={claseAdministrar}>
                Administrar documentos
              </Enlace>
            ) : undefined
          }
        />
      )}

      <section className="section">
        <div className="wrap flex flex-col gap-7">
          {esAdmin && (
            <div className="flex flex-wrap items-end gap-3">
              <SearchField aria-label="Buscar documentos" value={busqueda} onChange={setBusqueda} className="flex-1 min-w-[220px] max-w-[420px]">
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Buscar por título o archivo" />
                  <SearchField.ClearButton aria-label="Borrar la búsqueda" />
                </SearchField.Group>
              </SearchField>
              <Select value={filtroOrg} onChange={(v) => setFiltroOrg(v ? String(v) : TODAS)} className="w-full tab:w-[280px]">
                <Label className="text-[12.5px] font-medium text-piedra">Cliente</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {[[TODAS, 'Todos los clientes'], [GENERALES, 'Biblioteca común'], ...empresas.map((e) => [e.id, e.nombre])].map(([valor, texto]) => (
                      <ListBox.Item key={valor} id={valor} textValue={texto}>
                        {texto}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          )}

          {!enProtocolos && (
            <PestanasEnlace
              etiqueta="Secciones de documentos"
              items={pestanas.map((s) => ({ a: `${s.ruta}${consulta}`, titulo: s.titulo, cuenta: docs ? cuenta(s.clave) : undefined, activa: s.clave === seccion.clave }))}
            />
          )}

          {!enProtocolos && (
            <div className="grid gap-6 desk:grid-cols-2 desk:items-start">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading font-semibold text-[20px] leading-tight">{seccion.titulo}</h2>
                <p className="text-piedra text-[15px] leading-[1.55] max-w-[52ch]">{seccion.bajada}</p>
              </div>
              {mostrarAviso && (
                <div className="border-l-[3px] border-bosque bg-papel px-5 py-4 flex flex-col gap-1.5 max-w-[62ch]">
                  <span className="text-[13px] font-medium text-tinta">{seccion.avisoTitulo}</span>
                  <p className="text-[14px] leading-[1.55] text-piedra">{seccion.aviso}</p>
                </div>
              )}
            </div>
          )}

          {error && <Aviso tipo="error">{error}</Aviso>}

          {/* El pedido de contrato abre un asunto, así que lo completan quienes ven los asuntos. FIRMA lo ve en vista previa. */}
          {!enProtocolos && seccion.clave === 'equipo' && permisosDe(perfil.rol).casos && <PedidosEquipo key={`pedidos-${orgEquipo ?? 'ninguna'}`} orgId={orgEquipo} vistaPrevia={esAdmin || Boolean(vista)} />}

          {/* Los contratos del equipo mandados a firmar (0064). Traen honorarios: solo titular, Legales y Operaciones. */}
          {/* FIRMA los ve al elegir un cliente, solo para mirar: los envía cada empresa desde Firmas. */}
          {!enProtocolos && seccion.clave === 'equipo' && orgEquipo && generaContratos(perfil) && (
            <ContratosEquipoFirmados
              key={`contratos-${orgEquipo}`}
              orgId={orgEquipo}
              puedeEnviar={!vista && !esAdmin}
              docs={deEquipo}
              bajandoDoc={bajando}
              alDescargarDoc={(d) => void descargar(d)}
              alAbrirDoc={(d) => {
                if (!vista) registrarDescarga(d);
              }}
            />
          )}

          {docs === null ? (
            <p className="text-[14px] text-piedra">Cargando documentos…</p>
          ) : lista.length === 0 && !enProtocolos && seccion.clave === 'equipo' && deEquipo.length > 0 ? null : lista.length === 0 ? (
            esAdmin && q ? (
              <div className="p-tarjeta flex flex-col gap-3 p-6 desk:p-8 max-w-[680px]">
                <p className="font-heading font-semibold text-[18px]">No hay documentos que coincidan con «{busqueda.trim()}»</p>
                <p className="text-[15px] leading-[1.6] text-piedra">Probá con otra palabra o borrá la búsqueda.{filtroOrg !== TODAS ? ` Estás mirando ${rotuloFiltro}.` : ''}</p>
                <button type="button" className={`${claseSecundaria} self-start`} onClick={() => setBusqueda('')}>
                  Borrar la búsqueda
                </button>
              </div>
            ) : (
              <div className="p-tarjeta flex flex-col gap-3 p-6 desk:p-8 max-w-[680px]">
                <p className="font-heading font-semibold text-[18px]">
                  {!esAdmin
                    ? enProtocolos
                      ? 'Todavía no hay protocolos para tu área'
                      : 'Esta sección todavía no tiene documentos'
                    : unaEmpresa
                      ? `${rotuloFiltro} no tiene ${enProtocolos ? 'protocolos propios' : 'documentos propios en esta sección'}`
                      : filtroOrg === GENERALES
                        ? `La biblioteca común no tiene ${enProtocolos ? 'protocolos' : 'documentos en esta sección'}`
                        : 'Todavía no cargaste documentos acá'}
                </p>
                <p className="text-[15px] leading-[1.6] text-piedra">
                  {!esAdmin
                    ? 'Si necesitás un modelo para un caso puntual, contanos en una reunión y lo redactamos.'
                    : unaEmpresa
                      ? `Ve los de la biblioteca común${enProtocolos ? '' : ' y los contratos de su equipo, si tiene'}. Los propios se cargan desde Administración.`
                      : 'Cargalos desde Administración, en la pestaña Documentos.'}
                </p>
                <Enlace a={esAdmin ? `/portal/admin/documentos${consulta}` : '/portal/agenda'} className={`${claseSecundaria} self-start`}>
                  {!esAdmin ? 'Agendar una reunión' : unaEmpresa ? `Cargar un documento para ${rotuloFiltro}` : 'Cargar documentos'}
                </Enlace>
              </div>
            )
          ) : enProtocolos ? (
            <div className="grid grid-cols-1 wide:grid-cols-2 gap-x-6 gap-y-8">
              {lista.map((d) => (
                <TarjetaProtocolo
                  key={d.id}
                  doc={d}
                  areas={nombresArea}
                  bajando={bajando === d.id}
                  alDescargar={(x) => void descargar(x)}
                  alAbrir={(x) => {
                    if (!vista) registrarDescarga(x);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 tab:grid-cols-2 gap-4 desk:gap-5">
              {lista.map((d) => {
                const Icono = iconoDe(d);
                const peso = tamano(d.archivo_bytes);
                const version = d.version?.trim().replace(/^v(ersi[oó]n)?\s*/i, '');
                return (
                  <article key={d.id} className="p-tarjeta flex flex-col gap-2.5 p-5 desk:p-6 transition-colors duration-150 hover:border-borde">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="w-10 h-10 rounded-[12px] grid place-items-center bg-niebla text-tinta shrink-0">
                        <Icono size={20} strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <span className="text-[12.5px] text-piedra">
                        {formatoDe(d)}
                        {peso ? ` · ${peso}` : ''}
                      </span>
                      {esAdmin ? (
                        <span className={`ml-auto px-2.5 py-[3px] rounded-pastilla text-[12px] font-semibold whitespace-nowrap ${d.organizacion_id ? 'bg-tinta text-marfil' : 'bg-niebla text-tinta'}`}>{nombreEmpresa(d.organizacion_id)}</span>
                      ) : (
                        d.organizacion_id && <span className="ml-auto px-2.5 py-[3px] rounded-pastilla bg-tinta text-marfil text-[12px] font-semibold whitespace-nowrap">Exclusivo para tu empresa</span>
                      )}
                    </div>
                    <h3 className="font-heading font-semibold text-[18px] leading-snug">{d.titulo}</h3>
                    {d.descripcion && <p className="text-[14px] leading-[1.55] text-piedra">{d.descripcion}</p>}
                    <p className="text-[13px] text-piedra">
                      {version ? `Versión ${version} · ` : ''}Actualizado el {fechaLarga(d.actualizado_en)}
                    </p>
                    <div className="mt-auto pt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                      {d.archivo_ruta ? (
                        <button type="button" className={claseAccion} onClick={() => descargar(d)} disabled={bajando === d.id} aria-label={`Descargar ${d.titulo}`}>
                          <ArrowDown size={16} aria-hidden="true" />
                          {bajando === d.id ? 'Preparando' : 'Descargar'}
                        </button>
                      ) : d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={claseAccion}
                          aria-label={`Abrir ${d.titulo}`}
                          onClick={() => {
                            if (!vista) registrarDescarga(d);
                          }}
                        >
                          <ArrowUpRight size={16} aria-hidden="true" />
                          Abrir
                        </a>
                      ) : null}
                      {!esAdmin && (
                        <Enlace a="/portal/agenda" className={claseSecundaria}>
                          Pedir adaptación
                        </Enlace>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </Marco>
  );
};

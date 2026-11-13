import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, FileSpreadsheet, FileText, Globe, Link2, Presentation } from 'lucide-react';
import { supabase } from './supabase';
import { Aviso, Encabezado, Enlace, Marco } from './ui';
import { useVistaPrevia } from './vistaPrevia';
import { PedidosEquipo } from './pedidos/Pedidos';
import { TarjetaProtocolo } from './TarjetaProtocolo';
import { ContratosEquipoFirmados } from './firmas/ContratosEquipo';
import { generaContratos, permisosDe } from './tipos';
import { SECCIONES, descargarArchivo, extension, fechaLarga, formatoDe, registrarDescarga, seccionDeRuta, tamano, visibleEnPantalla } from './descargas';
import type { Documento, Organizacion, Perfil } from './tipos';

/**
 * Documentos del cliente en tres secciones, cada una con su ruta, y los
 * protocolos y la formación en una vista aparte.
 *   /portal/documentos          contratos de servicio
 *   /portal/documentos/equipo   contratos con el equipo
 *   /portal/documentos/otros    otros documentos
 *   /portal/protocolos          protocolos y formación (es_protocolo)
 * La base decide qué ve cada usuario. El admin, sin Ver como, ve la biblioteca común.
 */

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

const claseAccion =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[10px] bg-bosque text-marfil text-[14px] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-bosque-dark disabled:opacity-60 disabled:cursor-wait';
const claseSecundaria =
  'inline-flex items-center min-h-[40px] text-[14px] font-medium text-bosque underline underline-offset-4 decoration-bosque/30 transition-colors duration-150 hover:decoration-bosque';
const claseAdministrar = 'inline-flex items-center h-11 px-5 rounded-control text-[14.5px] font-medium bg-bosque text-marfil transition-colors duration-150 hover:bg-bosque-dark';

export const Documentos: React.FC<{ perfil: Perfil; organizacion: Organizacion | null; ruta: string }> = ({ perfil, organizacion, ruta }) => {
  const vista = useVistaPrevia();
  const [docs, setDocs] = useState<Documento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState<string | null>(null);
  const [nombresArea, setNombresArea] = useState<Record<string, string>>({});
  // En Ver como el perfil llega con el rol del cliente, así que esto es el admin mirando la biblioteca común.
  const esAdmin = perfil.rol === 'admin';
  const enProtocolos = ruta === '/portal/protocolos';
  const seccion = seccionDeRuta(ruta);
  const orgId = esAdmin ? null : (organizacion?.id ?? null);

  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    supabase
      .from('documentos')
      .select('*')
      .eq('activo', true)
      .order('orden')
      .order('titulo')
      .then(({ data, error: e }) => {
        if (!vivo) return;
        if (e) setError(esAdmin ? `${e.message}. Revisá que la migración 0005_documentos.sql esté corrida en Supabase.` : 'No pudimos cargar los documentos. Probá recargar la página.');
        setDocs((data as Documento[]) ?? []);
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

  const disponibles = (docs ?? []).filter((d) => visibleEnPantalla(d, perfil.rol, perfil.areas ?? [], orgId));
  const protocolos = disponibles.filter((d) => d.es_protocolo);
  // Los protocolos tienen su propia vista y no se repiten en las secciones de documentos.
  const visibles = disponibles.filter((d) => !d.es_protocolo);
  const lista = enProtocolos ? protocolos : visibles.filter((d) => d.seccion === seccion.clave);
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
          eyebrow={esAdmin ? 'Protocolos · Biblioteca común' : 'Protocolos de tu equipo'}
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
              <Enlace a="/portal/admin/documentos" className={claseAdministrar}>
                Administrar protocolos
              </Enlace>
            ) : undefined
          }
        />
      ) : (
        <Encabezado
          eyebrow={esAdmin ? 'Documentos · Biblioteca común' : 'Documentos'}
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
              ? 'Así ven tus clientes la biblioteca común. Los documentos exclusivos de cada empresa se ven con Ver como.'
              : 'Los modelos que redactamos para tu negocio, siempre en su última versión. Cuando FIRMA actualiza uno, acá ya está el nuevo.'
          }
          acciones={
            esAdmin ? (
              <Enlace a="/portal/admin/documentos" className={claseAdministrar}>
                Administrar documentos
              </Enlace>
            ) : undefined
          }
        />
      )}

      <section className="section">
        <div className="wrap flex flex-col gap-7">
          {!enProtocolos && (
            <nav aria-label="Secciones de documentos" className="flex gap-7 overflow-x-auto scrollbar-hide border-b border-borde-suave">
              {pestanas.map((s) => {
                const activa = s.clave === seccion.clave;
                return (
                  <Enlace
                    key={s.clave}
                    a={s.ruta}
                    aria-current={activa ? 'page' : undefined}
                    className={`inline-flex items-center gap-1.5 min-h-[44px] -mb-px text-[14.5px] font-medium whitespace-nowrap border-b-2 transition-colors duration-150 ${activa ? 'border-bosque text-bosque' : 'border-transparent text-piedra hover:text-tinta'}`}
                  >
                    {s.titulo}
                    {docs && (
                      <span className={`min-w-[20px] h-[20px] px-1.5 grid place-items-center rounded-pastilla tabular-nums text-[11.5px] ${activa ? 'bg-bosque-suave text-bosque' : 'bg-separador text-piedra'}`}>{cuenta(s.clave)}</span>
                    )}
                  </Enlace>
                );
              })}
            </nav>
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
          {!enProtocolos && seccion.clave === 'equipo' && permisosDe(perfil.rol).casos && <PedidosEquipo orgId={orgId} vistaPrevia={esAdmin || Boolean(vista)} />}

          {/* Los contratos del equipo mandados a firmar (0064). Traen honorarios: solo titular, Legales y Operaciones. */}
          {!enProtocolos && seccion.clave === 'equipo' && orgId && generaContratos(perfil) && <ContratosEquipoFirmados orgId={orgId} puedeEnviar={!vista} />}

          {docs === null ? (
            <p className="text-[14px] text-piedra">Cargando documentos…</p>
          ) : lista.length === 0 ? (
            <div className="p-tarjeta flex flex-col gap-3 p-6 desk:p-8 max-w-[680px]">
              <p className="font-heading font-semibold text-[18px]">{esAdmin ? 'Todavía no cargaste documentos acá' : enProtocolos ? 'Todavía no hay protocolos para tu área' : 'Esta sección todavía no tiene documentos'}</p>
              <p className="text-[15px] leading-[1.6] text-piedra">
                {esAdmin ? 'Cargalos desde Administración, en la pestaña Documentos.' : 'Si necesitás un modelo para un caso puntual, contanos en una reunión y lo redactamos.'}
              </p>
              <Enlace a={esAdmin ? '/portal/admin/documentos' : '/portal/agenda'} className={`${claseSecundaria} self-start`}>
                {esAdmin ? 'Cargar documentos' : 'Agendar una reunión'}
              </Enlace>
            </div>
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
                      {d.organizacion_id && <span className="ml-auto px-2.5 py-[3px] rounded-pastilla bg-tinta text-marfil text-[12px] font-semibold whitespace-nowrap">Exclusivo para tu empresa</span>}
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
